let pyodideInstance = null;
let loadingPromise = null;
let capturing = false;
let stdoutBuffer = "";
let stderrBuffer = "";

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.mjs";

export async function getPyodide() {
  if (pyodideInstance) return pyodideInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const mod = await import(/* @vite-ignore */ PYODIDE_URL);
    pyodideInstance = await mod.loadPyodide({
      stdin: () => {
        return prompt("Python input:") || "";
      },
      stdout: (text) => {
        if (capturing) stdoutBuffer += text + "\n";
      },
      stderr: (text) => {
        if (capturing) stderrBuffer += text + "\n";
      }
    });
    loadingPromise = null;
    return pyodideInstance;
  })();

  return loadingPromise;
}

export async function runPython(code) {
  const pyodide = await getPyodide();
  capturing = true;
  stdoutBuffer = "";
  stderrBuffer = "";
  try {
    await pyodide.loadPackagesFromImports(code).catch(() => {});
    const result = pyodide.runPython(code);
    const stdout = stdoutBuffer;
    const stderr = stderrBuffer;
    return { result, stdout, stderr };
  } catch (e) {
    const stdout = stdoutBuffer;
    const stderr = stderrBuffer;
    return { result: undefined, stdout, stderr, error: e.message || String(e) };
  } finally {
    capturing = false;
  }
}

export async function isPyodideReady() {
  return !!pyodideInstance;
}
