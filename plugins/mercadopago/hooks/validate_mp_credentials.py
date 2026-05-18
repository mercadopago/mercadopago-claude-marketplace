#!/usr/bin/env python3
"""
SPDX-FileCopyrightText: (c) 2026 Mercado Pago (MercadoLibre S.R.L.)
SPDX-License-Identifier: Apache-2.0

Mercado Pago Plugin — Credential Leak Prevention Hook

Scans tool inputs (Bash, Edit, Write, MultiEdit, Read) for hardcoded
Mercado Pago credentials and blocks them before they reach source files.
Also blocks reading .env files to prevent credential exposure.

Exit codes:
  0 — allow (no credentials detected)
  2 — block (credential pattern matched)

Reads optional per-project settings from .claude/mercadopago.local.md
to allow disabling the hook with `enabled: false` in frontmatter.
"""

import json
import os
import re
import sys


# ---------- credential patterns ----------

PATTERNS = {
    "MP Access Token": re.compile(
        r"(TEST|APP_USR)-\d{12,}-\d{6}-[a-f0-9]{32}-U\d+"
    ),
    "Client Secret": re.compile(
        r"""['"]client_secret['"]\s*[:=]\s*['"][a-f0-9]{32,}['"]"""
    ),
    "Bearer Token": re.compile(
        r"Bearer\s+(TEST|APP_USR)-[^\s'\"]+"
    ),
    "Webhook Secret": re.compile(
        r"""['"]?(x-signature|webhook.?secret)['"]?\s*[:=]\s*['"][a-zA-Z0-9+/]{20,}['"]""",
        re.IGNORECASE,
    ),
}


# ---------- project relevance gate ----------

# Dependency manifests checked for a "mercadopago" mention. Lock files are
# intentionally excluded to keep the per-call file reads small.
MANIFEST_FILES = (
    "package.json",
    "composer.json",
    "requirements.txt",
    "Pipfile",
    "pyproject.toml",
    "Gemfile",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "go.mod",
)


def _mentions_mercadopago(path: str) -> bool:
    try:
        with open(path, "r", errors="ignore") as f:
            return "mercadopago" in f.read().lower()
    except OSError:
        return False


def is_mercadopago_project(start_dir: str) -> bool:
    """Heuristic check: does this project integrate with Mercado Pago?

    Walks from start_dir up to the nearest .git boundary (or filesystem root)
    looking for either:
      - the plugin's per-project config (.claude/mercadopago.local.md), or
      - a dependency manifest that mentions "mercadopago".

    This is intentionally conservative: it only needs to be good enough to
    keep the hook a no-op in projects that have nothing to do with Mercado
    Pago. Maintainers: add or remove signals here as you see fit.
    """
    current = os.path.abspath(start_dir or os.getcwd())
    for _ in range(32):  # bounded walk
        if os.path.isfile(os.path.join(current, ".claude", "mercadopago.local.md")):
            return True
        for name in MANIFEST_FILES:
            candidate = os.path.join(current, name)
            if os.path.isfile(candidate) and _mentions_mercadopago(candidate):
                return True

        at_repo_root = os.path.isdir(os.path.join(current, ".git"))
        parent = os.path.dirname(current)
        if at_repo_root or parent == current:
            break
        current = parent
    return False


# ---------- helpers ----------

def read_settings() -> dict:
    """Read per-project .claude/mercadopago.local.md frontmatter."""
    settings_path = os.path.join(os.getcwd(), ".claude", "mercadopago.local.md")
    if not os.path.isfile(settings_path):
        return {}

    try:
        with open(settings_path, "r") as f:
            content = f.read()
    except OSError:
        return {}

    # Parse YAML-like frontmatter between --- fences
    if not content.startswith("---"):
        return {}

    end = content.find("---", 3)
    if end == -1:
        return {}

    frontmatter = content[3:end].strip()
    result = {}
    for line in frontmatter.splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            result[key.strip()] = value.strip()
    return result


def extract_text(tool_name: str, tool_input: dict) -> str:
    """Extract the scannable text content from a tool input."""
    if tool_name == "Bash":
        return tool_input.get("command", "")
    elif tool_name == "Write":
        return tool_input.get("content", "")
    elif tool_name == "Edit":
        return tool_input.get("new_string", "")
    elif tool_name == "MultiEdit":
        # MultiEdit contains an array of edits
        edits = tool_input.get("edits", [])
        return "\n".join(e.get("new_string", "") for e in edits)
    return ""


def get_file_path(tool_name: str, tool_input: dict) -> str:
    """Extract the target file path from a tool input."""
    if tool_name in ("Write", "Edit", "MultiEdit", "Read"):
        return tool_input.get("file_path", "")
    return ""


def scan(text: str) -> list[tuple[str, str]]:
    """Return list of (pattern_name, matched_value) for all credential matches."""
    matches = []
    for name, pattern in PATTERNS.items():
        for m in pattern.finditer(text):
            matches.append((name, m.group()))
    return matches


def is_env_file(path: str) -> bool:
    """Check if path is a .env file (not .env.example)."""
    basename = os.path.basename(path)
    if basename == ".env.example" or basename.endswith(".env.example"):
        return False
    return basename == ".env" or basename.startswith(".env.")


# ---------- main ----------

def main():
    try:
        data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)  # Can't parse input — allow

    # Project relevance gate: if the current project shows no signs of a
    # Mercado Pago integration, allow the tool call without inspection.
    # This keeps the hook from changing tool behavior (e.g. blocking .env
    # reads) in projects that have nothing to do with Mercado Pago.
    if not is_mercadopago_project(os.getcwd()):
        sys.exit(0)

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})

    # Check per-project override
    settings = read_settings()
    if settings.get("enabled", "true").lower() == "false":
        sys.exit(0)

    file_path = get_file_path(tool_name, tool_input)

    # --- Read tool path: block .env reads (not .env.example) ---
    if tool_name == "Read":
        if file_path and is_env_file(file_path):
            print(
                f"BLOCKED: Reading .env files is not allowed to prevent credential exposure.\n"
                f"If you need to see the expected variables, read .env.example instead.",
                file=sys.stderr,
            )
            sys.exit(2)
        sys.exit(0)

    # --- Write/Edit/MultiEdit/Bash path: scan for credentials ---

    # Skip .env files — credentials belong there
    if file_path and is_env_file(file_path):
        sys.exit(0)

    # Extract and scan
    text = extract_text(tool_name, tool_input)
    if not text:
        sys.exit(0)

    matches = scan(text)
    if not matches:
        sys.exit(0)

    # Block — print guidance to stderr
    names = sorted(set(name for name, _ in matches))
    print(
        f"BLOCKED: Detected hardcoded Mercado Pago credential(s): {', '.join(names)}.\n"
        f"Use environment variables instead:\n"
        f"  - MP_ACCESS_TOKEN for access tokens\n"
        f"  - MP_CLIENT_SECRET for client secrets\n"
        f"  - MP_WEBHOOK_SECRET for webhook signing secrets\n"
        f"See: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/credentials",
        file=sys.stderr,
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
