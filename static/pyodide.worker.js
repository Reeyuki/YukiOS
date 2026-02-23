// pyodide.worker.js
// Runs Pyodide entirely off the main thread to prevent browser blocking.

importScripts("https://cdn.jsdelivr.net/pyodide/v0.24.0/full/pyodide.js");

let pyodide = null;
let currentRunId = null;

async function init() {
  try {
    self.postMessage({ type: "progress", value: 5, label: "Starting runtime..." });

    pyodide = await loadPyodide({
      stdout: (text) => {
        self.postMessage({ type: "stdout", text: text + "\n" });
      },
      stderr: (text) => {
        self.postMessage({ type: "stderr", text: text + "\n" });
      },
    });

    self.postMessage({ type: "progress", value: 80, label: "Setting up environment..." });

    await pyodide.runPythonAsync(`
import sys
import io
print("Python", sys.version.split()[0], "ready")
    `);

    self.postMessage({ type: "progress", value: 100, label: "Ready!" });
    self.postMessage({ type: "ready" });
  } catch (err) {
    self.postMessage({ type: "init_error", message: String(err) });
  }
}

self.onmessage = async (e) => {
  const { type, code, runId } = e.data;

  if (type === "run") {
    currentRunId = runId;
    try {
      self.postMessage({ type: "run_start", runId });

      await pyodide.loadPackagesFromImports(code);

      const result = await pyodide.runPythonAsync(code);

      let resultStr = null;
      if (result !== undefined && result !== null) {
        try {
          resultStr = result.toString();
        } catch {
          resultStr = String(result);
        }
      }

      self.postMessage({ type: "result", result: resultStr, runId });
    } catch (err) {
      self.postMessage({ type: "error", message: String(err), runId });
    }
  }

  if (type === "interrupt") {
    if (pyodide && pyodide.checkInterrupt) {
      pyodide.setInterruptBuffer(new Int32Array(new SharedArrayBuffer(4)));
    }
  }
};

init();
