// Node 25+ ships its own (experimental) global localStorage. Without --localstorage-file it is
// unusable (undefined or throws) and it shadows jsdom's. Re-expose jsdom's Web Storage so the
// tests behave the same on every Node version.
function hasWorkingStorage() {
  try {
    return typeof globalThis.localStorage?.clear === "function";
  } catch {
    return false;
  }
}

if (!hasWorkingStorage() && globalThis.jsdom) {
  const { window: jsdomWindow } = globalThis.jsdom;
  for (const name of ["localStorage", "sessionStorage", "Storage"]) {
    Object.defineProperty(globalThis, name, { value: jsdomWindow[name], configurable: true, writable: true });
  }
}
