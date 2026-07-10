import { WidgetBase } from "../widgetManager.js";
import { StorageKeys, os } from "../../framework.js";

export class ClipboardWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "clipboard", "Clipboard", 260, 180);
    this.interval = null;
  }

  onRender(contentEl) {
    contentEl.innerHTML = `
      <div class="widget-clipboard-current" id="w-clip-current-${this.id}">
        <div class="widget-clipboard-label">Current</div>
        <div class="widget-clipboard-value" id="w-clip-value-${this.id}">--</div>
      </div>
      <div class="widget-clipboard-label" style="margin-top:8px;">History</div>
      <div class="widget-clipboard-list" id="w-clip-list-${this.id}"></div>
    `;

    this.refresh(contentEl);
    this.interval = setInterval(() => this.refresh(contentEl), 2000);
  }

  refresh(ce) {
    const currentEl = ce.querySelector(`#w-clip-value-${this.id}`);
    const listEl = ce.querySelector(`#w-clip-list-${this.id}`);
    if (!currentEl || !listEl) return;

    const current = os.storage.get(StorageKeys.clipboardCurrent);
    currentEl.textContent = current ? (current.length > 60 ? current.slice(0, 60) + "..." : current) : "Empty";

    const history = os.storage.get(StorageKeys.clipboardHistory);
    if (Array.isArray(history) && history.length > 0) {
      listEl.innerHTML = history
        .slice(0, 5)
        .map((item) => {
          const data = typeof item === "string" ? item : item.data || "";
          const preview = data.length > 40 ? data.slice(0, 40) + "..." : data;
          return `<div class="widget-clipboard-item">${this.escapeHtml(preview)}</div>`;
        })
        .join("");
    } else {
      listEl.innerHTML = `<div class="widget-clipboard-empty">No history</div>`;
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    if (this.interval) clearInterval(this.interval);
    super.destroy();
  }
}
