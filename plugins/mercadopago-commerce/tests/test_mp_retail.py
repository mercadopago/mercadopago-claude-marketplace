from __future__ import annotations

import asyncio
import importlib.util
import sys
import types
import unittest
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_NAME = "commerce_template_under_test"

package = types.ModuleType(PACKAGE_NAME)
package.__path__ = []
sys.modules[PACKAGE_NAME] = package

if "httpx" not in sys.modules:
    httpx = types.ModuleType("httpx")

    class RequestError(Exception):
        pass

    class AsyncClient:
        pass

    httpx.RequestError = RequestError
    httpx.AsyncClient = AsyncClient
    sys.modules["httpx"] = httpx


@dataclass
class Cart:
    items: list[object]
    currency: str = "USD"


@dataclass
class CheckoutHandoff:
    url: str
    label: str | None = None


@dataclass
class ShoppingSessionContext:
    session_id: str
    user_id: str


shopping_agent = types.ModuleType("shopping_agent")
shopping_agent.Cart = Cart
shopping_agent.CheckoutHandoff = CheckoutHandoff
shopping_agent.ShoppingSessionContext = ShoppingSessionContext
sys.modules["shopping_agent"] = shopping_agent


class MockRetail:
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.products: dict[str, object] = {}

    def product(self, product_id: str) -> object | None:
        return self.products.get(product_id)


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


checkout = load(
    f"{PACKAGE_NAME}.mp_checkout",
    ROOT / "templates" / "mp_checkout.py",
)
retail = load(
    f"{PACKAGE_NAME}.mp_retail",
    ROOT / "templates" / "mp_retail.py",
)


class RetailAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = checkout.MPConfig(
            access_token="TEST-secret",
            currency_id="CLP",
            decimals=0,
            price_multiplier=Decimal("1000"),
        )
        self.payer = checkout.MPPayer(email="buyer@example.com")

    def test_import_and_construction_do_not_require_payment_environment(self) -> None:
        with patch.dict("os.environ", {}, clear=True):
            backend = retail.MPRetail()
        self.assertIsNone(backend._mp)
        self.assertIsNone(backend._payer)

    def test_reprices_from_catalog_and_omits_relative_product_image(self) -> None:
        backend = retail.MPRetail(mp_config=self.config, mp_payer=self.payer)
        backend.products["ITEM-001"] = SimpleNamespace(
            product_id="ITEM-001",
            title="Catalog title",
            short_description="Trusted description",
            price=1.5,
            image_url="/products/local-only.webp",
            in_stock=True,
        )
        cart = Cart(
            items=[SimpleNamespace(product_id="ITEM-001", quantity=2, price=0.01)]
        )

        result = backend._reprice(cart, self.config)

        self.assertEqual(result[0]["unit_price"], "1500")
        self.assertEqual(result[0]["quantity"], 2)
        self.assertNotIn("picture_url", result[0])

    def test_checkout_returns_only_the_hosted_handoff(self) -> None:
        backend = retail.MPRetail(mp_config=self.config, mp_payer=self.payer)
        backend.products["ITEM-001"] = SimpleNamespace(
            product_id="ITEM-001",
            title="Catalog title",
            short_description=None,
            price=1,
            image_url=None,
            in_stock=True,
        )
        cart = Cart(items=[SimpleNamespace(product_id="ITEM-001", quantity=1)])
        captured: dict[str, object] = {}

        async def fake_create(cfg: object, **kwargs: object) -> object:
            captured["cfg"] = cfg
            captured.update(kwargs)
            return checkout.MPCheckoutOrder(
                order_id="ORD1",
                external_reference=str(kwargs["external_reference"]),
                status="created",
                status_detail="created",
                currency="CLP",
                checkout_url="https://www.mercadopago.cl/checkout/v1/redirect",
            )

        with patch.object(retail, "create_checkout_order", fake_create):
            handoffs = asyncio.run(
                backend.checkout_handoff(
                    ShoppingSessionContext(session_id="session-1", user_id="buyer-1"),
                    cart,
                )
            )

        self.assertEqual(
            handoffs,
            [
                CheckoutHandoff(
                    url="https://www.mercadopago.cl/checkout/v1/redirect",
                    label="Pagar con Mercado Pago",
                )
            ],
        )
        self.assertEqual(captured["items"][0]["unit_price"], "1000")
        self.assertNotIn("idempotency_key", captured)


if __name__ == "__main__":
    unittest.main()
