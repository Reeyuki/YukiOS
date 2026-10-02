import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const manifestPath = join(currentDir, "../src/registry/AppManifest.js");
const primaryOut = resolve(currentDir, "../../static/icons/favicons");
const cachePath = join(currentDir, "faviconCache.json");
const force = process.argv.includes("--force");
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const TIMEOUT_HTML = 15000;
const CONCURRENCY = 4;
const TIMEOUT_IMAGE = 15000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const requireFn = createRequire(import.meta.url);

let sharp = null;
try {
  sharp = requireFn("sharp");
} catch {}

function serviceKeyToSlug(key) {
  return key
    .replace(/App$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

function ensureDirs() {
  mkdirSync(primaryOut, { recursive: true });
  const gitkeepPrimary = join(primaryOut, ".gitkeep");
  if (!existsSync(gitkeepPrimary)) writeFileSync(gitkeepPrimary, "");
}

function loadWebApps() {
  const text = readFileSync(manifestPath, "utf-8");
  const serviceEntries = [...text.matchAll(/serviceKey:\s*"([^"]+)"/g)].map((m) => ({ key: m[1], index: m.index }));
  const targetEntries = [...text.matchAll(/targetUrl:\s*"([^"]+)"/g)].map((m) => ({ url: m[1], index: m.index }));
  const apps = [];
  for (let i = 0; i < serviceEntries.length; i++) {
    const svc = serviceEntries[i];
    const nextSvcIndex = i + 1 < serviceEntries.length ? serviceEntries[i + 1].index : Infinity;
    let best = null;
    for (const t of targetEntries) {
      if (t.index > svc.index && t.index < nextSvcIndex) {
        best = t;
        break;
      }
    }
    if (best) apps.push({ serviceKey: svc.key, targetUrl: best.url });
  }
  return apps;
}

function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_HTML) {
  // AbortSignal.timeout also covers reading the response body, unlike a timer cleared on headers.
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
}

function safeCodePoint(n) {
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
}

// href="...&amp;..." and "&#038;" must be decoded before the URL is requested.
function decodeHtmlEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function decodeDataUri(uri) {
  if (!uri.startsWith("data:")) return null;
  const comma = uri.indexOf(",");
  if (comma === -1) return null;
  const meta = uri.slice(5, comma);
  const data = uri.slice(comma + 1);
  const isBase64 = meta.includes(";base64");
  if (isBase64) {
    try {
      const b64 = data.replace(/\s/g, "");
      if (!b64 || b64 === "=") return null;
      return Buffer.from(b64, "base64");
    } catch {
      return null;
    }
  }
  try {
    const decoded = decodeURIComponent(data);
    if (!decoded) return null;
    return Buffer.from(decoded, "utf-8");
  } catch {
    try {
      return Buffer.from(data, "utf-8");
    } catch {
      return null;
    }
  }
}

function parseFaviconLinks(html, baseUrl) {
  const results = [];
  const linkTagRegex = /<link[^>]*>/gi;
  let m;
  while ((m = linkTagRegex.exec(html)) !== null) {
    const tag = m[0];
    const relMatch = tag.match(/rel\s*=\s*["']([^"']*)["']/i);
    if (!relMatch) continue;
    const rel = relMatch[1].toLowerCase();
    const isIcon = rel.includes("icon");
    const isManifest = rel.includes("manifest");
    if (!isIcon && !isManifest) continue;
    if (isManifest) continue;
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    let href = decodeHtmlEntities(hrefMatch[1].trim());
    if (!href) continue;
    if (href.startsWith("data:;")) {
      if (href === "data:;base64,=" || href.length < 20) continue;
    }
    const sizesMatch = tag.match(/sizes\s*=\s*["']([^"']+)["']/i);
    const sizes = sizesMatch ? sizesMatch[1] : "";
    let absolute;
    if (href.startsWith("data:")) {
      absolute = href;
    } else {
      try {
        absolute = new URL(href, baseUrl).href;
      } catch {
        continue;
      }
    }
    let sizeValue = 0;
    if (sizes) {
      const parts = sizes.split(/\s+/);
      for (const part of parts) {
        const dim = part.split("x");
        const w = parseInt(dim[0], 10);
        if (!Number.isNaN(w) && w > sizeValue) sizeValue = w;
      }
    }
    if (rel.includes("apple-touch-icon") && sizeValue === 0) sizeValue = 180;
    if (rel.includes("apple-touch-icon-precomposed") && sizeValue === 0) sizeValue = 180;
    results.push({ href: absolute, sizes, rel, sizeValue });
  }
  results.sort((a, b) => {
    if (b.sizeValue !== a.sizeValue) return b.sizeValue - a.sizeValue;
    const aApple = a.rel.includes("apple-touch-icon") ? 1 : 0;
    const bApple = b.rel.includes("apple-touch-icon") ? 1 : 0;
    if (bApple !== aApple) return bApple - aApple;
    return 0;
  });
  return results;
}

async function fetchManifestIcons(html, baseUrl) {
  const icons = [];
  const manifestLinkRegex = /<link[^>]*>/gi;
  let mm;
  let manifestHref = null;
  while ((mm = manifestLinkRegex.exec(html)) !== null) {
    const tag = mm[0];
    const relMatch = tag.match(/rel\s*=\s*["']([^"']*)["']/i);
    if (!relMatch) continue;
    if (!relMatch[1].toLowerCase().includes("manifest")) continue;
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch) {
      manifestHref = decodeHtmlEntities(hrefMatch[1]);
      break;
    }
  }
  if (!manifestHref) return icons;
  let manifestUrl;
  try {
    manifestUrl = new URL(manifestHref, baseUrl).href;
  } catch {
    return icons;
  }
  try {
    const res = await fetchWithTimeout(
      manifestUrl,
      { headers: { "User-Agent": USER_AGENT, Accept: "application/json,*/*" } },
      TIMEOUT_HTML
    );
    if (!res.ok) return icons;
    const text = await res.text();
    const json = JSON.parse(text);
    if (!json.icons || !Array.isArray(json.icons)) return icons;
    for (const icon of json.icons) {
      if (!icon.src) continue;
      let src;
      try {
        src = new URL(icon.src, manifestUrl).href;
      } catch {
        continue;
      }
      let sizeValue = 0;
      if (icon.sizes) {
        const parts = String(icon.sizes).split(/\s+/);
        for (const part of parts) {
          const w = parseInt(part.split("x")[0], 10);
          if (!Number.isNaN(w) && w > sizeValue) sizeValue = w;
        }
      }
      icons.push({ href: src, sizes: icon.sizes || "", rel: "manifest-icon", sizeValue });
    }
    icons.sort((a, b) => b.sizeValue - a.sizeValue);
  } catch {}
  return icons;
}

function buildFallbackList(targetUrl) {
  const u = new URL(targetUrl);
  const host = u.hostname;
  const origin = u.origin;
  const list = [];
  const hostSpecific = {
    "newgrounds.com": ["https://www.newgrounds.com/_guard/favicon.ico", "https://www.newgrounds.com/favicon.ico"],
    "www.newgrounds.com": ["https://www.newgrounds.com/_guard/favicon.ico"],
    "mail.google.com": ["https://ssl.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png"],
    "docs.google.com": ["https://ssl.gstatic.com/images/branding/product/1x/docs_2020q4_32dp.png"],
    "chat.deepseek.com": ["https://www.deepseek.com/favicon.ico", "https://chat.deepseek.com/favicon.ico"],
    "codepen.io": [],
    "gitlab.com": ["https://about.gitlab.com/favicon.ico"],
    "grok.x.ai": ["https://x.ai/favicon.ico"],
    "notion.so": ["https://www.notion.so/front-static/favicon.ico"],
    "www.notion.so": ["https://www.notion.so/front-static/favicon.ico"],
    "outlook.live.com": ["https://outlook.live.com/mail/favicon.ico"],
    "tiktok.com": ["https://www.tiktok.com/favicon.ico"],
    "www.tiktok.com": ["https://www.tiktok.com/favicon.ico"],
    "proton.me": [],
    "play.geforcenow.com": []
  };
  const overrides = hostSpecific[host] || [];
  for (const o of overrides) if (!list.includes(o)) list.push(o);
  const faviconIco = `${origin}/favicon.ico`;
  if (!list.includes(faviconIco)) list.push(faviconIco);
  if (host.startsWith("www.")) {
    const bare = host.slice(4);
    const bareOrigin = `${u.protocol}//${bare}`;
    const bareFavicon = `${bareOrigin}/favicon.ico`;
    if (!list.includes(bareFavicon)) list.push(bareFavicon);
  } else {
    const wwwHost = `www.${host}`;
    const wwwOrigin = `${u.protocol}//${wwwHost}`;
    const wwwFavicon = `${wwwOrigin}/favicon.ico`;
    if (["notion.so", "tiktok.com", "newgrounds.com"].includes(host) && !list.includes(wwwFavicon)) {
      list.splice(1, 0, wwwFavicon);
    }
  }
  const duck = `https://icons.duckduckgo.com/ip3/${host}.ico`;
  if (!list.includes(duck)) list.push(duck);
  const google = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
  if (!list.includes(google)) list.push(google);
  if (host === "mail.google.com" || host === "docs.google.com") {
    const s2Google = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
    if (!list.includes(s2Google)) list.push(s2Google);
  }
  const wwwVariant = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
  if (host === "tiktok.com" || host === "notion.so") {
    const altDuck = `https://icons.duckduckgo.com/ip3/${wwwVariant}.ico`;
    if (!list.includes(altDuck)) list.push(altDuck);
  }
  return [...new Set(list)];
}

async function tryFetchImage(candidate) {
  if (candidate.startsWith("data:")) {
    const buf = decodeDataUri(candidate);
    if (!buf || buf.length < 50) return { ok: false, status: 0, buffer: null, contentType: "" };
    let ct = "image/svg+xml";
    if (candidate.includes("image/png")) ct = "image/png";
    else if (candidate.includes("image/jpeg")) ct = "image/jpeg";
    else if (candidate.includes("image/webp")) ct = "image/webp";
    return { ok: true, status: 200, buffer: buf, contentType: ct, sourceUrl: candidate };
  }
  try {
    const res = await fetchWithTimeout(
      candidate,
      { headers: { "User-Agent": USER_AGENT, Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" } },
      TIMEOUT_IMAGE
    );
    if (!res.ok) return { ok: false, status: res.status, buffer: null, contentType: "" };
    const ct = res.headers.get("content-type") || "";
    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);
    if (buffer.length < 80) return { ok: false, status: res.status, buffer: null, contentType: ct };
    const ctLower = ct.toLowerCase();
    if (ctLower.includes("text/html") || ctLower.includes("application/xhtml+xml"))
      return { ok: false, status: res.status, buffer: null, contentType: ct };
    const headStr = buffer.toString("utf8", 0, 2000).trim().toLowerCase();
    const headSlice = headStr.slice(0, 500);
    if (headSlice.startsWith("<!doctype") || headSlice.startsWith("<html") || headSlice.includes("<html"))
      return { ok: false, status: res.status, buffer: null, contentType: ct };
    return { ok: true, status: res.status, buffer, contentType: ct, sourceUrl: candidate };
  } catch (e) {
    return { ok: false, status: 0, buffer: null, contentType: "", error: e.message };
  }
}

async function collectCandidates(targetUrl) {
  const parsed = [];
  let html = "";
  try {
    const res = await fetchWithTimeout(
      targetUrl,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/*;q=0.8,*/*;q=0.7"
        }
      },
      TIMEOUT_HTML
    );
    if (res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html") || ct.includes("application/xhtml") || ct === "") {
        html = await res.text();
      } else {
        html = "";
      }
    }
  } catch {}
  if (html) {
    const links = parseFaviconLinks(html, targetUrl);
    for (const l of links) parsed.push(l.href);
    try {
      const manifestIcons = await fetchManifestIcons(html, targetUrl);
      for (const mi of manifestIcons) if (!parsed.includes(mi.href)) parsed.push(mi.href);
    } catch {}
    const filtered = parsed.filter((href) => {
      if (href.startsWith("data:;")) return false;
      if (href === "data:;base64,=") return false;
      if (href.length < 8) return false;
      return true;
    });
    parsed.length = 0;
    for (const f of filtered) parsed.push(f);
  }
  const fallbacks = buildFallbackList(targetUrl);
  const combined = [...parsed];
  for (const fb of fallbacks) if (!combined.includes(fb)) combined.push(fb);
  return combined;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Decodes a bitmap (BMP/DIB) frame stored inside an .ico into RGBA pixels. Supports 1/4/8/24/32-bit, uncompressed.
function decodeIcoBmp(frame) {
  if (frame.length < 40) return null;
  const headerSize = frame.readUInt32LE(0);
  const width = frame.readInt32LE(4);
  const height = Math.abs(frame.readInt32LE(8)) / 2; // header height covers the pixels plus the AND mask
  const bpp = frame.readUInt16LE(14);
  const compression = frame.readUInt32LE(16);
  if (headerSize < 40 || compression !== 0 || ![1, 4, 8, 24, 32].includes(bpp)) return null;
  if (width <= 0 || width > 512 || !Number.isInteger(height) || height <= 0 || height > 512) return null;

  const paletteEntries = bpp <= 8 ? frame.readUInt32LE(32) || 1 << bpp : 0;
  const xorOffset = headerSize + paletteEntries * 4;
  const xorStride = Math.ceil((width * bpp) / 32) * 4;
  const andOffset = xorOffset + xorStride * height;
  const andStride = Math.ceil(width / 32) * 4;
  if (andOffset > frame.length) return null;

  const rgba = Buffer.alloc(width * height * 4);
  let hasAlpha = false;

  for (let y = 0; y < height; y++) {
    const row = xorOffset + (height - 1 - y) * xorStride; // bitmaps are stored bottom-up
    for (let x = 0; x < width; x++) {
      let r, g, b;
      let a = 255;
      if (bpp === 32) {
        const o = row + x * 4;
        [b, g, r, a] = [frame[o], frame[o + 1], frame[o + 2], frame[o + 3]];
        if (a) hasAlpha = true;
      } else if (bpp === 24) {
        const o = row + x * 3;
        [b, g, r] = [frame[o], frame[o + 1], frame[o + 2]];
      } else {
        const bitPos = x * bpp;
        const index = (frame[row + (bitPos >> 3)] >> (8 - bpp - (bitPos & 7))) & ((1 << bpp) - 1);
        const p = headerSize + index * 4;
        [b, g, r] = [frame[p], frame[p + 1], frame[p + 2]];
      }
      const out = (y * width + x) * 4;
      rgba[out] = r;
      rgba[out + 1] = g;
      rgba[out + 2] = b;
      rgba[out + 3] = a;
    }
  }

  // Without a real alpha channel, transparency comes from the 1-bit AND mask.
  if (!hasAlpha) {
    const maskFits = andOffset + andStride * height <= frame.length;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const masked = maskFits && (frame[andOffset + (height - 1 - y) * andStride + (x >> 3)] >> (7 - (x & 7))) & 1;
        rgba[(y * width + x) * 4 + 3] = masked ? 0 : 255;
      }
    }
  }
  return { rgba, width, height };
}

// sharp cannot decode .ico files. Take the largest frame we can read: an embedded PNG, or a decoded bitmap.
function decodeIco(buffer) {
  if (buffer.length < 22 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) return null;
  const count = buffer.readUInt16LE(4);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 16;
    if (offset + 16 > buffer.length) break;
    entries.push({
      width: buffer[offset] || 256,
      size: buffer.readUInt32LE(offset + 8),
      dataOffset: buffer.readUInt32LE(offset + 12)
    });
  }
  entries.sort((a, b) => b.width - a.width);

  for (const entry of entries) {
    const frame = buffer.subarray(entry.dataOffset, entry.dataOffset + entry.size);
    if (frame.length >= 8 && frame.subarray(0, 8).equals(PNG_SIGNATURE)) return { png: frame };
    const bitmap = decodeIcoBmp(frame);
    if (bitmap) return bitmap;
  }
  return null;
}

// Throws if the image can't be converted, so the caller can move on to the next candidate
// instead of saving raw .ico/.bmp bytes under a .webp name.
async function convertToWebp(buffer, contentType, outPath) {
  if (!sharp) {
    writeFileSync(outPath, buffer);
    return { bytes: buffer.length, converted: false };
  }

  const ico = decodeIco(buffer);
  let pipeline;
  if (ico && ico.rgba) {
    pipeline = sharp(ico.rgba, { raw: { width: ico.width, height: ico.height, channels: 4 } });
  } else {
    const input = (ico && ico.png) || buffer;
    const isSvg = contentType.includes("svg") || input.toString("utf8", 0, 500).includes("<svg");
    pipeline = isSvg ? sharp(input, { density: 128 }) : sharp(input, { animated: false });
  }

  const out = await pipeline
    .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 85 })
    .toBuffer();
  writeFileSync(outPath, out);
  return { bytes: out.length, converted: true };
}

function upsertCache(cache, entry) {
  const idx = cache.findIndex((c) => c.slug === entry.slug);
  if (idx >= 0) cache[idx] = { ...cache[idx], ...entry };
  else cache.push(entry);
}

function shouldSkip(slug) {
  if (force) return false;
  const primaryFile = join(primaryOut, `${slug}.webp`);
  if (!existsSync(primaryFile)) return false;
  try {
    const stat = statSync(primaryFile);
    const age = Date.now() - stat.mtimeMs;
    if (age < SEVEN_DAYS && stat.size > 0) return true;
  } catch {}
  return false;
}

async function processApp(app, cache) {
  const slug = serviceKeyToSlug(app.serviceKey);
  const outPrimary = join(primaryOut, `${slug}.webp`);

  if (shouldSkip(slug)) {
    try {
      const stat = statSync(outPrimary);
      console.log(
        `[skip] ${slug} (${app.serviceKey} -> ${app.targetUrl}) exists ${stat.size} bytes age ${((Date.now() - stat.mtimeMs) / 3600000) | 0}h`
      );
      upsertCache(cache, { slug, url: app.targetUrl, bytes: stat.size, status: "cached" });
      return { slug, status: "cached" };
    } catch {}
  }

  const candidates = await collectCandidates(app.targetUrl);
  let success = null;
  let lastFailure = "no candidates";

  for (const cand of candidates) {
    const result = await tryFetchImage(cand);
    if (!(result.ok && result.buffer)) {
      lastFailure = `${cand} -> status ${result.status}`;
      continue;
    }
    try {
      const conv = await convertToWebp(result.buffer, result.contentType, outPrimary);
      success = { ...result, ...conv };
      break;
    } catch (e) {
      lastFailure = `${cand} -> convert failed: ${e.message}`;
    }
  }

  if (!success) {
    console.log(`[fail] ${slug} (${app.targetUrl}) all ${candidates.length} candidates failed; last: ${lastFailure}`);
    upsertCache(cache, {
      slug,
      url: app.targetUrl,
      sourceUrl: candidates[0] || "",
      fetchedAt: new Date().toISOString(),
      bytes: 0,
      status: "fail"
    });
    return { slug, status: "fail" };
  }

  const label = success.converted ? "webp" : "raw (sharp missing)";
  console.log(
    `[ok] ${slug} <- ${success.sourceUrl} get=${success.status} bytes=${success.buffer.length} -> ${success.bytes} ${label}`
  );
  upsertCache(cache, {
    slug,
    url: app.targetUrl,
    sourceUrl: success.sourceUrl,
    fetchedAt: new Date().toISOString(),
    bytes: success.bytes,
    status: "ok"
  });
  return { slug, status: "ok", bytes: success.bytes };
}

async function main() {
  ensureDirs();
  const apps = loadWebApps();
  console.log(`Found ${apps.length} web apps`);
  for (const a of apps) console.log(` - ${a.serviceKey} -> ${a.targetUrl} => ${serviceKeyToSlug(a.serviceKey)}.webp`);
  if (!sharp) console.log("WARN sharp not available, saving original bytes as .webp");
  let cache = [];
  if (existsSync(cachePath)) {
    try {
      cache = JSON.parse(readFileSync(cachePath, "utf-8"));
      if (!Array.isArray(cache)) cache = [];
    } catch {
      cache = [];
    }
  }
  let okCount = 0;
  let failCount = 0;
  let cachedCount = 0;
  const queue = [...apps];
  const worker = async () => {
    while (queue.length > 0) {
      const app = queue.shift();
      try {
        const res = await processApp(app, cache);
        if (res.status === "ok") okCount++;
        else if (res.status === "cached") cachedCount++;
        else failCount++;
      } catch (e) {
        console.log(`[fail] ${app.serviceKey} exception ${e.message}`);
        failCount++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, apps.length) }, worker));

  cache.sort((a, b) => a.slug.localeCompare(b.slug));
  writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n");
  console.log(`Done ok=${okCount} cached=${cachedCount} fail=${failCount} total=${apps.length}`);
  console.log(`Primary: ${primaryOut}`);
  console.log(`Cache: ${cachePath}`);
  if (failCount > 0) {
    const fails = cache.filter((c) => c.status === "fail").map((c) => c.slug);
    console.log(`Failed slugs: ${fails.join(", ")}`);
    if (process.argv.includes("--strict")) process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
