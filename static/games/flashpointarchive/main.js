let entry = null;
let gameZip = null;

const GAMES_BASE = "https://cdn.jsdelivr.net/gh/Reeyuki/yukios-games@main/";
const RAW_GAMES_BASE = "https://raw.githubusercontent.com/Reeyuki/yukios-games/main/";
const HTDOCS = "flashpointarchive/infinity.unstable.life/Flashpoint/Legacy/htdocs/";
const ZIPS = "flashpointarchive/download.unstable.life/gib-roms/Games/";
const LEGACY_URL = new URL("https://infinity.unstable.life/Flashpoint/Legacy/htdocs/");

const name = new URLSearchParams(window.location.search).get("fpGameName");
const request = GAMES_BASE + name + "/metadata.json";
const fallbackRequest = GAMES_BASE + HTDOCS + "miniclip.com/games/" + name + "/metadata.json";

const nativeFetch = window.fetch;

const redirect = async (requestUrl) => {
  let url = {
    original: new URL(
      [location.origin, "https://cdn.jsdelivr.net", "https://raw.githubusercontent.com", LEGACY_URL.origin].some(
        (origin) => origin == requestUrl.origin,
      )
        ? requestUrl.pathname.substring(1)
        : requestUrl.href,
      entry.launchCommand,
    ),
    redirect: "",
  };

  if (gameZip != null) {
    const cleanUrl = decodeURIComponent(
      "content/" + url.original.hostname + url.original.pathname,
    ).toLowerCase();
    const match = Object.entries(gameZip.files).find(
      (item) => item[0].toLowerCase() === cleanUrl,
    );
    if (match !== undefined) {
      const file = match[1];
      if (file && !file.dir) {
        url.redirect = URL.createObjectURL(await file.async("blob"));
        return url;
      }
    }
  }

  url.redirect = GAMES_BASE + HTDOCS + url.original.hostname + url.original.pathname;
  return url;
};

const playerSource = "https://unpkg.com/@ruffle-rs/ruffle";

const players = [
  {
    source: playerSource,
    platforms: ["Flash"],
    extensions: [".swf"],

    get override() {
      const player = window.RufflePlayer;
      if (window.RufflePlayer != null) {
        const extension = player.sources.extension;
        return (
          extension != null &&
          Date.now() - new Date(extension.version.split("+")[1]).getTime() < 86400000
        );
      }
      return false;
    },

    async initialize() {
      window.fetch = async (resource, options) => {
        let urlString;
        if (resource instanceof Request) {
          urlString = resource.url;
        } else if (typeof resource === "string") {
          urlString = resource;
        } else {
          return nativeFetch(resource, options);
        }

        let resourceURL;
        try {
          resourceURL = new URL(urlString, location.origin);
        } catch {
          return nativeFetch(resource, options);
        }

        if (urlString.startsWith("blob:") || urlString.startsWith("data:")) {
          return nativeFetch(resource, options);
        }

        if (
          !resourceURL.protocol.startsWith("http") ||
          playerSource.startsWith(resourceURL.origin) ||
          GAMES_BASE.startsWith(resourceURL.origin) ||
          RAW_GAMES_BASE.startsWith(resourceURL.origin)
        ) {
          return nativeFetch(resource, options);
        }

        const redirectInfo = await redirect(resourceURL);
        const redirected = redirectInfo.redirect;

        if (redirected.startsWith("blob:") || redirected.startsWith("data:")) {
          return nativeFetch(redirected, options);
        }

        const response = await nativeFetch(redirected, options);
        Object.defineProperty(response, "url", {
          value: redirectInfo.original.href,
        });
        return response;
      };

      let player = window.RufflePlayer.newest().createPlayer();
      player.config.base = entry.launchCommand.substring(
        0,
        entry.launchCommand.lastIndexOf("/") + 1,
      );
      player.config.allowScriptAccess = true;

      document.querySelector(".player").append(player);
      player.load(entry.launchCommand);

      player.addEventListener("loadedmetadata", () => {
        if (player.metadata.width > 1 && player.metadata.height > 1) {
          player.style.width = player.metadata.width + "px";
          player.style.height = player.metadata.height + "px";
        }
      });
    },
  },
];

async function fetchEntry(url) {
  const response = await nativeFetch(url);
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}

async function loadZip() {
  const file = `${entry.uuid}-${entry.utcMilli}.zip`;
  const sources = [GAMES_BASE + ZIPS + file, RAW_GAMES_BASE + ZIPS + file];
  for (const url of sources) {
    try {
      const response = await nativeFetch(url);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const blob = await response.blob();
      gameZip = await new JSZip().loadAsync(blob);
      return;
    } catch (err) {
      console.warn(`Failed to load zip from ${url}:`, err);
    }
  }
  throw new Error("Failed to load game zip");
}

async function loadEntry(request) {
  try {
    entry = await fetchEntry(request);
  } catch (err) {
    console.warn(`Failed to load primary entry (${request}):`, err);
    try {
      entry = await fetchEntry(fallbackRequest);
    } catch (fallbackErr) {
      console.error("Failed to load fallback entry:", fallbackErr);
      const header = document.querySelector(".header");
      if (header) header.textContent = "The specified entry is invalid.";
      document.querySelectorAll(".content *:not(.header)").forEach((elem) => {
        elem.style.display = "none";
      });
      return;
    }
  }

  document.title = entry.title + " - 9o3o";
  document.querySelector(".header").textContent = entry.title;

  document.querySelector(".info").href =
    "https://flashpointproject.github.io/flashpoint-database/search/#" + entry.uuid;
  document.querySelector(".link").href = "./?" + entry.uuid;

  let total = entry.votesWorking + entry.votesBroken;
  if (total > 0) {
    document.querySelector(".fraction").textContent =
      Math.round((entry.votesWorking / total) * 100) / 10 + "/10";
    document.querySelector(".total").textContent = total;
  }

  document.querySelectorAll(".button").forEach((elem) =>
    elem.addEventListener("click", () => {
      document.querySelector(".vote").textContent = "Thank you.";
    }),
  );

  let p = Math.max(
    0,
    players.findIndex((player) =>
      player.extensions.some((ext) =>
        new URL(entry.launchCommand).pathname.toLowerCase().endsWith(ext),
      ),
    ),
  );

  if (players[p].override) prepareEntry();
  else {
    let script = document.createElement("script");
    script.src = players[p].source;
    script.addEventListener("load", prepareEntry);
    document.head.append(script);
  }

  async function prepareEntry() {
    if (entry.isZipped) {
      try {
        await loadZip();
      } catch {
        let player = document.querySelector(".player");
        player.style.fontSize = "12px";
        player.style.padding = "16px 0 20px";
        player.textContent = "Failed to load entry. This is not an emulator issue.";
        return;
      }
    }
    players[p].initialize();
  }
}

loadEntry(request);
