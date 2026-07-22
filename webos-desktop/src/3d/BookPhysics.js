import * as CANNON from "cannon-es";

export class BookPhysics {
  constructor(bounds, colliders) {
    this.bounds = bounds;
    this.colliders = colliders || [];

    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.solver.iterations = 20;

    const def = this.world.defaultContactMaterial;
    def.friction = 0.8;
    def.restitution = 0.03;
    def.contactEquationStiffness = 1e9;
    def.contactEquationRelaxation = 4;

    this.setupWalls();
    this.setupColliders();
  }

  setupWalls() {
    const b = this.bounds;
    const shape = new CANNON.Plane();

    const floor = new CANNON.Body({ mass: 0 });
    floor.addShape(shape);
    floor.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(floor);

    const ceil = new CANNON.Body({ mass: 0 });
    ceil.addShape(shape);
    ceil.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    ceil.position.set(0, 3, 0);
    this.world.addBody(ceil);

    const left = new CANNON.Body({ mass: 0 });
    left.addShape(shape);
    left.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
    left.position.set(b.minX, 1.5, 0);
    this.world.addBody(left);

    const right = new CANNON.Body({ mass: 0 });
    right.addShape(shape);
    right.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
    right.position.set(b.maxX, 1.5, 0);
    this.world.addBody(right);

    const back = new CANNON.Body({ mass: 0 });
    back.addShape(shape);
    back.position.set(0, 1.5, b.minZ);
    this.world.addBody(back);

    const front = new CANNON.Body({ mass: 0 });
    front.addShape(shape);
    front.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
    front.position.set(0, 1.5, b.maxZ);
    this.world.addBody(front);
  }

  setupColliders() {
    for (const col of this.colliders) {
      const sx = (col.max.x - col.min.x) / 2;
      const sy = (col.max.y - col.min.y) / 2;
      const sz = (col.max.z - col.min.z) / 2;
      if (sx <= 0 || sy <= 0 || sz <= 0) continue;
      const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(sx, sy, sz))
      });
      body.position.set((col.min.x + col.max.x) / 2, (col.min.y + col.max.y) / 2, (col.min.z + col.max.z) / 2);
      this.world.addBody(body);
    }
  }

  createBody(position, size, mass) {
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)),
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.25,
      angularDamping: 0.4,
      sleepSpeedLimit: 0.05,
      sleepTimeLimit: 0.5
    });
    this.world.addBody(body);
    return body;
  }

  removeBody(body) {
    this.world.removeBody(body);
  }

  update(books, delta) {
    for (const book of books) {
      if (!book.grabbed) continue;
      if (book.body.type !== CANNON.Body.KINEMATIC) {
        book.body.type = CANNON.Body.KINEMATIC;
        book.body.velocity.set(0, 0, 0);
        book.body.angularVelocity.set(0, 0, 0);
      }
      book.body.position.set(book.mesh.position.x, book.mesh.position.y, book.mesh.position.z);
      book.body.quaternion.set(
        book.mesh.quaternion.x,
        book.mesh.quaternion.y,
        book.mesh.quaternion.z,
        book.mesh.quaternion.w
      );
    }

    const stepped = Math.min(delta, 0.033);
    this.world.step(1 / 120, stepped, 8);

    for (const book of books) {
      if (book.grabbed) continue;
      book.mesh.position.set(book.body.position.x, book.body.position.y, book.body.position.z);
      book.mesh.quaternion.set(
        book.body.quaternion.x,
        book.body.quaternion.y,
        book.body.quaternion.z,
        book.body.quaternion.w
      );
      book.pos.copy(book.mesh.position);
    }
  }

  destroy() {
    while (this.world.bodies.length > 0) {
      this.world.removeBody(this.world.bodies[0]);
    }
  }
}
