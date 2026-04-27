
## Description

Card-only payment form with PCI-compliant tokenization, brand detection, and installment selection. Use when: Card Payment Brick, card-only, só cartão, solo tarjeta, credit card form, debit card form, formulário de cartão, tokenizar cartão, tokenizar tarjeta.

## Compatibility

JavaScript browser-only. All 7 MP markets (MLA/MLB/MLM/MCO/MLC/MPE/MLU).

## Metadata

### Version

1.0.0

# MercadoPago Card Payment Brick

> **Language rule**: Always respond in the same language the developer is writing in.

---

## Step-by-step setup

### 1. Confirm prerequisites

Read: `../references/rules-bricks-setup.md`

Shared setup: credentials, tech stack detection, SDK initialization, and container div.

---

### 2. Configure

Configure initialization.amount (Number). For card type filtering and installments, see `./references/customization.md` — "Payment methods filtering" and "Installments limit" sections.

---

### 3. Render the Brick

Read: `./references/snippets.md`

JS and React render code with initialization, callbacks, and customization.

---

### 4. Handle callbacks

Read: `./references/rules-callbacks.md`

onSubmit (required, Promise, sends cardFormData), onReady (required), onError (required).

---

### 5. Create order on the server side

Read: `./references/snippets.md` — "Server-side order creation" section.

Backend uses token + formData to call MP Orders API (`POST /v1/orders`) using `processing_mode: "automatic"` only. Handles 3DS if needed.

From the order response, extract `payment_id` from the first payment transaction and return it to frontend:
- `payment_id = order.transactions.payments[0].id`

---

### 6. Customize appearance (optional)

Read: `./references/customization.md`

Visual themes, labels, and layout options.

---

### 7. Run quality gates (MANDATORY before Implementation Report)

Before generating the report, run both checks for this brick:

1. `mcp__mercadopago__quality_checklist`
2. `mcp__mercadopago__quality_evaluation`

Both must complete successfully before moving to the Implementation Report.

---

## Implementation Report

**🛑 MANDATORY FINAL STEP — ALWAYS GENERATE THIS REPORT BEFORE ENDING THE SKILL**

After implementation is complete, generate and output a consolidated report:

```markdown
## 📋 Card Payment Brick Implementation Report

### ✅ Completed (Mandatory)
- [x] Step 1: Prerequisites confirmed
- [x] Step 2: Card types and installments configured
- [x] Step 3: Brick rendered
- [x] Step 4: Callbacks implemented
- [x] Step 5: Server-side order created
- [x] Quality gates completed (`mcp__mercadopago__quality_checklist` + `mcp__mercadopago__quality_evaluation`)
- [x] Implementation Report generated

### 📋 Optional (Can be done later)
- [ ] Step 6: Appearance customization
- [ ] Testing: Detailed sandbox testing

### 🎯 What's Next
1. Implement appearance customization (Step 6) - optional
2. Configure webhooks for real-time payment notifications
3. Go to production (swap TEST- keys for live keys)

### 🔗 Resources
- [Card Payment Brick Docs](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick)
- [Troubleshooting](references/troubleshooting.md)
- [Customization](references/customization.md)
```

**🎉 After outputting the report above, the Card Payment Brick implementation is complete.**

---

## Optional: Run Tests (OPTIONAL)

**Ask the developer:**

**"Would you like to run tests before going live?"**

If yes, execute:
1. Use `mcp__mercadopago__search_documentation` to fetch the official "Test cards" guide.
2. Create test users via `mcp__mercadopago__create_test_user`
3. Test different installment counts (1, 3, 6, 12)
4. Test both credit and debit cards

If no, the implementation flow is complete.

---

## Webhooks / Payment Notifications (RECOMMENDED)

For webhook setup, signature validation (HMAC-SHA256), retry handling, and idempotency patterns, use the `mp-notifications` skill.

---

## Troubleshooting

Read: `./references/troubleshooting.md`
