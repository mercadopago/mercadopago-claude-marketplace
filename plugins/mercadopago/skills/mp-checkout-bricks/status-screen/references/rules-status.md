# Payment Status Reference (official MercadoPago documentation)

## Status values

| `status` | `status_detail` | Description |
|---|---|---|
| `approved` | `accredited` | Payment approved. Funds on their way. |
| `approved` | `partially_refunded` | Payment approved with at least one partial refund. |
| `authorized` | `pending_capture` | Payment authorized, waiting for capture. |
| `in_process` | `offline_process` | Being processed offline due to lack of online processing. |
| `in_process` | `pending_contingency` | Being processed. Result within 2 business days. |
| `in_process` | `pending_review_manual` | Under manual review. Result within 2 business days. |
| `pending` | `pending_waiting_transfer` | Waiting for user to complete bank transfer (Pix, PSE). |
| `pending` | `pending_waiting_payment` | Waiting for user to pay at physical location (Boleto, OXXO, cash). |
| `pending` | `pending_challenge` | 3DS challenge required. Status Screen Brick handles automatically. |
| `rejected` | `bank_error` | Bank transfer rejected due to bank error. |
| `rejected` | `cc_rejected_3ds_mandatory` | Rejected — 3DS challenge was required but not completed. |
| `rejected` | `cc_rejected_bad_filled_card_number` | Rejected — invalid card number. |
| `rejected` | `cc_rejected_bad_filled_date` | Rejected — invalid expiry date. |
| `rejected` | `cc_rejected_bad_filled_other` | Rejected — invalid card data. |
| `rejected` | `cc_rejected_bad_filled_security_code` | Rejected — invalid CVV. |
| `rejected` | `cc_rejected_blacklist` | Rejected — card blacklisted. |
| `rejected` | `cc_rejected_call_for_authorize` | Rejected — requires phone authorization with bank. |
| `rejected` | `cc_rejected_card_disabled` | Rejected — card not active. |
| `rejected` | `cc_rejected_card_error` | Rejected — card processing error. |
| `rejected` | `cc_rejected_duplicated_payment` | Rejected — duplicate payment detected. |
| `rejected` | `cc_rejected_high_risk` | Rejected — fraud risk. |
| `rejected` | `cc_rejected_insufficient_amount` | Rejected — insufficient funds. |
| `rejected` | `cc_rejected_invalid_installments` | Rejected — installments not accepted. |
| `rejected` | `cc_rejected_max_attempts` | Rejected — too many failed attempts. |
| `rejected` | `cc_rejected_other_reason` | Rejected — other reason. |
| `rejected` | `cc_amount_rate_limit_exceeded` | Rejected — exceeded payment method limit (CAP). |
| `rejected` | `rejected_insufficient_data` | Rejected — missing required fields. |
| `rejected` | `rejected_by_bank` | Rejected by bank. |
| `rejected` | `rejected_by_regulations` | Rejected due to regulations. |
| `rejected` | `insufficient_amount` | Rejected — insufficient amount. |
| `cancelled` | `cancelled` | Payment cancelled. |

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "payment status detail approved rejected pending collection results")`
