# Status Screen Brick — Troubleshooting

## Status Screen shows error state

**Symptom**: Brick renders with error message instead of payment result.

**Causes:**
1. `paymentId` is invalid (wrong id, doesn't exist)
2. `paymentId` is from a different environment (sandbox vs production)
3. `paymentId` was not extracted from the order response (`transactions.payments[0].id`)

**Fix:**
```js
// CORRECT — use payment id returned by your backend
initialization: { paymentId: "pay_01JC1KVZ0WJY8Y4WA7MZG3A8F2" }

// WRONG — using order id instead of payment_id
initialization: { paymentId: "01JC1KVZ0WJY8Y4WA7MZAD5S2T" }

// WRONG — undefined
initialization: { paymentId: undefined }
```

---

## 3DS challenge not appearing

**Symptom**: Payment is `pending_challenge` but the Brick shows a pending message without the challenge UI.

**Cause:** Missing `three_d_secure_mode` in order creation request.

**Fix:** Add `three_d_secure_mode: "optional"` to your order creation request. See `./rules-3ds.md` for details.

---

## Status stuck on "pending" for cash payments

**Symptom**: Boleto/OXXO/cash payment shows `pending_waiting_payment` indefinitely.

**Explanation**: This is correct — the user hasn't completed the payment yet. These methods are asynchronous: the user must complete payment outside the checkout (via bank app, QR code scan, or at a physical payment point). Status updates to `approved` when the payment is confirmed.

**For your server:** Set up a webhook to receive the async status update.

---

## Back buttons not showing

**Symptom**: Payment result displayed but no redirect buttons.

**Cause:** `backUrls` not configured in customization.

**Fix:**
```js
customization: {
  backUrls: {
    return: "https://yoursite.com/shop",
    error: "https://yoursite.com/error",
  }
}
```

See `./rules-backurl.md` for details.

---

## Status Screen not loading (blank container)

**Symptom**: Container div remains empty even with correct paymentId.

**Checklist:**
1. Is the container div present in the DOM before `bricksBuilder.create()` runs?
2. MP SDK loaded before your script?
3. `new MercadoPago(key, { locale })` called before `bricksBuilder.create()`?
4. Check browser console for errors

---

## Submit fails intermittently — works sometimes, breaks other times

**Symptom**: The Brick sometimes loads correctly, but other times the container stays blank. The behavior is inconsistent — it seems to depend on how fast the page loads.

**Cause:** The code uses `setTimeout` to "wait" for the Brick to load. The problem is that `setTimeout` is a guess — sometimes 2 seconds is enough, sometimes it's not.

**Fix:** Replace `setTimeout` with the `onReady` callback. The Brick tells you exactly when it's ready — no guessing.

```js
const settings = {
  callbacks: {
    onReady: () => {
      document.getElementById("loading").style.display = "none";
    },
    onError: (error) => { console.error(error); },
  },
};
```

**Rule:** Never use `setTimeout` to wait for a Brick. Always use `onReady`.

---

## Error catalog and lifecycle

See `../../references/rules-errors.md` for the complete error catalog (initialization + communication errors) and lifecycle management rules.
