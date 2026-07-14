const WORKER_CODE = `
let timerId = null;

self.onmessage = function(e) {
  if (e.data.type === 'start') {
    if (timerId) return;
    timerId = setInterval(() => {
      const now = new Date();
      self.postMessage({
        type: 'tick',
        timeStr: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateStr: now.toLocaleDateString(),
        timeLong: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        dateLong: now.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        timestamp: Date.now()
      });
    }, 1000);
  } else if (e.data.type === 'stop') {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }
};
`;

let worker = null;
let subscriberCount = 0;
const listeners = new Set();

function startWorker() {
  if (worker) return;
  const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = (e) => {
    if (e.data.type === "tick") {
      listeners.forEach((fn) => fn(e.data));
    }
  };
  worker.postMessage({ type: "start" });
}

function stopWorker() {
  if (!worker) return;
  worker.postMessage({ type: "stop" });
  worker.terminate();
  worker = null;
}

export function subscribeTimeTick(fn) {
  listeners.add(fn);
  subscriberCount++;
  if (subscriberCount === 1) startWorker();
  return function unsubscribe() {
    listeners.delete(fn);
    subscriberCount--;
    if (subscriberCount <= 0) {
      subscriberCount = 0;
      stopWorker();
    }
  };
}
