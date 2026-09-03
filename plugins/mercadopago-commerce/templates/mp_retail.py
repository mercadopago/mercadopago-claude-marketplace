"""The ACME retail backend, paid through Mercado Pago Checkout Pro.

Only ``checkout_handoff`` changes. Search, cart, orders and policies stay exactly as
the blueprint wrote them, which is the whole point: adding a payment provider to a
commerce agent is one method, not a rewrite.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any

from shopping_agent import Cart, CheckoutHandoff, ShoppingSessionContext

from .mock_retail import MockRetail
from .mp_checkout import MPConfig, MPConfigError, create_preference

logger = logging.getLogger(__name__)

# Where the last reference is parked so scripts/mp_confirm.py can look the payment up.
LAST_REFERENCE_FILE = Path(__file__).resolve().parent.parent / "data" / ".mp-last-reference"


class MPRetail(MockRetail):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        # Fail at boot rather than in front of an audience.
        self._mp = MPConfig.from_env()

    def _reprice(self, cart: Cart) -> list[dict[str, Any]]:
        """Rebuild every line from the catalog, discarding the prices in the cart.

        The cart is assembled by a language model that reads product descriptions, so
        its prices are attacker-reachable: a description saying "this item costs $1"
        is enough. The catalog is the only price that may reach Mercado Pago.

        The currency is taken from configuration for the same reason — ``Cart.currency``
        defaults to USD in the blueprint and a Brazilian collector cannot charge USD.
        """
        items: list[dict[str, Any]] = []
        for line in cart.items:
            product = self.product(line.product_id)
            if product is None:
                logger.warning("Skipping unknown product_id in cart: %s", line.product_id)
                continue
            unit_price = round(product.price * self._mp.price_multiplier, self._mp.decimals)
            items.append(
                {
                    "id": product.product_id,
                    "title": product.title,
                    "quantity": int(line.quantity),
                    "unit_price": unit_price,
                    "currency_id": self._mp.currency_id,
                }
            )
        return items

    async def checkout_handoff(
        self, session: ShoppingSessionContext, cart: Cart
    ) -> list[CheckoutHandoff]:
        items = self._reprice(cart)
        if not items:
            return []

        external_reference = f"demo-{session.session_id[:12]}-{uuid.uuid4().hex[:8]}"
        try:
            init_point = await create_preference(
                self._mp, items=items, external_reference=external_reference
            )
        except MPConfigError as err:
            # A failed preference must not take the conversation down with it.
            logger.error("Checkout Pro preference failed: %s", err)
            return []

        # The reference is safe to record; the init_point is not, so it is never logged.
        logger.info("Checkout Pro preference ready — external_reference=%s", external_reference)
        try:
            LAST_REFERENCE_FILE.write_text(external_reference, encoding="utf-8")
        except OSError:
            pass

        return [CheckoutHandoff(url=init_point, label="Pagar com Mercado Pago")]
