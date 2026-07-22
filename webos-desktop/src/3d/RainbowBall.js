import * as CANNON from "cannon-es";

export class RainbowBall {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.mesh = null;
    this.body = null;
    this.time = 0;
  }

  init(position) {
    const T = this.THREE;
    const size = 0.12;

    const geo = new T.SphereGeometry(size, 24, 24);
    const mat = new T.MeshStandardMaterial({
      roughness: 0.05,
      metalness: 0.7,
      emissive: 0x000000,
      emissiveIntensity: 0.4
    });
    this.mesh = new T.Mesh(geo, mat);
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.isBall = true;
    this.mesh.userData.title = "Rainbow Ball";
    this.scene.add(this.mesh);

    this.body = new CANNON.Body({
      mass: 0.2,
      shape: new CANNON.Sphere(size),
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.1,
      angularDamping: 0.2,
      sleepSpeedLimit: 0.05,
      sleepTimeLimit: 0.5
    });
    this.body.wakeUp();

    this.updateColor(0);

    return this;
  }

  updateColor(hue) {
    const color = new this.THREE.Color(`hsl(${hue % 360}, 100%, 55%)`);
    this.mesh.material.color.copy(color);
    this.mesh.material.emissive.copy(new this.THREE.Color(`hsl(${hue % 360}, 100%, 30%)`));
  }

  update(delta, time) {
    this.time = time;
    const hue = time * 60;
    this.updateColor(hue);
  }

  destroy() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    this.mesh = null;
    this.body = null;
  }
}
