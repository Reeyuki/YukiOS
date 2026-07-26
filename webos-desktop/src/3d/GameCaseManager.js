import { appMap } from "../games/gamesList.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { GameCasePhysics } from "./GameCasePhysics.js";
import { GAME_GENRES, GENRES } from "./GameState.js";
import * as CANNON from "cannon-es";

const BOOK_WIDTH = 0.3;
const BOOK_HEIGHT = 0.42;
const BOOK_DEPTH = 0.04;
const TEXTURE_W = 320;
const TEXTURE_H = 440;
const SPAWN_Y = 2.5;
const BATCH_PER_FRAME = 4;
const INITIAL_SPAWN = 20;
const EXCLUDED = new Set(["TMNP", "vscode", "paint", "photopea", "liventcord", "nightInTheWoods"]);

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
  angryBirds2: 70,
  lobotomyCorporation: 49,
  catGoesFishing: 79,
  inscryption: 46,
  stardew: 52,
  inStarsAndTime: 40
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

export function getGameList() {
  return Object.entries(appMap)
    .filter(([id, data]) => data.type !== "system" && !EXCLUDED.has(id) && data.icon && data.title)
    .map(([id, data]) => ({
      id,
      title: data.title,
      icon: data.icon
    }));
}

export class GameCaseManager {
  constructor(scene, bounds, interaction, colliders) {
    this.scene = scene;
    this.bounds = bounds;
    this.interaction = interaction;
    this.gameCases = [];
    this.spawnQueue = [];
    this.gamePool = [];
    this.trashed = [];
    this.physics = new GameCasePhysics(bounds, colliders);
    this.ballBody = null;
    this.THREE = null;
    this.done = false;
    this.gameMode = false;
    this.gameState = null;
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
      const gameCase = this.spawnQueue.splice(queueIdx, 1)[0];
      this.scene.add(gameCase.mesh);
      gameCase.body.position.set(gameCase.pos.x, gameCase.pos.y, gameCase.pos.z);
      gameCase.body.velocity.set(0, 0, 0);
      gameCase.body.angularVelocity.set(0, 0, 0);
      gameCase.body.wakeUp();
      gameCase.mesh.position.set(gameCase.pos.x, gameCase.pos.y, gameCase.pos.z);
      this.gameCases.push(gameCase);
      return gameCase;
    }

    const spawned = this.gameCases.find((b) => b.gameId === gameId);
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

    const gameCase = {
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

    this.gameCases.push(gameCase);
    this.loadSingleIcon(gameCase).catch(() => {});

    return gameCase;
  }

  trashCase(gameCase) {
    gameCase.grabbed = false;
    this.scene.remove(gameCase.mesh);
    this.physics.removeBody(gameCase.body);
    if (gameCase.tex) {
      if (gameCase.mesh.material.map) gameCase.mesh.material.map.dispose();
      gameCase.mesh.material.dispose();
      gameCase.mesh.geometry.dispose();
    }
    const bIdx = this.gameCases.indexOf(gameCase);
    if (bIdx !== -1) this.gameCases.splice(bIdx, 1);
    this.trashed.push(gameCase.gameId);

    if (this.interaction.povGrabbedCase === gameCase) {
      this.interaction.povGrabbedCase = null;
    }
    if (this.interaction.grabbedCase === gameCase) {
      this.interaction.grabbedCase = null;
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
    const spawned = this.gameCases.map((b) => ({
      id: b.gameId,
      title: b.title,
      icon: b.iconUrl
    }));
    return { spawned, pool: this.gamePool, trashed: [...this.trashed] };
  }

  drawTexture(game, ctx, canvas) {
    const h = hashId(game.id);
    let hue, sat, lit;

    if (this.gameMode) {
      const genre = GAME_GENRES[game.id] || "casual";
      const genreInfo = GENRES[genre];
      const genreColor = genreInfo ? genreInfo.color : 0x44cc88;
      const r2 = ((genreColor >> 16) & 0xff) / 255;
      const g2 = ((genreColor >> 8) & 0xff) / 255;
      const b2 = (genreColor & 0xff) / 255;
      const max = Math.max(r2, g2, b2);
      const min = Math.min(r2, g2, b2);
      const d = max - min;
      let h2 = 0;
      if (d > 0) {
        if (max === r2) h2 = ((g2 - b2) / d) % 6;
        else if (max === g2) h2 = (b2 - r2) / d + 2;
        else h2 = (r2 - g2) / d + 4;
        h2 = Math.round(h2 * 60);
        if (h2 < 0) h2 += 360;
      }
      hue = h2;
      sat = 55;
      lit = 28;
    } else {
      hue = h % 360;
      sat = 45 + (h % 20);
      lit = 25 + (h % 15);
    }

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

    if (this.gameMode) {
      const genre = this.getGenreForGame(game.id);
      const genreInfo = GENRES[genre];
      const genreLabel = genreInfo ? genreInfo.label : genre;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("[" + genreLabel.toUpperCase() + "]", TEXTURE_W / 2, TEXTURE_H - 64);
    }

    const tex = new this.THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  async loadIcons() {
    const all = [...this.spawnQueue];
    const promises = all.map((gameCase) => this.loadSingleIcon(gameCase).catch(() => {}));
    await Promise.allSettled(promises);
  }

  async loadSingleIcon(gameCase) {
    if (/^fa[srb]?\s+fa-/.test(gameCase.iconUrl)) return;
    const url = resolveIconUrl(gameCase.iconUrl);
    if (!url) return;
    const img = await this.loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_W;
    canvas.height = TEXTURE_H;
    const ctx = canvas.getContext("2d");

    const h = hashId(gameCase.gameId);
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
    gameCase.loadedIcon = img;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    wrapText(ctx, gameCase.title, TEXTURE_W / 2, TEXTURE_H - 44, TEXTURE_W - 32, 24);

    const newTex = new this.THREE.CanvasTexture(canvas);
    newTex.needsUpdate = true;
    gameCase.mesh.material.map = newTex;
    gameCase.mesh.material.needsUpdate = true;
    if (gameCase.tex && gameCase.tex !== newTex) gameCase.tex.dispose();
    gameCase.tex = newTex;
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

  getGameCases() {
    return this.gameCases;
  }

  searchGameCases(query) {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    return this.gameCases.filter((b) => b.title.toLowerCase().includes(q));
  }

  highlightGameCases(query) {
    for (const gameCase of this.gameCases) {
      if (query && query.length > 0 && gameCase.title.toLowerCase().includes(query.toLowerCase())) {
        gameCase.mesh.material.emissive.setHex(0x00ddff);
        gameCase.mesh.material.emissiveIntensity = 0.6;
      } else {
        gameCase.mesh.material.emissive.setHex(0x000000);
        gameCase.mesh.material.emissiveIntensity = 0;
      }
    }
  }

  clearHighlights() {
    for (const gameCase of this.gameCases) {
      gameCase.mesh.material.emissive.setHex(0x000000);
      gameCase.mesh.material.emissiveIntensity = 0;
    }
  }

  getPositions() {
    const positions = {};
    for (const gameCase of this.gameCases) {
      if (gameCase.shelved) continue;
      const p = gameCase.mesh.position;
      const r = gameCase.mesh.rotation;
      positions[gameCase.gameId] = {
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

  placeShelvedCases(shelfManager) {
    const quat = new this.THREE.Quaternion();
    quat.setFromAxisAngle(new this.THREE.Vector3(0, 1, 0), Math.PI / 2);

    for (const gameCase of this.gameCases) {
      if (gameCase.shelvedAt == null) continue;
      const slot = shelfManager.getSlotByIndex(gameCase.shelvedAt);
      if (!slot || slot.occupied) continue;

      slot.occupied = true;
      slot.gameCase = gameCase;
      gameCase.shelved = true;
      gameCase.grabbed = false;

      gameCase.mesh.position.copy(slot.position);
      gameCase.mesh.quaternion.copy(quat);
      gameCase.body.position.set(slot.position.x, slot.position.y, slot.position.z);
      gameCase.body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
      gameCase.body.type = CANNON.Body.KINEMATIC;
      gameCase.body.velocity.set(0, 0, 0);
      gameCase.body.angularVelocity.set(0, 0, 0);
      gameCase.body.mass = 0;
      gameCase.body.invMass = 0;
      gameCase.body.updateMassProperties();

      gameCase.shelvedAt = null;
    }
  }

  getMeshes() {
    return this.gameCases.filter((b) => !b.grabbed).map((b) => b.mesh);
  }

  setGameMode(enabled, gameState) {
    this.gameMode = enabled;
    this.gameState = gameState;
  }

  getGenreForGame(gameId) {
    return GAME_GENRES[gameId] || "casual";
  }

  scatteredSpawnPosition(gameId, index) {
    const T = this.THREE;
    const b = this.bounds;
    const margin = 0.8;
    const zones = [
      { xMin: b.minX + margin, xMax: -1, zMin: b.minZ + margin, zMax: -0.5 },
      { xMin: 0.5, xMax: b.maxX - margin, zMin: b.minZ + margin, zMax: -0.5 },
      { xMin: b.minX + margin, xMax: -1, zMin: 0.5, zMax: b.maxZ - margin },
      { xMin: 0.5, xMax: b.maxX - margin, zMin: 0.5, zMax: b.maxZ - margin },
      { xMin: -0.5, xMax: 0.5, zMin: b.minZ + margin, zMax: b.maxZ - margin }
    ];
    const zone = zones[index % zones.length];
    const h = hashId(gameId);
    const rx = zone.xMin + ((h % 1000) / 1000) * (zone.xMax - zone.xMin);
    const rz = zone.zMin + (((h >> 10) % 1000) / 1000) * (zone.zMax - zone.zMin);
    const ry = (h % 360) * (Math.PI / 180);
    return new T.Vector3(rx, 0.02, rz);
  }

  startGameMode(gameState) {
    this.setGameMode(true, gameState);
    for (const gameCase of this.gameCases) {
      if (gameCase.shelved) {
        this.interaction.shelfManager?.popCaseFromSlot(gameCase);
      }
      this.scene.remove(gameCase.mesh);
      this.physics.removeBody(gameCase.body);
      if (gameCase.mesh.material.map) gameCase.mesh.material.map.dispose();
      gameCase.mesh.material.dispose();
      gameCase.mesh.geometry.dispose();
    }
    this.gameCases.length = 0;

    const SLOTS_PER_GENRE = 3;
    const TARGET_TOTAL = SLOTS_PER_GENRE * Object.keys(GENRES).length;
    const genreGames = Object.entries(GAME_GENRES)
      .map(([id, genre]) => {
        const data = appMap[id];
        if (!data || data.type === "system" || EXCLUDED.has(id) || !data.icon || !data.title) return null;
        return { id, title: data.title, icon: data.icon, genre };
      })
      .filter(Boolean);

    const byGenre = {};
    for (const game of genreGames) {
      (byGenre[game.genre] ||= []).push(game);
    }

    const selected = [];
    const genreKeys = Object.keys(GENRES);
    for (const genre of genreKeys) {
      const bucket = byGenre[genre] || [];
      const take = Math.min(bucket.length, SLOTS_PER_GENRE);
      for (let i = 0; i < take; i++) {
        selected.push(bucket[i]);
      }
    }

    for (let i = selected.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selected[i], selected[j]] = [selected[j], selected[i]];
    }

    const totalToSpawn = selected.length;
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_W;
    canvas.height = TEXTURE_H;
    const ctx = canvas.getContext("2d");
    const size = new THREE.Vector3(BOOK_WIDTH, BOOK_HEIGHT, BOOK_DEPTH);

    for (let i = 0; i < totalToSpawn; i++) {
      const game = selected[i];
      const tex = this.drawTexture(game, ctx, canvas);
      const mesh = this.createMesh(tex);
      mesh.userData.title = game.title;
      mesh.userData.genre = this.getGenreForGame(game.id);

      const pos = this.scatteredSpawnPosition(game.id, i);
      mesh.position.copy(pos);
      const flatRotation = new THREE.Euler(-Math.PI / 2, 0, (hashId(game.id) % 628) / 100 - 3.14);
      mesh.rotation.copy(flatRotation);

      const dynamicMass = 0.3 + Math.random() * 0.3;
      const body = this.physics.createBody(pos, size, dynamicMass);
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w);

      const gameCase = {
        mesh,
        pos: pos.clone(),
        size: size.clone(),
        mass: dynamicMass,
        dynamicMass,
        body,
        grabbed: false,
        gameId: game.id,
        title: game.title,
        genre: this.getGenreForGame(game.id),
        tex,
        iconUrl: game.icon,
        loadedIcon: null,
        shelvedAt: null,
        shelved: false,
        isCorrect: false
      };

      this.scene.add(mesh);
      this.gameCases.push(gameCase);
      this.loadSingleIcon(gameCase).catch(() => {});
    }

    gameState.totalGameCases = this.gameCases.length;
    gameState.remaining = this.gameCases.length;
  }

  update(delta) {
    let spawned = 0;
    while (this.spawnQueue.length > 0 && spawned < BATCH_PER_FRAME) {
      const gameCase = this.spawnQueue.shift();
      this.scene.add(gameCase.mesh);
      gameCase.body.position.set(gameCase.pos.x, gameCase.pos.y, gameCase.pos.z);
      gameCase.body.velocity.set(0, 0, 0);
      gameCase.body.angularVelocity.set(0, 0, 0);
      gameCase.body.wakeUp();
      gameCase.mesh.position.set(gameCase.pos.x, gameCase.pos.y, gameCase.pos.z);
      this.gameCases.push(gameCase);
      spawned++;
    }
    if (this.spawnQueue.length === 0 && !this.done) {
      this.done = true;
    }
    this.physics.update(this.gameCases, delta, this.ballBody);
  }

  getSpawnProgress() {
    const total = this.gameCases.length + this.spawnQueue.length;
    return total > 0 ? this.gameCases.length / total : 1;
  }

  destroy() {
    for (const gameCase of this.gameCases) {
      this.physics.removeBody(gameCase.body);
      this.scene.remove(gameCase.mesh);
      if (gameCase.mesh.material.map) gameCase.mesh.material.map.dispose();
      gameCase.mesh.material.dispose();
      gameCase.mesh.geometry.dispose();
    }
    for (const gameCase of this.spawnQueue) {
      this.physics.removeBody(gameCase.body);
      if (gameCase.mesh.material.map) gameCase.mesh.material.map.dispose();
      gameCase.mesh.material.dispose();
      gameCase.mesh.geometry.dispose();
    }
    this.physics.destroy();
    this.gameCases = [];
    this.spawnQueue = [];
    this.gamePool = [];
    this.trashed = [];
  }
}
