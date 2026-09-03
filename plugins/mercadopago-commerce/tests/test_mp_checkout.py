from __future__ import annotations

import asyncio
import importlib.util
import sys
import types
import unittest
import uuid
from dataclasses import asdict
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch


# The public repository gate intentionally installs no application dependencies.
# Supply the tiny import surface the template needs; all HTTP is represented by
# deterministic fakes below.
httpx = types.ModuleType("httpx")


class RequestError(Exception):
    pass


class AsyncClient:  # pragma: no cover - a live client must never run in these tests
    def __init__(self, *args: object, **kwargs: object) -> None:
        raise AssertionError("unit tests must inject FakeClient")


httpx.RequestError = RequestError
httpx.AsyncClient = AsyncClient
sys.modules["httpx"] = httpx

MODULE_PATH = Path(__file__).resolve().parents[1] / "templates" / "mp_checkout.py"
SPEC = importlib.util.spec_from_file_location("mp_checkout_under_test", MODULE_PATH)
assert SPEC and SPEC.loader
mp = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mp
SPEC.loader.exec_module(mp)


class FakeResponse:
    def __init__(
        self,
        payload: dict[str, object],
        *,
        status_code: int = 200,
        headers: dict[str, str] | None = None,
    ) -> None:
        self._payload = payload
        self.status_code = status_code
        self.headers = headers or {}

    def json(self) -> dict[str, object]:
        return self._payload


class FakeClient:
    def __init__(
        self,
        *,
        post_response: FakeResponse | None = None,
        get_response: FakeResponse | None = None,
        error: Exception | None = None,
    ) -> None:
        self.post_response = post_response
        self.get_response = get_response
        self.error = error
        self.posts: list[tuple[str, dict[str, object]]] = []
        self.gets: list[tuple[str, dict[str, str]]] = []

    async def post(
        self,
        url: str,
        *,
        headers: dict[str, str],
        json: dict[str, object],
    ) -> FakeResponse:
        self.posts.append((url, {"headers": headers, "json": json}))
        if self.error:
            raise self.error
        assert self.post_response is not None
        return self.post_response

    async def get(self, url: str, *, headers: dict[str, str]) -> FakeResponse:
        self.gets.append((url, headers))
        if self.error:
            raise self.error
        assert self.get_response is not None
        return self.get_response


def config(**overrides: object) -> object:
    values: dict[str, object] = {
        "access_token": "TEST-secret",
        "currency_id": "CLP",
        "decimals": 0,
        "back_url": "http://localhost:3000/store?from=agent#checkout",
    }
    values.update(overrides)
    return mp.MPConfig(**values)


def payer(email: str = "buyer@example.com") -> object:
    return mp.MPPayer(email=email, first_name="Test", last_name="Buyer")


def items(
    unit_price: str = "500", quantity: int | float = 2
) -> list[dict[str, object]]:
    return [
        {
            "external_code": "ITEM-001",
            "title": "Test item",
            "quantity": quantity,
            "unit_price": unit_price,
            "unit_measure": "unit",
            "total_amount": str(Decimal(unit_price) * Decimal(str(quantity))),
        }
    ]


class CheckoutTemplateTests(unittest.TestCase):
    def test_builds_orders_contract_and_preserves_return_url_fragment(self) -> None:
        body = mp._order_body(
            config(),
            payer=payer(),
            items=items(),
            external_reference="merchant-attempt-1",
        )

        self.assertEqual(body["type"], "online")
        self.assertEqual(body["processing_mode"], "manual")
        self.assertEqual(body["total_amount"], "1000")
        self.assertEqual(body["payer"]["email"], "buyer@example.com")
        self.assertEqual(
            body["config"]["online"]["success_url"],
            "http://localhost:3000/store?from=agent&mp=success#checkout",
        )

    def test_canonicalizes_item_totals_and_rejects_invalid_lines(self) -> None:
        tampered = items()
        tampered[0]["total_amount"] = "1"
        tampered[0]["picture_url"] = "/products/local-only.webp"
        body = mp._order_body(
            config(),
            payer=payer(),
            items=tampered,
            external_reference="merchant-attempt-1",
        )
        self.assertEqual(body["items"][0]["total_amount"], "1000")
        self.assertEqual(body["total_amount"], "1000")
        self.assertNotIn("picture_url", body["items"][0])

        for invalid in (
            items(unit_price="-1"),
            items(unit_price="0.49"),
            items(quantity=0),
            items(quantity=1.9),
            items(unit_price="NaN"),
        ):
            with self.subTest(invalid=invalid):
                with self.assertRaises(mp.MPConfigError):
                    mp._order_body(
                        config(),
                        payer=payer(),
                        items=invalid,
                        external_reference="merchant-attempt-1",
                    )

    def test_amount_formatting_handles_zero_and_two_decimal_currencies(self) -> None:
        self.assertEqual(mp.format_amount(Decimal("1000.49"), 0), "1000")
        self.assertEqual(mp.format_amount(Decimal("12.345"), 2), "12.35")

    def test_configuration_rejects_non_finite_multiplier(self) -> None:
        for multiplier in ("NaN", "Infinity", "-1"):
            with self.subTest(multiplier=multiplier):
                with patch.dict(
                    "os.environ",
                    {
                        "MP_ACCESS_TOKEN": "TEST-secret",
                        "MP_CURRENCY_ID": "CLP",
                        "MP_PRICE_MULTIPLIER": multiplier,
                    },
                    clear=True,
                ):
                    with self.assertRaises(mp.MPConfigError):
                        mp.MPConfig.from_env()

    def test_return_url_requires_https_outside_loopback(self) -> None:
        with self.assertRaisesRegex(mp.MPConfigError, "HTTPS"):
            mp._result_url("http://merchant.example/return", "success")

    def test_reference_is_stable_within_session_and_cart(self) -> None:
        first = mp.checkout_reference("session-a", items())
        second = mp.checkout_reference("session-a", items())
        changed = mp.checkout_reference("session-b", items())

        self.assertEqual(first, second)
        self.assertNotEqual(first, changed)
        self.assertTrue(first.startswith("ca-"))

    def test_idempotency_key_covers_the_entire_request_body(self) -> None:
        original = mp._order_body(
            config(),
            payer=payer(),
            items=items(),
            external_reference="merchant-attempt-1",
        )
        changed = mp._order_body(
            config(),
            payer=payer("another@example.com"),
            items=items(),
            external_reference="merchant-attempt-1",
        )

        original_key = mp.idempotency_key_for(original)
        self.assertEqual(original_key, mp.idempotency_key_for(original))
        self.assertNotEqual(original_key, mp.idempotency_key_for(changed))
        self.assertEqual(str(uuid.UUID(original_key)), original_key)

    def test_cart_order_does_not_change_the_idempotency_key(self) -> None:
        second = items(unit_price="250", quantity=1)[0]
        second["external_code"] = "ITEM-002"
        second["title"] = "Second item"
        forward = mp._order_body(
            config(),
            payer=payer(),
            items=[items()[0], second],
            external_reference="merchant-attempt-1",
        )
        reverse = mp._order_body(
            config(),
            payer=payer(),
            items=[second, items()[0]],
            external_reference="merchant-attempt-1",
        )
        self.assertEqual(mp.idempotency_key_for(forward), mp.idempotency_key_for(reverse))

    def test_create_order_projects_safe_fields_and_uses_checkout_url(self) -> None:
        response = FakeResponse(
            {
                "id": "ORDTST01ABC",
                "status": "created",
                "external_reference": "merchant-attempt-1",
                "currency": "CLP",
                "total_amount": "1000",
                "checkout_url": (
                    "https://www.mercadopago.cl/checkout/v1/redirect?order_id=ORDTST01ABC"
                ),
                "client_token": "must-not-leave-the-adapter",
                "user_id": "123",
            },
            status_code=201,
        )
        client = FakeClient(post_response=response)

        order = asyncio.run(
            mp.create_checkout_order(
                config(),
                payer=payer(),
                items=items(),
                external_reference="merchant-attempt-1",
                client=client,
            )
        )

        self.assertEqual(order.order_id, "ORDTST01ABC")
        self.assertEqual(order.status, "created")
        self.assertIsNone(order.status_detail)
        self.assertEqual(order.currency, "CLP")
        self.assertNotIn("client_token", asdict(order))
        url, request = client.posts[0]
        self.assertEqual(url, "https://api.mercadopago.com/v1/orders")
        self.assertEqual(request["json"]["total_amount"], "1000")
        self.assertEqual(
            str(uuid.UUID(request["headers"]["X-Idempotency-Key"])),
            request["headers"]["X-Idempotency-Key"],
        )
        self.assertEqual(request["headers"]["Authorization"], "Bearer TEST-secret")

    def test_create_order_rejects_untrusted_handoff_and_currency(self) -> None:
        bad_url = FakeResponse(
            {
                "id": "ORD1",
                "external_reference": "ref",
                "currency": "CLP",
                "status": "created",
                "total_amount": "1000",
                "checkout_url": "https://evil.example/phish",
            },
            status_code=201,
        )
        with self.assertRaisesRegex(mp.MPConfigError, "trusted Mercado Pago"):
            asyncio.run(
                mp.create_checkout_order(
                    config(),
                    payer=payer(),
                    items=items(),
                    external_reference="ref",
                    client=FakeClient(post_response=bad_url),
                )
            )

    def test_create_order_requires_201_and_reconciliation_fields(self) -> None:
        base = {
            "id": "ORD1",
            "external_reference": "ref",
            "currency": "CLP",
            "status": "created",
            "total_amount": "1000",
            "checkout_url": "https://www.mercadopago.cl/checkout/v1/redirect",
        }
        cases = (
            (FakeResponse(base, status_code=200), "status=200"),
            (FakeResponse(base | {"external_reference": ""}, status_code=201), "reference"),
            (FakeResponse(base | {"currency": ""}, status_code=201), "currency"),
            (FakeResponse(base | {"status": "failed"}, status_code=201), "status"),
            (FakeResponse(base | {"total_amount": "999"}, status_code=201), "amount"),
        )
        for response, expected in cases:
            with self.subTest(expected=expected):
                with self.assertRaises(mp.MPConfigError):
                    asyncio.run(
                        mp.create_checkout_order(
                            config(),
                            payer=payer(),
                            items=items(),
                            external_reference="ref",
                            client=FakeClient(post_response=response),
                        )
                    )

        wrong_currency = FakeResponse(
            {
                "id": "ORD2",
                "external_reference": "ref",
                "currency": "BRL",
                "status": "created",
                "total_amount": "1000",
                "checkout_url": "https://www.mercadopago.cl/checkout/v1/redirect",
            },
            status_code=201,
        )
        with self.assertRaisesRegex(mp.MPConfigError, "currency"):
            asyncio.run(
                mp.create_checkout_order(
                    config(),
                    payer=payer(),
                    items=items(),
                    external_reference="ref",
                    client=FakeClient(post_response=wrong_currency),
                )
            )

    def test_lookup_requires_exact_order_id_and_only_accredited_is_paid(self) -> None:
        response = FakeResponse(
            {
                "id": "ORDTST01ABC",
                "external_reference": "merchant-attempt-1",
                "status": "processed",
                "status_detail": "accredited",
                "total_amount": "1000",
                "total_paid_amount": "1000",
                "currency": "CLP",
                "last_updated_date": "2026-09-03T18:30:08Z",
                "payer": {"email": "must-not-be-projected@example.com"},
            }
        )
        client = FakeClient(get_response=response)

        snapshot = asyncio.run(
            mp.get_checkout_order(config(), "ORDTST01ABC", client=client)
        )

        self.assertTrue(snapshot.payment_accredited)
        self.assertNotIn("payer", asdict(snapshot))
        self.assertEqual(
            client.gets[0][0],
            "https://api.mercadopago.com/v1/orders/ORDTST01ABC",
        )
        refunded = mp.MPOrderSnapshot(
            order_id="ORDTST01ABC",
            external_reference="ref",
            status="processed",
            status_detail="refunded",
            total_amount="1000",
            total_paid_amount="0",
            currency="CLP",
            last_updated_date=None,
        )
        self.assertFalse(refunded.payment_accredited)

    def test_transport_errors_are_sanitized(self) -> None:
        with self.assertRaisesRegex(mp.MPConfigError, "Could not reach"):
            asyncio.run(
                mp.create_checkout_order(
                    config(),
                    payer=payer(),
                    items=items(),
                    external_reference="ref",
                    client=FakeClient(error=RequestError("secret diagnostic")),
                )
            )
        with self.assertRaisesRegex(mp.MPConfigError, "Could not reach"):
            asyncio.run(
                mp.get_checkout_order(
                    config(),
                    "ORD1",
                    client=FakeClient(error=RequestError("secret diagnostic")),
                )
            )


if __name__ == "__main__":
    unittest.main()
