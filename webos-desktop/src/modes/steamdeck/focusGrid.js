import { $$ } from "../../framework.js";

const FOCUSABLE_SELECTOR = [
  ".deck-topbar-avatar",
  ".deck-topbar-item",
  ".deck-topbar-tray .tray-icon-btn",
  ".deck-topbar-search",
  ".deck-topbar-quick",
  ".deck-topbar-power",
  ".deck-rail-btn",
  ".deck-nav-btn",
  ".deck-tile",
  ".deck-recent-item",
  ".deck-news-card",
  ".deck-foot-btn",
  ".deck-foot-hint[data-action]"
].join(", ");

const EXCLUDED_SELECTOR = [
  ".deck-power",
  ".deck-search-overlay",
  ".deck-carousel-item",
  ".deck-carousel-arrow",
  ".deck-sleep-overlay",
  ".deck-sleep-wake-layer"
].join(", ");

const REDUNDANT_CLASSES = ["deck-tile", "deck-nav-btn", "deck-recent-item", "deck-foot-btn", "deck-rail-btn"];

const VERTICAL_PERSPECTIVE_WEIGHT = 2.5;

function isExcluded(el) {
  return el.closest(EXCLUDED_SELECTOR);
}

function isVisible(el) {
  return el.getClientRects().length > 0;
}

export function collectSpatialFocusables(root, opts = {}) {
  const list = [];
  const seen = new Set();
  const add = (el) => {
    if (!el || seen.has(el) || !isVisible(el) || isExcluded(el)) return;
    seen.add(el);
    const rect = el.getBoundingClientRect();
    list.push({
      el,
      action: el.dataset.action,
      appId: el.dataset.appId,
      rect,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2
    });
  };

  if (opts.detailOpen) {
    $$("[data-action]", opts.detailEl).forEach(add);
  } else {
    $$(FOCUSABLE_SELECTOR, root).forEach(add);
    $$("[data-action]", root).forEach((el) => {
      if (REDUNDANT_CLASSES.some((className) => el.classList && el.classList.contains(className))) return;
      add(el);
    });
  }
  $$(".deck-foot-left [data-action], .deck-foot-hint[data-action='back']", root).forEach(add);

  return buildRows(list);
}

function buildRows(list) {
  const rows = [];
  for (const entry of list) {
    const rect = entry.rect;
    let row = rows.find((candidate) => candidate.top < rect.bottom && rect.top < candidate.bottom);
    if (!row) {
      row = { top: rect.top, bottom: rect.bottom, items: [] };
      rows.push(row);
    } else {
      row.top = Math.min(row.top, rect.top);
      row.bottom = Math.max(row.bottom, rect.bottom);
    }
    row.items.push(entry);
  }
  rows.sort((a, b) => a.top - b.top);
  const ordered = [];
  rows.forEach((row, rowIndex) => {
    row.items.sort((a, b) => a.cx - b.cx);
    row.items.forEach((entry, colIndex) => {
      entry.row = rowIndex;
      entry.col = colIndex;
      ordered.push(entry);
    });
  });
  return ordered;
}

export function moveSpatialFocus(list, index, dx, dy) {
  if (!list.length) return 0;
  if (index < 0 || index >= list.length) index = 0;
  const current = list[index];

  if (dy !== 0) {
    let best = null;
    let bestScore = Infinity;
    for (const entry of list) {
      if (entry === current) continue;
      if (dy > 0 && entry.cy <= current.cy) continue;
      if (dy < 0 && entry.cy >= current.cy) continue;
      const parallel = Math.abs(entry.cy - current.cy);
      const perpendicular = Math.abs(entry.cx - current.cx);
      const score = parallel + perpendicular * VERTICAL_PERSPECTIVE_WEIGHT;
      if (score < bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    if (best) return list.indexOf(best);
    return index;
  }

  if (dx !== 0) {
    const row = list.filter((entry) => entry.row === current.row);
    let best = null;
    let bestDistance = Infinity;
    for (const entry of row) {
      if (entry === current) continue;
      if (dx > 0 && entry.cx <= current.cx) continue;
      if (dx < 0 && entry.cx >= current.cx) continue;
      const distance = Math.abs(entry.cx - current.cx);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = entry;
      }
    }
    if (best) return list.indexOf(best);
    if (row.length > 1) {
      let wrapped = null;
      for (const entry of row) {
        if (entry === current) continue;
        if (!wrapped || (dx > 0 && entry.cx < wrapped.cx) || (dx < 0 && entry.cx > wrapped.cx)) {
          wrapped = entry;
        }
      }
      return list.indexOf(wrapped);
    }
    let nearest = null;
    let nearestScore = Infinity;
    for (const entry of list) {
      if (entry === current) continue;
      if (dx > 0 && entry.cx <= current.cx) continue;
      if (dx < 0 && entry.cx >= current.cx) continue;
      const score = Math.abs(entry.cx - current.cx) + Math.abs(entry.cy - current.cy) * VERTICAL_PERSPECTIVE_WEIGHT;
      if (score < nearestScore) {
        nearestScore = score;
        nearest = entry;
      }
    }
    if (nearest) return list.indexOf(nearest);
    return index;
  }

  return index;
}
