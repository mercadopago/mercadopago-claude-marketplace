---
description: "Returns test card numbers for a given country. No MCP authentication required."
argument-hint: "[country_code]"
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Read, Bash, AskUserQuestion]
---

# /mp-test-cards

Returns test card numbers for Mercado Pago. **No MCP authentication required** — data is served from the bundled `references/products.md`.

## Step 0 — Read the bundled source

Use `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/products.md`. Claude Code resolves `${CLAUDE_PLUGIN_ROOT}` to the active plugin version. Never copy `.mcp.json`, scan an installation cache, or load another marketplace copy. This command remains fully offline.

## Step 1 — Resolve country

1. If `$ARGUMENTS` contains a country code (`AR`, `BR`, `MX`, `CO`, `CL`, `UY`, `PE`) → use it directly.
2. Otherwise, read `.mp-integrate-progress.md` in the project root. Use `country:` field if present.
3. Otherwise, ask once via `AskUserQuestion`:
   - `header="Country"`
   - Options: `"AR — Argentina"` / `"BR — Brazil"` / `"MX — Mexico"` / `"CO — Colombia"` + Other (for CL, UY, PE)

## Step 2 — Return test cards

Read `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/products.md` with the `Read` tool. Do not search a cache or another marketplace. If Claude Code cannot resolve the active root, use the bundled fallback table in Step 2b instead of loading a different plugin copy.

If no file is found by any method, skip to the fallback in Step 2b.

**Step 2b — Fallback (file not found)**

If `products.md` cannot be located, output the test cards inline from the table below. Do not call any MCP tool. Do not call `search_documentation`.

Hardcoded fallback data is embedded in this command only for this scenario — it is not the source of truth.

<details>
<summary>Fallback card data (use only if products.md is unreachable)</summary>

**AR** (MLA) — Expiry: 11/30 · CVV: 123 (Amex: 1234)
| Card number | Brand | Type |
|---|---|---|
| 5031 7557 3453 0604 | Mastercard | Credit |
| 4509 9535 6623 3704 | Visa | Credit |
| 3711 803032 57522 | Amex | Credit |
| 5287 3383 1025 3304 | Mastercard | Debit |
| 4002 7686 9439 5619 | Visa | Debit |

**BR** (MLB) — Expiry: 11/30 · CVV: 123 (Amex: 1234)
| Card number | Brand | Type |
|---|---|---|
| 5031 4332 1540 6351 | Mastercard | Credit |
| 4235 6477 2802 5682 | Visa | Credit |
| 3753 651535 56885 | Amex | Credit |
| 5067 2680 5566 8045 | Elo | Credit |

**MX** (MLM) — Expiry: 11/30 · CVV: 123 (Amex: 1234)
| Card number | Brand | Type |
|---|---|---|
| 5474 9254 3267 0366 | Mastercard | Credit |
| 4075 5957 1648 3764 | Visa | Credit |

**CO** (MCO) — Expiry: 11/30 · CVV: 123 (Amex: 1234)
| Card number | Brand | Type |
|---|---|---|
| 5254 1336 7440 3564 | Mastercard | Credit |
| 4013 5406 8274 6260 | Visa | Credit |

**CL** (MLC) — Expiry: 11/30 · CVV: 123 (Amex: 1234)
| Card number | Brand | Type |
|---|---|---|
| 5416 7526 0258 2580 | Mastercard | Credit |
| 4168 8188 4444 7115 | Visa | Credit |

Cardholder name → payment outcome: `APRO` = Approved · `FUND` = Insufficient funds · `OTHE` = General error · `CONT` = Pending · `CALL` = Requires authorization · `SECU` = Invalid CVV · `EXPI` = Expired

</details>

---

Find the section `### {COUNTRY} ({SITE_ID})`.

Format the output as:

```
## Test cards — {Country} ({site_id})

Expiry: 11/30 · CVV: 123 (Amex: 1234)

| Card number         | Brand      | Type   |
|---------------------|------------|--------|
| 4509 9535 6623 3704 | Visa       | Credit |
| ...                 | ...        | ...    |

### Cardholder name → payment outcome

Set the cardholder first+last name to one of these to force a scenario:

| Name  | Result                              |
|-------|-------------------------------------|
| APRO  | Approved payment                    |
| FUND  | Declined — insufficient funds       |
| OTHE  | Declined — general error            |
| CONT  | Pending                             |
| CALL  | Declined — requires authorization   |
| SECU  | Declined — invalid security code    |
| EXPI  | Declined — expired                  |

Document field: {document_note_for_country}
```

> ⚠️ These are **test cards only**. Never use real card numbers in a test environment.
> To create test users with pre-loaded funds, run `/mp-integrate test-setup`.

## Step 3 — Invalid or unrecognized country

Respond in the user's language. If the argument is not one of the 7 valid countries (`AR`, `BR`, `MX`, `CO`, `CL`, `PE`, `UY`):

1. **Try to infer:** if the input looks like a country name (e.g. "chile", "peru"), suggest the correct code via `AskUserQuestion`:
   - Question: *"Did you mean **{suggestion}** ({country name})?"*
   - Options: `"Yes"` / `"No, it's a different country"`

2. **If the user confirms the suggestion** → use the correct code and continue.

3. **If the user insists on an unrecognized code** → inform them and open a picker:
   > *"Mercado Pago does not operate in that country. Test cards exist only for: Argentina, Brazil, Mexico, Colombia, Chile, Peru, and Uruguay."*

   Then ask via `AskUserQuestion`:
   - header: `"Country"`
   - Options: `"AR — Argentina"` / `"BR — Brazil"` / `"MX — Mexico"` / `"CO — Colombia"` + Other (CL, PE, UY)

4. **Never** call `search_documentation` or any MCP tool.
5. **Never** invent card numbers.
