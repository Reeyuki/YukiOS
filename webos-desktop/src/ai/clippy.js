import { os } from "../os/index.js";
import { getLibraryUrl } from "../shared/cdnConfig.js";
import { StorageKeys } from "../StorageKeys.js";

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export const ClippyAnimation = Object.freeze({
  CheckingSomething: "CheckingSomething",
  EmptyTrash: "EmptyTrash",
  GetArtsy: "GetArtsy",
  GetWizardy: "GetWizardy",
  GestureDown: "GestureDown",
  GestureLeft: "GestureLeft",
  GestureRight: "GestureRight",
  Greeting: "Greeting",
  Hearing_1: "Hearing_1",
  IdleEyeBrowRaise: "IdleEyeBrowRaise",
  IdleFingerTap: "IdleFingerTap",
  IdleSnooze: "IdleSnooze",
  LookDown: "LookDown",
  LookDownLeft: "LookDownLeft",
  LookDownRight: "LookDownRight",
  LookUp: "LookUp",
  RestPose: "RestPose",
  Searching: "Searching",
  Show: "Show",
  Wave: "Wave",
  Writing: "Writing"
});

const CLIPPY_STORAGE_KEY = StorageKeys.clippy;
const SPEAK_COOLDOWN_MS = 50_000;

let clippyPromise = null;
let clippyEventBound = false;
let clippyPendingResolve = null;
let lastSpokenMessage = null;
let lastSpokenAt = 0;

function isExplicitlyEnabled() {
  try {
    return localStorage.getItem(CLIPPY_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function removeClippyDom() {
  document.querySelectorAll(".clippy, .clippy-balloon, .clippy-content").forEach((el) => el.remove());
}

async function setupClippy() {
  if (window.clippyAgent) return window.clippyAgent;

  const script = document.createElement("script");
  script.type = "module";
  script.textContent = `
    import { initAgent } from "${getLibraryUrl("clippyjs", "module")}";
    import * as agents from "${getLibraryUrl("clippyjs", "agents")}";
    window.clippyAgent = await initAgent(agents.Clippy);
    window.clippyAgent.show();
    window.clippyAgent.speak("Hi! I'm Clippy. I'll be here if you need me.");
    window.clippyAgent.play(${JSON.stringify(ClippyAnimation.Wave)});
  `;
  document.head.appendChild(script);

  while (!window.clippyAgent) await new Promise((r) => setTimeout(r, 50));
  return window.clippyAgent;
}

function waitForBootAndInit(resolve) {
  clippyPendingResolve = resolve;
  setupClippy()
    .then(resolve)
    .catch((err) => {
      console.warn("Clippy failed to load:", err);
      resolve(null);
    });
}

function enableClippyLive() {
  clippyPromise = new Promise((resolve) => waitForBootAndInit(resolve));
  return clippyPromise;
}

async function disableClippyLive() {
  try {
    clippyPendingResolve?.(null);
  } catch {}
  clippyPendingResolve = null;

  try {
    const clippy = await clippyPromise;
    clippy?.stop?.();
    clippy?.hide?.();
  } catch {}

  window.clippyAgent = null;
  removeClippyDom();
  clippyPromise = Promise.resolve(null);
}

export function initClippy() {
  if (!clippyEventBound) {
    clippyEventBound = true;
    window.addEventListener("yukios:clippy-toggle", (e) => setClippyEnabled(!!e?.detail?.enabled));

    os.events.on("settings:changed", (settings) => {
      if (settings && typeof settings.clippy !== "undefined") {
        setClippyEnabled(settings.clippy);
      }
    });
  }

  clippyPromise = new Promise((resolve) => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("game") || isMobile || !isExplicitlyEnabled()) return resolve(null);
    waitForBootAndInit(resolve);
  });

  return clippyPromise;
}

export function setClippyEnabled(enabled) {
  if (enabled) {
    if (window.clippyAgent) return Promise.resolve(window.clippyAgent);
    setupClippy().then((agent) => {
      window.clippyAgent = agent;
      clippyPromise = Promise.resolve(agent);
    });
    return enableClippyLive();
  }
  return disableClippyLive();
}

export async function speak(message, animation) {
  if (!clippyPromise) return;

  const now = Date.now();
  if (message === lastSpokenMessage && now - lastSpokenAt < SPEAK_COOLDOWN_MS) return;
  lastSpokenMessage = message;
  lastSpokenAt = now;

  const clippy = await clippyPromise;
  if (!clippy) return;

  clippy.speak(message);
  const clippyAnimation = animation ?? ClippyAnimation.RestPose;
  clippy.play(clippyAnimation);
}
