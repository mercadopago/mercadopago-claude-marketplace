#!/usr/bin/env bash
#
# SPDX-FileCopyrightText: (c) 2026 Mercado Pago (MercadoLibre S.R.L.)
# SPDX-License-Identifier: Apache-2.0
#
# Mercado Pago MCP Server — Setup Script
#
# Stores the Access Token securely in the OS keychain.
# Claude Code has no tools to read the keychain, so the token stays private.
# Only the MCP server process reads it at startup time.
#
# Usage:
#   bash setup.sh              # Interactive — prompts for token
#   bash setup.sh --remove     # Remove stored token from keychain
#   bash setup.sh --status     # Check if a token is stored
#

set -euo pipefail

KEYCHAIN_SERVICE="mercadopago-claude-plugin"
KEYCHAIN_ACCOUNT="access_token"
MCP_URL="https://mcp.mercadopago.com/mcp"

# ---------- colors ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ---------- OS detection ----------
detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)  echo "linux" ;;
    *)      echo "unsupported" ;;
  esac
}

OS=$(detect_os)

# ---------- keychain operations ----------
store_token() {
  local token="$1"
  case "$OS" in
    macos)
      # -U updates if exists, creates if not
      security add-generic-password \
        -a "$KEYCHAIN_ACCOUNT" \
        -s "$KEYCHAIN_SERVICE" \
        -w "$token" \
        -U 2>/dev/null
      ;;
    linux)
      if command -v secret-tool &>/dev/null; then
        echo -n "$token" | secret-tool store \
          --label="Mercado Pago Claude Plugin" \
          service "$KEYCHAIN_SERVICE" \
          account "$KEYCHAIN_ACCOUNT"
      else
        echo -e "${RED}Error: 'secret-tool' not found. Install libsecret-tools:${NC}"
        echo "  sudo apt install libsecret-tools"
        exit 1
      fi
      ;;
    *)
      echo -e "${RED}Error: Unsupported OS. Only macOS and Linux are supported.${NC}"
      exit 1
      ;;
  esac
}

read_token() {
  case "$OS" in
    macos)
      security find-generic-password \
        -a "$KEYCHAIN_ACCOUNT" \
        -s "$KEYCHAIN_SERVICE" \
        -w 2>/dev/null
      ;;
    linux)
      secret-tool lookup \
        service "$KEYCHAIN_SERVICE" \
        account "$KEYCHAIN_ACCOUNT" 2>/dev/null
      ;;
  esac
}

remove_token() {
  case "$OS" in
    macos)
      security delete-generic-password \
        -a "$KEYCHAIN_ACCOUNT" \
        -s "$KEYCHAIN_SERVICE" 2>/dev/null
      ;;
    linux)
      secret-tool clear \
        service "$KEYCHAIN_SERVICE" \
        account "$KEYCHAIN_ACCOUNT" 2>/dev/null
      ;;
  esac
}

has_token() {
  read_token &>/dev/null
}

# ---------- validation ----------
validate_token_format() {
  local token="$1"
  # MP tokens: APP_USR-... (current) or TEST-... (legacy, kept for back-compat)
  if [[ "$token" =~ ^(APP_USR|TEST)- ]]; then
    return 0
  fi
  return 1
}

test_connection() {
  local token="$1"
  echo -e "${BLUE}Testing connection to Mercado Pago MCP server...${NC}"

  # Quick HTTP check — the MCP endpoint should respond
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    --max-time 10 \
    "$MCP_URL" 2>/dev/null || echo "000")

  if [[ "$http_code" == "000" ]]; then
    echo -e "${YELLOW}Warning: Could not reach $MCP_URL (network/timeout).${NC}"
    echo -e "${YELLOW}The token was stored. MCP will retry when Claude Code starts.${NC}"
    return 1
  elif [[ "$http_code" =~ ^(200|404|405|426) ]]; then
    # 200=ok, 404/405=endpoint exists but method differs, 426=upgrade required (SSE/WS)
    echo -e "${GREEN}Connection successful (HTTP $http_code).${NC}"
    return 0
  elif [[ "$http_code" == "401" || "$http_code" == "403" ]]; then
    echo -e "${RED}Authentication failed (HTTP $http_code). Check your Access Token.${NC}"
    return 1
  else
    echo -e "${YELLOW}Unexpected response (HTTP $http_code). Token stored anyway.${NC}"
    return 1
  fi
}

# ---------- commands ----------
cmd_status() {
  if has_token; then
    echo -e "${GREEN}A Mercado Pago Access Token is stored in your keychain.${NC}"
    echo -e "  Service: $KEYCHAIN_SERVICE"
    echo -e "  Account: $KEYCHAIN_ACCOUNT"
  else
    echo -e "${YELLOW}No Access Token found in keychain.${NC}"
    echo -e "  Run: bash setup.sh"
  fi
}

cmd_remove() {
  if has_token; then
    remove_token
    echo -e "${GREEN}Access Token removed from keychain.${NC}"
  else
    echo -e "${YELLOW}No Access Token found in keychain. Nothing to remove.${NC}"
  fi
}

cmd_setup() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  Mercado Pago MCP Server — Setup                ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
  echo ""

  if has_token; then
    echo -e "${YELLOW}An Access Token is already stored in your keychain.${NC}"
    echo ""
    read -r -p "Replace it with a new one? [y/N] " confirm
    if [[ ! "$confirm" =~ ^[yY]$ ]]; then
      echo "Setup cancelled."
      exit 0
    fi
    echo ""
  fi

  echo "Enter your Mercado Pago Access Token."
  echo -e "Get one at: ${BLUE}https://www.mercadopago.com.ar/developers/panel/app${NC}"
  echo ""

  # Read token with hidden input
  read -r -s -p "Access Token: " token
  echo ""

  if [[ -z "$token" ]]; then
    echo -e "${RED}Error: Token cannot be empty.${NC}"
    exit 1
  fi

  # Validate format
  if ! validate_token_format "$token"; then
    echo -e "${YELLOW}Warning: Token doesn't match expected format (APP_USR-*).${NC}"
    read -r -p "Store anyway? [y/N] " confirm
    if [[ ! "$confirm" =~ ^[yY]$ ]]; then
      echo "Setup cancelled."
      exit 0
    fi
  fi

  # Store in keychain
  echo -e "${BLUE}Storing token in OS keychain...${NC}"
  store_token "$token"
  echo -e "${GREEN}Token stored securely.${NC}"
  echo ""

  # Test connection
  test_connection "$token" || true

  echo ""
  echo -e "${GREEN}Setup complete.${NC} Restart Claude Code to activate the MCP server."
  echo ""
  echo "Commands:"
  echo "  bash setup.sh --status    Check stored token"
  echo "  bash setup.sh --remove    Remove stored token"
  echo "  bash setup.sh             Replace token"
}

# ---------- main ----------
case "${1:-}" in
  --status) cmd_status ;;
  --remove) cmd_remove ;;
  --help|-h)
    echo "Usage: bash setup.sh [--status|--remove|--help]"
    echo ""
    echo "  (no args)    Store or replace your Mercado Pago Access Token"
    echo "  --status     Check if a token is stored"
    echo "  --remove     Remove stored token from keychain"
    ;;
  *) cmd_setup ;;
esac
