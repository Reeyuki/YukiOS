import { WidgetBase } from "../widgetManager.js";

export class NotesWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "notes", "Notes", 260, 200);
    this._text = "";
    this._saveTimer = null;
  }

  onRender(contentEl) {
    const textarea = document.createElement("textarea");
    textarea.className = "widget-notes-input";
    textarea.placeholder = "Type something...";
    textarea.value = this._text;
    textarea.addEventListener("input", () => {
      this._text = textarea.value;
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.manager.saveState(), 500);
    });
    contentEl.appendChild(textarea);
  }

  getData() {
    return { text: this._text };
  }

  setData(data) {
    if (data) this._text = data.text || "";
  }

  destroy() {
    clearTimeout(this._saveTimer);
    super.destroy();
  }
}
