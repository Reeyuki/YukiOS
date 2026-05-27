import { BaseApp } from "./core/BaseApp.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { showConfirm, showPrompt } from "./shared/dialogs.js";

export class DataEditorApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this.openWindows = new Set();
    this.cssLoaded = false;
  }

  open(options = {}) {
    const winId = "yukios-data-editor";
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const win = this.wm.createWindow(winId, "Storage Editor", "1000px", "650px");
    win.innerHTML = this._buildHTML();
    this.windowHelper.mountWindow(win, winId, "Storage Editor", "fas fa-database");
    this.openWindows.add(winId);

    this._bindControls(win);
  }

  onClose(winId) {
    this.openWindows.delete(winId);
  }

  _buildHTML() {
    return `
      <div class="window-header">
        <span>Storage Editor</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="window-content data-editor-window">
        <div class="de-tabs">
          <button id="de-tab-ls" class="de-tab de-tab-active"><i class="fas fa-hdd"></i> localStorage</button>
          <button id="de-tab-ss" class="de-tab"><i class="fas fa-memory"></i> sessionStorage</button>
          <button id="de-tab-cookie" class="de-tab"><i class="fas fa-cookie"></i> Cookies</button>
          <button id="de-tab-idb" class="de-tab"><i class="fas fa-server"></i> IndexedDB</button>
        </div>
        <div class="de-main">
          <div class="de-list-panel">
            <div class="de-search-container">
              <input id="de-search" placeholder="Search keys and values..."/>
            </div>
            <div class="de-select-bar">
              <input type="checkbox" id="de-select-all"/>
              <span>Select All</span>
              <span id="de-selected-count">0 selected</span>
            </div>
            <div id="de-key-list" class="de-key-list"></div>
            <div class="de-list-actions">
              <button id="de-add-key"><i class="fas fa-plus"></i> New</button>
              <button id="de-bulk-delete" class="de-delete" disabled><i class="fas fa-trash"></i> Delete</button>
              <button id="de-bulk-export" disabled><i class="fas fa-download"></i> Export</button>
            </div>
          </div>
          <div class="de-edit-panel">
            <div id="de-empty-state" class="de-empty-state">
              <i class="fas fa-table-cells"></i>
              <span>Select a key to inspect and edit</span>
            </div>
            <div id="de-editor-area" class="de-editor-area">
              <div class="de-key-row">
                <input id="de-key-input" placeholder="Key name"/>
                <span id="de-key-type"></span>
                <span id="de-key-size"></span>
              </div>
              <div class="de-json-toolbar">
                <button id="de-prettify-btn"><i class="fas fa-align-left"></i> Prettify</button>
                <button id="de-validate-btn"><i class="fas fa-check"></i> Validate</button>
                <span id="de-json-error"></span>
              </div>
              <textarea id="de-val-input" spellcheck="false"></textarea>
              <div class="de-editor-actions">
                <button id="de-copy-key-btn"><i class="fas fa-copy"></i> Copy Key</button>
                <button id="de-copy-val-btn"><i class="fas fa-copy"></i> Copy Value</button>
                <button id="de-rename-btn" class="de-rename"><i class="fas fa-edit"></i> Rename</button>
                <div class="de-spacer"></div>
                <button id="de-save-btn" class="de-save"><i class="fas fa-save"></i> Save</button>
                <button id="de-delete-btn" class="de-delete"><i class="fas fa-trash"></i> Delete</button>
                <span id="de-status"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _bindControls(win) {
    const tabLs = win.querySelector("#de-tab-ls");
    const tabSs = win.querySelector("#de-tab-ss");
    const tabCookie = win.querySelector("#de-tab-cookie");
    const tabIdb = win.querySelector("#de-tab-idb");
    const keyList = win.querySelector("#de-key-list");
    const searchInput = win.querySelector("#de-search");
    const emptyState = win.querySelector("#de-empty-state");
    const editorArea = win.querySelector("#de-editor-area");
    const keyInput = win.querySelector("#de-key-input");
    const keyType = win.querySelector("#de-key-type");
    const keySize = win.querySelector("#de-key-size");
    const valInput = win.querySelector("#de-val-input");
    const saveBtn = win.querySelector("#de-save-btn");
    const deleteBtn = win.querySelector("#de-delete-btn");
    const statusEl = win.querySelector("#de-status");
    const addKeyBtn = win.querySelector("#de-add-key");
    const selectAllCheckbox = win.querySelector("#de-select-all");
    const selectedCountEl = win.querySelector("#de-selected-count");
    const bulkDeleteBtn = win.querySelector("#de-bulk-delete");
    const bulkExportBtn = win.querySelector("#de-bulk-export");
    const prettifyBtn = win.querySelector("#de-prettify-btn");
    const validateBtn = win.querySelector("#de-validate-btn");
    const jsonErrorEl = win.querySelector("#de-json-error");
    const copyKeyBtn = win.querySelector("#de-copy-key-btn");
    const copyValBtn = win.querySelector("#de-copy-val-btn");
    const renameBtn = win.querySelector("#de-rename-btn");

    let currentTab = "ls";
    let currentIdbCtx = null;
    let activeKeyEl = null;
    let statusTimer = null;
    let selectedKeys = new Set();
    let idbPagination = { page: 1, pageSize: 50, total: 0 };

    const showEditorStatus = (msg, color = "var(--text-secondary)") => {
      statusEl.textContent = msg;
      statusEl.style.color = color;
      statusEl.style.opacity = "1";
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => {
        statusEl.style.opacity = "0";
      }, 2000);
    };

    const showJsonError = (msg) => {
      jsonErrorEl.textContent = msg;
      jsonErrorEl.classList.toggle("visible", !!msg);
    };

    const updateSelectedCount = () => {
      selectedCountEl.textContent = `${selectedKeys.size} selected`;
      bulkDeleteBtn.disabled = selectedKeys.size === 0;
      bulkExportBtn.disabled = selectedKeys.size === 0;
    };

    const getValueType = (value) => {
      if (value === null) return "null";
      if (Array.isArray(value)) return "array";
      return typeof value;
    };

    const formatBytes = (bytes) => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    const getValueSize = (value) => {
      return new Blob([String(value)]).size;
    };

    const detectValueType = (str) => {
      try {
        const parsed = JSON.parse(str);
        return getValueType(parsed);
      } catch {
        return "string";
      }
    };

    const selectKey = (keyEl, keyName, value, typeLabel, idbCtx = null) => {
      if (activeKeyEl) activeKeyEl.classList.remove("active");
      activeKeyEl = keyEl;
      if (keyEl) keyEl.classList.add("active");
      currentIdbCtx = idbCtx;
      emptyState.style.display = "none";
      editorArea.style.display = "flex";
      keyInput.value = keyName;
      keyType.textContent = typeLabel;
      keySize.textContent = formatBytes(getValueSize(value ?? ""));
      try {
        const parsed = JSON.parse(value);
        valInput.value = JSON.stringify(parsed, null, 2);
        keyType.textContent = `${typeLabel} (${getValueType(parsed)})`;
      } catch {
        valInput.value = value ?? "";
        keyType.textContent = `${typeLabel} (string)`;
      }
      showJsonError("");
    };

    const buildKeyItem = (label, onclick, keyValue = null, storeContext = null) => {
      const container = document.createElement("div");
      container.className = "de-key-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", (e) => {
        e.stopPropagation();
        const keyId = storeContext ? `${storeContext.dbName}/${storeContext.storeName}/${label}` : label;
        if (checkbox.checked) {
          selectedKeys.add({ key: label, value: keyValue, context: storeContext });
        } else {
          selectedKeys.delete(keyId);
        }
        updateSelectedCount();
      });
      checkbox.addEventListener("click", (e) => e.stopPropagation());

      const labelEl = document.createElement("span");
      labelEl.title = label;
      labelEl.textContent = label;

      container.appendChild(checkbox);
      container.appendChild(labelEl);

      container.addEventListener("click", () => onclick(container));

      return container;
    };

    const loadLocalStorage = () => {
      keyList.innerHTML = "";
      selectedKeys.clear();
      selectAllCheckbox.checked = false;
      emptyState.style.display = "flex";
      editorArea.style.display = "none";
      activeKeyEl = null;
      updateSelectedCount();
      const q = searchInput.value.toLowerCase();
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys.sort().forEach((key) => {
        const value = localStorage.getItem(key);
        if (q && !key.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) return;
        const el = buildKeyItem(
          key,
          (container) => {
            selectKey(container, key, value, "localStorage");
          },
          value
        );
        keyList.appendChild(el);
      });
      if (!keyList.children.length) {
        keyList.innerHTML = `<div style="padding:10px;color:rgba(255,255,255,0.25);font-size:0.8em;text-align:center;">No keys found</div>`;
      }
    };

    const loadSessionStorage = () => {
      keyList.innerHTML = "";
      selectedKeys.clear();
      selectAllCheckbox.checked = false;
      emptyState.style.display = "flex";
      editorArea.style.display = "none";
      activeKeyEl = null;
      updateSelectedCount();
      const q = searchInput.value.toLowerCase();
      const keys = [];
      for (let i = 0; i < sessionStorage.length; i++) keys.push(sessionStorage.key(i));
      keys.sort().forEach((key) => {
        const value = sessionStorage.getItem(key);
        if (q && !key.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) return;
        const el = buildKeyItem(
          key,
          (container) => {
            selectKey(container, key, value, "sessionStorage");
          },
          value
        );
        keyList.appendChild(el);
      });
      if (!keyList.children.length) {
        keyList.innerHTML = `<div style="padding:10px;color:rgba(255,255,255,0.25);font-size:0.8em;text-align:center;">No keys found</div>`;
      }
    };

    const loadCookies = () => {
      keyList.innerHTML = "";
      selectedKeys.clear();
      selectAllCheckbox.checked = false;
      emptyState.style.display = "flex";
      editorArea.style.display = "none";
      activeKeyEl = null;
      updateSelectedCount();
      const q = searchInput.value.toLowerCase();
      const cookies = document.cookie
        .split(";")
        .map((c) => c.trim())
        .filter((c) => c);
      cookies.sort().forEach((cookie) => {
        const [key, ...valueParts] = cookie.split("=");
        const value = valueParts.join("=");
        if (q && !key.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) return;
        const el = buildKeyItem(
          key,
          (container) => {
            selectKey(container, key, value, "Cookie");
          },
          value
        );
        keyList.appendChild(el);
      });
      if (!keyList.children.length) {
        keyList.innerHTML = `<div style="padding:10px;color:rgba(255,255,255,0.25);font-size:0.8em;text-align:center;">No cookies found</div>`;
      }
    };

    const loadIdb = async () => {
      keyList.innerHTML = `<div style="padding:10px;color:rgba(255,255,255,0.35);font-size:0.8em;text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;
      emptyState.style.display = "flex";
      editorArea.style.display = "none";
      activeKeyEl = null;
      selectedKeys.clear();
      selectAllCheckbox.checked = false;
      updateSelectedCount();
      const q = searchInput.value.toLowerCase();
      keyList.innerHTML = "";
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

              idbPagination.total = allKeys.length;
              const startIdx = (idbPagination.page - 1) * idbPagination.pageSize;
              const endIdx = startIdx + idbPagination.pageSize;
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
                const el = buildKeyItem(
                  `${storeName} › ${keyStr}`,
                  (container) => {
                    selectKey(container, keyStr, valStr, `IDB: ${dbName}/${storeName}`, storeContext);
                  },
                  valStr,
                  storeContext
                );
                keyList.appendChild(el);
              }

              if (idbPagination.total > idbPagination.pageSize) {
                const paginationEl = document.createElement("div");
                paginationEl.className = "de-pagination";
                paginationEl.innerHTML = `
                  <span>Page ${idbPagination.page} of ${Math.ceil(idbPagination.total / idbPagination.pageSize)}</span>
                  <button class="de-prev-page" ${idbPagination.page === 1 ? "disabled" : ""}>Prev</button>
                  <button class="de-next-page" ${endIdx >= idbPagination.total ? "disabled" : ""}>Next</button>
                `;
                paginationEl.querySelector(".de-prev-page").addEventListener("click", () => {
                  idbPagination.page--;
                  loadIdb();
                });
                paginationEl.querySelector(".de-next-page").addEventListener("click", () => {
                  idbPagination.page++;
                  loadIdb();
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
        noKeys.textContent = "No entries found";
        keyList.appendChild(noKeys);
      }
    };

    const setActiveTab = (tab) => {
      currentTab = tab;
      idbPagination = { page: 1, pageSize: 50, total: 0 };
      tabLs.classList.toggle("de-tab-active", tab === "ls");
      tabSs.classList.toggle("de-tab-active", tab === "ss");
      tabCookie.classList.toggle("de-tab-active", tab === "cookie");
      tabIdb.classList.toggle("de-tab-active", tab === "idb");
      emptyState.style.display = "flex";
      editorArea.style.display = "none";
      activeKeyEl = null;
      if (tab === "ls") loadLocalStorage();
      else if (tab === "ss") loadSessionStorage();
      else if (tab === "cookie") loadCookies();
      else loadIdb();
    };

    tabLs.addEventListener("click", () => setActiveTab("ls"));
    tabSs.addEventListener("click", () => setActiveTab("ss"));
    tabCookie.addEventListener("click", () => setActiveTab("cookie"));
    tabIdb.addEventListener("click", () => setActiveTab("idb"));
    searchInput.addEventListener("input", () => {
      if (currentTab === "ls") loadLocalStorage();
      else if (currentTab === "ss") loadSessionStorage();
      else if (currentTab === "cookie") loadCookies();
      else loadIdb();
    });

    selectAllCheckbox.addEventListener("change", () => {
      const checkboxes = keyList.querySelectorAll('input[type="checkbox"]');
      selectedKeys.clear();
      checkboxes.forEach((cb) => {
        cb.checked = selectAllCheckbox.checked;
        if (cb.checked) {
          const container = cb.closest("div");
          const labelEl = container.querySelector("span");
          const key = labelEl.textContent;
          selectedKeys.add({ key, value: null, context: currentIdbCtx });
        }
      });
      updateSelectedCount();
    });

    saveBtn.addEventListener("click", async () => {
      const key = keyInput.value.trim();
      if (!key) {
        showEditorStatus("Key cannot be empty", "#ff4d4f");
        return;
      }
      const val = valInput.value;
      if (currentTab === "ls") {
        localStorage.setItem(key, val);
        showEditorStatus("Saved to localStorage", "#52c41a");
        loadLocalStorage();
      } else if (currentTab === "ss") {
        sessionStorage.setItem(key, val);
        showEditorStatus("Saved to sessionStorage", "#52c41a");
        loadSessionStorage();
      } else if (currentTab === "cookie") {
        document.cookie = `${key}=${val}; path=/`;
        showEditorStatus("Saved cookie", "#52c41a");
        loadCookies();
      } else if (currentIdbCtx) {
        try {
          const { db, dbName, storeName, key: origKey } = currentIdbCtx;
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
          showEditorStatus("Saved to IDB", "#52c41a");
        } catch (e) {
          showEditorStatus("Save failed: " + e.message, "#ff4d4f");
        }
      }
    });

    deleteBtn.addEventListener("click", async () => {
      const key = keyInput.value.trim();
      if (!key) return;
      if (currentTab === "ls") {
        localStorage.removeItem(key);
        showEditorStatus("Deleted", "#faad14");
        editorArea.style.display = "none";
        emptyState.style.display = "flex";
        activeKeyEl = null;
        loadLocalStorage();
      } else if (currentTab === "ss") {
        sessionStorage.removeItem(key);
        showEditorStatus("Deleted", "#faad14");
        editorArea.style.display = "none";
        emptyState.style.display = "flex";
        activeKeyEl = null;
        loadSessionStorage();
      } else if (currentTab === "cookie") {
        document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
        showEditorStatus("Deleted cookie", "#faad14");
        editorArea.style.display = "none";
        emptyState.style.display = "flex";
        activeKeyEl = null;
        loadCookies();
      } else if (currentIdbCtx) {
        try {
          const { dbName, storeName, key: origKey } = currentIdbCtx;
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
          editorArea.style.display = "none";
          emptyState.style.display = "flex";
          activeKeyEl = null;
          showEditorStatus("Deleted from IDB", "#faad14");
          loadIdb();
        } catch (e) {
          showEditorStatus("Delete failed: " + e.message, "#ff4d4f");
        }
      }
    });

    renameBtn.addEventListener("click", async () => {
      const oldKey = keyInput.value.trim();
      if (!oldKey) return;
      const newKey = await showPrompt("Rename Key", "Enter new key name:", oldKey, "Rename");
      if (!newKey || newKey === oldKey) return;

      const val = valInput.value;
      if (currentTab === "ls") {
        localStorage.setItem(newKey, val);
        localStorage.removeItem(oldKey);
        showEditorStatus("Renamed", "#52c41a");
        loadLocalStorage();
      } else if (currentTab === "ss") {
        sessionStorage.setItem(newKey, val);
        sessionStorage.removeItem(oldKey);
        showEditorStatus("Renamed", "#52c41a");
        loadSessionStorage();
      } else if (currentTab === "cookie") {
        document.cookie = `${newKey}=${val}; path=/`;
        document.cookie = `${oldKey}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
        showEditorStatus("Renamed cookie", "#52c41a");
        loadCookies();
      } else {
        showEditorStatus("Rename not supported for IndexedDB", "#ff4d4f");
      }
    });

    copyKeyBtn.addEventListener("click", async () => {
      const key = keyInput.value.trim();
      if (!key) return;
      try {
        await navigator.clipboard.writeText(key);
        showEditorStatus("Key copied", "#52c41a");
      } catch {
        showEditorStatus("Copy failed", "#ff4d4f");
      }
    });

    copyValBtn.addEventListener("click", async () => {
      const val = valInput.value;
      if (!val) return;
      try {
        await navigator.clipboard.writeText(val);
        showEditorStatus("Value copied", "#52c41a");
      } catch {
        showEditorStatus("Copy failed", "#ff4d4f");
      }
    });

    prettifyBtn.addEventListener("click", () => {
      const val = valInput.value;
      try {
        const parsed = JSON.parse(val);
        valInput.value = JSON.stringify(parsed, null, 2);
        showJsonError("");
        showEditorStatus("Prettified", "#52c41a");
      } catch (e) {
        showJsonError("Invalid JSON: " + e.message);
      }
    });

    validateBtn.addEventListener("click", () => {
      const val = valInput.value;
      try {
        JSON.parse(val);
        showJsonError("");
        showEditorStatus("Valid JSON", "#52c41a");
      } catch (e) {
        showJsonError("Invalid JSON: " + e.message);
      }
    });

    bulkDeleteBtn.addEventListener("click", async () => {
      if (selectedKeys.size === 0) return;
      const confirmed = await showConfirm(
        "Delete Items",
        `Delete ${selectedKeys.size} selected items?`,
        "Delete",
        "Cancel"
      );
      if (!confirmed) return;

      if (currentTab === "ls") {
        selectedKeys.forEach((item) => localStorage.removeItem(item.key));
        showEditorStatus(`Deleted ${selectedKeys.size} items`, "#52c41a");
        loadLocalStorage();
      } else if (currentTab === "ss") {
        selectedKeys.forEach((item) => sessionStorage.removeItem(item.key));
        showEditorStatus(`Deleted ${selectedKeys.size} items`, "#52c41a");
        loadSessionStorage();
      } else if (currentTab === "cookie") {
        selectedKeys.forEach((item) => {
          document.cookie = `${item.key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
        });
        showEditorStatus(`Deleted ${selectedKeys.size} cookies`, "#52c41a");
        loadCookies();
      }
      this.notify("Storage Editor", `Deleted ${selectedKeys.size} items`, "info", 3000, "fas fa-trash");
      selectedKeys.clear();
      updateSelectedCount();
    });

    bulkExportBtn.addEventListener("click", async () => {
      if (selectedKeys.size === 0) return;
      const exportData = {};
      selectedKeys.forEach((item) => {
        if (currentTab === "ls") {
          exportData[item.key] = localStorage.getItem(item.key);
        } else if (currentTab === "ss") {
          exportData[item.key] = sessionStorage.getItem(item.key);
        } else if (currentTab === "cookie") {
          exportData[item.key] =
            document.cookie
              .split(";")
              .find((c) => c.trim().startsWith(item.key + "="))
              ?.split("=")
              .slice(1)
              .join("=") || "";
        }
      });
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `storage-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showEditorStatus(`Exported ${selectedKeys.size} items`, "#52c41a");
      this.notify("Storage Editor", `Exported ${selectedKeys.size} items`, "success", 3000, "fas fa-download");
    });

    addKeyBtn.addEventListener("click", () => {
      emptyState.style.display = "none";
      editorArea.style.display = "flex";
      if (activeKeyEl) activeKeyEl.style.background = "";
      activeKeyEl = null;
      currentIdbCtx = null;
      keyInput.value = "";
      valInput.value = "";
      keyType.textContent =
        currentTab === "ls"
          ? "localStorage"
          : currentTab === "ss"
            ? "sessionStorage"
            : currentTab === "cookie"
              ? "Cookie"
              : "IDB";
      keySize.textContent = "0 B";
      keyInput.focus();
    });

    setActiveTab("ls");
  }
}
