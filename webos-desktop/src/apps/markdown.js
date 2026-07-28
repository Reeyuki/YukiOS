import "../styles/markdown.css";
import { decodeDataURLContent } from "../fileDisplay.js";

import { $ } from "../framework.js";
import { BaseApp, os } from "../framework.js";
export class MarkdownApp extends BaseApp {
  constructor(services) {
    super(services);
    this.marked = null;
    this.cssLoaded = false;
    this.windowStates = new Map();
  }

  async loadMarked() {
    if (this.marked) return;

    try {
      const markedModule = await import("marked");
      this.marked = markedModule.marked;

      this.marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false
      });
    } catch (error) {
      console.error("Failed to load marked.js:", error);
      throw error;
    }
  }

  loadMarkdownCSS() {
    if (this.cssLoaded) return;

    const existingLink = $("link[data-markdown-css]");
    if (existingLink) {
      this.cssLoaded = true;
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown-dark.min.css";
    link.setAttribute("data-markdown-css", "true");
    document.head.appendChild(link);
    this.cssLoaded = true;
  }

  async renderContent(winId, content) {
    await this.loadMarked();
    this.loadMarkdownCSS();
    const decoded = decodeDataURLContent(content);
    const rendered = this.marked.parse(decoded);
    const el = $(`#${winId}-content`);
    if (el) el.innerHTML = rendered;
  }

  setWindowTitle(winId, title) {
    os.window.setTitle(winId, title);
  }

  async open(fileName = "README.md", content = "", filePath = null) {
    if (typeof fileName === "object") {
      const opts = fileName;
      const winId = opts.forceId || `markdown-${Date.now()}`;
      os.window.create(winId, "Markdown", "750px", "550px", {
        icon: "fab fa-markdown",
        iconColor: "#519aba"
      });
      const win = $(`#${winId}`);
      if (win) {
        win.innerHTML = `
          <div class="window-content markdown-container">
            <article class="markdown-body" id="${winId}-content"></article>
          </div>`;
      }
      this.windowStates.set(winId, { fileName: "Markdown", content: "", filePath: null });
      return;
    }

    const winId = `markdown-${Date.now()}`;
    const win = os.window.create(winId, fileName, "750px", "550px", {
      icon: "fab fa-markdown",
      iconColor: "#519aba"
    });
    win.innerHTML = `
      <div class="window-content markdown-container">
        <article class="markdown-body" id="${winId}-content"></article>
      </div>`;

    try {
      await this.renderContent(winId, content);
      this.windowStates.set(winId, { fileName, content, filePath });
    } catch (e) {
      os.notify.send("Markdown renderer unavailable.", "", { icon: "fab fa-markdown" });
    }
  }

  getSnapshot(winId) {
    const state = this.windowStates.get(winId);
    return state ? { ...state } : null;
  }

  async restoreSnapshot(winId, snapshot) {
    if (!snapshot) return;
    this.windowStates.set(winId, { ...snapshot });
    this.setWindowTitle(winId, snapshot.fileName);
    if (snapshot.content) {
      try {
        await this.renderContent(winId, snapshot.content);
      } catch (e) {
        os.notify.send("Markdown renderer unavailable.", "", { icon: "fab fa-markdown" });
      }
    }
  }
}
