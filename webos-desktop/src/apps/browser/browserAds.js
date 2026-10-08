import { ADSTERRA_KEYS } from "../../ads.js";

const closeTimers = new WeakMap();
const DISMISS_KEY = "yukiBrowserAdDismissed";

function isDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch (dismissErr) {
    void dismissErr;
    return false;
  }
}

function markDismissed() {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch (markErr) {
    void markErr;
  }
}

export function bindBrowserAdClose(adBar, adClose, adSlot) {
  if (!adBar || !adClose) return;
  if (adClose.dataset.bound !== "1") {
    adClose.dataset.bound = "1";
    adClose.addEventListener("click", () => {
      if (adClose.disabled) return;
      adBar.style.display = "none";
      if (adSlot) {
        adSlot.removeAttribute("data-ads-loaded");
        adSlot.replaceChildren();
      }
      markDismissed();
      const pending = closeTimers.get(adClose);
      if (pending) {
        clearTimeout(pending);
        closeTimers.delete(adClose);
      }
    });
  }
  adClose.disabled = true;
  const pending = closeTimers.get(adClose);
  if (pending) clearTimeout(pending);
  closeTimers.set(
    adClose,
    setTimeout(() => {
      adClose.disabled = false;
      closeTimers.delete(adClose);
    }, 4000),
  );
}

export function enableBrowserAds(adBar, adClose, adSlot) {
  if (!adBar || !adSlot) return;
  if (isDismissed()) {
    adBar.style.display = "none";
    return;
  }
  if (adSlot.getAttribute("data-ads-loaded") === "1") {
    adBar.style.display = "flex";
    bindBrowserAdClose(adBar, adClose, adSlot);
    return;
  }
  adSlot.setAttribute("data-ads-loaded", "1");
  const cfg = document.createElement("script");
  cfg.text =
    "atOptions = { 'key': '" +
    ADSTERRA_KEYS.leaderboard +
    "', 'format': 'iframe', 'height': 90, 'width': 728, 'params': {} };";
  adSlot.appendChild(cfg);
  const invoke = document.createElement("script");
  invoke.async = true;
  invoke.src =
    "https://www.highperformanceformat.com/" +
    ADSTERRA_KEYS.leaderboard +
    "/invoke.js";
  adSlot.appendChild(invoke);
  adBar.style.display = "flex";
  bindBrowserAdClose(adBar, adClose, adSlot);
}

export function disableBrowserAds(adBar, adSlot) {
  if (adBar) adBar.style.display = "none";
  if (adSlot) {
    adSlot.removeAttribute("data-ads-loaded");
    adSlot.replaceChildren();
  }
}
