let didReloadForUpdate = false;

function onNewServiceWorker(registration) {
  const waiting = registration.waiting;
  if (!waiting) return;

  if (didReloadForUpdate) return;
  didReloadForUpdate = true;

  waiting.postMessage({ type: "SKIP_WAITING" });
}

export function registerPWA() {
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext && window.location.hostname !== "localhost") return;

  window.addEventListener("load", async () => {
    try {
      const swUrl = new URL("sw.js", window.location.href).toString();
      const scope = new URL("./", window.location.href).pathname;
      const registration = await navigator.serviceWorker.register(swUrl, {
        scope,
        updateViaCache: "none"
      });

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed") onNewServiceWorker(registration);
        });
      });

      if (registration.waiting) onNewServiceWorker(registration);

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (didReloadForUpdate) window.location.reload();
      });

      const tryUpdate = () => registration.update().catch(() => {});
      window.addEventListener("focus", tryUpdate);
      setInterval(tryUpdate, 60 * 60 * 1000);
    } catch {}
  });
}
