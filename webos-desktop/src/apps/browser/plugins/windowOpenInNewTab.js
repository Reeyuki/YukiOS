import { StorageKeys } from "../../../StorageKeys.js";

export const PLUGIN_ID = "windowOpenInNewTab";
export const PLUGIN_NAME = "Open window.open in New Tab";
export const STORAGE_KEY = StorageKeys.browserWindowOpenInNewTab;

export function isPluginEnabled(storage) {
  const raw = storage.get(STORAGE_KEY);
  if (raw === null || raw === undefined) return true;
  if (typeof raw === "string") return raw !== "false";
  return Boolean(raw);
}

export function setPluginEnabled(storage, enabled) {
  storage.set(STORAGE_KEY, enabled ? "true" : "false");
}

export function buildWindowOpenInterceptorScript() {
  return `(function(){
  var FLAG_KEY="scramjet_windowopen_newtab";
  function isEnabled(){
    try{
      var v=localStorage.getItem(FLAG_KEY);
      if(v===null) return true;
      return v!=="false";
    }catch(e){return true;}
  }
  window.__yukiWindowOpenInterceptEnabled=isEnabled();
  window.addEventListener("storage",function(e){
    if(e.key===FLAG_KEY) window.__yukiWindowOpenInterceptEnabled=e.newValue!=="false";
  });
  window.__yukiSetWindowOpenIntercept=function(v){
    try{localStorage.setItem(FLAG_KEY,v?"true":"false");}catch(e){}
    window.__yukiWindowOpenInterceptEnabled=!!v;
    try{localStorage.setItem("scramjet_tab_state","");}catch(e){}
    var ev=new CustomEvent("yuki:windowOpenInterceptChanged",{detail:{enabled:!!v}});
    window.dispatchEvent(ev);
  };
  function createFakeWindow(tabId){
    var f={closed:false,__yukiTabId:tabId,focus:function(){try{window.switchTab&&window.switchTab(tabId);}catch(e){}},close:function(){try{window.closeTab&&window.closeTab(tabId);}catch(e){}},closed:false};
    try{
      Object.defineProperty(f,"location",{get:function(){try{var t=window.tabs&&window.tabs.find(function(x){return x.id===tabId;});return t&&t.frame&&t.frame.element&&t.frame.element.contentWindow&&t.frame.element.contentWindow.location||{href:"about:blank"};}catch(e){return{href:"about:blank"};}},set:function(v){try{var t=window.tabs&&window.tabs.find(function(x){return x.id===tabId;});if(t&&t.frame) t.frame.go(String(v));}catch(e){}}});
    }catch(e){}
    return f;
  }
  function patchWindow(win,tabRef){
    if(!win) return;
    try{
      var current=win.open;
      if(!current) return;
      if(current.__yukiIsHandler) return;
      var orig=current;
      var handler=function(url,name,specs){
        try{
          var enabled=window.__yukiWindowOpenInterceptEnabled;
          if(enabled===undefined) enabled=isEnabled();
          if(!enabled) return orig.apply(this,arguments);
          if(name==="_self"||name==="_parent"||name==="_top"){
            if(url){try{window.handleSubmit&&window.handleSubmit(String(url));}catch(e){try{tabRef&&tabRef.frame&&tabRef.frame.go(String(url));}catch(e2){}}}
            return win;
          }
          var raw=url!=null?String(url):"";
          var resolved=raw.trim();
          if(resolved && !/^(about|javascript|data|blob|mailto):/i.test(resolved)){
            try{
              var baseForResolve=(tabRef&&tabRef.url&&!tabRef.url.startsWith("yuki://")&&!tabRef.url.includes("NT.html"))?tabRef.url:(win.location?win.location.href:location.href);
              resolved=new URL(resolved,baseForResolve).href;
            }catch(e){ resolved=raw; }
          }
          if(!resolved||resolved==="about:blank"||resolved===""||resolved.startsWith("javascript:")){
            var nt=window.createTab?window.createTab(true):null;
            if(nt){
              try{var cw=nt.frame.element.contentWindow;if(cw) return cw;}catch(e){}
              var fakeBlank=createFakeWindow(nt.id);
              try{
                Object.defineProperty(fakeBlank,"document",{get:function(){ try{return nt.frame.element.contentWindow.document;}catch(e){return null;}},configurable:true});
              }catch(e){}
              return fakeBlank;
            }
            return orig.apply(this,arguments);
          }
          var nt2=window.createTab?window.createTab(true,{url:resolved}):null;
          setTimeout(function(){
            try{
              if(nt2&&nt2.frame&&nt2.frame.go){
                var cur=""; try{cur=nt2.frame.element.contentWindow.location.href;}catch(e){}
                if(!cur||cur==="about:blank"||cur.includes("NT.html")||nt2.url==="yuki://home"){
                  nt2.frame.go(resolved);
                }
              }
            }catch(e){ try{window.handleSubmit&&window.handleSubmit(resolved);}catch(e2){} }
          },60);
          if(nt2){
            try{var cw2=nt2.frame.element.contentWindow;if(cw2) return cw2;}catch(e){}
            var fake=createFakeWindow(nt2.id);
            try{
              Object.defineProperty(fake,"location",{get:function(){ try{return nt2.frame.element.contentWindow.location;}catch(e){return{href:resolved};}},set:function(v){ try{var u=String(v); try{u=new URL(u,nt2.url||location.href).href;}catch(e){} nt2.frame.go(u);}catch(e){ try{window.handleSubmit&&window.handleSubmit(String(v));}catch(e2){} }},configurable:true});
            }catch(e){}
            return fake;
          }
          return orig.apply(this,arguments);
        }catch(e){
          try{return orig.apply(this,arguments);}catch(e2){return null;}
        }
      };
      handler.__yukiIsHandler=true;
      handler.__yukiOriginal=orig;
      win.__yukiOriginalOpen=orig;
      win.__yukiWindowOpenPatched=true;
      try{win.open=handler;}catch(e){}
      try{
        if(win.Window&&win.Window.prototype){
          var proto=win.Window.prototype;
          if(proto.open&&!proto.open.__yukiIsHandler) try{proto.open=handler;}catch(e){}
        }
      }catch(e){}
      try{
        var desc=Object.getOwnPropertyDescriptor(win,"open");
        if(desc&&desc.configurable) try{Object.defineProperty(win,"open",{value:handler,writable:true,configurable:true});}catch(e){}
      }catch(e){}
    }catch(e){}
  }
  function patchAllSubframes(win,tabRef){
    try{
      for(var i=0;i<win.frames.length;i++){
        try{ var f=win.frames[i]; patchWindow(f,tabRef); patchAllSubframes(f,tabRef);}catch(e){}
      }
    }catch(e){}
    try{
      var docs=win.document?win.document.querySelectorAll("iframe"):[];
      for(var j=0;j<docs.length;j++){
        try{ var w=docs[j].contentWindow; if(w){ patchWindow(w,tabRef); patchAllSubframes(w,tabRef);} }catch(e){}
      }
    }catch(e){}
  }
  window.__yukiPatchWindowForOpen=patchWindow;
  window.patchAllSubframes=patchAllSubframes;
  window.__yukiInstallWindowOpenInterceptor=function(tab){
    try{
      if(!tab||!tab.frame||!tab.frame.element) return;
      var cw=tab.frame.element.contentWindow;
      if(!cw) return;
      var attempts=0;
      var tryPatch=function(){ try{patchWindow(cw,tab);}catch(e){} try{patchAllSubframes(cw,tab);}catch(e){} try{patchWindow(window,null);}catch(e){} };
      tryPatch();
      var iv=setInterval(function(){ tryPatch(); attempts++; if(attempts>60) clearInterval(iv); },100);
      setTimeout(function(){ try{clearInterval(iv);}catch(e){} },6500);
      try{
        var doc=cw.document;
        if(doc){
          var obs=new MutationObserver(function(){ tryPatch(); });
          obs.observe(doc,{childList:true,subtree:true});
          tab._yukiOpenObs=obs;
        }
      }catch(e){}
      try{ cw.addEventListener&&cw.addEventListener("load",tryPatch);}catch(e){}
    }catch(e){}
  };
  try{ patchWindow(window,null);}catch(e){}
})();`;
}

export class WindowOpenInNewTabPlugin {
  constructor(storage, notify) {
    this.storage = storage;
    this.notify = notify;
  }

  isEnabled() {
    return isPluginEnabled(this.storage);
  }

  setEnabled(enabled) {
    setPluginEnabled(this.storage, enabled);
    if (this.notify) {
      try {
        this.notify(enabled);
      } catch {}
    }
  }

  toggle() {
    const next = !this.isEnabled();
    this.setEnabled(next);
    return next;
  }

  getInterceptorScript() {
    return buildWindowOpenInterceptorScript();
  }

  getStatus() {
    return { id: PLUGIN_ID, name: PLUGIN_NAME, enabled: this.isEnabled() };
  }
}
