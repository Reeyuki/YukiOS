import { decodeDataURLContent } from "../fileDisplay.js";

import { BaseApp, os } from "../framework.js";
export class MarkdownApp extends BaseApp {
  constructor(services) {
    super(services);
    this.marked = null;
    this.cssLoaded = false;
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

    const existingLink = document.querySelector("link[data-markdown-css]");
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

  async open(fileName = "README.md", content = "", filePath = null) {
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
      await this.loadMarked();
      this.loadMarkdownCSS();
      const decoded = decodeDataURLContent(content);
      const rendered = this.marked.parse(decoded);
      const el = win.querySelector(`#${winId}-content`);
      if (el) el.innerHTML = rendered;
    } catch (e) {
      os.notify.send("Markdown renderer unavailable.", "", { icon: "fab fa-markdown" });
    }
  }
}
