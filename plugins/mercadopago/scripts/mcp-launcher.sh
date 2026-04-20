#!/usr/bin/env bash
#
# MCP Launcher — reads the Access Token from the OS keychain
# and launches the Mercado Pago MCP remote server.
#
# This script is called by Claude Code via .mcp.json.
# The token never appears in any file Claude Code can read.
#

set -euo pipefail

KEYCHAIN_SERVICE="mercadopago-claude-plugin"
KEYCHAIN_ACCOUNT="access_token"
MCP_URL="https://mcp.mercadopago.com/mcp"

# ---------- read token from keychain ----------
read_token() {
  case "$(uname -s)" in
    Darwin)
      security find-generic-password \
        -a "$KEYCHAIN_ACCOUNT" \
        -s "$KEYCHAIN_SERVICE" \
        -w 2>/dev/null
      ;;
    Linux)
      secret-tool lookup \
        service "$KEYCHAIN_SERVICE" \
        account "$KEYCHAIN_ACCOUNT" 2>/dev/null
      ;;
    *)
      echo "Unsupported OS" >&2
      exit 1
      ;;
  esac
}

TOKEN=$(read_token) || {
  echo "No Mercado Pago Access Token found in keychain." >&2
  echo "Run the setup script first:" >&2
  echo "  bash \$(dirname \"\$0\")/setup.sh" >&2
  exit 1
}

if [[ -z "$TOKEN" ]]; then
  echo "Access Token is empty. Run setup.sh to configure it." >&2
  exit 1
fi

# ---------- launch MCP server ----------
exec npx -y mcp-remote "$MCP_URL" --header "Authorization:Bearer ${TOKEN}"
