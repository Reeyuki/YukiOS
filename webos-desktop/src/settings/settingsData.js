import { os } from "../framework.js";
import { audioMixer } from "../audioMixer.js";
import { downloadBlob } from "../utils/utils.js";

export function dumpStorage(storage) {
  const out = {};
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      out[key] = storage.getItem(key);
    }
  } catch {}
  return out;
}

export function restoreStorage(storage, data) {
  if (!data || typeof data !== "object") return;
  try {
    for (const [k, v] of Object.entries(data)) {
      if (typeof k !== "string") continue;
      storage.setItem(k, v);
    }
  } catch {}
}

export async function exportData(fs, showStatus = () => {}) {
  if (!fs) {
    os.dialog.alert("Alert", "Can't export. Filesystem manager isn't available.");
    return;
  }
  try {
    showStatus("Exporting…");
    const fsSnapshot = await fs.exportSnapshot();
    const payload = {
      version: 1,
      createdAt: Date.now(),
      localStorage: dumpStorage(localStorage),
      sessionStorage: dumpStorage(sessionStorage),
      fs: fsSnapshot
    };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadBlob(blob, `yukiOS-backup-${stamp}.json`);
    showStatus("Exported");
  } catch (e) {
    console.error("Export failed:", e);
    os.dialog.alert("Alert", "Export failed. Check the console for details.");
    showStatus("Export failed");
  }
}

export async function importData(fs, showStatus = () => {}) {
  if (!fs) {
    os.dialog.alert("Alert", "Can't import. Filesystem manager isn't available.");
    return;
  }

  const confirmed = await os.dialog.confirm(
    "Confirm",
    "This will replace settings, files, and everything else. There's no going back."
  );
  if (!confirmed) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.style.display = "none";
  document.body.appendChild(input);
  const cleanup = () => input.remove();

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    cleanup();
    if (!file) return;

    try {
      showStatus("Importing…");
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload || payload.version !== 1 || !payload.fs) throw new Error("Invalid backup file.");

      try {
        os.storage.clear();
        sessionStorage.clear();
      } catch {}

      restoreStorage(localStorage, payload.localStorage);
      restoreStorage(sessionStorage, payload.sessionStorage);
      await fs.importSnapshot(payload.fs, { wipe: true });

      showStatus("Imported (reloading)...");
      setTimeout(() => location.reload(), 400);
    } catch (e) {
      console.error("Import failed:", e);
      audioMixer().playCriticalWarning();
      os.dialog.alert("Alert", "Import failed. The file might be damaged or invalid.");
      showStatus("Import failed");
    }
  });

  input.click();
}

export async function deleteAllData() {
  const confirmed = await os.dialog.confirm(
    "Confirm",
    "⚠️ WARNING: Delete All Data\n\n" +
      "This will permanently delete:\n" +
      "• All game progresses, saved files, settings, and preferences\n\n" +
      "No take-backs.\n\n" +
      "Still want to go through with this?"
  );
  if (!confirmed) return;

  try {
    os.storage.clear();

    const sessionKeys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) sessionKeys.push(key);
    }
    sessionKeys.forEach((key) => {
      try {
        sessionStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove sessionStorage key: ${key}`, e);
      }
    });

    await deleteAllIndexedDBDatabases();

    if ("caches" in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch (e) {
        console.warn("Failed to clear caches:", e);
      }
    }

    location.reload();
  } catch (error) {
    console.error("Error deleting all data:", error);
    os.dialog.alert("Alert", "Something went wrong while deleting. Some data might still be there. Reloading now.");
    location.reload();
  }
}

async function deleteAllIndexedDBDatabases() {
  if (typeof indexedDB.databases === "function") {
    try {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases.map(
          (dbInfo) =>
            new Promise((resolve) => {
              if (!dbInfo.name) {
                resolve();
                return;
              }
              const req = indexedDB.deleteDatabase(dbInfo.name);
              req.onsuccess = () => {
                console.log(`Deleted IndexedDB: ${dbInfo.name}`);
                resolve();
              };
              req.onerror = (e) => {
                console.warn(`Failed to delete IndexedDB: ${dbInfo.name}`, e);
                resolve();
              };
              req.onblocked = () => {
                console.warn(`IndexedDB deletion blocked: ${dbInfo.name}`);
                resolve();
              };
            })
        )
      );
      return;
    } catch (e) {
      console.warn("indexedDB.databases() failed, falling back to known names:", e);
    }
  }

  const variations = generateDatabaseNameVariations();
  await Promise.all(
    variations.map(
      (dbName) =>
        new Promise((resolve) => {
          try {
            const req = indexedDB.deleteDatabase(dbName);
            req.onsuccess = () => {
              console.log(`Deleted IndexedDB: ${dbName}`);
              resolve();
            };
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          } catch {
            resolve();
          }
        })
    )
  );
}

function generateDatabaseNameVariations() {
  const prefixes = ["yuki", "yukiOS", "app", "data", "cache", "store"];
  const suffixes = ["db", "DB", "database", "Database", "store", "Store", "cache", "Cache", "data", "Data"];
  const variations = [];
  prefixes.forEach((prefix) => {
    suffixes.forEach((suffix) => {
      variations.push(`${prefix}-${suffix}`);
      variations.push(`${prefix}_${suffix}`);
      variations.push(`${prefix}${suffix}`);
    });
  });
  return variations;
}
