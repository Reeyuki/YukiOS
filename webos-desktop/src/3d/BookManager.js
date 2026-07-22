import { appMap } from "../games/gamesList.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { BookPhysics } from "./BookPhysics.js";
import * as CANNON from "cannon-es";

const BOOK_WIDTH = 0.3;
const BOOK_HEIGHT = 0.42;
const BOOK_DEPTH = 0.04;
const TEXTURE_W = 320;
const TEXTURE_H = 440;
const SPAWN_Y = 2.5;
const BATCH_PER_FRAME = 4;
const INITIAL_SPAWN = 20;
const EXCLUDED = new Set(["TMNP", "vscode", "paint", "photopea", "liventcord"]);

const FIXED_POSITIONS = {
  seaSweeper: { x: -1.917, y: 0.02, z: 0.933, rx: -1.571, ry: 0, rz: 1.01 },
  deltaruneCh5: { x: -0.936, y: 0.82, z: -0.74, rx: -1.571, ry: 0, rz: -0.01 },
  slimeRancher: { x: 2.759, y: 0.02, z: -0.545, rx: -1.571, ry: 0, rz: -2.781 },
  tabs: { x: 1.076, y: 0.02, z: 1.09, rx: -1.571, ry: 0, rz: -0.296 },
  plagueIncEvolved: { x: -3.212, y: 0.02, z: -1.365, rx: -1.571, ry: 0, rz: 0.406 },
  fiveNightsAtFrickbears3: { x: 2.0, y: 0.056, z: -0.748, rx: -1.704, ry: 0.065, rz: 1.735 },
  helltaker: { x: 2.367, y: 0.02, z: 0.699, rx: -1.571, ry: 0, rz: -0.548 },
  daddy: { x: 1.9, y: 0.02, z: 1.318, rx: -1.571, ry: 0, rz: -0.278 },
  suicideGuy: { x: -3.525, y: 0.535, z: 0.782, rx: -1.571, ry: 0, rz: 2.018 },
  ytlifeomg: { x: 1.999, y: 0.089, z: -0.802, rx: -1.704, ry: 0.065, rz: 2.734 },
  slenderina: { x: 1.751, y: 0.048, z: -0.627, rx: -1.703, ry: 0.065, rz: 0.911 },
  baldiBalds: { x: 1.93, y: 0.02, z: -0.257, rx: -1.571, ry: 0, rz: 0.097 },
  baldisBasicsTeachingOnTwos: { x: 0.19, y: 0.02, z: -2.388, rx: -1.571, ry: 0, rz: 1.344 },
  playtimeHellBear5van: { x: 2.437, y: 0.02, z: -2.496, rx: -1.571, ry: 0, rz: 0.828 }
};

const FIXED_SHELVES = {
  angryBirds2: 23,
  lobotomyCorporation: 16,
  catGoesFishing: 27,
  inscryption: 15,
  nightInTheWoods: 17,
  inStarsAndTime: 13
};

function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let ly = y;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    const metrics = ctx.measureText(test);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, ly);
      line = word;
      ly += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, ly);
}

function getGameList() {
  return Object.entries(appMap)
    .filter(([id, data]) => data.type !== "system" && !EXCLUDED.has(id) && data.icon && data.title)
    .map(([id, data]) => ({
      id,
      title: data.title,
      icon: data.icon
    }));
}

export class BookManager {
  constructor(scene, bounds, interaction, colliders) {
    this.scene = scene;
    this.bounds = bounds;
    this.interaction = interaction;
    this.books = [];
    this.spawnQueue = [];
    this.gamePool = [];
    this.trashed = [];
    this.physics = new BookPhysics(bounds, colliders);
    this.THREE = null;
    this.done = false;
  }

  init(THREE, savedPositions, savedShelves) {
    this.THREE = THREE;
    this.savedPositions = savedPositions || {};
    this.savedShelves = savedShelves || {};
    const games = getGameList();
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_W;
    canvas.height = TEXTURE_H;
    const ctx = canvas.getContext("2d");
    const size = new THREE.Vector3(BOOK_WIDTH, BOOK_HEIGHT, BOOK_DEPTH);

    for (let i = 0; i < games.length; i++) {
      const game = games[i];

      if (i < INITIAL_SPAWN) {
        const tex = this.drawTexture(game, ctx, canvas);
        const mesh = this.createMesh(tex);
        mesh.userData.title = game.title;

        const saved = this.savedPositions[game.id];
        const fixed = !saved && FIXED_POSITIONS[game.id];
        let pos;
        if (saved) {
          pos = new THREE.Vector3(saved.x, saved.y, saved.z);
          mesh.position.copy(pos);
          mesh.rotation.set(saved.rx, saved.ry, saved.rz);
        } else if (fixed) {
          pos = new THREE.Vector3(fixed.x, fixed.y, fixed.z);
          mesh.position.copy(pos);
          mesh.rotation.set(fixed.rx, fixed.ry, fixed.rz);
        } else {
          pos = this.spawnPosition(game);
          mesh.position.copy(pos);
        }

        const dynamicMass = 0.3 + Math.random() * 0.3;
        const isStatic = !!(saved || fixed);
        const mass = isStatic ? 0 : dynamicMass;
        const body = this.physics.createBody(pos, size, mass);
        if (isStatic) {
          body.velocity.set(0, 0, 0);
          body.angularVelocity.set(0, 0, 0);
          body.quaternion.copy(mesh.quaternion);
          body.mass = 0;
          body.invMass = 0;
          body.updateMassProperties();
        } else {
          body.velocity.set((Math.random() - 0.5) * 0.15, -0.1 - Math.random() * 0.1, (Math.random() - 0.5) * 0.15);
          body.angularVelocity.set(
            (Math.random() - 0.5) * 0.08,
            (Math.random() - 0.5) * 0.08,
            (Math.random() - 0.5) * 0.08
          );
        }

        const shelfSlotIndex = this.savedShelves[game.id] ?? FIXED_SHELVES[game.id] ?? null;

        this.spawnQueue.push({
          mesh,
          pos: pos.clone(),
          size: size.clone(),
          mass,
          dynamicMass,
          body,
          grabbed: false,
          gameId: game.id,
          title: game.title,
          tex,
          iconUrl: game.icon,
          loadedIcon: null,
          shelvedAt: shelfSlotIndex != null ? shelfSlotIndex : null
        });
      } else {
        this.gamePool.push({
          id: game.id,
          title: game.title,
          icon: game.icon
        });
      }
    }

    this.loadIcons();
  }

  spawnFromCatalog(gameId) {
    const THREE = this.THREE;

    const queueIdx = this.spawnQueue.findIndex((b) => b.gameId === gameId);
    if (queueIdx !== -1) {
      const book = this.spawnQueue.splice(queueIdx, 1)[0];
      this.scene.add(book.mesh);
      book.body.position.set(book.pos.x, book.pos.y, book.pos.z);
      book.body.velocity.set(0, 0, 0);
      book.body.angularVelocity.set(0, 0, 0);
      book.body.wakeUp();
      book.mesh.position.set(book.pos.x, book.pos.y, book.pos.z);
      this.books.push(book);
      return book;
    }

    const spawned = this.books.find((b) => b.gameId === gameId);
    if (spawned) return spawned;

    const idx = this.gamePool.findIndex((g) => g.id === gameId);
    if (idx === -1) return null;
    const game = this.gamePool[idx];
    this.gamePool.splice(idx, 1);

    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_W;
    canvas.height = TEXTURE_H;
    const ctx = canvas.getContext("2d");
    const tex = this.drawTexture(game, ctx, canvas);
    const mesh = this.createMesh(tex);
    mesh.userData.title = game.title;

    const size = new THREE.Vector3(BOOK_WIDTH, BOOK_HEIGHT, BOOK_DEPTH);
    const saved = this.savedPositions[game.id];
    const fixed = !saved && FIXED_POSITIONS[game.id];
    const boxPos = saved
      ? new THREE.Vector3(saved.x, saved.y, saved.z)
      : fixed
        ? new THREE.Vector3(fixed.x, fixed.y, fixed.z)
        : new THREE.Vector3(0.55, 0.9, -1.3);
    const dynamicMass = 0.3 + Math.random() * 0.3;
    const isStatic = !!(saved || fixed);
    const mass = isStatic ? 0 : dynamicMass;
    const body = this.physics.createBody(boxPos, size, mass);

    if (isStatic) {
      if (saved) mesh.rotation.set(saved.rx, saved.ry, saved.rz);
      else mesh.rotation.set(fixed.rx, fixed.ry, fixed.rz);
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.mass = 0;
      body.invMass = 0;
      body.updateMassProperties();
    } else {
      body.velocity.set((Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.5);
      body.angularVelocity.set((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5);
    }

    this.scene.add(mesh);

    const book = {
      mesh,
      pos: boxPos.clone(),
      size: size.clone(),
      mass,
      dynamicMass,
      body,
      grabbed: false,
      gameId: game.id,
      title: game.title,
      tex,
      iconUrl: game.icon,
      loadedIcon: null
    };

    this.books.push(book);
    this.loadSingleIcon(book).catch(() => {});

    return book;
  }

  trashBook(book) {
    book.grabbed = false;
    this.scene.remove(book.mesh);
    this.physics.removeBody(book.body);
    if (book.tex) {
      if (book.mesh.material.map) book.mesh.material.map.dispose();
      book.mesh.material.dispose();
      book.mesh.geometry.dispose();
    }
    const bIdx = this.books.indexOf(book);
    if (bIdx !== -1) this.books.splice(bIdx, 1);
    this.trashed.push(book.gameId);

    if (this.interaction.povGrabbedBook === book) {
      this.interaction.povGrabbedBook = null;
      this.interaction.hideDetailCard();
    }
    if (this.interaction.grabbedBook === book) {
      this.interaction.grabbedBook = null;
    }
  }

  recoverFromTrash(gameId) {
    const idx = this.trashed.indexOf(gameId);
    if (idx === -1) return;
    this.trashed.splice(idx, 1);
    const games = getGameList();
    const game = games.find((g) => g.id === gameId);
    if (!game) return;
    this.gamePool.push({
      id: game.id,
      title: game.title,
      icon: game.icon
    });
  }

  recoverAllTrashed() {
    const ids = [...this.trashed];
    this.trashed = [];
    const games = getGameList();
    for (const id of ids) {
      const game = games.find((g) => g.id === id);
      if (game) {
        this.gamePool.push({
          id: game.id,
          title: game.title,
          icon: game.icon
        });
      }
    }
  }

  getCatalogueData() {
    const spawned = this.books.map((b) => ({
      id: b.gameId,
      title: b.title,
      icon: b.iconUrl
    }));
    return { spawned, pool: this.gamePool, trashed: [...this.trashed] };
  }

  drawTexture(game, ctx, canvas) {
    const h = hashId(game.id);
    const hue = h % 360;
    const sat = 45 + (h % 20);
    const lit = 25 + (h % 15);

    ctx.clearRect(0, 0, TEXTURE_W, TEXTURE_H);

    ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lit}%)`;
    ctx.fillRect(0, 0, TEXTURE_W, TEXTURE_H);

    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit + 10}%, 0.5)`;
    ctx.fillRect(0, TEXTURE_H - 88, TEXTURE_W, 88);

    const cx = TEXTURE_W / 2;
    const cy = 176;
    const radius = 120;
    ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 96px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(game.title.charAt(0).toUpperCase(), cx, cy);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    wrapText(ctx, game.title, TEXTURE_W / 2, TEXTURE_H - 44, TEXTURE_W - 32, 24);

    const tex = new this.THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  async loadIcons() {
    const all = [...this.spawnQueue];
    const promises = all.map((book) => this.loadSingleIcon(book).catch(() => {}));
    await Promise.allSettled(promises);
  }

  async loadSingleIcon(book) {
    if (/^fa[srb]?\s+fa-/.test(book.iconUrl)) return;
    const url = resolveIconUrl(book.iconUrl);
    if (!url) return;
    const img = await this.loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_W;
    canvas.height = TEXTURE_H;
    const ctx = canvas.getContext("2d");

    const h = hashId(book.gameId);
    const hue = h % 360;
    const sat = 45 + (h % 20);
    const lit = 25 + (h % 15);

    ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lit}%)`;
    ctx.fillRect(0, 0, TEXTURE_W, TEXTURE_H);

    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit + 10}%, 0.5)`;
    ctx.fillRect(0, TEXTURE_H - 88, TEXTURE_W, 88);

    const size = 260;
    const ix = (TEXTURE_W - size) / 2;
    const iy = 46;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, size, size);
    ctx.clip();
    ctx.drawImage(img, ix, iy, size, size);
    ctx.restore();
    book.loadedIcon = img;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    wrapText(ctx, book.title, TEXTURE_W / 2, TEXTURE_H - 44, TEXTURE_W - 32, 24);

    const newTex = new this.THREE.CanvasTexture(canvas);
    newTex.needsUpdate = true;
    book.mesh.material.map = newTex;
    book.mesh.material.needsUpdate = true;
    if (book.tex && book.tex !== newTex) book.tex.dispose();
    book.tex = newTex;
  }

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load: " + url));
      img.src = url;
    });
  }

  spawnPosition(game) {
    const h = hashId(game.id);
    const angle = h * 0.618;
    const radius = 1 + ((h % 3000) / 3000) * 3;
    return new this.THREE.Vector3(
      Math.cos(angle) * radius,
      Math.min(SPAWN_Y + (h % 20) * 0.05, 2.7),
      Math.sin(angle) * radius
    );
  }

  createMesh(texture) {
    const T = this.THREE;
    const geo = new T.BoxGeometry(BOOK_WIDTH, BOOK_HEIGHT, BOOK_DEPTH);
    const mat = new T.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      metalness: 0.05
    });
    const mesh = new T.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isBook = true;
    return mesh;
  }

  getBooks() {
    return this.books;
  }

  searchBooks(query) {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    return this.books.filter((b) => b.title.toLowerCase().includes(q));
  }

  highlightBooks(query) {
    for (const book of this.books) {
      if (query && query.length > 0 && book.title.toLowerCase().includes(query.toLowerCase())) {
        book.mesh.material.emissive.setHex(0x8844ff);
        book.mesh.material.emissiveIntensity = 0.6;
      } else {
        book.mesh.material.emissive.setHex(0x000000);
        book.mesh.material.emissiveIntensity = 0;
      }
    }
  }

  clearHighlights() {
    for (const book of this.books) {
      book.mesh.material.emissive.setHex(0x000000);
      book.mesh.material.emissiveIntensity = 0;
    }
  }

  getPositions() {
    const positions = {};
    for (const book of this.books) {
      if (book.shelved) continue;
      const p = book.mesh.position;
      const r = book.mesh.rotation;
      positions[book.gameId] = {
        x: p.x,
        y: p.y,
        z: p.z,
        rx: r.x,
        ry: r.y,
        rz: r.z
      };
    }
    return positions;
  }

  placeShelvedBooks(shelfManager) {
    const quat = new this.THREE.Quaternion();
    quat.setFromAxisAngle(new this.THREE.Vector3(0, 1, 0), Math.PI / 2);

    for (const book of this.books) {
      if (book.shelvedAt == null) continue;
      const slot = shelfManager.getSlotByIndex(book.shelvedAt);
      if (!slot || slot.occupied) continue;

      slot.occupied = true;
      slot.book = book;
      book.shelved = true;
      book.grabbed = false;

      book.mesh.position.copy(slot.position);
      book.mesh.quaternion.copy(quat);
      book.body.position.set(slot.position.x, slot.position.y, slot.position.z);
      book.body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
      book.body.type = CANNON.Body.KINEMATIC;
      book.body.velocity.set(0, 0, 0);
      book.body.angularVelocity.set(0, 0, 0);
      book.body.mass = 0;
      book.body.invMass = 0;
      book.body.updateMassProperties();

      book.shelvedAt = null;
    }
  }

  getMeshes() {
    return this.books.filter((b) => !b.grabbed).map((b) => b.mesh);
  }

  update(delta) {
    let spawned = 0;
    while (this.spawnQueue.length > 0 && spawned < BATCH_PER_FRAME) {
      const book = this.spawnQueue.shift();
      this.scene.add(book.mesh);
      book.body.position.set(book.pos.x, book.pos.y, book.pos.z);
      book.body.velocity.set(0, 0, 0);
      book.body.angularVelocity.set(0, 0, 0);
      book.body.wakeUp();
      book.mesh.position.set(book.pos.x, book.pos.y, book.pos.z);
      this.books.push(book);
      spawned++;
    }
    if (this.spawnQueue.length === 0 && !this.done) {
      this.done = true;
    }
    this.physics.update(this.books, delta);
  }

  getSpawnProgress() {
    const total = this.books.length + this.spawnQueue.length;
    return total > 0 ? this.books.length / total : 1;
  }

  destroy() {
    for (const book of this.books) {
      this.physics.removeBody(book.body);
      this.scene.remove(book.mesh);
      if (book.mesh.material.map) book.mesh.material.map.dispose();
      book.mesh.material.dispose();
      book.mesh.geometry.dispose();
    }
    for (const book of this.spawnQueue) {
      this.physics.removeBody(book.body);
      if (book.mesh.material.map) book.mesh.material.map.dispose();
      book.mesh.material.dispose();
      book.mesh.geometry.dispose();
    }
    this.physics.destroy();
    this.books = [];
    this.spawnQueue = [];
    this.gamePool = [];
    this.trashed = [];
  }
}
