import { decodeDataURLContent } from "./fileDisplay.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { BaseApp } from "./core/BaseApp.js";

export class MarkdownApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
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

    const decodedContent = decodeDataURLContent(content);
    const renderedContent = this.marked.parse(decodedContent);

    const windowContent = `
      <div class="window-content markdown-container">
        <article class="markdown-body">
          ${renderedContent}
        </article>
      </div>
    `;

    const win = this.windowHelper.createAndMountWindow(winId, title, windowContent, "750px", "550px", {
      icon: "fab fa-markdown",
      iconColor: "#519aba"
    });
  }

  loadContent(fileName, content, filePath) {
    this.open(fileName, content, filePath);
  }
}
