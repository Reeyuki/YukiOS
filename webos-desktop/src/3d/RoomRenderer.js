import { HologramRenderer } from "./HologramRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { CDN_BASES } from "../shared/assetResolver.js";
import { PlayerBody } from "./PlayerBody.js";

export class RoomRenderer {
  constructor(container) {
    this.container = container;
    this.updateHooks = [];
    this.renderHooks = [];
    this.clock = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.bloomPass = null;
    this.roomObjects = [];
    this.interactiveObjects = [];
    this.allMeshes = [];
    this.bounds = { minX: -5, maxX: 5, minZ: -4, maxZ: 4 };
    this.running = false;
    this.monitorScreen = null;
    this.monitorCaptureTimer = null;
    this.hologramRenderer = null;
    this.navArrowMeshes = [];
    this.curtainGeos = [];
    this.wailaMeshes = [];
    this.dustMesh = null;
    this.dustPositions = null;
    this.dustVelocities = null;
    this.time = 0;
    this.hologramTime = 0;
    this.hologramGroup = null;
    this.hologramBaseY = 0;
    this.hologramFrozen = false;
    this.chairGroup = null;
    this.glowStripLight = null;
    this.hdriEnvMap = null;
    this.isDay = false;
    this.quality = null;
  }

  async init() {
    const THREE = await import("three");
    this.THREE = THREE;

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a18);
    this.scene.fog = new THREE.Fog(0x0a0a18, 10, 22);

    this.camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 100);
    this.camera.position.set(0, 1.6, 2.5);
    this.camera.lookAt(0, 1.2, 0);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.4, 0.2, 0.1);
    this.composer.addPass(this.bloomPass);

    this.clock = new THREE.Clock();
    this.mirrorRes = 512;

    this.buildRoom();

    this.setupLighting();

    const skyPromise = this.buildSkybox();

    this.buildMirror();

    this.player = new PlayerBody(THREE, this.scene, this.camera);
    this.player.build();

    this.toggleDayNight();
    this.toggleDayNight();

    this.collectWAILAMeshes();
    this.running = true;
    this.animate();
  }

  buildRoom() {
    const THREE = this.THREE;

    this.wallMat = new THREE.MeshStandardMaterial({
      color: 0x16162a,
      roughness: 0.75,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    this.wallMeshes = [];

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), this.wallMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 3, 0);
    this.scene.add(ceiling);
    this.registerObject(ceiling, "Room");
    this.wallMeshes.push(ceiling);
    this.ceilingMesh = ceiling;

    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), this.wallMat);
    frontWall.position.set(0, 1.5, -4);
    this.scene.add(frontWall);
    this.registerObject(frontWall, "Room");
    this.wallMeshes.push(frontWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), this.wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-5, 1.5, 0);
    this.scene.add(leftWall);
    this.registerObject(leftWall, "Room");
    this.wallMeshes.push(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), this.wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(5, 1.5, 0);
    this.scene.add(rightWall);
    this.registerObject(rightWall, "Room");
    this.wallMeshes.push(rightWall);

    const backWallShape = new THREE.Shape();
    backWallShape.moveTo(-5, 0);
    backWallShape.lineTo(5, 0);
    backWallShape.lineTo(5, 3);
    backWallShape.lineTo(-5, 3);
    backWallShape.lineTo(-5, 0);

    const winHalfW = 0.6;
    const winHalfH = 0.5;
    const winCenterY = 1.5;
    const holePath = new THREE.Path();
    holePath.moveTo(-winHalfW, winCenterY - winHalfH);
    holePath.lineTo(winHalfW, winCenterY - winHalfH);
    holePath.lineTo(winHalfW, winCenterY + winHalfH);
    holePath.lineTo(-winHalfW, winCenterY + winHalfH);
    backWallShape.holes.push(holePath);

    const backWallGeo = new THREE.ShapeGeometry(backWallShape);
    const backWall = new THREE.Mesh(backWallGeo, this.wallMat);
    backWall.rotation.y = Math.PI;
    backWall.position.set(0, 0, 4);
    this.scene.add(backWall);
    this.registerObject(backWall, "Room");
    this.wallMeshes.push(backWall);

    this.floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a14,
      roughness: 0.75,
      metalness: 0.15
    });
    this.floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), this.floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = 0.01;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);
    this.registerObject(this.floorMesh, "Floor");

    const deskMat = new THREE.MeshStandardMaterial({
      color: 0x3d2b1f,
      roughness: 0.7,
      metalness: 0.2
    });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 1), deskMat);
    desk.position.set(0, 0.75, -1);
    desk.receiveShadow = true;
    desk.castShadow = true;
    this.scene.add(desk);
    this.registerObject(desk, "Desk");

    const legMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });
    const legPositions = [
      [-0.85, 0.35, -0.55],
      [-0.85, 0.35, -1.45],
      [0.85, 0.35, -0.55],
      [0.85, 0.35, -1.45]
    ];
    for (const pos of legPositions) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), legMat);
      leg.position.set(pos[0], pos[1], pos[2]);
      this.scene.add(leg);
      this.registerObject(leg, "Desk Leg");
    }

    const hologramGroup = new THREE.Group();
    hologramGroup.position.set(0, 0.82, -1.4);
    this.hologramGroup = hologramGroup;
    this.hologramBaseY = 0.82;

    const projectorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x00ccff,
      emissiveIntensity: 0.15
    });

    const projectorBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.06, 16), projectorMat);
    projectorBase.position.y = 0.03;
    projectorBase.castShadow = true;
    hologramGroup.add(projectorBase);

    const hologramScreenMat = new THREE.MeshBasicMaterial({
      color: 0x00bbff,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    });
    const holoScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), hologramScreenMat);
    holoScreen.position.set(0, 0.8, 0);
    hologramGroup.add(holoScreen);
    this.monitorScreen = holoScreen;
    holoScreen.userData.title = "Hologram";

    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ccff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.4), glowMat);
    glowPlane.position.set(0, 0.8, -0.01);
    hologramGroup.add(glowPlane);

    const borderMat = new THREE.MeshBasicMaterial({
      color: 0x00ccff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.8, 1.2));
    const borderLine = new THREE.LineSegments(
      borderGeo,
      new THREE.LineBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.15, depthWrite: false })
    );
    borderLine.position.set(0, 0.8, 0);
    hologramGroup.add(borderLine);

    const cornerDots = [
      [-0.9, 0.6, 0],
      [0.9, 0.6, 0],
      [-0.9, -0.6, 0],
      [0.9, -0.6, 0]
    ];
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x00ddff });
    for (const cd of cornerDots) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), dotMat);
      dot.position.set(cd[0], cd[1], cd[2]);
      hologramGroup.add(dot);
    }

    this.scene.add(hologramGroup);
    this.registerObject(projectorBase, "Monitor", true);

    {
      const as = 0.08;
      ["prev", "next"].forEach((d) => {
        const c = document.createElement("canvas");
        c.width = 30;
        c.height = 30;
        const cx = c.getContext("2d");
        cx.fillStyle = "rgba(0,204,255,0.15)";
        cx.beginPath();
        cx.arc(15, 15, 14, 0, Math.PI * 2);
        cx.fill();
        cx.fillStyle = "rgba(0,204,255,0.55)";
        cx.beginPath();
        if (d === "prev") {
          cx.moveTo(20, 8);
          cx.lineTo(10, 15);
          cx.lineTo(20, 22);
        } else {
          cx.moveTo(10, 8);
          cx.lineTo(20, 15);
          cx.lineTo(10, 22);
        }
        cx.closePath();
        cx.fill();
        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(as, as),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
        );
        m.position.set(d === "prev" ? -0.95 : 0.95, 0.8, 0.02);
        m.userData.objectId = "holoArrow" + (d === "prev" ? "Prev" : "Next");
        m.userData.interactive = true;
        hologramGroup.add(m);
        this.interactiveObjects.push(m);
        m.userData.title = "Navigate";
        this.navArrowMeshes.push(m);
      });
    }

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a1a,
      roughness: 0.6,
      metalness: 0.1
    });
    const frameDepth = 0.08;
    const outerW = 1.44;
    const outerH = 1.24;
    const borderW = 0.12;

    const frameParts = [
      { w: outerW, h: borderW, d: frameDepth, x: 0, y: 1.5 + outerH / 2 - borderW / 2, z: 3.98 },
      { w: outerW, h: borderW, d: frameDepth, x: 0, y: 1.5 - outerH / 2 + borderW / 2, z: 3.98 },
      { w: borderW, h: outerH - 2 * borderW, d: frameDepth, x: -outerW / 2 + borderW / 2, y: 1.5, z: 3.98 },
      { w: borderW, h: outerH - 2 * borderW, d: frameDepth, x: outerW / 2 - borderW / 2, y: 1.5, z: 3.98 }
    ];

    for (const p of frameParts) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), frameMat);
      mesh.position.set(p.x, p.y, p.z);
      this.scene.add(mesh);
      this.registerObject(mesh, "Window Frame");
    }

    const sillMat = new THREE.MeshStandardMaterial({
      color: 0x4a3a2a,
      roughness: 0.5,
      metalness: 0.1
    });
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.04, 0.14), sillMat);
    sill.position.set(0, 0.86, 3.96);
    this.scene.add(sill);
    this.registerObject(sill, "Window Sill");

    this.buildDecor();
    this.buildBaseboards();
    this.buildChair();
    this.buildKeyboard();
    this.buildCoffeeCup();
    this.buildGlowStrip();
    this.buildMouse();
    this.buildCeilingLight();
    this.buildCurtains();
    this.buildDoor();
    this.buildWastebin();
    this.buildWallArt();
    this.buildLamp();
    this.buildDustParticles();
    this.buildCornerAO();
    this.buildRugPattern();
    this.buildColorButton();

    this.bounds = { minX: -4.8, maxX: 4.8, minZ: -3.8, maxZ: 3.8 };

    this.colliders = [
      {
        min: { x: -1, y: 0, z: -1.5 },
        max: { x: 1, y: 0.8, z: -0.5 },
        label: "desk"
      },
      {
        min: { x: -1.0, y: 0.78, z: -1.5 },
        max: { x: 1.0, y: 1.7, z: -1.3 },
        label: "monitor"
      }
    ];
  }

  buildDecor() {}

  buildChair() {
    const T = this.THREE;
    const fabricMat = new T.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.85, metalness: 0 });
    const metalMat = new T.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 });
    const wheelMat = new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.4 });

    const group = new T.Group();
    group.position.set(0, 0, 0);
    group.rotation.y = Math.PI;

    const base = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.02, 6), metalMat);
    base.position.set(0, 0.25, 0);
    group.add(base);

    const hub = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.04, 6), metalMat);
    hub.position.set(0, 0.27, 0);
    group.add(hub);

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const arm = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.2, 4), metalMat);
      arm.position.set(Math.sin(angle) * 0.1, 0.22, Math.cos(angle) * 0.1);
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = -angle;
      group.add(arm);

      const wheel = new T.Mesh(new T.SphereGeometry(0.018, 6, 6), wheelMat);
      wheel.position.set(Math.sin(angle) * 0.2, 0.018, Math.cos(angle) * 0.2);
      group.add(wheel);
    }

    const pole = new T.Mesh(new T.CylinderGeometry(0.018, 0.022, 0.2, 6), metalMat);
    pole.position.set(0, 0.39, 0);
    group.add(pole);

    const seat = new T.Mesh(new T.BoxGeometry(0.38, 0.04, 0.36), fabricMat);
    seat.position.set(0, 0.52, 0);
    seat.castShadow = true;
    group.add(seat);

    const armMat = new T.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.3 });
    for (const sx of [-1, 1]) {
      const arm = new T.Mesh(new T.BoxGeometry(0.03, 0.02, 0.22), armMat);
      arm.position.set(sx * 0.2, 0.62, -0.02);
      group.add(arm);

      const support = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.1, 4), metalMat);
      support.position.set(sx * 0.2, 0.57, 0.08);
      group.add(support);
    }

    const back = new T.Mesh(new T.BoxGeometry(0.34, 0.4, 0.03), fabricMat);
    back.position.set(0, 0.76, -0.16);
    back.castShadow = true;
    group.add(back);

    const backSupport = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.08, 6), metalMat);
    backSupport.position.set(0, 0.62, -0.14);
    backSupport.rotation.x = 0.3;
    group.add(backSupport);

    group.traverse((child) => {
      if (child.isMesh) {
        child.userData.title = "Chair";
      }
    });
    this.scene.add(group);
    this.chairGroup = group;
  }

  buildKeyboard() {
    const T = this.THREE;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, 128, 48);

    const rows = [8, 7, 7, 5];
    const keyW = 10;
    const keyH = 8;
    const gap = 2;
    let y = 6;
    for (let r = 0; r < rows.length; r++) {
      const totalW = rows[r] * (keyW + gap) - gap;
      let x = (128 - totalW) / 2;
      for (let i = 0; i < rows[r]; i++) {
        ctx.fillStyle = "#333";
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 0.5;
        ctx.fillRect(x, y, keyW, keyH);
        ctx.strokeRect(x, y, keyW, keyH);
        x += keyW + gap;
      }
      y += keyH + gap;
    }

    const tex = new T.CanvasTexture(canvas);
    const mat = new T.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.1 });
    const kb = new T.Mesh(new T.BoxGeometry(0.35, 0.015, 0.12), mat);
    kb.position.set(0, 0.81, -0.78);
    kb.castShadow = true;
    this.scene.add(kb);
    this.registerObject(kb, "Keyboard");
  }

  buildCoffeeCup() {
    const T = this.THREE;
    const bodyMat = new T.MeshStandardMaterial({
      color: 0x14142a,
      roughness: 0.4,
      metalness: 0.1
    });

    const body = new T.Mesh(new T.CylinderGeometry(0.035, 0.03, 0.07, 12), bodyMat);
    body.position.set(-0.55, 0.81 + 0.035, -0.55);
    body.castShadow = true;
    body.receiveShadow = true;
    this.scene.add(body);
    this.registerObject(body, "Coffee Cup");

    const handleMat = new T.MeshStandardMaterial({
      color: 0x14142a,
      roughness: 0.4,
      metalness: 0.1
    });

    const handle = new T.Mesh(new T.TorusGeometry(0.025, 0.006, 8, 12, Math.PI), handleMat);
    handle.position.set(-0.55 + 0.035 + 0.025, 0.81 + 0.035, -0.55);
    handle.rotation.z = -Math.PI / 2;
    handle.castShadow = true;
    handle.receiveShadow = true;
    this.scene.add(handle);
    this.registerObject(handle, "Coffee Cup Handle");

    const liquidMat = new T.MeshStandardMaterial({
      color: 0xff3388,
      emissive: 0xff2266,
      transparent: true,
      opacity: 0.8,
      roughness: 0.1,
      metalness: 0,
      side: T.DoubleSide
    });

    const liquid = new T.Mesh(new T.CircleGeometry(0.028, 16), liquidMat);
    liquid.rotation.x = -Math.PI / 2;
    liquid.position.set(-0.55, 0.81 + 0.07, -0.55);
    liquid.castShadow = true;
    this.scene.add(liquid);
    this.registerObject(liquid, "Coffee Liquid");

    const steamMat = new T.MeshBasicMaterial({
      color: 0xff3388,
      transparent: true,
      opacity: 0.1,
      side: T.DoubleSide,
      depthWrite: false,
      blending: T.AdditiveBlending
    });

    for (let i = 0; i < 3; i++) {
      const steam = new T.Mesh(new T.PlaneGeometry(0.025, 0.035), steamMat);
      steam.position.set(-0.55 + (i - 1) * 0.025, 0.81 + 0.09 + i * 0.02, -0.55);
      steam.rotation.x = (i - 1) * 0.1;
      steam.rotation.z = (i - 1) * 0.1;
      steam.userData.title = "Steam";
      this.scene.add(steam);
    }
  }

  buildMouse() {
    const T = this.THREE;
    const mat = new T.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.2 });

    const body = new T.Mesh(new T.SphereGeometry(0.04, 8, 8), mat);
    body.position.set(0.32, 0.805, -0.62);
    body.scale.set(1, 0.5, 1.5);
    this.scene.add(body);
    this.registerObject(body, "Mouse");

    const cordMat = new T.MeshBasicMaterial({ color: 0x222222 });
    const cord = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 0.25, 4), cordMat);
    cord.position.set(0.32, 0.805, -0.48);
    cord.rotation.x = 0.3;
    this.scene.add(cord);
    this.registerObject(cord, "Mouse Cord");
  }

  buildCeilingLight() {
    const T = this.THREE;
    const metalMat = new T.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
    const glassMat = new T.MeshStandardMaterial({
      color: 0x1a1a30,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.3,
      side: T.DoubleSide
    });

    const mount = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.02, 8), metalMat);
    mount.position.set(0, 2.99, -0.5);
    mount.userData.title = "Ceiling Light";
    this.scene.add(mount);

    const cord = new T.Mesh(new T.CylinderGeometry(0.005, 0.005, 0.25, 4), metalMat);
    cord.position.set(0, 2.87, -0.5);
    cord.userData.title = "Ceiling Light";
    this.scene.add(cord);

    const shade = new T.Mesh(new T.CylinderGeometry(0.12, 0.18, 0.15, 8, 1, true), glassMat);
    shade.position.set(0, 2.73, -0.5);
    shade.userData.title = "Ceiling Light";
    this.scene.add(shade);

    const rimMat = new T.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.2 });
    const rim = new T.Mesh(new T.TorusGeometry(0.15, 0.006, 6, 16), rimMat);
    rim.position.set(0, 2.66, -0.5);
    rim.rotation.x = Math.PI / 2;
    rim.userData.title = "Ceiling Light";
    this.scene.add(rim);

    const bulb = new T.Mesh(new T.SphereGeometry(0.035, 8, 8), new T.MeshBasicMaterial({ color: 0x00ddff }));
    bulb.position.set(0, 2.7, -0.5);
    bulb.userData.title = "Ceiling Light";
    this.scene.add(bulb);

    this.ceilingLight = new T.SpotLight(0x00ddff, 0.45, 4, Math.PI / 4, 0.5, 1.5);
    this.ceilingLight.target.position.set(0, 0, -0.5);
    this.scene.add(this.ceilingLight.target);
    this.ceilingLight.castShadow = true;
    this.ceilingLight.shadow.mapSize.width = 256;
    this.ceilingLight.shadow.mapSize.height = 256;
    this.ceilingLight.shadow.bias = -0.002;
    this.ceilingLight.position.set(0, 2.65, -0.5);
    this.scene.add(this.ceilingLight);
  }

  buildCurtains() {
    const T = this.THREE;

    const fabricMat = new T.MeshStandardMaterial({
      color: 0x14142a,
      roughness: 0.95,
      metalness: 0,
      side: T.DoubleSide
    });

    const curtainW = 0.4;
    const curtainH = 1.25;

    for (const xSign of [-1, 1]) {
      const segW = 6;
      const segH = 10;
      const geo = new T.PlaneGeometry(curtainW, curtainH, segW, segH);
      const pos = geo.attributes.position;

      for (let i = 0; i < pos.count; i++) {
        const ix = pos.getX(i);
        const iy = pos.getY(i);
        const fold = Math.sin(ix * 12) * 0.025;
        const sag = ((iy + curtainH / 2) / curtainH) * Math.sin(ix * 8 + 1) * 0.02;
        pos.setZ(i, fold + sag);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();

      const mesh = new T.Mesh(geo, fabricMat);
      mesh.position.set(xSign * 0.45, 1.4, 3.93);
      this.scene.add(mesh);
      mesh.userData.title = "Curtain";
      this.curtainGeos.push({ geo, origPositions: Float32Array.from(geo.attributes.position.array) });

      const tieMat = new T.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.3 });
      const tie = new T.Mesh(new T.TorusGeometry(0.03, 0.004, 6, 8), tieMat);
      tie.position.set(xSign * 0.45, 1.1, 3.95);
      tie.userData.title = "Curtain Tie";
      this.scene.add(tie);
    }

    const rodMat = new T.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.8,
      roughness: 0.2
    });
    const rod = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 1.0, 6), rodMat);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, 2.04, 3.94);
    rod.userData.title = "Curtain Rod";
    this.scene.add(rod);

    const finialMat = new T.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
    for (const sx of [-1, 1]) {
      const finial = new T.Mesh(new T.SphereGeometry(0.022, 6, 6), finialMat);
      finial.position.set(sx * 0.52, 2.04, 3.94);
      finial.userData.title = "Curtain Finial";
      this.scene.add(finial);
    }
  }

  async buildSkybox() {
    const T = this.THREE;

    this.scene.background = new T.Color(0x0a0a18);

    try {
      const loader = new EXRLoader();
      const texture = await loader.loadAsync(CDN_BASES.MAIN + "/webos-desktop/public/skybox/cosmic.exr");

      const pmremGenerator = new T.PMREMGenerator(this.renderer);
      pmremGenerator.compileEquirectangularShader();
      this.hdriEnvMap = pmremGenerator.fromEquirectangular(texture).texture;
      pmremGenerator.dispose();

      this.scene.background = this.hdriEnvMap;
      this.scene.environment = this.hdriEnvMap;
    } catch (e) {
      console.warn("HDRI skybox failed to load, using fallback:", e);
    }
  }

  buildDoor() {
    const T = this.THREE;
    const doorMat = new T.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 });
    const handleMat = new T.MeshStandardMaterial({ color: 0x556677, metalness: 0.8, roughness: 0.2 });

    const door = new T.Mesh(new T.BoxGeometry(0.05, 2.0, 0.8), doorMat);
    door.position.set(-4.97, 1.0, 1.5);
    this.scene.add(door);
    this.registerObject(door, "Door");

    const handle = new T.Mesh(new T.SphereGeometry(0.035, 8, 8), handleMat);
    handle.position.set(-4.97, 1.0, 1.9);
    this.registerObject(handle, "Door Handle", true);
    handle.userData.tooltip = "Locked";
    this.scene.add(handle);
  }

  buildWastebin() {
    const T = this.THREE;

    const binMat = new T.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2
    });

    const bin = new T.Mesh(new T.CylinderGeometry(0.15, 0.2, 0.3, 12), binMat);
    bin.position.set(-2.5, 0.15, 2);
    bin.castShadow = true;
    bin.receiveShadow = true;
    this.registerObject(bin, "Wastebin", true);
    bin.userData.tooltip = "Press E to grab Wastebin";
    bin.userData.isFurniture = true;
    this.scene.add(bin);

    const rimMat = new T.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.6,
      metalness: 0.3
    });
    const rim = new T.Mesh(new T.TorusGeometry(0.17, 0.02, 8, 12), rimMat);
    rim.position.set(-2.5, 0.3, 2);
    rim.rotation.x = Math.PI / 2;
    this.scene.add(rim);
    this.registerObject(rim, "Wastebin");
  }

  buildBaseboards() {
    const T = this.THREE;
    const mat = new T.MeshStandardMaterial({ color: 0x121226, roughness: 0.6, metalness: 0.1 });
    const h = 0.08;

    const walls = [
      { pos: [0, h / 2, -3.96], rot: [0, 0, 0], w: 10 },
      { pos: [-4.96, h / 2, 0], rot: [0, Math.PI / 2, 0], w: 10 },
      { pos: [4.96, h / 2, 0], rot: [0, Math.PI / 2, 0], w: 10 }
    ];
    for (const w of walls) {
      const mesh = new T.Mesh(new T.BoxGeometry(w.w, h, 0.02), mat);
      mesh.position.set(...w.pos);
      mesh.rotation.set(...w.rot);
      this.scene.add(mesh);
    }

    const crown = new T.MeshStandardMaterial({ color: 0x121226, roughness: 0.5, metalness: 0.05 });
    const ch = 0.06;
    const crownWalls = [
      { pos: [0, 2.97, -3.96], w: 10 },
      { pos: [-4.96, 2.97, 0], w: 10, ry: Math.PI / 2 },
      { pos: [4.96, 2.97, 0], w: 10, ry: Math.PI / 2 }
    ];
    for (const w of crownWalls) {
      const mesh = new T.Mesh(new T.BoxGeometry(w.w, ch, 0.03), crown);
      mesh.position.set(...w.pos);
      if (w.ry) mesh.rotation.y = w.ry;
      this.scene.add(mesh);
    }
  }

  buildWallArt() {
    const T = this.THREE;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0c0614";
    ctx.fillRect(0, 0, 256, 192);

    const grad = ctx.createLinearGradient(0, 0, 0, 192);
    grad.addColorStop(0, "#14081e");
    grad.addColorStop(0.5, "#1a0c28");
    grad.addColorStop(1, "#0a0410");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 192);

    ctx.strokeStyle = "rgba(0,180,255,0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
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

    ctx.fillStyle = "rgba(0,200,255,0.2)";
    ctx.beginPath();
    ctx.ellipse(128, 100, 40, 30, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(0,150,220,0.15)";
    ctx.beginPath();
    ctx.ellipse(100, 80, 25, 20, -0.5, 0, Math.PI * 2);
    ctx.fill();

    const tex = new T.CanvasTexture(canvas);
    const artMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.05 });

    const art = new T.Mesh(new T.PlaneGeometry(0.7, 0.5), artMat);
    art.position.set(-2.0, 1.8, -3.95);
    this.scene.add(art);
    this.registerObject(art, "Wall Painting");

    const frameMat = new T.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5, metalness: 0.2 });
    const fw = 0.74;
    const fh = 0.54;
    const fd = 0.025;
    const fb = 0.03;
    const frameParts = [
      { w: fw, h: fb, x: -2.0, y: 1.8 + fh / 2 - fb / 2, z: -3.94 },
      { w: fw, h: fb, x: -2.0, y: 1.8 - fh / 2 + fb / 2, z: -3.94 },
      { w: fb, h: fh - 2 * fb, x: -2.0 - fw / 2 + fb / 2, y: 1.8, z: -3.94 },
      { w: fb, h: fh - 2 * fb, x: -2.0 + fw / 2 - fb / 2, y: 1.8, z: -3.94 }
    ];
    for (const p of frameParts) {
      const m = new T.Mesh(new T.BoxGeometry(p.w, p.h, fd), frameMat);
      m.position.set(p.x, p.y, p.z);
      m.userData.title = "Painting Frame";
      this.scene.add(m);
    }
  }

  buildLamp() {
    const T = this.THREE;
    const poleMat = new T.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 });
    const shadeMat = new T.MeshStandardMaterial({
      color: 0x222238,
      roughness: 0.9,
      metalness: 0,
      side: T.DoubleSide
    });

    const base = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.02, 12), poleMat);
    base.position.set(0.85, 0.81, -1.0);
    base.userData.title = "Desk Lamp Base";
    this.scene.add(base);

    const pole = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.35, 6), poleMat);
    pole.position.set(0.85, 0.99, -1.0);
    pole.userData.title = "Desk Lamp Pole";
    this.scene.add(pole);

    const shade = new T.Mesh(new T.CylinderGeometry(0.08, 0.12, 0.12, 8, 1, true), shadeMat);
    shade.position.set(0.85, 1.19, -1.0);
    this.scene.add(shade);
    this.registerObject(shade, "Desk Lamp", true);
    shade.userData.tooltip = "Click to toggle lamp";

    this.lampBulb = new T.Mesh(new T.SphereGeometry(0.03, 8, 8), new T.MeshBasicMaterial({ color: 0xffcc44 }));
    this.lampBulb.position.set(0.85, 1.13, -1.0);
    this.lampBulb.userData.title = "Desk Lamp Bulb";
    this.scene.add(this.lampBulb);

    this.lampLight = new T.PointLight(0xffcc44, 0.5, 3, 2);
    this.lampLight.position.set(0.85, 1.15, -1.0);
    this.scene.add(this.lampLight);

    this.lampOn = true;
  }

  toggleLamp() {
    this.lampOn = !this.lampOn;
    if (this.lampOn) {
      this.lampLight.intensity = 0.8;
      this.lampBulb.material.color.setHex(0xffcc44);
    } else {
      this.lampLight.intensity = 0;
      this.lampBulb.material.color.setHex(0x221100);
    }
  }

  setWallColor(hex) {
    if (this.wallMat) {
      this.wallMat.color.setHex(hex);
    }
  }

  setFloorColor(hex) {
    if (this.floorMat) {
      this.floorMat.color.setHex(hex);
    }
  }
  buildDustParticles() {
    const T = this.THREE;
    const count = 200;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 1] = Math.random() * 2.8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 7;
      velocities[i * 3] = 0.3 + Math.random() * 0.4;
      velocities[i * 3 + 1] = 0.5 + Math.random() * 0.8;
      velocities[i * 3 + 2] = 0.2 + Math.random() * 0.5;
    }
    this.dustPositions = positions;
    this.dustVelocities = velocities;
    const geo = new T.CircleGeometry(0.015, 4);
    const mat = new T.MeshBasicMaterial({
      color: 0x88ccdd,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: T.DoubleSide
    });
    const instancedMesh = new T.InstancedMesh(geo, mat, count);
    const dummyMatrix = new T.Matrix4();
    for (let i = 0; i < count; i++) {
      dummyMatrix.makeTranslation(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      instancedMesh.setMatrixAt(i, dummyMatrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    this.dustMesh = instancedMesh;
    this.scene.add(instancedMesh);
  }

  buildCornerAO() {
    const T = this.THREE;
    const aoMat = new T.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      side: T.DoubleSide,
      depthWrite: false
    });

    const corners = [
      { pos: [-4.98, 1.5, -3.98], ry: Math.PI / 4 },
      { pos: [4.98, 1.5, -3.98], ry: -Math.PI / 4 },
      { pos: [-4.98, 1.5, 3.98], ry: -Math.PI / 4 },
      { pos: [4.98, 1.5, 3.98], ry: Math.PI / 4 }
    ];
    for (const c of corners) {
      const plane = new T.Mesh(new T.PlaneGeometry(0.6, 3), aoMat);
      plane.position.set(...c.pos);
      plane.rotation.y = c.ry;
      plane.userData.title = "Ambient Occlusion";
      this.scene.add(plane);
    }

    const baseAOMat = new T.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.15,
      side: T.DoubleSide,
      depthWrite: false
    });
    const baseWalls = [
      { pos: [0, 0.15, -3.98], w: 10 },
      { pos: [-4.98, 0.15, 0], w: 10, ry: Math.PI / 2 },
      { pos: [4.98, 0.15, 0], w: 10, ry: Math.PI / 2 }
    ];
    for (const b of baseWalls) {
      const strip = new T.Mesh(new T.PlaneGeometry(b.w, 0.3), baseAOMat);
      strip.position.set(...b.pos);
      if (b.ry) strip.rotation.y = b.ry;
      strip.userData.title = "Ambient Occlusion";
      this.scene.add(strip);
    }
  }

  buildRugPattern() {
    const T = this.THREE;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 170;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#1a0a28";
    ctx.fillRect(0, 0, 256, 170);

    ctx.strokeStyle = "rgba(0,150,255,0.25)";
    ctx.lineWidth = 1;
    const cx = 128,
      cy = 85;
    for (let r = 10; r < 80; r += 8) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(0,100,200,0.2)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 60;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.65);
      ctx.lineTo(cx + Math.cos(angle) * (dist + 5), cy + Math.sin(angle) * (dist + 5) * 0.65);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(0,180,255,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 55, 35, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 40, 25, 0, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new T.CanvasTexture(canvas);
    const rugMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 });
    const rug = new T.Mesh(new T.PlaneGeometry(1.2, 0.8), rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.005, 1.0);
    this.scene.add(rug);
    this.registerObject(rug, "Rug");
  }

  buildGlowStrip() {
    const T = this.THREE;
    const glowMat = new T.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.5
    });
    const glow = new T.Mesh(new T.BoxGeometry(1.6, 0.01, 0.04), glowMat);
    glow.position.set(0, 0.12, -0.55);
    this.scene.add(glow);
    this.registerObject(glow, "Glow Strip");

    this.glowStripLight = new T.PointLight(0x00ddff, 0.25, 1.5, 1);
    this.glowStripLight.position.set(0, 0.08, -0.55);
    this.scene.add(this.glowStripLight);
  }

  buildColorButton() {
    const T = this.THREE;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = "#44ff44";
    ctx.fillRect(32, 0, 32, 32);
    ctx.fillStyle = "#4444ff";
    ctx.fillRect(0, 32, 32, 32);
    ctx.fillStyle = "#ffaa00";
    ctx.fillRect(32, 32, 32, 32);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(canvas);

    const mat = new T.MeshStandardMaterial({
      map: tex,
      roughness: 0.3,
      metalness: 0.05,
      emissive: 0xffcc00,
      emissiveIntensity: 0.08
    });
    const btn = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.018, 16), mat);
    btn.position.set(-0.35, 0.805, -0.7);
    btn.userData.objectId = "colorPickerButton";
    this.scene.add(btn);
    this.registerObject(btn, "ColorPicker", true);
  }

  buildMirror() {
    const T = this.THREE;
    const res = this.mirrorRes || 512;

    const mirrorH = 2.8;
    const mirrorW = 0.8;
    const mirrorGeo = new T.PlaneGeometry(mirrorW, mirrorH);
    const reflector = new Reflector(mirrorGeo, {
      color: 0x7f7f7f,
      textureWidth: res,
      textureHeight: res,
      clipBias: 0.003
    });
    reflector.position.set(1.8, 1.5, 3.97);
    reflector.rotation.y = Math.PI;
    reflector.userData.title = "Mirror";
    this.scene.add(reflector);
    this.mirrorMesh = reflector;

    const origOnBeforeRender = reflector.onBeforeRender;
    const camDir = new T.Vector3();
    const dirToMirror = new T.Vector3();
    reflector.onBeforeRender = function (renderer, scene, camera) {
      camera.getWorldDirection(camDir);
      dirToMirror.subVectors(reflector.position, camera.position).normalize();
      if (camDir.angleTo(dirToMirror) > 0.9) return;
      origOnBeforeRender.call(this, renderer, scene, camera);
    };

    const frameMat = new T.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.3 });
    const mz = 3.97;
    const hh = mirrorH / 2;
    const hw = mirrorW / 2;
    const barW = 0.03;
    const ovlap = 0.015;
    for (const [dx, dy, sx, sy] of [
      [0, hh + ovlap, mirrorW + barW * 2, barW],
      [0, -(hh + ovlap), mirrorW + barW * 2, barW],
      [-(hw + ovlap), 0, barW, mirrorH + barW * 2],
      [hw + ovlap, 0, barW, mirrorH + barW * 2]
    ]) {
      const f = new T.Mesh(new T.BoxGeometry(sx, sy, 0.03), frameMat);
      f.position.set(1.8 + dx, 1.5 + dy, mz - 0.02);
      this.scene.add(f);
    }
  }

  setupLighting() {
    const THREE = this.THREE;

    this.hemiLight = new THREE.HemisphereLight(0x1a1a2e, 0x0a0a14, 0.3);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0x10101e, 0.3);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xcc8844, 0.3);
    this.keyLight.position.set(1, 5, 4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 256;
    this.keyLight.shadow.mapSize.height = 256;
    this.keyLight.shadow.bias = -0.001;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0x224466, 0.15);
    this.fillLight.position.set(-3, 2, -2);
    this.scene.add(this.fillLight);

    this.moonSpot = new THREE.SpotLight(0x4488aa, 3.0, 10, 0.45, 0.6, 1.2);
    this.moonSpot.position.set(0, 2.2, 5.5);
    this.moonSpot.target.position.set(0, 0.5, -1);
    this.moonSpot.castShadow = true;
    this.moonSpot.shadow.mapSize.width = 512;
    this.moonSpot.shadow.mapSize.height = 512;
    this.moonSpot.shadow.bias = -0.002;
    this.scene.add(this.moonSpot);
    this.scene.add(this.moonSpot.target);

    this.moonBeam = new THREE.PointLight(0x336688, 0.8, 8, 1.5);
    this.moonBeam.position.set(0, 1.5, 2);
    this.scene.add(this.moonBeam);

    this.windowGlow = new THREE.PointLight(0x4488aa, 0.4, 5, 2);
    this.windowGlow.position.set(0, 1.5, 3.5);
    this.scene.add(this.windowGlow);

    this.isDay = false;
  }

  toggleDayNight() {
    this.isDay = !this.isDay;
    const T = this.THREE;
    if (this.isDay) {
      this.hemiLight.color.setHex(0x88bbdd);
      this.hemiLight.groundColor.setHex(0x446688);
      this.hemiLight.intensity = 0.5;
      this.ambientLight.color.setHex(0x557799);
      this.ambientLight.intensity = 0.35;
      this.keyLight.color.setHex(0xffddaa);
      this.keyLight.intensity = 0.6;
      this.fillLight.color.setHex(0x88aacc);
      this.fillLight.intensity = 0.25;
      this.moonSpot.intensity = 0.1;
      this.moonBeam.intensity = 0;
      this.windowGlow.color.setHex(0x88bbdd);
      this.windowGlow.intensity = 0.4;
      if (this.scene) {
        this.scene.background = new T.Color(0x4a6a8a);
        this.scene.fog.color.setHex(0x4a6a8a);
      }
      this.renderer.toneMappingExposure = 1.2;
    } else {
      this.hemiLight.color.setHex(0x1a1a2e);
      this.hemiLight.groundColor.setHex(0x0a0a14);
      this.hemiLight.intensity = 0.3;
      this.ambientLight.color.setHex(0x10101e);
      this.ambientLight.intensity = 0.3;
      this.keyLight.color.setHex(0xcc8844);
      this.keyLight.intensity = 0.3;
      this.fillLight.color.setHex(0x224466);
      this.fillLight.intensity = 0.15;
      this.moonSpot.intensity = 3.0;
      this.moonBeam.intensity = 0.8;
      this.windowGlow.color.setHex(0x4488aa);
      this.windowGlow.intensity = 0.4;
      if (this.scene) {
        this.scene.background = this.hdriEnvMap || new T.Color(0x0a0a18);
        this.scene.fog.color.setHex(0x0a0a18);
      }
      this.renderer.toneMappingExposure = 1.2;
    }
  }

  rebuildMirror() {
    if (this.mirrorMesh) {
      this.scene.remove(this.mirrorMesh);
      const rt = this.mirrorMesh.getRenderTarget();
      if (rt) rt.dispose();
      this.mirrorMesh.material.dispose();
      this.mirrorMesh.geometry.dispose();
      this.mirrorMesh = null;
    }
    this.buildMirror();
  }

  enableMonitorCapture(os) {
    if (!this.monitorScreen) return;
    const THREE = this.THREE;

    const ps = this.quality === "ultra" ? 3 : 2;
    this.hologramRenderer = new HologramRenderer(ps);
    const canvas = this.hologramRenderer.canvas;

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: 0x6688aa,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    });
    this.monitorScreen.material = material;

    this.hologramRenderer.onDraw = () => {
      texture.needsUpdate = true;
    };
    this.hologramRenderer.start(os);
  }

  disableMonitorCapture() {
    if (this.hologramRenderer) {
      this.hologramRenderer.stop();
      this.hologramRenderer = null;
    }
  }

  onUpdate(callback) {
    this.updateHooks.push(callback);
  }

  onRender(callback) {
    this.renderHooks.push(callback);
  }

  animate() {
    if (!this.running) return;
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    if (this.player) this.player.update();

    for (const hook of this.updateHooks) {
      hook(delta);
    }

    if (this.hologramGroup) {
      if (!this.hologramFrozen) {
        this.hologramTime += delta;
        const floatOffset = Math.sin(this.hologramTime * 0.8) * 0.04;
        this.hologramGroup.position.y = this.hologramBaseY + floatOffset;
      }
    }

    this.composer.render();

    for (const hook of this.renderHooks) {
      hook();
    }
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
  }

  getCameraPosition() {
    return this.camera.position;
  }

  setCameraPosition(x, y, z) {
    this.camera.position.set(x, y, z);
  }

  registerObject(mesh, title, interactive) {
    mesh.userData.title = title;
    if (!mesh.userData.objectId) {
      mesh.userData.objectId = title.toLowerCase().replace(/\s+/g, "");
    }
    this.roomObjects.push(mesh);
    this.allMeshes.push(mesh);
    if (interactive) {
      mesh.userData.interactive = true;
      this.interactiveObjects.push(mesh);
    }
  }

  getAllMeshes() {
    return this.allMeshes;
  }

  getInteractiveObjects() {
    return this.interactiveObjects;
  }

  collectWAILAMeshes() {
    this.wailaMeshes = [];
    this.scene.traverse((child) => {
      if (
        child.isMesh &&
        child.userData.title &&
        child.userData.objectId !== "room" &&
        child.userData.objectId !== "floor" &&
        !child.userData.title.startsWith("Hologram") &&
        !child.userData.title.startsWith("Ambient Occlusion")
      ) {
        this.wailaMeshes.push(child);
      }
    });
  }

  toggleCeiling(visible) {
    if (this.ceilingMesh) {
      this.ceilingMesh.visible = visible;
    }
    if (this.ceilingLight) {
      this.ceilingLight.visible = visible;
    }
  }

  getColliders() {
    return this.colliders;
  }

  setBloomEnabled(enabled) {
    this.bloomPass.enabled = enabled;
  }

  setShadowsEnabled(enabled) {
    this.renderer.shadowMap.enabled = enabled;
    if (!enabled) {
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  setQuality(level) {
    const THREE = this.THREE;
    const isUltra = level === "ultra";
    const isHigh = level === "high" || isUltra;
    const isLow = level === "low";

    if (this.monitorScreen) {
      this.monitorScreen.material.color.setHex(isUltra ? 0x557799 : isHigh ? 0x5a7799 : 0x6688aa);
    }
    const mirrorRes = isLow ? 256 : isUltra ? 2048 : isHigh ? 1024 : 512;
    if (mirrorRes !== this.mirrorRes) {
      this.mirrorRes = mirrorRes;
      this.rebuildMirror();
    }
    this.bloomPass.strength = isUltra ? 0.5 : 0.4;
    this.bloomPass.radius = isUltra ? 0.25 : 0.2;
    this.bloomPass.threshold = isUltra ? 0.08 : 0.1;
    this.renderer.shadowMap.type = isLow ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMappingExposure = isLow ? 1.5 : isUltra ? 1.6 : isHigh ? 1.5 : 1.2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLow ? 1 : 2));
    this.resize();

    const shadowRes = isLow ? 128 : isUltra ? 4096 : isHigh ? 2048 : 256;
    if (this.keyLight) {
      this.keyLight.shadow.mapSize.width = shadowRes;
      this.keyLight.shadow.mapSize.height = shadowRes;
      this.keyLight.shadow.camera.near = 0.2;
      this.keyLight.shadow.camera.far = isLow ? 15 : isUltra ? 6 : isHigh ? 8 : 15;
      this.keyLight.shadow.camera.left = -4;
      this.keyLight.shadow.camera.right = 4;
      this.keyLight.shadow.camera.top = 4;
      this.keyLight.shadow.camera.bottom = -4;
      this.keyLight.shadow.normalBias = isLow ? 0 : isUltra ? 0.03 : isHigh ? 0.02 : 0;
      if (this.keyLight.shadow.map) this.keyLight.shadow.map.dispose();
      this.keyLight.shadow.map = null;
    }
    if (this.ceilingLight) {
      this.ceilingLight.shadow.mapSize.width = shadowRes;
      this.ceilingLight.shadow.mapSize.height = shadowRes;
      this.ceilingLight.shadow.camera.near = 0.2;
      this.ceilingLight.shadow.camera.far = isLow ? 10 : isUltra ? 4 : isHigh ? 5 : 8;
      this.ceilingLight.shadow.camera.fov = isLow ? 90 : isUltra ? 50 : isHigh ? 60 : 90;
      this.ceilingLight.shadow.normalBias = isLow ? 0 : isUltra ? 0.03 : isHigh ? 0.02 : 0;
      if (this.ceilingLight.shadow.map) this.ceilingLight.shadow.map.dispose();
      this.ceilingLight.shadow.map = null;
    }
    if (this.moonSpot) {
      this.moonSpot.shadow.mapSize.width = isLow ? 256 : isUltra ? 8192 : isHigh ? 4096 : 512;
      this.moonSpot.shadow.mapSize.height = isLow ? 256 : isUltra ? 8192 : isHigh ? 4096 : 512;
      this.moonSpot.shadow.camera.near = 0.2;
      this.moonSpot.shadow.camera.far = isLow ? 15 : isUltra ? 6 : isHigh ? 8 : 15;
      this.moonSpot.shadow.camera.fov = isLow ? 45 : isUltra ? 25 : isHigh ? 30 : 45;
      this.moonSpot.shadow.normalBias = isLow ? 0 : isUltra ? 0.03 : isHigh ? 0.02 : 0;
      if (this.moonSpot.shadow.map) this.moonSpot.shadow.map.dispose();
      this.moonSpot.shadow.map = null;
    }

    this.renderer.shadowMap.needsUpdate = true;
    this.quality = level;
  }

  destroy() {
    this.running = false;
    this.disableMonitorCapture();
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
    if (this.bloomPass) {
      this.bloomPass = null;
    }
    for (const m of this.navArrowMeshes) {
      if (m.parent) m.parent.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        if (m.material.map) m.material.map.dispose();
        m.material.dispose();
      }
    }
    this.navArrowMeshes = [];
    this.updateHooks = [];
    this.renderHooks = [];
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.clock = null;
    this.monitorScreen = null;
    this.allMeshes = [];
    if (this.mirrorMesh) {
      this.scene.remove(this.mirrorMesh);
      const rt = this.mirrorMesh.getRenderTarget();
      if (rt) rt.dispose();
      this.mirrorMesh.material.dispose();
      this.mirrorMesh.geometry.dispose();
      this.mirrorMesh = null;
    }
    if (this.player) this.player.destroy();
    this.player = null;
  }
}
