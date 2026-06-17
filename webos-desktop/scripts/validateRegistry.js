import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const manifestPath = join(__dirname, "../src/registry/AppManifest.js");
const manifestContent = readFileSync(manifestPath, "utf-8");

const manifestMatch = manifestContent.match(/export const APP_MANIFESTS = (\[[\s\S]*\]);/);
if (!manifestMatch) {
  console.error("Could not find APP_MANIFESTS in AppManifest.js");
  process.exit(1);
}

const manifestString = manifestMatch[1];

const requiredFields = ["serviceKey", "type", "title", "icon", "launchType", "category"];
let hasErrors = false;
let hasWarnings = false;

const simpleValidation =
  manifestString.includes("serviceKey") && manifestString.includes("type") && manifestString.includes("title");

if (!simpleValidation) {
  console.error("APP_MANIFESTS appears to be malformed");
  hasErrors = true;
}

const descriptionCount = (manifestString.match(/description:/g) || []).length;
const manifestCount = (manifestString.match(/serviceKey:/g) || []).length;

if (descriptionCount < manifestCount) {
  console.error(`Missing descriptions: ${manifestCount - descriptionCount} apps without descriptions`);
  hasErrors = true;
}

if (hasErrors) {
  console.error("\nRegistry validation failed with errors.");
  process.exit(1);
}

console.log("Registry validation passed.");
