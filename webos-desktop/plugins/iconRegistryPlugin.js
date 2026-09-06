import { readdirSync, writeFileSync, mkdirSync, existsSync, statSync, readFileSync } from "fs";
import { resolve, dirname, join } from "path";

function generateIconRegistry() {
  let iconsDir = resolve(process.cwd(), "../static/icons");
  if (!existsSync(iconsDir)) {
    const fallback = resolve(process.cwd(), "public/static/icons");
    if (existsSync(fallback)) {
      iconsDir = fallback;
    } else {
      const fallback2 = resolve(process.cwd(), "../static");
      if (existsSync(fallback2)) {
        const maybe = join(fallback2, "icons");
        if (existsSync(maybe)) iconsDir = maybe;
        else return;
      } else {
        return;
      }
    }
  }
  let files = [];
  try {
    const entries = readdirSync(iconsDir);
    const allowed = new Set([".webp", ".png", ".jpg", ".jpeg", ".svg", ".avif", ".gif", ".ico"]);
    for (const entry of entries) {
      const fullPath = join(iconsDir, entry);
      try {
        const st = statSync(fullPath);
        if (!st.isFile()) continue;
      } catch {
        continue;
      }
      const dot = entry.lastIndexOf(".");
      const ext = dot !== -1 ? entry.slice(dot).toLowerCase() : "";
      if (!allowed.has(ext)) continue;
      files.push(entry);
    }
  } catch {
    return;
  }
  files.sort((a, b) => a.localeCompare(b));
  const meta = files.map((name) => ({ name, path: `static/icons/${name}` }));
  const outputPath = resolve(process.cwd(), "src/generated/iconRegistry.js");
  const content = `export const ICON_REGISTRY = ${JSON.stringify(files, null, 2)};\nexport const ICON_COUNT = ${files.length};\nexport const ICON_REGISTRY_META = ${JSON.stringify(meta, null, 2)};\n`;
  let existing = "";
  try {
    existing = readFileSync(outputPath, "utf-8");
  } catch {
    existing = "";
  }
  if (existing !== content) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, "utf-8");
  }
}

export function iconRegistryPlugin() {
  return {
    name: "yukios-icon-registry",
    buildStart() {
      generateIconRegistry();
    },
    configureServer(server) {
      try {
        const dir = resolve(process.cwd(), "../static/icons");
        server.watcher.add(dir);
        server.watcher.on("all", (event, path) => {
          if (path.includes("static/icons")) generateIconRegistry();
        });
      } catch {}
    }
  };
}
