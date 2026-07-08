import "../styles/model3d.css";
import { ClippyAnimation, speak } from "../ai/clippy.js";
import { unzipSync } from "fflate";
import { Achievements } from "../achievements.js";
import { BusEvents } from "../core/EventBus.js";
import { resolveGhUrl } from "../shared/assetResolver.js";
import { getLibraryUrl } from "../shared/cdnConfig.js";
import { KeybindManager } from "../keybindManager.js";
import { $, $$, bindEvent, toggleClass, addClass, removeClass, setText, setHTML } from "../shared/domUtils.js";

import { showAboutDialog } from "../shared/aboutDialog.js";
import { BaseApp, os } from "../framework.js";
const SAMPLE_MODELS = [
  {
    name: "Stanford Bunny",
    fileName: "bunny.obj",
    url: resolveGhUrl("https://cdn.jsdelivr.net/gh/glmark2/glmark2@master/data/models/bunny.obj"),
    icon: "fa-paw",
    description: "The classic Stanford bunny"
  },
  {
    name: "Cat",
    fileName: "cat.3ds",
    url: resolveGhUrl("https://cdn.jsdelivr.net/gh/glmark2/glmark2@master/data/models/cat.3ds"),
    icon: "fa-cat",
    description: "A cat, loaded from 3DS"
  },
  {
    name: "Cube",
    fileName: "cube.3ds",
    url: resolveGhUrl("https://cdn.jsdelivr.net/gh/glmark2/glmark2@master/data/models/cube.3ds"),
    icon: "fa-cube",
    description: "Just a plain cube"
  },
  {
    name: "Horse",
    fileName: "horse.3ds",
    url: resolveGhUrl("https://cdn.jsdelivr.net/gh/glmark2/glmark2@master/data/models/horse.3ds"),
    icon: "fa-horse",
    description: "A horse, loaded from 3DS"
  }
];

let THREE = null;
let GLTFLoader = null;
let OBJLoader = null;
let FBXLoader = null;
let ColladaLoader = null;
let TDSLoader = null;
let STLLoader = null;
let PLYLoader = null;
let OrbitControls = null;
let TransformControls = null;

async function loadThree() {
  if (THREE) return;
  if (__SINGLE_FILE__) {
    const mods = await Promise.all([
      import("three"),
      import("three/examples/jsm/loaders/GLTFLoader.js"),
      import("three/examples/jsm/loaders/OBJLoader.js"),
      import("three/examples/jsm/loaders/FBXLoader.js"),
      import("three/examples/jsm/loaders/ColladaLoader.js"),
      import("three/examples/jsm/loaders/TDSLoader.js"),
      import("three/examples/jsm/loaders/STLLoader.js"),
      import("three/examples/jsm/loaders/PLYLoader.js"),
      import("three/examples/jsm/controls/OrbitControls.js"),
      import("three/examples/jsm/controls/TransformControls.js")
    ]);
    THREE = mods[0];
    GLTFLoader = mods[1].GLTFLoader;
    OBJLoader = mods[2].OBJLoader;
    FBXLoader = mods[3].FBXLoader;
    ColladaLoader = mods[4].ColladaLoader;
    TDSLoader = mods[5].TDSLoader;
    STLLoader = mods[6].STLLoader;
    PLYLoader = mods[7].PLYLoader;
    OrbitControls = mods[8].OrbitControls;
    TransformControls = mods[9].TransformControls;
    return;
  }
  const baseUrl = getLibraryUrl("three");
  const mods = await Promise.all([
    import(/* @vite-ignore */ `${baseUrl}`),
    import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/GLTFLoader.js`),
    import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/OBJLoader.js`),
    import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/FBXLoader.js`),
    import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/ColladaLoader.js`),
    import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/TDSLoader.js`),
    import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/STLLoader.js`),
    import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/PLYLoader.js`),
    import(/* @vite-ignore */ `${baseUrl}/examples/jsm/controls/OrbitControls.js`),
    import(/* @vite-ignore */ `${baseUrl}/examples/jsm/controls/TransformControls.js`)
  ]);
  THREE = mods[0];
  GLTFLoader = mods[1].GLTFLoader;
  OBJLoader = mods[2].OBJLoader;
  FBXLoader = mods[3].FBXLoader;
  ColladaLoader = mods[4].ColladaLoader;
  TDSLoader = mods[5].TDSLoader;
  STLLoader = mods[6].STLLoader;
  PLYLoader = mods[7].PLYLoader;
  OrbitControls = mods[8].OrbitControls;
  TransformControls = mods[9].TransformControls;
}

class UndoStack {
  constructor(limit = 64) {
    this.stack = [];
    this.index = -1;
    this.limit = limit;
  }
  push(action) {
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(action);
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
  }
  undo() {
    if (this.index < 0) return null;
    const a = this.stack[this.index--];
    a.undo?.();
    return a;
  }
  redo() {
    if (this.index >= this.stack.length - 1) return null;
    const a = this.stack[++this.index];
    a.redo?.();
    return a;
  }
  canUndo() {
    return this.index >= 0;
  }
  canRedo() {
    return this.index < this.stack.length - 1;
  }
}

let _objIdCounter = 0;
class SceneObject {
  constructor(threeObj, name, type = "mesh") {
    this.id = ++_objIdCounter;
    this.object3D = threeObj;
    this.name = name || threeObj.name || `Object ${this.id}`;
    this.type = type;
    this.visible = true;
    this.selected = false;
    this.locked = false;
    this.children = [];
    this.parentId = null;
    threeObj.userData.__sceneObjectId = this.id;
  }
}

export class Model3DApp extends BaseApp {
  constructor(services) {
    super(services);
    this.explorerApp = services.explorerApp;

    this.sceneObjects = new Map();
    this.selectedIds = new Set();
    this.currentModel = null;
    this.currentFileName = "";
    this.sampleCache = new Map();

    this.renderMode = "lit";
    this.bgType = "gradient";
    this.showGrid = true;
    this.showAxes = true;
    this.showBones = false;
    this.autoRotate = false;
    this.wireframe = false;

    this.transformMode = "translate";
    this.transformSpace = "world";
    this.snapEnabled = false;
    this.snapGrid = 0.25;
    this.activeTool = "select";

    this.mixer = null;
    this.animations = [];
    this.currentAction = null;
    this.currentAnimationIndex = -1;
    this.clock = null;
    this.animationSpeed = 1.0;
    this.isPlaying = false;
    this.loopAnimation = true;
    this.isDraggingTimeline = false;

    this.lightIntensity = 1.0;
    this.ambientIntensity = 0.5;
    this.exposure = 1.0;

    this.bloomEnabled = false;
    this.ssaoEnabled = false;
    this.fxaaEnabled = true;

    this.isOrtho = false;
    this.orthoCam = null;
    this.perspCam = null;

    this.frameCount = 0;
    this.lastTime = 0;
    this.triangleCount = 0;
    this.drawCallCount = 0;

    this.undoStack = new UndoStack();

    this.skeletonHelper = null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.transformControls = null;
    this.gridHelper = null;
    this.axesHelper = null;
    this.groundPlane = null;
    this.mainLight = null;
    this.fillLight = null;
    this.ambientLight = null;
    this.hemiLight = null;
    this.bgMesh = null;
    this.cyberGrid = null;
    this.container = null;
    this.win = null;
  }

  _buildHTML(title) {
    return `
    <div class="window-header">
      <span><i class="fa fa-cube" style="color: white;margin-right: 6px;font-size: 25px;vertical-align: middle;"></i>${title}</span>
      ${os.window.getWindowControls()}
    </div>

    <!-- ── Menubar ── -->
    <div class="yb-menubar">
      <div class="yb-menu-item" data-menu="file"><span>File</span>
        <div class="yb-dropdown">
          <div class="yb-dropdown-item" data-action="open"><i class="fa fa-folder-open"></i> Open from Explorer</div>
          <div class="yb-dropdown-item" data-action="openBrowser"><i class="fa fa-upload"></i> Import File</div>
          <div class="yb-dropdown-item" data-action="samples"><i class="fa fa-archive"></i> Sample Models</div>
          <div class="yb-dropdown-sep"></div>
          <div class="yb-dropdown-item" data-action="exportGLTF"><i class="fa fa-file-export"></i> Export GLTF/GLB</div>
          <div class="yb-dropdown-item" data-action="exportOBJ"><i class="fa fa-file-code"></i> Export OBJ</div>
          <div class="yb-dropdown-item" data-action="exportSceneJSON"><i class="fa fa-file-alt"></i> Export Scene JSON</div>
          <div class="yb-dropdown-sep"></div>
          <div class="yb-dropdown-item" data-action="screenshot"><i class="fa fa-camera"></i> Save Screenshot</div>
        </div>
      </div>

      <div class="yb-menu-item" data-menu="edit"><span>Edit</span>
        <div class="yb-dropdown">
          <div class="yb-dropdown-item" data-action="undo"><i class="fa fa-undo"></i> Undo <span class="yb-shortcut">Ctrl+Z</span></div>
          <div class="yb-dropdown-item" data-action="redo"><i class="fa fa-redo"></i> Redo <span class="yb-shortcut">Ctrl+Y</span></div>
          <div class="yb-dropdown-sep"></div>
          <div class="yb-dropdown-item" data-action="duplicate"><i class="fa fa-clone"></i> Duplicate <span class="yb-shortcut">Ctrl+D</span></div>
          <div class="yb-dropdown-item" data-action="deleteSelected"><i class="fa fa-trash"></i> Delete Selected <span class="yb-shortcut">Del</span></div>
          <div class="yb-dropdown-sep"></div>
          <div class="yb-dropdown-item" data-action="selectAll"><i class="fa fa-object-group"></i> Select All <span class="yb-shortcut">Ctrl+A</span></div>
          <div class="yb-dropdown-item" data-action="deselectAll"><i class="fa fa-times-circle"></i> Deselect All <span class="yb-shortcut">Alt+A</span></div>
        </div>
      </div>

      <div class="yb-menu-item" data-menu="view"><span>View</span>
        <div class="yb-dropdown">
          <div class="yb-dropdown-label">Render Mode</div>
          <div class="yb-dropdown-item rm-item" data-rm="lit"><span class="yb-check" style="visibility:visible">✓</span> Lit</div>
          <div class="yb-dropdown-item rm-item" data-rm="solid"><span class="yb-check" style="visibility:hidden">✓</span> Solid</div>
          <div class="yb-dropdown-item rm-item" data-rm="wireframe"><span class="yb-check" style="visibility:hidden">✓</span> Wireframe</div>
          <div class="yb-dropdown-item rm-item" data-rm="texture"><span class="yb-check" style="visibility:hidden">✓</span> Texture Preview</div>
          <div class="yb-dropdown-sep"></div>
          <div class="yb-dropdown-label">Overlays</div>
          <div class="yb-dropdown-item toggle-item" data-action="grid"><span class="yb-check" style="visibility:visible">✓</span> Grid</div>
          <div class="yb-dropdown-item toggle-item" data-action="axes"><span class="yb-check" style="visibility:visible">✓</span> Axes</div>
          <div class="yb-dropdown-item toggle-item" data-action="bones"><span class="yb-check" style="visibility:hidden">✓</span> Skeleton</div>
          <div class="yb-dropdown-item toggle-item" data-action="autoRotate"><span class="yb-check" style="visibility:hidden">✓</span> Auto Rotate</div>
          <div class="yb-dropdown-sep"></div>
          <div class="yb-dropdown-item" data-action="toggleOrtho"><i class="fa fa-border-all"></i> Toggle Orthographic</div>
          <div class="yb-dropdown-item" data-action="resetCamera"><i class="fa fa-crosshairs"></i> Reset Camera</div>
          <div class="yb-dropdown-item" data-action="zoomFit"><i class="fa fa-expand-arrows-alt"></i> Frame Selection</div>
          <div class="yb-dropdown-sep"></div>
          <div class="yb-dropdown-item" data-action="fullscreen"><i class="fa fa-expand"></i> Fullscreen</div>
        </div>
      </div>

      <div class="yb-menu-item" data-menu="render"><span>Render</span>
        <div class="yb-dropdown">
          <div class="yb-dropdown-label">Background</div>
          <div class="yb-dropdown-item bg-item" data-bg="gradient"><span class="yb-check" style="visibility:visible">✓</span> Gradient</div>
          <div class="yb-dropdown-item bg-item" data-bg="dark"><span class="yb-check" style="visibility:hidden">✓</span> Dark</div>
          <div class="yb-dropdown-item bg-item" data-bg="light"><span class="yb-check" style="visibility:hidden">✓</span> Light</div>
          <div class="yb-dropdown-item bg-item" data-bg="studio"><span class="yb-check" style="visibility:hidden">✓</span> Studio</div>
          <div class="yb-dropdown-item bg-item" data-bg="sunset"><span class="yb-check" style="visibility:hidden">✓</span> Sunset</div>
          <div class="yb-dropdown-item bg-item" data-bg="cyber"><span class="yb-check" style="visibility:hidden">✓</span> Cyber</div>
          <div class="yb-dropdown-sep"></div>
          <div class="yb-dropdown-label">Post-Processing</div>
          <div class="yb-dropdown-item toggle-item" data-action="bloom"><span class="yb-check" style="visibility:hidden">✓</span> Bloom</div>
          <div class="yb-dropdown-item toggle-item" data-action="fxaa"><span class="yb-check" style="visibility:visible">✓</span> FXAA</div>
        </div>
      </div>

      <div class="yb-menu-item" data-menu="object"><span>Object</span>
        <div class="yb-dropdown">
          <div class="yb-dropdown-label">Add Primitive</div>
          <div class="yb-dropdown-item" data-action="addCube"><i class="fa fa-cube"></i> Cube</div>
          <div class="yb-dropdown-item" data-action="addSphere"><i class="fa fa-circle"></i> Sphere</div>
          <div class="yb-dropdown-item" data-action="addCylinder"><i class="fa fa-circle"></i> Cylinder</div>
          <div class="yb-dropdown-item" data-action="addPlane"><i class="fa fa-square"></i> Plane</div>
          <div class="yb-dropdown-item" data-action="addTorus"><i class="fa fa-ring"></i> Torus</div>
          <div class="yb-dropdown-sep"></div>
          <div class="yb-dropdown-item" data-action="addPointLight"><i class="fa fa-lightbulb"></i> Point Light</div>
          <div class="yb-dropdown-item" data-action="addSpotLight"><i class="fa fa-dot-circle"></i> Spot Light</div>
          <div class="yb-dropdown-sep"></div>
          <div class="yb-dropdown-item" data-action="duplicate"><i class="fa fa-clone"></i> Duplicate</div>
          <div class="yb-dropdown-item" data-action="deleteSelected"><i class="fa fa-trash"></i> Delete</div>
          <div class="yb-dropdown-sep"></div>
          <div class="yb-dropdown-item" data-action="recalcNormals"><i class="fa fa-project-diagram"></i> Recalculate Normals</div>
          <div class="yb-dropdown-item" data-action="flattenToWorld"><i class="fa fa-compress-arrows-alt"></i> Apply Transforms</div>
        </div>
      </div>

      <div class="yb-menu-item" data-menu="help"><span>Help</span>
        <div class="yb-dropdown">
          <div class="yb-dropdown-item" data-action="about"><i class="fa fa-info-circle"></i> About Yuki Blender</div>
        </div>
      </div>
    </div>

    <!-- ── Toolbar ── -->
    <div class="yb-toolbar">
      <div class="yb-toolbar-group">
        <button class="yb-tool-btn active" data-tool="select" title="Select (Q)"><i class="fa fa-mouse-pointer"></i></button>
        <button class="yb-tool-btn" data-tool="move" title="Move (G)"><i class="fa fa-arrows-alt"></i></button>
        <button class="yb-tool-btn" data-tool="rotate" title="Rotate (R)"><i class="fa fa-sync-alt"></i></button>
        <button class="yb-tool-btn" data-tool="scale" title="Scale (S)"><i class="fa fa-expand-arrows-alt"></i></button>
      </div>
      <div class="yb-toolbar-sep"></div>
      <div class="yb-toolbar-group">
        <button class="yb-tool-btn" data-tool="transformSpace" title="Toggle World/Local space"><i class="fa fa-globe"></i><span class="yb-tool-label" id="tb-space">WORLD</span></button>
      </div>
      <div class="yb-toolbar-sep"></div>
      <div class="yb-toolbar-group">
        <button class="yb-tool-btn" data-action="snapToggle" title="Snap (Ctrl+Shift+Tab)"><i class="fa fa-magnet"></i><span class="yb-tool-label" id="tb-snap">SNAP OFF</span></button>
      </div>
      <div class="yb-toolbar-sep"></div>
      <div class="yb-toolbar-group">
        <button class="yb-tool-btn" data-rm="lit" title="Lit mode"><i class="fa fa-sun"></i></button>
        <button class="yb-tool-btn" data-rm="solid" title="Solid mode"><i class="fa fa-adjust"></i></button>
        <button class="yb-tool-btn" data-rm="wireframe" title="Wireframe"><i class="fa fa-project-diagram"></i></button>
      </div>
      <div class="yb-toolbar-sep"></div>
      <div class="yb-toolbar-group">
        <button class="yb-tool-btn" data-action="zoomFit" title="Frame Selection (Numpad .)"><i class="fa fa-expand-arrows-alt"></i></button>
        <button class="yb-tool-btn" data-action="resetCamera" title="Reset Camera (Numpad 0)"><i class="fa fa-crosshairs"></i></button>
        <button class="yb-tool-btn" data-action="toggleOrtho" title="Ortho/Persp (Numpad 5)" id="tb-ortho"><i class="fa fa-border-all"></i><span class="yb-tool-label">PERSP</span></button>
      </div>
      <div class="yb-toolbar-spacer"></div>
      <div class="yb-toolbar-group">
        <button class="yb-tool-btn" data-action="screenshot" title="Screenshot"><i class="fa fa-camera"></i></button>
      </div>
    </div>

    <!-- ── Main Layout ── -->
    <div class="yb-body">

      <!-- Left: Outliner + Hierarchy -->
      <div class="yb-panel yb-panel-left" id="yb-panel-left">
        <div class="yb-panel-header">
          <span><i class="fa fa-sitemap"></i> Outliner</span>
          <button class="yb-panel-btn" data-action="addCube" title="Add object"><i class="fa fa-plus"></i></button>
        </div>
        <div class="yb-outliner" id="yb-outliner">
          <div class="yb-outliner-empty">Scene is empty</div>
        </div>
        <div class="yb-collections" id="yb-collections">
          <div class="yb-collection-row active" data-coll="default">
            <i class="fa fa-folder-open"></i><span>Scene Collection</span>
          </div>
        </div>
      </div>

      <!-- Center: Viewport -->
      <div class="yb-viewport-wrap">
        <div class="yb-viewport" id="yb-viewport">
          <div class="yb-canvas-host" id="yb-canvas-host"></div>

          <!-- Stats HUD -->
          <div class="yb-hud" id="yb-hud" style="display:none">
            <div class="yb-hud-row"><span class="yb-hl">Verts</span><span id="hud-verts">–</span></div>
            <div class="yb-hud-row"><span class="yb-hl">Tris</span><span id="hud-tris">–</span></div>
            <div class="yb-hud-row"><span class="yb-hl">Meshes</span><span id="hud-meshes">–</span></div>
            <div class="yb-hud-row"><span class="yb-hl">Mats</span><span id="hud-mats">–</span></div>
            <div class="yb-hud-row"><span class="yb-hl">Tex</span><span id="hud-tex">–</span></div>
          </div>

          <!-- Camera orientation cube (decorative) -->
          <div class="yb-nav-gizmo" id="yb-nav-gizmo" title="View axis">
            <div class="yb-nav-axis yb-axis-x">X</div>
            <div class="yb-nav-axis yb-axis-y">Y</div>
            <div class="yb-nav-axis yb-axis-z">Z</div>
          </div>

          <!-- Active tool indicator -->
          <div class="yb-active-tool-badge" id="yb-tool-badge">SELECT</div>

          <!-- Drag overlay -->
          <div class="yb-drag-overlay" id="yb-drag-overlay">
            <i class="fa fa-cube"></i>
            <span>Drop model to import</span>
          </div>

          <!-- Loading overlay -->
          <div class="yb-loading-overlay" id="yb-loading" style="display:none">
            <div class="yb-spinner"></div>
            <span id="yb-loading-text">Loading…</span>
          </div>

          <!-- Welcome screen -->
          <div class="yb-welcome" id="yb-welcome">
            <div class="yb-welcome-inner">
              <div class="yb-welcome-logo">
                <i class="fa fa-cube"></i>
              </div>
              <h2>Start Here</h2>
              <p>Browser-native 3D editor · Modeling · Animation · Scene editing</p>
              <div class="yb-welcome-formats">
                <span>.glb</span><span>.gltf</span><span>.obj</span><span>.fbx</span>
                <span>.dae</span><span>.3ds</span><span>.stl</span><span>.ply</span><span>.zip</span>
              </div>
              <div class="yb-welcome-actions">
                <button class="yb-welcome-btn yb-btn-primary" id="wb-browser"><i class="fa fa-upload"></i> Import File</button>
                <button class="yb-welcome-btn" id="wb-samples"><i class="fa fa-archive"></i> Sample Models</button>
                <button class="yb-welcome-btn" id="wb-new"><i class="fa fa-cube"></i> New Scene</button>
              </div>
            </div>
          </div>

          <!-- Selection info overlay -->
          <div class="yb-selection-info" id="yb-sel-info" style="display:none">
            <span id="yb-sel-label"></span>
          </div>
        </div>

        <!-- Timeline / Animation panel (bottom) -->
        <div class="yb-timeline" id="yb-timeline" style="display:none">
          <div class="yb-timeline-header">
            <span class="yb-tl-title"><i class="fa fa-film"></i> <span id="tl-anim-name">No Animation</span></span>
            <div class="yb-tl-transport">
              <button class="yb-tl-btn" data-anim="stop" title="Stop"><i class="fa fa-stop"></i></button>
              <button class="yb-tl-btn" data-anim="step-back" title="Step Back"><i class="fa fa-step-backward"></i></button>
              <button class="yb-tl-btn yb-tl-play" data-anim="play" title="Play/Pause"><i class="fa fa-play" id="tl-play-icon"></i></button>
              <button class="yb-tl-btn" data-anim="step-forward" title="Step Forward"><i class="fa fa-step-forward"></i></button>
            </div>
            <div class="yb-tl-time">
              <span class="yb-hl" id="tl-cur">0.00</span>
              <span style="color:oklch(30% 0.02 265)"> / </span>
              <span id="tl-dur">0.00</span>
              <span style="color:oklch(35% 0.03 265)">s</span>
            </div>
            <div class="yb-tl-speed">
              <label style="font-size:11px;color:oklch(45% 0.03 265)">Speed</label>
              <select id="tl-speed" class="yb-tl-select">
                <option value="0.25">0.25×</option>
                <option value="0.5">0.5×</option>
                <option value="1" selected>1×</option>
                <option value="1.5">1.5×</option>
                <option value="2">2×</option>
              </select>
            </div>
            <label class="yb-tl-loop">
              <input type="checkbox" id="tl-loop" checked> Loop
            </label>
            <button class="yb-tl-btn yb-tl-close" id="yb-tl-close" title="Hide timeline"><i class="fa fa-chevron-down"></i></button>
          </div>
          <div class="yb-tl-scrub-row">
            <input type="range" class="yb-tl-scrubber" id="tl-scrubber" min="0" max="100" step="0.01" value="0">
          </div>
          <div class="yb-tl-dopesheet" id="yb-dopesheet">
            <!-- keyframe markers injected here -->
          </div>
        </div>
      </div>

      <!-- Right: Inspector panel -->
      <div class="yb-panel yb-panel-right" id="yb-panel-right">
        <!-- Tab bar -->
        <div class="yb-inspector-tabs">
          <button class="yb-ins-tab active" data-tab="object">OBJ</button>
          <button class="yb-ins-tab" data-tab="material">MAT</button>
          <button class="yb-ins-tab" data-tab="scene">SCENE</button>
          <button class="yb-ins-tab" data-tab="anim">ANIM</button>
        </div>

        <!-- Object tab -->
        <div class="yb-ins-panel active" id="yb-ins-object">
          <div class="yb-ins-section">
            <div class="yb-ins-header">Transform</div>
            <div class="yb-ins-row">
              <label>Location</label>
              <div class="yb-xyz-row">
                <div class="yb-xyz-field"><span class="yb-xyz-lbl x">X</span><input type="number" class="yb-xyz-inp" id="tx-x" step="0.1" value="0"></div>
                <div class="yb-xyz-field"><span class="yb-xyz-lbl y">Y</span><input type="number" class="yb-xyz-inp" id="tx-y" step="0.1" value="0"></div>
                <div class="yb-xyz-field"><span class="yb-xyz-lbl z">Z</span><input type="number" class="yb-xyz-inp" id="tx-z" step="0.1" value="0"></div>
              </div>
            </div>
            <div class="yb-ins-row">
              <label>Rotation</label>
              <div class="yb-xyz-row">
                <div class="yb-xyz-field"><span class="yb-xyz-lbl x">X</span><input type="number" class="yb-xyz-inp" id="rx-x" step="1" value="0"></div>
                <div class="yb-xyz-field"><span class="yb-xyz-lbl y">Y</span><input type="number" class="yb-xyz-inp" id="rx-y" step="1" value="0"></div>
                <div class="yb-xyz-field"><span class="yb-xyz-lbl z">Z</span><input type="number" class="yb-xyz-inp" id="rx-z" step="1" value="0"></div>
              </div>
            </div>
            <div class="yb-ins-row">
              <label>Scale</label>
              <div class="yb-xyz-row">
                <div class="yb-xyz-field"><span class="yb-xyz-lbl x">X</span><input type="number" class="yb-xyz-inp" id="sx-x" step="0.01" value="1"></div>
                <div class="yb-xyz-field"><span class="yb-xyz-lbl y">Y</span><input type="number" class="yb-xyz-inp" id="sx-y" step="0.01" value="1"></div>
                <div class="yb-xyz-field"><span class="yb-xyz-lbl z">Z</span><input type="number" class="yb-xyz-inp" id="sx-z" step="0.01" value="1"></div>
              </div>
            </div>
          </div>
          <div class="yb-ins-section">
            <div class="yb-ins-header">Visibility</div>
            <div class="yb-ins-row-inline">
              <label>Visible in scene</label>
              <input type="checkbox" id="obj-visible" checked class="yb-toggle">
            </div>
            <div class="yb-ins-row-inline">
              <label>Cast shadows</label>
              <input type="checkbox" id="obj-cast-shadow" checked class="yb-toggle">
            </div>
            <div class="yb-ins-row-inline">
              <label>Receive shadows</label>
              <input type="checkbox" id="obj-recv-shadow" checked class="yb-toggle">
            </div>
          </div>
          <div class="yb-ins-section" id="ins-bones-section" style="display:none">
            <div class="yb-ins-header"><i class="fa fa-bone"></i> Skeleton</div>
            <div class="yb-ins-row-inline">
              <label>Bones</label><span id="ins-bone-count" class="yb-mono">–</span>
            </div>
            <div class="yb-bone-tree" id="ins-bone-tree"></div>
          </div>
          <div class="yb-ins-empty-msg" id="ins-obj-empty">
            <i class="fa fa-mouse-pointer"></i><br>Select an object
          </div>
        </div>

        <!-- Material tab -->
        <div class="yb-ins-panel" id="yb-ins-material">
          <div class="yb-ins-section" id="ins-mat-section">
            <div class="yb-ins-header">Material Slots</div>
            <div id="ins-mat-slots" class="yb-mat-slots"></div>
          </div>
          <div class="yb-ins-section" id="ins-mat-props">
            <div class="yb-ins-header">PBR Properties</div>
            <div class="yb-ins-row">
              <label>Color</label>
              <input type="color" id="mat-color" value="#cccccc" class="yb-color-pick">
            </div>
            <div class="yb-ins-slider-row">
              <label>Roughness</label>
              <input type="range" class="yb-slider" id="mat-roughness" min="0" max="1" step="0.01" value="0.5">
              <span class="yb-slider-val" id="mat-roughness-val">0.50</span>
            </div>
            <div class="yb-ins-slider-row">
              <label>Metalness</label>
              <input type="range" class="yb-slider" id="mat-metalness" min="0" max="1" step="0.01" value="0">
              <span class="yb-slider-val" id="mat-metalness-val">0.00</span>
            </div>
            <div class="yb-ins-slider-row">
              <label>Opacity</label>
              <input type="range" class="yb-slider" id="mat-opacity" min="0" max="1" step="0.01" value="1">
              <span class="yb-slider-val" id="mat-opacity-val">1.00</span>
            </div>
            <div class="yb-ins-row-inline">
              <label>Wireframe</label>
              <input type="checkbox" id="mat-wireframe" class="yb-toggle">
            </div>
            <div class="yb-ins-row-inline">
              <label>Double-sided</label>
              <input type="checkbox" id="mat-double-sided" class="yb-toggle">
            </div>
          </div>
          <div class="yb-ins-section">
            <div class="yb-ins-header">Textures</div>
            <div class="yb-tex-slot">
              <span class="yb-tex-type">Diffuse</span>
              <span class="yb-tex-name" id="tex-diffuse">–</span>
              <button class="yb-tex-btn" data-tex="diffuse" title="Assign texture"><i class="fa fa-folder-open"></i></button>
            </div>
            <div class="yb-tex-slot">
              <span class="yb-tex-type">Normal</span>
              <span class="yb-tex-name" id="tex-normal">–</span>
              <button class="yb-tex-btn" data-tex="normal" title="Assign texture"><i class="fa fa-folder-open"></i></button>
            </div>
            <div class="yb-tex-slot">
              <span class="yb-tex-type">Roughness</span>
              <span class="yb-tex-name" id="tex-roughness">–</span>
              <button class="yb-tex-btn" data-tex="roughness" title="Assign texture"><i class="fa fa-folder-open"></i></button>
            </div>
          </div>
          <div class="yb-ins-empty-msg" id="ins-mat-empty">
            <i class="fa fa-palette"></i><br>Select an object
          </div>
        </div>

        <!-- Scene tab -->
        <div class="yb-ins-panel" id="yb-ins-scene">
          <div class="yb-ins-section">
            <div class="yb-ins-header">Lighting</div>
            <div class="yb-ins-slider-row">
              <label>Sun Intensity</label>
              <input type="range" class="yb-slider" data-light="intensity" min="0" max="5" step="0.1" value="1">
              <span class="yb-slider-val" id="light-intensity-val">1.0</span>
            </div>
            <div class="yb-ins-slider-row">
              <label>Ambient</label>
              <input type="range" class="yb-slider" data-light="ambient" min="0" max="3" step="0.1" value="0.5">
              <span class="yb-slider-val" id="light-ambient-val">0.5</span>
            </div>
            <div class="yb-ins-slider-row">
              <label>Exposure</label>
              <input type="range" class="yb-slider" id="exposure-slider" min="0.1" max="4" step="0.05" value="1">
              <span class="yb-slider-val" id="exposure-val">1.0</span>
            </div>
            <div class="yb-ins-slider-row">
              <label>Gamma</label>
              <input type="range" class="yb-slider" id="gamma-slider" min="1" max="3" step="0.05" value="2.2">
              <span class="yb-slider-val" id="gamma-val">2.2</span>
            </div>
          </div>
          <div class="yb-ins-section">
            <div class="yb-ins-header">Overlays</div>
            <div class="yb-ins-slider-row">
              <label>Grid Size</label>
              <input type="range" class="yb-slider" id="grid-size" min="10" max="100" step="10" value="20">
              <span class="yb-slider-val" id="grid-size-val">20</span>
            </div>
            <div class="yb-ins-slider-row">
              <label>Grid Divs</label>
              <input type="range" class="yb-slider" id="grid-divs" min="10" max="100" step="10" value="20">
              <span class="yb-slider-val" id="grid-divs-val">20</span>
            </div>
          </div>
          <div class="yb-ins-section">
            <div class="yb-ins-header">Snap</div>
            <div class="yb-ins-row-inline">
              <label>Enable snap</label>
              <input type="checkbox" id="snap-toggle" class="yb-toggle">
            </div>
            <div class="yb-ins-slider-row">
              <label>Grid Step</label>
              <input type="range" class="yb-slider" id="snap-step" min="0.05" max="2" step="0.05" value="0.25">
              <span class="yb-slider-val" id="snap-step-val">0.25</span>
            </div>
          </div>
          <div class="yb-ins-section">
            <div class="yb-ins-header">Renderer Stats</div>
            <div class="yb-stats-grid" id="yb-stats-grid">
              <div class="yb-stat-row"><span class="yb-hl">FPS</span><span id="stat-fps" class="yb-mono">–</span></div>
              <div class="yb-stat-row"><span class="yb-hl">Triangles</span><span id="stat-tris" class="yb-mono">–</span></div>
              <div class="yb-stat-row"><span class="yb-hl">Draw Calls</span><span id="stat-draws" class="yb-mono">–</span></div>
              <div class="yb-stat-row"><span class="yb-hl">Geometries</span><span id="stat-geo" class="yb-mono">–</span></div>
              <div class="yb-stat-row"><span class="yb-hl">Textures</span><span id="stat-tex" class="yb-mono">–</span></div>
            </div>
          </div>
        </div>

        <!-- Animation tab -->
        <div class="yb-ins-panel" id="yb-ins-anim">
          <div class="yb-ins-section">
            <div class="yb-ins-header">Animations</div>
            <div class="yb-anim-list" id="yb-anim-list">
              <span class="yb-empty-label">No animations to show</span>
            </div>
          </div>
          <div class="yb-ins-section" id="ins-bones-anim" style="display:none">
            <div class="yb-ins-header">Skeleton</div>
            <div class="yb-ins-row-inline">
              <label>Bones</label><span id="ins-bone-count2" class="yb-mono">–</span>
            </div>
            <div class="yb-bone-tree" id="ins-bone-tree2"></div>
          </div>
          <div class="yb-ins-empty-msg" id="ins-anim-empty">
            <i class="fa fa-film"></i><br>Load a model
          </div>
        </div>

      </div>
    </div>

    <!-- ── Status bar ── -->
    <div class="yb-statusbar">
      <span class="yb-sb-item" id="sb-fps">FPS: --</span>
      <span class="yb-sb-sep"></span>
      <span class="yb-sb-item" id="sb-mode">OBJECT MODE</span>
      <span class="yb-sb-sep"></span>
      <span class="yb-sb-item" id="sb-file"><i class="fa fa-file"></i> No model</span>
      <span class="yb-sb-sep"></span>
      <span class="yb-sb-item" id="sb-sel">–</span>
      <span class="yb-sb-sep" style="margin-left:auto"></span>
      <span class="yb-sb-item" id="sb-anim"><i class="fa fa-film"></i> –</span>
      <span class="yb-sb-sep"></span>
      <span class="yb-sb-item" id="sb-renderer"><i class="fa fa-microchip"></i> WebGL2</span>
    </div>
    `;
  }

  async open(titleOrOptions = "Yuki Blender", filePath = null) {
    let title = "Yuki Blender";
    let fileData = null;
    let fileName = "";

    if (titleOrOptions && typeof titleOrOptions === "object" && !Array.isArray(titleOrOptions)) {
      title = titleOrOptions.title || "Yuki Blender";
      filePath = titleOrOptions.filePath || filePath;
      fileData = titleOrOptions.fileData || titleOrOptions.content || null;
      fileName = titleOrOptions.fileName || titleOrOptions.name || "";
    } else if (typeof titleOrOptions === "string") {
      title = titleOrOptions;
    }

    const winId = `model3d-${Date.now()}`;
    if (document.getElementById(winId)) {
      os.window.focus(document.getElementById(winId));
      return;
    }

    const win = os.window.create(winId, title, "1080px", "640px", {
      icon: "static/icons/3dmodel.webp"
    });
    win.classList.add("yb-window");
    win.innerHTML = this._buildHTML(title);

    this.win = win;

    this._setupMenus();
    this._setupToolbar();
    this._setupInspectorTabs();
    this._setupInspectorControls();
    this._setupKeyboardShortcuts();
    this._setupDragDrop();
    this._setupWelcomeButtons();

    await this._setupRenderer(filePath, fileData, fileName);
    this._setupAnimationTimeline();
  }

  _setupMenus() {
    const win = this.win;
    const menuItems = $$(".yb-menu-item", win);
    let activeMenu = null;
    const closeAll = () => {
      menuItems.forEach((m) => m.classList.remove("active"));
      activeMenu = null;
    };

    menuItems.forEach((mi) => {
      bindEvent(mi, "click", (e) => {
        e.stopPropagation();
        if (mi.classList.contains("active")) {
          closeAll();
        } else {
          closeAll();
          mi.classList.add("active");
          activeMenu = mi;
        }
      });
      bindEvent(mi, "mouseenter", () => {
        if (activeMenu && activeMenu !== mi) {
          closeAll();
          mi.classList.add("active");
          activeMenu = mi;
        }
      });
    });

    document.addEventListener("click", closeAll);

    $$(".yb-dropdown-item[data-action]", win).forEach((item) => {
      bindEvent(item, "click", (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        const isToggle = item.classList.contains("toggle-item");
        if (isToggle) {
          const chk = $(".yb-check", item);
          const newState = chk.style.visibility !== "visible";
          chk.style.visibility = newState ? "visible" : "hidden";
          this._handleToggle(action, newState);
        } else {
          this._handleAction(action);
        }
        closeAll();
      });
    });

    $$(".rm-item[data-rm]", win).forEach((item) => {
      bindEvent(item, "click", (e) => {
        e.stopPropagation();
        $$(".rm-item .yb-check", win).forEach((c) => (c.style.visibility = "hidden"));
        $(".yb-check", item).style.visibility = "visible";
        this._setRenderMode(item.dataset.rm);
        closeAll();
      });
    });

    $$(".bg-item[data-bg]", win).forEach((item) => {
      bindEvent(item, "click", (e) => {
        e.stopPropagation();
        $$(".bg-item .yb-check", win).forEach((c) => (c.style.visibility = "hidden"));
        $(".yb-check", item).style.visibility = "visible";
        this.setBackground(item.dataset.bg);
        closeAll();
      });
    });
  }

  _setupToolbar() {
    const win = this.win;

    $$(".yb-tool-btn[data-tool]", win).forEach((btn) => {
      bindEvent(btn, "click", () => {
        const tool = btn.dataset.tool;
        if (tool === "transformSpace") {
          this._toggleTransformSpace();
          return;
        }
        this._setActiveTool(tool);
      });
    });

    $$(".yb-tool-btn[data-rm]", win).forEach((btn) => {
      bindEvent(btn, "click", () => this._setRenderMode(btn.dataset.rm));
    });

    $$(".yb-tool-btn[data-action]", win).forEach((btn) => {
      bindEvent(btn, "click", () => this._handleAction(btn.dataset.action));
    });
  }

  _setActiveTool(tool) {
    this.activeTool = tool;
    $$(".yb-tool-btn[data-tool]", this.win).forEach((b) => {
      toggleClass(b, "active", b.dataset.tool === tool);
    });
    const badge = $("#yb-tool-badge", this.win);
    if (badge) setText(badge, tool.toUpperCase());

    if (this.transformControls) {
      if (tool === "move") {
        this.transformControls.mode = "translate";
        this.transformControls.enabled = true;
      } else if (tool === "rotate") {
        this.transformControls.mode = "rotate";
        this.transformControls.enabled = true;
      } else if (tool === "scale") {
        this.transformControls.mode = "scale";
        this.transformControls.enabled = true;
      } else {
        this.transformControls.enabled = false;
      }
    }
    this._updateStatusBar();
  }

  _toggleTransformSpace() {
    this.transformSpace = this.transformSpace === "world" ? "local" : "world";
    const lbl = $("#tb-space", this.win);
    if (lbl) setText(lbl, this.transformSpace.toUpperCase());
    if (this.transformControls) {
      this.transformControls.space = this.transformSpace;
    }
  }

  _setupInspectorTabs() {
    $$(".yb-ins-tab", this.win).forEach((tab) => {
      bindEvent(tab, "click", () => {
        $$(".yb-ins-tab", this.win).forEach((t) => removeClass(t, "active"));
        $$(".yb-ins-panel", this.win).forEach((p) => removeClass(p, "active"));
        addClass(tab, "active");
        const panel = $(`#yb-ins-${tab.dataset.tab}`, this.win);
        if (panel) addClass(panel, "active");
      });
    });
  }

  _setupInspectorControls() {
    const win = this.win;

    $$(".yb-slider[data-light]", win).forEach((slider) => {
      slider.oninput = () => {
        const t = slider.dataset.light;
        const v = parseFloat(slider.value);
        if (t === "intensity") {
          this.lightIntensity = v;
          if (this.mainLight) this.mainLight.intensity = v;
          if (this.fillLight) this.fillLight.intensity = v * 0.3;
          const lbl = $("#light-intensity-val", win);
          if (lbl) setText(lbl, v.toFixed(1));
        } else if (t === "ambient") {
          this.ambientIntensity = v;
          if (this.ambientLight) this.ambientLight.intensity = v;
          const lbl = $("#light-ambient-val", win);
          if (lbl) setText(lbl, v.toFixed(1));
        }
      };
    });

    const expSlider = $("#exposure-slider", win);
    if (expSlider) {
      expSlider.oninput = () => {
        this.exposure = parseFloat(expSlider.value);
        if (this.renderer) this.renderer.toneMappingExposure = this.exposure;
        const lbl = $("#exposure-val", win);
        if (lbl) setText(lbl, this.exposure.toFixed(1));
      };
    }

    const gridSizeSlider = $("#grid-size", win);
    const gridDivsSlider = $("#grid-divs", win);
    if (gridSizeSlider) {
      gridSizeSlider.oninput = () => {
        const lbl = $("#grid-size-val", win);
        if (lbl) setText(lbl, gridSizeSlider.value);
        this._rebuildGrid(parseInt(gridSizeSlider.value), parseInt(gridDivsSlider?.value || 20));
      };
    }
    if (gridDivsSlider) {
      gridDivsSlider.oninput = () => {
        const lbl = $("#grid-divs-val", win);
        if (lbl) setText(lbl, gridDivsSlider.value);
        this._rebuildGrid(parseInt(gridSizeSlider?.value || 20), parseInt(gridDivsSlider.value));
      };
    }

    const snapToggle = $("#snap-toggle", win);
    if (snapToggle) {
      snapToggle.onchange = () => {
        this.snapEnabled = snapToggle.checked;
        const lbl = $("#tb-snap", win);
        if (lbl) setText(lbl, this.snapEnabled ? "SNAP ON" : "SNAP OFF");
        if (this.transformControls) {
          this.transformControls.setTranslationSnap(this.snapEnabled ? this.snapGrid : null);
          this.transformControls.setRotationSnap(this.snapEnabled ? THREE.MathUtils.degToRad(15) : null);
          this.transformControls.setScaleSnap(this.snapEnabled ? 0.25 : null);
        }
      };
    }
    const snapStepSlider = $("#snap-step", win);
    if (snapStepSlider) {
      snapStepSlider.oninput = () => {
        this.snapGrid = parseFloat(snapStepSlider.value);
        const lbl = $("#snap-step-val", win);
        if (lbl) setText(lbl, this.snapGrid.toFixed(2));
        if (this.snapEnabled && this.transformControls) {
          this.transformControls.setTranslationSnap(this.snapGrid);
        }
      };
    }

    ["tx-x", "tx-y", "tx-z", "rx-x", "rx-y", "rx-z", "sx-x", "sx-y", "sx-z"].forEach((id) => {
      const inp = $(`#${id}`, win);
      if (inp) inp.onchange = () => this._applyTransformFromInspector();
    });

    const objVisible = $("#obj-visible", win);
    if (objVisible)
      objVisible.onchange = () => {
        const sel = this._getFirstSelected();
        if (sel) {
          sel.object3D.visible = objVisible.checked;
          sel.visible = objVisible.checked;
        }
      };
    const objCast = $("#obj-cast-shadow", win);
    if (objCast)
      objCast.onchange = () => {
        const sel = this._getFirstSelected();
        if (sel)
          sel.object3D.traverse((c) => {
            if (c.isMesh) c.castShadow = objCast.checked;
          });
      };
    const objRecv = $("#obj-recv-shadow", win);
    if (objRecv)
      objRecv.onchange = () => {
        const sel = this._getFirstSelected();
        if (sel)
          sel.object3D.traverse((c) => {
            if (c.isMesh) c.receiveShadow = objRecv.checked;
          });
      };

    this._setupMaterialControls();

    $$(".yb-tex-btn[data-tex]", win).forEach((btn) => {
      btn.onclick = () => this._assignTexture(btn.dataset.tex);
    });

    const addBtn = $(".yb-panel-btn[data-action='addCube']", win);
    if (addBtn) addBtn.onclick = () => this._handleAction("addCube");
  }

  _setupMaterialControls() {
    const win = this.win;
    const syncMat = () => {
      const sel = this._getFirstSelected();
      if (!sel) return;
      let mat = null;
      sel.object3D.traverse((c) => {
        if (c.isMesh && !mat) mat = Array.isArray(c.material) ? c.material[0] : c.material;
      });
      if (!mat) return;

      const col = $("#mat-color", win);
      if (col) mat.color?.setStyle(col.value);
      const rough = $("#mat-roughness", win);
      if (rough && mat.roughness !== undefined) mat.roughness = parseFloat(rough.value);
      const metal = $("#mat-metalness", win);
      if (metal && mat.metalness !== undefined) mat.metalness = parseFloat(metal.value);
      const opac = $("#mat-opacity", win);
      if (opac) {
        mat.opacity = parseFloat(opac.value);
        mat.transparent = mat.opacity < 1;
      }
      const wf = $("#mat-wireframe", win);
      if (wf) mat.wireframe = wf.checked;
      const ds = $("#mat-double-sided", win);
      if (ds) mat.side = ds.checked ? THREE.DoubleSide : THREE.FrontSide;
      mat.needsUpdate = true;
    };

    ["mat-color", "mat-roughness", "mat-metalness", "mat-opacity", "mat-wireframe", "mat-double-sided"].forEach(
      (id) => {
        const el = $(`#${id}`, win);
        if (el) {
          bindEvent(el, "input", () => {
            const valEl = $(`#${id}-val`, win);
            if (valEl) setText(valEl, parseFloat(el.value).toFixed(2));
            syncMat();
          });
          bindEvent(el, "change", syncMat);
        }
      }
    );
  }

  _setupKeyboardShortcuts() {
    const handler = (e) => {
      if (!this.win?.isConnected) {
        document.removeEventListener("keydown", handler);
        return;
      }
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (KeybindManager.matches(e, "model3d.undo")) {
        e.preventDefault();
        this.undoStack.undo();
      } else if (KeybindManager.matches(e, "model3d.redo") || KeybindManager.matches(e, "model3d.redoAlt")) {
        e.preventDefault();
        this.undoStack.redo();
      } else if (KeybindManager.matches(e, "model3d.duplicate")) {
        e.preventDefault();
        this._handleAction("duplicate");
      } else if (KeybindManager.matches(e, "model3d.selectAll")) {
        e.preventDefault();
        this._handleAction("selectAll");
      } else if (KeybindManager.matches(e, "model3d.delete") || KeybindManager.matches(e, "model3d.backspace")) {
        this._handleAction("deleteSelected");
      } else if (e.key === "q" || e.key === "Q") this._setActiveTool("select");
      else if (e.key === "g" || e.key === "G") this._setActiveTool("move");
      else if (e.key === "r" || e.key === "R") this._setActiveTool("rotate");
      else if (e.key === "s" && !e.ctrlKey && !e.altKey && !e.metaKey) this._setActiveTool("scale");
      else if (e.key === "h" || e.key === "H") this._handleAction("toggleVisibility");
      else if (e.key === "f" || e.key === "F") this._handleAction("zoomFit");
    };
    document.addEventListener("keydown", handler);
  }

  _setupDragDrop() {
    const viewport = $("#yb-viewport", this.win);
    const overlay = $("#yb-drag-overlay", this.win);
    bindEvent(viewport, "dragover", (e) => {
      e.preventDefault();
      addClass(overlay, "active");
    });
    bindEvent(viewport, "dragleave", () => removeClass(overlay, "active"));
    bindEvent(viewport, "drop", async (e) => {
      e.preventDefault();
      removeClass(overlay, "active");
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const ab = await file.arrayBuffer();
      await this.loadModel(ab, file.name);
      os.notify.send(`Loaded: ${file.name}`, "Load");
    });
  }

  _setupWelcomeButtons() {
    const win = this.win;
    const btn = (id, fn) => {
      const el = $(id, win);
      if (el) el.onclick = fn;
    };
    btn("#wb-browser", () => this._handleAction("openBrowser"));
    btn("#wb-samples", () => this.openSamplesModal());
    btn("#wb-new", () => this._newScene());
  }

  async _setupRenderer(filePath, fileData, fileName) {
    await loadThree();

    const host = $("#yb-canvas-host", this.win);

    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();

    const w = host.clientWidth || 800,
      h = host.clientHeight || 500;

    this.perspCam = new THREE.PerspectiveCamera(60, w / h, 0.01, 10000);
    this.perspCam.position.set(3, 2, 5);
    this.orthoCam = new THREE.OrthographicCamera(-5, 5, 5 * (h / w), -5 * (h / w), 0.01, 10000);
    this.orthoCam.position.copy(this.perspCam.position);
    this.camera = this.perspCam;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.01;
    this.controls.maxDistance = 10000;

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.enabled = false;
    this.transformControls.space = this.transformSpace;
    this.transformControls.addEventListener("dragging-changed", (e) => {
      this.controls.enabled = !e.value;
    });
    this.transformControls.addEventListener("objectChange", () => {
      this._syncTransformToInspector();
    });
    this.scene.add(this.transformControls);

    this._setupLighting();
    this._setupHelpers();
    this.setBackground("gradient");

    const canvas = this.renderer.domElement;
    const raycaster = new THREE.Raycaster();
    canvas.addEventListener("click", (e) => {
      if (this.activeTool !== "select") return;
      if (this.transformControls?.dragging) return;
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, this.camera);
      const meshes = [];
      this.scene.traverse((c) => {
        if (c.isMesh && c.userData.__sceneObjectId) meshes.push(c);
      });
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        const id = hits[0].object.userData.__sceneObjectId;
        if (!e.shiftKey) this._selectOnly(id);
        else this._toggleSelect(id);
      } else if (!e.shiftKey) {
        this._deselectAll();
      }
    });

    const ro = new ResizeObserver(() => {
      const cw = host.clientWidth,
        ch = host.clientHeight;
      this.perspCam.aspect = cw / ch;
      this.perspCam.updateProjectionMatrix();
      const hh = ch / cw;
      this.orthoCam.left = -this.orthoCam.right;
      this.orthoCam.top = this.orthoCam.right * hh;
      this.orthoCam.bottom = -this.orthoCam.top;
      this.orthoCam.updateProjectionMatrix();
      this.renderer.setSize(cw, ch);
    });
    ro.observe(host);
    this.container = host;

    this.lastTime = performance.now();
    this.frameCount = 0;
    this._animate();

    if (!fileData && filePath) {
      try {
        const path = Array.isArray(filePath) ? filePath : [filePath];
        const actualFileName =
          fileName || (typeof filePath === "string" ? filePath.split("/").pop() : path[path.length - 1]);
        const parentPath = typeof filePath === "string" ? filePath.split("/").slice(0, -1) : path.slice(0, -1);
        const blob = await os.fs.read([...parentPath, actualFileName]);
        if (blob?.size > 0) {
          fileData = await blob.arrayBuffer();
          fileName = actualFileName;
        }
      } catch (err) {
        console.error("Error reading file in Yuki Blender:", err);
      }
    }
    if (fileData) await this.loadModel(fileData, fileName);
  }

  _setupLighting() {
    this.mainLight = new THREE.DirectionalLight(0xffffff, 1);
    this.mainLight.position.set(5, 10, 7.5);
    this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.set(2048, 2048);
    this.mainLight.shadow.camera.near = 0.5;
    this.mainLight.shadow.camera.far = 100;
    this.mainLight.shadow.camera.left = -15;
    this.mainLight.shadow.camera.right = 15;
    this.mainLight.shadow.camera.top = 15;
    this.mainLight.shadow.camera.bottom = -15;
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

  _setupHelpers() {
    this.gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
    this.gridHelper.material.opacity = 0.5;
    this.gridHelper.material.transparent = true;
    this.scene.add(this.gridHelper);

    this.axesHelper = new THREE.AxesHelper(3);
    this.scene.add(this.axesHelper);

    const groundMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    this.groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), groundMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -0.01;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);
  }

  _rebuildGrid(size = 20, divs = 20) {
    if (this.gridHelper) this.scene.remove(this.gridHelper);
    this.gridHelper = new THREE.GridHelper(size, divs, 0x444444, 0x333333);
    this.gridHelper.material.opacity = 0.5;
    this.gridHelper.material.transparent = true;
    this.gridHelper.visible = this.showGrid;
    this.scene.add(this.gridHelper);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    if (!this.win?.isConnected) return;

    const delta = this.clock.getDelta();
    this.controls.update();

    if (this.autoRotate && this.currentModel) this.currentModel.rotation.y += 0.005;
    if (this.mixer && this.isPlaying) {
      this.mixer.update(delta * this.animationSpeed);
      this._updateTimelineUI();
    }

    this.renderer.render(this.scene, this.camera);

    this.frameCount++;
    const now = performance.now();
    if (now - this.lastTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
      this._updateStats(fps);
      this.frameCount = 0;
      this.lastTime = now;
    }
  }

  _updateStats(fps) {
    const win = this.win;
    const info = this.renderer.info;
    const set = (id, v) => {
      const el = $(id, win);
      if (el) setText(el, v);
    };
    set("#sb-fps", `FPS: ${fps}`);
    set("#stat-fps", fps);
    set("#stat-tris", (info.render?.triangles || 0).toLocaleString());
    set("#stat-draws", info.render?.calls || 0);
    set("#stat-geo", info.memory?.geometries || 0);
    set("#stat-tex", info.memory?.textures || 0);
  }

  setBackground(type) {
    this.bgType = type;
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
        this._gradientBg(0x1a1a2e, 0x0f3460, 0x16213e);
        break;
      case "dark":
        this.scene.background = new THREE.Color(0x111111);
        break;
      case "light":
        this.scene.background = new THREE.Color(0xf0f0f0);
        break;
      case "studio":
        this._gradientBg(0x333333, 0x1a1a1a, 0x222222);
        break;
      case "sunset":
        this._gradientBg(0x2d1b4e, 0x562b41, 0x1e3a5f);
        break;
      case "cyber":
        this._gradientBg(0x0a0a0a, 0x1a0a2e, 0x0f1a2e);
        this.cyberGrid = new THREE.GridHelper(50, 50, 0xff00ff, 0x00ffff);
        this.cyberGrid.material.opacity = 0.15;
        this.cyberGrid.material.transparent = true;
        this.cyberGrid.position.y = -0.02;
        this.scene.add(this.cyberGrid);
        break;
    }
  }

  _gradientBg(top, mid, bot) {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, `#${top.toString(16).padStart(6, "0")}`);
    g.addColorStop(0.5, `#${mid.toString(16).padStart(6, "0")}`);
    g.addColorStop(1, `#${bot.toString(16).padStart(6, "0")}`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 512);
    this.scene.background = new THREE.CanvasTexture(canvas);
  }

  _setRenderMode(mode) {
    this.renderMode = mode;
    $$(".yb-tool-btn[data-rm]", this.win).forEach((b) => {
      toggleClass(b, "active", b.dataset.rm === mode);
    });
    this.scene.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        if (!mat) return;
        switch (mode) {
          case "lit":
            mat.wireframe = false;
            mat.color?.set(mat._originalColor || "#cccccc");
            break;
          case "wireframe":
            mat.wireframe = true;
            break;
          case "solid":
            mat.wireframe = false;
            if (!mat._originalColor) mat._originalColor = mat.color?.getHexString?.() || "cccccc";
            mat.color?.set(0x888888);
            break;
          case "texture":
            mat.wireframe = false;
            break;
        }
        mat.needsUpdate = true;
      });
    });
    this._updateStatusBar();
  }

  _registerObject(obj3d, name, type = "mesh") {
    const so = new SceneObject(obj3d, name, type);
    this.sceneObjects.set(so.id, so);
    this._refreshOutliner();
    return so;
  }

  _removeSceneObject(id) {
    const so = this.sceneObjects.get(id);
    if (!so) return;
    this.scene.remove(so.object3D);
    this.sceneObjects.delete(id);
    this.selectedIds.delete(id);
    this._refreshOutliner();
  }

  _refreshOutliner() {
    const outliner = $("#yb-outliner", this.win);
    if (!outliner) return;
    if (this.sceneObjects.size === 0) {
      setHTML(outliner, '<div class="yb-outliner-empty">Scene is empty</div>');
      return;
    }
    setHTML(outliner, "");
    this.sceneObjects.forEach((so) => {
      const row = document.createElement("div");
      row.className = "yb-outliner-row" + (so.selected ? " selected" : "") + (so.visible ? "" : " hidden");
      row.dataset.id = so.id;
      setHTML(
        row,
        `
        <span class="yb-ol-type-icon"><i class="fa ${so.type === "light" ? "fa-lightbulb" : so.type === "group" ? "fa-object-group" : "fa-cube"}"></i></span>
        <span class="yb-ol-name">${so.name}</span>
        <span class="yb-ol-actions">
          <button class="yb-ol-vis-btn" title="Toggle visibility" data-id="${so.id}"><i class="fa ${so.visible ? "fa-eye" : "fa-eye-slash"}"></i></button>
        </span>
      `
      );
      row.addEventListener("click", (e) => {
        if (e.target.closest(".yb-ol-vis-btn")) return;
        if (e.shiftKey) this._toggleSelect(so.id);
        else this._selectOnly(so.id);
      });
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this._showOutlinerContextMenu(e, so.id);
      });
      row.querySelector(".yb-ol-vis-btn").onclick = (e) => {
        e.stopPropagation();
        so.visible = !so.visible;
        so.object3D.visible = so.visible;
        this._refreshOutliner();
      };
      outliner.appendChild(row);
    });
  }

  _showOutlinerContextMenu(e, id) {
    const existing = document.querySelector(".yb-context-menu");
    if (existing) existing.remove();

    const so = this.sceneObjects.get(id);
    if (!so) return;

    const menu = document.createElement("div");
    menu.className = "yb-context-menu";
    menu.style.left = e.clientX + "px";
    menu.style.top = e.clientY + "px";
    menu.innerHTML = `
      <div class="yb-ctx-item" data-act="select"><i class="fa fa-mouse-pointer"></i> Select</div>
      <div class="yb-ctx-item" data-act="duplicate"><i class="fa fa-clone"></i> Duplicate</div>
      <div class="yb-ctx-item" data-act="rename"><i class="fa fa-pen"></i> Rename</div>
      <div class="yb-ctx-sep"></div>
      <div class="yb-ctx-item" data-act="visibility"><i class="fa ${so.visible ? "fa-eye-slash" : "fa-eye"}"></i> ${so.visible ? "Hide" : "Show"}</div>
      <div class="yb-ctx-sep"></div>
      <div class="yb-ctx-item yb-ctx-danger" data-act="delete"><i class="fa fa-trash"></i> Delete</div>
    `;
    menu.querySelectorAll(".yb-ctx-item").forEach((item) => {
      item.onclick = () => {
        const act = item.dataset.act;
        if (act === "select") this._selectOnly(id);
        else if (act === "duplicate") {
          this._selectOnly(id);
          this._handleAction("duplicate");
        } else if (act === "rename") this._renameObject(id);
        else if (act === "visibility") {
          so.visible = !so.visible;
          so.object3D.visible = so.visible;
          this._refreshOutliner();
        } else if (act === "delete") this._removeSceneObject(id);
        menu.remove();
      };
    });
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener("click", () => menu.remove(), { once: true }), 50);
  }

  async _renameObject(id) {
    const so = this.sceneObjects.get(id);
    if (!so) return;
    const newName = await os.dialog.prompt("Rename Object", "Give it a name:", so.name, "Rename");
    if (newName && newName.trim()) {
      so.name = newName.trim();
      so.object3D.name = so.name;
      this._refreshOutliner();
    }
  }

  _selectOnly(id) {
    this.selectedIds.clear();
    this.sceneObjects.forEach((s) => (s.selected = false));
    const so = this.sceneObjects.get(id);
    if (so) {
      so.selected = true;
      this.selectedIds.add(id);
    }
    this._onSelectionChanged();
  }

  _toggleSelect(id) {
    const so = this.sceneObjects.get(id);
    if (!so) return;
    if (so.selected) {
      so.selected = false;
      this.selectedIds.delete(id);
    } else {
      so.selected = true;
      this.selectedIds.add(id);
    }
    this._onSelectionChanged();
  }

  _deselectAll() {
    this.selectedIds.clear();
    this.sceneObjects.forEach((s) => (s.selected = false));
    this._onSelectionChanged();
  }

  _handleAction_selectAll() {
    this.sceneObjects.forEach((s) => {
      s.selected = true;
      this.selectedIds.add(s.id);
    });
    this._onSelectionChanged();
  }

  _getFirstSelected() {
    for (const id of this.selectedIds) {
      return this.sceneObjects.get(id) || null;
    }
    return null;
  }

  _onSelectionChanged() {
    this._refreshOutliner();
    this._updateTransformGizmo();
    this._syncTransformToInspector();
    this._syncMaterialToInspector();
    this._updateSelectionInfo();
    this._updateStatusBar();
  }

  _updateTransformGizmo() {
    if (!this.transformControls) return;
    const sel = this._getFirstSelected();
    if (sel && this.activeTool !== "select") {
      this.transformControls.attach(sel.object3D);
    } else {
      this.transformControls.detach();
    }
  }

  _syncTransformToInspector() {
    const sel = this._getFirstSelected();
    if (!sel) return;
    const o = sel.object3D;
    const RAD2DEG = THREE.MathUtils.radToDeg;
    const set = (id, v) => {
      const el = $(`#${id}`, this.win);
      if (el) el.value = parseFloat(v.toFixed(4));
    };
    set("tx-x", o.position.x);
    set("tx-y", o.position.y);
    set("tx-z", o.position.z);
    set("rx-x", RAD2DEG(o.rotation.x));
    set("rx-y", RAD2DEG(o.rotation.y));
    set("rx-z", RAD2DEG(o.rotation.z));
    set("sx-x", o.scale.x);
    set("sx-y", o.scale.y);
    set("sx-z", o.scale.z);
    const insEmpty = $("#ins-obj-empty", this.win);
    if (insEmpty) insEmpty.style.display = "none";
  }

  _syncMaterialToInspector() {
    const sel = this._getFirstSelected();
    const empty = $("#ins-mat-empty", this.win);
    if (!sel) {
      if (empty) empty.style.display = "flex";
      return;
    }
    if (empty) empty.style.display = "none";

    let mat = null;
    const slots = [];
    sel.object3D.traverse((c) => {
      if (c.isMesh) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => {
          if (m && !slots.find((s) => s.uuid === m.uuid)) slots.push(m);
        });
        if (!mat && mats[0]) mat = mats[0];
      }
    });

    const slotEl = $("#ins-mat-slots", this.win);
    if (slotEl) {
      setHTML(
        slotEl,
        slots
          .map(
            (m, i) => `
        <div class="yb-mat-slot ${i === 0 ? "active" : ""}" data-index="${i}">
          <span class="yb-mat-swatch" style="background:${m.color ? "#" + m.color.getHexString() : "#ccc"}"></span>
          <span>${m.name || `Material ${i + 1}`}</span>
        </div>
      `
          )
          .join("")
      );
    }

    if (!mat) return;
    const get = (id) => $(`#${id}`, this.win);
    const setVal = (id, v) => {
      const el = get(id);
      if (el) el.value = v;
    };
    const setTxt = (id, t) => {
      const el = get(id);
      if (el) setText(el, t);
    };

    if (mat.color) setVal("mat-color", "#" + mat.color.getHexString());
    setVal("mat-roughness", mat.roughness ?? 0.5);
    setTxt("mat-roughness-val", (mat.roughness ?? 0.5).toFixed(2));
    setVal("mat-metalness", mat.metalness ?? 0);
    setTxt("mat-metalness-val", (mat.metalness ?? 0).toFixed(2));
    setVal("mat-opacity", mat.opacity ?? 1);
    setTxt("mat-opacity-val", (mat.opacity ?? 1).toFixed(2));
    if (get("mat-wireframe")) get("mat-wireframe").checked = mat.wireframe ?? false;
    if (get("mat-double-sided")) get("mat-double-sided").checked = mat.side === THREE.DoubleSide;

    setTxt("tex-diffuse", mat.map?.name || mat.map?.uuid?.slice(0, 8) || "–");
    setTxt("tex-normal", mat.normalMap?.name || "–");
    setTxt("tex-roughness", mat.roughnessMap?.name || "–");
  }

  _applyTransformFromInspector() {
    const sel = this._getFirstSelected();
    if (!sel) return;
    const o = sel.object3D;
    const DEG2RAD = THREE.MathUtils.degToRad;
    const get = (id) => parseFloat($(`#${id}`, this.win)?.value || 0);
    o.position.set(get("tx-x"), get("tx-y"), get("tx-z"));
    o.rotation.set(DEG2RAD(get("rx-x")), DEG2RAD(get("rx-y")), DEG2RAD(get("rx-z")));
    o.scale.set(get("sx-x"), get("sx-y"), get("sx-z"));
  }

  _updateSelectionInfo() {
    const info = $("#yb-sel-info", this.win);
    const lbl = $("#yb-sel-label", this.win);
    if (!info || !lbl) return;
    if (this.selectedIds.size === 0) {
      info.style.display = "none";
      return;
    }
    const sel = this._getFirstSelected();
    setText(lbl, sel ? sel.name : `${this.selectedIds.size} objects`);
    info.style.display = "flex";
  }

  _updateStatusBar() {
    const win = this.win;
    const set = (id, v) => {
      const el = $(id, win);
      if (el) setText(el, v);
    };
    set("#sb-mode", `${this.activeTool.toUpperCase()} · ${this.renderMode.toUpperCase()}`);
    const selCount = this.selectedIds.size;
    set("#sb-sel", selCount > 0 ? `${selCount} selected` : "Nothing selected");
  }

  _addPrimitive(type) {
    if (!THREE) return;
    let geo, name;
    switch (type) {
      case "cube":
        geo = new THREE.BoxGeometry(1, 1, 1);
        name = "Cube";
        break;
      case "sphere":
        geo = new THREE.SphereGeometry(0.5, 32, 16);
        name = "Sphere";
        break;
      case "cylinder":
        geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
        name = "Cylinder";
        break;
      case "plane":
        geo = new THREE.PlaneGeometry(2, 2);
        name = "Plane";
        break;
      case "torus":
        geo = new THREE.TorusGeometry(0.5, 0.2, 16, 48);
        name = "Torus";
        break;
      default:
        return;
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const so = this._registerObject(mesh, name, "mesh");
    this._hideWelcome();
    this._selectOnly(so.id);
    const hud = $("#yb-hud", this.win);
    if (hud) hud.style.display = "block";
    os.notify.send(`Added ${name}`, "Scene");
  }

  _addLight(type) {
    if (!THREE) return;
    let light, name;
    if (type === "point") {
      light = new THREE.PointLight(0xffffff, 1, 100);
      light.position.set(2, 3, 2);
      name = "Point Light";
    } else {
      light = new THREE.SpotLight(0xffffff, 1);
      light.position.set(3, 5, 3);
      name = "Spot Light";
    }
    this.scene.add(light);
    const helper = type === "point" ? new THREE.PointLightHelper(light, 0.3) : new THREE.SpotLightHelper(light);
    this.scene.add(helper);
    this._registerObject(light, name, "light");
    os.notify.send(`Added ${name}`, "Scene");
  }

  _showLoading(show, text = "Loading…") {
    const el = $("#yb-loading", this.win);
    const tx = $("#yb-loading-text", this.win);
    if (el) el.style.display = show ? "flex" : "none";
    if (tx) setText(tx, text);
  }

  _hideWelcome() {
    const w = $("#yb-welcome", this.win);
    if (w) w.style.display = "none";
  }

  _newScene() {
    this.sceneObjects.forEach((so) => this.scene.remove(so.object3D));
    this.sceneObjects.clear();
    this.selectedIds.clear();
    this.currentModel = null;
    this.currentFileName = "";
    this.mixer = null;
    this.animations = [];
    this.currentAction = null;
    this.isPlaying = false;
    if (this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper);
      this.skeletonHelper = null;
    }
    this._refreshOutliner();
    this._refreshAnimations([]);
    const hud = $("#yb-hud", this.win);
    if (hud) hud.style.display = "none";
    const tl = $("#yb-timeline", this.win);
    if (tl) tl.style.display = "none";
    const welcome = $("#yb-welcome", this.win);
    if (welcome) welcome.style.display = "flex";
    const sbFile = $("#sb-file", this.win);
    if (sbFile) setHTML(sbFile, '<i class="fa fa-file"></i> No model');
    os.notify.send("New scene created", "Scene");
  }

  async loadModel(fileData, fileName = "") {
    await loadThree();
    this._showLoading(true, `Opening ${fileName}…`);
    this._hideWelcome();

    if (this.currentModel) {
      this.sceneObjects.forEach((so, id) => {
        if (so.object3D === this.currentModel) this.sceneObjects.delete(id);
      });
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
    this.currentFileName = fileName;

    const ext = fileName.toLowerCase().split(".").pop();

    if (ext === "zip") {
      await this._handleZip(fileData);
      this._showLoading(false);
      return;
    }

    try {
      let object,
        animations = [];

      switch (ext) {
        case "obj": {
          const loader = new OBJLoader();
          object = loader.parse(new TextDecoder().decode(fileData));
          break;
        }
        case "fbx": {
          const loader = new FBXLoader();
          object = loader.parse(fileData, "");
          animations = object.animations || [];
          break;
        }
        case "dae": {
          const loader = new ColladaLoader();
          const result = loader.parse(new TextDecoder().decode(fileData), "");
          object = result.scene;
          animations = result.animations || [];
          break;
        }
        case "3ds": {
          const loader = new TDSLoader();
          object = loader.parse(fileData);
          break;
        }
        case "stl": {
          const loader = new STLLoader();
          const geo = loader.parse(fileData);
          const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0 });
          object = new THREE.Mesh(geo, mat);
          break;
        }
        case "ply": {
          const loader = new PLYLoader();
          const geo = loader.parse(fileData);
          geo.computeVertexNormals();
          const mat = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.5,
            metalness: 0,
            vertexColors: geo.hasAttribute("color")
          });
          object = new THREE.Mesh(geo, mat);
          break;
        }
        case "gltf":
        case "glb":
        default: {
          const loader = new GLTFLoader();
          const gltf = await new Promise((res, rej) => loader.parse(fileData, "", res, rej));
          object = gltf.scene;
          animations = gltf.animations || [];
          break;
        }
      }

      if (object) {
        object.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.scene.add(object);
        this.currentModel = object;

        const name = fileName.replace(/\.[^.]+$/, "") || "Imported Model";
        const so = this._registerObject(object, name, "group");

        this._setupSkeleton(object);

        if (animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(object);
          this.animations = animations;
          this.mixer.addEventListener("finished", () => {
            if (!this.loopAnimation) {
              this.isPlaying = false;
              const icon = $("#tl-play-icon", this.win);
              if (icon) {
                removeClass(icon, "fa-pause");
                addClass(icon, "fa-play");
              }
            }
          });
          this._refreshAnimations(animations);
          this._showTimeline(true);
        } else {
          this._refreshAnimations([]);
          this._showTimeline(false);
        }

        this._frameModel();
        this._updateModelHUD(object);
        this._updateFileStatus(fileName);
        this._selectOnly(so.id);

        const hud = $("#yb-hud", this.win);
        if (hud) hud.style.display = "block";

        os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.ModelViewer });
      }
    } catch (err) {
      console.error("Yuki Blender load error:", err);
      os.notify.send(`Couldn't load ${fileName}: ${err.message}`, "Error");
    }

    this._showLoading(false);
  }

  async _handleZip(fileData) {
    try {
      const unzipped = unzipSync(new Uint8Array(fileData));
      const supported = ["obj", "gltf", "glb", "fbx", "dae", "3ds", "stl", "ply"];
      for (const [fname, bytes] of Object.entries(unzipped)) {
        if (fname.endsWith("/")) continue;
        const ext = fname.toLowerCase().split(".").pop();
        if (supported.includes(ext)) {
          const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          await this.loadModel(ab, fname);
          os.notify.send(`Loaded ${fname} from zip`, "Load");
          return true;
        }
      }
      os.notify.send("No loadable models in that zip", "Error");
      return false;
    } catch (err) {
      os.notify.send("Couldn't read that zip file", "Error");
      return false;
    }
  }

  _frameModel() {
    if (!this.currentModel) return;
    const box = new THREE.Box3().setFromObject(this.currentModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    this.currentModel.position.sub(center);
    if (this.skeletonHelper) this.skeletonHelper.position.copy(this.currentModel.position);
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const cameraZ = Math.abs(maxDim / Math.tan(fov / 2)) * 1.5;
    this.camera.position.set(cameraZ * 0.5, cameraZ * 0.3, cameraZ);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  _updateModelHUD(object) {
    let verts = 0,
      tris = 0,
      meshes = 0;
    const mats = new Set(),
      texs = new Set();
    object.traverse((c) => {
      if (!c.isMesh) return;
      meshes++;
      const geo = c.geometry;
      if (geo.attributes.position) verts += geo.attributes.position.count;
      if (geo.index) tris += geo.index.count / 3;
      else if (geo.attributes.position) tris += geo.attributes.position.count / 3;
      const ms = Array.isArray(c.material) ? c.material : [c.material];
      ms.forEach((m) => {
        if (!m) return;
        mats.add(m.uuid);
        if (m.map) texs.add(m.map.uuid);
        if (m.normalMap) texs.add(m.normalMap.uuid);
      });
    });
    const set = (id, v) => {
      const el = $(id, this.win);
      if (el) setText(el, v);
    };
    set("#hud-verts", verts.toLocaleString());
    set("#hud-tris", Math.floor(tris).toLocaleString());
    set("#hud-meshes", meshes);
    set("#hud-mats", mats.size);
    set("#hud-tex", texs.size);
  }

  _updateFileStatus(fileName) {
    const el = $("#sb-file", this.win);
    if (el) setHTML(el, `<i class="fa fa-file"></i> ${fileName}`);
  }

  _setupSkeleton(object) {
    let skeleton = null,
      skinnedMesh = null;
    object.traverse((c) => {
      if (c.isSkinnedMesh) {
        skinnedMesh = c;
        skeleton = c.skeleton;
      }
    });

    if (skinnedMesh && skeleton) {
      this.skeletonHelper = new THREE.SkeletonHelper(skinnedMesh);
      this.skeletonHelper.visible = this.showBones;
      this.scene.add(this.skeletonHelper);

      const count = skeleton.bones.length;
      ["#ins-bone-count", "#ins-bone-count2"].forEach((id) => {
        const el = $(id, this.win);
        if (el) setText(el, count);
      });

      const buildTree = (bone, depth = 0) => {
        let html = `<div class="yb-bone-item" style="padding-left:${depth * 10}px">${bone.name || "Bone"}</div>`;
        bone.children.filter((c) => c.isBone).forEach((c) => (html += buildTree(c, depth + 1)));
        return html;
      };
      const roots = skeleton.bones.filter((b) => !b.parent?.isBone);
      const treeHtml = roots.map((b) => buildTree(b)).join("");

      ["#ins-bone-tree", "#ins-bone-tree2"].forEach((id) => {
        const el = $(id, this.win);
        if (el) setHTML(el, treeHtml || "<span class='yb-empty-label'>–</span>");
      });

      ["#ins-bones-section", "#ins-bones-anim"].forEach((id) => {
        const el = $(id, this.win);
        if (el) el.style.display = "block";
      });
    } else {
      ["#ins-bones-section", "#ins-bones-anim"].forEach((id) => {
        const el = $(id, this.win);
        if (el) el.style.display = "none";
      });
    }
  }

  _setupAnimationTimeline() {
    const win = this.win;

    $$(".yb-tl-btn[data-anim]", win).forEach((btn) => {
      btn.onclick = () => this._handleAnimTransport(btn.dataset.anim);
    });

    const scrubber = $("#tl-scrubber", win);
    if (scrubber) {
      bindEvent(scrubber, "mousedown", () => (this.isDraggingTimeline = true));
      bindEvent(scrubber, "mouseup", () => (this.isDraggingTimeline = false));
      bindEvent(scrubber, "input", () => {
        if (this.currentAction) {
          const clip = this.currentAction.getClip();
          this.seekAnimation((scrubber.value / 100) * clip.duration);
        }
      });
    }

    const speed = $("#tl-speed", win);
    if (speed) {
      speed.onchange = () => {
        this.animationSpeed = parseFloat(speed.value);
        if (this.currentAction) this.currentAction.setEffectiveTimeScale(this.animationSpeed);
      };
    }

    const loop = $("#tl-loop", win);
    if (loop) {
      loop.onchange = () => {
        this.loopAnimation = loop.checked;
        if (this.currentAction) {
          this.currentAction.setLoop(this.loopAnimation ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
          this.currentAction.clampWhenFinished = !this.loopAnimation;
        }
      };
    }

    const tlClose = $("#yb-tl-close", win);
    if (tlClose) tlClose.onclick = () => this._showTimeline(false);
  }

  _showTimeline(show) {
    const tl = $("#yb-timeline", this.win);
    if (tl) tl.style.display = show ? "block" : "none";
  }

  _refreshAnimations(animations) {
    const list = $("#yb-anim-list", this.win);
    const empty = $("#ins-anim-empty", this.win);
    if (!list) return;

    if (animations.length === 0) {
      setHTML(list, '<span class="yb-empty-label">No animations</span>');
      if (empty) empty.style.display = "flex";
      const sb = $("#sb-anim", this.win);
      if (sb) setHTML(sb, '<i class="fa fa-film"></i> –');
      return;
    }
    if (empty) empty.style.display = "none";

    list.innerHTML = animations
      .map(
        (anim, i) => `
      <div class="yb-anim-row" data-index="${i}">
        <i class="fa fa-play-circle"></i>
        <span class="yb-anim-rowname">${anim.name || `Animation ${i + 1}`}</span>
        <span class="yb-anim-dur">${anim.duration.toFixed(2)}s</span>
      </div>
    `
      )
      .join("");

    list.querySelectorAll(".yb-anim-row").forEach((row) => {
      row.onclick = () => {
        list.querySelectorAll(".yb-anim-row").forEach((r) => r.classList.remove("active"));
        row.classList.add("active");
        this._playAnimation(parseInt(row.dataset.index));
      };
    });

    const dopesheet = this.win.querySelector("#yb-dopesheet");
    if (dopesheet && animations[0]) {
      const totalDur = Math.max(...animations.map((a) => a.duration));
      dopesheet.innerHTML = animations
        .map((anim, i) => {
          const tracks = anim.tracks || [];
          const keyTimes = new Set();
          tracks.forEach((t) => {
            if (t.times) t.times.forEach((time) => keyTimes.add(time));
          });
          const markers = [...keyTimes]
            .map((t) => {
              const pct = (t / totalDur) * 100;
              return `<div class="yb-ds-key" style="left:${pct}%"></div>`;
            })
            .join("");
          return `
          <div class="yb-ds-track">
            <div class="yb-ds-track-label">${anim.name || `Anim ${i + 1}`}</div>
            <div class="yb-ds-track-keys">${markers}</div>
          </div>
        `;
        })
        .join("");
    }

    const sb = this.win.querySelector("#sb-anim");
    if (sb) sb.innerHTML = `<i class="fa fa-film"></i> ${animations.length} anim(s)`;
  }

  _playAnimation(index) {
    if (!this.mixer || !this.animations[index]) return;
    if (this.currentAction) this.currentAction.fadeOut(0.2);

    const clip = this.animations[index];
    this.currentAction = this.mixer.clipAction(clip);
    this.currentAnimationIndex = index;
    this.currentAction.setLoop(this.loopAnimation ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    this.currentAction.clampWhenFinished = !this.loopAnimation;
    this.currentAction.setEffectiveTimeScale(this.animationSpeed);
    this.currentAction.reset().fadeIn(0.2).play();
    this.isPlaying = true;

    const icon = this.win.querySelector("#tl-play-icon");
    if (icon) {
      icon.classList.remove("fa-play");
      icon.classList.add("fa-pause");
    }

    const dur = this.win.querySelector("#tl-dur");
    if (dur) dur.textContent = clip.duration.toFixed(2);

    const name = this.win.querySelector("#tl-anim-name");
    if (name) name.textContent = clip.name || `Animation ${index + 1}`;

    const sb = this.win.querySelector("#sb-anim");
    if (sb) sb.innerHTML = `<i class="fa fa-play"></i> ${clip.name || `Anim ${index + 1}`}`;

    this._showTimeline(true);
  }

  _handleAnimTransport(action) {
    switch (action) {
      case "play":
        this._togglePlayPause();
        break;
      case "stop":
        this._stopAnimation();
        break;
      case "step-back":
        this._stepAnimation(-0.1);
        break;
      case "step-forward":
        this._stepAnimation(0.1);
        break;
    }
  }

  _togglePlayPause() {
    if (!this.currentAction) {
      if (this.animations.length > 0) this._playAnimation(0);
      return;
    }
    const icon = this.win.querySelector("#tl-play-icon");
    if (this.isPlaying) {
      this.currentAction.paused = true;
      this.isPlaying = false;
      if (icon) {
        icon.classList.remove("fa-pause");
        icon.classList.add("fa-play");
      }
    } else {
      this.currentAction.paused = false;
      this.isPlaying = true;
      if (icon) {
        icon.classList.remove("fa-play");
        icon.classList.add("fa-pause");
      }
    }
  }

  _stopAnimation() {
    if (!this.currentAction) return;
    this.currentAction.stop();
    this.isPlaying = false;
    const icon = this.win.querySelector("#tl-play-icon");
    if (icon) {
      icon.classList.remove("fa-pause");
      icon.classList.add("fa-play");
    }
    const scrubber = this.win.querySelector("#tl-scrubber");
    if (scrubber) scrubber.value = 0;
    const cur = this.win.querySelector("#tl-cur");
    if (cur) cur.textContent = "0.00";
  }

  _stepAnimation(delta) {
    if (!this.currentAction) {
      if (this.animations.length > 0) {
        this._playAnimation(0);
        this.currentAction.paused = true;
        this.isPlaying = false;
      }
      return;
    }
    const clip = this.currentAction.getClip();
    let t = Math.max(0, Math.min(this.currentAction.time + delta, clip.duration));
    this.seekAnimation(t);
  }

  seekAnimation(time) {
    if (!this.currentAction) return;
    this.currentAction.time = time;
    this.mixer.update(0);
    this._updateTimelineUI();
  }

  _updateTimelineUI() {
    if (!this.currentAction || !this.win) return;
    const clip = this.currentAction.getClip();
    const cur = this.currentAction.time;
    const dur = clip.duration;
    const scrubber = this.win.querySelector("#tl-scrubber");
    if (scrubber && !this.isDraggingTimeline) scrubber.value = (cur / dur) * 100;
    const curEl = this.win.querySelector("#tl-cur");
    if (curEl) curEl.textContent = cur.toFixed(2);
    const durEl = this.win.querySelector("#tl-dur");
    if (durEl) durEl.textContent = dur.toFixed(2);
  }

  _handleToggle(action, active) {
    switch (action) {
      case "grid":
        this.showGrid = active;
        if (this.gridHelper) this.gridHelper.visible = active;
        break;
      case "axes":
        this.showAxes = active;
        if (this.axesHelper) this.axesHelper.visible = active;
        break;
      case "bones":
        this.showBones = active;
        if (this.skeletonHelper) this.skeletonHelper.visible = active;
        break;
      case "autoRotate":
        this.autoRotate = active;
        break;
      case "bloom":
        this.bloomEnabled = active;
        break;
      case "fxaa":
        this.fxaaEnabled = active;
        if (this.renderer) this.renderer.antialias = active;
        break;
    }
  }

  _handleAction(action) {
    switch (action) {
      case "open":
        this._openFromExplorer();
        break;
      case "openBrowser":
        this._openFromBrowser();
        break;
      case "samples":
        this.openSamplesModal();
        break;
      case "screenshot":
        this._takeScreenshot();
        break;
      case "fullscreen":
        this._toggleFullscreen();
        break;
      case "resetCamera":
        this._resetCamera();
        break;
      case "zoomFit":
        this._frameModel();
        break;
      case "toggleOrtho":
        this._toggleOrtho();
        break;

      case "undo":
        this.undoStack.undo();
        break;
      case "redo":
        this.undoStack.redo();
        break;

      case "selectAll":
        this._handleAction_selectAll();
        break;
      case "deselectAll":
        this._deselectAll();
        break;

      case "duplicate":
        this._duplicateSelected();
        break;
      case "deleteSelected":
        this._deleteSelected();
        break;
      case "toggleVisibility": {
        const sel = this._getFirstSelected();
        if (sel) {
          sel.visible = !sel.visible;
          sel.object3D.visible = sel.visible;
          this._refreshOutliner();
        }
        break;
      }

      case "addCube":
        this._addPrimitive("cube");
        break;
      case "addSphere":
        this._addPrimitive("sphere");
        break;
      case "addCylinder":
        this._addPrimitive("cylinder");
        break;
      case "addPlane":
        this._addPrimitive("plane");
        break;
      case "addTorus":
        this._addPrimitive("torus");
        break;
      case "addPointLight":
        this._addLight("point");
        break;
      case "addSpotLight":
        this._addLight("spot");
        break;

      case "snapToggle": {
        this.snapEnabled = !this.snapEnabled;
        const lbl = this.win.querySelector("#tb-snap");
        if (lbl) lbl.textContent = this.snapEnabled ? "SNAP ON" : "SNAP OFF";
        const toggle = this.win.querySelector("#snap-toggle");
        if (toggle) toggle.checked = this.snapEnabled;
        if (this.transformControls) {
          this.transformControls.setTranslationSnap(this.snapEnabled ? this.snapGrid : null);
          this.transformControls.setRotationSnap(this.snapEnabled ? THREE.MathUtils.degToRad(15) : null);
        }
        break;
      }

      case "recalcNormals":
        this._recalcNormals();
        break;
      case "flattenToWorld":
        this._applyTransformsToMesh();
        break;

      case "exportGLTF":
        this._exportGLTF();
        break;
      case "exportOBJ":
        this._exportOBJ();
        break;
      case "exportSceneJSON":
        this._exportSceneJSON();
        break;

      case "about":
        this._showAboutDialog();
        break;
    }
  }

  _duplicateSelected() {
    const sel = this._getFirstSelected();
    if (!sel) return;
    const clone = sel.object3D.clone(true);
    clone.position.x += 0.5;
    clone.userData = {};
    this.scene.add(clone);
    const newSo = this._registerObject(clone, sel.name + " Copy", sel.type);
    this.undoStack.push({
      undo: () => {
        this._removeSceneObject(newSo.id);
      },
      redo: () => {
        this.scene.add(clone);
        this.sceneObjects.set(newSo.id, newSo);
        this._refreshOutliner();
      }
    });
    this._selectOnly(newSo.id);
    os.notify.send(`Duplicated: ${sel.name}`, "Scene");
  }

  _deleteSelected() {
    if (this.selectedIds.size === 0) return;
    const ids = [...this.selectedIds];
    ids.forEach((id) => this._removeSceneObject(id));
    os.notify.send(`Deleted ${ids.length} object(s)`, "Scene");
  }

  _resetCamera() {
    this.camera.position.set(3, 2, 5);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  _toggleOrtho() {
    this.isOrtho = !this.isOrtho;
    this.camera = this.isOrtho ? this.orthoCam : this.perspCam;
    if (this.isOrtho) {
      this.orthoCam.position.copy(this.perspCam.position);
      this.orthoCam.quaternion.copy(this.perspCam.quaternion);
    }
    this.controls.object = this.camera;
    this.controls.update();
    if (this.transformControls) this.transformControls.camera = this.camera;

    const lbl = this.win.querySelector("#tb-ortho span.yb-tool-label");
    if (lbl) lbl.textContent = this.isOrtho ? "ORTHO" : "PERSP";
    os.notify.send(this.isOrtho ? "Orthographic view" : "Perspective view", "View");
  }

  async _exportGLTF() {
    if (!this.currentModel) {
      os.notify.send("Nothing to export", "Error");
      return;
    }
    try {
      const { GLTFExporter } = __SINGLE_FILE__
        ? await import("three/examples/jsm/exporters/GLTFExporter.js")
        : await import(/* @vite-ignore */ `${getLibraryUrl("three")}/examples/jsm/exporters/GLTFExporter.js`);
      const exporter = new GLTFExporter();
      exporter.parse(
        this.currentModel,
        (result) => {
          const blob = new Blob([JSON.stringify(result)], { type: "application/json" });
          this._downloadBlob(blob, (this.currentFileName.replace(/\.[^.]+$/, "") || "scene") + ".gltf");
          os.notify.send("Exported as GLTF", "Export");
        },
        (err) => os.notify.send("Export didn't work: " + err, "Error"),
        { binary: false }
      );
    } catch (e) {
      os.notify.send("GLTF export isn't available", "Error");
    }
  }

  _exportOBJ() {
    if (!this.currentModel) {
      os.notify.send("Nothing to export", "Error");
      return;
    }
    let lines = ["# Exported by Yuki Blender"];
    let vertOffset = 1;
    this.currentModel.traverse((child) => {
      if (!child.isMesh) return;
      const geo = child.geometry;
      const pos = geo.attributes.position;
      if (!pos) return;
      lines.push(`o ${child.name || "Mesh"}`);
      for (let i = 0; i < pos.count; i++) {
        lines.push(`v ${pos.getX(i).toFixed(6)} ${pos.getY(i).toFixed(6)} ${pos.getZ(i).toFixed(6)}`);
      }
      if (geo.index) {
        for (let i = 0; i < geo.index.count; i += 3) {
          const a = geo.index.getX(i) + vertOffset;
          const b = geo.index.getX(i + 1) + vertOffset;
          const c = geo.index.getX(i + 2) + vertOffset;
          lines.push(`f ${a} ${b} ${c}`);
        }
      }
      vertOffset += pos.count;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    this._downloadBlob(blob, (this.currentFileName.replace(/\.[^.]+$/, "") || "scene") + ".obj");
    os.notify.send("Exported as OBJ", "Export");
  }

  _exportSceneJSON() {
    const data = { version: "1.0", objects: [] };
    this.sceneObjects.forEach((so) => {
      data.objects.push({
        id: so.id,
        name: so.name,
        type: so.type,
        visible: so.visible,
        position: so.object3D.position.toArray(),
        rotation: [so.object3D.rotation.x, so.object3D.rotation.y, so.object3D.rotation.z],
        scale: so.object3D.scale.toArray()
      });
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    this._downloadBlob(blob, "scene.json");
    os.notify.send("Scene exported as JSON", "Export");
  }

  _downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  _recalcNormals() {
    const sel = this._getFirstSelected();
    if (!sel) {
      os.notify.send("Pick an object first", "Error");
      return;
    }
    sel.object3D.traverse((c) => {
      if (c.isMesh) c.geometry.computeVertexNormals();
    });
    os.notify.send("Recalculated normals", "Mesh");
  }

  _applyTransformsToMesh() {
    const sel = this._getFirstSelected();
    if (!sel) {
      os.notify.send("Pick an object first", "Error");
      return;
    }
    sel.object3D.traverse((c) => {
      if (!c.isMesh) return;
      c.geometry.applyMatrix4(c.matrixWorld);
      c.matrixWorld.decompose(c.position, c.quaternion, c.scale);
      c.updateMatrix();
    });
    os.notify.send("Applied transforms", "Mesh");
  }

  _assignTexture(type) {
    const sel = this._getFirstSelected();
    if (!sel) {
      os.notify.send("Pick an object first", "Error");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const texture = new THREE.TextureLoader().load(url, () => {
        sel.object3D.traverse((c) => {
          if (!c.isMesh) return;
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((mat) => {
            if (!mat) return;
            if (type === "diffuse") mat.map = texture;
            else if (type === "normal") mat.normalMap = texture;
            else if (type === "roughness") mat.roughnessMap = texture;
            mat.needsUpdate = true;
          });
        });
        this._syncMaterialToInspector();
        os.notify.send("", `${type} texture assigned`);
      });
    };
    input.click();
  }

  _openFromExplorer() {
    speak("Looking for a model?", ClippyAnimation.Searching);
    this.explorerApp.open(async (path, fileName) => {
      const blob = await os.fs.read([...path, fileName]);
      const ab = await blob.arrayBuffer();
      await this.loadModel(ab, fileName);
      os.notify.send("", `Loaded: ${fileName}`);
    }, this);
  }

  _openFromBrowser() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".obj,.gltf,.glb,.fbx,.dae,.3ds,.stl,.ply,.zip";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const ab = await file.arrayBuffer();
      await this.loadModel(ab, file.name);
      os.notify.send("", `Loaded: ${file.name}`);
    };
    input.click();
  }

  async _takeScreenshot() {
    try {
      await os.fs.mkdir(["Pictures"]);
      const dataUrl = this.renderer.domElement.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      const bytes = new Uint8Array(
        atob(base64)
          .split("")
          .map((c) => c.charCodeAt(0))
      );
      const blob = new Blob([bytes], { type: "image/png" });
      const name = `${(this.currentFileName || "scene").replace(/\.[^.]+$/, "")}-screenshot-${Date.now()}.png`;
      await os.fs.write(["Pictures"], name, blob, "image", dataUrl);
      os.notify.send(`Saved screenshot to Pictures/${name}`, "Screenshot");
    } catch (err) {
      console.error(err);
      os.notify.send("Couldn't take screenshot", "Error");
    }
  }

  _toggleFullscreen() {
    if (!document.fullscreenElement) this.container.requestFullscreen();
    else document.exitFullscreen();
  }

  openSamplesModal() {
    const existing = document.querySelector(".yb-samples-backdrop");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "yb-samples-backdrop";

    const modal = document.createElement("div");
    modal.className = "yb-samples-modal";
    modal.innerHTML = `
      <div class="yb-samples-header">
        <h3><i class="fa fa-archive"></i> Sample Models</h3>
        <button class="yb-samples-close" title="Close"><i class="fa fa-times"></i></button>
      </div>
      <div class="yb-samples-body">
        <p class="yb-samples-desc">Load a sample model to explore Yuki Blender.</p>
        <div class="yb-samples-grid">
          ${SAMPLE_MODELS.map(
            (m, i) => `
            <div class="yb-sample-card" data-index="${i}">
              <div class="yb-sample-icon"><i class="fa ${m.icon}"></i></div>
              <div class="yb-sample-info">
                <div class="yb-sample-name">${m.name}</div>
                <div class="yb-sample-desc">${m.description}</div>
                <code class="yb-sample-file">${m.fileName}</code>
              </div>
              <button class="yb-sample-load-btn" data-index="${i}" title="Load"><i class="fa fa-download"></i></button>
              <div class="yb-sample-progress" style="display:none">
                <div class="yb-sp-bar"><div class="yb-sp-fill"></div></div>
                <span class="yb-sp-text">Downloading…</span>
              </div>
            </div>
          `
          ).join("")}
        </div>
      </div>
      <div class="yb-samples-footer">
        <button class="yb-btn-cancel">Cancel</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => {
      backdrop.classList.add("visible");
      modal.classList.add("visible");
    });

    const close = () => {
      backdrop.classList.remove("visible");
      modal.classList.remove("visible");
      setTimeout(() => backdrop.remove(), 220);
    };

    modal.querySelector(".yb-samples-close").onclick = close;
    modal.querySelector(".yb-btn-cancel").onclick = close;
    backdrop.onclick = (e) => {
      if (e.target === backdrop) close();
    };

    modal.querySelectorAll(".yb-sample-load-btn").forEach((btn) => {
      btn.onclick = async () => {
        const index = parseInt(btn.dataset.index);
        const card = modal.querySelector(`.yb-sample-card[data-index="${index}"]`);
        const progressEl = card.querySelector(".yb-sample-progress");
        const fill = card.querySelector(".yb-sp-fill");
        const text = card.querySelector(".yb-sp-text");
        btn.style.display = "none";
        progressEl.style.display = "block";
        try {
          await this._loadSampleModel(index, fill, text, card);
          close();
        } catch {
          btn.style.display = "flex";
          progressEl.style.display = "none";
        }
      };
    });
  }

  async _loadSampleModel(index, fillEl, textEl, card) {
    const sample = SAMPLE_MODELS[index];
    let ab;
    if (this.sampleCache.has(sample.url)) {
      ab = this.sampleCache.get(sample.url);
    } else {
      if (textEl) textEl.textContent = "Connecting…";
      if (fillEl) fillEl.style.width = "10%";
      const response = await fetch(sample.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const total = parseInt(response.headers.get("content-length") || 0);
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
          if (fillEl) fillEl.style.width = `${pct}%`;
          if (textEl) textEl.textContent = `${pct}%`;
        }
        const all = new Uint8Array(received);
        let pos = 0;
        for (const chunk of chunks) {
          all.set(chunk, pos);
          pos += chunk.length;
        }
        ab = all.buffer;
      } else {
        if (textEl) textEl.textContent = "Downloading…";
        if (fillEl) fillEl.style.width = "50%";
        ab = await response.arrayBuffer();
      }
      if (fillEl) fillEl.style.width = "100%";
      if (textEl) textEl.textContent = "Done!";
      this.sampleCache.set(sample.url, ab);
    }
    await this.loadModel(ab, sample.fileName);
    os.notify.send(`Loaded: ${sample.name}`, "Load");
  }

  _showAboutDialog() {
    showAboutDialog({
      title: "Yuki Blender",
      version: "1.0.0",
      description: "Browser-native 3D editor with modeling, animation, and scene editing powered by three.js.",
      icon: "static/icons/3dmodel.webp",
      iconType: "image"
    });
  }
}
