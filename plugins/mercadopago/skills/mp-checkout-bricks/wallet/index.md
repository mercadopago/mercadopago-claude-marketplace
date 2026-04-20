## Description

One-click pay button for logged-in MercadoPago users using saved cards, balance, or Mercado Crédito. Use when: Wallet Brick, pay with MercadoPago, pagar com Mercado Pago, pagar con Mercado Pago, botão MercadoPago, one-click payment, carteira digital.

## Compatibility

JavaScript browser-only. All 7 MP markets (MLA/MLB/MLM/MCO/MLC/MPE/MLU).

## Metadata

### Version

1.0.0

# MercadoPago Wallet Brick

> **Language rule**: Always respond in the same language the developer is writing in.

---

## Step-by-step setup

### 1. Confirm prerequisites

Read: `../references/rules-bricks-setup.md`

Shared setup: credentials, tech stack detection, SDK initialization, and container div.

---

### 2. Configure

Read: `../references/rules-preference.md`

Create a server-side preference (REQUIRED before rendering). The Brick needs a real preferenceId.

---

### 3. Render the Brick

Read: `./references/snippets.md`

JS and React render code with preferenceId, redirectMode, callbacks, and valueProp.

---

### 4. Handle callbacks

onReady (required) and onError (required). onSubmit is optional (no params — fires when user clicks the button before redirect).

---

### 5. Customize appearance (optional)

Read: `./references/customization.md`

Button text variants, theme, redirect mode, and visual options.

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
## 📋 Wallet Brick Implementation Report

### ✅ Completed (Mandatory)
- [x] Step 1: Prerequisites confirmed
- [x] Step 2: Server-side preference created
- [x] Step 3: Brick rendered
- [x] Step 4: Callbacks implemented
- [x] Quality gates completed (`mcp__mercadopago__quality_checklist` + `mcp__mercadopago__quality_evaluation`)
- [x] Implementation Report generated

### 📋 Optional (Can be done later)
- [ ] Step 5: Appearance customization
- [ ] Testing: Detailed sandbox testing

### 🎯 What's Next
1. Implement appearance customization (Step 5) - optional
2. Configure webhooks for real-time payment notifications
3. Go to production (swap TEST- keys for live keys)

### 🔗 Resources
- [Wallet Brick Docs](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/wallet-brick)
- [Troubleshooting](references/troubleshooting.md)
- [Customization](references/customization.md)
```

**🎉 After outputting the report above, the Wallet Brick implementation is complete.**

---

## Optional: Run Tests (OPTIONAL)

**Ask the developer:**

**"Would you like to run tests before going live?"**

If yes, execute:
1. Use `mcp__mercadopago__search_documentation` to fetch the official "Test cards" guide.
2. Create 2 test users via `mcp__mercadopago__create_test_user` (buyer + seller)
3. Add funds to buyer test account via `mcp__mercadopago__add_money_test_user`
4. Complete a payment using saved test card or test balance
5. Verify back URLs receive correct query parameters

If no, the implementation flow is complete.

---

## Troubleshooting

Read: `./references/troubleshooting.md`
