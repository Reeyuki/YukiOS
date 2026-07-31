import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function extractGameIds() {
  const content = readFileSync(resolve(ROOT, "src/games/gamesList.js"), "utf-8");
  const ids = new Set();
  const keyRegex = /^\s\s(\w+):\s*\{/gm;
  let match;
  while ((match = keyRegex.exec(content)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

function extractAppIds() {
  const content = readFileSync(resolve(ROOT, "src/registry/AppManifest.js"), "utf-8");
  const ids = new Set();
  const svcRegex = /serviceKey:\s*"([^"]+)"/g;
  let match;
  while ((match = svcRegex.exec(content)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

function extractInstalledAppIds() {
  const content = readFileSync(resolve(ROOT, "src/games/gameDescriptions.js"), "utf-8");
  const ids = new Set();
  const keyRegex = /^\s{2}(\w+):\s*\{/gm;
  let match;
  while ((match = keyRegex.exec(content)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

const ids = new Set([...extractGameIds(), ...extractAppIds(), ...extractInstalledAppIds()]);
const list = [...ids].map((id) => id.toLowerCase()).sort();

const outDir = resolve(ROOT, "public");
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "app-list.json"), JSON.stringify(list, null, 2) + "\n");
console.log(`Generated app-list.json with ${list.length} app ids.`);
