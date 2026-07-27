import * as CANNON from "cannon-es";

export class RoomInteraction {
  static INTERACT_DIST = 3;

  constructor(renderer, controls) {
    this.renderer = renderer;
    this.controls = controls;
    this.raycaster = null;
    this.mouse = null;
    this.callbacks = new Map();
    this.prefixCallbacks = [];
    this.THREE = null;
    this.canvas = null;
    this.gameCases = [];
    this.grabbedCase = null;
    this.grabPlane = null;
    this.grabOffset = null;
    this.lastGrabPos = null;
    this.povGrabbedCase = null;

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
    this.gameCaseManager = null;
    this.gameState = null;
    this.onCasePlaced = null;
    this.seatedChair = null;
    this.seatedSavedPos = null;
    this.seatedSavedYaw = null;
    this.seatedSavedPitch = null;
    this.audio = null;
    this.onHoverChange = null;
    this.hoverTarget = null;
    this.wailaTitle = null;
    this.hoverMeshes = [];
    this.hoverMeshesDirty = true;
    this.cachedBookMeshes = [];
    this.planeNormal = null;
    this.intersectPoint = null;
    this.leftHandMesh = null;
    this.rightHandMesh = null;
  }

  async init(THREE) {
    this.THREE = THREE;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.grabPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.planeNormal = new THREE.Vector3(0, 1, 0);
    this.intersectPoint = new THREE.Vector3();

    this.canvas = this.renderer.renderer.domElement;
    this.canvas.addEventListener("mousemove", (e) => this.onHover(e));
    this.canvas.style.cursor = "default";

    this.controls.onBeforeLock = (event) => this.onBeforeLock(event);
  }

  setGameCases(gameCases) {
    this.gameCases = gameCases;
  }

  makeKinematic(body) {
    body.type = CANNON.Body.KINEMATIC;
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.allowSleep = false;
    body.wakeUp();
  }

  makeDynamic(body, dynamicMass) {
    body.type = CANNON.Body.DYNAMIC;
    if (dynamicMass) {
      body.mass = dynamicMass;
    }
    body.updateMassProperties();
    body.allowSleep = true;
    body.wakeUp();
  }

  applyThrowVelocity(body, velocity, spin) {
    body.velocity.set(velocity.x, velocity.y, velocity.z);
    if (spin) {
      body.angularVelocity.set(spin.x, spin.y, spin.z);
    }
  }

  updateWAILA(camera) {
    if (this.renderer) this.renderer.hologramFrozen = false;
    this.renderer.collectWAILAMeshes();
    this.raycaster.setFromCamera(new this.THREE.Vector2(0, 0), camera);
    const wailaMeshes = this.renderer.wailaMeshes;
    if (!wailaMeshes || wailaMeshes.length === 0) {
      this.wailaTitle = null;
      return;
    }
    const hits = this.raycaster.intersectObjects(wailaMeshes, true);
    const closeHit = hits.find((h) => h.distance < RoomInteraction.INTERACT_DIST);
    if (closeHit) {
      let obj = closeHit.object;
      while (obj && !obj.userData.title) {
        obj = obj.parent;
      }
      this.wailaTitle = obj ? obj.userData.title || null : null;
    } else {
      this.wailaTitle = null;
    }
  }

  getBookMeshes() {
    const meshes = this.gameCases.filter((b) => !b.grabbed && b !== this.povGrabbedCase).map((b) => b.mesh);
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
    if (this.editorManager && this.editorManager.isEditActive()) return false;
    this.updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

    if (this.grabbedCase || this.grabbedBallMesh) {
      if (this.grabbedBallMesh) this.releaseBall();
      else this.releaseBook();
      return true;
    }

    if (this.povGrabbedCase) {
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
            this.furnitureManager.povGrab(item);
            return true;
          }
        }
        this.lastIntersect = intersects[0];
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
          const gameCase = this.gameCases.find((b) => b.mesh === mesh);
          if (gameCase && this.onLaunchGame) {
            this.onLaunchGame(gameCase.gameId);
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
    const gameCase = this.gameCases.find((b) => b.mesh === mesh);
    if (!gameCase) return;

    if (this.shelfManager) {
      this.shelfManager.popCaseFromSlot(gameCase);
    }

    if (this.audio) this.audio.playBookGrab();
    gameCase.grabbed = true;
    this.makeKinematic(gameCase.body);
    this.grabbedCase = gameCase;

    this.grabPlane.set(new this.THREE.Vector3(0, 1, 0), -gameCase.mesh.position.y);

    const intersectPoint = new this.THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.grabPlane, intersectPoint);
    if (hit) {
      this.grabOffset = new this.THREE.Vector3().copy(gameCase.mesh.position).sub(intersectPoint);
    } else {
      this.grabOffset = new this.THREE.Vector3(0, 0, 0);
    }

    this.lastGrabPos = gameCase.mesh.position.clone();
  }

  releaseBook() {
    if (this.grabbedCase) {
      const gameCase = this.grabbedCase;

      if (this.shelfManager && !gameCase.isBall) {
        const slot = this.shelfManager.getNearestEmptySlot(gameCase.mesh.position);
        if (slot) {
          const isCorrect = this.shelfManager.isCorrectShelf(gameCase, slot);
          this.shelfManager.shelveCase(gameCase, slot);
          if (this.audio) this.audio.playBookShelve();
          if (this.gameState && this.gameState.active) {
            this.shelfManager.flashSlot(slot, isCorrect);
            if (isCorrect) {
              this.gameState.placeGameCaseCorrectly(gameCase.gameId);
              if (this.audio) this.audio.playCorrect();
            } else {
              this.gameState.placeGameCaseWrongly(gameCase.gameId);
              if (this.audio) this.audio.playWrong();
            }
            if (this.onCasePlaced) this.onCasePlaced(gameCase, isCorrect);
          }
          this.grabbedCase = null;
          this.grabOffset = null;
          return;
        }
      }

      this.makeDynamic(gameCase.body, gameCase.dynamicMass);
      if (this.lastGrabPos) {
        const throwVel = new this.THREE.Vector3().copy(gameCase.pos).sub(this.lastGrabPos);
        gameCase.body.velocity.set(throwVel.x, Math.max(throwVel.y, 0), throwVel.z);
        const spin = new this.THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5
        );
        gameCase.body.angularVelocity.set(spin.x, spin.y, spin.z);
      }
      gameCase.grabbed = false;
    }
    this.grabbedCase = null;
    this.grabOffset = null;
  }

  updateGrabbed() {
    if (this.grabbedBallMesh) {
      this.updateBallDrag();
      return;
    }
    if (!this.grabbedCase || !this.grabOffset) return;

    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

    this.grabPlane.set(this.planeNormal, -this.grabbedCase.pos.y);

    const intersectPoint = this.intersectPoint;
    const hit = this.raycaster.ray.intersectPlane(this.grabPlane, intersectPoint);
    if (!hit) return;

    this.lastGrabPos.copy(this.grabbedCase.pos);

    this.grabbedCase.mesh.position.copy(intersectPoint).add(this.grabOffset);

    const b = this.renderer.bounds;
    const sx = this.grabbedCase.size.x / 2;
    const sy = this.grabbedCase.size.y / 2;
    const sz = this.grabbedCase.size.z / 2;
    this.grabbedCase.mesh.position.x = Math.max(b.minX + sx, Math.min(b.maxX - sx, this.grabbedCase.mesh.position.x));
    this.grabbedCase.mesh.position.z = Math.max(b.minZ + sz, Math.min(b.maxZ - sz, this.grabbedCase.mesh.position.z));
    this.grabbedCase.mesh.position.y = Math.max(sy, Math.min(3 - sy, this.grabbedCase.mesh.position.y));

    this.grabbedCase.pos.copy(this.grabbedCase.mesh.position);
  }

  updateBallDrag() {
    if (!this.grabbedBallMesh || !this.grabOffset) return;

    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

    const y = this.grabbedBallMesh.position.y;
    this.grabPlane.set(this.planeNormal, -y);

    const intersectPoint = this.intersectPoint;
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

  findNearestChair(camera) {
    if (!this.furnitureManager) return null;
    let best = null;
    let bestDist = 1.5;
    for (const item of this.furnitureManager.items.values()) {
      if (!item.id.startsWith("wooden-chair")) continue;
      const dx = camera.position.x - item.mesh.position.x;
      const dz = camera.position.z - item.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    }
    return best;
  }

  sitOnChair(camera, controls) {
    const chair = this.findNearestChair(camera);
    if (!chair) return false;
    if (this.audio) this.audio.playSit();
    this.seatedChair = chair;
    this.seatedSavedPos = camera.position.clone();
    this.seatedSavedYaw = controls.yaw;
    this.seatedSavedPitch = controls.pitch;
    const chairPos = chair.mesh.position;
    const forward = new this.THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(chair.mesh.quaternion);
    const sitPos = new this.THREE.Vector3(
      chairPos.x + forward.x * 0.05,
      chairPos.y + 1.65,
      chairPos.z + forward.z * 0.05
    );
    const lookTarget = sitPos.clone().add(forward.clone().multiplyScalar(3));
    controls.animateCamera(sitPos, lookTarget, 0.5);
    return true;
  }

  standFromChair(controls) {
    if (!this.seatedChair) return;
    if (this.audio) this.audio.playStand();
    const chair = this.seatedChair;
    const chairPos = chair.mesh.position;
    const forward = new this.THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(chair.mesh.quaternion);
    const fwd = new this.THREE.Vector3(0, 0, -1);
    fwd.x = -Math.sin(this.seatedSavedYaw) * Math.cos(this.seatedSavedPitch);
    fwd.y = Math.sin(this.seatedSavedPitch);
    fwd.z = -Math.cos(this.seatedSavedYaw) * Math.cos(this.seatedSavedPitch);
    const lookAtTarget = this.seatedSavedPos.clone().add(fwd.multiplyScalar(10));
    this.seatedChair = null;
    controls.animateCamera(this.seatedSavedPos, lookAtTarget, 0.4, () => {
      controls.yaw = this.seatedSavedYaw;
      controls.pitch = this.seatedSavedPitch;
      const V = this.THREE.Vector3;
      const Q = this.THREE.Quaternion;
      const qx = new Q();
      const qy = new Q();
      qx.setFromAxisAngle(new V(1, 0, 0), controls.pitch);
      qy.setFromAxisAngle(new V(0, 1, 0), controls.yaw);
      controls.camera.quaternion.copy(qy.multiply(qx));
      controls.lock();
    });
    this.seatedSavedPos = null;
    this.seatedSavedYaw = null;
    this.seatedSavedPitch = null;
  }

  isSeated() {
    return this.seatedChair !== null;
  }

  handleEKey(camera, controls) {
    if (this.editorManager && this.editorManager.isEditActive()) return false;
    if (!this.raycaster) return false;

    if (this.seatedChair) {
      this.standFromChair(controls);
      return true;
    }
    if (this.povGrabbedCase) {
      if (!this.povGrabbedCase.isBall && this.nearWastebin && this.onTrashRequest) {
        this.onTrashRequest(this.povGrabbedCase);
        return true;
      }
      if (!this.povGrabbedCase.isBall && this.shelfManager && this.nearShelf) {
        const slot = this.shelfManager.getNearestEmptySlot(this.povGrabbedCase.mesh.position);
        if (slot) {
          const isCorrect = this.shelfManager.isCorrectShelf(this.povGrabbedCase, slot);
          this.shelfManager.shelveCase(this.povGrabbedCase, slot);
          if (this.audio) this.audio.playBookShelve();
          if (this.gameState && this.gameState.active) {
            this.shelfManager.flashSlot(slot, isCorrect);
            if (isCorrect) {
              this.gameState.placeGameCaseCorrectly(this.povGrabbedCase.gameId);
              if (this.audio) this.audio.playCorrect();
            } else {
              this.gameState.placeGameCaseWrongly(this.povGrabbedCase.gameId);
              if (this.audio) this.audio.playWrong();
            }
            if (this.onCasePlaced) this.onCasePlaced(this.povGrabbedCase, isCorrect);
          }
          this.povGrabbedCase = null;
          this.resetArm(this.renderer.player.rightArm);
          return true;
        }
      }
      this.releasePOVGrab(camera);
      return true;
    }

    if (this.grabbedCase) {
      this.releaseBook();
    }

    if (this.grabbedBallMesh) {
      this.makeDynamic(this.ballBody);
      const fwd = new this.THREE.Vector3(0, 0, -1);
      fwd.applyQuaternion(camera.quaternion);
      fwd.multiplyScalar(12);
      this.applyThrowVelocity(this.ballBody, fwd);
      this.ballGrabbed = false;
      this.grabbedBallMesh = null;
      this.resetArm(this.renderer.player.rightArm);
      return true;
    }

    if (this.furnitureManager && this.furnitureManager.povGrabbedItem) {
      this.furnitureManager.releasePovGrab();
      if (this.audio) this.audio.playFurnitureRelease();
      return true;
    }

    this.mouse.set(0, 0);
    this.raycaster.setFromCamera(this.mouse, camera);

    const objects = this.renderer.getInteractiveObjects();
    if (objects.length > 0) {
      const intersects = this.raycaster.intersectObjects(objects);
      if (intersects.length > 0 && intersects[0].distance < RoomInteraction.INTERACT_DIST) {
        const obj = intersects[0].object;
        if (obj.userData.isFurniture && this.furnitureManager) {
          const item = this.furnitureManager.findByMesh(obj);
          if (item) {
            this.furnitureManager.povGrab(item);
            if (this.audio) this.audio.playFurnitureGrab();
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

    if (this.findNearestChair(camera)) {
      return this.sitOnChair(camera, this.controls);
    }

    const bookMeshes = this.getBookMeshes();
    if (bookMeshes.length === 0) return false;

    const intersects = this.raycaster.intersectObjects(bookMeshes);
    if (intersects.length === 0 || intersects[0].distance >= RoomInteraction.INTERACT_DIST) return false;

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

    const gameCase = this.gameCases.find((b) => b.mesh === mesh);
    if (!gameCase) return false;

    this.povGrabCase(gameCase);
    return true;
  }

  povGrabCase(gameCase) {
    if (this.shelfManager && this.shelfManager.isCaseShelved(gameCase)) {
      this.shelfManager.popCaseFromSlot(gameCase);
    }

    gameCase.grabbed = true;
    this.makeKinematic(gameCase.body);
    if (this.audio) this.audio.playBookGrabPOV();
    this.povGrabbedCase = gameCase;
  }

  releasePOVGrab(camera) {
    if (!this.povGrabbedCase) return;
    if (this.audio) this.audio.playReleasePOV();
    const gameCase = this.povGrabbedCase;
    this.makeDynamic(gameCase.body, gameCase.dynamicMass);
    if (camera && this.THREE) {
      const fwd = new this.THREE.Vector3(0, 0, -1);
      fwd.applyQuaternion(camera.quaternion);
      const speed = gameCase.isBall ? 12 : 5;
      fwd.multiplyScalar(speed);
      gameCase.body.velocity.set(fwd.x, fwd.y, fwd.z);
    }
    gameCase.grabbed = false;
    this.povGrabbedCase = null;
    this.resetArm(this.renderer.player.rightArm);
  }

  launchFocusedGame() {
    if (this.povGrabbedCase) {
      return this.povGrabbedCase.gameId;
    }
    if (!this.raycaster || !this.renderer || !this.renderer.camera) return null;
    const camera = this.renderer.camera;
    this.raycaster.setFromCamera(new this.THREE.Vector2(0, 0), camera);
    const meshes = this.gameCases.filter((b) => !b.grabbed && b !== this.povGrabbedCase).map((b) => b.mesh);
    const intersects = this.raycaster.intersectObjects(meshes);
    if (intersects.length > 0 && intersects[0].distance < RoomInteraction.INTERACT_DIST) {
      const mesh = intersects[0].object;
      const gameCase = this.gameCases.find((b) => b.mesh === mesh);
      if (gameCase) return gameCase.gameId;
    }
    return null;
  }

  grabBall() {
    if (!this.ballMesh) return;
    if (this.audio) this.audio.playBallGrab();
    this.ballGrabbed = true;
    this.makeKinematic(this.ballBody);
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
    if (this.audio) this.audio.playBallThrow();
    this.makeDynamic(this.ballBody);
    if (this.lastGrabPos) {
      const throwVel = new this.THREE.Vector3().copy(this.ballMesh.position).sub(this.lastGrabPos);
      this.ballBody.velocity.set(throwVel.x * 3, Math.max(throwVel.y * 3, 2), throwVel.z * 3);
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

  setHandMeshes(leftHand, rightHand) {
    this.leftHandMesh = leftHand;
    this.rightHandMesh = rightHand;
  }

  setShelfManager(shelfManager) {
    this.shelfManager = shelfManager;
  }

  setFurnitureManager(fm) {
    this.furnitureManager = fm;
  }

  setGameCaseManager(bm) {
    this.gameCaseManager = bm;
  }

  setGameState(gs) {
    this.gameState = gs;
  }

  setEditorManager(editorManager) {
    this.editorManager = editorManager;
  }

  setAudio(audio) {
    this.audio = audio;
  }

  updateEGrabbed(camera) {
    if (this.furnitureManager && this.furnitureManager.povGrabbedItem) {
      this.furnitureManager.updatePovGrabbed(camera);
      return;
    }
    if (this.povGrabbedCase) {
      const forward = new this.THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(camera.quaternion);

      const distance = 0.9;
      const targetPos = camera.position.clone().add(forward.multiplyScalar(distance));
      targetPos.y += 0.15;
      const caseBottom = 0.42;
      const heldPos = targetPos.clone();
      heldPos.y -= caseBottom;

      this.povGrabbedCase.mesh.position.copy(heldPos);
      this.povGrabbedCase.pos.copy(heldPos);
      this.povGrabbedCase.mesh.quaternion.copy(camera.quaternion);

      if (this.rightHandMesh) {
        const handPos = camera.position.clone().add(forward.clone().multiplyScalar(distance * 0.85));
        handPos.y += 0.1;
        handPos.y -= caseBottom;
        this.renderer.player.worldToLocal(handPos);
        this.rightHandMesh.position.copy(handPos);
        this.poseArm(this.renderer.player.rightArm, this.renderer.player.baseShoulderR, handPos);
      }
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

      if (this.rightHandMesh) {
        const handPos = camera.position.clone().add(forward.clone().multiplyScalar(distance * 0.85));
        handPos.y += 0.1;
        this.renderer.player.worldToLocal(handPos);
        this.rightHandMesh.position.copy(handPos);
        this.poseArm(this.renderer.player.rightArm, this.renderer.player.baseShoulderR, handPos);
      }
    }
  }

  poseArm(armMesh, shoulderBase, handLocalPos) {
    if (!armMesh) return;
    const T = this.THREE;
    const dir = handLocalPos.clone().sub(shoulderBase);
    const distance = dir.length();
    if (distance < 0.01) return;
    dir.normalize();

    const mid = shoulderBase.clone().add(handLocalPos).multiplyScalar(0.5);
    armMesh.position.copy(mid);

    const up = new T.Vector3(0, 1, 0);
    const quat = new T.Quaternion().setFromUnitVectors(up, dir);
    armMesh.quaternion.copy(quat);
    armMesh.scale.y = distance / 0.48;
  }

  resetArm(armMesh) {
    if (!armMesh) return;
    armMesh.quaternion.identity();
    armMesh.scale.set(1, 1, 1);
  }

  isEGrabbed() {
    return (
      this.povGrabbedCase !== null ||
      this.grabbedBallMesh !== null ||
      (this.furnitureManager && this.furnitureManager.povGrabbedItem !== null)
    );
  }

  updateWastebinProximity(camera) {
    this.nearShelf = false;
    if (!this.povGrabbedCase || this.povGrabbedCase.isBall) {
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
      const slot = this.shelfManager.getNearestEmptySlot(this.povGrabbedCase.mesh.position);
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
    if (this.renderer) this.renderer.hologramFrozen = false;
    if (this.editorManager && this.editorManager.isEditActive()) return;
    if (this.grabbedCase || this.povGrabbedCase || this.grabbedBallMesh) {
      if (!this.povGrabbedCase) {
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

    const bookMeshes = this.getBookMeshes();
    const objects = this.renderer.getInteractiveObjects();
    const allMeshes = this.renderer.roomObjects;
    const shelfMeshes = this.shelfManager ? this.shelfManager.shelfMeshes || [] : [];
    const everything = [...bookMeshes, ...objects, ...allMeshes, ...shelfMeshes];

    const holoScreen = this.renderer.monitorScreen;
    const holoRenderer = this.renderer.hologramRenderer;
    if (holoScreen && holoRenderer) {
      const holoHits = this.raycaster.intersectObject(holoScreen);
      if (holoHits.length > 0 && holoHits[0].uv && holoHits[0].distance < RoomInteraction.INTERACT_DIST) {
        const holoDist = holoHits[0].distance;
        let occluded = false;
        if (everything.length > 0) {
          const blockerHits = this.raycaster.intersectObjects(everything);
          if (blockerHits.length > 0 && blockerHits[0].distance < holoDist) {
            occluded = true;
          }
        }
        if (!occluded) {
          const item = holoRenderer.getItemAtUV(holoHits[0].uv.x, holoHits[0].uv.y);
          if (item) {
            if (this.renderer) this.renderer.hologramFrozen = true;
            if (!this.controls.isLocked) this.canvas.style.cursor = "pointer";
            return;
          }
        }
      }
    }

    let found = false;

    if (everything.length > 0) {
      const intersects = this.raycaster.intersectObjects(everything);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const isCase = hit !== this.ballMesh && hit.userData.isCase;
        const hitCase = isCase ? this.gameCases.find((b) => b.mesh === hit) : null;

        if (hit === this.ballMesh) {
          if (!this.controls.isLocked) this.canvas.style.cursor = "grab";
        } else if (isCase && hitCase) {
          if (!this.controls.isLocked) this.canvas.style.cursor = "grab";
        } else {
          if (!this.controls.isLocked) this.canvas.style.cursor = hit.userData.interactive ? "pointer" : "default";
        }

        found = true;
        if (this.onHoverChange) {
          const target =
            hit === this.ballMesh
              ? "ball"
              : isCase && hitCase
                ? "case"
                : hit.userData.interactive
                  ? "interactive"
                  : "object";
          if (target !== this.hoverTarget) {
            this.hoverTarget = target;
            this.onHoverChange(target);
          }
        }
      }
    }

    if (!found) {
      if (!this.controls.isLocked) this.canvas.style.cursor = "default";
      if (this.onHoverChange && this.hoverTarget !== null) {
        this.hoverTarget = null;
        this.onHoverChange(null);
      }
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
    this.gameCases = [];
    this.grabbedCase = null;
    this.povGrabbedCase = null;
    this.ballMesh = null;
    this.ballBody = null;
    this.grabbedBallMesh = null;
    this.shelfManager = null;
    this.gameCaseManager = null;
    this.gameState = null;
    this.raycaster = null;
    this.mouse = null;
  }
}
