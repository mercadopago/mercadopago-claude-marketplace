#!/usr/bin/env python3
"""
MP Developer Plugin — Credential Leak Prevention Hook

Scans tool inputs (Bash, Edit, Write, MultiEdit) for hardcoded
Mercado Pago credentials and blocks them before they reach source files.

Exit codes:
  0 — allow (no credentials detected)
  2 — block (credential pattern matched)

Reads optional per-project settings from .claude/mp-developer.local.md
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


# ---------- helpers ----------

def read_settings() -> dict:
    """Read per-project .claude/mp-developer.local.md frontmatter."""
    settings_path = os.path.join(os.getcwd(), ".claude", "mp-developer.local.md")
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
    if tool_name in ("Write", "Edit", "MultiEdit"):
        return tool_input.get("file_path", "")
    return ""


def scan(text: str) -> list[tuple[str, str]]:
    """Return list of (pattern_name, matched_value) for all credential matches."""
    matches = []
    for name, pattern in PATTERNS.items():
        for m in pattern.finditer(text):
            matches.append((name, m.group()))
    return matches


# ---------- main ----------

def main():
    try:
        data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)  # Can't parse input — allow

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})

    # Check per-project override
    settings = read_settings()
    if settings.get("enabled", "true").lower() == "false":
        sys.exit(0)

    # Skip .env files — credentials belong there
    file_path = get_file_path(tool_name, tool_input)
    if file_path and os.path.basename(file_path).startswith(".env"):
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
