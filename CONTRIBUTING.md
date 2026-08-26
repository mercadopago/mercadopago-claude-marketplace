# Contributing to mercadopago-claude-marketplace

Thank you for helping improve the public Mercado Pago plugin for Claude Code.

## Before opening an issue

- Search existing issues and use the bug report template for reproducible bugs.
- Prefix significant proposals with `[RFC]` and explain why the existing four
  skills cannot cover the requirement.
- Never post credentials, buyer data, test-user passwords, or full payment
  payloads. Report sensitive findings according to [SECURITY.md](./SECURITY.md).

## Development setup

Maintainers currently validate the repository on macOS and Linux with:

- Node.js 20 or newer and npm;
- Python 3.8 or newer;
- Claude Code 2.1.228 or newer;
- Git.

Fork and clone the public repository, then run:

```bash
bash scripts/install-git-hooks.sh
sh scripts/validate_repository.sh
```

## Architecture rules

- Keep one thin Claude router and four passive skills.
- Extend `mp-integrate` for product behavior unless an architectural proposal
  justifies a new skill.
- Skills never declare top-level `tools` or `model`.
- Use `${CLAUDE_PLUGIN_ROOT}` for bundled plugin resources.
- Connect MCP only immediately before the selected operation requires it.
- Do not duplicate volatile API documentation when it can be obtained from the
  official country `llms.txt` or MCP. Stable, versioned scaffold contracts may
  live in approved `mp-integrate/references/` files with regression tests.

## Pull requests

1. Keep the change focused and include deterministic regression tests.
2. Update documentation and CHANGELOG for user-visible behavior.
3. Regenerate the catalog with `python3 scripts/generate_catalog.py` when
   component metadata changes.
4. Run `sh scripts/validate_repository.sh` before opening the PR.
5. Complete the PR template, including security/privacy impact.

By submitting a contribution, you agree that it is provided under the
repository's [Apache-2.0 license](./LICENSE). All contributors must follow the
[Code of Conduct](./CODE_OF_CONDUCT.md).
