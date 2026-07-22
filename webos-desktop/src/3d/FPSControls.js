export class FPSControls {
  constructor(camera, domElement, bounds, colliders) {
    this.camera = camera;
    this.domElement = domElement;
    this.bounds = bounds || { minX: -4, maxX: 4, minZ: -4, maxZ: 4 };
    this.colliders = colliders || [];
    this.playerRadius = 0.3;
    this.THREE = null;

    this.enabled = false;
    this.isLocked = false;

    this.moveSpeed = 2;
    this.sprintMultiplier = 1.5;
    this.crouchMultiplier = 0.4;
    this.lookSensitivity = 0.002;

    this.pitch = 0;
    this.yaw = 0;

    this.velocityY = 0;
    this.isGrounded = true;
    this.gravity = -9.8;
    this.jumpSpeed = 4.5;
    this.normalHeight = 1.6;
    this.crouchHeight = 0.8;

    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false,
      crouch: false
    };

    this.animTarget = null;
    this.animDuration = 0;
    this.animElapsed = 0;
    this.animOnComplete = null;
    this.animStartPos = null;

    this.onBeforeLock = null;

    this.onPointerLockChangeBound = this.onPointerLockChange.bind(this);
    this.onMouseMoveBound = this.onMouseMove.bind(this);
    this.onKeyDownBound = this.onKeyDown.bind(this);
    this.onKeyUpBound = this.onKeyUp.bind(this);
    this.onClickBound = this.onClick.bind(this);
  }

  lock() {
    if (!this.domElement) return;
    this.domElement.requestPointerLock();
  }

  unlock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
    if (this.onLockStateChange) {
      this.onLockStateChange(this.isLocked);
    }
  }

  onMouseMove(event) {
    if (!this.isLocked || !this.enabled) return;
    this.yaw -= event.movementX * this.lookSensitivity;
    this.pitch -= event.movementY * this.lookSensitivity;
    this.pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.pitch));
  }

  onKeyDown(event) {
    if (!this.enabled) return;
    switch (event.code) {
      case "KeyW":
        this.keys.forward = true;
        event.preventDefault();
        break;
      case "KeyS":
        this.keys.backward = true;
        event.preventDefault();
        break;
      case "KeyA":
        this.keys.left = true;
        event.preventDefault();
        break;
      case "KeyD":
        this.keys.right = true;
        event.preventDefault();
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.keys.sprint = true;
        break;
      case "Space":
        this.keys.jump = true;
        event.preventDefault();
        break;
      case "KeyC":
        this.keys.crouch = true;
        event.preventDefault();
        break;
    }
  }

  onKeyUp(event) {
    switch (event.code) {
      case "KeyW":
        this.keys.forward = false;
        break;
      case "KeyS":
        this.keys.backward = false;
        break;
      case "KeyA":
        this.keys.left = false;
        break;
      case "KeyD":
        this.keys.right = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.keys.sprint = false;
        break;
      case "Space":
        this.keys.jump = false;
        break;
      case "KeyC":
        this.keys.crouch = false;
        break;
    }
  }

  onClick(event) {
    if (!this.enabled) return;
    if (!this.isLocked) {
      if (this.onBeforeLock && this.onBeforeLock(event)) {
        return;
      }
      this.lock();
    }
  }

  start(THREE) {
    this.THREE = THREE;
    this.enabled = true;
    document.addEventListener("pointerlockchange", this.onPointerLockChangeBound);
    document.addEventListener("mousemove", this.onMouseMoveBound);
    document.addEventListener("keydown", this.onKeyDownBound);
    document.addEventListener("keyup", this.onKeyUpBound);
    this.domElement.addEventListener("click", this.onClickBound);
  }

  stop() {
    this.enabled = false;
    this.unlock();
    document.removeEventListener("pointerlockchange", this.onPointerLockChangeBound);
    document.removeEventListener("mousemove", this.onMouseMoveBound);
    document.removeEventListener("keydown", this.onKeyDownBound);
    document.removeEventListener("keyup", this.onKeyUpBound);
    if (this.domElement) {
      this.domElement.removeEventListener("click", this.onClickBound);
    }
  }

  update(delta) {
    if (!this.enabled || !this.THREE) return;

    if (this.animTarget) {
      this.animElapsed += delta;
      const t = Math.min(this.animElapsed / this.animDuration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      this.camera.position.lerpVectors(this.animStartPos, this.animTarget.pos, ease);
      this.camera.lookAt(this.animTarget.lookAt);

      if (t >= 1) {
        this.camera.position.copy(this.animTarget.pos);
        this.camera.lookAt(this.animTarget.lookAt);
        const cb = this.animOnComplete;
        this.animTarget = null;
        this.animOnComplete = null;
        if (cb) cb();
      }
      return;
    }

    if (!this.isLocked) return;

    const speed =
      this.moveSpeed * (this.keys.sprint ? this.sprintMultiplier : 1) * (this.keys.crouch ? this.crouchMultiplier : 1);

    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    let dx = 0;
    let dz = 0;

    if (this.keys.forward) {
      dx -= sinYaw;
      dz -= cosYaw;
    }
    if (this.keys.backward) {
      dx += sinYaw;
      dz += cosYaw;
    }
    if (this.keys.left) {
      dx -= cosYaw;
      dz += sinYaw;
    }
    if (this.keys.right) {
      dx += cosYaw;
      dz -= sinYaw;
    }

    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
      const normX = dx / len;
      const normZ = dz / len;
      this.camera.position.x += normX * speed * delta;
      this.camera.position.z += normZ * speed * delta;
    }

    this.camera.position.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.camera.position.x));
    this.camera.position.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, this.camera.position.z));

    if (this.keys.jump && this.isGrounded) {
      this.velocityY = this.jumpSpeed;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.velocityY += this.gravity * delta;
      this.camera.position.y += this.velocityY * delta;
      if (this.camera.position.y <= 0) {
        this.camera.position.y = 0;
        this.velocityY = 0;
        this.isGrounded = true;
      }
    }

    if (this.isGrounded) {
      this.camera.position.y = this.keys.crouch ? this.crouchHeight : this.normalHeight;
    }

    for (const col of this.colliders) {
      this.resolveCollider(col);
    }

    const V = this.THREE.Vector3;
    const Q = this.THREE.Quaternion;
    const qx = new Q();
    const qy = new Q();
    qx.setFromAxisAngle(new V(1, 0, 0), this.pitch);
    qy.setFromAxisAngle(new V(0, 1, 0), this.yaw);
    this.camera.quaternion.copy(qy.multiply(qx));
  }

  resolveCollider(col) {
    const r = this.playerRadius;
    const px = this.camera.position.x;
    const pz = this.camera.position.z;

    const closestX = Math.max(col.min.x, Math.min(px, col.max.x));
    const closestZ = Math.max(col.min.z, Math.min(pz, col.max.z));
    const dx = px - closestX;
    const dz = pz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < r * r) {
      const dist = Math.sqrt(distSq);
      if (dist < 0.001) {
        const angle = Math.random() * Math.PI * 2;
        this.camera.position.x += Math.cos(angle) * r;
        this.camera.position.z += Math.sin(angle) * r;
      } else {
        this.camera.position.x = closestX + (dx / dist) * r;
        this.camera.position.z = closestZ + (dz / dist) * r;
      }
    }
  }

  destroy() {
    this.stop();
    this.domElement = null;
    this.camera = null;
  }

  animateCamera(targetPos, targetLookAt, duration, onComplete) {
    if (!this.THREE) return;
    this.animTarget = { pos: targetPos.clone(), lookAt: targetLookAt.clone() };
    this.animDuration = duration;
    this.animElapsed = 0;
    this.animOnComplete = onComplete;
    this.animStartPos = this.camera.position.clone();
    if (this.isLocked) this.unlock();
  }

  cancelAnimation() {
    if (this.animTarget) {
      this.animTarget = null;
      this.animOnComplete = null;
    }
  }
}
