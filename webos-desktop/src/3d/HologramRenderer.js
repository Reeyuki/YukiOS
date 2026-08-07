import { resolveIconUrl } from "../shared/assetResolver.js";
import { createElement } from "../shared/domUtils.js";

export class HologramRenderer {
  constructor(pixelScale = 2) {
    this.pixelScale = pixelScale;
    this.canvas = createElement("canvas");
    this.canvas.width = 800 * pixelScale;
    this.canvas.height = 500 * pixelScale;
    this.ctx = this.canvas.getContext("2d");

    this.allItems = [];
    this.pageItems = [];
    this.currentPage = 0;
    this.totalPages = 0;
    this.itemsPerPage = 30;
    this.cols = 6;
    this.rows = 5;

    this.ticker = 0;
    this.intervalId = null;
    this.running = false;
    this.os = null;
    this.iconBitmaps = new Map();
    this.iconLoadAttempted = new Set();

    this.gridStartX = 82;
    this.gridStartY = 16;
    this.gridCellW = 106;
    this.gridCellH = 86;
    this.iconSize = 68;

    this.prevBtnBounds = null;
    this.nextBtnBounds = null;
    this.dotBounds = [];
    this.onDraw = null;
    this.dirty = true;
  }

  start(os) {
    this.os = os;
    this.running = true;
    this.refreshItems();
    this.goToPage(0);
    this.loadAllIcons();

    this.intervalId = setInterval(() => this.update(), 100);
    this.update();
  }

  loadAllIcons() {
    for (const item of this.allItems) {
      if (!item.icon || this.iconLoadAttempted.has(item.icon)) continue;
      this.iconLoadAttempted.add(item.icon);
      this.loadIconBitmap(item.icon);
    }
  }

  async loadIconBitmap(icon) {
    if (/^fa[srb]?\s+fa-/.test(icon)) return;
    let url = icon;
    try {
      url = resolveIconUrl(icon);
    } catch (e) {}

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const bitmap = await createImageBitmap(img);
        this.iconBitmaps.set(icon, bitmap);
        this.markDirty();
      }
    } catch (e) {
      /* icon failed to load, stay as fallback */
    }
  }

  stop() {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.allItems = [];
    this.pageItems = [];
    for (const b of this.iconBitmaps.values()) b.close();
    this.iconBitmaps.clear();
    this.iconLoadAttempted.clear();
    this.os = null;
  }

  refreshItems() {
    const allApps = this.os ? this.os.app.getAllApps() : {};
    const entries = Object.entries(allApps || {});
    this.allItems = entries
      .filter(([, item]) => item && item.title)
      .map(([key, item]) => ({ ...item, appId: item.serviceKey || key }));
    this.allItems.sort((a, b) => {
      if (a.type === "game" && b.type !== "game") return -1;
      if (a.type !== "game" && b.type === "game") return 1;
      return (a.title || "").localeCompare(b.title || "");
    });
    this.totalPages = Math.max(1, Math.ceil(this.allItems.length / this.itemsPerPage));
    this.markDirty();
  }

  goToPage(page) {
    this.currentPage = Math.max(0, Math.min(page, this.totalPages - 1));
    const start = this.currentPage * this.itemsPerPage;
    this.pageItems = this.allItems.slice(start, start + this.itemsPerPage);
    this.markDirty();
  }

  markDirty() {
    this.dirty = true;
  }

  update() {
    if (!this.running) return;
    this.ticker++;
    if (this.dirty) {
      this.dirty = false;
      this.draw();
    }
  }

  draw() {
    const ctx = this.ctx;
    const W = 800,
      H = 500;

    ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a18");
    grad.addColorStop(0.4, "#0e0e20");
    grad.addColorStop(0.7, "#080818");
    grad.addColorStop(1, "#060610");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(0,220,255,0.45)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("YUKIOS LIBRARY", W / 2, 10);

    this.drawGrid(ctx, W, H);
    this.drawNavigation(ctx, W, H);

    if (this.onDraw) this.onDraw();
  }

  drawGrid(ctx, W, H) {
    const { gridStartX, gridStartY, gridCellW, gridCellH, iconSize, cols, pageItems } = this;
    const r = Math.round(iconSize * 0.125);

    pageItems.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = gridStartX + col * gridCellW + gridCellW / 2;
      const cy = gridStartY + row * gridCellH + 6;
      const ix = cx - iconSize / 2;
      const iy = cy;

      ctx.shadowColor = "rgba(0,220,255,0.08)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "rgba(8,8,20,0.75)";
      this.roundRect(ctx, ix, iy, iconSize, iconSize, r);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = "rgba(0,220,255,0.12)";
      ctx.lineWidth = 0.5;
      this.roundRect(ctx, ix, iy, iconSize, iconSize, r);
      ctx.stroke();

      const bitmap = this.iconBitmaps.get(item.icon);
      if (bitmap) {
        ctx.save();
        this.roundRect(ctx, ix + 2, iy + 2, iconSize - 4, iconSize - 4, r - 1);
        ctx.clip();
        ctx.drawImage(bitmap, ix + 4, iy + 4, iconSize - 8, iconSize - 8);
        ctx.restore();
      } else {
        ctx.fillStyle = this.getIconColor(item);
        ctx.beginPath();
        ctx.arc(cx, iy + iconSize / 2, iconSize / 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "bold 20px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((item.title || "?")[0].toUpperCase(), cx, iy + iconSize / 2 + 1);
      }

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = (item.title || "").slice(0, 20);
      ctx.fillText(label, cx, iy + iconSize + 4);

      item.bounds = { x: ix, y: iy, w: iconSize, h: iconSize + 14 };
    });
  }

  getIconColor(item) {
    const hue = this.stringToHue(item.icon || item.title);
    return `hsl(${hue}, 40%, 22%)`;
  }

  stringToHue(str) {
    let hash = 0;
    for (let i = 0; i < (str || "").length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  }

  drawNavigation(ctx, W, H) {
    this.dotBounds = [];
    this.prevBtnBounds = null;
    this.nextBtnBounds = null;

    ctx.fillStyle = "rgba(0,220,255,0.35)";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${this.currentPage + 1} / ${this.totalPages}`, W / 2, H - 34 + 1);

    const maxDots = Math.min(this.totalPages, 9);
    const dotStartX = W / 2 - (maxDots * 10) / 2;
    const dotY = H - 34 + 1 + 20;
    const pageOffset = Math.max(0, Math.min(this.currentPage - Math.floor(maxDots / 2), this.totalPages - maxDots));
    for (let i = 0; i < maxDots; i++) {
      const pageIdx = pageOffset + i;
      if (pageIdx >= this.totalPages) break;
      const dx = dotStartX + i * 10;
      this.dotBounds.push({ x: dx - 3, y: dotY - 3, w: 6, h: 6, page: pageIdx });

      const proxim = Math.abs(pageIdx - this.currentPage);
      const bright = proxim === 0 ? 0.4 : Math.max(0.05, 0.25 - proxim * 0.04);
      ctx.fillStyle = `rgba(255,204,0,${bright})`;
      ctx.beginPath();
      ctx.arc(dx, dotY, proxim === 0 ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  getItemAtUV(uvX, uvY) {
    const cx = uvX * 800;
    const cy = (1 - uvY) * 500;

    if (this.prevBtnBounds && this.pointInRect(cx, cy, this.prevBtnBounds)) {
      return { type: "nav", action: "prev" };
    }
    if (this.nextBtnBounds && this.pointInRect(cx, cy, this.nextBtnBounds)) {
      return { type: "nav", action: "next" };
    }
    for (const db of this.dotBounds) {
      if (this.pointInRect(cx, cy, db)) {
        return { type: "nav", action: "goto", page: db.page };
      }
    }
    for (const item of this.pageItems) {
      if (item.bounds && this.pointInRect(cx, cy, item.bounds)) {
        return { type: "app", appId: item.appId, title: item.title };
      }
    }
    return null;
  }

  handleClick(uvX, uvY) {
    const result = this.getItemAtUV(uvX, uvY);
    if (!result) return null;

    if (result.type === "nav") {
      if (result.action === "prev") {
        const target = this.currentPage > 0 ? this.currentPage - 1 : this.totalPages - 1;
        this.goToPage(target);
        return { action: "navigate" };
      }
      if (result.action === "next" && this.currentPage < this.totalPages - 1) {
        this.goToPage(this.currentPage + 1);
        return { action: "navigate" };
      }
      if (result.page !== undefined) {
        this.goToPage(result.page);
        return { action: "navigate" };
      }
    }

    if (result.type === "app") {
      return { action: "launch", appId: result.appId, title: result.title };
    }

    return null;
  }

  pointInRect(px, py, rect) {
    return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
