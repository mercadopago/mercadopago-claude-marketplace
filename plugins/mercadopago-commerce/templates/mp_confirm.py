#!/usr/bin/env python3
"""Confirm a Checkout Pro payment server-side.

The redirect back from Mercado Pago carries query parameters an attacker controls,
so nothing here trusts them. The only thing that decides whether an order was paid
is this lookup, keyed on the external_reference we generated when the preference
was created.

    python scripts/mp_confirm.py                 # uses the last checkout of the session
    python scripts/mp_confirm.py <external_ref>  # or an explicit reference
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "examples"))

load_dotenv(REPO_ROOT / ".env", override=False)

from retail.api.mp_checkout import MPConfig, find_payment  # noqa: E402
from retail.api.mp_retail import LAST_REFERENCE_FILE  # noqa: E402


def resolve_reference(argv: list[str]) -> str:
    if len(argv) > 1:
        return argv[1].strip()
    if LAST_REFERENCE_FILE.exists():
        return LAST_REFERENCE_FILE.read_text(encoding="utf-8").strip()
    raise SystemExit(
        "No external_reference given and no checkout recorded yet.\n"
        "Run a checkout in the storefront first, or pass the reference as an argument."
    )


async def main() -> int:
    reference = resolve_reference(sys.argv)
    cfg = MPConfig.from_env()

    print(f"Looking up external_reference={reference} ...")
    payment = await find_payment(cfg, reference)

    if payment is None:
        print("No payment found yet for that reference.")
        print("The buyer may not have finished paying — try again in a few seconds.")
        return 1

    status = payment.get("status")
    print("")
    print(f"  status         {status}")
    print(f"  status_detail  {payment.get('status_detail')}")
    print(f"  payment_id     {payment.get('id')}")
    print(f"  amount         {payment.get('transaction_amount')} {payment.get('currency_id')}")
    print(f"  payment_method {payment.get('payment_method_id')}")
    print(f"  installments   {payment.get('installments')}")
    print("")
    print("APPROVED — confirmed server-side." if status == "approved" else f"NOT approved: {status}")
    return 0 if status == "approved" else 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
