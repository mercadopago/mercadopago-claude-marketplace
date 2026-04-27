# Development Spec — mercadopago-claude-marketplace

## Architecture: Hybrid Skills + MCP

This project follows a **hybrid architecture** where:

- **Skills** = stable integration intelligence (flows, decision trees, gotchas)
- **MCP** = dynamic data at runtime (endpoints, payloads, code snippets)
- **Agent** = single router that orchestrates skills + MCP

### The Golden Rule

> There is ONE agent (`mp-integration-expert`). It is the ONLY directly invocable component.
> Skills are reference documents that the agent reads — they are NOT independent agents.

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
version: 2.0.1
---
```

### Skill (`skills/*/SKILL.md`)

```yaml
---
name: mp-checkout-online
description: ...
metadata:                                    # metadata block ONLY
  version: "2.0.1"
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
| Integration flows, decision trees, gotchas, prerequisites | `skills/*/SKILL.md` | "Checkout Pro flow: 1. Create preference 2. Redirect..." |
| Stable reference data (status tables, field requirements) | `skills/*/references/*.md` | Payment status table, preference required fields |
| Code templates, SDK snippets, payload examples | **MCP server** (fetched at runtime) | Node.js preference creation code |
| Endpoint URLs, request/response schemas | **MCP server** (fetched at runtime) | POST /v1/payments schema |
| Country detection, product routing, security checklist | `agents/mp-integration-expert.md` | Signal-to-skill routing table |
| User-facing commands (/mp-setup, /mp-review) | `commands/*.md` | Scaffolding instructions |

**Code snippets or API payloads in skills** can be used to express determinism, but be aware that could become stale rather than MCP tools output. Code snippets can be used, but with caution, user must approve the use.

## Skill Lifecycle

1. User asks a question about Mercado Pago
2. `mp-integration-expert` agent activates (by context matching)
3. Agent detects **country** (from project signals or asking user)
4. Agent detects **product** (from signal-to-skill routing table)
5. Agent reads the ONE relevant `SKILL.md` for integration intelligence
6. Agent queries **MCP server** for dynamic data (endpoints, code, schemas)
7. Agent combines skill + MCP to provide complete answer

Only ONE skill is loaded per interaction. This keeps context lightweight.

## WebFetch Budget

When the MCP server is not available, the agent falls back to `WebFetch` for documentation. To prevent excessive context consumption:

- **Maximum 2 WebFetch calls per interaction.** The skill already contains the integration intelligence — docs are only needed for specific endpoint details or code samples.
- **Never fetch what's already in the skill.** Flows, decision trees, gotchas, prerequisites, and country availability are in the SKILL.md.
- **Never re-fetch the same or similar pages.** One fetch for the main product guide, one for a secondary topic (error codes, test data, etc.) if needed.

This rule is enforced in the agent's Delegation Protocol.

## Adding a New Product Skill

1. Create `skills/mp-{product}/SKILL.md` with the standard skill frontmatter (NO `tools`, NO `model`)
2. Create `skills/mp-{product}/references/{product}-guide.md` for stable reference data
3. Add a routing entry in `agents/mp-integration-expert.md` → Product Detection table
4. Follow the hybrid format: flows and gotchas in skill, dynamic data from MCP

## Validation Checklist

Before pushing changes:

```bash
# JSON validation
python3 -m json.tool .claude/settings.json
python3 -m json.tool .claude-plugin/marketplace.json
python3 -m json.tool plugins/mercadopago/.claude-plugin/plugin.json

# Hook compilation
python3 -m py_compile plugins/mercadopago/hooks/validate_mp_credentials.py

# Skill count (currently 13)
find plugins/mercadopago/skills -name "SKILL.md" | wc -l

# Agent weight (should be < 200 lines)
wc -l plugins/mercadopago/agents/mp-integration-expert.md

# CRITICAL: No skill should have 'tools:' in frontmatter
grep -rl "^tools:" plugins/mercadopago/skills/*/SKILL.md plugins/mercadopago/skills/*/*/SKILL.md && echo "ERROR: skills must not have tools field" || echo "OK"

# All skills have valid YAML frontmatter
for f in plugins/mercadopago/skills/*/SKILL.md; do head -1 "$f"; done
```

## pre-commit

This repo has no `.pre-commit-config.yaml`. When committing, use:

```bash
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "message"
```
