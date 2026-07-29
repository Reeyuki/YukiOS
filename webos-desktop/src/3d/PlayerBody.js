export class PlayerBody {
  constructor(THREE, scene, camera) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.leftArm = null;
    this.rightArm = null;
    this.leftHand = null;
    this.rightHand = null;
    this.leftShoulder = null;
    this.rightShoulder = null;
    this.leftLegPivot = null;
    this.rightLegPivot = null;
    this.leftLeg = null;
    this.rightLeg = null;
    this.leftFoot = null;
    this.rightFoot = null;
    this.shadowMesh = null;
    this.startTime = Date.now();
    this.prevPos = new THREE.Vector3();
    this.lastTime = this.startTime / 1000;
    this.walkPhase = 0;
  }

  build() {
    const T = this.THREE;

    const skinMat = new T.MeshStandardMaterial({
      color: 0xf5d0b0,
      roughness: 0.6,
      metalness: 0.0
    });
    const clothMat = new T.MeshStandardMaterial({
      color: 0x2a1a3a,
      roughness: 0.8,
      metalness: 0.0
    });
    const darkClothMat = new T.MeshStandardMaterial({
      color: 0x1a122a,
      roughness: 0.9,
      metalness: 0.0
    });
    const shoeMat = new T.MeshStandardMaterial({
      color: 0x111111,
      roughness: 1.0,
      metalness: 0.0
    });

    const neckBox = new T.Mesh(new T.BoxGeometry(0.16, 0.12, 0.16), skinMat);
    neckBox.position.set(0, 1.3, 0);
    this.group.add(neckBox);

    const head = new T.Mesh(new T.BoxGeometry(0.32, 0.3, 0.26), skinMat);
    head.position.set(0, 1.48, 0);
    this.group.add(head);

    this.leftShoulder = new T.Mesh(new T.BoxGeometry(0.18, 0.1, 0.16), clothMat);
    this.leftShoulder.position.set(-0.34, 1.22, 0);
    this.group.add(this.leftShoulder);

    this.rightShoulder = new T.Mesh(new T.BoxGeometry(0.18, 0.1, 0.16), clothMat);
    this.rightShoulder.position.set(0.34, 1.22, 0);
    this.group.add(this.rightShoulder);

    this.baseArmL = new T.Vector3(-0.36, 0.95, 0);
    this.baseArmR = new T.Vector3(0.36, 0.95, 0);
    this.baseHandL = new T.Vector3(-0.35, 0.68, 0);
    this.baseHandR = new T.Vector3(0.35, 0.68, 0);
    this.baseShoulderL = new T.Vector3(-0.34, 1.22, 0);
    this.baseShoulderR = new T.Vector3(0.34, 1.22, 0);

    const chestBox = new T.Mesh(new T.BoxGeometry(0.44, 0.36, 0.24), clothMat);
    chestBox.position.set(0, 1.03, 0);
    this.group.add(chestBox);

    const hipsBox = new T.Mesh(new T.BoxGeometry(0.38, 0.32, 0.2), darkClothMat);
    hipsBox.position.set(0, 0.72, 0);
    this.group.add(hipsBox);

    this.leftArm = new T.Mesh(new T.BoxGeometry(0.1, 0.48, 0.1), clothMat);
    this.leftArm.position.set(-0.36, 0.95, 0);
    this.leftArm.rotation.z = 0.2;
    this.leftArm.rotation.x = 0.1;
    this.group.add(this.leftArm);

    this.rightArm = new T.Mesh(new T.BoxGeometry(0.1, 0.48, 0.1), clothMat);
    this.rightArm.position.set(0.36, 0.95, 0);
    this.rightArm.rotation.z = -0.2;
    this.rightArm.rotation.x = 0.1;
    this.group.add(this.rightArm);

    this.leftHand = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.1), skinMat);
    this.leftHand.position.set(-0.35, 0.68, 0);
    this.group.add(this.leftHand);

    this.rightHand = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.1), skinMat);
    this.rightHand.position.set(0.35, 0.68, 0);
    this.group.add(this.rightHand);

    this.leftLegPivot = new T.Group();
    this.leftLegPivot.position.set(-0.12, 0.72, 0);
    this.group.add(this.leftLegPivot);

    this.leftLeg = new T.Mesh(new T.BoxGeometry(0.12, 0.55, 0.12), darkClothMat);
    this.leftLeg.position.set(0, -0.36, 0);
    this.leftLegPivot.add(this.leftLeg);

    this.leftFoot = new T.Mesh(new T.BoxGeometry(0.14, 0.07, 0.24), shoeMat);
    this.leftFoot.position.set(0, -0.685, 0);
    this.leftLegPivot.add(this.leftFoot);

    this.rightLegPivot = new T.Group();
    this.rightLegPivot.position.set(0.12, 0.72, 0);
    this.group.add(this.rightLegPivot);

    this.rightLeg = new T.Mesh(new T.BoxGeometry(0.12, 0.55, 0.12), darkClothMat);
    this.rightLeg.position.set(0, -0.36, 0);
    this.rightLegPivot.add(this.rightLeg);

    this.rightFoot = new T.Mesh(new T.BoxGeometry(0.14, 0.07, 0.24), shoeMat);
    this.rightFoot.position.set(0, -0.685, 0);
    this.rightLegPivot.add(this.rightFoot);

    const shadowMat = new T.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      depthWrite: false
    });
    this.shadowMesh = new T.Mesh(new T.CircleGeometry(0.5, 16), shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.scale.set(1, 1, 0.7);
    this.shadowMesh.position.y = 0.02;

    this.scene.add(this.group);
    this.scene.add(this.shadowMesh);
  }

  update() {
    const cp = this.camera.position;
    const floorY = Math.max(0, cp.y - 1.6);
    const yaw = new this.THREE.Euler().setFromQuaternion(this.camera.quaternion, "YXZ").y;
    const bodyBack = 0.03;
    this.group.position.set(cp.x + Math.sin(yaw) * bodyBack, floorY, cp.z + Math.cos(yaw) * bodyBack);
    this.group.quaternion.setFromEuler(new this.THREE.Euler(0, yaw, 0, "YXZ"));
    this.group.updateMatrixWorld();

    if (this.shadowMesh) {
      this.shadowMesh.position.x = cp.x;
      this.shadowMesh.position.z = cp.z;
    }

    const now = Date.now() / 1000;
    const dt = Math.min(now - this.lastTime, 0.05);
    this.lastTime = now;

    const dx = cp.x - this.prevPos.x;
    const dz = cp.z - this.prevPos.z;
    this.prevPos.copy(cp);
    const velocity = Math.sqrt(dx * dx + dz * dz) / Math.max(dt, 0.001);
    const isMoving = velocity > 0.05;

    const WALK_AMP = 0.55;
    const WALK_FREQ = 5.5;
    const MAX_WALK_VEL = 2.5;
    const walkIntensity = Math.min(velocity / MAX_WALK_VEL, 1);

    if (isMoving) {
      this.walkPhase += dt * WALK_FREQ * walkIntensity;
      const legSwing = walkIntensity * WALK_AMP;
      this.leftLegPivot.rotation.x = legSwing * Math.sin(this.walkPhase);
      this.rightLegPivot.rotation.x = legSwing * Math.sin(this.walkPhase + Math.PI);

      const armSwing = walkIntensity * 0.25;
      this.leftArm.rotation.x = 0.1 + armSwing * Math.sin(this.walkPhase + Math.PI);
      this.rightArm.rotation.x = 0.1 + armSwing * Math.sin(this.walkPhase);

      const bob = walkIntensity * 0.012;
      this.group.position.y = floorY + Math.abs(Math.sin(this.walkPhase)) * bob;
    } else {
      this.leftLegPivot.rotation.x = 0;
      this.rightLegPivot.rotation.x = 0;

      this.leftArm.quaternion.identity();
      this.leftArm.scale.set(1, 1, 1);
      this.rightArm.quaternion.identity();
      this.rightArm.scale.set(1, 1, 1);
    }

    const t = (Date.now() - this.startTime) / 1000;

    if (!isMoving) {
      const sway = Math.sin(t * 1.1) * 0.025;
      const float = Math.sin(t * 0.7 + 1.5) * 0.018;
      const rotSway = Math.sin(t * 1.3 + 1) * 0.04;

      this.leftArm.position.set(this.baseArmL.x + sway, this.baseArmL.y + float * 0.8, this.baseArmL.z);
      this.leftArm.rotation.z = 0.2 + rotSway * 0.4;
      this.rightArm.position.set(this.baseArmR.x - sway, this.baseArmR.y + float * 0.8, this.baseArmR.z);
      this.rightArm.rotation.z = -0.2 - rotSway * 0.4;
      this.leftHand.position.set(this.baseHandL.x + sway * 0.6, this.baseHandL.y + float * 1.2, this.baseHandL.z);
      this.rightHand.position.set(this.baseHandR.x - sway * 0.6, this.baseHandR.y + float * 1.2, this.baseHandR.z);
    }

    this.leftShoulder.position.y = this.baseShoulderL.y + Math.sin(t * 0.8) * 0.008;
    this.rightShoulder.position.y = this.baseShoulderR.y + Math.sin(t * 0.8) * 0.008;
  }

  worldToLocal(point) {
    return this.group.worldToLocal(point);
  }

  destroy() {
    if (this.group.parent) this.scene.remove(this.group);
    if (this.shadowMesh && this.shadowMesh.parent) this.scene.remove(this.shadowMesh);
    this.group.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (child.material) child.material.dispose();
      }
    });
    if (this.shadowMesh) {
      this.shadowMesh.geometry.dispose();
      this.shadowMesh.material.dispose();
    }
    this.leftArm = null;
    this.rightArm = null;
    this.leftHand = null;
    this.rightHand = null;
    this.leftShoulder = null;
    this.rightShoulder = null;
    this.leftLegPivot = null;
    this.rightLegPivot = null;
    this.leftLeg = null;
    this.rightLeg = null;
    this.leftFoot = null;
    this.rightFoot = null;
    this.shadowMesh = null;
    this.group = null;
  }
}
