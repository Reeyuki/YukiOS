import "../styles/particleEffects.css";
import { StorageKeys, os } from "../framework.js";
import { createElement } from "../shared/domUtils.js";

const DEFAULT_DENSITY = 70;
const DEFAULT_SPEED = 1;
const DEFAULT_SIZE = 1;
const DEFAULT_FPS = 60;
const MAX_PARTICLES = 260;
const MAX_RIPPLES = 36;
const QUALITY_MIN = 0.35;
const TAU = Math.PI * 2;

const DEFAULT_DEPTH = {
  size: [0.6, 1.25],
  speed: [0.6, 1.2],
  alpha: [0.5, 1],
};

const LOW_END_DEVICE =
  (navigator.hardwareConcurrency || 4) <= 4 ||
  (navigator.deviceMemory || 4) <= 4;
const DEFAULT_RESOLUTION = LOW_END_DEVICE ? 1 : 2;

export const PARTICLE_EFFECTS = [
  {
    id: "snow",
    name: "Snowfall",
    icon: "fas fa-snowflake",
    description: "Soft glowing flakes drifting down the desktop",
    shape: "flake",
    rotate: false,
    baseCount: 120,
    colors: ["--particle-snow"],
    speedY: [22, 62],
    speedX: [-8, 8],
    size: [1.4, 3.4],
    sway: [8, 26],
    swayFreq: [0.4, 1.2],
    spin: [0, 0],
    opacity: [0.5, 0.95],
  },
  {
    id: "petals",
    name: "Cherry Petals",
    icon: "fas fa-leaf",
    description: "Pink blossoms fluttering on a gentle breeze",
    shape: "petal",
    baseCount: 70,
    colors: ["--particle-petal-a", "--particle-petal-b", "--particle-petal-c"],
    speedY: [24, 55],
    speedX: [-14, 10],
    size: [2.6, 5.4],
    sway: [18, 48],
    swayFreq: [0.3, 0.9],
    spin: [-1.4, 1.4],
    opacity: [0.6, 1],
    flutter: { speed: [1.6, 3.4], min: 0.35 },
  },
  {
    id: "leaves",
    name: "Autumn Leaves",
    icon: "fas fa-tree",
    description: "Warm leaves tumbling across the screen",
    shape: "leaf",
    baseCount: 55,
    colors: ["--particle-leaf-a", "--particle-leaf-b", "--particle-leaf-c"],
    speedY: [28, 60],
    speedX: [-16, 12],
    size: [3.2, 6.4],
    sway: [16, 42],
    swayFreq: [0.3, 0.8],
    spin: [-2, 2],
    opacity: [0.6, 1],
    flutter: { speed: [1.2, 2.8], min: 0.3 },
  },
  {
    id: "stars",
    name: "Shooting Stars",
    icon: "fas fa-star",
    description: "Fast streaks with fading trails crossing the night sky",
    shape: "streak",
    rotate: false,
    baseCount: 24,
    colors: ["--particle-star-a", "--particle-star-b"],
    speedY: [190, 360],
    speedX: [-320, -140],
    size: [0.9, 1.9],
    sway: [0, 0],
    swayFreq: [0, 0],
    spin: [0, 0],
    opacity: [0.55, 1],
    scatter: true,
    respawnOnExit: true,
    trailTime: 0.24,
    depthScale: { size: [0.7, 1.2], speed: [0.75, 1.15], alpha: [0.55, 1] },
  },
  {
    id: "rain",
    name: "Rainfall",
    icon: "fas fa-cloud-showers-heavy",
    description: "Rain streaks falling steadily and splashing on the ground",
    shape: "rain",
    baseCount: 140,
    colors: ["--particle-rain"],
    speedY: [520, 900],
    speedX: [-30, 30],
    size: [3, 7],
    sway: [0, 0],
    swayFreq: [0, 0],
    spin: [0, 0],
    opacity: [0.25, 0.6],
    splash: true,
    depthScale: { size: [0.55, 1.2], speed: [0.7, 1.1], alpha: [0.45, 1] },
  },
  {
    id: "bubbles",
    name: "Bubbles",
    icon: "fas fa-circle-notch",
    description: "Shiny translucent bubbles floating upward",
    shape: "bubble",
    rotate: false,
    baseCount: 45,
    colors: ["--particle-bubble"],
    speedY: [-55, -22],
    speedX: [-8, 8],
    size: [3.5, 11],
    sway: [8, 24],
    swayFreq: [0.3, 0.9],
    spin: [0, 0],
    opacity: [0.3, 0.7],
    rise: true,
    flutter: { speed: [1.5, 3], min: 0.9 },
  },
  {
    id: "fireflies",
    name: "Fireflies",
    icon: "fas fa-lightbulb",
    description: "Soft glowing dots that drift and pulse in the dark",
    shape: "glow",
    rotate: false,
    wrap: true,
    baseCount: 46,
    colors: ["--particle-firefly-a", "--particle-firefly-b"],
    speedY: [-6, 6],
    speedX: [-6, 6],
    size: [1.4, 3],
    sway: [10, 30],
    swayFreq: [0.3, 0.9],
    swayY: [8, 24],
    spin: [0, 0],
    opacity: [0.6, 1],
    flicker: { amount: 0.9, power: 2.2, speed: [0.7, 2] },
    depthScale: { size: [0.6, 1.3], speed: [0.5, 1.2], alpha: [0.5, 1] },
  },
  {
    id: "embers",
    name: "Embers",
    icon: "fas fa-fire",
    description: "Warm sparks rising and flickering out",
    shape: "ember",
    rotate: false,
    rise: true,
    lifeFade: true,
    baseCount: 60,
    colors: ["--particle-ember-a", "--particle-ember-b", "--particle-ember-c"],
    speedY: [-120, -45],
    speedX: [-14, 22],
    size: [1, 2.4],
    sway: [12, 40],
    swayFreq: [1, 3],
    spin: [0, 0],
    opacity: [0.7, 1],
    flicker: { amount: 0.55, power: 1, speed: [7, 16] },
  },
  {
    id: "mist",
    name: "Mist",
    icon: "fas fa-smog",
    description: "Large faint banks of fog drifting slowly",
    shape: "mist",
    rotate: false,
    wrap: true,
    baseCount: 9,
    colors: ["--particle-mist"],
    speedY: [-3, 3],
    speedX: [5, 16],
    size: [110, 230],
    sway: [0, 0],
    swayFreq: [0, 0],
    spin: [0, 0],
    opacity: [0.05, 0.13],
    depthScale: { size: [0.8, 1.2], speed: [0.5, 1.3], alpha: [0.6, 1] },
    fpsCap: 30,
    maxRatio: 1,
  },
  {
    id: "bokeh",
    name: "Dust & Bokeh",
    icon: "fas fa-braille",
    description: "Out-of-focus light circles and dust at different depths",
    shape: "bokeh",
    rotate: false,
    wrap: true,
    baseCount: 36,
    colors: [
      "--particle-bokeh-a",
      "--particle-bokeh-b",
      "--particle-bokeh-c",
      "--particle-bokeh-d",
    ],
    speedY: [-12, -3],
    speedX: [-5, 5],
    size: [5, 24],
    sizeSkew: 1.6,
    sway: [2, 8],
    swayFreq: [0.2, 0.6],
    spin: [0, 0],
    opacity: [0.1, 0.32],
    flicker: { amount: 0.3, power: 1, speed: [0.2, 0.7] },
    depthScale: { size: [0.45, 1.6], speed: [0.35, 1.5], alpha: [0.4, 1] },
  },
  {
    id: "confetti",
    name: "Confetti",
    icon: "fas fa-cake-candles",
    description: "Colourful paper tumbling and flipping down",
    shape: "confetti",
    baseCount: 70,
    colors: [
      "--particle-confetti-a",
      "--particle-confetti-b",
      "--particle-confetti-c",
      "--particle-confetti-d",
      "--particle-confetti-e",
      "--particle-confetti-f",
    ],
    speedY: [70, 150],
    speedX: [-30, 30],
    size: [2.6, 5],
    sway: [18, 46],
    swayFreq: [0.8, 2],
    spin: [-4, 4],
    opacity: [0.85, 1],
    flutter: { speed: [3, 9], min: 0.1 },
  },
  {
    id: "code",
    name: "Code Rain",
    icon: "fas fa-code",
    description: "Falling columns of glowing glyphs",
    scene: "matrix",
    shape: "glyph",
    baseCount: 0,
    colors: ["--particle-code", "--particle-code-head"],
    fpsCap: 30,
  },
  {
    id: "aurora",
    name: "Aurora",
    icon: "fas fa-wand-magic-sparkles",
    description: "Slow shifting ribbons of northern light",
    scene: "aurora",
    shape: "ribbon",
    baseCount: 4,
    colors: [
      "--particle-aurora-a",
      "--particle-aurora-b",
      "--particle-aurora-c",
      "--particle-aurora-d",
    ],
    fpsCap: 30,
    maxRatio: 1,
  },
];

const OPTION_KEYS = {
  density: StorageKeys.particleEffectDensity,
  speed: StorageKeys.particleEffectSpeed,
  size: StorageKeys.particleEffectSize,
  fps: StorageKeys.particleEffectFps || "particleEffectFps",
  adaptive: StorageKeys.particleEffectAdaptive || "particleEffectAdaptive",
  resolution:
    StorageKeys.particleEffectResolution || "particleEffectResolution",
};

let canvasElement = null;
let ctx = null;
let animationFrameId = null;
let activePreset = null;
let activeScene = null;
let activeColors = [];
let particles = [];
let ripples = [];
let rippleSprite = null;
let currentUnit = 8;
let matrix = null;
let aurora = null;

let viewWidth = 0;
let viewHeight = 0;
let pixelRatio = 1;
let lastFrameTime = 0;
let targetInterval = 1000 / DEFAULT_FPS;
let minInterval = targetInterval - 4;

let qualityScale = 1;
let ratioCap = 2;
let listenersBound = false;
let resizeTimer = null;
let themeObserver = null;

const spriteCache = new Map();
const perf = {
  sum: 0,
  count: 0,
  windowStart: 0,
  warmup: 0,
  goodStreak: 0,
  raiseBlockedUntil: 0,
  fps: 0,
};

let config = {
  density: DEFAULT_DENSITY,
  speed: DEFAULT_SPEED,
  size: DEFAULT_SIZE,
  fps: DEFAULT_FPS,
  adaptive: 1,
  resolution: DEFAULT_RESOLUTION,
};

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(range, t) {
  return range[0] + (range[1] - range[0]) * t;
}

function readStoredNumber(key, fallback, { allowZero = false } = {}) {
  const stored = os.storage.get(key);
  if (stored === null || stored === undefined || stored === "") return fallback;
  const raw = Number(stored);
  if (!Number.isFinite(raw)) return fallback;
  return raw > 0 || (allowZero && raw === 0) ? raw : fallback;
}

function syncConfig() {
  config = {
    density: readStoredNumber(OPTION_KEYS.density, DEFAULT_DENSITY),
    speed: readStoredNumber(OPTION_KEYS.speed, DEFAULT_SPEED),
    size: readStoredNumber(OPTION_KEYS.size, DEFAULT_SIZE),
    fps: clamp(readStoredNumber(OPTION_KEYS.fps, DEFAULT_FPS), 20, 120),
    adaptive: readStoredNumber(OPTION_KEYS.adaptive, 1, { allowZero: true })
      ? 1
      : 0,
    resolution: clamp(
      readStoredNumber(OPTION_KEYS.resolution, DEFAULT_RESOLUTION),
      0.5,
      2,
    ),
  };
}

function findPreset(id) {
  return PARTICLE_EFFECTS.find((preset) => preset.id === id) || null;
}

function resolveColors(preset) {
  const style = getComputedStyle(document.documentElement);
  const colors = preset.colors
    .map((name) => style.getPropertyValue(name).trim())
    .filter(Boolean);
  if (colors.length) return colors;
  const fallback = style.getPropertyValue("--particle-custom-fallback").trim();
  return [fallback || "transparent"];
}

function isLightTheme() {
  return document.documentElement.getAttribute("data-theme") === "light";
}

function newSprite(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return { canvas, c: canvas.getContext("2d") };
}

function addWhiteStops(gradient, stops) {
  for (const [position, alpha] of stops) {
    gradient.addColorStop(position, `rgba(255,255,255,${alpha})`);
  }
}

function tintSprite(c, canvas, color) {
  c.globalCompositeOperation = "source-in";
  c.fillStyle = color;
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.globalCompositeOperation = "source-over";
}

function radialSprite(color, radius, unit, stops) {
  const size = Math.ceil(radius * 2);
  const { canvas, c } = newSprite(size, size);
  const gradient = c.createRadialGradient(
    radius,
    radius,
    0,
    radius,
    radius,
    radius,
  );
  addWhiteStops(gradient, stops);
  c.fillStyle = gradient;
  c.fillRect(0, 0, size, size);
  tintSprite(c, canvas, color);
  return { canvas, cx: canvas.width / 2, cy: canvas.height / 2, unit };
}

function glowSprite(color, unit, halo, core) {
  const radius = Math.ceil(unit * halo);
  const edge = 1 / halo;
  const sprite = radialSprite(color, radius, unit, [
    [0, 1],
    [edge, 0.8],
    [edge + (1 - edge) * 0.3, 0.3],
    [edge + (1 - edge) * 0.65, 0.07],
    [1, 0],
  ]);
  const c = sprite.canvas.getContext("2d");
  const hot = c.createRadialGradient(
    sprite.cx,
    sprite.cy,
    0,
    sprite.cx,
    sprite.cy,
    unit,
  );
  hot.addColorStop(0, `rgba(${core},0.95)`);
  hot.addColorStop(0.6, `rgba(${core},0.5)`);
  hot.addColorStop(1, `rgba(${core},0)`);
  c.fillStyle = hot;
  c.fillRect(0, 0, sprite.canvas.width, sprite.canvas.height);
  return sprite;
}

function overlayShade(c, x0, y0, x1, y1, from, to) {
  c.globalCompositeOperation = "source-atop";
  const gradient = c.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  c.fillStyle = gradient;
  c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  c.globalCompositeOperation = "source-over";
}

const SPRITE_BUILDERS = {
  flake(color, unit) {
    return radialSprite(color, Math.ceil(unit / 0.42), unit, [
      [0, 1],
      [0.42, 0.95],
      [0.6, 0.4],
      [1, 0],
    ]);
  },

  glow(color, unit) {
    return glowSprite(color, unit, 3, "255,255,240");
  },

  ember(color, unit) {
    return glowSprite(color, unit, 2.6, "255,236,170");
  },

  bokeh(color, unit) {
    return radialSprite(color, Math.ceil(unit * 1.12), unit, [
      [0, 0.5],
      [0.78, 0.58],
      [0.9, 0.95],
      [0.97, 0.85],
      [1, 0],
    ]);
  },

  mist(color) {
    return radialSprite(color, 64, 64, [
      [0, 0.9],
      [0.35, 0.55],
      [0.7, 0.18],
      [1, 0],
    ]);
  },

  petal(color, unit) {
    const { canvas, c } = newSprite(unit * 3.6, unit * 3);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    c.translate(cx, cy);
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(-1.5 * unit, 0);
    c.bezierCurveTo(
      -1 * unit,
      -1.3 * unit,
      1.1 * unit,
      -1.2 * unit,
      1.6 * unit,
      -0.15 * unit,
    );
    c.lineTo(1.35 * unit, 0);
    c.lineTo(1.6 * unit, 0.15 * unit);
    c.bezierCurveTo(
      1.1 * unit,
      1.2 * unit,
      -1 * unit,
      1.3 * unit,
      -1.5 * unit,
      0,
    );
    c.fill();
    c.setTransform(1, 0, 0, 1, 0, 0);
    overlayShade(
      c,
      cx - 1.5 * unit,
      0,
      cx + 1.6 * unit,
      0,
      "rgba(255,255,255,0.34)",
      "rgba(255,255,255,0)",
    );
    return { canvas, cx, cy, unit };
  },

  leaf(color, unit) {
    const { canvas, c } = newSprite(unit * 4.6, unit * 2.8);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    c.translate(cx, cy);
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(-1.7 * unit, 0);
    c.quadraticCurveTo(0, -1.2 * unit, 1.7 * unit, 0);
    c.quadraticCurveTo(0, 1.2 * unit, -1.7 * unit, 0);
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = Math.max(1, unit * 0.12);
    c.beginPath();
    c.moveTo(-1.7 * unit, 0);
    c.lineTo(-2.15 * unit, 0);
    c.stroke();
    c.setTransform(1, 0, 0, 1, 0, 0);
    overlayShade(
      c,
      0,
      cy - unit,
      0,
      cy + unit,
      "rgba(255,255,255,0.2)",
      "rgba(0,0,0,0.14)",
    );
    c.globalCompositeOperation = "source-atop";
    c.strokeStyle = "rgba(0,0,0,0.28)";
    c.lineWidth = Math.max(0.8, unit * 0.1);
    c.beginPath();
    c.moveTo(cx - 1.7 * unit, cy);
    c.lineTo(cx + 1.5 * unit, cy);
    c.stroke();
    c.globalCompositeOperation = "source-over";
    return { canvas, cx, cy, unit };
  },

  confetti(color, unit) {
    const { canvas, c } = newSprite(unit * 2.2, unit * 1.4);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    c.fillStyle = color;
    c.fillRect(cx - unit, cy - unit * 0.55, unit * 2, unit * 1.1);
    overlayShade(
      c,
      0,
      0,
      canvas.width,
      canvas.height,
      "rgba(255,255,255,0.3)",
      "rgba(0,0,0,0.16)",
    );
    return { canvas, cx, cy, unit };
  },

  bubble(color, unit) {
    const radius = Math.ceil(unit * 1.3);
    const size = radius * 2;
    const { canvas, c } = newSprite(size, size);
    const body = c.createRadialGradient(
      radius,
      radius,
      unit * 0.4,
      radius,
      radius,
      unit,
    );
    body.addColorStop(0, "rgba(255,255,255,0)");
    body.addColorStop(1, "rgba(255,255,255,0.2)");
    c.fillStyle = body;
    c.beginPath();
    c.arc(radius, radius, unit, 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = Math.max(1, unit * 0.13);
    c.beginPath();
    c.arc(radius, radius, unit, 0, TAU);
    c.stroke();
    tintSprite(c, canvas, color);
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.beginPath();
    c.ellipse(
      radius - unit * 0.38,
      radius - unit * 0.4,
      unit * 0.3,
      unit * 0.15,
      -0.75,
      0,
      TAU,
    );
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.45)";
    c.beginPath();
    c.arc(
      radius + unit * 0.46,
      radius + unit * 0.46,
      Math.max(0.6, unit * 0.08),
      0,
      TAU,
    );
    c.fill();
    return { canvas, cx: radius, cy: radius, unit };
  },

  rain(color, unit) {
    const lineWidth = Math.max(1.2, unit * 0.2);
    const height = Math.ceil(unit * 4.5 + lineWidth);
    const { canvas, c } = newSprite(lineWidth * 2 + 2, height);
    const cx = canvas.width / 2;
    const gradient = c.createLinearGradient(
      0,
      lineWidth / 2,
      0,
      height - lineWidth / 2,
    );
    addWhiteStops(gradient, [
      [0, 0],
      [1, 1],
    ]);
    c.strokeStyle = gradient;
    c.lineWidth = lineWidth;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(cx, lineWidth / 2);
    c.lineTo(cx, height - lineWidth / 2);
    c.stroke();
    tintSprite(c, canvas, color);
    return { canvas, cx, cy: height - lineWidth / 2, unit };
  },

  streak(color) {
    const length = 128;
    const height = 14;
    const { canvas, c } = newSprite(length + 6, height);
    const gradient = c.createLinearGradient(0, 0, length, 0);
    addWhiteStops(gradient, [
      [0, 0],
      [0.6, 0.35],
      [1, 1],
    ]);
    c.strokeStyle = gradient;
    c.lineCap = "round";
    c.globalAlpha = 0.3;
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(0, height / 2);
    c.lineTo(length, height / 2);
    c.stroke();
    c.globalAlpha = 1;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(0, height / 2);
    c.lineTo(length, height / 2);
    c.stroke();
    tintSprite(c, canvas, color);
    return { canvas, cx: length, cy: height / 2, unit: 4, length };
  },

  ring(color) {
    const radius = 24;
    const lineWidth = 3;
    const { canvas, c } = newSprite(
      (radius + lineWidth) * 2,
      (radius + lineWidth) * 2,
    );
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = lineWidth;
    c.beginPath();
    c.arc(canvas.width / 2, canvas.height / 2, radius, 0, TAU);
    c.stroke();
    tintSprite(c, canvas, color);
    return {
      canvas,
      cx: canvas.width / 2,
      cy: canvas.height / 2,
      unit: radius,
    };
  },
};

function getSprite(shape, color, unit) {
  const key = `${shape}|${color}|${unit}`;
  let sprite = spriteCache.get(key);
  if (!sprite) {
    sprite = SPRITE_BUILDERS[shape](color, unit);
    spriteCache.set(key, sprite);
  }
  return sprite;
}

function spriteUnitFor(preset) {
  const depth = (preset.depthScale || DEFAULT_DEPTH).size[1];
  const maxSize = preset.size
    ? preset.size[1] * depth * Math.max(1, config.size)
    : 4;
  return clamp(Math.ceil(maxSize * pixelRatio), 6, 44);
}

function place(sprite, x, y, scaleX, scaleY, angle, alpha) {
  const r = pixelRatio;
  ctx.globalAlpha = alpha;
  if (angle === 0) {
    ctx.setTransform(scaleX * r, 0, 0, scaleY * r, x * r, y * r);
  } else {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    ctx.setTransform(
      cos * scaleX * r,
      sin * scaleX * r,
      -sin * scaleY * r,
      cos * scaleY * r,
      x * r,
      y * r,
    );
  }
  ctx.drawImage(sprite.canvas, -sprite.cx, -sprite.cy);
}

function assignSprites(particle) {
  const preset = activePreset;
  const color = activeColors[particle.colorIndex % activeColors.length];
  particle.sprite = getSprite(preset.shape, color, currentUnit);
  if (preset.trailTime) particle.glow = getSprite("glow", color, currentUnit);
}

function scatterPosition(particle) {
  particle.x = randomBetween(0, viewWidth);
  particle.y = randomBetween(0, viewHeight);
}

function spawnPosition(particle, preset) {
  if (preset.rise) {
    particle.x = randomBetween(0, viewWidth);
    particle.y =
      viewHeight + particle.size * 2 + randomBetween(0, viewHeight * 0.25);
    return;
  }
  if (preset.scatter) {
    particle.x = randomBetween(viewWidth * 0.1, viewWidth * 1.2);
    particle.y = randomBetween(-viewHeight * 0.25, viewHeight * 0.55);
    return;
  }
  particle.x = randomBetween(0, viewWidth);
  particle.y = -particle.size * 2 - randomBetween(0, viewHeight * 0.35);
}

function rollGround(particle) {
  particle.groundY =
    viewHeight * (0.66 + 0.32 * particle.depth) -
    randomBetween(0, viewHeight * 0.05);
}

function respawn(particle) {
  spawnPosition(particle, activePreset);
  particle.life = 0;
  if (activePreset.splash) rollGround(particle);
}

function createParticle(preset, scattered) {
  const layered = preset.depthScale !== undefined || preset.depth !== false;
  const depthCfg = preset.depthScale || DEFAULT_DEPTH;
  const depth = layered ? Math.random() : 1;
  const sizeScale = layered ? lerp(depthCfg.size, depth) : 1;
  const speedScale = layered ? lerp(depthCfg.speed, depth) : 1;
  const alphaScale = layered ? lerp(depthCfg.alpha, depth) : 1;

  const sizeBase =
    lerp(preset.size, Math.pow(Math.random(), preset.sizeSkew || 1)) *
    sizeScale;
  const particle = {
    depth,
    rank: Math.random(),
    colorIndex: Math.floor(Math.random() * activeColors.length),
    sprite: null,
    glow: null,
    sizeBase,
    size: sizeBase * config.size,
    speedX: lerp(preset.speedX, Math.random()) * speedScale,
    speedY: lerp(preset.speedY, Math.random()) * speedScale,
    sway: lerp(preset.sway, Math.random()) * speedScale,
    swayFreq: lerp(preset.swayFreq, Math.random()),
    swayY: preset.swayY ? lerp(preset.swayY, Math.random()) * speedScale : 0,
    spin: lerp(preset.spin, Math.random()),
    alpha: clamp(lerp(preset.opacity, Math.random()) * alphaScale, 0, 1),
    phase: randomBetween(0, TAU),
    phaseOffset: randomBetween(0, TAU),
    angle: preset.rotate === false ? 0 : randomBetween(0, TAU),
    flutterPhase: randomBetween(0, TAU),
    flutterSpeed: preset.flutter
      ? lerp(preset.flutter.speed, Math.random())
      : 0,
    flickerPhase: randomBetween(0, TAU),
    flickerSpeed: preset.flicker
      ? lerp(preset.flicker.speed, Math.random())
      : 0,
    trail: Boolean(preset.trailTime),
    vx: 0,
    vy: 0,
    life: 0,
    groundY: 0,
  };
  if (preset.shape === "rain") {
    particle.angle = Math.atan2(particle.speedY, particle.speedX) - Math.PI / 2;
  }
  assignSprites(particle);
  if (preset.splash) rollGround(particle);
  if (preset.scatter || !scattered) spawnPosition(particle, preset);
  else scatterPosition(particle);
  return particle;
}

function buildParticles() {
  const preset = activePreset;
  currentUnit = spriteUnitFor(preset);
  rippleSprite = preset.splash ? getSprite("ring", activeColors[0], 24) : null;
  ripples = [];
  const areaFactor = clamp((viewWidth * viewHeight) / (1920 * 1080), 0.4, 2.5);
  const count = clamp(
    Math.round(
      preset.baseCount * (config.density / DEFAULT_DENSITY) * areaFactor,
    ),
    4,
    MAX_PARTICLES,
  );
  particles = Array.from({ length: count }, () => createParticle(preset, true));

  particles.sort((a, b) => a.depth - b.depth);
}

function applySizes() {
  for (const particle of particles)
    particle.size = particle.sizeBase * config.size;
}

function updateParticle(particle, delta, speed) {
  const preset = activePreset;
  particle.phase += particle.swayFreq * delta;
  const vx = particle.speedX * speed + Math.cos(particle.phase) * particle.sway;
  const vy =
    particle.speedY * speed +
    (particle.swayY
      ? Math.sin(particle.phase * 0.73 + particle.phaseOffset) * particle.swayY
      : 0);
  particle.vx = vx;
  particle.vy = vy;
  particle.x += vx * delta;
  particle.y += vy * delta;
  if (particle.spin) particle.angle += particle.spin * delta;
  if (particle.flutterSpeed)
    particle.flutterPhase += particle.flutterSpeed * delta;
  if (particle.flickerSpeed)
    particle.flickerPhase += particle.flickerSpeed * delta;

  const margin = particle.size * 2 + 60;

  if (preset.wrap) {
    if (particle.x < -margin) particle.x = viewWidth + margin;
    else if (particle.x > viewWidth + margin) particle.x = -margin;
    if (particle.y < -margin) particle.y = viewHeight + margin;
    else if (particle.y > viewHeight + margin) particle.y = -margin;
    return;
  }

  if (preset.lifeFade) {
    particle.life = clamp(
      (viewHeight - particle.y) / (viewHeight * 0.95),
      0,
      1,
    );
    if (particle.life >= 1) {
      respawn(particle);
      return;
    }
  }

  if (preset.splash && particle.y >= particle.groundY) {
    spawnRipple(particle);
    respawn(particle);
    return;
  }

  const verticalOut =
    vy > 0 ? particle.y > viewHeight + margin : particle.y < -margin;
  const horizontalOut = particle.x < -margin || particle.x > viewWidth + margin;

  if (verticalOut || (horizontalOut && preset.respawnOnExit)) {
    respawn(particle);
    return;
  }
  if (horizontalOut) {
    particle.x = particle.x < 0 ? viewWidth + margin : -margin;
  }
}

function drawStreak(particle, alpha, size) {
  const sprite = particle.sprite;
  const length = Math.hypot(particle.vx, particle.vy) * activePreset.trailTime;
  const angle = Math.atan2(particle.vy, particle.vx);
  place(
    sprite,
    particle.x,
    particle.y,
    length / sprite.length,
    (size * 1.8) / sprite.unit,
    angle,
    alpha,
  );
  const glow = particle.glow;
  const glowScale = (size * 1.2) / glow.unit;
  place(glow, particle.x, particle.y, glowScale, glowScale, 0, alpha);
}

function drawParticle(particle) {
  const preset = activePreset;
  let alpha = particle.alpha;
  let size = particle.size;

  if (particle.flickerSpeed) {
    const flicker = preset.flicker;
    const wave = 0.5 + 0.5 * Math.sin(particle.flickerPhase);
    alpha *=
      1 -
      flicker.amount +
      flicker.amount *
        (flicker.power > 1 ? Math.pow(wave, flicker.power) : wave);
  }
  if (preset.lifeFade) {
    alpha *= 1 - particle.life * particle.life;
    size *= 1 - 0.45 * particle.life;
  }
  if (alpha < 0.012) return;

  if (particle.trail) {
    drawStreak(particle, alpha, size);
    return;
  }

  const sprite = particle.sprite;
  const scale = size / sprite.unit;
  let scaleY = scale;
  if (particle.flutterSpeed) {
    const flutter = preset.flutter;
    scaleY *=
      flutter.min +
      (1 - flutter.min) * Math.abs(Math.cos(particle.flutterPhase));
  }
  place(sprite, particle.x, particle.y, scale, scaleY, particle.angle, alpha);
}

function spawnRipple(particle) {
  if (ripples.length >= Math.floor(MAX_RIPPLES * qualityScale)) return;
  ripples.push({
    x: particle.x,
    y: particle.groundY,
    age: 0,
    life: randomBetween(0.45, 0.85),
    radius: randomBetween(5, 11) * (0.55 + 0.6 * particle.depth),
    alpha: particle.alpha * 0.9,
  });
}

function renderRipples(delta) {
  if (!rippleSprite) return;
  for (let index = ripples.length - 1; index >= 0; index -= 1) {
    const ripple = ripples[index];
    ripple.age += delta;
    const t = ripple.age / ripple.life;
    if (t >= 1) {
      ripples[index] = ripples[ripples.length - 1];
      ripples.pop();
      continue;
    }
    const scale = (ripple.radius * (0.25 + 0.75 * t)) / rippleSprite.unit;
    place(
      rippleSprite,
      ripple.x,
      ripple.y,
      scale,
      scale * 0.36,
      0,
      ripple.alpha * (1 - t) * (1 - t),
    );
  }
}

function renderParticles(delta) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  const speed = config.speed;
  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    if (particle.rank > qualityScale) continue;
    updateParticle(particle, delta, speed);
    drawParticle(particle);
  }
  if (activePreset.splash) renderRipples(delta);
  ctx.globalAlpha = 1;
}

const particleScene = {
  build: buildParticles,
  render: renderParticles,
  refresh() {
    currentUnit = spriteUnitFor(activePreset);
    rippleSprite = activePreset.splash
      ? getSprite("ring", activeColors[0], 24)
      : null;
    for (const particle of particles) assignSprites(particle);
  },
};

const GLYPHS = Array.from(
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789:.=*+-<>|",
);
const GLYPH_FONT =
  '"Noto Sans Mono CJK JP", "MS Gothic", "Noto Sans JP", monospace';

function buildAtlas(color, glow, cellPx) {
  const { canvas, c } = newSprite(GLYPHS.length * cellPx, cellPx);
  c.font = `${Math.round(cellPx * 0.9)}px ${GLYPH_FONT}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = color;
  if (glow) {
    c.shadowColor = glow;
    c.shadowBlur = cellPx * 0.35;
  }
  GLYPHS.forEach((glyph, index) => {
    c.fillText(glyph, index * cellPx + cellPx / 2, cellPx / 2 + cellPx * 0.04);
  });
  return canvas;
}

function resetColumn(column, rows, initial) {
  const depth = column.depth;
  column.speed = randomBetween(9, 24) * lerp([0.6, 1.1], depth);
  column.alpha = lerp([0.45, 1], depth);
  column.row = column.pos = initial
    ? Math.floor(randomBetween(-rows * 0.4, rows * 0.9))
    : -Math.floor(randomBetween(2, rows * 0.6));
}

function buildMatrix() {
  const cell = Math.round(clamp(16 * config.size, 9, 42));
  const cellPx = Math.max(6, Math.round(cell * pixelRatio));
  const body = activeColors[0];
  const head = activeColors[1] || activeColors[0];
  const rows = Math.ceil(viewHeight / cell);
  const columnCount = Math.ceil(viewWidth / cell);
  const fraction = clamp(config.density / 100, 0.25, 1);

  const columns = [];
  for (let index = 0; index < columnCount; index += 1) {
    const rank = Math.random();
    if (rank > fraction) continue;
    const column = {
      x: index * cell,
      rank: rank / fraction,
      depth: Math.random(),
      speed: 0,
      alpha: 1,
      row: 0,
      pos: 0,
    };
    resetColumn(column, rows, true);
    columns.push(column);
  }

  matrix = {
    cell,
    cellPx,
    rows,
    columns,
    atlasBody: buildAtlas(body, null, cellPx),
    atlasHead: buildAtlas(head, body, cellPx),
    fade: 2.4,
  };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  for (let step = 0; step < 36; step += 1) renderMatrix(0.05);
}

function drawGlyph(atlas, x, y) {
  const m = matrix;
  const index = (Math.random() * GLYPHS.length) | 0;
  ctx.drawImage(
    atlas,
    index * m.cellPx,
    0,
    m.cellPx,
    m.cellPx,
    x,
    y,
    m.cell,
    m.cell,
  );
}

function renderMatrix(delta) {
  const m = matrix;
  const r = pixelRatio;
  ctx.setTransform(r, 0, 0, r, 0, 0);

  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = 1 - Math.exp(-delta * m.fade);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.globalCompositeOperation = "source-over";

  for (const column of m.columns) {
    if (column.rank > qualityScale) continue;
    column.pos += column.speed * config.speed * delta;
    const target = Math.floor(column.pos);
    while (column.row < target) {
      column.row += 1;
      const previous = column.row - 1;
      if (previous >= 0 && previous < m.rows) {
        ctx.clearRect(column.x, previous * m.cell, m.cell, m.cell);
        ctx.globalAlpha = column.alpha * 0.9;
        drawGlyph(m.atlasBody, column.x, previous * m.cell);
      }
      if (column.row >= 0 && column.row < m.rows) {
        ctx.globalAlpha = column.alpha;
        drawGlyph(m.atlasHead, column.x, column.row * m.cell);
      }
    }
    if (column.row > m.rows + 1) resetColumn(column, m.rows, false);
  }
  ctx.globalAlpha = 1;
}

const matrixScene = {
  build: buildMatrix,
  render: renderMatrix,
  refresh: buildMatrix,
};

function ribbonSprite(color) {
  const { canvas, c } = newSprite(1, 64);
  const gradient = c.createLinearGradient(0, 0, 0, 64);
  addWhiteStops(gradient, [
    [0, 0],
    [0.55, 0.35],
    [0.82, 1],
    [1, 0],
  ]);
  c.fillStyle = gradient;
  c.fillRect(0, 0, 1, 64);
  tintSprite(c, canvas, color);
  return canvas;
}

function buildAurora() {
  const preset = activePreset;
  const divisor = 7;
  const lowWidth = Math.ceil(viewWidth / divisor);
  const lowHeight = Math.ceil(viewHeight / divisor);
  const low = document.createElement("canvas");
  low.width = lowWidth;
  low.height = lowHeight;

  const count = clamp(
    Math.round(preset.baseCount * (config.density / DEFAULT_DENSITY)),
    2,
    6,
  );
  const ribbons = [];
  for (let index = 0; index < count; index += 1) {
    const t = count > 1 ? index / (count - 1) : 0.5;
    ribbons.push({
      sprite: ribbonSprite(activeColors[index % activeColors.length]),
      baseY: lowHeight * (0.2 + 0.2 * t + randomBetween(-0.03, 0.03)),
      amp1: lowHeight * randomBetween(0.05, 0.1),
      amp2: lowHeight * randomBetween(0.02, 0.05),
      f1: (TAU * randomBetween(0.8, 1.6)) / lowWidth,
      f2: (TAU * randomBetween(1.8, 3)) / lowWidth,
      f3: (TAU * randomBetween(1.5, 3)) / lowWidth,
      f4: (TAU * randomBetween(2.5, 4.5)) / lowWidth,
      f5: randomBetween(0.7, 1.1),
      s1: randomBetween(0.12, 0.3),
      s2: randomBetween(0.18, 0.4),
      s3: randomBetween(0.15, 0.35),
      s4: randomBetween(0.2, 0.5),
      s5: randomBetween(0.6, 1.2),
      p1: randomBetween(0, TAU),
      p2: randomBetween(0, TAU),
      p3: randomBetween(0, TAU),
      p4: randomBetween(0, TAU),
      p5: randomBetween(0, TAU),
      thick:
        lowHeight * randomBetween(0.18, 0.3) * clamp(config.size, 0.6, 1.6),
      alpha: randomBetween(0.28, 0.45),
    });
  }

  aurora = {
    low,
    lowContext: low.getContext("2d"),
    ribbons,
    time: randomBetween(0, 100),
    additive: !isLightTheme(),
  };
}

function renderAurora(delta) {
  const a = aurora;
  a.time += delta * config.speed;
  const l = a.lowContext;
  const t = a.time;
  const lowWidth = a.low.width;
  const step = qualityScale < 0.7 ? 3 : 2;

  l.globalCompositeOperation = "source-over";
  l.globalAlpha = 1;
  l.clearRect(0, 0, lowWidth, a.low.height);
  l.globalCompositeOperation = a.additive ? "lighter" : "source-over";

  for (const ribbon of a.ribbons) {
    for (let x = 0; x < lowWidth; x += step) {
      const centre =
        ribbon.baseY +
        Math.sin(x * ribbon.f1 + t * ribbon.s1 + ribbon.p1) * ribbon.amp1 +
        Math.sin(x * ribbon.f2 - t * ribbon.s2 + ribbon.p2) * ribbon.amp2;
      const thickness =
        ribbon.thick *
        (0.65 + 0.35 * Math.sin(x * ribbon.f3 + t * ribbon.s3 + ribbon.p3));
      const intensity =
        (0.55 + 0.45 * Math.sin(x * ribbon.f4 + t * ribbon.s4 + ribbon.p4)) *
        (0.78 + 0.22 * Math.sin(x * ribbon.f5 + t * ribbon.s5 + ribbon.p5));
      l.globalAlpha = ribbon.alpha * intensity;
      l.drawImage(
        ribbon.sprite,
        0,
        0,
        1,
        64,
        x,
        centre - thickness * 0.78,
        step + 0.5,
        thickness,
      );
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(a.low, 0, 0, canvasElement.width, canvasElement.height);
}

const auroraScene = {
  build: buildAurora,
  render: renderAurora,
  refresh: buildAurora,
};

const SCENES = {
  particles: particleScene,
  matrix: matrixScene,
  aurora: auroraScene,
};

function resolvePixelRatio() {
  const presetCap = activePreset?.maxRatio || 2;
  const cap = Math.min(config.resolution, ratioCap, presetCap);
  return clamp(Math.min(window.devicePixelRatio || 1, cap), 0.5, 2);
}

function resizeCanvas() {
  if (!canvasElement || !ctx) return;
  viewWidth = window.innerWidth;
  viewHeight = window.innerHeight;
  pixelRatio = resolvePixelRatio();
  canvasElement.width = Math.round(viewWidth * pixelRatio);
  canvasElement.height = Math.round(viewHeight * pixelRatio);
  ctx.imageSmoothingEnabled = true;
}

function ensureCanvas() {
  if (canvasElement) return;
  canvasElement = createElement("canvas");
  canvasElement.id = "particle-effects-canvas";
  canvasElement.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvasElement);
  ctx = canvasElement.getContext("2d");
}

function removeCanvas() {
  if (canvasElement) canvasElement.remove();
  canvasElement = null;
  ctx = null;
}

function updateFrameInterval() {
  const cap = Math.min(config.fps, activePreset?.fpsCap || Infinity);
  targetInterval = 1000 / cap;
  minInterval = targetInterval - 4;
}

function refreshScene() {
  if (!activePreset || !activeScene) return;
  spriteCache.clear();
  activeScene.refresh();
}

function resetPerf(now) {
  perf.sum = 0;
  perf.count = 0;
  perf.windowStart = now;
  perf.warmup = 20;
}

function evaluateQuality(average, now) {
  perf.fps = 1000 / average;
  if (average > targetInterval * 1.35) {
    perf.goodStreak = 0;
    perf.raiseBlockedUntil = now + 30000;
    if (qualityScale > QUALITY_MIN + 0.001) {
      qualityScale = Math.max(QUALITY_MIN, qualityScale - 0.2);
    } else if (ratioCap > 1) {
      ratioCap = Math.max(1, ratioCap - 0.25);
      resizeCanvas();
      refreshScene();
    }
  } else if (average < targetInterval * 1.12) {
    perf.goodStreak += 1;
    if (
      perf.goodStreak >= 8 &&
      now > perf.raiseBlockedUntil &&
      qualityScale < 1
    ) {
      perf.goodStreak = 0;
      qualityScale = Math.min(1, qualityScale + 0.1);
    }
  }
}

function trackPerformance(elapsed, now) {
  if (!config.adaptive) return;
  if (perf.warmup > 0) {
    perf.warmup -= 1;
    return;
  }
  perf.sum += Math.min(elapsed, 250);
  perf.count += 1;
  if (now - perf.windowStart >= 1000) {
    if (perf.count >= 5) evaluateQuality(perf.sum / perf.count, now);
    perf.sum = 0;
    perf.count = 0;
    perf.windowStart = now;
  }
}

function renderFrame(timestamp) {
  if (!activePreset || !ctx) return;
  animationFrameId = requestAnimationFrame(renderFrame);
  const elapsed = timestamp - lastFrameTime;
  if (elapsed < minInterval) return;
  lastFrameTime = timestamp;
  trackPerformance(elapsed, timestamp);
  activeScene.render(clamp(elapsed / 1000, 0, 0.1), timestamp);
}

function startLoop() {
  if (animationFrameId) return;
  lastFrameTime = performance.now();
  resetPerf(lastFrameTime);
  animationFrameId = requestAnimationFrame(renderFrame);
}

function stopLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function applyEffect(id) {
  syncConfig();
  stopLoop();
  const preset = findPreset(id);
  if (!preset) {
    activePreset = null;
    activeScene = null;
    particles = [];
    ripples = [];
    matrix = null;
    aurora = null;
    spriteCache.clear();
    removeCanvas();
    return;
  }
  activePreset = preset;
  activeScene = SCENES[preset.scene || "particles"];
  qualityScale = 1;
  ratioCap = 2;
  ensureCanvas();
  resizeCanvas();
  activeColors = resolveColors(preset);
  spriteCache.clear();
  particles = [];
  ripples = [];
  updateFrameInterval();
  activeScene.build();
  startLoop();
}

function handleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!activePreset) return;
    resizeCanvas();
    spriteCache.clear();
    activeScene.build();
  }, 150);
}

function handleVisibility() {
  if (document.hidden) stopLoop();
  else if (activePreset) startLoop();
}

function handleThemeChange() {
  if (!activePreset) return;
  activeColors = resolveColors(activePreset);
  refreshScene();
}

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;
  window.addEventListener("resize", handleResize);
  document.addEventListener("visibilitychange", handleVisibility);
  if (typeof MutationObserver !== "undefined") {
    themeObserver = new MutationObserver(handleThemeChange);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }
}

export function initParticleEffects() {
  bindListeners();
  applyEffect(os.storage.get(StorageKeys.particleEffect) || "none");
}

export function setParticleEffect(id) {
  const preset = findPreset(id);
  const resolved = preset ? preset.id : "none";
  os.storage.set(StorageKeys.particleEffect, resolved);
  applyEffect(resolved);
  return resolved;
}

export function getParticleEffect() {
  return os.storage.get(StorageKeys.particleEffect) || "none";
}

export function getParticleOptions() {
  syncConfig();
  return { ...config };
}

export function setParticleOptions(options) {
  const changed = new Set();
  for (const key of Object.keys(OPTION_KEYS)) {
    if (!(key in options)) continue;
    const value = Number(options[key]);
    if (!Number.isFinite(value)) continue;
    if (key === "adaptive") {
      os.storage.set(OPTION_KEYS[key], value ? "1" : "0");
    } else {
      if (value <= 0) continue;
      os.storage.set(OPTION_KEYS[key], String(value));
    }
    changed.add(key);
  }
  syncConfig();
  if (!activePreset || !changed.size) return;

  if (changed.has("fps")) updateFrameInterval();
  if (changed.has("adaptive")) {
    qualityScale = 1;
    ratioCap = 2;
    resetPerf(performance.now());
  }
  if (changed.has("resolution") || changed.has("adaptive")) {
    resizeCanvas();
    refreshScene();
  }
  if (changed.has("size")) {
    if (activePreset.scene) {
      activeScene.build();
    } else {
      applySizes();
      refreshScene();
    }
  }
  if (changed.has("density")) activeScene.build();
}

export function getParticleStats() {
  return {
    effect: getParticleEffect(),
    particles: particles.filter((particle) => particle.rank <= qualityScale)
      .length,
    quality: Number(qualityScale.toFixed(2)),
    pixelRatio: Number(pixelRatio.toFixed(2)),
    fps: Math.round(perf.fps),
  };
}
