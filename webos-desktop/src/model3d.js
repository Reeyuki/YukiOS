import { desktop } from "./desktop.js";
import { speak } from "./clippy.js";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import { TDSLoader } from "three/examples/jsm/loaders/TDSLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SkeletonHelper } from "three";
import JSZip from "jszip";

const SAMPLE_MODELS = [
  {
    name: "Stanford Bunny",
    fileName: "bunny.obj",
    url: "https://raw.githack.com/glmark2/glmark2/master/data/models/bunny.obj",
    icon: "fa-rabbit",
    description: "Classic Stanford Bunny mesh"
  },
  {
    name: "Cat",
    fileName: "cat.3ds",
    url: "https://raw.githack.com/glmark2/glmark2/master/data/models/cat.3ds",
    icon: "fa-cat",
    description: "Cat model in 3DS format"
  },
  {
    name: "Cube",
    fileName: "cube.3ds",
    url: "https://raw.githack.com/glmark2/glmark2/master/data/models/cube.3ds",
    icon: "fa-cube",
    description: "Simple cube primitive"
  },
  {
    name: "Horse",
    fileName: "horse.3ds",
    url: "https://raw.githack.com/glmark2/glmark2/master/data/models/horse.3ds",
    icon: "fa-horse",
    description: "Horse model in 3DS format"
  }
];

export class Model3DApp {
  constructor(fileSystemManager, windowManager, explorerApp) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
    this.explorerApp = explorerApp;
    this.currentModel = null;
    this.mixer = null;
    this.animations = [];
    this.currentAction = null;
    this.currentAnimationIndex = -1;
    this.clock = new THREE.Clock();
    this.autoRotate = false;
    this.wireframe = false;
    this.showGrid = true;
    this.showAxes = true;
    this.showBones = false;
    this.currentFileName = "";
    this.skeletonHelper = null;
    this.animationSpeed = 1.0;
    this.isPlaying = false;
    this.loopAnimation = true;
    this.sampleCache = new Map();
  }

  open(title = "3D Model Viewer", filePath = null) {
    const winId = `model3d-${Date.now()}`;
    if (document.getElementById(winId)) {
      this.wm.bringToFront(document.getElementById(winId));
      return;
    }

    const win = this.wm.createWindow(winId, `${title}`, "1000px", "750px");
    Object.assign(win.style, { left: "150px", top: "60px" });

    win.innerHTML = `
      <div class="window-header">
        <span>${title}</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="model3d-toolbar">
        <div class="toolbar-group">
          <button class="model3d-btn" data-action="open" title="Open from Explorer">
            <span class="btn-icon"><i class="fa fa-folder-open"></i></span>
            <span class="btn-text">Open</span>
          </button>
          <button class="model3d-btn" data-action="openBrowser" title="Upload Model">
            <span class="btn-icon"><i class="fa fa-upload"></i></span>
            <span class="btn-text">Upload</span>
          </button>
          <button class="model3d-btn" data-action="samples" title="Load Sample Models">
            <span class="btn-icon"><i class="fa fa-download"></i></span>
            <span class="btn-text">Samples</span>
          </button>
          <button class="model3d-btn" data-action="screenshot" title="Take Screenshot">
            <span class="btn-icon"><i class="fa fa-camera"></i></span>
            <span class="btn-text">Screenshot</span>
          </button>
          <button class="model3d-btn" data-action="fullscreen" title="Fullscreen">
            <span class="btn-icon"><i class="fa fa-expand"></i></span>
            <span class="btn-text">Fullscreen</span>
          </button>
        </div>
        <div class="toolbar-group">
          <button class="model3d-btn toggle" data-action="wireframe" title="Wireframe Mode">
            <span class="btn-icon"><i class="fa fa-draw-polygon"></i></span>
            <span class="btn-text">Wireframe</span>
          </button>
          <button class="model3d-btn toggle" data-action="autoRotate" title="Auto Rotate">
            <span class="btn-icon"><i class="fa fa-sync-alt"></i></span>
            <span class="btn-text">Rotate</span>
          </button>
          <button class="model3d-btn toggle active" data-action="grid" title="Toggle Grid">
            <span class="btn-icon"><i class="fa fa-th"></i></span>
            <span class="btn-text">Grid</span>
          </button>
          <button class="model3d-btn toggle active" data-action="axes" title="Toggle Axes">
            <span class="btn-icon"><i class="fa fa-arrows-alt"></i></span>
            <span class="btn-text">Axes</span>
          </button>
          <button class="model3d-btn toggle" data-action="bones" title="Show Skeleton">
            <span class="btn-icon"><i class="fa fa-bone"></i></span>
            <span class="btn-text">Bones</span>
          </button>
        </div>
        <div class="toolbar-group">
          <button class="model3d-btn" data-action="resetCamera" title="Reset Camera">
            <span class="btn-icon"><i class="fa fa-crosshairs"></i></span>
            <span class="btn-text">Reset</span>
          </button>
          <button class="model3d-btn" data-action="zoomFit" title="Zoom to Fit">
            <span class="btn-icon"><i class="fa fa-search-plus"></i></span>
            <span class="btn-text">Fit</span>
          </button>
        </div>
      </div>
      <div class="model3d-main">
        <div class="model3d-sidebar">
          <div class="sidebar-section">
            <h4><i class="fa fa-palette"></i> Background</h4>
            <div class="bg-options">
              <button class="bg-btn active" data-bg="gradient">Gradient</button>
              <button class="bg-btn" data-bg="dark">Dark</button>
              <button class="bg-btn" data-bg="light">Light</button>
              <button class="bg-btn" data-bg="studio">Studio</button>
              <button class="bg-btn" data-bg="sunset">Sunset</button>
              <button class="bg-btn" data-bg="cyber">Cyber</button>
            </div>
          </div>
          <div class="sidebar-section">
            <h4><i class="fa fa-lightbulb"></i> Lighting</h4>
            <div class="slider-group">
              <label>Intensity</label>
              <input type="range" class="model3d-slider" data-light="intensity" min="0" max="3" step="0.1" value="1">
            </div>
            <div class="slider-group">
              <label>Ambient</label>
              <input type="range" class="model3d-slider" data-light="ambient" min="0" max="2" step="0.1" value="0.5">
            </div>
          </div>
          <div class="sidebar-section animation-section">
            <h4><i class="fa fa-film"></i> Animations</h4>
            <div class="animation-controls" id="animation-controls" style="display:none;">
              <div class="anim-transport">
                <button class="anim-control-btn" data-anim-action="stop" title="Stop">
                  <i class="fa fa-stop"></i>
                </button>
                <button class="anim-control-btn" data-anim-action="play" title="Play/Pause">
                  <i class="fa fa-play" id="play-pause-icon"></i>
                </button>
                <button class="anim-control-btn" data-anim-action="step-back" title="Step Back">
                  <i class="fa fa-step-backward"></i>
                </button>
                <button class="anim-control-btn" data-anim-action="step-forward" title="Step Forward">
                  <i class="fa fa-step-forward"></i>
                </button>
              </div>
              <div class="anim-timeline">
                <input type="range" class="timeline-slider" id="timeline-slider" min="0" max="100" step="0.1" value="0">
                <div class="time-display">
                  <span id="current-time">0.00</span> / <span id="total-time">0.00</span>s
                </div>
              </div>
              <div class="anim-options">
                <div class="speed-control">
                  <label><i class="fa fa-tachometer-alt"></i> Speed</label>
                  <select id="speed-select">
                    <option value="0.25">0.25x</option>
                    <option value="0.5">0.5x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1" selected>1x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2x</option>
                    <option value="3">3x</option>
                  </select>
                </div>
                <div class="loop-control">
                  <label>
                    <input type="checkbox" id="loop-checkbox" checked>
                    <i class="fa fa-redo"></i> Loop
                  </label>
                </div>
              </div>
            </div>
            <div class="animation-list" id="animation-list">
              <span class="no-animations">No animations</span>
            </div>
            <div class="bone-info" id="bone-info" style="display:none;">
              <h5><i class="fa fa-bone"></i> Skeleton Info</h5>
              <div class="info-row"><span>Bones:</span><span id="info-bones">-</span></div>
              <div class="bone-list" id="bone-list"></div>
            </div>
          </div>
          <div class="sidebar-section">
            <h4><i class="fa fa-info-circle"></i> Model Info</h4>
            <div class="model-info" id="model-info">
              <div class="info-row"><span>Vertices:</span><span id="info-vertices">-</span></div>
              <div class="info-row"><span>Faces:</span><span id="info-faces">-</span></div>
              <div class="info-row"><span>Meshes:</span><span id="info-meshes">-</span></div>
              <div class="info-row"><span>Materials:</span><span id="info-materials">-</span></div>
              <div class="info-row"><span>Textures:</span><span id="info-textures">-</span></div>
            </div>
          </div>
        </div>
        <div class="model3d-viewport">
          <div class="model3d-container"></div>
          <div class="viewport-overlay">
            <div class="controls-hint">
              <span><i class="fa fa-mouse-pointer"></i> Left: Rotate</span>
              <span><i class="fa fa-mouse-pointer"></i> Right: Pan</span>
              <span><i class="fa fa-mouse-pointer"></i> Scroll: Zoom</span>
            </div>
          </div>
          <div class="animation-overlay" id="animation-overlay" style="display:none;">
            <div class="anim-name" id="anim-overlay-name"></div>
          </div>
          <div class="loading-overlay" style="display:none;">
            <div class="loading-spinner"></div>
            <span>Loading model...</span>
          </div>
          <div class="welcome-screen" id="welcome-screen">
            <div class="welcome-content">
              <div class="welcome-icon"><i class="fa fa-cube"></i></div>
              <h2>3D Model Viewer</h2>
              <p>Drag & drop a model or click Open to get started</p>
              <div class="supported-formats">
                <span>.obj</span>
                <span>.gltf</span>
                <span>.glb</span>
                <span>.fbx</span>
                <span>.dae</span>
                <span>.3ds</span>
                <span>.zip</span>
              </div>
              <button class="welcome-samples-btn" id="welcome-samples-btn">
                <i class="fa fa-download"></i> Load Sample Models
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="model3d-statusbar">
        <span class="status-item" id="status-fps">FPS: --</span>
        <span class="status-item" id="status-anim"><i class="fa fa-film"></i> No animation</span>
        <span class="status-item" id="status-file"><i class="fa fa-file"></i> No model loaded</span>
        <span class="status-item" id="status-renderer"><i class="fa fa-microchip"></i> WebGL</span>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, title, "/static/icons/3dmodel.webp");

    this.win = win;
    this.setupRenderer(win, filePath);
    this.setupControls(win);
    this.setupAnimationControls(win);
    this.setupDragDrop(win);

    const welcomeSamplesBtn = win.querySelector("#welcome-samples-btn");
    if (welcomeSamplesBtn) {
      welcomeSamplesBtn.onclick = () => this.openSamplesModal();
    }
  }

  openSamplesModal() {
    const existingModal = document.querySelector(".samples-modal-backdrop");
    if (existingModal) existingModal.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "samples-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "samples-modal";

    modal.innerHTML = `
      <div class="samples-modal-header">
        <h3><i class="fa fa-download"></i> Sample 3D Models</h3>
        <button class="samples-modal-close" title="Close"><i class="fa fa-times"></i></button>
      </div>
      <div class="samples-modal-body">
        <p class="samples-modal-desc">Select a sample model to download and preview.</p>
        <div class="samples-grid">
          ${SAMPLE_MODELS.map(
            (m, i) => `
            <div class="sample-card" data-sample-index="${i}">
              <div class="sample-card-icon"><i class="fa ${m.icon}"></i></div>
              <div class="sample-card-info">
                <div class="sample-card-name">${m.name}</div>
                <div class="sample-card-desc">${m.description}</div>
                <div class="sample-card-file">${m.fileName}</div>
              </div>
              <div class="sample-card-action">
                <button class="sample-load-btn" data-sample-index="${i}" title="Load this model">
                  <i class="fa fa-download"></i>
                </button>
              </div>
              <div class="sample-card-progress" style="display:none;">
                <div class="sample-progress-bar"><div class="sample-progress-fill"></div></div>
                <span class="sample-progress-text">Fetching...</span>
              </div>
            </div>
          `
          ).join("")}
        </div>
      </div>
      <div class="samples-modal-footer">
        <button class="samples-modal-cancel">Cancel</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    setTimeout(() => {
      backdrop.classList.add("visible");
      modal.classList.add("visible");
    }, 10);

    const closeModal = () => {
      backdrop.classList.remove("visible");
      modal.classList.remove("visible");
      setTimeout(() => backdrop.remove(), 300);
    };

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });

    modal.querySelector(".samples-modal-close").onclick = closeModal;
    modal.querySelector(".samples-modal-cancel").onclick = closeModal;

    modal.querySelectorAll(".sample-load-btn").forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.sampleIndex);
        await this.fetchAndLoadSample(index, modal);
        closeModal();
      };
    });

    modal.querySelectorAll(".sample-card").forEach((card) => {
      card.onclick = async () => {
        const index = parseInt(card.dataset.sampleIndex);
        await this.fetchAndLoadSample(index, modal);
        closeModal();
      };
    });
  }

  async fetchAndLoadSample(index, modal) {
    const sample = SAMPLE_MODELS[index];
    if (!sample) return;

    const card = modal.querySelector(`.sample-card[data-sample-index="${index}"]`);
    const progressEl = card?.querySelector(".sample-card-progress");
    const progressFill = card?.querySelector(".sample-progress-fill");
    const progressText = card?.querySelector(".sample-progress-text");
    const loadBtn = card?.querySelector(".sample-load-btn");

    if (loadBtn) loadBtn.style.display = "none";
    if (progressEl) progressEl.style.display = "flex";

    const allCards = modal.querySelectorAll(".sample-card");
    allCards.forEach((c) => {
      if (c !== card) {
        c.style.opacity = "0.4";
        c.style.pointerEvents = "none";
      }
    });

    try {
      let arrayBuffer;

      if (this.sampleCache.has(sample.url)) {
        arrayBuffer = this.sampleCache.get(sample.url);
        if (progressText) progressText.textContent = "Cached!";
        if (progressFill) progressFill.style.width = "100%";
      } else {
        if (progressText) progressText.textContent = "Connecting...";
        if (progressFill) progressFill.style.width = "10%";

        const response = await fetch(sample.url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentLength = response.headers.get("content-length");
        const total = contentLength ? parseInt(contentLength) : 0;

        if (total && response.body) {
          const reader = response.body.getReader();
          const chunks = [];
          let received = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;

            const pct = Math.round((received / total) * 100);
            if (progressFill) progressFill.style.width = `${pct}%`;
            if (progressText) progressText.textContent = `${pct}% (${(received / 1024).toFixed(0)} KB)`;
          }

          const allChunks = new Uint8Array(received);
          let pos = 0;
          for (const chunk of chunks) {
            allChunks.set(chunk, pos);
            pos += chunk.length;
          }
          arrayBuffer = allChunks.buffer;
        } else {
          if (progressText) progressText.textContent = "Downloading...";
          if (progressFill) progressFill.style.width = "50%";
          arrayBuffer = await response.arrayBuffer();
        }

        if (progressFill) progressFill.style.width = "100%";
        if (progressText) progressText.textContent = "Done!";

        this.sampleCache.set(sample.url, arrayBuffer);
      }

      await this.loadModel(arrayBuffer, sample.fileName);
      speak(`Loaded sample: ${sample.name}`, "Load");
    } catch (error) {
      console.error("Error fetching sample model:", error);
      if (progressText) {
        progressText.textContent = `Error: ${error.message}`;
        progressText.style.color = "#ff4444";
      }
      if (progressFill) {
        progressFill.style.background = "#ff4444";
      }
      speak(`Failed to fetch ${sample.name}: ${error.message}`, "Error");

      allCards.forEach((c) => {
        c.style.opacity = "1";
        c.style.pointerEvents = "auto";
      });
      if (loadBtn) loadBtn.style.display = "flex";
      if (progressEl) progressEl.style.display = "none";

      throw error;
    }
  }

  setupRenderer(win, filePath) {
    const container = win.querySelector(".model3d-container");

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.01, 10000);
    this.camera.position.set(3, 2, 5);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 1000;
    this.controls.maxPolarAngle = Math.PI;

    this.setupLighting();
    this.setupHelpers();
    this.setBackground("gradient");

    this.lastTime = performance.now();
    this.frameCount = 0;
    this.animate();

    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    this.container = container;

    if (filePath) {
      this.loadModel(filePath, "");
    }
  }

  setupLighting() {
    this.mainLight = new THREE.DirectionalLight(0xffffff, 1);
    this.mainLight.position.set(5, 10, 7.5);
    this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.width = 2048;
    this.mainLight.shadow.mapSize.height = 2048;
    this.mainLight.shadow.camera.near = 0.5;
    this.mainLight.shadow.camera.far = 50;
    this.mainLight.shadow.camera.left = -10;
    this.mainLight.shadow.camera.right = 10;
    this.mainLight.shadow.camera.top = 10;
    this.mainLight.shadow.camera.bottom = -10;
    this.scene.add(this.mainLight);

    this.fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    this.fillLight.position.set(-5, 5, -5);
    this.scene.add(this.fillLight);

    this.ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);
  }

  setupHelpers() {
    this.gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
    this.gridHelper.material.opacity = 0.5;
    this.gridHelper.material.transparent = true;
    this.scene.add(this.gridHelper);

    this.axesHelper = new THREE.AxesHelper(5);
    this.scene.add(this.axesHelper);

    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -0.01;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);
  }

  setBackground(type) {
    if (this.bgMesh) {
      this.scene.remove(this.bgMesh);
      this.bgMesh = null;
    }

    if (this.cyberGrid) {
      this.scene.remove(this.cyberGrid);
      this.cyberGrid = null;
    }

    switch (type) {
      case "gradient":
        this.createGradientBackground(0x1a1a2e, 0x0f3460, 0x16213e);
        break;
      case "dark":
        this.scene.background = new THREE.Color(0x111111);
        break;
      case "light":
        this.scene.background = new THREE.Color(0xf0f0f0);
        break;
      case "studio":
        this.createGradientBackground(0x333333, 0x1a1a1a, 0x222222);
        break;
      case "sunset":
        this.createGradientBackground(0x2d1b4e, 0x562b41, 0x1e3a5f);
        break;
      case "cyber":
        this.createGradientBackground(0x0a0a0a, 0x1a0a2e, 0x0f1a2e);
        this.addCyberGrid();
        break;
    }
  }

  createGradientBackground(colorTop, colorMid, colorBottom) {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, `#${colorTop.toString(16).padStart(6, "0")}`);
    gradient.addColorStop(0.5, `#${colorMid.toString(16).padStart(6, "0")}`);
    gradient.addColorStop(1, `#${colorBottom.toString(16).padStart(6, "0")}`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);

    const texture = new THREE.CanvasTexture(canvas);
    this.scene.background = texture;
  }

  addCyberGrid() {
    this.cyberGrid = new THREE.GridHelper(50, 50, 0xff00ff, 0x00ffff);
    this.cyberGrid.material.opacity = 0.15;
    this.cyberGrid.material.transparent = true;
    this.cyberGrid.position.y = -0.02;
    this.scene.add(this.cyberGrid);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    this.controls.update();

    if (this.autoRotate && this.currentModel) {
      this.currentModel.rotation.y += 0.005;
    }

    if (this.mixer && this.isPlaying) {
      this.mixer.update(delta * this.animationSpeed);
      this.updateTimelineUI();
    }

    this.renderer.render(this.scene, this.camera);

    this.frameCount++;
    const now = performance.now();
    if (now - this.lastTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
      const fpsElement = this.win.querySelector("#status-fps");
      if (fpsElement) fpsElement.textContent = `FPS: ${fps}`;
      this.frameCount = 0;
      this.lastTime = now;
    }
  }

  updateTimelineUI() {
    if (!this.currentAction || !this.win) return;

    const clip = this.currentAction.getClip();
    const currentTime = this.currentAction.time;
    const duration = clip.duration;

    const slider = this.win.querySelector("#timeline-slider");
    const currentTimeEl = this.win.querySelector("#current-time");
    const totalTimeEl = this.win.querySelector("#total-time");

    if (slider && !this.isDraggingTimeline) {
      slider.value = (currentTime / duration) * 100;
    }

    if (currentTimeEl) {
      currentTimeEl.textContent = currentTime.toFixed(2);
    }

    if (totalTimeEl) {
      totalTimeEl.textContent = duration.toFixed(2);
    }
  }

  setupControls(win) {
    const buttons = win.querySelectorAll(".model3d-btn");
    buttons.forEach((btn) => {
      btn.onclick = () => {
        const action = btn.dataset.action;
        this.handleAction(action, btn);
      };
    });

    const bgButtons = win.querySelectorAll(".bg-btn");
    bgButtons.forEach((btn) => {
      btn.onclick = () => {
        bgButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.setBackground(btn.dataset.bg);
      };
    });

    const sliders = win.querySelectorAll(".model3d-slider");
    sliders.forEach((slider) => {
      slider.oninput = () => {
        const lightType = slider.dataset.light;
        const value = parseFloat(slider.value);
        if (lightType === "intensity") {
          this.mainLight.intensity = value;
          this.fillLight.intensity = value * 0.3;
        } else if (lightType === "ambient") {
          this.ambientLight.intensity = value;
        }
      };
    });
  }

  setupAnimationControls(win) {
    const transportBtns = win.querySelectorAll(".anim-control-btn");
    transportBtns.forEach((btn) => {
      btn.onclick = () => {
        const action = btn.dataset.animAction;
        this.handleAnimationTransport(action);
      };
    });

    const timelineSlider = win.querySelector("#timeline-slider");
    if (timelineSlider) {
      timelineSlider.addEventListener("mousedown", () => {
        this.isDraggingTimeline = true;
      });

      timelineSlider.addEventListener("mouseup", () => {
        this.isDraggingTimeline = false;
      });

      timelineSlider.addEventListener("input", () => {
        if (this.currentAction) {
          const clip = this.currentAction.getClip();
          const time = (timelineSlider.value / 100) * clip.duration;
          this.seekAnimation(time);
        }
      });
    }

    const speedSelect = win.querySelector("#speed-select");
    if (speedSelect) {
      speedSelect.onchange = () => {
        this.animationSpeed = parseFloat(speedSelect.value);
        if (this.currentAction) {
          this.currentAction.setEffectiveTimeScale(this.animationSpeed);
        }
      };
    }

    const loopCheckbox = win.querySelector("#loop-checkbox");
    if (loopCheckbox) {
      loopCheckbox.onchange = () => {
        this.loopAnimation = loopCheckbox.checked;
        if (this.currentAction) {
          this.currentAction.setLoop(this.loopAnimation ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
          this.currentAction.clampWhenFinished = !this.loopAnimation;
        }
      };
    }
  }

  handleAnimationTransport(action) {
    switch (action) {
      case "play":
        this.togglePlayPause();
        break;
      case "stop":
        this.stopAnimation();
        break;
      case "step-back":
        this.stepAnimation(-0.1);
        break;
      case "step-forward":
        this.stepAnimation(0.1);
        break;
    }
  }

  togglePlayPause() {
    if (!this.currentAction) {
      if (this.animations.length > 0) {
        this.playAnimation(0);
      }
      return;
    }

    const icon = this.win.querySelector("#play-pause-icon");

    if (this.isPlaying) {
      this.currentAction.paused = true;
      this.isPlaying = false;
      if (icon) {
        icon.classList.remove("fa-pause");
        icon.classList.add("fa-play");
      }
      this.updateAnimationStatus(false);
    } else {
      this.currentAction.paused = false;
      this.isPlaying = true;
      if (icon) {
        icon.classList.remove("fa-play");
        icon.classList.add("fa-pause");
      }
      this.updateAnimationStatus(true);
    }
  }

  stopAnimation() {
    if (!this.currentAction) return;

    this.currentAction.stop();
    this.isPlaying = false;

    const icon = this.win.querySelector("#play-pause-icon");
    if (icon) {
      icon.classList.remove("fa-pause");
      icon.classList.add("fa-play");
    }

    const slider = this.win.querySelector("#timeline-slider");
    if (slider) slider.value = 0;

    const currentTimeEl = this.win.querySelector("#current-time");
    if (currentTimeEl) currentTimeEl.textContent = "0.00";

    this.updateAnimationStatus(false);

    const animBtns = this.win.querySelectorAll(".anim-btn");
    animBtns.forEach((b) => b.classList.remove("playing"));
  }

  stepAnimation(delta) {
    if (!this.currentAction) {
      if (this.animations.length > 0) {
        this.playAnimation(0);
        this.currentAction.paused = true;
        this.isPlaying = false;
      }
      return;
    }

    const clip = this.currentAction.getClip();
    let newTime = this.currentAction.time + delta;

    if (newTime < 0) newTime = 0;
    if (newTime > clip.duration) newTime = clip.duration;

    this.seekAnimation(newTime);
  }

  seekAnimation(time) {
    if (!this.currentAction) return;

    this.currentAction.time = time;
    this.mixer.update(0);
    this.updateTimelineUI();
  }

  handleAction(action, btn) {
    switch (action) {
      case "open":
        this.openModelDialog();
        break;
      case "openBrowser":
        this.openFromBrowser();
        break;
      case "samples":
        this.openSamplesModal();
        break;
      case "screenshot":
        this.takeScreenshot();
        break;
      case "fullscreen":
        this.toggleFullscreen();
        break;
      case "wireframe":
        this.wireframe = !this.wireframe;
        btn.classList.toggle("active", this.wireframe);
        this.setWireframe(this.wireframe);
        break;
      case "autoRotate":
        this.autoRotate = !this.autoRotate;
        btn.classList.toggle("active", this.autoRotate);
        break;
      case "grid":
        this.showGrid = !this.showGrid;
        btn.classList.toggle("active", this.showGrid);
        this.gridHelper.visible = this.showGrid;
        break;
      case "axes":
        this.showAxes = !this.showAxes;
        btn.classList.toggle("active", this.showAxes);
        this.axesHelper.visible = this.showAxes;
        break;
      case "bones":
        this.showBones = !this.showBones;
        btn.classList.toggle("active", this.showBones);
        this.toggleSkeletonHelper(this.showBones);
        break;
      case "resetCamera":
        this.resetCamera();
        break;
      case "zoomFit":
        this.frameModel();
        break;
    }
  }

  toggleSkeletonHelper(show) {
    if (this.skeletonHelper) {
      this.skeletonHelper.visible = show;
    }
  }

  setupDragDrop(win) {
    const viewport = win.querySelector(".model3d-viewport");

    viewport.addEventListener("dragover", (e) => {
      e.preventDefault();
      viewport.classList.add("drag-over");
    });

    viewport.addEventListener("dragleave", (e) => {
      e.preventDefault();
      viewport.classList.remove("drag-over");
    });

    viewport.addEventListener("drop", async (e) => {
      e.preventDefault();
      viewport.classList.remove("drag-over");

      const file = e.dataTransfer.files[0];
      if (!file) return;

      const arrayBuffer = await file.arrayBuffer();
      await this.loadModel(arrayBuffer, file.name);
      speak(`Loaded model: ${file.name}`, "Load");
    });
  }

  openModelDialog() {
    speak("Looking for a model?", "Searching");
    this.explorerApp.open(async (path, fileName) => {
      const arrayBuffer = await this.fs.getFileContent(path, fileName, "arraybuffer");
      await this.loadModel(arrayBuffer, fileName);
      speak(`Loaded model: ${fileName}`, "Load");
    }, this);
  }

  openFromBrowser() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".obj,.gltf,.glb,.fbx,.dae,.3ds,.zip";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const arrayBuffer = await file.arrayBuffer();
      await this.loadModel(arrayBuffer, file.name);
      speak(`Loaded model: ${file.name}`, "Load");
    };
    input.click();
  }

  async takeScreenshot() {
    try {
      await this.fs.ensureFolder(["Pictures"]);

      const dataUrl = this.renderer.domElement.toDataURL("image/png");

      const base64Data = dataUrl.split(",")[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "image/png" });

      const modelName = this.currentFileName ? this.currentFileName.split(".")[0] : "model";
      const timestamp = Date.now();
      const fileName = `${modelName}-screenshot-${timestamp}.png`;

      await this.fs.writeBinaryFile(["Pictures"], fileName, blob, "image", dataUrl);

      speak(`Screenshot saved to Pictures/${fileName}`, "Screenshot");
    } catch (error) {
      console.error("Error saving screenshot:", error);
      speak("Failed to save screenshot", "Error");
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.container.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  setWireframe(enabled) {
    this.scene.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => (m.wireframe = enabled));
        } else {
          child.material.wireframe = enabled;
        }
      }
    });
  }

  resetCamera() {
    this.camera.position.set(3, 2, 5);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  getFileExtension(fileName) {
    return fileName.toLowerCase().split(".").pop();
  }

  async handleZipFile(fileData) {
    try {
      const zip = await JSZip.loadAsync(fileData);
      const supportedExtensions = ["obj", "gltf", "glb", "fbx", "dae", "3ds"];

      for (const [filename, file] of Object.entries(zip.files)) {
        if (file.dir) continue;

        const ext = this.getFileExtension(filename);
        if (supportedExtensions.includes(ext)) {
          const content = await file.async("arraybuffer");
          await this.loadModel(content, filename);
          speak(`Loaded ${filename} from zip`, "Load");
          return true;
        }
      }

      speak("No supported 3D models found in zip", "Error");
      return false;
    } catch (error) {
      console.error("Error reading zip file:", error);
      speak("Failed to read zip file", "Error");
      return false;
    }
  }

  showLoading(show) {
    const overlay = this.win.querySelector(".loading-overlay");
    if (overlay) overlay.style.display = show ? "flex" : "none";
  }

  hideWelcome() {
    const welcome = this.win.querySelector("#welcome-screen");
    if (welcome) welcome.style.display = "none";
  }

  async loadModel(fileData, fileName = "") {
    this.showLoading(true);
    this.hideWelcome();

    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.currentModel = null;
    }

    if (this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper);
      this.skeletonHelper = null;
    }

    this.animations = [];
    this.mixer = null;
    this.currentAction = null;
    this.currentAnimationIndex = -1;
    this.isPlaying = false;
    this.updateAnimationList([]);
    this.currentFileName = fileName;

    const ext = this.getFileExtension(fileName);

    if (ext === "zip") {
      await this.handleZipFile(fileData);
      this.showLoading(false);
      return;
    }

    try {
      let object;
      let animations = [];

      switch (ext) {
        case "obj":
          const objLoader = new OBJLoader();
          const objText = new TextDecoder().decode(fileData);
          object = objLoader.parse(objText);
          break;

        case "fbx":
          const fbxLoader = new FBXLoader();
          object = fbxLoader.parse(fileData, "");
          animations = object.animations || [];
          break;

        case "dae":
          const daeLoader = new ColladaLoader();
          const daeText = new TextDecoder().decode(fileData);
          const collada = daeLoader.parse(daeText, "");
          object = collada.scene;
          animations = collada.animations || [];
          break;

        case "3ds":
          const tdsLoader = new TDSLoader();
          object = tdsLoader.parse(fileData);
          break;

        case "gltf":
        case "glb":
        default:
          const gltfLoader = new GLTFLoader();
          const gltf = await new Promise((resolve, reject) => {
            gltfLoader.parse(fileData, "", resolve, reject);
          });
          object = gltf.scene;
          animations = gltf.animations || [];
          break;
      }

      if (object) {
        object.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.currentModel = object;
        this.scene.add(object);

        this.setupSkeleton(object);

        if (animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(object);
          this.animations = animations;

          this.mixer.addEventListener("finished", (e) => {
            if (!this.loopAnimation) {
              this.isPlaying = false;
              const icon = this.win.querySelector("#play-pause-icon");
              if (icon) {
                icon.classList.remove("fa-pause");
                icon.classList.add("fa-play");
              }
              this.updateAnimationStatus(false);
            }
          });

          this.updateAnimationList(animations);
          this.showAnimationControls(true);
        } else {
          this.showAnimationControls(false);
        }

        this.frameModel();
        this.updateModelInfo(object);
        this.updateStatus(fileName);
        this.addModelLabel(fileName);
      }
    } catch (error) {
      console.error("Error loading model:", error);
      speak(`Failed to load ${fileName}: ${error.message}`, "Error");
    }

    this.showLoading(false);
  }

  setupSkeleton(object) {
    let skeleton = null;
    let skinnedMesh = null;

    object.traverse((child) => {
      if (child.isSkinnedMesh) {
        skinnedMesh = child;
        skeleton = child.skeleton;
      }
    });

    if (skinnedMesh && skeleton) {
      this.skeletonHelper = new SkeletonHelper(skinnedMesh);
      this.skeletonHelper.visible = this.showBones;
      this.scene.add(this.skeletonHelper);

      this.updateBoneInfo(skeleton);

      const bonesBtn = this.win.querySelector('[data-action="bones"]');
      if (bonesBtn) {
        bonesBtn.style.display = "flex";
      }
    } else {
      const bonesBtn = this.win.querySelector('[data-action="bones"]');
      if (bonesBtn) {
        bonesBtn.style.display = "none";
      }

      const boneInfo = this.win.querySelector("#bone-info");
      if (boneInfo) {
        boneInfo.style.display = "none";
      }
    }
  }

  updateBoneInfo(skeleton) {
    const boneInfo = this.win.querySelector("#bone-info");
    const boneCount = this.win.querySelector("#info-bones");
    const boneList = this.win.querySelector("#bone-list");

    if (!boneInfo || !skeleton) return;

    boneInfo.style.display = "block";

    if (boneCount) {
      boneCount.textContent = skeleton.bones.length;
    }

    if (boneList) {
      const rootBones = skeleton.bones.filter((bone) => !bone.parent || !bone.parent.isBone);

      const buildBoneTree = (bone, depth = 0) => {
        let html = `<div class="bone-item ${depth === 0 ? "root" : ""}" style="padding-left: ${depth * 10}px;">
          ${bone.name || "Bone"}
        </div>`;

        bone.children.forEach((child) => {
          if (child.isBone) {
            html += buildBoneTree(child, depth + 1);
          }
        });

        return html;
      };

      let boneHtml = "";
      rootBones.forEach((rootBone) => {
        boneHtml += buildBoneTree(rootBone);
      });

      boneList.innerHTML = boneHtml || '<span class="no-animations">No bone hierarchy</span>';
    }
  }

  showAnimationControls(show) {
    const controls = this.win.querySelector("#animation-controls");
    if (controls) {
      controls.style.display = show ? "block" : "none";
    }
  }

  frameModel() {
    if (!this.currentModel) return;

    const box = new THREE.Box3().setFromObject(this.currentModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    this.currentModel.position.sub(center);

    if (this.skeletonHelper) {
      this.skeletonHelper.position.copy(this.currentModel.position);
    }

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.tan(fov / 2)) * 1.5;

    this.camera.position.set(cameraZ * 0.5, cameraZ * 0.3, cameraZ);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  updateModelInfo(object) {
    let vertices = 0;
    let faces = 0;
    let meshes = 0;
    const materials = new Set();
    const textures = new Set();

    object.traverse((child) => {
      if (child.isMesh) {
        meshes++;
        const geo = child.geometry;
        if (geo.attributes.position) {
          vertices += geo.attributes.position.count;
        }
        if (geo.index) {
          faces += geo.index.count / 3;
        } else if (geo.attributes.position) {
          faces += geo.attributes.position.count / 3;
        }

        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          materials.add(mat.uuid);
          if (mat.map) textures.add(mat.map.uuid);
          if (mat.normalMap) textures.add(mat.normalMap.uuid);
          if (mat.roughnessMap) textures.add(mat.roughnessMap.uuid);
        });
      }
    });

    this.win.querySelector("#info-vertices").textContent = vertices.toLocaleString();
    this.win.querySelector("#info-faces").textContent = Math.floor(faces).toLocaleString();
    this.win.querySelector("#info-meshes").textContent = meshes;
    this.win.querySelector("#info-materials").textContent = materials.size;
    this.win.querySelector("#info-textures").textContent = textures.size;
  }

  updateAnimationList(animations) {
    const list = this.win.querySelector("#animation-list");
    if (!list) return;

    if (animations.length === 0) {
      list.innerHTML = '<span class="no-animations">No animations</span>';
      this.updateAnimationStatus(false);
      return;
    }

    list.innerHTML = animations
      .map((anim, i) => {
        const duration = anim.duration.toFixed(2);
        return `
          <button class="anim-btn" data-index="${i}">
            <i class="fa fa-play"></i>
            <span class="anim-name">${anim.name || `Animation ${i + 1}`}</span>
            <span class="anim-duration">${duration}s</span>
          </button>
        `;
      })
      .join("");

    list.querySelectorAll(".anim-btn").forEach((btn) => {
      btn.onclick = () => {
        const index = parseInt(btn.dataset.index);
        this.selectAndPlayAnimation(index);
      };
    });
  }

  selectAndPlayAnimation(index) {
    const list = this.win.querySelector("#animation-list");

    list.querySelectorAll(".anim-btn").forEach((b) => {
      b.classList.remove("selected", "playing");
    });

    const btn = list.querySelector(`[data-index="${index}"]`);
    if (btn) {
      btn.classList.add("selected", "playing");
    }

    this.playAnimation(index);
  }

  playAnimation(index) {
    if (!this.mixer || !this.animations[index]) return;

    if (this.currentAction) {
      this.currentAction.fadeOut(0.3);
    }

    const clip = this.animations[index];
    this.currentAction = this.mixer.clipAction(clip);
    this.currentAnimationIndex = index;

    this.currentAction.setLoop(this.loopAnimation ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    this.currentAction.clampWhenFinished = !this.loopAnimation;
    this.currentAction.setEffectiveTimeScale(this.animationSpeed);

    this.currentAction.reset();
    this.currentAction.fadeIn(0.3);
    this.currentAction.play();

    this.isPlaying = true;

    const icon = this.win.querySelector("#play-pause-icon");
    if (icon) {
      icon.classList.remove("fa-play");
      icon.classList.add("fa-pause");
    }

    const totalTimeEl = this.win.querySelector("#total-time");
    if (totalTimeEl) {
      totalTimeEl.textContent = clip.duration.toFixed(2);
    }

    this.showAnimationOverlay(clip.name || `Animation ${index + 1}`);
    this.updateAnimationStatus(true, clip.name || `Animation ${index + 1}`);
  }

  showAnimationOverlay(name) {
    const overlay = this.win.querySelector("#animation-overlay");
    const nameEl = this.win.querySelector("#anim-overlay-name");

    if (overlay && nameEl) {
      nameEl.textContent = name;
      overlay.style.display = "block";

      setTimeout(() => {
        overlay.style.display = "none";
      }, 2000);
    }
  }

  updateAnimationStatus(playing, animName = "") {
    const statusAnim = this.win.querySelector("#status-anim");
    if (statusAnim) {
      if (playing && animName) {
        statusAnim.innerHTML = `<i class="fa fa-play"></i> ${animName}`;
        statusAnim.classList.add("playing");
      } else if (this.animations.length > 0) {
        statusAnim.innerHTML = `<i class="fa fa-film"></i> ${this.animations.length} animation(s)`;
        statusAnim.classList.remove("playing");
      } else {
        statusAnim.innerHTML = `<i class="fa fa-film"></i> No animation`;
        statusAnim.classList.remove("playing");
      }
    }
  }

  updateStatus(fileName) {
    const fileStatus = this.win.querySelector("#status-file");
    if (fileStatus) {
      fileStatus.innerHTML = `<i class="fa fa-file"></i> ${fileName}`;
    }
  }

  addModelLabel(fileName) {
    const fileStatus = this.win.querySelector("#status-file");
    if (fileStatus) {
      const name = fileName.split(".")[0];
      fileStatus.innerHTML = `<i class="fa fa-file"></i> ${name}`;
    }
  }
}
