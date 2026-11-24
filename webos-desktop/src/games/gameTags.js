export const GAME_TAGS = [
  { id: "ports", label: "Ports", icon: "fas fa-gamepad" },
  { id: "flash", label: "Flash", icon: "fas fa-bolt" },
  { id: "emulator", label: "Emulators", icon: "fas fa-desktop" },
  { id: "fnf", label: "FNF", icon: "fas fa-music" },
  { id: "io", label: "IO", icon: "fas fa-globe" },
  { id: "horror", label: "Horror", icon: "fas fa-skull" },
  { id: "racing", label: "Racing", icon: "fas fa-flag-checkered" },
  { id: "sports", label: "Sports", icon: "fas fa-futbol" },
  { id: "fighting", label: "Fighting", icon: "fas fa-fist-raised" },
  { id: "puzzle", label: "Puzzle", icon: "fas fa-puzzle-piece" },
  { id: "runner", label: "Runner", icon: "fas fa-person-running" },
  { id: "simulation", label: "Simulation", icon: "fas fa-sliders" },
  { id: "sandbox", label: "Sandbox", icon: "fas fa-cubes" },
  { id: "idle", label: "Idle", icon: "fas fa-hourglass-half" },
  { id: "pokemon", label: "Pokemon", icon: "fas fa-circle" },
];

const PORT_URL_MARKERS = [
  "gh/freebuisness/html",
  "gh/NaoTomori1/yukios-games",
  "gn-math",
  "gh/Reeyuki",
  "yukios-games@main",
];

function getTitle(game) {
  return (game?.title ?? game?.name ?? "").toLowerCase();
}

function getUrl(game) {
  return (game?.url ?? "").toLowerCase();
}

function isPort(game, title, url) {
  if (PORT_URL_MARKERS.some((marker) => url.includes(marker))) return true;
  if (title.endsWith("webport")) return true;
  if (title.endsWith(" webport")) return true;
  if (title.includes("(webport)")) return true;
  if (title.endsWith(" port")) return true;
  if (title.includes(" - port")) return true;
  return false;
}

function isFlash(game, url) {
  if (game?.type === "swf") return true;
  if (game?.swf) return true;
  return /\.swf(\?|$|#)/.test(url);
}

function isEmulator(title, url) {
  if (/v86|jsdos|dosbox|emulator/.test(url)) return true;
  return title.includes("emulator");
}

function isFnf(title) {
  return /friday night funkin|\bfnf\b/.test(title);
}

function isHorror(title) {
  return /\b(horror|scary|granny|slender|freddy)\b|baldi|frickbear|chucky/.test(
    title,
  );
}

function isRacing(title) {
  return /racing|rider|drift|\bmoto\b|drive|speed|nascar|kart/.test(title);
}

function isSports(title) {
  return /soccer|basketball|tennis|baseball|golf|football|\bsmack|\bfishing|\bgoal\b|hockey|\bcricket|\brooks/.test(
    title,
  );
}

function isFighting(title) {
  return /fight|\bbox\b|\bpunch|\bfist|street fighter|\btekken|mort|smash|\bbrawl|combat/.test(
    title,
  );
}

function isPuzzle(title) {
  return /puzzle|tetris|\bmatch|mahjong|jigsaw|sudoku|\b2048|merge/.test(title);
}

function isRunner(title) {
  return /runner|\bdash\b|\bjump|platformer/.test(title);
}

function isSimulation(title) {
  return /simulat|\btyco|\btycoon|\btruck|farm|\bbooster|\bsim /.test(title);
}

function isSandbox(title) {
  return /sandbox|\bcraft|\bcrafter|\bbuild|\bmaker/.test(title);
}

function isIdle(title) {
  return /clicker|idle/.test(title);
}

function isPokemon(title) {
  return /pokemon|pok\u00e9mon|poke\b/.test(title);
}

function isIo(game) {
  const raw = game?.url;
  if (!raw) return false;
  const schemeEnd = raw.indexOf("://");
  if (schemeEnd === -1) return false;
  const afterScheme = raw.slice(schemeEnd + 3);
  const slashIndex = afterScheme.indexOf("/");
  const host = (
    slashIndex === -1 ? afterScheme : afterScheme.slice(0, slashIndex)
  ).toLowerCase();
  const bare = host.startsWith("www.") ? host.slice(4) : host;
  return bare.endsWith(".io");
}

export function deriveGameTags(game) {
  const tags = new Set();
  if (!game) return tags;
  const title = getTitle(game);
  const url = getUrl(game);
  if (isPort(game, title, url)) tags.add("ports");
  if (isFlash(game, url)) tags.add("flash");
  if (isEmulator(title, url)) tags.add("emulator");
  if (isFnf(title)) tags.add("fnf");
  if (isIo(game)) tags.add("io");
  if (isRacing(title)) tags.add("racing");
  if (isSports(title)) tags.add("sports");
  if (isFighting(title)) tags.add("fighting");
  if (isPuzzle(title)) tags.add("puzzle");
  if (isRunner(title)) tags.add("runner");
  if (isSimulation(title)) tags.add("simulation");
  if (isSandbox(title)) tags.add("sandbox");
  if (isIdle(title)) tags.add("idle");
  if (isPokemon(title)) tags.add("pokemon");
  if (isHorror(title)) tags.add("horror");
  return tags;
}

export function gameMatchesTag(game, tagId) {
  if (!tagId) return true;
  return deriveGameTags(game).has(tagId);
}
