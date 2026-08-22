import { createElement } from "../framework.js";

const MAX_CONCURRENT_FALLS = 4;
const GRAVITY_PX_PER_S2 = 2400;
const CRACK_SPEED_PX_PER_S = 2600;
const TARGET_CELL_AREA_PX2 = 16000;
const MIN_CELLS = 9;
const MAX_CELLS = 26;
const MAX_CLONE_NODES = 1500;
const HEAVY_ELEMENT_SELECTOR = "iframe, video, audio, canvas, embed, object";

let activeFallCount = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampInt(value, min, max) {
  return Math.round(clamp(value, min, max));
}

function buildShardCells(width, height) {
  const cellCount = clampInt((width * height) / TARGET_CELL_AREA_PX2, MIN_CELLS, MAX_CELLS);
  const cols = Math.max(3, Math.ceil(Math.sqrt((cellCount * width) / height)));
  const rows = Math.max(3, Math.ceil(cellCount / cols));

  const seeds = [];
  for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
    for (let colIdx = 0; colIdx < cols; colIdx++) {
      if (seeds.length >= cellCount) break;
      seeds.push({
        x: ((colIdx + 0.18 + Math.random() * 0.64) * width) / cols,
        y: ((rowIdx + 0.18 + Math.random() * 0.64) * height) / rows
      });
    }
  }

  const cells = [];
  for (let i = 0; i < seeds.length; i++) {
    const cell = voronoiCell(seeds[i], i, seeds, width, height);
    if (cell && cell.length >= 3) cells.push(cell);
  }
  return cells;
}

function voronoiCell(ownSeed, ownIndex, seeds, width, height) {
  let polygon = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height }
  ];
  for (let j = 0; j < seeds.length; j++) {
    if (j === ownIndex || polygon.length === 0) continue;
    polygon = clipHalfPlane(polygon, ownSeed, seeds[j]);
  }
  return polygon;
}

function clipHalfPlane(polygon, ownSeed, otherSeed) {
  const midX = (ownSeed.x + otherSeed.x) / 2;
  const midY = (ownSeed.y + otherSeed.y) / 2;
  const normalX = otherSeed.x - ownSeed.x;
  const normalY = otherSeed.y - ownSeed.y;
  const kept = [];
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const distCurrent = (current.x - midX) * normalX + (current.y - midY) * normalY;
    const distNext = (next.x - midX) * normalX + (next.y - midY) * normalY;
    if (distCurrent <= 0) kept.push(current);
    if ((distCurrent < 0 && distNext > 0) || (distCurrent > 0 && distNext < 0)) {
      const t = distCurrent / (distCurrent - distNext);
      kept.push({
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t
      });
    }
  }
  return kept;
}

function polygonAreaAndCentroid(polygon) {
  let twiceArea = 0;
  let centroidX = 0;
  let centroidY = 0;
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const cross = current.x * next.y - next.x * current.y;
    twiceArea += cross;
    centroidX += (current.x + next.x) * cross;
    centroidY += (current.y + next.y) * cross;
  }
  const area = Math.abs(twiceArea) / 2;
  if (area < 1) return { area: 0, cx: polygon[0].x, cy: polygon[0].y };
  return { area, cx: centroidX / (3 * twiceArea), cy: centroidY / (3 * twiceArea) };
}

function shardClipPath(corners, width, height) {
  const points = corners.map((pt) => `${((pt.x / width) * 100).toFixed(2)}% ${((pt.y / height) * 100).toFixed(2)}%`);
  return `polygon(${points.join(", ")})`;
}

function prepareCloneRoot(sourceWin) {
  const cloneRoot = sourceWin.cloneNode(true);
  const cloneStyle = cloneRoot.style;
  cloneStyle.position = "absolute";
  cloneStyle.left = "0";
  cloneStyle.top = "0";
  cloneStyle.right = "auto";
  cloneStyle.bottom = "auto";
  cloneStyle.margin = "0";
  cloneStyle.width = "100%";
  cloneStyle.height = "100%";
  cloneStyle.maxWidth = "none";
  cloneStyle.maxHeight = "none";
  cloneStyle.transform = "none";
  cloneStyle.filter = "none";
  cloneStyle.backdropFilter = "none";
  cloneStyle.opacity = "1";
  cloneStyle.clipPath = "none";
  cloneStyle.boxShadow = "none";
  cloneStyle.pointerEvents = "none";
  cloneStyle.visibility = "visible";
  cloneStyle.zIndex = "auto";
  cloneStyle.transition = "none";
  cloneStyle.animation = "none";

  cloneRoot.querySelectorAll(HEAVY_ELEMENT_SELECTOR).forEach((heavyEl) => {
    const heavyStyle = getComputedStyle(heavyEl);
    const placeholder = createElement("div");
    placeholder.style.width = `${heavyEl.offsetWidth || 0}px`;
    placeholder.style.height = `${heavyEl.offsetHeight || 0}px`;
    placeholder.style.margin = heavyStyle.margin;
    placeholder.style.borderRadius = heavyStyle.borderRadius;
    placeholder.style.background =
      heavyStyle.backgroundColor && heavyStyle.backgroundColor !== "transparent"
        ? heavyStyle.backgroundColor
        : "var(--glass)";
    heavyEl.replaceWith(placeholder);
  });

  return cloneRoot;
}

function createShard(layer, corners, rect, mode, contentPayload, impactPoint, fallDurationMs) {
  const element = createElement("div");
  element.className = "wa-shard";
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
  element.style.borderRadius = contentPayload.borderRadius || "";
  element.style.clipPath = shardClipPath(corners, rect.width, rect.height);

  if (mode === "clone") {
    const contentWrap = createElement("div");
    contentWrap.className = "wa-shard-content";
    contentWrap.appendChild(prepareCloneRoot(contentPayload.sourceWin));
    element.appendChild(contentWrap);
    element.style.filter = "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.32))";
  } else {
    element.style.backgroundColor =
      contentPayload.fallbackBackground === null ? "var(--glass)" : contentPayload.fallbackBackground;
    element.style.boxShadow = "inset 0 0 0 1px var(--glass-border)";
    element.style.filter = `brightness(${(0.86 + Math.random() * 0.22).toFixed(2)}) drop-shadow(0 6px 12px rgba(0, 0, 0, 0.32))`;
  }
  layer.appendChild(element);

  const { area, cx, cy } = polygonAreaAndCentroid(corners);

  const offsetX = cx - impactPoint.x;
  const offsetY = cy - impactPoint.y;
  const offsetDist = Math.hypot(offsetX, offsetY) || 1;
  const dirX = offsetX / offsetDist;
  const dirY = offsetY / offsetDist;

  const inertiaScale = clamp(Math.sqrt(area) / 95, 0.45, 2.6);
  const spinSign = offsetX >= 0 ? 1 : -1;
  const delayMs = clamp((offsetDist / CRACK_SPEED_PX_PER_S) * 1000 * (0.75 + Math.random() * 0.5), 0, 150);

  return {
    element,
    x: 0,
    y: 0,
    rotation: 0,
    vx: dirX * (14 + Math.random() * 48) + (Math.random() - 0.5) * 18,
    vy: dirY * (8 + Math.random() * 30) + (Math.random() - 0.5) * 16 + 12,
    spinSpeed: (spinSign * (16 + Math.random() * 64)) / inertiaScale + (Math.random() - 0.5) * 12,
    delayMs,
    fadeStartRatio: 0.62 + Math.random() * 0.28,
    durationMs: fallDurationMs - delayMs,
    released: false
  };
}

function runFallPhysics(layer, shards, fallDurationMs, onFinished) {
  const startTime = performance.now();
  let lastTimestamp = startTime;

  const tick = (now) => {
    const deltaSeconds = Math.min((now - lastTimestamp) / 1000, 0.033);
    lastTimestamp = now;
    const elapsedMs = now - startTime;

    for (const shard of shards) {
      const localMs = elapsedMs - shard.delayMs;
      if (localMs <= 0) continue;
      if (!shard.released) shard.released = true;

      shard.vy += GRAVITY_PX_PER_S2 * deltaSeconds;
      shard.vx *= Math.max(0, 1 - 0.4 * deltaSeconds);
      shard.x += shard.vx * deltaSeconds;
      shard.y += shard.vy * deltaSeconds;
      shard.rotation += shard.spinSpeed * deltaSeconds;

      const localProgress = Math.min(localMs / shard.durationMs, 1);
      const opacity =
        localProgress <= shard.fadeStartRatio
          ? 1
          : 1 - (localProgress - shard.fadeStartRatio) / (1 - shard.fadeStartRatio);

      shard.element.style.transform = `translate3d(${shard.x.toFixed(1)}px, ${shard.y.toFixed(1)}px, 0) rotate(${shard.rotation.toFixed(1)}deg)`;
      shard.element.style.opacity = Math.max(opacity, 0).toFixed(3);
    }

    if (elapsedMs < fallDurationMs && !document.hidden) {
      requestAnimationFrame(tick);
    } else {
      layer.remove();
      activeFallCount--;
      onFinished();
    }
  };
  requestAnimationFrame(tick);
}

function startFall(rect, mode, contentPayload, speedMultiplier, onFinished) {
  const layer = createElement("div");
  layer.className = "wa-fall-apart-layer";

  const cornerSets = buildShardCells(rect.width, rect.height);
  const fallDurationMs = clamp(950 + rect.height * 0.85, 1050, 1750) * Math.max(speedMultiplier, 0.35);
  const impactPoint = {
    x: rect.width * (0.35 + Math.random() * 0.3),
    y: rect.height * (0.35 + Math.random() * 0.3)
  };

  const shards = cornerSets.map((corners) =>
    createShard(layer, corners, rect, mode, contentPayload, impactPoint, fallDurationMs)
  );
  document.body.appendChild(layer);
  shards.forEach((shardState) => {
    try {
      shardState.element.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    } catch {}
  });

  runFallPhysics(layer, shards, fallDurationMs, onFinished);
}

export function playFallApartAnimation(win, onDone, speedMultiplier = 1) {
  const rect = win.getBoundingClientRect();
  if (!rect.width || !rect.height || activeFallCount >= MAX_CONCURRENT_FALLS) {
    onDone?.();
    return;
  }
  activeFallCount++;

  const computedStyle = getComputedStyle(win);
  const rawBackground = computedStyle.backgroundColor;
  const fallbackBackground =
    rawBackground && rawBackground !== "transparent" && !rawBackground.endsWith(", 0)") ? rawBackground : null;

  const nodeCount = win.querySelectorAll("*").length;
  const useCloneMode = nodeCount <= MAX_CLONE_NODES;
  let launched = false;

  try {
    if (useCloneMode) {
      startFall(
        rect,
        "clone",
        { sourceWin: win, borderRadius: computedStyle.borderRadius || "0px" },
        speedMultiplier,
        () => {}
      );
      launched = true;
    }
  } catch {}

  if (!launched) {
    try {
      startFall(rect, "glass", { fallbackBackground }, speedMultiplier, () => {});
      launched = true;
    } catch {
      activeFallCount--;
    }
  }

  onDone?.();
}
