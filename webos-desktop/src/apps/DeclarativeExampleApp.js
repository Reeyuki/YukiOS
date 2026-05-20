import { PersistenceTypes } from "../runtime/AppSchema.js";

export const declarativeExampleApp = {
  id: "declarative-example",
  name: "Declarative Example",
  icon: "fa fa-code",
  windows: [
    {
      id: "example-window",
      title: "Declarative App Example",
      size: ["500px", "400px"],
      icon: "fa fa-code",
      className: "example-window",
      ui: {
        type: "element",
        tag: "div",
        props: {
          className: "example-container",
          style: {
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }
        },
        children: [
          {
            type: "element",
            tag: "h2",
            props: {
              style: { margin: "0", color: "#fff" }
            },
            text: "Declarative App System"
          },
          {
            type: "element",
            tag: "p",
            props: {
              style: { margin: "0", color: "#aaa" }
            },
            text: "This app is defined entirely as data, not imperative code."
          },
          {
            type: "element",
            tag: "div",
            props: {
              style: {
                display: "flex",
                gap: "10px",
                alignItems: "center"
              }
            },
            children: [
              {
                type: "element",
                tag: "button",
                props: {
                  className: "btn btn-primary",
                  style: { padding: "8px 16px" }
                },
                text: "Click Me",
                events: {
                  click: {
                    type: "custom:increment",
                    stopPropagation: true
                  }
                }
              },
              {
                type: "element",
                tag: "span",
                ref: "counter-display",
                props: {
                  style: { fontSize: "18px", fontWeight: "bold", color: "#fff" }
                },
                text: "Count: 0"
              }
            ]
          },
          {
            type: "element",
            tag: "div",
            props: {
              style: {
                padding: "12px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "8px"
              }
            },
            children: [
              {
                type: "element",
                tag: "p",
                props: {
                  style: { margin: "0 0 8px 0", color: "#fff" }
                },
                text: "State Management:"
              },
              {
                type: "element",
                tag: "pre",
                ref: "state-display",
                props: {
                  style: {
                    margin: "0",
                    padding: "8px",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "4px",
                    fontSize: "12px",
                    color: "#0f0",
                    overflow: "auto"
                  }
                },
                text: "{}"
              }
            ]
          }
        ]
      },
      events: {
        window: {
          click: {
            type: "custom:logWindowClick",
            stopPropagation: false
          }
        }
      }
    }
  ],
  state: {
    initial: {
      count: 0,
      clicks: 0
    },
    persistence: PersistenceTypes.MEMORY
  },
  actions: {
    increment: (payload, event, element, state) => {
      state.count = (state.count || 0) + 1;
      const counterDisplay = element.parentElement.querySelector('[ref="counter-display"]');
      if (counterDisplay) {
        counterDisplay.textContent = `Count: ${state.count}`;
      }
    },
    logWindowClick: (payload, event, element, state) => {
      state.clicks = (state.clicks || 0) + 1;
      const stateDisplay = element.querySelector('[ref="state-display"]');
      if (stateDisplay) {
        stateDisplay.textContent = JSON.stringify(state, null, 2);
      }
    }
  },
  onClose: (winId, state) => {}
};
