# Guide: Checkout Pro
# Updated: 2026-06-22 | Source: Mercado Pago MCP (search_documentation)
#
# TRAP TO AVOID FIRST: Never use sandbox_init_point — use init_point always.
# Checkout Pro uses Preferences API (/checkout/preferences), NOT Orders API.

---

## What it is

Hosted redirect checkout. Buyer leaves your site, pays on Mercado Pago's secure page, returns via `back_url`. You never handle card data — no PCI scope required.

**When to use:** fastest integration, full payment method catalog (saved cards, MP balance, cash, BNPL), no customization needed on the payment form.

**Countries:** AR, BR, MX, CL, CO, PE, UY

---

## Mandatory placement in an existing application

Before writing UI, run the bundled CTA detector. Checkout Pro must always place a visible, localized **Pay with Mercado Pago** button at the application's resolved checkout CTA location. Reuse the surrounding layout and button classes; replace the previous checkout action instead of adding a competing second handler.

If no unambiguous CTA is detected, the developer must choose the concrete screen/location where the button will be inserted. Do not finish the scaffold without the button. Checkout Pro redirects to the hosted Mercado Pago page, so it does not create a separate local card-form screen.

Mark the final button with the `data-mp-checkout-cta` attribute set to the Checkout Pro product slug and make it submit to the preference-creation route that redirects to `result.init_point`.

---

## Complete working app (Node.js + Express)

This is a **fully runnable** app. Copy it, fill in `.env`, run `npm install && node server.js`, open `http://localhost:3000`.

### Install

```bash
npm install mercadopago express dotenv
```

### server.js

```js
import 'dotenv/config';
import express from 'express';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const configuredAppUrl = process.env.APP_URL?.trim();
const publicAppUrl = Boolean(
  configuredAppUrl
  && /^https:\/\//i.test(configuredAppUrl)
  && !/^https:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/|$)/i.test(configuredAppUrl)
);
const baseUrl = configuredAppUrl || `http://localhost:${process.env.PORT || 3000}`;

// ─── GET / — checkout page ────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Checkout Pro Test</title></head>
      <body>
        <h1>Checkout Pro — Test</h1>
        <p>Product: <strong>Test Product — BRL 10.00</strong></p>
        <form action="/checkout" method="POST">
          <button type="submit" data-mp-checkout-cta="checkout-pro" style="padding:12px 24px;font-size:16px;background:#009ee3;color:#fff;border:none;border-radius:6px;cursor:pointer">
            Pay with Mercado Pago
          </button>
        </form>
      </body>
    </html>
  `);
});

// ─── POST /checkout — create preference and redirect ─────────────────────────
app.post('/checkout', async (req, res) => {
  try {
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [{
          title: 'Test Product',
          quantity: 1,
          unit_price: 10.0,
          currency_id: process.env.CURRENCY_ID || 'BRL',
        }],
        back_urls: {
          success: `${baseUrl}/success`,
          failure: `${baseUrl}/failure`,
          pending: `${baseUrl}/pending`,
        },
        // ⚠️ auto_return only works with a public URL — MP rejects localhost
        // Remove this line during local development; add back in production
        ...(publicAppUrl
          ? { auto_return: 'approved' }
          : {}),
        notification_url: process.env.WEBHOOK_URL || undefined,
        external_reference: `order-${Date.now()}`,
        statement_descriptor: 'TEST STORE',
      },
    });

    // ✅ Always use init_point — NEVER sandbox_init_point
    res.redirect(result.init_point);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating preference: ' + err.message);
  }
});

// ─── Back URLs ────────────────────────────────────────────────────────────────
app.get('/success', async (req, res) => {
  const { collection_id, collection_status, external_reference } = req.query;

  // ⚠️ Never trust query params alone — always verify server-side
  try {
    const payment = new Payment(client);
    const paymentData = await payment.get({ id: collection_id });
    res.send(`
      <h1>✅ Payment ${paymentData.status}</h1>
      <p>Payment ID: ${paymentData.id}</p>
      <p>Status detail: ${paymentData.status_detail}</p>
      <p>External reference: ${external_reference}</p>
      <a href="/">← Back to checkout</a>
    `);
  } catch (err) {
    res.send(`<h1>✅ Back from checkout</h1><p>Status: ${collection_status}</p><a href="/">← Back</a>`);
  }
});

app.get('/failure', (req, res) => {
  res.send(`<h1>❌ Payment failed</h1><a href="/">← Try again</a>`);
});

app.get('/pending', (req, res) => {
  res.send(`<h1>⏳ Payment pending</h1><a href="/">← Back</a>`);
});

// ─── Webhook ──────────────────────────────────────────────────────────────────
app.post('/webhooks/mp', (req, res) => {
  // Validate x-signature here (see /mp-integrate webhook for full HMAC pattern)
  res.status(200).end();
  const { type, data } = req.body;
  console.log('Webhook received:', type, data?.id);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n🚀 Server running at http://localhost:${PORT}\n`));
```

### .env

```
MP_ACCESS_TOKEN=APP_USR-...   # from DevPanel → your app → Test credentials tab
MP_PUBLIC_KEY=APP_USR-...
CURRENCY_ID=BRL               # BRL for Brazil, ARS for Argentina, MXN for Mexico, etc.
PORT=3000
APP_URL=                      # leave empty for local dev — auto_return is disabled on localhost
                              # set to public URL in production: APP_URL=https://mysite.com
WEBHOOK_URL=                  # optional: your public webhook URL
```

### package.json (add this if missing)

```json
{
  "type": "module",
  "scripts": { "start": "node server.js" }
}
```

### Run

```bash
node server.js
# then open: http://localhost:3000
```

---

## How to test a payment

1. Open `http://localhost:3000`
2. Click "Pay with Mercado Pago"
3. Log in with your **test buyer user** (email + password from `/mp-integrate test-setup`)
4. Use a test card (from `/mp-test-cards BR`):
   - Visa `4235 6477 2802 5682` · CVV `123` · Exp `11/30` · Name `APRO` · CPF `12345678909`
5. Complete payment → you'll be redirected to `/success`

---

## Step 4 — Verify payment (server-side)

⚠️ **Never trust query params alone.** The `/success` route above already verifies via `Payment.get()`.

---

## Step 5 — Webhooks

Run `/mp-integrate webhook` to scaffold the HMAC-SHA256 receiver and register your URL.

---

## Pre-production checklist

- [ ] `init_point` used (not `sandbox_init_point`)
- [ ] `external_reference` set on every preference
- [ ] Payment status verified server-side after redirect (not just query params)
- [ ] `auto_return` removed or conditional — **MP rejects `auto_return: 'approved'` when `back_urls.success` is a localhost URL**. Only set it in production with a public URL.
- [ ] `back_urls.success` set (required for `auto_return`)
- [ ] `notification_url` pointing to your webhook handler (HTTPS in production)
- [ ] `currency_id` matches the country
- [ ] `.env` not committed; `.env.example` committed
- [ ] Run `/mp-review` before switching to production credentials
