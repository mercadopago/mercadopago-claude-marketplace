#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const extensions = new Set([
  '.html', '.htm', '.jsx', '.tsx', '.vue', '.svelte', '.astro',
  '.js', '.ts', '.php', '.phtml', '.erb', '.ejs', '.hbs', '.handlebars', '.twig',
]);
const ignoredDirs = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'vendor', '.venv', 'venv',
  'dist', 'build', 'out', 'target', 'coverage', '.next', '.nuxt', '.cache', '.turbo',
]);
const maxSourceBytes = 1024 * 1024;

function collectFiles(directory) {
  const files = [];
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(absolute));
    else if (extensions.has(path.extname(entry.name).toLowerCase())) {
      try {
        if (fs.statSync(absolute).size <= maxSourceBytes) files.push(absolute);
      } catch {
        // Ignore unreadable or concurrently removed files.
      }
    }
  }
  return files.sort();
}

function stripMarkup(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attribute(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1] || '';
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function selectorFor(attrs, tag) {
  const id = attribute(attrs, 'id');
  if (id) return `#${id}`;
  const testId = attribute(attrs, 'data-testid');
  if (testId) return `[data-testid="${testId}"]`;
  const className = attribute(attrs, 'class') || attribute(attrs, 'className');
  if (className) return `.${className.trim().split(/\s+/)[0]}`;
  return tag.toLowerCase();
}

const files = collectFiles(root);
const sources = files.map(file => ({ file, source: fs.readFileSync(file, 'utf8') }));
const strongText = /\b(checkout|finalizar(?:\s+(?:compra|pedido))?|concluir(?:\s+(?:compra|pedido))?|confirmar\s+(?:compra|pedido)|proceder\s+(?:al|ao)\s+pago|proceder\s+ao\s+pagamento|ir\s+(?:al|ao|para o)\s+pagamento|continuar\s+(?:al|ao|para o)\s+pagamento|proceed\s+to\s+(?:checkout|payment)|continue\s+to\s+(?:checkout|payment)|go\s+to\s+checkout|complete\s+(?:order|purchase)|place\s+order|buy\s+now|comprar\s+agora|pay\s+now|pagar\s+agora|pagar\s+com\s+mercado\s+pago|mercado\s+pago|realizar\s+(?:pago|pagamento))\b/i;
const checkoutToken = /checkout|finaliz|payment|pagamento|pago|pagar|pay/i;
const navigation = /(?:href\s*=|navigate\s*\(|router\.(?:push|replace)\s*\(|goTo\s*\(|location(?:\.href|\.assign|\.replace)?\s*[=(]).{0,160}(?:checkout|payment|pagamento|pago)/is;
const checkoutLaunch = /createPreference|preference|init_point|checkoutPro|mercadoPago|\/checkout\b/i;
const paymentExecution = /fetch\s*\(|axios\.|createPayment|processPayment|submitPayment|tokeniz|initCheckout|createCardToken/i;
const tagPattern = /<(button|a|[A-Z][\w.]*(?:Button|Link))\b([^>]*)>([\s\S]*?)<\/\1>/g;
const candidates = [];

for (const { file, source } of sources) {
  // JSX arrow functions contain `=>` inside attributes. Preserve string length
  // while preventing `>` from being mistaken for the end of the opening tag.
  const tagSource = source.replace(/=>/g, '=›');
  for (const match of tagSource.matchAll(tagPattern)) {
    const [raw, tag, attrs, body] = match;
    const text = stripMarkup(body);
    const id = attribute(attrs, 'id');
    const identifier = `${id} ${attribute(attrs, 'class')} ${attribute(attrs, 'className')} ${attribute(attrs, 'name')} ${attribute(attrs, 'aria-label')} ${attribute(attrs, 'data-testid')}`;
    const start = match.index;
    const lastFormOpen = source.lastIndexOf('<form', start);
    const lastFormClose = source.lastIndexOf('</form>', start);
    const insideForm = lastFormOpen > lastFormClose;
    let related = `${attrs}\n${text}`;

    const className = attribute(attrs, 'class') || attribute(attrs, 'className');
    const testId = attribute(attrs, 'data-testid');
    const namedHandler = attrs.match(/(?:onClick|onclick|@click|v-on:click|on:click)\s*=\s*(?:\{\s*)?["']?([A-Za-z_$][\w$]*)/i)?.[1];
    const searchKeys = [id, testId, namedHandler, className.trim().split(/\s+/)[0]].filter(Boolean);

    if (searchKeys.length) {
      for (const item of sources) {
        const lines = item.source.split('\n');
        lines.forEach((line, index) => {
          if (!searchKeys.some(key => line.includes(key))) return;
          related += `\n${lines.slice(Math.max(0, index - 2), index + 3).join('\n')}`;
        });
      }
    }

    let score = 0;
    const reasons = [];
    const hasStrongText = strongText.test(text);
    const hasCheckoutAttribute = checkoutToken.test(identifier);
    if (hasStrongText) { score += 4; reasons.push('checkout intent in visible text'); }
    if (hasCheckoutAttribute) { score += 2; reasons.push('checkout intent in attributes'); }
    if (navigation.test(related)) { score += 5; reasons.push('handler navigates to checkout'); }
    if (checkoutLaunch.test(related)) { score += 5; reasons.push('handler starts hosted checkout'); }
    if (/type\s*=\s*["']submit["']/i.test(attrs)) { score -= 8; reasons.push('form submit excluded'); }
    if (insideForm) { score -= 3; reasons.push('inside a form'); }
    if (paymentExecution.test(related) && !navigation.test(related) && !checkoutLaunch.test(related)) { score -= 6; reasons.push('executes payment instead of opening checkout'); }

    // A handler can reference checkout code elsewhere in the same component.
    // Require semantic evidence on the element itself so arrows, carousel
    // controls, and other generic navigation buttons never become CTAs.
    if (!hasStrongText && !hasCheckoutAttribute) continue;
    if (score <= 0) continue;
    candidates.push({
      file: path.relative(root, file) || path.basename(file),
      line: lineNumber(source, start),
      selector: selectorFor(attrs, tag),
      tag,
      text,
      score,
      reasons,
      snippet: raw.replace(/\s+/g, ' ').slice(0, 240),
    });
  }
}

candidates.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || a.line - b.line);
const qualified = candidates.filter(candidate => candidate.score >= 7);
let status = 'not_found';
let selected = null;

if (qualified.length === 1 || (qualified.length > 1 && qualified[0].score - qualified[1].score >= 3)) {
  status = 'selected';
  selected = qualified[0];
} else if (qualified.length > 1) {
  status = 'ambiguous';
}

process.stdout.write(`${JSON.stringify({ status, selected, candidates: qualified.slice(0, 8) }, null, 2)}\n`);
