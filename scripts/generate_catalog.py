#!/usr/bin/env python3
"""Generate docs/components.json from plugin source files.

Scans skills, agents, commands, and hooks under plugins/mercadopago/
and produces a single JSON catalog consumed by the static website.

Uses only Python stdlib — no external dependencies.
"""

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLUGIN_DIR = ROOT / "plugins" / "mercadopago"
OUTPUT = ROOT / "docs" / "components.json"


def parse_frontmatter(text: str) -> dict:
    """Extract YAML-ish frontmatter between --- delimiters using regex."""
    match = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not match:
        return {}
    block = match.group(1)
    data = {}
    current_key = None
    indent_block = {}

    for line in block.split("\n"):
        # Skip blank lines
        if not line.strip():
            continue

        # Indented line (part of a nested block like metadata:)
        if line.startswith("  ") and current_key:
            nested_match = re.match(r'\s+(\w[\w-]*):\s*"?([^"]*)"?\s*$', line)
            if nested_match:
                indent_block[nested_match.group(1)] = nested_match.group(2).strip()
            continue

        # Flush any pending nested block
        if current_key and indent_block:
            data[current_key] = indent_block
            indent_block = {}
            current_key = None

        # Top-level key: value
        top_match = re.match(r'^(\w[\w-]*):\s*(.*?)\s*$', line)
        if top_match:
            key = top_match.group(1)
            value = top_match.group(2)

            # YAML array like [a, b, c]
            if value.startswith("[") and value.endswith("]"):
                items = [v.strip().strip('"').strip("'") for v in value[1:-1].split(",")]
                data[key] = [i for i in items if i]
                current_key = None
            # Quoted string
            elif value.startswith('"') and value.endswith('"'):
                data[key] = value[1:-1]
                current_key = None
            # Empty value — start of nested block
            elif value == "":
                current_key = key
                indent_block = {}
            # Object-like value (e.g. author: { "name": "..." })
            elif value.startswith("{"):
                data[key] = value
                current_key = None
            else:
                data[key] = value
                current_key = None

    # Flush last nested block
    if current_key and indent_block:
        data[current_key] = indent_block

    return data


def parse_tags(raw) -> list:
    """Normalize tags from various formats to a list of strings."""
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        return [t.strip() for t in raw.split(",") if t.strip()]
    return []


def _parse_skill(skill_file: Path) -> dict:
    """Parse a single SKILL.md into a component dict."""
    skill_dir = skill_file.parent
    text = skill_file.read_text(encoding="utf-8")
    fm = parse_frontmatter(text)
    meta = fm.get("metadata", {})

    refs_dir = skill_dir / "references"
    references = []
    if refs_dir.is_dir():
        references = sorted(
            f"references/{f.name}" for f in refs_dir.iterdir() if f.suffix == ".md"
        )

    return {
        "name": fm.get("name", skill_dir.name),
        "type": "skill",
        "description": fm.get("description", ""),
        "version": meta.get("version", fm.get("version", "")),
        "tags": parse_tags(meta.get("tags", fm.get("tags", []))),
        "license": fm.get("license", ""),
        "path": str(skill_file.relative_to(ROOT)),
        "references": references,
    }


def collect_skills() -> list:
    """Collect top-level skills from plugins/mercadopago/skills/*/SKILL.md."""
    components = []
    skills_dir = PLUGIN_DIR / "skills"
    if not skills_dir.exists():
        return components

    for skill_dir in sorted(skills_dir.iterdir()):
        skill_file = skill_dir / "SKILL.md"
        if not skill_file.is_file():
            continue

        components.append(_parse_skill(skill_file))

    return components


def collect_agents() -> list:
    """Collect agents from plugins/mercadopago/agents/*.md."""
    components = []
    agents_dir = PLUGIN_DIR / "agents"
    if not agents_dir.exists():
        return components

    for agent_file in sorted(agents_dir.glob("*.md")):
        text = agent_file.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)

        components.append({
            "name": fm.get("name", agent_file.stem),
            "type": "agent",
            "description": fm.get("description", ""),
            "version": fm.get("version", ""),
            "tags": parse_tags(fm.get("tags", [])),
            "license": fm.get("license", ""),
            "tools": fm.get("tools", ""),
            "model": fm.get("model", ""),
            "path": str(agent_file.relative_to(ROOT)),
        })

    return components


def collect_commands() -> list:
    """Collect commands from plugins/mercadopago/commands/*.md."""
    components = []
    commands_dir = PLUGIN_DIR / "commands"
    if not commands_dir.exists():
        return components

    for cmd_file in sorted(commands_dir.glob("*.md")):
        text = cmd_file.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)

        # Command name is derived from filename: mp-setup.md -> /mp-setup
        cmd_name = f"/{cmd_file.stem}"

        components.append({
            "name": cmd_name,
            "type": "command",
            "description": fm.get("description", ""),
            "argument_hint": fm.get("argument-hint", ""),
            "allowed_tools": fm.get("allowed-tools", []),
            "license": fm.get("license", ""),
            "path": str(cmd_file.relative_to(ROOT)),
        })

    return components


def collect_hooks() -> list:
    """Collect hooks from plugins/mercadopago/hooks/hooks.json."""
    components = []
    hooks_file = PLUGIN_DIR / "hooks" / "hooks.json"
    if not hooks_file.is_file():
        return components

    data = json.loads(hooks_file.read_text(encoding="utf-8"))

    # Extract hook events and matchers
    hooks_config = data.get("hooks", {})
    for event, entries in hooks_config.items():
        for entry in entries:
            matcher = entry.get("matcher", "")
            for hook in entry.get("hooks", []):
                hook_type = hook.get("type", "")
                command = hook.get("command", "")
                # Derive a friendly name from the command
                name = Path(command.split("/")[-1]).stem if "/" in command else command

                components.append({
                    "name": name,
                    "type": "hook",
                    "description": data.get("description", ""),
                    "trigger": event,
                    "matcher": matcher,
                    "hook_type": hook_type,
                    "path": str(hooks_file.relative_to(ROOT)),
                })

    return components


def load_plugin_meta() -> dict:
    """Load plugin metadata from .claude-plugin/plugin.json."""
    meta_file = PLUGIN_DIR / ".claude-plugin" / "plugin.json"
    if not meta_file.is_file():
        return {}
    data = json.loads(meta_file.read_text(encoding="utf-8"))
    author = data.get("author", {})
    return {
        "name": data.get("name", ""),
        "version": data.get("version", ""),
        "description": data.get("description", ""),
        "repository": data.get("repository", ""),
        "license": data.get("license", ""),
        "author": author.get("name", "") if isinstance(author, dict) else str(author),
        "keywords": data.get("keywords", []),
    }


def main():
    skills = collect_skills()
    agents = collect_agents()
    commands = collect_commands()
    hooks = collect_hooks()

    all_components = agents + skills + commands + hooks

    catalog = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "plugin": load_plugin_meta(),
        "stats": {
            "total": len(all_components),
            "skills": len(skills),
            "agents": len(agents),
            "commands": len(commands),
            "hooks": len(hooks),
        },
        "components": all_components,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Generated {OUTPUT} with {len(all_components)} components:")
    print(f"  Skills:     {len(skills)}")
    print(f"  Agents:     {len(agents)}")
    print(f"  Commands:   {len(commands)}")
    print(f"  Hooks:      {len(hooks)}")


if __name__ == "__main__":
    main()
