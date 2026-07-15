import { StorageKeys, os } from "./framework.js";
import logoImg from "./assets/logo.png";
import versionStr from "../version.txt?raw";
import "./styles/bootScreen.css";

const BRAND = "YUKiOS";
const MIN_DURATION = 2500;

export function showBootScreen() {
  const raw = os.storage.get(StorageKeys.disableBootScreen);
  if (raw === true || raw === "true") {
    return { hide: () => Promise.resolve() };
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
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

  const lettersHTML = BRAND.split("")
    .map((ch) => `<span class="boot-letter">${ch === " " ? "\u00A0" : ch}</span>`)
    .join("");

  const div = document.createElement("div");
  div.className = "boot-overlay";
  div.innerHTML = `
    <div class="boot-container">
      <div class="boot-logo-wrap">
        <img class="boot-logo" src="${logoImg}" alt="YukiOS" />
        <div class="boot-brand">${lettersHTML}</div>
        <div class="boot-version">${versionStr}</div>
      </div>
    </div>
  `;
  div.style.cssText = "opacity:0";
  document.body.appendChild(div);

  const logo = div.querySelector(".boot-logo");
  const letters = div.querySelectorAll(".boot-letter");
  const version = div.querySelector(".boot-version");

  const startTime = performance.now();
  const gsap = typeof window !== "undefined" && window.gsap;

  if (gsap && typeof gsap.to === "function") {
    gsap.set(div, { opacity: 0 });
    gsap.set(logo, { opacity: 0, scale: 0.5 });
    gsap.set(letters, { opacity: 0, y: 16 });
    gsap.set(version, { opacity: 0 });

    const tl = gsap.timeline();

    tl.to(div, { opacity: 1, duration: 0.3, ease: "power2.out" });

    tl.to(
      logo,
      {
        opacity: 1,
        scale: 1,
        duration: 0.6,
        ease: "back.out(1.4)"
      },
      "-=0.1"
    );

    tl.to(
      letters,
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        stagger: 0.07,
        ease: "power2.out"
      },
      "-=0.3"
    );

    tl.to(version, { opacity: 1, duration: 0.35, ease: "power2.out" }, "-=0.15");
  } else {
    requestAnimationFrame(() => {
      div.style.transition = "opacity 0.3s ease";
      div.style.opacity = "1";
    });

    requestAnimationFrame(() => {
      logo.style.transition = "opacity 0.5s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)";
      logo.style.opacity = "1";
      logo.style.transform = "scale(1)";
    });

    requestAnimationFrame(() => {
      letters.forEach((l, i) => {
        l.style.transition = "opacity 0.35s ease, transform 0.35s ease";
        l.style.transitionDelay = `${0.06 * i}s`;
        l.style.opacity = "1";
        l.style.transform = "translateY(0)";
      });
    });

    requestAnimationFrame(() => {
      version.style.transition = "opacity 0.4s ease";
      version.style.opacity = "1";
    });
  }

  return {
    hide: () => {
      const elapsed = performance.now() - startTime;
      const delay = Math.max(0, MIN_DURATION - elapsed);

      return new Promise((resolve) => {
        const doHide = () => {
          if (gsap && typeof gsap.to === "function") {
            const tl = gsap.timeline({
              onComplete: () => {
                div.remove();
                resolve();
              }
            });

            tl.to(letters, { opacity: 0, y: -12, duration: 0.15, stagger: 0.03, ease: "power2.in" });
            tl.to(logo, { opacity: 0, scale: 0.6, duration: 0.15, ease: "power2.in" }, "-=0.1");
            tl.to(div, { opacity: 0, scale: 1.04, duration: 0.35, ease: "power2.inOut" }, "-=0.1");
          } else {
            div.style.transition = "opacity 0.35s ease, transform 0.35s ease";
            div.style.opacity = "0";
            div.style.transform = "scale(1.04)";
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
