---
name: mp-migrate
description: Migrates existing Mercado Pago Instore integrations (QR Code and Point) from legacy APIs to the Orders API. Scans the project, identifies legacy patterns, proposes a diff, and applies changes only after explicit confirmation.
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
metadata:
  version: "4.3.2"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, migration, orders-api, instore, qr, point"
---

# mp-migrate

Migrates existing Mercado Pago **Instore** integrations (QR Code and Point) from legacy APIs to the Orders API.
**Never modifies any file without showing the diff and receiving explicit confirmation first.**

**Language rule:** always respond in the language the developer used — detect from their first message and keep throughout the entire interaction, including diff annotations, code comments, AskUserQuestion text, post-migration warnings, and the `migration-proposal.md` file. Never mix languages.

---

## Supported migrations — Instore only

| Product | Legacy pattern detected | Target |
|---------|------------------------|--------|
| QR Instore (Órdenes presenciales) | `POST /mpmobile/instore/qr/{user_id}/{external_id}` | `POST /v1/orders` |
| QR Instore V2 (Órdenes presenciales V2) | `PUT /instore/qr/seller/collectors/{user_id}/stores/{store_id}/pos/{pos_id}/qrs` | `POST /v1/orders` |
| QR Dinámico | `POST /instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs` and/or `PUT /instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs` | `POST /v1/orders` |
| MP Point (PDV + Self Service) | `POST /point/integration-api/devices/{deviceId}/payment-intents` | `POST /v1/orders` |

> **Note — MP Point:** PDV and Self Service modes use the same legacy endpoint. The migration path is identical for both. What differs between the two modes is terminal configuration, not the API.

> **Note — QR Instore vs V2:** these are two different generations of the same legacy Instore product with different endpoints. Both migrate to `POST /v1/orders`.

**Out of scope — do NOT migrate:**
- Checkout Pro, Checkout API / CHAPI, Bricks, Marketplace, Subscriptions → Online products excluded from scope
- `POST /checkout/preferences` → Checkout Pro (no Orders API)
- `preapproval` endpoints → Subscriptions (no Orders API)
- Files with `CardPayment` or `onSubmit` → Bricks uses `/v1/payments` correctly

---

## Step 0 — MCP connection on demand

All official migration docs are public URLs — WebFetch works without MCP authentication. The core migration proceeds fully offline. MCP is required only for the optional webhook-topic update.

The only MCP-backed action in this skill is updating the webhook topic with `save_webhook`. Do not check connection state unless the developer first chooses that action.

**MCP authentication rules (apply immediately before `save_webhook`):**

1. **URL presentation — clickable link only:**
   ```
   > Abra este link para conectar ao Mercado Pago:
   > **[Conectar ao Mercado Pago]({url})**
   >
   > Use Cmd+Click (Mac) ou Ctrl+Click (Windows/Linux). Não copie e cole a URL em um navegador externo.
   ```

2. **Retry limit — maximum 2 authenticate attempts total per session:**
   - Call `authenticate` → show URL → wait for user to return.
   - When the user returns, retry `save_webhook` directly. If it still returns an authentication error, call `authenticate` once more and show the URL again.
   - After 2 failed attempts → **stop retrying immediately** and ask via `AskUserQuestion`:
     ```
     header: "Conexão com MCP"
     Question: "Houve um problema na autenticação. O que deseja fazer?"
     Options:
       - "Tentar novamente"
       - "Continuar sem MCP (modo limitado — sem credenciais automáticas)"
       - "Cancelar"
     ```
   - "Tentar novamente" → one final attempt only, then offer fallback regardless.
   - "Continuar sem MCP" → proceed in offline mode, note limitations inline.
   - Never attempt `authenticate` more than 2 times in a session.

---

## Step 0.5 — Resolve country

The country determines which domain to use for WebFetch doc lookups. Resolve in this order — stop at the first match:

1. Read `.mp-integrate-progress.md` in the project root → use `country:` field if present.
2. Grep the project for domain signals: `mercadopago.com.br` → BR, `mercadopago.com.ar` → AR, `mercadopago.com.mx` → MX, `mercadopago.cl` → CL, `mercadopago.com.co` → CO, `mercadopago.com.pe` → PE, `mercadopago.com.uy` → UY.
3. If still unresolved → ask via `AskUserQuestion`:

```
AskUserQuestion:
  header: "País"
  Question: "Qual é o país da sua integração?"
  Options:
    - "Brasil (MLB)"
    - "Argentina (MLA)"
    - "México (MLM)"
    - "Colombia (MCO)"
    - "Chile (MLC)"
    - "Peru (MPE)"
    - "Uruguay (MLU)"
```

Store the resolved country as `{country}` and derive `{country_domain}`:

| Country | Domain |
|---------|--------|
| BR (MLB) | `www.mercadopago.com.br` |
| AR (MLA) | `www.mercadopago.com.ar` |
| MX (MLM) | `www.mercadopago.com.mx` |
| CO (MCO) | `www.mercadopago.com.co` |
| CL (MLC) | `www.mercadopago.cl` |
| PE (MPE) | `www.mercadopago.com.pe` |
| UY (MLU) | `www.mercadopago.com.uy` |

Persist to `.mp-integrate-progress.md` if not already there.

---

## Step 1 — Scan project for legacy Instore patterns

Run `Grep`/`Glob` for each pattern:

```
QR Instore:      /mpmobile/instore/qr
QR Instore V2:   /instore/qr/seller/collectors
QR Dinámico:     /instore/orders/qr/seller/collectors
Point:           /point/integration-api/devices/.*/payment-intents
Refund:          /v1/payments/.*/refunds
Webhook topic 1: point_integration_wh
Webhook topic 2: merchant_order
Webhook state:   state === 'FINISHED'\|state === 'ERROR'\|state === 'CANCELED'\|state === 'ON_TERMINAL'\|{ state,
QR cancel (DELETE): app\.delete\|router\.delete
```

**QR cancel scope:** grep `app.delete` and `router.delete` across ALL files — not just files with legacy QR URLs. A cancel route may be in a different file. When found in the context of a QR integration, include it in the migration scope and **always rewrite it as `app.post` / `router.post`** in the diff. Do NOT preserve `DELETE` as the route method even if the legacy code used it — body is silently discarded by many HTTP clients (browser fetch, nginx, AWS ALB, Cloudflare) on DELETE requests, making `req.body` unreliable. The integrator's own route method is an internal decision; `POST` is always safe.

For each match, record: `{ file, line, pattern, context_snippet }`.

**Refund scope:** only flag `/v1/payments/{id}/refunds` when it co-exists in the same project as Point or QR legacy patterns. A standalone Payments API refund unrelated to Instore is out of scope.

**Webhook topic scope:** grep `point_integration_wh` AND `merchant_order` across the **entire project** — not just webhook handler files. Both topics must be migrated to `orders` in every file they appear (config, constants, notification setup, env, etc.).

**Webhook fetch URL:** when migrating a handler that checks `type === 'merchant_order'` and fetches data from `/merchant_orders/${data.id}`, also replace that URL with `/v1/orders/${data.id}`. The `/merchant_orders` endpoint returns the legacy structure (no `status` field) — using it after migrating the topic makes all status checks fail silently.
```js
// ❌ BEFORE — fetches legacy structure, status is undefined
fetch(`https://api.mercadopago.com/merchant_orders/${data.id}`, ...)
// ✅ AFTER — correct endpoint for Orders API topic
fetch(`https://api.mercadopago.com/v1/orders/${data.id}`, ...)
```

**Webhook state variable scope:** grep for `{ state,` or `state,` in destructuring patterns AND legacy status values (`'FINISHED'`, `'ERROR'`, `'CANCELED'`, `'ON_TERMINAL'`). When found:
- Rename destructured variable: `const { state, ... }` → `const { status, ... }` 
- Replace all status checks: `state === 'FINISHED'` → `status === 'processed'`, `state === 'ERROR'` → `status === 'failed'`, `state === 'CANCELED'` → `status === 'canceled'`, `state === 'ON_TERMINAL'` → `status === 'at_terminal'`
- **Always generate all five status branches** — including `refunded` and `expired`, even when absent from the legacy code. Any missing branch causes silent event discard.
- **Dedup key must be `requestId`** (the unique delivery ID from MP), NOT `${type}:${data?.id}`. Using `type:id` as key discards the second event for the same order (e.g. refund after payment) because both webhooks carry identical `type` and `data.id`.
- **Mark dedup only after successful processing** — add to `processedEvents` only after the Orders API fetch succeeds and `r.ok` is true. Marking before the fetch means a network failure permanently loses the event on retry.
- **`orderStore.delete` on terminal statuses** — call `orderStore.delete(external_reference)` for `canceled`, `expired`, and `refunded`. Omitting it leaves orphan entries in memory indefinitely.

```js
import crypto from 'node:crypto';

// ✅ Required shape — always generate this exact structure
app.post('/webhooks', (req, res) => {
  // HMAC-SHA256 signature validation (canonical pattern from mp-webhooks)
  const signature = req.header('x-signature') ?? '';
  const requestId = req.header('x-request-id') ?? '';
  const parts = Object.fromEntries(
    signature.split(',').map((p) => p.split('=').map((s) => s.trim()))
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  const dataId = req.body?.data?.id;
  if (!ts || !v1 || !dataId || !requestId) return res.status(400).end();
  const canonical = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET).update(canonical).digest('hex');
  const valid = expected.length === v1.length &&
                crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  if (!valid) return res.status(401).end();

  const { type, data } = req.body;

  // Dedup by requestId — NOT by type:data.id (would discard refund after payment)
  if (processedEvents.has(requestId)) return res.sendStatus(200);

  res.sendStatus(200); // ack immediately to MP

  if (type === 'orders') {
    (async () => {
      const r = await fetch(`https://api.mercadopago.com/v1/orders/${data.id}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!r.ok) throw new Error(`Orders API error: ${r.status}`); // do NOT add to processedEvents on failure
      const order = await r.json();
      const { status, external_reference } = order;

      if (status === 'processed') { /* handle payment */ }
      if (status === 'canceled')  { orderStore.delete(external_reference); /* handle cancellation */ }
      if (status === 'refunded')  { orderStore.delete(external_reference); /* handle refund */ }
      if (status === 'failed')    { /* handle failure */ }
      if (status === 'expired')   { orderStore.delete(external_reference); /* handle expiry */ }

      processedEvents.add(requestId); // mark only after successful processing
    })();
  }
});
```
- This applies to every file in the project, not just the main webhook handler.

**Idempotency check:** if a file already contains `/v1/orders` → skip it and note: *"Already on Orders API."*

If **nothing found**:
> ✅ No legacy Instore API patterns found. Your integration is already using the current API.

---

## Step 2 — Identify product and migration source

Map each detected pattern to its product and documentation source:

| Pattern | Product | Documentation source |
|---------|---------|---------------------|
| `/mpmobile/instore/qr` | QR Instore (Órdenes presenciales) | WebFetch: `https://{country_domain}/developers/{lang}/docs/qr-code/migrate-instore-orders-to-orders` |
| `/instore/qr/seller/collectors` | QR Instore V2 (Órdenes presenciales V2) | WebFetch: `https://{country_domain}/developers/{lang}/docs/qr-code/migrate-instore-orders-v2-to-orders` |
| `/instore/orders/qr/seller/collectors` | QR Dinámico | WebFetch: `https://{country_domain}/developers/{lang}/docs/qr-code/migrate-dynamic-qr-model-to-orders` |
| `/point/integration-api/devices` | MP Point (PDV + Self Service) | WebFetch: `https://{country_domain}/developers/{lang}/docs/mp-point/migrate-payment-intent-to-orders` AND `https://{country_domain}/developers/{lang}/docs/mp-point-v2/migrate-payment-intent-to-orders` |
| `/v1/payments/.*/refunds` | Refund (associated with Point/QR) | No specific doc — mapping is straightforward (see below) |
| `point_integration_wh` (any file) | Webhook topic (Point) | No specific doc — direct string replacement: `point_integration_wh` → `orders` |

**Always fetch the doc before proposing the diff.** Never invent field mappings from training data.

If WebFetch returns 4xx/5xx → retry once, then inform the developer and do not propose a diff for that product.

---

## Step 3 — Build the field mapping

**Primary source: the WebFetch result from Step 2.** Use the fetched official migration doc to derive all field mappings, payload shapes, and breaking changes for the detected product.

**Fallback only — use `migrate-to-orders.md` when:**
- WebFetch returned 4xx/5xx and could not be retried successfully, OR
- The fetched page does not cover a specific product or operation (e.g. Refund, webhook topic)

Read `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/guides/migrate-to-orders.md` only in those cases. Claude Code resolves this to the active plugin version. Never search another marketplace or an installation cache. Never use it as the primary source when the live doc is available — the live doc is always more current.

---

## Step 3.6 — Ask about architectural decisions (before generating the diff)

These are decisions the developer must make — the plugin cannot infer them from code. Ask each one that applies **before** writing `migration-proposal.md`. Combine into a single `AskUserQuestion` call when possible, but never skip them.

### 3.6.a — Listing endpoint (Point only)

Trigger: project has `GET /point/integration-api/devices/{id}/payment-intents` or `GET /point/integration-api/payment-intents` (listing pattern).

```
AskUserQuestion:
  header: "Listagem de payment intents"
  Question: "A Orders API não tem equivalente direto para listar orders por terminal.
             Escolha como implementar essa funcionalidade na nova API:"
  Options:
    - "Persistir orderId — salvar o orderId retornado pelo POST /v1/orders e consultar individualmente via GET /v1/orders/{orderId} (Recomendado)"
    - "Filtrar por external_reference — usar prefixo por terminal e consultar GET /v1/orders?external_reference=<prefix>"
```

- Option 1 → generate storage snippet + `GET /v1/orders/{orderId}` replacement in diff
- Option 2 → generate `external_reference` prefix pattern + filter query in diff

### 3.6.b — Order ID storage

**QR cancel — always generate orderId storage (no trigger check needed):**

The legacy QR cancel endpoint (`DELETE .../pos/{external_pos_id}/qrs`) did NOT require an order ID — it canceled by POS. The Orders API cancel (`POST /v1/orders/{orderId}/cancel`) requires the `orderId` returned by `POST /v1/orders`. When migrating any QR cancel endpoint, **always** generate the storage pattern in the diff, even if the legacy code has no ID storage at all:

```js
// In the create endpoint — capture orderId
const data = await response.json();
// ⚠️ Store orderId — required for cancel/refund (Orders API does not cancel by POS)
orderStore.set(externalReference, data.id);

// In the cancel endpoint — retrieve orderId
const orderId = orderStore.get(externalReference);
if (!orderId) return res.status(404).json({ message: 'order not found in local store' });
```

Use an in-memory `Map` as the default storage pattern. Add a comment in the diff recommending persistence (DB/Redis) for production. Never leave the cancel endpoint reading `orderId` from a variable that was never populated.

**Cancel route must be `app.post`, never `app.delete`:** the integrator's own server endpoint for canceling a QR order must use `POST`, not `DELETE`. Many HTTP clients (browser `fetch()`, older axios, nginx proxies, AWS ALB, Cloudflare) silently discard the body on `DELETE` requests — so `req.body` arrives empty, `externalReference` is undefined, `orderStore.get` returns undefined, and the call goes to `/v1/orders/undefined/cancel`. This passes in Postman/curl tests (which send the body) but fails in production behind any proxy. The HTTP method of the integrator's own route is an internal decision — using `POST` makes the body reliable on all clients.

**Point ID storage — trigger: project has code that stores, logs, or compares `intentId`, `paymentIntentId`, `payment_intent_id`, or similar identifiers in variables, database calls, or response objects.**

```
AskUserQuestion:
  header: "Armazenamento de IDs"
  Question: "A Orders API retorna um orderId no lugar do intentId (formato diferente: alfanumérico, não UUID).
             Como você quer tratar os IDs existentes?"
  Options:
    - "Manter os dois — salvar ambos temporariamente durante a transição (Recomendado)"
    - "Substituir — passar a salvar orderId no lugar do intentId (IDs antigos perdem rastreabilidade)"
    - "Não tenho IDs salvos — pode substituir diretamente"
```

- Option 1 → replace variable names and storage calls in diff
- Option 2 → generate dual-storage pattern in diff
- Option 3 → replace directly, no special handling

### 3.6.c — external_reference constraints

Trigger: project has `external_reference` values that contain hyphens, special chars (`-`, `_`, `.`, `/`), or string length potentially > 64 chars (e.g. UUIDs with hyphens: `550e8400-e29b-41d4-a716-446655440000` = 36 chars, but with prefix could exceed 64).

Check: grep the project for `external_reference` values. If the value is a plain UUID with hyphens → flag it.

**sanitizeRef warning (always show when sanitization changes the value):** When the migration sanitizes `external_reference` (removes hyphens, truncates, etc.), it MUST show the change explicitly before applying:
```
⚠️  external_reference será alterado automaticamente:
    Antes:  "order-001-2024"
    Depois: "order0012024"

    Se o seu sistema usa o valor original para reconciliação financeira,
    atualize-o também no seu banco de dados/sistema interno.
    A Orders API rejeita hífens e caracteres especiais neste campo.
```
Never sanitize silently. Always show before/after and wait for diff confirmation.

**IMPORTANT — hyphens are NOT allowed in `external_reference`.** The Orders API rejects values with hyphens (`-`) or any non-alphanumeric character. Never generate a diff that keeps hyphens and never add a comment saying "hyphens are allowed". They are NOT.

**`external_pos_id` is different — hyphens ARE allowed.** Per API docs, `config.qr.external_pos_id` accepts letters, numbers, hyphens (`-`), and underscores (`_`). Do NOT sanitize it. Only `external_reference` requires alphanumeric-only.

**QR root payload — forbidden fields (always strip from diff):**
- `title` — NOT a valid property at root level for QR. API returns `400: title is not a valid property`. The correct field is `description`. Never generate both; if legacy code has `title`, rename it to `description` and remove the original.
- `items[].total_amount` — NOT a valid property in `items[]`. API returns `400: items[0].total_amount is not a valid property`. The valid `items[]` fields are: `title`, `unit_price`, `quantity`, `unit_measure`, `external_code`, `external_categories`. Always strip `total_amount` from items in every QR diff.

```
AskUserQuestion:
  header: "external_reference"
  Question: "A Orders API exige que external_reference seja alfanumérico (sem hífens) e máximo 64 caracteres.
             O valor atual no seu projeto usa hífens ou caracteres especiais?"
  Options:
    - "Sim — remover hífens (ex: 'order-001' → 'order001')"
    - "Não — já é alfanumérico e ≤ 64 chars"
```

- "Sim" → generate sanitization in diff: `externalRef.replace(/-/g, '').slice(0, 64)` — and show warning in proposal
- "Não" → no change needed for this field

When generating any `external_reference` value in the diff, always use the alphanumeric form. Example: `` `order${Date.now()}` `` NOT `` `order-${Date.now()}` ``.

### 3.6.d — print_on_terminal dynamic value (Point only)

Trigger: project uses `print_on_terminal` with a variable (not hardcoded `true` or `false`).

```
AskUserQuestion:
  header: "Impressão no terminal"
  Question: "O campo print_on_terminal agora é uma string enum ('seller_ticket' ou 'no_ticket').
             Qual deve ser o comportamento padrão?"
  Options:
    - "Manter dinâmico — gerar mapeamento: true → 'seller_ticket', false → 'no_ticket' (Recomendado)"
    - "Sempre imprimir (seller_ticket)"
    - "Nunca imprimir (no_ticket)"
```

- "Sempre" → hardcode `"seller_ticket"` in diff
- "Nunca" → hardcode `"no_ticket"` in diff
- "Dinâmico" → generate ternary: `printOnTerminal ? "seller_ticket" : "no_ticket"` in diff

---

## Step 3.5 — Infer ambiguous fields from code before asking

**Infer first, ask only when truly ambiguous.** Scan the matched files for evidence before asking anything. Only call `AskUserQuestion` if the evidence is absent or contradictory.

### 3.5.a — Amount unit (Point and QR)

**The Payment Intents API always received `amount` as an integer in the smallest currency unit (centavos for BRL, centavos for ARS, centavos for MXN, etc.). This is a hard constraint of the legacy API — there is no ambiguity.**

**Default rule (apply always, no scanning needed):**
The field `amount` in a Payment Intents API payload is ALWAYS in centavos. Generate `(Number(amount) / 100).toFixed(2)` in the diff with annotation:
`// ⚠️ Converted from centavos to decimal string (Payment Intents API used integers)`

**Only override the default if there is explicit evidence to the contrary:**
- `.toFixed(2)` already applied to `amount` before sending → already decimal, use `Number(amount).toFixed(2)` instead
- Variable named `amountDecimal`, `valorReais`, `priceDecimal` → already decimal
- Value like `24.00` or `15.50` hardcoded (has decimal separator) → already decimal

**Decision:**
- No override evidence found (the common case) → apply default: centavos → `(Number(amount) / 100).toFixed(2)`. Do NOT ask.
- Override evidence found → use decimal conversion: `Number(amount).toFixed(2)`. Do NOT ask.
- **Field not found in code (amount not implemented yet)** → do NOT ask. Skip the conversion entirely and add to the post-migration report:
  ```
  ⚠️  Conversão de valor monetário não verificada
      O campo de valor não foi encontrado no código analisado.
      Quando implementar: a Orders API espera string decimal ("24.00").
      Se o seu projeto usa centavos inteiros (ex: 2400 = R$24,00), aplique:
        transactions: { payments: [{ amount: (Number(amount) / 100).toFixed(2) }] }
      Se já usa decimal (ex: 24.00), aplique:
        transactions: { payments: [{ amount: Number(amount).toFixed(2) }] }
  ```
- **Truly ambiguous** (field exists but unit cannot be inferred) → same as "not found": skip and add the warning above to the report. Do NOT ask.

### 3.5.b — QR mode

**The legacy endpoint AND HTTP method together determine the mode — never ask, but always check the method for QR Dinâmico:**

| Legacy endpoint + method | Mode | `config.qr.mode` | `transactions.payments` in request |
|--------------------------|------|-------------------|-------------------------------------|
| `POST /mpmobile/instore/qr` (QR Instore v1) | Static | `"static"` | Required |
| `PUT /instore/qr/seller/collectors` (QR Instore v2) | Static | `"static"` | Required |
| `POST /instore/orders/qr/seller/collectors` (QR Dinâmico) | Dynamic — new QR per transaction | `"dynamic"` | **Required** |
| `PUT /instore/orders/qr/seller/collectors` (QR Dinâmico) | Hybrid — updates fixed QR on POS | `"hybrid"` | **Required** |

**For QR Dinâmico:** grep the file for the HTTP method used on the `/instore/orders/qr/seller/collectors` endpoint. If the code uses `method: 'PUT'` (or equivalent), set `mode: "hybrid"`. If `POST`, set `mode: "dynamic"`. Add the single `transactions.payments` entry in both cases. **Never default to `"dynamic"` without checking the method** — `"hybrid"` and `"dynamic"` produce different QR behaviors: hybrid also links the static POS QR; dynamic creates a new QR per transaction.

Set `config.qr.mode` from this table automatically. Do NOT call `AskUserQuestion` — the endpoint + method are unambiguous evidence. If for any reason the endpoint cannot be matched, default to `"static"` and add a comment in the diff: `// config.qr.mode: review this value — could not be inferred from legacy endpoint`.

---

## Step 4 — Write diff to file and summarize in chat

**Do NOT dump the full diff into the chat.** Write it to a file the developer can open in their editor, then show only a compact summary in chat.

### 4.1 — Write `migration-proposal.md`

Use the `Write` tool to create `migration-proposal.md` in the project root with the following structure:

```markdown
# Migration Proposal — {Product}: Legacy API → Orders API

Generated: {date}
Source: {doc URL}

---

## Summary

| File | Changes |
|------|---------|
| {file} | {n} endpoints migrated |
| ... | ... |

---

## {file}

### Line {n} — {operation}

**BEFORE:**
```{lang}
{old code block}
```

**AFTER:**
```{lang}
{new code block with inline annotations as comments}
```

**What changed:**
- {bullet point per field change}

---

## Post-migration checklist

{post-migration warnings per product}

## Próximos passos

Com credenciais de teste (recomendado):
  → /mp-integrate test-setup  para criar usuário de teste
  → Teste um pagamento com o terminal em modo desenvolvedor
  → /mp-review  para validar a integração migrada

Com credenciais produtivas (já tenho token ativo):
  → Teste um pagamento com o terminal
  → /mp-review  para validar a integração migrada

## 🆕 Novidades disponíveis na Orders API

  • Refund nativo — POST /v1/orders/{id}/refund
  • Cancelamento por status — X-Allow-Cancelable-Status
  • Idempotência nativa — X-Idempotency-Key previne cobranças duplicadas
  • PIX via Pago Integrado (Brasil)
  • Status unificado — um único campo status para Point e QR
```

### 4.2 — Show compact summary in chat

After writing the file, show in chat:

```
📋 Migration proposal ready — {N} file(s) · {M} changes

  📄 {file1}: {n} endpoints migrated
  📄 {file2}: {n} endpoints migrated

→ Open `migration-proposal.md` to review the full diff.
  When ready, confirm below to apply the changes.
```

Then immediately call `AskUserQuestion`:

```
AskUserQuestion:
  header: "Apply migration?"
  Question: "Reviewed migration-proposal.md and ready to apply?"
  Options:
    - "Yes, apply all changes"
    - "Cancel — I'll review the proposal first"
```

If "Cancel" → stop. The developer can re-run `/mp-integrate migrate` after reviewing.
If "Yes" → proceed to Step 5.

---

## Step 5 — Apply confirmed changes

The confirmation already happened in Step 4.2. If the developer selected "Yes, apply all changes", proceed directly to Step 6. Do NOT ask again.

---

## Step 6 — Apply

Use `Edit` to apply each change. Work file by file. After each file:
```
✅ {file} — updated
```

If a file fails to edit → report the error, skip that file, continue with the rest.

**After applying all files, check `.env.example`:**

Read the project's `.env.example` (or create if missing). Ensure it contains ALL required variables for the migrated integration:

```
MP_ACCESS_TOKEN=APP_USR-...   # Token de acesso — DevPanel → sua app → aba Teste
MP_PUBLIC_KEY=APP_USR-...     # Chave pública — DevPanel → sua app → aba Teste
MP_WEBHOOK_SECRET=            # Segredo para validação HMAC-SHA256 dos webhooks
                              # Obtenha em: DevPanel → Notificações → seu endpoint → Assinatura secreta
PORT=3000
```

If `MP_WEBHOOK_SECRET` is missing from `.env.example` → add it. This variable is required for HMAC-SHA256 webhook validation and is frequently omitted.

---

## Step 7 — Post-migration guidance

### QR Code (all variants)

```
⚠️  After migration:
1. external_reference is now required at root level (max 64 chars, alphanumeric).
2. expiration_time uses ISO 8601 duration (e.g. "PT5M"), not seconds.
3. Monetary amounts must be string decimal ("10.00"), not number (1000).
4. Refund is now POST /v1/orders/{id}/refund (no longer via Payments API).
5. Status values unified: "created", "processed", "canceled", "refunded", "expired".
6. QR Instore V2: response is now 201 Created with full order object (was 204 No Content).

Next steps:
  → Test a real QR payment with test credentials
  → /mp-review to validate the migrated integration
```

### MP Point (PDV + Self Service)

After showing the warnings below, execute the two automated actions (terminal_id + webhook topic) before listing next steps.

```
⚠️  After migration:
1. terminal_id may differ from device_id — validate before first test.
   (Plugin will fetch the list automatically — see below.)
2. Amounts must be string decimal ("15.00"), not integer (1500).
3. print_on_terminal is now an enum string ("seller_ticket" or "no_ticket").
4. Order ID format changed: UUID → alphanumeric (e.g. ORDTST01KW2N1H...)
   Update any code that stores or compares order IDs.
5. Status renamed: "FINISHED" → "processed", "ERROR" → "failed".
   New values: "canceled", "expired".
6. Remove x-test-scope header. Add X-Idempotency-Key (UUID) to create/cancel/refund.
7. Webhook topic updated automatically — see below.
```

#### Automated action 1 — Validate terminal_id

Check if `.env` exists and has `MP_ACCESS_TOKEN`. If yes, run via `Bash`:

```bash
node -e "
require('dotenv').config();
fetch('https://api.mercadopago.com/terminals/v1/list', {
  headers: { Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN }
}).then(r => r.json()).then(d => {
  console.log(JSON.stringify((d.data || []).map(t => ({ id: t.id, model: t.device_model })), null, 2));
});
"
```

Show the result to the developer and ask:

```
AskUserQuestion:
  header: "terminal_id"
  Question: "Esses são os terminais encontrados na sua conta. Qual é o terminal_id correto para esta integração?"
  Options: [list terminal ids from the API response]
  + "Nenhum desses — vou configurar manualmente"
```

If `.env` not found or token missing:
```
ℹ️  Não encontrei MP_ACCESS_TOKEN no projeto.
    Execute manualmente para obter o terminal_id correto:

    GET https://api.mercadopago.com/terminals/v1/list
    Authorization: Bearer {seu_access_token}

    Ou conecte o MCP (/mp-connect) e rode /mp-integrate migrate novamente
    para que o plugin busque automaticamente.
```

#### Automated action 2 — Update webhook topic

Ask via `AskUserQuestion` before any MCP call:
```
AskUserQuestion:
  header: "Webhook topic"
  Question: "Quer que eu atualize o topic do webhook de 'point_integration_wh' para 'orders' na sua conta agora?"
  Options:
    - "Sim, atualizar agora"
    - "Não, farei manualmente no Developer Dashboard"
```
If "Sim" → attempt `mcp__plugin_mercadopago_mcp__save_webhook` directly. If it is unavailable or returns an authentication error, apply Step 0, then retry `save_webhook`. Confirm: *"✅ Webhook topic atualizado para 'orders'."*

If "Não" → continue without MCP and show the manual Developer Dashboard path.

#### Additional diff items — always include for Point migrations

**X-Idempotency-Key — deterministic keys required on create AND cancel:**

`POST /v1/orders` (create) and `POST /v1/orders/{id}/cancel` both require `X-Idempotency-Key`. The API returns `400 empty_required_header` if omitted.

**Never use `crypto.randomUUID()`.** A random UUID changes on every call — including network retries — so the API treats each retry as a new operation, creating duplicate orders or duplicate cancels.

Always generate a deterministic key derived from a stable identifier:
```js
// ✅ create — key derived from externalReference
'X-Idempotency-Key': crypto.createHash('sha256').update(externalReference).digest('hex'),

// ✅ cancel — key derived from orderId with prefix to avoid collision with create key
'X-Idempotency-Key': crypto.createHash('sha256').update(`cancel:${orderId}`).digest('hex'),
```
Same input → same key → retries are safe. Different operations (create vs cancel) → different keys because of the prefix.

**X-Allow-Cancelable-Status:** for **every cancel endpoint** (Point AND QR — both products), add this header preemptively:
```js
'X-Allow-Cancelable-Status': 'at_terminal,created', // ⚠️ Required to cancel orders already at terminal
```
Applies to: `POST /v1/orders/{id}/cancel` regardless of product. Harmless for other statuses — prevents failures when canceling `at_terminal` orders. If not present in the QR cancel diff, add it.

**payment_method_id / payment_type_id path:** if project reads these from root response, correct in diff:
```js
// WRONG — fields do not exist at root level of Orders API response:
// data.payment_method_id  /  data.payment_type_id

// CORRECT — verified against live API:
data.transactions?.payments?.[0]?.payment_method?.id    // payment method id (e.g. "master")
data.transactions?.payments?.[0]?.payment_method?.type  // payment type (e.g. "credit_card")
```

#### Next steps (two explicit paths)

```
Próximos passos:

  Com credenciais de teste (recomendado):
  → /mp-integrate test-setup  para criar usuário de teste
  → Teste um pagamento com o terminal em modo desenvolvedor
  → /mp-review  para validar a integração migrada

  Com credenciais produtivas (já tenho token ativo):
  → Teste um pagamento com o terminal
  → /mp-review  para validar a integração migrada
```

#### Novidades disponíveis na Orders API

```
🆕 Com a Orders API você também passa a ter:

  • Refund nativo — POST /v1/orders/{id}/refund
  • Cancelamento por status — X-Allow-Cancelable-Status
  • Idempotência nativa — X-Idempotency-Key previne cobranças duplicadas
  • PIX via Pago Integrado (Brasil)
  • Status unificado — um único campo status para Point e QR
```

---

#### Final summary (always show at the very end, after all actions are complete)

Always close the migration with this exact format — no exceptions, no variations:

```
✅ Migração concluída — {Product} → Orders API
─────────────────────────────────────────────
{for each modified file}
📄 {file path}   {n} endpoint(s) migrado(s) | {what changed}

Decisões aplicadas:
  • {each decision made in Steps 3.5 and 3.6, one bullet per decision}

Diff completo: migration-proposal.md

Próximos passos:
  → /mp-integrate test-setup
  → /mp-review
```

Rules for the summary:
- Always include every file that was modified, one line each
- Always include every decision that was confirmed (amount unit, terminal_id, webhook, listing approach, ID storage, QR mode, print_on_terminal)
- Always include "Diff completo: migration-proposal.md" — even if the developer already applied the changes
- Always end with the two next steps in that order
- Translate all text to the developer's language (detected in Step 0)
- Never add extra sections, explanations, or warnings after this block — they belong in migration-proposal.md

---

## What this skill does NOT do

- It does **not** modify files without explicit confirmation.
- It does **not** invent field mappings — always fetches from official documentation.
- It does **not** migrate Online products (Checkout API, Marketplace, Bricks, Checkout Pro, Subscriptions).
- It does **not** guarantee 100% correctness without testing — always orient the developer to test after migration.
