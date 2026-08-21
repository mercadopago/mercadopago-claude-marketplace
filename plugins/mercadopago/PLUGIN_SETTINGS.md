# MP Developer Plugin Settings

This plugin supports per-project configuration via a local settings file.

## Configuration File

Create `.claude/mercadopago.local.md` in your project root to customize plugin behavior:

```markdown
---
enabled: true
---
```

### Available Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable the credential leak prevention hook |

### Emergency override: disable credential scanning

The hook is already a no-op for secret-file reads in projects that do not show
Mercado Pago signals. Disable it only to diagnose a confirmed hook false
positive:

```markdown
---
enabled: false
---
```

### Notes

- The settings file must be at `.claude/mercadopago.local.md` relative to your project root
- The file uses YAML frontmatter (between `---` fences)
- Restart Claude Code after modifying settings
- `.claude/*.local.md` files are typically in `.gitignore` — they are personal, not shared
- `enabled: false` disables both credential-pattern scanning and secret-file read protection. Re-enable it immediately after diagnosis.
- The hook blocks direct Claude `Read` access and common Bash readers for `.env`, `.env.*`, `.envrc`, and `*.env` files in detected Mercado Pago projects. `.env.example`, `.env.sample`, and `.env.template` remain readable.
