import * as CANNON from "cannon-es";

const SHELF_Y_LEVELS = [0.5, 1.1, 1.7];
const SLOTS_PER_SHELF = 10;
const SHELF_X = -3.47;

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
    this.animatingBooks = [];
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

    const back = new T.Mesh(new T.BoxGeometry(0.05, 2.4, 4.4), darkWoodMat);
    back.position.set(-3.75, 1.2, 0);
    back.userData.title = "Bookshelf";
    this.scene.add(back);
    this.shelfMeshes.push(back);

    for (const zSign of [-1, 1]) {
      const side = new T.Mesh(new T.BoxGeometry(0.3, 2.4, 0.05), woodMat);
      side.position.set(-3.6, 1.2, zSign * 2.2);
      side.userData.title = "Bookshelf";
      this.scene.add(side);
      this.shelfMeshes.push(side);
    }

    for (const y of SHELF_Y_LEVELS) {
      const plank = new T.Mesh(new T.BoxGeometry(0.3, 0.03, 4.2), woodMat);
      plank.position.set(-3.6, y, 0);
      plank.userData.title = "Bookshelf";
      this.scene.add(plank);
      this.shelfMeshes.push(plank);

      const body = new CANNON.Body({ mass: 0 });
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.15, 0.015, 2.1)));
      body.position.set(-3.6, y, 0);
      this.physicsWorld.addBody(body);
    }

    for (const shelfY of SHELF_Y_LEVELS) {
      for (let i = 0; i < SLOTS_PER_SHELF; i++) {
        const t = SLOTS_PER_SHELF > 1 ? i / (SLOTS_PER_SHELF - 1) : 0.5;
        const z = -1.87 + t * 3.74;
        this.slots.push({
          position: new T.Vector3(SHELF_X, shelfY + 0.21, z),
          occupied: false,
          book: null,
          shelfY,
          index: this.slots.length
        });
      }
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

  getSlotByBook(book) {
    for (const slot of this.slots) {
      if (slot.book === book) return slot;
    }
    return null;
  }

  isBookShelved(book) {
    return this.getSlotByBook(book) !== null;
  }

  getSlotByIndex(index) {
    return this.slots[index] || null;
  }

  getShelfAssignments() {
    const assignments = {};
    for (const slot of this.slots) {
      if (slot.occupied && slot.book) {
        assignments[slot.book.gameId] = slot.index;
      }
    }
    return assignments;
  }

  shelveBook(book, slot) {
    slot.occupied = true;
    slot.book = book;

    const quat = new this.THREE.Quaternion();
    quat.setFromAxisAngle(new this.THREE.Vector3(0, 1, 0), Math.PI / 2);

    this.animatingBooks.push({
      book,
      slot,
      startPos: book.mesh.position.clone(),
      startQuat: book.mesh.quaternion.clone(),
      targetPos: slot.position.clone(),
      targetQuat: quat,
      progress: 0,
      duration: 0.35
    });

    book.grabbed = false;
    book.body.type = CANNON.Body.KINEMATIC;
  }

  popBookFromSlot(book) {
    const slot = this.getSlotByBook(book);
    if (!slot) return false;
    slot.occupied = false;
    slot.book = null;
    book.body.type = CANNON.Body.DYNAMIC;
    book.body.updateMassProperties();
    book.body.allowSleep = true;
    book.body.wakeUp();
    return true;
  }

  update(delta) {
    for (let i = this.animatingBooks.length - 1; i >= 0; i--) {
      const anim = this.animatingBooks[i];
      anim.progress += delta / anim.duration;

      if (anim.progress >= 1) {
        anim.book.mesh.position.copy(anim.targetPos);
        anim.book.mesh.quaternion.copy(anim.targetQuat);
        anim.book.mesh.position.copy(anim.targetPos);
        anim.book.body.position.set(anim.targetPos.x, anim.targetPos.y, anim.targetPos.z);
        anim.book.body.quaternion.set(anim.targetQuat.x, anim.targetQuat.y, anim.targetQuat.z, anim.targetQuat.w);
        this.animatingBooks.splice(i, 1);
      } else {
        const t = easeOutCubic(anim.progress);
        anim.book.mesh.position.lerpVectors(anim.startPos, anim.targetPos, t);
        anim.book.mesh.quaternion.slerpQuaternions(anim.startQuat, anim.targetQuat, t);
        anim.book.pos.copy(anim.book.mesh.position);
        anim.book.body.position.set(anim.book.mesh.position.x, anim.book.mesh.position.y, anim.book.mesh.position.z);
      }
    }
  }

  destroy() {
    for (const mesh of this.shelfMeshes) {
      this.scene.remove(mesh);
    }
    this.shelfMeshes = [];
    this.slots = [];
    this.animatingBooks = [];
  }
}
