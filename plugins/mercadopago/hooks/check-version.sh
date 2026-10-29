#!/usr/bin/env bash
#
# Runs on every UserPromptSubmit. Silent unless the plugin version changed.
#

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/check-version.mjs" 2>/dev/null || exit 0
