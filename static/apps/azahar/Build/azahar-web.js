function resolveElement(target) {
  if (!target) {
    return document.body;
  }
  if (typeof target === "string") {
    const element = document.querySelector(target);
    if (!element) {
      throw new Error(`Could not find mount target: ${target}`);
    }
    return element;
  }
  return target;
}

function ensureTrailingSlash(text) {
  return text.endsWith("/") ? text : `${text}/`;
}

function buildFrontendUrl(frontendUrl, renderer, hwShaders) {
  const url = new URL(ensureTrailingSlash(frontendUrl), window.location.href);
  url.searchParams.set("embed", "1");
  if (renderer === "software") {
    url.searchParams.set("renderer", "software");
  } else if (renderer === "webgl-full") {
    url.searchParams.set("renderer", "webgl-full");
  } else {
    url.searchParams.set("renderer", "webgl");
    if (hwShaders) {
      url.searchParams.set("hwshaders", "on");
    } else {
      url.searchParams.delete("hwshaders");
    }
  }
  return url.toString();
}

function guessFileName(url, fallback) {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    const leaf = pathname.split("/").filter(Boolean).pop();
    return leaf || fallback;
  } catch {
    return fallback;
  }
}

async function fetchBytes(url, fetchInit) {
  const response = await fetch(url, fetchInit);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

class AzaharWebPlayer {
  constructor(options = {}) {
    this.options = {
      target: document.body,
      frontendUrl: "./",
      renderer: "webgl",
      hwShaders: false,
      autoLoadCore: true,
      width: "100%",
      height: "100%",
      ...options,
    };
    this.mount = resolveElement(this.options.target);
    this.iframe = null;
    this.app = null;
    this.ready = null;
  }

  async init() {
    if (this.ready) {
      return this.ready;
    }

    const iframe = document.createElement("iframe");
    iframe.src = buildFrontendUrl(
      this.options.frontendUrl,
      this.options.renderer,
      this.options.hwShaders,
    );
    iframe.allow = "fullscreen";
    iframe.style.width = this.options.width;
    iframe.style.height = this.options.height;
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.background = "#000";
    this.mount.replaceChildren(iframe);
    this.iframe = iframe;

    this.ready = (async () => {
      await new Promise((resolve, reject) => {
        iframe.addEventListener("load", resolve, { once: true });
        iframe.addEventListener("error", () => reject(new Error("Failed to load Azahar frontend")), {
          once: true,
        });
      });
      this.app = await this.waitForApp();
      if (this.options.autoLoadCore) {
        await this.app.loadCore();
      }
      if (this.options.sdEntries?.length) {
        await this.importSdEntriesFromUrls(this.options.sdEntries, {
          autoSelectExecutable: false,
        });
      }
      if (this.options.autoBoot) {
        await this.handleAutoBoot(this.options.autoBoot);
      }
      return this;
    })();

    return this.ready;
  }

  async waitForApp(timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const app = this.iframe?.contentWindow?.AzaharWebApp;
      if (app) {
        return app;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Timed out waiting for Azahar frontend API");
  }

  async call(method, ...args) {
    await this.init();
    const fn = this.app?.[method];
    if (typeof fn !== "function") {
      throw new Error(`Azahar frontend API is missing method: ${method}`);
    }
    return fn(...args);
  }

  async handleAutoBoot(autoBoot) {
    if (autoBoot.homebrew) {
      if (Array.isArray(autoBoot.homebrew)) {
        await this.importSdEntriesFromUrls(autoBoot.homebrew);
      } else {
        await this.bootHomebrewFromUrl(autoBoot.homebrew.url, autoBoot.homebrew);
        return;
      }
    }
    if (autoBoot.romUrl) {
      await this.bootRomFromUrl(autoBoot.romUrl, autoBoot);
    }
  }

  async loadCore() {
    return this.call("loadCore");
  }

  async unloadGame() {
    return this.call("unloadGame");
  }

  async stopCore() {
    return this.call("stopCore");
  }

  async resetCore() {
    return this.call("resetCore");
  }

  async selectRomData(name, bytes, options = {}) {
    return this.call("selectRomData", name, bytes, options);
  }

  async bootSelected() {
    return this.call("bootGame");
  }

  async bootRomData(name, bytes, options = {}) {
    return this.call("bootRomData", name, bytes, options);
  }

  async bootRomFromUrl(url, options = {}) {
    const bytes = await fetchBytes(url, options.fetchInit);
    const name = options.name || guessFileName(url, "game.3ds");
    return this.bootRomData(name, bytes, options);
  }

  async bootHomebrewFromUrl(url, options = {}) {
    const bytes = await fetchBytes(url, options.fetchInit);
    const name = options.name || guessFileName(url, "app.3dsx");
    return this.bootRomData(name, bytes, options);
  }

  async importSdEntries(entries, options = {}) {
    return this.call("importSdEntries", entries, options);
  }

  async importSdEntriesFromUrls(entries, options = {}) {
    const resolved = await Promise.all(
      Array.from(entries || []).map(async (entry) => {
        const bytes = await fetchBytes(entry.url, entry.fetchInit);
        return {
          name: entry.name || guessFileName(entry.url, "file.bin"),
          bytes,
          relativePath: entry.relativePath,
          virtualPath: entry.virtualPath,
        };
      }),
    );
    return this.importSdEntries(resolved, options);
  }

  async getState() {
    return this.call("getState");
  }

  destroy() {
    this.app = null;
    this.ready = null;
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
  }
}

async function createAzaharWeb(options = {}) {
  const player = new AzaharWebPlayer(options);
  await player.init();
  return player;
}

const azaharWebApi = { AzaharWebPlayer, createAzaharWeb };

if (typeof globalThis !== "undefined") {
  globalThis.AzaharWeb = azaharWebApi;
  globalThis.AzaharWebPlayer = AzaharWebPlayer;
  globalThis.createAzaharWeb = createAzaharWeb;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = azaharWebApi;
}
