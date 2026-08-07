import "../styles/virtualMachineManager.css";
import { BaseApp, os, StorageKeys, $ } from "../framework.js";
import { getWispUrl } from "../shared/wispConfig.js";
const IFRAME_ATTRS =
  'style="width:100%;height:100%;border:none;" allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture" sandbox="allow-forms allow-downloads allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"';

const OS_LIST = [
  {
    id: "win11",
    name: "Windows 11",
    url: "https://test.webos.tenfell.cn",
    color: "#0078d4",
    icon: "fab fa-windows"
  },
  { id: "win10", name: "Windows 10", url: "https://dustinbrett.com/", color: "#005a9e", icon: "fab fa-windows" },
  { id: "win7", name: "Windows 7", url: "https://win7simu.visnalize.com/", color: "#3a6ea5", icon: "fab fa-windows" },
  { id: "winxp", name: "Windows XP", url: "https://winxp.vercel.app", color: "#3a6ea5", icon: "fab fa-windows" },
  {
    id: "winxpHeavy",
    name: "Windows XP (Heavy)",
    url: "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main/static/apps/winxp/index.html",
    color: "#3a6ea5",
    icon: "fab fa-windows"
  },
  { id: "win96", name: "Windows 96", url: "https://windows96.net", color: "#c0c0c0", icon: "fas fa-desktop" },
  { id: "win93", name: "Windows 93", url: "https://www.windows93.net", color: "#008080", icon: "fas fa-desktop" },
  { id: "mac", name: "Mac OS", url: "https://www.macos-web.app", color: "#a2aaad", icon: "fab fa-apple" },
  { id: "emuos", name: "EmuOS", url: "https://emupedia.net/beta/emuos", color: "#4a9eff", icon: "fas fa-gamepad" }
];

const CORES = navigator.hardwareConcurrency || 4;
const RAM_GB = navigator.deviceMemory || 4;
const STORAGE_KEY = StorageKeys.VM_MANAGER_VMS;

export class VirtualMachineManagerApp extends BaseApp {
  constructor(services) {
    super(services);
    this.vms = this.loadVMs();
  }

  loadVMs() {
    try {
      const raw = os.storage.get(STORAGE_KEY);
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  saveVMs() {
    os.storage.set(STORAGE_KEY, this.vms);
  }

  open() {
    const win = os.window.create("vm-app", "Virtual Machine Manager", "580px", "480px", {
      icon: "fas fa-server",
      appId: "virtualMachineManagerApp"
    });
    win.innerHTML = `<div class="vm-shell"></div>`;
    this.initVM(win);
    return win;
  }

  renderList(shell) {
    const count = this.vms.length;
    shell.innerHTML = `
      <div class="vm-header">
        <div>
          <h2>Virtual Machine Manager</h2>
          <p class="vm-subtitle">Create and manage browser-based virtual environments</p>
        </div>
        <button class="vm-create-btn" id="vm-goto-create"><i class="fas fa-plus"></i> Create VM</button>
      </div>
      ${
        count === 0
          ? `
        <div class="vm-empty">
          <i class="fas fa-server"></i>
          <p>No virtual machines yet.<br>Click "Create VM" to get started.</p>
        </div>
      `
          : `
        <div class="vm-list">
          ${this.vms
            .map((vm, i) => {
              const osInfo = OS_LIST.find((o) => o.id === vm.osId) || OS_LIST[0];
              return `
              <div class="vm-card" data-index="${i}">
                <div class="vm-card-icon" style="background:linear-gradient(135deg,${osInfo.color}66,${osInfo.color}33);">
                  <i class="${osInfo.icon}"></i>
                </div>
                <div class="vm-card-info">
                  <div class="vm-card-name">${vm.name}</div>
                  <div class="vm-card-specs">${vm.osName} · ${vm.cpu} cores · ${vm.ram} GB RAM</div>
                </div>
                <div class="vm-card-actions">
                  <button class="vm-boot-card-btn" data-index="${i}"><i class="fas fa-play"></i> Boot</button>
                  <button class="vm-view-btn" data-index="${i}"><i class="fas fa-eye"></i></button>
                  <button class="vm-delete-btn" data-index="${i}"><i class="fas fa-trash"></i></button>
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
      `
      }
    `;

    shell.querySelector("#vm-goto-create")?.addEventListener("click", () => this.renderCreate(shell));

    shell.querySelectorAll(".vm-boot-card-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const idx = parseInt(btn.dataset.index);
        await this.bootVM(this.vms[idx]);
      });
    });

    shell.querySelectorAll(".vm-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        this.renderView(shell, this.vms[idx], idx);
      });
    });

    shell.querySelectorAll(".vm-delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        this.vms.splice(idx, 1);
        this.saveVMs();
        this.renderList(shell);
      });
    });
  }

  renderCreate(shell) {
    let selected = null;

    const renderStep1 = () => {
      shell.innerHTML = `
        <div class="vm-header">
          <button class="vm-back-btn" id="vm-back-list"><i class="fas fa-arrow-left"></i> Back</button>
          <h2>Select Operating System</h2>
          <div></div>
        </div>
        <p class="vm-step-hint">Choose a system to virtualize</p>
        <div class="vm-os-grid">
          ${OS_LIST.map(
            (os) => `
            <div class="vm-os-card" data-os-id="${os.id}" data-os-name="${os.name}" data-os-url="${os.url}" data-os-color="${os.color}" data-os-icon="${os.icon}">
              <div class="vm-preview" style="background:linear-gradient(135deg,${os.color}44,${os.color}22);">
                <i class="${os.icon}"></i>
              </div>
              <div class="vm-label">${os.name}</div>
            </div>
          `
          ).join("")}
        </div>
      `;

      shell.querySelector("#vm-back-list").addEventListener("click", () => this.renderList(shell));

      shell.querySelectorAll(".vm-os-card").forEach((card) => {
        card.addEventListener("click", () => {
          shell.querySelectorAll(".vm-os-card").forEach((c) => c.classList.remove("selected"));
          card.classList.add("selected");
          selected = {
            id: card.dataset.osId,
            name: card.dataset.osName,
            url: card.dataset.osUrl,
            color: card.dataset.osColor,
            icon: card.dataset.osIcon
          };
          renderStep2(selected);
        });
      });
    };

    const renderStep2 = (osInfo) => {
      const cpu = Math.min(CORES, Math.max(1, CORES));
      const ram = Math.min(RAM_GB, Math.max(1, RAM_GB));

      shell.innerHTML = `
        <div class="vm-header">
          <button class="vm-back-btn" id="vm-back-os"><i class="fas fa-arrow-left"></i> Back</button>
          <h2>Configure ${osInfo.name}</h2>
          <div></div>
        </div>
        <div class="vm-config">
          <div class="vm-config-group">
            <label>CPU Cores</label>
            <div class="vm-value" id="vm-cpu-val">${cpu}</div>
            <input type="range" id="vm-cpu" min="1" max="${Math.max(CORES, 8)}" value="${cpu}" step="1">
          </div>
          <div class="vm-config-group">
            <label>Memory</label>
            <div class="vm-value" id="vm-ram-val">${ram} GB</div>
            <input type="range" id="vm-ram" min="1" max="16" value="${ram}" step="1">
          </div>
        </div>
        <button class="vm-create-final-btn" id="vm-create-boot">
          <i class="fas fa-play"></i> Create & Boot
        </button>
      `;

      const cpuSlider = shell.querySelector("#vm-cpu");
      const ramSlider = shell.querySelector("#vm-ram");
      const cpuVal = shell.querySelector("#vm-cpu-val");
      const ramVal = shell.querySelector("#vm-ram-val");

      cpuSlider.addEventListener("input", () => {
        cpuVal.textContent = cpuSlider.value;
      });
      ramSlider.addEventListener("input", () => {
        ramVal.textContent = ramSlider.value + " GB";
      });

      shell.querySelector("#vm-back-os").addEventListener("click", () => renderStep1());

      shell.querySelector("#vm-create-boot").addEventListener("click", async () => {
        const name = osInfo.name + " VM";
        const vm = {
          id: osInfo.id + "_" + Date.now(),
          name,
          osId: osInfo.id,
          osName: osInfo.name,
          url: osInfo.url,
          cpu: parseInt(cpuSlider.value),
          ram: parseInt(ramSlider.value),
          icon: osInfo.icon,
          color: osInfo.color
        };
        this.vms.push(vm);
        this.saveVMs();
        await this.bootVM(vm);
        this.renderList(shell);
      });
    };

    renderStep1();
  }

  scramjetUrl(url) {
    const wispUrl = getWispUrl();
    return (
      window.location.origin +
      "/s/index.html?wisp=" +
      encodeURIComponent(wispUrl) +
      "&embed=1" +
      "#" +
      encodeURIComponent(url)
    );
  }

  renderView(shell, vm, index) {
    const osInfo = OS_LIST.find((o) => o.id === vm.osId) || OS_LIST[0];
    const usesScramjet = vm.osId === "emuos" || vm.osId === "mac";
    const isWinXpHeavy = vm.osId === "winxpHeavy";

    let previewHtml;
    if (usesScramjet) {
      previewHtml = `
        <div class="vm-preview-unavailable">
          <div class="vm-preview-icon-box" style="background:linear-gradient(135deg,${osInfo.color}66,${osInfo.color}33);">
            <i class="${osInfo.icon}"></i>
          </div>
          <span>Live preview unavailable for this OS</span>
          <span class="vm-preview-hint-small">Click "Open in Window" to launch via proxy</span>
        </div>
      `;
    } else if (isWinXpHeavy) {
      previewHtml = `<iframe ${IFRAME_ATTRS}></iframe>`;
    } else {
      previewHtml = `<iframe src="${vm.url}" ${IFRAME_ATTRS}></iframe>`;
    }

    shell.innerHTML = `
      <div class="vm-header">
        <button class="vm-back-btn" id="vm-back-list"><i class="fas fa-arrow-left"></i> Back</button>
        <h2>${vm.name}</h2>
        <div></div>
      </div>
      <div class="vm-preview-frame">
        <div class="vm-preview-bar">
          <i class="fas fa-circle"></i> ${vm.osName} · ${vm.cpu} cores · ${vm.ram} GB RAM
        </div>
        ${previewHtml}
      </div>
      <div class="vm-config vm-config-no-gap">
        <div class="vm-detail-row">
          <span class="vm-detail-label">CPU Cores</span>
          <span class="vm-detail-value">${vm.cpu}</span>
        </div>
        <div class="vm-detail-row">
          <span class="vm-detail-label">Memory</span>
          <span class="vm-detail-value">${vm.ram} GB</span>
        </div>
        <div class="vm-detail-row">
          <span class="vm-detail-label">System</span>
          <span class="vm-detail-value">${vm.osName}</span>
        </div>
      </div>
      <div class="vm-detail-actions">
        <button class="vm-create-final-btn vm-btn-flex" id="vm-boot-from-view">
          <i class="fas fa-external-link-alt"></i> Open in Window
        </button>
        <button id="vm-delete-from-view" class="vm-delete-btn-danger">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    `;

    shell.querySelector("#vm-back-list").addEventListener("click", () => this.renderList(shell));
    shell.querySelector("#vm-boot-from-view").addEventListener("click", () => this.bootVM(vm));
    shell.querySelector("#vm-delete-from-view").addEventListener("click", () => {
      this.vms.splice(index, 1);
      this.saveVMs();
      this.renderList(shell);
    });

    if (isWinXpHeavy) {
      this.fetchHtmlAsBlobUrl(vm.url).then((blobUrl) => {
        const previewIframe = shell.querySelector(".vm-preview-frame iframe");
        if (previewIframe) previewIframe.src = blobUrl;
      });
    }
  }

  async fetchHtmlAsBlobUrl(url) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const blob = new Blob([html], { type: "text/html" });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("[VMManager] Failed to fetch HTML for blob:", e);
      return url;
    }
  }

  async bootVM(vm) {
    const existing = $(`#${vm.id}-win`);
    if (existing) {
      os.window.focus(existing);
      return;
    }

    const usesScramjet = vm.osId === "emuos" || vm.osId === "win7" || vm.osId === "mac";
    const isWinXpHeavy = vm.osId === "winxpHeavy";
    let iframeSrc = usesScramjet ? this.scramjetUrl(vm.url) : vm.url;

    const attrs = usesScramjet
      ? 'style="width:100%;height:100%;border:none;opacity:0;" allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"'
      : IFRAME_ATTRS;

    const win = os.window.create(`${vm.id}-win`, vm.name, "85vw", "85vh", {
      isGame: false,
      icon: "fas fa-server"
    });

    const bootingHtml = usesScramjet
      ? `
      <div class="vm-booting-overlay" id="${vm.id}-booting">
        <div class="vm-booting-content">
          <div class="vm-booting-icon" style="background:linear-gradient(135deg,${vm.color}66,${vm.color}33);">
            <i class="${vm.icon}"></i>
          </div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary);text-align:center;">Booting ${vm.name}...</div>
        </div>
      </div>
    `
      : "";

    win.dataset.externalUrl = vm.url;
    win.innerHTML = `
      <div class="window-header">
        <span><i class="fas fa-server vm-header-icon"></i>${vm.name}</span>
        ${os.window.getWindowControls()}
      </div>
      <div class="window-content vm-window-content">
        ${bootingHtml}
        <iframe id="${vm.id}-iframe" ${attrs}></iframe>
      </div>
    `;

    const iframe = win.querySelector(`#${vm.id}-iframe`);
    if (isWinXpHeavy) {
      iframeSrc = await this.fetchHtmlAsBlobUrl(vm.url);
    }
    if (usesScramjet) {
      iframe.addEventListener("load", () => {
        try {
          iframe.contentWindow?.postMessage({ type: "hide-chrome" }, "*");
          this.waitForScramjetLoad(iframe, vm.id);
        } catch (e) {
          console.error("[VMManager]", e);
        }
      });
    }
    iframe.src = iframeSrc;
  }

  waitForScramjetLoad(iframe, vmId) {
    const bootingEl = $(`#${vmId}-booting`);
    if (!bootingEl) return;

    const reveal = () => {
      this.stripScramChrome(iframe);
      bootingEl.classList.add("vm-booting-fade");
      iframe.style.opacity = "1";
      setTimeout(() => bootingEl.remove(), 450);
    };

    const checkLoaded = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return false;
        const loadingEl = doc.querySelector("#loading");
        const hidden =
          !loadingEl || loadingEl.style.display === "none" || getComputedStyle(loadingEl).display === "none";
        const hasInnerFrame = doc.querySelector(".scramjet-frame iframe, .frame iframe, .iframe-container iframe");
        return hidden && hasInnerFrame;
      } catch {
        return false;
      }
    };

    const poll = setInterval(() => {
      if (checkLoaded()) {
        clearInterval(poll);
        clearTimeout(fallback);
        reveal();
      }
    }, 200);

    const fallback = setTimeout(() => {
      clearInterval(poll);
      reveal();
    }, 25000);
  }

  stripScramChrome(iframe) {
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      doc
        .querySelectorAll(".flex.tabs, .flex.nav, .loading-bar-container, .bookmark-bar, .message-container, #tooltip")
        .forEach((el) => el.remove());
    } catch (e) {
      console.error("[VMManager] strip chrome:", e);
    }
  }

  initVM(win) {
    const shell = win.querySelector(".vm-shell");
    if (!shell) return;
    this.renderList(shell);
  }

  onClose(winId) {}
}
