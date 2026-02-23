import { desktop } from "./desktop.js";

export class CalculatorApp {
  constructor(windowManager) {
    this.wm = windowManager;
  }

  open() {
    const winId = "calculator-app";
    if (document.getElementById(winId)) {
      this.wm.bringToFront(document.getElementById(winId));
      return;
    }

    const win = this.wm.createWindow(winId, "Calculator", "320px", "500px");
    Object.assign(win.style, { left: "300px", top: "120px" });

    win.innerHTML = `
      <div class="window-header calc-header">
        <span>Calculator</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">X</button>
        </div>
      </div>
      <div class="calc-body">
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
    this.wm.addToTaskbar(win.id, "Calculator", "fa fa-calculator");

    this.setupCalcLogic(win, winId);
  }

  setupCalcLogic(win, winId) {
    const resultEl = win.querySelector(`#calc-result-${winId}`);
    const expressionEl = win.querySelector(`#calc-expression-${winId}`);

    let state = {
      current: "0",
      previous: null,
      operator: null,
      justEvaluated: false,
      waitingForOperand: false
    };

    const update = () => {
      resultEl.textContent = state.current;
      resultEl.style.fontSize = state.current.length > 10 ? "1.6rem" : "";
    };

    const applyOp = (a, op, b) => {
      const fa = parseFloat(a),
        fb = parseFloat(b);
      switch (op) {
        case "+":
          return String(fa + fb);
        case "−":
          return String(fa - fb);
        case "×":
          return String(fa * fb);
        case "÷":
          return fb === 0 ? "Error" : String(fa / fb);
      }
    };

    win.querySelectorAll(".calc-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const value = btn.dataset.value;

        if (action === "digit") {
          if (state.justEvaluated || state.waitingForOperand) {
            state.current = value;
            state.justEvaluated = false;
            state.waitingForOperand = false;
          } else {
            state.current = state.current === "0" ? value : state.current + value;
          }
          update();
        } else if (action === "dot") {
          if (state.waitingForOperand) {
            state.current = "0.";
            state.waitingForOperand = false;
          } else if (!state.current.includes(".")) {
            state.current += ".";
          }
          state.justEvaluated = false;
          update();
        } else if (action === "clear") {
          state = { current: "0", previous: null, operator: null, justEvaluated: false, waitingForOperand: false };
          expressionEl.textContent = "";
          update();
        } else if (action === "sign") {
          state.current = String(parseFloat(state.current) * -1);
          update();
        } else if (action === "percent") {
          state.current = String(parseFloat(state.current) / 100);
          update();
        } else if (action === "backspace") {
          if (state.waitingForOperand) return;
          if (state.current.length > 1) state.current = state.current.slice(0, -1);
          else state.current = "0";
          update();
        } else if (action === "op") {
          if (state.previous !== null && state.operator && !state.waitingForOperand) {
            state.current = applyOp(state.previous, state.operator, state.current);
          }
          state.previous = state.current;
          state.operator = value;
          state.justEvaluated = false;
          state.waitingForOperand = true;
          expressionEl.textContent = `${state.previous} ${value}`;
          update();
        } else if (action === "equals") {
          if (state.previous !== null && state.operator) {
            expressionEl.textContent = `${state.previous} ${state.operator} ${state.current} =`;
            state.current = applyOp(state.previous, state.operator, state.current);
            state.previous = null;
            state.operator = null;
            state.justEvaluated = true;
            state.waitingForOperand = false;
            update();
          }
        }
      });
    });
  }
}
