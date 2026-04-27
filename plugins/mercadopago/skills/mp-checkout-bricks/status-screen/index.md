## Description

Payment result screen (approved/pending/rejected) with automatic 3DS challenge handling. Requires a `payment_id` generated from an Orders API `automatic` flow. Use when: Status Screen Brick, show payment result, mostrar resultado, resultado del pago, 3DS challenge, tela de status, post-payment screen.

## Compatibility

JavaScript browser-only. All 7 MP markets (MLA/MLB/MLM/MCO/MLC/MPE/MLU).

## Metadata

### Version

1.0.0

# MercadoPago Status Screen Brick

> **Language rule**: Always respond in the same language the developer is writing in.

---

## Step-by-step setup

### 1. Confirm prerequisites

Read: `../references/rules-bricks-setup.md`

Shared setup: credentials, tech stack detection, SDK initialization, and container div.

---

### 2. Configure

Configure initialization.paymentId (payment transaction id obtained from the order execution result) and customization.backUrls (object with return/error).

`payment_id` source (MANDATORY):
- Use the first payment transaction from the order response:
- `payment_id = order.transactions.payments[0].id`
- Pass this value to Status Screen `initialization.paymentId`.

See `./references/rules-backurl.md` for back URL rules. See `./references/rules-3ds.md` for 3DS challenge flow and `./references/rules-status.md` for payment statuses.

---

### 3. Render the Brick

Read: `./references/snippets.md`

JS and React render code with paymentId, backUrls, callbacks, and theme.

---

### 4. Handle callbacks

onReady (required) and onError (required). No onSubmit for Status Screen.

---

### 5. Customize appearance (optional)

Read: `./references/customization.md`

Visual options: hide status details, show external reference, text labels, themes.

---

### 6. Run quality gates (MANDATORY before Implementation Report)

Before generating the report, run both checks for this brick:

1. `mcp__mercadopago__quality_checklist`
2. `mcp__mercadopago__quality_evaluation`

Both must complete successfully before moving to the Implementation Report.

---

## Implementation Report

**🛑 MANDATORY FINAL STEP — ALWAYS GENERATE THIS REPORT BEFORE ENDING THE SKILL**

After implementation is complete, generate and output a consolidated report:

```markdown
## 📋 Status Screen Brick Implementation Report

### ✅ Completed (Mandatory)
- [x] Step 1: Prerequisites confirmed
- [x] Step 2: paymentId and backUrls configured
- [x] Step 3: Brick rendered
- [x] Step 4: Callbacks implemented
- [x] Quality gates completed (`mcp__mercadopago__quality_checklist` + `mcp__mercadopago__quality_evaluation`)
- [x] Implementation Report generated

### 📋 Optional (Can be done later)
- [ ] Step 5: Appearance customization
- [ ] Testing: Detailed sandbox testing

### 🎯 What's Next
1. Implement appearance customization (Step 5) - optional
2. Configure webhooks for real-time payment status updates
3. Go to production (swap TEST- keys for live keys)

### 🔗 Resources
- [Status Screen Brick Docs](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/status-screen-brick)
- [Troubleshooting](references/troubleshooting.md)
- [Customization](references/customization.md)
```

**🎉 After outputting the report above, the Status Screen Brick implementation is complete.**

---

## Optional: Run Tests (OPTIONAL)

**Ask the developer:**

**"Would you like to run tests before going live?"**

If yes, execute:
1. Use `mcp__mercadopago__search_documentation` to fetch the official "Test cards" guide.
2. Use sandbox payment IDs generated from Card Payment Brick or Payment Brick Orders API testing
3. Test each status scenario (approved, pending, rejected, 3DS challenge)
4. Click back button — verify it navigates to configured backUrls

If no, the implementation flow is complete.

---

## Troubleshooting

Read: `./references/troubleshooting.md`
