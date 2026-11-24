import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "../..");

export const TRUFFLED_BASE = "https://truffled.lol";
export const ARCHIVE_BASE =
  "https://gcore.jsdelivr.net/gh/NaoTomori1/yukios-games@642364dd3a8fceaa3552ac6d782a9b8a544b8f52/archive";
export const DEFAULT_ARCHIVE_GAMES_URL = `${ARCHIVE_BASE}/games.json`;

export function loadJson(source, label) {
  if (/^https?:\/\//i.test(source)) {
    return fetch(source).then((res) => {
      if (!res.ok)
        throw new Error(`${label}: ${source} returned ${res.status}`);
      return res.json();
    });
  }
  return Promise.resolve(JSON.parse(readFileSync(resolve(source), "utf-8")));
}

export function archiveList(data) {
  return Array.isArray(data) ? data : data?.games || [];
}

const JSDELIVR_HOSTS = new Set([
  "cdn.jsdelivr.net",
  "gcore.jsdelivr.net",
  "purge.jsdelivr.net",
]);

export function normalizeUrl(raw, base) {
  if (!raw) return "";
  let absolute = raw;
  if (!/^https?:\/\//i.test(absolute)) {
    if (base && absolute.startsWith("/"))
      absolute = new URL(base).origin + absolute;
    else if (base) absolute = `${base}/${absolute}`;
  }
  absolute = absolute.split("#")[0].split("?")[0];
  try {
    const url = new URL(absolute);
    url.hostname = url.hostname.toLowerCase();
    if (JSDELIVR_HOSTS.has(url.hostname)) url.hostname = "cdn.jsdelivr.net";
    url.pathname = decodeURIComponent(url.pathname)
      .replace(/\/+$/, "")
      .toLowerCase();
    return url.hostname + url.pathname;
  } catch {
    return absolute.toLowerCase().replace(/\/+$/, "");
  }
}

export function normalizeTitle(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/,\s*webport$/i, "")
    .replace(/\bwebports?\b/gi, " ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function idify(raw) {
  return normalizeTitle(raw).replace(/\s+/g, "");
}

export function parseGamesList() {
  const content = readFileSync(
    resolve(ROOT, "src/games/gamesList.js"),
    "utf-8",
  );
  const entries = [];
  const blockRegex = /^\s\s(\w+):\s*\{/gm;
  const starts = [];
  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    starts.push({ id: match[1], index: match.index });
  }
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].index : content.length;
    const block = content.slice(starts[i].index, end);
    const url = block.match(/url:\s*"([^"]+)"/)?.[1] || null;
    const swf = block.match(/swf:\s*"([^"]+)"/)?.[1] || null;
    const title = block.match(/title:\s*"([^"]+)"/)?.[1] || "";
    entries.push({ id: starts[i].id, url: url || swf || "", title });
  }
  return entries;
}

export function loadYukiosListSets() {
  const yukiosEntries = parseGamesList();
  const appListPath = resolve(ROOT, "public/app-list.json");
  const appListIds = new Set(
    existsSync(appListPath)
      ? JSON.parse(readFileSync(appListPath, "utf-8")).map((id) =>
          id.toLowerCase(),
        )
      : [],
  );
  return {
    count: yukiosEntries.length,
    listUrls: new Set(
      yukiosEntries.map((entry) => normalizeUrl(entry.url)).filter(Boolean),
    ),
    listTitles: new Set(
      yukiosEntries.map((entry) => normalizeTitle(entry.title)).filter(Boolean),
    ),
    listIds: new Set(yukiosEntries.map((entry) => entry.id.toLowerCase())),
    appListIds,
  };
}

export async function loadArchiveSets(source = DEFAULT_ARCHIVE_GAMES_URL) {
  const raw = await loadJson(source, "yukios archive games.json");
  const games = archiveList(raw);
  return {
    count: games.length,
    archiveUrls: new Set(
      games.map((game) => normalizeUrl(game.url, ARCHIVE_BASE)).filter(Boolean),
    ),
    archiveTitles: new Set(
      games.map((game) => normalizeTitle(game.name)).filter(Boolean),
    ),
    archiveIds: new Set(games.map((game) => idify(game.name)).filter(Boolean)),
  };
}

export function computeCoverage(items, listSets, archiveSets) {
  const inList = [];
  const inArchive = [];
  const missing = [];
  for (const item of items) {
    const nameNorms = item.names.map(normalizeTitle);
    const nameIds = item.names.map(idify);
    const url = normalizeUrl(item.url);
    const inListMatch =
      listSets.listUrls.has(url) ||
      nameNorms.some((n) => listSets.listTitles.has(n)) ||
      nameIds.some(
        (n) => listSets.listIds.has(n) || listSets.appListIds.has(n),
      );
    const inArchiveMatch =
      archiveSets.archiveUrls.has(url) ||
      nameNorms.some((n) => archiveSets.archiveTitles.has(n)) ||
      nameIds.some((n) => archiveSets.archiveIds.has(n));
    if (inListMatch) inList.push(item.name);
    if (inArchiveMatch) inArchive.push(item.name);
    if (!inListMatch && !inArchiveMatch) missing.push(item);
  }
  return { inList, inArchive, missing };
}
