import { StorageKeys } from "./settings.js";

let clippyPromise = null;
async function setupClippy() {
  const script = document.createElement("script");
  script.type = "module";
  script.textContent = `
    import { initAgent } from "https://cdn.jsdelivr.net/npm/clippyjs/dist/index.mjs";
    import * as agents from "https://cdn.jsdelivr.net/npm/clippyjs/dist/agents/index.mjs";
    window.clippyAgent = await initAgent(agents.Clippy);
    window.clippyAgent.show();
    window.clippyAgent.speak("Hi! I'm Clippy. I'll be here if you need me.");
    window.clippyAgent.play("Wave");
  `;
  document.head.appendChild(script);
  while (!window.clippyAgent) await new Promise((r) => setTimeout(r, 50));
  return window.clippyAgent;
}

export function initClippy(settingsApp) {
  clippyPromise = new Promise((resolve) => {
    const clippyEnabled = localStorage.getItem(StorageKeys.clippy) !== "false";
    if (!clippyEnabled) return resolve(null);

    const bootloader = document.getElementById("bootloader");
    const tryInit = () => {
      setupClippy()
        .then(resolve)
        .catch((err) => {
          console.warn("Clippy failed to load:", err);
          resolve(null);
        });
    };

    if (!bootloader || bootloader.classList.contains("hidden")) {
      tryInit();
    } else {
      const observer = new MutationObserver(() => {
        if (bootloader.classList.contains("hidden")) {
          observer.disconnect();
          tryInit();
        }
      });
      observer.observe(bootloader, { attributes: true, attributeFilter: ["class"] });
    }
  });

  return clippyPromise;
}
export async function speak(message, animation) {
  if (!clippyPromise) return;
  console.log("Speaking: ", message, animation);
  const clippy = await clippyPromise;
  if (!clippy) return;
  clippy.speak(message);
  animation === "animate" ? clippy.animate() : clippy.play(animation);
}
