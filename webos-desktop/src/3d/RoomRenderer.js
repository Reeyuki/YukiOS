import { HologramRenderer } from "./HologramRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

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
    this.bounds = { minX: -4, maxX: 4, minZ: -4, maxZ: 4 };
    this.running = false;
    this.monitorScreen = null;
    this.monitorCaptureTimer = null;
    this.hologramRenderer = null;
    this.navArrowMeshes = [];
    this.curtainGeos = [];
    this.dustMesh = null;
    this.dustPositions = null;
    this.dustVelocities = null;
    this.time = 0;
    this.hologramTime = 0;
    this.hologramGroup = null;
    this.hologramBaseY = 0;
    this.glowStripLight = null;
  }

  async init() {
    const THREE = await import("three");
    this.THREE = THREE;

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0618);
    this.scene.fog = new THREE.Fog(0x0e0618, 10, 22);

    this.camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 100);
    this.camera.position.set(0, 1.6, 2.5);
    this.camera.lookAt(0, 1.2, 0);

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

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      0.4,
      0.2,
      0.1
    );
    this.composer.addPass(this.bloomPass);

    this.clock = new THREE.Clock();

    this.buildRoom();
    this.setupLighting();
    this.buildSkybox();

    this.running = true;
    this.animate();
  }

  buildRoom() {
    const T = this.THREE;

    this.wallMat = new THREE.MeshStandardMaterial({
      color: 0x3d2840,
      roughness: 0.75,
      metalness: 0.05,
      side: T.DoubleSide
    });

    this.wallMeshes = [];

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), this.wallMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 3, 0);
    this.scene.add(ceiling);
    this.registerObject(ceiling, "Room");
    this.wallMeshes.push(ceiling);

    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), this.wallMat);
    frontWall.position.set(0, 1.5, -4);
    this.scene.add(frontWall);
    this.registerObject(frontWall, "Room");
    this.wallMeshes.push(frontWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), this.wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-4, 1.5, 0);
    this.scene.add(leftWall);
    this.registerObject(leftWall, "Room");
    this.wallMeshes.push(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), this.wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(4, 1.5, 0);
    this.scene.add(rightWall);
    this.registerObject(rightWall, "Room");
    this.wallMeshes.push(rightWall);

    const backWallShape = new THREE.Shape();
    backWallShape.moveTo(-4, 0);
    backWallShape.lineTo(4, 0);
    backWallShape.lineTo(4, 3);
    backWallShape.lineTo(-4, 3);
    backWallShape.lineTo(-4, 0);

    const winHalfW = 0.60;
    const winHalfH = 0.50;
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
      color: 0x1e1018,
      roughness: 0.75,
      metalness: 0.15
    });
    this.floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), this.floorMat);
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
    const legPositions = [[-0.85, 0.35, -0.55], [-0.85, 0.35, -1.45], [0.85, 0.35, -0.55], [0.85, 0.35, -1.45]];
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
      color: 0x222233,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x4422aa,
      emissiveIntensity: 0.15
    });

    const projectorBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.06, 16), projectorMat);
    projectorBase.position.y = 0.03;
    projectorBase.castShadow = true;
    hologramGroup.add(projectorBase);

    const projectorRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.008, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x8844ff, emissive: 0x8844ff, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.2 })
    );
    projectorRing.position.y = 0.065;
    projectorRing.rotation.x = Math.PI / 2;
    hologramGroup.add(projectorRing);

    const hologramScreenMat = new THREE.MeshStandardMaterial({
      color: 0x8844ff,
      emissive: 0x8844ff,
      emissiveIntensity: 0.04,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      roughness: 0.1,
      metalness: 0
    });
    const holoScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), hologramScreenMat);
    holoScreen.position.set(0, 0.8, 0);
    hologramGroup.add(holoScreen);
    this.monitorScreen = holoScreen;

    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x8844ff,
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
      color: 0x8844ff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.8, 1.2));
    const borderLine = new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({ color: 0x8844ff, transparent: true, opacity: 0.15, depthWrite: false }));
    borderLine.position.set(0, 0.8, 0);
    hologramGroup.add(borderLine);

    const cornerDots = [
      [-0.9, 0.6, 0], [0.9, 0.6, 0], [-0.9, -0.6, 0], [0.9, -0.6, 0]
    ];
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xaa66ff });
    for (const cd of cornerDots) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), dotMat);
      dot.position.set(cd[0], cd[1], cd[2]);
      hologramGroup.add(dot);
    }

    this.scene.add(hologramGroup);
    this.registerObject(projectorBase, "Monitor", true);

    {
      const as = 0.08;
      ["prev","next"].forEach(d=>{
        const c=document.createElement("canvas");
        c.width=30;c.height=30;
        const cx=c.getContext("2d");
        cx.fillStyle="rgba(136,68,255,0.15)";
        cx.beginPath();
        cx.arc(15,15,14,0,Math.PI*2);
        cx.fill();
        cx.fillStyle="rgba(200,180,255,0.55)";
        cx.beginPath();
        if(d==="prev"){cx.moveTo(20,8);cx.lineTo(10,15);cx.lineTo(20,22);}
        else{cx.moveTo(10,8);cx.lineTo(20,15);cx.lineTo(10,22);}
        cx.closePath();cx.fill();
        const tex=new THREE.CanvasTexture(c);
        tex.needsUpdate=true;
        const m=new THREE.Mesh(
          new THREE.PlaneGeometry(as,as),
          new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide})
        );
        m.position.set(d==="prev"?-0.95:0.95,0.8,0.02);
        m.userData.objectId="holoArrow"+(d==="prev"?"Prev":"Next");
        m.userData.interactive=true;
        hologramGroup.add(m);
        this.interactiveObjects.push(m);
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
    this.buildLightShaft();
    this.buildDustParticles();
    this.buildCornerAO();
    this.buildRugPattern();
    this.buildColorButton();

    this.bounds = { minX: -3.8, maxX: 3.8, minZ: -3.8, maxZ: 3.8 };

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

  buildDecor() {
  }

  buildChair() {
    const T = this.THREE;
    const fabricMat = new T.MeshStandardMaterial({ color: 0x1a0e1e, roughness: 0.85, metalness: 0 });
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

    this.scene.add(group);
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
      color: 0x1a0e22,
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
      color: 0x1a0e22,
      roughness: 0.4,
      metalness: 0.1
    });

    const handle = new T.Mesh(
      new T.TorusGeometry(0.025, 0.006, 8, 12, Math.PI),
      handleMat
    );
    handle.position.set(-0.55 + 0.035 + 0.025, 0.81 + 0.035, -0.55);
    handle.rotation.z = -Math.PI / 2;
    handle.castShadow = true;
    handle.receiveShadow = true;
    this.scene.add(handle);
    this.registerObject(handle, "Coffee Cup Handle");

    const liquidMat = new T.MeshStandardMaterial({
      color: 0x8844ff,
      emissive: 0x6633cc,
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
      color: 0x8844ff,
      transparent: true,
      opacity: 0.1,
      side: T.DoubleSide,
      depthWrite: false,
      blending: T.AdditiveBlending
    });

    for (let i = 0; i < 3; i++) {
      const steam = new T.Mesh(
        new T.PlaneGeometry(0.025, 0.035),
        steamMat
      );
      steam.position.set(
        -0.55 + (i - 1) * 0.025,
        0.81 + 0.09 + i * 0.02,
        -0.55
      );
      steam.rotation.x = (i - 1) * 0.1;
      steam.rotation.z = (i - 1) * 0.1;
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
      color: 0x442244,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.3,
      side: T.DoubleSide
    });

    const mount = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.02, 8), metalMat);
    mount.position.set(0, 2.99, -0.5);
    this.scene.add(mount);

    const cord = new T.Mesh(new T.CylinderGeometry(0.005, 0.005, 0.25, 4), metalMat);
    cord.position.set(0, 2.87, -0.5);
    this.scene.add(cord);

    const shade = new T.Mesh(new T.CylinderGeometry(0.12, 0.18, 0.15, 8, 1, true), glassMat);
    shade.position.set(0, 2.73, -0.5);
    this.scene.add(shade);

    const rimMat = new T.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.2 });
    const rim = new T.Mesh(new T.TorusGeometry(0.15, 0.006, 6, 16), rimMat);
    rim.position.set(0, 2.66, -0.5);
    rim.rotation.x = Math.PI / 2;
    this.scene.add(rim);

    const bulb = new T.Mesh(
      new T.SphereGeometry(0.035, 8, 8),
      new T.MeshBasicMaterial({ color: 0xffbb77 })
    );
    bulb.position.set(0, 2.7, -0.5);
    this.scene.add(bulb);

    const glowMat = new T.MeshBasicMaterial({ color: 0x8844ff, transparent: true, opacity: 0.1, side: T.DoubleSide });
    const glow = new T.Mesh(new T.PlaneGeometry(0.3, 0.3), glowMat);
    glow.position.set(0, 2.65, -0.5);
    this.scene.add(glow);

    this.ceilingLight = new T.SpotLight(0x8844ff, 0.6, 4, Math.PI / 4, 0.5, 1.5);
    this.ceilingLight.target.position.set(0, 0, -0.5);
    this.scene.add(this.ceilingLight.target);
    this.ceilingLight.castShadow = true;
    this.ceilingLight.shadow.mapSize.width = 512;
    this.ceilingLight.shadow.mapSize.height = 512;
    this.ceilingLight.shadow.bias = -0.002;
    this.ceilingLight.position.set(0, 2.65, -0.5);
    this.scene.add(this.ceilingLight);
  }

  buildCurtains() {
    const T = this.THREE;

    const fabricMat = new T.MeshStandardMaterial({
      color: 0x1a0a2a,
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
      this.curtainGeos.push({ geo, origPositions: Float32Array.from(geo.attributes.position.array) });

      const tieMat = new T.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.3 });
      const tie = new T.Mesh(new T.TorusGeometry(0.03, 0.004, 6, 8), tieMat);
      tie.position.set(xSign * 0.45, 1.1, 3.95);
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
    this.scene.add(rod);

    const finialMat = new T.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
    for (const sx of [-1, 1]) {
      const finial = new T.Mesh(new T.SphereGeometry(0.022, 6, 6), finialMat);
      finial.position.set(sx * 0.52, 2.04, 3.94);
      this.scene.add(finial);
    }
  }

  buildSkybox() {
    const T = this.THREE;

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#020008");
    grad.addColorStop(0.15, "#060010");
    grad.addColorStop(0.35, "#0a0218");
    grad.addColorStop(0.55, "#120520");
    grad.addColorStop(0.75, "#0e0318");
    grad.addColorStop(1, "#050108");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    const cx = 750;
    const cy = 90;

    const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 100);
    outerGlow.addColorStop(0, "rgba(120,20,20,0.1)");
    outerGlow.addColorStop(0.4, "rgba(80,10,15,0.06)");
    outerGlow.addColorStop(1, "rgba(30,0,5,0)");
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 100, 0, Math.PI * 2);
    ctx.fill();

    const midGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
    midGlow.addColorStop(0, "rgba(180,40,30,0.25)");
    midGlow.addColorStop(0.5, "rgba(120,20,15,0.1)");
    midGlow.addColorStop(1, "rgba(60,5,5,0)");
    ctx.fillStyle = midGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fill();

    const moonGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
    moonGrad.addColorStop(0, "rgba(200,160,140,0.95)");
    moonGrad.addColorStop(0.6, "rgba(170,80,60,0.9)");
    moonGrad.addColorStop(1, "rgba(120,30,20,0.8)");
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(80,10,10,0.6)";
    ctx.beginPath();
    ctx.arc(cx + 4, cy - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 6, cy + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 2, cy + 7, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(60,10,15,0.12)";
    ctx.beginPath();
    ctx.ellipse(350, 100, 160, 14, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(50,5,10,0.08)";
    ctx.beginPath();
    ctx.ellipse(700, 140, 130, 10, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(40,5,10,0.06)";
    ctx.beginPath();
    ctx.ellipse(150, 170, 100, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();

    const horizonY = 400;
    ctx.fillStyle = "#030106";
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 50);
    for (let x = 0; x <= 1024; x += 20) {
      const peak = horizonY + 40 + Math.sin(x * 0.007) * 35 + Math.sin(x * 0.019 + 2) * 18 + Math.sin(x * 0.04 + 5) * 8;
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(1024, 512);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#020105";
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 65);
    for (let x = 0; x <= 1024; x += 16) {
      const peak = horizonY + 55 + Math.sin(x * 0.013 + 1) * 22 + Math.sin(x * 0.033 + 3) * 12;
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(1024, 512);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();

    const drawDeadTree = (tx, ty, height, lean) => {
      ctx.strokeStyle = "#020105";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + lean * 0.3, ty - height * 0.4, tx + lean, ty - height);
      ctx.stroke();

      const branchCount = 2 + Math.floor(Math.random() * 3);
      for (let b = 0; b < branchCount; b++) {
        const by = ty - height * (0.35 + b * 0.18);
        const bx = tx + lean * (0.3 + b * 0.15);
        const bLen = 8 + Math.random() * 15;
        const bDir = b % 2 === 0 ? 1 : -1;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + bDir * bLen * 0.6, by - bLen * 0.5, bx + bDir * bLen, by - bLen * 0.8);
        ctx.stroke();

        if (Math.random() > 0.5) {
          const subLen = bLen * 0.5;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx + bDir * bLen * 0.6, by - bLen * 0.5);
          ctx.lineTo(bx + bDir * bLen * 0.6 + bDir * subLen, by - bLen * 0.5 - subLen * 0.6);
          ctx.stroke();
        }
      }
    };

    for (let i = 0; i < 8; i++) {
      const tx = 60 + i * 130 + Math.floor(Math.random() * 40);
      const ty = horizonY + 42 + Math.sin(tx * 0.007) * 35;
      const th = 30 + Math.random() * 40;
      const lean = (Math.random() - 0.5) * 12;
      drawDeadTree(tx, ty, th, lean);
    }

    for (let i = 0; i < 4; i++) {
      const tx = 180 + i * 220 + Math.floor(Math.random() * 60);
      const ty = horizonY + 56 + Math.sin(tx * 0.013 + 1) * 22;
      const th = 18 + Math.random() * 22;
      const lean = (Math.random() - 0.5) * 8;
      drawDeadTree(tx, ty, th, lean);
    }

    const texture = new T.CanvasTexture(canvas);

    const skyMat = new T.MeshBasicMaterial({
      map: texture,
      side: T.BackSide,
      fog: false
    });

    const skybox = new T.Mesh(new T.SphereGeometry(22, 32, 32), skyMat);
    skybox.position.set(0, 1.5, 0);
    this.scene.add(skybox);
  }

  buildDoor() {
    const T = this.THREE;
    const doorMat = new T.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 });
    const handleMat = new T.MeshStandardMaterial({ color: 0xccaaff, metalness: 0.8, roughness: 0.2 });

    const door = new T.Mesh(new T.BoxGeometry(0.05, 2.0, 0.8), doorMat);
    door.position.set(-3.97, 1.0, 1.5);
    this.scene.add(door);
    this.registerObject(door, "Door");

    const handle = new T.Mesh(new T.SphereGeometry(0.035, 8, 8), handleMat);
    handle.position.set(-3.97, 1.0, 1.9);
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
    const mat = new T.MeshStandardMaterial({ color: 0x2a1a1e, roughness: 0.6, metalness: 0.1 });
    const h = 0.08;

    const walls = [
      { pos: [0, h / 2, -3.96], rot: [0, 0, 0], w: 8 },
      { pos: [-3.96, h / 2, 0], rot: [0, Math.PI / 2, 0], w: 8 },
      { pos: [3.96, h / 2, 0], rot: [0, Math.PI / 2, 0], w: 8 },
    ];
    for (const w of walls) {
      const mesh = new T.Mesh(new T.BoxGeometry(w.w, h, 0.02), mat);
      mesh.position.set(...w.pos);
      mesh.rotation.set(...w.rot);
      this.scene.add(mesh);
    }

    const crown = new T.MeshStandardMaterial({ color: 0x2a1a1e, roughness: 0.5, metalness: 0.05 });
    const ch = 0.06;
    const crownWalls = [
      { pos: [0, 2.97, -3.96], w: 8 },
      { pos: [-3.96, 2.97, 0], w: 8, ry: Math.PI / 2 },
      { pos: [3.96, 2.97, 0], w: 8, ry: Math.PI / 2 },
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

    ctx.strokeStyle = "rgba(100,40,60,0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 256, Math.random() * 192);
      ctx.bezierCurveTo(
        Math.random() * 256, Math.random() * 192,
        Math.random() * 256, Math.random() * 192,
        Math.random() * 256, Math.random() * 192
      );
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(120,30,40,0.2)";
    ctx.beginPath();
    ctx.ellipse(128, 100, 40, 30, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(80,20,30,0.15)";
    ctx.beginPath();
    ctx.ellipse(100, 80, 25, 20, -0.5, 0, Math.PI * 2);
    ctx.fill();

    const tex = new T.CanvasTexture(canvas);
    const artMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.05 });

    const art = new T.Mesh(new T.PlaneGeometry(0.7, 0.5), artMat);
    art.position.set(-2.0, 1.8, -3.95);
    this.scene.add(art);
    this.registerObject(art, "Wall Painting");

    const frameMat = new T.MeshStandardMaterial({ color: 0x1a1018, roughness: 0.5, metalness: 0.2 });
    const fw = 0.74;
    const fh = 0.54;
    const fd = 0.025;
    const fb = 0.03;
    const frameParts = [
      { w: fw, h: fb, x: -2.0, y: 1.8 + fh / 2 - fb / 2, z: -3.94 },
      { w: fw, h: fb, x: -2.0, y: 1.8 - fh / 2 + fb / 2, z: -3.94 },
      { w: fb, h: fh - 2 * fb, x: -2.0 - fw / 2 + fb / 2, y: 1.8, z: -3.94 },
      { w: fb, h: fh - 2 * fb, x: -2.0 + fw / 2 - fb / 2, y: 1.8, z: -3.94 },
    ];
    for (const p of frameParts) {
      const m = new T.Mesh(new T.BoxGeometry(p.w, p.h, fd), frameMat);
      m.position.set(p.x, p.y, p.z);
      this.scene.add(m);
    }
  }

  buildLamp() {
    const T = this.THREE;
    const poleMat = new T.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 });
    const shadeMat = new T.MeshStandardMaterial({
      color: 0x3a1a28,
      roughness: 0.9,
      metalness: 0,
      side: T.DoubleSide
    });

    const base = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.02, 12), poleMat);
    base.position.set(0.85, 0.81, -1.0);
    this.scene.add(base);

    const pole = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.35, 6), poleMat);
    pole.position.set(0.85, 0.99, -1.0);
    this.scene.add(pole);

    const shade = new T.Mesh(new T.CylinderGeometry(0.08, 0.12, 0.12, 8, 1, true), shadeMat);
    shade.position.set(0.85, 1.19, -1.0);
    this.scene.add(shade);
    this.registerObject(shade, "Desk Lamp", true);
    shade.userData.tooltip = "Click to toggle lamp";

    this.lampBulb = new T.Mesh(
      new T.SphereGeometry(0.03, 8, 8),
      new T.MeshBasicMaterial({ color: 0xffcc88 })
    );
    this.lampBulb.position.set(0.85, 1.13, -1.0);
    this.scene.add(this.lampBulb);

    this.lampLight = new T.PointLight(0xffaa66, 1.2, 3, 2);
    this.lampLight.position.set(0.85, 1.15, -1.0);
    this.scene.add(this.lampLight);

    this.lampOn = true;
  }

  toggleLamp() {
    this.lampOn = !this.lampOn;
    if (this.lampOn) {
      this.lampLight.intensity = 1.2;
      this.lampBulb.material.color.setHex(0xffcc88);
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

  buildLightShaft() {
    const T = this.THREE;
    const count = 6;
    const group = new T.Group();
    group.position.set(0, 1.2, 3.3);
    group.rotation.x = -0.3;
    group.rotation.y = Math.PI;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI;
      const plane = new T.Mesh(
        new T.PlaneGeometry(1.3, 2.6),
        new T.MeshBasicMaterial({
          color: 0xaa5544,
          transparent: true,
          opacity: 0.025,
          side: T.DoubleSide,
          depthWrite: false,
          blending: T.AdditiveBlending
        })
      );
      plane.rotation.z = angle;
      group.add(plane);
    }

    const glowMat = new T.MeshBasicMaterial({
      color: 0xcc6644,
      transparent: true,
      opacity: 0.04,
      side: T.DoubleSide,
      depthWrite: false,
      blending: T.AdditiveBlending
    });
    const glow = new T.Mesh(new T.PlaneGeometry(1.6, 2.8), glowMat);
    glow.position.set(0, 0, 0.15);
    group.add(glow);

    this.scene.add(group);
  }

  buildDustParticles() {
    const T = this.THREE;
    const count = 200;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 7;
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
      color: 0xccaaaa,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: T.DoubleSide
    });
    const instancedMesh = new T.InstancedMesh(geo, mat, count);
    const dummyMatrix = new T.Matrix4();
    for (let i = 0; i < count; i++) {
      dummyMatrix.makeTranslation(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      );
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
      { pos: [-3.98, 1.5, -3.98], ry: Math.PI / 4 },
      { pos: [3.98, 1.5, -3.98], ry: -Math.PI / 4 },
      { pos: [-3.98, 1.5, 3.98], ry: -Math.PI / 4 },
      { pos: [3.98, 1.5, 3.98], ry: Math.PI / 4 },
    ];
    for (const c of corners) {
      const plane = new T.Mesh(new T.PlaneGeometry(0.6, 3), aoMat);
      plane.position.set(...c.pos);
      plane.rotation.y = c.ry;
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
      { pos: [0, 0.15, -3.98], w: 8 },
      { pos: [-3.98, 0.15, 0], w: 8, ry: Math.PI / 2 },
      { pos: [3.98, 0.15, 0], w: 8, ry: Math.PI / 2 },
    ];
    for (const b of baseWalls) {
      const strip = new T.Mesh(new T.PlaneGeometry(b.w, 0.3), baseAOMat);
      strip.position.set(...b.pos);
      if (b.ry) strip.rotation.y = b.ry;
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

    ctx.strokeStyle = "rgba(80,30,60,0.25)";
    ctx.lineWidth = 1;
    const cx = 128, cy = 85;
    for (let r = 10; r < 80; r += 8) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(60,20,50,0.2)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 60;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.65);
      ctx.lineTo(cx + Math.cos(angle) * (dist + 5), cy + Math.sin(angle) * (dist + 5) * 0.65);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(100,40,70,0.15)";
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
      color: 0x8844ff,
      transparent: true,
      opacity: 0.5
    });
    const glow = new T.Mesh(new T.BoxGeometry(1.6, 0.01, 0.04), glowMat);
    glow.position.set(0, 0.12, -0.55);
    this.scene.add(glow);
    this.registerObject(glow, "Glow Strip");

    this.glowStripLight = new T.PointLight(0x8844ff, 0.25, 1.5, 1);
    this.glowStripLight.position.set(0, 0.08, -0.55);
    this.scene.add(this.glowStripLight);
  }

  buildColorButton() {
    const T = this.THREE;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff4444"; ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = "#44ff44"; ctx.fillRect(32, 0, 32, 32);
    ctx.fillStyle = "#4444ff"; ctx.fillRect(0, 32, 32, 32);
    ctx.fillStyle = "#ffaa00"; ctx.fillRect(32, 32, 32, 32);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(canvas);

    const mat = new T.MeshStandardMaterial({
      map: tex,
      roughness: 0.3,
      metalness: 0.05,
      emissive: 0x8844ff,
      emissiveIntensity: 0.08
    });
    const btn = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.018, 16), mat);
    btn.position.set(-0.35, 0.805, -0.7);
    btn.userData.objectId = "colorPickerButton";
    this.scene.add(btn);
    this.registerObject(btn, "ColorPicker", true);
  }

  setupLighting() {
    const T = this.THREE;

    this.hemiLight = new THREE.HemisphereLight(0x3a1830, 0x0a0410, 0.4);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0x200c18, 0.45);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0x6a3858, 0.6);
    this.keyLight.position.set(1, 5, 4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 512;
    this.keyLight.shadow.mapSize.height = 512;
    this.keyLight.shadow.bias = -0.001;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0x4a1840, 0.25);
    this.fillLight.position.set(-3, 2, -2);
    this.scene.add(this.fillLight);

    this.moonSpot = new THREE.SpotLight(0xaa5544, 3.0, 10, 0.45, 0.6, 1.2);
    this.moonSpot.position.set(0, 2.2, 5.5);
    this.moonSpot.target.position.set(0, 0.5, -1);
    this.moonSpot.castShadow = true;
    this.moonSpot.shadow.mapSize.width = 512;
    this.moonSpot.shadow.mapSize.height = 512;
    this.moonSpot.shadow.bias = -0.002;
    this.scene.add(this.moonSpot);
    this.scene.add(this.moonSpot.target);

    this.moonBeam = new THREE.PointLight(0x663328, 0.8, 8, 1.5);
    this.moonBeam.position.set(0, 1.5, 2);
    this.scene.add(this.moonBeam);

    this.windowGlow = new THREE.PointLight(0x552030, 0.4, 5, 2);
    this.windowGlow.position.set(0, 1.5, 3.5);
    this.scene.add(this.windowGlow);

    this.isDay = false;
  }

  toggleDayNight() {
    this.isDay = !this.isDay;
    if (this.isDay) {
      this.hemiLight.color.setHex(0x87ceeb);
      this.hemiLight.groundColor.setHex(0x554433);
      this.hemiLight.intensity = 0.5;
      this.ambientLight.color.setHex(0x6060a0);
      this.ambientLight.intensity = 0.55;
      this.keyLight.color.setHex(0xffeecc);
      this.keyLight.intensity = 1.0;
      this.fillLight.color.setHex(0x8899ff);
      this.fillLight.intensity = 0.35;
      this.moonSpot.intensity = 0.1;
      this.moonBeam.intensity = 0;
      this.windowGlow.color.setHex(0xaaccee);
      this.windowGlow.intensity = 0.5;
      if (this.scene) {
        this.scene.background.setHex(0x2a1840);
        this.scene.fog.color.setHex(0x2a1840);
      }
      this.renderer.toneMappingExposure = 1.5;
    } else {
      this.hemiLight.color.setHex(0x3a1830);
      this.hemiLight.groundColor.setHex(0x0a0410);
      this.hemiLight.intensity = 0.4;
      this.ambientLight.color.setHex(0x200c18);
      this.ambientLight.intensity = 0.45;
      this.keyLight.color.setHex(0x6a3858);
      this.keyLight.intensity = 0.6;
      this.fillLight.color.setHex(0x4a1840);
      this.fillLight.intensity = 0.25;
      this.moonSpot.intensity = 3.0;
      this.moonBeam.intensity = 0.8;
      this.windowGlow.color.setHex(0x552030);
      this.windowGlow.intensity = 0.4;
      if (this.scene) {
        this.scene.background.setHex(0x0e0618);
        this.scene.fog.color.setHex(0x0e0618);
      }
      this.renderer.toneMappingExposure = 1.2;
    }
  }

  enableMonitorCapture(os) {
    if (!this.monitorScreen) return;
    const T = this.THREE;

    this.hologramRenderer = new HologramRenderer();
    const canvas = this.hologramRenderer.canvas;

    const texture = new T.CanvasTexture(canvas);
    texture.minFilter = T.LinearFilter;
    texture.magFilter = T.LinearFilter;

    this.monitorScreen.material = new T.MeshStandardMaterial({
      map: texture,
      emissive: 0x8844ff,
      emissiveIntensity: 0.04,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      roughness: 0.1,
      metalness: 0
    });

    this.hologramRenderer.onDraw = () => { texture.needsUpdate = true; };
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

    for (const hook of this.updateHooks) {
      hook(delta);
    }

    this.hologramTime += delta;
    if (this.hologramGroup) {
      const floatOffset = Math.sin(this.hologramTime * 0.8) * 0.04;
      this.hologramGroup.position.y = this.hologramBaseY + floatOffset;
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
      mesh.userData.objectId = title.toLowerCase().replace(/\s+/g, '');
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

  getColliders() {
    return this.colliders;
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
  }
}
