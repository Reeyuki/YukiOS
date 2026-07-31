import { WidgetBase } from "../widgetManager.js";
import { os } from "../../framework.js";

export class PhotoFrameWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "photoframe", "Photo Frame", 200, 180);
    this.interval = null;
    this.currentIndex = 0;
    this.images = null;
    this.customPhotoPath = null;
    this.loading = false;
  }

  onRender(contentEl) {
    contentEl.innerHTML = `
      <div class="widget-photo-frame" id="w-photo-frame-${this.id}">
        <div class="widget-photo-placeholder">No photos</div>
      </div>
    `;
    this.showImage(contentEl);
    this.interval = setInterval(() => this.nextImage(), 10000);
  }

  getConfigFields() {
    return [{ key: "upload", label: "Upload a photo", type: "text", value: this.customPhotoPath || "", default: "" }];
  }

  applyConfig(data) {
    if (data.upload && data.upload !== this.customPhotoPath) {
      this.customPhotoPath = data.upload;
      if (this.contentEl) this.showImage(this.contentEl);
      this.manager.saveState();
    }
  }

  onConfigure() {
    os.dialog.fileOpen({ defaultFileName: "", initialPath: ["Pictures"] }).then((result) => {
      if (result) {
        this.customPhotoPath = result;
        if (this.contentEl) this.showImage(this.contentEl);
        this.manager.saveState();
      }
    });
  }

  async loadImages() {
    try {
      const files = await os.fs.readdir(["Pictures"]);
      this.images = Object.entries(files)
        .filter(([name, data]) => {
          if (data?.type !== "file") return false;
          const ext = name.split(".").pop().toLowerCase();
          return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
        })
        .map(([name]) => ({
          name,
          path: ["Pictures", name]
        }));
    } catch {
      this.images = [];
    }
  }

  async resolveImageBlob(filePath) {
    const raw = await os.fs.read(filePath, { encoding: "binary" });
    if (!raw || raw.length === 0) return null;
    const asText = typeof raw === "string" ? raw : new TextDecoder("utf-8").decode(raw);
    if (asText.startsWith("http://") || asText.startsWith("https://")) {
      return await (await fetch(asText)).blob();
    }
    if (asText.startsWith("data:")) {
      return await (await fetch(asText)).blob();
    }
    return new Blob([raw], { type: "image/jpeg" });
  }

  async showImage(contentEl) {
    const frameEl = contentEl.querySelector(`#w-photo-frame-${this.id}`);
    if (!frameEl) return;

    if (this.customPhotoPath) {
      this.loadCustomPhoto(this.customPhotoPath, frameEl);
      return;
    }

    if (this.images === null && !this.loading) {
      this.loading = true;
      await this.loadImages();
      this.loading = false;
    }

    if (!this.images || this.images.length === 0) {
      frameEl.innerHTML = `<div class="widget-photo-placeholder">No photos</div>`;
      return;
    }

    const img = this.images[this.currentIndex];
    frameEl.innerHTML = `<img src="" alt="${img.name}" class="widget-photo-img" id="w-photo-img-${this.id}">`;

    try {
      const blob = await this.resolveImageBlob(img.path.join("/"));
      if (blob) {
        const imgEl = frameEl.querySelector("img");
        if (imgEl) imgEl.src = URL.createObjectURL(blob);
      }
    } catch {
      frameEl.innerHTML = `<div class="widget-photo-placeholder">Error loading</div>`;
    }
  }

  async loadCustomPhoto(path, frameEl) {
    try {
      const parts = path.split("/");
      const name = parts.pop();
      const dir = parts;
      const filePath = dir.length ? dir.join("/") + "/" + name : name;
      const blob = await this.resolveImageBlob(filePath);
      if (blob) {
        frameEl.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="${name}" class="widget-photo-img">`;
      } else {
        frameEl.innerHTML = `<div class="widget-photo-placeholder">File not found</div>`;
      }
    } catch {
      frameEl.innerHTML = `<div class="widget-photo-placeholder">Error loading</div>`;
    }
  }

  nextImage() {
    if (this.customPhotoPath || !this.images || this.images.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    if (this.contentEl) this.showImage(this.contentEl);
  }

  getData() {
    return { customPhotoPath: this.customPhotoPath };
  }

  setData(data) {
    if (data && data.customPhotoPath) {
      this.customPhotoPath = data.customPhotoPath;
    }
  }

  destroy() {
    if (this.interval) clearInterval(this.interval);
    super.destroy();
  }
}
