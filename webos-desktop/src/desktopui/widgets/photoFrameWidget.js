import { WidgetBase } from "../widgetManager.js";
import { os } from "../../framework.js";

export class PhotoFrameWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "photoframe", "Photo Frame", 200, 180);
    this._interval = null;
    this._currentIndex = 0;
    this._images = null;
    this._customPhotoPath = null;
    this._loading = false;
  }

  onRender(contentEl) {
    contentEl.innerHTML = `
      <div class="widget-photo-frame" id="w-photo-frame-${this.id}">
        <div class="widget-photo-placeholder">No photos</div>
      </div>
    `;
    this._showImage(contentEl);
    this._interval = setInterval(() => this._nextImage(), 10000);
  }

  getConfigFields() {
    return [{ key: "upload", label: "Upload a photo", type: "text", value: this._customPhotoPath || "", default: "" }];
  }

  applyConfig(data) {
    if (data.upload && data.upload !== this._customPhotoPath) {
      this._customPhotoPath = data.upload;
      if (this._contentEl) this._showImage(this._contentEl);
      this.manager.saveState();
    }
  }

  onConfigure() {
    os.dialog
      .fileOpen({ defaultFileName: "", initialPath: ["Pictures"] })
      .then((result) => {
        if (result) {
          this._customPhotoPath = result;
          if (this._contentEl) this._showImage(this._contentEl);
          this.manager.saveState();
        }
      })
      .catch(() => {
        const explorerApp = this.manager?._widgetClasses ? null : null;
        const path = ["Pictures"];
        const desktopUI = typeof window !== "undefined" ? window.__desktopUI : null;
        if (desktopUI && desktopUI.explorerApp) {
          desktopUI.explorerApp.open(path, (selectedPath) => {
            if (selectedPath) {
              this._customPhotoPath = selectedPath;
              if (this._contentEl) this._showImage(this._contentEl);
              this.manager.saveState();
            }
          });
        }
      });
  }

  async _loadImages() {
    try {
      const files = await os.fs.readdir(["Pictures"]);
      this._images = Object.entries(files)
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
      this._images = [];
    }
  }

  async _resolveImageBlob(filePath) {
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

  async _showImage(contentEl) {
    const frameEl = contentEl.querySelector(`#w-photo-frame-${this.id}`);
    if (!frameEl) return;

    if (this._customPhotoPath) {
      this._loadCustomPhoto(this._customPhotoPath, frameEl);
      return;
    }

    if (this._images === null && !this._loading) {
      this._loading = true;
      await this._loadImages();
      this._loading = false;
    }

    if (!this._images || this._images.length === 0) {
      frameEl.innerHTML = `<div class="widget-photo-placeholder">No photos</div>`;
      return;
    }

    const img = this._images[this._currentIndex];
    frameEl.innerHTML = `<img src="" alt="${img.name}" class="widget-photo-img" id="w-photo-img-${this.id}">`;

    try {
      const blob = await this._resolveImageBlob(img.path.join("/"));
      if (blob) {
        const imgEl = frameEl.querySelector("img");
        if (imgEl) imgEl.src = URL.createObjectURL(blob);
      }
    } catch {
      frameEl.innerHTML = `<div class="widget-photo-placeholder">Error loading</div>`;
    }
  }

  async _loadCustomPhoto(path, frameEl) {
    try {
      const parts = path.split("/");
      const name = parts.pop();
      const dir = parts;
      const filePath = dir.length ? dir.join("/") + "/" + name : name;
      const blob = await this._resolveImageBlob(filePath);
      if (blob) {
        frameEl.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="${name}" class="widget-photo-img">`;
      } else {
        frameEl.innerHTML = `<div class="widget-photo-placeholder">File not found</div>`;
      }
    } catch {
      frameEl.innerHTML = `<div class="widget-photo-placeholder">Error loading</div>`;
    }
  }

  _nextImage() {
    if (this._customPhotoPath || !this._images || this._images.length === 0) return;
    this._currentIndex = (this._currentIndex + 1) % this._images.length;
    if (this._contentEl) this._showImage(this._contentEl);
  }

  getData() {
    return { customPhotoPath: this._customPhotoPath };
  }

  setData(data) {
    if (data && data.customPhotoPath) {
      this._customPhotoPath = data.customPhotoPath;
    }
  }

  destroy() {
    if (this._interval) clearInterval(this._interval);
    super.destroy();
  }
}
