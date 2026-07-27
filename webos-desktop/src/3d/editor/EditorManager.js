export class EditorManager {
  constructor(THREE, scene, camera, rendererDomElement) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;
    this.rendererDomElement = rendererDomElement;

    this.active = false;
    this.selected = null;
    this.selectedInfo = null;
    this.transformControls = null;
    this.highlight = null;
    this.controls = null;
    this.furnitureManager = null;
    this.decorManager = null;
    this.paletteBuilders = null;

    this.history = [];
    this.redoStack = [];
    this.maxHistory = 20;

    this.onModeChange = null;
    this.onSelectionChange = null;

    this.onDraggingChangedBound = this.onDraggingChanged.bind(this);

    this.equippedItem = null;
    this.ghostMesh = null;

    this.snapEnabled = false;
    this.snapSize = 0.25;
    this.validPlacement = true;
    this.collisionObjects = [];
    this.audio = null;
  }

  setAudio(audio) {
    this.audio = audio;
  }

  setControls(controls) {
    this.controls = controls;
  }

  async enter() {
    if (this.active) return;
    if (this.audio) this.audio.playEditorEnter();
    if (!this.transformControls) {
      const { TransformControls } = await import("three/examples/jsm/controls/TransformControls.js");
      this.transformControls = new TransformControls(this.camera, this.rendererDomElement);
      this.transformControls.setMode("translate");
      this.transformControls.setSpace("world");
      this.transformControls.rotationSnap = Math.PI / 12;
      this.transformControls.addEventListener("dragging-changed", this.onDraggingChangedBound);
      this.scene.add(this.transformControls);
    }

    this.active = true;
    document.exitPointerLock();
    if (this.onModeChange) this.onModeChange(true);
  }

  exit() {
    if (!this.active) return;
    if (this.audio) this.audio.playEditorExit();
    this.unequip();
    this.deselect();
    this.active = false;
    if (this.onModeChange) this.onModeChange(false);
  }

  toggle() {
    if (this.active) {
      this.exit();
    } else {
      this.enter();
    }
  }

  select(mesh, info) {
    if (!mesh) return;
    this.deselect();
    if (this.audio) this.audio.playSelect();
    this.selected = mesh;
    this.selectedInfo = info;

    let targetGeo = mesh.geometry;
    if (!targetGeo && mesh.children) {
      for (const child of mesh.children) {
        if (child.geometry) {
          targetGeo = child.geometry;
          break;
        }
      }
    }
    if (targetGeo) {
      const edges = new this.THREE.EdgesGeometry(targetGeo);
      const edgeMat = new this.THREE.LineBasicMaterial({ color: 0x00ddff, linewidth: 2 });
      this.highlight = new this.THREE.LineSegments(edges, edgeMat);
      mesh.add(this.highlight);
    }

    if (this.transformControls) {
      this.transformControls.attach(mesh);
    }

    if (this.onSelectionChange) this.onSelectionChange(mesh, info);
  }

  deselect() {
    if (!this.selected) return;
    if (this.audio) this.audio.playDeselect();
    if (this.highlight) {
      this.highlight.parent.remove(this.highlight);
      this.highlight.geometry.dispose();
      this.highlight.material.dispose();
      this.highlight = null;
    }

    if (this.transformControls) {
      this.transformControls.detach();
    }

    this.selected = null;
    this.selectedInfo = null;

    if (this.onSelectionChange) this.onSelectionChange(null, null);
  }

  spawnObject(id, type, builderFn, position) {
    const mesh = builderFn(this.THREE);
    if (!mesh) return null;

    mesh.position.copy(position);
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.userData.title = id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }
    });
    this.scene.add(mesh);

    if (type === "furniture" && this.furnitureManager) {
      this.furnitureManager.registerFurniture(id, mesh, position.clone());
    } else if (type === "decor" && this.decorManager) {
      const item = this.decorManager.items.find((i) => i.id === id);
      if (item) {
        item.mesh = mesh;
        item.mesh.visible = true;
        this.decorManager.activeDecorations[id] = true;
      }
    }

    const info = { manager: type, id };
    this.select(mesh, info);
    this.takeSnapshot();
    return mesh;
  }

  deleteSelected() {
    if (!this.selected) return;

    const mesh = this.selected;
    const info = this.selectedInfo;

    this.deselect();
    this.scene.remove(mesh);

    if (info.manager === "furniture" && this.furnitureManager) {
      this.furnitureManager.items.delete(info.id);
    } else if (info.manager === "decor" && this.decorManager) {
      const item = this.decorManager.items.find((i) => i.id === info.id);
      if (item) item.mesh.visible = false;
      this.decorManager.activeDecorations[info.id] = false;
    }

    this.takeSnapshot();
  }

  takeSnapshot() {
    const snapshot = {
      furniturePositions: this.furnitureManager ? this.furnitureManager.getPositions() : {},
      decorActiveStates: this.decorManager ? this.decorManager.getActiveStates() : {},
      decorPositions: this.decorManager ? this.decorManager.getPositions() : {}
    };
    this.history.push(snapshot);
    this.redoStack = [];
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  undo() {
    if (this.history.length <= 1) return;
    if (this.audio) this.audio.playUndo();
    const current = this.history.pop();
    this.redoStack.push(current);
    const snapshot = this.history[this.history.length - 1];
    this.restoreSnapshot(snapshot);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    if (this.audio) this.audio.playRedo();
    const snapshot = this.redoStack.pop();
    this.history.push(snapshot);
    this.restoreSnapshot(snapshot);
  }

  restoreSnapshot(snapshot) {
    if (this.furnitureManager && snapshot.furniturePositions) {
      this.furnitureManager.restorePositions(snapshot.furniturePositions);
    }
    if (this.decorManager) {
      if (snapshot.decorActiveStates) {
        this.decorManager.restoreStates(snapshot.decorActiveStates);
      }
      if (snapshot.decorPositions) {
        this.decorManager.restorePositions(snapshot.decorPositions);
      }
    }
  }

  isEditActive() {
    return this.active;
  }

  equip(itemDef) {
    if (this.audio) this.audio.playEquip();
    this.unequip();
    this.equippedItem = itemDef;
    const builder = this.paletteBuilders ? this.paletteBuilders[itemDef.id] : null;
    if (!builder) return;
    const mesh = builder(this.THREE);
    if (!mesh) return;
    this.validPlacement = true;
    mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.45;
        child.material.depthWrite = false;
        child.material.color.setHex(0x66ff88);
      }
    });
    this.ghostMesh = mesh;
    const forward = new this.THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize().multiplyScalar(2);
    this.ghostMesh.position.copy(this.camera.position).add(forward);
    this.ghostMesh.position.y = 0;
    this.scene.add(mesh);
  }

  unequip() {
    if (this.audio) this.audio.playDeselect();
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.ghostMesh = null;
    }
    this.equippedItem = null;
  }

  updateGhostPosition(camera, mouseNDC) {
    if (!this.equippedItem || !this.ghostMesh) return;
    const raycaster = new this.THREE.Raycaster();
    raycaster.setFromCamera(mouseNDC, camera);
    const floorPlane = new this.THREE.Plane(new this.THREE.Vector3(0, 1, 0), 0);
    const target = new this.THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(floorPlane, target);
    if (!hit) return;

    if (this.snapEnabled) {
      const snap = this.snapSize;
      target.x = Math.round(target.x / snap) * snap;
      target.z = Math.round(target.z / snap) * snap;
      target.y = 0;
    }

    this.ghostMesh.position.copy(target);

    const valid = this.isPlacementValid(target, this.ghostMesh);
    this.validPlacement = valid;
    const color = valid ? 0x66ff88 : 0xff4444;
    this.ghostMesh.traverse((child) => {
      if (child.isMesh && child.material && child.material.color) {
        child.material.color.setHex(color);
      }
    });
  }

  isPlacementValid(position, mesh) {
    const box = new this.THREE.Box3().setFromObject(mesh);
    const margin = 0.05;
    box.expandByScalar(margin);

    for (const obj of this.collisionObjects) {
      if (obj === mesh) continue;
      if (obj === this.ghostMesh) continue;
      const objBox = new this.THREE.Box3().setFromObject(obj);
      if (box.intersectsBox(objBox)) return false;
    }
    return true;
  }

  setCollisionObjects(objects) {
    this.collisionObjects = objects;
  }

  toggleSnap() {
    this.snapEnabled = !this.snapEnabled;
    if (this.audio) this.audio.playSnap(this.snapEnabled);
    return this.snapEnabled;
  }

  placeAt(position) {
    if (!this.equippedItem) return;
    if (!this.validPlacement) {
      if (this.audio) this.audio.playPlaceInvalid();
      return;
    }
    if (this.audio) this.audio.playPlaceValid();
    const def = this.equippedItem;
    this.unequip();

    const isDecor = def.manager === "decor";
    if (isDecor) {
      const item = this.decorManager.spawnNew(def.id, position);
      if (item) {
        this.select(item.mesh, { manager: "decor", id: def.id });
      }
    } else {
      const builder = this.paletteBuilders ? this.paletteBuilders[def.id] : null;
      if (!builder) return;
      const mesh = builder(this.THREE);
      if (!mesh) return;
      mesh.traverse((child) => {
        if (child.isMesh) {
          child.userData.title = def.name || def.id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        }
      });
      const itemId = def.id + "_" + Date.now();
      const item = this.furnitureManager.spawnFurniture(itemId, mesh, position, { label: def.name });
      if (item) {
        this.select(item.mesh, { manager: "furniture", id: itemId });
      }
    }
    this.takeSnapshot();
  }

  getObjectInfo(mesh) {
    if (this.furnitureManager) {
      const item = this.furnitureManager.findByMesh(mesh);
      if (item) return { manager: "furniture", id: item.id, name: item.options.label };
    }
    if (this.decorManager) {
      const item = this.decorManager.items.find((i) => i.mesh === mesh);
      if (item) return { manager: "decor", id: item.id, name: item.title };
    }
    return null;
  }

  getEditableObjects() {
    const objects = [];

    if (this.furnitureManager) {
      for (const item of this.furnitureManager.getAllItems()) {
        objects.push(item.mesh);
      }
    }

    if (this.decorManager) {
      for (const item of this.decorManager.getAllItems()) {
        if (item.mesh.visible) {
          objects.push(item.mesh);
        }
      }
    }

    return objects;
  }

  cycleTransformMode() {
    const current = this.transformControls ? this.transformControls.getMode() : "translate";
    const next = current === "translate" ? "rotate" : "translate";
    if (this.transformControls) {
      this.transformControls.setMode(next);
      if (next === "rotate") {
        this.transformControls.setSpace("world");
      } else {
        this.transformControls.setSpace("world");
      }
    }
    return next;
  }

  rotateSelected() {
    if (!this.selected) return;
    this.selected.rotation.y += Math.PI / 4;
    this.takeSnapshot();
    if (this.onSelectionChange) {
      const pos = this.selected.position;
      this.onSelectionChange(this.selected, this.selectedInfo);
    }
  }

  onDraggingChanged(event) {
    if (this.controls) {
      this.controls.enabled = !event.value;
    }
  }
}
