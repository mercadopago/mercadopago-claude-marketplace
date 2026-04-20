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

### Example: Disable credential scanning

If you're working on a project that doesn't use Mercado Pago credentials (e.g., documentation), you can disable the hook:

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
