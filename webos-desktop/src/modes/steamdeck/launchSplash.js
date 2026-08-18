import { createElement, setHTML } from "../../framework.js";
import { escapeHtml } from "../../utils/utils.js";
import { isUrlIcon } from "../../shared/urlUtils.js";

export const LAUNCH_SPLASH_ID = "steamdeck-launch-splash";

export class LaunchSplash {
  constructor() {
    this.active = false;
    this.el = null;
    this.revealTimer = null;
  }

  show({ title, icon, mode, description = "", stats = [] }) {
    this.close();
    this.el = createElement("div", { id: LAUNCH_SPLASH_ID });
    this.el.className = `deck-launch-layer deck-launch-${mode}`;
    const safeTitle = escapeHtml(title);
    const safeDescription = description ? `<span class="deck-launch-desc">${escapeHtml(description)}</span>` : "";
    const iconHtml = isUrlIcon(icon)
      ? `<img class="deck-launch-icon" src="${icon}" alt="${safeTitle}" loading="lazy">`
      : `<i class="deck-launch-icon ${icon}"></i>`;
    const statsHtml = stats.length
      ? `<div class="deck-launch-stats">${stats
          .map((s) => `<span class="deck-launch-stat"><i class="fas ${s.icon}"></i>${escapeHtml(s.value)}</span>`)
          .join("")}</div>`
      : "";
    setHTML(
      this.el,
      `<div class="deck-launch-backdrop"></div>
       <div class="deck-launch-card">
         <div class="deck-launch-art">${iconHtml}</div>
         <div class="deck-launch-info">
           <span class="deck-launch-eyebrow"><i class="fas fa-play"></i>Now Launching</span>
           <span class="deck-launch-title">${safeTitle}</span>
           ${safeDescription}
           <div class="deck-launch-progress"><span class="deck-launch-progress-fill"></span></div>
           ${statsHtml}
         </div>
       </div>`
    );
    document.body.appendChild(this.el);
    this.el.querySelector(".deck-launch-backdrop").addEventListener("click", () => this.reveal());
    requestAnimationFrame(() => {
      if (this.el) this.el.classList.add("open");
    });
  }

  reveal() {
    if (!this.el) return;
    if (this.revealTimer) clearTimeout(this.revealTimer);
    this.el.classList.add("closing");
    this.revealTimer = setTimeout(() => this.close(), 300);
  }

  close() {
    if (this.revealTimer) clearTimeout(this.revealTimer);
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
    this.active = false;
  }
}

export const launchSplash = typeof document !== "undefined" ? new LaunchSplash() : null;