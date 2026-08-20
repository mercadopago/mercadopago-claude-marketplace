# Changelog

All notable changes to this project are documented in this file.

## [4.3.1] - Unreleased

### Added

- Generic Checkout Pro and Checkout API CTA detection, resolution, and acceptance checks.
- Deterministic Checkout API checks for a separate payment screen, associated labels, interactive secure fields, and runtime public-key configuration.
- Checkout tooling regression tests in CI and the repository pre-commit hook.

### Changed

- Checkout API always creates a separate payment screen and wires the resolved entry CTA to it.
- Checkout Pro always places a visible Mercado Pago payment button at the resolved CTA location.
- SDK installation and updates require authorization and target the official current stable release.
- Bundled plugin files are resolved through `${CLAUDE_PLUGIN_ROOT}` without scanning installation caches.
- Checkout Pro preference creation uses `/checkout/preferences` without a `/v1` prefix.

### Fixed

- Public-key loading no longer relies on cache-prone HTML placeholder substitution.
- CardForm lifecycle controls remain present and enabled so secure fields stay responsive.
- CTA and label validators no longer accept unrelated destinations or unresolved accessible labels.
