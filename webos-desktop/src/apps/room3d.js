import "../styles/room3d.css";
import { BaseApp, os } from "../framework.js";
import { gameBridge } from "../game-bridge/GameBridge.js";
import { RoomRenderer } from "../3d/RoomRenderer.js";
import { FPSControls } from "../3d/FPSControls.js";
import { RoomInteraction } from "../3d/RoomInteraction.js";
import { BookManager } from "../3d/BookManager.js";
import { WallDisplay } from "../3d/WallDisplay.js";
import { RainbowBall } from "../3d/RainbowBall.js";
import { ShelfManager } from "../3d/ShelfManager.js";
import { FurnitureManager } from "../3d/FurnitureManager.js";
import { DecorManager } from "../3d/DecorManager.js";
import { CanvasOverlay } from "../3d/CanvasOverlay.js";
import { SystemUtilities } from "../system.js";

const rmStore = {
  _p: "rm3d_",
  get(k, d) {
    try {
      const v = localStorage.getItem(this._p + k);
      return v !== null ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(this._p + k, JSON.stringify(v));
    } catch {}
  }
};

export class Room3DApp extends BaseApp {
  constructor(services) {
    super(services);
    this.renderer = null;
    this.controls = null;
    this.interaction = null;
    this.bookManager = null;
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
    this._crosshairEl = null;
    this._suppressPauseOnUnlock = false;
  }

  async open(opts = {}) {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:999999;background:#000;opacity:0;transition:opacity 0.4s ease";
    document.body.appendChild(overlay);

    SystemUtilities.disableVantaWallpaper();
    document.getElementById("desktop").style.display = "none";

    this.buildUI(overlay);
    const container = overlay.querySelector("#room3d-canvas");
    await this.init3D(container);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });

    this.running = true;
    this._openOverlay = overlay;

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
    document.getElementById("desktop").style.display = "none";

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
    `;
  }

  async init3D(container) {
    const root = container.parentElement;
    this._crosshairEl = root.querySelector("#room3d-crosshair");

    const THREE = await import("three");
    this.THREE = THREE;

    this.renderer = new RoomRenderer(container);
    await this.renderer.init();

    this.controls = new FPSControls(
      this.renderer.camera,
      this.renderer.renderer.domElement,
      this.renderer.bounds,
      this.renderer.getColliders()
    );
    this.controls.onLockStateChange = (locked) => {
      if (locked) {
        this._crosshairEl.classList.add("room3d-crosshair--visible");
      } else {
        this._crosshairEl.classList.remove("room3d-crosshair--visible");
        if (!this._suppressPauseOnUnlock && this.overlay && !this.overlay.isVisible() && this.running) {
          this.overlay.show("pause");
        }
        this._suppressPauseOnUnlock = false;
      }
    };
    this.controls.start(THREE);

    this.renderer.onUpdate((delta) => {
      if (this.controls) this.controls.update(delta);
    });

    this.interaction = new RoomInteraction(this.renderer, this.controls);
    await this.interaction.init();
    this.interaction.onLaunchGame = (gameId) => os.app.launch(gameId);
    this.setupInteractionCallbacks();

    const overlayCanvas = root.querySelector("#room3d-overlay");
    this.overlay = new CanvasOverlay(overlayCanvas, {
      onAction: (btn) => this.handleHUDAction(btn)
    });

    this.bookManager = new BookManager(
      this.renderer.scene,
      this.renderer.bounds,
      this.interaction,
      this.renderer.getColliders()
    );
    const savedState = rmStore.get("bookPositions") || {};
    const savedPositions = savedState.positions || {};
    const savedShelves = savedState.shelves || {};
    await this.bookManager.init(THREE, savedPositions, savedShelves);
    this.interaction.setBooks(this.bookManager.getBooks());

    const savedBallPos = rmStore.get("ballPosition");
    const ballPos = savedBallPos
      ? new THREE.Vector3(savedBallPos.x, savedBallPos.y, savedBallPos.z)
      : new THREE.Vector3(0.4, 0.95, -0.6);
    this.rainbowBall = new RainbowBall(THREE, this.renderer.scene);
    this.rainbowBall.init(ballPos);
    this.bookManager.physics.world.addBody(this.rainbowBall.body);
    this.interaction.setBallMesh(this.rainbowBall.mesh, this.rainbowBall.body);

    this.shelfManager = new ShelfManager(THREE, this.renderer.scene, this.bookManager.physics.world);
    this.shelfManager.build(savedShelves);
    this.bookManager.placeShelvedBooks(this.shelfManager);
    this.interaction.setShelfManager(this.shelfManager);

    this.furnitureManager = new FurnitureManager(THREE, this.renderer.scene, this.renderer, this.interaction, () => {
      const fp = this.furnitureManager.getPositions();
      rmStore.set("furniturePositions", fp);
    });
    this.interaction.setFurnitureManager(this.furnitureManager);

    const savedFurniturePos = rmStore.get("furniturePositions");
    if (savedFurniturePos) {
      this.furnitureManager.restorePositions(savedFurniturePos);
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

    const savedWallColor = rmStore.get("wallColor");
    if (savedWallColor) this.renderer.setWallColor(savedWallColor);
    const savedFloorColor = rmStore.get("floorColor");
    if (savedFloorColor) this.renderer.setFloorColor(savedFloorColor);

    this.wallDisplay = new WallDisplay(
      this.bookManager,
      (gameId) => {
        const book = this.bookManager.spawnFromCatalog(gameId);
        if (book && this.interaction) {
          this.interaction.povGrabBook(book);
        }
      },
      (gameId) => this.bookManager.recoverFromTrash(gameId),
      THREE,
      this.renderer.scene,
      this.renderer.interactiveObjects
    );
    this.wallDisplay.open();

    this.interaction.register("wallPagePrev", () => {
      this.wallDisplay.prevPage();
    });
    this.interaction.register("wallPageNext", () => {
      this.wallDisplay.nextPage();
    });
    this.interaction.register("wallRecoverAll", () => {
      if (this.wallDisplay.handleRecoverAll) {
        this.wallDisplay.handleRecoverAll();
      }
    });
    this.interaction.registerPrefix("wallCard_", (obj) => {
      return this.wallDisplay.handleCardClick(obj.userData.gameId);
    });
    this.interaction.registerPrefix("wallTab_", (obj) => {
      this.wallDisplay.handleTabClick(obj.userData.tabId);
    });

    this.interaction.onCatalogOpen = () => {
      this.wallDisplay.open();
    };

    this.interaction.onTrashRequest = (book) => {
      this.interaction.releasePOVGrab();
      this.bookManager.trashBook(book);
    };

    this.renderer.onUpdate((delta) => {
      if (!this.interaction || !this.bookManager || !this.renderer) return;
      this.interaction.updateGrabbed();
      this.interaction.updateEGrabbed(this.renderer.camera);
      this.interaction.updateWastebinProximity(this.renderer.camera);
      this.bookManager.update(delta);
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
      if (this.furnitureManager) {
        this.furnitureManager.updateGrabbed(this.renderer.camera, this.renderer.renderer, THREE);
      }

      this.renderer.time += delta;
      const t = this.renderer.time;

      if (this.renderer.dustMesh && this.renderer.dustPositions) {
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

    this.resizeObserver = new ResizeObserver(() => {
      if (this.renderer) this.renderer.resize();
    });
    this.resizeObserver.observe(container);

    this.saveRoomState = () => {
      try {
        if (!this.bookManager) return;
        const positions = this.bookManager.getPositions();
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
      } catch (e) {
        /* ignore */
      }
    };

    this.autoSaveInterval = setInterval(() => this.saveRoomState(), 30000);

    this.handleHUDAction = (btn) => {
      switch (btn.id) {
        case "resume":
          this.overlay.hide();
          if (this.controls && !this.controls.isLocked) this.controls.lock();
          break;
        case "colors":
          this.overlay.show("colors");
          break;
        case "exit":
          this.overlay.hide();
          if (this.systemOnExit) this.systemOnExit();
          else this.closeRoom();
          break;
        case "back":
          this.overlay.show("pause");
          break;
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

    this.onEscapeCallback = () => {
      if (this.controls && this.controls.animTarget) {
        this.controls.cancelAnimation();
        return;
      }
      if (this.interaction && (this.interaction.grabbedBook || this.interaction.grabbedBallMesh)) {
        if (this.interaction.grabbedBallMesh) this.interaction.releaseBall();
        else this.interaction.releaseBook();
        return;
      }
      if (this.overlay && this.overlay.isVisible()) {
        if (this.overlay.getMode() === "colors") {
          this.overlay.show("pause");
        } else {
          this.overlay.hide();
        }
        return;
      }
      if (this.overlay) {
        this._suppressPauseOnUnlock = true;
        this.overlay.show("pause");
        if (this.controls && this.controls.isLocked) {
          this.controls.unlock();
        }
      }
    };

    this.captureScreenshot = () => {
      if (!this.renderer || !this.renderer.renderer) return;
      const crosshair = this._crosshairEl;
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
      if (e.code === "F12" || e.key === "F12") {
        e.preventDefault();
        this.captureScreenshot();
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
          const btn = this.overlay.handleEKey();
          if (btn) this.handleHUDAction(btn);
          return;
        }

        if (this.renderer && this.renderer.monitorScreen && this.renderer.hologramRenderer) {
          this.interaction.raycaster.setFromCamera(this.interaction.mouse, this.renderer.camera);
          const hits = this.interaction.raycaster.intersectObject(this.renderer.monitorScreen);
          if (hits.length > 0 && hits[0].uv) {
            const result = this.renderer.hologramRenderer.getItemAtUV(hits[0].uv.x, hits[0].uv.y);
            if (result && result.type === "app") {
              if (this.systemOnExit) this.systemOnExit();
              else this.closeRoom();
              os.app.launch(result.appId);
              return;
            }
            if (result && result.type === "nav") {
              this.renderer.hologramRenderer.handleClick(hits[0].uv.x, hits[0].uv.y);
              return;
            }
          }
        }
        this.interaction.handleEKey(this.renderer.camera);
      }
      if ((e.code === "KeyN" || e.key === "n") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (this.renderer && this.renderer.toggleDayNight) {
          this.renderer.toggleDayNight();
        }
        return;
      }
    };
    document.addEventListener("keydown", this.onKeyDownBound);
  }

  setupInteractionCallbacks() {
    this.controls.onBeforeLock = () => {
      if (this.controls && this.controls.animTarget) {
        this.controls.cancelAnimation();
        return true;
      }
      return false;
    };

    this.interaction.register("desklamp", () => {
      if (this.renderer) this.renderer.toggleLamp();
    });

    this.interaction.register("monitor", () => {
      if (!this.controls || !this.THREE || !this.renderer) return;
      const screen = this.renderer.monitorScreen;
      const holo = this.renderer.hologramRenderer;
      if (screen && holo && this.interaction) {
        this.interaction.raycaster.setFromCamera({ x: 0, y: 0 }, this.renderer.camera);
        const hits = this.interaction.raycaster.intersectObject(screen);
        if (hits.length > 0 && hits[0].uv) {
          const uv = hits[0].uv;
          const result = holo.handleClick(uv.x, uv.y);
          if (result && result.action === "navigate") return;
          if (result && result.action === "launch") {
            if (this.systemOnExit) this.systemOnExit();
            else this.closeRoom();
            os.app.launch(result.appId);
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
      this._suppressPauseOnUnlock = true;
      if (this.controls && this.controls.isLocked) this.controls.unlock();
      if (this.overlay) this.overlay.show("colors");
    });

    if (this.renderer) {
      this.interaction.register("holoArrowPrev", () => {
        if (this.renderer && this.renderer.hologramRenderer) {
          const h = this.renderer.hologramRenderer;
          const target = h.currentPage > 0 ? h.currentPage - 1 : h.totalPages - 1;
          h.goToPage(target);
        }
      });
      this.interaction.register("holoArrowNext", () => {
        if (this.renderer && this.renderer.hologramRenderer) {
          const h = this.renderer.hologramRenderer;
          h.goToPage(h.currentPage + 1);
        }
      });
    }
  }

  closeRoom() {
    if (this.saveRoomState) this.saveRoomState();
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    if (this.onKeyDownBound) {
      document.removeEventListener("keydown", this.onKeyDownBound);
      this.onKeyDownBound = null;
    }

    const w = this.wallDisplay;
    const r = this.rainbowBall;
    const s = this.shelfManager;
    const f = this.furnitureManager;
    const d = this.decorManager;
    const i = this.interaction;
    const c = this.controls;
    const b = this.bookManager;
    const re = this.renderer;
    const ro = this.resizeObserver;
    const o = this.overlay;

    this.wallDisplay = null;
    this.rainbowBall = null;
    this.shelfManager = null;
    this.furnitureManager = null;
    this.decorManager = null;
    this.interaction = null;
    this.bookManager = null;
    this.controls = null;
    this.renderer = null;
    this.resizeObserver = null;
    this.THREE = null;
    this.overlay = null;
    window.room3d = undefined;

    const overlay = this._openOverlay || this.systemOverlay;
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
          if (ro) ro.disconnect();
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          document.getElementById("desktop").style.display = "";
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
      if (ro) ro.disconnect();
      document.getElementById("desktop").style.display = "";
      SystemUtilities.loadWallpaper();
    }

    this._openOverlay = null;
    this.systemOverlay = null;
    this._crosshairEl = null;
  }

  exitSystemMode() {
    this.closeRoom();
    this.systemOnExit = null;
  }

  onClose(winId) {
    this.closeRoom();
  }
}
