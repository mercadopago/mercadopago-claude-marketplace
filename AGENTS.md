# Claude Plugin Development Guide

This repository builds the official Mercado Pago plugin marketplace for Claude Code. All runtime behavior, examples, paths, and validation must target Claude Code, not another agent platform.

## Architecture

- One Claude agent: `plugins/mercadopago/agents/mp-integration-expert.md`.
- Four passive skills only: `mp-integrate`, `mp-webhooks`, `mp-test-setup`, and `mp-review`.
- Commands are user-facing Claude Code slash commands.
- The agent is a thin router; implementation guidance belongs in skills and their approved references.
- MCP is connected only immediately before a selected operation needs an MCP tool. Offline-capable work must remain available.

## Plugin paths

- Use `${CLAUDE_PLUGIN_ROOT}` for scripts, references, and configuration bundled with the active plugin version.
- Use `${CLAUDE_PLUGIN_DATA}` only for persistent plugin-owned data that must survive updates.
- Use `${CLAUDE_PROJECT_DIR}` for the developer's application.
- Never hardcode or scan `~/.claude/plugins/cache`.
- Never copy the plugin's `.mcp.json` into the developer's project. Claude Code registers plugin MCP servers from the plugin manifest.

## File formats

- Agent frontmatter requires `tools`, `model`, `tags`, `category`, and `version`.
- Skill frontmatter uses a `metadata` block. Never add `tools` or `model` to a skill.
- Command frontmatter uses `allowed-tools`, not `tools`.
- Keep the agent under 150 lines.
- Keep the skill count at four unless the architecture is intentionally redesigned.

## Integration invariants

- Checkout Pro and Checkout API must always resolve a concrete checkout CTA.
- Checkout Pro places a visible Mercado Pago payment button at the resolved location.
- Checkout API creates a separate payment page and links the resolved CTA to it.
- Every visible checkout field has a persistent associated label.
- Secure card hosts remain interactive and are never disabled, readonly, inert, or covered by an overlay.
- Public client configuration is loaded at runtime without HTML placeholder substitution.
- Use `/checkout/preferences` for Checkout Pro preferences; never prefix that route with `/v1`.
- Never install or update an SDK without authorization. Once authorized, use the official current stable release and update the lockfile.

## MCP boundary

- Do not authenticate as a pre-flight check.
- Static scaffolding and local checks do not require MCP.
- Account data, credential import, test-user operations, live documentation fallback, webhook administration, and official quality operations may use MCP on demand.
- Never request or store an OAuth callback URL.

## Validation before a commit

```bash
python3 -m json.tool .claude/settings.json
python3 -m json.tool .claude-plugin/marketplace.json
python3 -m json.tool plugins/mercadopago/.claude-plugin/plugin.json
python3 -m json.tool plugins/mercadopago/.mcp.json
python3 -m py_compile plugins/mercadopago/hooks/validate_mp_credentials.py
node plugins/mercadopago/scripts/test-checkout-tools.mjs
claude plugins validate .
claude plugins validate plugins/mercadopago
```

Also verify that no skill contains a top-level `tools:` field, exactly four `SKILL.md` files exist, the agent remains below 150 lines, and no unexpected `references/` directory exists outside `mp-integrate`.

Do not synchronize an installed plugin cache, create a commit, or push unless the developer explicitly requests it.
