import "../styles/dataeditor.css";
import { $, $$, setText, toggleClass, setHTML } from "../shared/domUtils.js";
import { BaseApp, os } from "../framework.js";
import { formatSize, downloadBlob } from "../utils/utils.js";

export class DataEditorApp extends BaseApp {
  constructor(services) {
    super(services);
    this.cssLoaded = false;
    this.currentTab = "ls";
    this.currentIdbCtx = null;
    this.activeKeyEl = null;
    this.statusTimer = null;
    this.selectedKeys = new Set();
    this.idbPagination = { page: 1, pageSize: 50, total: 0 };
  }

  open() {
    const winId = "yukios-data-editor";
    if (this.hasOpenWindow(winId)) return;

    const win = os.window.create(winId, "Storage Editor", "1000px", "650px", {
      icon: "fas fa-database",
      appId: "dataEditor"
    });

    this.win = win;
    this.trackWindow(winId, win);
    win.innerHTML = this.buildUI();
    this.bindDataEditorEvents(win);
    this.loadLocalStorage(win);

    win.addEventListener("remove", () => {
      this.win = null;
    });
  }

  buildUI() {
    return `<div class="window-content data-editor-window">
  <div class="de-tabs">
    <button id="de-tab-ls" class="de-tab de-tab-active" data-tab="ls"><i class="fas fa-hdd"></i><span> localStorage</span></button>
    <button id="de-tab-ss" class="de-tab" data-tab="ss"><i class="fas fa-memory"></i><span> sessionStorage</span></button>
    <button id="de-tab-cookie" class="de-tab" data-tab="cookie"><i class="fas fa-cookie"></i><span> Cookies</span></button>
    <button id="de-tab-idb" class="de-tab" data-tab="idb"><i class="fas fa-server"></i><span> IndexedDB</span></button>
  </div>
  <div class="de-main">
    <div class="de-list-panel">
      <div class="de-search-container">
        <input id="de-search" placeholder="Search keys and values...">
      </div>
      <div class="de-select-bar">
        <input id="de-select-all" type="checkbox"><span>Select All</span><span id="de-selected-count">0 selected</span>
      </div>
      <div id="de-key-list" class="de-key-list"></div>
      <div class="de-list-actions">
        <button id="de-add-key"><i class="fas fa-plus"></i><span> New</span></button>
        <button id="de-bulk-delete" class="de-delete" disabled><i class="fas fa-trash"></i><span> Delete</span></button>
        <button id="de-bulk-export" disabled><i class="fas fa-download"></i><span> Export</span></button>
      </div>
    </div>
    <div class="de-edit-panel">
      <div id="de-empty-state" class="de-empty-state">
        <i class="fas fa-table-cells"></i><span>Select a key to inspect and edit</span>
      </div>
      <div id="de-editor-area" class="de-editor-area" style="display:none">
        <div class="de-key-row">
          <input id="de-key-input" placeholder="Key name">
          <span id="de-key-type"></span>
          <span id="de-key-size"></span>
        </div>
        <div class="de-json-toolbar">
          <button id="de-prettify-btn"><i class="fas fa-align-left"></i><span> Prettify</span></button>
          <button id="de-validate-btn"><i class="fas fa-check"></i><span> Validate</span></button>
          <span id="de-json-error"></span>
        </div>
        <textarea id="de-val-input" spellcheck="false"></textarea>
        <div class="de-editor-actions">
          <button id="de-copy-key-btn"><i class="fas fa-copy"></i><span> Copy Key</span></button>
          <button id="de-copy-val-btn"><i class="fas fa-copy"></i><span> Copy Value</span></button>
          <button id="de-rename-btn" class="de-rename"><i class="fas fa-edit"></i><span> Rename</span></button>
          <div class="de-spacer"></div>
          <button id="de-save-btn" class="de-save"><i class="fas fa-save"></i><span> Save</span></button>
          <button id="de-delete-btn" class="de-delete"><i class="fas fa-trash"></i><span> Delete</span></button>
          <span id="de-status"></span>
        </div>
      </div>
    </div>
  </div>
</div>`;
  }

  bindDataEditorEvents(win) {
    win.querySelectorAll(".de-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.stopPropagation();
        this.switchTab(tab.dataset.tab, win);
      });
    });

    win.querySelector("#de-search")?.addEventListener("input", () => {
      this.reloadCurrentTab(win);
    });

    win.querySelector("#de-select-all")?.addEventListener("change", (e) => {
      const keyList = $("#de-key-list", win);
      const checkboxes = $$('input[type="checkbox"]', keyList);
      this.selectedKeys.clear();
      checkboxes.forEach((cb) => {
        cb.checked = e.target.checked;
        if (cb.checked) {
          const container = cb.closest("div");
          const labelEl = container.querySelector("span");
          const key = labelEl.textContent;
          this.selectedKeys.add({ key, value: null, context: this.currentIdbCtx });
        }
      });
      this.updateSelectedCount(win);
    });

    win.querySelector("#de-add-key")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const emptyState = $("#de-empty-state", win);
      const editorArea = $("#de-editor-area", win);
      const keyInput = $("#de-key-input", win);
      const valInput = $("#de-val-input", win);
      const keyType = $("#de-key-type", win);
      const keySize = $("#de-key-size", win);

      if (emptyState) emptyState.style.display = "none";
      if (editorArea) editorArea.style.display = "flex";
      if (this.activeKeyEl) this.activeKeyEl.style.background = "";
      this.activeKeyEl = null;
      this.currentIdbCtx = null;
      if (keyInput) keyInput.value = "";
      if (valInput) valInput.value = "";
      if (keyType)
        keyType.textContent =
          this.currentTab === "ls"
            ? "localStorage"
            : this.currentTab === "ss"
              ? "sessionStorage"
              : this.currentTab === "cookie"
                ? "Cookie"
                : "IDB";
      if (keySize) keySize.textContent = "0 B";
      if (keyInput) keyInput.focus();
    });

    win.querySelector("#de-save-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleSave(e.currentTarget);
    });

    win.querySelector("#de-delete-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleDelete(e.currentTarget);
    });

    win.querySelector("#de-rename-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleRename(e.currentTarget);
    });

    win.querySelector("#de-copy-key-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleCopyKey(e.currentTarget);
    });

    win.querySelector("#de-copy-val-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleCopyVal(e.currentTarget);
    });

    win.querySelector("#de-prettify-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handlePrettify(e.currentTarget);
    });

    win.querySelector("#de-validate-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleValidate(e.currentTarget);
    });

    win.querySelector("#de-bulk-delete")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleBulkDelete(e.currentTarget);
    });

    win.querySelector("#de-bulk-export")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleBulkExport(e.currentTarget);
    });

    win.querySelector("#de-key-list")?.addEventListener("click", (e) => {
      const item = e.target.closest(".de-key-item");
      if (item) {
        const idx = Array.from(item.parentNode.children).indexOf(item);
        item.click();
      }
    });
  }

  switchTab(tabId, win) {
    this.currentTab = tabId;
    this.idbPagination = { page: 1, pageSize: 50, total: 0 };

    const tabLs = $("#de-tab-ls", win);
    const tabSs = $("#de-tab-ss", win);
    const tabCookie = $("#de-tab-cookie", win);
    const tabIdb = $("#de-tab-idb", win);

    if (tabLs) toggleClass(tabLs, "de-tab-active", tabId === "ls");
    if (tabSs) toggleClass(tabSs, "de-tab-active", tabId === "ss");
    if (tabCookie) toggleClass(tabCookie, "de-tab-active", tabId === "cookie");
    if (tabIdb) toggleClass(tabIdb, "de-tab-active", tabId === "idb");

    const emptyState = $("#de-empty-state", win);
    const editorArea = $("#de-editor-area", win);
    if (emptyState) emptyState.style.display = "flex";
    if (editorArea) editorArea.style.display = "none";
    this.activeKeyEl = null;

    if (tabId === "ls") this.loadLocalStorage(win);
    else if (tabId === "ss") this.loadSessionStorage(win);
    else if (tabId === "cookie") this.loadCookies(win);
    else this.loadIdb(win);
  }

  onClose(winId) {
    this.untrackWindow(winId);
  }

  showEditorStatus(win, msg, color = "var(--text-secondary)") {
    const statusEl = $("#de-status", win);
    if (!statusEl) return;
    setText(statusEl, msg);
    statusEl.style.color = color;
    statusEl.style.opacity = "1";
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => {
      statusEl.style.opacity = "0";
    }, 2000);
  }

  showJsonError(win, msg) {
    const jsonErrorEl = $("#de-json-error", win);
    if (!jsonErrorEl) return;
    setText(jsonErrorEl, msg);
    toggleClass(jsonErrorEl, "visible", !!msg);
  }

  updateSelectedCount(win) {
    const selectedCountEl = $("#de-selected-count", win);
    const bulkDeleteBtn = $("#de-bulk-delete", win);
    const bulkExportBtn = $("#de-bulk-export", win);
    if (selectedCountEl) setText(selectedCountEl, `${this.selectedKeys.size} selected`);
    if (bulkDeleteBtn) bulkDeleteBtn.disabled = this.selectedKeys.size === 0;
    if (bulkExportBtn) bulkExportBtn.disabled = this.selectedKeys.size === 0;
  }

  getValueType(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }

  getValueSize(value) {
    return new Blob([String(value)]).size;
  }

  selectKey(win, keyEl, keyName, value, typeLabel, idbCtx = null) {
    if (this.activeKeyEl && this.activeKeyEl.classList) this.activeKeyEl.classList.remove("active");
    this.activeKeyEl = keyEl;
    if (keyEl && keyEl.classList) keyEl.classList.add("active");
    this.currentIdbCtx = idbCtx;
    const emptyState = $("#de-empty-state", win);
    const editorArea = $("#de-editor-area", win);
    const keyInput = $("#de-key-input", win);
    const keyType = $("#de-key-type", win);
    const keySize = $("#de-key-size", win);
    const valInput = $("#de-val-input", win);

    if (emptyState) emptyState.style.display = "none";
    if (editorArea) editorArea.style.display = "flex";
    if (keyInput) keyInput.value = keyName;
    if (keyType) keyType.textContent = typeLabel;
    if (keySize) keySize.textContent = formatSize(this.getValueSize(value ?? ""));
    if (valInput) {
      try {
        const parsed = JSON.parse(value);
        valInput.value = JSON.stringify(parsed, null, 2);
        if (keyType) keyType.textContent = `${typeLabel} (${this.getValueType(parsed)})`;
      } catch {
        valInput.value = value ?? "";
        if (keyType) keyType.textContent = `${typeLabel} (string)`;
      }
    }
    this.showJsonError(win, "");
  }

  buildKeyItem(win, label, onclick, keyValue = null, storeContext = null) {
    const container = document.createElement("div");
    container.className = "de-key-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      const keyId = storeContext ? `${storeContext.dbName}/${storeContext.storeName}/${label}` : label;
      if (checkbox.checked) {
        this.selectedKeys.add({ key: label, value: keyValue, context: storeContext });
      } else {
        this.selectedKeys.delete(keyId);
      }
      this.updateSelectedCount(win);
    });
    checkbox.addEventListener("click", (e) => e.stopPropagation());

    const labelEl = document.createElement("span");
    labelEl.title = label;
    labelEl.textContent = label;

    container.appendChild(checkbox);
    container.appendChild(labelEl);

    container.addEventListener("click", () => onclick(container));

    return container;
  }

  loadFlatStorage(win, getEntries, typeLabel, emptyMsg) {
    const keyList = $("#de-key-list", win);
    const searchInput = $("#de-search", win);
    const selectAllCheckbox = $("#de-select-all", win);
    const emptyState = $("#de-empty-state", win);
    const editorArea = $("#de-editor-area", win);

    setHTML(keyList, "");
    this.selectedKeys.clear();
    selectAllCheckbox.checked = false;
    if (emptyState) emptyState.style.display = "flex";
    if (editorArea) editorArea.style.display = "none";
    this.activeKeyEl = null;
    this.updateSelectedCount(win);
    const q = searchInput.value.toLowerCase();

    const entries = getEntries();
    entries.sort((a, b) => a.key.localeCompare(b.key));

    for (const { key, value } of entries) {
      if (q && !key.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) continue;
      const el = this.buildKeyItem(
        win,
        key,
        (container) => {
          this.selectKey(win, container, key, value, typeLabel);
        },
        value
      );
      keyList.appendChild(el);
    }

    if (!keyList.children.length) {
      keyList.innerHTML = `<div style="padding:10px;color:var(--text-muted);font-size:0.8em;text-align:center;">${emptyMsg}</div>`;
    }
  }

  loadLocalStorage(win) {
    this.loadFlatStorage(
      win,
      () => {
        const entries = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          entries.push({ key: k, value: localStorage.getItem(k) });
        }
        return entries;
      },
      "localStorage",
      "No keys stored yet"
    );
  }

  loadSessionStorage(win) {
    this.loadFlatStorage(
      win,
      () => {
        const entries = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          entries.push({ key: k, value: sessionStorage.getItem(k) });
        }
        return entries;
      },
      "sessionStorage",
      "No keys stored yet"
    );
  }

  loadCookies(win) {
    this.loadFlatStorage(
      win,
      () => {
        return document.cookie
          .split(";")
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => {
            const [key, ...parts] = c.split("=");
            return { key, value: parts.join("=") };
          });
      },
      "Cookie",
      "No cookies here"
    );
  }

  async loadIdb(win) {
    const keyList = $("#de-key-list", win);
    const searchInput = $("#de-search", win);
    const selectAllCheckbox = $("#de-select-all", win);
    const emptyState = $("#de-empty-state", win);
    const editorArea = $("#de-editor-area", win);

    setHTML(
      keyList,
      `<div style="padding:10px;color:var(--text-secondary);font-size:0.8em;text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`
    );
    if (emptyState) emptyState.style.display = "flex";
    if (editorArea) editorArea.style.display = "none";
    this.activeKeyEl = null;
    this.selectedKeys.clear();
    selectAllCheckbox.checked = false;
    this.updateSelectedCount(win);
    const q = searchInput.value.toLowerCase();
    setHTML(keyList, "");
    try {
      const dbs = await indexedDB.databases();
      for (const dbInfo of dbs) {
        const dbName = dbInfo.name;
        const header = document.createElement("div");
        header.className = "de-db-header";
        header.textContent = dbName;
        keyList.appendChild(header);
        try {
          const req = indexedDB.open(dbName);
          const db = await new Promise((res, rej) => {
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });
          const storeNames = [...db.objectStoreNames];
          for (const storeName of storeNames) {
            const tx = db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);
            const allKeysReq = store.getAllKeys();
            const allKeys = await new Promise((res, rej) => {
              allKeysReq.onsuccess = () => res(allKeysReq.result);
              allKeysReq.onerror = () => rej(allKeysReq.error);
            });

            this.idbPagination.total = allKeys.length;
            const startIdx = (this.idbPagination.page - 1) * this.idbPagination.pageSize;
            const endIdx = startIdx + this.idbPagination.pageSize;
            const paginatedKeys = allKeys.slice(startIdx, endIdx);

            for (const key of paginatedKeys) {
              const keyStr = String(key);
              const valReq = store.get(key);
              const val = await new Promise((res, rej) => {
                valReq.onsuccess = () => res(valReq.result);
                valReq.onerror = () => rej(valReq.error);
              });
              const valStr = typeof val === "string" ? val : JSON.stringify(val);
              if (
                q &&
                !keyStr.toLowerCase().includes(q) &&
                !valStr.toLowerCase().includes(q) &&
                !storeName.toLowerCase().includes(q) &&
                !dbName.toLowerCase().includes(q)
              )
                continue;
              const storeContext = { db, dbName, storeName, key };
              const el = this.buildKeyItem(
                win,
                `${storeName} › ${keyStr}`,
                (container) => {
                  this.selectKey(win, container, keyStr, valStr, `IDB: ${dbName}/${storeName}`, storeContext);
                },
                valStr,
                storeContext
              );
              keyList.appendChild(el);
            }

            if (this.idbPagination.total > this.idbPagination.pageSize) {
              const paginationEl = document.createElement("div");
              paginationEl.className = "de-pagination";
              paginationEl.innerHTML = `
                <span>Page ${this.idbPagination.page} of ${Math.ceil(this.idbPagination.total / this.idbPagination.pageSize)}</span>
                <button class="de-prev-page" ${this.idbPagination.page === 1 ? "disabled" : ""}>Prev</button>
                <button class="de-next-page" ${endIdx >= this.idbPagination.total ? "disabled" : ""}>Next</button>
              `;
              paginationEl.querySelector(".de-prev-page").addEventListener("click", () => {
                this.idbPagination.page--;
                this.loadIdb(win);
              });
              paginationEl.querySelector(".de-next-page").addEventListener("click", () => {
                this.idbPagination.page++;
                this.loadIdb(win);
              });
              keyList.appendChild(paginationEl);
            }
          }
          db.close();
        } catch {}
      }
    } catch {
      keyList.innerHTML = `<div class="de-no-keys" style="color:var(--error);">Failed to enumerate databases</div>`;
    }
    if (!keyList.querySelector(".de-key-item")) {
      const noKeys = document.createElement("div");
      noKeys.className = "de-no-keys";
      noKeys.textContent = "Nothing to show";
      keyList.appendChild(noKeys);
    }
  }

  getStorageLabel() {
    if (this.currentTab === "ls") return "localStorage";
    if (this.currentTab === "ss") return "sessionStorage";
    if (this.currentTab === "cookie") return "Cookie";
    return "IDB";
  }

  reloadCurrentTab(win) {
    if (this.currentTab === "ls") this.loadLocalStorage(win);
    else if (this.currentTab === "ss") this.loadSessionStorage(win);
    else if (this.currentTab === "cookie") this.loadCookies(win);
    else this.loadIdb(win);
  }

  setStorageValue(key, val) {
    if (this.currentTab === "ls") os.storage.set(key, val);
    else if (this.currentTab === "ss") sessionStorage.setItem(key, val);
    else if (this.currentTab === "cookie") document.cookie = `${key}=${val}; path=/`;
  }

  removeStorageValue(key) {
    if (this.currentTab === "ls") os.storage.remove(key);
    else if (this.currentTab === "ss") sessionStorage.removeItem(key);
    else if (this.currentTab === "cookie") {
      document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
    }
  }

  renameStorageValue(oldKey, newKey, val) {
    if (this.currentTab === "ls" || this.currentTab === "ss") {
      this.setStorageValue(newKey, val);
      this.removeStorageValue(oldKey);
    } else if (this.currentTab === "cookie") {
      document.cookie = `${newKey}=${val}; path=/`;
      document.cookie = `${oldKey}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
    }
  }

  getStorageValue(key) {
    if (this.currentTab === "ls") return os.storage.get(key);
    if (this.currentTab === "ss") return sessionStorage.getItem(key);
    if (this.currentTab === "cookie") {
      return (
        document.cookie
          .split(";")
          .find((c) => c.trim().startsWith(key + "="))
          ?.split("=")
          .slice(1)
          .join("=") || ""
      );
    }
    return null;
  }

  async handleSave(element) {
    const win = element.closest(".window-content");
    const keyInput = $("#de-key-input", win);
    const valInput = $("#de-val-input", win);
    const key = keyInput.value.trim();
    if (!key) {
      this.showEditorStatus(win, "Key cannot be empty", "var(--error)");
      return;
    }
    const val = valInput.value;
    if (this.currentTab === "idb") {
      if (!this.currentIdbCtx) return;
      try {
        const { db, dbName, storeName, key: origKey } = this.currentIdbCtx;
        const req = indexedDB.open(dbName);
        const freshDb = await new Promise((res, rej) => {
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        });
        const tx = freshDb.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        let toStore;
        try {
          toStore = JSON.parse(val);
        } catch {
          toStore = val;
        }
        await new Promise((res, rej) => {
          const r = store.put(toStore, origKey);
          r.onsuccess = () => res();
          r.onerror = () => rej(r.error);
        });
        freshDb.close();
        this.showEditorStatus(win, "Saved to IDB", "var(--charging)");
      } catch (e) {
        this.showEditorStatus(win, "Save failed: " + e.message, "var(--error)");
      }
    } else {
      this.setStorageValue(key, val);
      this.showEditorStatus(win, `Saved to ${this.getStorageLabel()}`, "var(--charging)");
      this.reloadCurrentTab(win);
    }
  }

  async handleDelete(element) {
    const win = element.closest(".window-content");
    const keyInput = $("#de-key-input", win);
    const emptyState = $("#de-empty-state", win);
    const editorArea = $("#de-editor-area", win);
    const key = keyInput.value.trim();
    if (!key) return;

    if (this.currentTab === "idb") {
      if (!this.currentIdbCtx) return;
      try {
        const { dbName, storeName, key: origKey } = this.currentIdbCtx;
        const req = indexedDB.open(dbName);
        const freshDb = await new Promise((res, rej) => {
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        });
        const tx = freshDb.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        await new Promise((res, rej) => {
          const r = store.delete(origKey);
          r.onsuccess = () => res();
          r.onerror = () => rej(r.error);
        });
        freshDb.close();
        this.showEditorStatus(win, "Deleted from IDB", "var(--brand)");
      } catch (e) {
        this.showEditorStatus(win, "Delete failed: " + e.message, "var(--error)");
        return;
      }
    } else {
      this.removeStorageValue(key);
      this.showEditorStatus(win, "Deleted", "var(--brand)");
    }
    if (editorArea) editorArea.style.display = "none";
    if (emptyState) emptyState.style.display = "flex";
    this.activeKeyEl = null;
    this.reloadCurrentTab(win);
  }

  async handleRename(element) {
    const win = element.closest(".window-content");
    const keyInput = $("#de-key-input", win);
    const valInput = $("#de-val-input", win);
    const oldKey = keyInput.value.trim();
    if (!oldKey) return;
    const newKey = await os.dialog.prompt("Rename Key", "Enter new key name:", oldKey, "Rename");
    if (!newKey || newKey === oldKey) return;

    const val = valInput.value;
    if (this.currentTab === "idb") {
      this.showEditorStatus(win, "Rename not supported for IndexedDB", "var(--error)");
    } else {
      this.renameStorageValue(oldKey, newKey, val);
      this.showEditorStatus(win, "Renamed", "var(--charging)");
      this.reloadCurrentTab(win);
    }
  }

  async handleCopyKey(element) {
    const win = element.closest(".window-content");
    const keyInput = $("#de-key-input", win);
    const key = keyInput.value.trim();
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      this.showEditorStatus(win, "Key copied", "var(--charging)");
    } catch {
      this.showEditorStatus(win, "Copy failed", "var(--error)");
    }
  }

  async handleCopyVal(element) {
    const win = element.closest(".window-content");
    const valInput = $("#de-val-input", win);
    const val = valInput.value;
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      this.showEditorStatus(win, "Value copied", "var(--charging)");
    } catch {
      this.showEditorStatus(win, "Copy failed", "var(--error)");
    }
  }

  handlePrettify(element) {
    const win = element.closest(".window-content");
    const valInput = $("#de-val-input", win);
    const val = valInput.value;
    try {
      const parsed = JSON.parse(val);
      valInput.value = JSON.stringify(parsed, null, 2);
      this.showJsonError(win, "");
      this.showEditorStatus(win, "Prettified", "var(--charging)");
    } catch (e) {
      this.showJsonError(win, "Invalid JSON: " + e.message);
    }
  }

  handleValidate(element) {
    const win = element.closest(".window-content");
    const valInput = $("#de-val-input", win);
    const val = valInput.value;
    try {
      JSON.parse(val);
      this.showJsonError(win, "");
      this.showEditorStatus(win, "Valid JSON", "var(--charging)");
    } catch (e) {
      this.showJsonError(win, "Invalid JSON: " + e.message);
    }
  }

  async handleBulkDelete(element) {
    const win = element.closest(".window-content");
    if (this.selectedKeys.size === 0) return;
    const confirmed = await os.dialog.confirm(
      "Delete Items",
      `Delete ${this.selectedKeys.size} selected items?`,
      "Delete",
      "Cancel"
    );
    if (!confirmed) return;

    this.selectedKeys.forEach((item) => this.removeStorageValue(item.key));
    this.showEditorStatus(win, `Deleted ${this.selectedKeys.size} items`, "var(--charging)");
    this.reloadCurrentTab(win);
    os.notify.send("Storage Editor", `Deleted ${this.selectedKeys.size} items`, {
      type: "info",
      duration: 3000,
      icon: "fas fa-trash"
    });
    this.selectedKeys.clear();
    this.updateSelectedCount(win);
  }

  async handleBulkExport(element) {
    const win = element.closest(".window-content");
    if (this.selectedKeys.size === 0) return;
    const exportData = {};
    this.selectedKeys.forEach((item) => {
      exportData[item.key] = this.getStorageValue(item.key);
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    downloadBlob(blob, `storage-export-${Date.now()}.json`);
    this.showEditorStatus(win, `Exported ${this.selectedKeys.size} items`, "var(--charging)");
    os.notify.send("Storage Editor", `Exported ${this.selectedKeys.size} items`, {
      type: "success",
      duration: 3000,
      icon: "fas fa-download"
    });
  }
}
