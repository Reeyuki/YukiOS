import { createElement } from "../shared/domUtils.js";

export class DecorManager {
  constructor(THREE, scene, renderer) {
    this.THREE = THREE;
    this.scene = scene;
    this.renderer = renderer;
    this.items = [];
    this.activeDecorations = {};
    this.definitions = [];
  }

  defineItem(id, title, icon, builderFn, defaultPos) {
    this.definitions.push({ id, title, icon, builderFn, defaultPos });
  }

  buildAll() {
    const T = this.THREE;
    for (const def of this.definitions) {
      const mesh = def.builderFn(T);
      if (mesh) {
        mesh.visible = true;
        this.activeDecorations[def.id] = true;
        if (def.defaultPos) {
          mesh.position.set(def.defaultPos.x, def.defaultPos.y, def.defaultPos.z);
        }
        mesh.traverse((child) => {
          if (child.isMesh) {
            child.userData.title = def.title;
          }
        });
        this.scene.add(mesh);
        this.items.push({
          id: def.id,
          title: def.title,
          icon: def.icon,
          mesh,
          defaultPos: def.defaultPos
        });
      }
    }
  }

  spawn(id) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.mesh.visible = true;
    this.activeDecorations[id] = true;
  }

  despawn(id) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.mesh.visible = false;
    this.activeDecorations[id] = false;
  }

  toggle(id) {
    if (this.activeDecorations[id]) {
      this.despawn(id);
    } else {
      this.spawn(id);
    }
  }

  isActive(id) {
    return !!this.activeDecorations[id];
  }

  getAllItems() {
    return this.items;
  }

  getActiveStates() {
    return { ...this.activeDecorations };
  }

  restoreStates(states) {
    for (const item of this.items) {
      if (states[item.id] === false || !(item.id in states)) {
        this.despawn(item.id);
      }
    }
    for (const id of Object.keys(states)) {
      if (states[id]) {
        this.spawn(id);
      }
    }
  }

  getPositions() {
    const positions = {};
    for (const item of this.items) {
      if (item.mesh.visible) {
        positions[item.id] = {
          x: item.mesh.position.x,
          y: item.mesh.position.y,
          z: item.mesh.position.z
        };
      }
    }
    return positions;
  }

  restorePositions(positions) {
    for (const item of this.items) {
      const pos = positions[item.id];
      if (pos) {
        item.mesh.position.set(pos.x, pos.y, pos.z);
      }
    }
  }

  destroy() {
    for (const item of this.items) {
      this.scene.remove(item.mesh);
      if (item.mesh.geometry) item.mesh.geometry.dispose();
      if (item.mesh.material) {
        if (Array.isArray(item.mesh.material)) {
          for (const mat of item.mesh.material) mat.dispose();
        } else {
          item.mesh.material.dispose();
        }
      }
    }
    this.items = [];
    this.definitions = [];
    this.activeDecorations = {};
  }

  defineDefaultItems() {
    const T = this.THREE;

    this.defineItem(
      "wall-poster",
      "Extra Wall Poster",
      "fas fa-paint-roller",
      (T) => {
        const group = new T.Group();

        const canvas = createElement("canvas");
        canvas.width = 256;
        canvas.height = 192;
        const ctx = canvas.getContext("2d");

        const grad = ctx.createLinearGradient(0, 0, 256, 192);
        grad.addColorStop(0, "#0a0a18");
        grad.addColorStop(0.5, "#0e0e1e");
        grad.addColorStop(1, "#060610");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 192);

        ctx.strokeStyle = "rgba(0,220,255,0.2)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 25; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * 256, Math.random() * 192);
          ctx.bezierCurveTo(
            Math.random() * 256,
            Math.random() * 192,
            Math.random() * 256,
            Math.random() * 192,
            Math.random() * 256,
            Math.random() * 192
          );
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(255,0,255,0.1)";
        ctx.beginPath();
        ctx.ellipse(100, 90, 35, 28, 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(0,220,255,0.1)";
        ctx.beginPath();
        ctx.ellipse(160, 110, 30, 22, -0.3, 0, Math.PI * 2);
        ctx.fill();

        const tex = new T.CanvasTexture(canvas);
        const posterMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.05 });

        const poster = new T.Mesh(new T.PlaneGeometry(0.7, 0.5), posterMat);
        poster.position.z = 0;
        group.add(poster);

        const frameMat = new T.MeshStandardMaterial({ color: 0x0a0a18, roughness: 0.5, metalness: 0.2 });
        const fw = 0.74;
        const fh = 0.54;
        const fd = 0.025;
        const fb = 0.03;
        const frameParts = [
          { w: fw, h: fb, x: 0, y: fh / 2 - fb / 2, z: -0.01 },
          { w: fw, h: fb, x: 0, y: -fh / 2 + fb / 2, z: -0.01 },
          { w: fb, h: fh - 2 * fb, x: -fw / 2 + fb / 2, y: 0, z: -0.01 },
          { w: fb, h: fh - 2 * fb, x: fw / 2 - fb / 2, y: 0, z: -0.01 }
        ];
        for (const p of frameParts) {
          const m = new T.Mesh(new T.BoxGeometry(p.w, p.h, fd), frameMat);
          m.position.set(p.x, p.y, p.z);
          group.add(m);
        }

        return group;
      },
      { x: 2.0, y: 1.8, z: -3.95 }
    );

    this.defineItem(
      "desk-plant",
      "Desk Succulent",
      "fas fa-leaf",
      (T) => {
        const group = new T.Group();

        const potMat = new T.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.8 });
        const pot = new T.Mesh(new T.CylinderGeometry(0.025, 0.035, 0.03, 8), potMat);
        pot.position.y = 0.015;
        group.add(pot);

        const soilMat = new T.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9 });
        const soil = new T.Mesh(new T.CylinderGeometry(0.024, 0.024, 0.008, 8), soilMat);
        soil.position.y = 0.034;
        group.add(soil);

        const plantMat = new T.MeshStandardMaterial({ color: 0x3d8c4a, roughness: 0.6 });
        const plant = new T.Mesh(new T.SphereGeometry(0.025, 8, 8), plantMat);
        plant.position.y = 0.055;
        plant.scale.set(1, 1.2, 1);
        group.add(plant);

        const smallMat = new T.MeshStandardMaterial({ color: 0x4a9c5a, roughness: 0.6 });
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          const small = new T.Mesh(new T.SphereGeometry(0.015, 6, 6), smallMat);
          small.position.set(Math.cos(angle) * 0.025, 0.045, Math.sin(angle) * 0.025);
          small.scale.set(0.8, 0.6, 0.8);
          group.add(small);
        }

        return group;
      },
      { x: -0.5, y: 0.82, z: -0.6 }
    );

    this.defineItem(
      "desk-books",
      "Books on Desk",
      "fas fa-book",
      (T) => {
        const group = new T.Group();
        const colors = [0x224488, 0x3a5c4a, 0x6c3a3a];
        const bookMat = colors.map((c) => new T.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.1 }));

        const books = [
          { w: 0.06, h: 0.09, d: 0.04, x: 0, y: 0.045, z: 0, mat: bookMat[0] },
          { w: 0.07, h: 0.07, d: 0.04, x: 0.01, y: 0.08, z: -0.005, mat: bookMat[1] },
          { w: 0.05, h: 0.08, d: 0.04, x: -0.008, y: 0.115, z: 0.005, mat: bookMat[2] }
        ];

        for (const b of books) {
          const mesh = new T.Mesh(new T.BoxGeometry(b.w, b.h, b.d), b.mat);
          mesh.position.set(b.x, b.y, b.z);
          group.add(mesh);
        }

        return group;
      },
      { x: -0.3, y: 0.8, z: -1.2 }
    );

    this.defineItem(
      "floor-lamp",
      "Floor Lamp",
      "fas fa-lightbulb",
      (T) => {
        const group = new T.Group();

        const poleMat = new T.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 });
        const shadeMat = new T.MeshStandardMaterial({
          color: 0x1a1a30,
          roughness: 0.9,
          metalness: 0,
          side: T.DoubleSide
        });

        const base = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 0.02, 10), poleMat);
        base.position.y = 0.01;
        group.add(base);

        const pole = new T.Mesh(new T.CylinderGeometry(0.012, 0.015, 1.2, 6), poleMat);
        pole.position.y = 0.61;
        group.add(pole);

        const shade = new T.Mesh(new T.CylinderGeometry(0.1, 0.18, 0.18, 10, 1, true), shadeMat);
        shade.position.y = 1.3;
        shade.userData.objectId = "floorlamp";
        shade.userData.interactive = true;
        shade.userData.tooltip = "Click to toggle lamp";
        group.add(shade);

        const bulb = new T.Mesh(new T.SphereGeometry(0.04, 8, 8), new T.MeshBasicMaterial({ color: 0x221100 }));
        bulb.position.y = 1.24;
        group.add(bulb);

        const light = new T.PointLight(0xffddaa, 0, 8, 1.5);
        light.position.y = 1.22;
        group.add(light);

        group.userData.floorLampLight = light;
        group.userData.floorLampBulb = bulb;

        return group;
      },
      { x: 2.2, y: 0, z: -1.5 }
    );
  }

  moveDecor(id, position) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.mesh.position.set(position.x, position.y, position.z);
  }

  deleteDecor(id) {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const item = this.items[idx];
    this.scene.remove(item.mesh);
    if (item.mesh.geometry) item.mesh.geometry.dispose();
    if (item.mesh.material) {
      if (Array.isArray(item.mesh.material)) {
        for (const mat of item.mesh.material) mat.dispose();
      } else {
        item.mesh.material.dispose();
      }
    }
    this.items.splice(idx, 1);
    const defIdx = this.definitions.findIndex((d) => d.id === id);
    if (defIdx !== -1) this.definitions.splice(defIdx, 1);
    delete this.activeDecorations[id];
  }

  spawnNew(id, position) {
    const def = this.definitions.find((d) => d.id === id);
    if (!def) return null;
    const existing = this.items.find((i) => i.id === id);
    if (existing) {
      this.scene.remove(existing.mesh);
      const idx = this.items.indexOf(existing);
      this.items.splice(idx, 1);
    }
    const T = this.THREE;
    const mesh = def.builderFn(T);
    if (!mesh) return null;
    mesh.visible = true;
    mesh.position.set(position.x, position.y, position.z);
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.userData.title = def.title;
      }
    });
    this.scene.add(mesh);
    this.items.push({ id: def.id, title: def.title, icon: def.icon, mesh, defaultPos: def.defaultPos });
    this.activeDecorations[def.id] = true;
    return this.items[this.items.length - 1];
  }
}
