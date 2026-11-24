import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  ARCHIVE_BASE,
  normalizeUrl,
  loadJson,
  archiveList,
} from "./lib/gameAudit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const YUKIOS_ROOT = resolve(ROOT, "..");

const argv = process.argv.slice(2);
const flagValue = (name, fallback) => {
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || fallback;
  const index = argv.indexOf(name);
  return index !== -1 && argv[index + 1] ? argv[index + 1] : fallback;
};
const hasFlag = (name) => argv.includes(name);

if (hasFlag("--help")) {
  console.log(`Usage: node scripts/checkGameHealth.js [options]

Options:
  --concurrency N   parallel workers (default 24 http, 4 render)
  --timeout MS      per-request timeout (default 8000)
  --retries N       retries after a failure (default 1)
  --icons           include icon urls (default on)
  --no-icons        skip icon urls
  --local           check /static paths against disk (dev layout) instead of CDN
  --steam           only check entries the Steam tab displays (icon+title, non-system)
  --archive         include the CDN archive games.json catalog
  --archive-source=PATH  use a local archive games.json instead of the CDN one
  --render          use Playwright to load games instead of HTTP
  --only=SUBSTR    only check entries whose id or title contains SUBSTR
  --wait MS         render mode settle time after load (default 2500)
  --block-assets    render mode: block media/fonts/css for speed (default on)
  --no-block-assets render mode: load assets normally
  --out FILE        report path (default health-report.json)
  --no-fail         exit 0 even when failures are found
  --help            this message`);
  process.exit(0);
}

const renderMode = hasFlag("--render");
const skipIcons = hasFlag("--no-icons");
const archiveSource = flagValue(
  "--archive-source",
  `${ARCHIVE_BASE}/games.json`,
);
const includeArchive =
  hasFlag("--archive") || argv.some((a) => a.startsWith("--archive-source="));
const noFail = hasFlag("--no-fail");
const onlyFlag = argv.find((a) => a.startsWith("--only="));
const onlyFilter = onlyFlag ? onlyFlag.split("=")[1] || null : null;
const steamOnly = hasFlag("--steam");
const STEAM_APP_EXCLUDED = new Set(["TMNP", "vscode", "paint", "photopea"]);
const localOnly = hasFlag("--local");
const concurrency = Number(flagValue("--concurrency", renderMode ? 4 : 24));
const timeoutMs = Number(flagValue("--timeout", 8000));
const retries = Number(flagValue("--retries", 1));
const waitMs = Number(flagValue("--wait", 2500));
const blockAssets = !hasFlag("--no-block-assets");
const outFile = flagValue("--out", resolve(ROOT, "health-report.json"));

function collectChecks() {
  const checks = [];
  const content = readFileSync(
    resolve(ROOT, "src/games/gamesList.js"),
    "utf-8",
  );
  const seen = new Set();
  const blockRegex = /^\s\s(\w+):\s*\{/gm;
  const starts = [];
  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      starts.push({ id: match[1], index: match.index });
    }
  }
  const closing = content.lastIndexOf("};");
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].index : closing;
    const block = content.slice(starts[i].index, end);
    const title = (block.match(/title:\s*"([^"]+)"/) || [])[1] || starts[i].id;
    const type = (block.match(/type:\s*"([^"]+)"/) || [])[1] || "";
    const target =
      (block.match(/url:\s*"([^"]+)"/) || [])[1] ||
      (block.match(/swf:\s*"([^"]+)"/) || [])[1];
    const icon = (block.match(/icon:\s*"([^"]+)"/) || [])[1];
    if (steamOnly) {
      if (type === "system" || !icon || !title) continue;
      if (STEAM_APP_EXCLUDED.has(starts[i].id)) continue;
    }
    if (target) checks.push({ id: starts[i].id, title, kind: "url", target });
    if (!skipIcons && icon)
      checks.push({ id: starts[i].id, title, kind: "icon", target: icon });
  }
  return checks;
}

async function collectArchiveChecks() {
  const raw = await loadJson(archiveSource, "archive games.json");
  return archiveList(raw)
    .map((game) => {
      const id =
        normalizeUrl(game.url)
          .split("/")
          .pop()
          .replace(/[^a-z0-9]+/g, "") || game.name;
      const target = /^https?:\/\//i.test(game.url)
        ? game.url
        : `${ARCHIVE_BASE}/${game.url.replace(/^\/+/, "")}`;
      const rawThumb = game.thumbnail || "";
      const icon = /^https?:\/\//i.test(rawThumb)
        ? rawThumb
        : `${ARCHIVE_BASE}/${rawThumb.replace(/^\/+/, "")}`;
      const checks = [{ id, title: game.name, kind: "url", target }];
      if (!skipIcons && icon)
        checks.push({ id, title: game.name, kind: "icon", target: icon });
      return checks;
    })
    .flat();
}

function classifyLocal(pathname) {
  const candidates = [
    resolve(YUKIOS_ROOT, pathname.replace(/^\/+/, "")),
    resolve(YUKIOS_ROOT, "static", pathname.replace(/^\/+static\/+/, "")),
    resolve(ROOT, "public", pathname.replace(/^\/+/, "")),
  ];
  return candidates.some((candidate) => existsSync(candidate));
}

async function checkHttp(target) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(target, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        },
      });
      if (response.status >= 400) {
        await response.body?.cancel().catch(() => {});
        return {
          ok: false,
          status: response.status,
          bytes: 0,
          error: `HTTP ${response.status}`,
        };
      }
      const reader = response.body?.getReader();
      let bytes = 0;
      try {
        if (reader) {
          const first = await reader.read();
          bytes = first.done ? 0 : (first.value?.byteLength ?? 0);
          await reader.cancel().catch(() => {});
        }
      } finally {
        clearTimeout(timer);
      }
      if (bytes === 0) {
        return {
          ok: false,
          status: response.status,
          bytes,
          error: "empty body",
        };
      }
      return { ok: true, status: response.status, bytes };
    } catch (err) {
      clearTimeout(timer);
      lastError =
        err?.name === "AbortError"
          ? `timeout after ${timeoutMs}ms`
          : String(err?.message || err);
    }
  }
  return { ok: false, status: 0, bytes: 0, error: lastError };
}

const STATIC_CDN_BASE = "https://gcore.jsdelivr.net/gh/Reeyuki/yukios@main";
const STATIC_GAMES_CDN_BASE =
  "https://gcore.jsdelivr.net/gh/NaoTomori1/yukios-games@main";

function checkTarget(target) {
  if (/^https?:\/\//i.test(target)) return checkHttp(target);
  if (target.startsWith("/")) {
    const clean = target.split("?")[0].split("#")[0];
    if (localOnly) {
      const exists = classifyLocal(clean);
      return Promise.resolve(
        exists
          ? { ok: true, status: 200, bytes: -1, local: true }
          : { ok: false, status: 0, bytes: 0, error: "local file not found" },
      );
    }
    if (clean.startsWith("/static/games/"))
      return checkHttp(
        `${STATIC_GAMES_CDN_BASE}/${clean.replace(/^\/+static\/+games\/+/, "")}`,
      );
    if (clean.startsWith("/static/"))
      return checkHttp(`${STATIC_CDN_BASE}${clean}`);
    return checkHttp(`${STATIC_CDN_BASE}${clean}`);
  }
  return Promise.resolve({
    ok: false,
    status: 0,
    bytes: 0,
    error: "unsupported url",
  });
}

async function checkRender(browser, check) {
  const context = await browser.newContext({ javaScriptEnabled: true });
  if (blockAssets) {
    await context.route(
      /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp3|wav|ogg|mp4|webm|flac)(\?|$)/i,
      (route) => route.abort(),
    );
    await context.route("**/*", (route) =>
      route.request().resourceType() === "stylesheet"
        ? route.abort()
        : route.continue(),
    );
  }
  const pageErrors = [];
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    pageErrors.push(String(error?.message || error)),
  );
  try {
    const response = await page.goto(check.target, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await page.waitForTimeout(waitMs);
    const status = response?.status() ?? 0;
    if (status >= 400) {
      return { ok: false, status, bytes: 0, error: `HTTP ${status}` };
    }
    if (pageErrors.length) {
      return {
        ok: false,
        status,
        bytes: 0,
        error: `pageerror: ${pageErrors[0]}`,
      };
    }
    return { ok: true, status, bytes: -1 };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      bytes: 0,
      error: String(err?.message || err).split("\n")[0],
    };
  } finally {
    await context.close();
  }
}

async function runPool(tasks, workers, worker) {
  const results = new Array(tasks.length);
  let next = 0;
  let completed = 0;
  const lanes = Array.from(
    { length: Math.min(workers, tasks.length) },
    async () => {
      while (true) {
        const index = next++;
        if (index >= tasks.length) return;
        results[index] = await worker(tasks[index], index);
        completed++;
        if (completed % 100 === 0)
          console.log(`progress: ${completed}/${tasks.length}`);
      }
    },
  );
  await Promise.all(lanes);
  return results;
}

const httpChecks = collectChecks();
const checks = (
  includeArchive ? httpChecks.concat(await collectArchiveChecks()) : httpChecks
).filter(
  (check) =>
    !onlyFilter ||
    check.id.toLowerCase().includes(onlyFilter.toLowerCase()) ||
    check.title.toLowerCase().includes(onlyFilter.toLowerCase()),
);
console.log(
  `Health check: ${checks.length} targets (${httpChecks.length} from gamesList.js${includeArchive ? " + archive catalog" : ""})`,
);
console.log(
  renderMode
    ? `Mode: playwright (concurrency ${concurrency}, wait ${waitMs}ms)`
    : `Mode: http (concurrency ${concurrency}, timeout ${timeoutMs}ms, retries ${retries})`,
);

const started = Date.now();
let results;
if (renderMode) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(
      "Playwright is not installed. Install it with:\n  pnpm add -D playwright && npx playwright install chromium",
    );
    process.exit(1);
  }
  const browser = await chromium.launch({ headless: true });
  try {
    results = await runPool(checks, concurrency, (check) =>
      /^https?:\/\//i.test(check.target)
        ? checkRender(browser, check)
        : checkTarget(check.target),
    );
  } finally {
    await browser.close();
  }
} else {
  results = await runPool(checks, concurrency, (check) =>
    checkTarget(check.target),
  );
}

const report = checks.map((check, index) => ({ ...check, ...results[index] }));
const failures = report.filter((entry) => !entry.ok);
const iconTargets = report.filter((entry) => entry.kind === "icon");
const urlTargets = report.filter((entry) => entry.kind === "url");
const iconFailures = iconTargets.filter((entry) => !entry.ok);
const urlFailures = urlTargets.filter((entry) => !entry.ok);
const seconds = ((Date.now() - started) / 1000).toFixed(1);

writeFileSync(
  outFile,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      total: report.length,
      failures: failures.length,
      results: report,
    },
    null,
    2,
  ),
);

console.log(`\n${report.length} targets checked in ${seconds}s`);
console.log(`Games: ${urlTargets.length} icons + ${iconTargets.length} images`);
console.log(
  `URLs OK: ${urlTargets.length - urlFailures.length}/${urlTargets.length}   broken: ${urlFailures.length}`,
);
console.log(
  `Images OK: ${iconTargets.length - iconFailures.length}/${iconTargets.length}   broken: ${iconFailures.length}`,
);
console.log(`OK: ${report.length - failures.length}`);
console.log(`Broken: ${failures.length}`);
if (failures.length) {
  console.log("\nFailures:");
  for (const failure of failures) {
    console.log(
      `${failure.kind.padEnd(5)} ${failure.title}  [${failure.status || "ERR"}]  ${failure.error || ""}  ${failure.target}`,
    );
  }
}
console.log(`\nReport written to ${outFile}`);
process.exit(failures.length && !noFail ? 1 : 0);
