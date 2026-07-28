import { setStyle } from "../shared/domUtils.js";
export class TerminalRawMode {
  constructor(terminalElement, inputElement) {
    this.terminal = terminalElement;
    this.input = inputElement;
    this.isActive = false;
    this.onKey = null;
    this.onResize = null;
    this.keyHandler = null;
    this.origOverflow = "";
    this.cursorVisible = true;
    this.cursorEl = null;
    this.cursorRow = 0;
    this.cursorCol = 0;
  }

  enable(onKey, onResize) {
    if (this.isActive) return;
    this.isActive = true;
    this.onKey = onKey;
    this.onResize = onResize;

    this.origOverflow = this.terminal.style.overflow;
    this.terminal.style.overflow = "hidden";

    this.input.style.display = "none";

    this.keyHandler = (e) => {
      if (!this.isActive) return;
      e.preventDefault();
      e.stopPropagation();
      if (this.onKey) {
        const keyData = {
          key: e.key,
          code: e.code,
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey,
          meta: e.metaKey,
          charCode: e.key.length === 1 ? e.key.charCodeAt(0) : null,
          preventDefault: () => {},
          stopPropagation: () => {}
        };
        this.onKey(keyData);
      }
    };

    document.addEventListener("keydown", this.keyHandler, true);

    this.createCursor();
  }

  disable() {
    if (!this.isActive) return;
    this.isActive = false;
    this.terminal.style.overflow = this.origOverflow;
    this.input.style.display = "";
    this.removeCursor();
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler, true);
      this.keyHandler = null;
    }
    this.onKey = null;
    this.onResize = null;
  }

  get active() {
    return this.isActive;
  }

  setCursorPosition(row, col) {
    this.cursorRow = row;
    this.cursorCol = col;
    if (this.cursorEl) {
      this.cursorEl.style.top = `${row * 20}px`;
      this.cursorEl.style.left = `${col * 9}px`;
    }
  }

  showCursor() {
    this.cursorVisible = true;
    if (this.cursorEl) this.cursorEl.style.display = "";
  }

  hideCursor() {
    this.cursorVisible = false;
    if (this.cursorEl) this.cursorEl.style.display = "none";
  }

  write(text) {
    const el = document.createElement("span");
    el.textContent = text;
    this.terminal.appendChild(el);
    this.terminal.scrollTop = this.terminal.scrollHeight;
  }

  clear() {
    this.terminal.innerHTML = "";
    this.cursorRow = 0;
    this.cursorCol = 0;
  }

  get size() {
    const charWidth = 9;
    const charHeight = 20;
    const cols = Math.floor(this.terminal.clientWidth / charWidth);
    const rows = Math.floor(this.terminal.clientHeight / charHeight);
    return { rows: Math.max(rows, 10), cols: Math.max(cols, 20) };
  }

  createCursor() {
    if (this.cursorEl) return;
    this.cursorEl = document.createElement("div");
    setStyle(this.cursorEl, {
      position: "absolute",
      width: "8px",
      height: "18px",
      background: "var(--text-primary, #fff)",
      opacity: "0.8",
      pointerEvents: "none",
      zIndex: "10",
      animation: "terminal-cursor-blink 1s step-end infinite"
    });
    this.terminal.style.position = "relative";
    this.terminal.appendChild(this.cursorEl);
  }

  removeCursor() {
    if (this.cursorEl && this.cursorEl.parentNode) {
      this.cursorEl.parentNode.removeChild(this.cursorEl);
    }
    this.cursorEl = null;
  }
}

export class AltScreenManager {
  constructor(terminalContainer) {
    this.container = terminalContainer;
    this.isActive = false;
    this.savedContent = [];
    this.savedScrollPos = 0;
    this.bufferLines = [];
    this.onExit = null;
  }

  enter() {
    if (this.isActive) return;
    this.isActive = true;
    const outputEl = this.container.querySelector(".terminal-output");
    if (outputEl) {
      this.savedContent = Array.from(outputEl.childNodes);
      this.savedScrollPos = outputEl.scrollTop;
      outputEl.innerHTML = "";
    }
    this.bufferLines = [];
  }

  exit() {
    if (!this.isActive) return;
    this.isActive = false;
    const outputEl = this.container.querySelector(".terminal-output");
    if (outputEl) {
      outputEl.innerHTML = "";
      for (const child of this.savedContent) {
        outputEl.appendChild(child);
      }
      outputEl.scrollTop = this.savedScrollPos;
    }
    this.bufferLines = [];
    this.savedContent = [];
    if (this.onExit) this.onExit();
  }

  get active() {
    return this.isActive;
  }

  writeLine(text, renderer) {
    if (!this.isActive) return;
    this.bufferLines.push(text);
    const outputEl = this.container.querySelector(".terminal-output");
    if (!outputEl) return;
    if (renderer) {
      const el = renderer.render(text);
      outputEl.appendChild(el);
    } else {
      const div = document.createElement("div");
      div.textContent = text;
      outputEl.appendChild(div);
    }
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  clear() {
    if (!this.isActive) return;
    this.bufferLines = [];
    const outputEl = this.container.querySelector(".terminal-output");
    if (outputEl) outputEl.innerHTML = "";
  }

  get lines() {
    return [...this.bufferLines];
  }

  onExit(callback) {
    this.onExit = callback;
  }
}

export class TerminalUIApp {
  constructor(options = {}) {
    this.name = options.name || "app";
    this.rawModeInstance = null;
    this.altScreenInstance = null;
    this.isRunning = false;
    this.container = null;
    this.onStop = null;
  }

  async start(terminalInstance) {
    this.isRunning = true;
    this.container = terminalInstance.terminalContent;
    const outputEl = this.container.querySelector(".terminal-output");
    const inputEl = this.container.querySelector(".terminal-input");

    this.altScreenInstance = new AltScreenManager(this.container);
    this.altScreenInstance.enter();

    this.rawModeInstance = new TerminalRawMode(outputEl, inputEl);
    this.rawModeInstance.enable(
      (keyData) => this.handleKey(keyData),
      () => this.handleResize()
    );

    await this.onStart();

    while (this.isRunning) {
      await this.onTick();
    }

    this.rawModeInstance.disable();
    this.altScreenInstance.exit();
  }

  stop() {
    this.isRunning = false;
    if (this.onStop) this.onStop();
  }

  get rawMode() {
    return this.rawModeInstance;
  }
  get altScreen() {
    return this.altScreenInstance;
  }
  get running() {
    return this.isRunning;
  }

  async onStart() {}
  async onTick() {}
  handleKey(keyData) {}
  handleResize() {}

  onStop(callback) {
    this.onStop = callback;
  }
}
