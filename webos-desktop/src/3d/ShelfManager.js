import * as CANNON from "cannon-es";
import { GENRES } from "./GameState.js";
import { createElement } from "../shared/domUtils.js";

const SHELF_Y_LEVELS = [0.5, 1.25, 2.0];
const SHELF_WIDTH = 0.55;
const SHELF_DEPTH = 0.5;
const SHELF_HEIGHT = 2.5;
const PLANK_THICKNESS = 0.03;
const SLOT_Z_OFFSET = 0.12;

const ALL_GENRES = ["horror", "strategy", "casual", "puzzle", "action", "adventure", "simulation", "rpg", "platformer"];

const SHELF_POSITIONS = [
  { x: -4.5, z: -2.8, genre: "horror" },
  { x: -4.5, z: -1.4, genre: "strategy" },
  { x: -4.5, z: 0, genre: "casual" },
  { x: -4.5, z: 1.4, genre: "puzzle" },
  { x: -4.5, z: 2.8, genre: "action" },
  { x: 4.5, z: -2.8, genre: "adventure" },
  { x: 4.5, z: -1.4, genre: "simulation" },
  { x: 4.5, z: 0, genre: "rpg" },
  { x: 4.5, z: 1.4, genre: "platformer" }
];

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export class ShelfManager {
  constructor(THREE, scene, physicsWorld) {
    this.THREE = THREE;
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.slots = [];
    this.shelfMeshes = [];
    this.animatingCases = [];
    this.gameMode = false;
    this.shelfCategories = {};
    this.labelMeshes = [];
    this.categoryGlowMeshes = [];
    this.shelfData = [];
  }

  setGameMode(enabled) {
    this.gameMode = enabled;
    if (enabled) {
      this.createLabels();
    } else {
      this.clearLabels();
    }
  }

  getShelfCategory(slot) {
    if (!this.gameMode) return null;
    return slot.genre || null;
  }

  isCorrectShelf(gameCase, slot) {
    if (!this.gameMode) return true;
    const gameCaseGenre = gameCase.genre || "casual";
    return gameCaseGenre === slot.genre;
  }

  createLabels() {
    const T = this.THREE;

    for (const shelf of this.shelfData) {
      const category = shelf.genre;
      const genreInfo = GENRES[category];
      const colorHex = genreInfo ? genreInfo.color : 0x44cc88;
      const r = (colorHex >> 16) & 0xff;
      const g = (colorHex >> 8) & 0xff;
      const b2 = colorHex & 0xff;
      const colorStr = `rgb(${r}, ${g}, ${b2})`;

      const canvas = createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = colorStr;
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(genreInfo ? genreInfo.label : category, 128, 32);

      const tex = new T.CanvasTexture(canvas);
      tex.needsUpdate = true;
      const mat = new T.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.85,
        side: T.DoubleSide
      });
      const labelGeo = new T.PlaneGeometry(0.4, 0.1);
      const labelMesh = new T.Mesh(labelGeo, mat);
      const labelX = shelf.x < 0 ? shelf.x + SHELF_WIDTH / 2 + 0.005 : shelf.x - SHELF_WIDTH / 2 - 0.005;
      labelMesh.position.set(labelX, SHELF_Y_LEVELS[2] + 0.3, shelf.z);
      labelMesh.rotation.y = shelf.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      labelMesh.userData.isLabel = true;
      this.scene.add(labelMesh);
      this.labelMeshes.push(labelMesh);

      const glowGeo = new T.PlaneGeometry(0.38, 0.09);
      const glowMat = new T.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0,
        side: T.DoubleSide
      });
      const glowMesh = new T.Mesh(glowGeo, glowMat);
      glowMesh.position.set(labelX, SHELF_Y_LEVELS[2] + 0.3, shelf.z);
      glowMesh.rotation.y = shelf.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      glowMesh.userData.isGlow = true;
      this.scene.add(glowMesh);
      this.categoryGlowMeshes.push(glowMesh);
    }
  }

  highlightCategory(genre, duration) {
    if (!this.gameMode) return;
    for (let i = 0; i < this.shelfData.length; i++) {
      if (this.shelfData[i].genre === genre) {
        this.categoryGlowMeshes[i].material.opacity = 0.6;
        setTimeout(() => {
          if (this.categoryGlowMeshes[i]) this.categoryGlowMeshes[i].material.opacity = 0;
        }, duration);
      }
    }
  }

  flashSlot(slot, correct) {
    if (!this.gameMode) return;
    const color = correct ? 0x44ff88 : 0xff4444;
    const T = this.THREE;
    const flashGeo = new T.PlaneGeometry(0.35, 0.42);
    const flashMat = new T.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      side: T.DoubleSide
    });
    const flashMesh = new T.Mesh(flashGeo, flashMat);
    flashMesh.position.copy(slot.position);
    flashMesh.position.x += 0.02;
    flashMesh.rotation.y = slot.position.x < 0 ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(flashMesh);

    let elapsed = 0;
    const animate = () => {
      elapsed += 0.016;
      flashMat.opacity = Math.max(0, 0.7 * (1 - elapsed / 1.2));
      if (elapsed < 1.2) {
        requestAnimationFrame(animate);
      } else {
        this.scene.remove(flashMesh);
        flashGeo.dispose();
        flashMat.dispose();
      }
    };
    requestAnimationFrame(animate);
  }

  clearLabels() {
    for (const mesh of this.labelMeshes) {
      this.scene.remove(mesh);
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
      mesh.geometry.dispose();
    }
    this.labelMeshes = [];
    for (const mesh of this.categoryGlowMeshes) {
      this.scene.remove(mesh);
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
      mesh.geometry.dispose();
    }
    this.categoryGlowMeshes = [];
    this.shelfCategories = {};
  }

  build(savedShelves) {
    const T = this.THREE;
    this.savedShelves = savedShelves || {};

    const woodMat = new T.MeshStandardMaterial({
      color: 0x5c3a1e,
      roughness: 0.9,
      metalness: 0
    });
    const darkWoodMat = new T.MeshStandardMaterial({
      color: 0x4a2e14,
      roughness: 0.9,
      metalness: 0
    });

    for (let s = 0; s < ALL_GENRES.length; s++) {
      const genre = ALL_GENRES[s];
      const sp = SHELF_POSITIONS[s];
      const sx = sp.x;
      const sz = sp.z;

      const back = new T.Mesh(new T.BoxGeometry(0.05, SHELF_HEIGHT, SHELF_DEPTH), darkWoodMat);
      back.position.set(sx, SHELF_HEIGHT / 2, sz);
      back.userData.title = genre + " Shelf";
      this.scene.add(back);
      this.shelfMeshes.push(back);

      for (const zSign of [-1, 1]) {
        const side = new T.Mesh(new T.BoxGeometry(SHELF_WIDTH, SHELF_HEIGHT, 0.05), woodMat);
        side.position.set(sx, SHELF_HEIGHT / 2, sz + (zSign * SHELF_DEPTH) / 2);
        side.userData.title = genre + " Shelf";
        this.scene.add(side);
        this.shelfMeshes.push(side);

        const sideBody = new CANNON.Body({ mass: 0 });
        sideBody.addShape(new CANNON.Box(new CANNON.Vec3(SHELF_WIDTH / 2, SHELF_HEIGHT / 2, 0.025)));
        sideBody.position.set(sx, SHELF_HEIGHT / 2, sz + (zSign * SHELF_DEPTH) / 2);
        this.physicsWorld.addBody(sideBody);
      }

      const backBody = new CANNON.Body({ mass: 0 });
      backBody.addShape(new CANNON.Box(new CANNON.Vec3(0.025, SHELF_HEIGHT / 2, SHELF_DEPTH / 2)));
      backBody.position.set(sx, SHELF_HEIGHT / 2, sz);
      this.physicsWorld.addBody(backBody);

      for (const y of SHELF_Y_LEVELS) {
        const plank = new T.Mesh(new T.BoxGeometry(SHELF_WIDTH, PLANK_THICKNESS, SHELF_DEPTH), woodMat);
        plank.position.set(sx, y, sz);
        plank.userData.title = genre + " Shelf";
        this.scene.add(plank);
        this.shelfMeshes.push(plank);

        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(SHELF_WIDTH / 2, PLANK_THICKNESS / 2, SHELF_DEPTH / 2)));
        body.position.set(sx, y, sz);
        this.physicsWorld.addBody(body);
      }

      const innerEdge = sx < 0 ? sx + SHELF_WIDTH / 2 : sx - SHELF_WIDTH / 2;
      const slotXs =
        sx < 0
          ? [innerEdge - 0.02, innerEdge - 0.08, innerEdge - 0.14]
          : [innerEdge + 0.02, innerEdge + 0.08, innerEdge + 0.14];

      for (const shelfY of SHELF_Y_LEVELS) {
        for (const slotX of slotXs) {
          this.slots.push({
            position: new T.Vector3(slotX, shelfY + 0.22, sz),
            occupied: false,
            gameCase: null,
            shelfY,
            index: this.slots.length,
            genre: genre,
            shelfIndex: s
          });
        }
      }

      this.shelfData.push({ x: sx, z: sz, genre: genre });
    }
  }

  getNearestEmptySlot(pos) {
    let best = null;
    let bestDist = Infinity;
    for (const slot of this.slots) {
      if (slot.occupied) continue;
      const dist = pos.distanceTo(slot.position);
      if (dist < bestDist) {
        bestDist = dist;
        best = slot;
      }
    }
    return bestDist < 0.5 ? best : null;
  }

  getSlotByCase(gameCase) {
    for (const slot of this.slots) {
      if (slot.gameCase === gameCase) return slot;
    }
    return null;
  }

  isCaseShelved(gameCase) {
    return this.getSlotByCase(gameCase) !== null;
  }

  getSlotByIndex(index) {
    return this.slots[index] || null;
  }

  getShelfAssignments() {
    const assignments = {};
    for (const slot of this.slots) {
      if (slot.occupied && slot.gameCase) {
        assignments[slot.gameCase.gameId] = slot.index;
      }
    }
    return assignments;
  }

  shelveCase(gameCase, slot) {
    slot.occupied = true;
    slot.gameCase = gameCase;

    const quat = new this.THREE.Quaternion();
    quat.setFromAxisAngle(new this.THREE.Vector3(0, 1, 0), Math.PI / 2);

    this.animatingCases.push({
      gameCase,
      slot,
      startPos: gameCase.mesh.position.clone(),
      startQuat: gameCase.mesh.quaternion.clone(),
      targetPos: slot.position.clone(),
      targetQuat: quat,
      progress: 0,
      duration: 0.35
    });

    gameCase.grabbed = false;
    gameCase.body.type = CANNON.Body.KINEMATIC;
  }

  popCaseFromSlot(gameCase) {
    const slot = this.getSlotByCase(gameCase);
    if (!slot) return false;
    slot.occupied = false;
    slot.gameCase = null;
    gameCase.body.type = CANNON.Body.DYNAMIC;
    if (gameCase.dynamicMass) {
      gameCase.body.mass = gameCase.dynamicMass;
    }
    gameCase.body.updateMassProperties();
    gameCase.body.allowSleep = true;
    gameCase.body.wakeUp();
    return true;
  }

  update(delta) {
    for (let i = this.animatingCases.length - 1; i >= 0; i--) {
      const anim = this.animatingCases[i];
      anim.progress += delta / anim.duration;

      if (anim.progress >= 1) {
        anim.gameCase.mesh.position.copy(anim.targetPos);
        anim.gameCase.mesh.quaternion.copy(anim.targetQuat);
        anim.gameCase.mesh.position.copy(anim.targetPos);
        anim.gameCase.body.position.set(anim.targetPos.x, anim.targetPos.y, anim.targetPos.z);
        anim.gameCase.body.quaternion.set(anim.targetQuat.x, anim.targetQuat.y, anim.targetQuat.z, anim.targetQuat.w);
        this.animatingCases.splice(i, 1);
      } else {
        const t = easeOutCubic(anim.progress);
        anim.gameCase.mesh.position.lerpVectors(anim.startPos, anim.targetPos, t);
        anim.gameCase.mesh.quaternion.slerpQuaternions(anim.startQuat, anim.targetQuat, t);
        anim.gameCase.pos.copy(anim.gameCase.mesh.position);
        anim.gameCase.body.position.set(
          anim.gameCase.mesh.position.x,
          anim.gameCase.mesh.position.y,
          anim.gameCase.mesh.position.z
        );
      }
    }
  }

  destroy() {
    this.clearLabels();
    for (const mesh of this.shelfMeshes) {
      this.scene.remove(mesh);
    }
    this.shelfMeshes = [];
    this.slots = [];
    this.animatingCases = [];
  }
}
