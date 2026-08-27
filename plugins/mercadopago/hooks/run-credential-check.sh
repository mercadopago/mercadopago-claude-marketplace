#!/usr/bin/env bash
#
# Wrapper for validate_mp_credentials.py: resolves a real Python 3
# interpreter via resolve-python.sh before running it, instead of trusting
# a bare `python3` invoked directly from hooks.json (see #64 — that
# resolves to the Microsoft Store execution-alias stub on Windows and
# leaks handles/commit charge in the AppXSvc service on every PreToolUse
# call).
#
# Fails open (exit 0, same as the previous behavior when the Store stub
# silently did nothing useful) if no working Python 3 interpreter is
# found, so this change never makes the hook more restrictive than it
# already was.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

resolved_out="$(mktemp)"
trap 'rm -f "$resolved_out"' EXIT

bash "$SCRIPT_DIR/resolve-python.sh" > "$resolved_out" || exit 0

PY_ARGV=()
mapfile -d '' -t PY_ARGV < "$resolved_out"
[ "${#PY_ARGV[@]}" -gt 0 ] || exit 0

exec "${PY_ARGV[@]}" "$SCRIPT_DIR/validate_mp_credentials.py" "$@"
