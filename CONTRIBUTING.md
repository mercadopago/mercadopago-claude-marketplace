# Contributing to mercadopago-claude-marketplace

Thank you for your interest in contributing! This guide explains how to add new plugins or improve existing ones.

## Repository Structure

```
mercadopago-claude-marketplace/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace registry — lists all plugins
├── plugins/
│   └── <plugin-name>/
│       ├── .claude-plugin/
│       │   └── plugin.json       # Plugin manifest (required)
│       ├── README.md             # Plugin documentation (required)
│       ├── agents/               # Agent definitions (.md)
│       ├── commands/             # Slash command definitions (.md)
│       ├── skills/               # Skill definitions (SKILL.md + references/)
│       ├── hooks/                # Hook config (hooks.json) + scripts
│       └── .mcp.json             # MCP server definitions
└── ...
```

## Adding a New Plugin

### 1. Create the plugin directory

```bash
mkdir -p plugins/<your-plugin>/.claude-plugin
```

### 2. Create `plugin.json`

```json
{
  "name": "<your-plugin>",
  "description": "Brief description of what the plugin does",
  "version": "1.0.0",
  "author": { "name": "Your Name or Team" },
  "license": "Apache-2.0",
  "keywords": ["relevant", "keywords"]
}
```

### 3. Add components

Add any combination of:

- **Agents** (`agents/<name>.md`) — Specialized agents with frontmatter (`name`, `description`, `tools`, `model`, `tags`)
- **Commands** (`commands/<name>.md`) — Slash commands with frontmatter (`description`, `argument-hint`, `allowed-tools`)
- **Skills** (`skills/<name>/SKILL.md`) — Knowledge skills with frontmatter and reference files
- **Hooks** (`hooks/hooks.json` + scripts) — Event hooks for PreToolUse, PostToolUse, etc.
- **MCP Servers** (`.mcp.json`) — Model Context Protocol server definitions

### 4. Register in marketplace.json

Add your plugin to the `plugins` array in `.claude-plugin/marketplace.json`:

```json
{
  "name": "<your-plugin>",
  "source": "./plugins/<your-plugin>",
  "description": "Brief description",
  "version": "1.0.0",
  "author": { "name": "Your Name" },
  "license": "Apache-2.0",
  "category": "development",
  "keywords": ["keyword1", "keyword2"]
}
```

### 5. Add a README

Create `plugins/<your-plugin>/README.md` documenting all components and usage.

## Guidelines

### Content

- **Public information only** — Do not include internal URLs, credentials, proprietary APIs, or company-internal tooling
- **Working examples** — All code examples should be complete and functional
- **Environment variables** — Never hardcode credentials. Always use environment variables with clear naming

### Quality

- All JSON files must be valid (validated in CI)
- All Python scripts must pass `py_compile` syntax check
- Hooks must handle edge cases (missing stdin, invalid JSON) gracefully
- Commands should have clear argument hints and structured output

### Testing

Before submitting, run the validation suite:

```bash
# JSON validation
python3 -m json.tool .claude-plugin/marketplace.json
python3 -m json.tool plugins/<your-plugin>/.claude-plugin/plugin.json

# Python syntax (if applicable)
python3 -m py_compile plugins/<your-plugin>/hooks/*.py

# Hook testing (if applicable)
echo '{"tool_name":"Write","tool_input":{"file_path":"test.js","content":"clean code"}}' \
  | python3 plugins/<your-plugin>/hooks/<your-hook>.py; echo "Exit: $?"
```

## Submitting a Pull Request

1. Fork the repository
2. Create a feature branch (`git checkout -b add-my-plugin`)
3. Add your plugin following the structure above
4. Run validation checks locally
5. Submit a PR with a description of the plugin and its components

## Code of Conduct

Be respectful, constructive, and focused on helping developers build better Mercado Pago integrations.
