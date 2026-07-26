let nextNodeId = 1;

function newNodeId() {
  return `tile_${nextNodeId++}`;
}

function createLeaf(winId) {
  return {
    type: "leaf",
    split: null,
    ratio: null,
    left: null,
    right: null,
    winId: winId || null,
    parent: null,
    nodeId: newNodeId()
  };
}

function createInternal(split, ratio, left, right) {
  const node = {
    type: "internal",
    split: split || "h",
    ratio: ratio != null ? ratio : 0.5,
    left: left || null,
    right: right || null,
    winId: null,
    parent: null,
    nodeId: newNodeId()
  };
  if (node.left) node.left.parent = node;
  if (node.right) node.right.parent = node;
  return node;
}

function isLeaf(node) {
  return node.type === "leaf";
}

function findNodeByWinId(root, winId) {
  if (!root) return null;
  if (isLeaf(root) && root.winId === winId) return root;
  const left = root.left ? findNodeByWinId(root.left, winId) : null;
  if (left) return left;
  return root.right ? findNodeByWinId(root.right, winId) : null;
}

function findNodeById(root, nodeId) {
  if (!root) return null;
  if (root.nodeId === nodeId) return root;
  const left = root.left ? findNodeById(root.left, nodeId) : null;
  if (left) return left;
  return root.right ? findNodeById(root.right, nodeId) : null;
}

function findFocusedLeaf(root, focusedWinId) {
  const focused = focusedWinId ? findNodeByWinId(root, focusedWinId) : null;
  return focused || findLargestLeaf(root);
}

function findRightmostLeaf(node) {
  if (!node) return null;
  if (isLeaf(node)) return node;
  return findRightmostLeaf(node.right) || findRightmostLeaf(node.left);
}

function findLeftmostLeaf(node) {
  if (!node) return null;
  if (isLeaf(node)) return node;
  return findLeftmostLeaf(node.left) || findLeftmostLeaf(node.right);
}

function findLargestLeaf(node) {
  if (!node) return null;
  if (isLeaf(node)) return node;
  const left = findLargestLeaf(node.left);
  const right = findLargestLeaf(node.right);
  if (!left) return right;
  if (!right) return left;
  return left;
}

function countLeaves(node) {
  if (!node) return 0;
  if (isLeaf(node)) return node.winId ? 1 : 0;
  return countLeaves(node.left) + countLeaves(node.right);
}

function getLeafWindows(root) {
  const result = [];
  function walk(node) {
    if (!node) return;
    if (isLeaf(node)) {
      if (node.winId) result.push(node.winId);
    } else {
      walk(node.left);
      walk(node.right);
    }
  }
  walk(root);
  return result;
}

function insert(root, winId, focusedWinId) {
  if (!root) {
    return createLeaf(winId);
  }

  const target = findFocusedLeaf(root, focusedWinId);
  if (!target) {
    const rightmost = findRightmostLeaf(root);
    if (!rightmost) return createLeaf(winId);
    return insertAtLeaf(root, rightmost, winId);
  }

  return insertAtLeaf(root, target, winId);
}

function insertAtLeaf(root, leaf, winId) {
  const parent = leaf.parent;
  const existingWinId = leaf.winId;

  const newLeaf = createLeaf(winId);
  const existingLeaf = createLeaf(existingWinId);

  const parentSplit = parent ? parent.split : root.split;
  const splitDir = parentSplit === "h" ? "v" : "h";
  const internal = createInternal(splitDir, 0.5, existingLeaf, newLeaf);
  internal.parent = parent;

  if (!parent) {
    return internal;
  }

  if (parent.left === leaf) {
    parent.left = internal;
  } else {
    parent.right = internal;
  }

  return root;
}

function remove(root, winId) {
  const node = findNodeByWinId(root, winId);
  if (!node || !isLeaf(node)) return root;

  if (!node.parent) {
    node.winId = null;
    return root;
  }

  const parent = node.parent;
  const sibling = parent.left === node ? parent.right : parent.left;

  if (!sibling) {
    if (parent.left === node) parent.left = null;
    else parent.right = null;
    return removeEmptyParents(root, parent);
  }

  sibling.parent = null;

  if (!parent.parent) {
    return sibling;
  }

  const grandparent = parent.parent;
  if (grandparent.left === parent) {
    grandparent.left = sibling;
  } else {
    grandparent.right = sibling;
  }
  sibling.parent = grandparent;

  return root;
}

function removeEmptyParents(root, node) {
  if (!node || !node.parent) {
    if (node && isLeaf(node) && !node.winId) return null;
    return node;
  }
  const parent = node.parent;
  const isEmpty = isLeaf(node) && !node.winId;
  if (!isEmpty) return root;
  if (parent.left === node) parent.left = null;
  else parent.right = null;

  const sibling = parent.left || parent.right;
  if (!sibling) {
    return removeEmptyParents(root, parent);
  }
  if (!parent.parent) {
    if (sibling) sibling.parent = null;
    return sibling;
  }
  const grandparent = parent.parent;
  if (grandparent.left === parent) {
    grandparent.left = sibling;
  } else {
    grandparent.right = sibling;
  }
  sibling.parent = grandparent;
  return root;
}

function getDirectionalNeighbor(root, winId, direction) {
  const node = findNodeByWinId(root, winId);
  if (!node || !node.parent) return null;

  const parent = node.parent;
  const isLeft = parent.left === node;
  const isTop = parent.split === "v" && isLeft;
  const isBottom = parent.split === "v" && !isLeft;
  const isRight = !isLeft;

  if (direction === "left" || direction === "up") {
    if (isLeft || isTop) return null;
    const sibling = parent.left;
    return findRightmostLeaf(sibling);
  }

  if (direction === "right" || direction === "down") {
    if (isRight || isBottom) return null;
    const sibling = parent.right;
    return findLeftmostLeaf(sibling);
  }

  return null;
}

function swapWindows(root, winIdA, winIdB) {
  const nodeA = findNodeByWinId(root, winIdA);
  const nodeB = findNodeByWinId(root, winIdB);
  if (!nodeA || !nodeB) return false;
  if (!isLeaf(nodeA) || !isLeaf(nodeB)) return false;

  const tempWinId = nodeA.winId;
  nodeA.winId = nodeB.winId;
  nodeB.winId = tempWinId;
  return true;
}

function resizeSplit(root, winId, direction, delta) {
  const node = findNodeByWinId(root, winId);
  if (!node || !node.parent) return false;

  const parent = node.parent;
  if (parent.type !== "internal") return false;

  const isLeft = parent.left === node;
  const isTop = parent.split === "v" && isLeft;

  if ((direction === "left" || direction === "up") && (isLeft || isTop)) return false;
  if ((direction === "right" || direction === "down") && !isLeft && !isTop) {
    parent.ratio = Math.max(0.1, Math.min(0.9, parent.ratio + delta));
  } else {
    parent.ratio = Math.max(0.1, Math.min(0.9, parent.ratio - delta));
  }
  return true;
}

function calculateLayout(root, x, y, w, h, gaps) {
  const results = [];
  const inner = gaps && gaps.inner != null ? gaps.inner : 4;
  const outer = gaps && gaps.outer != null ? gaps.outer : 3;
  const outerBottom = gaps && gaps.outerBottom != null ? gaps.outerBottom : outer;

  function walk(node, rx, ry, rw, rh, depth) {
    if (!node) return;
    depth = depth || 0;

    if (isLeaf(node)) {
      if (node.winId) {
        results.push({
          winId: node.winId,
          nodeId: node.nodeId,
          x: Math.round(rx),
          y: Math.round(ry),
          w: Math.round(Math.max(rw, 0)),
          h: Math.round(Math.max(rh, 0))
        });
      }
      return;
    }

    const ratio = node.ratio != null ? node.ratio : 0.5;
    const gap = inner;

    const MIN_W = 80;
    const MIN_H = 60;

    if (node.split === "h") {
      const availW = rw - gap;
      let leftW = Math.round(availW * ratio);
      let rightW = availW - leftW;
      if (leftW < MIN_W && rightW < MIN_W) {
        leftW = Math.round(availW / 2);
        rightW = availW - leftW;
      } else if (leftW < MIN_W) {
        leftW = MIN_W;
        rightW = Math.max(0, availW - MIN_W);
      } else if (rightW < MIN_W) {
        rightW = MIN_W;
        leftW = Math.max(0, availW - MIN_W);
      }
      walk(node.left, rx, ry, leftW, rh, depth + 1);
      walk(node.right, rx + leftW + gap, ry, rightW, rh, depth + 1);
    } else {
      const availH = rh - gap;
      let topH = Math.round(availH * ratio);
      let bottomH = availH - topH;
      if (topH < MIN_H && bottomH < MIN_H) {
        topH = Math.round(availH / 2);
        bottomH = availH - topH;
      } else if (topH < MIN_H) {
        topH = MIN_H;
        bottomH = Math.max(0, availH - MIN_H);
      } else if (bottomH < MIN_H) {
        bottomH = MIN_H;
        topH = Math.max(0, availH - MIN_H);
      }
      walk(node.left, rx, ry, rw, topH, depth + 1);
      walk(node.right, rx, ry + topH + gap, rw, bottomH, depth + 1);
    }
  }

  const ox = outer;
  walk(root, x + ox, y + outer, w - ox * 2, h - outer - outerBottom, 0);
  return results;
}

function createState() {
  return null;
}

export const TilingLayoutEngine = {
  createState,
  createLeaf,
  createInternal,
  isLeaf,
  findNodeByWinId,
  findNodeById,
  findFocusedLeaf,
  findRightmostLeaf,
  findLeftmostLeaf,
  findLargestLeaf,
  countLeaves,
  getLeafWindows,
  insert,
  remove,
  getDirectionalNeighbor,
  swapWindows,
  resizeSplit,
  calculateLayout
};
