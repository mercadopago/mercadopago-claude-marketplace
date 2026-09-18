from __future__ import annotations

import asyncio
import importlib.util
import sys
import types
import unittest
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_NAME = "commerce_template_under_test"

package = types.ModuleType(PACKAGE_NAME)
package.__path__ = []
sys.modules[PACKAGE_NAME] = package


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


commerce_checkout = types.ModuleType("mercadopago_commerce_agents")
commerce_checkout.CheckoutHandoff = CheckoutHandoff
commerce_checkout.CheckoutOutcomeUnknown = CheckoutOutcomeUnknown
commerce_checkout.MercadoPagoCheckout = MercadoPagoCheckout
sys.modules["mercadopago_commerce_agents"] = commerce_checkout


@dataclass
class Cart:
    items: list[object]
    currency: str = "CLP"


@dataclass
class ShoppingSessionContext:
    session_id: str
    user_id: str = "buyer-1"


shopping_agent = types.ModuleType("shopping_agent")
shopping_agent.Cart = Cart
shopping_agent.ShoppingSessionContext = ShoppingSessionContext
sys.modules["shopping_agent"] = shopping_agent


class MockRetail:
    def __init__(self, *args: object, **kwargs: object) -> None:
        del args, kwargs


mock_retail = types.ModuleType(f"{PACKAGE_NAME}.mock_retail")
mock_retail.MockRetail = MockRetail
sys.modules[mock_retail.__name__] = mock_retail


def load(name: str, path: Path) -> types.ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


retail = load(f"{PACKAGE_NAME}.mp_retail", ROOT / "templates" / "mp_retail.py")


class RecordingCheckout:
    def __init__(self, result: list[CheckoutHandoff] | Exception) -> None:
        self.result = result
        self.calls: list[dict[str, object]] = []

    async def checkout_handoff(self, session: object, cart: object, **kwargs: object):
        self.calls.append({"session": session, "cart": cart, **kwargs})
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


class RetailAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.session = ShoppingSessionContext(session_id="session-1")
        self.cart = Cart(
            items=[types.SimpleNamespace(product_id="ITEM-001", quantity=2, price=500)]
        )

    def test_construction_does_not_require_a_payment_environment(self) -> None:
        backend = retail.MPRetail()

        self.assertIsNone(backend._checkout)

    def test_attempt_identifiers_are_stable_for_one_confirmed_cart(self) -> None:
        store = retail.InMemoryCheckoutAttemptStore()

        _, first = store.get_or_create(self.session, self.cart)
        _, second = store.get_or_create(self.session, self.cart)

        self.assertEqual(first.idempotency_key, second.idempotency_key)
        self.assertEqual(first.external_reference, second.external_reference)
        self.assertNotIn(self.session.session_id, first.idempotency_key)
        self.assertNotIn(self.session.session_id, first.external_reference)

    def test_delegates_to_library_with_the_persisted_attempt(self) -> None:
        expected = [CheckoutHandoff(url="https://www.mercadopago.cl/checkout/v1/redirect")]
        checkout = RecordingCheckout(expected)
        backend = retail.MPRetail(checkout=checkout)

        handoffs = asyncio.run(backend.checkout_handoff(self.session, self.cart))
        retry = asyncio.run(backend.checkout_handoff(self.session, self.cart))

        self.assertEqual(handoffs, expected)
        self.assertEqual(retry, expected)
        self.assertEqual(len(checkout.calls), 1)
        call = checkout.calls[0]
        self.assertTrue(str(call["idempotency_key"]).startswith("checkout-"))
        self.assertTrue(str(call["external_reference"]).startswith("seller-order-"))
        self.assertNotIn("recovering", call)

    def test_unknown_outcome_is_persisted_and_blocks_the_next_handoff(self) -> None:
        failure = CheckoutOutcomeUnknown(
            external_reference="seller-order-test",
            idempotency_key="checkout-test",
            reason="resource_locked",
            order_id="ORD123",
        )
        checkout = RecordingCheckout(failure)
        backend = retail.MPRetail(checkout=checkout)

        with self.assertRaises(CheckoutOutcomeUnknown):
            asyncio.run(backend.checkout_handoff(self.session, self.cart))
        with self.assertRaises(CheckoutOutcomeUnknown) as raised:
            asyncio.run(backend.checkout_handoff(self.session, self.cart))

        self.assertEqual(raised.exception.reason, "reconciliation_required")
        self.assertEqual(raised.exception.order_id, "ORD123")
        self.assertEqual(len(checkout.calls), 1)

    def test_definitive_refusal_closes_the_demo_attempt(self) -> None:
        checkout = RecordingCheckout([])
        backend = retail.MPRetail(checkout=checkout)

        self.assertEqual(asyncio.run(backend.checkout_handoff(self.session, self.cart)), [])
        self.assertEqual(asyncio.run(backend.checkout_handoff(self.session, self.cart)), [])

        self.assertEqual(len(checkout.calls), 2)
        self.assertNotEqual(
            checkout.calls[0]["idempotency_key"],
            checkout.calls[1]["idempotency_key"],
        )


if __name__ == "__main__":
    unittest.main()
