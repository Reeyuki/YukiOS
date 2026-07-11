let containerInstance = null;
let bootPromise = null;
let fallbackMode = false;
let bootAttempted = false;

const CROSS_ORIGIN_MSG =
  "<span style=\"color: rgb(255, 85, 85);\">Failed to execute 'postMessage' on 'Worker': SharedArrayBuffer transfer requires self.crossOriginIsolated.</span>";

async function tryBootWebContainer() {
  if (!self.crossOriginIsolated) {
    fallbackMode = true;
    return null;
  }
  try {
    const { WebContainer } = await import("@webcontainer/api");
    const instance = await WebContainer.boot();
    return instance;
  } catch {
    fallbackMode = true;
    return null;
  }
}

function runJSFallback(code) {
  let stdoutBuffer = "";
  let stderrBuffer = "";
  try {
    const globals = {
      console: {
        log: (...args) => {
          stdoutBuffer +=
            args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ") + "\n";
        },
        error: (...args) => {
          stderrBuffer +=
            args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ") + "\n";
        },
        warn: (...args) => {
          stderrBuffer +=
            args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ") + "\n";
        },
        info: (...args) => {
          stdoutBuffer +=
            args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ") + "\n";
        }
      },
      Buffer: class Buffer {
        static from(data) {
          return typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
        }
        static alloc(size) {
          return new Uint8Array(size);
        }
        static isBuffer(obj) {
          return obj instanceof Uint8Array;
        }
      },
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      setInterval: (fn, ms) => setInterval(fn, ms),
      setImmediate: (fn) => setTimeout(fn, 0),
      clearTimeout: (id) => clearTimeout(id),
      clearInterval: (id) => clearInterval(id),
      clearImmediate: (id) => clearTimeout(id),
      require: () => {
        throw new Error("Cannot require in fallback Node.js mode");
      }
    };
    const keys = Object.keys(globals);
    const vals = Object.values(globals);
    const fn = new Function(...keys, `"use strict";\n${code}`);
    const result = fn(...vals);
    return { result, stdout: stdoutBuffer, stderr: stderrBuffer };
  } catch (e) {
    return { result: undefined, stdout: stdoutBuffer, stderr: stderrBuffer, error: e.message || String(e) };
  }
}

export async function getWebContainer() {
  if (containerInstance) return containerInstance;
  if (fallbackMode) return null;
  if (bootPromise) {
    const instance = await bootPromise;
    return instance;
  }
  bootPromise = tryBootWebContainer().then((instance) => {
    containerInstance = instance;
    bootPromise = null;
    return instance;
  });
  return bootPromise;
}

export async function runNode(code, filename = "/index.js") {
  bootAttempted = true;
  const container = await getWebContainer();

  if (!container) {
    fallbackMode = true;
    return runJSFallback(code);
  }

  try {
    await container.fs.writeFile(filename, code);
    const proc = await container.spawn("node", [filename]);
    let stdout = "";
    let stderr = "";

    const outReader = proc.output.getReader();
    const errReader = proc.stderr.getReader();
    const decoder = new TextDecoder();

    const readAll = async (reader) => {
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
      }
      return buf;
    };

    const [outResult, errResult] = await Promise.all([readAll(outReader), readAll(errReader)]);
    await proc.exit;
    await container.fs.rm(filename, { force: true }).catch(() => {});

    return { stdout: outResult, stderr: errResult, exitCode: 0 };
  } catch (e) {
    return { stdout: "", stderr: "", exitCode: 1, error: e.message || String(e) };
  }
}

export function getFallbackMode() {
  return fallbackMode;
}

export function getCrossOriginMessage() {
  return CROSS_ORIGIN_MSG;
}

export function wasBootAttempted() {
  return bootAttempted;
}
