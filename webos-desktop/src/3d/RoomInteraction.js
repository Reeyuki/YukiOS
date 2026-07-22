import * as CANNON from "cannon-es";

export class RoomInteraction {
  constructor(renderer, controls) {
    this.renderer = renderer;
    this.controls = controls;
    this.raycaster = null;
    this.mouse = null;
    this.callbacks = new Map();
    this.prefixCallbacks = [];
    this.THREE = null;
    this.canvas = null;
    this.books = [];
    this.grabbedBook = null;
    this.grabPlane = null;
    this.grabOffset = null;
    this.lastGrabPos = null;
    this.povGrabbedBook = null;

    this.onCatalogOpen = null;
    this.onTrashRequest = null;
    this.nearWastebin = false;
    this.shelfManager = null;
    this.nearShelf = false;
    this.ballMesh = null;
    this.ballBody = null;
    this.ballGrabbed = false;
    this.grabbedBallMesh = null;
    this.onLaunchGame = null;
    this.furnitureManager = null;
  }

  async init() {
    const THREE = await import("three");
    this.THREE = THREE;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.grabPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.canvas = this.renderer.renderer.domElement;
    this.canvas.addEventListener("mousemove", (e) => this.onHover(e));
    this.canvas.style.cursor = "default";

    this.controls.onBeforeLock = (event) => this.onBeforeLock(event);
  }

  setBooks(books) {
    this.books = books;
  }

  getBookMeshes() {
    const meshes = this.books.filter((b) => !b.grabbed && b !== this.povGrabbedBook).map((b) => b.mesh);
    if (this.ballMesh && !this.ballGrabbed && !this.grabbedBallMesh) {
      meshes.push(this.ballMesh);
    }
    return meshes;
  }

  resolveCallback(id) {
    const exact = this.callbacks.get(id);
    if (exact) return exact;
    for (const { prefix, callback } of this.prefixCallbacks) {
      if (id && id.startsWith(prefix)) return callback;
    }
    return null;
  }

  dispatch(obj) {
    const id = obj.userData.objectId;
    const cb = this.resolveCallback(id);
    if (cb) return cb(obj) !== false;
    return false;
  }

  onBeforeLock(event) {
    this.updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

    if (this.grabbedBook || this.grabbedBallMesh) {
      if (this.grabbedBallMesh) this.releaseBall();
      else this.releaseBook();
      return true;
    }

    if (this.povGrabbedBook) {
      return true;
    }

    const objects = this.renderer.getInteractiveObjects();
    if (objects.length > 0) {
      const intersects = this.raycaster.intersectObjects(objects);
      if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        if (hitObj.userData.isFurniture && this.furnitureManager) {
          const item = this.furnitureManager.findByMesh(hitObj);
          if (item) {
            this.furnitureManager.grabFurniture(item);
            return true;
          }
        }
        this._lastIntersect = intersects[0];
        this.dispatch(hitObj);
        return true;
      }
    }

    const bookMeshes = this.getBookMeshes();
    if (bookMeshes.length > 0) {
      const intersects = this.raycaster.intersectObjects(bookMeshes);
      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        if (mesh === this.ballMesh) {
          this.grabBall();
        } else {
          const book = this.books.find((b) => b.mesh === mesh);
          if (book && this.shelfManager && this.shelfManager.isBookShelved(book) && this.onLaunchGame) {
            this.onLaunchGame(book.gameId);
          } else {
            this.grabBook(mesh);
          }
        }
        return true;
      }
    }

    return false;
  }

  grabBook(mesh) {
    const book = this.books.find((b) => b.mesh === mesh);
    if (!book) return;

    if (this.shelfManager) {
      this.shelfManager.popBookFromSlot(book);
    }

    book.grabbed = true;
    book.body.type = CANNON.Body.KINEMATIC;
    book.body.velocity.set(0, 0, 0);
    book.body.angularVelocity.set(0, 0, 0);
    book.body.allowSleep = false;
    book.body.wakeUp();
    this.grabbedBook = book;

    this.grabPlane.set(new this.THREE.Vector3(0, 1, 0), -book.mesh.position.y);

    const intersectPoint = new this.THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.grabPlane, intersectPoint);
    if (hit) {
      this.grabOffset = new this.THREE.Vector3().copy(book.mesh.position).sub(intersectPoint);
    } else {
      this.grabOffset = new this.THREE.Vector3(0, 0, 0);
    }

    this.lastGrabPos = book.mesh.position.clone();
  }

  releaseBook() {
    if (this.grabbedBook) {
      const book = this.grabbedBook;

      if (this.shelfManager && !book.isBall) {
        const slot = this.shelfManager.getNearestEmptySlot(book.mesh.position);
        if (slot) {
          this.shelfManager.shelveBook(book, slot);
          this.grabbedBook = null;
          this.grabOffset = null;
          return;
        }
      }

      const body = book.body;
      body.type = CANNON.Body.DYNAMIC;
      if (book.dynamicMass) {
        body.mass = book.dynamicMass;
      }
      body.updateMassProperties();
      body.allowSleep = true;
      body.wakeUp();
      if (this.lastGrabPos) {
        const throwVel = new this.THREE.Vector3().copy(book.pos).sub(this.lastGrabPos);
        body.velocity.set(throwVel.x, Math.max(throwVel.y, 0), throwVel.z);
        const spin = new this.THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5
        );
        body.angularVelocity.set(spin.x, spin.y, spin.z);
      }
      book.grabbed = false;
    }
    this.grabbedBook = null;
    this.grabOffset = null;
  }

  updateGrabbed() {
    if (this.grabbedBallMesh) {
      this.updateBallDrag();
      return;
    }
    if (!this.grabbedBook || !this.grabOffset) return;

    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

    this.grabPlane.set(new this.THREE.Vector3(0, 1, 0), -this.grabbedBook.pos.y);

    const intersectPoint = new this.THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.grabPlane, intersectPoint);
    if (!hit) return;

    this.lastGrabPos.copy(this.grabbedBook.pos);

    this.grabbedBook.mesh.position.copy(intersectPoint).add(this.grabOffset);

    const b = this.renderer.bounds;
    const sx = this.grabbedBook.size.x / 2;
    const sy = this.grabbedBook.size.y / 2;
    const sz = this.grabbedBook.size.z / 2;
    this.grabbedBook.mesh.position.x = Math.max(b.minX + sx, Math.min(b.maxX - sx, this.grabbedBook.mesh.position.x));
    this.grabbedBook.mesh.position.z = Math.max(b.minZ + sz, Math.min(b.maxZ - sz, this.grabbedBook.mesh.position.z));
    this.grabbedBook.mesh.position.y = Math.max(sy, Math.min(3 - sy, this.grabbedBook.mesh.position.y));

    this.grabbedBook.pos.copy(this.grabbedBook.mesh.position);
  }

  updateBallDrag() {
    if (!this.grabbedBallMesh || !this.grabOffset) return;

    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

    const y = this.grabbedBallMesh.position.y;
    this.grabPlane.set(new this.THREE.Vector3(0, 1, 0), -y);

    const intersectPoint = new this.THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.grabPlane, intersectPoint);
    if (!hit) return;

    this.lastGrabPos.copy(this.grabbedBallMesh.position);
    this.grabbedBallMesh.position.copy(intersectPoint).add(this.grabOffset);

    const b = this.renderer.bounds;
    this.grabbedBallMesh.position.x = Math.max(b.minX + 0.12, Math.min(b.maxX - 0.12, this.grabbedBallMesh.position.x));
    this.grabbedBallMesh.position.z = Math.max(b.minZ + 0.12, Math.min(b.maxZ - 0.12, this.grabbedBallMesh.position.z));
    this.grabbedBallMesh.position.y = Math.max(0.12, Math.min(3 - 0.12, this.grabbedBallMesh.position.y));

    if (this.ballBody) {
      this.ballBody.position.set(
        this.grabbedBallMesh.position.x,
        this.grabbedBallMesh.position.y,
        this.grabbedBallMesh.position.z
      );
    }
  }

  handleEKey(camera) {
    if (!this.raycaster) return false;
    if (this.povGrabbedBook) {
      if (!this.povGrabbedBook.isBall && this.nearWastebin && this.onTrashRequest) {
        this.onTrashRequest(this.povGrabbedBook);
        return true;
      }
      if (!this.povGrabbedBook.isBall && this.shelfManager && this.nearShelf) {
        const slot = this.shelfManager.getNearestEmptySlot(this.povGrabbedBook.mesh.position);
        if (slot) {
          this.shelfManager.shelveBook(this.povGrabbedBook, slot);
          this.povGrabbedBook = null;
          return true;
        }
      }
      this.releasePOVGrab(camera);
      return true;
    }

    if (this.grabbedBook) {
      this.releaseBook();
    }

    if (this.grabbedBallMesh) {
      const body = this.ballBody;
      body.type = CANNON.Body.DYNAMIC;
      body.updateMassProperties();
      body.allowSleep = true;
      body.wakeUp();
      const fwd = new this.THREE.Vector3(0, 0, -1);
      fwd.applyQuaternion(camera.quaternion);
      fwd.multiplyScalar(12);
      body.velocity.set(fwd.x, fwd.y, fwd.z);
      this.ballGrabbed = false;
      this.grabbedBallMesh = null;
      return true;
    }

    if (this.furnitureManager && this.furnitureManager.grabbed) {
      this.furnitureManager.releaseFurniture();
      return true;
    }

    if (this.controls.isLocked) {
      this.mouse.set(0, 0);
    }
    this.raycaster.setFromCamera(this.mouse, camera);

    const objects = this.renderer.getInteractiveObjects();
    if (objects.length > 0) {
      const intersects = this.raycaster.intersectObjects(objects);
      if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (obj.userData.isFurniture && this.furnitureManager) {
          const item = this.furnitureManager.findByMesh(obj);
          if (item) {
            this.furnitureManager.grabFurniture(item);
            return true;
          }
        }
        const id = obj.userData.objectId;
        if (id === "spawnBox") {
          if (this.onCatalogOpen) this.onCatalogOpen();
          return true;
        }
        if (id) {
          if (this.dispatch(obj)) return true;
        }
      }
    }

    const bookMeshes = this.getBookMeshes();
    if (bookMeshes.length === 0) return false;

    const intersects = this.raycaster.intersectObjects(bookMeshes);
    if (intersects.length === 0) return false;

    const mesh = intersects[0].object;

    if (mesh === this.ballMesh) {
      this.ballBody.type = CANNON.Body.KINEMATIC;
      this.ballBody.velocity.set(0, 0, 0);
      this.ballBody.angularVelocity.set(0, 0, 0);
      this.ballBody.allowSleep = false;
      this.ballBody.wakeUp();
      this.ballGrabbed = true;
      this.grabbedBallMesh = this.ballMesh;
      return true;
    }

    const book = this.books.find((b) => b.mesh === mesh);
    if (!book) return false;

    this.povGrabBook(book);
    return true;
  }

  povGrabBook(book) {
    if (this.shelfManager && this.shelfManager.isBookShelved(book)) {
      this.shelfManager.popBookFromSlot(book);
    }

    book.grabbed = true;
    book.body.type = CANNON.Body.KINEMATIC;
    book.body.velocity.set(0, 0, 0);
    book.body.angularVelocity.set(0, 0, 0);
    book.body.allowSleep = false;
    book.body.wakeUp();
    this.povGrabbedBook = book;
  }

  releasePOVGrab(camera) {
    if (!this.povGrabbedBook) return;
    const book = this.povGrabbedBook;
    const body = book.body;
    body.type = CANNON.Body.DYNAMIC;
    if (book.dynamicMass) {
      body.mass = book.dynamicMass;
    }
    body.updateMassProperties();
    body.allowSleep = true;
    body.wakeUp();
    if (camera && this.THREE) {
      const fwd = new this.THREE.Vector3(0, 0, -1);
      fwd.applyQuaternion(camera.quaternion);
      const speed = book.isBall ? 12 : 5;
      fwd.multiplyScalar(speed);
      body.velocity.set(fwd.x, fwd.y, fwd.z);
    }
    book.grabbed = false;
    this.povGrabbedBook = null;
  }

  grabBall() {
    if (!this.ballMesh) return;

    this.ballGrabbed = true;
    this.ballBody.type = CANNON.Body.KINEMATIC;
    this.ballBody.velocity.set(0, 0, 0);
    this.ballBody.angularVelocity.set(0, 0, 0);
    this.ballBody.allowSleep = false;
    this.ballBody.wakeUp();
    this.grabbedBallMesh = this.ballMesh;

    this.grabPlane.set(new this.THREE.Vector3(0, 1, 0), -this.ballMesh.position.y);

    const intersectPoint = new this.THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.grabPlane, intersectPoint);
    if (hit) {
      this.grabOffset = new this.THREE.Vector3().copy(this.ballMesh.position).sub(intersectPoint);
    } else {
      this.grabOffset = new this.THREE.Vector3(0, 0, 0);
    }

    this.lastGrabPos = this.ballMesh.position.clone();
  }

  releaseBall() {
    if (!this.grabbedBallMesh) return;
    const body = this.ballBody;
    body.type = CANNON.Body.DYNAMIC;
    body.updateMassProperties();
    body.allowSleep = true;
    body.wakeUp();
    if (this.lastGrabPos) {
      const throwVel = new this.THREE.Vector3().copy(this.ballMesh.position).sub(this.lastGrabPos);
      body.velocity.set(throwVel.x * 3, Math.max(throwVel.y * 3, 2), throwVel.z * 3);
    }
    this.ballGrabbed = false;
    this.grabbedBallMesh = null;
  }

  setBallMesh(mesh, body) {
    this.ballMesh = mesh;
    this.ballBody = body;
    this.ballGrabbed = false;
    this.grabbedBallMesh = null;
  }

  setShelfManager(shelfManager) {
    this.shelfManager = shelfManager;
  }

  setFurnitureManager(fm) {
    this.furnitureManager = fm;
  }

  updateEGrabbed(camera) {
    if (this.povGrabbedBook) {
      const forward = new this.THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(camera.quaternion);

      const distance = 0.9;
      const targetPos = camera.position.clone().add(forward.multiplyScalar(distance));
      targetPos.y += 0.15;

      this.povGrabbedBook.mesh.position.copy(targetPos);
      this.povGrabbedBook.pos.copy(targetPos);
      this.povGrabbedBook.mesh.quaternion.copy(camera.quaternion);
    } else if (this.grabbedBallMesh) {
      const forward = new this.THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(camera.quaternion);

      const distance = 0.9;
      const targetPos = camera.position.clone().add(forward.multiplyScalar(distance));
      targetPos.y += 0.15;

      this.grabbedBallMesh.position.copy(targetPos);
      if (this.ballBody) {
        this.ballBody.position.set(targetPos.x, targetPos.y, targetPos.z);
      }
    }
  }

  isEGrabbed() {
    return this.povGrabbedBook !== null || this.grabbedBallMesh !== null;
  }

  updateWastebinProximity(camera) {
    this.nearShelf = false;
    if (!this.povGrabbedBook || this.povGrabbedBook.isBall) {
      this.nearWastebin = false;
      return;
    }
    const dx = camera.position.x - -2.5;
    const dz = camera.position.z - 2;
    const wasteDist = Math.sqrt(dx * dx + dz * dz);
    this.nearWastebin = wasteDist < 0.35;
    if (this.nearWastebin) {
      return;
    }

    if (this.shelfManager) {
      const slot = this.shelfManager.getNearestEmptySlot(this.povGrabbedBook.mesh.position);
      this.nearShelf = slot !== null;
    }
  }

  hashId(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
      h = (h << 5) - h + id.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  onHover(event) {
    if (this.grabbedBook || this.povGrabbedBook || this.grabbedBallMesh) {
      if (!this.povGrabbedBook) {
        this.canvas.style.cursor = "default";
      }
      return;
    }
    if (this.controls.isLocked) {
      this.mouse.set(0, 0);
    } else {
      this.updateMouse(event);
    }
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

    const holoScreen = this.renderer.monitorScreen;
    const holoRenderer = this.renderer.hologramRenderer;
    if (holoScreen && holoRenderer) {
      const holoHits = this.raycaster.intersectObject(holoScreen);
      if (holoHits.length > 0 && holoHits[0].uv) {
        const holoDist = holoHits[0].distance;
        let occluded = false;
        const bookMeshes = this.getBookMeshes();
        const objects = this.renderer.getInteractiveObjects();
        const allMeshes = this.renderer.roomObjects;
        const shelfMeshes = this.shelfManager ? this.shelfManager.shelfMeshes || [] : [];
        const blockers = [...bookMeshes, ...objects, ...allMeshes, ...shelfMeshes];
        if (blockers.length > 0) {
          const blockerHits = this.raycaster.intersectObjects(blockers);
          if (blockerHits.length > 0 && blockerHits[0].distance < holoDist) {
            occluded = true;
          }
        }
        if (!occluded) {
          const item = holoRenderer.getItemAtUV(holoHits[0].uv.x, holoHits[0].uv.y);
          if (item) {
            if (!this.controls.isLocked) this.canvas.style.cursor = "pointer";
            return;
          }
        }
      }
    }

    const bookMeshes = this.getBookMeshes();
    const objects = this.renderer.getInteractiveObjects();
    const allMeshes = this.renderer.roomObjects;
    const shelfMeshes = this.shelfManager ? this.shelfManager.shelfMeshes || [] : [];
    const everything = [...bookMeshes, ...objects, ...allMeshes, ...shelfMeshes];

    let found = false;

    if (everything.length > 0) {
      const intersects = this.raycaster.intersectObjects(everything);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const isBook = hit !== this.ballMesh && hit.userData.isBook;
        const hitBook = isBook ? this.books.find((b) => b.mesh === hit) : null;

        if (hit === this.ballMesh) {
          if (!this.controls.isLocked) this.canvas.style.cursor = "grab";
        } else if (isBook && hitBook) {
          if (!this.controls.isLocked) this.canvas.style.cursor = "grab";
        } else {
          if (!this.controls.isLocked) this.canvas.style.cursor = hit.userData.interactive ? "pointer" : "default";
        }

        found = true;
      }
    }

    if (!found) {
      if (!this.controls.isLocked) this.canvas.style.cursor = "default";
    }
  }

  register(id, callback) {
    this.callbacks.set(id, callback);
  }

  registerPrefix(prefix, callback) {
    this.prefixCallbacks.push({ prefix, callback });
  }

  updateMouse(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  destroy() {
    this.callbacks.clear();
    this.prefixCallbacks = [];
    this.books = [];
    this.grabbedBook = null;
    this.povGrabbedBook = null;
    this.ballMesh = null;
    this.ballBody = null;
    this.grabbedBallMesh = null;
    this.shelfManager = null;
    this.raycaster = null;
    this.mouse = null;
  }
}
