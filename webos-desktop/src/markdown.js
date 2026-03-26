import { desktop } from "./desktop.js";
import { decodeDataURLContent } from "./fileDisplay.js";

export class MarkdownApp {
  constructor(windowManager) {
    this.wm = windowManager;
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

  async open(title = "README.md", content = "", filePath = null) {
    try {
      await this.loadMarked();
      this.loadMarkdownCSS();
    } catch (error) {
      this.wm.sendNotify("Markdown renderer unavailable.");
      return;
    }

    const winId = `markdown-${title.replace(/[^a-zA-Z0-9]/g, "")}`;
    if (document.getElementById(winId)) {
      this.wm.bringToFront(document.getElementById(winId));
      return;
    }

    const win = this.wm.createWindow(winId, title, "750px", "550px");
    Object.assign(win.style, { left: "180px", top: "80px" });

    const decodedContent = decodeDataURLContent(content);
    const renderedContent = this.marked.parse(decodedContent);

    win.innerHTML = `
      <div class="window-header">
        <span>${title}</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="window-content markdown-container">
        <article class="markdown-body">
          ${renderedContent}
        </article>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, title, "fab fa-markdown", "#519aba");

    this.setupControls(win, title, decodedContent, filePath);
  }

  loadContent(fileName, content, filePath) {
    this.open(fileName, content, filePath);
  }
}
