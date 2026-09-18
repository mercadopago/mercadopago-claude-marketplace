---
description: Wire the Mercado Pago Checkout Pro library into the retail example of an Anthropic commerce-agents project.
argument-hint: ""
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion]
---

# /mp-commerce

Add a Mercado Pago hosted checkout handoff to the `retail` commerce-agents
example. The seller backend stores the checkout attempt, while the pinned
Checkout Pro library creates and validates the Order. The executor renders the
returned `checkout_url` after the model call.

## Behaviour

1. Hand control to the `mp-commerce-checkout` skill, passing `$ARGUMENTS`.
2. Pin `mercadopago-commerce-agents-checkout==0.1.0`; do not recreate its
   Orders HTTP transport in the generated project.
3. Do not authenticate or run a live payment as a preflight. The scaffold and
   its tests are local.
4. If the developer also asks for test users, webhooks or an integration
   review, suggest the corresponding skill from the separate `mercadopago`
   plugin.
