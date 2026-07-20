import { StorageKeys, os } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";

const CATEGORY_ORDER = ["navigation", "resize", "swap", "windows", "workspaces", "system"];
const CATEGORY_LABELS = {
  navigation: "Navigation",
  resize: "Resize",
  swap: "Swap Windows",
  windows: "Windows",
  workspaces: "Workspaces",
  system: "System"
};
const CATEGORY_ICONS = {
  navigation: "fas fa-arrows-alt",
  resize: "fas fa-expand-alt",
  swap: "fas fa-arrow-right-arrow-left",
  windows: "fas fa-window-maximize",
  workspaces: "fas fa-desktop",
  system: "fas fa-cog"
};

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function getCategory(id) {
  if (id.includes("focusWorkspace")) return "workspaces";
  if (id.includes("focus") || id.includes("cycle")) return "navigation";
  if (id.includes("resize")) return "resize";
  if (id.includes("swap")) return "swap";
  if (id.includes("fullscreen") || id.includes("floating") || id.includes("close")) return "windows";
  return "system";
}

export function buildTilingKeybindHTML(searchLower) {
  const all = KeybindManager.getAll();
  const tiling = all.filter((k) => k.id && k.id.startsWith("tiling."));

  const groups = {};
  tiling.forEach((k) => {
    const cat = getCategory(k.id);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(k);
  });

  let html = "";
  CATEGORY_ORDER.forEach((cat) => {
    const items = groups[cat];
    if (!items || items.length === 0) return;
    const filtered = searchLower
      ? items.filter((k) => k.desc.toLowerCase().includes(searchLower))
      : items;
    if (filtered.length === 0) return;
    html += `<div class="tiling-kb-category"><div class="tiling-kb-cat-title"><i class="${CATEGORY_ICONS[cat]}"></i>${CATEGORY_LABELS[cat]}</div><div class="tiling-kb-items">`;
    filtered.forEach((k) => {
      const keys = (k.currentKeys || k.defaultKeys || []).join(" + ");
      html += `<div class="tiling-kb-row"><kbd>${esc(keys)}</kbd><span>${esc(k.desc)}</span></div>`;
    });
    html += `</div></div>`;
  });

  if (!html) html = `<p style="padding:16px;text-align:center;color:var(--tiling-bar-text-secondary);font-size:13px">No matching shortcuts</p>`;
  return html;
}

export class TilingKeybindOverlay {
  constructor(bar) {
    this.bar = bar;
    this.el = null;
    this.isOpen = false;
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    if (this.el) {
      this.el.style.display = "flex";
      this.isOpen = true;
      return;
    }
    this.el = document.createElement("div");
    this.el.id = "tiling-keybind-overlay";
    const pos = os.storage.get(StorageKeys.tilingBarPosition) || "top";
    if (pos === "bottom") this.el.classList.add("position-bottom");
    this.render();
    document.body.appendChild(this.el);
    this.isOpen = true;
    setTimeout(() => {
      const close = (e) => {
        if (this.el && !this.el.contains(e.target) && e.target.id !== "tiling-keybind-hint") {
          this.close();
          document.removeEventListener("click", close);
        }
      };
      document.addEventListener("click", close);
    }, 0);
  }

  close() {
    if (this.el) this.el.style.display = "none";
    this.isOpen = false;
  }

  render() {
    if (!this.el) return;
    const bodyHtml = buildTilingKeybindHTML("");
    this.el.innerHTML = `<div class="tiling-kb-header"><i class="fas fa-keyboard"></i><span>Tiling Keyboard Shortcuts</span></div><div class="tiling-kb-body">${bodyHtml}</div>
      <div class="tiling-kb-footer">
        <button class="tiling-kb-hide-btn" id="tiling-kb-hide-btn">
          <i class="fas fa-eye-slash"></i> Hide this
        </button>
      </div>`;

    const hideBtn = this.el.querySelector("#tiling-kb-hide-btn");
    if (hideBtn) {
      hideBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        os.storage.set(StorageKeys.tilingKeybindHintHidden, "true");
        this.close();
        if (this.bar && this.bar.hideKeybindHint) {
          this.bar.hideKeybindHint();
        }
      });
    }
  }

  destroy() {
    this.close();
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this.el = null;
  }
}
