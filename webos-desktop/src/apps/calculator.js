import "../styles/calculator.css";

import { BaseApp, PersistenceTypes } from "../framework.js";
export class CalculatorApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
    this.elements = {};
  }

  getDeclarativeSchema(opts) {
    return {
      id: "calculator",
      name: "Calculator",
      icon: "fas fa-calculator",
      windows: [
        {
          id: "calculator-window",
          title: "Calculator",
          size: ["360px", "560px"],
          icon: "fas fa-calculator",
          ui: {
            type: "element",
            tag: "div",
            props: {
              className: "calc-body"
            },
            children: [
              {
                type: "element",
                tag: "div",
                props: {
                  className: "calc-history",
                  ref: "calc-history"
                }
              },
              {
                type: "element",
                tag: "div",
                props: {
                  className: "calc-display"
                },
                children: [
                  {
                    type: "element",
                    tag: "div",
                    props: {
                      className: "calc-expression",
                      ref: "calc-expression"
                    }
                  },
                  {
                    type: "element",
                    tag: "div",
                    props: {
                      className: "calc-result",
                      ref: "calc-result",
                      textContent: "0"
                    }
                  }
                ]
              },
              {
                type: "element",
                tag: "div",
                props: {
                  className: "calc-grid"
                },
                children: [
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn span-two func",
                      textContent: "AC"
                    },
                    events: {
                      click: {
                        type: "custom:clear",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn func",
                      textContent: "+/−"
                    },
                    events: {
                      click: {
                        type: "custom:sign",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn func",
                      textContent: "%"
                    },
                    events: {
                      click: {
                        type: "custom:percent",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn",
                      textContent: "7"
                    },
                    events: {
                      click: {
                        type: "custom:digit",
                        payload: "7",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn",
                      textContent: "8"
                    },
                    events: {
                      click: {
                        type: "custom:digit",
                        payload: "8",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn",
                      textContent: "9"
                    },
                    events: {
                      click: {
                        type: "custom:digit",
                        payload: "9",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn op",
                      textContent: "÷"
                    },
                    events: {
                      click: {
                        type: "custom:op",
                        payload: "÷",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn",
                      textContent: "4"
                    },
                    events: {
                      click: {
                        type: "custom:digit",
                        payload: "4",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn",
                      textContent: "5"
                    },
                    events: {
                      click: {
                        type: "custom:digit",
                        payload: "5",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn",
                      textContent: "6"
                    },
                    events: {
                      click: {
                        type: "custom:digit",
                        payload: "6",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn op",
                      textContent: "×"
                    },
                    events: {
                      click: {
                        type: "custom:op",
                        payload: "×",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn",
                      textContent: "1"
                    },
                    events: {
                      click: {
                        type: "custom:digit",
                        payload: "1",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn",
                      textContent: "2"
                    },
                    events: {
                      click: {
                        type: "custom:digit",
                        payload: "2",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn",
                      textContent: "3"
                    },
                    events: {
                      click: {
                        type: "custom:digit",
                        payload: "3",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn op",
                      textContent: "−"
                    },
                    events: {
                      click: {
                        type: "custom:op",
                        payload: "−",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn",
                      textContent: "0"
                    },
                    events: {
                      click: {
                        type: "custom:digit",
                        payload: "0",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn",
                      textContent: "."
                    },
                    events: {
                      click: {
                        type: "custom:dot",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn op",
                      textContent: "⌫"
                    },
                    events: {
                      click: {
                        type: "custom:backspace",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn op",
                      textContent: "+"
                    },
                    events: {
                      click: {
                        type: "custom:op",
                        payload: "+",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      className: "calc-btn span-four equals",
                      textContent: "="
                    },
                    events: {
                      click: {
                        type: "custom:equals",
                        stopPropagation: true
                      }
                    }
                  }
                ]
              }
            ]
          },
          events: {
            window: {
              keydown: {
                type: "custom:handleKeydown",
                stopPropagation: false
              }
            },
            "#calc-history": {
              click: {
                type: "custom:handleHistoryClick",
                stopPropagation: true
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
        persistence: PersistenceTypes.MEMORY
      },
      actions: {
        updateDisplay: (payload, event, element, state) => {
          const resultEl = element.closest(".calc-body").querySelector('[ref="calc-result"]');
          if (resultEl) {
            resultEl.textContent = state.current;
            const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
            resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
          }
        },
        renderHistory: (payload, event, element, state) => {
          const historyEl = element.closest(".calc-body").querySelector('[ref="calc-history"]');
          if (historyEl) {
            historyEl.innerHTML = state.history
              .map((h, i) => `<div class="calc-history-item" data-index="${i}">${h}</div>`)
              .join("");
          }
        },
        pushHistory: (payload, event, element, state) => {
          state.history.unshift(payload);
          if (state.history.length > 50) state.history.pop();
          const historyEl = element.closest(".calc-body").querySelector('[ref="calc-history"]');
          if (historyEl) {
            historyEl.innerHTML = state.history
              .map((h, i) => `<div class="calc-history-item" data-index="${i}">${h}</div>`)
              .join("");
          }
        },
        digit: (payload, event, element, state) => {
          if (state.justEvaluated || state.waitingForOperand) {
            state.current = payload;
            state.waitingForOperand = false;
            state.justEvaluated = false;
          } else {
            state.current = state.current === "0" ? payload : state.current + payload;
          }
          const resultEl = element.closest(".calc-body").querySelector('[ref="calc-result"]');
          if (resultEl) {
            resultEl.textContent = state.current;
            const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
            resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
          }
        },
        dot: (payload, event, element, state) => {
          if (state.waitingForOperand) {
            state.current = "0.";
            state.waitingForOperand = false;
          } else if (!state.current.includes(".")) {
            state.current += ".";
          }
          const resultEl = element.closest(".calc-body").querySelector('[ref="calc-result"]');
          if (resultEl) {
            resultEl.textContent = state.current;
            const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
            resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
          }
        },
        clear: (payload, event, element, state) => {
          state.current = "0";
          state.previous = null;
          state.operator = null;
          state.lastOperand = null;
          state.justEvaluated = false;
          state.waitingForOperand = false;
          state.error = false;
          const expressionEl = element.closest(".calc-body").querySelector('[ref="calc-expression"]');
          if (expressionEl) expressionEl.textContent = "";
          const resultEl = element.closest(".calc-body").querySelector('[ref="calc-result"]');
          if (resultEl) {
            resultEl.textContent = state.current;
            const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
            resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
          }
        },
        sign: (payload, event, element, state) => {
          const n = parseFloat(state.current);
          if (Number.isFinite(n)) {
            const r = Math.round(n * -1 * 1e12) / 1e12;
            state.current = r.toString();
          }
          const resultEl = element.closest(".calc-body").querySelector('[ref="calc-result"]');
          if (resultEl) {
            resultEl.textContent = state.current;
            const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
            resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
          }
        },
        percent: (payload, event, element, state) => {
          const cur = parseFloat(state.current);
          if (!Number.isFinite(cur)) return;

          if (state.previous !== null) {
            const prev = parseFloat(state.previous);
            if (Number.isFinite(prev)) {
              if (state.operator === "+" || state.operator === "−") {
                const r = Math.round(((prev * cur) / 100) * 1e12) / 1e12;
                state.current = r.toString();
              } else if (state.operator === "×" || state.operator === "÷") {
                const r = Math.round((cur / 100) * 1e12) / 1e12;
                state.current = r.toString();
              }
            }
          } else {
            const r = Math.round((cur / 100) * 1e12) / 1e12;
            state.current = r.toString();
          }
          const resultEl = element.closest(".calc-body").querySelector('[ref="calc-result"]');
          if (resultEl) {
            resultEl.textContent = state.current;
            const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
            resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
          }
        },
        backspace: (payload, event, element, state) => {
          if (!state.justEvaluated) {
            if (state.current.length > 1) {
              state.current = state.current.slice(0, -1);
              if (state.current === "-" || state.current === "-0") state.current = "0";
            } else {
              state.current = "0";
            }
          }
          const resultEl = element.closest(".calc-body").querySelector('[ref="calc-result"]');
          if (resultEl) {
            resultEl.textContent = state.current;
            const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
            resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
          }
        },
        op: (payload, event, element, state) => {
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

          if (state.previous !== null && state.operator && !state.waitingForOperand) {
            const result = applyOp(state.previous, state.operator, state.current);
            if (result === null) {
              state.current = "Error";
              state.error = true;
            } else {
              state.current = result.toString();
              state.previous = state.current;
            }
          } else {
            state.previous = state.current;
          }
          state.operator = payload;
          state.waitingForOperand = true;
          state.justEvaluated = false;
          const expressionEl = element.closest(".calc-body").querySelector('[ref="calc-expression"]');
          if (expressionEl) expressionEl.textContent = `${state.previous} ${payload}`;
          const resultEl = element.closest(".calc-body").querySelector('[ref="calc-result"]');
          if (resultEl) {
            resultEl.textContent = state.current;
            const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
            resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
          }
        },
        equals: (payload, event, element, state) => {
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

          if (state.operator) {
            let operand = !state.waitingForOperand ? state.current : state.lastOperand;
            if (operand !== null) {
              state.lastOperand = operand;
              const result = applyOp(state.previous, state.operator, operand);
              if (result === null) {
                state.current = "Error";
                state.error = true;
              } else {
                const entry = `${state.previous} ${state.operator} ${operand} = ${result}`;
                state.history.unshift(entry);
                if (state.history.length > 50) state.history.pop();
                const historyEl = element.closest(".calc-body").querySelector('[ref="calc-history"]');
                if (historyEl) {
                  historyEl.innerHTML = state.history
                    .map((h, i) => `<div class="calc-history-item" data-index="${i}">${h}</div>`)
                    .join("");
                }
                const expressionEl = element.closest(".calc-body").querySelector('[ref="calc-expression"]');
                if (expressionEl) expressionEl.textContent = `${state.previous} ${state.operator} ${operand} =`;
                state.current = result.toString();
                state.previous = state.current;
                state.waitingForOperand = true;
                state.justEvaluated = true;
              }
            }
          }
          const resultEl = element.closest(".calc-body").querySelector('[ref="calc-result"]');
          if (resultEl) {
            resultEl.textContent = state.current;
            const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
            resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
          }
        },
        handleKeydown: (payload, event, element, state) => {
          const k = event.key;
          const calcBody = element.querySelector(".calc-body");

          if (!calcBody) return;

          if ((event.ctrlKey || event.metaKey) && k.toLowerCase() === "v") {
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
                  state.history.unshift(`${text} = ${formatted}`);
                  if (state.history.length > 50) state.history.pop();
                  const historyEl = calcBody.querySelector('[ref="calc-history"]');
                  if (historyEl) {
                    historyEl.innerHTML = state.history
                      .map((h, i) => `<div class="calc-history-item" data-index="${i}">${h}</div>`)
                      .join("");
                  }
                  const expressionEl = calcBody.querySelector('[ref="calc-expression"]');
                  if (expressionEl) expressionEl.textContent = `${text} =`;
                  state.current = formatted;
                  state.previous = formatted;
                  state.justEvaluated = true;
                  const resultEl = calcBody.querySelector('[ref="calc-result"]');
                  if (resultEl) {
                    resultEl.textContent = state.current;
                    const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
                    resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
                  }
                } catch {}
              })
              .catch(() => {});
            event.preventDefault();
            return;
          }

          const actions = {
            digit: (p) => {
              if (state.justEvaluated || state.waitingForOperand) {
                state.current = p;
                state.waitingForOperand = false;
                state.justEvaluated = false;
              } else {
                state.current = state.current === "0" ? p : state.current + p;
              }
              const resultEl = calcBody.querySelector('[ref="calc-result"]');
              if (resultEl) {
                resultEl.textContent = state.current;
                const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
                resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
              }
            },
            dot: () => {
              if (state.waitingForOperand) {
                state.current = "0.";
                state.waitingForOperand = false;
              } else if (!state.current.includes(".")) {
                state.current += ".";
              }
              const resultEl = calcBody.querySelector('[ref="calc-result"]');
              if (resultEl) {
                resultEl.textContent = state.current;
                const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
                resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
              }
            },
            op: (p) => {
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

              if (state.previous !== null && state.operator && !state.waitingForOperand) {
                const result = applyOp(state.previous, state.operator, state.current);
                if (result === null) {
                  state.current = "Error";
                  state.error = true;
                } else {
                  state.current = result.toString();
                  state.previous = state.current;
                }
              } else {
                state.previous = state.current;
              }
              state.operator = p;
              state.waitingForOperand = true;
              state.justEvaluated = false;
              const expressionEl = calcBody.querySelector('[ref="calc-expression"]');
              if (expressionEl) expressionEl.textContent = `${state.previous} ${p}`;
              const resultEl = calcBody.querySelector('[ref="calc-result"]');
              if (resultEl) {
                resultEl.textContent = state.current;
                const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
                resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
              }
            },
            percent: () => {
              const cur = parseFloat(state.current);
              if (!Number.isFinite(cur)) return;

              if (state.previous !== null) {
                const prev = parseFloat(state.previous);
                if (Number.isFinite(prev)) {
                  if (state.operator === "+" || state.operator === "−") {
                    const r = Math.round(((prev * cur) / 100) * 1e12) / 1e12;
                    state.current = r.toString();
                  } else if (state.operator === "×" || state.operator === "÷") {
                    const r = Math.round((cur / 100) * 1e12) / 1e12;
                    state.current = r.toString();
                  }
                }
              } else {
                const r = Math.round((cur / 100) * 1e12) / 1e12;
                state.current = r.toString();
              }
              const resultEl = calcBody.querySelector('[ref="calc-result"]');
              if (resultEl) {
                resultEl.textContent = state.current;
                const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
                resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
              }
            },
            equals: () => {
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

              if (state.operator) {
                let operand = !state.waitingForOperand ? state.current : state.lastOperand;
                if (operand !== null) {
                  state.lastOperand = operand;
                  const result = applyOp(state.previous, state.operator, operand);
                  if (result === null) {
                    state.current = "Error";
                    state.error = true;
                  } else {
                    const entry = `${state.previous} ${state.operator} ${operand} = ${result}`;
                    state.history.unshift(entry);
                    if (state.history.length > 50) state.history.pop();
                    const historyEl = calcBody.querySelector('[ref="calc-history"]');
                    if (historyEl) {
                      historyEl.innerHTML = state.history
                        .map((h, i) => `<div class="calc-history-item" data-index="${i}">${h}</div>`)
                        .join("");
                    }
                    const expressionEl = calcBody.querySelector('[ref="calc-expression"]');
                    if (expressionEl) expressionEl.textContent = `${state.previous} ${state.operator} ${operand} =`;
                    state.current = result.toString();
                    state.previous = state.current;
                    state.waitingForOperand = true;
                    state.justEvaluated = true;
                  }
                }
              }
              const resultEl = calcBody.querySelector('[ref="calc-result"]');
              if (resultEl) {
                resultEl.textContent = state.current;
                const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
                resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
              }
            },
            backspace: () => {
              if (!state.justEvaluated) {
                if (state.current.length > 1) {
                  state.current = state.current.slice(0, -1);
                  if (state.current === "-" || state.current === "-0") state.current = "0";
                } else {
                  state.current = "0";
                }
              }
              const resultEl = calcBody.querySelector('[ref="calc-result"]');
              if (resultEl) {
                resultEl.textContent = state.current;
                const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
                resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
              }
            },
            clear: () => {
              state.current = "0";
              state.previous = null;
              state.operator = null;
              state.lastOperand = null;
              state.justEvaluated = false;
              state.waitingForOperand = false;
              state.error = false;
              const expressionEl = calcBody.querySelector('[ref="calc-expression"]');
              if (expressionEl) expressionEl.textContent = "";
              const resultEl = calcBody.querySelector('[ref="calc-result"]');
              if (resultEl) {
                resultEl.textContent = state.current;
                const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
                resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
              }
            }
          };

          if (k >= "0" && k <= "9") actions.digit(k);
          else if (k === ".") actions.dot();
          else if (k === "+") actions.op("+");
          else if (k === "-") actions.op("−");
          else if (k === "*") actions.op("×");
          else if (k === "/") actions.op("÷");
          else if (k === "%") actions.percent();
          else if (k === "Enter" || k === "=") actions.equals();
          else if (k === "Backspace") actions.backspace();
          else if (k === "Escape" || k === "Delete") actions.clear();
          else return;

          event.preventDefault();
        },
        handleHistoryClick: (payload, event, element, state) => {
          const item = event.target.closest(".calc-history-item");
          if (!item) return;

          const idx = Number(item.dataset.index);
          const entry = state.history[idx];
          const result = entry.split("=").pop().trim();
          state.current = result;
          state.justEvaluated = true;
          const resultEl = element.closest(".calc-body").querySelector('[ref="calc-result"]');
          if (resultEl) {
            resultEl.textContent = state.current;
            const _calcSz = state.current.length > 10 ? "calc-result-size-sm" : "calc-result-size-lg";
            resultEl.className = resultEl.className.replace(/calc-result-size-\w+/g, "").trim() + " " + _calcSz;
          }
        }
      },
      onMount: (win, state, actionExecutor) => {}
    };
  }

  onClose(winId) {
    this.openWindows.delete(winId);
  }
}
