import "../styles/calculator.css";
import { Achievements } from "../achievements.js";
import { KeybindManager } from "../keybindManager.js";
import { BaseApp, os } from "../framework.js";

export class CalculatorApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
    this.reset();
  }

  reset() {
    this.current = "0";
    this.previous = null;
    this.operator = null;
    this.lastOperand = null;
    this.justEvaluated = false;
    this.waitingForOperand = false;
    this.error = false;
    this.history = [];
  }

  open() {
    const winId = "calculator-window";
    if (this.openWindows.has(winId)) return;

    const win = os.window.create(winId, "Calculator", "360px", "560px", {
      icon: "fas fa-calculator",
      appId: "calculatorApp"
    });

    this.win = win;
    this.openWindows.add(winId);
    this.reset();
    win.innerHTML = this.buildUI();
    this.bindCalculatorEvents(win);

    const resultEl = win.querySelector("#calc-result");
    if (resultEl) {
      resultEl.textContent = this.current;
      resultEl.className = "calc-result calc-result-size-lg";
    }

    win.addEventListener("remove", () => {
      this.openWindows.delete(winId);
      this.win = null;
    });

    win.setAttribute("tabindex", "0");
    setTimeout(() => win.focus(), 50);
  }

  buildUI() {
    return `<div class="calc-body">
  <div class="calc-history" id="calc-history"></div>
  <div class="calc-display">
    <div class="calc-expression" id="calc-expression"></div>
    <div class="calc-result calc-result-size-lg" id="calc-result">0</div>
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

  bindCalculatorEvents(win) {
    win.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const value = btn.dataset.value;
        switch (action) {
          case "digit":
            this.handleDigit(value);
            break;
          case "op":
            this.handleOp(value);
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
          case "equals":
            this.handleEquals();
            break;
        }
      });
    });

    win.querySelector("#calc-history")?.addEventListener("click", (e) => {
      const item = e.target.closest(".calc-history-item");
      if (!item) return;
      const idx = Number(item.dataset.index);
      const entry = this.history[idx];
      if (!entry) return;
      this.current = entry.split("=").pop().trim();
      this.justEvaluated = true;
      this.updateDisplay();
    });

    win.addEventListener("keydown", (e) => this.handleKeydown(e));
  }

  handleDigit(payload) {
    if (this.justEvaluated || this.waitingForOperand) {
      this.current = payload;
      this.waitingForOperand = false;
      this.justEvaluated = false;
    } else {
      this.current = this.current === "0" ? payload : this.current + payload;
    }
    this.updateDisplay();
  }

  handleDot() {
    if (this.waitingForOperand) {
      this.current = "0.";
      this.waitingForOperand = false;
    } else if (!this.current.includes(".")) {
      this.current += ".";
    }
    this.updateDisplay();
  }

  handleClear() {
    this.current = "0";
    this.previous = null;
    this.operator = null;
    this.lastOperand = null;
    this.justEvaluated = false;
    this.waitingForOperand = false;
    this.error = false;
    const expressionEl = this.win?.querySelector("#calc-expression");
    if (expressionEl) expressionEl.textContent = "";
    this.updateDisplay();
  }

  handleSign() {
    const n = parseFloat(this.current);
    if (Number.isFinite(n)) {
      this.current = (Math.round(n * -1 * 1e12) / 1e12).toString();
    }
    this.updateDisplay();
  }

  handlePercent() {
    const cur = parseFloat(this.current);
    if (!Number.isFinite(cur)) return;

    if (this.previous !== null) {
      const prev = parseFloat(this.previous);
      if (Number.isFinite(prev)) {
        if (this.operator === "+" || this.operator === "−") {
          this.current = (Math.round(((prev * cur) / 100) * 1e12) / 1e12).toString();
        } else if (this.operator === "×" || this.operator === "÷") {
          this.current = (Math.round((cur / 100) * 1e12) / 1e12).toString();
        }
      }
    } else {
      this.current = (Math.round((cur / 100) * 1e12) / 1e12).toString();
    }
    this.updateDisplay();
  }

  handleBackspace() {
    if (!this.justEvaluated) {
      if (this.current.length > 1) {
        this.current = this.current.slice(0, -1);
        if (this.current === "-" || this.current === "-0") this.current = "0";
      } else {
        this.current = "0";
      }
    }
    this.updateDisplay();
  }

  handleOp(payload) {
    const applyOp = (a, op, b) => {
      const fa = parseFloat(a);
      const fb = parseFloat(b);
      if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;

      let r;
      if (op === "+") r = fa + fb;
      else if (op === "−") r = fa - fb;
      else if (op === "×") r = fa * fb;
      else if (op === "÷") {
        if (fb === 0) return null;
        r = fa / fb;
      }
      return Math.round(r * 1e12) / 1e12;
    };

    if (this.previous !== null && this.operator && !this.waitingForOperand) {
      const result = applyOp(this.previous, this.operator, this.current);
      if (result === null) {
        this.current = "Error";
        this.error = true;
      } else {
        this.current = result.toString();
        this.previous = this.current;
      }
    } else {
      this.previous = this.current;
    }
    this.operator = payload;
    this.waitingForOperand = true;
    this.justEvaluated = false;

    const expressionEl = this.win?.querySelector("#calc-expression");
    if (expressionEl) expressionEl.textContent = `${this.previous} ${payload}`;
    this.updateDisplay();
  }

  handleEquals() {
    const applyOp = (a, op, b) => {
      const fa = parseFloat(a);
      const fb = parseFloat(b);
      if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;

      let r;
      if (op === "+") r = fa + fb;
      else if (op === "−") r = fa - fb;
      else if (op === "×") r = fa * fb;
      else if (op === "÷") {
        if (fb === 0) return null;
        r = fa / fb;
      }
      return Math.round(r * 1e12) / 1e12;
    };

    if (this.operator) {
      let operand = !this.waitingForOperand ? this.current : this.lastOperand;
      if (operand !== null) {
        this.lastOperand = operand;
        const result = applyOp(this.previous, this.operator, operand);
        if (result === null) {
          this.current = "Error";
          this.error = true;
        } else {
          const entry = `${this.previous} ${this.operator} ${operand} = ${result}`;
          this.history.unshift(entry);
          if (this.history.length > 50) this.history.pop();
          const historyEl = this.win?.querySelector("#calc-history");
          if (historyEl) {
            historyEl.innerHTML = this.history
              .map((h, i) => `<div class="calc-history-item" data-index="${i}">${h}</div>`)
              .join("");
          }
          const expressionEl = this.win?.querySelector("#calc-expression");
          if (expressionEl) expressionEl.textContent = `${this.previous} ${this.operator} ${operand} =`;
          this.current = result.toString();
          this.previous = this.current;
          this.os.app.apps.achievementsApp?.incrementCalculationDone();
          this.waitingForOperand = true;
          this.justEvaluated = true;
        }
      }
    }
    this.updateDisplay();
  }

  handleKeydown(e) {
    if (KeybindManager.matches(e, "calc.paste")) {
      navigator.clipboard
        .readText()
        .then((text) => {
          if (!text) return;
          try {
            const cleaned = text
              .replace(/×/g, "*")
              .replace(/÷/g, "/")
              .replace(/−/g, "-")
              .replace(/[^0-9+\-*/().% ]/g, "");
            if (!cleaned) return;
            const result = Function(`return (${cleaned})`)();
            if (!Number.isFinite(result)) return;
            const r = Math.round(result * 1e12) / 1e12;
            const formatted = r.toString();
            this.history.unshift(`${text} = ${formatted}`);
            if (this.history.length > 50) this.history.pop();
            const historyEl = this.win?.querySelector("#calc-history");
            if (historyEl) {
              historyEl.innerHTML = this.history
                .map((h, i) => `<div class="calc-history-item" data-index="${i}">${h}</div>`)
                .join("");
            }
            const expressionEl = this.win?.querySelector("#calc-expression");
            if (expressionEl) expressionEl.textContent = `${text} =`;
            this.current = formatted;
            this.previous = formatted;
            this.justEvaluated = true;
            this.updateDisplay();
          } catch {}
        })
        .catch(() => {});
      e.preventDefault();
      return;
    }

    const k = e.key;

    if (k >= "0" && k <= "9") this.handleDigit(k);
    else if (k === ".") this.handleDot();
    else if (k === "+") this.handleOp("+");
    else if (k === "-") this.handleOp("−");
    else if (k === "*") this.handleOp("×");
    else if (k === "/") this.handleOp("÷");
    else if (k === "%") this.handlePercent();
    else if (k === "Enter" || k === "=") this.handleEquals();
    else if (k === "Backspace") this.handleBackspace();
    else if (k === "Escape" || k === "Delete") this.handleClear();
    else return;

    e.preventDefault();
  }

  updateDisplay() {
    const resultEl = this.win?.querySelector("#calc-result");
    if (resultEl) {
      resultEl.textContent = this.current;
      const calcSz = this.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
      resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + calcSz;
    }
  }

  onClose(winId) {
    this.openWindows.delete(winId);
    this.win = null;
  }
}
