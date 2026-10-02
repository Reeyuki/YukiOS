import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Makes dist/ self-contained so it can be hosted anywhere (Netlify, Cloudflare Pages, Vercel...).
 *
 * The normal build points static/ and src/styles/ at a jsDelivr copy of another repository.
 * This script copies those folders into dist/ and rewrites every HTML file to use them instead.
 *
 *   node scripts/prepareSelfHost.js     (run after `vite build`; `pnpm build:site` does both)
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");
const STATIC_SRC = resolve(ROOT, "../static");
const STYLES_SRC = resolve(ROOT, "src/styles");

// https://cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/static/...  ->  /static/...
const CDN_ASSET_PATTERN =
  /https:\/\/cdn\.jsdelivr\.net\/gh\/[^/"'\s]+\/[^/@"'\s]+@[^/"'\s]+\/(static\/|src\/styles\/)/g;

const WARN_FILE_BYTES = 50 * 1024 * 1024;
const WARN_TOTAL_BYTES = 500 * 1024 * 1024;

function fail(message) {
  console.error(`[self-host] ${message}`);
  process.exit(1);
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

if (!existsSync(join(DIST, "index.html"))) fail("dist/index.html not found. Run `vite build` first.");
if (!existsSync(STATIC_SRC)) fail(`static folder not found at ${STATIC_SRC}`);

// 1. Rewrite CDN asset URLs to local paths in every HTML file.
let rewritten = 0;
let filesChanged = 0;
for (const file of walk(DIST).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(file, "utf-8");
  let count = 0;
  const updated = html.replace(CDN_ASSET_PATTERN, (_, folder) => {
    count++;
    return `/${folder}`;
  });
  if (count > 0) {
    writeFileSync(file, updated, "utf-8");
    rewritten += count;
    filesChanged++;
  }
}
console.log(`[self-host] rewrote ${rewritten} CDN references in ${filesChanged} HTML files`);

// 2. Copy the folders those URLs now point to.
cpSync(STATIC_SRC, join(DIST, "static"), { recursive: true });
console.log("[self-host] copied static/ into dist/static");

if (existsSync(STYLES_SRC)) {
  cpSync(STYLES_SRC, join(DIST, "src/styles"), { recursive: true });
  console.log("[self-host] copied src/styles/ into dist/src/styles");
}

// 3. Report the size of the result so surprises show up before uploading.
let total = 0;
const large = [];
for (const file of walk(DIST)) {
  const size = statSync(file).size;
  total += size;
  if (size > WARN_FILE_BYTES) large.push({ file: file.slice(DIST.length + 1), size });
}
console.log(`[self-host] dist/ is ${mb(total)} MB`);
for (const { file, size } of large) console.warn(`[self-host] large file: ${file} (${mb(size)} MB)`);
if (total > WARN_TOTAL_BYTES) {
  console.warn(
    "[self-host] dist/ is over 500 MB. Drag-and-drop uploads may be slow or fail; consider trimming static/."
  );
}
console.log("[self-host] done. Upload the dist folder.");
