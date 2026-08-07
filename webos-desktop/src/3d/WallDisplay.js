import { resolveIconUrl } from "../shared/assetResolver.js";
import { getGameList } from "./GameCaseManager.js";
import { createElement } from "../shared/domUtils.js";

const COLS = 4;
const ROWS = 5;
const PER_PAGE = COLS * ROWS;
const CARD_W = 0.28;
const CARD_H = 0.34;
const CARD_D = 0.04;
const CANVAS_W = 256;
const CANVAS_H = 312;
const TAB_IDS = ["all", "available", "spawned", "trashed"];

function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export class WallDisplay {
  constructor(gameCaseManager, onSpawn, onRecover, THREE, scene, interactiveObjects) {
    this.gameCaseManager = gameCaseManager;
    this.onSpawn = onSpawn;
    this.onRecover = onRecover;
    this.THREE = THREE;
    this.scene = scene;
    this.interactiveObjects = interactiveObjects;
    this.group = null;
    this.cards = [];
    this.tabButtons = [];
    this.pageButtons = [];
    this.closeBtn = null;
    this.recoverAllBtn = null;
    this.active = false;
    this.tab = "all";
    this.page = 0;
    this.items = [];
    this.images = new Map();
    this.loadQueue = new Set();
  }

  isOpen() {
    return this.active;
  }

  open() {
    if (this.active) return;
    this.active = true;
    this.tab = "all";
    this.page = 0;
    this.buildItems();
    this.buildGroup();
    this.updateUI();
  }

  close() {
    if (!this.active) return;
  }

  buildItems() {
    const data = this.gameCaseManager.getCatalogueData();
    const trashedIds = new Set(data.trashed);
    const spawnedIds = new Set(data.spawned.map((g) => g.id));
    const allGames = getGameList();

    this.items = [];
    for (const game of allGames) {
      const spawned = spawnedIds.has(game.id);
      const trashed = trashedIds.has(game.id);
      const available = !spawned && !trashed;
      const status = spawned ? "spawned" : trashed ? "trashed" : "available";
      this.items.push({ ...game, status });
    }

    const filterFn = {
      all: () => true,
      available: (g) => g.status === "available",
      spawned: (g) => g.status === "spawned",
      trashed: (g) => g.status === "trashed"
    };
    this.items = this.items.filter(filterFn[this.tab] || filterFn.all);
  }

  buildGroup() {
    const T = this.THREE;
    this.group = new T.Group();
    this.group.position.set(3.7, 1.5, 3.8);
    this.group.rotation.y = Math.PI;

    const boardW = 2.2;
    const boardH = 2.8;

    const boardMat = new T.MeshStandardMaterial({
      color: 0x0e0e1e,
      roughness: 0.6,
      metalness: 0.2,
      emissive: 0x14142a,
      emissiveIntensity: 0.25,
      side: T.DoubleSide
    });
    const board = new T.Mesh(new T.PlaneGeometry(boardW, boardH), boardMat);
    board.userData.title = "Game Collection";
    this.group.add(board);

    const borderColor = 0x334466;
    const borderOpacity = 0.7;
    const bt = 0.04;
    const bMat = new T.MeshBasicMaterial({
      color: borderColor,
      transparent: true,
      opacity: borderOpacity,
      side: T.DoubleSide
    });

    const top = new T.Mesh(new T.PlaneGeometry(boardW + bt * 2, bt), bMat);
    top.position.set(0, boardH / 2 + bt / 2, 0.001);
    this.group.add(top);

    const bottom = new T.Mesh(new T.PlaneGeometry(boardW + bt * 2, bt), bMat);
    bottom.position.set(0, -boardH / 2 - bt / 2, 0.001);
    this.group.add(bottom);

    const left = new T.Mesh(new T.PlaneGeometry(bt, boardH), bMat);
    left.position.set(-boardW / 2 - bt / 2, 0, 0.001);
    this.group.add(left);

    const right = new T.Mesh(new T.PlaneGeometry(bt, boardH), bMat);
    right.position.set(boardW / 2 + bt / 2, 0, 0.001);
    this.group.add(right);

    const titleMat = new T.MeshBasicMaterial({ transparent: true, opacity: 0.9, side: T.DoubleSide });
    const titleCanvas = createElement("canvas");
    titleCanvas.width = 256;
    titleCanvas.height = 40;
    const tctx = titleCanvas.getContext("2d");
    tctx.fillStyle = "#00ddff";
    tctx.font = "bold 18px monospace";
    tctx.textAlign = "center";
    tctx.textBaseline = "middle";
    tctx.fillText("Game Collection", 128, 22);
    const titleTex = new T.CanvasTexture(titleCanvas);
    titleMat.map = titleTex;
    const titleMesh = new T.Mesh(new T.PlaneGeometry(0.8, 0.12), titleMat);
    titleMesh.position.set(0, 1.25, 0.002);
    this.group.add(titleMesh);

    this.buildCloseButton();
    this.buildTabs();
    this.buildPageButtons();
    this.buildRecoverAllButton();

    this.scene.add(this.group);
  }

  buildCloseButton() {
    const T = this.THREE;
    const mat = new T.MeshBasicMaterial({
      color: 0x882222,
      transparent: true,
      opacity: 0.7,
      side: T.DoubleSide
    });
    const mesh = new T.Mesh(new T.PlaneGeometry(0.1, 0.1), mat);
    mesh.position.set(0.97, 1.3, 0.005);
    mesh.userData.objectId = "wallClose";
    mesh.userData.title = "Close";
    mesh.userData.interactive = true;
    this.group.add(mesh);
    this.closeBtn = mesh;
  }

  buildTabs() {
    const T = this.THREE;
    const tabW = 0.4;
    const tabH = 0.1;
    const startX = -(tabW * 2 + 0.04);

    for (let i = 0; i < TAB_IDS.length; i++) {
      const canvas = createElement("canvas");
      canvas.width = 128;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(TAB_IDS[i].charAt(0).toUpperCase() + TAB_IDS[i].slice(1), 64, 18);

      const tex = new T.CanvasTexture(canvas);
      const mat = new T.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.5,
        side: T.DoubleSide
      });
      const mesh = new T.Mesh(new T.PlaneGeometry(tabW, tabH), mat);
      mesh.position.set(startX + i * (tabW + 0.04), 1.08, 0.005);
      mesh.userData.objectId = "wallTab_" + TAB_IDS[i];
      mesh.userData.tabId = TAB_IDS[i];
      mesh.userData.title = TAB_IDS[i].charAt(0).toUpperCase() + TAB_IDS[i].slice(1);
      mesh.userData.interactive = true;
      mesh.userData.tabMat = mat;
      mesh.userData.tabCanvas = canvas;
      this.group.add(mesh);
      this.tabButtons.push(mesh);
    }
    this.updateTabHighlight();
  }

  updateTabHighlight() {
    for (const mesh of this.tabButtons) {
      const canvas = mesh.userData.tabCanvas;
      const ctx = canvas.getContext("2d");
      const isActive = mesh.userData.tabId === this.tab;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (isActive) {
        ctx.fillStyle = "#00ddff";
        ctx.font = "bold 13px sans-serif";
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "12px sans-serif";
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(mesh.userData.tabId.charAt(0).toUpperCase() + mesh.userData.tabId.slice(1), 64, 18);
      if (isActive) {
        ctx.fillStyle = "#00ddff";
        ctx.fillRect(20, canvas.height - 3, canvas.width - 40, 2);
      }
      mesh.material.map.needsUpdate = true;
      mesh.material.opacity = isActive ? 0.9 : 0.5;
    }
  }

  buildPageButtons() {
    const T = this.THREE;

    const prevMat = new T.MeshBasicMaterial({
      color: 0x00ddff,
      transparent: true,
      opacity: 0.5,
      side: T.DoubleSide
    });
    const prev = new T.Mesh(new T.PlaneGeometry(0.12, 0.12), prevMat);
    prev.position.set(-0.6, -1.2, 0.005);
    prev.userData.objectId = "wallPagePrev";
    prev.userData.title = "Previous Page";
    prev.userData.interactive = true;
    this.group.add(prev);
    this.pageButtons.push(prev);

    const nextMat = new T.MeshBasicMaterial({
      color: 0x00ddff,
      transparent: true,
      opacity: 0.5,
      side: T.DoubleSide
    });
    const next = new T.Mesh(new T.PlaneGeometry(0.12, 0.12), nextMat);
    next.position.set(0.6, -1.2, 0.005);
    next.userData.objectId = "wallPageNext";
    next.userData.title = "Next Page";
    next.userData.interactive = true;
    this.group.add(next);
    this.pageButtons.push(next);

    this.updatePageButtons();
  }

  updatePageButtons() {
    const totalPages = Math.ceil(this.items.length / PER_PAGE) || 1;
    if (this.pageButtons.length >= 2) {
      this.pageButtons[0].visible = true;
      this.pageButtons[1].visible = this.page < totalPages - 1;
    }
  }

  buildRecoverAllButton() {
    const T = this.THREE;
    const mat = new T.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.0,
      side: T.DoubleSide
    });
    const mesh = new T.Mesh(new T.PlaneGeometry(0.32, 0.1), mat);
    mesh.position.set(0.0, -1.2, 0.005);
    mesh.userData.objectId = "wallRecoverAll";
    mesh.userData.title = "Recover All";
    mesh.userData.interactive = true;
    mesh.userData.mat = mat;
    this.group.add(mesh);
    this.recoverAllBtn = mesh;
    this.updateRecoverAllButton();
  }

  updateRecoverAllButton() {
    const hasTrashed = this.items.some((g) => g.status === "trashed");
    const show = this.tab === "trashed" && hasTrashed;
    if (this.recoverAllBtn) {
      this.recoverAllBtn.visible = show;
      this.recoverAllBtn.material.opacity = show ? 0.5 : 0;
    }
  }

  updateUI() {
    this.clearCards();
    this.buildCardsForPage();
    this.updateTabHighlight();
    this.updatePageButtons();
    this.updateRecoverAllButton();
    this.syncInteractiveObjects();
  }

  clearCards() {
    for (const card of this.cards) {
      this.group.remove(card.mesh);
      card.mesh.geometry.dispose();
      card.mesh.material.dispose();
      if (card.tex) card.tex.dispose();
    }
    this.cards = [];
  }

  buildCardsForPage() {
    const T = this.THREE;
    const start = this.page * PER_PAGE;
    const end = Math.min(start + PER_PAGE, this.items.length);
    if (start >= this.items.length) return;

    const gridW = (COLS - 1) * 0.36;
    const gridH = (ROWS - 1) * 0.4;
    const originX = -gridW / 2;
    const originY = gridH / 2 - 0.05;

    const cardGroupItems = [];

    for (let i = start; i < end; i++) {
      const idx = i - start;
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const lx = originX + col * 0.36;
      const ly = originY - row * 0.4;

      const game = this.items[i];
      const tex = this.createCardTexture(game);
      const mat = new T.MeshStandardMaterial({
        map: tex,
        roughness: 0.6,
        metalness: 0.1,
        side: T.DoubleSide
      });
      const geo = new T.BoxGeometry(CARD_W, CARD_H, CARD_D);
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(lx, ly, 0.01);
      mesh.userData.objectId = "wallCard_" + game.id;
      mesh.userData.gameId = game.id;
      mesh.userData.gameStatus = game.status;
      mesh.userData.title = game.title;
      mesh.userData.interactive = true;
      this.group.add(mesh);

      const cardItem = { mesh, tex, game };
      this.cards.push(cardItem);
      cardGroupItems.push(cardItem);

      if (this.images.has(game.id)) {
        this.updateCardWithImage(cardItem);
      } else {
        this.loadCardImage(cardItem);
      }
    }

    const pageLabelCanvas = createElement("canvas");
    pageLabelCanvas.width = 128;
    pageLabelCanvas.height = 24;
    const plc = pageLabelCanvas.getContext("2d");
    const totalPages = Math.ceil(this.items.length / PER_PAGE) || 1;
    plc.fillStyle = "rgba(255,255,255,0.3)";
    plc.font = "10px sans-serif";
    plc.textAlign = "center";
    plc.textBaseline = "middle";
    plc.fillText(`Page ${this.page + 1}/${totalPages}`, 64, 13);

    for (const btn of this.pageButtons) {
      const bc = createElement("canvas");
      bc.width = 32;
      bc.height = 32;
      const bctx = bc.getContext("2d");
      bctx.fillStyle = "#00ddff";
      bctx.font = "bold 18px sans-serif";
      bctx.textAlign = "center";
      bctx.textBaseline = "middle";
      if (btn.userData.objectId === "wallPagePrev") {
        bctx.fillText("\u25C0", 16, 18);
      } else {
        bctx.fillText("\u25B6", 16, 18);
      }
      const btex = new T.CanvasTexture(bc);
      btn.material.map = btex;
      btn.material.needsUpdate = true;
    }
  }

  createCardTexture(game) {
    const canvas = createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");

    const h = hashId(game.id);
    const hue = h % 360;
    const sat = 45 + (h % 20);
    const lit = 25 + (h % 15);

    ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lit}%)`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit + 10}%, 0.5)`;
    ctx.fillRect(0, CANVAS_H - 64, CANVAS_W, 64);

    ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
    ctx.beginPath();
    ctx.arc(CANVAS_W / 2, 116, 72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(game.title.charAt(0).toUpperCase(), CANVAS_W / 2, 118);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const title = game.title.length > 18 ? game.title.slice(0, 17) + "..." : game.title;
    ctx.fillText(title, CANVAS_W / 2, CANVAS_H - 32);

    const tex = new this.THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  async loadCardImage(cardItem) {
    const game = cardItem.game;
    if (this.loadQueue.has(game.id)) return;
    this.loadQueue.add(game.id);

    if (/^fa[srb]?\s+fa-/.test(game.icon)) return;
    const url = resolveIconUrl(game.icon);
    if (!url) return;

    try {
      const img = await this.loadImage(url);
      this.images.set(game.id, img);
      this.updateCardWithImage(cardItem);
    } catch {}
  }

  updateCardWithImage(cardItem) {
    const img = this.images.get(cardItem.game.id);
    if (!img) return;

    const canvas = createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");

    const h = hashId(cardItem.game.id);
    const hue = h % 360;
    const sat = 45 + (h % 20);
    const lit = 25 + (h % 15);

    ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lit}%)`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit + 10}%, 0.5)`;
    ctx.fillRect(0, CANVAS_H - 64, CANVAS_W, 64);

    const size = 160;
    const ix = (CANVAS_W - size) / 2;
    const iy = 56;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, size, size);
    ctx.clip();
    ctx.drawImage(img, ix, iy, size, size);
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const title = cardItem.game.title.length > 18 ? cardItem.game.title.slice(0, 17) + "..." : cardItem.game.title;
    ctx.fillText(title, CANVAS_W / 2, CANVAS_H - 32);

    const oldTex = cardItem.mesh.material.map;
    const newTex = new this.THREE.CanvasTexture(canvas);
    newTex.needsUpdate = true;
    cardItem.mesh.material.map = newTex;
    cardItem.mesh.material.needsUpdate = true;
    cardItem.tex = newTex;
    if (oldTex) oldTex.dispose();
  }

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject();
      img.src = url;
    });
  }

  handleCardClick(gameId) {
    const game = this.items.find((g) => g.id === gameId);
    if (!game) return false;
    if (game.status === "available") {
      this.onSpawn(gameId);
      this.buildItems();
      this.updateUI();
      return true;
    }
    if (game.status === "trashed") {
      this.onRecover(gameId);
      this.buildItems();
      this.updateUI();
      return true;
    }
    return false;
  }

  handleTabClick(tabId) {
    if (tabId === this.tab) return false;
    this.tab = tabId;
    this.page = 0;
    this.buildItems();
    this.updateUI();
    return true;
  }

  nextPage() {
    const totalPages = Math.ceil(this.items.length / PER_PAGE) || 1;
    if (this.page < totalPages - 1) {
      this.page++;
      this.updateUI();
    }
  }

  handleRecoverAll() {
    const trashed = this.items.filter((g) => g.status === "trashed");
    for (const game of trashed) {
      this.onRecover(game.id);
    }
    this.buildItems();
    this.updateUI();
  }

  prevPage() {
    const totalPages = Math.ceil(this.items.length / PER_PAGE) || 1;
    this.page = this.page > 0 ? this.page - 1 : totalPages - 1;
    this.updateUI();
  }

  syncInteractiveObjects() {
    if (!this.interactiveObjects) return;

    for (let i = this.interactiveObjects.length - 1; i >= 0; i--) {
      const obj = this.interactiveObjects[i];
      if (obj.userData.objectId && obj.userData.objectId.startsWith("wall")) {
        this.interactiveObjects.splice(i, 1);
      }
    }

    if (!this.active) return;

    if (this.closeBtn) this.interactiveObjects.push(this.closeBtn);
    for (const btn of this.tabButtons) {
      this.interactiveObjects.push(btn);
    }
    for (const btn of this.pageButtons) {
      this.interactiveObjects.push(btn);
    }
    for (const card of this.cards) {
      this.interactiveObjects.push(card.mesh);
    }
    if (this.recoverAllBtn && this.recoverAllBtn.visible) {
      this.interactiveObjects.push(this.recoverAllBtn);
    }
  }

  removeAllMeshes() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group = null;
    }
    if (this.interactiveObjects) {
      for (let i = this.interactiveObjects.length - 1; i >= 0; i--) {
        const obj = this.interactiveObjects[i];
        if (obj && obj.userData && obj.userData.objectId && obj.userData.objectId.startsWith("wall")) {
          this.interactiveObjects.splice(i, 1);
        }
      }
    }
    this.cards = [];
    this.tabButtons = [];
    this.pageButtons = [];
    this.closeBtn = null;
    this.recoverAllBtn = null;
  }

  destroy() {
    this.close();
    this.images.clear();
    this.loadQueue.clear();
    this.items = [];
  }
}
