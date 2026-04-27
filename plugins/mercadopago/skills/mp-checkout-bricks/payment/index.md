## Description

All-in-one payment form: cards, Pix, Boleto, OXXO, PSE, Yape, cash methods, installments, and MercadoPago wallet. Use when: Payment Brick, multiple payment methods, formulário de pagamento, métodos de pago, Pix, Boleto, OXXO, checkout completo, all-in-one checkout, aceitar vários meios de pagamento, aceptar múltiples medios de pago.

## Compatibility

JavaScript browser-only. All 7 MP markets (MLA/MLB/MLM/MCO/MLC/MPE/MLU).

## Metadata

### Version

1.0.0

# MercadoPago Payment Brick

> **Language rule**: Always respond in the same language the developer is writing in.

---

## Step-by-step setup

### 1. Confirm prerequisites

Read: `../references/rules-bricks-setup.md`

Shared setup: credentials, tech stack detection, SDK initialization, and container div.

---

### 2. Initialize the Brick

Read: `./references/rules-initialization.md`

Configure initialization.amount (Number) and preferenceId (if mercadoPago enabled).

---

### 3. Configure payment methods

Read: `./references/rules-payment-methods.md`

Configure paymentMethods per country/siteId. Not all methods available everywhere.

---

### 3b. Conditional: if mercadoPago is enabled — create a preference first

**Only execute this step if `mercadoPago` property is included in the payment methods config from Step 3.**

When `mercadoPago` is enabled, the "Pay with MercadoPago" wallet option requires a server-side preference. If `mercadoPago` is NOT in the config: **skip this step entirely** and proceed to Step 4.

Read: `../references/rules-preference.md`


---

### 4. Render the Brick

Read: `./references/snippets.md` — "Payment Brick render" section.

JS and React render code with initialization, callbacks, and customization.

---

### 5. Handle callbacks

Read: `./references/rules-callbacks.md`

onSubmit (required, Promise), onReady (required), onError (required). See reference for details.

---

### 6. Create order on the server side

Read: `./references/snippets.md` — "Server-side order creation" section.

Backend receives formData from onSubmit and calls MP Orders API (`POST /v1/orders`) using `processing_mode: "automatic"` only.

From the order response, extract `payment_id` from the first payment transaction and return it to frontend:
- `payment_id = order.transactions.payments[0].id`

---

### 7. Customize appearance (optional)

Read: `./references/customization.md`

Visual themes, labels, and layout options.

---

### 8. Run quality gates (MANDATORY before Implementation Report)

Before generating the report, run both checks for this brick:

1. `mcp__mercadopago__quality_checklist`
2. `mcp__mercadopago__quality_evaluation`

Both must complete successfully before moving to the Implementation Report.

---

## Implementation Report

**🛑 MANDATORY FINAL STEP — ALWAYS GENERATE THIS REPORT BEFORE ENDING THE SKILL**

After implementation is complete, generate and output a consolidated report:

```markdown
## 📋 Payment Brick Implementation Report

### ✅ Completed (Mandatory)
- [x] Step 1: Prerequisites confirmed
- [x] Step 2: Brick initialized
- [x] Step 3: Payment methods configured
- [x] Step 4: Brick rendered
- [x] Step 5: Callbacks implemented
- [x] Step 6: Server-side order created
- [x] Quality gates completed (`mcp__mercadopago__quality_checklist` + `mcp__mercadopago__quality_evaluation`)
- [x] Implementation Report generated

### 📋 Optional (Can be done later)
- [ ] Step 7: Appearance customization
- [ ] Testing: Detailed sandbox testing

### 🎯 What's Next
1. Implement appearance customization (Step 7) - optional
2. Configure webhooks for real-time notifications
3. Monitor payments in MercadoPago dashboard
4. Go to production (swap TEST- keys for live keys)

### 🔗 Resources
- [Payment Brick Docs](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick)
- [Troubleshooting](references/troubleshooting.md)
- [Customization](references/customization.md)
```

**🎉 After outputting the report above, the Payment Brick implementation is complete.**

---

## Optional: Run Tests (OPTIONAL)

**Ask the developer:**

**"Would you like to run tests before going live?"**

If yes, execute:
1. Use `mcp__mercadopago__search_documentation` to fetch the official "Test cards" guide.
2. Create test users via `mcp__mercadopago__create_test_user` (create 2: buyer + seller)
3. Add test funds via `mcp__mercadopago__add_money_test_user` if testing wallet/balance
4. Test each payment method available for the target country

If no, the implementation flow is complete.

---

## Webhooks / Payment Notifications (RECOMMENDED)

For webhook setup, signature validation (HMAC-SHA256), retry handling, and idempotency patterns, use the `mp-notifications` skill.

---

## Troubleshooting

Read: `./references/troubleshooting.md`
