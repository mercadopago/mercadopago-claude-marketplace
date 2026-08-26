#!/usr/bin/env python3
"""
SPDX-FileCopyrightText: (c) 2026 Mercado Pago (MercadoLibre S.R.L.)
SPDX-License-Identifier: Apache-2.0

Mercado Pago Plugin — credential leak prevention hook.

The hook always scans supported write/edit/Bash inputs for Mercado Pago secret
patterns. In projects that show Mercado Pago signals, it also blocks direct
Read and common Bash attempts to expose secret environment files.

Exit codes:
  0 — allow
  2 — block
"""

import json
import os
import re
import shlex
import sys
from typing import Dict, List, Tuple


PATTERNS = {
    "MP Access Token": re.compile(
        r"(?:TEST|APP_USR)-\d{8,}-\d{4,}-[a-f0-9]{24,}-\d+",
        re.IGNORECASE,
    ),
    "Client Secret": re.compile(
        r"""['\"](?:client_secret|mp_client_secret)['\"]\s*[:=]\s*['\"][A-Za-z0-9_+/=-]{24,}['\"]""",
        re.IGNORECASE,
    ),
    "Bearer Token": re.compile(
        r"Bearer\s+(?:TEST|APP_USR)-[^\s'\"]+",
        re.IGNORECASE,
    ),
    "Webhook Secret": re.compile(
        r"""['\"]?(?:x-signature|webhook.?secret|mp_webhook_secret)['\"]?\s*[:=]\s*['\"][A-Za-z0-9_+/=-]{20,}['\"]""",
        re.IGNORECASE,
    ),
}


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

PROJECT_SIGNAL_FILES = MANIFEST_FILES + (
    ".env.example",
    ".env.sample",
    ".mcp.json",
    "README.md",
)

SHELL_READERS = {
    ".",
    "awk",
    "cat",
    "cut",
    "grep",
    "head",
    "less",
    "more",
    "sed",
    "source",
    "tail",
}

CODE_SUFFIXES = {
    "cjs",
    "css",
    "go",
    "html",
    "java",
    "js",
    "json",
    "jsx",
    "kt",
    "md",
    "mjs",
    "php",
    "py",
    "rb",
    "rs",
    "sh",
    "ts",
    "tsx",
    "yaml",
    "yml",
}


def _mentions_mercadopago(path: str) -> bool:
    try:
        with open(path, "r", errors="ignore") as handle:
            content = handle.read(256 * 1024).lower()
        return "mercadopago" in content or "mercado pago" in content
    except OSError:
        return False


def is_mercadopago_project(start_dir: str) -> bool:
    """Walk to the repository boundary looking for a Mercado Pago signal."""
    current = os.path.abspath(start_dir or os.getcwd())
    for _ in range(32):
        if os.path.isfile(os.path.join(current, ".claude", "mercadopago.local.md")):
            return True
        if os.path.isfile(os.path.join(current, ".mp-integrate-progress.md")):
            return True
        for name in PROJECT_SIGNAL_FILES:
            candidate = os.path.join(current, name)
            if os.path.isfile(candidate) and _mentions_mercadopago(candidate):
                return True

        at_repo_root = os.path.isdir(os.path.join(current, ".git"))
        parent = os.path.dirname(current)
        if at_repo_root or parent == current:
            break
        current = parent
    return False


def read_settings() -> Dict[str, str]:
    """Read per-project .claude/mercadopago.local.md frontmatter."""
    settings_path = os.path.join(os.getcwd(), ".claude", "mercadopago.local.md")
    if not os.path.isfile(settings_path):
        return {}

    try:
        with open(settings_path, "r") as handle:
            content = handle.read()
    except OSError:
        return {}

    if not content.startswith("---"):
        return {}
    end = content.find("---", 3)
    if end == -1:
        return {}

    result = {}
    for line in content[3:end].strip().splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            result[key.strip()] = value.strip()
    return result


def extract_text(tool_name: str, tool_input: dict) -> str:
    if tool_name == "Bash":
        return tool_input.get("command", "")
    if tool_name == "Write":
        return tool_input.get("content", "")
    if tool_name == "Edit":
        return tool_input.get("new_string", "")
    if tool_name == "MultiEdit":
        return "\n".join(
            edit.get("new_string", "") for edit in tool_input.get("edits", [])
        )
    if tool_name == "NotebookEdit":
        return tool_input.get("cell_source", "")
    return ""


def get_file_path(tool_name: str, tool_input: dict) -> str:
    if tool_name in ("Write", "Edit", "MultiEdit", "Read"):
        return tool_input.get("file_path", "")
    if tool_name == "NotebookEdit":
        return tool_input.get("notebook_path", "")
    return ""


def scan(text: str) -> List[Tuple[str, str]]:
    matches = []
    for name, pattern in PATTERNS.items():
        for match in pattern.finditer(text):
            matches.append((name, match.group()))
    return matches


def is_env_file(path: str) -> bool:
    """Return whether a path is a likely secret environment file."""
    basename = os.path.basename(path).lower().strip("'\"")
    if not basename:
        return False
    if any(marker in basename for marker in ("example", "sample", "template")):
        return False
    if basename in (".env", ".envrc", "secrets.env", "secret.env", "credentials.env"):
        return True
    if basename.endswith(".env"):
        return True
    if basename.startswith(".env."):
        suffix = basename.rsplit(".", 1)[-1]
        return suffix not in CODE_SUFFIXES
    return False


def bash_reads_secret_file(command: str) -> bool:
    """Detect common shell reads of env files without executing the command."""
    try:
        tokens = shlex.split(command, posix=True)
    except ValueError:
        tokens = command.split()

    normalized = [token.strip(";|&()<> ") for token in tokens]
    has_reader = any(os.path.basename(token) in SHELL_READERS for token in normalized)
    has_secret_file = any(is_env_file(token) for token in normalized)
    redirected_secret = bool(
        re.search(r"<\s*[^\s;&|]*(?:\.env(?:\.[^\s;&|]+)?|[^/\s;&|]+\.env)\b", command)
    )
    exposes_mp_env = bool(
        re.search(
            r"\b(?:printenv|env)\b[^\n]*(?:MP_ACCESS_TOKEN|MP_CLIENT_SECRET|MP_WEBHOOK_SECRET)",
            command,
            re.IGNORECASE,
        )
    )
    return (has_reader and has_secret_file) or redirected_secret or exposes_mp_env


def is_within_project(path: str) -> bool:
    try:
        absolute = os.path.realpath(os.path.abspath(path))
        project_root = os.path.realpath(os.getcwd())
        return absolute.startswith(project_root + os.sep) or absolute == project_root
    except (OSError, ValueError):
        return False


def block(message: str) -> None:
    print("BLOCKED: " + message, file=sys.stderr)
    raise SystemExit(2)


def main() -> None:
    try:
        data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        block("Credential hook received invalid JSON input; refusing the tool call safely.")

    if not isinstance(data, dict) or not isinstance(data.get("tool_input", {}), dict):
        block("Credential hook received an invalid payload shape.")

    settings = read_settings()
    if settings.get("enabled", "true").lower() == "false":
        raise SystemExit(0)

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})
    file_path = get_file_path(tool_name, tool_input)
    relevant_project = is_mercadopago_project(os.getcwd())

    if tool_name == "Read":
        if relevant_project and file_path and is_env_file(file_path):
            block(
                "Reading secret environment files is disabled in Mercado Pago projects. "
                "Read .env.example or .env.sample instead."
            )
        raise SystemExit(0)

    if tool_name == "Bash" and relevant_project:
        command = tool_input.get("command", "")
        if bash_reads_secret_file(command):
            block(
                "This shell command may expose a secret environment file or Mercado Pago "
                "secret. Use variable names or a redacted .env.example instead."
            )

    # Secret files inside the project are the intended destination for values.
    # Their content is not scanned, but direct model reads remain blocked above.
    if file_path and is_env_file(file_path) and is_within_project(file_path):
        raise SystemExit(0)

    text = extract_text(tool_name, tool_input)
    if not text:
        raise SystemExit(0)

    matches = scan(text)
    if not matches:
        raise SystemExit(0)

    names = sorted(set(name for name, _ in matches))
    block(
        "Detected hardcoded Mercado Pago credential(s): {}. Use MP_ACCESS_TOKEN, "
        "MP_CLIENT_SECRET, or MP_WEBHOOK_SECRET from environment variables or a secret "
        "manager.".format(", ".join(names))
    )


if __name__ == "__main__":
    main()
