import { WidgetBase } from "../widgetManager.js";
import { createElement } from "../../shared/domUtils.js";

export class NotesWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "notes", "Notes", 260, 200);
    this.text = "";
    this.saveTimer = null;
  }

  onRender(contentEl) {
    const textarea = createElement("textarea");
    textarea.className = "widget-notes-input";
    textarea.placeholder = "Type something...";
    textarea.value = this.text;
    textarea.addEventListener("input", () => {
      this.text = textarea.value;
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.manager.saveState(), 500);
    });
    contentEl.appendChild(textarea);
  }

  getData() {
    return { text: this.text };
  }

  setData(data) {
    if (data) this.text = data.text || "";
  }

  destroy() {
    clearTimeout(this.saveTimer);
    super.destroy();
  }
}
