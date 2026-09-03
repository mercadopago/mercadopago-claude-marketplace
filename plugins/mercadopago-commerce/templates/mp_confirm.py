#!/usr/bin/env python3
"""Inspect a Checkout Pro Order without trusting browser return parameters.

Pass the Order id printed by the demo backend after it creates the handoff:

    python scripts/mp_confirm.py ORDTST01...

For production fulfillment, consume an authenticated Order webhook, run the
same server-side GET and compare reference, amount and currency with the
merchant order. This diagnostic only inspects the Mercado Pago state.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "examples"))

load_dotenv(REPO_ROOT / ".env", override=False)

from retail.api.mp_checkout import MPConfig, MPConfigError, get_checkout_order  # noqa: E402


def resolve_order_id(argv: list[str]) -> str:
    if len(argv) != 2 or not argv[1].strip():
        raise SystemExit("Usage: python scripts/mp_confirm.py <order_id>")
    return argv[1].strip()


async def main() -> int:
    order_id = resolve_order_id(sys.argv)
    try:
        cfg = MPConfig.from_env()
        print(f"Looking up order_id={order_id} ...")
        order = await get_checkout_order(cfg, order_id)
    except MPConfigError as error:
        print(f"Lookup failed: {error}")
        return 1

    print("")
    print(f"  status             {order.status}")
    print(f"  status_detail      {order.status_detail}")
    print(f"  external_reference {order.external_reference}")
    print(f"  total_amount        {order.total_amount} {order.currency or ''}".rstrip())
    print(f"  total_paid_amount   {order.total_paid_amount} {order.currency or ''}".rstrip())
    print(f"  last_updated_date   {order.last_updated_date}")
    print("")

    if order.payment_accredited:
        print("ACCREDITED — state confirmed server-side.")
        print("Before fulfillment, also match reference, amount and currency.")
        return 0

    print("NOT ACCREDITED — do not fulfill this order.")
    return 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
