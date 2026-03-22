import { desktop } from "./desktop.js";

export class CalculatorApp {
  constructor(windowManager) {
    this.wm = windowManager;
    this.keyHandler = null;
  }

  open() {
    const winId = "calculator-app";
    if (document.getElementById(winId)) {
      this.wm.bringToFront(document.getElementById(winId));
      return;
    }

    const win = this.wm.createWindow(winId, "Calculator", "360px", "560px");
    Object.assign(win.style, { left: "300px", top: "120px" });

    win.innerHTML = `
      <div class="window-header calc-header">
        <span>Calculator</span>
        ${this.wm.getWindowControls()}

      </div>
      <div class="calc-body">
        <div class="calc-history" id="calc-history-${winId}"></div>
        <div class="calc-display">
          <div class="calc-expression" id="calc-expression-${winId}"></div>
          <div class="calc-result" id="calc-result-${winId}">0</div>
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
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Calculator", "fa fa-calculator", "#6677dd");

    this.setupCalcLogic(win, winId);
  }

  setupCalcLogic(win, winId) {
    const resultEl = win.querySelector(`#calc-result-${winId}`);
    const expressionEl = win.querySelector(`#calc-expression-${winId}`);
    const historyEl = win.querySelector(`#calc-history-${winId}`);

    let history = [];

    let state = {
      current: "0",
      previous: null,
      operator: null,
      lastOperand: null,
      justEvaluated: false,
      waitingForOperand: false,
      error: false
    };

    const resetState = () => {
      state = {
        current: "0",
        previous: null,
        operator: null,
        lastOperand: null,
        justEvaluated: false,
        waitingForOperand: false,
        error: false
      };
    };

    const normalize = (n) => {
      if (!Number.isFinite(n)) return null;
      const r = Math.round(n * 1e12) / 1e12;
      return parseFloat(r.toString());
    };

    const format = (n) => {
      if (n === null) return "Error";
      const s = n.toString();
      if (s.length > 12) return n.toExponential(6);
      return s;
    };

    const safeNumber = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };

    const update = () => {
      resultEl.textContent = state.current;
      resultEl.style.fontSize = state.current.length > 10 ? "1.6rem" : "2.4rem";
    };

    const renderHistory = () => {
      historyEl.innerHTML = history
        .map((h, i) => `<div class="calc-history-item" data-index="${i}">${h}</div>`)
        .join("");
    };

    const pushHistory = (entry) => {
      history.unshift(entry);
      if (history.length > 50) history.pop();
      renderHistory();
    };

    historyEl.addEventListener("click", (e) => {
      const item = e.target.closest(".calc-history-item");
      if (!item) return;
      const idx = Number(item.dataset.index);
      const entry = history[idx];
      const result = entry.split("=").pop().trim();
      state.current = result;
      state.justEvaluated = true;
      update();
    });

    const applyOp = (a, op, b) => {
      const fa = safeNumber(a);
      const fb = safeNumber(b);
      if (fa === null || fb === null) return null;

      let r;

      if (op === "+") r = fa + fb;
      else if (op === "−") r = fa - fb;
      else if (op === "×") r = fa * fb;
      else if (op === "÷") {
        if (fb === 0) return null;
        r = fa / fb;
      }

      return normalize(r);
    };

    const computePercent = () => {
      const cur = safeNumber(state.current);
      if (cur === null) return;

      if (state.previous !== null) {
        const prev = safeNumber(state.previous);
        if (prev === null) return;

        if (state.operator === "+" || state.operator === "−") {
          state.current = format(normalize((prev * cur) / 100));
          return;
        }

        if (state.operator === "×" || state.operator === "÷") {
          state.current = format(normalize(cur / 100));
          return;
        }
      }

      state.current = format(normalize(cur / 100));
    };

    const evaluateExpression = (expr) => {
      try {
        const cleaned = expr
          .replace(/×/g, "*")
          .replace(/÷/g, "/")
          .replace(/−/g, "-")
          .replace(/[^0-9+\-*/().% ]/g, "");

        if (!cleaned) return null;

        const result = Function(`return (${cleaned})`)();

        if (!Number.isFinite(result)) return null;

        return normalize(result);
      } catch {
        return null;
      }
    };

    const perform = (action, value) => {
      if (state.error && action !== "clear") resetState();

      if (action === "digit") {
        if (state.justEvaluated || state.waitingForOperand) {
          state.current = value;
          state.waitingForOperand = false;
          state.justEvaluated = false;
        } else {
          state.current = state.current === "0" ? value : state.current + value;
        }
        update();
        return;
      }

      if (action === "dot") {
        if (state.waitingForOperand) {
          state.current = "0.";
          state.waitingForOperand = false;
        } else if (!state.current.includes(".")) {
          state.current += ".";
        }
        update();
        return;
      }

      if (action === "clear") {
        resetState();
        expressionEl.textContent = "";
        update();
        return;
      }

      if (action === "sign") {
        const n = safeNumber(state.current);
        if (n === null) return;
        state.current = format(normalize(n * -1));
        update();
        return;
      }

      if (action === "percent") {
        computePercent();
        update();
        return;
      }

      if (action === "backspace") {
        if (state.justEvaluated) return;
        if (state.current.length > 1) {
          state.current = state.current.slice(0, -1);
          if (state.current === "-" || state.current === "-0") state.current = "0";
        } else {
          state.current = "0";
        }
        update();
        return;
      }

      if (action === "op") {
        if (state.previous !== null && state.operator && !state.waitingForOperand) {
          const result = applyOp(state.previous, state.operator, state.current);

          if (result === null) {
            state.current = "Error";
            state.error = true;
            update();
            return;
          }

          state.current = format(result);
          state.previous = state.current;
        } else {
          state.previous = state.current;
        }

        state.operator = value;
        state.waitingForOperand = true;
        state.justEvaluated = false;

        expressionEl.textContent = `${state.previous} ${value}`;
        update();
        return;
      }

      if (action === "equals") {
        if (!state.operator) return;

        let operand;

        if (!state.waitingForOperand) {
          operand = state.current;
          state.lastOperand = operand;
        } else {
          operand = state.lastOperand;
        }

        if (operand === null) return;

        const result = applyOp(state.previous, state.operator, operand);

        if (result === null) {
          state.current = "Error";
          state.error = true;
          update();
          return;
        }

        const entry = `${state.previous} ${state.operator} ${operand} = ${format(result)}`;
        pushHistory(entry);

        expressionEl.textContent = `${state.previous} ${state.operator} ${operand} =`;

        state.current = format(result);
        state.previous = state.current;
        state.waitingForOperand = true;
        state.justEvaluated = true;

        update();
      }
    };

    win.querySelectorAll(".calc-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        perform(btn.dataset.action, btn.dataset.value);
      });
    });

    document.addEventListener("keydown", async (e) => {
      if (!document.body.contains(win)) return;

      const k = e.key;

      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "v") {
        try {
          const text = await navigator.clipboard.readText();
          if (!text) return;
          const result = evaluateExpression(text);
          if (result === null) return;

          const formatted = format(result);
          pushHistory(`${text} = ${formatted}`);
          expressionEl.textContent = `${text} =`;
          state.current = formatted;
          state.previous = formatted;
          state.justEvaluated = true;
          update();
        } catch {}
        e.preventDefault();
        return;
      }

      if (k >= "0" && k <= "9") perform("digit", k);
      else if (k === ".") perform("dot");
      else if (k === "+") perform("op", "+");
      else if (k === "-") perform("op", "−");
      else if (k === "*") perform("op", "×");
      else if (k === "/") perform("op", "÷");
      else if (k === "%") perform("percent");
      else if (k === "Enter" || k === "=") perform("equals");
      else if (k === "Backspace") perform("backspace");
      else if (k === "Escape" || k === "Delete") perform("clear");
      else return;

      e.preventDefault();
    });

    update();
  }
}
