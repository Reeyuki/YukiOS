export function createState(orientation = "horizontal", masterSize = 0.6) {
  return {
    type: "master-stack",
    master: null,
    stack: [],
    orientation,
    masterSize
  };
}

export function insert(state, winId, focusedWinId) {
  if (!state.master) {
    state.master = winId;
  } else {
    state.stack.push(winId);
  }
  return state;
}

export function remove(state, winId) {
  if (state.master === winId) {
    state.master = state.stack.shift() || null;
  } else {
    state.stack = state.stack.filter((id) => id !== winId);
  }
  return state;
}

export function findNodeByWinId(state, winId) {
  if (!state) return null;
  if (state.master === winId) return { winId };
  if (state.stack.includes(winId)) return { winId };
  return null;
}

export function getLeafWindows(state) {
  if (!state || !state.master) return [];
  return [state.master, ...state.stack];
}

export function countLeaves(state) {
  return state ? (state.master ? 1 : 0) + state.stack.length : 0;
}

export function swapWindows(state, winIdA, winIdB) {
  const idxA = state.master === winIdA ? -1 : state.stack.indexOf(winIdA);
  const idxB = state.master === winIdB ? -1 : state.stack.indexOf(winIdB);
  if (idxA === -2 || idxB === -2) return false;
  if (idxA === -1 && idxB === -1) return false;

  if (idxA === -1) {
    state.master = winIdB;
    state.stack[idxB] = winIdA;
  } else if (idxB === -1) {
    state.master = winIdA;
    state.stack[idxA] = winIdB;
  } else {
    const tmp = state.stack[idxA];
    state.stack[idxA] = state.stack[idxB];
    state.stack[idxB] = tmp;
  }
  return true;
}

export function getDirectionalNeighbor(state, winId, direction) {
  if (!state || !state.master) return null;

  if (direction === "left" || direction === "right") {
    if (state.master === winId && state.stack.length > 0) return { winId: state.stack[0] };
    if (state.stack.includes(winId) && state.master) return { winId: state.master };
    return null;
  }

  if (direction === "up" || direction === "down") {
    const idx = state.stack.indexOf(winId);
    if (idx > 0) return { winId: state.stack[idx - 1] };
    if (idx >= 0 && idx < state.stack.length - 1) return { winId: state.stack[idx + 1] };
    return { winId: state.master };
  }

  return null;
}

export function resizeSplit(state, winId, direction, delta) {
  if (!state) return false;
  const size = state.masterSize ?? 0.6;
  if (direction === "left" || direction === "up") {
    state.masterSize = Math.max(0.15, Math.min(0.85, size + delta));
  } else {
    state.masterSize = Math.max(0.15, Math.min(0.85, size - delta));
  }
  return true;
}

export function calculateLayout(state, x, y, w, h, gaps) {
  const results = [];
  const inner = gaps && gaps.inner != null ? gaps.inner : 4;
  const outer = gaps && gaps.outer != null ? gaps.outer : 3;
  const outerBottom = gaps && gaps.outerBottom != null ? gaps.outerBottom : outer;

  const ox = outer;
  const rect = { x: x + ox, y: y + outer, w: w - ox * 2, h: h - outer - outerBottom };

  if (!state || !state.master) return results;

  const size = state.masterSize ?? 0.6;
  const orientation = state.orientation ?? "horizontal";

  if (orientation === "horizontal") {
    const masterW = Math.round(rect.w * size);
    const stackW = rect.w - masterW - inner;

    results.push({
      winId: state.master,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(Math.max(masterW, 0)),
      h: Math.round(Math.max(rect.h, 0))
    });

    if (state.stack.length > 0) {
      const stackH = Math.round((rect.h - inner * (state.stack.length - 1)) / state.stack.length);
      state.stack.forEach((winId, i) => {
        results.push({
          winId,
          x: Math.round(rect.x + masterW + inner),
          y: Math.round(rect.y + i * (stackH + inner)),
          w: Math.round(Math.max(stackW, 0)),
          h: Math.round(Math.max(stackH, 0))
        });
      });
    }
  } else {
    const masterH = Math.round(rect.h * size);
    const stackH = rect.h - masterH - inner;

    results.push({
      winId: state.master,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(Math.max(rect.w, 0)),
      h: Math.round(Math.max(masterH, 0))
    });

    if (state.stack.length > 0) {
      const stackW = Math.round((rect.w - inner * (state.stack.length - 1)) / state.stack.length);
      state.stack.forEach((winId, i) => {
        results.push({
          winId,
          x: Math.round(rect.x + i * (stackW + inner)),
          y: Math.round(rect.y + masterH + inner),
          w: Math.round(Math.max(stackW, 0)),
          h: Math.round(Math.max(stackH, 0))
        });
      });
    }
  }

  return results;
}

export const MasterStackEngine = {
  createState,
  insert,
  remove,
  findNodeByWinId,
  getLeafWindows,
  countLeaves,
  swapWindows,
  getDirectionalNeighbor,
  resizeSplit,
  calculateLayout
};
