import "../styles/virtualMachineManager.css";
import { BaseApp, os, StorageKeys } from "../framework.js";
import { IFRAME_ATTRS } from "../shared/iframeAttrs.js";
import { DeclarativeApp } from "../runtime/DeclarativeApp.js";

const OS_LIST = [
  {
    id: "win11",
    name: "Windows 11",
    url: "https://selenite.cc/resources/sppa/11/index.html",
    color: "#0078d4",
    icon: "fab fa-windows"
  },
  { id: "win10", name: "Windows 10", url: "https://dustinbrett.com/", color: "#005a9e", icon: "fab fa-windows" },
  { id: "win7", name: "Windows 7", url: "https://win7simu.visnalize.com/", color: "#3a6ea5", icon: "fab fa-windows" },
  { id: "winxp", name: "Windows XP", url: "https://winxp.vercel.app", color: "#3a6ea5", icon: "fab fa-windows" },
  { id: "win96", name: "Windows 96", url: "https://windows96.net", color: "#c0c0c0", icon: "fas fa-desktop" },
  { id: "win93", name: "Windows 93", url: "https://www.windows93.net", color: "#008080", icon: "fas fa-desktop" },
  { id: "mac", name: "Mac OS", url: "https://www.macos-web.app", color: "#a2aaad", icon: "fab fa-apple" },
  { id: "emuos", name: "EmuOS", url: "https://emupedia.net/beta/emuos", color: "#4a9eff", icon: "fas fa-gamepad" }
];

const CORES = navigator.hardwareConcurrency || 4;
const RAM_GB = navigator.deviceMemory || 4;
const STORAGE_KEY = "vm_manager_vms";

export class VirtualMachineManagerApp extends BaseApp {
  constructor(services) {
    super(services);
    this._vms = this._loadVMs();
  }

  _loadVMs() {
    try {
      const raw = os.storage.get(STORAGE_KEY);
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  _saveVMs() {
    os.storage.set(STORAGE_KEY, this._vms);
  }

  open(opts) {
    const schema = this.getDeclarativeSchema(opts);
    if (!schema.actions) schema.actions = {};
    if (!schema.actions.initVM) {
      schema.actions.initVM = (payload, event, element, state, actionExecutor) => {
        return this.initVM(payload, event, element, state, actionExecutor);
      };
    }
    schema.actions._appInstance = this;
    const declarativeApp = new DeclarativeApp(schema, {
      wm: this.wm,
      fs: this.fs,
      bus: this.bus,
      notifications: this.notifications
    });
    return declarativeApp.open(opts);
  }

  getDeclarativeSchema() {
    return {
      id: "vm-app",
      name: "Virtual Machine Manager",
      icon: "fas fa-server",
      windows: [
        {
          id: "vm-app",
          title: "Virtual Machine Manager",
          size: ["580px", "480px"],
          icon: "fas fa-server",
          ui: `<div class="vm-shell"></div>`
        }
      ],
      state: { initial: {}, persistence: 0 },
      onMount: "initVM"
    };
  }

  _renderList(shell) {
    const count = this._vms.length;
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
          ${this._vms
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

    shell.querySelector("#vm-goto-create")?.addEventListener("click", () => this._renderCreate(shell));

    shell.querySelectorAll(".vm-boot-card-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        this._bootVM(this._vms[idx]);
      });
    });

    shell.querySelectorAll(".vm-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        this._renderView(shell, this._vms[idx], idx);
      });
    });

    shell.querySelectorAll(".vm-delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        this._vms.splice(idx, 1);
        this._saveVMs();
        this._renderList(shell);
      });
    });
  }

  _renderCreate(shell) {
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

      shell.querySelector("#vm-back-list").addEventListener("click", () => this._renderList(shell));

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

      shell.querySelector("#vm-create-boot").addEventListener("click", () => {
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
        this._vms.push(vm);
        this._saveVMs();
        this._bootVM(vm);
        this._renderList(shell);
      });
    };

    renderStep1();
  }

  _scramjetUrl(url) {
    const wispUrl = os.storage.get(StorageKeys.wispServer) || "wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/";
    return (
      window.location.origin +
      "/scram/index.html?wisp=" +
      encodeURIComponent(wispUrl) +
      "&embed=1" +
      "#" +
      encodeURIComponent(url)
    );
  }

  _renderView(shell, vm, index) {
    const osInfo = OS_LIST.find((o) => o.id === vm.osId) || OS_LIST[0];
    const usesScramjet = vm.osId === "emuos";

    let previewHtml;
    if (usesScramjet) {
      previewHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;background:var(--s1,rgba(0,0,0,0.3));color:var(--text-secondary);font-size:0.85rem;">
          <div style="width:64px;height:64px;border-radius:14px;background:linear-gradient(135deg,${osInfo.color}66,${osInfo.color}33);display:flex;align-items:center;justify-content:center;font-size:2rem;">
            <i class="${osInfo.icon}"></i>
          </div>
          <span>Live preview unavailable for this OS</span>
          <span style="font-size:0.75rem;">Click "Open in Window" to launch via proxy</span>
        </div>
      `;
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
      <div class="vm-config" style="gap:0;">
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
      <div style="display:flex;gap:10px;">
        <button class="vm-create-final-btn" id="vm-boot-from-view" style="flex:1;">
          <i class="fas fa-external-link-alt"></i> Open in Window
        </button>
        <button id="vm-delete-from-view" style="padding:12px 20px;border-radius:10px;border:1px solid var(--error, #e74c3c);background:none;color:var(--error, #e74c3c);font-size:0.9rem;font-weight:600;cursor:pointer;">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    `;

    shell.querySelector("#vm-back-list").addEventListener("click", () => this._renderList(shell));
    shell.querySelector("#vm-boot-from-view").addEventListener("click", () => this._bootVM(vm));
    shell.querySelector("#vm-delete-from-view").addEventListener("click", () => {
      this._vms.splice(index, 1);
      this._saveVMs();
      this._renderList(shell);
    });
  }

  _bootVM(vm) {
    const existing = document.getElementById(`${vm.id}-win`);
    if (existing) {
      os.window.focus(existing);
      return;
    }

    const usesScramjet = vm.osId === "emuos" || vm.osId === "win7";
    const iframeSrc = usesScramjet ? this._scramjetUrl(vm.url) : vm.url;
    const attrs = usesScramjet
      ? 'style="width:100%;height:100%;border:none;" allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"'
      : IFRAME_ATTRS;

    const win = os.window.create(`${vm.id}-win`, vm.name, "85vw", "85vh", {
      isGame: false,
      icon: "fas fa-server"
    });

    win.dataset.externalUrl = vm.url;
    win.innerHTML = `
      <div class="window-header">
        <span><i class="fas fa-server" style="margin-right:8px;"></i>${vm.name}</span>
        ${os.window.getWindowControls()}
      </div>
      <div class="window-content" style="width:100%;height:100%;overflow:hidden;">
        <iframe id="${vm.id}-iframe" ${attrs}></iframe>
      </div>
    `;

    const iframe = win.querySelector(`#${vm.id}-iframe`);
    if (usesScramjet) {
      iframe.addEventListener("load", () => {
        try {
          iframe.contentWindow?.postMessage({ type: "hide-chrome" }, "*");
        } catch (e) {}
      });
    }
    iframe.src = iframeSrc;
  }

  initVM(payload, event, element, state) {
    const shell = element?.querySelector?.(".vm-shell") || document.querySelector("#vm-app .vm-shell");
    if (!shell) return;
    this._renderList(shell);
  }

  onClose(winId) {}
}
