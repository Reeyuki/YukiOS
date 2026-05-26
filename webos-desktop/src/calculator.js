import { BaseApp } from "./core/BaseApp.js";

export class CalculatorApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
    this.state = null;
    this.elements = {};
  }

  open() {
    const winId = "calculator-window";
    if (this.openWindows.has(winId)) return;

    const win = this.wm.createWindow(winId, "Calculator", 360, 560);
    win.innerHTML = this.buildUI();
    this.wm.mountWindow(win, winId, "Calculator", "fa-calculator");

    this.initializeState();
    this.cacheElements(winId);
    this.bindEvents(winId);
    this.updateDisplay();

    this.openWindows.add(winId);
  }

  onClose(winId) {
    this.openWindows.delete(winId);
  }

  buildUI() {
    return `<div class="window-header">
      <span>Calculator</span>
      ${this.wm.getWindowControls()}
    </div>
    <div class="calc-body">
      <div class="calc-history" id="calc-history"></div>
      <div class="calc-display">
        <div class="calc-expression" id="calc-expression"></div>
        <div class="calc-result" id="calc-result">0</div>
      </div>
      <div class="calc-grid">
        <button class="calc-btn span-two func" data-action="clear">AC</button>
        <button class="calc-btn func" data-action="sign">+/−</button>
        <button class="calc-btn func" data-action="percent">%</button>
        <button class="calc-btn" data-action="digit" data-value="7">7</button>
        <button class="calc-btn" data-action="digit" data-value="8">8</button>
        <button class="calc-btn" data-action="digit" data-value="9">9</button>
        <button class="calc-btn op" data-action="op" data-value="÷">÷</button>
        <button class="calc-btn" data-action="digit" data-value="4">4</button>
        <button class="calc-btn" data-action="digit" data-value="5">5</button>
        <button class="calc-btn" data-action="digit" data-value="6">6</button>
        <button class="calc-btn op" data-action="op" data-value="×">×</button>
        <button class="calc-btn" data-action="digit" data-value="1">1</button>
        <button class="calc-btn" data-action="digit" data-value="2">2</button>
        <button class="calc-btn" data-action="digit" data-value="3">3</button>
        <button class="calc-btn op" data-action="op" data-value="−">−</button>
        <button class="calc-btn" data-action="digit" data-value="0">0</button>
        <button class="calc-btn" data-action="dot">.</button>
        <button class="calc-btn op" data-action="backspace">⌫</button>
        <button class="calc-btn op" data-action="op" data-value="+">+</button>
        <button class="calc-btn span-four equals" data-action="equals">=</button>
      </div>
    </div>`;
  }

  initializeState() {
    this.state = {
      current: "0",
      previous: null,
      operator: null,
      lastOperand: null,
      justEvaluated: false,
      waitingForOperand: false,
      error: false,
      history: []
    };
  }

  cacheElements(winId) {
    this.elements = {
      result: document.getElementById("calc-result"),
      expression: document.getElementById("calc-expression"),
      history: document.getElementById("calc-history"),
      buttons: document.querySelectorAll(".calc-btn")
    };
  }

  bindEvents(winId) {
    this.elements.buttons.forEach((btn) => {
      btn.addEventListener("click", (e) => this.handleButtonClick(e));
    });

    this.elements.history.addEventListener("click", (e) => this.handleHistoryClick(e));

    const win = document.getElementById(winId);
    if (win) {
      win.addEventListener("keydown", (e) => this.handleKeydown(e));
    }
  }

  handleButtonClick(e) {
    const btn = e.target.closest(".calc-btn");
    if (!btn) return;

    const action = btn.dataset.action;
    const value = btn.dataset.value;

    this.performAction(action, value);
  }

  handleHistoryClick(e) {
    const item = e.target.closest(".calc-history-item");
    if (!item) return;

    const idx = Number(item.dataset.index);
    const entry = this.state.history[idx];
    const result = entry.split("=").pop().trim();
    this.state.current = result;
    this.state.justEvaluated = true;
    this.updateDisplay();
  }

  async handleKeydown(e) {
    const k = e.key;

    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "v") {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return;
        const result = this.evaluateExpression(text);
        if (result === null) return;

        const formatted = this.formatNumber(result);
        this.pushHistory(`${text} = ${formatted}`);
        this.elements.expression.textContent = `${text} =`;
        this.state.current = formatted;
        this.state.previous = formatted;
        this.state.justEvaluated = true;
        this.updateDisplay();
      } catch {}
      e.preventDefault();
      return;
    }

    if (k >= "0" && k <= "9") this.performAction("digit", k);
    else if (k === ".") this.performAction("dot");
    else if (k === "+") this.performAction("op", "+");
    else if (k === "-") this.performAction("op", "−");
    else if (k === "*") this.performAction("op", "×");
    else if (k === "/") this.performAction("op", "÷");
    else if (k === "%") this.performAction("percent");
    else if (k === "Enter" || k === "=") this.performAction("equals");
    else if (k === "Backspace") this.performAction("backspace");
    else if (k === "Escape" || k === "Delete") this.performAction("clear");
    else return;

    e.preventDefault();
  }

  performAction(action, value) {
    if (this.state.error && action !== "clear") {
      this.resetState();
    }

    switch (action) {
      case "digit":
        this.handleDigit(value);
        break;
      case "dot":
        this.handleDot();
        break;
      case "clear":
        this.handleClear();
        break;
      case "sign":
        this.handleSign();
        break;
      case "percent":
        this.handlePercent();
        break;
      case "backspace":
        this.handleBackspace();
        break;
      case "op":
        this.handleOperator(value);
        break;
      case "equals":
        this.handleEquals();
        break;
    }

    this.updateDisplay();
  }

  handleDigit(value) {
    if (this.state.justEvaluated || this.state.waitingForOperand) {
      this.state.current = value;
      this.state.waitingForOperand = false;
      this.state.justEvaluated = false;
    } else {
      this.state.current = this.state.current === "0" ? value : this.state.current + value;
    }
  }

  handleDot() {
    if (this.state.waitingForOperand) {
      this.state.current = "0.";
      this.state.waitingForOperand = false;
    } else if (!this.state.current.includes(".")) {
      this.state.current += ".";
    }
  }

  handleClear() {
    this.resetState();
    this.elements.expression.textContent = "";
  }

  handleSign() {
    const n = this.safeNumber(this.state.current);
    if (n !== null) {
      this.state.current = this.formatNumber(this.normalize(n * -1));
    }
  }

  handlePercent() {
    this.state.current = this.computePercent(this.state.current, this.state.previous, this.state.operator);
  }

  handleBackspace() {
    if (!this.state.justEvaluated) {
      if (this.state.current.length > 1) {
        this.state.current = this.state.current.slice(0, -1);
        if (this.state.current === "-" || this.state.current === "-0") this.state.current = "0";
      } else {
        this.state.current = "0";
      }
    }
  }

  handleOperator(value) {
    if (this.state.previous !== null && this.state.operator && !this.state.waitingForOperand) {
      const result = this.applyOp(this.state.previous, this.state.operator, this.state.current);
      if (result === null) {
        this.state.current = "Error";
        this.state.error = true;
      } else {
        this.state.current = this.formatNumber(result);
        this.state.previous = this.state.current;
      }
    } else {
      this.state.previous = this.state.current;
    }
    this.state.operator = value;
    this.state.waitingForOperand = true;
    this.state.justEvaluated = false;
    this.elements.expression.textContent = `${this.state.previous} ${value}`;
  }

  handleEquals() {
    if (this.state.operator) {
      let operand = !this.state.waitingForOperand ? this.state.current : this.state.lastOperand;
      if (operand !== null) {
        this.state.lastOperand = operand;
        const result = this.applyOp(this.state.previous, this.state.operator, operand);
        if (result === null) {
          this.state.current = "Error";
          this.state.error = true;
        } else {
          const entry = `${this.state.previous} ${this.state.operator} ${operand} = ${this.formatNumber(result)}`;
          this.pushHistory(entry);
          this.elements.expression.textContent = `${this.state.previous} ${this.state.operator} ${operand} =`;
          this.state.current = this.formatNumber(result);
          this.state.previous = this.state.current;
          this.state.waitingForOperand = true;
          this.state.justEvaluated = true;
        }
      }
    }
  }

  resetState() {
    this.state.current = "0";
    this.state.previous = null;
    this.state.operator = null;
    this.state.lastOperand = null;
    this.state.justEvaluated = false;
    this.state.waitingForOperand = false;
    this.state.error = false;
  }

  updateDisplay() {
    this.elements.result.textContent = this.state.current;
    this.elements.result.style.fontSize = this.state.current.length > 10 ? "1.6rem" : "2.4rem";
  }

  renderHistory() {
    this.elements.history.innerHTML = this.state.history
      .map((h, i) => `<div class="calc-history-item" data-index="${i}">${h}</div>`)
      .join("");
  }

  pushHistory(entry) {
    this.state.history.unshift(entry);
    if (this.state.history.length > 50) this.state.history.pop();
    this.renderHistory();
  }

  normalize(n) {
    if (!Number.isFinite(n)) return null;
    const r = Math.round(n * 1e12) / 1e12;
    return parseFloat(r.toString());
  }

  formatNumber(n) {
    if (n === null) return "Error";
    const s = n.toString();
    if (s.length > 12) return n.toExponential(6);
    return s;
  }

  safeNumber(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  applyOp(a, op, b) {
    const fa = this.safeNumber(a);
    const fb = this.safeNumber(b);
    if (fa === null || fb === null) return null;

    let r;
    if (op === "+") r = fa + fb;
    else if (op === "−") r = fa - fb;
    else if (op === "×") r = fa * fb;
    else if (op === "÷") {
      if (fb === 0) return null;
      r = fa / fb;
    }
    return this.normalize(r);
  }

  computePercent(current, previous, operator) {
    const cur = this.safeNumber(current);
    if (cur === null) return current;

    if (previous !== null) {
      const prev = this.safeNumber(previous);
      if (prev === null) return current;

      if (operator === "+" || operator === "−") {
        return this.formatNumber(this.normalize((prev * cur) / 100));
      }
      if (operator === "×" || operator === "÷") {
        return this.formatNumber(this.normalize(cur / 100));
      }
    }
    return this.formatNumber(this.normalize(cur / 100));
  }

  evaluateExpression(expr) {
    try {
      const cleaned = expr
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/[^0-9+\-*/().% ]/g, "");

      if (!cleaned) return null;

      const result = Function(`return (${cleaned})`)();

      if (!Number.isFinite(result)) return null;

      return this.normalize(result);
    } catch {
      return null;
    }
  }
}
