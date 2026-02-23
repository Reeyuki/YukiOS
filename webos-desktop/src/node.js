import { desktop } from "./desktop.js";

/**
 * NodeEditorApp — In-browser JavaScript editor with npm package support.
 *
 * Execution engine : QuickJS compiled to WebAssembly (quickjs-emscripten)
 *                    using the ASYNCIFY variant so the module loader can fetch
 *                    packages asynchronously.
 *
 * Package system   : `import foo from 'lodash'` inside user code is resolved
 *                    by fetching https://esm.sh/lodash (ESM bundle) at runtime.
 *                    Users can also "install" packages via the Packages panel
 *                    which pins a specific version and caches the source so
 *                    subsequent runs don't need to re-fetch.
 *
 * CDN dependencies (loaded once, lazily):
 *   https://esm.sh/quickjs-emscripten@0.31.0              (sync build, ~500 KB WASM)
 *   https://esm.sh/quickjs-emscripten@0.31.0/variants/    (async build, ~1 MB WASM)
 *
 */
export class NodeEditorApp {
  constructor(fileSystemManager, windowManager) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
    this.explorerApp = null;

    this._asyncModule = null;
    this._loadPromise = null;

    this._pkgCache = new Map();

    this._runState = new Map();
  }

  setExplorer(explorerApp) {
    this.explorerApp = explorerApp;
  }

  open(title = "NodeJS Code Editor", content = "", filePath = null) {
    const winId = `node-editor-${title.replace(/\s+/g, "-")}`;
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const win = this.wm.createWindow(winId, `${title} — NodeJS Code Editor`, "980px", "600px");
    Object.assign(win.style, { left: "160px", top: "70px" });
    win.innerHTML = this._buildHTML(title, content);

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, `${title} — NodeJS Code Editor`, "fab fa-js-square");
    setTimeout(() => this.wm.updateTransparency(), 0);

    this._bindControls(win, filePath);
    this._initRuntime(win);
  }

  _buildHTML(title, content) {
    const escaped = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `
      <div class="window-header">
        <span>${title} — NodeJS Code Editor</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">×</button>
        </div>
      </div>

      <div class="python-interpreter" style="display:flex;flex-direction:column;height:calc(100% - 36px)">

        <!-- Toolbar -->
        <div class="python-toolbar" style="flex-shrink:0">
          <button class="editor-btn run-btn" id="runBtn" disabled>
            <i class="fas fa-play"></i> Run
          </button>
          <button class="editor-btn stop-btn" id="stopBtn" disabled style="display:none">
            <i class="fas fa-stop"></i> Stop
          </button>
          <button class="editor-btn" id="clearBtn">
            <i class="fas fa-eraser"></i> Clear
          </button>
          <button class="editor-btn" id="saveBtn">
            <i class="fas fa-save"></i> Save
          </button>
          <button class="editor-btn" id="loadBtn">
            <i class="fas fa-folder-open"></i> Load
          </button>
          <button class="editor-btn" id="pkgToggleBtn" title="Toggle package manager">
            <i class="fas fa-box"></i> Packages
          </button>
          <input type="text" id="nodeFilename" class="editor-filename" value="index.js" spellcheck="false" />

          <!-- Runtime status -->
          <div class="pyodide-progress-wrap visible" id="progressWrap">
            <div class="pyodide-status-dot pulsing" id="statusDot"></div>
            <div class="pyodide-progress-track">
              <div class="pyodide-progress-fill" id="progressFill" style="width:0%"></div>
            </div>
            <span class="pyodide-progress-label" id="statusLabel">Loading QuickJS…</span>
          </div>
        </div>

        <!-- Main body: editor | output | packages -->
        <div style="display:flex;flex:1;min-height:0;overflow:hidden">

          <!-- Editor -->
          <div class="python-editor-section" style="flex:1;min-width:0;display:flex;flex-direction:column">
            <div class="python-section-header">
              <i class="fab fa-js-square"></i> Editor
              <span style="font-size:10px;opacity:0.5;margin-left:8px">Ctrl+Enter to run · import any npm pkg</span>
            </div>
            <textarea
              class="python-code-editor"
              id="nodeCodeEditor"
              style="flex:1;resize:none"
              placeholder="// import any npm package — it will be fetched from esm.sh&#10;import _ from 'lodash'&#10;console.log(_.chunk([1,2,3,4,5], 2))"
              spellcheck="false"
            >${escaped}</textarea>
          </div>

          <!-- Output -->
          <div class="python-output-section" style="flex:1;min-width:0;display:flex;flex-direction:column">
            <div class="python-section-header">
              <i class="fas fa-terminal"></i> Output
            </div>
            <div class="python-output" id="nodeOutput" style="flex:1;overflow:auto">
              <span class="out-info">Run your script to see output here.</span>
            </div>
          </div>

          <!-- Package Manager Panel (hidden by default) -->
          <div id="pkgPanel" style="
            width:0;overflow:hidden;flex-shrink:0;
            display:flex;flex-direction:column;
            transition:width 0.2s ease;
            background:var(--window-bg,#1e1e2e);
            border-left:1px solid var(--border-color,#333);
          ">
            <div class="python-section-header" style="white-space:nowrap">
              <i class="fas fa-box"></i> Package Manager
            </div>

            <!-- Install row -->
            <div style="display:flex;gap:6px;padding:8px;flex-shrink:0">
              <input
                id="pkgInput"
                type="text"
                placeholder="e.g. lodash@4 or dayjs"
                spellcheck="false"
                style="
                  flex:1;padding:4px 8px;border-radius:4px;
                  background:var(--input-bg,#111);color:inherit;
                  border:1px solid var(--border-color,#444);font-size:12px;
                "
              />
              <button class="editor-btn" id="pkgInstallBtn" style="white-space:nowrap;padding:4px 10px">
                <i class="fas fa-download"></i> Install
              </button>
            </div>

            <!-- Installed list -->
            <div style="font-size:11px;padding:0 10px 4px;opacity:0.5;flex-shrink:0">Installed packages</div>
            <ul id="pkgList" style="
              flex:1;overflow-y:auto;margin:0;padding:4px 8px;
              list-style:none;font-size:12px;
            "></ul>

            <!-- Info -->
            <div style="font-size:10px;padding:8px;opacity:0.4;line-height:1.5;flex-shrink:0">
              Packages are fetched from esm.sh and cached for this session.
              Use bare specifiers in your code:<br>
              <code>import _ from 'lodash'</code>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  async _initRuntime(win) {
    const progressFill = win.querySelector("#progressFill");
    const statusLabel = win.querySelector("#statusLabel");
    const statusDot = win.querySelector("#statusDot");
    const progressWrap = win.querySelector("#progressWrap");
    const runBtn = win.querySelector("#runBtn");

    try {
      let fakeProgress = 0;
      const ticker = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + 3, 85);
        progressFill.style.width = `${fakeProgress}%`;
      }, 150);

      await this._ensureAsyncModule();

      clearInterval(ticker);
      progressFill.style.width = "100%";
      statusLabel.textContent = "QuickJS ready";
      statusDot.classList.remove("pulsing");
      statusDot.classList.add("ready");
      runBtn.disabled = false;

      setTimeout(() => {
        progressWrap.style.transition = "opacity 0.5s";
        progressWrap.style.opacity = "0";
        setTimeout(() => progressWrap.classList.remove("visible"), 500);
      }, 1200);
    } catch (err) {
      statusLabel.textContent = `Load failed: ${err.message}`;
      statusDot.classList.remove("pulsing");
      statusDot.classList.add("error");
    }
  }

  /**
   * Load (or reuse) the QuickJS ASYNCIFY WASM module.
   * We need the asyncify build so setModuleLoader can return a Promise
   * (allowing us to fetch() packages inside the loader).
   */
  async _ensureAsyncModule() {
    if (this._asyncModule) return this._asyncModule;
    if (!this._loadPromise) {
      this._loadPromise = (async () => {
        const { newQuickJSAsyncWASMModule } = await import("https://esm.sh/quickjs-emscripten@0.31.0");
        this._asyncModule = await newQuickJSAsyncWASMModule();
        return this._asyncModule;
      })();
    }
    return this._loadPromise;
  }

  _bindControls(win, currentFilePath) {
    const winId = win.id;
    const codeArea = win.querySelector("#nodeCodeEditor");
    const outputArea = win.querySelector("#nodeOutput");
    const filenameInput = win.querySelector("#nodeFilename");
    const runBtn = win.querySelector("#runBtn");
    const stopBtn = win.querySelector("#stopBtn");
    const pkgPanel = win.querySelector("#pkgPanel");
    const pkgToggleBtn = win.querySelector("#pkgToggleBtn");
    const pkgInput = win.querySelector("#pkgInput");
    const pkgInstallBtn = win.querySelector("#pkgInstallBtn");
    const pkgList = win.querySelector("#pkgList");

    // Tab / Ctrl+Enter
    codeArea.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const s = codeArea.selectionStart,
          end = codeArea.selectionEnd;
        codeArea.value = codeArea.value.slice(0, s) + "    " + codeArea.value.slice(end);
        codeArea.selectionStart = codeArea.selectionEnd = s + 4;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!runBtn.disabled) runBtn.click();
      }
    });
    pkgToggleBtn.addEventListener("click", () => {
      const open = pkgPanel.style.width !== "0px" && pkgPanel.style.width !== "0";
      pkgPanel.style.width = open ? "0" : "240px";
    });

    const doInstall = async () => {
      const spec = pkgInput.value.trim();
      if (!spec) return;
      pkgInstallBtn.disabled = true;
      pkgInstallBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Installing…';

      try {
        const { name, version, source } = await this._fetchPackage(spec);
        this._pkgCache.set(name, { version, source });
        this._renderPkgList(pkgList);
        pkgInput.value = "";
        this._appendOutput(outputArea, `✅ Installed ${name}@${version}`, "info");
      } catch (err) {
        this._appendOutput(outputArea, `❌ Install failed: ${err.message}`, "error");
      } finally {
        pkgInstallBtn.disabled = false;
        pkgInstallBtn.innerHTML = '<i class="fas fa-download"></i> Install';
      }
    };

    pkgInstallBtn.addEventListener("click", doInstall);
    pkgInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doInstall();
    });

    runBtn.addEventListener("click", async () => {
      const code = codeArea.value.trim();
      if (!code) {
        this._appendOutput(outputArea, "⚠️ Nothing to run.", "info");
        return;
      }

      outputArea.innerHTML = "";
      runBtn.disabled = true;
      stopBtn.style.display = "inline-flex";
      stopBtn.disabled = false;
      this._setRunning(win, true);

      const state = { cancelled: false };
      this._runState.set(winId, state);

      try {
        await this._executeCode(code, outputArea, state);
      } finally {
        this._runState.delete(winId);
        runBtn.disabled = false;
        stopBtn.style.display = "none";
        stopBtn.disabled = true;
        this._setRunning(win, false);
      }
    });

    stopBtn.addEventListener("click", () => {
      const state = this._runState.get(winId);
      if (state) state.cancelled = true;
    });

    win.querySelector("#clearBtn").addEventListener("click", () => {
      outputArea.innerHTML = "";
    });

    win.querySelector("#saveBtn").addEventListener("click", () => {
      const fileName = filenameInput.value.trim() || "index.js";
      const content = codeArea.value;
      if (currentFilePath) {
        try {
          this.fs.updateFile(currentFilePath, fileName, content);
          this.wm.showPopup(`Saved: ${fileName}`);
        } catch (e) {
          this.wm.showPopup(`Save failed: ${e.message}`);
        }
      } else {
        this._saveAs(fileName, content);
      }
    });

    win.querySelector("#loadBtn").addEventListener("click", () => {
      if (!this.explorerApp) {
        this.wm.showPopup("File explorer not available.");
        return;
      }
      this.explorerApp.open(async (path, fileName) => {
        try {
          codeArea.value = await this.fs.getFileContent(path, fileName);
          filenameInput.value = fileName || "script.js";
          currentFilePath = path;
        } catch (e) {
          this.wm.showPopup(`Load failed: ${e.message}`);
        }
      });
    });
  }

  /**
   * Fetch an npm package as ESM source from esm.sh.
   * spec can be "lodash", "lodash@4.17", "dayjs@latest", etc.
   *
   * Returns { name, version, source }
   */
  async _fetchPackage(spec) {
    const atIdx = spec.lastIndexOf("@");
    const hasVersion = atIdx > 0;
    const name = hasVersion ? spec.slice(0, atIdx) : spec;
    const version = hasVersion ? spec.slice(atIdx + 1) : "latest";

    const url = `https://esm.sh/${name}@${version}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`esm.sh returned ${res.status} for "${spec}"`);

    const source = await res.text();

    const resolvedUrl = res.url;
    const versionMatch = resolvedUrl.match(/@([\d.]+)/);
    const resolvedVersion = versionMatch ? versionMatch[1] : version;
    this._pkgCache.set(name, { version: resolvedVersion, source });
    this._pkgCache.set(`https://esm.sh/${name}@${resolvedVersion}`, { version: resolvedVersion, source });
    return { name, version: resolvedVersion, source };
  }

  /**
   * Resolve a bare module specifier to ESM source.
   * Called by the QuickJS module loader for every `import` statement.
   *
   * Priority:
   *  1. Already in cache (pre-installed or previously fetched this session)
   *  2. Fetch live from esm.sh and add to cache
   */
  async _resolveModule(specifier) {
    // Relative imports — not supported in sandbox
    if (specifier.startsWith(".")) {
      return `// relative import "${specifier}" is not supported in browser sandbox`;
    }

    // Build the canonical full URL
    let url;
    if (specifier.startsWith("http://") || specifier.startsWith("https://")) {
      url = specifier;
    } else if (specifier.startsWith("/")) {
      // Root-relative path from esm.sh (e.g. "/rxjs@7.8.2/es2022/...")
      url = `https://esm.sh${specifier}`; // single slash — specifier already has leading /
    } else {
      // Bare specifier like "rxjs" or "lodash@4"
      url = `https://esm.sh/${specifier}`;
    }

    // Cache by full URL to avoid re-fetching sub-modules
    if (this._pkgCache.has(url)) {
      return this._pkgCache.get(url).source;
    }

    // Also check bare-name cache for pre-installed packages
    const bareName = specifier.split("/")[0].replace(/^\//, "");
    if (!specifier.startsWith("/") && !specifier.startsWith("http") && this._pkgCache.has(bareName)) {
      return this._pkgCache.get(bareName).source;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const source = await res.text();
      // Cache by full URL so sub-module paths are keyed correctly
      this._pkgCache.set(url, { version: "latest", source });
      return source;
    } catch (err) {
      return `throw new Error("Cannot resolve module '${specifier}': ${err.message}")`;
    }
  }

  async _executeCode(code, outputArea, state) {
    const QuickJS = await this._ensureAsyncModule();

    const runtime = QuickJS.newRuntime();
    runtime.setMemoryLimit(128 * 1024 * 1024);

    // Interrupt handler: stop on user cancel or 30-second deadline
    const deadline = Date.now() + 30_000;
    runtime.setInterruptHandler(() => {
      if (state.cancelled) return true;
      return Date.now() > deadline;
    });

    runtime.setModuleLoader(async (moduleName) => {
      return this._resolveModule(moduleName);
    });

    const vm = runtime.newContext();

    const makeConsoleFn = (type) => {
      const fn = vm.newFunction(type, (...handles) => {
        const parts = handles.map((h) => {
          const v = vm.dump(h);
          return typeof v === "object" && v !== null ? JSON.stringify(v, null, 2) : String(v ?? "");
        });
        const outType = type === "error" || type === "warn" ? "stderr" : "stdout";
        this._appendOutput(outputArea, parts.join(" "), outType);
      });
      return fn;
    };

    const consoleObj = vm.newObject();
    for (const level of ["log", "warn", "error", "info", "debug", "dir", "table"]) {
      const fn = makeConsoleFn(level);
      vm.setProp(consoleObj, level, fn);
      fn.dispose();
    }
    vm.setProp(vm.global, "console", consoleObj);
    consoleObj.dispose();

    let hadOutput = outputArea.childElementCount > 0;

    try {
      // evalCodeAsync is required for async module loading to work
      const result = await vm.evalCodeAsync(code, "script.js", { type: "module" });

      if (result.error) {
        const errVal = vm.dump(result.error);
        const msg = errVal?.message ?? JSON.stringify(errVal);
        this._appendOutput(outputArea, msg, "error");
        result.error.dispose();
        hadOutput = true;
      } else {
        const val = vm.dump(result.value);
        result.value.dispose();
        if (val !== undefined) {
          const display = typeof val === "object" ? JSON.stringify(val, null, 2) : String(val);
          this._appendOutput(outputArea, `→ ${display}`, "result");
          hadOutput = true;
        }
      }
    } catch (err) {
      if (state.cancelled) {
        this._appendOutput(outputArea, "⛔ Execution stopped by user.", "info");
      } else if (Date.now() >= deadline) {
        this._appendOutput(outputArea, "⏱️ Timed out after 30 seconds.", "error");
      } else {
        this._appendOutput(outputArea, String(err), "error");
      }
      hadOutput = true;
    } finally {
      vm.dispose();
      runtime.dispose();
    }

    if (!hadOutput) {
      this._appendOutput(outputArea, "(no output)", "info");
    }
  }

  _renderPkgList(pkgList) {
    pkgList.innerHTML = "";

    if (this._pkgCache.size === 0) {
      pkgList.innerHTML = '<li style="opacity:0.4;padding:4px 2px">No packages installed yet.</li>';
      return;
    }

    for (const [name, { version }] of this._pkgCache.entries()) {
      const li = document.createElement("li");
      li.style.cssText =
        "display:flex;align-items:center;justify-content:space-between;padding:4px 2px;border-bottom:1px solid rgba(255,255,255,0.05)";

      const label = document.createElement("span");
      label.textContent = `${name}`;
      label.style.fontWeight = "600";

      const ver = document.createElement("span");
      ver.textContent = `v${version}`;
      ver.style.cssText = "opacity:0.5;font-size:10px;margin-left:6px";

      const removeBtn = document.createElement("button");
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.title = `Remove ${name}`;
      removeBtn.style.cssText =
        "background:none;border:none;cursor:pointer;opacity:0.5;padding:2px 4px;color:inherit;font-size:11px";
      removeBtn.addEventListener("click", () => {
        this._pkgCache.delete(name);
        this._renderPkgList(pkgList);
      });

      const left = document.createElement("span");
      left.appendChild(label);
      left.appendChild(ver);

      li.appendChild(left);
      li.appendChild(removeBtn);
      pkgList.appendChild(li);
    }
  }

  _setRunning(win, running) {
    const dot = win.querySelector("#statusDot");
    const label = win.querySelector("#statusLabel");
    const wrap = win.querySelector("#progressWrap");

    if (running) {
      wrap.classList.add("visible");
      wrap.style.opacity = "1";
      dot.classList.add("pulsing");
      dot.classList.remove("ready", "error");
      label.textContent = "Running…";
    } else {
      dot.classList.remove("pulsing");
      dot.classList.add("ready");
      label.textContent = "QuickJS ready";
      setTimeout(() => {
        wrap.style.transition = "opacity 0.5s";
        wrap.style.opacity = "0";
        setTimeout(() => wrap.classList.remove("visible"), 500);
      }, 800);
    }
  }

  _appendOutput(outputArea, text, type = "stdout") {
    const span = document.createElement("span");
    span.textContent = text;
    switch (type) {
      case "error":
        span.className = "out-error";
        break;
      case "stderr":
        span.className = "out-stderr";
        break;
      case "result":
        span.className = "out-result";
        break;
      case "info":
        span.className = "out-info";
        break;
    }
    outputArea.appendChild(span);
    outputArea.scrollTop = outputArea.scrollHeight;
  }

  _saveAs(fileName, content) {
    const pathString = prompt("Enter the folder path to save into:", "home/user/Projects");
    if (pathString === null) return;
    const path = pathString.split("/").filter(Boolean);
    try {
      this.fs.createFile(path, fileName, content);
      this.wm.showPopup(`Saved: ${fileName} → /${pathString}`);
    } catch (e) {
      this.wm.showPopup(`Save error: ${e.message}`);
    }
  }
}
