export function isFunction(value) {
  return typeof value === "function";
}

export function hasMethod(obj, name) {
  return typeof obj?.[name] === "function";
}

export function callIfFunction(fn, ...args) {
  if (isFunction(fn)) return fn(...args);
  if (fn != null && import.meta.env?.VITE_DEV_BUILD) {
    console.warn("[callIfFunction] expected a function but received:", fn);
  }
  return undefined;
}
