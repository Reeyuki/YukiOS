import L from "https://cdn.jsdelivr.net/npm/@mercuryworkshop/libcurl-transport@2.0.5/dist/index.mjs";

function n(headers) {
  if (!headers) return [];
  if (Array.isArray(headers)) return headers;
  if (typeof Headers !== "undefined" && headers instanceof Headers) return [...headers];
  return Object.entries(headers);
}

function o(headers) {
  if (!headers) return {};
  let entries = Array.isArray(headers) ? headers : Object.entries(headers);
  let out = {};
  for (let e of entries) {
    let k = String(e[0]).toLowerCase(), v = e[1];
    if (Array.isArray(v)) {
      for (let x of v) {
        let sv = String(x);
        if (k in out) { let p = out[k]; out[k] = Array.isArray(p) ? (p.push(sv), p) : [p, sv]; }
        else out[k] = sv;
      }
    } else {
      let sv = String(v);
      if (k in out) { let p = out[k]; out[k] = Array.isArray(p) ? (p.push(sv), p) : [p, sv]; }
      else out[k] = sv;
    }
  }
  return out;
}

export default class WrappedL {
  constructor(p) { this._ = new L(p); }
  get ready() { return this._.ready; }
  set ready(v) { this._.ready = v; }
  init() { return this._.init(); }
  meta() { return this._.meta(); }
  async request(remote, method, body, headers, signal) {
    let r = await this._.request(remote, method, body, n(headers), signal);
    let buf = typeof ReadableStream !== "undefined" && r.body instanceof ReadableStream ? await new Response(r.body).arrayBuffer() : r.body;
    return { body: buf, headers: o(r.headers), status: r.status, statusText: r.statusText };
  }
  connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
    return this._.connect(url, protocols, n(requestHeaders), onopen, onmessage, onclose, onerror);
  }
}
