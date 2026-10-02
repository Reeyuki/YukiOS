import { loadManifests, MANIFEST_PATH } from "./lib/registry.js";

/**
 * Validates src/registry/AppManifest.js.
 *
 *   node scripts/validateRegistry.js            errors fail the build, warnings are printed
 *   node scripts/validateRegistry.js --strict   warnings fail the build too
 *
 * Tighten REQUIRED / RECOMMENDED below once the warnings are clean.
 */

const STRICT = process.argv.includes("--strict");

// Missing or empty => error.
const REQUIRED = ["title", "description"];
// Missing or empty => warning (error with --strict).
const RECOMMENDED = ["serviceKey", "type", "icon", "launchType", "category"];

const errors = [];
const warnings = [];

function label(entry, index) {
  return entry.serviceKey || entry.title || `entry #${index + 1}`;
}

function isFilled(value) {
  return typeof value === "string" && value.trim().length > 0;
}

let loaded;
try {
  loaded = await loadManifests();
} catch (err) {
  console.error(`Registry validation failed: ${err.message}`);
  process.exit(1);
}

const { manifests, mode } = loaded;

if (manifests.length === 0) {
  console.error(`APP_MANIFESTS in ${MANIFEST_PATH} is empty or malformed.`);
  process.exit(1);
}

// In "source" mode only literal strings are visible, so a non-literal value looks missing.
// Downgrade to warnings there to avoid false build failures.
const requiredBucket = mode === "import" ? errors : warnings;

const seenKeys = new Map();
const seenTitles = new Map();

manifests.forEach((entry, index) => {
  const name = label(entry, index);

  for (const field of REQUIRED) {
    if (!isFilled(entry[field])) requiredBucket.push(`${name}: missing "${field}"`);
  }
  for (const field of RECOMMENDED) {
    if (!isFilled(entry[field])) warnings.push(`${name}: missing "${field}"`);
  }

  if (isFilled(entry.serviceKey)) {
    if (seenKeys.has(entry.serviceKey)) errors.push(`Duplicate serviceKey "${entry.serviceKey}"`);
    seenKeys.set(entry.serviceKey, index);
  }
  if (isFilled(entry.title)) {
    const key = entry.title.trim().toLowerCase();
    if (seenTitles.has(key)) warnings.push(`Duplicate title "${entry.title}"`);
    seenTitles.set(key, index);
  }

  if (entry.targetUrl !== undefined) {
    try {
      const { protocol } = new URL(entry.targetUrl);
      if (protocol !== "http:" && protocol !== "https:") errors.push(`${name}: targetUrl must be http(s)`);
    } catch {
      errors.push(`${name}: invalid targetUrl "${entry.targetUrl}"`);
    }
  }
});

console.log(
  `Checked ${manifests.length} manifest entries (${mode === "import" ? "imported module" : "parsed source"}).`
);

for (const w of warnings) console.warn(`  warning: ${w}`);
for (const e of errors) console.error(`  error:   ${e}`);

if (errors.length > 0 || (STRICT && warnings.length > 0)) {
  console.error(`\nRegistry validation failed (${errors.length} errors, ${warnings.length} warnings).`);
  process.exit(1);
}

console.log(`Registry validation passed${warnings.length ? ` with ${warnings.length} warnings` : ""}.`);
