import * as CANNON from "cannon-es";

export class FurnitureManager {
  constructor(THREE, scene, renderer, interaction, onSave) {
    this.THREE = THREE;
    this.scene = scene;
    this.renderer = renderer;
    this.interaction = interaction;
    this.onSave = onSave;

    this.items = new Map();
    this.grabbed = null;
    this.grabPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.grabOffset = null;
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

  grabFurniture(item) {
    if (!item) return;
    this.grabbed = item;

    const y = item.mesh.position.y + item.options.yOffset;
    this.grabPlane.set(new this.THREE.Vector3(0, 1, 0), -y);

    const intersectPoint = new this.THREE.Vector3();
    const hit = this.interaction.raycaster.ray.intersectPlane(this.grabPlane, intersectPoint);
    if (hit) {
      this.grabOffset = new this.THREE.Vector3().copy(item.mesh.position).sub(intersectPoint);
    } else {
      this.grabOffset = new this.THREE.Vector3(0, 0, 0);
    }
  }

  releaseFurniture() {
    if (!this.grabbed) return;
    this.grabbed.currentPos.copy(this.grabbed.mesh.position);
    this.grabbed = null;
    this.grabOffset = null;
    if (this.onSave) {
      this.onSave(this.getPositions());
    }
  }

  updateGrabbed(camera, raycaster, THREE) {
    if (!this.grabbed || !this.grabOffset) return;

    raycaster.setFromCamera(this.interaction.mouse, camera);

    const y = this.grabbed.mesh.position.y + this.grabbed.options.yOffset;
    this.grabPlane.set(new THREE.Vector3(0, 1, 0), -y);

    const intersectPoint = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(this.grabPlane, intersectPoint);
    if (!hit) return;

    this.grabbed.mesh.position.copy(intersectPoint).add(this.grabOffset);

    const b = this.renderer.bounds;
    const half = (typeof this.grabbed.options.size === "number" ? this.grabbed.options.size : 0.5) / 2;
    this.grabbed.mesh.position.x = Math.max(b.minX + half, Math.min(b.maxX - half, this.grabbed.mesh.position.x));
    this.grabbed.mesh.position.z = Math.max(b.minZ + half, Math.min(b.maxZ - half, this.grabbed.mesh.position.z));
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
    this.grabbed = null;
    this.grabOffset = null;
    this.onSave = null;
  }
}
