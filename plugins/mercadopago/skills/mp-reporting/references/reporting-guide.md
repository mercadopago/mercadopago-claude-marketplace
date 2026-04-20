# Reporting Integration Reference

## Report Types

| Report | Content | Format |
|--------|---------|--------|
| Settlement | Available money, release dates | CSV |
| Account Statement | All movements (in/out) | CSV |
| Available Balance | Current balance details | CSV |

## Reconciliation Strategy

1. Always set `external_reference` when creating payments
2. Use external_reference to match MP payments with internal orders
3. Download settlement report
4. Match report rows with internal records via external_reference
5. Flag discrepancies for manual review

## Report Fields (Settlement)

Key columns: source_id (payment ID), external_reference, gross_amount, fee_amount, net_amount, date_created, date_approved, status

## Scheduling

- Reports can be generated on-demand or scheduled
- Scheduled: daily, weekly, monthly
- Notification via webhook when report is ready
- Download via API with report_id

## Best Practices

- Automate daily reconciliation
- Store external_reference in your order system
- Handle currency formatting per country
- Account for fee deductions in reconciliation

**For current report API endpoints and field schemas**: Consult MCP server.
