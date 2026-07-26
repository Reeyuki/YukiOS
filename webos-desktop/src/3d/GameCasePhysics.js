import * as CANNON from "cannon-es";

export class GameCasePhysics {
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

  update(gameCases, delta, ballBody) {
    for (const gameCase of gameCases) {
      if (!gameCase.grabbed) continue;
      if (gameCase.body.type !== CANNON.Body.KINEMATIC) {
        gameCase.body.type = CANNON.Body.KINEMATIC;
        gameCase.body.velocity.set(0, 0, 0);
        gameCase.body.angularVelocity.set(0, 0, 0);
        gameCase.body.allowSleep = false;
        gameCase.body.wakeUp();
      }
      gameCase.body.position.set(gameCase.mesh.position.x, gameCase.mesh.position.y, gameCase.mesh.position.z);
      gameCase.body.quaternion.set(
        gameCase.mesh.quaternion.x,
        gameCase.mesh.quaternion.y,
        gameCase.mesh.quaternion.z,
        gameCase.mesh.quaternion.w
      );
    }

    const stepped = Math.min(delta, 0.033);

    let anyAwake = ballBody && ballBody.sleepState === 0;
    if (!anyAwake) {
      for (const gameCase of gameCases) {
        if (gameCase.grabbed || (gameCase.body && gameCase.body.sleepState === 0)) {
          anyAwake = true;
          break;
        }
      }
    }
    if (anyAwake) {
      this.world.step(1 / 120, stepped, 4);
    }

    for (const gameCase of gameCases) {
      if (gameCase.grabbed) continue;
      gameCase.mesh.position.set(gameCase.body.position.x, gameCase.body.position.y, gameCase.body.position.z);
      gameCase.mesh.quaternion.set(
        gameCase.body.quaternion.x,
        gameCase.body.quaternion.y,
        gameCase.body.quaternion.z,
        gameCase.body.quaternion.w
      );
      gameCase.pos.copy(gameCase.mesh.position);
    }
  }

  destroy() {
    while (this.world.bodies.length > 0) {
      this.world.removeBody(this.world.bodies[0]);
    }
  }
}
