export class FurnitureManager {
  constructor(THREE, scene, renderer, interaction, onSave) {
    this.THREE = THREE;
    this.scene = scene;
    this.renderer = renderer;
    this.interaction = interaction;
    this.onSave = onSave;

    this.items = new Map();
    this.povGrabbedItem = null;
  }

  registerFurniture(id, mesh, defaultPos, options = {}) {
    const item = {
      id,
      mesh,
      defaultPos: defaultPos.clone(),
      currentPos: defaultPos.clone(),
      options: {
        label: options.label || id,
        yOffset: options.yOffset || 0,
        size: options.size || 0.5
      }
    };

    mesh.position.copy(defaultPos);
    this.items.set(id, item);
    this.scene.add(mesh);

    return item;
  }

  findByMesh(mesh) {
    for (const item of this.items.values()) {
      if (item.mesh === mesh) return item;
    }
    return null;
  }

  povGrab(item) {
    if (!item) return;
    this.povGrabbedItem = item;
  }

  releasePovGrab() {
    if (!this.povGrabbedItem) return null;
    const item = this.povGrabbedItem;
    item.currentPos.copy(item.mesh.position);
    this.povGrabbedItem = null;
    if (this.onSave) {
      this.onSave(this.getPositions());
    }
    return item;
  }

  updatePovGrabbed(camera) {
    if (!this.povGrabbedItem) return;
    const forward = new this.THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);

    const distance = 0.9;
    const targetPos = camera.position.clone().add(forward.multiplyScalar(distance));
    targetPos.y = Math.max(0.5, targetPos.y);

    this.povGrabbedItem.mesh.position.copy(targetPos);
  }

  getPositions() {
    const positions = {};
    for (const item of this.items.values()) {
      const pos = item.mesh.position;
      positions[item.id] = { x: pos.x, y: pos.y, z: pos.z };
    }
    return positions;
  }

  restorePositions(positions) {
    if (!positions) return;
    for (const [id, pos] of Object.entries(positions)) {
      const item = this.items.get(id);
      if (item) {
        item.mesh.position.set(pos.x, pos.y, pos.z);
        item.currentPos.set(pos.x, pos.y, pos.z);
      }
    }
  }

  getAllItems() {
    return Array.from(this.items.values());
  }

  destroy() {
    for (const item of this.items.values()) {
      this.scene.remove(item.mesh);
    }
    this.items.clear();
    this.povGrabbedItem = null;
    this.onSave = null;
  }

  spawnFurniture(id, mesh, position, options = {}) {
    const existing = this.items.get(id);
    if (existing) {
      this.scene.remove(existing.mesh);
    }
    const item = {
      id,
      mesh,
      defaultPos: position.clone ? position.clone() : new this.THREE.Vector3(position.x, position.y, position.z),
      currentPos: position.clone ? position.clone() : new this.THREE.Vector3(position.x, position.y, position.z),
      options: {
        label: options.label || id,
        yOffset: options.yOffset || 0,
        size: options.size || 0.5
      }
    };
    mesh.position.copy(position);
    this.items.set(id, item);
    this.scene.add(mesh);
    return item;
  }

  deleteFurniture(id) {
    const item = this.items.get(id);
    if (!item) return;
    this.scene.remove(item.mesh);
    if (item.mesh.geometry) item.mesh.geometry.dispose();
    if (item.mesh.material) {
      if (Array.isArray(item.mesh.material)) {
        for (const mat of item.mesh.material) mat.dispose();
      } else {
        item.mesh.material.dispose();
      }
    }
    this.items.delete(id);
    if (this.povGrabbedItem && this.povGrabbedItem.id === id) {
      this.povGrabbedItem = null;
    }
    if (this.onSave) this.onSave(this.getPositions());
  }

  findByName(name) {
    for (const item of this.items.values()) {
      if (item.options.label === name) return item;
    }
    return null;
  }
}
