import { desktop } from "./desktop.js";
import { initWorker, onProgress, onReady, getIsReady, getInitError, runPython, isRunning } from "./pyodide-bridge.js";

const PYTHON_VERSIONS = [
  {
    id: "3.12",
    label: "Python 3.12",
    badge: "Latest",
    badgeClass: "badge-latest",
    description: "Newest stable release. Best performance & features.",
    pyodideVersion: "0.26.4",
    workerPath: "/static/pyodide.worker.js"
  },
  {
    id: "3.11",
    label: "Python 3.11",
    badge: "Stable",
    badgeClass: "badge-stable",
    description: "Rock-solid. Recommended for most projects.",
    pyodideVersion: "0.25.1",
    workerPath: "/static/pyodide-3.11.worker.js"
  },
  {
    id: "3.10",
    label: "Python 3.10",
    badge: "Legacy",
    badgeClass: "badge-legacy",
    description: "Compatibility mode for older codebases.",
    pyodideVersion: "0.23.4",
    workerPath: "/static/pyodide-3.10.worker.js"
  }
];

export class PythonEditorApp {
  constructor(fileSystemManager, windowManager) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
    this.explorerApp = null;
    this._selectedVersion = null;
    this._workerInitialized = false;
  }

  setExplorer(explorerApp) {
    this.explorerApp = explorerApp;
  }

  open(title = "Python Editor", content = "", filePath = null) {
    const winId = `python-editor-${title.replace(/\s+/g, "-")}`;

    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const win = this.wm.createWindow(winId, `Python Editor`, "860px", "540px");
    Object.assign(win.style, { left: "180px", top: "80px" });

    win.innerHTML = this._buildVersionPickerHTML(title);

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, `Python Editor`, "fas fa-code");
    setTimeout(() => this.wm.updateTransparency(), 0);

    this._bindVersionPicker(win, title, content, filePath);
  }

  // ─── Version Picker ──────────────────────────────────────────────────────────

  _buildVersionPickerHTML() {
    const cards = PYTHON_VERSIONS.map(
      (v) => `
      <div
        class="py-version-card"
        data-version-id="${v.id}"
        tabindex="0"
        role="radio"
        aria-checked="false"
      >
        <div class="py-version-card-inner">
          <div class="py-version-top">
            <span class="py-version-label">${v.label}</span>
            <span class="py-version-badge ${v.badgeClass}">${v.badge}</span>
          </div>
          <p class="py-version-desc">${v.description}</p>
          <div class="py-version-check"><i class="fas fa-check-circle"></i></div>
        </div>
      </div>`
    ).join("");

    return `
      <div class="window-header">
        <span>Python Editor</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">×</button>
        </div>
      </div>

      <div class="py-version-screen">
        <div class="py-version-hero">
          <div class="py-version-icon"><i class="fab fa-python"></i></div>
          <h2 class="py-version-title">Select Python Version</h2>
          <p class="py-version-subtitle">Choose the runtime for your session. This cannot be changed afterwards.</p>
        </div>

        <div class="py-version-cards" role="radiogroup" aria-label="Python version">
          ${cards}
        </div>

        <div class="py-version-actions">
          <button class="py-version-launch-btn" id="launchBtn" disabled>
            <i class="fas fa-rocket"></i> Launch Editor
          </button>
        </div>
      </div>

      <style>
        /* ── Version Picker Screen ── */
        .py-version-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: calc(100% - 36px);
          padding: 24px 32px 28px;
          box-sizing: border-box;
          background: var(--window-bg, #1e1e2e);
          gap: 20px;
          overflow: auto;
        }

        .py-version-hero {
          text-align: center;
        }

        .py-version-icon {
          font-size: 2.4rem;
          color: #4ade80;
          margin-bottom: 8px;
          filter: drop-shadow(0 0 12px #4ade8066);
        }

        .py-version-title {
          margin: 0 0 6px;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary, #e2e8f0);
          letter-spacing: -0.01em;
        }

        .py-version-subtitle {
          margin: 0;
          font-size: 0.8rem;
          color: var(--text-muted, #94a3b8);
        }

        /* Cards */
        .py-version-cards {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          justify-content: center;
          width: 100%;
          max-width: 720px;
        }

        .py-version-card {
          flex: 1 1 190px;
          max-width: 220px;
          border: 1.5px solid var(--border, #334155);
          border-radius: 12px;
          padding: 16px;
          cursor: pointer;
          background: var(--card-bg, #0f172a);
          transition: border-color 0.18s, transform 0.15s, box-shadow 0.18s;
          position: relative;
          outline: none;
        }

        .py-version-card:hover {
          border-color: #4ade80;
          transform: translateY(-2px);
          box-shadow: 0 6px 24px #4ade8022;
        }

        .py-version-card:focus-visible {
          border-color: #4ade80;
          box-shadow: 0 0 0 3px #4ade8033;
        }

        .py-version-card.selected {
          border-color: #4ade80;
          background: #0f2818;
          box-shadow: 0 4px 20px #4ade8033;
        }

        .py-version-card-inner {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .py-version-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .py-version-label {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary, #e2e8f0);
          font-family: monospace;
        }

        .py-version-badge {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 2px 7px;
          border-radius: 20px;
        }

        .badge-latest  { background: #166534; color: #4ade80; }
        .badge-stable  { background: #1e3a5f; color: #60a5fa; }
        .badge-legacy  { background: #3d2c00; color: #fbbf24; }

        .py-version-desc {
          margin: 0;
          font-size: 0.76rem;
          color: var(--text-muted, #94a3b8);
          line-height: 1.4;
        }

        .py-version-check {
          position: absolute;
          top: 10px;
          right: 10px;
          font-size: 1rem;
          color: #4ade80;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .py-version-card.selected .py-version-check {
          opacity: 1;
        }

        /* Launch button */
        .py-version-actions {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .py-version-launch-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 28px;
          border-radius: 8px;
          border: none;
          background: #4ade80;
          color: #0a1a10;
          font-size: 0.9rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 16px #4ade8044;
        }

        .py-version-launch-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .py-version-launch-btn:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px #4ade8066;
        }

        .py-version-launch-btn:not(:disabled):active {
          transform: translateY(0);
        }
      </style>
    `;
  }

  _bindVersionPicker(win, title, content, filePath) {
    const cards = win.querySelectorAll(".py-version-card");
    const launchBtn = win.querySelector("#launchBtn");
    let selected = null;

    const selectCard = (card) => {
      cards.forEach((c) => {
        c.classList.remove("selected");
        c.setAttribute("aria-checked", "false");
      });
      card.classList.add("selected");
      card.setAttribute("aria-checked", "true");
      selected = card.dataset.versionId;
      launchBtn.disabled = false;
    };

    cards.forEach((card) => {
      card.addEventListener("click", () => selectCard(card));
      card.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          selectCard(card);
        }
      });
    });

    launchBtn.addEventListener("click", () => {
      if (!selected) return;
      const version = PYTHON_VERSIONS.find((v) => v.id === selected);
      this._selectedVersion = version;
      this._launchEditor(win, title, content, filePath, version);
    });
  }

  _launchEditor(win, title, content, filePath, version) {
    if (!this._workerInitialized) {
      initWorker(version.workerPath);
      this._workerInitialized = true;
    }

    win.innerHTML = this._buildHTML(title, content, version);

    this.wm.makeDraggable(win);
    this.wm.setupWindowControls(win);

    this._bindControls(win, filePath);
    this._initRuntimeStatus(win);
  }

  // ─── Editor ──────────────────────────────────────────────────────────────────

  _buildHTML(title, content, version) {
    const escaped = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const versionLabel = version ? version.label : "Python";
    return `
      <div class="window-header">
        <span>Python Editor</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">×</button>
        </div>
      </div>

      <div class="python-interpreter">

        <!-- Toolbar -->
        <div class="python-toolbar">
          <button class="editor-btn run-btn" id="runBtn">
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
          <input
            type="text"
            id="pythonFilename"
            class="editor-filename"
            value="main.py"
            spellcheck="false"
          />

          <!-- Version badge -->
          <span class="py-active-version-badge" title="Python runtime version">
            <i class="fab fa-python"></i> ${versionLabel}
          </span>

          <!-- Runtime status -->
          <div class="pyodide-progress-wrap" id="progressWrap">
            <div class="pyodide-status-dot pulsing" id="statusDot"></div>
            <div class="pyodide-progress-track">
              <div class="pyodide-progress-fill" id="progressFill"></div>
            </div>
            <span class="pyodide-progress-label" id="progressLabel">Loading runtime…</span>
          </div>
        </div>

        <!-- Editor + Output split -->
        <div class="python-editor-container">
          <div class="python-editor-section">
            <div class="python-section-header">
              <i class="fas fa-code"></i> Editor
            </div>
            <textarea
              class="python-code-editor"
              id="pythonCodeEditor"
              placeholder="# Write Python here&#10;print('Hello, World!')"
              spellcheck="false"
            >${escaped}</textarea>
          </div>

          <div class="python-output-section">
            <div class="python-section-header">
              <i class="fas fa-terminal"></i> Output
            </div>
            <div class="python-output" id="pythonOutput">
              <span class="out-info">Run your script to see output here.</span>
            </div>
          </div>
        </div>

      </div>

      <style>
        .py-active-version-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.72rem;
          font-weight: 600;
          font-family: monospace;
          padding: 3px 9px;
          border-radius: 20px;
          background: #0f2818;
          color: #4ade80;
          border: 1px solid #4ade8044;
          white-space: nowrap;
          margin-left: 4px;
        }
      </style>
    `;
  }

  _initRuntimeStatus(win) {
    const progressWrap = win.querySelector("#progressWrap");
    const progressFill = win.querySelector("#progressFill");
    const progressLabel = win.querySelector("#progressLabel");

    progressWrap.classList.add("visible");

    if (getIsReady()) {
      this._setStatus(win, "ready");
      return;
    }

    if (getInitError()) {
      this._setStatus(win, "error", getInitError());
      return;
    }

    const unsubProgress = onProgress(({ value, label }) => {
      if (value === -1) {
        this._setStatus(win, "error", label);
        unsubProgress();
        return;
      }
      progressFill.style.width = `${Math.min(value, 100)}%`;
      progressLabel.textContent = label;

      if (value >= 100) {
        setTimeout(() => {
          this._setStatus(win, "ready");
          unsubProgress();
        }, 600);
      }
    });

    onReady(() => {
      this._setStatus(win, "ready");
      const outputArea = win.querySelector("#pythonOutput");
      outputArea.innerHTML = "";
      unsubProgress();
    });
  }

  _setStatus(win, state, errorMsg = "") {
    const progressWrap = win.querySelector("#progressWrap");
    const progressFill = win.querySelector("#progressFill");
    const progressLabel = win.querySelector("#progressLabel");
    const statusDot = win.querySelector("#statusDot");
    const runBtn = win.querySelector("#runBtn");

    if (state === "ready") {
      progressFill.style.width = "100%";
      progressLabel.textContent = "Runtime ready";
      statusDot.classList.remove("pulsing");
      statusDot.classList.add("ready");
      runBtn.disabled = false;

      setTimeout(() => {
        progressWrap.style.transition = "opacity 0.5s";
        progressWrap.style.opacity = "0";
        setTimeout(() => progressWrap.classList.remove("visible"), 500);
      }, 1200);
    } else if (state === "error") {
      progressLabel.textContent = errorMsg || "Runtime failed";
      statusDot.classList.remove("pulsing");
      statusDot.classList.add("error");
    } else if (state === "running") {
      statusDot.classList.add("pulsing");
      statusDot.classList.remove("ready", "error");
    }
  }

  _bindControls(win, currentFilePath) {
    const codeArea = win.querySelector("#pythonCodeEditor");
    const outputArea = win.querySelector("#pythonOutput");
    const filenameInput = win.querySelector("#pythonFilename");
    const runBtn = win.querySelector("#runBtn");
    const stopBtn = win.querySelector("#stopBtn");

    codeArea.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = codeArea.selectionStart;
        const end = codeArea.selectionEnd;
        codeArea.value = codeArea.value.slice(0, start) + "    " + codeArea.value.slice(end);
        codeArea.selectionStart = codeArea.selectionEnd = start + 4;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!runBtn.disabled) runBtn.click();
      }
    });

    runBtn.addEventListener("click", async () => {
      if (!getIsReady()) {
        this._appendOutput(outputArea, "⏳ Runtime not ready yet. Please wait…", "info");
        return;
      }
      if (isRunning()) {
        this._appendOutput(outputArea, "⚠️ A script is already running.", "info");
        return;
      }

      const code = codeArea.value.trim();
      if (!code) {
        this._appendOutput(outputArea, "⚠️ Nothing to run.", "info");
        return;
      }

      outputArea.innerHTML = "";
      runBtn.disabled = true;
      stopBtn.style.display = "inline-flex";
      stopBtn.disabled = false;
      this._setStatus(win, "running");

      try {
        const result = await runPython(code, (text, stream) => {
          this._appendOutput(outputArea, text, stream === "stderr" ? "stderr" : "stdout");
        });

        if (result !== null && result !== undefined) {
          this._appendOutput(outputArea, `→ ${result}`, "result");
        }

        if (!outputArea.textContent.trim()) {
          this._appendOutput(outputArea, "(no output)", "info");
        }
      } catch (err) {
        this._appendOutput(outputArea, String(err), "error");
      } finally {
        runBtn.disabled = false;
        stopBtn.style.display = "none";
        stopBtn.disabled = true;
        if (getIsReady()) this._setStatus(win, "ready");
      }
    });

    win.querySelector("#clearBtn").addEventListener("click", () => {
      outputArea.innerHTML = "";
    });

    win.querySelector("#saveBtn").addEventListener("click", () => {
      const fileName = filenameInput.value.trim() || "main.py";
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
          const content = await this.fs.getFileContent(path, fileName);
          codeArea.value = content;
          filenameInput.value = fileName || "script.py";
          currentFilePath = path;
        } catch (e) {
          this.wm.showPopup(`Load failed: ${e.message}`);
        }
      });
    });
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
      default:
        break;
    }

    outputArea.appendChild(span);
    outputArea.scrollTop = outputArea.scrollHeight;
  }

  _saveAs(fileName, content) {
    const pathString = prompt("Enter the folder path to save into (e.g. home/user/Documents):", "home/user/Documents");
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
