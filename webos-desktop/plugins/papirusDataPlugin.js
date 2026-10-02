import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";

const DATA_FILES = ["papirus-available.json", "papirus-symlinks.json"];
const DEBOUNCE_MS = 150;

function isStale(source, target) {
  return !existsSync(target) || statSync(target).mtimeMs < statSync(source).mtimeMs;
}

function hasAllData(generatedDir) {
  return DATA_FILES.every((name) => existsSync(join(generatedDir, name)));
}

/** Runs scripts/generatePapirusData.js if the JSON is missing. Returns true when the data exists. */
function ensurePapirusData(root) {
  const generatedDir = resolve(root, "src/generated");
  if (hasAllData(generatedDir)) return true;

  mkdirSync(generatedDir, { recursive: true });
  const script = resolve(root, "scripts/generatePapirusData.js");
  if (existsSync(script)) {
    spawnSync(process.execPath, [script], { stdio: "inherit", cwd: root });
  }
  return hasAllData(generatedDir);
}

/** Writes .gz / .br siblings next to the JSON, skipping any that are already up to date. */
function compressPapirusData(generatedDir) {
  for (const name of DATA_FILES) {
    const jsonPath = join(generatedDir, name);
    if (!existsSync(jsonPath)) continue;

    const gzPath = `${jsonPath}.gz`;
    const brPath = `${jsonPath}.br`;
    const needGz = isStale(jsonPath, gzPath);
    const needBr = isStale(jsonPath, brPath);
    if (!needGz && !needBr) continue;

    const data = readFileSync(jsonPath);
    if (needGz) writeFileSync(gzPath, gzipSync(data, { level: 9, mtime: 0 }));
    if (needBr) {
      try {
        writeFileSync(brPath, brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
      } catch (err) {
        console.warn(`[papirus] brotli compression failed for ${name}: ${err.message}`);
      }
    }
  }
}

export function papirusDataPlugin() {
  let root = process.cwd();
  let isBuild = false;
  let generateAttempted = false;

  // Returns false only when the data is missing and could not be generated.
  function prepare() {
    const generatedDir = resolve(root, "src/generated");
    let ok = hasAllData(generatedDir);
    if (!ok && !generateAttempted) {
      generateAttempted = true; // dev runs buildStart and configureServer; don't clone twice
      ok = ensurePapirusData(root);
    }
    if (ok) compressPapirusData(generatedDir);
    return ok;
  }

  return {
    name: "yukios-papirus-data",

    configResolved(config) {
      root = config.root;
      isBuild = config.command === "build";
    },

    buildStart() {
      if (prepare()) return;
      const message =
        "[papirus] src/generated/papirus-*.json is missing and scripts/generatePapirusData.js could not create it. " +
        "Run `pnpm generate:papirus` (needs git and network access).";
      if (isBuild) this.error(message);
      this.warn(message);
    },

    configureServer(server) {
      prepare();

      const watched = new Set(DATA_FILES.map((name) => resolve(root, "src/generated", name)));
      let timer = null;
      const onDataChange = (file) => {
        if (!watched.has(resolve(file))) return;
        clearTimeout(timer);
        timer = setTimeout(() => compressPapirusData(resolve(root, "src/generated")), DEBOUNCE_MS);
      };

      for (const file of watched) server.watcher.add(file);
      server.watcher.on("add", onDataChange);
      server.watcher.on("change", onDataChange);
      server.httpServer?.once("close", () => clearTimeout(timer));
    }
  };
}
