# Changelog

All notable changes to this project are documented in this file.

## [4.3.1] - 2026-08-21

### Added

- Generic Checkout Pro and Checkout API CTA detection, resolution, and acceptance checks.
- Deterministic Checkout API checks for a separate payment screen, associated labels, interactive secure fields, and runtime public-key configuration.
- Checkout tooling regression tests in CI and the repository pre-commit hook.
- Deterministic integration contracts for Bricks, Point, QR,
  Subscriptions, Marketplace, Wallet Connect, SmartApps, and Payouts.
- Public `SECURITY.md`, privacy/data-flow documentation, issue and pull-request
  templates, and a single repository validation gate shared by CI and pre-commit.
- Credential-hook regression tests for Bash secret-file reads, `.env` variants,
  malformed input, project detection, and the explicit local override.

### Changed

- Checkout API always creates a separate payment screen and wires the resolved entry CTA to it.
- Checkout Pro always places a visible Mercado Pago payment button at the resolved CTA location.
- SDK installation and updates require authorization and target the official current stable release.
- Bundled plugin files are resolved through `${CLAUDE_PLUGIN_ROOT}` without scanning installation caches.
- Checkout Pro preference creation uses `/checkout/preferences` without a `/v1` prefix.
- Project prerequisites are detected per application stack; Git/Node/npm are no
  longer universal requirements and the wizard never installs OS packages.
- MCP tools are no longer pre-authorized in tracked project settings, and project
  MCP servers are not enabled globally.
- Public CI now uses Node 20, installs a pinned Claude Code validator, runs every
  deterministic product suite, validates the plugin strictly, and rejects
  catalog drift.
- Catalog generation is deterministic and read-only in CI; the workflow no
  longer commits directly to `main`.

### Fixed

- Public-key loading no longer relies on cache-prone HTML placeholder substitution.
- CardForm lifecycle controls remain present and enabled so secure fields stay responsive.
- CTA and label validators no longer accept unrelated destinations or unresolved accessible labels.
- Conflicting guidance about `TEST-` credentials and the WebFetch/MCP
  documentation hierarchy was consolidated.
- Public documentation and repository validation no longer contain
  maintainer-specific absolute paths or internal registry URLs.
- Hook commands now pass plugin paths as arguments, version state uses
  `${CLAUDE_PLUGIN_DATA}`, and credential scanning fails closed on malformed input.
