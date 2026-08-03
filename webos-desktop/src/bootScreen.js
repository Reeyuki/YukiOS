import { StorageKeys, os, osName } from "./framework.js";
import logoImg from "./assets/logo.png";
import versionStr from "../version.txt?raw";
import "./styles/bootScreen.css";
import { pickAnimation } from "./bootAnimations.js";
import { KeybindManager } from "./keybindManager.js";
import { $, $$, createElement, setStyle, addClass } from "./shared/domUtils.js";
import { parseBool } from "./utils/utils.js";

const BRAND = osName();
const MIN_DURATION = 2500;

export function showBootScreen() {
  const raw = os.storage.get(StorageKeys.disableBootScreen);
  if (parseBool(raw)) {
    return { hide: () => Promise.resolve() };
  }

  const launchRaw = os.storage.get(StorageKeys.lastLaunchTime);
  if (launchRaw) {
    try {
      const lastLaunch = Number(launchRaw);
      if (!isNaN(lastLaunch) && Date.now() - lastLaunch < 5 * 60 * 1000) {
        return { hide: () => Promise.resolve() };
      }
    } catch {}
  }

  const savedId = os.storage.get(StorageKeys.selectedBootAnimation);
  const animation = pickAnimation(savedId);

  const lettersHTML = BRAND.split("")
    .map((ch) => `<span class="boot-letter">${ch === " " ? "\u00A0" : ch}</span>`)
    .join("");

  const div = createElement("div", { className: "boot-overlay" });
  div.innerHTML = `
    <div class="boot-container">
      <div class="boot-logo-wrap">
        <img class="boot-logo" src="${logoImg}" alt="${BRAND}" fetchpriority="high" />
        <div class="boot-brand">${lettersHTML}</div>
        <div class="boot-version">${versionStr}</div>
      </div>
    </div>
    <div class="boot-skip-hint">Esc · Enter · Space to skip</div>
  `;
  document.body.appendChild(div);

  const extEls = animation.createExtra ? animation.createExtra(div) || {} : {};

  const container = $(".boot-container", div);
  const logo = $(".boot-logo", div);
  const letters = $$(".boot-letter", div);
  const version = $(".boot-version", div);

  const startTime = performance.now();
  const gsap = typeof window !== "undefined" && window.gsap;

  const els = { overlay: div, container, logo, letters, version, extEls };

  let hidden = false;
  let showTl = null;

  if (gsap && typeof gsap.to === "function") {
    animation.setup(els);

    showTl = gsap.timeline();
    animation.show(showTl, els);
  } else {
    requestAnimationFrame(() => {
      addClass(div, "boot-visible");
    });

    requestAnimationFrame(() => {
      addClass(logo, "boot-visible");
    });

    requestAnimationFrame(() => {
      letters.forEach((l, i) => {
        setStyle(l, { transitionDelay: `${0.06 * i}s` });
        addClass(l, "boot-visible");
      });
    });

    requestAnimationFrame(() => {
      addClass(version, "boot-visible");
    });
  }

  const isSkipKey = (e) => e.key === "Escape" || e.key === "Enter" || e.key === " " || e.key === "Spacebar";

  const skipHandler = (e) => {
    if (!isSkipKey(e) && !KeybindManager.matches(e, "boot.skip")) return;
    e.preventDefault();
    e.stopPropagation();
    if (hidden) return;
    hidden = true;
    document.removeEventListener("keydown", skipHandler);
    if (showTl && showTl.kill) showTl.kill();
    div.remove();
  };
  document.addEventListener("keydown", skipHandler);

  return {
    hide: () => {
      const elapsed = performance.now() - startTime;
      const delay = Math.max(0, MIN_DURATION - elapsed);

      return new Promise((resolve) => {
        const doHide = () => {
          document.removeEventListener("keydown", skipHandler);
          if (hidden) {
            resolve();
            return;
          }
          hidden = true;
          if (gsap && typeof gsap.to === "function") {
            const hideTl = gsap.timeline({
              onComplete: () => {
                div.remove();
                resolve();
              }
            });
            animation.hide(hideTl, els);
          } else {
            setStyle(div, {
              transition: "opacity 0.35s ease, transform 0.35s ease",
              opacity: "0",
              transform: "scale(1.04)"
            });
            setTimeout(() => {
              div.remove();
              resolve();
            }, 400);
          }
        };

        if (delay > 0) setTimeout(doHide, delay);
        else doHide();
      });
    }
  };
}

export function runBootPreview(anim, onDone) {
  const lettersHTML = BRAND.split("")
    .map((ch) => `<span class="boot-letter">${ch === " " ? "\u00A0" : ch}</span>`)
    .join("");

  const div = createElement("div", { className: "boot-overlay" });
  div.innerHTML = `
    <div class="boot-container">
      <div class="boot-logo-wrap">
        <img class="boot-logo" src="${logoImg}" alt="${BRAND}" fetchpriority="high" />
        <div class="boot-brand">${lettersHTML}</div>
      </div>
    </div>
  `;
  document.body.appendChild(div);

  const extEls = anim.createExtra ? anim.createExtra(div) || {} : {};
  const container = $(".boot-container", div);
  const logo = $(".boot-logo", div);
  const letters = $$(".boot-letter", div);
  const version = createElement("div", { styles: { display: "none" } });
  div.appendChild(version);
  const els = { overlay: div, container, logo, letters, version, extEls };

  const gsap = typeof window !== "undefined" && window.gsap;
  if (gsap && typeof gsap.to === "function") {
    anim.setup(els);
    const showTl = gsap.timeline();
    anim.show(showTl, els);

    setTimeout(() => {
      const hideTl = gsap.timeline({
        onComplete: () => {
          div.remove();
          if (onDone) onDone();
        }
      });
      anim.hide(hideTl, els);
    }, 2000);
  } else {
    setStyle(div, { transition: "opacity 0.3s ease", opacity: "1" });
    setTimeout(() => {
      setStyle(div, { opacity: "0" });
      setTimeout(() => {
        div.remove();
        if (onDone) onDone();
      }, 400);
    }, 1000);
  }
}
