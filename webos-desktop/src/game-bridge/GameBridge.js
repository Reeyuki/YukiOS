class GameBridge {
  constructor() {
    this.listeners = {};
  }

  on(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    for (const handler of this.listeners[event]) {
      handler(data);
    }
  }

  emitToDesktop(event, data) {
    this.emit("desktop:" + event, data);
  }

  emitToRoom(event, data) {
    this.emit("room:" + event, data);
  }

  clear() {
    this.listeners = {};
  }
}

export const gameBridge = new GameBridge();
