export class AIMemory {
  constructor() {
    this.sessionMemory = new Map();
    this.contextMemory = new Map();
    this.preferences = new Map();
    this.chatHistory = [];
    this.STORAGE_KEY = "yuki_ai_memory";
    this.CHAT_KEY = "yuki_ai_chat_history";
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
    this._savePreferences();
  }

  async loadPreferences() {
    try {
      const saved = localStorage.getItem(this.PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.preferences = new Map(Object.entries(parsed));
        return Object.fromEntries(this.preferences);
      }
    } catch (error) {
      console.warn("[AIMemory] Failed to load preferences:", error);
    }
    return {};
  }

  _savePreferences() {
    try {
      const obj = Object.fromEntries(this.preferences);
      localStorage.setItem(this.PREFS_KEY, JSON.stringify(obj));
    } catch (error) {
      console.warn("[AIMemory] Failed to save preferences:", error);
    }
  }

  async saveChatHistory(history) {
    try {
      const trimmed = history.slice(-50);
      localStorage.setItem(this.CHAT_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.warn("[AIMemory] Failed to save chat history:", error);
    }
  }

  async loadChatHistory() {
    try {
      const saved = localStorage.getItem(this.CHAT_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn("[AIMemory] Failed to load chat history:", error);
    }
    return [];
  }

  clearChatHistory() {
    this.chatHistory = [];
    localStorage.removeItem(this.CHAT_KEY);
  }

  async savePersistentMemory(key, value) {
    try {
      let memory = {};
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        memory = JSON.parse(saved);
      }
      memory[key] = value;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memory));
    } catch (error) {
      console.warn("[AIMemory] Failed to save persistent memory:", error);
    }
  }

  async loadPersistentMemory(key) {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const memory = JSON.parse(saved);
        return memory[key];
      }
    } catch (error) {
      console.warn("[AIMemory] Failed to load persistent memory:", error);
    }
    return null;
  }

  async clearPersistentMemory() {
    localStorage.removeItem(this.STORAGE_KEY);
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
      this._savePreferences();
    }
  }
}
