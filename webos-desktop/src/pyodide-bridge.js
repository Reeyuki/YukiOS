// Manages the Pyodide Web Worker lifecycle, message routing, and run queuing.

let worker = null;
let isReady = false;
let initError = null;
let runIdCounter = 0;

const progressListeners = new Set();
const readyListeners = new Set();

let pendingRun = null;

export function initWorker(workerPath = "/static/pyodide.worker.js") {
  if (worker) return;

  worker = new Worker(workerPath);

  worker.onmessage = (e) => {
    const msg = e.data;

    switch (msg.type) {
      case "progress":
        progressListeners.forEach((cb) => cb({ value: msg.value, label: msg.label }));
        break;

      case "ready":
        isReady = true;
        readyListeners.forEach((cb) => cb());
        readyListeners.clear();
        break;

      case "init_error":
        initError = msg.message;
        progressListeners.forEach((cb) => cb({ value: -1, label: `Error: ${msg.message}` }));
        break;

      case "run_start":
        break;

      case "stdout":
        if (pendingRun && pendingRun.runId === msg.runId) {
          pendingRun.onOutput(msg.text, "stdout");
        } else if (pendingRun) {
          pendingRun.onOutput(msg.text, "stdout");
        }
        break;

      case "stderr":
        if (pendingRun) {
          pendingRun.onOutput(msg.text, "stderr");
        }
        break;

      case "result":
        if (pendingRun) {
          const { resolve } = pendingRun;
          pendingRun = null;
          resolve(msg.result);
        }
        break;

      case "error":
        if (pendingRun) {
          const { reject } = pendingRun;
          pendingRun = null;
          reject(new Error(msg.message));
        }
        break;
    }
  };

  worker.onerror = (e) => {
    initError = e.message;
    if (pendingRun) {
      const { reject } = pendingRun;
      pendingRun = null;
      reject(new Error(e.message));
    }
  };
}

export function onProgress(cb) {
  progressListeners.add(cb);
  return () => progressListeners.delete(cb);
}

export function onReady(cb) {
  if (isReady) {
    cb();
    return () => {};
  }
  readyListeners.add(cb);
  return () => readyListeners.delete(cb);
}

export function getIsReady() {
  return isReady;
}

export function getInitError() {
  return initError;
}

/**
 * Run Python code in the worker.
 * @param {string} code - Python source code
 * @param {function} onOutput - called with (text, stream) for stdout/stderr
 * @returns {Promise<string|null>} - resolves with the last expression result, or null
 */
export function runPython(code, onOutput) {
  if (!worker) throw new Error("Worker not initialized. Call initWorker() first.");
  if (!isReady) return Promise.reject(new Error("Pyodide runtime is not ready yet."));
  if (pendingRun) return Promise.reject(new Error("Another script is already running."));

  return new Promise((resolve, reject) => {
    const runId = ++runIdCounter;
    pendingRun = { runId, onOutput, resolve, reject };
    worker.postMessage({ type: "run", code, runId });
  });
}

export function isRunning() {
  return pendingRun !== null;
}
