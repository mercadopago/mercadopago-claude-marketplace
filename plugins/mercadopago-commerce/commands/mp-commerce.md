---
description: Discover and wire Mercado Pago Checkout Pro into a Python commerce-agent backend.
argument-hint: "[analyze|apply]"
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion]
---

# /mp-commerce

Integrate a server-side Python commerce agent with Mercado Pago Checkout Pro
through `mercadopago-commerce-agents-checkout==0.1.0`.

## Required flow

1. Hand control to the `mp-commerce-checkout` skill, passing `$ARGUMENTS`.
2. Always start with its read-only discovery phase. Do not install dependencies
   or edit files during discovery.
3. Present the discovered checkout entry point, cart mapping, authoritative
   catalog, durable attempt store, safe handoff boundary, dependency manager,
   target files, and verification plan.
4. Ask for explicit confirmation before applying the displayed plan, including
   when `$ARGUMENTS` contains `apply`.
5. During apply, pin `mercadopago-commerce-agents-checkout==0.1.0`; never
   recreate its Orders API transport in the generated project.
6. Run local or mocked verification only. Do not authenticate, create an Order,
   or call Mercado Pago as a preflight.

For a non-Python project, do not generate a multilingual implementation. Give
the official server-side Orders API fallback documented by the skill and stop.

If the developer separately asks for test users, webhooks, or an integration
review, suggest the corresponding capability from the `mercadopago` plugin.
