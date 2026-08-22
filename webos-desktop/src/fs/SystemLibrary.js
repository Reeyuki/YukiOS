import { StorageKeys } from "../StorageKeys.js";
import { SYSTEM_LIBRARY_FILES } from "../generated/systemLibraryManifest.js";

export const SYSTEM_FOLDER = "System";

const LIBRARY_RAW_BASE = "https://cdn.jsdelivr.net/gh/Reeyuki/YukiOS@main/webos-desktop/src";
const LIBRARY_FA_ICONS = {
  ".js": "fab fa-js",
  ".mjs": "fab fa-js",
  ".css": "fab fa-css3-alt"
};

let manifestIndex = null;
const overrideContentCache = new Map();

function getManifestIndex() {
  if (!manifestIndex) {
    manifestIndex = new Map(SYSTEM_LIBRARY_FILES.map((entry) => [entry.path, entry]));
  }
  return manifestIndex;
}

export function isSystemPath(fullPath, root) {
  if (typeof fullPath !== "string" || typeof root !== "string") return false;
  const systemRoot = `${root.replace(/\/+$/, "")}/${SYSTEM_FOLDER}`;
  const cleanPath = fullPath.replace(/\/+$/, "");
  return cleanPath === systemRoot || cleanPath.startsWith(`${systemRoot}/`);
}

export function toSystemRelPath(fullPath, root) {
  if (!isSystemPath(fullPath, root)) return null;
  const systemRoot = `${root.replace(/\/+$/, "")}/${SYSTEM_FOLDER}`;
  const remainder = fullPath.replace(/\/+$/, "").slice(systemRoot.length);
  return remainder.startsWith("/") ? remainder.slice(1) : remainder;
}

export function aliasSystemDir(fullPath, root) {
  if (typeof fullPath !== "string" || !fullPath.startsWith("/")) return fullPath;
  const cleanPath = fullPath.replace(/\/+$/, "");
  const systemRootAlias = `/${SYSTEM_FOLDER}`;
  if (cleanPath !== systemRootAlias && !cleanPath.startsWith(`${systemRootAlias}/`)) return fullPath;
  return `${root.replace(/\/+$/, "")}/${SYSTEM_FOLDER}${cleanPath.slice(systemRootAlias.length)}`;
}

export function withRootSystemEntry(dir, root, listing) {
  if (!listing || typeof listing !== "object") return listing;
  if (dir !== root || listing[SYSTEM_FOLDER]) return listing;
  listing[SYSTEM_FOLDER] = {};
  return listing;
}

export function isLibraryFile(relPath) {
  return getManifestIndex().has(relPath);
}

export function getManifestSize(relPath) {
  const entry = getManifestIndex().get(relPath);
  return entry ? entry.bytes : null;
}

export function mimeForPath(pathOrName) {
  const lowerName = String(pathOrName ?? "").toLowerCase();
  if (lowerName.endsWith(".js") || lowerName.endsWith(".mjs")) return "text/javascript";
  if (lowerName.endsWith(".css")) return "text/css";
  if (lowerName.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

export function mergeListings(virtualMap, realMap) {
  const merged = { ...virtualMap };
  for (const [name, entry] of Object.entries(realMap)) {
    merged[name] = entry && entry.type === "file" ? { ...entry, overridden: true } : { ...entry };
  }
  return merged;
}

function buildVirtualFileEntry(fsFacade, fileName, entry) {
  const dotIndex = fileName.lastIndexOf(".");
  const ext = dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
  return {
    type: "file",
    kind: fsFacade.inferKind(fileName),
    icon: "static/icons/file.webp",
    faIcon: LIBRARY_FA_ICONS[ext] ?? null,
    content: "",
    size: entry.bytes,
    mtime: entry.mtime,
    overridden: false
  };
}

function buildVirtualListing(fsFacade, relDir) {
  const virtualMap = {};
  const prefix = relDir ? `${relDir}/` : "";
  for (const entry of SYSTEM_LIBRARY_FILES) {
    if (!entry.path.startsWith(prefix)) continue;
    const remainder = entry.path.slice(prefix.length);
    if (!remainder) continue;
    const slashIndex = remainder.indexOf("/");
    if (slashIndex === -1) {
      virtualMap[remainder] = buildVirtualFileEntry(fsFacade, remainder, entry);
    } else {
      virtualMap[remainder.slice(0, slashIndex)] = {};
    }
  }
  return virtualMap;
}

export async function listSystemFolder(fsFacade, dir) {
  const relDir = toSystemRelPath(dir, fsFacade.CONFIG.ROOT);
  if (relDir === null) return {};
  const virtualMap = buildVirtualListing(fsFacade, relDir);
  const names = await fsFacade.storage.readdir(dir).catch(() => []);
  const dirMeta = await fsFacade.readMeta(dir);
  const realMap = {};
  for (const name of names) {
    if (name === fsFacade.CONFIG.META_FILE) continue;
    const fullPath = `${dir}/${name}`;
    const stat = await fsFacade.pStat(fullPath).catch(() => null);
    if (!stat) continue;
    if (stat.isDirectory()) {
      realMap[name] = {};
      continue;
    }
    const meta = dirMeta[name] ?? {};
    let size = stat.size ?? 0;
    if (size === 0) {
      const blob = await fsFacade.blobs.getBlobByFullPath(fullPath).catch(() => null);
      size = blob?.size ?? meta.size ?? 0;
    }
    realMap[name] = {
      type: "file",
      kind: meta.kind ?? fsFacade.inferKind(name),
      icon: meta.icon ?? "static/icons/file.webp",
      faIcon: meta.faIcon ?? null,
      content: "",
      size,
      mtime: stat.mtimeMs ?? null
    };
  }
  return mergeListings(virtualMap, realMap);
}

export async function fetchSystemFileContent(relPath) {
  if (overrideContentCache.has(relPath)) return overrideContentCache.get(relPath);
  if (import.meta.env.DEV) {
    const localResponse = await fetch(new URL(`src/${relPath}`, document.baseURI), {
      cache: "no-store"
    }).catch(() => null);
    if (localResponse?.ok) {
      const content = await localResponse.text();
      overrideContentCache.set(relPath, content);
      return content;
    }
  }
  const fallbackResponse = await fetch(`${LIBRARY_RAW_BASE}/${relPath}`).catch(() => null);
  if (fallbackResponse?.ok) {
    const content = await fallbackResponse.text();
    overrideContentCache.set(relPath, content);
    return content;
  }
  throw new Error("Unable to load system library file");
}

export function requireLibraryEntry(fullPath, root) {
  const relPath = toSystemRelPath(fullPath, root);
  if (!relPath || !isLibraryFile(relPath)) {
    throw new Error("Cannot create files inside System libraries");
  }
}

async function collectAllOverrideContents(fsFacade) {
  const { os } = await import("../framework.js");
  const index = os.storage.get(StorageKeys.systemOverridesIndex) || {};
  const overrides = {};
  for (const relPath of Object.keys(index)) {
    const fullPath = fsFacade.paths.join(fsFacade.CONFIG.ROOT, SYSTEM_FOLDER, relPath);
    const content = await fsFacade.pRead("readFile", fullPath, "utf8").catch(() => "");
    const text = typeof content === "string" ? content : "";
    overrides[`/src/${relPath}`] = text;
  }
  return overrides;
}

function pushOverridesToServiceWorker(overrides) {
  return new Promise((resolve) => {
    const controller = typeof navigator !== "undefined" ? navigator.serviceWorker?.controller : null;
    if (!controller) {
      resolve(false);
      return;
    }
    const channel = new MessageChannel();
    let settled = false;
    let handshakeTimeout = null;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(handshakeTimeout);
      resolve(result);
    };
    handshakeTimeout = setTimeout(() => settle(false), 1500);
    channel.port1.onmessage = (event) => settle(Boolean(event.data?.ok));
    controller.postMessage({ type: "SYSTEM_OVERRIDES_PUSH", overrides }, [channel.port2]);
  });
}

export async function syncSystemOverrideAfterWrite(fsFacade, fullPath) {
  const relPath = toSystemRelPath(fullPath, fsFacade.CONFIG.ROOT);
  if (relPath === null) return;
  let content = await fsFacade.pRead("readFile", fullPath, "utf8").catch(() => "");
  if (typeof content !== "string") content = "";
  const { os } = await import("../framework.js");
  const index = os.storage.get(StorageKeys.systemOverridesIndex) || {};
  index[relPath] = { savedAt: Date.now() };
  os.storage.set(StorageKeys.systemOverridesIndex, index);
  if (import.meta.env.DEV) {
    try {
      const response = await fetch("/__yukios-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "src/" + relPath, content })
      });
      if (response.ok) {
        location.reload();
        return;
      }
    } catch {}
  }
  await pushOverridesToServiceWorker(await collectAllOverrideContents(fsFacade));
  if (import.meta.env.DEV) {
    os.notify.send("Saved. Override applies when running via the dev server");
  }
}

export async function removeSystemOverride(fsFacade, fullPath) {
  const relPath = toSystemRelPath(fullPath, fsFacade.CONFIG.ROOT);
  if (!relPath) return false;
  if (!(await fsFacade.exists(fullPath))) return false;
  await fsFacade.p("unlink", fullPath).catch(() => {});
  await fsFacade.metadata
    .removeMeta(fsFacade.dirname(fullPath), fsFacade.basename(fullPath))
    .catch(() => {});
  if (!fsFacade.isElectron) {
    await fsFacade.blobs.deleteBlobByFullPath(fullPath).catch(() => {});
  }
  const { os } = await import("../framework.js");
  const index = os.storage.get(StorageKeys.systemOverridesIndex) || {};
  delete index[relPath];
  const hasRemainingOverrides = Object.keys(index).length > 0;
  if (hasRemainingOverrides) {
    os.storage.set(StorageKeys.systemOverridesIndex, index);
  } else if (typeof os.storage.remove === "function") {
    os.storage.remove(StorageKeys.systemOverridesIndex);
  } else {
    os.storage.set(StorageKeys.systemOverridesIndex, null);
  }
  const devClearedRequest = import.meta.env.DEV
    ? fetch("/__yukios-overrides", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "src/" + relPath })
      })
        .then((response) => response.ok)
        .catch(() => false)
    : Promise.resolve(false);
  const remainingOverrides = hasRemainingOverrides ? await collectAllOverrideContents(fsFacade) : {};
  await pushOverridesToServiceWorker(remainingOverrides);
  if (await devClearedRequest) {
    location.reload();
  }
  return true;
}
