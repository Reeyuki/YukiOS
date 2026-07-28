import "../styles/room3d.css";
import { BaseApp, os, StorageKeys } from "../framework.js";
import { $ } from "../shared/domUtils.js";
import { gameBridge } from "../game-bridge/GameBridge.js";
import { RoomRenderer } from "../3d/RoomRenderer.js";
import { FPSControls } from "../3d/FPSControls.js";
import { RoomInteraction } from "../3d/RoomInteraction.js";
import { GameCaseManager } from "../3d/GameCaseManager.js";
import { WallDisplay } from "../3d/WallDisplay.js";
import { RainbowBall } from "../3d/RainbowBall.js";
import { ShelfManager } from "../3d/ShelfManager.js";
import { FurnitureManager } from "../3d/FurnitureManager.js";
import { DecorManager } from "../3d/DecorManager.js";
import { CanvasOverlay } from "../3d/CanvasOverlay.js";
import { SystemUtilities } from "../system.js";
import { GameState } from "../3d/GameState.js";
import { EditorManager } from "../3d/editor/EditorManager.js";
import { EditorUI } from "../3d/editor/EditorUI.js";
import { SceneSerializer } from "../3d/editor/SceneSerializer.js";
import { SceneAudio } from "../3d/SceneAudio.js";
import { Achievements } from "../achievements.js";
import { RoomAchievements } from "../3d/RoomAchievements.js";

const ACHIEVEMENT_GATED = {
  "floor-lamp": Achievements.FirstGame,
  painting: Achievements.GameHopper,
  "wall-clock": Achievements.TerminalUser,
  rug: Achievements.NightPerson,
  "gold-trophy": Achievements.GameHopperMega,
  "neon-sign": Achievements.Completionist
};

const rmStore = {
  storagePrefix: "rm3d_",
  get(k, d) {
    try {
      const v = os.storage.get(this.storagePrefix + k);
      return v !== null && v !== undefined ? v : d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      os.storage.set(this.storagePrefix + k, v);
    } catch {}
  }
};

export class Room3DApp extends BaseApp {
  constructor(services) {
    super(services);
    this.renderer = null;
    this.controls = null;
    this.interaction = null;
    this.gameCaseManager = null;
    this.shelfManager = null;
    this.furnitureManager = null;
    this.decorManager = null;
    this.rainbowBall = null;
    this.wallDisplay = null;
    this.THREE = null;
    this.running = false;
    this.systemOverlay = null;
    this.systemOnExit = null;
    this.overlay = null;
    this.crosshairEl = null;
    this.suppressPauseOnUnlock = false;
    this.gameState = null;
    this.audio = null;
  }

  getLockedItems() {
    const achApp = this.services ? this.services.achievementsApp : null;
    if (!achApp) return Object.keys(ACHIEVEMENT_GATED);
    return Object.keys(ACHIEVEMENT_GATED).filter((id) => !achApp.isUnlocked(ACHIEVEMENT_GATED[id]));
  }

  async open(opts = {}) {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:999999;background:#000;opacity:0;transition:opacity 0.4s ease";
    document.body.appendChild(overlay);

    SystemUtilities.disableVantaWallpaper();
    $("#desktop").style.display = "none";

    this.buildUI(overlay);
    const container = overlay.querySelector("#room3d-canvas");
    await this.init3D(container);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });

    this.running = true;
    this.openOverlay = overlay;

    window.room3d = {
      renderer: this.renderer,
      controls: this.controls,
      bridge: gameBridge,
      close: () => this.closeRoom()
    };
  }

  async launchSystemMode(onExit) {
    this.systemOnExit = onExit;

    const overlay = document.createElement("div");
    overlay.id = "room3d-system-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:999999;background:#000;opacity:0;transition:opacity 0.4s ease";
    document.body.appendChild(overlay);

    SystemUtilities.disableVantaWallpaper();
    $("#desktop").style.display = "none";

    this.buildUI(overlay);
    const container = overlay.querySelector("#room3d-canvas");
    await this.init3D(container);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });

    this.running = true;
    this.systemOverlay = overlay;

    window.room3d = {
      renderer: this.renderer,
      controls: this.controls,
      bridge: gameBridge,
      close: () => {
        if (this.systemOnExit) this.systemOnExit();
      }
    };
  }

  buildUI(root) {
    root.innerHTML = `
      <div class="room3d-canvas-container" id="room3d-canvas"></div>
      <div class="room3d-crosshair" id="room3d-crosshair"></div>
      <canvas class="room3d-overlay" id="room3d-overlay"></canvas>
      <div class="room3d-editor-overlay" id="room3d-editor-overlay">
        <canvas class="room3d-editor-canvas" id="room3d-editor-canvas"></canvas>
      </div>
      <div class="room3d-hint" id="room3d-hint">
        <span class="room3d-hint-key">G</span> Sort  <span class="room3d-hint-key">Tab</span> Edit  <span class="room3d-hint-key">N</span> Day/Night
      </div>
      <div class="room3d-launch-hint" id="room3d-launch-hint">
        <span class="room3d-hint-key">F</span> Launch
      </div>
      <div class="room3d-wastebin-hint" id="room3d-wastebin-hint">
        <span class="room3d-hint-key">E</span> Trash
      </div>
      <div class="room3d-editor-hint" id="room3d-editor-hint">
        <span class="room3d-hint-key">WASD</span> Move <span class="room3d-hint-key">Space</span> Ascend <span class="room3d-hint-key">C</span> Descend <span class="room3d-hint-key">G</span> Snap <span class="room3d-hint-key">R</span> Rotate <span class="room3d-hint-key">Ctrl</span> HoldSnap
      </div>
    `;
  }

  async init3D(container) {
    const root = container.parentElement;
    this.crosshairEl = root.querySelector("#room3d-crosshair");
    this.hintEl = root.querySelector("#room3d-hint");
    this.wastebinHintEl = root.querySelector("#room3d-wastebin-hint");
    this.launchHintEl = root.querySelector("#room3d-launch-hint");
    this.rotateHintEl = null;

    this.renderer = new RoomRenderer(container);
    await this.renderer.init();
    const THREE = this.renderer.THREE;

    this.controls = new FPSControls(
      this.renderer.camera,
      this.renderer.renderer.domElement,
      this.renderer.bounds,
      this.renderer.getColliders()
    );
    this.controls.onLockStateChange = (locked) => {
      if (locked) {
        this.crosshairEl.classList.add("room3d-crosshair--visible");
      } else {
        this.crosshairEl.classList.remove("room3d-crosshair--visible");
        if (!this.suppressPauseOnUnlock && this.overlay && !this.overlay.isVisible() && this.running) {
          this.overlay.show("pause");
        }
        this.suppressPauseOnUnlock = false;
      }
    };
    this.controls.start(THREE);

    this.ctrlHeld = false;

    this.audio = new SceneAudio();
    this.audio.setCameraGetter(() => this.renderer.camera);
    this.audio.setMasterVolume(0.4);

    const DEFAULT_ROOM_SETTINGS = {
      visuals: { dayNight: false, lamp: true },
      audio: { masterVolume: 0.4, ui: true, footstep: true, ambient: true },
      gameplay: { genreHints: true, timer: true },
      editor: { snap: false, snapSize: 0.25 },
      graphics: { quality: "medium", bloom: true, shadows: true, dust: true, curtainSway: true }
    };
    this.roomSettings = { ...DEFAULT_ROOM_SETTINGS, ...rmStore.get("settings", {}) };
    for (const k of Object.keys(DEFAULT_ROOM_SETTINGS)) {
      this.roomSettings[k] = { ...DEFAULT_ROOM_SETTINGS[k], ...this.roomSettings[k] };
    }
    this.audio.setUIEnabled(this.roomSettings.audio.ui);
    this.audio.setFootstepEnabled(this.roomSettings.audio.footstep);
    this.audio.setAmbientEnabled(this.roomSettings.audio.ambient);
    this.audio.setMasterVolume(this.roomSettings.audio.masterVolume);
    if (this.roomSettings.visuals.dayNight && this.renderer) this.renderer.toggleDayNight();
    if (this.renderer) this.renderer.toggleCeiling(this.roomSettings.visuals.lamp);
    if (this.renderer) {
      this.renderer.setBloomEnabled(this.roomSettings.graphics.bloom);
      this.renderer.setShadowsEnabled(this.roomSettings.graphics.shadows);
      this.renderer.setQuality(this.roomSettings.graphics.quality);
    }

    this.renderer.onUpdate((delta) => {
      if (this.controls) this.controls.update(delta);
    });

    this.interaction = new RoomInteraction(this.renderer, this.controls);
    await this.interaction.init(THREE);
    this.interaction.onLaunchGame = (gameId) => os.app.launch(gameId);
    this.setupInteractionCallbacks();

    const overlayCanvas = root.querySelector("#room3d-overlay");
    this.overlay = new CanvasOverlay(overlayCanvas, {
      onAction: (btn) => this.handleHUDAction(btn)
    });
    this.overlay.setSettings(this.roomSettings);
    const origShow = this.overlay.show.bind(this.overlay);
    this.overlay.show = (mode) => {
      this.hideHint();
      origShow(mode);
    };

    this.gameCaseManager = new GameCaseManager(
      this.renderer.scene,
      this.renderer.bounds,
      this.interaction,
      this.renderer.getColliders()
    );
    const savedState = rmStore.get("bookPositions") || {};
    const savedPositions = savedState.positions || {};
    const savedShelves = savedState.shelves || {};
    await this.gameCaseManager.init(THREE, savedPositions, savedShelves);
    this.interaction.setGameCases(this.gameCaseManager.getGameCases());

    const savedBallPos = rmStore.get("ballPosition");
    const ballPos = savedBallPos
      ? new THREE.Vector3(savedBallPos.x, savedBallPos.y, savedBallPos.z)
      : new THREE.Vector3(0.4, 0.95, -0.6);
    this.rainbowBall = new RainbowBall(THREE, this.renderer.scene);
    this.rainbowBall.init(ballPos);
    this.gameCaseManager.physics.world.addBody(this.rainbowBall.body);
    this.gameCaseManager.ballBody = this.rainbowBall.body;
    this.interaction.setBallMesh(this.rainbowBall.mesh, this.rainbowBall.body);

    if (this.renderer.player && this.renderer.player.leftHand && this.renderer.player.rightHand) {
      this.interaction.setHandMeshes(this.renderer.player.leftHand, this.renderer.player.rightHand);
    }

    this.shelfManager = new ShelfManager(THREE, this.renderer.scene, this.gameCaseManager.physics.world);
    this.shelfManager.build(savedShelves);
    this.gameCaseManager.placeShelvedCases(this.shelfManager);
    this.interaction.setShelfManager(this.shelfManager);
    this.interaction.setGameCaseManager(this.gameCaseManager);

    this.gameState = new GameState();
    this.roomAchievements = new RoomAchievements();
    this.interaction.setGameState(this.gameState);
    this.overlay.setGameState(this.gameState);

    this.furnitureManager = new FurnitureManager(THREE, this.renderer.scene, this.renderer, this.interaction, () => {
      const fp = this.furnitureManager.getPositions();
      rmStore.set("furniturePositions", fp);
    });
    this.interaction.setFurnitureManager(this.furnitureManager);

    const savedFurniturePos = rmStore.get("furniturePositions");
    if (savedFurniturePos) {
      this.furnitureManager.restorePositions(savedFurniturePos);
    }

    if (this.renderer.chairGroup) {
      this.furnitureManager.registerFurniture(
        "wooden-chair-1",
        this.renderer.chairGroup,
        this.renderer.chairGroup.position.clone(),
        { yOffset: 0.65 }
      );
    }

    this.decorManager = new DecorManager(THREE, this.renderer.scene, this.renderer);
    this.decorManager.defineDefaultItems();
    this.decorManager.buildAll();
    for (const item of this.decorManager.getAllItems()) {
      this.decorManager.spawn(item.id);
    }
    const savedDecorStates = rmStore.get("activeDecorations");
    if (savedDecorStates) {
      this.decorManager.restoreStates(savedDecorStates);
    }

    const floorLampItem = this.decorManager.getAllItems().find((i) => i.id === "floor-lamp");
    if (floorLampItem) {
      floorLampItem.mesh.traverse((child) => {
        if (child.isMesh && child.userData.interactive && child.userData.objectId) {
          this.renderer.interactiveObjects.push(child);
        }
      });
    }

    this.sceneSerializer = new SceneSerializer();
    const editorCanvas = root.querySelector("#room3d-editor-canvas");
    this.editorUI = new EditorUI(editorCanvas, {
      onAction: (btn) => this.handleEditorAction(btn)
    });
    this.editorManager = new EditorManager(
      THREE,
      this.renderer.scene,
      this.renderer.camera,
      this.renderer.renderer.domElement
    );
    this.editorManager.setControls(this.controls);
    this.editorManager.furnitureManager = this.furnitureManager;
    this.editorManager.decorManager = this.decorManager;
    this.interaction.setEditorManager(this.editorManager);
    this.interaction.setAudio(this.audio);
    this.editorManager.setAudio(this.audio);
    this.editorManager.snapEnabled = this.roomSettings.editor.snap;
    this.editorManager.snapSize = this.roomSettings.editor.snapSize;
    this.interaction.onHoverChange = (target) => {
      if (this.audio) this.audio.checkHover(target);
    };

    const savedLayout = this.sceneSerializer.deserialize();
    if (savedLayout) {
      this.sceneSerializer.apply(savedLayout, this.furnitureManager, this.decorManager);
    }

    this.editorManager.onModeChange = (active) => {
      if (active) {
        this.triggerRoomAchievement("interior_designer");
        this.hideHint();
        this.savedCameraPos = this.renderer.camera.position.clone();
        this.savedCameraYaw = this.controls.yaw;
        this.savedCameraPitch = this.controls.pitch;
        if (this.controls && this.controls.isLocked) this.controls.unlock();
        const topDownPos = new THREE.Vector3(0, 6.5, 0.5);
        const topDownLookAt = new THREE.Vector3(0, 0, 0);
        this.controls.animateCamera(topDownPos, topDownLookAt, 0.6, () => {
          this.controls.yaw = Math.PI;
          this.controls.pitch = -Math.PI / 2;
        });
        if (this.renderer) this.renderer.toggleCeiling(false);
        const overlayEl = root.querySelector("#room3d-editor-overlay");
        if (overlayEl) overlayEl.classList.add("room3d-editor-overlay--active");
        this.editorManager.setCollisionObjects(this.getEditorColliders());
        this.editorUI.setLockedItems(this.getLockedItems());
        this.editorUI.show(
          this.editorManager.equippedItem ? this.editorManager.equippedItem.id : null,
          this.editorManager.snapEnabled
        );
        this.editorUI.render();
        const editHint = root.querySelector("#room3d-editor-hint");
        if (editHint) editHint.classList.add("room3d-editor-hint--visible");
      } else {
        if (this.editorManager.equippedItem) this.editorManager.unequip();
        if (this.renderer) this.renderer.toggleCeiling(true);
        const editHint = root.querySelector("#room3d-editor-hint");
        if (editHint) editHint.classList.remove("room3d-editor-hint--visible");
        const overlayEl = root.querySelector("#room3d-editor-overlay");
        if (overlayEl) overlayEl.classList.remove("room3d-editor-overlay--active");
        this.editorUI.hide();
        if (this.savedCameraPos) {
          const fwd = new THREE.Vector3(0, 0, -1);
          fwd.x = -Math.sin(this.savedCameraYaw) * Math.cos(this.savedCameraPitch);
          fwd.y = Math.sin(this.savedCameraPitch);
          fwd.z = -Math.cos(this.savedCameraYaw) * Math.cos(this.savedCameraPitch);
          const lookAtTarget = this.savedCameraPos.clone().add(fwd.multiplyScalar(10));
          this.controls.animateCamera(this.savedCameraPos, lookAtTarget, 0.5, () => {
            this.controls.yaw = this.savedCameraYaw;
            this.controls.pitch = this.savedCameraPitch;
            const V = THREE.Vector3;
            const Q = THREE.Quaternion;
            const qx = new Q();
            const qy = new Q();
            qx.setFromAxisAngle(new V(1, 0, 0), this.controls.pitch);
            qy.setFromAxisAngle(new V(0, 1, 0), this.controls.yaw);
            this.controls.camera.quaternion.copy(qy.multiply(qx));
            this.controls.lock();
          });
        }
        this.showHint();
      }
    };

    this.editorManager.onSelectionChange = (mesh, info) => {
      if (mesh && info) {
        const pos = mesh.position;
        const rot = mesh.rotation;
        this.editorUI.setSelection(
          info.id,
          info.manager,
          { x: pos.x, y: pos.y, z: pos.z },
          THREE.MathUtils.radToDeg(rot.y)
        );
      } else {
        this.editorUI.clearSelection();
      }
    };

    this.registerNewDecorBuilders();
    this.editorUI.setLockedItems(this.getLockedItems());

    const rendererDom = this.renderer.renderer.domElement;
    this.editorMouseNDC = { x: 0, y: 0 };

    rendererDom.addEventListener("mousemove", (e) => {
      if (!this.editorManager || !this.editorManager.isEditActive()) return;
      this.editorMouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.editorMouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    rendererDom.addEventListener("click", (e) => {
      if (!this.editorManager || !this.editorManager.isEditActive()) return;
      if (this.editorManager.transformControls && this.editorManager.transformControls.dragging) return;

      const hit = this.editorUI.hitTest(e.clientX, e.clientY);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        this.editorUI.handleClick(e.clientX, e.clientY);
        return;
      }

      const THREE = this.editorManager.THREE;
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.renderer.camera);

      if (this.editorManager.equippedItem) {
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        const planeHit = raycaster.ray.intersectPlane(floorPlane, target);
        if (planeHit) {
          this.editorManager.placeAt(target);
          this.editorUI.show(
            this.editorManager.equippedItem ? this.editorManager.equippedItem.id : null,
            this.editorManager.snapEnabled
          );
          this.editorUI.render();
          if (this.saveRoomState) this.saveRoomState();
        }
        return;
      }

      const editableObjects = this.editorManager.getEditableObjects();
      const intersects = raycaster.intersectObjects(editableObjects, true);
      if (intersects.length > 0) {
        let target = intersects[0].object;
        while (target.parent && !editableObjects.includes(target)) {
          target = target.parent;
        }
        const info = this.editorManager.getObjectInfo(target);
        if (info) {
          this.editorManager.select(target, info);
        }
      } else {
        this.editorManager.deselect();
      }
    });

    rendererDom.addEventListener("wheel", (e) => {
      if (!this.editorManager || !this.editorManager.isEditActive()) return;
      const hit = this.editorUI.hitTest(e.clientX, e.clientY);
      if (hit) {
        e.preventDefault();
        this.editorUI.handleWheel(e.deltaY);
      } else {
        e.preventDefault();
        const camera = this.renderer.camera;
        camera.position.y -= e.deltaY * 0.01;
        camera.position.y = Math.max(1.5, Math.min(15, camera.position.y));
      }
    });

    const savedWallColor = rmStore.get("wallColor");
    if (savedWallColor) this.renderer.setWallColor(savedWallColor);
    const savedFloorColor = rmStore.get("floorColor");
    if (savedFloorColor) this.renderer.setFloorColor(savedFloorColor);

    this.wallDisplay = new WallDisplay(
      this.gameCaseManager,
      (gameId) => {
        const gameCase = this.gameCaseManager.spawnFromCatalog(gameId);
        if (gameCase && this.interaction) {
          this.interaction.povGrabCase(gameCase);
        }
      },
      (gameId) => this.gameCaseManager.recoverFromTrash(gameId),
      THREE,
      this.renderer.scene,
      this.renderer.interactiveObjects
    );
    this.wallDisplay.open();

    this.interaction.register("wallPagePrev", () => {
      this.wallDisplay.prevPage();
      if (this.audio) this.audio.playHoloPage();
    });
    this.interaction.register("wallPageNext", () => {
      this.wallDisplay.nextPage();
      if (this.audio) this.audio.playHoloPage();
    });
    this.interaction.register("wallRecoverAll", () => {
      if (this.wallDisplay.handleRecoverAll) {
        this.wallDisplay.handleRecoverAll();
        if (this.audio) this.audio.playRecover();
      }
    });
    this.interaction.registerPrefix("wallCard_", (obj) => {
      const result = this.wallDisplay.handleCardClick(obj.userData.gameId);
      if (this.audio) this.audio.playHoloClick();
      return result;
    });
    this.interaction.registerPrefix("wallTab_", (obj) => {
      this.wallDisplay.handleTabClick(obj.userData.tabId);
      if (this.audio) this.audio.playTabSwitch();
    });

    this.interaction.onCatalogOpen = () => {
      this.wallDisplay.open();
      if (this.audio) this.audio.playSpawnFromCatalog();
    };

    this.interaction.onTrashRequest = (gameCase) => {
      this.interaction.releasePOVGrab();
      this.gameCaseManager.trashCase(gameCase);
    };

    this.renderer.onUpdate((delta) => {
      if (this.editorManager && this.editorManager.isEditActive()) {
        if (this.editorManager.equippedItem) {
          this.editorManager.updateGhostPosition(this.renderer.camera, this.editorMouseNDC);
        }
        const keys = this.controls.keys;
        if (keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.crouch) {
          const speed = 3 * delta;
          const cam = this.renderer.camera;
          if (keys.forward) cam.position.z -= speed;
          if (keys.backward) cam.position.z += speed;
          if (keys.left) cam.position.x -= speed;
          if (keys.right) cam.position.x += speed;
          if (keys.jump) cam.position.y += speed * 1.5;
          if (keys.crouch) cam.position.y -= speed * 1.5;
          cam.position.y = Math.max(0.5, Math.min(7, cam.position.y));
        }
        return;
      }
      if (!this.interaction || !this.gameCaseManager || !this.renderer) return;
      this.interaction.updateGrabbed();
      this.interaction.updateEGrabbed(this.renderer.camera);
      this.interaction.updateWastebinProximity(this.renderer.camera);
      if (this.wastebinHintEl) {
        this.wastebinHintEl.classList.toggle("room3d-wastebin-hint--visible", this.interaction.nearWastebin);
      }
      if (this.launchHintEl) {
        const showLaunch = !(this.gameState && this.gameState.active) && this.interaction.povGrabbedCase;
        this.launchHintEl.classList.toggle("room3d-launch-hint--visible", showLaunch);
      }
      if (this.audio && this.controls && this.controls.isLocked) {
        const moving =
          this.controls.keys.forward ||
          this.controls.keys.backward ||
          this.controls.keys.left ||
          this.controls.keys.right;
        const sprint = this.controls.keys.sprint || false;
        if (moving) {
          const now = performance.now();
          const interval = sprint ? 320 : 460;
          if (now - this.audio.footstepTimer > interval) {
            this.audio.playFootstep(sprint);
            this.audio.footstepTimer = now;
          }
        }
      }
      if (this.overlay && this.renderer && this.interaction) {
        this.interaction.updateWAILA(this.renderer.camera);
        this.overlay.setHoverTitle(this.interaction.wailaTitle);
      }
      if (this.gameState && this.gameState.active && this.overlay) {
        const held = this.interaction.povGrabbedCase;
        this.overlay.setHeldBookGenre(held ? held.genre : null);
      }
      this.gameCaseManager.update(delta);
      if (
        this.rainbowBall &&
        this.rainbowBall.body &&
        this.rainbowBall.mesh &&
        !this.interaction.grabbedBallMesh &&
        !this.interaction.ballGrabbed
      ) {
        this.rainbowBall.mesh.position.set(
          this.rainbowBall.body.position.x,
          this.rainbowBall.body.position.y,
          this.rainbowBall.body.position.z
        );
      }
      if (this.rainbowBall) {
        const t = performance.now() / 1000;
        this.rainbowBall.update(delta, t);
      }
      if (this.shelfManager) this.shelfManager.update(delta);
      if (this.gameState && this.gameState.active) {
        this.gameState.update(performance.now());
      }
      if (this.furnitureManager) {
        this.furnitureManager.updatePovGrabbed(this.renderer.camera);
      }

      this.renderer.time += delta;
      const t = this.renderer.time;

      if (this.roomSettings.graphics.dust && this.renderer.dustMesh && this.renderer.dustPositions) {
        const pos = this.renderer.dustPositions;
        const vel = this.renderer.dustVelocities;
        const dummyMatrix = new THREE.Matrix4();
        for (let i = 0; i < pos.length / 3; i++) {
          pos[i * 3] += Math.sin(t * vel[i * 3] + i * 0.7) * 0.0003;
          pos[i * 3 + 1] += Math.sin(t * vel[i * 3 + 1] + i * 1.3) * 0.0002;
          pos[i * 3 + 2] += Math.cos(t * vel[i * 3 + 2] + i * 0.9) * 0.0003;
          if (pos[i * 3 + 1] > 2.9) pos[i * 3 + 1] = 0.1;
          if (pos[i * 3 + 1] < 0.05) pos[i * 3 + 1] = 2.8;
          dummyMatrix.makeTranslation(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
          this.renderer.dustMesh.setMatrixAt(i, dummyMatrix);
        }
        this.renderer.dustMesh.instanceMatrix.needsUpdate = true;
      }

      if (this.renderer.ceilingLight) {
        this.renderer.ceilingLight.intensity =
          0.35 + Math.sin(t * 3.7) * 0.02 + Math.sin(t * 7.1) * 0.01 + Math.sin(t * 13) * 0.005;
      }

      if (this.roomSettings.graphics.curtainSway)
        for (const c of this.renderer.curtainGeos) {
          const pos = c.geo.attributes.position;
          const orig = c.origPositions;
          for (let i = 0; i < pos.count; i++) {
            const ox = orig[i * 3];
            const oy = orig[i * 3 + 1];
            const sway = Math.sin(t * 0.8 + oy * 3 + ox * 5) * 0.006;
            pos.setZ(i, orig[i * 3 + 2] + sway);
          }
          pos.needsUpdate = true;
        }
    });

    this.renderer.enableMonitorCapture(os);

    this.gameHudRaf = null;
    this.startGameMode = () => {
      if (this.gameState.active) return;
      this.hideHint();
      this.saveRoomState();
      if (this.audio) this.audio.playGameStart();
      this.gameState.start(20);
      this.gameCaseManager.startGameMode(this.gameState);
      this.shelfManager.setGameMode(true);
      this.overlay.show("gameHud");
      this.gameState.onUpdate = null;
      this.gameState.onCompletion = (results) => {
        this.triggerRoomAchievement("game_master");
        if (results.accuracy >= 100) this.triggerRoomAchievement("perfect_sort");
        if (this.gameState.elapsed < 120) this.triggerRoomAchievement("speed_shelver");
        if (this.controls && this.controls.isLocked) this.controls.unlock();
        this.overlay.show("completion");
        if (this.audio) this.audio.playGameComplete();
        const tickComplete = () => {
          if (!this.overlay || this.overlay.mode !== "completion") return;
          this.overlay.render();
          this.gameHudRaf = requestAnimationFrame(tickComplete);
        };
        this.gameHudRaf = requestAnimationFrame(tickComplete);
      };
      this.interaction.onCasePlaced = (gameCase, correct) => {
        this.overlay.showPlacementFeedback(correct);
      };
      const tickHud = () => {
        if (!this.gameState || (!this.gameState.active && !this.gameState.completed)) return;
        if (this.overlay && this.overlay.mode === "gameHud") this.overlay.render();
        this.gameHudRaf = requestAnimationFrame(tickHud);
      };
      this.gameHudRaf = requestAnimationFrame(tickHud);
    };

    this.endGameMode = () => {
      if (this.gameHudRaf) {
        cancelAnimationFrame(this.gameHudRaf);
        this.gameHudRaf = null;
      }
      if (!this.gameState.active && !this.gameState.completed) return;
      this.gameState.reset();
      this.shelfManager.setGameMode(false);
      this.gameCaseManager.setGameMode(false, null);
      this.overlay.hide();
      this.showHint();
    };

    this.triggerRoomAchievement = (id) => {
      const def = this.roomAchievements.trigger(id);
      if (def && this.overlay) {
        this.overlay.showAchievementToast(def.title, def.desc, def.rarity);
      }
    };

    this.showHint = () => {
      if (this.hintEl && this.gameState && !this.gameState.active) this.hintEl.classList.add("room3d-hint--visible");
    };

    this.hideHint = () => {
      if (this.hintEl) this.hintEl.classList.remove("room3d-hint--visible");
    };

    this.resizeObserver = new ResizeObserver(() => {
      if (this.renderer) this.renderer.resize();
    });
    this.resizeObserver.observe(container);

    this.saveRoomState = () => {
      try {
        if (!this.gameCaseManager) return;
        const positions = this.gameCaseManager.getPositions();
        const shelves = this.shelfManager ? this.shelfManager.getShelfAssignments() : {};
        rmStore.set("bookPositions", { positions, shelves });

        if (this.rainbowBall && this.rainbowBall.body) {
          const bp = this.rainbowBall.mesh.position;
          rmStore.set("ballPosition", { x: bp.x, y: bp.y, z: bp.z });
        }
        if (this.furnitureManager) {
          rmStore.set("furniturePositions", this.furnitureManager.getPositions());
        }
        if (this.decorManager) {
          rmStore.set("activeDecorations", this.decorManager.getActiveStates());
        }
        if (this.sceneSerializer && this.furnitureManager && this.decorManager) {
          this.sceneSerializer.serialize(this.furnitureManager, this.decorManager);
        }
      } catch (e) {
        /* ignore */
      }
    };

    this.autoSaveInterval = setInterval(() => {
      this.saveRoomState();
      if (this.audio) this.audio.playAutoSave();
    }, 30000);

    this.handleHUDAction = (btn) => {
      switch (btn.id) {
        case "resume":
          this.overlay.hide();
          if (this.gameState && this.gameState.active) {
            this.overlay.show("gameHud");
          }
          if (this.controls && !this.controls.isLocked) this.controls.lock();
          if (this.audio) this.audio.playClick();
          break;
        case "colors":
          this.overlay.show("colors");
          if (this.audio) this.audio.playToggleOn();
          break;
        case "exit":
          this.overlay.hide();
          if (this.audio) this.audio.playToggleOff();
          if (this.gameState && (this.gameState.active || this.gameState.completed)) {
            this.endGameMode();
          } else if (this.systemOnExit) {
            this.systemOnExit();
          } else {
            this.closeRoom();
          }
          break;
        case "startGame":
          this.overlay.hide();
          if (this.audio) this.audio.playGameStart();
          if (this.controls && !this.controls.isLocked) this.controls.lock();
          this.startGameMode();
          break;
        case "back":
          this.overlay.show("pause");
          if (this.audio) this.audio.playCloseCatalog();
          break;
        case "achievements":
          this.overlay.show("achievements");
          if (this.overlay && this.roomAchievements) {
            this.overlay.setAchievementsData(this.roomAchievements.getAllWithStatus());
          }
          if (this.audio) this.audio.playToggleOn();
          break;
        case "achievements_back":
          this.overlay.show("pause");
          if (this.audio) this.audio.playCloseCatalog();
          break;
        case "settings":
          this.overlay.show("settings");
          if (this.audio) this.audio.playToggleOn();
          break;
        case "settings_back":
          this.overlay.settingsCategory = null;
          this.overlay.render();
          if (this.audio) this.audio.playCloseCatalog();
          break;
        case "settings_cat_graphics":
        case "settings_cat_visuals":
        case "settings_cat_audio":
        case "settings_cat_gameplay":
        case "settings_cat_editor":
          this.overlay.settingsCategory = btn.id.replace("settings_cat_", "");
          this.overlay.render();
          if (this.audio) this.audio.playToggleOn();
          break;
        case "settings_visuals_dayNight": {
          this.roomSettings.visuals.dayNight = !this.roomSettings.visuals.dayNight;
          rmStore.set("settings", this.roomSettings);
          if (this.renderer) this.renderer.toggleDayNight();
          this.overlay.render();
          break;
        }
        case "settings_visuals_lamp": {
          this.roomSettings.visuals.lamp = !this.roomSettings.visuals.lamp;
          rmStore.set("settings", this.roomSettings);
          if (this.renderer) this.renderer.toggleCeiling(this.roomSettings.visuals.lamp);
          this.overlay.render();
          break;
        }
        case "settings_audio_masterDown":
        case "settings_audio_masterUp": {
          const step = 0.05;
          const dir = btn.id === "settings_audio_masterDown" ? -1 : 1;
          this.roomSettings.audio.masterVolume = Math.max(
            0,
            Math.min(1, this.roomSettings.audio.masterVolume + dir * step)
          );
          rmStore.set("settings", this.roomSettings);
          if (this.audio) this.audio.setMasterVolume(this.roomSettings.audio.masterVolume);
          this.overlay.render();
          break;
        }
        case "settings_audio_ui": {
          this.roomSettings.audio.ui = !this.roomSettings.audio.ui;
          rmStore.set("settings", this.roomSettings);
          if (this.audio) this.audio.setUIEnabled(this.roomSettings.audio.ui);
          this.overlay.render();
          break;
        }
        case "settings_audio_footstep": {
          this.roomSettings.audio.footstep = !this.roomSettings.audio.footstep;
          rmStore.set("settings", this.roomSettings);
          if (this.audio) this.audio.setFootstepEnabled(this.roomSettings.audio.footstep);
          this.overlay.render();
          break;
        }
        case "settings_audio_ambient": {
          this.roomSettings.audio.ambient = !this.roomSettings.audio.ambient;
          rmStore.set("settings", this.roomSettings);
          if (this.audio) this.audio.setAmbientEnabled(this.roomSettings.audio.ambient);
          this.overlay.render();
          break;
        }
        case "settings_gameplay_genreHints": {
          this.roomSettings.gameplay.genreHints = !this.roomSettings.gameplay.genreHints;
          rmStore.set("settings", this.roomSettings);
          this.overlay.render();
          break;
        }
        case "settings_gameplay_timer": {
          this.roomSettings.gameplay.timer = !this.roomSettings.gameplay.timer;
          rmStore.set("settings", this.roomSettings);
          this.overlay.render();
          break;
        }
        case "settings_editor_snap": {
          this.roomSettings.editor.snap = !this.roomSettings.editor.snap;
          rmStore.set("settings", this.roomSettings);
          if (this.editorManager) this.editorManager.snapEnabled = this.roomSettings.editor.snap;
          this.overlay.render();
          break;
        }
        case "settings_editor_snapSizeDown":
        case "settings_editor_snapSizeUp": {
          const snapStep = 0.05;
          const snapDir = btn.id === "settings_editor_snapSizeDown" ? -1 : 1;
          this.roomSettings.editor.snapSize = Math.max(
            0.05,
            Math.min(1, this.roomSettings.editor.snapSize + snapDir * snapStep)
          );
          rmStore.set("settings", this.roomSettings);
          if (this.editorManager) this.editorManager.snapSize = this.roomSettings.editor.snapSize;
          this.overlay.render();
          break;
        }
        case "settings_graphics_bloom":
        case "settings_graphics_shadows":
        case "settings_graphics_dust":
        case "settings_graphics_curtainSway": {
          const gfx = this.roomSettings.graphics;
          const key =
            btn.id === "settings_graphics_curtainSway" ? "curtainSway" : btn.id.replace("settings_graphics_", "");
          gfx[key] = !gfx[key];
          if (key === "bloom" && this.renderer) this.renderer.setBloomEnabled(gfx.bloom);
          if (key === "shadows" && this.renderer) this.renderer.setShadowsEnabled(gfx.shadows);
          rmStore.set("settings", this.roomSettings);
          this.overlay.render();
          break;
        }
        case "settings_graphics_quality": {
          const order = ["low", "medium", "high", "ultra"];
          const cur = order.indexOf(this.roomSettings.graphics.quality);
          const next = (cur + 1) % order.length;
          const quality = order[next];
          const g = this.roomSettings.graphics;
          g.quality = quality;
          g.bloom = quality !== "low";
          g.shadows = quality !== "low";
          g.dust = quality !== "low";
          g.curtainSway = quality !== "low";
          if (this.renderer) {
            this.renderer.setBloomEnabled(g.bloom);
            this.renderer.setShadowsEnabled(g.shadows);
            this.renderer.setQuality(quality);
          }
          rmStore.set("settings", this.roomSettings);
          this.overlay.render();
          break;
        }
        default:
          if (btn.type === "wall") {
            this.renderer.setWallColor(btn.hex);
            rmStore.set("wallColor", btn.hex);
          } else if (btn.type === "floor") {
            this.renderer.setFloorColor(btn.hex);
            rmStore.set("floorColor", btn.hex);
          }
          break;
      }
    };

    this.handleEditorAction = (btn) => {
      if (!this.editorManager) return;
      if (btn.id === "exit") {
        this.editorManager.exit();
        return;
      }
      if (btn.id === "undo") {
        this.editorManager.undo();
        return;
      }
      if (btn.id === "redo") {
        this.editorManager.redo();
        return;
      }
      if (btn.id === "snap") {
        this.editorManager.toggleSnap();
        this.editorUI.snapEnabled = this.editorManager.snapEnabled;
        this.editorUI.render();
        return;
      }
      if (btn.id === "spawn" && btn.data) {
        const current = this.editorManager.equippedItem;
        if (current && current.id === btn.data.id) {
          this.editorManager.unequip();
        } else {
          this.editorManager.equip({ id: btn.data.id, name: btn.data.name, manager: btn.data.manager });
        }
        this.editorUI.show(
          this.editorManager.equippedItem ? this.editorManager.equippedItem.id : null,
          this.editorManager.snapEnabled
        );
        this.editorUI.render();
        return;
      }
    };

    this.onEscapeCallback = () => {
      if (this.editorManager && this.editorManager.isEditActive() && this.editorManager.equippedItem) {
        this.editorManager.unequip();
        this.editorUI.show(null, this.editorManager.snapEnabled);
        this.editorUI.render();
        return;
      }
      if (this.interaction && this.interaction.isSeated()) {
        this.interaction.standFromChair(this.controls);
        return;
      }
      if (this.controls && this.controls.animTarget) {
        this.controls.cancelAnimation();
        return;
      }
      if (this.interaction && (this.interaction.grabbedCase || this.interaction.grabbedBallMesh)) {
        if (this.interaction.grabbedBallMesh) this.interaction.releaseBall();
        else this.interaction.releaseBook();
        return;
      }
      if (this.overlay && this.overlay.isVisible()) {
        if (this.overlay.getMode() === "colors") {
          this.overlay.show("pause");
        } else if (this.overlay.getMode() === "gameHud") {
          this.suppressPauseOnUnlock = true;
          this.overlay.show("pause");
          if (this.controls && this.controls.isLocked) this.controls.unlock();
        } else {
          this.overlay.hide();
        }
        return;
      }
      if (this.overlay) {
        this.suppressPauseOnUnlock = true;
        this.overlay.show("pause");
        if (this.controls && this.controls.isLocked) {
          this.controls.unlock();
        }
      }
    };

    this.captureScreenshot = () => {
      if (!this.renderer || !this.renderer.renderer) return;
      const crosshair = this.crosshairEl;
      const wasVisible = crosshair.classList.contains("room3d-crosshair--visible");
      crosshair.classList.remove("room3d-crosshair--visible");

      requestAnimationFrame(() => {
        try {
          const canvas = this.renderer.renderer.domElement;
          const dataUrl = canvas.toDataURL("image/png");
          const now = new Date();
          const pad = (n) => String(n).padStart(2, "0");
          const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = `yukios-room-${ts}.png`;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (err) {
          // silent
        } finally {
          if (wasVisible) crosshair.classList.add("room3d-crosshair--visible");
        }
      });
    };

    this.onKeyDownBound = (e) => {
      if (e.key === "Control") {
        this.ctrlHeld = true;
        this.updateEditorSnap();
        return;
      }
      if ((e.code === "KeyR" || e.key === "r" || e.code === "KeyE" || e.key === "e") && !e.ctrlKey && !e.metaKey) {
        if (this.editorManager && this.editorManager.isEditActive()) {
          e.preventDefault();
          const mode = this.editorManager.cycleTransformMode();
          this.editorUI.transformMode = mode;
          this.editorUI.render();
          if (this.audio) this.audio.playClick();
          return;
        }
      }
      if (e.code === "F12" || e.key === "F12") {
        e.preventDefault();
        this.captureScreenshot();
        if (this.audio) this.audio.playScreenshot();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this.onEscapeCallback();
        return;
      }
      if ((e.code === "KeyE" || e.key === "e") && this.controls) {
        e.preventDefault();
        if (this.overlay && this.overlay.isVisible()) {
          if (this.overlay.getMode() === "completion") {
            this.endGameMode();
            return;
          }
          if (this.overlay.getMode() !== "gameHud") {
            const btn = this.overlay.handleEKey();
            if (btn) this.handleHUDAction(btn);
            return;
          }
        }

        if (this.renderer && this.renderer.monitorScreen && this.renderer.hologramRenderer) {
          this.interaction.raycaster.setFromCamera(this.interaction.mouse, this.renderer.camera);
          const hits = this.interaction.raycaster.intersectObject(this.renderer.monitorScreen);
          if (hits.length > 0 && hits[0].uv && hits[0].distance < RoomInteraction.INTERACT_DIST) {
            const result = this.renderer.hologramRenderer.getItemAtUV(hits[0].uv.x, hits[0].uv.y);
            if (result && result.type === "app") {
              this.launchGameAndExit(result.appId);
              return;
            }
            if (result && result.type === "nav") {
              this.renderer.hologramRenderer.handleClick(hits[0].uv.x, hits[0].uv.y);
              if (this.audio) this.audio.playHoloDot();
              return;
            }
          }
        }
        if (this.interaction && this.interaction.isSeated()) {
          this.suppressPauseOnUnlock = true;
          this.interaction.handleEKey(this.renderer.camera, this.controls);
          return;
        }
        this.suppressPauseOnUnlock = true;
        if (this.audio) this.audio.playEKey();
        this.interaction.handleEKey(this.renderer.camera, this.controls);
      }
      if ((e.code === "KeyN" || e.key === "n") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (this.renderer && this.renderer.toggleDayNight) {
          this.renderer.toggleDayNight();
          if (this.audio) this.audio.playDayNight();
        }
        return;
      }
      if ((e.code === "KeyF" || e.key === "f") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (this.interaction) {
          const gameId = this.interaction.launchFocusedGame();
          if (gameId) {
            this.launchGameAndExit(gameId);
          }
        }
        return;
      }
      if (e.code === "Tab" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (this.editorManager) {
          if (!this.editorManager.isEditActive()) {
            this.suppressPauseOnUnlock = true;
          }
          this.editorManager.toggle();
          if (this.editorManager.isEditActive()) {
            this.hideHint();
            if (this.renderer && this.renderer.player) {
              this.renderer.player.group.visible = false;
              this.renderer.player.shadowMesh.visible = false;
            }
          } else {
            if (this.renderer && this.renderer.player) {
              this.renderer.player.group.visible = true;
              this.renderer.player.shadowMesh.visible = true;
            }
          }
        }
        return;
      }
      if ((e.code === "KeyG" || e.key === "g") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (this.editorManager && this.editorManager.isEditActive()) {
          this.editorManager.toggleSnap();
          this.editorUI.snapEnabled = this.editorManager.snapEnabled;
          this.editorUI.render();
          return;
        }
        if (this.gameState && this.gameState.active) {
          this.endGameMode();
        } else if (this.gameState && this.gameState.completed) {
          this.endGameMode();
        } else {
          this.startGameMode();
          if (this.audio) this.audio.playGameStart();
        }
        return;
      }
      if (this.gameState && this.gameState.active) {
        if ((e.code === "KeyT" || e.key === "t") && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          if (this.shelfManager && this.interaction && this.interaction.povGrabbedCase) {
            const genre = this.interaction.povGrabbedCase.genre || "casual";
            this.shelfManager.highlightCategory(genre, 3000);
          }
          return;
        }
      }
    };
    document.addEventListener("keydown", this.onKeyDownBound);
    this.onKeyUpBound = (e) => {
      if (e.key === "Control") {
        this.ctrlHeld = false;
        this.updateEditorSnap();
      }
    };
    document.addEventListener("keyup", this.onKeyUpBound);
    this.triggerRoomAchievement("room_explorer");
    this.showHint();
  }

  updateEditorSnap() {
    if (!this.editorManager || !this.editorManager.transformControls) return;
    if (this.ctrlHeld) {
      this.editorManager.transformControls.translationSnap = this.editorManager.snapSize;
    } else {
      this.editorManager.transformControls.translationSnap = null;
    }
  }

  registerNewDecorBuilders() {
    const T = this.editorManager ? this.editorManager.THREE : null;
    if (!T) return;

    this.editorManager.paletteBuilders = {
      wastebin: (T) => {
        const group = new T.Group();
        const mat = new T.MeshStandardMaterial({ color: 0x444444, roughness: 0.7 });
        const body = new T.Mesh(new T.CylinderGeometry(0.12, 0.15, 0.28, 12), mat);
        body.position.y = 0.14;
        group.add(body);
        const rim = new T.Mesh(new T.TorusGeometry(0.13, 0.01, 6, 12), mat);
        rim.position.y = 0.28;
        rim.rotation.x = Math.PI / 2;
        group.add(rim);
        return group;
      },
      "wooden-chair": (T) => {
        const group = new T.Group();
        const mat = new T.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 });
        const seat = new T.Mesh(new T.BoxGeometry(0.4, 0.03, 0.4), mat);
        seat.position.y = 0.42;
        group.add(seat);
        for (const [lx, lz] of [
          [-0.16, -0.16],
          [0.16, -0.16],
          [-0.16, 0.16],
          [0.16, 0.16]
        ]) {
          const leg = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.42, 6), mat);
          leg.position.set(lx, 0.21, lz);
          group.add(leg);
        }
        const back = new T.Mesh(new T.BoxGeometry(0.4, 0.4, 0.025), mat);
        back.position.set(0, 0.63, -0.185);
        group.add(back);
        return group;
      },
      "small-table": (T) => {
        const group = new T.Group();
        const mat = new T.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.8 });
        const top = new T.Mesh(new T.BoxGeometry(0.6, 0.03, 0.4), mat);
        top.position.y = 0.5;
        group.add(top);
        for (const [lx, lz] of [
          [-0.25, -0.15],
          [0.25, -0.15],
          [-0.25, 0.15],
          [0.25, 0.15]
        ]) {
          const leg = new T.Mesh(new T.BoxGeometry(0.03, 0.5, 0.03), mat);
          leg.position.set(lx, 0.25, lz);
          group.add(leg);
        }
        return group;
      },
      crate: (T) => {
        const group = new T.Group();
        const mat = new T.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
        const box = new T.Mesh(new T.BoxGeometry(0.35, 0.35, 0.35), mat);
        box.position.y = 0.175;
        group.add(box);
        const edgeMat = new T.MeshStandardMaterial({ color: 0x6b4e0a, roughness: 0.9 });
        for (let i = 0; i < 3; i++) {
          const strip = new T.Mesh(new T.BoxGeometry(0.36, 0.015, 0.36), edgeMat);
          strip.position.y = 0.06 + i * 0.12;
          group.add(strip);
        }
        return group;
      },
      barrel: (T) => {
        const group = new T.Group();
        const mat = new T.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.8 });
        const body = new T.Mesh(new T.CylinderGeometry(0.15, 0.17, 0.4, 12), mat);
        body.position.y = 0.2;
        group.add(body);
        const bandMat = new T.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.3 });
        for (const y of [0.08, 0.32]) {
          const band = new T.Mesh(new T.TorusGeometry(0.16, 0.008, 6, 16), bandMat);
          band.position.y = y;
          band.rotation.x = Math.PI / 2;
          group.add(band);
        }
        return group;
      },
      "wall-poster": (T) =>
        this.decorManager ? this.decorManager.definitions.find((d) => d.id === "wall-poster")?.builderFn(T) : null,
      "desk-plant": (T) =>
        this.decorManager ? this.decorManager.definitions.find((d) => d.id === "desk-plant")?.builderFn(T) : null,
      "desk-books": (T) =>
        this.decorManager ? this.decorManager.definitions.find((d) => d.id === "desk-books")?.builderFn(T) : null,
      "floor-lamp": (T) =>
        this.decorManager ? this.decorManager.definitions.find((d) => d.id === "floor-lamp")?.builderFn(T) : null,
      "wall-clock": (T) => {
        const group = new T.Group();
        const faceMat = new T.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.4 });
        const face = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.02, 24), faceMat);
        face.rotation.x = Math.PI / 2;
        face.position.y = 1.6;
        group.add(face);
        const handMat = new T.MeshStandardMaterial({ color: 0x111111 });
        const hour = new T.Mesh(new T.BoxGeometry(0.012, 0.1, 0.005), handMat);
        hour.position.set(0, 1.65, 0.015);
        group.add(hour);
        const minute = new T.Mesh(new T.BoxGeometry(0.008, 0.13, 0.005), handMat);
        minute.position.set(0.03, 1.66, 0.015);
        minute.rotation.z = -0.8;
        group.add(minute);
        const rim = new T.Mesh(
          new T.TorusGeometry(0.18, 0.01, 8, 24),
          new T.MeshStandardMaterial({ color: 0x222222, metalness: 0.6 })
        );
        rim.position.y = 1.6;
        rim.rotation.x = Math.PI / 2;
        group.add(rim);
        return group;
      },
      rug: (T) => {
        const group = new T.Group();
        const mat = new T.MeshStandardMaterial({ color: 0x6b2a5c, roughness: 0.9 });
        const rug = new T.Mesh(new T.BoxGeometry(1.2, 0.01, 0.8), mat);
        rug.position.y = 0.005;
        group.add(rug);
        const borderMat = new T.MeshStandardMaterial({ color: 0x8b3a7c, roughness: 0.9 });
        const border = new T.Mesh(new T.BoxGeometry(1.24, 0.012, 0.84), borderMat);
        border.position.y = 0.004;
        group.add(border);
        return group;
      },
      painting: (T) => {
        const group = new T.Group();
        const canvas = document.createElement("canvas");
        canvas.width = 192;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        const grad = ctx.createLinearGradient(0, 0, 192, 128);
        grad.addColorStop(0, "#2a1a4a");
        grad.addColorStop(1, "#1a0a3a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 192, 128);
        ctx.fillStyle = "rgba(160,100,220,0.2)";
        ctx.beginPath();
        ctx.arc(96, 64, 30, 0, Math.PI * 2);
        ctx.fill();
        const tex = new T.CanvasTexture(canvas);
        const poster = new T.Mesh(
          new T.PlaneGeometry(0.5, 0.35),
          new T.MeshStandardMaterial({ map: tex, roughness: 0.4 })
        );
        group.add(poster);
        const frameMat = new T.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
        for (const [w, h, x, y] of [
          [0.54, 0.025, 0, 0.175 - 0.012],
          [0.54, 0.025, 0, -0.175 + 0.012],
          [0.025, 0.35, -0.27 + 0.012, 0],
          [0.025, 0.35, 0.27 - 0.012, 0]
        ]) {
          const bar = new T.Mesh(new T.BoxGeometry(w, h, 0.02), frameMat);
          bar.position.set(x, y, -0.01);
          group.add(bar);
        }
        return group;
      },
      "gold-trophy": (T) => {
        const group = new T.Group();
        const goldMat = new T.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
        const darkMat = new T.MeshStandardMaterial({ color: 0x8b6914, metalness: 0.4, roughness: 0.6 });
        const base = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 0.02, 12), darkMat);
        base.position.y = 0.01;
        group.add(base);
        const stem = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.06, 8), goldMat);
        stem.position.y = 0.05;
        group.add(stem);
        const cup = new T.Mesh(new T.CylinderGeometry(0.07, 0.04, 0.07, 12), goldMat);
        cup.position.y = 0.12;
        group.add(cup);
        const handleLeft = new T.Mesh(new T.TorusGeometry(0.025, 0.006, 6, 8, Math.PI), goldMat);
        handleLeft.position.set(-0.065, 0.12, 0);
        handleLeft.rotation.z = Math.PI / 2;
        group.add(handleLeft);
        const handleRight = new T.Mesh(new T.TorusGeometry(0.025, 0.006, 6, 8, Math.PI), goldMat);
        handleRight.position.set(0.065, 0.12, 0);
        handleRight.rotation.z = Math.PI / 2;
        group.add(handleRight);
        return group;
      },
      "neon-sign": (T) => {
        const group = new T.Group();
        const neonMat = new T.MeshStandardMaterial({
          color: 0xff44ff,
          emissive: 0xff44ff,
          emissiveIntensity: 0.6,
          roughness: 0.1,
          metalness: 0.1,
          transparent: true,
          opacity: 0.9
        });
        const frameMat = new T.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
        const sign = new T.Mesh(new T.BoxGeometry(0.4, 0.15, 0.02), neonMat);
        sign.position.y = 0.075;
        group.add(sign);
        const glow = new T.Mesh(
          new T.BoxGeometry(0.44, 0.19, 0.01),
          new T.MeshBasicMaterial({ color: 0xff44ff, transparent: true, opacity: 0.08 })
        );
        glow.position.y = 0.075;
        glow.position.z = -0.01;
        group.add(glow);
        const bracket = new T.Mesh(new T.BoxGeometry(0.02, 0.08, 0.02), frameMat);
        bracket.position.set(0.18, -0.04, 0);
        group.add(bracket);
        const bracket2 = new T.Mesh(new T.BoxGeometry(0.02, 0.08, 0.02), frameMat);
        bracket2.position.set(-0.18, -0.04, 0);
        group.add(bracket2);
        const bar = new T.Mesh(new T.BoxGeometry(0.4, 0.015, 0.015), frameMat);
        bar.position.y = -0.08;
        group.add(bar);
        return group;
      }
    };
  }

  launchGameAndExit(gameId) {
    if (this.audio) this.audio.playHoloClick();
    const appId = gameId;
    os.app.launch(gameId);

    if (!os.storage.get(StorageKeys.room3dReturnHintShown)) {
      os.storage.set(StorageKeys.room3dReturnHintShown, true);
      setTimeout(() => {
        os.notify.send("3D Room", "You can launch the 3D Room app from desktop shortcut to return back.");
      }, 1500);
    }

    setTimeout(() => {
      const win = $(`[data-appId="${appId}"]`) || $(`#${appId}-win`) || $(`#${appId}`);
      if (win) {
        win.classList.add("snapping");
        win.offsetHeight;
        os.window.maximize(win);
      }
    }, 600);
    if (this.systemOnExit) this.systemOnExit();
    else this.closeRoom();
  }

  setupInteractionCallbacks() {
    this.controls.onBeforeLock = (event) => {
      if (this.editorManager && this.editorManager.isEditActive()) {
        return true;
      }
      if (this.interaction && this.interaction.isEGrabbed()) {
        return true;
      }
      if (this.controls && this.controls.animTarget) {
        this.controls.cancelAnimation();
        return true;
      }
      if (this.interaction) {
        return this.interaction.onBeforeLock(event);
      }
      return false;
    };

    this.interaction.register("desklamp", () => {
      if (this.renderer) this.renderer.toggleLamp();
    });

    this.interaction.register("floorlamp", () => {
      const item = this.decorManager.getAllItems().find((i) => i.id === "floor-lamp");
      if (!item) return;
      const mesh = item.mesh;
      const light = mesh.userData.floorLampLight;
      const bulb = mesh.userData.floorLampBulb;
      if (!light || !bulb) return;
      const on = light.intensity > 0;
      if (on) {
        light.intensity = 0;
        bulb.material.color.setHex(0x221100);
      } else {
        light.intensity = 1.5;
        bulb.material.color.setHex(0xffddaa);
      }
    });

    this.interaction.register("monitor", () => {
      if (!this.controls || !this.THREE || !this.renderer) return;
      const screen = this.renderer.monitorScreen;
      const holo = this.renderer.hologramRenderer;
      if (screen && holo && this.interaction) {
        this.interaction.raycaster.setFromCamera(this.interaction.mouse, this.renderer.camera);
        const hits = this.interaction.raycaster.intersectObject(screen);
        if (hits.length > 0 && hits[0].uv) {
          const uv = hits[0].uv;
          const result = holo.handleClick(uv.x, uv.y);
          if (result && result.action === "navigate") return;
          if (result && result.action === "launch") {
            this.launchGameAndExit(result.appId);
            return;
          }
        }
      }
      if (this.controls.animTarget) return;
      const V = this.THREE.Vector3;
      const targetPos = new V(0, 1.5, -0.6);
      const targetLook = new V(0, 1.6, -1.4);
      this.controls.animateCamera(targetPos, targetLook, 1.2, () => {
        if (this.systemOnExit) {
          this.systemOnExit();
        } else {
          os.app.launch("browserApp");
        }
      });
    });

    this.interaction.register("colorPickerButton", () => {
      this.suppressPauseOnUnlock = true;
      if (this.controls && this.controls.isLocked) this.controls.unlock();
      if (this.overlay) this.overlay.show("colors");
    });

    if (this.renderer) {
      this.interaction.register("holoArrowPrev", () => {
        if (this.renderer && this.renderer.hologramRenderer) {
          const h = this.renderer.hologramRenderer;
          const target = h.currentPage > 0 ? h.currentPage - 1 : h.totalPages - 1;
          h.goToPage(target);
          if (this.audio) this.audio.playHoloPage();
        }
      });
      this.interaction.register("holoArrowNext", () => {
        if (this.renderer && this.renderer.hologramRenderer) {
          const h = this.renderer.hologramRenderer;
          h.goToPage(h.currentPage + 1);
          if (this.audio) this.audio.playHoloPage();
        }
      });
    }
  }

  getEditorColliders() {
    const colliders = [];
    if (this.renderer && this.renderer.roomObjects) {
      for (const obj of this.renderer.roomObjects) {
        if (!obj.geometry && !(obj.children && obj.children.length > 0)) continue;
        if (obj.userData && obj.userData.title === "Floor") continue;
        colliders.push(obj);
      }
    }
    if (this.renderer && this.renderer.wallMeshes) {
      for (const wall of this.renderer.wallMeshes) {
        if (!colliders.includes(wall)) colliders.push(wall);
      }
    }
    if (this.shelfManager && this.shelfManager.shelfMeshes) {
      for (const shelf of this.shelfManager.shelfMeshes) {
        if (!colliders.includes(shelf)) colliders.push(shelf);
      }
    }
    return colliders;
  }

  closeRoom() {
    if (this.saveRoomState) this.saveRoomState();
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    if (this.gameHudRaf) {
      cancelAnimationFrame(this.gameHudRaf);
      this.gameHudRaf = null;
    }
    if (this.onKeyDownBound) {
      document.removeEventListener("keydown", this.onKeyDownBound);
      this.onKeyDownBound = null;
    }
    if (this.onKeyUpBound) {
      document.removeEventListener("keyup", this.onKeyUpBound);
      this.onKeyUpBound = null;
    }
    this.ctrlHeld = false;
    if (this.audio) {
      this.audio.dispose();
      this.audio = null;
    }

    const w = this.wallDisplay;
    const r = this.rainbowBall;
    const s = this.shelfManager;
    const f = this.furnitureManager;
    const d = this.decorManager;
    const i = this.interaction;
    const c = this.controls;
    const b = this.gameCaseManager;
    const re = this.renderer;
    const ro = this.resizeObserver;
    const o = this.overlay;
    const gs = this.gameState;
    const ed = this.editorManager;
    const eui = this.editorUI;
    const es = this.sceneSerializer;

    this.wallDisplay = null;
    this.rainbowBall = null;
    this.shelfManager = null;
    this.furnitureManager = null;
    this.decorManager = null;
    this.interaction = null;
    this.gameCaseManager = null;
    this.controls = null;
    this.renderer = null;
    this.resizeObserver = null;
    this.THREE = null;
    this.overlay = null;
    this.gameState = null;
    this.editorManager = null;
    this.editorUI = null;
    this.sceneSerializer = null;
    window.room3d = undefined;

    const overlay = this.openOverlay || this.systemOverlay;
    if (overlay) {
      overlay.style.opacity = "0";
      overlay.addEventListener(
        "transitionend",
        () => {
          try {
            if (w) w.destroy();
          } catch (e) {
            /* ignore */
          }
          try {
            if (r) r.destroy();
          } catch (e) {
            /* ignore */
          }
          try {
            if (s) s.destroy();
          } catch (e) {
            /* ignore */
          }
          try {
            if (f) f.destroy();
          } catch (e) {
            /* ignore */
          }
          try {
            if (d) d.destroy();
          } catch (e) {
            /* ignore */
          }
          try {
            if (i) i.destroy();
          } catch (e) {
            /* ignore */
          }
          try {
            if (c) c.stop();
          } catch (e) {
            /* ignore */
          }
          try {
            if (b) b.destroy();
          } catch (e) {
            /* ignore */
          }
          try {
            if (re) re.destroy();
          } catch (e) {
            /* ignore */
          }
          try {
            if (o) o.destroy();
          } catch (e) {
            /* ignore */
          }
          try {
            if (ed) ed.exit();
          } catch (e) {
            /* ignore */
          }
          if (ro) ro.disconnect();
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          $("#desktop").style.display = "";
          SystemUtilities.loadWallpaper();
        },
        { once: true }
      );
    } else {
      try {
        if (w) w.destroy();
      } catch (e) {
        /* ignore */
      }
      try {
        if (r) r.destroy();
      } catch (e) {
        /* ignore */
      }
      try {
        if (s) s.destroy();
      } catch (e) {
        /* ignore */
      }
      try {
        if (f) f.destroy();
      } catch (e) {
        /* ignore */
      }
      try {
        if (d) d.destroy();
      } catch (e) {
        /* ignore */
      }
      try {
        if (i) i.destroy();
      } catch (e) {
        /* ignore */
      }
      try {
        if (c) c.stop();
      } catch (e) {
        /* ignore */
      }
      try {
        if (b) b.destroy();
      } catch (e) {
        /* ignore */
      }
      try {
        if (re) re.destroy();
      } catch (e) {
        /* ignore */
      }
      try {
        if (o) o.destroy();
      } catch (e) {
        /* ignore */
      }
      try {
        if (ed) ed.exit();
      } catch (e) {
        /* ignore */
      }
      if (ro) ro.disconnect();
      $("#desktop").style.display = "";
      SystemUtilities.loadWallpaper();
    }

    this.openOverlay = null;
    this.systemOverlay = null;
    this.crosshairEl = null;
    this.wastebinHintEl = null;
    this.launchHintEl = null;
  }

  exitSystemMode() {
    this.closeRoom();
    this.systemOnExit = null;
  }

  onClose(winId) {
    this.closeRoom();
  }
}
