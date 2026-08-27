#!/usr/bin/env bash
#
# Deterministic regression tests for resolve-python.sh and its wrapper
# run-credential-check.sh. Every scenario builds fake `python3`/`python`/
# `py` executables on an isolated, throwaway PATH, so results never depend
# on what is actually installed on the machine running the suite.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOLVER="$SCRIPT_DIR/resolve-python.sh"
WRAPPER="$SCRIPT_DIR/run-credential-check.sh"

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# Resolved once, from the *current* PATH, before any scenario narrows PATH
# down to a fake directory. Every fake interpreter is shebanged with this
# absolute path (instead of `#!/usr/bin/env bash`) so it stays executable
# once PATH no longer contains a real bash — exactly the situation each
# scenario below is testing resolve-python.sh under.
REAL_BASH="$(command -v bash)"
REAL_BASH_DIR="$(dirname "$REAL_BASH")"

failures=0

fail() {
  echo "FAIL: $1" >&2
  failures=$((failures + 1))
}

pass() {
  echo "PASS: $1"
}

# Writes an executable bash stub at "$1" with body "$2".
write_stub() {
  local target="$1" body="$2"
  mkdir -p "$(dirname "$target")"
  {
    printf '#!%s\n' "$REAL_BASH"
    printf '%s\n' "$body"
  } > "$target"
  chmod +x "$target"
}

# A stub that behaves like a real Python 3 interpreter: succeeds on the
# resolver's `-c "import sys; ..."` version probe, and otherwise records
# how it was invoked to $MARKER_FILE (used by the wrapper end-to-end
# checks below).
python3_stub_body='
if [ "$1" = "-c" ]; then
  exit 0
fi
printf "invoked:%s\n" "$*" >> "$MARKER_FILE"
exit 0
'

# A stub that behaves like the `py` launcher: only succeeds when called
# with -3 first, exactly like the real fix requires.
py_stub_supports_py3_body='
if [ "$1" != "-3" ]; then
  exit 1
fi
shift
if [ "$1" = "-c" ]; then
  exit 0
fi
printf "invoked:-3 %s\n" "$*" >> "$MARKER_FILE"
exit 0
'

# A `py` launcher with no Python 3 registered at all: -3 fails too.
py_stub_no_py3_body='
exit 1
'

# A stub that is executable but is not a Python interpreter at all (or is
# otherwise broken): every invocation, including the version probe, fails.
non_python_stub_body='
exit 1
'

# Runs the resolver with PATH replaced by "$1", capturing its NUL-separated
# argv into the global PY_ARGV array and its exit code into RC.
run_resolver() {
  local fake_path="$1"
  local out="$TMP_ROOT/resolver-out-$$-$RANDOM"
  PATH="$fake_path" "$REAL_BASH" "$RESOLVER" > "$out"
  RC=$?
  PY_ARGV=()
  mapfile -d '' -t PY_ARGV < "$out"
  rm -f "$out"
}

# --- Scenario 1: a valid Python 3 interpreter -------------------------------
scenario1_dir="$TMP_ROOT/scenario1/bin"
export MARKER_FILE="$TMP_ROOT/scenario1/marker"
write_stub "$scenario1_dir/python3" "$python3_stub_body"
run_resolver "$scenario1_dir"
if [ "$RC" -eq 0 ] && [ "${#PY_ARGV[@]}" -eq 1 ] && [ "${PY_ARGV[0]}" = "$scenario1_dir/python3" ]; then
  pass "valid python3 interpreter is selected"
else
  fail "valid python3 interpreter: rc=$RC argv=(${PY_ARGV[*]-})"
fi

# --- Scenario 2: a WindowsApps execution alias ------------------------------
# The only `python3` on PATH is the Store stub; it must be rejected and the
# resolver must fall through to a genuinely working `python` next in line.
scenario2_root="$TMP_ROOT/scenario2"
stub_dir="$scenario2_root/AppData/Local/Microsoft/WindowsApps"
good_dir="$scenario2_root/real-python/bin"
export MARKER_FILE="$scenario2_root/marker"
write_stub "$stub_dir/python3" "$python3_stub_body"  # would pass if not filtered
write_stub "$good_dir/python" "$python3_stub_body"
run_resolver "$stub_dir:$good_dir"
if [ "$RC" -eq 0 ] && [ "${#PY_ARGV[@]}" -eq 1 ] && [ "${PY_ARGV[0]}" = "$good_dir/python" ]; then
  pass "WindowsApps execution alias is rejected, falls through to a real interpreter"
else
  fail "WindowsApps execution alias: rc=$RC argv=(${PY_ARGV[*]-})"
fi

# --- Scenario 3: a zero-byte executable --------------------------------------
scenario3_root="$TMP_ROOT/scenario3"
empty_dir="$scenario3_root/empty/bin"
good_dir="$scenario3_root/real/bin"
export MARKER_FILE="$scenario3_root/marker"
mkdir -p "$empty_dir"
: > "$empty_dir/python3"
chmod +x "$empty_dir/python3"
write_stub "$good_dir/python" "$python3_stub_body"
run_resolver "$empty_dir:$good_dir"
if [ "$RC" -eq 0 ] && [ "${#PY_ARGV[@]}" -eq 1 ] && [ "${PY_ARGV[0]}" = "$good_dir/python" ]; then
  pass "zero-byte executable is rejected, falls through to a real interpreter"
else
  fail "zero-byte executable: rc=$RC argv=(${PY_ARGV[*]-})"
fi

# --- Scenario 4: an invalid or non-Python executable -------------------------
scenario4_root="$TMP_ROOT/scenario4"
bad_dir="$scenario4_root/bad/bin"
good_dir="$scenario4_root/real/bin"
export MARKER_FILE="$scenario4_root/marker"
write_stub "$bad_dir/python3" "$non_python_stub_body"
write_stub "$good_dir/python" "$python3_stub_body"
run_resolver "$bad_dir:$good_dir"
if [ "$RC" -eq 0 ] && [ "${#PY_ARGV[@]}" -eq 1 ] && [ "${PY_ARGV[0]}" = "$good_dir/python" ]; then
  pass "non-Python executable is rejected, falls through to a real interpreter"
else
  fail "non-Python executable: rc=$RC argv=(${PY_ARGV[*]-})"
fi

# --- Scenario 5a: the py launcher, with Python 3 registered -----------------
scenario5a_dir="$TMP_ROOT/scenario5a/bin"
export MARKER_FILE="$TMP_ROOT/scenario5a/marker"
write_stub "$scenario5a_dir/py" "$py_stub_supports_py3_body"
run_resolver "$scenario5a_dir"
if [ "$RC" -eq 0 ] && [ "${#PY_ARGV[@]}" -eq 2 ] && [ "${PY_ARGV[0]}" = "$scenario5a_dir/py" ] && [ "${PY_ARGV[1]}" = "-3" ]; then
  pass "py launcher is selected and always paired with -3"
else
  fail "py launcher (-3 available): rc=$RC argv=(${PY_ARGV[*]-})"
fi

# --- Scenario 5b: the py launcher, with no Python 3 registered --------------
# Must not be accepted just because it resolved on PATH — with nothing else
# available, the resolver must report failure rather than fall back to a
# Python 2 install.
scenario5b_dir="$TMP_ROOT/scenario5b/bin"
export MARKER_FILE="$TMP_ROOT/scenario5b/marker"
write_stub "$scenario5b_dir/py" "$py_stub_no_py3_body"
run_resolver "$scenario5b_dir"
if [ "$RC" -eq 1 ] && [ "${#PY_ARGV[@]}" -eq 0 ]; then
  pass "py launcher without Python 3 is rejected outright"
else
  fail "py launcher (-3 unavailable): rc=$RC argv=(${PY_ARGV[*]-})"
fi

# --- Wrapper: end-to-end with a resolved interpreter -------------------------
# The wrapper must exec the resolved interpreter (plus -3, for py) against
# validate_mp_credentials.py, forwarding stdin and any args.
wrapper_dir="$TMP_ROOT/wrapper-good/bin"
export MARKER_FILE="$TMP_ROOT/wrapper-good/marker"
write_stub "$wrapper_dir/python3" "$python3_stub_body"
PATH="$wrapper_dir:$REAL_BASH_DIR" "$REAL_BASH" "$WRAPPER" extra-arg < /dev/null
wrapper_rc=$?
recorded="$(cat "$MARKER_FILE" 2>/dev/null || true)"
case "$recorded" in
  invoked:*validate_mp_credentials.py\ extra-arg)
    pass "wrapper execs the resolved python3 against the scanner, forwarding args"
    ;;
  *)
    fail "wrapper end-to-end (python3): rc=$wrapper_rc recorded='$recorded'"
    ;;
esac

# --- Wrapper: end-to-end via the py launcher ---------------------------------
wrapper_py_dir="$TMP_ROOT/wrapper-py/bin"
export MARKER_FILE="$TMP_ROOT/wrapper-py/marker"
write_stub "$wrapper_py_dir/py" "$py_stub_supports_py3_body"
PATH="$wrapper_py_dir:$REAL_BASH_DIR" "$REAL_BASH" "$WRAPPER" < /dev/null
case "$(cat "$MARKER_FILE" 2>/dev/null || true)" in
  invoked:-3\ *validate_mp_credentials.py)
    pass "wrapper execs the py launcher with -3 against the scanner"
    ;;
  *)
    fail "wrapper end-to-end (py launcher): recorded='$(cat "$MARKER_FILE" 2>/dev/null || true)'"
    ;;
esac

# --- Wrapper: fails open when no working interpreter exists -----------------
empty_path_dir="$TMP_ROOT/wrapper-none/empty-bin"
mkdir -p "$empty_path_dir"
PATH="$empty_path_dir:$REAL_BASH_DIR" "$REAL_BASH" "$WRAPPER" < /dev/null
none_rc=$?
if [ "$none_rc" -eq 0 ]; then
  pass "wrapper fails open when no working interpreter is found"
else
  fail "wrapper fail-open: exited $none_rc, expected 0"
fi

if [ "$failures" -eq 0 ]; then
  echo "All resolve-python.sh / run-credential-check.sh regression tests passed."
  exit 0
fi

echo "$failures regression test(s) failed." >&2
exit 1
