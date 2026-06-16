import { BaseApp } from "../core/BaseApp.js";
import { WindowHelper } from "../utils/WindowHelper.js";
import { PersistenceTypes } from "../runtime/AppSchema.js";
import { os } from "../os/index.js";
import { showPrompt, showAlert, showConfirm } from "../shared/dialogs.js";
import { $, $$, bindEvent } from "../shared/domUtils.js";
import parseTorrent from "parse-torrent";

export class TorrentClientApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this.client = null;
    this.activeTorrents = new Map();
    this.selectedTorrents = new Set();
    this.currentCategory = "all";
    this.torrentHistory = [];
    this.downloadQueue = [];
    this.activeDownloadCount = 0;
    this.maxConcurrentDownloads = 3;
    this.seedRatios = new Map();
    this.trayRegistered = false;
    this.selectedDetailsHash = null;
    this.loadHistory();
  }

  getDeclarativeSchema(opts) {
    return {
      id: "torrent-client-win",
      name: "Torrent Client",
      icon: "fas fa-download",
      singleton: true,
      windows: [
        {
          id: "torrent-client-win",
          title: "Torrent Client",
          size: ["900px", "600px"],
          icon: "fas fa-download",
          ui: `
      <div class="window-content">
        <div class="torrent-main-layout">
          <div class="torrent-sidebar">
            <div class="torrent-sidebar-item active" data-category="all"><i class="fas fa-layer-group"></i> All</div>
            <div class="torrent-sidebar-item" data-category="downloading"><i class="fas fa-download"></i> Downloading</div>
            <div class="torrent-sidebar-item" data-category="queued"><i class="fas fa-list-ol"></i> Queued <span class="torrent-queue-badge" id="torrent-queue-badge" style="display:none"></span></div>
            <div class="torrent-sidebar-item" data-category="completed"><i class="fas fa-check-circle"></i> Completed</div>
            <div class="torrent-sidebar-item" data-category="paused"><i class="fas fa-pause-circle"></i> Paused</div>
            <div class="torrent-sidebar-item" data-category="history"><i class="fas fa-history"></i> History</div>
          </div>
          <div class="torrent-content">
            <div class="torrent-toolbar">
              <button class="torrent-tool-btn" id="torrent-add-btn" title="Add magnet link"><i class="fas fa-plus"></i> Add</button>
              <button class="torrent-tool-btn" id="torrent-file-btn" title="Add from .torrent file"><i class="fas fa-file-import"></i> Open File</button>
              <input type="file" id="torrent-file-input" accept=".torrent" style="display: none;" />
              <div class="torrent-toolbar-separator"></div>
              <button class="torrent-tool-btn" id="torrent-pause-btn" title="Pause selected"><i class="fas fa-pause"></i></button>
              <button class="torrent-tool-btn" id="torrent-resume-btn" title="Resume selected"><i class="fas fa-play"></i></button>
              <button class="torrent-tool-btn torrent-tool-btn--danger" id="torrent-delete-btn" title="Remove selected"><i class="fas fa-trash"></i></button>
              <div class="torrent-toolbar-separator"></div>
              <button class="torrent-tool-btn" id="torrent-tray-btn" title="Keep downloading in tray"><i class="fas fa-thumbtack"></i> Minimize</button>
            </div>
            <div class="torrent-list-container">
              <div class="torrent-list-header">
                <input type="checkbox" id="torrent-select-all" class="torrent-checkbox" />
                <span class="torrent-header-name">Name</span>
                <span>Size</span>
                <span>Progress</span>
                <span>Status</span>
                <span>Down</span>
                <span>Up</span>
                <span>Ratio</span>
              </div>
              <div class="torrent-list" id="torrent-list"></div>
            </div>
            <div class="torrent-details-panel" id="torrent-details-panel">
              <div class="torrent-details-empty">Select a torrent to see details</div>
            </div>
          </div>
        </div>
      </div>`,
          events: {}
        }
      ],
      state: {
        initial: { activeTorrents: {} },
        persistence: PersistenceTypes.MEMORY
      },
      actions: {
        initTorrentClient: (payload, event, win) => {
          this._bindStaticEvents(win);
          this.initWebTorrent();
          this.renderTorrentList();
          this.registerTray();
        }
      },
      onMount: "initTorrentClient"
    };
  }

  _bindStaticEvents(win) {
    const q = (sel) => win.querySelector(sel);
    const qa = (sel) => Array.from(win.querySelectorAll(sel));

    qa(".torrent-sidebar-item").forEach((item) => {
      bindEvent(item, "click", (e) => {
        e.stopPropagation();
        const category = item.dataset.category;
        this.currentCategory = category;
        qa(".torrent-sidebar-item").forEach((el) => el.classList.remove("active"));
        item.classList.add("active");
        this.renderTorrentList();
      });
    });

    bindEvent(q("#torrent-add-btn"), "click", async (e) => {
      e.stopPropagation();
      const magnetUri = await showPrompt("Add Torrent", "Paste a magnet link or info hash:");
      if (magnetUri) this.addTorrent(magnetUri.trim());
    });

    bindEvent(q("#torrent-file-btn"), "click", (e) => {
      e.stopPropagation();
      q("#torrent-file-input").click();
    });

    bindEvent(q("#torrent-file-input"), "change", (e) => {
      e.stopPropagation();
      const input = q("#torrent-file-input");
      if (input.files.length > 0) {
        this.addTorrentFile(input.files[0]);
        input.value = "";
      }
    });

    bindEvent(q("#torrent-pause-btn"), "click", (e) => {
      e.stopPropagation();
      this.pauseSelectedTorrents();
    });

    bindEvent(q("#torrent-resume-btn"), "click", (e) => {
      e.stopPropagation();
      this.resumeSelectedTorrents();
    });

    bindEvent(q("#torrent-delete-btn"), "click", (e) => {
      e.stopPropagation();
      this.deleteSelectedTorrents();
    });

    bindEvent(q("#torrent-tray-btn"), "click", (e) => {
      e.stopPropagation();
      this.minimizeToTray();
    });

    bindEvent(q("#torrent-select-all"), "change", (e) => {
      e.stopPropagation();
      this.selectedTorrents.clear();
      if (e.target.checked) {
        this.getFilteredTorrents().forEach((t) => this.selectedTorrents.add(t.infoHash));
      }
      this.renderTorrentList();
    });
  }

  registerTray() {
    if (this.trayRegistered) return;
    const winId = "torrent-client-win";
    os.tray.register(winId, "fas fa-download", "Torrent Client", {
      showInTray: true,
      onClick: () => os.tray.restoreFromTray(winId),
      onQuit: () => this.destroyClient(),
      contextMenuItems: [
        {
          label: "Open Torrent Client",
          icon: "fas fa-external-link-alt",
          action: () => os.tray.restoreFromTray(winId)
        },
        {
          label: "Pause All",
          icon: "fas fa-pause",
          action: () => this.pauseAllTorrents()
        },
        {
          label: "Resume All",
          icon: "fas fa-play",
          action: () => this.resumeAllTorrents()
        }
      ]
    });
    this.trayRegistered = true;
  }

  minimizeToTray() {
    const winId = "torrent-client-win";
    const activeCount = Array.from(this.activeTorrents.values()).filter((t) => !t.done && !t.paused).length;
    const queueCount = this.downloadQueue.length;
    const label =
      activeCount > 0
        ? `Torrent Client - ${activeCount} downloading${queueCount > 0 ? `, ${queueCount} queued` : ""}`
        : "Torrent Client";
    os.tray.updateLabel(winId, label);
    os.tray.sendToTray(winId);
    this.notify(
      "Torrent Client",
      "Running in tray - downloads continue in the background",
      "info",
      3000,
      "fas fa-thumbtack"
    );
  }

  pauseAllTorrents() {
    this.activeTorrents.forEach((torrent) => {
      if (!torrent.done && !torrent.paused) {
        torrent.pause();
        torrent.paused = true;
      }
    });
    this.renderTorrentList();
    os.tray.updateLabel("torrent-client-win", "Torrent Client - all paused");
  }

  resumeAllTorrents() {
    this.activeTorrents.forEach((torrent) => {
      if (!torrent.done && torrent.paused) {
        torrent.resume();
        torrent.paused = false;
      }
    });
    this.renderTorrentList();
  }

  destroyClient() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this.activeTorrents.clear();
    this.downloadQueue = [];
    this.trayRegistered = false;
  }

  loadHistory() {
    try {
      const history = os.storage.get("torrentHistory");
      if (history) {
        this.torrentHistory = JSON.parse(history);
      }
    } catch (err) {
      console.error("Failed to load torrent history:", err);
    }
  }

  saveHistory() {
    try {
      os.storage.set("torrentHistory", JSON.stringify(this.torrentHistory));
    } catch (err) {
      console.error("Failed to save torrent history:", err);
    }
  }

  addToHistory(torrent) {
    const ratio = torrent.downloaded > 0 ? torrent.uploaded / torrent.downloaded : 0;
    const historyItem = {
      name: torrent.name,
      infoHash: torrent.infoHash,
      size: torrent.length,
      downloaded: torrent.downloaded,
      uploaded: torrent.uploaded,
      ratio: parseFloat(ratio.toFixed(3)),
      completedAt: new Date().toISOString()
    };
    this.seedRatios.set(torrent.infoHash, { uploaded: torrent.uploaded, downloaded: torrent.downloaded, ratio });
    this.torrentHistory.unshift(historyItem);
    if (this.torrentHistory.length > 100) {
      this.torrentHistory = this.torrentHistory.slice(0, 100);
    }
    this.saveHistory();
  }

  updateSeedRatio(infoHash) {
    const torrent = this.activeTorrents.get(infoHash);
    if (!torrent) return;
    const ratio = torrent.downloaded > 0 ? torrent.uploaded / torrent.downloaded : 0;
    this.seedRatios.set(infoHash, { uploaded: torrent.uploaded, downloaded: torrent.downloaded, ratio });
  }

  getSeedRatio(infoHash) {
    const data = this.seedRatios.get(infoHash);
    if (!data) return 0;
    return data.ratio;
  }

  getFilteredTorrents() {
    const torrents = Array.from(this.activeTorrents.values());
    switch (this.currentCategory) {
      case "downloading":
        return torrents.filter((t) => !t.done && !t.paused);
      case "completed":
        return torrents.filter((t) => t.done);
      case "paused":
        return torrents.filter((t) => t.paused);
      case "history":
      case "queued":
        return [];
      default:
        return torrents;
    }
  }

  pauseSelectedTorrents() {
    if (this.selectedTorrents.size === 0) {
      showAlert("No Selection", "Select torrents to pause.");
      return;
    }
    this.selectedTorrents.forEach((infoHash) => {
      const torrent = this.activeTorrents.get(infoHash);
      if (torrent && !torrent.done) {
        torrent.pause();
        torrent.paused = true;
      }
    });
    this.notify(
      "Torrent Client",
      `Paused ${this.selectedTorrents.size} torrent(s)`,
      "info",
      3000,
      "fas fa-pause-circle"
    );
    this.renderTorrentList();
  }

  resumeSelectedTorrents() {
    if (this.selectedTorrents.size === 0) {
      showAlert("No Selection", "Select torrents to resume.");
      return;
    }
    this.selectedTorrents.forEach((infoHash) => {
      const torrent = this.activeTorrents.get(infoHash);
      if (torrent && !torrent.done) {
        torrent.resume();
        torrent.paused = false;
      }
    });
    this.notify(
      "Torrent Client",
      `Resumed ${this.selectedTorrents.size} torrent(s)`,
      "info",
      3000,
      "fas fa-play-circle"
    );
    this.renderTorrentList();
  }

  deleteSelectedTorrents() {
    if (this.selectedTorrents.size === 0) {
      showAlert("No Selection", "Select torrents to remove.");
      return;
    }
    const confirmed = showConfirm("Remove Torrents", `Remove ${this.selectedTorrents.size} torrent(s)?`);
    confirmed.then((ok) => {
      if (ok) {
        this.selectedTorrents.forEach((infoHash) => {
          const torrent = this.activeTorrents.get(infoHash);
          if (torrent) {
            torrent.destroy(() => {
              this.activeTorrents.delete(infoHash);
            });
          }
        });
        this.selectedTorrents.clear();
        if (this.selectedDetailsHash && !this.activeTorrents.has(this.selectedDetailsHash)) {
          this.selectedDetailsHash = null;
          const panel = $("#torrent-details-panel");
          if (panel) panel.innerHTML = '<div class="torrent-details-empty">Select a torrent to see details</div>';
        }
        this.renderTorrentList();
        this.notify("Torrent Client", "Removed selected torrents", "info", 3000, "fas fa-trash");
      }
    });
  }

  async initWebTorrent() {
    if (!this.client) {
      try {
        const WebTorrent = await this.loadWebTorrentFromCDN();
        this.client = new WebTorrent();
        this.client.on("error", (err) => {
          console.error("WebTorrent error:", err);
          this.notify("Torrent Client", `Error: ${err.message}`, "error", 5000, "fas fa-exclamation-triangle");
        });
      } catch (err) {
        console.error("Failed to load WebTorrent:", err);
        this.notify(
          "Torrent Client",
          "Failed to load WebTorrent library",
          "error",
          5000,
          "fas fa-exclamation-triangle"
        );
      }
    }
  }

  async loadWebTorrentFromCDN() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/webtorrent@0.108.6/webtorrent.debug.js";
      script.crossOrigin = "anonymous";
      script.onload = () => {
        if (typeof window.WebTorrent !== "undefined") {
          resolve(window.WebTorrent);
        } else {
          reject(new Error("WebTorrent not available on window"));
        }
      };
      script.onerror = (err) => {
        console.error("Script load error:", err);
        reject(new Error("Failed to load WebTorrent script"));
      };
      document.head.appendChild(script);
    });
  }

  addTorrent(magnetUri) {
    if (!this.client) {
      this.initWebTorrent().then(() => this.addTorrent(magnetUri));
      return;
    }
    const existing = this.client.get(magnetUri);
    if (existing) {
      this.notify("Torrent Client", "This torrent is already added", "info", 3000, "fas fa-info-circle");
      return;
    }
    showConfirm("Save to YukiOS?", "Save files to YukiOS when the download finishes?").then((saveToYukiOS) => {
      this._startDownloadWithOptions({ magnetUri }, saveToYukiOS, null);
    });
  }

  _enqueue(item) {
    if (this.activeDownloadCount < this.maxConcurrentDownloads) {
      this._startDownload(item);
    } else {
      this.downloadQueue.push(item);
      this._updateQueueBadge();
      this.notify(
        "Torrent Client",
        `Queued - ${this.downloadQueue.length} item(s) waiting (max ${this.maxConcurrentDownloads} active)`,
        "info",
        3000,
        "fas fa-list-ol"
      );
      if (this.currentCategory === "queued") this.renderTorrentList();
    }
  }

  _dequeue() {
    this.activeDownloadCount = Math.max(0, this.activeDownloadCount - 1);
    if (this.downloadQueue.length > 0) {
      const next = this.downloadQueue.shift();
      this._updateQueueBadge();
      this._startDownload(next);
    }
  }

  _updateQueueBadge() {
    const badge = $("#torrent-queue-badge");
    if (!badge) return;
    if (this.downloadQueue.length > 0) {
      badge.textContent = this.downloadQueue.length;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
    if (this.currentCategory === "queued") this.renderTorrentList();
  }

  _startDownload(item) {
    this.activeDownloadCount++;
    if (item.magnetUri) {
      this._startMagnet(item.magnetUri);
    } else if (item.parsedTorrent) {
      this._startParsed(item.parsedTorrent);
    }
  }

  _startMagnet(magnetUri) {
    const torrent = this.client.add(magnetUri, (t) => {
      t.paused = false;
      this.activeTorrents.set(t.infoHash, t);
      this.renderTorrentList();
      this.notify("Torrent Client", `Downloading: ${t.name}`, "success", 4000, "fas fa-download");
    });
    this._attachTorrentEvents(torrent);
  }

  _startParsed(parsed) {
    const torrent = this.client.add(parsed, (t) => {
      t.paused = false;
      this.activeTorrents.set(t.infoHash, t);
      this.renderTorrentList();
      this.notify("Torrent Client", `Downloading: ${t.name}`, "success", 4000, "fas fa-download");
    });
    this._attachTorrentEvents(torrent);
  }

  _attachTorrentEvents(torrent) {
    torrent.on("metadata", () => {
      torrent.paused = false;
      this.activeTorrents.set(torrent.infoHash, torrent);
      this.renderTorrentList();
    });

    torrent.on("error", (err) => {
      console.error("Torrent error:", err);
      this.notify("Torrent Client", `Torrent error: ${err.message}`, "error", 5000, "fas fa-exclamation-triangle");
      this._dequeue();
    });

    torrent.on("done", () => {
      this.addToHistory(torrent);
      this.notify("Torrent Client", `Download complete: ${torrent.name}`, "success", 5000, "fas fa-check-circle");
      this.renderTorrentList();
      this._dequeue();
      this._updateTrayLabel();
      this._onTorrentComplete(torrent);
    });

    torrent.on("download", () => {
      this.updateTorrentProgress(torrent.infoHash);
    });

    torrent.on("upload", () => {
      this.updateSeedRatio(torrent.infoHash);
    });
  }

  _updateTrayLabel() {
    if (!this.trayRegistered) return;
    const activeCount = Array.from(this.activeTorrents.values()).filter((t) => !t.done && !t.paused).length;
    const queueCount = this.downloadQueue.length;
    const label =
      activeCount > 0
        ? `Torrent Client - ${activeCount} downloading${queueCount > 0 ? `, ${queueCount} queued` : ""}`
        : "Torrent Client";
    os.tray.updateLabel("torrent-client-win", label);
  }

  _onTorrentComplete(torrent) {
    if (torrent._saveToYukiOS) {
      this.saveToYukiOS(torrent);
    }
  }

  addTorrentFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = parseTorrent(e.target.result);
        if (!this.client) {
          await this.initWebTorrent();
        }
        this._showFileSelectionDialog(parsed);
      } catch (err) {
        console.error("Failed to parse torrent:", err);
        this.notify("Torrent Client", "Failed to parse torrent file", "error", 5000, "fas fa-exclamation-triangle");
      }
    };
    reader.onerror = () => {
      this.notify("Torrent Client", "Failed to read torrent file", "error", 5000, "fas fa-exclamation-triangle");
    };
    reader.readAsArrayBuffer(file);
  }

  _showFileSelectionDialog(parsedTorrent) {
    const files = parsedTorrent.files || [];
    const totalSize = files.reduce((acc, f) => acc + (f.length || 0), 0);

    const filesHtml = files
      .map((f, i) => {
        const size = this.formatSize(f.length || 0);
        const name = f.name || f.path || `File ${i + 1}`;
        return `
        <label class="torrent-file-select-row">
          <input type="checkbox" class="torrent-file-select-cb torrent-checkbox" data-index="${i}" checked />
          <span class="torrent-file-select-name" title="${name}">${name}</span>
          <span class="torrent-file-select-size">${size}</span>
        </label>
      `;
      })
      .join("");

    const overlay = document.createElement("div");
    overlay.className = "torrent-dialog-overlay";
    overlay.innerHTML = `
      <div class="torrent-dialog">
        <div class="torrent-dialog-header">
          <span class="torrent-dialog-title"><i class="fas fa-download"></i> Start Download</span>
          <button class="torrent-dialog-close" id="torrent-dlg-close"><i class="fas fa-times"></i></button>
        </div>
        ${
          files.length > 0
            ? `
          <div class="torrent-dialog-files-label">Select files to download${totalSize > 0 ? " (" + this.formatSize(totalSize) + " total)" : ""}</div>
          <div class="torrent-dialog-files-scroll">${filesHtml}</div>
        `
            : ""
        }
        <div class="torrent-dialog-save-toggle">
          <label class="torrent-dialog-toggle-label">
            <span class="torrent-toggle-switch">
              <input type="checkbox" id="torrent-save-yukios-toggle" checked />
              <span class="torrent-toggle-slider"></span>
            </span>
            Save to YukiOS when done
          </label>
        </div>
        <div class="torrent-dialog-actions">
          <button class="torrent-dialog-btn torrent-dialog-btn--cancel" id="torrent-dlg-cancel">Cancel</button>
          <button class="torrent-dialog-btn torrent-dialog-btn--start" id="torrent-dlg-start"><i class="fas fa-download"></i> Start Download</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    overlay.querySelector("#torrent-dlg-close").addEventListener("click", close);
    overlay.querySelector("#torrent-dlg-cancel").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    overlay.querySelector("#torrent-dlg-start").addEventListener("click", () => {
      const saveToYukiOS = overlay.querySelector("#torrent-save-yukios-toggle").checked;

      const selectedIndices = new Set();
      overlay.querySelectorAll(".torrent-file-select-cb").forEach((cb) => {
        if (cb.checked) selectedIndices.add(parseInt(cb.dataset.index, 10));
      });

      close();
      this._startDownloadWithOptions(
        { parsedTorrent },
        saveToYukiOS,
        selectedIndices.size > 0 ? selectedIndices : null
      );
    });
  }

  _startDownloadWithOptions(item, saveToYukiOS, selectedFileIndices) {
    const wrappedItem = { ...item, saveToYukiOS, selectedFileIndices };
    if (this.activeDownloadCount < this.maxConcurrentDownloads) {
      this._startDownloadItem(wrappedItem);
    } else {
      this.downloadQueue.push(wrappedItem);
      this._updateQueueBadge();
      this.notify(
        "Torrent Client",
        `Queued - ${this.downloadQueue.length} item(s) waiting`,
        "info",
        3000,
        "fas fa-list-ol"
      );
      if (this.currentCategory === "queued") this.renderTorrentList();
    }
  }

  _startDownloadItem(item) {
    this.activeDownloadCount++;
    const startCb = (t) => {
      t.paused = false;
      t._saveToYukiOS = item.saveToYukiOS || false;
      if (item.selectedFileIndices && t.files) {
        t.files.forEach((f, i) => {
          if (!item.selectedFileIndices.has(i)) {
            f.deselect();
          }
        });
      }
      this.activeTorrents.set(t.infoHash, t);
      this.renderTorrentList();
      this.notify("Torrent Client", `Downloading: ${t.name}`, "success", 4000, "fas fa-download");
    };

    let torrent;
    if (item.magnetUri) {
      torrent = this.client.add(item.magnetUri, startCb);
    } else if (item.parsedTorrent) {
      torrent = this.client.add(item.parsedTorrent, startCb);
    }
    if (torrent) this._attachTorrentEvents(torrent);
  }

  renderTorrentList() {
    const list = $("#torrent-list");
    if (!list) return;

    if (this.currentCategory === "history") {
      this.renderHistory(list);
      return;
    }

    if (this.currentCategory === "queued") {
      this.renderQueue(list);
      return;
    }

    const filteredTorrents = this.getFilteredTorrents();

    if (filteredTorrents.length === 0) {
      list.innerHTML = `
        <div class="torrent-empty">
          <div class="torrent-empty-icon"><i class="fas fa-download"></i></div>
          <div class="torrent-empty-title">No torrents here</div>
          <div class="torrent-empty-desc">Add a magnet link or torrent file to get started</div>
        </div>
      `;
      return;
    }

    let html = "";
    for (const torrent of filteredTorrents) {
      const infoHash = torrent.infoHash;
      const progress = Math.round(torrent.progress * 100);
      const downloadSpeed = this.formatSpeed(torrent.downloadSpeed);
      const uploadSpeed = this.formatSpeed(torrent.uploadSpeed);
      const size = this.formatSize(torrent.length);
      const status = torrent.done ? "Completed" : torrent.paused ? "Paused" : "Downloading";
      const isSelected = this.selectedTorrents.has(infoHash);
      const ratio = this.getSeedRatio(infoHash).toFixed(2);
      const isActive = this.selectedDetailsHash === infoHash;

      html += `
        <div class="torrent-row${isActive ? " torrent-row--active" : ""}" data-infohash="${infoHash}">
          <input type="checkbox" class="torrent-checkbox" data-infohash="${infoHash}" ${isSelected ? "checked" : ""} />
          <span class="torrent-name" title="${torrent.name}">${torrent.name}</span>
          <span class="torrent-size">${size}</span>
          <div class="torrent-progress-cell">
            <div class="torrent-progress-bar-small">
              <div class="torrent-progress-fill" style="width: ${progress}%; background: ${torrent.done ? "var(--success, #4caf50)" : "var(--brand)"}"></div>
            </div>
            <span class="torrent-progress-text">${progress}%</span>
          </div>
          <span class="torrent-status torrent-status--${status.toLowerCase()}">${status}</span>
          <span class="torrent-down">${downloadSpeed}</span>
          <span class="torrent-up">${uploadSpeed}</span>
          <span class="torrent-ratio${parseFloat(ratio) >= 1 ? " torrent-ratio--good" : ""}">${ratio}</span>
        </div>
      `;
    }

    list.innerHTML = html;

    $$(".torrent-checkbox", list).forEach((checkbox) => {
      bindEvent(checkbox, "change", (e) => {
        e.stopPropagation();
        const infoHash = checkbox.dataset.infohash;
        if (checkbox.checked) {
          this.selectedTorrents.add(infoHash);
        } else {
          this.selectedTorrents.delete(infoHash);
        }
      });
    });

    $$(".torrent-row", list).forEach((row) => {
      bindEvent(row, "click", (e) => {
        if (e.target.classList.contains("torrent-checkbox")) return;
        this.selectedDetailsHash = row.dataset.infohash;
        $$(".torrent-row", list).forEach((r) => r.classList.remove("torrent-row--active"));
        row.classList.add("torrent-row--active");
        this.showTorrentDetails(row.dataset.infohash);
      });
    });
  }

  renderQueue(list) {
    if (this.downloadQueue.length === 0) {
      list.innerHTML = `
        <div class="torrent-empty">
          <div class="torrent-empty-icon"><i class="fas fa-list-ol"></i></div>
          <div class="torrent-empty-title">Queue is empty</div>
          <div class="torrent-empty-desc">Torrents wait here when ${this.maxConcurrentDownloads} are already active</div>
        </div>
      `;
      return;
    }

    let html = "";
    this.downloadQueue.forEach((item, index) => {
      const label = item.parsedTorrent
        ? item.parsedTorrent.name || "Unknown torrent"
        : item.magnetUri
          ? item.magnetUri.substring(0, 60) + "..."
          : "Unknown";
      html += `
        <div class="torrent-queue-item">
          <span class="torrent-queue-position">#${index + 1}</span>
          <span class="torrent-queue-name" title="${label}">${label}</span>
          <button class="torrent-queue-remove-btn" data-index="${index}" title="Remove from queue"><i class="fas fa-times"></i></button>
        </div>
      `;
    });

    list.innerHTML = html;

    $$(".torrent-queue-remove-btn", list).forEach((btn) => {
      bindEvent(btn, "click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        this.downloadQueue.splice(idx, 1);
        this._updateQueueBadge();
        this.renderQueue(list);
      });
    });
  }

  renderHistory(list) {
    if (this.torrentHistory.length === 0) {
      list.innerHTML = `
        <div class="torrent-empty">
          <div class="torrent-empty-icon"><i class="fas fa-history"></i></div>
          <div class="torrent-empty-title">No history yet</div>
          <div class="torrent-empty-desc">Completed torrents will appear here</div>
        </div>
      `;
      return;
    }

    let html = "";
    for (const item of this.torrentHistory) {
      const size = this.formatSize(item.size);
      const date = new Date(item.completedAt).toLocaleDateString();
      const ratio = typeof item.ratio === "number" ? item.ratio.toFixed(2) : "0.00";
      html += `
        <div class="torrent-history-item">
          <span class="torrent-history-name" title="${item.name}">${item.name}</span>
          <span class="torrent-history-size">${size}</span>
          <span class="torrent-history-ratio${item.ratio >= 1 ? " torrent-ratio--good" : ""}" title="Seed ratio">${ratio}</span>
          <span class="torrent-history-date">${date}</span>
        </div>
      `;
    }

    list.innerHTML = html;
  }

  showTorrentDetails(infoHash) {
    const torrent = this.activeTorrents.get(infoHash);
    if (!torrent) return;

    const panel = $("#torrent-details-panel");
    if (!panel) return;

    const progress = Math.round(torrent.progress * 100);
    const downloadSpeed = this.formatSpeed(torrent.downloadSpeed);
    const uploadSpeed = this.formatSpeed(torrent.uploadSpeed);
    const size = this.formatSize(torrent.length);
    const downloaded = this.formatSize(torrent.downloaded);
    const uploaded = this.formatSize(torrent.uploaded);
    const peers = torrent.numPeers;
    const status = torrent.done ? "completed" : torrent.paused ? "paused" : "downloading";
    const statusLabel = torrent.done ? "Completed" : torrent.paused ? "Paused" : "Downloading";
    const ratio = this.getSeedRatio(infoHash).toFixed(3);

    let contentDiv = panel.querySelector(".torrent-details-content");
    const isSameTorrent = contentDiv && contentDiv.dataset.infohash === infoHash;

    if (!isSameTorrent) {
      let filesHtml = "";
      if (torrent.files && torrent.files.length > 0) {
        const fileRows = torrent.files
          .map((file) => {
            const fileProgress = Math.round(file.progress * 100);
            const fileSize = this.formatSize(file.length);
            return `
            <div class="torrent-file-item">
              <span class="torrent-file-name" title="${file.name}">${file.name}</span>
              <span class="torrent-file-size">${fileSize}</span>
              <div class="torrent-file-progress">
                <div class="torrent-progress-bar-small">
                  <div class="torrent-file-progress-fill" style="width: ${fileProgress}%"></div>
                </div>
                <span class="torrent-progress-text">${fileProgress}%</span>
              </div>
            </div>
          `;
          })
          .join("");

        filesHtml = `
          <div class="torrent-files-section">
            <div class="torrent-files-label">Files (${torrent.files.length})</div>
            <div class="torrent-files-list">${fileRows}</div>
          </div>
        `;
      }

      const actionsPause = !torrent.done
        ? `
        <button class="torrent-detail-action-btn" data-action="${torrent.paused ? "resume" : "pause"}" data-infohash="${infoHash}">
          <i class="fas fa-${torrent.paused ? "play" : "pause"}"></i>
          ${torrent.paused ? "Resume" : "Pause"}
        </button>
      `
        : "";

      const actionsSave = torrent.done
        ? `
        <button class="torrent-detail-action-btn" data-action="computer" data-infohash="${infoHash}">
          <i class="fas fa-download"></i> Save to Computer
        </button>
        <button class="torrent-detail-action-btn" data-action="yukios" data-infohash="${infoHash}">
          <i class="fas fa-hdd"></i> Save to YukiOS
        </button>
      `
        : "";

      panel.innerHTML = `
        <div class="torrent-details-content" data-infohash="${infoHash}">
          <div class="torrent-details-top">
            <div class="torrent-details-name">${torrent.name}</div>
            <span class="torrent-details-status torrent-details-status--${status}">${statusLabel}</span>
          </div>
          <div class="torrent-details-stats">
            <div class="torrent-stat"><span class="torrent-stat-label">Size</span><span class="torrent-stat-value">${size}</span></div>
            <div class="torrent-stat"><span class="torrent-stat-label">Downloaded</span><span class="torrent-stat-value torrent-stat-dl">${downloaded}</span></div>
            <div class="torrent-stat"><span class="torrent-stat-label">Uploaded</span><span class="torrent-stat-value torrent-stat-ul">${uploaded}</span></div>
            <div class="torrent-stat"><span class="torrent-stat-label">Progress</span><span class="torrent-stat-value torrent-stat-progress">${progress}%</span></div>
            <div class="torrent-stat"><span class="torrent-stat-label">Down speed</span><span class="torrent-stat-value torrent-stat-dlspeed">${downloadSpeed}</span></div>
            <div class="torrent-stat"><span class="torrent-stat-label">Up speed</span><span class="torrent-stat-value torrent-stat-ulspeed">${uploadSpeed}</span></div>
            <div class="torrent-stat"><span class="torrent-stat-label">Peers</span><span class="torrent-stat-value torrent-stat-peers">${peers}</span></div>
            <div class="torrent-stat"><span class="torrent-stat-label">Ratio</span><span class="torrent-stat-value torrent-stat-ratio${parseFloat(ratio) >= 1 ? " torrent-ratio--good" : ""}">${ratio}</span></div>
          </div>
          <div class="torrent-detail-hash">${infoHash}</div>
          ${filesHtml}
          <div class="torrent-details-actions">
            ${actionsPause}
            ${actionsSave}
            <button class="torrent-detail-action-btn torrent-detail-action-btn--danger" data-action="delete" data-infohash="${infoHash}">
              <i class="fas fa-trash"></i> Remove
            </button>
          </div>
        </div>
      `;

      $$(".torrent-detail-action-btn", panel).forEach((btn) => {
        bindEvent(btn, "click", () => {
          const action = btn.dataset.action;
          const hash = btn.dataset.infohash;
          const t = this.activeTorrents.get(hash);
          if (!t && action !== "delete") return;

          if (action === "computer") {
            this.saveToComputer(t);
          } else if (action === "yukios") {
            this.saveToYukiOS(t);
          } else if (action === "pause") {
            t.pause();
            t.paused = true;
            this.renderTorrentList();
            this.showTorrentDetails(hash);
          } else if (action === "resume") {
            t.resume();
            t.paused = false;
            this.renderTorrentList();
            this.showTorrentDetails(hash);
          } else if (action === "delete") {
            this.removeTorrent(hash);
            this.selectedDetailsHash = null;
            panel.innerHTML = '<div class="torrent-details-empty">Select a torrent to see details</div>';
          }
        });
      });
    } else {
      const patchText = (sel, val) => {
        const el = panel.querySelector(sel);
        if (el && el.textContent !== val) el.textContent = val;
      };
      patchText(".torrent-stat-dl", downloaded);
      patchText(".torrent-stat-ul", uploaded);
      patchText(".torrent-stat-progress", `${progress}%`);
      patchText(".torrent-stat-dlspeed", downloadSpeed);
      patchText(".torrent-stat-ulspeed", uploadSpeed);
      patchText(".torrent-stat-peers", String(peers));
      patchText(".torrent-stat-ratio", ratio);

      if (torrent.files) {
        torrent.files.forEach((file, i) => {
          const fileProgress = Math.round(file.progress * 100);
          const fills = panel.querySelectorAll(".torrent-file-progress-fill");
          if (fills[i]) fills[i].style.width = `${fileProgress}%`;
          const texts = panel.querySelectorAll(".torrent-file-progress .torrent-progress-text");
          if (texts[i] && texts[i].textContent !== `${fileProgress}%`) texts[i].textContent = `${fileProgress}%`;
        });
      }
    }
  }

  updateTorrentProgress(infoHash) {
    const torrent = this.activeTorrents.get(infoHash);
    if (!torrent) return;

    const row = document.querySelector(`.torrent-row[data-infohash="${infoHash}"]`);
    if (row) {
      const progress = Math.round(torrent.progress * 100);
      const fill = row.querySelector(".torrent-progress-fill");
      const text = row.querySelector(".torrent-progress-text");
      const downEl = row.querySelector(".torrent-down");
      const upEl = row.querySelector(".torrent-up");

      if (fill) fill.style.width = `${progress}%`;
      if (text && text.textContent !== `${progress}%`) text.textContent = `${progress}%`;
      if (downEl) downEl.textContent = this.formatSpeed(torrent.downloadSpeed);
      if (upEl) upEl.textContent = this.formatSpeed(torrent.uploadSpeed);
    }

    const panel = $("#torrent-details-panel");
    if (panel) {
      const content = panel.querySelector(".torrent-details-content");
      if (content && content.dataset.infohash === infoHash) {
        this.showTorrentDetails(infoHash);
      }
    }
  }

  removeTorrent(infoHash) {
    const torrent = this.activeTorrents.get(infoHash);
    if (torrent) {
      torrent.destroy(() => {
        this.activeTorrents.delete(infoHash);
        this.renderTorrentList();
        this.notify("Torrent Client", "Torrent removed", "info", 3000, "fas fa-trash");
      });
    }
  }

  formatSize(bytes) {
    if (!bytes || bytes < 1024) return (bytes || 0) + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  formatSpeed(bytesPerSecond) {
    if (!bytesPerSecond || bytesPerSecond === 0) return "0 B/s";
    const units = ["B/s", "KB/s", "MB/s", "GB/s"];
    const k = 1024;
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + " " + units[i];
  }

  async saveToComputer(torrent) {
    if (!torrent.done) {
      showAlert("Not Ready", "Wait for the download to finish before saving.");
      return;
    }
    const files = torrent.files;
    if (!files || files.length === 0) {
      showAlert("No Files", "No files found in this torrent.");
      return;
    }
    for (const file of files) {
      await this.downloadFile(file);
    }
    if (files.length > 1) {
      this.notify(
        "Torrent Client",
        `Saved ${files.length} file(s) to your computer`,
        "success",
        4000,
        "fas fa-check-circle"
      );
    }
  }

  async downloadFile(file) {
    return new Promise((resolve, reject) => {
      file.getBlob((err, blob) => {
        if (err) {
          reject(err);
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      });
    });
  }

  async saveToYukiOS(torrent) {
    if (!torrent.done) {
      showAlert("Not Ready", "Wait for the download to finish before saving.");
      return;
    }
    const explorerApp = this.services.explorerApp;
    if (!explorerApp) {
      showAlert("Error", "Explorer app not available.");
      return;
    }
    const savePath = await new Promise((resolve) => {
      explorerApp.openDirectoryDialog((path) => resolve(path));
    });
    if (!savePath) return;

    const files = torrent.files;
    if (!files || files.length === 0) {
      showAlert("No Files", "No files found in this torrent.");
      return;
    }

    try {
      await os.fs.mkdir(savePath);
      let savedCount = 0;
      for (const file of files) {
        const filePath = `${savePath}/${file.name}`;
        await this.saveFileToYukiOS(file, filePath);
        savedCount++;
      }
      this.notify(
        "Torrent Client",
        `Saved ${savedCount} file(s) to ${savePath.join("/")}`,
        "success",
        4000,
        "fas fa-check-circle"
      );
    } catch (err) {
      console.error("Error saving to YukiOS:", err);
      showAlert("Save Failed", `Failed to save files: ${err.message}`);
    }
  }

  async saveFileToYukiOS(file, filePath) {
    return new Promise((resolve, reject) => {
      file.getBlob(async (err, blob) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          await os.fs.writeBinaryFile(filePath, uint8Array);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  onClose(winId) {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this.activeTorrents.clear();
  }
}
