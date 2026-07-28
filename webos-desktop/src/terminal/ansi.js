export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  blink: "\x1b[5m",
  inverse: "\x1b[7m",
  hidden: "\x1b[8m",
  strikethrough: "\x1b[9m",

  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    brightBlack: "\x1b[90m",
    brightRed: "\x1b[91m",
    brightGreen: "\x1b[92m",
    brightYellow: "\x1b[93m",
    brightBlue: "\x1b[94m",
    brightMagenta: "\x1b[95m",
    brightCyan: "\x1b[96m",
    brightWhite: "\x1b[97m",
    color256: (n) => `\x1b[38;5;${n}m`,
    colorRgb: (r, g, b) => `\x1b[38;2;${r};${g};${b}m`
  },

  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
    brightBlack: "\x1b[100m",
    brightRed: "\x1b[101m",
    brightGreen: "\x1b[102m",
    brightYellow: "\x1b[103m",
    brightBlue: "\x1b[104m",
    brightMagenta: "\x1b[105m",
    brightCyan: "\x1b[106m",
    brightWhite: "\x1b[107m",
    color256: (n) => `\x1b[48;5;${n}m`,
    colorRgb: (r, g, b) => `\x1b[48;2;${r};${g};${b}m`
  },

  screen: {
    enterAltBuffer: "\x1b[?1049h",
    exitAltBuffer: "\x1b[?1049l",
    clear: "\x1b[2J",
    clearLine: "\x1b[K",
    home: "\x1b[H",
    saveCursor: "\x1b[s",
    restoreCursor: "\x1b[u"
  },

  cursor: {
    hide: "\x1b[?25l",
    show: "\x1b[?25h",
    up: (n = 1) => `\x1b[${n}A`,
    down: (n = 1) => `\x1b[${n}B`,
    forward: (n = 1) => `\x1b[${n}C`,
    backward: (n = 1) => `\x1b[${n}D`,
    position: (row, col) => `\x1b[${row};${col}H`,
    save: "\x1b7",
    restore: "\x1b8"
  },

  ctrl: {
    a: "\x01", b: "\x02", c: "\x03", d: "\x04",
    e: "\x05", f: "\x06", g: "\x07", h: "\x08",
    i: "\x09", j: "\x0a", k: "\x0b", l: "\x0c",
    m: "\x0d", n: "\x0e", o: "\x0f", p: "\x10",
    q: "\x11", r: "\x12", s: "\x13", t: "\x14",
    u: "\x15", v: "\x16", w: "\x17", x: "\x18",
    y: "\x19", z: "\x1a"
  },

  strip(str) {
    return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
              .replace(/\x1b\][0-9;]*[^\x1b]*\x1b\\/g, "")
              .replace(/\x1b[\[\(][0-9;]*[a-zA-Z]/g, "")
              .replace(/\x1b[PX^_].*?\x1b\\/g, "");
  },

  wrap(str, code) {
    return code + str + ANSI.reset;
  }
};
