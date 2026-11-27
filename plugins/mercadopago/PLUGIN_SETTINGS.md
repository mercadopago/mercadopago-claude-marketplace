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

### Variables de entorno opcionales

| Variable | Uso | Valor por defecto |
|---|---|---|
| `MP_SMARTAPPS_FEEDBACK_EMAIL` | Destinatario del feedback del asesor de SmartApps cuando un problema queda sin resolver (ver `skills/mp-integrate/references/guides/smartapps-feedback.md`). | Vacío: el feedback queda pendiente en `.mp-smartapps-feedback.md` del proyecto |

Defínela en tu `.env` local (cargado en el entorno) o en la configuración `env`
de Claude Code. El asesor lee solo el valor de la variable, nunca el archivo
`.env`, y no envía nada sin tu confirmación explícita.

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
