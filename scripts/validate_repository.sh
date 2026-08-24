#!/usr/bin/env sh
# Single production gate used by local pre-commit and public CI.

set -eu

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

python3 -m json.tool .claude/settings.json >/dev/null
python3 -m json.tool .claude-plugin/marketplace.json >/dev/null
python3 -m json.tool plugins/mercadopago/.claude-plugin/plugin.json >/dev/null
python3 -m json.tool plugins/mercadopago/.mcp.json >/dev/null
python3 -m json.tool plugins/mercadopago/hooks/hooks.json >/dev/null
python3 -m py_compile plugins/mercadopago/hooks/validate_mp_credentials.py
python3 -m unittest plugins/mercadopago/hooks/test_validate_mp_credentials.py

for script in plugins/mercadopago/scripts/*.mjs; do
  [ -f "$script" ] || continue
  node --check "$script"
done

node plugins/mercadopago/scripts/test-checkout-tools.mjs
node plugins/mercadopago/scripts/test-bricks-tools.mjs
node plugins/mercadopago/scripts/test-point-tools.mjs
node plugins/mercadopago/scripts/test-qr-tools.mjs
node plugins/mercadopago/scripts/test-subscriptions-tools.mjs
node plugins/mercadopago/scripts/test-marketplace-tools.mjs
node plugins/mercadopago/scripts/test-wallet-connect-tools.mjs
node plugins/mercadopago/scripts/test-smartapps-tools.mjs
node plugins/mercadopago/scripts/test-payouts-tools.mjs

claude plugins validate . --strict
claude plugins validate plugins/mercadopago --strict

skill_count="$(find plugins/mercadopago/skills -name SKILL.md -type f | wc -l | tr -d ' ')"
[ "$skill_count" = "4" ] || {
  echo "ERROR: expected exactly 4 skills, found $skill_count" >&2
  exit 1
}

agent_lines="$(wc -l < plugins/mercadopago/agents/mp-integration-expert.md | tr -d ' ')"
[ "$agent_lines" -lt 150 ] || {
  echo "ERROR: router must remain below 150 lines, found $agent_lines" >&2
  exit 1
}

if grep -rl '^tools:' plugins/mercadopago/skills/*/SKILL.md >/dev/null 2>&1; then
  echo "ERROR: skills must not declare top-level tools" >&2
  exit 1
fi

unexpected_references="$(find plugins/mercadopago/skills -name references -type d 2>/dev/null | grep -v '/mp-integrate/references$' || true)"
[ -z "$unexpected_references" ] || {
  echo "ERROR: unexpected references directories:" >&2
  echo "$unexpected_references" >&2
  exit 1
}

if git grep -nE 'npm\.artifacts\.furycloud\.io|/Users/esbento|\\Users\\esbento' -- ':!CHANGELOG.md' ':!scripts/validate_repository.sh' >/dev/null 2>&1; then
  echo "ERROR: tracked files contain an internal registry or maintainer-specific path" >&2
  git grep -nE 'npm\.artifacts\.furycloud\.io|/Users/esbento|\\Users\\esbento' -- ':!CHANGELOG.md' ':!scripts/validate_repository.sh' >&2
  exit 1
fi

python3 scripts/generate_catalog.py --check

echo "Repository validation passed."
