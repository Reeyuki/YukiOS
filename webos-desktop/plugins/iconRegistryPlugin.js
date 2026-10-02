import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ALLOWED_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg", ".svg", ".avif", ".gif", ".ico"]);
const DEBOUNCE_MS = 100;

function findIconsDir(root) {
  return (
    [resolve(root, "../static/icons"), resolve(root, "public/static/icons")].find((dir) => existsSync(dir)) ?? null
  );
}

function listIconFiles(iconsDir) {
  const files = [];
  for (const entry of readdirSync(iconsDir)) {
    try {
      if (!statSync(join(iconsDir, entry)).isFile()) continue;
    } catch {
      continue;
    }
    const dot = entry.lastIndexOf(".");
    const ext = dot === -1 ? "" : entry.slice(dot).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) files.push(entry);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

/** Writes src/generated/iconRegistry.js, touching the file only when its content changes. */
function generateIconRegistry(root) {
  const iconsDir = findIconsDir(root);
  if (!iconsDir) {
    console.warn("[icon-registry] icons directory not found (looked in ../static/icons and public/static/icons)");
    return;
  }

  let files;
  try {
    files = listIconFiles(iconsDir);
  } catch (err) {
    console.warn(`[icon-registry] could not read ${iconsDir}: ${err.message}`);
    return;
  }

  const meta = files.map((name) => ({ name, path: `static/icons/${name}` }));
  const content =
    `export const ICON_REGISTRY = ${JSON.stringify(files, null, 2)};\n` +
    `export const ICON_COUNT = ${files.length};\n` +
    `export const ICON_REGISTRY_META = ${JSON.stringify(meta, null, 2)};\n`;

  const outputPath = resolve(root, "src/generated/iconRegistry.js");
  let existing = "";
  try {
    existing = readFileSync(outputPath, "utf-8");
  } catch {}

  if (existing !== content) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, "utf-8");
  }
}

export function iconRegistryPlugin() {
  let root = process.cwd();

  return {
    name: "yukios-icon-registry",

    configResolved(config) {
      root = config.root;
    },

    buildStart() {
      generateIconRegistry(root);
    },

    configureServer(server) {
      const iconsDir = resolve(root, "../static/icons");
      let timer = null;

      // Only files added to / removed from the icons folder change the registry.
      // (Comparing resolved paths keeps this working with Windows backslashes.)
      const onFileListChange = (file) => {
        if (resolve(dirname(file)) !== iconsDir) return;
        clearTimeout(timer);
        timer = setTimeout(() => generateIconRegistry(root), DEBOUNCE_MS);
      };

      server.watcher.add(iconsDir);
      server.watcher.on("add", onFileListChange);
      server.watcher.on("unlink", onFileListChange);
      server.httpServer?.once("close", () => clearTimeout(timer));
    }
  };
}
