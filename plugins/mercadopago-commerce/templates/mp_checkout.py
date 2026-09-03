"""Mercado Pago Checkout Pro handoff for the commerce-agents blueprint.

Checkout Pro is a hosted redirect checkout: we create a preference server-side and
hand the buyer its ``init_point``. No card data ever reaches this process, and the
URL is injected into the checkout card by the executor after the model's tool call,
so the model never sees it either.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from typing import Any

import httpx

API_BASE = "https://api.mercadopago.com"
# Checkout Pro uses the Preferences API, which has no /v1 segment.
PREFERENCES_PATH = "/checkout/preferences"
PAYMENT_SEARCH_PATH = "/v1/payments/search"

REQUEST_TIMEOUT_S = 15.0


class MPConfigError(RuntimeError):
    """Raised when the Mercado Pago configuration is missing or unusable."""


@dataclass(frozen=True)
class MPConfig:
    """Everything Mercado Pago needs, resolved once from the environment.

    The access token lives here and nowhere else: never in source, never in a log
    line, never in anything the model can read.
    """

    access_token: str
    currency_id: str
    decimals: int
    price_multiplier: float
    back_url: str | None
    statement_descriptor: str

    @classmethod
    def from_env(cls) -> "MPConfig":
        token = os.environ.get("MP_ACCESS_TOKEN", "").strip()
        if not token:
            raise MPConfigError(
                "MP_ACCESS_TOKEN is not set. Add it to the environment before starting the API."
            )
        return cls(
            access_token=token,
            currency_id=os.environ.get("MP_CURRENCY_ID", "BRL").strip().upper(),
            decimals=int(os.environ.get("MP_CURRENCY_DECIMALS", "2")),
            price_multiplier=float(os.environ.get("MP_PRICE_MULTIPLIER", "1")),
            back_url=(os.environ.get("MP_BACK_URL", "").strip() or None),
            statement_descriptor=os.environ.get("MP_STATEMENT_DESCRIPTOR", "DEMO STORE").strip(),
        )

    @property
    def auto_return_allowed(self) -> bool:
        """Mercado Pago rejects ``auto_return`` when the return URL is local.

        Without it the buyer simply clicks Mercado Pago's own "back to site" button,
        which is why a local demo needs no tunnel.
        """
        url = (self.back_url or "").lower()
        if not url.startswith("https://"):
            return False
        local_hosts = ("https://localhost", "https://127.0.0.1", "https://0.0.0.0")
        return not url.startswith(local_hosts)


def _headers(cfg: MPConfig, *, idempotency_key: str | None = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {cfg.access_token}",
        "Content-Type": "application/json",
    }
    if idempotency_key:
        # Without this, a retried request creates a second charge.
        headers["X-Idempotency-Key"] = idempotency_key
    return headers


def _preference_body(cfg: MPConfig, items: list[dict[str, Any]], external_reference: str) -> dict:
    body: dict[str, Any] = {
        "items": items,
        "external_reference": external_reference,
        "statement_descriptor": cfg.statement_descriptor,
    }
    if cfg.back_url:
        body["back_urls"] = {
            "success": f"{cfg.back_url}/?mp=success",
            "failure": f"{cfg.back_url}/?mp=failure",
            "pending": f"{cfg.back_url}/?mp=pending",
        }
        if cfg.auto_return_allowed:
            body["auto_return"] = "approved"
    return body


async def create_preference(
    cfg: MPConfig,
    *,
    items: list[dict[str, Any]],
    external_reference: str,
) -> str:
    """Create a Checkout Pro preference and return its ``init_point``.

    ``items`` must already be priced from the catalog — see ``mp_retail.reprice``.
    Never build them from the cart the model produced.
    """
    if not items:
        raise MPConfigError("Refusing to create a preference for an empty cart.")

    body = _preference_body(cfg, items, external_reference)
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
        response = await client.post(
            f"{API_BASE}{PREFERENCES_PATH}",
            headers=_headers(cfg, idempotency_key=str(uuid.uuid4())),
            json=body,
        )
    if response.status_code >= 400:
        # Mercado Pago's message is safe to surface; the token is never echoed back.
        raise MPConfigError(
            f"Mercado Pago rejected the preference ({response.status_code}): {response.text[:300]}"
        )

    payload = response.json()
    # Always init_point. sandbox_init_point is dead — there is no sandbox host.
    init_point = payload.get("init_point")
    if not init_point:
        raise MPConfigError("Preference created but no init_point was returned.")
    return init_point


async def find_payment(cfg: MPConfig, external_reference: str) -> dict[str, Any] | None:
    """Look the payment up by our own reference, server-side.

    This is the only thing that decides whether an order was paid. Redirect query
    params are attacker-controlled and are never trusted.
    """
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
        response = await client.get(
            f"{API_BASE}{PAYMENT_SEARCH_PATH}",
            headers=_headers(cfg),
            params={"external_reference": external_reference},
        )
    if response.status_code >= 400:
        raise MPConfigError(
            f"Payment lookup failed ({response.status_code}): {response.text[:300]}"
        )
    results = response.json().get("results") or []
    return results[0] if results else None
