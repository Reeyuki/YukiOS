import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const ARCHIVE_BASE =
  "https://gcore.jsdelivr.net/gh/NaoTomori1/yukios-games@642364dd3a8fceaa3552ac6d782a9b8a544b8f52/archive";
const ARCHIVE_GAMES_URL = `${ARCHIVE_BASE}/games.json`;
const TREES_URL =
  "https://api.github.com/repos/freebuisness/html/git/trees/main?recursive=1";
const OUT_FILE = resolve(ROOT, "public/archive-games.json");

const argv = process.argv.slice(2);
const treePathArg = argv.find((a) => a.startsWith("--tree="));
const localSnapshot = argv.find((a) => a.startsWith("--snapshot="));

const DROP_HOSTS = ["linkdropper.zidanwaiba.com.np", "selenite.cc"];

const raw = localSnapshot
  ? JSON.parse(readFileSync(resolve(localSnapshot.split("=")[1]), "utf-8"))
  : await (await fetch(ARCHIVE_GAMES_URL)).json();

const games = Array.isArray(raw) ? raw : raw.games || [];

let htmlFiles;
if (treePathArg) {
  htmlFiles = new Set(
    JSON.parse(readFileSync(resolve(treePathArg.split("=")[1]), "utf-8"))
      .tree.filter((e) => e.type === "blob" && e.path.endsWith(".html"))
      .map((e) => e.path),
  );
} else {
  const res = await fetch(TREES_URL, {
    headers: { "user-agent": "yukios-archive-builder/1.0" },
  });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  const json = await res.json();
  htmlFiles = new Set(
    json.tree
      .filter((e) => e.type === "blob" && e.path.endsWith(".html"))
      .map((e) => e.path),
  );
}

const COVERS_TREES_URL =
  "https://api.github.com/repos/freebuisness/covers/git/trees/main?recursive=1";
const coversTreeArg = argv.find((a) => a.startsWith("--covers-tree="));
let coverFiles;
if (coversTreeArg) {
  coverFiles = new Set(
    JSON.parse(readFileSync(resolve(coversTreeArg.split("=")[1]), "utf-8"))
      .tree.filter((e) => e.type === "blob")
      .map((e) => e.path),
  );
} else {
  const res = await fetch(COVERS_TREES_URL, {
    headers: { "user-agent": "yukios-archive-builder/1.0" },
  });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  const json = await res.json();
  coverFiles = new Set(
    json.tree.filter((e) => e.type === "blob").map((e) => e.path),
  );
}

const stemBase = (file) =>
  file
    .replace(/\.html$/i, "")
    .replace(
      /-(fix\d*|f\d*|fi\d+|af|a\d*|wow\d*|ff|win\d*|update\d+|fde|fi\d+)$/i,
      "",
    );

function resolveFreebuisness(file) {
  if (htmlFiles.has(file)) return file;
  const base = stemBase(file);
  const candidates = [...htmlFiles].filter((p) => {
    const stem = p.slice(0, -5);
    return stem === base || stem.startsWith(base + "-");
  });
  if (!candidates.length) return null;
  return candidates.sort(
    (a, b) =>
      a.split("-").length - b.split("-").length ||
      a.localeCompare(b, undefined, { numeric: true }),
  )[0];
}

const coveredByFreebuisness = (game, thumb) => {
  if (/^https?:\/\//i.test(thumb)) return null;
  const m = String(game.url || "").match(
    /freebuisness\/html@[^/]+\/(\d+)[-a-z0-9]*\.html/,
  );
  if (!m) return null;
  const cover = `${m[1]}.png`;
  return coverFiles.has(cover) ? m[1] : null;
};

const URL_FIXUPS = [
  {
    match: "1on1soccer.swf",
    url: "https://truffled.lol/games/1on1soccer/index.html",
    thumbnail: "https://truffled.lol/png/games/12.webp",
  },
  {
    match: "gnmath/1v1.html",
    url: "https://cdn.jsdelivr.net/gh/freebuisness/html@main/58-fix2.html",
    thumbnail: "https://cdn.jsdelivr.net/gh/freebuisness/covers@main/58.png",
  },
  {
    match: "basketbros-io",
    url: "https://cdn.jsdelivr.net/gh/freebuisness/html@main/285-fix2.html",
    thumbnail: "https://cdn.jsdelivr.net/gh/freebuisness/covers@main/285.png",
  },
  {
    match: "preview.editmysite.com",
    url: "https://cdn.jsdelivr.net/gh/freebuisness/html@main/627-fix3.html",
    thumbnail: "https://cdn.jsdelivr.net/gh/freebuisness/covers@main/627.png",
  },
];

const fixThumbnail = (game) => {
  const thumb = String(game.thumbnail || "");
  const url = String(game.url || "");
  if (/^\/?stuff\/games\//.test(thumb)) {
    return {
      thumbnail: `https://larp.now/${thumb.replace(/^\/+/, "")}`,
      changed: true,
    };
  }
  if (/^semag\//.test(thumb)) {
    return { thumbnail: `${ARCHIVE_BASE}/${thumb}`, changed: true };
  }
  const id = coveredByFreebuisness(game, thumb);
  if (id) {
    return {
      thumbnail: `https://cdn.jsdelivr.net/gh/freebuisness/covers@main/${id}.png`,
      changed: true,
    };
  }
  return { thumbnail: thumb, changed: false };
};

const kept = [];
const remapped = [];
const thumbsRewired = [];
const dropped = [];
for (const game of games) {
  const url = String(game.url || "");
  const fixup = URL_FIXUPS.find((f) => url.includes(f.match));
  if (fixup) {
    kept.push({ ...game, url: fixup.url, thumbnail: fixup.thumbnail });
    remapped.push({ name: game.name, from: url, to: fixup.url });
    continue;
  }
  if (DROP_HOSTS.some((h) => url.includes(h))) {
    dropped.push({ game, reason: "dead host" });
    continue;
  }
  const fbMatch = url.match(/freebuisness\/html@([^/]+)\/([^"'#?]+\.html)/);
  if (fbMatch) {
    const resolved = resolveFreebuisness(fbMatch[2]);
    if (!resolved) {
      dropped.push({ game, reason: "freebuisness file missing" });
      continue;
    }
    if (resolved !== fbMatch[2]) {
      remapped.push({ name: game.name, from: fbMatch[2], to: resolved });
    }
    game.url = `https://cdn.jsdelivr.net/gh/freebuisness/html@main/${resolved}`;
  }
  const { thumbnail, changed } = fixThumbnail(game);
  if (changed) {
    thumbsRewired.push({
      name: game.name,
      from: game.thumbnail,
      to: thumbnail,
    });
    game.thumbnail = thumbnail;
  }
  kept.push(game);
}

const out = { games: kept };
writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
console.log(`Archive games.json: ${games.length} entries`);
console.log(`  remapped freebuisness filenames: ${remapped.length}`);
console.log(`  thumbnails rewired: ${thumbsRewired.length}`);
console.log(`  kept: ${kept.length}`);
console.log(`  dropped: ${dropped.length}`);
const dropByReason = {};
for (const d of dropped)
  dropByReason[d.reason] = (dropByReason[d.reason] || 0) + 1;
console.log(`  drop reasons:`, dropByReason);
console.log(`Written to ${OUT_FILE}`);
