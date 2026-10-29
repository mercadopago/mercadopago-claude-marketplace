#!/usr/bin/env node
// SPDX-FileCopyrightText: (c) 2026 Mercado Pago (MercadoLibre S.R.L.)
// SPDX-License-Identifier: Apache-2.0
//
// Runs on every UserPromptSubmit. Silent unless the plugin version changed.

import fs from "node:fs";
import path from "node:path";

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
const pluginData = process.env.CLAUDE_PLUGIN_DATA;
if (!pluginRoot || !pluginData) process.exit(0);

try {
  const versionFile = path.join(pluginRoot, ".claude-plugin", "plugin.json");
  const pkg = JSON.parse(fs.readFileSync(versionFile, "utf8"));
  const current = typeof pkg.version === "string" ? pkg.version.trim() : "";
  if (!current) process.exit(0);

  fs.mkdirSync(pluginData, { recursive: true });
  const seenFile = path.join(pluginData, "seen-version");
  let seen = "";
  try {
    seen = fs.readFileSync(seenFile, "utf8").trim();
  } catch {
    seen = "";
  }

  if (current !== seen) {
    fs.writeFileSync(seenFile, `${current}\n`, "utf8");
    if (seen) {
      console.log(
        `[Mercado Pago plugin updated: v${seen} -> v${current}. Run /mp-connect to verify your connection.]`
      );
    }
  }
} catch {
  // Never block user prompts on version check errors.
}
