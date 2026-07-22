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
      "potted-plant",
      "Potted Plant",
      "fas fa-seedling",
      (T) => {
        const group = new T.Group();

        const potMat = new T.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.8 });
        const pot = new T.Mesh(new T.CylinderGeometry(0.08, 0.11, 0.12, 10), potMat);
        pot.position.y = 0.04;
        group.add(pot);

        const stemMat = new T.MeshStandardMaterial({ color: 0x2d6b2d, roughness: 0.7 });
        const stem = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.18, 6), stemMat);
        stem.position.y = 0.14;
        group.add(stem);

        const leafMat = new T.MeshStandardMaterial({ color: 0x3d8c3d, roughness: 0.6 });
        const leafPositions = [
          { x: 0.06, y: 0.28, z: 0, sx: 0.09, sy: 0.03, sz: 0.045, rot: 0.3 },
          { x: -0.06, y: 0.29, z: 0, sx: 0.09, sy: 0.03, sz: 0.045, rot: -0.3 },
          { x: 0, y: 0.3, z: 0.06, sx: 0.045, sy: 0.03, sz: 0.09, rot: 0 },
          { x: 0, y: 0.28, z: -0.06, sx: 0.045, sy: 0.03, sz: 0.09, rot: 0 }
        ];
        for (const lp of leafPositions) {
          const leaf = new T.Mesh(new T.BoxGeometry(lp.sx, lp.sy, lp.sz), leafMat);
          leaf.position.set(lp.x, lp.y, lp.z);
          leaf.rotation.x = lp.rot;
          group.add(leaf);
        }

        group.castShadow = true;
        return group;
      },
      { x: 2.5, y: 0.04, z: 2.0 }
    );

    this.defineItem(
      "wall-poster",
      "Extra Wall Poster",
      "fas fa-paint-roller",
      (T) => {
        const group = new T.Group();

        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 192;
        const ctx = canvas.getContext("2d");

        const grad = ctx.createLinearGradient(0, 0, 256, 192);
        grad.addColorStop(0, "#2a0a3a");
        grad.addColorStop(0.5, "#1a1040");
        grad.addColorStop(1, "#0a0820");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 192);

        ctx.strokeStyle = "rgba(160,80,200,0.2)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 25; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * 256, Math.random() * 192);
          ctx.bezierCurveTo(
            Math.random() * 256, Math.random() * 192,
            Math.random() * 256, Math.random() * 192,
            Math.random() * 256, Math.random() * 192
          );
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(180,100,220,0.15)";
        ctx.beginPath();
        ctx.ellipse(100, 90, 35, 28, 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(120,60,180,0.12)";
        ctx.beginPath();
        ctx.ellipse(160, 110, 30, 22, -0.3, 0, Math.PI * 2);
        ctx.fill();

        const tex = new T.CanvasTexture(canvas);
        const posterMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.05 });

        const poster = new T.Mesh(new T.PlaneGeometry(0.7, 0.5), posterMat);
        poster.position.z = 0;
        group.add(poster);

        const frameMat = new T.MeshStandardMaterial({ color: 0x1a1020, roughness: 0.5, metalness: 0.2 });
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
        const colors = [0x5c3a6c, 0x3a5c4a, 0x6c3a3a];
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
          color: 0x3a1a28,
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
        group.add(shade);

        const bulb = new T.Mesh(new T.SphereGeometry(0.025, 6, 6), new T.MeshBasicMaterial({ color: 0xffddaa }));
        bulb.position.y = 1.24;
        group.add(bulb);

        const light = new T.PointLight(0xffddaa, 0.6, 2.5, 2);
        light.position.y = 1.22;
        group.add(light);

        return group;
      },
      { x: 2.2, y: 0, z: -1.5 }
    );
  }
}
