from __future__ import annotations

import asyncio
import importlib.util
import sys
import types
import unittest
from dataclasses import dataclass, replace
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SDK:
    def __init__(self, access_token: str) -> None:
        self.access_token = access_token


mercadopago = types.ModuleType("mercadopago")
mercadopago.SDK = SDK
sys.modules["mercadopago"] = mercadopago


@dataclass
class CheckoutHandoff:
    url: str
    label: str | None = None
    seller: str | None = None


class CheckoutOutcomeUnknown(RuntimeError):
    def __init__(
        self,
        *,
        external_reference: str,
        idempotency_key: str,
        reason: str,
        order_id: str | None = None,
    ) -> None:
        self.external_reference = external_reference
        self.idempotency_key = idempotency_key
        self.reason = reason
        self.order_id = order_id
        super().__init__("Checkout outcome is unknown")


class MercadoPagoCheckout:
    def __init__(self, *, sdk: SDK, catalog: object) -> None:
        self.sdk = sdk
        self.catalog = catalog


checkout_package = types.ModuleType("mercadopago_commerce_agents")
checkout_package.CheckoutHandoff = CheckoutHandoff
checkout_package.CheckoutOutcomeUnknown = CheckoutOutcomeUnknown
checkout_package.MercadoPagoCheckout = MercadoPagoCheckout
sys.modules["mercadopago_commerce_agents"] = checkout_package


def load(name: str, path: Path) -> types.ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


adapter = load(
    "mp_checkout_adapter_under_test",
    ROOT / "templates" / "mp_checkout_adapter.py",
)


class RecordingCheckout:
    def __init__(self, result: list[CheckoutHandoff] | Exception) -> None:
        self.result = result
        self.calls: list[dict[str, object]] = []

    async def checkout_handoff(
        self,
        session: object,
        cart: object,
        **kwargs: object,
    ) -> list[CheckoutHandoff]:
        self.calls.append({"session": session, "cart": cart, **kwargs})
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


class RecordingAttemptStore:
    def __init__(self, attempt: object) -> None:
        self.attempt = attempt
        self.lookups: list[dict[str, str]] = []
        self.unknown: list[dict[str, str | None]] = []
        self.saved_handoffs: list[tuple[CheckoutHandoff, ...]] = []

    async def get_or_create(
        self,
        *,
        attempt_scope: str,
        cart_fingerprint: str,
    ) -> object:
        self.lookups.append(
            {
                "attempt_scope": attempt_scope,
                "cart_fingerprint": cart_fingerprint,
            }
        )
        return self.attempt

    async def mark_outcome_unknown(
        self,
        *,
        external_reference: str,
        reason: str,
        order_id: str | None,
    ) -> None:
        self.unknown.append(
            {
                "external_reference": external_reference,
                "reason": reason,
                "order_id": order_id,
            }
        )
        self.attempt = replace(
            self.attempt,
            outcome_unknown=True,
            order_id=order_id,
        )

    async def save_handoffs(
        self,
        *,
        external_reference: str,
        handoffs: tuple[CheckoutHandoff, ...],
    ) -> None:
        self.asserted_external_reference = external_reference
        self.saved_handoffs.append(handoffs)
        self.attempt = replace(self.attempt, handoffs=handoffs)


def map_cart(host_cart: dict[str, object]) -> object:
    return adapter.CheckoutCart(
        items=tuple(
            adapter.CheckoutLine(
                product_id=str(line["sku"]),
                quantity=int(line["units"]),
                price=str(line["confirmed_price"]),
            )
            for line in host_cart["lines"]
        ),
        currency=str(host_cart["currency"]),
    )


class GenericAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.attempt = adapter.CheckoutAttempt(
            external_reference="seller-order-123",
            idempotency_key="checkout-attempt-123",
        )
        self.store = RecordingAttemptStore(self.attempt)
        self.host_cart = {
            "currency": "CLP",
            "lines": [
                {"sku": "SKU-1", "units": 2, "confirmed_price": "500.00"}
            ],
        }

    def test_composes_an_arbitrary_host_cart_without_framework_inheritance(self) -> None:
        expected = [CheckoutHandoff(url="https://www.mercadopago.cl/checkout")]
        checkout = RecordingCheckout(expected)
        integration = adapter.MercadoPagoAgentCheckout(
            checkout=checkout,
            attempts=self.store,
            map_cart=map_cart,
        )

        handoffs = asyncio.run(
            integration.checkout_handoff(
                object(),
                self.host_cart,
                attempt_scope="opaque-purchase-1",
            )
        )
        retry = asyncio.run(
            integration.checkout_handoff(
                object(),
                self.host_cart,
                attempt_scope="opaque-purchase-1",
            )
        )

        self.assertEqual(handoffs, expected)
        self.assertEqual(retry, expected)
        self.assertEqual(len(checkout.calls), 1)
        call = checkout.calls[0]
        self.assertEqual(call["external_reference"], "seller-order-123")
        self.assertEqual(call["idempotency_key"], "checkout-attempt-123")
        normalized = call["cart"]
        self.assertEqual(normalized.items[0].product_id, "SKU-1")
        self.assertEqual(normalized.items[0].price, "500.00")
        self.assertEqual(normalized.currency, "CLP")
        self.assertEqual(self.store.lookups[0]["attempt_scope"], "opaque-purchase-1")
        self.assertEqual(len(self.store.lookups[0]["cart_fingerprint"]), 64)
        self.assertEqual(self.store.asserted_external_reference, "seller-order-123")
        self.assertEqual(self.store.saved_handoffs, [tuple(expected)])

    def test_catalog_is_looked_up_independently_and_mapped_explicitly(self) -> None:
        seen: list[tuple[object, str]] = []

        async def lookup(session: object, product_id: str) -> dict[str, object]:
            seen.append((session, product_id))
            return {
                "name": "Authoritative title",
                "amount": "700.00",
                "money": "CLP",
                "available": True,
            }

        catalog = adapter.TrustedCatalogAdapter(
            lookup=lookup,
            map_record=lambda record: adapter.TrustedProduct(
                title=str(record["name"]),
                price=str(record["amount"]),
                currency=str(record["money"]),
                in_stock=bool(record["available"]),
            ),
        )
        session = object()

        product = asyncio.run(catalog.get_product_details(session, "SKU-1"))

        self.assertEqual(seen, [(session, "SKU-1")])
        self.assertEqual(product.price, "700.00")
        self.assertNotEqual(product.price, self.host_cart["lines"][0]["confirmed_price"])

    def test_unknown_outcome_is_persisted_and_blocks_the_next_call(self) -> None:
        failure = CheckoutOutcomeUnknown(
            external_reference="seller-order-123",
            idempotency_key="checkout-attempt-123",
            reason="resource_locked",
            order_id="ORD-1",
        )
        checkout = RecordingCheckout(failure)
        integration = adapter.MercadoPagoAgentCheckout(
            checkout=checkout,
            attempts=self.store,
            map_cart=map_cart,
        )

        with self.assertRaises(CheckoutOutcomeUnknown):
            asyncio.run(
                integration.checkout_handoff(
                    object(),
                    self.host_cart,
                    attempt_scope="opaque-purchase-1",
                )
            )
        with self.assertRaises(CheckoutOutcomeUnknown) as raised:
            asyncio.run(
                integration.checkout_handoff(
                    object(),
                    self.host_cart,
                    attempt_scope="opaque-purchase-1",
                )
            )

        self.assertEqual(self.store.unknown[0]["reason"], "resource_locked")
        self.assertEqual(raised.exception.reason, "reconciliation_required")
        self.assertEqual(raised.exception.order_id, "ORD-1")
        self.assertEqual(len(checkout.calls), 1)

    def test_empty_attempt_scope_fails_before_persistence_or_checkout(self) -> None:
        checkout = RecordingCheckout([])
        integration = adapter.MercadoPagoAgentCheckout(
            checkout=checkout,
            attempts=self.store,
            map_cart=map_cart,
        )

        with self.assertRaisesRegex(ValueError, "attempt_scope"):
            asyncio.run(
                integration.checkout_handoff(
                    object(),
                    self.host_cart,
                    attempt_scope=" ",
                )
            )

        self.assertEqual(self.store.lookups, [])
        self.assertEqual(checkout.calls, [])

    def test_template_has_no_agent_framework_or_retail_dependency(self) -> None:
        source = (ROOT / "templates" / "mp_checkout_adapter.py").read_text()

        self.assertNotIn("shopping_agent", source)
        self.assertNotIn("MockRetail", source)
        self.assertNotIn("examples/retail", source)


if __name__ == "__main__":
    unittest.main()
