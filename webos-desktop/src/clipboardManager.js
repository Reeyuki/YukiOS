import { StorageKeys } from "./StorageKeys.js";

class ClipboardManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.currentItem = null;
    this.history = [];
    this.maxHistorySize = 20;
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
    this.eventBus.emit("clipboard:update", item);
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
    this.eventBus.emit("clipboard:clear");
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
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.currentItem));
      localStorage.setItem(this.historyKey, JSON.stringify(this.history));
    } catch (e) {
      console.warn("[ClipboardManager] Failed to save to storage:", e);
    }
  }

  loadFromStorage() {
    try {
      const current = localStorage.getItem(this.storageKey);
      const history = localStorage.getItem(this.historyKey);

      if (current) {
        this.currentItem = JSON.parse(current);
      }
      if (history) {
        this.history = JSON.parse(history);
      }
    } catch (e) {
      console.warn("[ClipboardManager] Failed to load from storage:", e);
    }
  }

  clearStorage() {
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.historyKey);
    } catch (e) {
      console.warn("[ClipboardManager] Failed to clear storage:", e);
    }
  }

  removeFromHistory(index) {
    if (index >= 0 && index < this.history.length) {
      this.history.splice(index, 1);
      this.saveToStorage();
      this.notifyChange(this.currentItem);
      this.eventBus.emit("clipboard:history-changed");
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
      this.eventBus.emit("clipboard:history-changed");
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
      localStorage.setItem("yukios_clipboard_starred", JSON.stringify([...this.starredItems]));
    } catch (e) {
      console.warn("[ClipboardManager] Failed to save starred items:", e);
    }
  }

  loadStarredItems() {
    try {
      const starred = localStorage.getItem("yukios_clipboard_starred");
      if (starred) {
        this.starredItems = new Set(JSON.parse(starred));
      }
    } catch (e) {
      console.warn("[ClipboardManager] Failed to load starred items:", e);
    }
  }
}

export { ClipboardManager };
