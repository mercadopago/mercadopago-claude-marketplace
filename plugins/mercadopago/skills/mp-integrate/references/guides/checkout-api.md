# Guide: Checkout API (Checkout Transparente in Brazil)
# Updated: 2026-08-17 | API source: Mercado Pago MCP (search_documentation)
#
# TRAP TO AVOID FIRST:
#   Always use Orders API (POST /v1/orders) for card payments in ALL 7 countries.
#   There is NO country-conditional logic. Never use /v1/payments for checkout-api.
#   Never ask the developer — always use orders.

---

## What it is

Card payments on your page. Full UI control. Buyer never leaves. PCI-compliant via MP tokenization.

**API: Orders API (`POST /v1/orders`) — same for every country.** Available in AR, BR, MX, CL, CO, PE, UY. No fallback to Payments API for card payments.

---

## Mandatory entry CTA in an existing application

The payment form always lives on its own new screen, and the plugin must always connect an application CTA to that screen. Run the bundled detector before writing UI. If it finds one clear checkout CTA, preserve its styling/text and replace only its navigation. If the result is ambiguous or empty, require the developer to choose the concrete CTA or insertion location before finishing the scaffold.

Mark the final element with the `data-mp-checkout-cta` attribute set to the Checkout API product slug and point it to the dedicated checkout route, for example:

```text
<a href="/checkout/payment" data-mp-checkout-cta="checkout-api" class="existing-button-classes">
  Finalizar compra
</a>
```

There is no successful Checkout API scaffold without both the separate screen and its wired entry CTA.

---

## Complete Vanilla JS example — separate checkout screen

The payment form below belongs in a **new, dedicated checkout screen file**. When adapting this example to an existing project, preserve that separation: reuse shared styles/layout if useful, but never merge the form into an existing cart, product, modal, drawer, or hidden view. The `/checkout/payment` route and `public/checkout-payment.html` file below are generic examples; adapt their names to the target project's conventions.

### Install

```bash
npm install mercadopago express dotenv
```

### server.js

```js
import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// ─── Runtime config — never inject MP_PUBLIC_KEY into cached HTML ────────────
// The public key is safe to expose to the browser. Returning it as no-store
// JSON prevents an old checkout HTML document from retaining a placeholder.
app.get('/api/mp-config', (req, res) => {
  const publicKey = process.env.MP_PUBLIC_KEY?.trim();
  res.set('Cache-Control', 'no-store, max-age=0');
  if (!publicKey) {
    return res.status(500).json({ error: 'MP_PUBLIC_KEY is not configured on the application server' });
  }
  return res.json({ publicKey });
});

// ─── GET /checkout/payment — serve an unchanged, separate static screen ─────
app.get('/checkout/payment', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'checkout-payment.html'));
});

// ─── POST /api/process-payment — Orders API, all countries ───────────────────
app.post('/api/process-payment', async (req, res) => {
  // SDK v2 getCardFormData() returns camelCase — map to snake_case here
  const { token, paymentMethodId,
          transaction_amount, email, identificationNumber } = req.body;
  const payment_method_id = paymentMethodId;
  // Minimal one-time checkout: the server enforces one installment. Do not
  // trust or request an installments value from the browser unless the store
  // explicitly offers installment selection.
  const installments = 1;

  try {
    const response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        type: 'online',
        processing_mode: 'automatic',
        total_amount: Number(transaction_amount).toFixed(2), // must be '10.00' not '10'
        external_reference: `order-${Date.now()}`,
        payer: {
          email,
          identification: { type: 'CPF', number: identificationNumber },
        },
        transactions: {
          payments: [{
            amount: Number(transaction_amount).toFixed(2), // must be '10.00' not '10'
            payment_method: {
              id: payment_method_id,
              type: 'credit_card',
              token,
              installments: Number(installments),
              // ⚠️ issuer_id is NOT allowed inside payment_method for Orders API
            },
          }],
        },
      }),
    });
    const order = await response.json();
    if (!response.ok) return res.status(response.status).json(order);
    res.json({ status: order.status, id: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n🚀 Server at http://localhost:${PORT}\n`));
```

### public/checkout-payment.html — new, separate screen file

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Checkout API Test</title>
  <script src="https://sdk.mercadopago.com/js/v2"></script>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f7fa;
      color: #1f2937;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #f5f7fa; }
    .checkout-shell { width: min(100% - 32px, 720px); margin: 0 auto; padding: 48px 0; }
    .checkout-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 32px; box-shadow: 0 18px 50px rgba(15, 23, 42, .08); }
    .checkout-header { margin-bottom: 28px; }
    .checkout-header h1 { margin: 0 0 8px; font-size: clamp(1.75rem, 4vw, 2.25rem); }
    .checkout-header p { margin: 0; color: #64748b; }
    .checkout-total { display: flex; justify-content: space-between; gap: 16px; margin: 24px 0; padding: 16px 18px; border-radius: 12px; background: #f8fafc; font-size: 1.05rem; }
    #form-checkout { display: grid; gap: 18px; }
    .checkout-field { min-width: 0; }
    .checkout-field > label, .checkout-label { display: block; margin-bottom: 7px; color: #334155; font-size: .9rem; font-weight: 700; }
    .secure-input {
      position: relative;
      min-height: 48px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
      transition: border-color .15s, box-shadow .15s;
    }
    .secure-input:focus-within { border-color: #3483fa; box-shadow: 0 0 0 3px rgba(52, 131, 250, .15); }
    .secure-input iframe {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      border: 0 !important;
      pointer-events: auto !important;
    }
    .checkout-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    input, select {
      width: 100%; min-height: 48px; padding: 0 14px; border: 1px solid #cbd5e1;
      border-radius: 10px; background: #fff; color: #0f172a; font: inherit; outline: none;
    }
    input:focus, select:focus { border-color: #3483fa; box-shadow: 0 0 0 3px rgba(52, 131, 250, .15); }
    #form-checkout__submit {
      min-height: 50px; border: 0; border-radius: 10px; background: #3483fa;
      color: #fff; font: inherit; font-weight: 800; cursor: pointer;
    }
    #form-checkout__submit:hover { background: #2968c8; }
    #form-checkout__submit:disabled { opacity: .65; cursor: wait; }
    #checkout-init-error { margin-bottom: 18px; padding: 14px 16px; border: 1px solid #fecaca; border-radius: 10px; background: #fef2f2; color: #991b1b; }
    #result:not(:empty) { margin-top: 20px; padding: 14px 16px; border-radius: 10px; background: #f8fafc; }
    @media (max-width: 560px) {
      .checkout-shell { width: min(100% - 20px, 720px); padding: 20px 0; }
      .checkout-card { padding: 22px 18px; border-radius: 14px; }
      .checkout-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="checkout-shell">
    <section class="checkout-card" aria-labelledby="checkout-title">
      <header class="checkout-header">
        <h1 id="checkout-title">Finalizar compra</h1>
        <p>Preencha os dados abaixo para concluir o pagamento com segurança.</p>
      </header>
      <div class="checkout-total"><span>Total</span><strong>BRL 10,00</strong></div>

      <div id="checkout-init-error" role="alert" aria-live="assertive" hidden></div>

      <!--
        This standalone example has no authenticated buyer context, so it asks
        for CPF and email. In an existing application, set each source to
        "application", remove its visible input, and read the trusted value
        from the authenticated session/cart on the server.
      -->
      <form id="form-checkout"
            data-mp-public-key-source="runtime-endpoint"
            data-mp-payer-identification-source="form"
            data-mp-payer-email-source="form"
            data-mp-identification-type="CPF">
    <div class="checkout-field" data-mp-field="cardNumber" role="group" aria-labelledby="card-number-label">
      <label id="card-number-label" class="checkout-label">Número do cartão</label>
      <div id="form-checkout__cardNumber" data-mp-secure-field="cardNumber" class="secure-input" aria-labelledby="card-number-label"></div>
    </div>

    <div class="checkout-row">
      <div class="checkout-field" data-mp-field="expirationDate" role="group" aria-labelledby="expiration-label">
        <label id="expiration-label" class="checkout-label">Validade do cartão (MM/AA)</label>
        <div id="form-checkout__expirationDate" data-mp-secure-field="expirationDate" class="secure-input" aria-labelledby="expiration-label"></div>
      </div>
      <div class="checkout-field" data-mp-field="securityCode" role="group" aria-labelledby="security-code-label">
        <label id="security-code-label" class="checkout-label">Código de segurança (CVC)</label>
        <div id="form-checkout__securityCode" data-mp-secure-field="securityCode" class="secure-input" aria-labelledby="security-code-label"></div>
      </div>
    </div>

    <div class="checkout-field" data-mp-field="cardholderName">
      <label for="form-checkout__cardholderName">Nome no cartão</label>
      <input type="text" id="form-checkout__cardholderName" autocomplete="cc-name" required />
    </div>
    <div class="checkout-field" data-mp-field="identificationNumber">
      <label for="form-checkout__identificationNumber">CPF do titular</label>
      <input type="text" id="form-checkout__identificationNumber" inputmode="numeric" autocomplete="off" required />
    </div>
    <div class="checkout-field" data-mp-field="cardholderEmail">
      <label for="form-checkout__cardholderEmail">E-mail do comprador</label>
      <input type="email" id="form-checkout__cardholderEmail" autocomplete="email" required />
    </div>

        <!--
          Required CardForm lifecycle nodes. They stay in the DOM and in the
          CardForm map so the SDK can populate payment-method metadata without
          adding optional controls to the visible checkout UI.
        -->
        <select id="form-checkout__issuer"
                data-mp-sdk-required-field="issuer"
                hidden aria-hidden="true" tabindex="-1"></select>
        <select id="form-checkout__installments"
                data-mp-sdk-required-field="installments"
                hidden aria-hidden="true" tabindex="-1"></select>
        <select id="form-checkout__identificationType"
                data-mp-sdk-required-field="identificationType"
                hidden aria-hidden="true" tabindex="-1"></select>

        <button type="submit" id="form-checkout__submit">Pagar</button>
      </form>

      <div id="result" role="status" aria-live="polite"></div>
    </section>
  </main>

  <script>
    const secureFieldHosts = [
      { id: 'form-checkout__cardNumber', labelId: 'card-number-label' },
      { id: 'form-checkout__expirationDate', labelId: 'expiration-label' },
      { id: 'form-checkout__securityCode', labelId: 'security-code-label' },
    ];

    function showCheckoutInitError(details) {
      const region = document.getElementById('checkout-init-error');
      region.hidden = false;
      region.textContent = details || 'Não foi possível carregar os campos seguros do pagamento.';
      console.error('[Checkout API] Secure Fields initialization failed:', details);
    }

    async function loadPublicKey() {
      let response;
      try {
        response = await fetch('/api/mp-config', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
      } catch {
        throw new Error('Não foi possível acessar a configuração do Mercado Pago. Inicie a aplicação pelo servidor do projeto; não abra o HTML diretamente nem use um servidor somente estático.');
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.publicKey) {
        throw new Error(payload.error || 'MP_PUBLIC_KEY não está configurada no servidor da aplicação.');
      }
      return payload.publicKey;
    }

    function assertSecureFieldsMounted() {
      const failures = [];

      secureFieldHosts.forEach(({ id, labelId }) => {
        const host = document.getElementById(id);
        const label = document.getElementById(labelId);
        const frames = host ? host.querySelectorAll('iframe') : [];
        const rect = host ? host.getBoundingClientRect() : { width: 0, height: 0 };

        if (!host) failures.push(`${id}: host ausente`);
        else if (frames.length !== 1) failures.push(`${id}: iframe não montado exatamente uma vez`);
        if (!label || label.getClientRects().length === 0) failures.push(`${id}: rótulo visível ausente`);
        if (!rect.width || !rect.height) failures.push(`${id}: contêiner oculto ou sem dimensão`);
        if (host && getComputedStyle(host).pointerEvents === 'none') failures.push(`${id}: host não interativo`);
        if (frames[0] && getComputedStyle(frames[0]).pointerEvents === 'none') failures.push(`${id}: iframe não interativo`);
        if (host && host.closest('[inert], [aria-disabled="true"]')) failures.push(`${id}: ancestral desabilitado`);
      });

      if (failures.length) {
        const message = `Falha ao inicializar os campos seguros: ${failures.join('; ')}`;
        showCheckoutInitError(message);
        return false;
      }

      return true;
    }

    async function mountCheckoutForm() {
      if (typeof MercadoPago === 'undefined') {
        showCheckoutInitError('O SDK MercadoPago.js não foi carregado.');
        return;
      }

      let publicKey;
      try {
        publicKey = await loadPublicKey();
      } catch (error) {
        showCheckoutInitError(error.message);
        return;
      }

      const mp = new MercadoPago(publicKey);
      const cardForm = mp.cardForm({
      amount: '10.00',
      iframe: true,
      form: {
        id: 'form-checkout',
        cardNumber: { id: 'form-checkout__cardNumber', placeholder: 'Número do cartão' },
        expirationDate: { id: 'form-checkout__expirationDate', placeholder: 'MM/AA' },
        securityCode: { id: 'form-checkout__securityCode', placeholder: 'CVV' },
        cardholderName: { id: 'form-checkout__cardholderName' },
        issuer: { id: 'form-checkout__issuer' },
        installments: { id: 'form-checkout__installments' },
        identificationType: { id: 'form-checkout__identificationType' },
        identificationNumber: { id: 'form-checkout__identificationNumber' },
        cardholderEmail: { id: 'form-checkout__cardholderEmail' },
      },
      callbacks: {
        onFormMounted: (error) => {
          if (error) {
            showCheckoutInitError(error);
            return;
          }

          requestAnimationFrame(assertSecureFieldsMounted);
        },
        onSubmit: (event) => {
          event.preventDefault();
          // SDK v2 getCardFormData() returns camelCase fields
          const { token, paymentMethodId,
                  identificationNumber, cardholderEmail: email } =
            cardForm.getCardFormData();
          document.getElementById('result').innerHTML = '<p>Processing...</p>';
          fetch('/api/process-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, paymentMethodId,
              email, identificationNumber, transaction_amount: 10.00 }),
          })
          .then(r => r.json())
          .then(data => {
            const icon = data.status === 'approved' || data.status === 'processed' ? '✅' : '❌';
            document.getElementById('result').innerHTML =
              `<h2>${icon} ${data.status || 'error'}</h2><p>ID: ${data.id || JSON.stringify(data)}</p>`;
          })
          .catch(err => {
            document.getElementById('result').innerHTML = `<h2>❌ Error</h2><p>${err.message}</p>`;
          });
        },
      },
    });

    // Do not leave blank, unusable boxes when the SDK or Secure Fields are blocked.
      window.setTimeout(() => {
        const expirationHost = document.getElementById('form-checkout__expirationDate');
        if (!expirationHost?.querySelector('iframe')) {
          showCheckoutInitError('expirationDate iframe was not mounted');
        }
      }, 8000);
    }

    mountCheckoutForm();
  </script>
</body>
</html>
```

### .env

```
MP_ACCESS_TOKEN=APP_USR-...
MP_PUBLIC_KEY=APP_USR-...
PORT=3000
```

### package.json

```json
{ "type": "module", "scripts": { "start": "node server.js" } }
```

### Run

```bash
node server.js
# open the separate screen: http://localhost:3000/checkout/payment
# test card (BR): 4235 6477 2802 5682 | CVV 123 | Exp 11/30 | Name APRO | CPF 12345678909
```

---

## Test cards by country

Run `/mp-test-cards {country}` for the full list. Quick reference for Brazil:
- Visa `4235 6477 2802 5682` · CVV `123` · Exp `11/30` · Name `APRO` · CPF `12345678909`

---

## ⛔ Blocker — Orders API requires a test user buyer

The Orders API (`/v1/orders`) does **not** accept arbitrary emails. The payer must be an actual Mercado Pago test user created via the MCP tool.

**Before testing, you MUST:**
1. Run `/mp-integrate test-setup` to create a buyer test user
2. Use the test user's email in the `payer.email` field
3. Log in at the checkout page with that test user's email + password

⚠️ **Never use your own account's email as `payer.email`** — MP returns error 4390 (`Payer email forbidden`) because you cannot pay yourself. Use the buyer test user's email.

Without a test user, the Orders API returns `422 unprocessable_content`. This is not a bug in your code.

---

## Pre-production checklist

- [ ] **Test user created** via `/mp-integrate test-setup` (blocker for Orders API)
- [ ] `payer.email` is the test buyer's email, never your own account's (avoids error 4390)
- [ ] `X-Idempotency-Key` on every creation request
- [ ] Orders API (`/v1/orders`) used for all countries — no Payments API branch
- [ ] `issuer`, `installments`, and `identificationType` exist as hidden `<select>` lifecycle nodes and are referenced in the CardForm map even when they are not visible controls
- [ ] Minimal one-time checkout fixes `installments: 1` on the server; the hidden SDK node does not make the browser value authoritative
- [ ] `issuer_id` NOT inside `payment_method` for Orders API
- [ ] `total_amount` and `amount` use `.toFixed(2)` format
- [ ] Public key loaded through the application's detected public-config convention; vanilla/server apps use a no-store JSON endpoint such as `/api/mp-config`
- [ ] Generated client code contains no `%MP_PUBLIC_KEY%` placeholder and never reads private server environment variables directly
- [ ] Runtime config response sends `Cache-Control: no-store, max-age=0`, and the client fetch uses `cache: 'no-store'`
- [ ] Opening the actual checkout route returns a usable config response; opening the HTML directly or through a static-only server is rejected with a visible instruction
- [ ] Every field configured in `mp.cardForm` exists exactly once in the DOM
- [ ] No issuer selector is visible by default; show one only when the resolved payment method explicitly requires issuer selection
- [ ] Identification type comes from trusted buyer/country context (CPF in this BR example); its SDK lifecycle select remains hidden when the type can be inferred
- [ ] Payer email and identification are collected as labeled inputs only when the application does not already have trusted values
- [ ] Card number, expiration date, and security code have visible external labels
- [ ] No secure iframe field uses `disabled`, `readonly`, or `pointer-events: none`
- [ ] Secure fields mount only after their view is visible and each host has non-zero dimensions
- [ ] Each secure host contains exactly one iframe after mounting
- [ ] SDK/Public Key/ad-blocker failures render a visible initialization error instead of blank fields
- [ ] 3 UI states: loading, success, error
- [ ] Run `/mp-review` before production
