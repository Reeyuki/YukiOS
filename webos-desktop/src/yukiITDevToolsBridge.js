export const YUKI_DEV_TOOLS_URL = "https://it-tools.tech/";

const BRIDGE_STYLE_ID = "yuki-css-bridge-style";
const BRIDGE_CSS = `
:root {
  color-scheme: dark;
  --background: var(--bg-primary) !important;
  --foreground: var(--text-primary) !important;
  --surface: var(--bg-secondary) !important;
  --accent: var(--brand) !important;
  --muted: var(--text-secondary) !important;
}

html[data-theme="light"] {
  color-scheme: light;
}

html, body {
  background: var(--bg-primary) !important;
  color: var(--text-primary) !important;
  font-family: var(--font-ui) !important;
}

body {
  margin: 0 !important;
  min-height: 100vh;
}

html,
body,
body *,
body *::before,
body *::after {
  color: var(--text-brand) !important;
  border-color: var(--glass-border) !important;
  caret-color: var(--brand) !important;
}


body div,
body section,
body article,
body main,
body nav,
body header,
body footer,
body aside,
body span,
body p,
body label,
body li,
body ul,
body ol,
body fieldset,
body legend,
body form,
body details,
body summary,
body table,
body thead,
body tbody,
body tr,
body td,
body th,
body code,
body pre,
body blockquote,
body small,
body strong,
body em {
  background-color: var(--bg-primary) !important;
  color: var(--text-primary) !important;
}

body button,
body input,
body select,
body textarea,
body [role="button"],
body [type="button"],
body [type="submit"],
body [type="reset"],
body [tabindex] {
  background-color: var(--surface-1) !important;
  color: var(--text-primary) !important;
  border-color: var(--glass-border) !important;
  box-shadow: inset 0 1px 0 oklch(100% 0 0 / 0.08) !important;
}

body a,
body a:visited,
body [href] {
  color: var(--brand) !important;
}

body button *,
body input *,
body select *,
body textarea *,
body [role="button"] *,
body [type="button"] *,
body [type="submit"] *,
body [type="reset"] * {
  color: inherit !important;
  background-color: transparent !important;
}

body svg,
body svg * {
  fill: currentColor !important;
  stroke: currentColor !important;
}

button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}

a {
  color: var(--brand) !important;
}

::selection {
  background: var(--brand-dim);
  color: var(--text-primary);
}

*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

*::-webkit-scrollbar-thumb {
  background: oklch(100% 0 0 / 0.12);
  border-radius: 999px;
}
`;

function buildBridgeScript() {
  return `
(function() {
  const STYLE_ID = ${JSON.stringify(BRIDGE_STYLE_ID)};
  const BRIDGE_CSS = ${JSON.stringify(BRIDGE_CSS)};

  function buildThemeCss(parentRoot) {
    const parentStyles = getComputedStyle(parentRoot);
    const vars = [];

    for (let i = 0; i < parentStyles.length; i += 1) {
      const name = parentStyles[i];
      if (!name.startsWith("--")) continue;
      const value = parentStyles.getPropertyValue(name).trim();
      if (!value) continue;
      vars.push(name + ":" + value + ";");
    }

    return ":root{" + vars.join("") + "}\\n" + BRIDGE_CSS;
  }

  function ensureStyle() {
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(styleEl);
    }
    return styleEl;
  }

  function syncFromParent() {
    try {
      const parentDoc = window.parent && window.parent.document;
      if (!parentDoc || !parentDoc.documentElement) return;

      const parentRoot = parentDoc.documentElement;
      const styleEl = ensureStyle();
      styleEl.textContent = buildThemeCss(parentRoot);

      const theme = parentRoot.getAttribute("data-theme");
      if (theme) {
        document.documentElement.setAttribute("data-theme", theme);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    } catch (err) {}
  }

  function watchParent() {
    try {
      const parentDoc = window.parent && window.parent.document;
      if (!parentDoc || !parentDoc.documentElement) return;

      const observer = new MutationObserver(syncFromParent);
      observer.observe(parentDoc.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class", "style"]
      });

      window.addEventListener("unload", () => observer.disconnect(), { once: true });
    } catch (err) {}
  }

  function patchHistoryApi() {
    try {
      const sanitizeUrl = (url) => {
        if (typeof url !== "string") return url;
        if (url.startsWith("blob:")) return undefined;
        return url;
      };

      const originalReplaceState = history.replaceState.bind(history);
      const originalPushState = history.pushState.bind(history);

      history.replaceState = function(state, title, url) {
        const safeUrl = sanitizeUrl(url);
        return safeUrl === undefined ? originalReplaceState(state, title) : originalReplaceState(state, title, safeUrl);
      };

      history.pushState = function(state, title, url) {
        const safeUrl = sanitizeUrl(url);
        return safeUrl === undefined ? originalPushState(state, title) : originalPushState(state, title, safeUrl);
      };
    } catch (err) {}
  }

  window.addEventListener("message", (event) => {
    if (!event || !event.data || event.data.__yukiCssBridge !== "sync") return;
    syncFromParent();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncFromParent, { once: true });
  } else {
    syncFromParent();
  }

  watchParent();
  patchHistoryApi();
  setTimeout(()=> {
    const homeButton = document.querySelector('a[aria-label="Home"]');
    if (homeButton) {
        homeButton.click();
    }
  }, 500)
})();
`;
}

function stripContentSecurityPolicy(html) {
  return html.replace(/<meta\b[^>]*http-equiv\s*=\s*(["'])content-security-policy\1[^>]*>\s*/gi, "");
}

function injectBridgeIntoHtml(html, baseHref) {
  const sanitizedHtml = stripContentSecurityPolicy(html);
  const baseTag = baseHref ? `<base href="${baseHref}">` : "";
  const bridgeScript = `<script>${buildBridgeScript()}<\/script>`;
  const injected = `${baseTag}\n${bridgeScript}`;

  if (/<head\b[^>]*>/i.test(sanitizedHtml)) {
    return sanitizedHtml.replace(/<head\b[^>]*>/i, (match) => `${match}\n${injected}`);
  }

  return `${injected}\n${sanitizedHtml}`;
}

export async function yukiITDevToolsBridge(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);

  const html = await response.text();
  const baseHref = new URL(".", url).href;
  const bridgedHtml = injectBridgeIntoHtml(html, baseHref);
  return URL.createObjectURL(new Blob([bridgedHtml], { type: "text/html" }));
}
