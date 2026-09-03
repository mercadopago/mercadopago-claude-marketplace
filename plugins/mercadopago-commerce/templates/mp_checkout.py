"""Mercado Pago hosted Orders handoff for Anthropic commerce-agents.

Checkout Pro via Orders API creates an ``online`` order in ``manual`` processing
mode and returns a ``checkout_url``. The commerce-agents executor adds that URL
to the checkout card after Claude's tool call, so neither the URL nor Mercado
Pago credentials reach the model.

This module is deliberately only a transport adapter. The storefront backend
remains responsible for shopper identity, catalog prices, currency and order
ownership.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import uuid
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

import httpx

API_BASE = "https://api.mercadopago.com"
ORDERS_PATH = "/v1/orders"
REQUEST_TIMEOUT_S = 15.0

_ORDER_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
_CHECKOUT_HOSTS = frozenset(
    {
        "mercadopago.com",
        "mercadopago.com.ar",
        "mercadopago.com.br",
        "mercadopago.com.co",
        "mercadopago.com.mx",
        "mercadopago.com.pe",
        "mercadopago.com.uy",
        "mercadopago.cl",
    }
)


class MPConfigError(RuntimeError):
    """Raised when configuration or an upstream Orders response is unusable."""


@dataclass(frozen=True)
class MPConfig:
    """Server-owned Mercado Pago configuration."""

    access_token: str = field(repr=False)
    currency_id: str = "CLP"
    decimals: int = 0
    price_multiplier: Decimal = Decimal("1")
    back_url: str | None = None
    statement_descriptor: str = "DEMO STORE"
    allowed_user_type: str = "account_only"
    checkout_label: str = "Pagar con Mercado Pago"

    @classmethod
    def from_env(cls) -> "MPConfig":
        token = os.environ.get("MP_ACCESS_TOKEN", "").strip()
        if not token:
            raise MPConfigError(
                "MP_ACCESS_TOKEN is not set. Add it to the environment before starting the API."
            )
        try:
            multiplier = Decimal(os.environ.get("MP_PRICE_MULTIPLIER", "1").strip())
            decimals = int(os.environ.get("MP_CURRENCY_DECIMALS", "0"))
        except (InvalidOperation, ValueError) as error:
            raise MPConfigError(
                "Currency decimals and price multiplier must be numeric."
            ) from error
        if decimals not in (0, 2):
            raise MPConfigError("MP_CURRENCY_DECIMALS must be 0 or 2.")
        if not multiplier.is_finite() or multiplier <= 0:
            raise MPConfigError("MP_PRICE_MULTIPLIER must be greater than zero.")

        currency_id = os.environ.get("MP_CURRENCY_ID", "CLP").strip().upper()
        if not re.fullmatch(r"[A-Z]{3}", currency_id):
            raise MPConfigError("MP_CURRENCY_ID must be a three-letter currency code.")

        return cls(
            access_token=token,
            currency_id=currency_id,
            decimals=decimals,
            price_multiplier=multiplier,
            back_url=(os.environ.get("MP_BACK_URL", "").strip() or None),
            statement_descriptor=os.environ.get(
                "MP_STATEMENT_DESCRIPTOR", "DEMO STORE"
            ).strip(),
            allowed_user_type=os.environ.get(
                "MP_ALLOWED_USER_TYPE", "account_only"
            ).strip(),
            checkout_label=os.environ.get(
                "MP_CHECKOUT_LABEL", "Pagar con Mercado Pago"
            ).strip(),
        )


@dataclass(frozen=True)
class MPPayer:
    """Buyer data resolved by the trusted storefront backend."""

    email: str
    first_name: str | None = None
    last_name: str | None = None
    identification_type: str | None = None
    identification_number: str | None = field(default=None, repr=False)

    @classmethod
    def from_env(cls) -> "MPPayer":
        """Load the demo buyer. Production must use its authenticated profile."""

        email = os.environ.get("MP_PAYER_EMAIL", "").strip()
        if not email:
            raise MPConfigError(
                "MP_PAYER_EMAIL is not set. Use the test buyer email for this demo."
            )
        if "@" not in email or any(character.isspace() for character in email):
            raise MPConfigError("MP_PAYER_EMAIL must contain a valid buyer email.")
        identification_type = os.environ.get(
            "MP_PAYER_IDENTIFICATION_TYPE", ""
        ).strip()
        identification_number = os.environ.get(
            "MP_PAYER_IDENTIFICATION_NUMBER", ""
        ).strip()
        if bool(identification_type) != bool(identification_number):
            raise MPConfigError(
                "Set both MP_PAYER_IDENTIFICATION_TYPE and "
                "MP_PAYER_IDENTIFICATION_NUMBER, or leave both empty."
            )
        return cls(
            email=email,
            first_name=(os.environ.get("MP_PAYER_FIRST_NAME", "").strip() or None),
            last_name=(os.environ.get("MP_PAYER_LAST_NAME", "").strip() or None),
            identification_type=identification_type or None,
            identification_number=identification_number or None,
        )

    def as_payload(self) -> dict[str, Any]:
        payer: dict[str, Any] = {"email": self.email}
        if self.first_name:
            payer["first_name"] = self.first_name
        if self.last_name:
            payer["last_name"] = self.last_name
        if self.identification_type and self.identification_number:
            payer["identification"] = {
                "type": self.identification_type,
                "number": self.identification_number,
            }
        return payer


@dataclass(frozen=True)
class MPCheckoutOrder:
    """Small, safe projection of the create-order response."""

    order_id: str
    external_reference: str
    status: str
    status_detail: str | None
    currency: str | None
    checkout_url: str = field(repr=False)


@dataclass(frozen=True)
class MPOrderSnapshot:
    """Safe projection used for local reconciliation."""

    order_id: str
    external_reference: str | None
    status: str | None
    status_detail: str | None
    total_amount: str | None
    total_paid_amount: str | None
    currency: str | None
    last_updated_date: str | None

    @property
    def payment_accredited(self) -> bool:
        return self.status == "processed" and self.status_detail == "accredited"


def format_amount(value: Decimal, decimals: int) -> str:
    """Render an API amount without binary floating-point drift."""

    quantum = Decimal("1") if decimals == 0 else Decimal("0.01")
    return format(value.quantize(quantum, rounding=ROUND_HALF_UP), f".{decimals}f")


def checkout_reference(session_id: str, items: list[dict[str, Any]]) -> str:
    """Return a stable, non-sensitive reference for this cart and shopping session."""

    canonical_items = sorted(
        items,
        key=lambda item: (
            str(item.get("external_code", "")),
            str(item.get("title", "")),
        ),
    )
    canonical = json.dumps(
        canonical_items,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    cart_digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    session_digest = hashlib.sha256(session_id.encode("utf-8")).hexdigest()
    return f"ca-{session_digest[:12]}-{cart_digest[:16]}"


def idempotency_key_for(body: dict[str, Any]) -> str:
    """Return one UUID for an exact logical create-order request.

    An identical retry gets the same key. Changing the cart, buyer, return URL or
    any other body field gets a different key, which prevents accidentally
    reusing one Mercado Pago idempotency key with two different payloads.
    """

    canonical = json.dumps(
        body,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"mercadopago-commerce:{digest}"))


def _headers(cfg: MPConfig, *, idempotency_key: str | None = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {cfg.access_token}",
        "Content-Type": "application/json",
    }
    if idempotency_key:
        headers["X-Idempotency-Key"] = idempotency_key
    return headers


def _result_url(base_url: str, result: str) -> str:
    parsed = urlsplit(base_url)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise MPConfigError("MP_BACK_URL must be an HTTP(S) URL without credentials.")
    if parsed.scheme == "http" and parsed.hostname not in {
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
    }:
        raise MPConfigError("MP_BACK_URL must use HTTPS outside local development.")
    query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key != "mp"
    ]
    query.append(("mp", result))
    return urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment)
    )


def _order_body(
    cfg: MPConfig,
    *,
    payer: MPPayer,
    items: list[dict[str, Any]],
    external_reference: str,
) -> dict[str, Any]:
    if not items:
        raise MPConfigError("Refusing to create an order for an empty cart.")

    canonical_items: list[dict[str, Any]] = []
    total = Decimal("0")
    for source in items:
        title = str(source.get("title") or "").strip()
        quantity = source.get("quantity")
        if not title:
            raise MPConfigError("Every Order item must have a title.")
        if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity < 1:
            raise MPConfigError("Every Order item quantity must be a positive integer.")
        try:
            raw_unit_price = Decimal(str(source["unit_price"]))
        except (InvalidOperation, KeyError, TypeError, ValueError) as error:
            raise MPConfigError("Every Order item must have a valid unit price.") from error
        if not raw_unit_price.is_finite() or raw_unit_price <= 0:
            raise MPConfigError("Every Order item unit price must be finite and positive.")

        rendered_unit_price = format_amount(raw_unit_price, cfg.decimals)
        normalized_unit_price = Decimal(rendered_unit_price)
        if normalized_unit_price <= 0:
            raise MPConfigError("An Order item price rounded to zero in this currency.")
        line_total = normalized_unit_price * quantity
        canonical: dict[str, Any] = {
            "title": title,
            "quantity": quantity,
            "unit_price": rendered_unit_price,
            "total_amount": format_amount(line_total, cfg.decimals),
        }
        for optional in (
            "external_code",
            "description",
            "unit_measure",
        ):
            value = source.get(optional)
            if value is not None and str(value).strip():
                canonical[optional] = str(value).strip()
        picture_url = str(source.get("picture_url") or "").strip()
        if picture_url:
            picture = urlsplit(picture_url)
            if (
                picture.scheme == "https"
                and picture.hostname
                and picture.username is None
                and picture.password is None
            ):
                canonical["picture_url"] = picture_url
        canonical_items.append(canonical)
        total += line_total
    if total <= 0:
        raise MPConfigError("The Order total must be greater than zero.")
    canonical_items.sort(
        key=lambda item: (
            str(item.get("external_code", "")),
            str(item.get("title", "")),
        )
    )

    online: dict[str, Any] = {"allowed_user_type": cfg.allowed_user_type}
    if cfg.back_url:
        online.update(
            {
                "success_url": _result_url(cfg.back_url, "success"),
                "failure_url": _result_url(cfg.back_url, "failure"),
                "pending_url": _result_url(cfg.back_url, "pending"),
            }
        )

    return {
        "type": "online",
        "total_amount": format_amount(total, cfg.decimals),
        "external_reference": external_reference,
        "processing_mode": "manual",
        "payer": payer.as_payload(),
        "config": {
            "statement_descriptor": cfg.statement_descriptor,
            "online": online,
        },
        "items": canonical_items,
    }


def _checkout_url(value: Any) -> str:
    checkout_url = str(value or "").strip()
    parsed = urlsplit(checkout_url)
    hostname = (parsed.hostname or "").lower()
    trusted_host = any(
        hostname == allowed or hostname.endswith(f".{allowed}")
        for allowed in _CHECKOUT_HOSTS
    )
    if (
        parsed.scheme != "https"
        or not trusted_host
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise MPConfigError(
            "Order created but no trusted Mercado Pago checkout_url was returned."
        )
    return checkout_url


async def _post_order(
    client: httpx.AsyncClient,
    cfg: MPConfig,
    *,
    body: dict[str, Any],
    idempotency_key: str,
) -> MPCheckoutOrder:
    response = await client.post(
        f"{API_BASE}{ORDERS_PATH}",
        headers=_headers(cfg, idempotency_key=idempotency_key),
        json=body,
    )
    if response.status_code != 201:
        correlation = response.headers.get("x-request-id", "unavailable")
        raise MPConfigError(
            "Mercado Pago rejected the checkout order "
            f"(status={response.status_code}, correlation={correlation})."
        )
    try:
        payload = response.json()
    except ValueError as error:
        raise MPConfigError("Mercado Pago returned a non-JSON Orders response.") from error
    if not isinstance(payload, dict):
        raise MPConfigError("Mercado Pago returned an invalid Orders response shape.")

    order_id = str(payload.get("id") or "").strip()
    if not order_id or not _ORDER_ID_PATTERN.fullmatch(order_id):
        raise MPConfigError("Order created but no valid id was returned.")
    returned_reference = str(payload.get("external_reference") or "").strip()
    expected_reference = str(body["external_reference"])
    if returned_reference != expected_reference:
        raise MPConfigError("The Orders response did not match the requested external_reference.")
    currency = str(payload.get("currency") or "").strip().upper() or None
    if currency != cfg.currency_id:
        raise MPConfigError("The Orders response currency did not match the collector site.")
    status = str(payload.get("status") or "").strip()
    if status != "created":
        raise MPConfigError("The hosted checkout Order was not created successfully.")
    try:
        returned_total = Decimal(str(payload["total_amount"]))
        requested_total = Decimal(str(body["total_amount"]))
    except (InvalidOperation, KeyError, TypeError, ValueError) as error:
        raise MPConfigError("The Orders response did not contain a valid total amount.") from error
    if not returned_total.is_finite() or returned_total != requested_total:
        raise MPConfigError("The Orders response total did not match the requested total.")

    # Project the response deliberately. In particular, ``client_token`` is
    # never retained, logged, returned to Claude, or placed in CheckoutHandoff.
    return MPCheckoutOrder(
        order_id=order_id,
        external_reference=returned_reference,
        status=status,
        status_detail=(
            str(payload["status_detail"])
            if payload.get("status_detail") is not None
            else None
        ),
        currency=currency,
        checkout_url=_checkout_url(payload.get("checkout_url")),
    )


async def create_checkout_order(
    cfg: MPConfig,
    *,
    payer: MPPayer,
    items: list[dict[str, Any]],
    external_reference: str,
    client: httpx.AsyncClient | None = None,
) -> MPCheckoutOrder:
    """Create a hosted checkout order and return a safe response projection."""

    body = _order_body(
        cfg,
        payer=payer,
        items=items,
        external_reference=external_reference,
    )
    idempotency_key = idempotency_key_for(body)
    try:
        if client is not None:
            return await _post_order(
                client,
                cfg,
                body=body,
                idempotency_key=idempotency_key,
            )
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as owned_client:
            return await _post_order(
                owned_client,
                cfg,
                body=body,
                idempotency_key=idempotency_key,
            )
    except httpx.RequestError as error:
        raise MPConfigError("Could not reach Mercado Pago Orders API.") from error


async def _get_order(
    client: httpx.AsyncClient,
    cfg: MPConfig,
    order_id: str,
) -> MPOrderSnapshot:
    response = await client.get(
        f"{API_BASE}{ORDERS_PATH}/{quote(order_id, safe='')}",
        headers=_headers(cfg),
    )
    if response.status_code >= 400:
        correlation = response.headers.get("x-request-id", "unavailable")
        raise MPConfigError(
            "Mercado Pago order lookup failed "
            f"(status={response.status_code}, correlation={correlation})."
        )
    try:
        payload = response.json()
    except ValueError as error:
        raise MPConfigError("Mercado Pago returned a non-JSON order lookup response.") from error
    if not isinstance(payload, dict):
        raise MPConfigError("Mercado Pago returned an invalid order lookup shape.")

    returned_id = str(payload.get("id") or order_id)
    if returned_id != order_id:
        raise MPConfigError("The Orders response did not match the requested order id.")
    currency = str(payload.get("currency") or "").strip().upper() or None
    if currency is not None and currency != cfg.currency_id:
        raise MPConfigError("The Order currency did not match the collector site.")

    return MPOrderSnapshot(
        order_id=returned_id,
        external_reference=payload.get("external_reference"),
        status=payload.get("status"),
        status_detail=payload.get("status_detail"),
        total_amount=(
            str(payload.get("total_amount"))
            if payload.get("total_amount") is not None
            else None
        ),
        total_paid_amount=(
            str(payload.get("total_paid_amount"))
            if payload.get("total_paid_amount") is not None
            else None
        ),
        currency=currency,
        last_updated_date=payload.get("last_updated_date"),
    )


async def get_checkout_order(
    cfg: MPConfig,
    order_id: str,
    *,
    client: httpx.AsyncClient | None = None,
) -> MPOrderSnapshot:
    """Look up an order and return only fields safe for reconciliation."""

    normalized_id = order_id.strip()
    if not normalized_id or not _ORDER_ID_PATTERN.fullmatch(normalized_id):
        raise MPConfigError("A valid Mercado Pago order id is required.")
    if client is not None:
        try:
            return await _get_order(client, cfg, normalized_id)
        except httpx.RequestError as error:
            raise MPConfigError("Could not reach Mercado Pago Orders API.") from error
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as owned_client:
            return await _get_order(owned_client, cfg, normalized_id)
    except httpx.RequestError as error:
        raise MPConfigError("Could not reach Mercado Pago Orders API.") from error
