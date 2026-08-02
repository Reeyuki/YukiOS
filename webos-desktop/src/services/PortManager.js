export class PortManager {
  constructor() {
    this.ports = new Map();
  }

  register(port, handler, root = null) {
    this.ports.set(Number(port), { handler, root });
  }

  unregister(port) {
    this.ports.delete(Number(port));
  }

  get(port) {
    return this.ports.get(Number(port)) || null;
  }

  isRegistered(port) {
    return this.ports.has(Number(port));
  }

  list() {
    return Array.from(this.ports.entries()).map(([port, entry]) => ({ port, root: entry.root }));
  }
}
