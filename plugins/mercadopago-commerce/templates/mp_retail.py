"""Checkout Pro handoff wired through mercadopago-commerce-agents-checkout.

Copy this file over the retail example's ``api/mp_retail.py`` and replace
``MockRetail`` with ``MPRetail`` in ``api/main.py``. The package owns the
Orders API contract: it reloads catalog records, creates the Order, validates
the returned hosted URL, and gives it to commerce-agents after the model call.

The small attempt store below is intentionally *demo-only*. A production
seller must replace it with durable storage and close an attempt only after a
verified terminal Order webhook has updated the seller's own order state.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import mercadopago
from mercadopago_commerce_agents import (
    CheckoutHandoff,
    CheckoutOutcomeUnknown,
    MercadoPagoCheckout,
)
from shopping_agent import Cart, ShoppingSessionContext

from .mock_retail import MockRetail


_RECONCILIATION_DEADLINE = timedelta(hours=25)
"""Block and reconcile after the hosted Order's P1D window; never rotate by clock alone."""


@dataclass
class _CheckoutAttempt:
    """One checkout operation retained until a verified terminal Order state."""

    idempotency_key: str
    external_reference: str
    reconcile_after: datetime | None = None
    handoffs: tuple[CheckoutHandoff, ...] | None = None
    outcome_unknown: bool = False
    order_id: str | None = None


class InMemoryCheckoutAttemptStore:
    """Local-demo implementation only; production must use durable seller storage.

    The identifiers are created together before the first possible API call and
    survive A -> B -> A cart navigation during this process. A restart loses
    them, which is why this class must never be used for a live seller.
    """

    def __init__(self) -> None:
        self._attempts: dict[tuple[str, str], _CheckoutAttempt] = {}
        self._attempts_by_reference: dict[str, tuple[str, str]] = {}

    def get_or_create(
        self, session: ShoppingSessionContext, cart: Cart
    ) -> tuple[tuple[str, str], _CheckoutAttempt]:
        attempt_id = (session.session_id, self._cart_fingerprint(cart))
        attempt = self._attempts.get(attempt_id)
        if attempt is None:
            attempt = _CheckoutAttempt(
                idempotency_key=f"checkout-{uuid4()}",
                external_reference=f"seller-order-{uuid4()}",
            )
            self._attempts[attempt_id] = attempt
            self._attempts_by_reference[attempt.external_reference] = attempt_id
        return attempt_id, attempt

    def finish(self, external_reference: str) -> None:
        """Close an attempt after a verified paid, canceled, or expired Order."""

        attempt_id = self._attempts_by_reference.pop(external_reference, None)
        if attempt_id is not None:
            self._attempts.pop(attempt_id, None)

    @staticmethod
    def _cart_fingerprint(cart: Cart) -> str:
        """Canonical local key only; it is never sent to Mercado Pago."""

        return json.dumps(
            {
                "currency": str(cart.currency),
                "items": sorted(
                    (
                        str(line.product_id),
                        int(line.quantity),
                        str(line.price),
                    )
                    for line in cart.items
                ),
            },
            separators=(",", ":"),
            sort_keys=True,
        )


class MPRetail(MockRetail):
    """The retail backend with Mercado Pago's versioned Checkout Pro handoff."""

    def __init__(
        self,
        *args: Any,
        checkout: MercadoPagoCheckout | None = None,
        attempt_store: InMemoryCheckoutAttemptStore | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self._checkout = checkout
        self._attempt_store = attempt_store or InMemoryCheckoutAttemptStore()

    def _checkout_adapter(self) -> MercadoPagoCheckout:
        """Create the library adapter lazily so ordinary retail tests need no token."""

        if self._checkout is None:
            access_token = os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "").strip()
            if not access_token:
                raise RuntimeError(
                    "MERCADOPAGO_ACCESS_TOKEN is required before Mercado Pago checkout can start."
                )
            self._checkout = MercadoPagoCheckout(
                sdk=mercadopago.SDK(access_token),
                catalog=self,
            )
        return self._checkout

    async def checkout_handoff(
        self, session: ShoppingSessionContext, cart: Cart
    ) -> list[CheckoutHandoff]:
        """Return the hosted handoff without exposing a payment URL to the model."""

        _attempt_id, attempt = self._attempt_store.get_or_create(session, cart)
        if (
            attempt.reconcile_after is not None
            and attempt.reconcile_after <= datetime.now(timezone.utc)
        ):
            raise CheckoutOutcomeUnknown(
                external_reference=attempt.external_reference,
                idempotency_key=attempt.idempotency_key,
                reason="reconciliation_required",
                order_id=attempt.order_id,
            )
        if attempt.handoffs is not None:
            return list(attempt.handoffs)
        if attempt.outcome_unknown:
            # Do not release a fallback checkout while an earlier Order may be payable.
            raise CheckoutOutcomeUnknown(
                external_reference=attempt.external_reference,
                idempotency_key=attempt.idempotency_key,
                reason="reconciliation_required",
                order_id=attempt.order_id,
            )

        # Start retention immediately before the first operation that can create an Order.
        attempt.reconcile_after = datetime.now(timezone.utc) + _RECONCILIATION_DEADLINE
        try:
            handoffs = await self._checkout_adapter().checkout_handoff(
                session,
                cart,
                external_reference=attempt.external_reference,
                idempotency_key=attempt.idempotency_key,
            )
        except CheckoutOutcomeUnknown as error:
            attempt.outcome_unknown = True
            attempt.order_id = error.order_id
            raise

        if handoffs:
            attempt.handoffs = tuple(handoffs)
        else:
            # The library proved that no payable Order remains for this attempt.
            self._attempt_store.finish(attempt.external_reference)
        return handoffs

    async def finish_checkout_attempt(self, external_reference: str) -> None:
        """Call after a verified terminal Order webhook updates seller state.

        In a production backend, perform this durable update in the same
        transaction as the seller order's state transition.
        """

        self._attempt_store.finish(external_reference)
