---
description: Add Mercado Pago Checkout Pro as the payment provider of an Anthropic commerce-agents shopping agent.
argument-hint: "[site=MLC|MLA|MLB|MLM|MCO|MPE|MLU] [example=retail|travel|telecom|entertainment]"
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion]
---

# /mp-commerce

Turn a commerce-agents deployment into one that takes real money through Mercado Pago.

The blueprint leaves payment to the host on purpose: `checkout_handoff` returns a hosted checkout URL that the executor attaches to the checkout card after the model's call, so the model never sees it. Checkout Pro returns exactly that URL. This command implements the method.

## Behaviour

1. Hand control to the `mp-commerce-checkout` skill, passing `$ARGUMENTS` through.
2. Do not check MCP status first. The scaffold is local. Connect only if the developer also asks for test users, which the `mp-test-setup` skill of the `mercadopago` plugin owns.
