# Development Spec — mercadopago-claude-marketplace

## Architecture: MCP-First Orchestration (v4)

This project follows an **MCP-first orchestration architecture** where:

- **Agent** = thin router (`mp-integration-expert`) that detects country, mode, and intent, then delegates.
- **Skills** = orchestrators that translate developer intent into MCP queries and assemble the response. They contain routing logic, gotchas, and a small fixed security floor — **not** documentation copies.
- **MCP** = the single source of truth (`plugin:mercadopago:mercadopago`). Every endpoint, payload, snippet, payment status, country/product matrix, quality criterion, and webhook tool lives here. Pulled live, never duplicated.

### The Golden Rules

1. **The MCP must always be connected.** This is non-negotiable. The agent and every skill check `ListMcpResourcesTool` first; if the MCP is not authenticated, they stop and ask the user to run `/mp-connect`. **There is no offline mode**, no WebFetch substitute for an unauthenticated MCP.
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

WebFetch is **not** a fallback for an unauthenticated MCP. It is only allowed when:

- The MCP is connected, and
- A specific docs page is needed that `search_documentation` did not surface.

Limits:

- **Maximum 1 WebFetch per interaction** (down from 2 in v3).
- Never use WebFetch as a substitute for missing MCP authentication — stop and ask the user to run `/mp-connect`.
- Never fetch the same page twice.

## Adding new functionality

The default answer is **extend `mp-integrate`**, not "create a new skill".

- New product to support → add a row in the Product Matrix in `mp-integrate/SKILL.md`, add a Gotchas section, ensure MCP `search_documentation` returns useful results for it.
- New testing scenario → extend `mp-test-setup`.
- New webhook tool from MCP → wrap it in `mp-webhooks`.
- New review dimension → extend `mp-review`'s security floor or add a new query against `quality_checklist`.

If you genuinely need a fifth skill, document why the existing four cannot cover it.

## Validation Checklist

Before pushing changes:

```bash
# JSON validation
python3 -m json.tool .claude/settings.json
python3 -m json.tool .claude-plugin/marketplace.json
python3 -m json.tool plugins/mercadopago/.claude-plugin/plugin.json

# Hook compilation
python3 -m py_compile plugins/mercadopago/hooks/validate_mp_credentials.py

# Skill count (currently 4 — must stay at 4 unless architecture changes)
find plugins/mercadopago/skills -name "SKILL.md" | wc -l

# Agent weight (should be < 150 lines — it's a router)
wc -l plugins/mercadopago/agents/mp-integration-expert.md

# CRITICAL: No skill should have 'tools:' in frontmatter
grep -rl "^tools:" plugins/mercadopago/skills/*/SKILL.md && echo "ERROR: skills must not have tools field" || echo "OK"

# Every skill mentions the MCP gate
for f in plugins/mercadopago/skills/*/SKILL.md; do
  grep -q "ListMcpResourcesTool\|MCP is connected\|mp-connect" "$f" || echo "MISSING MCP GATE: $f"
done

# All skills have valid YAML frontmatter
for f in plugins/mercadopago/skills/*/SKILL.md; do head -1 "$f"; done

# No legacy reference files
test -z "$(find plugins/mercadopago/skills -name 'references' -type d 2>/dev/null)" && echo "OK: no references dirs" || echo "ERROR: legacy references/ dirs still present"
```

## pre-commit

This repo uses a git hook in `.githooks/pre-commit` to run `claude plugins validate .` and then validate each first-level plugin directory under `plugins/*/` before each commit.

Mandatory setup:

```bash
bash scripts/install-git-hooks.sh
```
