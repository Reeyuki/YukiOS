let createAzaharModuleFactoryPromise = null;
let azaharRuntimeScriptPromise = null;
let azaharRuntimeFormatPromise = null;
const AZAHAR_RUNTIME_SNIFF_LIMIT = 65536;

function looksLikeModuleRuntime(text) {
  return text.includes("import.meta") || text.includes("export default createAzaharModule");
}

function looksLikeClassicRuntime(text) {
  return (
    text.includes("var createAzaharModule =") &&
    !text.includes("import.meta") &&
    !text.includes("export default createAzaharModule")
  );
}

async function detectAzaharRuntimeFormat(src) {
  if (azaharRuntimeFormatPromise) {
    return azaharRuntimeFormatPromise;
  }

  azaharRuntimeFormatPromise = (async () => {
    const response = await fetch(src, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to inspect Azahar runtime: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      const text = await response.text();
      if (looksLikeModuleRuntime(text)) return "module";
      if (looksLikeClassicRuntime(text)) return "classic";
      return "module";
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    const chunks = [];
    let totalLength = 0;

    while (totalLength < AZAHAR_RUNTIME_SNIFF_LIMIT) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      if (!value?.length) {
        continue;
      }
      chunks.push(value);
      totalLength += value.length;
      const snippet = decoder.decode(value, { stream: true });
      if (looksLikeModuleRuntime(snippet)) {
        await reader.cancel();
        return "module";
      }
    }

    await reader.cancel();

    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    const snippet = decoder.decode(merged);
    if (looksLikeModuleRuntime(snippet)) return "module";
    if (looksLikeClassicRuntime(snippet)) return "classic";
    return "module";
  })();

  return azaharRuntimeFormatPromise;
}

function loadClassicRuntimeScript(src) {
  if (azaharRuntimeScriptPromise) {
    return azaharRuntimeScriptPromise;
  }

  const absoluteSrc = new URL(src, window.location.href).href;
  azaharRuntimeScriptPromise = new Promise((resolve, reject) => {
    const complete = () => resolve();
    const fail = () => reject(new Error(`Failed to load classic Azahar runtime script: ${absoluteSrc}`));

    const existing = Array.from(document.scripts).find((script) => script.src === absoluteSrc);
    if (existing) {
      if (existing.dataset.azaharLoaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => {
        existing.dataset.azaharLoaded = "true";
        complete();
      }, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = absoluteSrc;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.azaharLoaded = "true";
      complete();
    }, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.append(script);
  });

  return azaharRuntimeScriptPromise;
}

async function getCreateAzaharModule() {
  if (typeof window !== "undefined" && typeof window.createAzaharModule === "function") {
    return window.createAzaharModule;
  }
  if (!createAzaharModuleFactoryPromise) {
    const moduleUrl = new URL("./Build/azahar_libretro.js", window.location.href).href;
    createAzaharModuleFactoryPromise = (async () => {
      const runtimeFormat = await detectAzaharRuntimeFormat(moduleUrl);
      if (runtimeFormat === "classic") {
        await loadClassicRuntimeScript(moduleUrl);
        if (typeof window !== "undefined" && typeof window.createAzaharModule === "function") {
          return window.createAzaharModule;
        }
        throw new Error("Classic Azahar runtime loaded without exposing createAzaharModule");
      }

      const moduleExports = await import(moduleUrl);
      const factory =
        moduleExports?.default ||
        moduleExports?.createAzaharModule ||
        moduleExports;
      if (typeof factory !== "function") {
        throw new Error("Azahar module factory export was not found");
      }
      if (typeof window !== "undefined") {
        window.createAzaharModule = factory;
      }
      return factory;
    })();
  }
  return createAzaharModuleFactoryPromise;
}

const RETRO_DEVICE_JOYPAD = 1;
const RETRO_DEVICE_MOUSE = 2;
const RETRO_DEVICE_ANALOG = 5;
const RETRO_DEVICE_POINTER = 6;
const RETRO_DEVICE_INDEX_ANALOG_RIGHT = 1;
const RETRO_DEVICE_ID_ANALOG_X = 0;
const RETRO_DEVICE_ID_ANALOG_Y = 1;
const RETRO_DEVICE_ID_MOUSE_X = 0;
const RETRO_DEVICE_ID_MOUSE_Y = 1;
const RETRO_DEVICE_ID_MOUSE_LEFT = 2;
const RETRO_DEVICE_ID_POINTER_X = 0;
const RETRO_DEVICE_ID_POINTER_Y = 1;
const RETRO_DEVICE_ID_POINTER_PRESSED = 2;
const RETRO_ENVIRONMENT_SET_MESSAGE = 6;
const RETRO_ENVIRONMENT_SET_PIXEL_FORMAT = 10;
const RETRO_ENVIRONMENT_SET_HW_RENDER = 14;
const RETRO_ENVIRONMENT_GET_VARIABLE = 15;
const RETRO_ENVIRONMENT_SET_VARIABLES = 16;
const RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE = 17;
const RETRO_ENVIRONMENT_GET_LOG_INTERFACE = 27;
const RETRO_ENVIRONMENT_SET_SYSTEM_AV_INFO = 32;
const RETRO_ENVIRONMENT_SET_INPUT_DESCRIPTORS = 11;
const RETRO_ENVIRONMENT_SET_SUPPORT_NO_GAME = 18;
const RETRO_ENVIRONMENT_SET_MEMORY_MAPS = 36;
const RETRO_ENVIRONMENT_SET_GEOMETRY = 37;
const RETRO_ENVIRONMENT_SET_SERIALIZATION_QUIRKS = 44;
const RETRO_ENVIRONMENT_GET_CORE_OPTIONS_VERSION = 52;
const RETRO_ENVIRONMENT_GET_PREFERRED_HW_RENDER = 56;
const RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY = 31;
const RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY = 9;
const RETRO_ENVIRONMENT_GET_CAN_DUPE = 3;
const RETRO_ENVIRONMENT_EXPERIMENTAL = 0x10000;
const RETRO_ENVIRONMENT_GET_SENSOR_INTERFACE =
  25 | RETRO_ENVIRONMENT_EXPERIMENTAL;
const RETRO_ENVIRONMENT_GET_MICROPHONE_INTERFACE =
  75 | RETRO_ENVIRONMENT_EXPERIMENTAL;
const RETRO_ENVIRONMENT_SET_HW_RENDER_CONTEXT_NEGOTIATION_INTERFACE =
  43 | RETRO_ENVIRONMENT_EXPERIMENTAL;
const RETRO_ENVIRONMENT_SET_HW_SHARED_CONTEXT =
  44 | RETRO_ENVIRONMENT_EXPERIMENTAL;
const RETRO_HW_CONTEXT_OPENGL_CORE = 3;
const RETRO_HW_CONTEXT_OPENGLES3 = 4;
const RETRO_HW_FRAME_BUFFER_VALID = -1;
const PIXEL_XRGB8888 = 1;
const PIXEL_RGB565 = 2;
const HW_RENDER_CONTEXT_TYPE_OFFSET = 0;
const HW_RENDER_CONTEXT_RESET_OFFSET = 4;
const HW_RENDER_GET_FRAMEBUFFER_OFFSET = 8;
const HW_RENDER_GET_PROC_ADDRESS_OFFSET = 12;
const HW_RENDER_VERSION_MAJOR_OFFSET = 20;
const HW_RENDER_VERSION_MINOR_OFFSET = 24;
const HW_RENDER_CONTEXT_DESTROY_OFFSET = 32;

const urlSearchParams =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
const rendererQuery = urlSearchParams?.get("renderer") || "";
const hwShadersQuery = urlSearchParams?.get("hwshaders") || "";
const rendererPreset =
  rendererQuery === "software"
    ? "software"
    : rendererQuery === "webgl-full"
      ? "webgl-full"
      : "webgl-hybrid";
const HOMEBREW_EXTENSIONS = new Set(["3dsx", "z3dsx", "elf", "axf"]);
const CORE_AUDIO_SAMPLE_RATE = 32728;

const state = {
  module: null,
  exports: {},
  callbacks: [],
  coreLoaded: false,
  coreLoadPromise: null,
  gameLoaded: false,
  romFile: null,
  romBytes: null,
  romHash: "",
  romName: "",
  romVirtualPath: "",
  animFrame: 0,
  pixelFormat: PIXEL_XRGB8888,
  frameWidth: 400,
  frameHeight: 480,
  framePitch: 1600,
  variables: new Map(),
  variablePointers: new Map(),
  variableUpdated: false,
  saveDirPtr: 0,
  systemDirPtr: 0,
  lastFrame: null,
  keys: new Set(),
  pointerX: 0,
  pointerY: 0,
  pointerPressed: false,
  mouseLeft: false,
  fpsFrames: 0,
  fpsLastUpdate: performance.now(),
  fpsValue: 0,
  audioContext: null,
  audioNextTime: 0,
  audioLeadTime: 0.03,
  audioMaxBacklog: 0.15,
  audioSources: new Set(),
  audioUnavailableLogged: false,
  audioUnlockedLogged: false,
  canvas2dContext: null,
  webglContext: null,
  webglContextHandle: 0,
  usingHardwareVideo: false,
  hwContextType: 0,
  hwContextResetPtr: 0,
  hwContextDestroyPtr: 0,
  hwFramebufferCallbackPtr: 0,
  hwProcAddressCallbackPtr: 0,
  softwarePresentStride: 1,
  softwareFrameCounter: 0,
  sdImportCount: 0,
  rendererPreset,
  experimentalHardwareRenderer: rendererPreset !== "software",
  experimentalHardwareShaders:
    rendererPreset === "webgl-full" ||
    (rendererPreset === "webgl-hybrid" && hwShadersQuery === "on"),
  softwareKeyboardOpen: false,
  softwareKeyboardOkButton: 0,
  softwareKeyboardCancelButton: -1,
};

const elements = {
  loadCore: document.querySelector("#load-core"),
  resetCore: document.querySelector("#reset-core"),
  stopCore: document.querySelector("#stop-core"),
  bootGame: document.querySelector("#boot-game"),
  unloadGame: document.querySelector("#unload-game"),
  romInput: document.querySelector("#rom-input"),
  sdImportFiles: document.querySelector("#sd-import-files"),
  sdImportFolder: document.querySelector("#sd-import-folder"),
  sdStatusText: document.querySelector("#sd-status-text"),
  romName: document.querySelector("#rom-name span"),
  coreStatus: document.querySelector("#core-status"),
  coreStatusText: document.querySelector("#core-status-text"),
  log: document.querySelector("#log"),
  metaLibrary: document.querySelector("#meta-library"),
  metaRom: document.querySelector("#meta-rom"),
  metaStateSize: document.querySelector("#meta-state-size"),
  metaFrame: document.querySelector("#meta-frame"),
  metaFps: document.querySelector("#meta-fps"),
  emptyState: document.querySelector("#empty-state"),
  saveStateButton: document.querySelector("#save-state-btn"),
  exportState: document.querySelector("#export-state"),
  importState: document.querySelector("#import-state"),
  slotGrid: document.querySelector("#slot-grid"),
  canvas: document.querySelector("#screen"),
  softwareCanvas: document.querySelector("#screen-software"),
  runtimePanel: document.querySelector("#runtime-panel"),
  runtimeSummary: document.querySelector("#runtime-summary"),
  runtimeDetails: document.querySelector("#runtime-details"),
  runtimeCopy: document.querySelector("#runtime-copy"),
  runtimeDismiss: document.querySelector("#runtime-dismiss"),
  softwareKeyboard: document.querySelector("#software-keyboard"),
  softwareKeyboardForm: document.querySelector("#software-keyboard-form"),
  softwareKeyboardHint: document.querySelector("#software-keyboard-hint"),
  softwareKeyboardError: document.querySelector("#software-keyboard-error"),
  softwareKeyboardInput: document.querySelector("#software-keyboard-input"),
  softwareKeyboardTextarea: document.querySelector(
    "#software-keyboard-textarea",
  ),
  softwareKeyboardButtons: document.querySelector("#software-keyboard-buttons"),
};

const imageDataCache = new Map();
const logLines = [];
const MAX_LOG_LINES = 250;
const IGNORED_LOG_PATTERNS = [
  "<Debug>",
  "called service=",
  "Mapping 0x",
  "LogLayout:",
  "Allocating TLS",
  "Registered archive",
  "Starting title scan",
  "Finished title scan",
  "path exists ",
  "stat failed on ",
];

function attachCanvasInputHandlers() {
  elements.canvas.addEventListener("mousedown", (event) => {
    if (state.softwareKeyboardOpen) return;
    updatePointerFromClient(event.clientX, event.clientY, true);
    elements.canvas.focus?.();
    event.preventDefault();
  });

  elements.canvas.addEventListener(
    "touchstart",
    (event) => {
      if (state.softwareKeyboardOpen) return;
      const touch = event.touches[0];
      if (!touch) return;
      updatePointerFromClient(touch.clientX, touch.clientY, true);
      event.preventDefault();
    },
    { passive: false },
  );

  elements.canvas.addEventListener(
    "touchmove",
    (event) => {
      if (state.softwareKeyboardOpen) return;
      const touch = event.touches[0];
      if (!touch) return;
      updatePointerFromClient(touch.clientX, touch.clientY, true);
      event.preventDefault();
    },
    { passive: false },
  );

  elements.canvas.addEventListener("touchend", () => {
    releasePointer();
  });

  elements.canvas.addEventListener("touchcancel", () => {
    releasePointer();
  });

  elements.canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stopRunLoop();
    state.usingHardwareVideo = false;
    reportRuntimeFailure(
      "WebGL context lost",
      event.statusMessage || "The browser dropped the WebGL context.",
    );
  });

  elements.canvas.addEventListener("webglcontextrestored", () => {
    reportRuntimeFailure(
      "WebGL context restored",
      "The browser restored WebGL, but the game needs a reboot to recover.",
    );
  });
}

function resetCanvasElement() {
  state.canvas2dContext = null;
  state.webglContext = null;
  state.lastFrame = null;
  if (elements.softwareCanvas) {
    elements.softwareCanvas.hidden = true;
  }
  releasePointer();
}

function logLine(text) {
  const stamp = new Date().toLocaleTimeString();
  logLines.push(`[${stamp}] ${text}`);
  if (logLines.length > MAX_LOG_LINES) {
    logLines.splice(0, logLines.length - MAX_LOG_LINES);
  }
  elements.log.textContent = `${logLines.join("\n")}\n`;
  elements.log.scrollTop = elements.log.scrollHeight;
}

function getRecentLogLines(limit = 40) {
  return logLines.slice(-limit).join("\n");
}

function shouldIgnoreLog(text) {
  return IGNORED_LOG_PATTERNS.some((pattern) => text.includes(pattern));
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack || error.message || error.toString();
  }
  if (typeof error === "string") {
    return error;
  }
  if (error === undefined) {
    return "undefined";
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function setStatus(kind, text) {
  elements.coreStatus.className = `status ${kind}`;
  elements.coreStatusText.textContent = text;
}

function clearRuntimePanel() {
  if (!elements.runtimePanel) {
    return;
  }
  elements.runtimePanel.hidden = true;
  elements.runtimeSummary.textContent = "";
  elements.runtimeDetails.textContent = "";
}

function showRuntimePanel(summary, details) {
  if (!elements.runtimePanel) {
    return;
  }
  elements.runtimeSummary.textContent = summary || "Runtime crash";
  elements.runtimeDetails.textContent = details || "No further details.";
  elements.runtimePanel.hidden = false;
}

function reportRuntimeFailure(summary, error, options = {}) {
  const formattedError = error ? formatError(error) : "";
  const summaryText = summary || "Runtime crash";
  const detailParts = [];

  if (options.note) {
    detailParts.push(options.note);
  }
  if (formattedError) {
    detailParts.push(formattedError);
  }

  const recentLog = getRecentLogLines();
  if (recentLog) {
    detailParts.push(`Recent log:\n${recentLog}`);
  }

  logLine(`${summaryText}: ${formattedError || "No error detail available"}`);
  setStatus("error", "Runtime crash");
  showRuntimePanel(summaryText, detailParts.join("\n\n"));
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function getFileExtension(name) {
  const text = String(name || "");
  const dot = text.lastIndexOf(".");
  return dot >= 0 ? text.slice(dot + 1).toLowerCase() : "";
}

function isHomebrewFileName(name) {
  return HOMEBREW_EXTENSIONS.has(getFileExtension(name));
}

function sanitizePathSegment(name) {
  const sanitized = String(name || "")
    .replace(/[<>:"|?*\u0000-\u001f]/g, "_")
    .replace(/[\\/]/g, "_")
    .trim();
  if (!sanitized || sanitized === "." || sanitized === "..") {
    return "item";
  }
  return sanitized;
}

function joinFsPath(...parts) {
  const segments = parts
    .flatMap((part) =>
      String(part || "")
        .replace(/\\/g, "/")
        .split("/"),
    )
    .filter(Boolean);
  return `/${segments.join("/")}`;
}

function getHomebrewAppName(name) {
  return sanitizePathSegment(
    String(name || "").replace(/\.(?:z3dsx|3dsx|elf|axf)$/i, ""),
  );
}

function getDefaultRomVirtualPath(name) {
  if (isHomebrewFileName(name)) {
    return joinFsPath(
      "save",
      "sdmc",
      "3ds",
      getHomebrewAppName(name),
      sanitizePathSegment(name),
    );
  }
  return joinFsPath("game", sanitizePathSegment(name));
}

function ensureFsDirectory(path) {
  let current = "";
  for (const segment of String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)) {
    current = `${current}/${segment}`;
    if (state.module.FS.analyzePath(current).exists === false) {
      state.module.FS.mkdir(current);
    }
  }
}

function ensureFsParentDirectory(path) {
  const segments = String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  segments.pop();
  if (segments.length) {
    ensureFsDirectory(segments.join("/"));
  }
}

function stageBytesAtPath(path, bytes) {
  ensureFsParentDirectory(path);
  state.module.FS.writeFile(path, bytes);
}

function updateSdStatus(message = null) {
  if (message) {
    elements.sdStatusText.textContent = message;
    return;
  }
  if (!state.sdImportCount) {
    elements.sdStatusText.textContent = "No SD content staged";
    return;
  }
  elements.sdStatusText.textContent =
    state.sdImportCount === 1
      ? "1 SD file staged"
      : `${state.sdImportCount} SD files staged`;
}

function normalizeImportedRelativePath(path, mode) {
  const segments = String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((segment) => sanitizePathSegment(segment));
  if (!segments.length) {
    return "3ds/item";
  }
  const first = segments[0]?.toLowerCase();
  const second = segments[1]?.toLowerCase();
  if (first === "sdmc") {
    segments.shift();
  } else if (
    segments.length > 1 &&
    (second === "3ds" || second === "nintendo 3ds")
  ) {
    segments.shift();
  }
  if (mode === "folder" && segments[0]) {
    const root = segments[0].toLowerCase();
    if (root !== "3ds" && root !== "nintendo 3ds") {
      segments.unshift("3ds");
    }
  }
  return segments.join("/");
}

function buildSdImportPlan(files, mode) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) {
    return [];
  }
  const executable = list.find((file) => isHomebrewFileName(file.name));
  const defaultHomebrewRoot = executable
    ? joinFsPath("save", "sdmc", "3ds", getHomebrewAppName(executable.name))
    : joinFsPath("save", "sdmc", "3ds", `import-${Date.now()}`);

  return list.map((file) => {
    const relativePath = file.webkitRelativePath
      ? normalizeImportedRelativePath(file.webkitRelativePath, mode)
      : sanitizePathSegment(file.name);
    const virtualPath = file.webkitRelativePath
      ? joinFsPath("save", "sdmc", relativePath)
      : joinFsPath(defaultHomebrewRoot, relativePath);
    return { file, virtualPath };
  });
}

async function selectRomBytes(
  file,
  bytes,
  virtualPath = getDefaultRomVirtualPath(file.name),
) {
  state.romFile = file;
  state.romBytes = bytes;
  state.romName = file.name;
  state.romVirtualPath = virtualPath;
  state.romHash = await hashBytes(bytes);
  elements.romName.textContent = file.name;
  elements.metaRom.textContent = file.name;
  await refreshSlots();
  updateUi();
}

async function selectRomData(name, bytes, options = {}) {
  const normalizedBytes = toUint8Array(bytes);
  const romName = sanitizePathSegment(name || "game.3ds");
  await selectRomBytes(
    { name: romName },
    normalizedBytes,
    options.virtualPath || getDefaultRomVirtualPath(romName),
  );
  if (options.log !== false) {
    logLine(`Selected ROM ${romName}`);
  }
  if (isHomebrewFileName(romName) && options.log !== false) {
    logLine(`Homebrew will boot from ${state.romVirtualPath}`);
  }
  return {
    name: state.romName,
    virtualPath: state.romVirtualPath,
    hash: state.romHash,
  };
}

async function importSdFiles(files, mode) {
  if (!files?.length) {
    return;
  }
  if (!state.coreLoaded) {
    await loadCore();
  }
  const plan = buildSdImportPlan(files, mode);
  let selectedExecutable = null;

  for (const entry of plan) {
    const bytes = new Uint8Array(await entry.file.arrayBuffer());
    stageBytesAtPath(entry.virtualPath, bytes);
    if (!selectedExecutable && isHomebrewFileName(entry.file.name)) {
      selectedExecutable = {
        file: entry.file,
        bytes,
        virtualPath: entry.virtualPath,
      };
    }
  }

  state.sdImportCount += plan.length;
  updateSdStatus();

  if (selectedExecutable) {
    await selectRomBytes(
      selectedExecutable.file,
      selectedExecutable.bytes,
      selectedExecutable.virtualPath,
    );
    logLine(
      `Imported ${plan.length} SD file(s) and selected ${selectedExecutable.file.name} for boot`,
    );
    return;
  }

  logLine(`Imported ${plan.length} file(s) into the virtual SD card`);
}

async function importSdEntries(entries, options = {}) {
  const list = Array.from(entries || []).filter(Boolean);
  if (!list.length) {
    return [];
  }
  if (!state.coreLoaded) {
    await loadCore();
  }

  const importedEntries = [];
  let selectedExecutable = null;
  const defaultRoot = joinFsPath("save", "sdmc", "3ds", `import-${Date.now()}`);

  for (const entry of list) {
    const name = sanitizePathSegment(entry.name || getPathLeaf(entry.relativePath || entry.virtualPath));
    const bytes = toUint8Array(entry.bytes);
    let virtualPath = entry.virtualPath;
    if (!virtualPath) {
      if (entry.relativePath) {
        virtualPath = joinFsPath(
          "save",
          "sdmc",
          normalizeImportedRelativePath(entry.relativePath, "folder"),
        );
      } else if (isHomebrewFileName(name)) {
        virtualPath = joinFsPath(
          "save",
          "sdmc",
          "3ds",
          getHomebrewAppName(name),
          name,
        );
      } else {
        virtualPath = joinFsPath(defaultRoot, name);
      }
    }
    stageBytesAtPath(virtualPath, bytes);
    importedEntries.push({ name, virtualPath, size: bytes.byteLength });
    if (!selectedExecutable && isHomebrewFileName(name)) {
      selectedExecutable = { name, bytes, virtualPath };
    }
  }

  state.sdImportCount += importedEntries.length;
  updateSdStatus();

  if (selectedExecutable && options.autoSelectExecutable !== false) {
    await selectRomData(selectedExecutable.name, selectedExecutable.bytes, {
      virtualPath: selectedExecutable.virtualPath,
      log: false,
    });
    if (options.log !== false) {
      logLine(
        `Imported ${importedEntries.length} SD file(s) and selected ${selectedExecutable.name} for boot`,
      );
    }
  } else if (options.log !== false) {
    logLine(`Imported ${importedEntries.length} file(s) into the virtual SD card`);
  }

  return importedEntries;
}

function updateUi() {
  elements.bootGame.disabled = !state.coreLoaded || !state.romBytes;
  elements.resetCore.disabled = !state.gameLoaded;
  elements.stopCore.disabled = !state.gameLoaded;
  elements.unloadGame.disabled = !state.gameLoaded;
  elements.saveStateButton.disabled = !state.gameLoaded;
  elements.exportState.disabled = !state.gameLoaded;
  elements.metaRom.textContent = state.romName || "None";
  elements.metaFrame.textContent = `${state.frameWidth} x ${state.frameHeight}`;
  elements.metaFps.textContent = state.gameLoaded
    ? state.fpsValue.toFixed(1)
    : "0.0";
  elements.emptyState.hidden = state.gameLoaded;
}

function getSoftwareKeyboardField() {
  return elements.softwareKeyboardTextarea.hidden
    ? elements.softwareKeyboardInput
    : elements.softwareKeyboardTextarea;
}

function hideSoftwareKeyboard() {
  state.softwareKeyboardOpen = false;
  state.softwareKeyboardOkButton = 0;
  state.softwareKeyboardCancelButton = -1;
  elements.softwareKeyboard.hidden = true;
  elements.softwareKeyboardHint.textContent = "";
  elements.softwareKeyboardError.textContent = "";
  elements.softwareKeyboardError.hidden = true;
  elements.softwareKeyboardInput.value = "";
  elements.softwareKeyboardTextarea.value = "";
  elements.softwareKeyboardButtons.replaceChildren();
  state.keys.clear();
  elements.canvas.focus?.();
}

function submitSoftwareKeyboard(button) {
  if (!state.exports.azahar_web_keyboard_submit) return;
  state.exports.azahar_web_keyboard_submit(
    getSoftwareKeyboardField().value ?? "",
    button,
  );
}

function addSoftwareKeyboardButton(label, button, primary = false) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  if (primary) {
    element.classList.add("primary");
  }
  element.addEventListener("click", () => {
    submitSoftwareKeyboard(button);
  });
  elements.softwareKeyboardButtons.append(element);
}

function showSoftwareKeyboard(config = {}) {
  const {
    hintText = "",
    initialText = "",
    errorText = "",
    maxTextLength = 32,
    multilineMode = false,
    buttonConfig = 0,
    cancelText = "Cancel",
    forgotText = "I Forgot",
    okText = "Ok",
  } = config;
  const singleLine = !multilineMode;
  const field = singleLine
    ? elements.softwareKeyboardInput
    : elements.softwareKeyboardTextarea;
  const fallbackOkButton = buttonConfig <= 2 ? buttonConfig : 3;

  state.softwareKeyboardOpen = true;
  state.softwareKeyboardOkButton = fallbackOkButton;
  state.softwareKeyboardCancelButton =
    buttonConfig >= 1 && buttonConfig <= 2 ? 0 : -1;
  state.keys.clear();
  releasePointer();

  elements.softwareKeyboardInput.hidden = !singleLine;
  elements.softwareKeyboardTextarea.hidden = singleLine;
  elements.softwareKeyboardInput.maxLength = maxTextLength;
  elements.softwareKeyboardTextarea.maxLength = maxTextLength;
  field.placeholder = hintText;
  field.value = initialText;

  elements.softwareKeyboardHint.textContent = hintText;
  elements.softwareKeyboardError.textContent = errorText;
  elements.softwareKeyboardError.hidden = !errorText;
  elements.softwareKeyboardButtons.replaceChildren();

  if (buttonConfig === 2) {
    addSoftwareKeyboardButton(cancelText, 0);
    addSoftwareKeyboardButton(forgotText, 1);
    addSoftwareKeyboardButton(okText, 2, true);
  } else if (buttonConfig === 1) {
    addSoftwareKeyboardButton(cancelText, 0);
    addSoftwareKeyboardButton(okText, 1, true);
  } else if (buttonConfig === 3) {
    addSoftwareKeyboardButton(okText, 3, true);
  } else {
    addSoftwareKeyboardButton(okText, 0, true);
  }

  elements.softwareKeyboard.hidden = false;
  requestAnimationFrame(() => {
    field.focus();
    field.select?.();
  });
}

function reportSoftwareKeyboardError(message) {
  if (!message) return;
  logLine(`Software keyboard: ${message}`);
  if (state.softwareKeyboardOpen) {
    elements.softwareKeyboardError.textContent = message;
    elements.softwareKeyboardError.hidden = false;
  }
}

window.azaharShowSoftwareKeyboard = showSoftwareKeyboard;
window.azaharHideSoftwareKeyboard = hideSoftwareKeyboard;
window.azaharShowSoftwareKeyboardError = reportSoftwareKeyboardError;

function get2dContext() {
  if (!state.canvas2dContext) {
    state.canvas2dContext =
      elements.softwareCanvas?.getContext("2d", { alpha: false }) || null;
  }
  return state.canvas2dContext;
}

function syncSoftwareCanvasSize(width, height) {
  if (!elements.softwareCanvas) {
    return;
  }
  if (
    elements.softwareCanvas.width !== width ||
    elements.softwareCanvas.height !== height
  ) {
    elements.softwareCanvas.width = width;
    elements.softwareCanvas.height = height;
    state.canvas2dContext = null;
  }
}

function setSoftwareCanvasVisible(visible) {
  if (!elements.softwareCanvas) {
    return;
  }
  elements.softwareCanvas.hidden = !visible;
}

function getWebGlContext() {
  if (
    !state.webglContext &&
    state.webglContextHandle &&
    state.module?.GL?.getContext
  ) {
    const registeredContext =
      state.module.GL.getContext(state.webglContextHandle)?.GLctx;
    if (registeredContext) {
      state.webglContext = registeredContext;
    }
  }
  if (!state.webglContext) {
    state.webglContext =
      elements.canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: true,
        stencil: true,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
      }) || null;
  }
  return state.webglContext;
}

function ensureRegisteredWebGlContext() {
  const moduleGl = state.module?.GL;
  if (!moduleGl?.createContext || !moduleGl?.makeContextCurrent) {
    return !!getWebGlContext();
  }

  if (!state.webglContextHandle) {
    const contextHandle = moduleGl.createContext(elements.canvas, {
      majorVersion: 2,
      minorVersion: 0,
      alpha: false,
      depth: true,
      stencil: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!contextHandle) {
      return false;
    }
    state.webglContextHandle = contextHandle;
  }

  moduleGl.makeContextCurrent(state.webglContextHandle);
  const registeredContext =
    moduleGl.getContext?.(state.webglContextHandle)?.GLctx;
  if (registeredContext) {
    state.webglContext = registeredContext;
  }

  return !!getWebGlContext();
}

function destroyHardwareRenderContext() {
  if (!state.hwContextDestroyPtr) {
    return;
  }
  try {
    if (state.webglContextHandle && state.module?.GL?.makeContextCurrent) {
      state.module.GL.makeContextCurrent(state.webglContextHandle);
      const registeredContext =
        state.module.GL.getContext?.(state.webglContextHandle)?.GLctx;
      if (registeredContext) {
        state.webglContext = registeredContext;
      }
    }
    invokeVoidWasmFunction(state.hwContextDestroyPtr);
  } catch (error) {
    logLine(`HW context destroy failed: ${formatError(error)}`);
  } finally {
    const moduleGl = state.module?.GL;
    if (state.webglContextHandle && moduleGl) {
      try {
        moduleGl.makeContextCurrent?.(0);
      } catch (error) {
        logLine(`WebGL context release warning: ${formatError(error)}`);
      }
      try {
        moduleGl.deleteContext?.(state.webglContextHandle);
      } catch (error) {
        logLine(`WebGL context delete warning: ${formatError(error)}`);
      }
    }
    state.webglContextHandle = 0;
    state.webglContext = null;
    state.canvas2dContext = null;
  }
}

function clearCanvasSurface() {
  if (state.webglContext) {
    state.webglContext.bindFramebuffer(state.webglContext.FRAMEBUFFER, null);
    state.webglContext.viewport(
      0,
      0,
      elements.canvas.width || 1,
      elements.canvas.height || 1,
    );
    state.webglContext.clearColor(0, 0, 0, 1);
    state.webglContext.clear(
      state.webglContext.COLOR_BUFFER_BIT |
        state.webglContext.DEPTH_BUFFER_BIT |
        state.webglContext.STENCIL_BUFFER_BIT,
    );
  }
  const context2d = get2dContext();
  if (context2d && elements.softwareCanvas) {
    context2d.clearRect(
      0,
      0,
      elements.softwareCanvas.width,
      elements.softwareCanvas.height,
    );
  }
  setSoftwareCanvasVisible(false);
}

function getAudioContextConstructor() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.AudioContext || window.webkitAudioContext || null;
}

function ensureAudioContext() {
  if (state.audioContext) {
    return state.audioContext;
  }
  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) {
    if (!state.audioUnavailableLogged) {
      state.audioUnavailableLogged = true;
      logLine("Web Audio is unavailable in this browser");
    }
    return null;
  }
  state.audioContext = new AudioContextCtor({ latencyHint: "interactive" });
  state.audioNextTime = state.audioContext.currentTime;
  return state.audioContext;
}

async function wakeAudioContext() {
  const context = ensureAudioContext();
  if (!context) {
    return null;
  }
  if (context.state !== "running") {
    try {
      await context.resume();
    } catch (error) {
      return context;
    }
  }
  if (context.state === "running" && !state.audioUnlockedLogged) {
    state.audioUnlockedLogged = true;
    logLine("Audio output ready");
  }
  return context;
}

function clearAudioPlayback() {
  for (const source of state.audioSources) {
    try {
      source.stop();
    } catch (error) {
      // Ignore nodes that have already ended.
    }
  }
  state.audioSources.clear();
  if (state.audioContext) {
    state.audioNextTime = state.audioContext.currentTime;
  } else {
    state.audioNextTime = 0;
  }
}

function queueAudioFrames(data, frames) {
  if (!data || !frames) {
    return frames;
  }
  const context = ensureAudioContext();
  if (!context || context.state !== "running") {
    return frames;
  }

  const sampleCount = frames * 2;
  const pcm = new Int16Array(sampleCount);
  pcm.set(state.module.HEAP16.subarray(data >> 1, (data >> 1) + sampleCount));

  const buffer = context.createBuffer(2, frames, CORE_AUDIO_SAMPLE_RATE);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  for (let i = 0, j = 0; i < frames; i += 1, j += 2) {
    left[i] = pcm[j] / 32768;
    right[i] = pcm[j + 1] / 32768;
  }

  if (state.audioNextTime < context.currentTime) {
    state.audioNextTime = context.currentTime;
  }
  if (state.audioNextTime - context.currentTime > state.audioMaxBacklog) {
    state.audioNextTime = context.currentTime + state.audioLeadTime;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    state.audioSources.delete(source);
  };
  const startTime = Math.max(
    context.currentTime + state.audioLeadTime,
    state.audioNextTime,
  );
  source.start(startTime);
  state.audioSources.add(source);
  state.audioNextTime = startTime + frames / CORE_AUDIO_SAMPLE_RATE;
  return frames;
}

function updateFps(now) {
  state.fpsFrames += 1;
  const elapsed = now - state.fpsLastUpdate;
  if (elapsed >= 500) {
    state.fpsValue = (state.fpsFrames * 1000) / elapsed;
    state.fpsFrames = 0;
    state.fpsLastUpdate = now;
    if (!state.usingHardwareVideo) {
      state.softwarePresentStride =
        state.fpsValue < 12 ? 3 : state.fpsValue < 20 ? 2 : 1;
    }
    elements.metaFps.textContent = state.fpsValue.toFixed(1);
  }
}

function allocString(value) {
  const length = state.module.lengthBytesUTF8(value) + 1;
  const ptr = state.module._malloc(length);
  state.module.stringToUTF8(value, ptr, length);
  return ptr;
}

function syncVariablePointer(key, value) {
  const priorPtr = state.variablePointers.get(key);
  if (priorPtr) {
    state.module._free(priorPtr);
    state.variablePointers.delete(key);
  }
  const ptr = allocString(value);
  state.variablePointers.set(key, ptr);
  return ptr;
}

function setVariable(key, value) {
  if (!key || value == null) {
    return;
  }
  const text = String(value);
  const changed = state.variables.get(key) !== text;
  state.variables.set(key, text);
  syncVariablePointer(key, text);
  state.variableUpdated ||= changed;
}

function applyWebPerformanceDefaults() {
  const prefersHardwareRenderer = state.experimentalHardwareRenderer;
  const prefersHardwareShaders =
    prefersHardwareRenderer && state.experimentalHardwareShaders;
  const defaults = new Map([
    ["citra_use_cpu_jit", "disabled"],
    ["citra_cpu_clock_percentage", "75"],
    ["citra_is_new_3ds", "Old 3DS"],
    ["citra_audio_emulation", "hle"],
    ["citra_graphics_api", prefersHardwareRenderer ? "OpenGL" : "Software"],
    ["citra_use_hw_shader", prefersHardwareShaders ? "enabled" : "disabled"],
    ["citra_use_shader_jit", "disabled"],
    ["citra_shaders_accurate_mul", "disabled"],
    ["citra_use_disk_shader_cache", "disabled"],
    ["citra_resolution_factor", "1"],
    ["citra_texture_filter", "none"],
    ["citra_texture_sampling", "NearestNeighbor"],
    ["citra_custom_textures", "disabled"],
    ["citra_dump_textures", "disabled"],
    ["citra_layout_option", "default"],
    ["citra_swap_screen", "Top"],
    ["citra_swap_screen_mode", "Toggle"],
    ["citra_large_screen_proportion", "1.00"],
    ["citra_use_virtual_sd", "enabled"],
    ["citra_use_libretro_save_path", "LibRetro Default"],
    ["citra_analog_function", "touchscreen_pointer"],
    ["citra_analog_deadzone", "25"],
    ["citra_enable_mouse_touchscreen", "enabled"],
    ["citra_enable_touch_touchscreen", "enabled"],
    ["citra_enable_touch_pointer_timeout", "disabled"],
    ["citra_enable_motion", "disabled"],
    ["citra_motion_sensitivity", "1.0"],
  ]);

  for (const [key, value] of defaults) {
    setVariable(key, value);
  }
  logLine(
    `Renderer preset: ${
      prefersHardwareRenderer
        ? prefersHardwareShaders
          ? "WebGL full"
          : "WebGL hybrid"
        : "Software"
    }`,
  );
}

function parseLegacyVariableOptions(pointer) {
  if (!pointer) {
    return;
  }
  const entrySize = 8;
  for (let offset = 0; ; offset += entrySize) {
    const keyPtr = state.module.getValue(pointer + offset, "*");
    const valuePtr = state.module.getValue(pointer + offset + 4, "*");
    if (!keyPtr || !valuePtr) {
      break;
    }
    const key = state.module.UTF8ToString(keyPtr);
    const value = state.module.UTF8ToString(valuePtr);
    const separator = value.indexOf(";");
    const optionList = separator >= 0 ? value.slice(separator + 1) : value;
    const defaultValue = optionList.split("|")[0]?.trim();
    if (defaultValue) {
      setVariable(key, defaultValue);
    }
  }
}

function applyGeometry(pointer) {
  if (!pointer) {
    return;
  }
  state.frameWidth = state.module.getValue(pointer, "i32") || state.frameWidth;
  state.frameHeight =
    state.module.getValue(pointer + 4, "i32") || state.frameHeight;
  elements.metaFrame.textContent = `${state.frameWidth} x ${state.frameHeight}`;
}

function getImageData(width, height) {
  const key = `${width}x${height}`;
  if (!imageDataCache.has(key)) {
    const image = new ImageData(width, height);
    imageDataCache.set(key, {
      image,
      rgba: image.data,
      rgba32: new Uint32Array(image.data.buffer),
    });
  }
  return imageDataCache.get(key);
}

function getWasmFunction(pointer) {
  if (!pointer) {
    return null;
  }
  const table =
    state.module.wasmTable ||
    state.module.asm?.__indirect_function_table ||
    Object.values(state.module.asm || {}).find(
      (value) => value instanceof WebAssembly.Table,
    );
  return table ? table.get(pointer) : null;
}

function invokeVoidWasmFunction(pointer) {
  const fn = getWasmFunction(pointer);
  if (!fn) {
    throw new Error(`Missing wasm function at table index ${pointer}`);
  }
  fn();
}

function getCurrentFramebufferHandle() {
  if (!state.webglContext) {
    return 0;
  }
  const framebuffer = state.webglContext.getParameter(
    state.webglContext.FRAMEBUFFER_BINDING,
  );
  return framebuffer ?? 0;
}

function lookupGlProcAddress(name) {
  if (!name || !state.webglContext) {
    return 0;
  }
  const gl = state.webglContext;
  const candidates = {
    glGetString: () => 1,
    glGetIntegerv: () => 1,
    glGetStringi: () => 1,
    glGetError: () => 1,
    glFlush: () => 1,
    glFinish: () => 1,
    glViewport: () => 1,
    glScissor: () => 1,
    glClear: () => 1,
    glClearColor: () => 1,
    glClearDepthf: () => 1,
    glClearStencil: () => 1,
    glEnable: () => 1,
    glDisable: () => 1,
    glBlendFuncSeparate: () => 1,
    glBlendEquationSeparate: () => 1,
    glBlendColor: () => 1,
    glColorMask: () => 1,
    glDepthFunc: () => 1,
    glDepthMask: () => 1,
    glStencilFunc: () => 1,
    glStencilOp: () => 1,
    glStencilMask: () => 1,
    glActiveTexture: () => 1,
    glBindTexture: () => 1,
    glTexParameteri: () => 1,
    glTexStorage2D: () => 1,
    glTexSubImage2D: () => 1,
    glBindSampler: () => 1,
    glGenTextures: () => 1,
    glDeleteTextures: () => 1,
    glGenSamplers: () => 1,
    glDeleteSamplers: () => 1,
    glCreateShader: () => 1,
    glShaderSource: () => 1,
    glCompileShader: () => 1,
    glGetShaderiv: () => 1,
    glGetShaderInfoLog: () => 1,
    glCreateProgram: () => 1,
    glAttachShader: () => 1,
    glLinkProgram: () => 1,
    glGetProgramiv: () => 1,
    glGetProgramInfoLog: () => 1,
    glUseProgram: () => 1,
    glDeleteProgram: () => 1,
    glDeleteShader: () => 1,
    glGenBuffers: () => 1,
    glBindBuffer: () => 1,
    glBufferData: () => 1,
    glBufferSubData: () => 1,
    glMapBufferRange: () => 1,
    glUnmapBuffer: () => 1,
    glFlushMappedBufferRange: () => 1,
    glDeleteBuffers: () => 1,
    glGenVertexArrays: () => 1,
    glBindVertexArray: () => 1,
    glDeleteVertexArrays: () => 1,
    glVertexAttribPointer: () => 1,
    glEnableVertexAttribArray: () => 1,
    glDrawArrays: () => 1,
    glDrawRangeElementsBaseVertex: () => 1,
    glBindFramebuffer: () => 1,
    glFramebufferTexture2D: () => 1,
    glFramebufferParameteri: () => 1,
    glCheckFramebufferStatus: () => 1,
    glDeleteFramebuffers: () => 1,
    glGenFramebuffers: () => 1,
    glBlitFramebuffer: () => 1,
    glRenderbufferStorage: () => 1,
    glBindRenderbuffer: () => 1,
    glGenRenderbuffers: () => 1,
    glDeleteRenderbuffers: () => 1,
    glGetUniformLocation: () => 1,
    glUniform1i: () => 1,
    glUniform1f: () => 1,
    glUniform2f: () => 1,
    glUniform3f: () => 1,
    glUniform4f: () => 1,
    glUniformBlockBinding: () => 1,
    glBindBufferRange: () => 1,
    glGetUniformBlockIndex: () => 1,
    glGetAttribLocation: () => 1,
  };
  return candidates[name] ? 1 : 0;
}

function applyHardwareRenderCallback(pointer) {
  const contextType = state.module.getValue(
    pointer + HW_RENDER_CONTEXT_TYPE_OFFSET,
    "i32",
  );
  const versionMajor = state.module.getValue(
    pointer + HW_RENDER_VERSION_MAJOR_OFFSET,
    "i32",
  );
  const versionMinor = state.module.getValue(
    pointer + HW_RENDER_VERSION_MINOR_OFFSET,
    "i32",
  );
  if (
    contextType !== RETRO_HW_CONTEXT_OPENGLES3 &&
    contextType !== RETRO_HW_CONTEXT_OPENGL_CORE
  ) {
    logLine(`Unsupported HW context type ${contextType}`);
    return 0;
  }

  if (!ensureRegisteredWebGlContext()) {
    logLine("WebGL2 context creation failed");
    return 0;
  }

  if (!state.hwFramebufferCallbackPtr) {
    state.hwFramebufferCallbackPtr = state.module.addFunction(
      () => getCurrentFramebufferHandle(),
      "i",
    );
    state.callbacks.push(state.hwFramebufferCallbackPtr);
  }
  if (!state.hwProcAddressCallbackPtr) {
    state.hwProcAddressCallbackPtr = state.module.addFunction((namePtr) => {
      const name = state.module.UTF8ToString(namePtr);
      return lookupGlProcAddress(name);
    }, "ii");
    state.callbacks.push(state.hwProcAddressCallbackPtr);
  }

  state.module.setValue(
    pointer + HW_RENDER_GET_FRAMEBUFFER_OFFSET,
    state.hwFramebufferCallbackPtr,
    "*",
  );
  state.module.setValue(
    pointer + HW_RENDER_GET_PROC_ADDRESS_OFFSET,
    state.hwProcAddressCallbackPtr,
    "*",
  );

  state.hwContextType = contextType;
  state.hwContextResetPtr = state.module.getValue(
    pointer + HW_RENDER_CONTEXT_RESET_OFFSET,
    "*",
  );
  state.hwContextDestroyPtr = state.module.getValue(
    pointer + HW_RENDER_CONTEXT_DESTROY_OFFSET,
    "*",
  );
  logLine(
    `HW callbacks reset=${state.hwContextResetPtr || 0} destroy=${state.hwContextDestroyPtr || 0} framebuffer=${state.hwFramebufferCallbackPtr || 0} proc=${state.hwProcAddressCallbackPtr || 0}`,
  );
  state.usingHardwareVideo = true;
  logLine(
    `Using WebGL2 renderer (${state.experimentalHardwareShaders ? "full" : "hybrid"}) (${versionMajor}.${versionMinor})`,
  );
  invokeVoidWasmFunction(state.hwContextResetPtr);
  return 1;
}

function drawFrame(pointer, width, height, pitch) {
  state.frameWidth = width;
  state.frameHeight = height;
  state.framePitch = pitch;
  elements.metaFrame.textContent = `${width} x ${height}`;
  if (elements.canvas.width !== width || elements.canvas.height !== height) {
    elements.canvas.width = width;
    elements.canvas.height = height;
  }
  syncSoftwareCanvasSize(width, height);
  if (
    state.usingHardwareVideo &&
    (pointer === RETRO_HW_FRAME_BUFFER_VALID || pointer === 0xffffffff)
  ) {
    setSoftwareCanvasVisible(false);
    if (state.webglContext) {
      state.webglContext.flush();
    }
    return;
  }
  const imageBuffer = getImageData(width, height);
  const image = imageBuffer.image;
  const rgba = imageBuffer.rgba;
  const rgba32 = imageBuffer.rgba32;
  const heap = state.module.HEAPU8;

  if (!pointer) {
    if (state.lastFrame) {
      setSoftwareCanvasVisible(true);
      get2dContext().putImageData(state.lastFrame, 0, 0);
    }
    return;
  }

  if (!state.usingHardwareVideo) {
    state.softwareFrameCounter += 1;
    if (
      state.softwarePresentStride > 1 &&
      state.softwareFrameCounter % state.softwarePresentStride !== 0
    ) {
      return;
    }
  }

  if (state.pixelFormat === PIXEL_RGB565) {
    const source = new Uint16Array(heap.buffer, pointer, (pitch >> 1) * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = source[y * (pitch >> 1) + x];
        const out = (y * width + x) * 4;
        rgba[out] = (((pixel >> 11) & 0x1f) * 255) / 31;
        rgba[out + 1] = (((pixel >> 5) & 0x3f) * 255) / 63;
        rgba[out + 2] = ((pixel & 0x1f) * 255) / 31;
        rgba[out + 3] = 255;
      }
    }
  } else {
    const source = new Uint32Array(heap.buffer, pointer, (pitch >> 2) * height);
    for (let y = 0; y < height; y += 1) {
      const sourceRow = y * (pitch >> 2);
      const destRow = y * width;
      for (let x = 0; x < width; x += 1) {
        const pixel = source[sourceRow + x];
        rgba32[destRow + x] =
          0xff000000 |
          ((pixel & 0x0000ff) << 16) |
          (pixel & 0x00ff00) |
          ((pixel & 0xff0000) >> 16);
      }
    }
  }

  const context2d = get2dContext();
  if (!context2d) {
    throw new Error("2D canvas context is unavailable");
  }
  setSoftwareCanvasVisible(true);
  context2d.putImageData(image, 0, 0);
  state.lastFrame = image;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updatePointerFromClient(
  clientX,
  clientY,
  pressed = state.pointerPressed,
) {
  const rect = elements.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const relativeX = clamp((clientX - rect.left) / rect.width, 0, 1);
  const relativeY = clamp((clientY - rect.top) / rect.height, 0, 1);
  state.pointerX = Math.round(relativeX * 0xfffe - 0x7fff);
  state.pointerY = Math.round(relativeY * 0xfffe - 0x7fff);
  state.pointerPressed = pressed;
  state.mouseLeft = pressed;
}

function releasePointer() {
  state.pointerPressed = false;
  state.mouseLeft = false;
}

function makeEnvironmentCallback() {
  return state.module.addFunction((cmd, data) => {
    switch (cmd) {
      case RETRO_ENVIRONMENT_SET_MESSAGE: {
        const msgPtr = state.module.getValue(data, "*");
        if (msgPtr) {
          logLine(`core: ${state.module.UTF8ToString(msgPtr)}`);
        }
        return 1;
      }
      case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:
        state.pixelFormat = state.module.getValue(data, "i32");
        return 1;
      case RETRO_ENVIRONMENT_SET_HW_SHARED_CONTEXT:
        return 1;
      case RETRO_ENVIRONMENT_SET_HW_RENDER:
        return applyHardwareRenderCallback(data);
      case RETRO_ENVIRONMENT_SET_HW_RENDER_CONTEXT_NEGOTIATION_INTERFACE:
        return 1;
      case RETRO_ENVIRONMENT_SET_INPUT_DESCRIPTORS:
      case RETRO_ENVIRONMENT_SET_SUPPORT_NO_GAME:
      case RETRO_ENVIRONMENT_SET_MEMORY_MAPS:
      case RETRO_ENVIRONMENT_SET_SERIALIZATION_QUIRKS:
        return 1;
      case RETRO_ENVIRONMENT_GET_CAN_DUPE:
        state.module.setValue(data, 1, "i8");
        return 1;
      case RETRO_ENVIRONMENT_GET_CORE_OPTIONS_VERSION:
        state.module.setValue(data, 0, "i32");
        return 1;
      case RETRO_ENVIRONMENT_GET_PREFERRED_HW_RENDER:
        if (!state.experimentalHardwareRenderer) {
          return 0;
        }
        state.module.setValue(data, RETRO_HW_CONTEXT_OPENGLES3, "i32");
        return 1;
      case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY:
        state.module.setValue(data, state.saveDirPtr, "*");
        return 1;
      case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY:
        state.module.setValue(data, state.systemDirPtr, "*");
        return 1;
      case RETRO_ENVIRONMENT_SET_VARIABLES:
        parseLegacyVariableOptions(data);
        return 1;
      case RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE:
        state.module.setValue(data, state.variableUpdated ? 1 : 0, "i8");
        state.variableUpdated = false;
        return 1;
      case RETRO_ENVIRONMENT_GET_VARIABLE: {
        const keyPtr = state.module.getValue(data, "*");
        const key = state.module.UTF8ToString(keyPtr);
        const value = state.variables.get(key);
        if (!value) {
          state.module.setValue(data + 4, 0, "*");
          return 0;
        }
        let ptr = state.variablePointers.get(key);
        if (!ptr) {
          ptr = allocString(value);
          state.variablePointers.set(key, ptr);
        }
        state.module.setValue(data + 4, ptr, "*");
        return 1;
      }
      case RETRO_ENVIRONMENT_GET_LOG_INTERFACE:
        return 0;
      case RETRO_ENVIRONMENT_SET_SYSTEM_AV_INFO:
        applyGeometry(data);
        return 1;
      case RETRO_ENVIRONMENT_SET_GEOMETRY:
        applyGeometry(data);
        return 1;
      case RETRO_ENVIRONMENT_GET_SENSOR_INTERFACE:
      case RETRO_ENVIRONMENT_GET_MICROPHONE_INTERFACE:
        return 0;
      default:
        return 0;
    }
  }, "iii");
}

function makeVideoCallback() {
  return state.module.addFunction((data, width, height, pitch) => {
    drawFrame(data, width, height, pitch);
  }, "viiii");
}

function makeAudioSampleCallback() {
  return state.module.addFunction((left, right) => {
    const context = ensureAudioContext();
    if (!context || context.state !== "running") {
      return;
    }
    const buffer = context.createBuffer(2, 1, CORE_AUDIO_SAMPLE_RATE);
    buffer.getChannelData(0)[0] = left / 32768;
    buffer.getChannelData(1)[0] = right / 32768;
    if (state.audioNextTime < context.currentTime) {
      state.audioNextTime = context.currentTime;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      state.audioSources.delete(source);
    };
    const startTime = Math.max(
      context.currentTime + state.audioLeadTime,
      state.audioNextTime,
    );
    source.start(startTime);
    state.audioSources.add(source);
    state.audioNextTime = startTime + 1 / CORE_AUDIO_SAMPLE_RATE;
  }, "vii");
}

function makeAudioBatchCallback() {
  return state.module.addFunction((data, frames) => queueAudioFrames(data, frames), "iii");
}

function makeInputPollCallback() {
  return state.module.addFunction(() => {}, "v");
}

const keymap = new Map([
  ["KeyZ", 0],
  ["KeyA", 1],
  ["ShiftRight", 2],
  ["Enter", 3],
  ["ArrowUp", 4],
  ["ArrowDown", 5],
  ["ArrowLeft", 6],
  ["ArrowRight", 7],
  ["KeyX", 8],
  ["KeyS", 9],
  ["KeyQ", 10],
  ["KeyW", 11],
]);

window.__keymapRef = keymap;
const _saved = JSON.parse(localStorage.getItem("azahar-keymap") || "null");
if (_saved) {
  keymap.clear();
  _saved.forEach(({ code }, i) => keymap.set(code, i));
}

function makeInputStateCallback() {
  return state.module.addFunction((port, device, index, id) => {
    if (port !== 0) {
      return 0;
    }
    if (state.softwareKeyboardOpen) {
      return 0;
    }
    if (device === RETRO_DEVICE_JOYPAD && index === 0) {
      for (const [code, mapped] of keymap.entries()) {
        if (mapped === id && state.keys.has(code)) {
          return 1;
        }
      }
      return 0;
    }
    if (device === RETRO_DEVICE_POINTER && index === 0) {
      if (id === RETRO_DEVICE_ID_POINTER_X) {
        return state.pointerX;
      }
      if (id === RETRO_DEVICE_ID_POINTER_Y) {
        return state.pointerY;
      }
      if (id === RETRO_DEVICE_ID_POINTER_PRESSED) {
        return state.pointerPressed ? 1 : 0;
      }
      return 0;
    }
    if (device === RETRO_DEVICE_MOUSE && index === 0) {
      if (id === RETRO_DEVICE_ID_MOUSE_LEFT) {
        return state.mouseLeft ? 1 : 0;
      }
      if (id === RETRO_DEVICE_ID_MOUSE_X || id === RETRO_DEVICE_ID_MOUSE_Y) {
        return 0;
      }
      return 0;
    }
    if (
      device === RETRO_DEVICE_ANALOG &&
      index === RETRO_DEVICE_INDEX_ANALOG_RIGHT
    ) {
      if (id === RETRO_DEVICE_ID_ANALOG_X || id === RETRO_DEVICE_ID_ANALOG_Y) {
        return 0;
      }
    }
    return 0;
  }, "iiiii");
}

function setExports() {
  state.exports.retro_init = state.module.cwrap("retro_init", null, []);
  state.exports.retro_deinit = state.module.cwrap("retro_deinit", null, []);
  state.exports.retro_api_version = state.module.cwrap(
    "retro_api_version",
    "number",
    [],
  );
  state.exports.retro_set_environment = state.module.cwrap(
    "retro_set_environment",
    null,
    ["number"],
  );
  state.exports.retro_set_video_refresh = state.module.cwrap(
    "retro_set_video_refresh",
    null,
    ["number"],
  );
  state.exports.retro_set_audio_sample = state.module.cwrap(
    "retro_set_audio_sample",
    null,
    ["number"],
  );
  state.exports.retro_set_audio_sample_batch = state.module.cwrap(
    "retro_set_audio_sample_batch",
    null,
    ["number"],
  );
  state.exports.retro_set_input_poll = state.module.cwrap(
    "retro_set_input_poll",
    null,
    ["number"],
  );
  state.exports.retro_set_input_state = state.module.cwrap(
    "retro_set_input_state",
    null,
    ["number"],
  );
  state.exports.retro_get_system_info = state.module.cwrap(
    "retro_get_system_info",
    null,
    ["number"],
  );
  state.exports.retro_get_system_av_info = state.module.cwrap(
    "retro_get_system_av_info",
    null,
    ["number"],
  );
  state.exports.retro_set_controller_port_device = state.module.cwrap(
    "retro_set_controller_port_device",
    null,
    ["number", "number"],
  );
  state.exports.retro_load_game = state.module.cwrap(
    "retro_load_game",
    "number",
    ["number"],
  );
  state.exports.retro_unload_game = state.module.cwrap(
    "retro_unload_game",
    null,
    [],
  );
  state.exports.retro_run = state.module.cwrap("retro_run", null, []);
  state.exports.retro_reset = state.module.cwrap("retro_reset", null, []);
  state.exports.retro_serialize_size = state.module.cwrap(
    "retro_serialize_size",
    "number",
    [],
  );
  state.exports.retro_serialize = state.module.cwrap(
    "retro_serialize",
    "number",
    ["number", "number"],
  );
  state.exports.retro_unserialize = state.module.cwrap(
    "retro_unserialize",
    "number",
    ["number", "number"],
  );
  state.exports.azahar_web_keyboard_submit = state.module.cwrap(
    "azahar_web_keyboard_submit",
    null,
    ["string", "number"],
  );
}

async function loadCore() {
  if (state.coreLoaded) return;
  if (state.coreLoadPromise) {
    return state.coreLoadPromise;
  }
  const task = (async () => {
  clearRuntimePanel();
  setStatus("", "Loading module");
  resetCanvasElement();
  const createAzaharModule = await getCreateAzaharModule();
  state.module = await createAzaharModule({
    noInitialRun: true,
    canvas: elements.canvas,
    print: (text) => {
      if (!shouldIgnoreLog(text)) {
        logLine(text);
      }
    },
    printErr: (text) => {
      if (!shouldIgnoreLog(text)) {
        logLine(`stderr: ${text}`);
      }
    },
    onAbort: (reason) => {
      reportRuntimeFailure("Wasm abort", reason);
    },
    locateFile: (path) => new URL(`./Build/${path}`, window.location.href).href,
  });
  ensureFsDirectory("/save");
  ensureFsDirectory("/system");
  ensureFsDirectory("/game");
  ensureFsDirectory("/save/sdmc/3ds");
  state.saveDirPtr = allocString("/save");
  state.systemDirPtr = allocString("/system");
  setExports();
  const envCb = makeEnvironmentCallback();
  const videoCb = makeVideoCallback();
  const audioCb = makeAudioSampleCallback();
  const audioBatchCb = makeAudioBatchCallback();
  const inputPollCb = makeInputPollCallback();
  const inputStateCb = makeInputStateCallback();
  state.callbacks.push(
    envCb,
    videoCb,
    audioCb,
    audioBatchCb,
    inputPollCb,
    inputStateCb,
  );
  state.exports.retro_set_environment(envCb);
  state.exports.retro_set_video_refresh(videoCb);
  state.exports.retro_set_audio_sample(audioCb);
  state.exports.retro_set_audio_sample_batch(audioBatchCb);
  state.exports.retro_set_input_poll(inputPollCb);
  state.exports.retro_set_input_state(inputStateCb);
  applyWebPerformanceDefaults();
  state.exports.retro_init();
  state.exports.retro_set_controller_port_device(0, RETRO_DEVICE_JOYPAD);
  const infoPtr = state.module._malloc(20);
  state.exports.retro_get_system_info(infoPtr);
  const libraryName = state.module.UTF8ToString(
    state.module.getValue(infoPtr, "*"),
  );
  const libraryVersion = state.module.UTF8ToString(
    state.module.getValue(infoPtr + 4, "*"),
  );
  elements.metaLibrary.textContent = `${libraryName} ${libraryVersion}`.trim();
  state.module._free(infoPtr);
  state.coreLoaded = true;
  setStatus("ready", "Core ready");
  logLine(`Core ready. API version ${state.exports.retro_api_version()}`);
  updateSdStatus();
  updateUi();
  })();
  state.coreLoadPromise = task;
  try {
    await task;
  } finally {
    if (state.coreLoadPromise === task) {
      state.coreLoadPromise = null;
    }
  }
}

function autoLoadCore() {
  loadCore().catch((error) => {
    reportRuntimeFailure("Core load failed", error);
  });
}

async function hashBytes(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function toUint8Array(bytes) {
  if (bytes instanceof Uint8Array) {
    return bytes;
  }
  if (bytes instanceof ArrayBuffer) {
    return new Uint8Array(bytes);
  }
  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice();
  }
  throw new TypeError("Expected Uint8Array, ArrayBuffer, or typed array view");
}

function getPathLeaf(path) {
  const normalized = String(path || "").replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "item.bin";
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("azahar-web", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("states");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("states", "readonly");
    const req = tx.objectStore("states").get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function dbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("states", "readwrite");
    tx.objectStore("states").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("states", "readwrite");
    tx.objectStore("states").delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function slotKey(slot) {
  return `${state.romHash || "no-rom"}:${slot}`;
}

async function refreshSlots() {
  elements.slotGrid.innerHTML = "";
  for (let slot = 1; slot <= 6; slot += 1) {
    const saved = state.romHash ? await dbGet(slotKey(slot)) : null;
    const container = document.createElement("div");
    container.className = "slot";
    const label = document.createElement("strong");
    label.textContent = `Slot ${slot}`;
    const when = document.createElement("time");
    when.textContent = saved
      ? new Date(saved.createdAt).toLocaleString()
      : "Empty";
    const saveButton = document.createElement("button");
    saveButton.textContent = "Save";
    saveButton.disabled = !state.gameLoaded;
    saveButton.addEventListener("click", async () => saveStateToSlot(slot));
    const loadButton = document.createElement("button");
    loadButton.textContent = "Load";
    loadButton.disabled = !saved || !state.gameLoaded;
    loadButton.addEventListener("click", async () => loadStateFromSlot(slot));
    const clearButton = document.createElement("button");
    clearButton.textContent = "Clear";
    clearButton.disabled = !saved;
    clearButton.addEventListener("click", async () => {
      await dbDelete(slotKey(slot));
      await refreshSlots();
      logLine(`Cleared state slot ${slot}`);
    });
    container.append(label, when, saveButton, loadButton, clearButton);
    elements.slotGrid.append(container);
  }
}

async function saveStateBytes() {
  const size = state.exports.retro_serialize_size();
  elements.metaStateSize.textContent = formatBytes(size);
  if (!size) throw new Error("Core reported an empty save state");
  const ptr = state.module._malloc(size);
  try {
    const ok = state.exports.retro_serialize(ptr, size);
    if (!ok) throw new Error("retro_serialize returned false");
    const bytes = new Uint8Array(state.module.HEAPU8.buffer, ptr, size).slice();
    return bytes;
  } finally {
    state.module._free(ptr);
  }
}

async function loadStateBytes(bytes) {
  const ptr = state.module._malloc(bytes.length);
  try {
    state.module.HEAPU8.set(bytes, ptr);
    const ok = state.exports.retro_unserialize(ptr, bytes.length);
    if (!ok) throw new Error("retro_unserialize returned false");
  } finally {
    state.module._free(ptr);
  }
}

async function saveStateToSlot(slot) {
  try {
    const bytes = await saveStateBytes();
    await dbSet(slotKey(slot), {
      createdAt: Date.now(),
      romName: state.romName,
      bytes,
    });
    await refreshSlots();
    logLine(`Saved slot ${slot}`);
  } catch (error) {
    logLine(`Save failed: ${error.message}`);
  }
}

async function loadStateFromSlot(slot) {
  try {
    const saved = await dbGet(slotKey(slot));
    if (!saved) throw new Error("Slot is empty");
    await loadStateBytes(saved.bytes);
    logLine(`Loaded slot ${slot}`);
  } catch (error) {
    logLine(`Load failed: ${error.message}`);
  }
}

function buildGameInfo(bytes, path) {
  const virtualPath = path || getDefaultRomVirtualPath(state.romName);
  const pathPtr = allocString(virtualPath);
  stageBytesAtPath(virtualPath, bytes);
  const dataPtr = state.module._malloc(bytes.length);
  state.module.HEAPU8.set(bytes, dataPtr);
  const infoPtr = state.module._malloc(16);
  state.module.setValue(infoPtr, pathPtr, "*");
  state.module.setValue(infoPtr + 4, dataPtr, "*");
  state.module.setValue(infoPtr + 8, bytes.length, "i32");
  state.module.setValue(infoPtr + 12, 0, "*");
  return { infoPtr, dataPtr, pathPtr };
}

function stopRunLoop() {
  if (state.animFrame) {
    cancelAnimationFrame(state.animFrame);
    state.animFrame = 0;
  }
}

function runLoop() {
  if (!state.gameLoaded) return;
  try {
    state.exports.retro_run();
    updateFps(performance.now());
    state.animFrame = requestAnimationFrame(runLoop);
  } catch (error) {
    stopRunLoop();
    clearAudioPlayback();
    reportRuntimeFailure("Run loop failed", error);
  }
}

async function bootGame() {
  if (!state.coreLoaded || !state.romBytes) return false;
  clearRuntimePanel();
  unloadGame();
  const { infoPtr, dataPtr, pathPtr } = buildGameInfo(
    state.romBytes,
    state.romVirtualPath || getDefaultRomVirtualPath(state.romName),
  );
  try {
    const loaded = state.exports.retro_load_game(infoPtr);
    if (!loaded) throw new Error("retro_load_game returned false");
    state.gameLoaded = true;
    updateUi();
    await refreshSlots();
    logLine(`Booted ${state.romName}`);
    runLoop();
    return true;
  } catch (error) {
    reportRuntimeFailure("Boot failed", error);
    unloadGame();
    return false;
  } finally {
    state.module._free(infoPtr);
    state.module._free(dataPtr);
    state.module._free(pathPtr);
  }
}

async function bootRomData(name, bytes, options = {}) {
  await selectRomData(name, bytes, options);
  return bootGame();
}

async function bootFromUrl(url, options = {}) {
  const response = await fetch(url, options.fetchInit);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const name = options.name || getPathLeaf(url);
  return bootRomData(name, bytes, options);
}

function stopCore() {
  unloadGame();
  setStatus("ready", "Core ready");
}

function unloadGame() {
  if (!state.coreLoaded) return;
  stopRunLoop();
  clearAudioPlayback();
  hideSoftwareKeyboard();
  const hadHardwareContext =
    state.usingHardwareVideo ||
    state.hwContextDestroyPtr ||
    state.hwContextResetPtr ||
    state.webglContextHandle;
  if (state.gameLoaded || hadHardwareContext) {
    if (hadHardwareContext) {
      destroyHardwareRenderContext();
    }
    try {
      state.exports.retro_unload_game();
    } catch (error) {
      logLine(`retro_unload_game failed: ${formatError(error)}`);
    }
  }
  state.gameLoaded = false;
  state.usingHardwareVideo = false;
  state.hwContextType = 0;
  state.hwContextResetPtr = 0;
  state.hwContextDestroyPtr = 0;
  state.hwProcAddressCallbackPtr = 0;
  state.fpsFrames = 0;
  state.fpsValue = 0;
  state.fpsLastUpdate = performance.now();
  state.softwarePresentStride = 1;
  state.softwareFrameCounter = 0;
  state.lastFrame = null;
  clearRuntimePanel();
  resetCanvasElement();
  clearCanvasSurface();
  updateUi();
}

async function exportCurrentState() {
  try {
    const bytes = await saveStateBytes();
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${state.romName || "azahar"}.state`;
    anchor.click();
    URL.revokeObjectURL(url);
    logLine("Exported save state");
  } catch (error) {
    logLine(`Export failed: ${error.message}`);
  }
}

async function importState(file) {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await loadStateBytes(bytes);
    logLine(`Imported save state from ${file.name}`);
  } catch (error) {
    logLine(`Import failed: ${error.message}`);
  }
}

elements.loadCore.addEventListener("click", () => {
  wakeAudioContext().catch(() => {});
  loadCore().catch((error) => {
    reportRuntimeFailure("Core load failed", error);
  });
});

elements.bootGame.addEventListener("click", () => {
  wakeAudioContext().catch(() => {});
  bootGame();
});

elements.unloadGame.addEventListener("click", () => {
  unloadGame();
  logLine("Game unloaded");
});

elements.runtimeDismiss?.addEventListener("click", () => {
  clearRuntimePanel();
});

elements.runtimeCopy?.addEventListener("click", async () => {
  const text = [
    elements.runtimeSummary?.textContent || "Runtime crash",
    elements.runtimeDetails?.textContent || "",
  ]
    .filter(Boolean)
    .join("\n\n");
  try {
    await navigator.clipboard.writeText(text);
    logLine("Copied runtime details");
  } catch (error) {
    logLine(`Copy runtime details failed: ${formatError(error)}`);
  }
});

elements.resetCore.addEventListener("click", () => {
  if (!state.gameLoaded) return;
  state.exports.retro_reset();
  logLine("Core reset");
});

elements.stopCore.addEventListener("click", () => {
  stopCore();
});

elements.exportState.addEventListener("click", () => {
  exportCurrentState();
});

elements.importState.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (file) {
    await importState(file);
  }
  event.target.value = "";
});

elements.romInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await selectRomBytes(file, bytes);
  logLine(`Selected ROM ${file.name}`);
  if (isHomebrewFileName(file.name)) {
    logLine(`Homebrew will boot from ${state.romVirtualPath}`);
  }
});

elements.sdImportFiles.addEventListener("change", async (event) => {
  try {
    await importSdFiles(event.target.files, "files");
  } catch (error) {
    logLine(`SD import failed: ${formatError(error)}`);
  } finally {
    event.target.value = "";
  }
});

elements.sdImportFolder.addEventListener("change", async (event) => {
  try {
    await importSdFiles(event.target.files, "folder");
  } catch (error) {
    logLine(`SD folder import failed: ${formatError(error)}`);
  } finally {
    event.target.value = "";
  }
});

elements.softwareKeyboardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitSoftwareKeyboard(state.softwareKeyboardOkButton);
});

window.addEventListener("keydown", (event) => {
  wakeAudioContext().catch(() => {});
  if (state.softwareKeyboardOpen) {
    if (event.key === "Escape" && state.softwareKeyboardCancelButton >= 0) {
      event.preventDefault();
      submitSoftwareKeyboard(state.softwareKeyboardCancelButton);
    }
    return;
  }
  state.keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  if (state.softwareKeyboardOpen) {
    return;
  }
  state.keys.delete(event.code);
});

window.addEventListener("mousemove", (event) => {
  if (state.softwareKeyboardOpen) return;
  updatePointerFromClient(event.clientX, event.clientY, state.pointerPressed);
});

window.addEventListener("mouseup", () => {
  releasePointer();
});

window.addEventListener("error", (event) => {
  reportRuntimeFailure(
    "Window error",
    event.error || event.message || "Unknown window error",
  );
});

window.addEventListener("unhandledrejection", (event) => {
  reportRuntimeFailure("Unhandled promise rejection", event.reason);
});

attachCanvasInputHandlers();
refreshSlots();
updateSdStatus();
updateUi();
autoLoadCore();

window.AzaharWebApp = {
  loadCore,
  bootGame,
  unloadGame,
  stopCore,
  resetCore: () => {
    if (!state.gameLoaded) return false;
    state.exports.retro_reset();
    logLine("Core reset");
    return true;
  },
  selectRomData,
  bootRomData,
  bootFromUrl,
  importSdEntries,
  getState: () => ({
    coreLoaded: state.coreLoaded,
    gameLoaded: state.gameLoaded,
    romName: state.romName,
    romVirtualPath: state.romVirtualPath,
    rendererPreset: state.rendererPreset,
    experimentalHardwareShaders: state.experimentalHardwareShaders,
    fps: state.fpsValue,
  }),
};
window.dispatchEvent(new Event("azahar-web-app-ready"));
