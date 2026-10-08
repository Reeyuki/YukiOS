import "../../styles/browserNative.css";
import { os, StorageKeys } from "../../framework.js";
import {
  $,
  $$,
  createElement,
  bindEvent,
  setStyle,
  setHTML,
} from "../../shared/domUtils.js";
import { KeybindManager } from "../../keybindManager.js";
import { getWispUrl } from "../../shared/wispConfig.js";
import { createTabsStore } from "./browserTabs.js";
import { showTabMenu, showClosedTabsMenu } from "./browserTabMenu.js";
import {
  bindBrowserAdClose,
  disableBrowserAds,
  enableBrowserAds,
} from "./browserAds.js";
import { shouldEnableAds } from "../../ads.js";
const FALLBACK_HOME = "yuki://home";
const FALLBACK_APP_ID = "browserApp";
const TAB_SOUND_ICON =
  "https://cdn.jsdelivr.net/gh/PapirusDevelopmentTeam/papirus-icon-theme@master/Papirus/32x32/status/audio-volume-high.svg";
const TAB_MUTED_ICON =
  "https://cdn.jsdelivr.net/gh/PapirusDevelopmentTeam/papirus-icon-theme@master/Papirus/32x32/status/audio-volume-muted.svg";
function makeId(base, suffix) {
  return base + "-" + suffix;
}
function buildIcon(iconClass) {
  return createElement("i", { className: iconClass });
}
function buildChromeButton(
  className,
  idValue,
  tooltip,
  iconClass,
  actionId,
  fireAction,
) {
  const btn = createElement("button", {
    className: className,
    id: idValue,
    attributes: { "data-tooltip": tooltip, "data-action": actionId },
  });
  btn.appendChild(buildIcon(iconClass));
  bindEvent(btn, "click", () => {
    fireAction(actionId);
  });
  return btn;
}
function buildDropdownItem(suffix, action, tooltip, iconClass, label, badgeId) {
  const item = createElement("div", {
    className: "browser-dropdown-item",
    attributes: { "data-action": action, "data-tooltip": tooltip },
  });
  item.appendChild(buildIcon("fa-solid " + iconClass + " di-icon"));
  const labelEl = createElement("span", { className: "di-label", text: label });
  item.appendChild(labelEl);
  if (badgeId) {
    const badge = createElement("span", {
      className: "di-badge",
      id: makeId(badgeId, suffix),
      attributes: { style: "display:none;" },
    });
    item.appendChild(badge);
  }
  return item;
}
function buildSidebar(suffix, fireAction, els) {
  const sidebar = createElement("div", {
    className: "tab-sidebar",
    id: makeId("tab-sidebar", suffix),
  });
  const sidebarHeader = createElement("div", { className: "sidebar-header" });
  const brandIcon = createElement("img", {
    className: "sidebar-brand-icon",
    attributes: {
      src: "https://cdn.jsdelivr.net/gh/NaoTomori1/YukiOS@main/static/icons/logo.png",
      alt: "Yuki Browser",
    },
  });
  sidebarHeader.appendChild(brandIcon);
  const sidebarTitle = createElement("span", {
    className: "sidebar-title",
    text: "Yuki Browser",
  });
  sidebarHeader.appendChild(sidebarTitle);
  const headerActions = createElement("div", {
    className: "sidebar-header-actions",
  });
  const collapseBtn = createElement("button", {
    className: "sidebar-action-btn",
    id: makeId("sidebar-collapse-btn", suffix),
    attributes: {
      "data-tooltip": "Collapse sidebar to icons",
      "data-action": "collapse-sidebar",
    },
  });
  collapseBtn.appendChild(buildIcon("fa-solid fa-chevron-left"));
  bindEvent(collapseBtn, "click", () => {
    fireAction("collapse-sidebar");
  });
  headerActions.appendChild(collapseBtn);
  const newTabBtn = createElement("button", {
    className: "sidebar-action-btn",
    id: makeId("newTabBtn", suffix),
    attributes: {
      "data-tooltip": "Open a new blank tab",
      "data-action": "new-tab",
    },
  });
  newTabBtn.appendChild(buildIcon("fa-solid fa-plus"));
  bindEvent(newTabBtn, "click", () => {
    fireAction("new-tab");
  });
  headerActions.appendChild(newTabBtn);
  sidebarHeader.appendChild(headerActions);
  sidebar.appendChild(sidebarHeader);
  const tabStrip = createElement("div", {
    id: makeId("tab-strip", suffix),
    attributes: { "data-scroll-nav": "true" },
  });
  const navGroup = createElement("div", { className: "nav-btn-group" });
  const backBtn = buildChromeButton(
    "nav-back-btn",
    makeId("back-btn", suffix),
    "Go back to the previous page",
    "fa-solid fa-chevron-left",
    "back",
    fireAction,
  );
  const fwdBtn = buildChromeButton(
    "nav-fwd-btn",
    makeId("fwd-btn", suffix),
    "Go forward to the next page",
    "fa-solid fa-chevron-right",
    "forward",
    fireAction,
  );
  const reloadBtn = buildChromeButton(
    "nav-reload-btn",
    makeId("reload-btn", suffix),
    "Reload the current page",
    "fa-solid fa-rotate-right",
    "reload",
    fireAction,
  );
  navGroup.appendChild(backBtn);
  navGroup.appendChild(fwdBtn);
  navGroup.appendChild(reloadBtn);
  tabStrip.appendChild(navGroup);
  const resizer = createElement("div", {
    className: "sidebar-resizer",
    id: makeId("sidebar-resizer", suffix),
    attributes: { "data-tooltip": "Drag to resize sidebar" },
  });
  tabStrip.appendChild(resizer);
  sidebar.appendChild(tabStrip);
  els.sidebar = sidebar;
  els.tabStrip = tabStrip;
  els.navGroup = navGroup;
  els.backBtn = backBtn;
  els.fwdBtn = fwdBtn;
  els.reloadBtn = reloadBtn;
  els.sidebarResizer = resizer;
  els.collapseBtn = collapseBtn;
  els.newTabBtn = newTabBtn;
  return sidebar;
}
function buildDropdown(suffix, fireAction, els) {
  const wrapper = createElement("div", { className: "main-menu-wrapper" });
  const menuBtn = createElement("button", {
    id: makeId("main-menu-btn", suffix),
    attributes: {
      "data-tooltip":
        "Open the main browser menu with tabs, tools, and data options",
      "data-action": "main-menu",
    },
  });
  menuBtn.appendChild(buildIcon("fa-solid fa-ellipsis"));
  bindEvent(menuBtn, "click", () => {
    fireAction("main-menu");
    const dd = els.dropdown;
    if (dd) {
      const isOpen = dd.classList.contains("open");
      if (isOpen) {
        dd.classList.remove("open");
      } else {
        dd.classList.add("open");
      }
    }
  });
  wrapper.appendChild(menuBtn);
  const dropdown = createElement("div", {
    className: "browser-dropdown",
    id: makeId("browser-dropdown", suffix),
  });
  const sectionOne = createElement("div", {
    className: "browser-dropdown-section",
  });
  sectionOne.appendChild(
    buildDropdownItem(
      suffix,
      "new-tab",
      "Open a new blank tab",
      "fa-plus",
      "New Tab",
      null,
    ),
  );
  sectionOne.appendChild(
    buildDropdownItem(
      suffix,
      "new-window",
      "Open a new browser window with its own session",
      "fa-window-maximize",
      "New Window",
      null,
    ),
  );
  sectionOne.appendChild(
    buildDropdownItem(
      suffix,
      "new-private-window",
      "Open a private window that does not save history",
      "fa-user-secret",
      "New Private Window",
      null,
    ),
  );
  dropdown.appendChild(sectionOne);
  const sectionTwo = createElement("div", {
    className: "browser-dropdown-section",
  });
  sectionTwo.appendChild(
    buildDropdownItem(
      suffix,
      "downloads",
      "View files you have downloaded",
      "fa-download",
      "Downloads",
      "menu-dl-badge",
    ),
  );
  sectionTwo.appendChild(
    buildDropdownItem(
      suffix,
      "history",
      "View pages you have visited recently",
      "fa-clock-rotate-left",
      "History",
      null,
    ),
  );
  sectionTwo.appendChild(
    buildDropdownItem(
      suffix,
      "bookmarks",
      "View and manage your saved bookmarks",
      "fa-star",
      "Bookmarks",
      null,
    ),
  );
  dropdown.appendChild(sectionTwo);
  const sectionThree = createElement("div", {
    className: "browser-dropdown-section",
  });
  const toggleItem = buildDropdownItem(
    suffix,
    "toggle-bookmarkbar",
    "Show or hide the bookmark bar below the address bar",
    "fa-check",
    "Show Bookmark Bar",
    null,
  );
  sectionThree.appendChild(toggleItem);
  sectionThree.appendChild(
    buildDropdownItem(
      suffix,
      "reopen-tab",
      "View and reopen recently closed tabs",
      "fa-undo",
      "Reopen Closed Tab",
      "menu-rt-badge",
    ),
  );
  dropdown.appendChild(sectionThree);
  const sectionFour = createElement("div", {
    className: "browser-dropdown-section",
  });
  sectionFour.appendChild(
    buildDropdownItem(
      suffix,
      "save-page",
      "Bookmark the current page and save it to downloads",
      "fa-bookmark",
      "Save Page",
      null,
    ),
  );
  sectionFour.appendChild(
    buildDropdownItem(
      suffix,
      "screenshot",
      "Take a screenshot of the current page or panel",
      "fa-camera",
      "Screenshot",
      null,
    ),
  );
  sectionFour.appendChild(
    buildDropdownItem(
      suffix,
      "devtools",
      "Open developer tools (Eruda) for the current page",
      "fa-code",
      "DevTools",
      null,
    ),
  );
  sectionFour.appendChild(
    buildDropdownItem(
      suffix,
      "google-lens",
      "Open Google Lens to search by image",
      "fa-images",
      "Search With Google Lens",
      null,
    ),
  );
  dropdown.appendChild(sectionFour);
  const sectionFive = createElement("div", {
    className: "browser-dropdown-section",
  });
  sectionFive.appendChild(
    buildDropdownItem(
      suffix,
      "clear-data",
      "Delete all browsing history, downloads, and bookmarks",
      "fa-trash-can",
      "Delete Browsing Data",
      null,
    ),
  );
  dropdown.appendChild(sectionFive);
  const items = $$(".browser-dropdown-item", dropdown);
  Array.from(items).forEach((item) => {
    bindEvent(item, "click", () => {
      const action = item.getAttribute("data-action");
      if (action) {
        fireAction(action);
      }
      dropdown.classList.remove("open");
    });
  });
  wrapper.appendChild(dropdown);
  els.mainMenuBtn = menuBtn;
  els.dropdown = dropdown;
  return wrapper;
}
function buildNavRow(suffix, initialUrl, fireAction, els) {
  const tabsContainer = createElement("div", {
    className: "flex tabs browser-tabbar",
    id: makeId("tabs-container", suffix),
    attributes: {
      style: "display:flex;align-items:center;cursor: move;",
      "data-scroll-nav": "true",
    },
  });
  const controlsSlot = createElement("div", {
    id: makeId("controls-slot", suffix),
    attributes: { style: "display:flex;align-items:center;flex-shrink:0;" },
  });
  const windowControls = createElement("div", { className: "window-controls" });
  const minBtn = createElement("button", {
    className: "minimize-btn",
    attributes: { title: "Minimize", "data-action": "minimize" },
  });
  setHTML(minBtn, '<svg viewBox="0 0 10 1"><path d="M0 0h10v1H0z"/></svg>');
  bindEvent(minBtn, "click", () => {
    fireAction("minimize");
  });
  const maxBtn = createElement("button", {
    className: "maximize-btn",
    attributes: { title: "Maximize", "data-action": "maximize" },
  });
  setHTML(
    maxBtn,
    '<svg viewBox="0 0 10 10"><path d="M0 0v10h10V0H0zm1 1h8v8H1V1z"/></svg>',
  );
  bindEvent(maxBtn, "click", () => {
    fireAction("maximize");
  });
  const closeBtn = createElement("button", {
    className: "close-btn",
    attributes: { title: "Close", "data-action": "close" },
  });
  setHTML(
    closeBtn,
    '<svg viewBox="0 0 10 10"><path d="M10.2.7L9.5 0 5.1 4.4.7 0 0 .7l4.4 4.4L0 9.5l.7.7 4.4-4.4 4.4 4.4.7-.7-4.4-4.4z"/></svg>',
  );
  bindEvent(closeBtn, "click", () => {
    fireAction("close");
  });
  windowControls.appendChild(minBtn);
  windowControls.appendChild(maxBtn);
  windowControls.appendChild(closeBtn);
  controlsSlot.appendChild(windowControls);
  els.minBtn = minBtn;
  els.maxBtn = maxBtn;
  els.closeBtn = closeBtn;
  els.windowControls = windowControls;
  tabsContainer.appendChild(controlsSlot);
  const nav = createElement("div", { className: "flex nav" });
  const addressWrapper = createElement("div", { className: "address-wrapper" });
  const lockIcon = createElement("i", {
    className: "fa-solid fa-lock address-icon",
    attributes: { "data-tooltip": "View connection details" },
  });
  bindEvent(lockIcon, "click", (event) => {
    event.stopPropagation();
    fireAction("connection-info");
  });
  addressWrapper.appendChild(lockIcon);
  const addressInput = createElement("input", {
    className: "bar",
    id: makeId("address-bar", suffix),
    attributes: {
      autocomplete: "off",
      spellcheck: "false",
      placeholder: "Search or enter a URL",
      "data-tooltip":
        "Type a URL or search query. Use Enter to navigate, Ctrl+L to focus.",
      value: initialUrl,
    },
  });
  addressInput.value = initialUrl;
  addressWrapper.appendChild(addressInput);
  const starBtn = buildChromeButton(
    "star-btn",
    makeId("star-btn", suffix),
    "Bookmark or unbookmark the current page",
    "fa-solid fa-star",
    "toggle-bookmark",
    fireAction,
  );
  setStyle(starBtn, { color: "var(--text-muted)" });
  const homeBtn = buildChromeButton(
    "home-btn",
    makeId("home-btn-nav", suffix),
    "Go to your configured homepage",
    "fa-solid fa-house",
    "home",
    fireAction,
  );
  addressWrapper.appendChild(starBtn);
  addressWrapper.appendChild(homeBtn);
  nav.appendChild(addressWrapper);
  const actionGroup = createElement("div", { className: "nav-action-group" });
  const sidebarBtn = createElement("button", {
    className: "nav-action-btn",
    id: makeId("sidebar-btn", suffix),
    attributes: {
      "data-tooltip": "Toggle sidebar tabs (Ctrl+Shift+Y)",
      "data-action": "toggle-sidebar",
    },
  });
  setHTML(
    sidebarBtn,
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path><path d="m16 15-3-3 3-3"></path></svg>',
  );
  bindEvent(sidebarBtn, "click", () => {
    fireAction("toggle-sidebar");
  });
  const paletteBtn = buildChromeButton(
    "nav-action-btn",
    makeId("palette-btn", suffix),
    "Command palette",
    "fa-solid fa-keyboard",
    "palette",
    fireAction,
  );
  const splitBtn = buildChromeButton(
    "nav-action-btn",
    makeId("split-btn", suffix),
    "Split view: show current tab beside another",
    "fa-solid fa-columns",
    "split",
    fireAction,
  );
  const fullscreenBtn = buildChromeButton(
    "nav-action-btn",
    makeId("fullscreen-btn", suffix),
    "View the current page in fullscreen mode",
    "fa-solid fa-expand",
    "fullscreen",
    fireAction,
  );
  const darkmodeBtn = buildChromeButton(
    "nav-action-btn",
    makeId("darkmode-btn", suffix),
    "Toggle dark mode on and off",
    "fa-solid fa-moon",
    "darkmode",
    fireAction,
  );
  const bookmarksBtn = buildChromeButton(
    "nav-action-btn",
    makeId("bookmarks-btn", suffix),
    "View, open, and manage your saved bookmarks",
    "fa-solid fa-star",
    "bookmarks",
    fireAction,
  );
  const historyBtn = buildChromeButton(
    "nav-action-btn",
    makeId("history-btn", suffix),
    "View and revisit pages from your browsing history",
    "fa-solid fa-clock-rotate-left",
    "history",
    fireAction,
  );
  const zoomOutBtn = buildChromeButton(
    "nav-action-btn",
    makeId("zoom-out-btn", suffix),
    "Zoom out to see more of the page",
    "fa-solid fa-minus",
    "zoom-out",
    fireAction,
  );
  setStyle(zoomOutBtn, { width: "30px" });
  const zoomLabel = createElement("span", {
    id: makeId("nav-zoom-label", suffix),
    text: "100%",
    attributes: {
      "data-tooltip": "Current zoom level; click to reset to 100%",
    },
  });
  setStyle(zoomLabel, {
    marginTop: "10px",
    fontSize: "11px",
    color: "var(--text-secondary)",
    minWidth: "30px",
    textAlign: "center",
    fontFamily: "var(--font-mono)",
  });
  bindEvent(zoomLabel, "click", () => {
    fireAction("zoom-reset");
  });
  const zoomInBtn = buildChromeButton(
    "nav-action-btn",
    makeId("zoom-in-btn", suffix),
    "Zoom in to see page content larger",
    "fa-solid fa-plus",
    "zoom-in",
    fireAction,
  );
  setStyle(zoomInBtn, { width: "30px" });
  const adAnchor = createElement("div", {
    className: "adblock-popup-anchor",
    id: makeId("adblock-popup-anchor", suffix),
  });
  const adBtn = buildChromeButton(
    "adblock-btn active",
    makeId("adblock-btn", suffix),
    "Ad blocking is active. Blocked: 0",
    "fa-solid fa-shield-halved",
    "adblock",
    fireAction,
  );
  adAnchor.appendChild(adBtn);
  const adPopup = createElement("div", { className: "adblock-popup" });
  const adPopupBody = createElement("div", { className: "adblock-popup-body" });
  const adPowerBtn = createElement("button", {
    className: "adblock-power-btn",
    id: makeId("adblock-power-btn", suffix),
    attributes: {
      "data-tooltip": "Toggle ad blocking",
      "data-action": "adblock-toggle",
    },
  });
  adPowerBtn.appendChild(buildIcon("fa-solid fa-shield-halved"));
  bindEvent(adPowerBtn, "click", () => {
    fireAction("adblock-toggle");
  });
  adPopupBody.appendChild(adPowerBtn);
  const adPageRow = createElement("div", { className: "adblock-page-row" });
  adPageRow.appendChild(
    createElement("span", {
      className: "adblock-page-label",
      text: "Blocked on this page",
    }),
  );
  const adPageNum = createElement("span", {
    className: "adblock-page-num",
    text: "0",
  });
  adPageRow.appendChild(adPageNum);
  adPopupBody.appendChild(adPageRow);
  const adTotalRow = createElement("div", { className: "adblock-total-row" });
  adTotalRow.appendChild(
    createElement("span", {
      className: "adblock-total-label",
      text: "Blocked total",
    }),
  );
  const adTotalNum = createElement("span", {
    className: "adblock-total-num",
    text: "0",
  });
  adTotalRow.appendChild(adTotalNum);
  adPopupBody.appendChild(adTotalRow);
  const adActions = createElement("div", {
    className: "adblock-popup-actions",
  });
  const adLogBtn = createElement("button", {
    className: "adblock-action-btn",
    id: makeId("adblock-open-log", suffix),
    attributes: {
      "data-tooltip": "View the blocked request log",
      "data-action": "open-blocking-log",
    },
  });
  adLogBtn.appendChild(buildIcon("fa-solid fa-list"));
  adLogBtn.appendChild(createElement("span", { text: "Log" }));
  bindEvent(adLogBtn, "click", () => {
    adPopup.classList.remove("open");
    fireAction("open-blocking-log");
  });
  adActions.appendChild(adLogBtn);
  const adSettingsBtn = createElement("button", {
    className: "adblock-action-btn",
    id: makeId("adblock-open-settings", suffix),
    attributes: {
      "data-tooltip": "Open browser settings",
      "data-action": "wisp-settings",
    },
  });
  adSettingsBtn.appendChild(buildIcon("fa-solid fa-sliders"));
  adSettingsBtn.appendChild(createElement("span", { text: "Settings" }));
  bindEvent(adSettingsBtn, "click", () => {
    adPopup.classList.remove("open");
    fireAction("wisp-settings");
  });
  adActions.appendChild(adSettingsBtn);
  adPopupBody.appendChild(adActions);
  adPopup.appendChild(adPopupBody);
  const adFooter = createElement("div", { className: "adblock-popup-footer" });
  adFooter.appendChild(
    createElement("span", {
      className: "adblock-footer-text",
      text: "EasyList & uAssets",
    }),
  );
  adPopup.appendChild(adFooter);
  adAnchor.appendChild(adPopup);
  els.adPopup = adPopup;
  els.adPowerBtn = adPowerBtn;
  els.adPageNum = adPageNum;
  els.adTotalNum = adTotalNum;
  els.adLogBtn = adLogBtn;
  els.adSettingsBtn = adSettingsBtn;
  try {
    const adblockOn =
      os.storage.get(StorageKeys.browserAdblockEnabled) !== false;
    adBtn.classList.toggle("active", adblockOn);
    adBtn.classList.toggle("inactive", !adblockOn);
  } catch (adblockInitErr) {
    void adblockInitErr;
  }
  const wispBtn = buildChromeButton(
    "nav-action-btn",
    makeId("wisp-settings-btn", suffix),
    "Open browser settings and proxy configuration",
    "fa-solid fa-gear",
    "wisp-settings",
    fireAction,
  );
  actionGroup.appendChild(sidebarBtn);
  actionGroup.appendChild(paletteBtn);
  actionGroup.appendChild(splitBtn);
  actionGroup.appendChild(fullscreenBtn);
  actionGroup.appendChild(darkmodeBtn);
  actionGroup.appendChild(bookmarksBtn);
  actionGroup.appendChild(historyBtn);
  actionGroup.appendChild(zoomOutBtn);
  actionGroup.appendChild(zoomLabel);
  actionGroup.appendChild(zoomInBtn);
  actionGroup.appendChild(adAnchor);
  actionGroup.appendChild(wispBtn);
  const dropdownWrap = buildDropdown(suffix, fireAction, els);
  actionGroup.appendChild(dropdownWrap);
  nav.appendChild(actionGroup);
  els.tabsContainer = tabsContainer;
  els.controlsSlot = controlsSlot;
  els.navRow = nav;
  els.addressWrapper = addressWrapper;
  els.addressInput = addressInput;
  els.lockIcon = lockIcon;
  els.starBtn = starBtn;
  els.homeBtn = homeBtn;
  els.actionGroup = actionGroup;
  els.sidebarBtn = sidebarBtn;
  els.paletteBtn = paletteBtn;
  els.splitBtn = splitBtn;
  els.fullscreenBtn = fullscreenBtn;
  els.darkmodeBtn = darkmodeBtn;
  els.bookmarksBtn = bookmarksBtn;
  els.historyBtn = historyBtn;
  els.zoomOutBtn = zoomOutBtn;
  els.zoomLabel = zoomLabel;
  els.zoomInBtn = zoomInBtn;
  els.adAnchor = adAnchor;
  els.adBtn = adBtn;
  els.wispBtn = wispBtn;
  return { tabsContainer, nav };
}
function buildContentArea(suffix, fireAction, els) {
  const bookmarkBar = createElement("div", {
    className: "bookmark-bar hidden",
    id: makeId("bookmark-bar", suffix),
  });
  const loadingWrap = createElement("div", {
    className: "loading-bar-container",
  });
  const loadingBar = createElement("div", {
    className: "loading-bar",
    id: makeId("loading-bar", suffix),
    attributes: { style: "width: 0%; opacity: 0;" },
  });
  loadingWrap.appendChild(loadingBar);
  const adBar = createElement("div", {
    className: "browser-ad-bar",
    id: makeId("browser-ad-bar", suffix),
  });
  const adLabel = createElement("span", {
    className: "browser-ad-label",
    text: "Sponsored",
  });
  adBar.appendChild(adLabel);
  const adClose = createElement("button", {
    className: "browser-ad-close",
    id: makeId("browser-ad-close", suffix),
    text: "×",
    attributes: { "aria-label": "Close advertisement" },
  });
  adClose.disabled = true;
  const adSlot = createElement("div", {
    className: "browser-ad-slot",
    id: makeId("browser-ad-slot", suffix),
  });
  bindBrowserAdClose(adBar, adClose, adSlot);
  adBar.appendChild(adClose);
  adBar.appendChild(adSlot);
  const iframeContainer = createElement("div", {
    className: "iframe-container",
    id: makeId("iframe-container", suffix),
  });
  const viewportLayer = createElement("div", {
    className: "browser-viewport-layer",
    id: makeId("viewport-layer", suffix),
  });
  setStyle(viewportLayer, {
    flex: "1",
    width: "100%",
    minHeight: "0",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  });
  iframeContainer.appendChild(viewportLayer);
  const loadingOverlay = createElement("div", {
    className: "message-container",
    id: makeId("loading", suffix),
    attributes: { style: "display: none;" },
  });
  const loadingContent = createElement("div", { className: "message-content" });
  const spinner = createElement("div", { className: "spinner" });
  loadingContent.appendChild(spinner);
  const loadingTitle = createElement("h1", {
    id: makeId("loading-title", suffix),
    text: "Connecting",
  });
  loadingContent.appendChild(loadingTitle);
  const loadingUrl = createElement("p", {
    id: makeId("loading-url", suffix),
    text: "Initializing proxy...",
  });
  loadingContent.appendChild(loadingUrl);
  const skipBtn = createElement("button", {
    id: makeId("skip-btn", suffix),
    text: "Skip",
    attributes: {
      "data-tooltip": "Skip the loading process and show the page content",
      "data-action": "skip-loading",
    },
  });
  bindEvent(skipBtn, "click", () => {
    fireAction("skip-loading");
  });
  loadingContent.appendChild(skipBtn);
  loadingOverlay.appendChild(loadingContent);
  iframeContainer.appendChild(loadingOverlay);
  const errorOverlay = createElement("div", {
    className: "message-container",
    id: makeId("error", suffix),
    attributes: { style: "display: none;" },
  });
  const errorContent = createElement("div", { className: "message-content" });
  const errorTitle = createElement("h1", { text: "Connection Error" });
  errorContent.appendChild(errorTitle);
  const errorMessage = createElement("p", {
    id: makeId("error-message", suffix),
    text: "An error occurred.",
  });
  errorContent.appendChild(errorMessage);
  errorOverlay.appendChild(errorContent);
  iframeContainer.appendChild(errorOverlay);
  const yukiContainer = createElement("div", {
    className: "yuki-page-container",
    id: makeId("yuki-page-container", suffix),
    attributes: { style: "display:none;" },
  });
  iframeContainer.appendChild(yukiContainer);
  const localContainer = createElement("div", {
    className: "local-page-container",
    id: makeId("local-page-container", suffix),
    attributes: { style: "display:none;" },
  });
  iframeContainer.appendChild(localContainer);
  const findBar = createElement("div", {
    className: "find-bar",
    id: makeId("find-bar", suffix),
    attributes: { style: "display:none;" },
  });
  const findInput = createElement("input", {
    id: makeId("find-input", suffix),
    attributes: { type: "text", placeholder: "Find in page…" },
  });
  findBar.appendChild(findInput);
  const findCount = createElement("span", {
    className: "find-count",
    id: makeId("find-count", suffix),
    text: "0/0",
  });
  findBar.appendChild(findCount);
  const findPrev = createElement("button", {
    className: "find-nav-btn",
    id: makeId("find-prev", suffix),
    attributes: {
      "data-tooltip": "Previous match",
      "data-action": "find-prev",
    },
  });
  findPrev.appendChild(buildIcon("fa-solid fa-chevron-up"));
  bindEvent(findPrev, "click", () => {
    fireAction("find-prev");
  });
  findBar.appendChild(findPrev);
  const findNext = createElement("button", {
    className: "find-nav-btn",
    id: makeId("find-next", suffix),
    attributes: { "data-tooltip": "Next match", "data-action": "find-next" },
  });
  findNext.appendChild(buildIcon("fa-solid fa-chevron-down"));
  bindEvent(findNext, "click", () => {
    fireAction("find-next");
  });
  findBar.appendChild(findNext);
  const findClose = createElement("button", {
    className: "find-close-btn",
    id: makeId("find-close", suffix),
    attributes: {
      "data-tooltip": "Close find bar",
      "data-action": "find-close",
    },
  });
  findClose.appendChild(buildIcon("fa-solid fa-xmark"));
  bindEvent(findClose, "click", () => {
    fireAction("find-close");
  });
  findBar.appendChild(findClose);
  iframeContainer.appendChild(findBar);
  const pdfViewer = createElement("div", {
    className: "pdf-viewer-overlay",
    id: makeId("pdf-viewer", suffix),
  });
  const pdfToolbar = createElement("div", { className: "pdf-viewer-toolbar" });
  const pdfTitle = createElement("span", {
    className: "pdf-title",
    id: makeId("pdf-title", suffix),
    text: "PDF Document",
  });
  pdfToolbar.appendChild(pdfTitle);
  const pdfInfo = createElement("span", {
    className: "pdf-page-info",
    id: makeId("pdf-page-info", suffix),
    text: "-",
  });
  pdfToolbar.appendChild(pdfInfo);
  const pdfClose = createElement("button", {
    id: makeId("pdf-close", suffix),
    attributes: {
      "data-tooltip": "Close PDF viewer",
      "data-action": "pdf-close",
    },
  });
  pdfClose.appendChild(buildIcon("fa-solid fa-xmark"));
  bindEvent(pdfClose, "click", () => {
    fireAction("pdf-close");
  });
  pdfToolbar.appendChild(pdfClose);
  pdfViewer.appendChild(pdfToolbar);
  const pdfBody = createElement("div", {
    className: "pdf-viewer-body",
    id: makeId("pdf-body", suffix),
  });
  pdfViewer.appendChild(pdfBody);
  iframeContainer.appendChild(pdfViewer);
  const linkStatus = createElement("div", { className: "link-status" });
  iframeContainer.appendChild(linkStatus);
  const tooltip = createElement("div", { id: makeId("tooltip", suffix) });
  els.bookmarkBar = bookmarkBar;
  els.loadingWrap = loadingWrap;
  els.loadingBar = loadingBar;
  els.adBar = adBar;
  els.adClose = adClose;
  els.adSlot = adSlot;
  els.iframeContainer = iframeContainer;
  els.viewportLayer = viewportLayer;
  els.loadingOverlay = loadingOverlay;
  els.loadingTitle = loadingTitle;
  els.loadingUrl = loadingUrl;
  els.skipBtn = skipBtn;
  els.errorOverlay = errorOverlay;
  els.errorMessage = errorMessage;
  els.yukiContainer = yukiContainer;
  els.localContainer = localContainer;
  els.findBar = findBar;
  els.findInput = findInput;
  els.findCount = findCount;
  els.findPrev = findPrev;
  els.findNext = findNext;
  els.findClose = findClose;
  els.pdfViewer = pdfViewer;
  els.pdfTitle = pdfTitle;
  els.pdfInfo = pdfInfo;
  els.pdfClose = pdfClose;
  els.pdfBody = pdfBody;
  els.linkStatus = linkStatus;
  els.tooltip = tooltip;
  return {
    bookmarkBar,
    loadingWrap,
    adBar,
    iframeContainer,
    viewportLayer,
    tooltip,
  };
}
export function buildBrowserView(rootContainer, opts = {}) {
  const initialUrl = opts.initialUrl || FALLBACK_HOME;
  const appId = opts.appId || FALLBACK_APP_ID;
  const onNavigate = opts.onNavigate;
  const onAction = opts.onAction;
  const instanceNum = opts.instanceNum || 1;
  const suffix = String(instanceNum);
  const wispUrl = getWispUrl();
  function fireAction(actionId) {
    if (typeof onAction === "function") {
      onAction(actionId);
    }
  }
  function handleAddress(value) {
    const target = String(value || "").trim();
    if (!target) {
      return;
    }
    if (typeof onNavigate === "function") {
      onNavigate(target);
    }
  }
  rootContainer.replaceChildren();
  setStyle(rootContainer, {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    overflow: "hidden",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
  });
  const root = createElement("div", { className: "browser-native-root" });
  setStyle(root, {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    overflow: "hidden",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
  });
  root.setAttribute("data-app-id", appId);
  root.setAttribute("data-wisp-url", wispUrl);
  root.setAttribute("data-instance", suffix);
  const els = {};
  const shell = createElement("div", {
    className: "browser-shell",
    id: makeId("browser-shell", suffix),
  });
  const sidebar = buildSidebar(suffix, fireAction, els);
  shell.appendChild(sidebar);
  const browserContainer = createElement("div", {
    className: "browser-container",
  });
  const navParts = buildNavRow(suffix, initialUrl, fireAction, els);
  browserContainer.appendChild(navParts.tabsContainer);
  browserContainer.appendChild(navParts.nav);
  const contentParts = buildContentArea(suffix, fireAction, els);
  browserContainer.appendChild(contentParts.bookmarkBar);
  browserContainer.appendChild(contentParts.loadingWrap);
  browserContainer.appendChild(contentParts.adBar);
  browserContainer.appendChild(contentParts.iframeContainer);
  browserContainer.appendChild(contentParts.tooltip);
  shell.appendChild(browserContainer);
  root.appendChild(shell);
  rootContainer.appendChild(root);
  let embedMode = false;
  try {
    embedMode = /(?:\?|&)embed=1(?:&|$)/.test(window.location.search);
  } catch (embedErr) {
    void embedErr;
  }
  if (embedMode) {
    els.tabsContainer.classList.add("hidden");
    els.navRow.classList.add("hidden");
    els.loadingWrap.classList.add("hidden");
    els.sidebar.classList.add("hidden");
  }
  function clampSidebarWidth(value) {
    if (!Number.isFinite(value)) {
      return 240;
    }
    return Math.min(500, Math.max(140, value));
  }
  try {
    const storedWidth = os.storage.get(StorageKeys.browserSidebarWidth);
    const parsedWidth =
      typeof storedWidth === "number" ? storedWidth : parseFloat(storedWidth);
    if (Number.isFinite(parsedWidth)) {
      els.sidebar.style.width = clampSidebarWidth(parsedWidth) + "px";
    }
  } catch (widthErr) {
    void widthErr;
  }
  const addressInput = els.addressInput;
  const tabStrip = els.tabStrip;
  const viewportContainer = els.viewportLayer;
  const tabsContainer = navParts.tabsContainer;
  const controlsSlot = els.controlsSlot;
  function readSidebarMode() {
    try {
      return os.storage.get(StorageKeys.browserSidebar) === true;
    } catch {
      return false;
    }
  }
  function placeNavGroup() {
    const inSidebar = !sidebar.classList.contains("hidden");
    if (inSidebar) {
      if (tabStrip.firstChild !== els.navGroup)
        tabStrip.insertBefore(els.navGroup, tabStrip.firstChild);
    } else if (navParts.nav.firstChild !== els.navGroup) {
      navParts.nav.insertBefore(els.navGroup, els.addressWrapper);
    }
  }
  function applySidebarMode(enabled) {
    const on = enabled === true;
    if (on) {
      sidebar.classList.remove("hidden");
      shell.classList.add("sidebar-mode");
      sidebar.appendChild(tabStrip);
    } else {
      sidebar.classList.add("hidden");
      shell.classList.remove("sidebar-mode");
      tabsContainer.insertBefore(tabStrip, controlsSlot);
    }
    placeNavGroup();
    try {
      os.storage.set(StorageKeys.browserSidebar, on);
    } catch {}
    return on;
  }
  function toggleSidebarMode() {
    return applySidebarMode(sidebar.classList.contains("hidden"));
  }
  applySidebarMode(readSidebarMode());
  function query(sel) {
    return $(sel, root);
  }
  function syncAddress(url) {
    const target = query(".bar") || addressInput;
    if (target) {
      target.value = url;
    }
  }
  function handleLoadProgress(loading) {
    const bar = els.loadingBar;
    if (!bar) {
      return;
    }
    const done =
      loading === false || (typeof loading === "number" && loading >= 100);
    if (done) {
      setStyle(bar, { width: "100%", opacity: "0" });
      window.setTimeout(() => {
        setStyle(bar, { width: "0%" });
      }, 200);
      return;
    }
    const percent = typeof loading === "number" && loading > 0 ? loading : 10;
    setStyle(bar, { width: percent + "%", opacity: "1" });
  }
  const store = createTabsStore(viewportContainer, {
    onAddressSync: syncAddress,
    onProgress: handleLoadProgress,
    addressInput,
    root,
    onSidebarMode: (on) => {
      applySidebarMode(on);
      renderTabStrip();
    },
  });
  function forwardViewportKeys(viewport) {
    if (!viewport || viewport.dataset.keysForwarded === "1") return;
    let doc = null;
    try {
      doc = viewport.contentDocument || null;
    } catch (accessErr) {
      void accessErr;
      return;
    }
    if (!doc) return;
    viewport.dataset.keysForwarded = "1";
    doc.addEventListener("keydown", (event) => {
      try {
        root.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: event.key,
            code: event.code,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
            bubbles: true,
            cancelable: true,
          }),
        );
      } catch (forwardErr) {
        void forwardErr;
      }
    });
  }
  root.addEventListener(
    "load",
    (event) => {
      const frame = event.target;
      if (
        frame instanceof HTMLIFrameElement &&
        frame.classList.contains("file-protocol-viewport")
      ) {
        delete frame.dataset.keysForwarded;
        forwardViewportKeys(frame);
      }
    },
    true,
  );
  try {
    if (os.storage.get(StorageKeys.browserSidebarCollapsed) === true) {
      store.setSidebarCollapsed(true);
    }
  } catch (collapsedInitErr) {
    void collapsedInitErr;
  }
  try {
    if (shouldEnableAds()) enableBrowserAds(els.adBar, els.adClose, els.adSlot);
    else disableBrowserAds(els.adBar, els.adSlot);
  } catch (adsInitErr) {
    void adsInitErr;
  }
  let lastAddedTabId = null;
  let dragTabId = null;
  function renderBookmarks() {
    store.renderBookmarkBar();
  }
  function renderTabStrip() {
    tabStrip.replaceChildren();
    placeNavGroup();
    const tabs = store.getAll();
    const active = store.getActive();
    tabs.forEach((tab) => {
      const isActive = active !== null && active.id === tab.id;
      const pinned = tab.isPinned === true;
      const tabEl = createElement("div", {
        className: pinned
          ? isActive
            ? "tab pinned active"
            : "tab pinned"
          : isActive
            ? "tab active"
            : "tab",
        attributes: {
          "data-tab-id": tab.id,
          "data-tooltip": tab.title || tab.url || "New Tab",
          tabindex: "-1",
        },
      });
      tabEl.draggable = true;
      if (pinned) {
        if (tab.loading) {
          tabEl.appendChild(createElement("div", { className: "tab-spinner" }));
        } else if (tab.favicon) {
          const icon = createElement("img", {
            className: "tab-favicon",
            attributes: { src: tab.favicon, alt: "" },
          });
          bindEvent(icon, "error", () => {
            icon.classList.add("hidden");
          });
          tabEl.appendChild(icon);
        } else {
          tabEl.appendChild(
            createElement("i", { className: "fa-solid fa-thumbtack" }),
          );
        }
      } else {
        if (tab.loading) {
          tabEl.appendChild(createElement("div", { className: "tab-spinner" }));
        } else if (tab.favicon) {
          const icon = createElement("img", {
            className: "tab-favicon",
            attributes: { src: tab.favicon, alt: "" },
          });
          bindEvent(icon, "error", () => {
            icon.classList.add("hidden");
          });
          tabEl.appendChild(icon);
        }
        tabEl.appendChild(
          createElement("span", {
            className: "tab-title",
            text: tab.title || tab.url || "New Tab",
          }),
        );
        if (tab.isMuted || tab.isPlaying) {
          const audioIcon = createElement("span", {
            className:
              "tab-audio-icon taskbar-speaker-indicator visible" +
              (tab.isMuted ? " muted" : ""),
          });
          const audioImg = createElement("img", {
            className: "papirus-icon papirus-icon--16",
            attributes: {
              src: tab.isMuted ? TAB_MUTED_ICON : TAB_SOUND_ICON,
              alt: "",
            },
          });
          bindEvent(audioImg, "error", () => {
            audioImg.classList.add("hidden");
          });
          audioIcon.appendChild(audioImg);
          bindEvent(audioIcon, "click", (event) => {
            event.stopPropagation();
            store.toggleMute(tab.id);
          });
          tabEl.insertBefore(audioIcon, tabEl.querySelector(".tab-title"));
        }
        const closeButton = createElement("span", {
          className: "tab-close",
          text: "×",
        });
        bindEvent(closeButton, "click", (event) => {
          event.stopPropagation();
          store.closeTab(tab.id);
        });
        tabEl.appendChild(closeButton);
      }
      bindEvent(tabEl, "click", () => {
        store.switchTab(tab.id);
      });
      bindEvent(tabEl, "mousedown", (event) => {
        if (event.button === 1) {
          event.preventDefault();
          store.closeTab(tab.id);
        }
      });
      bindEvent(tabEl, "contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showTabMenu({
          x: event.clientX,
          y: event.clientY,
          tab,
          store,
          anchor: tabEl,
        });
      });
      bindEvent(tabEl, "dragstart", (event) => {
        dragTabId = tab.id;
        event.dataTransfer.effectAllowed = "move";
        tabEl.classList.add("dragging");
      });
      bindEvent(tabEl, "dragend", () => {
        dragTabId = null;
        tabEl.classList.remove("dragging");
        Array.from(tabStrip.querySelectorAll(".tab")).forEach((entry) => {
          entry.classList.remove("drag-over");
        });
      });
      bindEvent(tabEl, "dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        Array.from(tabStrip.querySelectorAll(".tab")).forEach((entry) => {
          entry.classList.remove("drag-over");
        });
        tabEl.classList.add("drag-over");
      });
      bindEvent(tabEl, "dragleave", () => {
        tabEl.classList.remove("drag-over");
      });
      bindEvent(tabEl, "drop", (event) => {
        event.preventDefault();
        Array.from(tabStrip.querySelectorAll(".tab")).forEach((entry) => {
          entry.classList.remove("drag-over");
        });
        const sourceId = dragTabId;
        dragTabId = null;
        if (!sourceId || sourceId === tab.id) {
          return;
        }
        store.moveTab(sourceId, tab.id);
      });
      tabStrip.appendChild(tabEl);
    });
    if (lastAddedTabId !== null) {
      const addedEl = tabStrip.querySelector(
        `.tab[data-tab-id="${lastAddedTabId}"]`,
      );
      if (addedEl) {
        addedEl.classList.add("tab-new");
        bindEvent(
          addedEl,
          "animationend",
          () => {
            addedEl.classList.remove("tab-new");
          },
          { once: true },
        );
      }
      lastAddedTabId = null;
    }
    const newBtn = createElement("button", {
      className: "new-tab",
      attributes: { "data-tooltip": "Open a new blank tab" },
    });
    newBtn.appendChild(buildIcon("fa-solid fa-plus"));
    bindEvent(newBtn, "click", () => {
      tabsApi.addTab();
    });
    bindEvent(newBtn, "contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showClosedTabsMenu({
        x: event.clientX,
        y: event.clientY,
        store,
        anchor: newBtn,
      });
    });
    tabStrip.appendChild(newBtn);
    tabStrip.appendChild(els.sidebarResizer);
  }
  let omniboxBlurTimer = null;
  bindEvent(addressInput, "keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (typeof store.selectOmniboxNext === "function") {
        store.selectOmniboxNext();
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (typeof store.selectOmniboxPrev === "function") {
        store.selectOmniboxPrev();
      }
      return;
    }
    if (event.key === "Escape") {
      if (typeof store.hideOmnibox === "function") {
        store.hideOmnibox();
      }
      addressInput.blur();
      return;
    }
    if (event.key === "Enter") {
      if (typeof store.activateOmniboxSelection === "function") {
        const done = store.activateOmniboxSelection();
        if (done === "navigated") {
          addressInput.blur();
          return;
        }
        if (done === "calc") {
          return;
        }
      }
      handleAddress(addressInput.value);
      addressInput.blur();
    }
  });
  bindEvent(addressInput, "focus", () => {
    if (omniboxBlurTimer !== null) {
      clearTimeout(omniboxBlurTimer);
      omniboxBlurTimer = null;
    }
    addressInput.select();
  });
  bindEvent(addressInput, "blur", () => {
    if (omniboxBlurTimer !== null) {
      clearTimeout(omniboxBlurTimer);
    }
    omniboxBlurTimer = setTimeout(() => {
      omniboxBlurTimer = null;
      if (typeof store.hideOmnibox === "function") {
        store.hideOmnibox();
      }
    }, 150);
  });
  bindEvent(addressInput, "input", () => {
    if (typeof store.updateOmnibox === "function") {
      store.updateOmnibox(addressInput);
    }
  });
  const tabsApi = {
    addTab(url) {
      const tab = store.addTab(url);
      if (tab) {
        lastAddedTabId = tab.id;
      }
      renderTabStrip();
      return tab;
    },
    switchTab(id) {
      const tab = store.switchTab(id);
      renderTabStrip();
      return tab;
    },
    closeTab(id) {
      const result = store.closeTab(id);
      renderTabStrip();
      return result;
    },
    getActive() {
      return store.getActive();
    },
    getAll() {
      return store.getAll();
    },
    navigateTab(id, url) {
      return store.navigateTab(id, url);
    },
    previewNavigate(id, url) {
      const tab = store.previewNavigate(id, url);
      renderTabStrip();
      return tab;
    },
    setStatusFor(url) {
      return store.setStatusFor(url);
    },
    clearStatus() {
      return store.clearStatus();
    },
    recordBlocked(url) {
      if (typeof store.recordBlocked === "function") {
        return store.recordBlocked(url);
      }
    },
    setProgress(percent) {
      handleLoadProgress(percent);
    },
    openYukiPage(kind) {
      return store.openYukiPage(kind);
    },
    closeYukiPage() {
      return store.closeYukiPage();
    },
    toggleSidebar() {
      return toggleSidebarMode();
    },
    collapseSidebar() {
      return store.toggleSidebar();
    },
    handleMenuAction(name) {
      const result = store.handleMenuAction(name);
      renderTabStrip();
      return result;
    },
    showClosedTabs() {
      let posX = Math.round(window.innerWidth / 2);
      let posY = 64;
      const dd = els.dropdown;
      if (dd && typeof dd.getBoundingClientRect === "function") {
        const rect = dd.getBoundingClientRect();
        posX = Math.round(rect.left);
        posY = Math.round(rect.bottom + 4);
      }
      showClosedTabsMenu({
        x: posX,
        y: posY,
        store,
        anchor: els.dropdown || root,
      });
    },
    refresh() {
      renderTabStrip();
      store.renderBookmarkBar();
      store.updateStarButton();
      store.updateMenuBadges();
    },
    destroy() {
      if (typeof store.destroy === "function") store.destroy();
    },
  };
  store.setChangeListener(renderTabStrip);
  let activePopup = null;
  function handlePopupKey(keyEvent) {
    if (keyEvent.key === "Escape") {
      closeActivePopup();
    }
  }
  function handleOutsideDown(downEvent) {
    if (
      activePopup &&
      downEvent.target &&
      !activePopup.contains(downEvent.target)
    ) {
      closeActivePopup();
    }
  }
  function closeActivePopup() {
    if (activePopup && activePopup.parentElement) {
      activePopup.parentElement.removeChild(activePopup);
    }
    activePopup = null;
    document.removeEventListener("mousedown", handleOutsideDown);
    document.removeEventListener("keydown", handlePopupKey);
  }
  function openPopupAt(menu, anchor) {
    closeActivePopup();
    setStyle(menu, { position: "fixed", zIndex: "9999" });
    document.body.appendChild(menu);
    const rect =
      anchor && anchor.getBoundingClientRect
        ? anchor.getBoundingClientRect()
        : null;
    if (rect) {
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 330));
      setStyle(menu, { left: left + "px", top: rect.bottom + 6 + "px" });
    }
    activePopup = menu;
    document.addEventListener("mousedown", handleOutsideDown);
    document.addEventListener("keydown", handlePopupKey);
  }
  function showHistoryMenu(anchor, mode) {
    const current =
      typeof store.getActive === "function" ? store.getActive() : null;
    if (!current || !Array.isArray(current.navStack)) {
      return;
    }
    const stack = current.navStack;
    const currentIndex =
      typeof current.navIndex === "number"
        ? current.navIndex
        : stack.length - 1;
    const indices = [];
    if (mode === "back") {
      for (
        let pos = currentIndex - 1;
        pos >= 0 && indices.length < 12;
        pos -= 1
      ) {
        indices.push(pos);
      }
    } else {
      for (
        let pos = currentIndex + 1;
        pos < stack.length && indices.length < 12;
        pos += 1
      ) {
        indices.push(pos);
      }
    }
    if (indices.length === 0) {
      return;
    }
    const menu = createElement("div", { className: "ctx-menu" });
    indices.forEach((entryIndex) => {
      const raw = String(stack[entryIndex] || "");
      let host = raw;
      try {
        host = new URL(raw).hostname || raw;
      } catch (hostErr) {
        void hostErr;
      }
      const item = createElement("div", { className: "ctx-menu-item" });
      const hostEl = createElement("div", { className: "ctx-menu-host" });
      hostEl.textContent = host;
      const urlEl = createElement("div", { className: "ctx-menu-url" });
      urlEl.textContent = raw;
      item.appendChild(hostEl);
      item.appendChild(urlEl);
      bindEvent(item, "click", () => {
        closeActivePopup();
        if (typeof store.jumpNavStack === "function") {
          store.jumpNavStack(entryIndex);
        }
      });
      menu.appendChild(item);
    });
    openPopupAt(menu, anchor);
  }
  function buildCleanUrl(raw) {
    try {
      const parsed = new URL(raw);
      const params = new URLSearchParams(parsed.search);
      const dropNames = [
        "gclid",
        "fbclid",
        "msclkid",
        "mc_cid",
        "mc_eid",
        "igshid",
      ];
      Array.from(params.keys()).forEach((name) => {
        const lower = name.toLowerCase();
        if (lower.startsWith("utm_") || dropNames.includes(lower)) {
          params.delete(name);
        }
      });
      const rest = params.toString();
      parsed.search = rest ? "?" + rest : "";
      return parsed.toString();
    } catch (cleanErr) {
      void cleanErr;
      return raw;
    }
  }
  function showConnectionPopup(anchor) {
    const current =
      typeof store.getActive === "function" ? store.getActive() : null;
    const pageUrl = current && current.url ? String(current.url) : "";
    let pageHost = pageUrl || "Unknown host";
    try {
      pageHost = new URL(pageUrl).hostname || pageUrl;
    } catch (pageErr) {
      void pageErr;
    }
    let relayHost = "";
    try {
      const relayUrl = getWispUrl();
      relayHost = new URL(relayUrl).hostname || relayUrl;
    } catch (relayErr) {
      void relayErr;
      relayHost = getWispUrl();
    }
    const popup = createElement("div", {
      className: "ctx-menu connection-popup",
    });
    const hostRow = createElement("div", { className: "ctx-menu-host" });
    hostRow.textContent = pageHost;
    popup.appendChild(hostRow);
    const relayRow = createElement("div", { className: "ctx-menu-url" });
    relayRow.textContent = relayHost;
    popup.appendChild(relayRow);
    const transportRow = createElement("div", { className: "ctx-menu-url" });
    transportRow.textContent = "WISP relay";
    popup.appendChild(transportRow);
    const copyBtn = createElement("button", {
      className: "ctx-menu-item",
      text: "Copy Link",
    });
    bindEvent(copyBtn, "click", async () => {
      try {
        await navigator.clipboard.writeText(pageUrl);
        os.notify.send("Browser", "Link copied to clipboard");
      } catch (copyErr) {
        void copyErr;
        os.notify.send("Browser", "Copy failed");
      }
      closeActivePopup();
    });
    popup.appendChild(copyBtn);
    const cleanBtn = createElement("button", {
      className: "ctx-menu-item",
      text: "Copy Clean Link",
    });
    bindEvent(cleanBtn, "click", async () => {
      try {
        await navigator.clipboard.writeText(buildCleanUrl(pageUrl));
        os.notify.send("Browser", "Clean link copied to clipboard");
      } catch (cleanCopyErr) {
        void cleanCopyErr;
        os.notify.send("Browser", "Copy failed");
      }
      closeActivePopup();
    });
    popup.appendChild(cleanBtn);
    openPopupAt(popup, anchor);
  }
  bindEvent(els.backBtn, "contextmenu", (menuEvent) => {
    menuEvent.preventDefault();
    menuEvent.stopPropagation();
    showHistoryMenu(els.backBtn, "back");
  });
  bindEvent(els.fwdBtn, "contextmenu", (menuEvent) => {
    menuEvent.preventDefault();
    menuEvent.stopPropagation();
    showHistoryMenu(els.fwdBtn, "forward");
  });
  bindEvent(els.lockIcon, "click", (lockEvent) => {
    lockEvent.stopPropagation();
    showConnectionPopup(els.lockIcon);
  });
  bindEvent(els.sidebarResizer, "pointerdown", (downEvent) => {
    downEvent.preventDefault();
    const startX = downEvent.clientX;
    const startWidth = els.sidebar.getBoundingClientRect().width || 240;
    function handleResizeMove(moveEvent) {
      els.sidebar.style.width =
        clampSidebarWidth(startWidth + (moveEvent.clientX - startX)) + "px";
    }
    function handleResizeUp(upEvent) {
      document.removeEventListener("pointermove", handleResizeMove);
      const finalWidth = clampSidebarWidth(
        startWidth + (upEvent.clientX - startX),
      );
      els.sidebar.style.width = finalWidth + "px";
      try {
        os.storage.set(StorageKeys.browserSidebarWidth, finalWidth);
      } catch (saveErr) {
        void saveErr;
      }
    }
    document.addEventListener("pointermove", handleResizeMove);
    document.addEventListener("pointerup", handleResizeUp, { once: true });
  });
  let tabScrollNavAt = 0;
  function handleTabScrollNav(event) {
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    const allTabs = store.getAll();
    if (!allTabs || allTabs.length < 2) {
      return;
    }
    const delta = (event.deltaY || 0) + (event.deltaX || 0);
    if (!delta) {
      return;
    }
    const now = Date.now();
    if (now - tabScrollNavAt < 150) {
      return;
    }
    tabScrollNavAt = now;
    event.preventDefault();
    const active = store.getActive();
    const activeId = active ? active.id : null;
    const baseIndex = allTabs.findIndex((tabEntry) => tabEntry.id === activeId);
    const base = baseIndex === -1 ? 0 : baseIndex;
    const nextIndex =
      (base + (delta > 0 ? 1 : -1) + allTabs.length) % allTabs.length;
    const next = allTabs[nextIndex];
    if (next && next.id !== activeId) {
      tabsApi.switchTab(next.id);
    }
  }
  function initTabScrollNav() {
    const targets = [tabStrip, tabsContainer];
    targets.forEach((target) => {
      if (!target) {
        return;
      }
      if (
        target.dataset.scrollNav === "true" &&
        target.dataset.scrollNavBound === "true"
      ) {
        return;
      }
      target.dataset.scrollNav = "true";
      target.dataset.scrollNavBound = "true";
      bindEvent(target, "wheel", handleTabScrollNav);
    });
  }
  initTabScrollNav();
  bindEvent(root, "keydown", (event) => {
    const activeElement = document.activeElement;
    if (activeElement) {
      const tagName = (activeElement.tagName || "").toUpperCase();
      if (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        activeElement.isContentEditable
      ) {
        return;
      }
    }
    if (KeybindManager.matches(event, "browser.focusUrl")) {
      event.preventDefault();
      addressInput.focus();
      addressInput.select();
      return;
    }
    if (KeybindManager.matches(event, "browser.toggleSidebar")) {
      fireAction("toggle-sidebar");
      return;
    }
    if (KeybindManager.matches(event, "browser.newTab")) {
      event.preventDefault();
      fireAction("new-tab");
      return;
    }
    if (KeybindManager.matches(event, "browser.closeTab")) {
      event.preventDefault();
      const closing = store.getActive();
      if (closing) store.closeTab(closing.id);
      return;
    }
    if (KeybindManager.matches(event, "browser.reloadPage")) {
      event.preventDefault();
      fireAction("reload");
      return;
    }
    if (KeybindManager.matches(event, "browser.bookmarkPage")) {
      event.preventDefault();
      fireAction("toggle-bookmark");
      return;
    }
    if (KeybindManager.matches(event, "browser.reopenTab")) {
      event.preventDefault();
      fireAction("reopen-tab");
      return;
    }
    if (KeybindManager.matches(event, "browser.find")) {
      event.preventDefault();
      fireAction("find");
      return;
    }
    if (KeybindManager.matches(event, "browser.history")) {
      event.preventDefault();
      fireAction("history");
      return;
    }
    if (KeybindManager.matches(event, "browser.downloads")) {
      event.preventDefault();
      fireAction("downloads");
      return;
    }
    if (KeybindManager.matches(event, "browser.toggleBookmarkBar")) {
      event.preventDefault();
      fireAction("toggle-bookmarkbar");
      return;
    }
    if (KeybindManager.matches(event, "browser.savePage")) {
      event.preventDefault();
      fireAction("save-page");
      return;
    }
    if (KeybindManager.matches(event, "browser.palette")) {
      event.preventDefault();
      fireAction("palette");
      return;
    }
    if (KeybindManager.matches(event, "browser.split")) {
      event.preventDefault();
      fireAction("split");
      return;
    }
    for (let tabNum = 1; tabNum <= 9; tabNum += 1) {
      if (KeybindManager.matches(event, "browser.tab" + tabNum)) {
        event.preventDefault();
        const all = store.getAll();
        const target = all[tabNum - 1];
        if (target) store.switchTab(target.id);
        return;
      }
    }
  });
  bindEvent(document, "click", (event) => {
    const target = event.target;
    const inside =
      target && target.closest ? target.closest(".main-menu-wrapper") : null;
    if (!inside && els.dropdown) {
      els.dropdown.classList.remove("open");
    }
  });
  bindEvent(document, "mousedown", (event) => {
    const popup = els.adPopup;
    if (!popup || !popup.classList.contains("open")) {
      return;
    }
    const target = event.target;
    if (target && popup.contains(target)) {
      return;
    }
    if (target && els.adAnchor && els.adAnchor.contains(target)) {
      return;
    }
    popup.classList.remove("open");
  });
  renderBookmarks();
  store.addTab(initialUrl);
  try {
    if (os.storage.get(StorageKeys.browserRestoreTabs) === true) {
      const savedTabs = os.storage.get(StorageKeys.browserOpenTabs);
      if (Array.isArray(savedTabs)) {
        let restoredCount = 0;
        for (const savedUrl of savedTabs) {
          if (restoredCount >= 10) break;
          if (typeof savedUrl !== "string" || !/^https?:\/\//i.test(savedUrl))
            continue;
          if (savedUrl === initialUrl) continue;
          store.addTab(savedUrl);
          restoredCount += 1;
        }
      }
    }
  } catch {}
  store.updateStarButton();
  store.updateMenuBadges();
  renderTabStrip();
  syncAddress(initialUrl);
  return {
    root,
    tabStrip,
    addressInput,
    viewportContainer,
    tabsApi,
    els,
    query,
    syncAddress,
  };
}
