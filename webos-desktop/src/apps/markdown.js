import { decodeDataURLContent } from "../fileDisplay.js";
import { DeclarativeApp } from "../runtime/DeclarativeApp.js";

import { BaseApp, os, PersistenceTypes } from "../framework.js";
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

  getDeclarativeSchema(opts) {
    const title = opts.title || "README.md";
    const content = opts.content || "";
    const filePath = opts.filePath || null;

    return {
      id: `markdown-${title.replace(/[^a-zA-Z0-9]/g, "")}`,
      name: "Markdown",
      icon: "fab fa-markdown",
      windows: [
        {
          id: `markdown-${title.replace(/[^a-zA-Z0-9]/g, "")}`,
          title: title,
          size: ["750px", "550px"],
          icon: "fab fa-markdown",
          iconColor: "#519aba",
          ui: `<div class="window-content markdown-container">
        <article class="markdown-body" id="markdown-content"></article>
      </div>`,
          events: {}
        }
      ],
      state: {
        initial: {
          content: content,
          title: title,
          filePath: filePath
        },
        persistence: PersistenceTypes.NONE
      },
      actions: {
        init: async (payload, event, element, state) => {
          try {
            await this.loadMarked();
            this.loadMarkdownCSS();
          } catch (error) {
            os.notify.send("Markdown renderer unavailable.", "", { icon: "static/icons/markdown.webp" });
            return;
          }

          const decodedContent = decodeDataURLContent(state.content);
          const renderedContent = this.marked.parse(decodedContent);
          const contentEl = document.getElementById("markdown-content");
          if (contentEl) {
            contentEl.innerHTML = renderedContent;
          }
        }
      },
      onMount: "init"
    };
  }

  async open(title = "README.md", content = "", filePath = null) {
    const safeTitle = title && typeof title === "string" ? title : "README.md";
    const winId = `markdown-${safeTitle.replace(/[^a-zA-Z0-9]/g, "")}`;
    if (await this._isSingletonOpen(winId)) return;

    const schema = this.getDeclarativeSchema({ title: safeTitle, content, filePath });
    if (!schema.actions) schema.actions = {};
    schema.actions._appInstance = this;
    const declarativeApp = new DeclarativeApp(schema, {
      wm: this.wm,
      fs: this.fs,
      bus: this.bus,
      notifications: this.notifications
    });
    return declarativeApp.open({ title: safeTitle });
  }

  loadContent(fileName, content, filePath) {
    this.open(fileName, content, filePath);
  }
}
