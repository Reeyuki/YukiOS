var NgRuffle = (function () {
  "use strict";
  const p = {
    ArrowUp: { key: "ArrowUp", keyCode: 38, location: 0 },
    ArrowDown: { key: "ArrowDown", keyCode: 40, location: 0 },
    ArrowLeft: { key: "ArrowLeft", keyCode: 37, location: 0 },
    ArrowRight: { key: "ArrowRight", keyCode: 39, location: 0 },
    F1: { key: "F1", keyCode: 112, location: 0 },
    F2: { key: "F2", keyCode: 113, location: 0 },
    F3: { key: "F3", keyCode: 114, location: 0 },
    F4: { key: "F4", keyCode: 115, location: 0 },
    F5: { key: "F5", keyCode: 116, location: 0 },
    F6: { key: "F6", keyCode: 117, location: 0 },
    F7: { key: "F7", keyCode: 118, location: 0 },
    F8: { key: "F8", keyCode: 119, location: 0 },
    F9: { key: "F9", keyCode: 120, location: 0 },
    F10: { key: "F10", keyCode: 121, location: 0 },
    F11: { key: "F11", keyCode: 122, location: 0 },
    F12: { key: "F12", keyCode: 123, location: 0 },
    Backspace: { key: "Backspace", keyCode: 8, location: 0 },
    Tab: { key: "Tab", keyCode: 9, location: 0 },
    Enter: { key: "Enter", keyCode: 13, location: 0 },
    ShiftLeft: { key: "Shift", keyCode: 16, location: 1 },
    ShiftRight: { key: "Shift", keyCode: 16, location: 2 },
    ControlLeft: { key: "Control", keyCode: 17, location: 1 },
    ControlRight: { key: "Control", keyCode: 17, location: 2 },
    AltLeft: { key: "Alt", keyCode: 18, location: 1 },
    AltRight: { key: "Alt", keyCode: 18, location: 2 },
    Pause: { key: "Pause", keyCode: 19, location: 0 },
    CapsLock: { key: "CapsLock", keyCode: 20, location: 0 },
    Escape: { key: "Escape", keyCode: 27, location: 0 },
    PageUp: { key: "PageUp", keyCode: 33, location: 0 },
    PageDown: { key: "PageDown", keyCode: 34, location: 0 },
    End: { key: "End", keyCode: 35, location: 0 },
    Home: { key: "Home", keyCode: 36, location: 0 },
    Insert: { key: "Insert", keyCode: 45, location: 0 },
    Delete: { key: "Delete", keyCode: 46, location: 0 },
    MetaLeft: { key: "Meta", keyCode: 91, location: 1 },
    MetaRight: { key: "Meta", keyCode: 92, location: 2 },
    KeyA: { key: "a", keyCode: 65, location: 0 },
    KeyB: { key: "b", keyCode: 66, location: 0 },
    KeyC: { key: "c", keyCode: 67, location: 0 },
    KeyD: { key: "d", keyCode: 68, location: 0 },
    KeyE: { key: "e", keyCode: 69, location: 0 },
    KeyF: { key: "f", keyCode: 70, location: 0 },
    KeyG: { key: "g", keyCode: 71, location: 0 },
    KeyH: { key: "h", keyCode: 72, location: 0 },
    KeyI: { key: "i", keyCode: 73, location: 0 },
    KeyJ: { key: "j", keyCode: 74, location: 0 },
    KeyK: { key: "k", keyCode: 75, location: 0 },
    KeyL: { key: "l", keyCode: 76, location: 0 },
    KeyM: { key: "m", keyCode: 77, location: 0 },
    KeyN: { key: "n", keyCode: 78, location: 0 },
    KeyO: { key: "o", keyCode: 79, location: 0 },
    KeyP: { key: "p", keyCode: 80, location: 0 },
    KeyQ: { key: "q", keyCode: 81, location: 0 },
    KeyR: { key: "r", keyCode: 82, location: 0 },
    KeyS: { key: "s", keyCode: 83, location: 0 },
    KeyT: { key: "t", keyCode: 84, location: 0 },
    KeyU: { key: "u", keyCode: 85, location: 0 },
    KeyV: { key: "v", keyCode: 86, location: 0 },
    KeyW: { key: "w", keyCode: 87, location: 0 },
    KeyX: { key: "x", keyCode: 88, location: 0 },
    KeyY: { key: "y", keyCode: 89, location: 0 },
    KeyZ: { key: "z", keyCode: 90, location: 0 },
    Digit0: { key: "0", keyCode: 48, location: 0 },
    Digit1: { key: "1", keyCode: 49, location: 0 },
    Digit2: { key: "2", keyCode: 50, location: 0 },
    Digit3: { key: "3", keyCode: 51, location: 0 },
    Digit4: { key: "4", keyCode: 52, location: 0 },
    Digit5: { key: "5", keyCode: 53, location: 0 },
    Digit6: { key: "6", keyCode: 54, location: 0 },
    Digit7: { key: "7", keyCode: 55, location: 0 },
    Digit8: { key: "8", keyCode: 56, location: 0 },
    Digit9: { key: "9", keyCode: 57, location: 0 },
    Numpad0: { key: "0", keyCode: 96, location: 3 },
    Numpad1: { key: "1", keyCode: 97, location: 3 },
    Numpad2: { key: "2", keyCode: 98, location: 3 },
    Numpad3: { key: "3", keyCode: 99, location: 3 },
    Numpad4: { key: "4", keyCode: 100, location: 3 },
    Numpad5: { key: "5", keyCode: 101, location: 3 },
    Numpad6: { key: "6", keyCode: 102, location: 3 },
    Numpad7: { key: "7", keyCode: 103, location: 3 },
    Numpad8: { key: "8", keyCode: 104, location: 3 },
    Numpad9: { key: "9", keyCode: 105, location: 3 },
    NumpadMultiply: { key: "*", keyCode: 106, location: 3 },
    NumpadAdd: { key: "+", keyCode: 107, location: 3 },
    NumpadSubtract: { key: "-", keyCode: 109, location: 3 },
    NumpadDecimal: { key: ".", keyCode: 110, location: 3 },
    NumpadDivide: { key: "/", keyCode: 111, location: 3 },
    NumpadEnter: { key: "Enter", keyCode: 13, location: 3 },
    NumLock: { key: "NumLock", keyCode: 144, location: 0 },
    Space: { key: " ", keyCode: 32, location: 0 },
    Semicolon: { key: ";", keyCode: 186, location: 0 },
    Equal: { key: "=", keyCode: 187, location: 0 },
    Comma: { key: ",", keyCode: 188, location: 0 },
    Minus: { key: "-", keyCode: 189, location: 0 },
    Period: { key: ".", keyCode: 190, location: 0 },
    Slash: { key: "/", keyCode: 191, location: 0 },
    Backquote: { key: "`", keyCode: 192, location: 0 },
    BracketLeft: { key: "[", keyCode: 219, location: 0 },
    Backslash: { key: "\\", keyCode: 220, location: 0 },
    BracketRight: { key: "]", keyCode: 221, location: 0 },
    Quote: { key: "'", keyCode: 222, location: 0 }
  };
  class u {
    constructor(o) {
      ((this.playerElement = o), (this.type = "input"));
    }
    dispatch(o, e) {
      const t = p[o],
        y = new KeyboardEvent(e ? "keydown" : "keyup", {
          bubbles: !0,
          cancelable: !0,
          key: t.key,
          code: o,
          keyCode: t.keyCode,
          which: t.keyCode,
          location: t.location
        });
      (this.playerElement.focus(), this.playerElement.dispatchEvent(y));
    }
  }
  class m extends u {
    #y = 0.35;
    #i = {
      0: "BD",
      1: "BR",
      2: "BL",
      3: "BU",
      4: "L1",
      5: "R1",
      6: "L2",
      7: "R2",
      8: "SELECT",
      9: "START",
      10: "L3",
      11: "R3",
      12: "DU",
      13: "DD",
      14: "DL",
      15: "DR"
    };
    #a = { LS: { axes: [0, 1], dirs: ["L", "R", "U", "D"] }, RS: { axes: [2, 3], dirs: ["L", "R", "U", "D"] } };
    #e = [];
    #o = [];
    #t = [];
    constructor(o, e) {
      (super(o),
        (this.type = "gamepad"),
        this.setInputMaps(e),
        (this.checkStatus = this.checkStatus.bind(this)),
        this.checkStatus());
    }
    setInputMaps(o) {
      if (o) {
        ((this.#e = o || this.#e), Array.isArray(this.#e) || (this.#e = [this.#e]));
        for (let e = 0; e < this.#e.length; e++)
          if (this.#e[e])
            for (const [t, y] of Object.entries(this.#e[e])) typeof y == "object" && y.key && (this.#e[e][t] = y.key);
      }
    }
    checkStatus() {
      if (!this.#e?.length) return;
      const o = navigator.getGamepads();
      for (let e = 0; e < o.length; e++) {
        if (!o[e]) continue;
        const t = o[e];
        let y = this.#t.indexOf(e);
        if ((y === -1 && (this.#t.push(e), (y = this.#t.length - 1)), y >= this.#e.length)) break;
        if (t) {
          this.#o[y] || (this.#o[y] = {});
          const C = this.#e[y],
            r = this.#o[y],
            s = {},
            d = 20;
          if (t.axes)
            for (const [k, h] of Object.entries(this.#a)) {
              const n = h.axes,
                l = h.dirs;
              if (
                (l.forEach((i, c) => {
                  s[`${k}${i}`] = !1;
                }),
                t.axes[n[0]] !== void 0 && t.axes[n[1]] !== void 0)
              ) {
                let i = t.axes[n[0]],
                  c = t.axes[n[1]];
                if ((Math.abs(i) < this.#y && (i = 0), Math.abs(c) < this.#y && (c = 0), i || c)) {
                  const a = Math.round(Math.atan2(c, i) * (180 / Math.PI));
                  (a >= 135 - d || a <= -135 + d
                    ? (s[`${k}${l[0]}`] = !0)
                    : a >= -45 - d && a <= 45 + d && (s[`${k}${l[1]}`] = !0),
                    a >= -135 - d && a <= -45 + d
                      ? (s[`${k}${l[2]}`] = !0)
                      : a >= 45 - d && a <= 135 + d && (s[`${k}${l[3]}`] = !0));
                }
              }
              for (const [i, c] of Object.entries(s)) {
                if (!C[i]) continue;
                const a = r[i] || !1;
                c !== a && ((r[i] = c), this.dispatch(C[i], c));
              }
            }
          t.buttons &&
            t.buttons.forEach((k, h) => {
              const n = this.#i[h];
              if (!C[n]) return;
              const l = r[n] || !1;
              k.pressed !== l && ((r[n] = k.pressed), this.dispatch(C[n], k.pressed));
            });
        }
      }
      requestAnimationFrame(this.checkStatus);
    }
  }
  class g extends u {
    constructor(o) {
      (super(o), (this.type = "touchpad"));
    }
  }
  return { External: { Input: u, GamePad: m, TouchPad: g, KeyMap: p } };
})();
