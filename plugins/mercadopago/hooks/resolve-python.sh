#!/usr/bin/env bash
#
# Resolves a working Python 3 interpreter, explicitly rejecting the
# Microsoft Store execution-alias stub on Windows and any candidate that
# doesn't actually run as Python 3 (a zero-byte stub, a non-Python
# executable, or the `py` launcher defaulting to a Python 2 install).
#
# On Windows, a bare `python3` (and often `python`) resolves to a 0-byte
# binary under `%LOCALAPPDATA%\Microsoft\WindowsApps\` unless a real
# interpreter is installed and ordered earlier on PATH. Invoking that stub
# triggers an AppX deployment-service operation that leaks handles and
# commit charge in the AppXSvc Windows service on every call, with no
# self-cleanup — see #64 for the full investigation.
#
# The `py` launcher is never trusted at its default: without an explicit
# `-3`, it can resolve to a Python 2 install depending on what's on the
# machine and how py.ini is configured. It is therefore always both
# verified and invoked with `-3`.
#
# Usage:
#   out="$(mktemp)"; bash resolve-python.sh > "$out" || { rm -f "$out"; exit 0; }
#   mapfile -d '' -t PY_ARGV < "$out"; rm -f "$out"
#   [ "${#PY_ARGV[@]}" -gt 0 ] || exit 0   # no working Python 3 found
#   "${PY_ARGV[@]}" some_script.py
#
# Prints the resolved command as a NUL-separated argv (interpreter path,
# plus a trailing `-3` when the `py` launcher is the resolved candidate)
# and exits 0, or exits 1 with no output if no working Python 3
# interpreter is found.

set -uo pipefail

is_python3() {
  # "$@" is the candidate invocation (path, plus any flags e.g. -3)
  "$@" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1
}

for candidate in python3 python py; do
  resolved="$(command -v "$candidate" 2>/dev/null)" || continue
  [ -n "$resolved" ] || continue
  case "$resolved" in
    *WindowsApps*|*windowsapps*) continue ;;  # Store execution-alias stub
  esac
  [ -s "$resolved" ] || continue  # 0-byte stub, belt-and-suspenders

  if [ "$candidate" = "py" ]; then
    # The launcher can default to Python 2 depending on what's installed
    # and how py.ini is configured — never trust it without -3.
    is_python3 "$resolved" -3 || continue
    printf '%s\0%s\0' "$resolved" "-3"
    exit 0
  fi

  is_python3 "$resolved" || continue
  printf '%s\0' "$resolved"
  exit 0
done

exit 1
