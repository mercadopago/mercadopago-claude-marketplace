# Payment Brick — Troubleshooting

## Brick not rendering at all

**Symptom**: Container div is empty after page load.

**Checklist:**
1. Is the MP SDK script loaded before your JS runs?
   ```html
   <!-- SDK FIRST, then your script -->
   <script src="https://sdk.mercadopago.com/js/v2"></script>
   <script src="checkout.js"></script>
   ```
2. Is the container div present in the DOM when `bricksBuilder.create()` runs?
   - If using React, ensure the component is mounted before calling `create()`
3. Is the `PUBLIC_KEY` correct? (starts with `TEST-` for sandbox, `APP_USR-` for production)
4. Check browser network tab for failed requests to `sdk.mercadopago.com`
5. Check browser console for JS errors

---

## onSubmit never triggers

**Symptom**: User clicks pay but nothing happens.

**Causes:**
- `amount: 0` — must be > 0
- `amount` is a string: `"100"` instead of `100`
- `onSubmit` not defined in callbacks (silently fails)
- Form has validation errors the user hasn't fixed (card number, expiry, etc.)

**Fix:**
```js
initialization: { amount: 100.00 }  // number, not string, not zero
callbacks: { onSubmit: async ({ formData }) => { ... } }  // must be defined
```

---

## Payment Brick shows "something went wrong"

**Symptom**: Error message in the Brick UI.

**Causes:**
- `onSubmit` callback throws an unhandled error
- Network error during server API call inside `onSubmit`

**Fix:**
- Add try/catch in `onSubmit` and re-throw only on actual failures

---

## Local payment methods not showing (Pix, Boleto, OXXO, PSE, etc.)

**Symptom**: Only card form appears, local payment methods for the country are missing.

**Causes:**
- `paymentMethods` not configured for the seller's country
- Wrong `PUBLIC_KEY` (key from a different country)

**Fix:** Configure `paymentMethods` per country — see `./rules-payment-methods.md`.

---

## Installments not appearing

**Symptom**: Card form shows but no installment selector.

**Causes:**
- Amount is too low (below minimum for installments in that country)
- `maxInstallments: 1` set in config
- Card BIN doesn't support installments

**Fix:**
- Remove `maxInstallments: 1` from config, or set to higher
- Test with a higher amount
- Use official test cards that support installments

---

## Payment created but status is "pending" or "action_required"

**Symptom**: Payment API returns `status: "pending"` or `status: "action_required"`.

**Explanation**: This is normal and expected for:
- **Cash/ticket methods** (Boleto, OXXO, Rapipago, Efecty, etc.) — user must pay at a physical location. Status: `action_required` / `waiting_payment`
- **Pix** — user must scan the QR code or copy the code. Status: `pending` / `pending_waiting_transfer`
- **PSE (Colombia)** — user is redirected to bank portal. Status: `pending` / `pending_waiting_transfer`
- **3DS challenge** — card issuer requires authentication. Status: `pending` / `pending_challenge`

**Fix:** Use the **Status Screen Brick** with the `payment_id` — it automatically handles all these scenarios (shows QR code for Pix, voucher for Boleto, 3DS challenge iframe, etc.). Set up webhooks for async status updates.

---

## API error 400 when creating payment

**Symptom**: Server returns 400 from MP Orders API.

**Common causes:**
- Missing required fields (token, email, transaction_amount)
- Token already used (single-use — each onSubmit needs a fresh token)
- Token already used (single-use) or expired (7-day validity)
- `payment_method_id` doesn't match card brand

**Fix:**
```python
# Check the full Orders API error response body from your backend logs:
# response.status_code and response.json() should be logged for POST /v1/orders
```

---

## API error 401

**Cause**: Wrong or expired access token.

**Fix:**
- Use `ACCESS_TOKEN` (not public key) for server-side API calls
- Refresh credentials in MP dashboard if expired
- Ensure you're using the **private** access token, not the public key

---

## 3DS challenge needed but not handled

**Symptom**: Payment gets `status: "pending"`, `status_detail: "pending_challenge"` but user sees no challenge.

**Fix:**
1. After getting payment result from your server, check `status` and `status_detail`
2. If `pending_challenge`: initialize Status Screen Brick with the `payment_id`
3. The Status Screen Brick handles the 3DS challenge automatically

```js
// In your onSubmit handler:
const result = await createPaymentOnServer(formData);
if (result.status === "pending" && result.status_detail === "pending_challenge") {
  // Render Status Screen Brick
  window.location.href = `/payment/3ds?payment_id=${result.payment_id}`;
}
```

---

## MercadoPago wallet/credit option not showing (preferenceId is a placeholder)

**Symptom**: The Brick renders cards and other payment methods, but the MercadoPago wallet/credit option doesn't appear even though `mercadoPago: "all"` is configured.

**Cause:** The `preferenceId` passed to `initialization` is a placeholder string copied from documentation instead of a real preference ID created via the API.

**Invalid preferenceId examples:**
- `<PREFERENCE_ID>` — template placeholder
- `preference_id` — variable name, not a value
- `YOUR_PREFERENCE_ID` — documentation placeholder
- `123456` — too short, wrong format
- Any hardcoded string that was never returned by `POST /checkout/preferences`

**Valid format:** `1234567890-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (string returned by the Preferences API)

**Fix:** Create a real preference via `POST https://api.mercadopago.com/checkout/preferences` with your ACCESS_TOKEN, then use the `id` from the response. See `../../references/rules-preference.md` for instructions.

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
