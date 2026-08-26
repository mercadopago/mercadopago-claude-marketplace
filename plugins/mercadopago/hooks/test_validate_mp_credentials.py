#!/usr/bin/env python3
"""Regression tests for the credential leak prevention hook."""

import json
import subprocess
import tempfile
import unittest
from pathlib import Path


HOOK = Path(__file__).with_name("validate_mp_credentials.py")


def fake_access_token() -> str:
    return "-".join(
        ("TEST", "123456789012", "123456", "abc1234567890123456789012345678a", "987654321")
    )


class CredentialHookTests(unittest.TestCase):
    def run_hook(self, payload, *, project=True, enabled=True):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            if project:
                (root / "package.json").write_text(
                    json.dumps({"dependencies": {"mercadopago": "^2.0.0"}}),
                    encoding="utf-8",
                )
            if not enabled:
                settings = root / ".claude"
                settings.mkdir()
                (settings / "mercadopago.local.md").write_text(
                    "---\nenabled: false\n---\n", encoding="utf-8"
                )

            raw = payload if isinstance(payload, str) else json.dumps(payload)
            return subprocess.run(
                ["python3", str(HOOK)],
                input=raw,
                text=True,
                cwd=str(root),
                capture_output=True,
                check=False,
            )

    def test_blocks_token_write_even_before_project_is_detected(self):
        result = self.run_hook(
            {
                "tool_name": "Write",
                "tool_input": {"file_path": "app.js", "content": fake_access_token()},
            },
            project=False,
        )
        self.assertEqual(result.returncode, 2)

    def test_allows_environment_variable_reference(self):
        result = self.run_hook(
            {
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "app.js",
                    "content": "const token = process.env.MP_ACCESS_TOKEN",
                },
            }
        )
        self.assertEqual(result.returncode, 0)

    def test_blocks_direct_variant_env_read(self):
        result = self.run_hook(
            {"tool_name": "Read", "tool_input": {"file_path": ".env.staging"}}
        )
        self.assertEqual(result.returncode, 2)

    def test_allows_example_env_read(self):
        result = self.run_hook(
            {"tool_name": "Read", "tool_input": {"file_path": ".env.example"}}
        )
        self.assertEqual(result.returncode, 0)

    def test_blocks_bash_env_read_in_mp_project(self):
        result = self.run_hook(
            {"tool_name": "Bash", "tool_input": {"command": "cat .env.staging"}}
        )
        self.assertEqual(result.returncode, 2)

    def test_does_not_change_bash_env_behavior_in_unrelated_project(self):
        result = self.run_hook(
            {"tool_name": "Bash", "tool_input": {"command": "cat .env"}},
            project=False,
        )
        self.assertEqual(result.returncode, 0)

    def test_allows_secret_write_to_local_env(self):
        result = self.run_hook(
            {
                "tool_name": "Write",
                "tool_input": {"file_path": ".env.local", "content": fake_access_token()},
            }
        )
        self.assertEqual(result.returncode, 0)

    def test_explicit_disable_bypasses_hook(self):
        result = self.run_hook(
            {
                "tool_name": "Write",
                "tool_input": {"file_path": "app.js", "content": fake_access_token()},
            },
            enabled=False,
        )
        self.assertEqual(result.returncode, 0)

    def test_invalid_json_fails_closed(self):
        result = self.run_hook("not-json")
        self.assertEqual(result.returncode, 2)


if __name__ == "__main__":
    unittest.main()
