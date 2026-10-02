import { os } from "../framework.js";
import { getEffectiveIcon } from "./iconPack.js";
import { resolveIconUrl } from "./assetResolver.js";
import { $ } from "./domUtils.js";

export function initLiveIconRefresh() {
  os.events.on("icon-pack-changed", () => {
    document.querySelectorAll(".window-header").forEach((header) => {
      const winId = header.closest(".window")?.id;
      if (winId && os.windowManager?.openWindows?.get(winId)) {
        const entry = os.windowManager.openWindows.get(winId);
        const raw = entry.record?.icon || entry.iconValue || entry.rawIcon;
        const eff = getEffectiveIcon(raw);
        const iconEl = header.querySelector("img, i, svg");
        if (iconEl) {
          const isPapirus = eff.startsWith("papirus:");
          let newEl;
          if (isPapirus) {
            newEl = document.createElement("img");
            newEl.src = resolveIconUrl(eff);
            newEl.className = "papirus-icon papirus-icon--16";
            newEl.dataset.rawIcon = raw;
          } else {
            newEl = document.createElement("i");
            newEl.className = eff;
            newEl.dataset.rawIcon = raw;
          }
          iconEl.replaceWith(newEl);
          if (window.FontAwesome?.dom?.i2svg) window.FontAwesome.dom.i2svg({ node: newEl.parentNode });
        }
      }
    });
    document.querySelectorAll("img.papirus-icon").forEach((img) => {
      const raw = img.dataset.rawIcon;
      const src = img.getAttribute("src") || img.src;
      let papirusKey = raw;
      if (!papirusKey && src && src.includes("/Papirus/")) {
        const part = src.split("/Papirus/")[1];
        const slash = part.indexOf("/");
        if (slash !== -1) {
          const path = part.slice(slash + 1).replace(/\.svg.*$/, "");
          papirusKey = `papirus:${path}`;
        }
      }
      if (!papirusKey) return;
      const eff = getEffectiveIcon(papirusKey);
      if (!eff.startsWith("papirus:")) {
        const newEl = document.createElement("i");
        newEl.className = eff;
        newEl.dataset.rawIcon = papirusKey;
        img.replaceWith(newEl);
        if (window.FontAwesome?.dom?.i2svg) window.FontAwesome.dom.i2svg({ node: newEl.parentNode });
      }
    });
    document.querySelectorAll("svg.svg-inline--fa, i[class*='fa-']").forEach((el) => {
      const raw = el.dataset.rawIcon || el.closest("[data-raw-icon]")?.dataset.rawIcon;
      if (!raw) return;
      const eff = getEffectiveIcon(raw);
      if (eff.startsWith("papirus:")) {
        const newEl = document.createElement("img");
        newEl.src = resolveIconUrl(eff);
        newEl.className = "papirus-icon papirus-icon--22";
        newEl.dataset.rawIcon = raw;
        el.replaceWith(newEl);
      }
    });
    if (window.FontAwesome?.dom?.i2svg) window.FontAwesome.dom.i2svg();
  });
}
