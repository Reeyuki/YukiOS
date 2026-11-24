const ISOLATED_SCOPE = "/iso/";
const ISOLATED_WORKER = `${ISOLATED_SCOPE}sw.js`;
const ACTIVATION_TIMEOUT_MS = 8000;

function canIsolate() {
  return (
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    !window.electronAPI
  );
}

function waitForActivation(worker) {
  if (worker.state === "activated") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Isolation worker activation timed out")),
      ACTIVATION_TIMEOUT_MS,
    );
    worker.addEventListener("statechange", () => {
      if (worker.state !== "activated") return;
      clearTimeout(timer);
      resolve();
    });
  });
}

async function ensureIsolationWorker() {
  const registration = await navigator.serviceWorker.register(ISOLATED_WORKER, {
    scope: ISOLATED_SCOPE,
  });
  const worker =
    registration.active || registration.waiting || registration.installing;
  await waitForActivation(worker);
}

export async function toIsolatedUrl(url) {
  if (!canIsolate()) return url;
  try {
    const target = new URL(url);
    await ensureIsolationWorker();
    const path = `${target.host}${target.pathname}${target.search}${target.hash}`;
    return `${window.location.origin}${ISOLATED_SCOPE}${path}`;
  } catch (error) {
    console.warn("[isolatedEmbed] falling back to the direct url", error);
    return url;
  }
}
