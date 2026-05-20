import { BaseApp } from "./core/BaseApp.js";
import { PersistenceTypes } from "./runtime/AppSchema.js";

export class CalculatorApp extends BaseApp {
  constructor(services) {
    super(services);
    this.keyHandler = null;
  }

  open() {
    if (this._isSingletonOpen("calculatorApp")) return;
    return super.open();
  }

  getDeclarativeSchema(opts) {
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

    const computePercent = (current, previous, operator) => {
      const cur = safeNumber(current);
      if (cur === null) return current;

      if (previous !== null) {
        const prev = safeNumber(previous);
        if (prev === null) return current;

        if (operator === "+" || operator === "−") {
          return format(normalize((prev * cur) / 100));
        }
        if (operator === "×" || operator === "÷") {
          return format(normalize(cur / 100));
        }
      }
      return format(normalize(cur / 100));
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

    return {
      id: "calculatorApp",
      name: "Calculator",
      icon: "fa fa-calculator",
      windows: [
        {
          id: "calculatorApp",
          title: "Calculator",
          size: ["360px", "560px"],
          icon: "fa fa-calculator",
          iconColor: "#6677dd",
          ui: `<div class="calc-body">
        <div class="calc-history" id="calc-history-calculatorApp"></div>
        <div class="calc-display">
          <div class="calc-expression" id="calc-expression-calculatorApp"></div>
          <div class="calc-result" id="calc-result-calculatorApp">0</div>
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
      </div>`,
          events: {
            ".calc-btn": {
              click: {
                type: "custom:calcBtnClick",
                stopPropagation: true
              }
            },
            "#calc-history-calculatorApp": {
              click: {
                type: "custom:historyItemClick",
                stopPropagation: true
              }
            },
            window: {
              keydown: {
                type: "custom:handleKeydown",
                stopPropagation: false
              }
            }
          }
        }
      ],
      state: {
        initial: {
          current: "0",
          previous: null,
          operator: null,
          lastOperand: null,
          justEvaluated: false,
          waitingForOperand: false,
          error: false,
          history: []
        },
        persistence: PersistenceTypes.NONE
      },
      actions: {
        calcBtnClick: (payload, event, element, state) => {
          const action = element.dataset.action;
          const value = element.dataset.value;
          const resultEl = document.getElementById("calc-result-calculatorApp");
          const expressionEl = document.getElementById("calc-expression-calculatorApp");
          const historyEl = document.getElementById("calc-history-calculatorApp");

          const updateDisplay = () => {
            resultEl.textContent = state.current;
            resultEl.style.fontSize = state.current.length > 10 ? "1.6rem" : "2.4rem";
          };

          const renderHistory = () => {
            historyEl.innerHTML = state.history
              .map((h, i) => `<div class="calc-history-item" data-index="${i}">${h}</div>`)
              .join("");
          };

          const pushHistory = (entry) => {
            state.history.unshift(entry);
            if (state.history.length > 50) state.history.pop();
            renderHistory();
          };

          const resetState = () => {
            state.current = "0";
            state.previous = null;
            state.operator = null;
            state.lastOperand = null;
            state.justEvaluated = false;
            state.waitingForOperand = false;
            state.error = false;
          };

          if (state.error && action !== "clear") resetState();

          if (action === "digit") {
            if (state.justEvaluated || state.waitingForOperand) {
              state.current = value;
              state.waitingForOperand = false;
              state.justEvaluated = false;
            } else {
              state.current = state.current === "0" ? value : state.current + value;
            }
            updateDisplay();
          } else if (action === "dot") {
            if (state.waitingForOperand) {
              state.current = "0.";
              state.waitingForOperand = false;
            } else if (!state.current.includes(".")) {
              state.current += ".";
            }
            updateDisplay();
          } else if (action === "clear") {
            resetState();
            expressionEl.textContent = "";
            updateDisplay();
          } else if (action === "sign") {
            const n = safeNumber(state.current);
            if (n !== null) {
              state.current = format(normalize(n * -1));
              updateDisplay();
            }
          } else if (action === "percent") {
            state.current = computePercent(state.current, state.previous, state.operator);
            updateDisplay();
          } else if (action === "backspace") {
            if (!state.justEvaluated) {
              if (state.current.length > 1) {
                state.current = state.current.slice(0, -1);
                if (state.current === "-" || state.current === "-0") state.current = "0";
              } else {
                state.current = "0";
              }
              updateDisplay();
            }
          } else if (action === "op") {
            if (state.previous !== null && state.operator && !state.waitingForOperand) {
              const result = applyOp(state.previous, state.operator, state.current);
              if (result === null) {
                state.current = "Error";
                state.error = true;
              } else {
                state.current = format(result);
                state.previous = state.current;
              }
            } else {
              state.previous = state.current;
            }
            state.operator = value;
            state.waitingForOperand = true;
            state.justEvaluated = false;
            expressionEl.textContent = `${state.previous} ${value}`;
            updateDisplay();
          } else if (action === "equals") {
            if (state.operator) {
              let operand = !state.waitingForOperand ? state.current : state.lastOperand;
              if (operand !== null) {
                state.lastOperand = operand;
                const result = applyOp(state.previous, state.operator, operand);
                if (result === null) {
                  state.current = "Error";
                  state.error = true;
                } else {
                  const entry = `${state.previous} ${state.operator} ${operand} = ${format(result)}`;
                  pushHistory(entry);
                  expressionEl.textContent = `${state.previous} ${state.operator} ${operand} =`;
                  state.current = format(result);
                  state.previous = state.current;
                  state.waitingForOperand = true;
                  state.justEvaluated = true;
                }
                updateDisplay();
              }
            }
          }
        },
        historyItemClick: (payload, event, element, state) => {
          const item = event.target.closest(".calc-history-item");
          if (!item) return;
          const idx = Number(item.dataset.index);
          const entry = state.history[idx];
          const result = entry.split("=").pop().trim();
          state.current = result;
          state.justEvaluated = true;
          const resultEl = document.getElementById("calc-result-calculatorApp");
          resultEl.textContent = state.current;
        },
        handleKeydown: async (payload, event, element, state) => {
          const k = event.key;
          const resultEl = document.getElementById("calc-result-calculatorApp");
          const expressionEl = document.getElementById("calc-expression-calculatorApp");
          const historyEl = document.getElementById("calc-history-calculatorApp");

          const updateDisplay = () => {
            resultEl.textContent = state.current;
            resultEl.style.fontSize = state.current.length > 10 ? "1.6rem" : "2.4rem";
          };

          const renderHistory = () => {
            historyEl.innerHTML = state.history
              .map((h, i) => `<div class="calc-history-item" data-index="${i}">${h}</div>`)
              .join("");
          };

          const pushHistory = (entry) => {
            state.history.unshift(entry);
            if (state.history.length > 50) state.history.pop();
            renderHistory();
          };

          const resetState = () => {
            state.current = "0";
            state.previous = null;
            state.operator = null;
            state.lastOperand = null;
            state.justEvaluated = false;
            state.waitingForOperand = false;
            state.error = false;
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
              updateDisplay();
            } else if (action === "dot") {
              if (state.waitingForOperand) {
                state.current = "0.";
                state.waitingForOperand = false;
              } else if (!state.current.includes(".")) {
                state.current += ".";
              }
              updateDisplay();
            } else if (action === "clear") {
              resetState();
              expressionEl.textContent = "";
              updateDisplay();
            } else if (action === "sign") {
              const n = safeNumber(state.current);
              if (n !== null) {
                state.current = format(normalize(n * -1));
                updateDisplay();
              }
            } else if (action === "percent") {
              state.current = computePercent(state.current, state.previous, state.operator);
              updateDisplay();
            } else if (action === "backspace") {
              if (!state.justEvaluated) {
                if (state.current.length > 1) {
                  state.current = state.current.slice(0, -1);
                  if (state.current === "-" || state.current === "-0") state.current = "0";
                } else {
                  state.current = "0";
                }
                updateDisplay();
              }
            } else if (action === "op") {
              if (state.previous !== null && state.operator && !state.waitingForOperand) {
                const result = applyOp(state.previous, state.operator, state.current);
                if (result === null) {
                  state.current = "Error";
                  state.error = true;
                } else {
                  state.current = format(result);
                  state.previous = state.current;
                }
              } else {
                state.previous = state.current;
              }
              state.operator = value;
              state.waitingForOperand = true;
              state.justEvaluated = false;
              expressionEl.textContent = `${state.previous} ${value}`;
              updateDisplay();
            } else if (action === "equals") {
              if (state.operator) {
                let operand = !state.waitingForOperand ? state.current : state.lastOperand;
                if (operand !== null) {
                  state.lastOperand = operand;
                  const result = applyOp(state.previous, state.operator, operand);
                  if (result === null) {
                    state.current = "Error";
                    state.error = true;
                  } else {
                    const entry = `${state.previous} ${state.operator} ${operand} = ${format(result)}`;
                    pushHistory(entry);
                    expressionEl.textContent = `${state.previous} ${state.operator} ${operand} =`;
                    state.current = format(result);
                    state.previous = state.current;
                    state.waitingForOperand = true;
                    state.justEvaluated = true;
                  }
                  updateDisplay();
                }
              }
            }
          };

          if ((event.ctrlKey || event.metaKey) && k.toLowerCase() === "v") {
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
              updateDisplay();
            } catch {}
            event.preventDefault();
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

          event.preventDefault();
        }
      }
    };
  }
}
