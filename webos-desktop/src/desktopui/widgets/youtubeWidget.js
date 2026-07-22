import { WidgetBase } from "../widgetManager.js";
import { os } from "../../framework.js";

export class YouTubeWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "youtube", "YouTube", 320, 240);
    this.videoId = "";
  }

  onRender(contentEl) {
    contentEl.innerHTML = `
      <div class="widget-yt-container" id="w-yt-container-${this.id}">
        <div class="widget-yt-input-row">
          <input type="text" class="widget-yt-input" id="w-yt-input-${this.id}" placeholder="Paste YouTube URL..." value="${this.videoId ? `https://youtube.com/watch?v=${this.videoId}` : ""}">
          <button class="widget-yt-btn" id="w-yt-btn-${this.id}"><i class="fas fa-play"></i></button>
        </div>
        <div class="widget-yt-embed" id="w-yt-embed-${this.id}">
          ${this.videoId ? `<iframe src="https://www.youtube-nocookie.com/embed/${this.videoId}" frameborder="0" allowfullscreen class="widget-yt-iframe"></iframe>` : `<div class="widget-yt-placeholder">Enter a YouTube URL to play</div>`}
        </div>
      </div>
    `;

    contentEl.querySelector(`#w-yt-btn-${this.id}`).addEventListener("click", () => {
      this.loadVideo(contentEl);
    });

    contentEl.querySelector(`#w-yt-input-${this.id}`).addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.loadVideo(contentEl);
    });
  }

  loadVideo(contentEl) {
    const input = contentEl.querySelector(`#w-yt-input-${this.id}`);
    if (!input) return;
    const url = input.value.trim();
    if (!url) return;

    const videoId = this.extractId(url);
    if (!videoId) {
      os.notify.send("YouTube Widget", "Invalid YouTube URL");
      return;
    }

    this.videoId = videoId;
    const embedEl = contentEl.querySelector(`#w-yt-embed-${this.id}`);
    if (embedEl) {
      embedEl.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}" frameborder="0" allowfullscreen class="widget-yt-iframe"></iframe>`;
    }
    this.manager.saveState();
  }

  extractId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }

  getData() {
    return { videoId: this.videoId };
  }

  setData(data) {
    if (data && data.videoId) {
      this.videoId = data.videoId;
    }
  }

  destroy() {
    super.destroy();
  }
}
