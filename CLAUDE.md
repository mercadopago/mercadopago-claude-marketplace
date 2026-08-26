# Claude Code Development Contract — Mercado Pago Plugin

This repository builds the public Mercado Pago marketplace plugin for Claude
Code. Runtime instructions, paths, hooks, examples, and validation must target
Claude Code and must be safe for developers outside Mercado Pago/Mercado Libre.

## Current architecture (v4.3.1)

- One thin router: `plugins/mercadopago/agents/mp-integration-expert.md`.
- Four passive skills only: `mp-integrate`, `mp-webhooks`, `mp-test-setup`, and
  `mp-review`.
- Commands are the user-facing entry points. Skills contain orchestration and
  approved scaffold contracts; they are not independent agents.
- Static scaffolding, bundled references, test cards, and local security checks
  work without MCP authentication.
- MCP OAuth is requested only immediately before a selected operation needs an
  authenticated MCP tool.

## Claude plugin paths

- Use `${CLAUDE_PLUGIN_ROOT}` for files shipped with the active plugin version.
- Use `${CLAUDE_PLUGIN_DATA}` for persistent plugin-owned state.
- Use `${CLAUDE_PROJECT_DIR}` for the developer's application.
- Never hardcode or scan `~/.claude/plugins/cache`.
- Never copy the plugin `.mcp.json` into the developer's project. Claude Code
  registers the MCP server from the enabled plugin.

## File contracts

- Agent frontmatter requires `tools`, `model`, `tags`, `category`, and `version`.
- Skill frontmatter uses `metadata`. Never add top-level `tools` or `model` to a
  skill.
- Command frontmatter uses `allowed-tools`, not `tools`.
- Keep the router under 150 lines and the skill count at four unless the
  architecture is intentionally redesigned.

## Sources and MCP boundary

Use this documentation order:

1. Fetch the official country-specific `developers/llms.txt` at most once per
   interaction when live product documentation is needed.
2. Read approved bundled references under
   `skills/mp-integrate/references/` for stable, version-pinned facts and tested
   scaffold contracts.
3. Use MCP `search_documentation` only for a gap in the first two sources, and
   always for products explicitly marked MCP-required, such as SmartApps.

Account data, credential import, application/test-user operations, webhook
administration, payment/order lookup, and official quality/homologation tools
always require MCP on demand. Do not authenticate as a generic pre-flight
check, and never use an unrelated website as a substitute for an MCP operation.

## Credential facts

- `APP_USR-` and `TEST-` are both valid credential prefixes. Never infer whether
  a credential is test or production from the prefix alone; use its Dashboard
  tab and the selected product/API context.
- Test users created through `create_test_user` receive `APP_USR-` credentials
  and still use production API hosts with test-user accounts.
- There is no sandbox host. Checkout Pro uses `init_point`, never
  `sandbox_init_point`.
- Access tokens, client secrets, and webhook secrets stay server-side in local
  secret storage or environment variables. A public key is client-visible.

## Integration invariants

- Checkout Pro and Checkout API always resolve a concrete entry CTA.
- Checkout Pro places its Mercado Pago payment button at the resolved CTA.
- Checkout API creates a separate payment page and links the resolved CTA to it.
- Every visible checkout field has a persistent associated label.
- Secure card hosts are never disabled, readonly, inert, or covered by an
  overlay. Required SDK lifecycle controls remain in the DOM.
- Public client configuration is loaded at runtime; never substitute an HTML
  placeholder at response time.
- Checkout Pro preferences use `/checkout/preferences`, without `/v1`.
- Installing or updating an SDK requires explicit authorization. After approval,
  use the official current stable version and update the lockfile.
- Prerequisites are conditional on the detected product and project stack. Do
  not require Node/npm for a Java, PHP, Python, Go, or Android-only integration.
- Never install an OS package or run `sudo` without explicit user authorization.

## Public-repository security

- Do not commit credentials, `.env` files, test-user profiles, smoke artifacts,
  local settings, personal absolute paths, or internal registry URLs.
- Mutating MCP tools must not be pre-authorized in tracked project settings.
- Treat hook input as untrusted. Prefer command plus `args` over shell-composed
  hook commands and handle malformed input safely.
- Keep SECURITY.md, PRIVACY.md, release notes, supported runtimes, and public
  contribution instructions accurate.

## Validation before a commit

Run the repository gate:

```bash
sh .githooks/pre-commit
```

It must syntax-check every plugin script, run all deterministic product suites,
and validate both marketplace and plugin manifests. CI must run the same gate
with Node 20 and strict Claude plugin validation. Also verify:

- exactly four `SKILL.md` files;
- no skill contains top-level `tools:`;
- the router remains below 150 lines;
- no unexpected `references/` directory exists outside `mp-integrate`;
- `python3 scripts/generate_catalog.py` produces no uncommitted diff.

Do not synchronize an installed plugin cache, commit, push, tag, or publish a
release unless the developer explicitly requests that specific action.
