export const Signal = {
  SIGINT: "SIGINT",
  SIGTERM: "SIGTERM",
  SIGKILL: "SIGKILL",
  SIGPIPE: "SIGPIPE",
  SIGHUP: "SIGHUP",
  SIGQUIT: "SIGQUIT"
};

export class OutputStream {
  constructor() {
    this.endedState = false;
    this.signalState = null;
    this.writeHandlers = [];
    this.endHandlers = [];
    this.signalStateHandlers = [];
    this.errorHandlers = [];
  }

  onWrite(handler) {
    this.writeHandlers.push(handler);
  }
  onEnd(handler) {
    this.endHandlers.push(handler);
  }
  onSignal(handler) {
    this.signalStateHandlers.push(handler);
  }
  onError(handler) {
    this.errorHandlers.push(handler);
  }

  write(data) {
    if (this.endedState) return false;
    for (const h of this.writeHandlers) h(data);
    return true;
  }

  end() {
    if (this.endedState) return;
    this.endedState = true;
    for (const h of this.endHandlers) h();
  }

  signal(sig) {
    this.signalState = sig;
    for (const h of this.signalStateHandlers) h(sig);
    if (sig !== Signal.SIGPIPE) this.end();
  }

  get ended() {
    return this.endedState;
  }
  get signal() {
    return this.signalState;
  }
}

export class InputStream {
  constructor() {
    this.buffer = [];
    this.readResolves = [];
    this.endedState = false;
    this.signalState = null;
  }

  write(data) {
    if (this.endedState) return;
    if (this.readResolves.length > 0) {
      const resolve = this.readResolves.shift();
      resolve(data);
    } else {
      this.buffer.push(data);
    }
  }

  async read() {
    if (this.buffer.length > 0) {
      return this.buffer.shift();
    }
    if (this.endedState) return null;
    return new Promise((resolve) => {
      this.readResolves.push(resolve);
    });
  }

  end() {
    this.endedState = true;
    for (const resolve of this.readResolves) resolve(null);
    this.readResolves = [];
  }

  signal(sig) {
    this.signalState = sig;
    this.end();
  }

  get ended() {
    return this.endedState;
  }
  get signal() {
    return this.signalState;
  }
}

export class Stream {
  constructor() {
    this.input = new InputStream();
    this.output = new OutputStream();
  }

  write(data) {
    return this.output.write(data);
  }
  async read() {
    return this.input.read();
  }
  end() {
    this.output.end();
    this.input.end();
  }
  signal(sig) {
    this.output.signal(sig);
    this.input.signal(sig);
  }

  pipe(destination) {
    this.output.onWrite((data) => destination.write(data));
    this.output.onEnd(() => destination.end());
    this.output.onSignal((sig) => destination.signal(sig));
    return destination;
  }

  get ended() {
    return this.output.ended;
  }
}

export function fromIterable(iterable) {
  const s = new Stream();
  (async () => {
    for await (const chunk of iterable) s.write(chunk);
    s.end();
  })();
  return s;
}

export function collectStream(stream) {
  return new Promise((resolve) => {
    const parts = [];
    stream.output.onWrite((data) => parts.push(data));
    stream.output.onEnd(() => resolve(parts.join("")));
  });
}

export async function* readLines(inputStream) {
  let tail = "";
  while (true) {
    const data = await inputStream.read();
    if (data === null) {
      if (tail) yield tail;
      break;
    }
    const lines = (tail + data).split("\n");
    tail = lines.pop();
    for (const line of lines) yield line;
  }
}
