"""The ACME retail backend, paid through Checkout Pro via Orders API.

Only ``checkout_handoff`` changes. Search, cart, orders and policies stay exactly as
the blueprint wrote them. The handoff is deliberately server-side: Claude never
receives Mercado Pago credentials or the hosted checkout URL.
"""

from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation
from typing import Any

from shopping_agent import Cart, CheckoutHandoff, ShoppingSessionContext

from .mock_retail import MockRetail
from .mp_checkout import (
    MPConfig,
    MPConfigError,
    MPPayer,
    checkout_reference,
    create_checkout_order,
    format_amount,
)

logger = logging.getLogger(__name__)


class MPRetail(MockRetail):
    def __init__(
        self,
        *args: Any,
        mp_config: MPConfig | None = None,
        mp_payer: MPPayer | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        # Keep ordinary catalog/search tests independent from payment credentials.
        # The checkout route still fails closed when configuration is missing.
        self._mp = mp_config
        self._payer = mp_payer

    def _reprice(self, cart: Cart, cfg: MPConfig) -> list[dict[str, Any]]:
        """Rebuild every line from the catalog, discarding the prices in the cart.

        The model supplies product ids and quantities, never authoritative prices.
        Re-reading the catalog here protects against stale or tampered cart state.

        The currency is taken from configuration for the same reason — ``Cart.currency``
        defaults to USD in the blueprint and a Brazilian collector cannot charge USD.
        """
        items: list[dict[str, Any]] = []
        for line in cart.items:
            product = self.product(line.product_id)
            if product is None:
                raise ValueError(f"{line.product_id} is not available for checkout")
            if not product.in_stock:
                raise ValueError(f"{line.product_id} is out of stock")
            quantity = line.quantity
            if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity < 1:
                raise ValueError(f"{line.product_id} has an invalid quantity")

            try:
                unit_price = Decimal(str(product.price)) * cfg.price_multiplier
            except (InvalidOperation, TypeError, ValueError) as error:
                raise ValueError(f"{line.product_id} has an invalid catalog price") from error
            if not unit_price.is_finite() or unit_price <= 0:
                raise ValueError(f"{line.product_id} has an invalid catalog price")
            rendered_price = format_amount(unit_price, cfg.decimals)
            item: dict[str, Any] = {
                "external_code": product.product_id,
                "title": product.title,
                "description": product.short_description or product.title,
                "quantity": quantity,
                "unit_price": rendered_price,
                "unit_measure": "unit",
            }
            if product.image_url and product.image_url.startswith("https://"):
                item["picture_url"] = product.image_url
            items.append(item)
        return items

    async def checkout_handoff(
        self, session: ShoppingSessionContext, cart: Cart
    ) -> list[CheckoutHandoff]:
        cfg = self._mp or MPConfig.from_env()
        payer = self._payer or MPPayer.from_env()
        self._mp = cfg
        self._payer = payer

        items = self._reprice(cart, cfg)
        if not items:
            return []

        external_reference = checkout_reference(session.session_id, items)
        try:
            order = await create_checkout_order(
                cfg,
                payer=payer,
                items=items,
                external_reference=external_reference,
            )
        except MPConfigError as err:
            logger.error("Mercado Pago checkout order failed: %s", err)
            raise

        # These identifiers are safe to log. checkout_url and client_token are not.
        logger.info(
            "Checkout Pro order ready — order_id=%s external_reference=%s",
            order.order_id,
            order.external_reference,
        )

        return [CheckoutHandoff(url=order.checkout_url, label=cfg.checkout_label)]
