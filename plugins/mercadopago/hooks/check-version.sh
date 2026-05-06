

#!/usr/bin/env bash
#
# Runs on every UserPromptSubmit. Silent unless the plugin version changed.
# When it changes, injects a one-line notice into the conversation context.
#

set -uo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
[[ -z "$PLUGIN_ROOT" ]] && exit 0

VERSION_FILE="$PLUGIN_ROOT/.claude-plugin/plugin.json"
[[ -f "$VERSION_FILE" ]] || exit 0

current=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d['version'])" "$VERSION_FILE" 2>/dev/null) || exit 0
[[ -z "$current" ]] && exit 0

SEEN_DIR="${HOME}/.claude"
SEEN_FILE="$SEEN_DIR/mp-plugin-seen-version"

mkdir -p "$SEEN_DIR" 2>/dev/null || exit 0
seen=$(cat "$SEEN_FILE" 2>/dev/null || echo "")

if [[ "$current" != "$seen" ]]; then
  echo "$current" > "$SEEN_FILE" || exit 0
  if [[ -n "$seen" ]]; then
    echo "[Mercado Pago plugin updated: v${seen} → v${current}. Run /mp-connect to verify your connection.]"
  fi
fi

exit 0
