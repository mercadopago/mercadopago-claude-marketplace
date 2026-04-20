# Card Payment Brick — Troubleshooting

## Token expired error (API 400)

**Symptom**: Payment API returns error, status 400, message about invalid token.

**Cause**: Card token is single-use and was already consumed, or it expired (7-day validity).

**Fix:**
- Ensure your backend processes the token immediately
- Don't store the token and use it later
- Don't add delays between `onSubmit` and your backend API call

```js
// WRONG — adding delay
onSubmit: async (cardFormData) => {
  await sleep(10000);  // Token likely expired
  await createPayment(cardFormData);
}

// CORRECT — use immediately
onSubmit: async (cardFormData) => {
  await createPayment(cardFormData);  // Immediate
}
```

---

## Token already used error

**Symptom**: Second API call with same token fails.

**Cause**: Card tokens are **single-use** — they can only be used once to create a payment.

**Fix:** Each `onSubmit` call provides a new, fresh token. Don't re-use tokens.

---

## Card validation errors not showing

**Symptom**: User clicks submit, nothing happens, no error shown.

**Causes:**
- Browser console shows `onSubmit` was called but card fields are empty
- Card number field not rendered properly

**Fix:**
- Ensure the container div exists in the DOM before `bricksBuilder.create()` is called
- Verify no CSS is hiding the Brick (`display: none`, `visibility: hidden`, `height: 0`)
- Check browser console for `FIELDS_SETUP_FAILED` error

---

## 3DS not triggered

**Symptom**: Payment is created but 3DS challenge doesn't appear for cards that should require it.

**Cause:** `three_d_secure_mode` not set in order creation request.

**Fix:**
```python
# Add to order creation payload:
payment_data = {
    "token": token,
    # ...other fields...
    "three_d_secure_mode": "optional",  # or "mandatory"
}
```

- `"optional"`: 3DS only when the bank requires it (recommended)
- `"mandatory"`: Always request 3DS (may increase declines for cards that don't support it)

---

## Brick not showing installments

**Symptom**: Card form renders but no installment selector appears.

**Causes:**
- `maxInstallments: 1` in config
- Amount is below minimum for the country (see table below)
- Card BIN lookup returned only 1 installment option

**Approximate minimum amounts for installments (> 1):**

| Country | Minimum |
|---|---|
| Argentina (MLA) | ARS 100 |
| Brazil (MLB) | BRL 5.00 |
| Mexico (MLM) | MXN 50 |
| Colombia (MCO) | COP 5,000 |
| Chile (MLC) | CLP 1,000 |
| Peru (MPE) | PEN 10 |
| Uruguay (MLU) | UYU 50 |

**Fix:** Increase the amount or set `maxInstallments` higher in `customization.paymentMethods`.

---

## `FIELDS_SETUP_FAILED` error

**Symptom**: `onError` callback called with `cause: "FIELDS_SETUP_FAILED"`.

**Causes:**
- Ad blockers blocking `sdk.mercadopago.com`
- Network error loading secure field assets

**Fix:** Ask the user to disable ad blockers for the checkout page. If the issue persists, check browser network tab for blocked requests.

---

## Debit card not appearing

**Symptom**: User enters a debit card but form shows no installments and submit seems to fail.

**Cause:** Debit cards have different flows — they typically don't support installments.

**Fix:** This is correct behavior. Debit cards submit with `installments: 1`. Ensure your backend order creation accepts `installments: 1`.

---

## API 400: `invalid payer.identification`

**Symptom**: Payment API returns 400 with payer identification error.

**Cause:** The payer's document is invalid or formatted incorrectly.

**Fix:**
```python
# Brazil CPF: 11 digits, numbers only
"identification": { "type": "CPF", "number": "12345678901" }  # no dots or dashes

# Argentina DNI: 7-8 digits
"identification": { "type": "DNI", "number": "12345678" }
```

The Brick validates the format in the UI, but the value might still fail server-side if you transform it. Pass the value exactly as received from `cardFormData.payer.identification`.

---

## Brick showing in wrong language

**Symptom**: Brick labels appear in Spanish but the site is in Portuguese.

**Cause:** Wrong `locale` passed to `new MercadoPago(key, { locale })`.

**Fix:**
```js
// For Brazil: pt-BR
const mp = new MercadoPago("KEY", { locale: "pt-BR" });

// For Mexico: es-MX
const mp = new MercadoPago("KEY", { locale: "es-MX" });
```

---

## Submit fails intermittently — works sometimes, breaks other times

**Symptom**: The payment form sometimes submits correctly, but other times nothing happens when the user clicks "Pay", or the Brick throws an error. The behavior is inconsistent — it seems to depend on how fast the page loads.

**Cause:** The code uses `setTimeout` to "wait" for the Brick to load, then enables submit or interacts with the Brick. The problem is that `setTimeout` is a guess — sometimes 2 seconds is enough, sometimes it's not. On slow connections or heavy pages, the Brick may still be loading when the timeout fires.

```js
// ❌ THE PROBLEM — guessing when the Brick is ready
await bricksBuilder.create("payment", "paymentBrick_container", settings);

setTimeout(() => {
  document.getElementById("loading").style.display = "none";
  document.getElementById("payButton").disabled = false;
}, 2000); // 2 seconds is a guess — what if the Brick takes 3?
```

**Why this breaks:**
- On fast connections: the 2s delay feels slow and unnecessary
- On slow connections: the Brick isn't ready yet when the timeout fires
- On mobile: network latency is unpredictable, the guess is almost always wrong
- Result: the user clicks "Pay" before Secure Fields are loaded → submit silently fails or throws `fields_setup_failed`

**Fix:** Replace `setTimeout` with the `onReady` callback. The Brick tells you exactly when it's ready — no guessing.

```js
// ✅ THE FIX — let the Brick tell you when it's ready
const settings = {
  callbacks: {
    onReady: () => {
      // This fires ONLY when the Brick is 100% loaded and interactive
      document.getElementById("loading").style.display = "none";
      document.getElementById("payButton").disabled = false;
    },
    onSubmit: async ({ formData }) => { /* ... */ },
    onError: (error) => { console.error(error); },
  },
};
```

**Rule:** Never use `setTimeout` to wait for a Brick. Always use `onReady`.

---

## Error catalog and lifecycle

See `../../references/rules-errors.md` for the complete error catalog (initialization + communication errors) and lifecycle management rules.
