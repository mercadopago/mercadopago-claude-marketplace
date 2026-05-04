---
name: mp-reporting
description: Mercado Pago reporting and reconciliation. Covers settlement reports, account statements, and transaction reconciliation. Use when implementing financial reporting.
license: Apache-2.0
metadata:
  version: "2.0.1"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, reports, reporting, reconciliation, settlement, conciliation"
---

# mp-reporting

## Products Covered

- **Released Money Report**: Money released and available for withdrawal, with release dates
- **Account Balance Report**: Current account balance, all movements (in/out)
- **Transaction Reconciliation**: Match payments with orders via external_reference

## When to Use

Use this skill when the query involves: report, reporte, conciliation, settlement, reconciliation, financial reporting, relatório.

**NOT** for payment processing -- use mp-checkout-online instead.

## Decision Tree

```
Need financial data
├── When will money be available?
│   └── Released Money Report
├── Current balance and all movements?
│   └── Account Balance Report
├── Match payments to orders?
│   └── Reconciliation via external_reference
└── Automated report generation?
    └── Report scheduling API
```

## Integration Flow: Reports

1. Configure report type and schedule
2. Generate report (manual or scheduled)
3. Download report file (CSV/JSON)
4. Parse and process data
5. Reconcile with internal records

## Gotchas

- Reports may have a generation delay (not real-time).
- Large reports are paginated.
- Use external_reference in payments for easy reconciliation.
- Report columns vary by type and country.
- Scheduled reports are generated daily/weekly.

## Prerequisites

- Mercado Pago account with transactions
- API credentials

## Country Availability

All countries (report types may vary)

## What to Fetch from MCP/Docs

- Report types available
- Generation endpoints
- Download endpoints
- Field descriptions
- `{DOMAIN}/developers/{LANG}/docs/reports/introduction`
