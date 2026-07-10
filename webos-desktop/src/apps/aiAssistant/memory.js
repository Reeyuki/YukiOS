import { os } from "../../framework.js";

export class AIMemory {
  constructor() {
    this.sessionMemory = new Map();
    this.contextMemory = new Map();
    this.preferences = new Map();
    this.chatHistory = [];
    this.STORAGE_KEY = "yuki_ai_memory";
    this.CHAT_KEY = "yuki_ai_chathistory";
    this.PREFS_KEY = "yuki_ai_preferences";
  }

  setContext(key, value) {
    this.contextMemory.set(key, value);
  }

  getContext(key) {
    return this.contextMemory.get(key);
  }

  removeContext(key) {
    this.contextMemory.delete(key);
  }

  setSession(key, value) {
    this.sessionMemory.set(key, value);
  }

  getSession(key) {
    return this.sessionMemory.get(key);
  }

  clearSession() {
    this.sessionMemory.clear();
  }

  setPreference(key, value) {
    this.preferences.set(key, value);
    this.savePreferences();
  }

  async loadPreferences() {
    try {
      const saved = os.storage.get(this.PREFS_KEY);
      if (saved) {
        this.preferences = new Map(Object.entries(saved));
        return Object.fromEntries(this.preferences);
      }
    } catch (error) {
      console.warn("[AIMemory] Failed to load preferences:", error);
    }
    return {};
  }

  savePreferences() {
    try {
      const obj = Object.fromEntries(this.preferences);
      os.storage.set(this.PREFS_KEY, Object.fromEntries(this.preferences));
    } catch (error) {
      console.warn("[AIMemory] Failed to save preferences:", error);
    }
  }

  async saveChatHistory(history) {
    try {
      const trimmed = history.slice(-50);
      os.storage.set(this.CHAT_KEY, trimmed);
    } catch (error) {
      console.warn("[AIMemory] Failed to save chat history:", error);
    }
  }

  async loadChatHistory() {
    try {
      const saved = os.storage.get(this.CHAT_KEY);
      if (saved) {
        return saved;
      }
    } catch (error) {
      console.warn("[AIMemory] Failed to load chat history:", error);
    }
    return [];
  }

  clearChatHistory() {
    this.chatHistory = [];
    os.storage.remove(this.CHAT_KEY);
  }

  async savePersistentMemory(key, value) {
    try {
      let memory = {};
      const saved = os.storage.get(this.STORAGE_KEY);
      if (saved) {
        memory = saved;
      }
      memory[key] = value;
      os.storage.set(this.STORAGE_KEY, memory);
    } catch (error) {
      console.warn("[AIMemory] Failed to save persistent memory:", error);
    }
  }

  async loadPersistentMemory(key) {
    try {
      const saved = os.storage.get(this.STORAGE_KEY);
      if (saved) {
        return saved[key];
      }
    } catch (error) {
      console.warn("[AIMemory] Failed to load persistent memory:", error);
    }
    return null;
  }

  async clearPersistentMemory() {
    os.storage.remove(this.STORAGE_KEY);
  }

  getFullContext() {
    return {
      session: Object.fromEntries(this.sessionMemory),
      context: Object.fromEntries(this.contextMemory),
      preferences: Object.fromEntries(this.preferences)
    };
  }

  exportMemory() {
    return {
      session: Object.fromEntries(this.sessionMemory),
      context: Object.fromEntries(this.contextMemory),
      preferences: Object.fromEntries(this.preferences),
      chatHistory: this.chatHistory.slice(-10),
      timestamp: Date.now()
    };
  }

  importMemory(data) {
    if (data.session) {
      this.sessionMemory = new Map(Object.entries(data.session));
    }
    if (data.context) {
      this.contextMemory = new Map(Object.entries(data.context));
    }
    if (data.preferences) {
      this.preferences = new Map(Object.entries(data.preferences));
      this.savePreferences();
    }
  }
}
