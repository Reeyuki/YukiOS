import { lstatSync, mkdirSync, mkdtempSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Generates src/generated/papirus-available.json and papirus-symlinks.json from the Papirus icon theme.
 *
 *   node scripts/generatePapirusData.js
 *   PAPIRUS_REF=<tag-or-branch> node scripts/generatePapirusData.js   (pin a version)
 */

const REPO_URL = "https://github.com/PapirusDevelopmentTeam/papirus-icon-theme.git";
const REPO_REF = process.env.PAPIRUS_REF || "";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const generatedDir = resolve(scriptDir, "../src/generated");
const availPath = join(generatedDir, "papirus-available.json");
const symPath = join(generatedDir, "papirus-symlinks.json");

function git(args) {
  const result = spawnSync("git", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args[0]} failed (exit ${result.status})`);
}

function safeLstat(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

function sortKeys(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

function scanPapirus(root) {
  const available = {};
  const symlinks = {};
  const papirusRoot = join(root, "Papirus");
  if (!safeLstat(papirusRoot)) return { available, symlinks };

  for (const size of readdirSync(papirusRoot)) {
    if (!/^\d+x\d+$/.test(size)) continue;
    const sizePath = join(papirusRoot, size);
    if (!safeLstat(sizePath)?.isDirectory()) continue;

    for (const ctx of readdirSync(sizePath)) {
      const ctxPath = join(sizePath, ctx);
      if (!safeLstat(ctxPath)?.isDirectory()) continue;

      for (const file of readdirSync(ctxPath)) {
        if (!file.endsWith(".svg")) continue;
        const key = `${ctx}/${file.slice(0, -4)}`;
        const fullPath = join(ctxPath, file);
        const stat = safeLstat(fullPath);
        if (!stat) continue;

        if (stat.isSymbolicLink()) {
          let target;
          try {
            target = readlinkSync(fullPath);
          } catch {
            continue;
          }
          const targetBase = target.endsWith(".svg") ? target.slice(0, -4) : target;
          const targetCtx = dirname(target);
          let resolvedKey;
          if (targetCtx === "." || targetCtx === "") {
            resolvedKey = `${ctx}/${targetBase}`;
          } else if (target.startsWith("/")) {
            resolvedKey = target.slice(1).replace(/\.svg$/, "");
          } else {
            resolvedKey = join(ctx, targetBase).split(sep).join("/");
          }
          if (!symlinks[key]) symlinks[key] = resolvedKey;
        } else {
          available[key] ??= [];
          if (!available[key].includes(size)) available[key].push(size);
        }
      }
    }
  }

  for (const sizes of Object.values(available)) {
    sizes.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }

  return { available: sortKeys(available), symlinks: sortKeys(symlinks) };
}

function main() {
  const tmpRoot = mkdtempSync(join(tmpdir(), "papirus-"));
  try {
    console.log(`[papirus] cloning ${REPO_URL}${REPO_REF ? ` @ ${REPO_REF}` : ""} (Papirus/ only) to ${tmpRoot}`);
    // core.symlinks=true keeps symlinks as real links on Windows; sparse + blob filter skips everything but Papirus/.
    git([
      "-c",
      "core.symlinks=true",
      "clone",
      "--depth",
      "1",
      "--filter=blob:none",
      "--sparse",
      ...(REPO_REF ? ["--branch", REPO_REF] : []),
      REPO_URL,
      tmpRoot
    ]);
    git(["-C", tmpRoot, "sparse-checkout", "set", "Papirus"]);

    const { available, symlinks } = scanPapirus(tmpRoot);
    if (Object.keys(available).length === 0) {
      throw new Error("no icons found, aborting");
    }

    mkdirSync(generatedDir, { recursive: true });
    writeFileSync(availPath, JSON.stringify(available), "utf-8");
    writeFileSync(symPath, JSON.stringify(symlinks), "utf-8");
    console.log(`[papirus] wrote ${availPath} (${Object.keys(available).length} icons)`);
    console.log(`[papirus] wrote ${symPath} (${Object.keys(symlinks).length} symlinks)`);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

try {
  main();
} catch (err) {
  console.error(`[papirus] ${err.message}`);
  process.exit(1);
}
