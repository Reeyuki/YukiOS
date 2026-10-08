import { os, StorageKeys } from "../framework.js";
import { $, createElement, bindEvent, setStyle } from "./domUtils.js";
import { getWispUrl } from "./wispConfig.js";
import { readOsTheme, parseLocalTarget, getMimeType } from "./virtualFsNet.js";
import { fetchViaWisp, fetchViaWispRaw } from "./libcurlWispClient.js";
import { fetchPage, fetchRaw } from "./transportRouter.js";
import { escapeDinoGameAttr } from "./dino/dinoGame.js";

export { fetchViaWisp, fetchViaWispRaw };

const braveSearchBase = "https://search.brave.com/search?q=";
const urlSchemePattern = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const httpPattern = /^https?:\/\//i;
const hostPattern = /^[^\s@]+\.[^\s@]+(\/.*)?$/;
const headPattern = /<head[^>]*>/i;
const htmlMimePattern = /html|xml|text|json|javascript|svg/i;
const skipRefPattern = /^(data:|blob:|mailto:|javascript:|#)/i;
const attrRefPattern =
  /((?:src|href|data-src|poster|cite|action|formaction|longdesc|profile)\s*=\s*["'])([^"']+)(["'])/gi;
const srcsetPattern = /\bsrcset\s*=\s*(["'])([^"']*)\1/gi;
const directLoadDomains = ["reeyuki.github.io", "reeyuki.neocities.org"];

function normalizeEngineUrl(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) {
    return "";
  }
  if (
    trimmed.startsWith("fs://") ||
    trimmed.startsWith("file://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  if (httpPattern.test(trimmed)) {
    return trimmed;
  }
  if (urlSchemePattern.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.includes(" ") || hostPattern.test(trimmed) === false) {
    return braveSearchBase + encodeURIComponent(trimmed);
  }
  return "https://" + trimmed;
}

function buildInterceptScript(base, pageUrl) {
  const safeBase = String(base || "");
  const safePage = String(pageUrl || safeBase);
  const typeNav = JSON.stringify("browser-navigate");
  const typeLocal = JSON.stringify("scram-local-nav");
  const typeOpen = JSON.stringify("browser-open");
  const typeFetchReq = JSON.stringify("browser-fetch-request");
  const typeFetchResp = JSON.stringify("browser-fetch-response");
  const typeBlocked = JSON.stringify("browser-blocked");
  const evtClick = JSON.stringify("click");
  const evtAux = JSON.stringify("auxclick");
  const evtDown = JSON.stringify("mousedown");
  const evtSubmit = JSON.stringify("submit");
  const evtMessage = JSON.stringify("message");
  const selAnchor = JSON.stringify("a");
  const attrHref = JSON.stringify("href");
  const attrTarget = JSON.stringify("target");
  const attrDownload = JSON.stringify("download");
  const attrAction = JSON.stringify("action");
  const typeSplit = JSON.stringify("browser-navigate-split");
  const strGet = JSON.stringify("get");
  const strPost = JSON.stringify("post");
  const strFs = JSON.stringify("fs://");
  const strFile = JSON.stringify("file://");
  const strRoot = JSON.stringify("/");
  const strStar = JSON.stringify("*");
  const strHash = JSON.stringify("#");
  const strJs = JSON.stringify("javascript:");
  const strMail = JSON.stringify("mailto:");
  const strQuery = JSON.stringify("?");
  const strAmp = JSON.stringify("&");
  return (
    "<script>(function(){var base=" +
    JSON.stringify(safeBase) +
    ";var pageUrl=" +
    JSON.stringify(safePage) +
    ";var origin='';try{origin=new URL(pageUrl||base).origin;}catch(originErr){origin='';}" +
    "function resolve(href){try{return new URL(href,base).href;}catch(resolveErr){return null;}}" +
    "function isHttp(u){return u.indexOf('http://')===0||u.indexOf('https://')===0;}" +
    "function send(url){var local=url.indexOf(" +
    strFs +
    ")===0||url.indexOf(" +
    strFile +
    ")===0||url.charAt(0)===" +
    strRoot +
    ";var payload=local?{type:" +
    typeLocal +
    ",url:url}:{type:" +
    typeNav +
    ",url:url};window.parent.postMessage(payload," +
    strStar +
    ");}" +
    "var origOpen=window.open;window.open=function(openUrl){var opened=openUrl?resolve(openUrl):null;if(!opened){return null;}window.parent.postMessage({type:" +
    typeOpen +
    ",url:opened}," +
    strStar +
    ");send(opened);return null;};" +
    "var origPush=history.pushState;history.pushState=function(){var pushUrl=arguments[2];if(pushUrl){var resolvedPush=resolve(pushUrl);if(resolvedPush){send(resolvedPush);return;}}return origPush.apply(this,arguments);};" +
    "var origReplace=history.replaceState;history.replaceState=function(){var replaceUrl=arguments[2];if(replaceUrl){var resolvedReplace=resolve(replaceUrl);if(resolvedReplace){send(resolvedReplace);return;}}return origReplace.apply(this,arguments);};" +
    "var pending={};var seq=0;window.addEventListener(" +
    evtMessage +
    ",function(msgEvt){var data=msgEvt.data||{};if(!data||data.type!==" +
    typeFetchResp +
    "||!pending[data.id]){return;}var job=pending[data.id];delete pending[data.id];if(data.ok){job.resolve(new Response(data.text,{status:data.status||200,headers:{'Content-Type':data.contentType||'text/plain'}}));}else{job.reject(new Error(data.error||('Fetch failed with status '+data.status)));}},false);" +
    "function bridge(url,method,headers){var bridgeId='gust'+(++seq);return new Promise(function(resolveBridge,rejectBridge){pending[bridgeId]={resolve:resolveBridge,reject:rejectBridge};window.parent.postMessage({type:" +
    typeFetchReq +
    ",id:bridgeId,url:url,method:method||'GET',headers:headers||{}}," +
    strStar +
    ");setTimeout(function(){if(pending[bridgeId]){delete pending[bridgeId];rejectBridge(new Error('Fetch timed out for '+url));}},30000);});}" +
    "var origFetch=window.fetch.bind(window);window.fetch=function(input,init){var raw=String((input&&input.url)||input||'');var resolved=resolve(raw);if(!resolved||!isHttp(resolved)){return origFetch(input,init);}var reqMethod=(init&&init.method)||'GET';var reqHeaders=(init&&init.headers)||{};return bridge(resolved,reqMethod,reqHeaders);};" +
    "var xhrOpen=XMLHttpRequest.prototype.open;var xhrSend=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.open=function(xhrMethod,xhrUrl){this.gwUrl=resolve(xhrUrl)||xhrUrl;this.gwMethod=xhrMethod;return xhrOpen.apply(this,arguments);};" +
    "XMLHttpRequest.prototype.send=function(){var self=this;var target=String(self.gwUrl||'');if(!target||!isHttp(target)){return xhrSend.apply(this,arguments);}bridge(target,self.gwMethod||'GET',{}).then(function(resp){var status=resp.status||200;return resp.text().then(function(text){try{Object.defineProperty(self,'responseText',{value:text,configurable:true});}catch(firstErr){try{self.responseText=text;}catch(secondErr){}}try{Object.defineProperty(self,'response',{value:text,configurable:true});}catch(thirdErr){}try{Object.defineProperty(self,'status',{value:status,configurable:true});}catch(fourthErr){}try{Object.defineProperty(self,'readyState',{value:4,configurable:true});}catch(fifthErr){}self.dispatchEvent(new Event('readystatechange'));self.dispatchEvent(new Event('load'));self.dispatchEvent(new Event('loadend'));});},function(){self.dispatchEvent(new Event('error'));});};" +
    "var OrigWS=window.WebSocket;window.WebSocket=function(wsUrl){var resolvedWs=resolve(wsUrl)||String(wsUrl||'');window.parent.postMessage({type:" +
    typeBlocked +
    ",kind:'websocket',url:resolvedWs}," +
    strStar +
    ");throw new Error('WebSocket blocked for '+resolvedWs);};if(OrigWS&&OrigWS.prototype){window.WebSocket.prototype=OrigWS.prototype;}" +
    "var OrigWorker=window.Worker;window.Worker=function(workerScript){var workerUrl=resolve(workerScript)||String(workerScript||'');var workerId='w'+(++seq);var queue=[];var stub={postMessage:function(queued){queue.push(queued);},terminate:function(){if(stub.worker){stub.worker.terminate();}},addEventListener:function(){},removeEventListener:function(){}};pending[workerId]={resolve:function(workerResp){workerResp.text().then(function(workerText){var blob=new Blob([workerText],{type:'application/javascript'});var objUrl=URL.createObjectURL(blob);try{stub.worker=new OrigWorker(objUrl);queue.forEach(function(queued){stub.worker.postMessage(queued);});}catch(workerErr){window.parent.postMessage({type:" +
    typeBlocked +
    ",kind:'worker',url:workerUrl}," +
    strStar +
    ");}});},reject:function(){window.parent.postMessage({type:" +
    typeBlocked +
    ",kind:'worker',url:workerUrl}," +
    strStar +
    ");}};window.parent.postMessage({type:" +
    typeFetchReq +
    ",id:workerId,url:workerUrl,method:'GET',headers:{}}," +
    strStar +
    ");return stub;};" +
    "var cookieJar={};try{Object.defineProperty(document,'cookie',{get:function(){return Object.keys(cookieJar).map(function(entry){return entry+'='+cookieJar[entry];}).join('; ');},set:function(cookieVal){var pair=String(cookieVal||'').split(';')[0];var idx=pair.indexOf('=');if(idx>0){cookieJar[pair.slice(0,idx).trim()]=pair.slice(idx+1).trim();}},configurable:true});}catch(cookieErr){}" +
    "function makeStore(){var data={};function namespaced(key){return origin+'::'+String(key);}return{getItem:function(key){var found=data[namespaced(key)];return found===undefined?null:found;},setItem:function(key,val){data[namespaced(key)]=String(val);},removeItem:function(key){delete data[namespaced(key)];},clear:function(){for(var stored in data){if(stored.indexOf(origin+'::')===0){delete data[stored];}}},key:function(pos){var out=[];var all=Object.keys(data);for(var idx=0;idx<all.length;idx++){if(all[idx].indexOf(origin+'::')===0){out.push(all[idx].slice(origin.length+2));}}return out[pos]||null;},get length(){var count=0;for(var tallied in data){if(tallied.indexOf(origin+'::')===0){count++;}}return count;}};}try{Object.defineProperty(window,'localStorage',{value:makeStore(),configurable:true});}catch(localErr){}try{Object.defineProperty(window,'sessionStorage',{value:makeStore(),configurable:true});}catch(sessionErr){}" +
    "document.addEventListener(" +
    evtClick +
    ",function(clickEvt){var anchor=clickEvt.target&&clickEvt.target.closest?clickEvt.target.closest(" +
    selAnchor +
    "):null;if(!anchor){return;}var href=anchor.getAttribute(" +
    attrHref +
    ");if(!href||href.charAt(0)===" +
    strHash +
    "||href.indexOf(" +
    strJs +
    ")===0||href.indexOf(" +
    strMail +
    ")===0){return;}if(anchor.getAttribute(" +
    attrTarget +
    ")){return;}var resolvedHref=resolve(href);if(!resolvedHref){return;}clickEvt.preventDefault();clickEvt.stopPropagation();send(resolvedHref);},true);" +
    "document.addEventListener(" +
    evtAux +
    ",function(auxEvt){if(auxEvt.button!==1){return;}var anchor=auxEvt.target&&auxEvt.target.closest?auxEvt.target.closest(" +
    selAnchor +
    "):null;if(!anchor){return;}var href=anchor.getAttribute(" +
    attrHref +
    ");if(!href||href.charAt(0)===" +
    strHash +
    "||href.indexOf(" +
    strJs +
    ")===0||href.indexOf(" +
    strMail +
    ")===0){return;}if(anchor.getAttribute(" +
    attrTarget +
    ")){return;}if(anchor.hasAttribute&&anchor.hasAttribute(" +
    attrDownload +
    ")){return;}var resolvedSplit=resolve(href);if(!resolvedSplit||!isHttp(resolvedSplit)){return;}auxEvt.preventDefault();auxEvt.stopPropagation();window.parent.postMessage({type:" +
    typeSplit +
    ",url:resolvedSplit}," +
    strStar +
    ");},true);" +
    "document.addEventListener(" +
    evtDown +
    ",function(downEvt){if(downEvt.button!==1){return;}var anchor=downEvt.target&&downEvt.target.closest?downEvt.target.closest(" +
    selAnchor +
    "):null;if(!anchor){return;}var href=anchor.getAttribute(" +
    attrHref +
    ");if(!href||href.charAt(0)===" +
    strHash +
    "||href.indexOf(" +
    strJs +
    ")===0||href.indexOf(" +
    strMail +
    ")===0){return;}if(anchor.getAttribute(" +
    attrTarget +
    ")){return;}if(anchor.hasAttribute&&anchor.hasAttribute(" +
    attrDownload +
    ")){return;}var resolvedSplit=resolve(href);if(!resolvedSplit||!isHttp(resolvedSplit)){return;}downEvt.preventDefault();downEvt.stopPropagation();window.parent.postMessage({type:" +
    typeSplit +
    ",url:resolvedSplit}," +
    strStar +
    ");},true);" +
    "document.addEventListener(" +
    evtSubmit +
    ",function(submitEvt){var form=submitEvt.target;var action=form.getAttribute(" +
    attrAction +
    ")||base;var resolvedAction=resolve(action);if(!resolvedAction){return;}submitEvt.preventDefault();var params=new URLSearchParams(new FormData(form)).toString();var formMethod=String(form.method||" +
    strGet +
    ").toLowerCase();var finalUrl=formMethod===" +
    strPost +
    "?resolvedAction:(resolvedAction+(resolvedAction.indexOf(" +
    strQuery +
    ")>=0?" +
    strAmp +
    ":" +
    strQuery +
    ")+params);send(finalUrl);},true);})();</script>"
  );
}

function isHtmlMime(mime) {
  const clean = String(mime || "").toLowerCase();
  if (!clean) {
    return true;
  }
  return htmlMimePattern.test(clean);
}

function escapeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toAbsoluteUrl(base, ref) {
  const value = String(ref || "").trim();
  if (!value || skipRefPattern.test(value) || httpPattern.test(value)) {
    return null;
  }
  try {
    return new URL(value, base).href;
  } catch (err) {
    return null;
  }
}

function rewriteSubresources(html, base) {
  let out = String(html || "");
  out = out.replace(attrRefPattern, (match, pre, ref, post) => {
    const abs = toAbsoluteUrl(base, ref);
    return abs ? pre + abs + post : match;
  });
  out = out.replace(srcsetPattern, (match, quote, set) => {
    const fixed = String(set)
      .split(",")
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) {
          return part;
        }
        const gap = trimmed.search(/\s/);
        const ref = gap < 0 ? trimmed : trimmed.slice(0, gap);
        const rest = gap < 0 ? "" : trimmed.slice(gap);
        const abs = toAbsoluteUrl(base, ref);
        return abs ? abs + rest : trimmed;
      })
      .join(", ");
    return "srcset=" + quote + fixed + quote;
  });
  return out;
}

function injectBaseAndScript(html, base) {
  const cleanBase = String(base).replace(/"/g, "");
  const baseTag = '<base href="' + cleanBase + '">';
  const script = buildInterceptScript(base, base);
  const source = rewriteSubresources(html, base);
  const headMatch = headPattern.exec(source);
  if (headMatch) {
    const pos = headMatch.index + headMatch[0].length;
    return source.slice(0, pos) + baseTag + script + source.slice(pos);
  }
  return baseTag + script + source;
}

function buildDocumentHtml(base, bodyText, mime) {
  if (isHtmlMime(mime)) {
    return injectBaseAndScript(bodyText, base);
  }
  const cleanBase = String(base).replace(/"/g, "");
  const baseTag = '<base href="' + cleanBase + '">';
  const script = buildInterceptScript(base, base);
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    baseTag +
    script +
    "</head><body><pre>" +
    escapeText(bodyText) +
    "</pre></body></html>"
  );
}

function buildLoadingHtml(current) {
  const theme = readOsTheme();
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;background:' +
    theme.bg +
    ";color:" +
    theme.text +
    ";font-size:14px;}</style></head><body><div>Loading " +
    escapeText(current) +
    "</div></body></html>"
  );
}

function buildErrorHtml(current, message) {
  const theme = readOsTheme();
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;color:' +
    theme.text +
    ";font-family:system-ui,-apple-system,sans-serif}.offline{width:100%;max-width:640px;padding:20px;text-align:center}.dino{border:1px solid " +
    theme.border +
    ";border-radius:12px;overflow:hidden;background:" +
    theme.surface +
    "}.dino-frame{display:block;width:100%;height:210px;border:0}.offline-msg{font-size:20px;font-weight:500;margin-top:20px;text-align:left}.offline-try{font-size:14px;color:" +
    theme.textMuted +
    ";margin-top:14px;text-align:left;margin-left:auto;margin-right:auto}.offline-try ul{list-style:disc;padding-left:20px;margin:6px 0 0}.offline-try li{margin-top:4px}.offline-code{font-family:ui-monospace,monospace;font-size:13px;color:" +
    theme.textMuted +
    ";margin-top:16px;text-align:left}.offline-url{font-size:13px;color:" +
    theme.textMuted +
    ';word-break:break-all;margin-top:10px;text-align:left}</style></head><body><div class="offline"><div class="dino"><iframe class="dino-frame" srcdoc=\'' +
    escapeDinoGameAttr() +
    '\' title="T-Rex Runner" loading="lazy"></iframe></div><div class="offline-msg">There is no Internet connection.</div><div class="offline-try">Try:<ul><li>Checking the network cables, modem and router</li><li>Reconnecting to Wi-Fi</li></ul></div><div class="offline-code">' +
    escapeText(message || "ERR_CONNECTION_REFUSED") +
    '</div><div class="offline-url">' +
    escapeText(current) +
    "</div></div></body></html>"
  );
}

function recordHistory(url, title) {
  try {
    const list = os.storage.get(StorageKeys.browserHistory) || [];
    const filtered = Array.isArray(list)
      ? list.filter((item) => (item && item.url ? item.url : item) !== url)
      : [];
    const next = [{ url, title: title || url, time: Date.now() }]
      .concat(filtered)
      .slice(0, 500);
    os.storage.set(StorageKeys.browserHistory, next);
  } catch (err) {
    return;
  }
}

function syncAddressInput(root, url) {
  const field = $(".file-protocol-address", root);
  if (field) {
    field.value = url;
  }
}

function styleShell(node) {
  setStyle(node, {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    overflow: "hidden",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
  });
}

function createViewport(appId) {
  const frame = createElement("iframe", {
    className: "file-protocol-viewport",
    attributes: {
      sandbox: "allow-scripts allow-forms allow-same-origin allow-popups",
      title: appId || "web view",
    },
  });
  setStyle(frame, {
    flex: "1",
    width: "100%",
    minHeight: "0",
    border: "none",
    background: "var(--bg-primary)",
  });
  return frame;
}

async function handleBridgeFetch(viewport, data, wispUrl) {
  const reply = (payload) => {
    try {
      viewport.contentWindow.postMessage(payload, "*");
    } catch (err) {
      return;
    }
  };
  try {
    const raw = await fetchRaw(data.url, {
      wispUrl,
      method: data.method,
      headers: data.headers,
    });
    let text = "";
    try {
      text = new TextDecoder().decode(raw.buffer);
    } catch (decodeErr) {
      text = "";
    }
    reply({
      type: "browser-fetch-response",
      id: data.id,
      ok: true,
      status: raw.status,
      text,
      contentType: raw.contentType,
    });
  } catch (err) {
    reply({
      type: "browser-fetch-response",
      id: data.id,
      ok: false,
      status: 0,
      text: "",
      contentType: "text/plain",
      error: err && err.message ? err.message : String(err),
    });
  }
}

export async function fetchRangeAsBlob(url, start, end, opts = {}) {
  const target = String(url || "").trim();
  if (!target) {
    throw new Error("A URL is required");
  }
  const headers = Object.assign({}, opts.headers || {});
  if (start !== undefined && start !== null) {
    headers.Range =
      "bytes=" + start + "-" + (end !== undefined && end !== null ? end : "");
  }
  return fetchPage(target, {
    wispUrl: opts.wispUrl || getWispUrl(),
    headers,
    method: opts.method || "GET",
  });
}

export async function renderFileProtocolUrl(viewportIframe, url, opts = {}) {
  const normalized = normalizeEngineUrl(url);
  if (!normalized) {
    throw new Error("A URL is required");
  }
  let bypassHost = "";
  try {
    bypassHost = new URL(normalized).hostname.toLowerCase();
  } catch (bypassErr) {
    bypassHost = "";
  }
  if (
    bypassHost &&
    directLoadDomains.some(
      (domain) => bypassHost === domain || bypassHost.endsWith("." + domain),
    )
  ) {
    viewportIframe.removeAttribute("srcdoc");
    viewportIframe.src = normalized;
    return { handled: true, url: normalized, title: normalized };
  }
  const local = parseLocalTarget(normalized);
  if (local && (local.kind === "fs" || local.kind === "port")) {
    return { handled: false, url: normalized, local };
  }
  if (!/^https?:\/\//i.test(normalized)) {
    return { handled: false, url: normalized };
  }
  const wispUrl = opts.wispUrl || getWispUrl();
  viewportIframe.srcdoc = buildLoadingHtml(normalized);
  try {
    const result = await fetchPage(normalized, {
      wispUrl,
      method: opts.method,
      headers: opts.headers,
      range: opts.range,
    });
    recordHistory(normalized, result.title);
    const mime = result.contentType || getMimeType(normalized);
    if (result.blobUrl) {
      viewportIframe.removeAttribute("srcdoc");
      viewportIframe.src = result.blobUrl;
      return {
        handled: true,
        url: normalized,
        status: result.status,
        title: result.title,
        contentType: mime,
      };
    }
    const finalHtml = buildDocumentHtml(normalized, result.text || "", mime);
    viewportIframe.src = "about:blank";
    viewportIframe.srcdoc = finalHtml;
    return {
      handled: true,
      url: normalized,
      status: result.status,
      title: result.title,
      contentType: mime,
    };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    viewportIframe.srcdoc = buildErrorHtml(normalized, message);
    return { handled: true, url: normalized, error: message };
  }
}

export async function mountFileProtocolView(container, opts = {}) {
  const targetUrl = opts.targetUrl || "https://search.brave.com/";
  const appId = opts.appId || "file-protocol";
  const showChrome = opts.showChrome !== false;
  container.replaceChildren();
  styleShell(container);
  const root = createElement("div", { className: "file-protocol-root" });
  styleShell(root);
  container.appendChild(root);
  const wispUrl = getWispUrl();
  const viewport = createViewport(appId);
  async function navigate(raw) {
    const result = await renderFileProtocolUrl(viewport, raw, {
      appId,
      wispUrl,
    });
    if (result && result.url) {
      syncAddressInput(root, result.url);
    }
    return result;
  }
  if (showChrome === false) {
    root.appendChild(viewport);
    navigate(targetUrl).catch(() => {});
    return { root, viewport, navigate, addressInput: null };
  }
  const chrome = createElement("div", { className: "file-protocol-chrome" });
  setStyle(chrome, {
    display: "flex",
    gap: "8px",
    padding: "8px",
    alignItems: "center",
    background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--glass-border)",
  });
  const addressInput = createElement("input", {
    className: "file-protocol-address",
    attributes: {
      type: "text",
      value: targetUrl,
      placeholder: "Search or enter address",
      spellcheck: "false",
    },
  });
  setStyle(addressInput, {
    flex: "1",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    border: "1px solid var(--glass-border)",
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "13px",
    outline: "none",
  });
  const goButton = createElement("button", {
    className: "file-protocol-go",
    text: "Go",
  });
  setStyle(goButton, {
    background: "var(--brand)",
    color: "var(--text-primary)",
    border: "1px solid var(--glass-border)",
    borderRadius: "8px",
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: "13px",
  });
  chrome.appendChild(addressInput);
  chrome.appendChild(goButton);
  root.appendChild(chrome);
  root.appendChild(viewport);
  bindEvent(goButton, "click", () => {
    navigate(addressInput.value).catch(() => {});
  });
  bindEvent(addressInput, "keydown", (event) => {
    if (event.key === "Enter") {
      navigate(addressInput.value).catch(() => {});
    }
  });
  bindEvent(window, "message", (event) => {
    const data = event.data;
    if (!data) {
      return;
    }
    if (
      data.type === "browser-navigate" ||
      data.type === "scram-local-nav" ||
      data.type === "browser-open"
    ) {
      navigate(data.url).catch(() => {});
    }
    if (data.type === "browser-fetch-request") {
      handleBridgeFetch(viewport, data, wispUrl).catch(() => {});
    }
  });
  navigate(targetUrl).catch(() => {});
  return { root, viewport, addressInput, navigate };
}
