# Card Payment Brick — Callbacks Reference

## Overview

The Card Payment Brick exposes 4 callbacks. **Three are required**: `onSubmit`, `onReady`, and `onError`. The Brick will throw `missing_required_callbacks` if `onReady` or `onError` are missing.

| Callback | Required | Purpose |
|---|---|---|
| `onSubmit` | **Yes** | Sends tokenized card data to your backend |
| `onReady` | **Yes** | Signals the Brick is fully loaded and interactive |
| `onError` | **Yes** | Receives all Brick errors |
| `onBinChange` | No | Card BIN detection (first 6-8 digits) |

---

## onSubmit (REQUIRED)

Called when the user submits the card form and MP has successfully tokenized the card data.

### Critical rules

1. **Must return a Promise** — the Brick waits for it to settle. Use `async/await` or return `fetch()` directly. If you don't return a Promise, the Brick won't know when your backend call finishes.
2. **Send the entire `cardFormData` object** to your backend — do not cherry-pick fields. Your backend should forward the complete object to the MP Orders API.
3. If the Promise **rejects or throws**, the Brick shows an error state to the user.
4. If the Promise **resolves**, the Brick considers the order submitted.
5. **Use the `token` immediately** — tokens are **single-use** and expire in **7 days**.

### Signature

```js
onSubmit: async (cardFormData) => {
  // cardFormData: object — COMPLETE tokenized card data (see structure below)

  // MUST return a Promise — the Brick waits for this
  const response = await fetch("/api/card-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cardFormData),  // send the ENTIRE object
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Order failed");
  }

  // Backend contract (recommended):
  // { order_id, payment_id, status, status_detail }
  // payment_id must come from order.transactions.payments[0].id
  // Handle 3DS if required
  if (result.status === "pending" && result.status_detail === "pending_challenge") {
    window.location.href = `/payment/3ds?payment_id=${result.payment_id}`;
    return;
  }

  // Redirect to result page
  window.location.href = `/payment/result?payment_id=${result.payment_id}&status=${result.status}`;
}
```

### Anti-pattern: NOT returning a Promise

```js
// ❌ WRONG — no return, Brick doesn't know when backend call finishes
onSubmit: (cardFormData) => {
  fetch("/api/card-payment", { method: "POST", body: JSON.stringify(cardFormData) });
}

// ❌ WRONG — cherry-picking fields, may miss country-specific required fields
onSubmit: async (cardFormData) => {
  await fetch("/api/card-payment", {
    body: JSON.stringify({ token: cardFormData.token, amount: cardFormData.transaction_amount }),
  });
}

// ✅ CORRECT — async + returns implicitly + sends entire cardFormData
onSubmit: async (cardFormData) => {
  const res = await fetch("/api/card-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cardFormData),
  });
  if (!res.ok) throw new Error("Order failed");
  const result = await res.json();
  window.location.href = `/result?payment_id=${result.payment_id}`;
}
```

### cardFormData structure

```js
{
  token: "abc123ef...",             // REQUIRED — single-use card token (single-use, EXPIRES IN 7 DAYS)
  issuer_id: "205",                 // Card issuer ID (bank)
  payment_method_id: "visa",        // Card brand: visa | mastercard | amex | elo | hipercard | etc.
  payment_method_option_id: null,   // For specific payment options (some countries)
  processing_mode: "aggregator",    // aggregator | gateway
  transaction_amount: 100.00,       // Same amount passed in initialization
  installments: 3,                  // Number of installments selected by user (1 if no selection)
  payer: {
    email: "buyer@example.com",
    identification: {
      type: "CPF",                  // ID type (varies by country)
      number: "12345678901"         // ID number (entered by user in the form)
    }
  }
}
```

---

## onReady (REQUIRED)

Called when the Brick is fully loaded, the card form is visible, and Secure Fields iframes are interactive. **This is the signal that the Brick is ready for user interaction.**

### Signature

```js
onReady: () => {
  // The Brick is fully loaded — safe to interact
  // Use this to:
  // 1. Hide your loading spinner/skeleton
  // 2. Enable external pay buttons (if controlling submit externally)
  // 3. Log analytics events
}
```

---

## onError (REQUIRED)

Called when the Brick encounters any error — initialization, configuration, or communication with MP APIs.

### Signature

```js
onError: (error) => {
  // error.cause: string — machine-readable error code (lower_snake_case)
  // error.message: string — human-readable description (English)
  console.error("Brick error:", error.cause, error.message);
}
```

---

## onBinChange (optional)

Called when the user enters enough digits for card brand detection (first 6-8 digits).

### Signature

```js
onBinChange: (bin) => {
  // bin: string — first 8 digits of the card number
}
```

### Use cases
- Display card bank logo or name based on BIN
- Show/hide specific promotions based on issuing bank
- Fetch custom installment promotions for specific bank+country combinations

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "Card Payment Brick onSubmit onError onReady callbacks")`
