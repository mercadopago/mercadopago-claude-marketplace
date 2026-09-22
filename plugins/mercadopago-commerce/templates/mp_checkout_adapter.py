"""Framework-neutral Checkout Pro composition for a Python commerce agent.

Adapt the host's existing cart, catalog, durable attempt repository, and
post-model handoff boundary to these small contracts. This module deliberately
does not import or subclass an agent framework.

The seller backend owns attempt persistence. There is intentionally no
in-memory implementation here: losing an idempotency key or an unknown outcome
on process restart can expose a second payable checkout.
"""

from __future__ import annotations

import hashlib
import inspect
import json
import os
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Awaitable, Callable, Protocol

import mercadopago
from mercadopago_commerce_agents import (
    CheckoutHandoff,
    CheckoutOutcomeUnknown,
    MercadoPagoCheckout,
)


Money = Decimal | int | str
CatalogLookup = Callable[[Any, str], Any | Awaitable[Any]]
CatalogRecordMapper = Callable[[Any], "TrustedProduct"]
CartMapper = Callable[[Any], "CheckoutCart"]


@dataclass(frozen=True)
class CheckoutLine:
    """One confirmed host-cart line.

    ``price`` is retained only so the library can detect a catalog price change
    and request reconfirmation. It never becomes authoritative for the charge.
    """

    product_id: str
    quantity: int
    price: Money


@dataclass(frozen=True)
class CheckoutCart:
    """The minimal cart shape consumed structurally by the checkout library."""

    items: tuple[CheckoutLine, ...]
    currency: str


@dataclass(frozen=True)
class TrustedProduct:
    """A product reread from the seller-owned authoritative catalog."""

    title: str
    price: Money
    currency: str
    in_stock: bool


@dataclass(frozen=True)
class CheckoutAttempt:
    """The durable state loaded before any operation can create an Order."""

    external_reference: str
    idempotency_key: str
    outcome_unknown: bool = False
    order_id: str | None = None
    handoffs: tuple[CheckoutHandoff, ...] | None = None


class CheckoutAttemptStore(Protocol):
    """Host persistence contract; implementations must survive restarts."""

    async def get_or_create(
        self,
        *,
        attempt_scope: str,
        cart_fingerprint: str,
    ) -> CheckoutAttempt:
        """Atomically load or create one attempt and its identifier pair."""

    async def mark_outcome_unknown(
        self,
        *,
        external_reference: str,
        reason: str,
        order_id: str | None,
    ) -> None:
        """Durably block fallback until this operation is reconciled."""

    async def save_handoffs(
        self,
        *,
        external_reference: str,
        handoffs: tuple[CheckoutHandoff, ...],
    ) -> None:
        """Persist a successful handoff so a retry never creates a new path."""


class TrustedCatalogAdapter:
    """Compose an existing catalog lookup with an explicit record mapper."""

    def __init__(
        self,
        *,
        lookup: CatalogLookup,
        map_record: CatalogRecordMapper,
    ) -> None:
        self._lookup = lookup
        self._map_record = map_record

    async def get_product_details(
        self,
        session: Any,
        product_id: str,
    ) -> TrustedProduct | None:
        """Resolve a product independently from cart or model-authored data."""

        record = self._lookup(session, product_id)
        if inspect.isawaitable(record):
            record = await record
        if record is None:
            return None
        return self._map_record(record)


class MercadoPagoAgentCheckout:
    """Compose a host cart and attempt store with the versioned library."""

    def __init__(
        self,
        *,
        checkout: MercadoPagoCheckout,
        attempts: CheckoutAttemptStore,
        map_cart: CartMapper,
    ) -> None:
        self._checkout = checkout
        self._attempts = attempts
        self._map_cart = map_cart

    async def checkout_handoff(
        self,
        session: Any,
        host_cart: Any,
        *,
        attempt_scope: str,
    ) -> list[CheckoutHandoff]:
        """Create a hosted handoff after host authentication and confirmation.

        ``attempt_scope`` is an opaque server-owned purchase-attempt key. It
        must not be shopper PII or an unauthenticated session identifier.
        """

        if not isinstance(attempt_scope, str) or not attempt_scope.strip():
            raise ValueError("attempt_scope must be a non-empty opaque host key")

        cart = self._map_cart(host_cart)
        attempt = await self._attempts.get_or_create(
            attempt_scope=attempt_scope,
            cart_fingerprint=cart_fingerprint(cart),
        )
        if attempt.outcome_unknown:
            raise CheckoutOutcomeUnknown(
                external_reference=attempt.external_reference,
                idempotency_key=attempt.idempotency_key,
                reason="reconciliation_required",
                order_id=attempt.order_id,
            )
        if attempt.handoffs is not None:
            return list(attempt.handoffs)

        try:
            handoffs = await self._checkout.checkout_handoff(
                session,
                cart,
                external_reference=attempt.external_reference,
                idempotency_key=attempt.idempotency_key,
            )
        except CheckoutOutcomeUnknown as error:
            await self._attempts.mark_outcome_unknown(
                external_reference=attempt.external_reference,
                reason=error.reason,
                order_id=error.order_id,
            )
            raise
        if handoffs:
            await self._attempts.save_handoffs(
                external_reference=attempt.external_reference,
                handoffs=tuple(handoffs),
            )
        return handoffs


def build_checkout_adapter(
    *,
    catalog: TrustedCatalogAdapter,
    attempts: CheckoutAttemptStore,
    map_cart: CartMapper,
) -> MercadoPagoAgentCheckout:
    """Build the adapter in the host's server-side composition root."""

    access_token = os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "").strip()
    if not access_token:
        raise RuntimeError(
            "MERCADOPAGO_ACCESS_TOKEN is required before checkout can start"
        )
    checkout = MercadoPagoCheckout(
        sdk=mercadopago.SDK(access_token),
        catalog=catalog,
    )
    return MercadoPagoAgentCheckout(
        checkout=checkout,
        attempts=attempts,
        map_cart=map_cart,
    )


def cart_fingerprint(cart: CheckoutCart) -> str:
    """Hash the confirmed cart snapshot used to scope one durable attempt."""

    canonical = json.dumps(
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
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
