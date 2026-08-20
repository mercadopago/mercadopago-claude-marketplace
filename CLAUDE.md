# Development Spec — mercadopago-claude-marketplace

## Architecture: MCP-First Orchestration (v4)

This project follows an **MCP-first orchestration architecture** where:

- **Agent** = thin router (`mp-integration-expert`) that detects country, mode, and intent, then delegates.
- **Skills** = orchestrators that translate developer intent into MCP queries and assemble the response. They contain routing logic, gotchas, and a small fixed security floor — **not** documentation copies.
- **MCP** = the single source of truth (`plugin:mercadopago:mercadopago`). Every endpoint, payload, snippet, payment status, country/product matrix, quality criterion, and webhook tool lives here. Pulled live, never duplicated.

### The Golden Rules

1. **Connect MCP only when the selected operation needs an MCP tool.** Static scaffolding, bundled references, test cards, webhook receiver generation, and local security checks remain available offline. Authenticate immediately before account data/actions, test-user operations, live documentation fallback, webhook administration, or official quality operations.
2. **One agent (`mp-integration-expert`).** It is the only directly invocable component. Skills are passive reference documents.
3. **Four skills only.** `mp-integrate`, `mp-webhooks`, `mp-test-setup`, `mp-review`. Adding a fifth requires rethinking the architecture — most additions belong inside `mp-integrate` as another wizard branch.
4. **No documentation duplication.** If a piece of information is in the public Mercado Pago docs or returned by an MCP tool, it does not live in this repo.

## File Format Rules

### Agent (`agents/*.md`)

```yaml
---
name: mp-integration-expert
description: ...
tools: Read, Grep, Glob, Bash, WebFetch    # REQUIRED for agents
model: sonnet                                # REQUIRED for agents
tags: [...]
category: development
version: 4.0.0
---
```

### Skill (`skills/*/SKILL.md`)

```yaml
---
name: mp-integrate
description: ...
metadata:                                    # metadata block ONLY
  version: "4.0.0"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "..."
---
```

**NEVER add `tools` or `model` to a SKILL.md.** Adding these fields converts the skill into an independent agent, breaking the single-router architecture. Skills must remain passive reference documents.

### Command (`commands/*.md`)

```yaml
---
description: ...
argument-hint: "..."
allowed-tools: [Read, Write, Edit, Bash]     # allowed-tools, NOT tools
---
```

## What Goes WHERE

| Content Type | Location | Example |
|---|---|---|
| MCP-gate, country detection, mode detection, security floor | `agents/mp-integration-expert.md` | Step 0 — MCP gate; country signal table |
| Wizard logic + gotchas per product | `skills/mp-integrate/SKILL.md` | "If product=bricks → ask brick variant" |
| HMAC validation pattern + webhook tool wrappers | `skills/mp-webhooks/SKILL.md` | Reference Node snippet for HMAC-SHA256 |
| Test user creation + funds + testing-model clarifications | `skills/mp-test-setup/SKILL.md` | "There is no `TEST-` prefix anymore" |
| Quality checklist orchestration + security floor | `skills/mp-review/SKILL.md` | Cross-cutting security table |
| Endpoints, request/response payloads, code snippets, status tables, payment methods per country | **MCP server** (fetched at runtime) | `search_documentation`, `quality_checklist` |
| User-facing commands | `commands/*.md` | `/mp-integrate`, `/mp-review`, `/mp-connect` |

## What MUST NOT live in this repo

- Endpoint URLs or request/response schemas → MCP.
- Payment status tables → MCP.
- Per-country payment methods → MCP.
- Device model lists for Point → MCP.
- SDK code samples beyond a single canonical reference (HMAC) → MCP.
- "How to integrate {product}" step-by-step prose → MCP.
- Anything described as "always up to date" that is actually static text → MCP.

If you find yourself wanting to add such content, the answer is: **extend the MCP query in the relevant skill instead**.

## Skill Lifecycle (v4)

1. User invokes `/mp-integrate`, `/mp-review`, or asks the agent a Mercado Pago question.
2. `mp-integration-expert` runs **Step 0 — MCP gate**. If MCP is not authenticated, it stops.
3. Agent detects country (from project signals or asks).
4. Agent detects mode (Orders API vs legacy) from existing code.
5. Agent delegates to the matching skill: `mp-integrate`, `mp-webhooks`, `mp-test-setup`, or `mp-review`.
6. The skill itself re-checks the MCP gate (defense in depth), then queries MCP tools to assemble the answer.
7. The skill returns a deterministic bundle to the agent, which presents it to the user.

## WebFetch Budget (v4)

WebFetch is used for the official `llms.txt` per country (Tier 1 of the documentation hierarchy). This file is public, always current, and a few KB — the developer always has internet.

Documentation hierarchy:
- **Tier 1**: WebFetch `{country_domain}/developers/llms.txt` — official, always current. Fallback to tier 2 if fails.
- **Tier 2**: bundled `references/products.md`
- **Tier 3**: MCP `search_documentation` (auth required)

Limits:
- **Maximum 1 WebFetch per interaction** — used for the official `llms.txt`. Do not use for anything else.
- Never use WebFetch as a substitute for missing MCP authentication.
- Never fetch the same page twice.

## Adding new functionality

The default answer is **extend `mp-integrate`**, not "create a new skill".

- New product to support → add a row in the Product Matrix in `mp-integrate/SKILL.md`, add a Gotchas section, ensure MCP `search_documentation` returns useful results for it.
- New testing scenario → extend `mp-test-setup`.
- New webhook tool from MCP → wrap it in `mp-webhooks`.
- New review dimension → extend `mp-review`'s security floor or add a new query against `quality_checklist`.

If you genuinely need a fifth skill, document why the existing four cannot cover it.

## v4.1 Changes — DX Improvements (June 2026)

Derived from a real integration test session (101 min, 13 findings). Root cause: the plugin assumed the developer arrived with a ready environment. The changes below close that gap without altering the MCP-first architecture.

**Golden Rule update:** The MCP gate is now _selective_, not universal. Gate placement depends on whether the flow actually requires authenticated MCP calls.

### Mudança 1 — Guided onboarding before integration

**Files:** `skills/mp-integrate/SKILL.md` (Step 1.b), `skills/mp-test-setup/SKILL.md` (before Step 1)

Before the integration wizard begins collecting product/country/mode, ask via `AskUserQuestion`:
- Do you already have a Mercado Pago developer account?
- Do you already have your test credentials (APP_USR- access token + public key)?
- Is your environment set up (SDK installed, etc.)?

If any answer is no, route to the appropriate setup step before continuing. Do not silently proceed.

### Mudança 2 — Surgical MCP gate

**Files:** `skills/mp-integrate/SKILL.md` (Step 0), `commands/mp-integrate.md` (Execution rule 1), `skills/mp-webhooks/SKILL.md` (Step 0)

**Gate placement rules — memorize these:**

| Skill / Command | Gate required? | Reason |
|---|---|---|
| `mp-review` | **YES — keep** | All checks require authenticated MCP calls |
| `mp-test-setup` | **YES — keep** | Creates test users via API; cannot work offline |
| `mp-integrate` (scaffold-only path) | **SOFTEN** | Code scaffolding does not need MCP; gate only before first `search_documentation` call |
| `mp-webhooks` (scaffold receiver) | **SOFTEN** | Receiver scaffold is static; gate only before `simulate_webhook` or tool calls |
| `commands/mp-integrate.md` | **SOFTEN** | Mirror the skill: gate only when MCP data is actually needed |

"Soften" means: proceed with scaffold steps and show the OAuth prompt inline (State B) when the first MCP call is reached, rather than blocking at the very start.

### Mudança 3 — Prerequisites checklist

**Files:** `commands/mp-integrate.md` (add before routing table), `skills/mp-integrate/SKILL.md` (Step 0 or Step 1.a)

Add a visible prerequisites block before any wizard step:

```
Before we start, you'll need:
- [ ] A Mercado Pago developer account (mercadopago.com.{country}/developers)
- [ ] An app created in the Developer Dashboard
- [ ] Test credentials: APP_USR- access token + public key (tab "Prueba" / "Teste")
- [ ] @mercadopago/sdk-react installed (if React project)
```

### Mudança 4 — Static anchor files (`llms.txt` + `references/products.md`)

**Files to CREATE:**
- `plugins/mercadopago/llms.txt` — editorial rules readable before auth (no frontmatter, plain text)
- `plugins/mercadopago/skills/mp-integrate/references/products.md` — SDK components per product, test card data per country

**File to UPDATE:** `skills/mp-test-setup/SKILL.md` Step 4

Change Step 4 from:
> "do NOT invent card numbers. Query MCP `search_documentation` with 'test cards {country}'"

To:
> "Read `skills/mp-integrate/references/products.md` first for bundled test card data. Only fall back to MCP `search_documentation` if the country is not listed in the file."

**What goes in `references/products.md`:**
- `@mercadopago/sdk-react` component map: `CardPayment` (not `CardForm` — CardForm does not exist), `Payment`, `StatusScreen`, `Wallet`
- Test card numbers per country (AR, BR, MX, CO, CL) — static, curated, version-pinned
- Any fact that (a) changes rarely and (b) where a hallucination has high DX impact

**What does NOT go in `references/products.md`:** endpoint URLs, payment status tables, per-country payment methods — those stay in MCP.

**`llms.txt` purpose:** Provides the model with editorial anchors (SDK component names, prefix rules, no-`sandbox_init_point`) that it can read before OAuth completes. Think of it as a pre-auth guard rail.

> **Validation checklist update:** Remove the check `test -z "$(find plugins/mercadopago/skills -name 'references' -type d)"` — `references/` is now intentional in `mp-integrate`. Update to: `find plugins/mercadopago/skills -name 'references' -type d | grep -v mp-integrate && echo "ERROR: unexpected references dirs" || echo "OK"`.

### Mudança 5 — MCP auto-config on install

**Status: `.mcp.json` exists at `plugins/mercadopago/.mcp.json` and is declared by the plugin manifest.**

Claude Code registers MCP servers bundled by an enabled plugin. Runtime instructions must use `${CLAUDE_PLUGIN_ROOT}` for bundled files and must never scan an installation cache.

Never copy the plugin's `.mcp.json` into the developer's project. For local development, load the plugin directory using Claude Code's local plugin workflow and run `/reload-plugins` after changes.

---

## Validation Checklist

Before pushing changes:

```bash
# JSON validation
python3 -m json.tool .claude/settings.json
python3 -m json.tool .claude-plugin/marketplace.json
python3 -m json.tool plugins/mercadopago/.claude-plugin/plugin.json

# Hook compilation
python3 -m py_compile plugins/mercadopago/hooks/validate_mp_credentials.py

# Checkout tooling
for script in plugins/mercadopago/scripts/*.mjs; do node --check "$script"; done
node plugins/mercadopago/scripts/test-checkout-tools.mjs

# Skill count (currently 4 — must stay at 4 unless architecture changes)
find plugins/mercadopago/skills -name "SKILL.md" | wc -l

# Agent weight (should be < 150 lines — it's a router)
wc -l plugins/mercadopago/agents/mp-integration-expert.md

# CRITICAL: No skill should have 'tools:' in frontmatter
grep -rl "^tools:" plugins/mercadopago/skills/*/SKILL.md && echo "ERROR: skills must not have tools field" || echo "OK"

# Every skill mentions the MCP gate
# mp-integrate uses a soft gate (authenticate inline) — both patterns are valid
for f in plugins/mercadopago/skills/*/SKILL.md; do
  grep -q "ListMcpResourcesTool\|MCP is connected\|mp-connect\|authenticate" "$f" || echo "MISSING MCP GATE: $f"
done

# All skills have valid YAML frontmatter
for f in plugins/mercadopago/skills/*/SKILL.md; do head -1 "$f"; done

# No unexpected reference dirs (references/ is allowed only in mp-integrate)
find plugins/mercadopago/skills -name 'references' -type d 2>/dev/null | grep -v mp-integrate && echo "ERROR: unexpected references dirs" || echo "OK"
```

## pre-commit

This repo uses a git hook in `.githooks/pre-commit` to run `claude plugins validate .` and then validate each first-level plugin directory under `plugins/*/` before each commit.

Mandatory setup:

```bash
bash scripts/install-git-hooks.sh
```
