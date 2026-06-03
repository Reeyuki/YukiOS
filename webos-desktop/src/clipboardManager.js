import { StorageKeys } from "./StorageKeys.js";
import { os } from "./os/index.js";

class ClipboardManager {
  constructor() {
    this.currentItem = null;
    this.history = [];
    this.maxHistorySize = 20;
    this.persistenceEnabled = os.storage.get(StorageKeys.clipboardSaveHistory) !== "false";
    this.changeCallbacks = new Set();
    this.broadcastChannel = null;
    this.storageKey = StorageKeys.clipboardCurrent;
    this.historyKey = StorageKeys.clipboardHistory;
    this.initialized = false;
    this.starredItems = new Set();
  }

  async init() {
    if (this.initialized) return;

    this.setupBroadcastChannel();
    this.loadFromStorage();
    this.loadStarredItems();
    this.setupGlobalInterception();
    this.initialized = true;
  }

  setupBroadcastChannel() {
    try {
      this.broadcastChannel = new BroadcastChannel("yukios-clipboard");
      this.broadcastChannel.onmessage = (event) => {
        const { type, data } = event.data;
        if (type === "update") {
          this.set(data.data, data.type, false);
        } else if (type === "clear") {
          this.clear(false);
        }
      };
    } catch (e) {
      console.warn("[ClipboardManager] BroadcastChannel not supported:", e);
    }
  }

  setupGlobalInterception() {
    document.addEventListener("copy", (e) => {
      this.handleCopyEvent(e);
    });

    document.addEventListener("cut", (e) => {
      this.handleCopyEvent(e);
    });
  }

  handleCopyEvent(event) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText) {
      this.set(selectedText, "text");
      console.log("[ClipboardManager] Captured:", selectedText.substring(0, 50));
    }
  }

  set(data, type = "text", skipHistory = false) {
    const item = {
      data,
      type,
      timestamp: Date.now(),
      id: Date.now() + Math.random()
    };

    this.currentItem = item;

    if (!skipHistory) {
      this.history.unshift(item);
      if (this.history.length > this.maxHistorySize) {
        this.history.pop();
      }
      this.saveToStorage();
    }

    this.broadcastUpdate(item);
    this.notifyChange(item);
    os.events.emit("clipboard:update", item);
  }

  get() {
    return this.currentItem;
  }

  getHistory() {
    return [...this.history];
  }

  clear(broadcast = true) {
    this.currentItem = null;
    this.history = [];
    this.clearStorage();

    if (broadcast) {
      this.broadcastClear();
    }

    this.notifyChange(null);
    os.events.emit("clipboard:clear");
  }

  onChange(callback) {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  notifyChange(item) {
    this.changeCallbacks.forEach((callback) => {
      try {
        callback(item);
      } catch (e) {
        console.error("[ClipboardManager] Error in change callback:", e);
      }
    });
  }

  broadcastUpdate(item) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: "update",
          data: { data: item.data, type: item.type }
        });
      } catch (e) {
        console.warn("[ClipboardManager] Failed to broadcast update:", e);
      }
    }
  }

  broadcastClear() {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: "clear" });
      } catch (e) {
        console.warn("[ClipboardManager] Failed to broadcast clear:", e);
      }
    }
  }

  saveToStorage() {
    if (!this.persistenceEnabled) return;
    try {
      os.storage.set(this.storageKey, this.currentItem);
      os.storage.set(this.historyKey, this.history);
    } catch (e) {
      console.warn("[ClipboardManager] Failed to save to storage:", e);
    }
  }

  loadFromStorage() {
    if (!this.persistenceEnabled) return;
    try {
      const current = os.storage.get(this.storageKey);
      const history = os.storage.get(this.historyKey);

      if (current) {
        this.currentItem = current;
      }
      if (history) {
        this.history = history;
      }
    } catch (e) {
      console.warn("[ClipboardManager] Failed to load from storage:", e);
    }
  }

  setPersistenceEnabled(enabled) {
    this.persistenceEnabled = enabled;
    if (!enabled) {
      this.clearStorage();
    }
  }

  setMaxHistorySize(size) {
    this.maxHistorySize = size;
    while (this.history.length > this.maxHistorySize) {
      this.history.pop();
    }
    this.saveToStorage();
  }

  clearStorage() {
    try {
      os.storage.remove(this.storageKey);
      os.storage.remove(this.historyKey);
    } catch (e) {
      console.warn("[ClipboardManager] Failed to clear storage:", e);
    }
  }

  removeFromHistory(index) {
    if (index >= 0 && index < this.history.length) {
      this.history.splice(index, 1);
      this.saveToStorage();
      this.notifyChange(this.currentItem);
      os.events.emit("clipboard:history-changed");
    }
  }

  updateItem(index, newData) {
    if (index >= 0 && index < this.history.length) {
      this.history[index].data = newData;
      this.history[index].timestamp = Date.now();
      if (index === 0) {
        this.currentItem = this.history[index];
      }
      this.saveToStorage();
      this.notifyChange(this.currentItem);
      os.events.emit("clipboard:history-changed");
    }
  }

  toggleStar(itemId) {
    if (this.starredItems.has(itemId)) {
      this.starredItems.delete(itemId);
    } else {
      this.starredItems.add(itemId);
    }
    this.saveStarredItems();
    return this.starredItems.has(itemId);
  }

  isStarred(itemId) {
    return this.starredItems.has(itemId);
  }

  saveStarredItems() {
    try {
      os.storage.set(StorageKeys.clipboardStarred, [...this.starredItems]);
    } catch (e) {
      console.warn("[ClipboardManager] Failed to save starred items:", e);
    }
  }

  loadStarredItems() {
    try {
      const starred = os.storage.get(StorageKeys.clipboardStarred);
      if (starred) {
        this.starredItems = new Set(starred);
      }
    } catch (e) {
      console.warn("[ClipboardManager] Failed to load starred items:", e);
    }
  }
}

export { ClipboardManager };
