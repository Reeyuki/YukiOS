import "../styles/dataeditor.css";
import { $, $$, bindEvent, setText, setHTML, toggleClass } from "../shared/domUtils.js";

import { BaseApp, PersistenceTypes, os } from "../framework.js";
export class DataEditorApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
    this.cssLoaded = false;
    this.currentTab = "ls";
    this.currentIdbCtx = null;
    this.activeKeyEl = null;
    this.statusTimer = null;
    this.selectedKeys = new Set();
    this.idbPagination = { page: 1, pageSize: 50, total: 0 };
  }

  getDeclarativeSchema(opts) {
    return {
      id: "dataEditor-declarative",
      name: "Storage Editor",
      icon: "fas fa-database",
      windows: [
        {
          id: "yukios-data-editor",
          title: "Storage Editor",
          size: ["1000px", "650px"],
          icon: "fas fa-database",
          ui: {
            type: "element",
            tag: "div",
            props: {
              className: "window-content data-editor-window"
            },
            children: [
              {
                type: "element",
                tag: "div",
                props: {
                  className: "de-tabs"
                },
                children: [
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      id: "de-tab-ls",
                      className: "de-tab de-tab-active"
                    },
                    children: [
                      {
                        type: "element",
                        tag: "i",
                        props: { className: "fas fa-hdd" }
                      },
                      {
                        type: "element",
                        tag: "span",
                        props: { textContent: " localStorage" }
                      }
                    ],
                    events: {
                      click: {
                        type: "custom:setTab",
                        payload: "ls",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      id: "de-tab-ss",
                      className: "de-tab"
                    },
                    children: [
                      {
                        type: "element",
                        tag: "i",
                        props: { className: "fas fa-memory" }
                      },
                      {
                        type: "element",
                        tag: "span",
                        props: { textContent: " sessionStorage" }
                      }
                    ],
                    events: {
                      click: {
                        type: "custom:setTab",
                        payload: "ss",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      id: "de-tab-cookie",
                      className: "de-tab"
                    },
                    children: [
                      {
                        type: "element",
                        tag: "i",
                        props: { className: "fas fa-cookie" }
                      },
                      {
                        type: "element",
                        tag: "span",
                        props: { textContent: " Cookies" }
                      }
                    ],
                    events: {
                      click: {
                        type: "custom:setTab",
                        payload: "cookie",
                        stopPropagation: true
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "button",
                    props: {
                      id: "de-tab-idb",
                      className: "de-tab"
                    },
                    children: [
                      {
                        type: "element",
                        tag: "i",
                        props: { className: "fas fa-server" }
                      },
                      {
                        type: "element",
                        tag: "span",
                        props: { textContent: " IndexedDB" }
                      }
                    ],
                    events: {
                      click: {
                        type: "custom:setTab",
                        payload: "idb",
                        stopPropagation: true
                      }
                    }
                  }
                ]
              },
              {
                type: "element",
                tag: "div",
                props: {
                  className: "de-main"
                },
                children: [
                  {
                    type: "element",
                    tag: "div",
                    props: {
                      className: "de-list-panel"
                    },
                    children: [
                      {
                        type: "element",
                        tag: "div",
                        props: {
                          className: "de-search-container"
                        },
                        children: [
                          {
                            type: "element",
                            tag: "input",
                            props: {
                              id: "de-search",
                              placeholder: "Search keys and values..."
                            },
                            events: {
                              input: {
                                type: "custom:search",
                                stopPropagation: true
                              }
                            }
                          }
                        ]
                      },
                      {
                        type: "element",
                        tag: "div",
                        props: {
                          className: "de-select-bar"
                        },
                        children: [
                          {
                            type: "element",
                            tag: "input",
                            props: {
                              id: "de-select-all",
                              type: "checkbox"
                            },
                            events: {
                              change: {
                                type: "custom:selectAll",
                                stopPropagation: true
                              }
                            }
                          },
                          {
                            type: "element",
                            tag: "span",
                            props: { textContent: "Select All" }
                          },
                          {
                            type: "element",
                            tag: "span",
                            props: {
                              id: "de-selected-count",
                              textContent: "0 selected"
                            }
                          }
                        ]
                      },
                      {
                        type: "element",
                        tag: "div",
                        props: {
                          id: "de-key-list",
                          className: "de-key-list"
                        }
                      },
                      {
                        type: "element",
                        tag: "div",
                        props: {
                          className: "de-list-actions"
                        },
                        children: [
                          {
                            type: "element",
                            tag: "button",
                            props: {
                              id: "de-add-key"
                            },
                            children: [
                              {
                                type: "element",
                                tag: "i",
                                props: { className: "fas fa-plus" }
                              },
                              {
                                type: "element",
                                tag: "span",
                                props: { textContent: " New" }
                              }
                            ],
                            events: {
                              click: {
                                type: "custom:addKey",
                                stopPropagation: true
                              }
                            }
                          },
                          {
                            type: "element",
                            tag: "button",
                            props: {
                              id: "de-bulk-delete",
                              className: "de-delete",
                              disabled: true
                            },
                            children: [
                              {
                                type: "element",
                                tag: "i",
                                props: { className: "fas fa-trash" }
                              },
                              {
                                type: "element",
                                tag: "span",
                                props: { textContent: " Delete" }
                              }
                            ],
                            events: {
                              click: {
                                type: "custom:bulkDelete",
                                stopPropagation: true
                              }
                            }
                          },
                          {
                            type: "element",
                            tag: "button",
                            props: {
                              id: "de-bulk-export",
                              disabled: true
                            },
                            children: [
                              {
                                type: "element",
                                tag: "i",
                                props: { className: "fas fa-download" }
                              },
                              {
                                type: "element",
                                tag: "span",
                                props: { textContent: " Export" }
                              }
                            ],
                            events: {
                              click: {
                                type: "custom:bulkExport",
                                stopPropagation: true
                              }
                            }
                          }
                        ]
                      }
                    ]
                  },
                  {
                    type: "element",
                    tag: "div",
                    props: {
                      className: "de-edit-panel"
                    },
                    children: [
                      {
                        type: "element",
                        tag: "div",
                        props: {
                          id: "de-empty-state",
                          className: "de-empty-state"
                        },
                        children: [
                          {
                            type: "element",
                            tag: "i",
                            props: { className: "fas fa-table-cells" }
                          },
                          {
                            type: "element",
                            tag: "span",
                            props: { textContent: "Select a key to inspect and edit" }
                          }
                        ]
                      },
                      {
                        type: "element",
                        tag: "div",
                        props: {
                          id: "de-editor-area",
                          className: "de-editor-area"
                        },
                        children: [
                          {
                            type: "element",
                            tag: "div",
                            props: {
                              className: "de-key-row"
                            },
                            children: [
                              {
                                type: "element",
                                tag: "input",
                                props: {
                                  id: "de-key-input",
                                  placeholder: "Key name"
                                }
                              },
                              {
                                type: "element",
                                tag: "span",
                                props: {
                                  id: "de-key-type"
                                }
                              },
                              {
                                type: "element",
                                tag: "span",
                                props: {
                                  id: "de-key-size"
                                }
                              }
                            ]
                          },
                          {
                            type: "element",
                            tag: "div",
                            props: {
                              className: "de-json-toolbar"
                            },
                            children: [
                              {
                                type: "element",
                                tag: "button",
                                props: {
                                  id: "de-prettify-btn"
                                },
                                children: [
                                  {
                                    type: "element",
                                    tag: "i",
                                    props: { className: "fas fa-align-left" }
                                  },
                                  {
                                    type: "element",
                                    tag: "span",
                                    props: { textContent: " Prettify" }
                                  }
                                ],
                                events: {
                                  click: {
                                    type: "custom:prettify",
                                    stopPropagation: true
                                  }
                                }
                              },
                              {
                                type: "element",
                                tag: "button",
                                props: {
                                  id: "de-validate-btn"
                                },
                                children: [
                                  {
                                    type: "element",
                                    tag: "i",
                                    props: { className: "fas fa-check" }
                                  },
                                  {
                                    type: "element",
                                    tag: "span",
                                    props: { textContent: " Validate" }
                                  }
                                ],
                                events: {
                                  click: {
                                    type: "custom:validate",
                                    stopPropagation: true
                                  }
                                }
                              },
                              {
                                type: "element",
                                tag: "span",
                                props: {
                                  id: "de-json-error"
                                }
                              }
                            ]
                          },
                          {
                            type: "element",
                            tag: "textarea",
                            props: {
                              id: "de-val-input",
                              spellcheck: "false"
                            }
                          },
                          {
                            type: "element",
                            tag: "div",
                            props: {
                              className: "de-editor-actions"
                            },
                            children: [
                              {
                                type: "element",
                                tag: "button",
                                props: {
                                  id: "de-copy-key-btn"
                                },
                                children: [
                                  {
                                    type: "element",
                                    tag: "i",
                                    props: { className: "fas fa-copy" }
                                  },
                                  {
                                    type: "element",
                                    tag: "span",
                                    props: { textContent: " Copy Key" }
                                  }
                                ],
                                events: {
                                  click: {
                                    type: "custom:copyKey",
                                    stopPropagation: true
                                  }
                                }
                              },
                              {
                                type: "element",
                                tag: "button",
                                props: {
                                  id: "de-copy-val-btn"
                                },
                                children: [
                                  {
                                    type: "element",
                                    tag: "i",
                                    props: { className: "fas fa-copy" }
                                  },
                                  {
                                    type: "element",
                                    tag: "span",
                                    props: { textContent: " Copy Value" }
                                  }
                                ],
                                events: {
                                  click: {
                                    type: "custom:copyVal",
                                    stopPropagation: true
                                  }
                                }
                              },
                              {
                                type: "element",
                                tag: "button",
                                props: {
                                  id: "de-rename-btn",
                                  className: "de-rename"
                                },
                                children: [
                                  {
                                    type: "element",
                                    tag: "i",
                                    props: { className: "fas fa-edit" }
                                  },
                                  {
                                    type: "element",
                                    tag: "span",
                                    props: { textContent: " Rename" }
                                  }
                                ],
                                events: {
                                  click: {
                                    type: "custom:rename",
                                    stopPropagation: true
                                  }
                                }
                              },
                              {
                                type: "element",
                                tag: "div",
                                props: {
                                  className: "de-spacer"
                                }
                              },
                              {
                                type: "element",
                                tag: "button",
                                props: {
                                  id: "de-save-btn",
                                  className: "de-save"
                                },
                                children: [
                                  {
                                    type: "element",
                                    tag: "i",
                                    props: { className: "fas fa-save" }
                                  },
                                  {
                                    type: "element",
                                    tag: "span",
                                    props: { textContent: " Save" }
                                  }
                                ],
                                events: {
                                  click: {
                                    type: "custom:save",
                                    stopPropagation: true
                                  }
                                }
                              },
                              {
                                type: "element",
                                tag: "button",
                                props: {
                                  id: "de-delete-btn",
                                  className: "de-delete"
                                },
                                children: [
                                  {
                                    type: "element",
                                    tag: "i",
                                    props: { className: "fas fa-trash" }
                                  },
                                  {
                                    type: "element",
                                    tag: "span",
                                    props: { textContent: " Delete" }
                                  }
                                ],
                                events: {
                                  click: {
                                    type: "custom:delete",
                                    stopPropagation: true
                                  }
                                }
                              },
                              {
                                type: "element",
                                tag: "span",
                                props: {
                                  id: "de-status"
                                }
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          events: {}
        }
      ],
      state: {
        initial: {
          currentTab: "ls",
          selectedKeys: []
        },
        persistence: PersistenceTypes.MEMORY
      },
      actions: {
        _appInstance: this,
        setTab: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          app.currentTab = payload;
          app.idbPagination = { page: 1, pageSize: 50, total: 0 };

          const win = element.closest(".window-content");
          const tabLs = $("#de-tab-ls", win);
          const tabSs = $("#de-tab-ss", win);
          const tabCookie = $("#de-tab-cookie", win);
          const tabIdb = $("#de-tab-idb", win);

          if (tabLs) toggleClass(tabLs, "de-tab-active", payload === "ls");
          if (tabSs) toggleClass(tabSs, "de-tab-active", payload === "ss");
          if (tabCookie) toggleClass(tabCookie, "de-tab-active", payload === "cookie");
          if (tabIdb) toggleClass(tabIdb, "de-tab-active", payload === "idb");

          const emptyState = $("#de-empty-state", win);
          const editorArea = $("#de-editor-area", win);
          if (emptyState) emptyState.style.display = "flex";
          if (editorArea) editorArea.style.display = "none";
          app.activeKeyEl = null;

          if (payload === "ls") app.loadLocalStorage(win);
          else if (payload === "ss") app.loadSessionStorage(win);
          else if (payload === "cookie") app.loadCookies(win);
          else app.loadIdb(win);
        },
        search: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          const win = element.closest(".window-content");
          if (app.currentTab === "ls") app.loadLocalStorage(win);
          else if (app.currentTab === "ss") app.loadSessionStorage(win);
          else if (app.currentTab === "cookie") app.loadCookies(win);
          else app.loadIdb(win);
        },
        selectAll: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          const win = element.closest(".window-content");
          const keyList = $("#de-key-list", win);
          const checkboxes = $$('input[type="checkbox"]', keyList);
          app.selectedKeys.clear();
          checkboxes.forEach((cb) => {
            cb.checked = element.checked;
            if (cb.checked) {
              const container = cb.closest("div");
              const labelEl = container.querySelector("span");
              const key = labelEl.textContent;
              app.selectedKeys.add({ key, value: null, context: app.currentIdbCtx });
            }
          });
          app.updateSelectedCount(win);
        },
        addKey: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          const win = element.closest(".window-content");
          const emptyState = $("#de-empty-state", win);
          const editorArea = $("#de-editor-area", win);
          const keyInput = $("#de-key-input", win);
          const valInput = $("#de-val-input", win);
          const keyType = $("#de-key-type", win);
          const keySize = $("#de-key-size", win);

          if (emptyState) emptyState.style.display = "none";
          if (editorArea) editorArea.style.display = "flex";
          if (app.activeKeyEl) app.activeKeyEl.style.background = "";
          app.activeKeyEl = null;
          app.currentIdbCtx = null;
          if (keyInput) keyInput.value = "";
          if (valInput) valInput.value = "";
          if (keyType)
            keyType.textContent =
              app.currentTab === "ls"
                ? "localStorage"
                : app.currentTab === "ss"
                  ? "sessionStorage"
                  : app.currentTab === "cookie"
                    ? "Cookie"
                    : "IDB";
          if (keySize) keySize.textContent = "0 B";
          if (keyInput) keyInput.focus();
        },
        save: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          app.handleSave(element);
        },
        delete: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          app.handleDelete(element);
        },
        rename: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          app.handleRename(element);
        },
        copyKey: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          app.handleCopyKey(element);
        },
        copyVal: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          app.handleCopyVal(element);
        },
        prettify: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          app.handlePrettify(element);
        },
        validate: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          app.handleValidate(element);
        },
        bulkDelete: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          app.handleBulkDelete(element);
        },
        bulkExport: (payload, event, element, state, actionExecutor) => {
          const app = actionExecutor.appInstance;
          app.handleBulkExport(element);
        }
      },
      onMount: (win, state, actionExecutor) => {
        const app = actionExecutor.appInstance;
        app.loadLocalStorage(win);
      }
    };
  }

  onClose(winId) {
    this.openWindows.delete(winId);
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

  formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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
    if (keySize) keySize.textContent = this.formatBytes(this.getValueSize(value ?? ""));
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

  loadLocalStorage(win) {
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
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.sort().forEach((key) => {
      const value = localStorage.getItem(key);
      if (q && !key.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) return;
      const el = this.buildKeyItem(
        win,
        key,
        (container) => {
          this.selectKey(win, container, key, value, "localStorage");
        },
        value
      );
      keyList.appendChild(el);
    });
    if (!keyList.children.length) {
      keyList.innerHTML = `<div style="padding:10px;color:rgba(255,255,255,0.25);font-size:0.8em;text-align:center;">No keys stored yet</div>`;
    }
  }

  loadSessionStorage(win) {
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
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) keys.push(sessionStorage.key(i));
    keys.sort().forEach((key) => {
      const value = sessionStorage.getItem(key);
      if (q && !key.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) return;
      const el = this.buildKeyItem(
        win,
        key,
        (container) => {
          this.selectKey(win, container, key, value, "sessionStorage");
        },
        value
      );
      keyList.appendChild(el);
    });
    if (!keyList.children.length) {
      keyList.innerHTML = `<div style="padding:10px;color:rgba(255,255,255,0.25);font-size:0.8em;text-align:center;">No keys stored yet</div>`;
    }
  }

  loadCookies(win) {
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
    const cookies = document.cookie
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c);
    cookies.sort().forEach((cookie) => {
      const [key, ...valueParts] = cookie.split("=");
      const value = valueParts.join("=");
      if (q && !key.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) return;
      const el = this.buildKeyItem(
        win,
        key,
        (container) => {
          this.selectKey(win, container, key, value, "Cookie");
        },
        value
      );
      keyList.appendChild(el);
    });
    if (!keyList.children.length) {
      keyList.innerHTML = `<div style="padding:10px;color:rgba(255,255,255,0.25);font-size:0.8em;text-align:center;">No cookies here</div>`;
    }
  }

  async loadIdb(win) {
    const keyList = $("#de-key-list", win);
    const searchInput = $("#de-search", win);
    const selectAllCheckbox = $("#de-select-all", win);
    const emptyState = $("#de-empty-state", win);
    const editorArea = $("#de-editor-area", win);

    setHTML(
      keyList,
      `<div style="padding:10px;color:rgba(255,255,255,0.35);font-size:0.8em;text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`
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

  async handleSave(element) {
    const win = element.closest(".window-content");
    const keyInput = $("#de-key-input", win);
    const valInput = $("#de-val-input", win);

    const key = keyInput.value.trim();
    if (!key) {
      this.showEditorStatus(win, "Key cannot be empty", "#ff4d4f");
      return;
    }
    const val = valInput.value;
    if (this.currentTab === "ls") {
      localStorage.setItem(key, val);
      this.showEditorStatus(win, "Saved to localStorage", "#52c41a");
      this.loadLocalStorage(win);
    } else if (this.currentTab === "ss") {
      sessionStorage.setItem(key, val);
      this.showEditorStatus(win, "Saved to sessionStorage", "#52c41a");
      this.loadSessionStorage(win);
    } else if (this.currentTab === "cookie") {
      document.cookie = `${key}=${val}; path=/`;
      this.showEditorStatus(win, "Saved cookie", "#52c41a");
      this.loadCookies(win);
    } else if (this.currentIdbCtx) {
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
        this.showEditorStatus(win, "Saved to IDB", "#52c41a");
      } catch (e) {
        this.showEditorStatus(win, "Save failed: " + e.message, "#ff4d4f");
      }
    }
  }

  async handleDelete(element) {
    const win = element.closest(".window-content");
    const keyInput = $("#de-key-input", win);
    const emptyState = $("#de-empty-state", win);
    const editorArea = $("#de-editor-area", win);

    const key = keyInput.value.trim();
    if (!key) return;
    if (this.currentTab === "ls") {
      localStorage.removeItem(key);
      this.showEditorStatus(win, "Deleted", "#faad14");
      if (editorArea) editorArea.style.display = "none";
      if (emptyState) emptyState.style.display = "flex";
      this.activeKeyEl = null;
      this.loadLocalStorage(win);
    } else if (this.currentTab === "ss") {
      sessionStorage.removeItem(key);
      this.showEditorStatus(win, "Deleted", "#faad14");
      if (editorArea) editorArea.style.display = "none";
      if (emptyState) emptyState.style.display = "flex";
      this.activeKeyEl = null;
      this.loadSessionStorage(win);
    } else if (this.currentTab === "cookie") {
      document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      this.showEditorStatus(win, "Deleted cookie", "#faad14");
      if (editorArea) editorArea.style.display = "none";
      if (emptyState) emptyState.style.display = "flex";
      this.activeKeyEl = null;
      this.loadCookies(win);
    } else if (this.currentIdbCtx) {
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
        if (editorArea) editorArea.style.display = "none";
        if (emptyState) emptyState.style.display = "flex";
        this.activeKeyEl = null;
        this.showEditorStatus(win, "Deleted from IDB", "#faad14");
        this.loadIdb(win);
      } catch (e) {
        this.showEditorStatus(win, "Delete failed: " + e.message, "#ff4d4f");
      }
    }
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
    if (this.currentTab === "ls") {
      localStorage.setItem(newKey, val);
      localStorage.removeItem(oldKey);
      this.showEditorStatus(win, "Renamed", "#52c41a");
      this.loadLocalStorage(win);
    } else if (this.currentTab === "ss") {
      sessionStorage.setItem(newKey, val);
      sessionStorage.removeItem(oldKey);
      this.showEditorStatus(win, "Renamed", "#52c41a");
      this.loadSessionStorage(win);
    } else if (this.currentTab === "cookie") {
      document.cookie = `${newKey}=${val}; path=/`;
      document.cookie = `${oldKey}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      this.showEditorStatus(win, "Renamed cookie", "#52c41a");
      this.loadCookies(win);
    } else {
      this.showEditorStatus(win, "Rename not supported for IndexedDB", "#ff4d4f");
    }
  }

  async handleCopyKey(element) {
    const win = element.closest(".window-content");
    const keyInput = $("#de-key-input", win);
    const key = keyInput.value.trim();
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      this.showEditorStatus(win, "Key copied", "#52c41a");
    } catch {
      this.showEditorStatus(win, "Copy failed", "#ff4d4f");
    }
  }

  async handleCopyVal(element) {
    const win = element.closest(".window-content");
    const valInput = $("#de-val-input", win);
    const val = valInput.value;
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      this.showEditorStatus(win, "Value copied", "#52c41a");
    } catch {
      this.showEditorStatus(win, "Copy failed", "#ff4d4f");
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
      this.showEditorStatus(win, "Prettified", "#52c41a");
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
      this.showEditorStatus(win, "Valid JSON", "#52c41a");
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

    if (this.currentTab === "ls") {
      this.selectedKeys.forEach((item) => localStorage.removeItem(item.key));
      this.showEditorStatus(win, `Deleted ${this.selectedKeys.size} items`, "#52c41a");
      this.loadLocalStorage(win);
    } else if (this.currentTab === "ss") {
      this.selectedKeys.forEach((item) => sessionStorage.removeItem(item.key));
      this.showEditorStatus(win, `Deleted ${this.selectedKeys.size} items`, "#52c41a");
      this.loadSessionStorage(win);
    } else if (this.currentTab === "cookie") {
      this.selectedKeys.forEach((item) => {
        document.cookie = `${item.key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      });
      this.showEditorStatus(win, `Deleted ${this.selectedKeys.size} cookies`, "#52c41a");
      this.loadCookies(win);
    }
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
      if (this.currentTab === "ls") {
        exportData[item.key] = localStorage.getItem(item.key);
      } else if (this.currentTab === "ss") {
        exportData[item.key] = sessionStorage.getItem(item.key);
      } else if (this.currentTab === "cookie") {
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
    this.showEditorStatus(win, `Exported ${this.selectedKeys.size} items`, "#52c41a");
    os.notify.send("Storage Editor", `Exported ${this.selectedKeys.size} items`, {
      type: "success",
      duration: 3000,
      icon: "fas fa-download"
    });
  }
}
