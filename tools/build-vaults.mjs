#!/usr/bin/env node
// Encrypts each mission's reward (flag, next page, note) with its answer and
// writes the result into the page's <script id="vault"> block.
//
// Answers live in .private/answers.json, which is gitignored so they never
// reach the public repo. See README.md for the file format.
//
//   node tools/build-vaults.mjs            # build all vaults
//   node tools/build-vaults.mjs --check    # also verify every answer opens its vault

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sealVault, openVault } from "../assets/vault.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const answersPath = path.join(root, ".private", "answers.json");
const check = process.argv.includes("--check");

const VAULT_RE = /(<script type="application\/json" id="vault">)([\s\S]*?)(<\/script>)/;

let config;
try {
  config = JSON.parse(await readFile(answersPath, "utf8"));
} catch (err) {
  console.error(`Cannot read ${answersPath}: ${err.message}`);
  process.exit(1);
}

let failed = false;
for (const [page, { answers, reward, raw = false }] of Object.entries(config.pages)) {
  const file = path.join(root, page);
  const html = await readFile(file, "utf8");
  if (!VAULT_RE.test(html)) {
    console.error(`✗ ${page}: no <script id="vault"> block`);
    failed = true;
    continue;
  }
  const vault = await sealVault(answers, reward, { raw });
  await writeFile(file, html.replace(VAULT_RE, (_, open, __, close) => `${open}${JSON.stringify(vault)}${close}`));

  if (check) {
    for (const fields of answers) {
      const opened = await openVault(vault, fields);
      if (!opened || opened.flag !== reward.flag) {
        console.error(`✗ ${page}: answer ${JSON.stringify(fields)} does not open the vault`);
        failed = true;
      }
    }
    const wrong = await openVault(vault, answers[0].map(() => "definitely wrong"));
    if (wrong) {
      console.error(`✗ ${page}: a wrong answer opened the vault`);
      failed = true;
    }
  }
  console.log(`✓ ${page}`);
}

process.exit(failed ? 1 : 0);
