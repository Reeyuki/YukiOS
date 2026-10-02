import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const ROOT = resolve(here, "../..");
export const MANIFEST_PATH = resolve(ROOT, "src/registry/AppManifest.js");

const STRING_FIELDS = ["serviceKey", "type", "title", "icon", "launchType", "category", "description", "targetUrl"];

/** Pulls literal string fields out of one manifest entry's source text. */
function extractFields(text) {
  const entry = {};
  for (const field of STRING_FIELDS) {
    const match = text.match(new RegExp(`(?<![\\w.])${field}:\\s*(?:"([^"]*)"|'([^']*)'|\`([^\`]*)\`)`));
    if (match) entry[field] = match[1] ?? match[2] ?? match[3];
  }
  return entry;
}

/**
 * Text-based fallback parser. Walks APP_MANIFESTS while tracking strings and comments, so braces or
 * quotes inside values don't break entry boundaries. Only literal string fields can be read this way.
 */
export function parseManifestSource(source) {
  const marker = source.indexOf("APP_MANIFESTS = [");
  if (marker === -1) throw new Error("Could not find APP_MANIFESTS in AppManifest.js");

  const entries = [];
  let depth = 0;
  let current = "";
  let inEntry = false;
  let quote = null;

  for (let i = source.indexOf("[", marker) + 1; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (quote) {
      if (inEntry) current += ch;
      if (ch === "\\") {
        if (inEntry) current += next ?? "";
        i++;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      if (end === -1) break;
      i = end;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) break;
      i = end + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      if (inEntry) current += ch;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) {
        current = "";
        inEntry = true;
      }
      depth++;
    }
    if (inEntry) current += ch;
    if (ch === "}") {
      depth--;
      if (depth === 0 && inEntry) {
        entries.push(extractFields(current));
        inEntry = false;
      }
    } else if (ch === "]" && depth === 0) {
      break;
    }
  }

  return entries;
}

/**
 * Loads the app manifests. Prefers importing the real module (exact values); falls back to parsing
 * the source text if the module can't run in plain Node (e.g. it touches `window` or Vite-only APIs).
 * @returns {Promise<{ manifests: object[], mode: "import" | "source" }>}
 */
export async function loadManifests() {
  try {
    const mod = await import(pathToFileURL(MANIFEST_PATH).href);
    if (Array.isArray(mod.APP_MANIFESTS)) return { manifests: mod.APP_MANIFESTS, mode: "import" };
  } catch {
    // fall through to the text parser
  }
  return { manifests: parseManifestSource(readFileSync(MANIFEST_PATH, "utf-8")), mode: "source" };
}
