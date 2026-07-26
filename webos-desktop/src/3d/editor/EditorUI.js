const FA_ICONS = {
  "wooden-chair": "\uf6c0",
  "wastebin": "\uf1f8",
  "crate": "\uf466",
  "barrel": "\uf0fc",
  "small-table": "\uf0ce",
  "desk-plant": "\uf06c",
  "wall-poster": "\uf5aa",
  "wall-clock": "\uf017",
  "painting": "\uf1fc",
  "floor-lamp": "\uf0eb",
  "rug": "\uf7a4",
  "desk-cases": "\uf02d",
  "gold-trophy": "\uf091",
  "neon-sign": "\uf0e7"
};

function drawIconChair(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.08);
  const p = s * 0.15;
  const cx = x + s / 2;
  const cy = y + s * 0.6;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy + s * 0.25);
  ctx.lineTo(cx - s * 0.3, cy - s * 0.25);
  ctx.lineTo(cx + s * 0.3, cy - s * 0.25);
  ctx.lineTo(cx + s * 0.3, cy + s * 0.25);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.25, cy - s * 0.25);
  ctx.lineTo(cx - s * 0.25, cy - s * 0.4);
  ctx.lineTo(cx + s * 0.25, cy - s * 0.4);
  ctx.lineTo(cx + s * 0.25, cy - s * 0.25);
  ctx.stroke();
}

function drawIconWastebin(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.08);
  const cx = x + s / 2;
  const cy = y + s * 0.55;
  const w = s * 0.35;
  const h = s * 0.4;
  ctx.beginPath();
  ctx.moveTo(cx - w, cy + h);
  ctx.lineTo(cx - w * 0.7, cy);
  ctx.lineTo(cx + w * 0.7, cy);
  ctx.lineTo(cx + w, cy + h);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, cy - h * 0.3);
  ctx.lineTo(cx + w * 0.5, cy - h * 0.3);
  ctx.stroke();
}

function drawIconCrate(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.07);
  const cx = x + s / 2;
  const cy = y + s / 2;
  const hs = s * 0.32;
  ctx.strokeRect(cx - hs, cy - hs * 0.7, hs * 2, hs * 1.4);
  ctx.beginPath();
  ctx.moveTo(cx - hs, cy - hs * 0.7);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + hs, cy - hs * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - hs * 0.7);
  ctx.lineTo(cx, cy + hs * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - hs, cy);
  ctx.lineTo(cx + hs, cy);
  ctx.stroke();
}

function drawIconBarrel(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.07);
  const cx = x + s / 2;
  const cy = y + s / 2;
  const hw = s * 0.3;
  const hh = s * 0.35;
  ctx.beginPath();
  ctx.ellipse(cx, cy - hh, hw, hh * 0.25, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy + hh, hw, hh * 0.25, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy - hh);
  ctx.lineTo(cx - hw * 0.9, cy + hh);
  ctx.moveTo(cx + hw, cy - hh);
  ctx.lineTo(cx + hw * 0.9, cy + hh);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - hw * 0.6, cy - hh);
  ctx.lineTo(cx - hw * 0.5, cy + hh);
  ctx.moveTo(cx + hw * 0.6, cy - hh);
  ctx.lineTo(cx + hw * 0.5, cy + hh);
  ctx.stroke();
}

function drawIconTable(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.07);
  const cx = x + s / 2;
  const cy = y + s / 2;
  const tw = s * 0.35;
  ctx.beginPath();
  ctx.moveTo(cx - tw, cy - s * 0.15);
  ctx.lineTo(cx + tw, cy - s * 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - tw * 0.5, cy - s * 0.15);
  ctx.lineTo(cx - tw * 0.5, cy + s * 0.35);
  ctx.moveTo(cx + tw * 0.5, cy - s * 0.15);
  ctx.lineTo(cx + tw * 0.5, cy + s * 0.35);
  ctx.stroke();
}

function drawIconSucculent(ctx, x, y, s, color) {
  const cx = x + s / 2;
  const cy = y + s * 0.6;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.2;
  const potW = s * 0.2;
  const potH = s * 0.15;
  ctx.beginPath();
  ctx.moveTo(cx - potW, cy + potH);
  ctx.lineTo(cx - potW * 0.7, cy);
  ctx.lineTo(cx + potW * 0.7, cy);
  ctx.lineTo(cx + potW, cy + potH);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.7;
  const r = s * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.1, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 1.3, cy - s * 0.1 + Math.sin(a) * r * 1.1, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawIconPoster(ctx, x, y, s, color) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.15;
  ctx.fillRect(cx - s * 0.3, cy - s * 0.32, s * 0.6, s * 0.64);
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.strokeRect(cx - s * 0.3, cy - s * 0.32, s * 0.6, s * 0.64);
  ctx.globalAlpha = 0.3;
  const dotR = s * 0.03;
  [[-s * 0.2, -s * 0.22], [s * 0.2, -s * 0.22], [-s * 0.2, s * 0.22], [s * 0.2, s * 0.22]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, dotR, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawIconClock(ctx, x, y, s, color) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s * 0.3;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.3);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - r * 0.2, cy + r * 0.4);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawIconPainting(ctx, x, y, s, color) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(cx - s * 0.28, cy - s * 0.32, s * 0.56, s * 0.64);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.strokeRect(cx - s * 0.28, cy - s * 0.32, s * 0.56, s * 0.64);
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.arc(cx - s * 0.05, cy - s * 0.08, s * 0.07, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.15, cy + s * 0.2);
  ctx.lineTo(cx - s * 0.05, cy + s * 0.05);
  ctx.lineTo(cx + s * 0.05, cy + s * 0.15);
  ctx.lineTo(cx + s * 0.15, cy);
  ctx.lineTo(cx + s * 0.2, cy + s * 0.2);
  ctx.stroke();
}

function drawIconLamp(ctx, x, y, s, color) {
  const cx = x + s / 2;
  const cy = y + s * 0.55;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.2);
  ctx.lineTo(cx, cy - s * 0.15);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.25, cy - s * 0.15);
  ctx.lineTo(cx, cy - s * 0.4);
  ctx.lineTo(cx + s * 0.25, cy - s * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.35, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

function drawIconRug(ctx, x, y, s, color) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  const rw = s * 0.35;
  const rh = s * 0.22;
  ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw * 0.65, rh * 0.65, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawIconBooks(ctx, x, y, s, color) {
  const cx = x + s / 2;
  const cy = y + s * 0.55;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6;
  const books = [
    { w: s * 0.12, h: s * 0.25, ox: -s * 0.1, oy: -s * 0.12 },
    { w: s * 0.14, h: s * 0.2, ox: s * 0.05, oy: -s * 0.05 },
    { w: s * 0.1, h: s * 0.22, ox: -s * 0.02, oy: -s * 0.2 }
  ];
  for (const b of books) {
    ctx.fillRect(cx + b.ox - b.w / 2, cy + b.oy, b.w, b.h);
  }
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.03);
  for (const b of books) {
    ctx.strokeRect(cx + b.ox - b.w / 2, cy + b.oy, b.w, b.h);
  }
}

function drawIconTrophy(ctx, x, y, s, color) {
  const cx = x + s / 2;
  const cy = y + s * 0.55;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.12, cy + s * 0.2);
  ctx.lineTo(cx - s * 0.2, cy - s * 0.05);
  ctx.lineTo(cx - s * 0.12, cy - s * 0.05);
  ctx.lineTo(cx - s * 0.08, cy - s * 0.25);
  ctx.lineTo(cx + s * 0.08, cy - s * 0.25);
  ctx.lineTo(cx + s * 0.12, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.2, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.12, cy + s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.06, cy + s * 0.2);
  ctx.lineTo(cx - s * 0.06, cy + s * 0.3);
  ctx.lineTo(cx + s * 0.06, cy + s * 0.3);
  ctx.lineTo(cx + s * 0.06, cy + s * 0.2);
  ctx.stroke();
}

function drawIconNeon(ctx, x, y, s, color) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = s * 0.2;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6;
  const nw = s * 0.35;
  const nh = s * 0.2;
  ctx.fillRect(cx - nw, cy - nh, nw * 2, nh * 2);
  ctx.globalAlpha = 0.15;
  ctx.fillRect(cx - nw * 1.1, cy - nh * 1.1, nw * 2.2, nh * 2.2);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "#fff";
  ctx.font = `${s * 0.28}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ON", cx, cy + 1);
}

const ICON_DRAWERS = {
  "wooden-chair": drawIconChair,
  "wastebin": drawIconWastebin,
  "crate": drawIconCrate,
  "barrel": drawIconBarrel,
  "small-table": drawIconTable,
  "desk-plant": drawIconSucculent,
  "wall-poster": drawIconPoster,
  "wall-clock": drawIconClock,
  "painting": drawIconPainting,
  "floor-lamp": drawIconLamp,
  "rug": drawIconRug,
  "desk-cases": drawIconBooks,
  "gold-trophy": drawIconTrophy,
  "neon-sign": drawIconNeon
};

export class EditorUI {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.buttons = [];
    this.visible = false;
    this.onAction = (opts && opts.onAction) || (() => {});
    this.selectedObject = null;
    this.scrollY = 0;
    this.hoveredButton = null;
    this.equippedId = null;

    this.resize = () => {
      const parent = this.canvas.parentElement;
      const w = parent ? parent.clientWidth : window.innerWidth;
      const h = parent ? parent.clientHeight : window.innerHeight;
      if (!w || !h) return;
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        if (this.visible) this.render();
      }
    };
    window.addEventListener("resize", this.resize);
    requestAnimationFrame(() => this.resize());

    this.snapEnabled = false;
    this.lockedItems = new Set();

    this.categories = [
      {
        name: "Furniture",
        expanded: true,
        subcategories: [
          {
            name: "Seating",
            items: [
              { id: "wooden-chair", name: "Wooden Chair", iconColor: "#8b5e3c", manager: "furniture" }
            ]
          },
          {
            name: "Storage",
            items: [
              { id: "wastebin", name: "Wastebin", iconColor: "#888", manager: "furniture" },
              { id: "crate", name: "Wooden Crate", iconColor: "#a07830", manager: "furniture" },
              { id: "barrel", name: "Barrel", iconColor: "#7a5030", manager: "furniture" }
            ]
          },
          {
            name: "Surfaces",
            items: [
              { id: "small-table", name: "Small Table", iconColor: "#7a5530", manager: "furniture" }
            ]
          }
        ]
      },
      {
        name: "Decorations",
        expanded: true,
        subcategories: [
          {
            name: "Plants",
            items: [
              { id: "desk-plant", name: "Desk Succulent", iconColor: "#5abc6a", manager: "decor" }
            ]
          },
          {
            name: "Wall Art",
            items: [
              { id: "wall-poster", name: "Wall Poster", iconColor: "#ff00ff", manager: "decor" },
              { id: "wall-clock", name: "Wall Clock", iconColor: "#777", manager: "decor" },
              { id: "painting", name: "Painting", iconColor: "#00ddff", manager: "decor" }
            ]
          },
          {
            name: "Floor",
            items: [
              { id: "floor-lamp", name: "Floor Lamp", iconColor: "#dda050", manager: "decor" },
              { id: "rug", name: "Floor Rug", iconColor: "#ff3388", manager: "decor" }
            ]
          },
          {
            name: "Desk",
            items: [
              { id: "desk-cases", name: "Game Cases on Desk", iconColor: "#ffcc00", manager: "decor" }
            ]
          },
          {
            name: "Rewards",
            items: [
              { id: "gold-trophy", name: "Gold Trophy", iconColor: "#ffd700", manager: "decor" },
              { id: "neon-sign", name: "Neon Sign", iconColor: "#ff00ff", manager: "decor" }
            ]
          }
        ]
      }
    ];
  }

  setLockedItems(items) {
    this.lockedItems = new Set(items);
  }

  show(equippedId, snapEnabled) {
    this.visible = true;
    this.equippedId = equippedId || null;
    this.snapEnabled = !!snapEnabled;
    this.resize();
    if (!this.canvas.width || !this.canvas.height) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
    this.render();
  }

  hide() {
    this.visible = false;
    this.equippedId = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  isVisible() {
    return this.visible;
  }

  hitTest(clientX, clientY) {
    if (!this.visible) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const W = this.canvas.width;
    const H = this.canvas.height;

    if (y < 46) return "toolbar";

    const paletteW = Math.floor(W * 0.5);
    const panelH = 240;
    const panelY = H - panelH;
    if (x < paletteW && y >= panelY) return "palette";

    const propW = Math.floor(W * 0.5);
    const propX = W - propW;
    if (x >= propX && y >= panelY) return "properties";

    return null;
  }

  setSelection(name, type, position, rotation) {
    this.selectedObject = { name, type, position, rotation };
    this.render();
  }

  clearSelection() {
    this.selectedObject = null;
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.clearRect(0, 0, W, H);
    this.buttons = [];

    this.renderToolbar(ctx, W);
    this.renderPalette(ctx, W, H);
    this.renderProperties(ctx, W, H);
  }

  handleClick(clientX, clientY) {
    if (!this.visible) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const btn = this.buttons[i];
      if (!(x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h)) continue;
      if (btn.id === "toggleCat") {
        const catName = btn.data.categoryName;
        for (const cat of this.categories) {
          if (cat.name === catName) cat.expanded = !cat.expanded;
        }
        this.render();
      } else if (btn.id === "snap") {
        this.snapEnabled = !this.snapEnabled;
        this.onAction({ id: "snap", data: { enabled: this.snapEnabled } });
        this.render();
      } else if (btn.id === "spawn" && btn.data && this.lockedItems.has(btn.data.id)) {
        return;
      } else {
        this.onAction({ id: btn.id, data: btn.data || null });
      }
      return;
    }
  }

  computeContentHeight() {
    const cols = Math.max(1, Math.floor((Math.floor(this.canvas.width * 0.45) - 20) / (56 + 5)));
    let h = 0;
    for (const cat of this.categories) {
      h += 20;
      if (cat.expanded) {
        for (const sub of cat.subcategories) {
          h += 14;
          const rows = Math.ceil(sub.items.length / cols);
          h += rows * (54 + 5) + 4;
        }
        h += 2;
      }
    }
    return h;
  }

  handleWheel(deltaY) {
    if (!this.visible) return;
    const H = this.canvas.height;
    const panelH = Math.min(380, Math.max(240, Math.floor(H * 0.4)));
    const visibleH = panelH - 32;
    const contentH = this.computeContentHeight();
    const maxScroll = 0;
    const minScroll = contentH > visibleH ? -(contentH - visibleH) : 0;
    this.scrollY = Math.max(minScroll, Math.min(maxScroll, this.scrollY - deltaY));
    this.render();
  }

  getAllPaletteItems() {
    const items = [];
    for (const cat of this.categories) {
      if (!cat.expanded) continue;
      for (const sub of cat.subcategories) {
        for (const item of sub.items) {
          items.push({ ...item, category: cat.name, subcategory: sub.name });
        }
      }
    }
    return items;
  }

  drawItemIcon(ctx, x, y, size, itemId, color) {
    const drawer = ICON_DRAWERS[itemId];
    if (drawer) {
      drawer(ctx, x, y, size, color);
    } else {
      const fa = FA_ICONS[itemId];
      if (fa) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7;
        ctx.font = `${size * 0.55}px "Font Awesome 6 Free", "Font Awesome 6 Pro", "FontAwesome"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fa, x + size / 2, y + size / 2);
      }
    }
  }

  renderToolbar(ctx, W) {
    const h = 46;
    ctx.fillStyle = "rgba(10, 10, 16, 0.85)";
    ctx.fillRect(0, 0, W, h);

    ctx.fillStyle = "#00ddff";
    ctx.font = "bold 14px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("Edit Mode", 14, h / 2);

    let x = 120;
    ctx.shadowColor = "rgba(0, 220, 255, 0.15)";
    ctx.shadowBlur = 4;
    this.addButton(ctx, x, 7, 36, 32, "undo");
    this.drawButton(ctx, x, 7, 36, 32, "↶", "rgba(255,255,255,0.06)");

    x += 44;
    this.addButton(ctx, x, 7, 36, 32, "redo");
    this.drawButton(ctx, x, 7, 36, 32, "↷", "rgba(255,255,255,0.06)");
    ctx.shadowBlur = 0;

    x += 54;
    const snapOn = this.snapEnabled;
    this.addButton(ctx, x, 7, 40, 32, "snap");
    const snapBg = snapOn ? "rgba(0, 220, 255, 0.18)" : "rgba(255,255,255,0.04)";
    const snapBorder = snapOn ? "rgba(0, 220, 255, 0.5)" : "rgba(255,255,255,0.06)";
    this.roundRect(ctx, x, 7, 40, 32, 4);
    ctx.fillStyle = snapBg;
    ctx.fill();
    ctx.strokeStyle = snapBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = snapOn ? "#00ddff" : "rgba(255,255,255,0.45)";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SNAP", x + 20, 7 + 16);
    ctx.textAlign = "start";

    const exitW = 68;
    const exitX = W - exitW - 14;
    this.addButton(ctx, exitX, 7, exitW, 32, "exit");
    this.drawButton(ctx, exitX, 7, exitW, 32, "Exit", "rgba(0, 220, 255, 0.1)");

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(W, h);
    ctx.stroke();
  }

  renderPalette(ctx, W, H) {
    const panelW = Math.floor(W * 0.45);
    const panelH = Math.min(380, Math.max(240, Math.floor(H * 0.4)));
    const panelY = H - panelH;
    const visibleH = panelH - 32;
    const contentH = this.computeContentHeight();
    if (this.scrollY < 0 && contentH <= visibleH) this.scrollY = 0;

    const grad = ctx.createLinearGradient(0, panelY, 0, H);
    grad.addColorStop(0, "rgba(10, 10, 16, 0.92)");
    grad.addColorStop(1, "rgba(8, 8, 14, 0.96)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, panelY, panelW, panelH);

    ctx.shadowColor = "rgba(0, 220, 255, 0.05)";
    ctx.shadowBlur = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelW, panelY);
    ctx.lineTo(panelW, H);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.moveTo(0, panelY);
    ctx.lineTo(panelW, panelY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(0, 200, 255, 0.7)";
    ctx.font = "14px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("Objects", 14, panelY + 11);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, panelY + 32, panelW, panelH - 32);
    ctx.clip();

    const tileW = 80;
    const tileH = 76;
    const gap = 6;
    const startX = 10;
    let y = panelY + 32 + this.scrollY;
    const cols = Math.max(1, Math.floor((panelW - 20) / (tileW + gap)));

    for (const cat of this.categories) {
      const catLabelY = y;
      const catIsExpanded = cat.expanded;

      ctx.shadowColor = "rgba(0, 220, 255, 0.06)";
      ctx.shadowBlur = 3;
      ctx.fillStyle = catIsExpanded ? "rgba(0, 220, 255, 0.1)" : "rgba(255,255,255,0.03)";
      this.roundRect(ctx, 4, catLabelY, panelW - 8, 22, 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = catIsExpanded ? "#00ddff" : "rgba(255,255,255,0.4)";
      ctx.font = "bold 11px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(catIsExpanded ? "▼" : "▶", 10, catLabelY + 11);
      ctx.fillText(cat.name + (catIsExpanded ? "" : " (" + this.countVisibleItems(cat) + ")"), 26, catLabelY + 11);

      this.addButton(ctx, 4, catLabelY, panelW - 8, 22, "toggleCat", { categoryName: cat.name });

      y += 24;

      if (catIsExpanded) {
        for (const sub of cat.subcategories) {
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.font = "9px sans-serif";
          ctx.textBaseline = "top";
          ctx.fillText(sub.name.toUpperCase(), startX, y + 3);
          y += 16;

          for (let i = 0; i < sub.items.length; i++) {
            const item = sub.items[i];
            const col = i % cols;
            const ix = startX + col * (tileW + gap);
            const iy = y + Math.floor(i / cols) * (tileH + gap);

            const isLocked = this.lockedItems.has(item.id);
            const isHovered = this.hoveredButton === `palette:${item.id}` && !isLocked;
            const isEquipped = item.id === this.equippedId;

            let bg;
            let border;
            if (isLocked) {
              bg = "rgba(255,255,255,0.02)";
              border = "rgba(255,255,255,0.04)";
            } else if (isEquipped) {
              bg = "rgba(0, 220, 255, 0.1)";
              border = "rgba(0, 220, 255, 0.5)";
            } else if (isHovered) {
              bg = "rgba(255,255,255,0.07)";
              border = "rgba(255,255,255,0.06)";
            } else {
              bg = "rgba(255,255,255,0.03)";
              border = "rgba(255,255,255,0.05)";
            }

            ctx.shadowColor = isHovered || isEquipped ? "rgba(0, 220, 255, 0.08)" : "transparent";
            ctx.shadowBlur = isHovered || isEquipped ? 6 : 0;
            this.roundRect(ctx, ix, iy, tileW, tileH, 6);
            ctx.fillStyle = bg;
            ctx.fill();
            ctx.strokeStyle = border;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.shadowBlur = 0;

            const iconSize = 40;
            const iconX = ix + (tileW - iconSize) / 2;
            const iconY = iy + 4;

            ctx.shadowColor = item.iconColor;
            ctx.shadowBlur = isHovered ? 8 : 0;
            this.roundRect(ctx, iconX, iconY, iconSize, iconSize, 5);
            ctx.fillStyle = item.iconColor || "#555";
            ctx.globalAlpha = isLocked ? 0.1 : 0.12;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = isLocked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.shadowBlur = 0;

            this.drawItemIcon(ctx, iconX, iconY, iconSize, item.id, item.iconColor || "#fff");

            ctx.fillStyle = isLocked ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)";
            ctx.font = "10px sans-serif";
            ctx.textBaseline = "top";
            ctx.textAlign = "center";
            ctx.fillText(item.name, ix + tileW / 2, iy + tileH - 16);
            ctx.textAlign = "start";

            if (isLocked) {
              ctx.save();
              ctx.translate(ix + tileW / 2, iy + tileH / 2 + 2);
              ctx.globalAlpha = 0.5;
              ctx.strokeStyle = "#ffffff";
              ctx.fillStyle = "#ffffff";
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(0, -4, 5, Math.PI, 0, false);
              ctx.stroke();
              ctx.beginPath();
              ctx.roundRect ? ctx.roundRect(-5, -2, 10, 8, 1.5) : ctx.rect(-5, -2, 10, 8);
              ctx.fill();
              ctx.strokeStyle = "rgba(10,10,16,0.8)";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(-2, 2);
              ctx.lineTo(-2, 4);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(2, 2);
              ctx.lineTo(2, 4);
              ctx.stroke();
              ctx.restore();
            } else {
              this.addButton(ctx, ix, iy, tileW, tileH, "spawn", item);
            }
          }

          const rows = Math.ceil(sub.items.length / cols);
          y += rows * (tileH + gap) + 4;
        }
        y += 2;
      }
    }

    ctx.restore();
  }

  countVisibleItems(cat) {
    let count = 0;
    for (const sub of cat.subcategories) {
      count += sub.items.length;
    }
    return count;
  }

  renderProperties(ctx, W, H) {
    const panelW = Math.floor(W * 0.5);
    const panelH = 240;
    const panelX = W - panelW;
    const panelY = H - panelH;

    ctx.fillStyle = "rgba(10, 10, 16, 0.92)";
    ctx.fillRect(panelX, panelY, panelW, panelH);

    ctx.shadowColor = "rgba(0, 220, 255, 0.05)";
    ctx.shadowBlur = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX, panelY);
    ctx.lineTo(panelX, H);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(0, 200, 255, 0.7)";
    ctx.font = "13px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("Properties", panelX + 16, panelY + 11);

    if (!this.selectedObject) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No selection", panelX + panelW / 2, panelY + panelH / 2 + 8);
      ctx.textAlign = "start";
      return;
    }

    const sel = this.selectedObject;
    let y = panelY + 30;
    const left = panelX + 14;

    ctx.fillStyle = "#00ccff";
    ctx.font = "bold 15px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(sel.name, left, y);
    y += 20;

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px sans-serif";
    ctx.fillText(sel.type, left, y);
    y += 18;

    const pos = sel.position;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px sans-serif";
    ctx.fillText(`X: ${pos.x.toFixed(2)}  Y: ${pos.y.toFixed(2)}  Z: ${pos.z.toFixed(2)}`, left, y);
    y += 16;
    ctx.fillText(`R: ${(sel.rotation || 0).toFixed(0)}°`, left, y);
    y += 24;
  }

  addButton(ctx, x, y, w, h, id, data) {
    this.buttons.push({ x, y, w, h, id, data });
  }

  drawButton(ctx, x, y, w, h, label, bg, textColor) {
    this.roundRect(ctx, x, y, w, h, 4);
    ctx.fillStyle = bg || "rgba(255,255,255,0.06)";
    ctx.fill();

    ctx.fillStyle = textColor || "rgba(255,255,255,0.7)";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.textAlign = "start";
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
