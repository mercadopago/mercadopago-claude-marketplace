---
description: Scaffold Checkout Pro via Orders API in the retail example of an Anthropic commerce-agents project.
argument-hint: "[site=MLC|MLA|MLB|MLM|MCO|MPE|MLU]"
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion]
---

# /mp-commerce

Add a Mercado Pago hosted checkout handoff to the `retail` commerce-agents
example. The backend creates an online Order through `POST /v1/orders`; the
executor renders the returned `checkout_url` after the model call.

## Behaviour

1. Hand control to the `mp-commerce-checkout` skill, passing `$ARGUMENTS`.
2. Do not authenticate or run a live payment as a preflight. The scaffold and
   its tests are local.
3. If the developer also asks for test users, webhooks or an integration
   review, suggest the corresponding skill from the separate `mercadopago`
   plugin.
