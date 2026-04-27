# Payment Brick — Callbacks Reference

## Overview

The Payment Brick exposes 4 callbacks. **Three are required**: `onSubmit`, `onReady`, and `onError`. The Brick will throw `missing_required_callbacks` if `onReady` or `onError` are missing.

| Callback | Required | Purpose |
|---|---|---|
| `onSubmit` | **Yes** | Sends payment data to your backend |
| `onReady` | **Yes** | Signals the Brick is fully loaded and interactive |
| `onError` | **Yes** | Receives all Brick errors |
| `onBinChange` | No | Card BIN detection (first 6-8 digits) |

---

## onSubmit (REQUIRED)

Called when the user clicks the pay button and the Brick has validated all fields.

### Critical rules

1. **Must return a Promise** — the Brick waits for it to settle. Use `async/await` or return `fetch()` directly. If you don't return a Promise, the Brick won't know when your backend call finishes.
2. **Send the entire `formData` object** to your backend — do not cherry-pick fields. The shape changes by payment method and country; your backend should forward the complete object to the MP Orders API.
3. If the Promise **rejects or throws**, the Brick shows a generic error to the user.
4. If the Promise **resolves**, the Brick considers the order submitted.
5. For token-based payments (cards), tokens are **single-use** and expire in **7 days**.

### Signature

```js
onSubmit: async ({ selectedPaymentMethod, formData }) => {
  // selectedPaymentMethod: string — "credit_card", "debit_card", "bank_transfer", "ticket", "wallet_purchase", etc.
  // formData: object — COMPLETE payment data, shape varies by method (see below)

  // MUST return a Promise — the Brick waits for this
  const response = await fetch("/api/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),  // send the ENTIRE formData
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Order failed");
  }

  // Backend contract (recommended):
  // { order_id, payment_id, status, status_detail }
  // payment_id must come from order.transactions.payments[0].id
  window.location.href = `/payment/result?payment_id=${result.payment_id}&status=${result.status}`;
}
```

### Anti-pattern: NOT returning a Promise

```js
// ❌ WRONG — no return, Brick doesn't know when backend call finishes
onSubmit: ({ formData }) => {
  fetch("/api/payment", { method: "POST", body: JSON.stringify(formData) });
}

// ❌ WRONG — cherry-picking fields, may miss country-specific required fields
onSubmit: async ({ formData }) => {
  await fetch("/api/payment", {
    body: JSON.stringify({ token: formData.token, amount: formData.transaction_amount }),
  });
}

// ✅ CORRECT — async + returns implicitly + sends entire formData
onSubmit: async ({ formData }) => {
  const res = await fetch("/api/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });
  if (!res.ok) throw new Error("Order failed");
  const result = await res.json();
  window.location.href = `/result?payment_id=${result.payment_id}`;
}
```

### formData shape by payment method

**Credit / Debit Card:**
```js
{
  token: "abc123...",           // single-use card token (single-use, expires in 7 days)
  issuer_id: "205",
  payment_method_id: "visa",
  transaction_amount: 100.00,
  installments: 3,
  payer: {
    email: "buyer@example.com",
    identification: {
      type: "CPF",              // varies by country
      number: "12345678901"
    }
  }
}
```

**Pix (Brazil only):**
```js
{
  payment_method_id: "pix",
  transaction_amount: 100.00,
  payer: {
    email: "buyer@example.com",
    first_name: "John",
    last_name: "Doe",
    identification: { type: "CPF", number: "12345678901" }
  }
}
```

**Boleto (Brazil only):**
```js
{
  payment_method_id: "bolbradesco",
  transaction_amount: 100.00,
  payer: {
    email: "buyer@example.com",
    first_name: "John",
    last_name: "Doe",
    identification: { type: "CPF", number: "12345678901" },
    address: {
      zip_code: "01310-100",
      street_name: "Av Paulista",
      street_number: "1000",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      federal_unit: "SP"
    }
  }
}
```

**OXXO / Cash tickets (Mexico, Argentina, etc.):**
```js
{
  payment_method_id: "oxxo",       // rapipago, pagofacil, etc.
  transaction_amount: 100.00,
  payer: {
    email: "buyer@example.com",
    first_name: "John",
    last_name: "Doe"
  }
}
```

**PSE (Colombia):**
```js
{
  payment_method_id: "pse",
  transaction_amount: 100.00,
  payer: {
    email: "buyer@example.com",
    identification: { type: "CC", number: "12345678" },
    entity_type: "individual"
  },
  additional_info: {
    ip_address: "192.168.1.1"
  },
  callback_url: "https://yoursite.com/pse-callback"
}
```

---

## onReady (REQUIRED)

Called when the Brick is fully loaded, rendered, and interactive. **This is the signal that the Brick is ready for user interaction.**

### Signature

```js
onReady: () => {
  // The Brick is fully loaded — safe to interact
  // Use this to:
  // 1. Hide your loading spinner/skeleton
  // 2. Enable external pay buttons (if controlling submit externally)
  // 3. Start timers (e.g., for session timeout)
  // 4. Log analytics events
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
  // Use to fetch installment options or display card brand
}
```

**Use case**: Displaying card bank logo or fetching custom installment promotions.

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "Payment Brick onSubmit onError onReady callbacks")`
