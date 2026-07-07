import "../styles/camera.css";
import { openMediaViewer } from "../fileDisplay.js";
import { FileKind } from "../shared/fileKindDetector.js";

import { formatSize } from "../utils/utils.js";
import { renderSelectMenu, bindSelectMenu, getSelectMenuValue } from "../shared/selectMenu.js";

import { BaseApp, PersistenceTypes, os } from "../framework.js";
export class CameraApp extends BaseApp {
  constructor(services) {
    super(services);
    this.stream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordings = [];
    this.recordingInterval = null;
    this.historyWin = null;
    this._declarativeApp = null;
  }

  getDeclarativeSchema(opts) {
    return {
      id: "camera-win",
      name: "Camera",
      icon: "static/icons/obs.webp",
      windows: [
        {
          id: "camera-win",
          title: "Camera",
          size: ["800px", "600px"],
          icon: "static/icons/obs.webp",
          style: { minWidth: "400px", minHeight: "400px" },
          ui: {
            type: "element",
            tag: "div",
            props: {
              className: "camera-app"
            },
            children: [
              {
                type: "element",
                tag: "div",
                props: {
                  className: "camera-viewfinder"
                },
                children: [
                  {
                    type: "element",
                    tag: "video",
                    props: {
                      id: "camera-video",
                      autoplay: true,
                      playsinline: true
                    }
                  },
                  {
                    type: "element",
                    tag: "div",
                    props: {
                      className: "camera-rec-status"
                    },
                    children: [
                      {
                        type: "element",
                        tag: "span",
                        props: {
                          id: "recording-icon"
                        }
                      },
                      {
                        type: "element",
                        tag: "span",
                        props: {
                          id: "recording-timer"
                        }
                      }
                    ]
                  },
                  {
                    type: "element",
                    tag: "div",
                    props: {
                      className: "camera-mode-indicator",
                      id: "mode-indicator"
                    },
                    text: "Photo"
                  },
                  {
                    type: "element",
                    tag: "div",
                    props: {
                      className: "camera-download-overlay"
                    },
                    children: [
                      {
                        type: "element",
                        tag: "a",
                        props: {
                          id: "download-link",
                          className: "download-link"
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
                  className: "camera-toolbar"
                },
                children: [
                  {
                    type: "element",
                    tag: "div",
                    props: {
                      className: "camera-modes"
                    },
                    children: [
                      {
                        type: "element",
                        tag: "button",
                        props: {
                          className: "cam-mode-btn active",
                          "data-mode": "photo",
                          id: "mode-photo"
                        },
                        events: {
                          click: {
                            type: "custom:modeClick",
                            stopPropagation: true
                          }
                        },
                        children: [
                          {
                            type: "element",
                            tag: "svg",
                            props: {
                              viewBox: "0 0 24 24",
                              width: "18",
                              height: "18",
                              fill: "none",
                              stroke: "currentColor",
                              strokeWidth: "2"
                            },
                            children: [
                              {
                                type: "element",
                                tag: "rect",
                                props: {
                                  x: "3",
                                  y: "6",
                                  width: "18",
                                  height: "12",
                                  rx: "2"
                                }
                              },
                              {
                                type: "element",
                                tag: "circle",
                                props: {
                                  cx: "12",
                                  cy: "12",
                                  r: "3"
                                }
                              },
                              {
                                type: "element",
                                tag: "circle",
                                props: {
                                  cx: "17",
                                  cy: "7",
                                  r: "1",
                                  fill: "currentColor",
                                  stroke: "none"
                                }
                              }
                            ]
                          },
                          {
                            type: "element",
                            tag: "span",
                            text: "Photo"
                          }
                        ]
                      },
                      {
                        type: "element",
                        tag: "button",
                        props: {
                          className: "cam-mode-btn",
                          "data-mode": "video",
                          id: "mode-video"
                        },
                        events: {
                          click: {
                            type: "custom:modeClick",
                            stopPropagation: true
                          }
                        },
                        children: [
                          {
                            type: "element",
                            tag: "svg",
                            props: {
                              viewBox: "0 0 24 24",
                              width: "18",
                              height: "18",
                              fill: "none",
                              stroke: "currentColor",
                              strokeWidth: "2"
                            },
                            children: [
                              {
                                type: "element",
                                tag: "rect",
                                props: {
                                  x: "3",
                                  y: "6",
                                  width: "14",
                                  height: "12",
                                  rx: "2"
                                }
                              },
                              {
                                type: "element",
                                tag: "polygon",
                                props: {
                                  points: "17,10 21,8 21,16 17,14",
                                  fill: "currentColor",
                                  stroke: "none"
                                }
                              }
                            ]
                          },
                          {
                            type: "element",
                            tag: "span",
                            text: "Video"
                          }
                        ]
                      },
                      {
                        type: "element",
                        tag: "button",
                        props: {
                          className: "cam-mode-btn",
                          "data-mode": "screen",
                          id: "mode-screen"
                        },
                        events: {
                          click: {
                            type: "custom:modeClick",
                            stopPropagation: true
                          }
                        },
                        children: [
                          {
                            type: "element",
                            tag: "svg",
                            props: {
                              viewBox: "0 0 24 24",
                              width: "18",
                              height: "18",
                              fill: "none",
                              stroke: "currentColor",
                              strokeWidth: "2"
                            },
                            children: [
                              {
                                type: "element",
                                tag: "rect",
                                props: {
                                  x: "2",
                                  y: "4",
                                  width: "20",
                                  height: "14",
                                  rx: "2"
                                }
                              },
                              {
                                type: "element",
                                tag: "line",
                                props: {
                                  x1: "8",
                                  y1: "21",
                                  x2: "16",
                                  y2: "21"
                                }
                              },
                              {
                                type: "element",
                                tag: "line",
                                props: {
                                  x1: "12",
                                  y1: "18",
                                  x2: "12",
                                  y2: "21"
                                }
                              }
                            ]
                          },
                          {
                            type: "element",
                            tag: "span",
                            text: "Screen"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    type: "element",
                    tag: "div",
                    props: {
                      className: "camera-actions"
                    },
                    children: [
                      {
                        type: "element",
                        tag: "div",
                        props: {
                          className: "cam-actions-side cam-actions-left"
                        },
                        children: [
                          {
                            type: "element",
                            tag: "button",
                            props: {
                              className: "cam-action-btn secondary",
                              id: "open-history-btn",
                              title: "History"
                            },
                            events: {
                              click: {
                                type: "custom:historyClick",
                                stopPropagation: true
                              }
                            },
                            children: [
                              {
                                type: "element",
                                tag: "svg",
                                props: {
                                  viewBox: "0 0 24 24",
                                  width: "20",
                                  height: "20",
                                  fill: "none",
                                  stroke: "currentColor",
                                  strokeWidth: "2"
                                },
                                children: [
                                  {
                                    type: "element",
                                    tag: "path",
                                    props: {
                                      d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"
                                    }
                                  },
                                  {
                                    type: "element",
                                    tag: "path",
                                    props: {
                                      d: "M3 3v9h9"
                                    }
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        type: "element",
                        tag: "button",
                        props: {
                          className: "cam-shutter-btn",
                          id: "shutter-btn"
                        },
                        events: {
                          click: {
                            type: "custom:shutterClick",
                            stopPropagation: true
                          }
                        },
                        children: [
                          {
                            type: "element",
                            tag: "span",
                            props: {
                              className: "shutter-inner"
                            }
                          }
                        ]
                      },
                      {
                        type: "element",
                        tag: "div",
                        props: {
                          className: "cam-actions-side cam-actions-right"
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      ],
      state: {
        initial: {
          currentMode: "photo",
          isRecording: false,
          recordings: [],
          historyFilter: "all",
          historySort: "newest",
          bulkSelectMode: false,
          selectedItems: []
        },
        persistence: PersistenceTypes.NONE
      },
      actions: {
        modeClick: (payload, event, element, state) => {
          const mode = element.dataset.mode;
          const cameraApp = document.querySelector(".camera-app");
          if (!cameraApp) return;
          cameraApp.querySelectorAll(".cam-mode-btn").forEach((b) => b.classList.remove("active"));
          element.classList.add("active");
          state.currentMode = mode;
          cameraApp.querySelector("#mode-indicator").textContent = element.querySelector("span").textContent;
          this.updateShutterButton(state, cameraApp);
        },
        shutterClick: async (payload, event, element, state) => {
          const cameraApp = document.querySelector(".camera-app");
          if (!cameraApp) return;

          const shutterBtn = cameraApp.querySelector("#shutter-btn");
          if (shutterBtn) {
            shutterBtn.classList.add("shutter-snap");
            setTimeout(() => shutterBtn.classList.remove("shutter-snap"), 200);
          }

          if (state.currentMode === "photo") {
            await this.takePhoto(state);
          } else if (state.currentMode === "video") {
            if (!state.isRecording) {
              this.startRecording(state, cameraApp);
            } else {
              this.stopRecording();
            }
          } else if (state.currentMode === "screen") {
            if (!state.isRecording) {
              await this.startScreenRecording(state, cameraApp);
            } else {
              this.stopRecording();
            }
          }
        },
        historyClick: (payload, event, element, state) => {
          const historyWin = os.window.create("history-win", "Recordings History", "45vw", "70vh", {
            icon: "static/icons/obs.webp"
          });

          historyWin.innerHTML = `
            <div class="window-content">
              <div class="history-controls">
                <div class="history-filter">
                  ${renderSelectMenu(
                    "history-type-filter",
                    [
                      { value: "all", label: "All" },
                      { value: "photo", label: "Photos" },
                      { value: "video", label: "Videos" },
                      { value: "screen", label: "Screen" }
                    ],
                    state.historyFilter || "all",
                    "history-filter-select"
                  )}
                  ${renderSelectMenu(
                    "history-sort",
                    [
                      { value: "newest", label: "Newest First" },
                      { value: "oldest", label: "Oldest First" }
                    ],
                    state.historySort || "newest",
                    "history-sort-select"
                  )}
                  <span id="history-count" class="history-count"></span>
                </div>
                <div class="history-actions">
                  <button id="bulk-select-btn" class="history-btn secondary">Bulk Select</button>
                  <button id="delete-selected-btn" class="history-btn danger" style="display: none;">Delete Selected</button>
                </div>
              </div>
              <div id="history-list" class="history-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; padding: 16px; overflow-y: auto; max-height: calc(70vh - 120px);"></div>
              <div class="history-pagination" style="display: flex; justify-content: center; align-items: center; gap: 16px; padding: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
                <button id="prev-page" class="history-btn secondary" disabled>Previous</button>
                <span id="page-info">Page 1 of 1</span>
                <button id="next-page" class="history-btn secondary" disabled>Next</button>
              </div>
            </div>
          `;

          bindSelectMenu(historyWin);

          state.currentPage = 1;
          state.itemsPerPage = 12;

          const typeFilter = historyWin.querySelector("#history-type-filter");
          const sortSelect = historyWin.querySelector("#history-sort");
          const bulkSelectBtn = historyWin.querySelector("#bulk-select-btn");
          const deleteSelectedBtn = historyWin.querySelector("#delete-selected-btn");
          const prevPageBtn = historyWin.querySelector("#prev-page");
          const nextPageBtn = historyWin.querySelector("#next-page");
          const pageInfo = historyWin.querySelector("#page-info");

          typeFilter.addEventListener("change", () => {
            state.currentPage = 1;
            this.renderHistory(state, historyWin);
          });
          sortSelect.addEventListener("change", () => {
            state.currentPage = 1;
            this.renderHistory(state, historyWin);
          });

          bulkSelectBtn.onclick = () => {
            state.bulkSelectMode = !state.bulkSelectMode;
            bulkSelectBtn.textContent = state.bulkSelectMode ? "Cancel Select" : "Bulk Select";
            deleteSelectedBtn.style.display = state.bulkSelectMode ? "block" : "none";
            state.selectedItems = [];
            this.renderHistory(state, historyWin);
          };

          deleteSelectedBtn.onclick = async () => {
            if (state.selectedItems.length === 0) return;
            const confirmed = await os.dialog.confirm(
              "Confirm",
              `Delete ${state.selectedItems.length} selected items?`
            );
            if (!confirmed) return;
            for (const id of state.selectedItems) {
              await this.deleteRecording(id, state);
            }
            state.selectedItems = [];
            this.renderHistory(state, historyWin);
          };

          prevPageBtn.onclick = () => {
            if (state.currentPage > 1) {
              state.currentPage--;
              this.renderHistory(state, historyWin);
            }
          };

          nextPageBtn.onclick = () => {
            const totalPages = Math.ceil(state.recordings.length / state.itemsPerPage);
            if (state.currentPage < totalPages) {
              state.currentPage++;
              this.renderHistory(state, historyWin);
            }
          };

          this.renderHistory(state, historyWin);
        },
        historyFilterChange: (payload, event, element, state) => {
          state.historyFilter = element.value;
          this.renderHistory(state);
        },
        historySortChange: (payload, event, element, state) => {
          state.historySort = element.value;
          this.renderHistory(state);
        },
        bulkSelectClick: (payload, event, element, state) => {
          state.bulkSelectMode = !state.bulkSelectMode;
          element.textContent = state.bulkSelectMode ? "Cancel Select" : "Bulk Select";
          const deleteBtn = document.querySelector("#delete-selected-btn");
          if (deleteBtn) {
            deleteBtn.style.display = state.bulkSelectMode ? "block" : "none";
          }
          state.selectedItems = [];
          this.renderHistory(state);
        },
        deleteSelectedClick: async (payload, event, element, state) => {
          if (state.selectedItems.length === 0) return;
          const confirmed = await os.dialog.confirm("Confirm", `Delete ${state.selectedItems.length} selected items?`);
          if (!confirmed) return;
          for (const id of state.selectedItems) {
            await this.deleteRecording(id, state);
          }
          state.selectedItems = [];
          this.renderHistory(state);
        }
      },
      onMount: "initCamera"
    };
  }

  updateShutterButton(state, cameraApp) {
    const shutterBtn = cameraApp.querySelector("#shutter-btn");
    const inner = shutterBtn.querySelector(".shutter-inner");
    inner.className = "shutter-inner";
    if (state.currentMode === "photo") {
      inner.classList.add("photo");
    } else if (state.currentMode === "video" || state.currentMode === "screen") {
      if (state.isRecording) {
        inner.classList.add("stop");
      } else {
        inner.classList.add("video");
      }
    }
  }

  async initCamera(payload, event, element, state) {
    const cameraApp = document.querySelector(".camera-app");
    if (!cameraApp) {
      console.error("Camera app container not found");
      return;
    }
    this.video = cameraApp.querySelector("#camera-video");
    this.shutterBtn = cameraApp.querySelector("#shutter-btn");
    this.downloadLink = cameraApp.querySelector("#download-link");
    this.recordingIcon = cameraApp.querySelector("#recording-icon");
    this.recordingTimer = cameraApp.querySelector("#recording-timer");
    this.modeIndicator = cameraApp.querySelector("#mode-indicator");

    state.currentMode = "photo";
    state.isRecording = false;

    await this.startCamera();
    this.updateShutterButton(state, cameraApp);
    await this.restoreHistory(state);
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.video.srcObject = this.stream;
    } catch (err) {
      os.notify.send("No camera permission", "Camera access denied or not available.");
      console.error(err);
    }
  }

  async takePhoto(state) {
    const canvas = document.createElement("canvas");
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    canvas.getContext("2d").drawImage(this.video, 0, 0);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

    const fileName = `photo-${Date.now()}.png`;
    await os.fs.writeBinaryFile(["Pictures", "Camera"], fileName, blob, "image", "@content");

    const dataUrl = canvas.toDataURL("image/png");
    this.downloadLink.href = dataUrl;
    this.downloadLink.download = fileName;
    this.downloadLink.textContent = "Download Photo";
    this.downloadLink.style.display = "flex";

    await this.addRecording(dataUrl, blob, fileName, fileName.replace(".png", ""), state);

    const flash = document.createElement("div");
    flash.className = "cam-viewfinder-flash";
    const viewfinder = this.video.parentElement;
    viewfinder.appendChild(flash);
    flash.addEventListener("animationend", () => flash.remove());
  }

  startRecording(state, cameraApp) {
    if (!this.stream || state.isRecording) return;

    state.isRecording = true;
    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.mediaRecorder.onstop = async () => {
      const blob = new Blob(this.recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);

      const fileName = `video-${Date.now()}.webm`;
      try {
        await os.fs.writeBinaryFile(["Videos", "Camera"], fileName, blob, "video", "fas fa-camera");
      } catch (e) {
        console.error("Failed to save video:", e);
      }

      await this.addRecording(url, blob, fileName, fileName.replace(".webm", ""), state);

      state.isRecording = false;
      this.stopTimer();
      this.shutterBtn.classList.remove("recording");
      this.updateShutterButton(state, cameraApp);
      this.downloadLink.href = url;
      this.downloadLink.download = fileName;
      this.downloadLink.textContent = "Download Video";
      this.downloadLink.style.display = "flex";
    };

    this.mediaRecorder.start();
    this.shutterBtn.classList.add("recording");
    this.recordingIcon.style.display = "block";
    this.updateShutterButton(state, cameraApp);
    this.startTimer();
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
  }

  async startScreenRecording(state, cameraApp) {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      this.activeStream = screenStream;
      this.video.srcObject = screenStream;

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(screenStream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);

        const fileName = `screen-${Date.now()}.webm`;
        try {
          await os.fs.writeBinaryFile(["Videos", "Camera"], fileName, blob, "video", "fas fa-camera");
        } catch (e) {
          console.error("Failed to save screen recording:", e);
        }

        await this.addRecording(url, blob, fileName, fileName.replace(".webm", ""), state);

        state.isRecording = false;
        this.downloadLink.href = url;
        this.downloadLink.download = fileName;
        this.downloadLink.textContent = "Download Screen Recording";
        this.downloadLink.style.display = "flex";
        this.stopTimer();
        this.recordingIcon.style.display = "none";
        this.shutterBtn.classList.remove("recording");
        this.updateShutterButton(state, cameraApp);
        this.activeStream.getTracks().forEach((t) => t.stop());
        this.activeStream = null;
        this.video.srcObject = this.stream;
      };

      screenStream.getVideoTracks()[0].onended = () => {
        if (this.mediaRecorder.state !== "inactive") this.mediaRecorder.stop();
      };

      state.isRecording = true;
      this.mediaRecorder.start();
      this.shutterBtn.classList.add("recording");
      this.recordingIcon.style.display = "block";
      this.updateShutterButton(state, cameraApp);
      this.startTimer();
    } catch (e) {
      console.error(e);
      os.notify.send("No camera permission", "Screen capture cancelled or not allowed");
    }
  }

  startTimer() {
    let seconds = 0;
    this.recordingTimer.textContent = "00:00";
    this.recordingInterval = setInterval(() => {
      seconds++;
      const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
      const secs = String(seconds % 60).padStart(2, "0");
      this.recordingTimer.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.recordingInterval);
    this.recordingTimer.textContent = "";
  }

  async addRecording(url, blob, savedName = null, displayName = null, state) {
    if (!displayName) {
      displayName = `Recording ${new Date().toLocaleTimeString()}`;
    }
    if (!savedName) {
      const fileName = `recording-${Date.now()}.webm`;
      await os.fs.writeBinaryFile(["Videos", "Camera"], fileName, blob, "video", "fas fa-camera");
      savedName = fileName;
    }

    state.recordings.unshift({
      id: savedName,
      name: displayName,
      url,
      blob
    });

    this.renderHistory(state);
  }

  closePreviewModal() {
    const modal = document.querySelector("#preview-modal");
    if (modal) modal.remove();
  }

  renderHistory(state, historyWin = null) {
    const list = historyWin ? historyWin.querySelector("#history-list") : document.querySelector("#history-list");
    const count = historyWin ? historyWin.querySelector("#history-count") : document.querySelector("#history-count");
    const typeFilter = historyWin
      ? historyWin.querySelector("#history-type-filter")
      : document.querySelector("#history-type-filter");
    const sortSelect = historyWin ? historyWin.querySelector("#history-sort") : document.querySelector("#history-sort");
    const prevPageBtn = historyWin ? historyWin.querySelector("#prev-page") : document.querySelector("#prev-page");
    const nextPageBtn = historyWin ? historyWin.querySelector("#next-page") : document.querySelector("#next-page");
    const pageInfo = historyWin ? historyWin.querySelector("#page-info") : document.querySelector("#page-info");

    if (!list) return;

    list.innerHTML = "";

    const filterVal = getSelectMenuValue("history-type-filter", historyWin || document) || "all";
    const sortVal = getSelectMenuValue("history-sort", historyWin || document) || "newest";

    let filtered = state.recordings.filter((rec) => {
      const type = this.getRecordingType(rec);
      return filterVal === "all" || type === filterVal;
    });

    filtered.sort((a, b) => {
      const aTime = this.extractTimestamp(a.id);
      const bTime = this.extractTimestamp(b.id);
      return sortVal === "newest" ? bTime - aTime : aTime - bTime;
    });

    if (count) count.textContent = `(${filtered.length})`;

    const totalPages = Math.ceil(filtered.length / state.itemsPerPage);
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, endIndex);

    paginatedItems.forEach((rec) => {
      const item = this.createHistoryItem(rec, state);
      list.appendChild(item);
    });

    if (prevPageBtn) prevPageBtn.disabled = state.currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = state.currentPage >= totalPages;
    if (pageInfo) pageInfo.textContent = `Page ${state.currentPage} of ${totalPages || 1}`;
  }

  getRecordingType(rec) {
    const id = String(rec.id || "");
    const name = String(rec.name || "");
    if (id.includes(".png") || id.includes(".jpg") || id.includes(".jpeg")) return "photo";
    if (name.toLowerCase().includes("screen")) return "screen";
    return "video";
  }

  extractTimestamp(id) {
    const idStr = String(id || "");
    const match = idStr.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }

  createHistoryItem(rec, state) {
    const type = this.getRecordingType(rec);
    const isPhoto = type === "photo";
    const item = document.createElement("div");
    item.className = "cam-history-item";
    item.onclick = () => this.openMediaViewer(rec);

    const thumbnail = document.createElement("div");
    thumbnail.className = "cam-history-thumb";

    if (state.bulkSelectMode) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "history-checkbox";
      checkbox.checked = state.selectedItems.includes(rec.id);
      checkbox.onclick = (e) => e.stopPropagation();
      checkbox.onchange = () => {
        const idx = state.selectedItems.indexOf(rec.id);
        if (checkbox.checked && idx === -1) state.selectedItems.push(rec.id);
        else if (!checkbox.checked && idx > -1) state.selectedItems.splice(idx, 1);
      };
      thumbnail.appendChild(checkbox);
    }

    if (isPhoto) {
      const img = document.createElement("img");
      img.src = rec.url;
      img.className = "cam-media-fill";
      thumbnail.appendChild(img);
    } else {
      const video = document.createElement("video");
      video.src = rec.url;
      video.muted = true;
      video.className = "cam-media-fill";
      thumbnail.appendChild(video);
    }

    const info = document.createElement("div");
    info.className = "cam-history-info";

    const name = document.createElement("div");
    name.className = "cam-history-name";
    name.textContent = rec.id;

    const timestamp = document.createElement("div");
    timestamp.className = "cam-history-timestamp";
    timestamp.textContent = this.formatTimestamp(rec.id);

    info.appendChild(name);
    info.appendChild(timestamp);

    const size = document.createElement("div");
    size.className = "cam-history-size";
    size.textContent = rec.blob ? formatSize(rec.blob.size) : "";
    info.appendChild(size);

    const actions = document.createElement("div");
    actions.className = "cam-history-actions";

    const renameBtn = document.createElement("button");
    renameBtn.innerHTML = '<i class="fas fa-pencil"></i>';
    renameBtn.className = "cam-hist-btn";
    renameBtn.title = "Rename";
    renameBtn.onclick = (e) => {
      e.stopPropagation();
      this.startInlineRename(rec, state, name);
    };
    actions.appendChild(renameBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.className = "cam-hist-btn danger";
    deleteBtn.title = "Delete";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      this.deleteRecording(rec.id, state);
    };
    actions.appendChild(deleteBtn);

    item.appendChild(thumbnail);
    item.appendChild(info);
    item.appendChild(actions);

    return item;
  }

  formatTimestamp(id) {
    const timestamp = this.extractTimestamp(id);
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  async getVideoDuration(url) {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.src = url;
      video.onloadedmetadata = () => {
        resolve(video.duration);
      };
      video.onerror = () => resolve(0);
    });
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  async copyToClipboard(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch (e) {
      console.error("Failed to copy to clipboard:", e);
      os.notify.send("Clipboard failure", "Failed to copy to clipboard");
    }
  }

  openMediaViewer(rec) {
    const type = this.getRecordingType(rec);
    let kind;
    if (type === "photo") {
      kind = FileKind.IMAGE;
    } else {
      kind = FileKind.VIDEO;
    }
    openMediaViewer(rec.id, rec.url, kind, this.wm);
  }

  startInlineRename(rec, state, nameEl) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "cam-inline-rename-input";
    input.value = rec.name;

    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = async (save) => {
      if (finished) return;
      finished = true;

      if (save) {
        const newName = input.value.trim();
        if (newName && newName !== rec.name) {
          const ext = rec.id.includes(".png") ? ".png" : ".webm";
          const newFileName = `${newName}${ext}`;
          try {
            await os.fs.renameBinaryFile(["Pictures", "Camera"], rec.id, newFileName);
          } catch {
            await os.fs.renameBinaryFile(["Videos", "Camera"], rec.id, newFileName);
          }
          rec.id = newFileName;
          rec.name = newName;
        }
      }

      const restoredName = document.createElement("div");
      restoredName.className = "cam-history-name";
      restoredName.textContent = rec.id;
      input.replaceWith(restoredName);
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });

    input.addEventListener("blur", () => finish(true));
  }

  async deleteRecording(id, state) {
    const index = state.recordings.findIndex((r) => r.id === id);
    if (index === -1) return;

    const confirmed = await os.dialog.confirm("Delete Recording", `Delete "${id}" for good?`);
    if (!confirmed) return;

    URL.revokeObjectURL(state.recordings[index].url);

    try {
      await os.fs.deleteBinaryFile(["Pictures", "Camera"], id);
    } catch {
      await os.fs.deleteBinaryFile(["Videos", "Camera"], id);
    }

    state.recordings.splice(index, 1);
    this.renderHistory(state);
  }

  playRecording(url) {
    const playerWin = os.window.create(`camera-playback-${Date.now()}`, "Playback", "50vw", "70vh", {
      icon: "static/icons/obs.webp"
    });

    playerWin.innerHTML = `
      <div class="window-content">
        <video controls autoplay style="width:100%; height:100%;"></video>
      </div>
    `;

    const videoEl = playerWin.querySelector("video");
    videoEl.src = url;
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
  }

  async restoreHistory(state) {
    const cameraFolder = await os.fs.readdir(["Pictures", "Camera"]).catch(() => ({}));
    const videosFolder = await os.fs.readdir(["Videos", "Camera"]).catch(() => ({}));

    const cameraEntries = Object.keys(cameraFolder).filter((k) => cameraFolder[k].type === "file");
    const videoEntries = Object.keys(videosFolder).filter((k) => videosFolder[k].type === "file");
    const allEntries = [...cameraEntries, ...videoEntries];

    const existingIds = new Set(state.recordings.map((r) => r.id));
    for (const name of allEntries) {
      if (existingIds.has(name)) continue;

      let blob = await os.fs.readBinaryFile(["Pictures", "Camera"], name).catch(() => null);
      if (!blob) {
        blob = await os.fs.readBinaryFile(["Videos", "Camera"], name).catch(() => null);
      }

      if (!blob) continue;
      state.recordings.push({
        id: name,
        name: name.replace(/\.(png|webm|jpg|jpeg)$/, ""),
        url: URL.createObjectURL(blob),
        blob
      });
    }

    this.renderHistory(state);
  }
}
