import { desktop } from "./desktop.js";

export class AboutApp {
  constructor(windowManager) {
    this.wm = windowManager;
  }

  open() {
    const winId = "about-yukios";
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const win = this.wm.createWindow(winId, "About Yuki OS", "700px", "650px");
    Object.assign(win.style, { left: "200px", top: "80px" });

    win.innerHTML = `
      <div class="window-header">
        <span>About Yuki OS</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">X</button>
        </div>
      </div>
      <div class="window-content" style="padding:0; height: calc(100% - 40px); overflow: hidden;">
        <div class="about-app-container" style="padding: 1.75rem 1.25rem 4rem; max-height: 85vh; overflow: auto; display: flex; flex-direction: column; box-sizing: border-box;">
          
          <div class="about-header" style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 2rem; padding-top: 0.25rem;">
            <div style="width: 100px; height: 100px; background: linear-gradient(135deg, var(--accent), var(--accent-hover)); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; animation: float 3s ease-in-out infinite;">
              <i class="fas fa-desktop" style="font-size: 3rem; color: var(--bg-primary);"></i>
            </div>
            <h1 style="font-size: 2rem; margin-bottom: 0; color: var(--text-primary); font-family: fontb; text-align: center; width: 100%;">Yuki OS</h1>
            <p style="color: var(--text-secondary); font-size: 1rem; margin: 0; text-align: center;">Version 1.0</p>
            <p style="color: var(--text-secondary); font-size: 0.9rem; max-width:700px; margin: 1rem auto 0; line-height:1.6; text-align: center;">
              A browser-based desktop OS where apps and games run in windows inside your browser. Open multiple apps, move them around, resize them, and multitask just like on a real computer. Upload custom wallpapers and manage your virtual filesystem seamlessly. Yuki OS comes with 130 ready-to-play games and built-in apps including terminal, browser, text editor, camera, calculator, paint,task manager, and a Python / Node.js IDE.
            </p>
          </div>

          <div class="about-section" style="margin-bottom: 2rem;">
            <h2 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; font-family: fontb;">
              <i class="fas fa-star" style="color: var(--accent);"></i> Key Features
            </h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
              ${[
                [
                  "fa-window-restore",
                  "Windowed Multitasking",
                  "Drag, resize, and layer multiple windows to multitask like a desktop."
                ],
                [
                  "fa-folder-open",
                  "Virtual Filesystem",
                  "Full file explorer with file operations and app integration."
                ],
                [
                  "fa-gamepad",
                  "Integrated Game Platform",
                  "Access 130 curated games and web-based emulators in one place."
                ],
                [
                  "fa-cube",
                  "Built-in Apps",
                  "Includes terminal, browser, text editor, camera, calculator, paint, and Python / Node.js IDE."
                ],
                [
                  "fa-layer-group",
                  "Multi-Runtime Support",
                  "Supports Flash (Ruffle), EmulatorJS, WASM, Unity, HTML5, and more."
                ],
                ["fa-image", "Wallpaper Upload", "Upload custom wallpapers for a personalized desktop experience."]
              ]
                .map(
                  ([icon, title, desc]) => `
                <div style="background: rgba(30, 35, 48, 0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.9rem;">
                  <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem;">
                    <i class="fas ${icon}" style="color: var(--accent); font-size: 1rem;"></i>
                    <span style="font-family: fontb; color: var(--text-primary); font-size: 0.9rem;">${title}</span>
                  </div>
                  <p style="color: var(--text-secondary); font-size: 0.8rem; margin: 0; line-height: 1.5;">${desc}</p>
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <div class="about-footer" style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 1rem 1rem 0.5rem; border-top: 1px solid var(--border); margin-top: auto; background: transparent;">
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.75rem; text-align: center;">
              Made with <i class="fas fa-heart" style="color: #ef4444;"></i> by Reeyuki
            </p>
            <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
              <a href="https://github.com/reeyuki/YukiOS" target="_blank" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(125, 211, 192, 0.15); border: 1px solid rgba(125, 211, 192, 0.3); border-radius: 8px; color: var(--text-primary); text-decoration: none; font-size: 0.85rem; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(125, 211, 192, 0.25)'" onmouseout="this.style.background='rgba(125, 211, 192, 0.15)'">
                <i class="fab fa-github"></i> View on GitHub
              </a>
            </div>
          </div>

        </div>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "About Yuki OS", "fa fa-circle-info");

    window._aboutApp = this;
  }

  toggleDevInfo(devId) {
    const info = document.getElementById(`devinfo-${devId}`);
    const chevron = document.getElementById(`chevron-${devId}`);
    if (!info) return;

    const isOpen = info.style.maxHeight && info.style.maxHeight !== "0px";
    if (isOpen) {
      info.style.maxHeight = "0";
      if (chevron) chevron.style.transform = "rotate(0deg)";
    } else {
      info.style.maxHeight = info.scrollHeight + "px";
      if (chevron) chevron.style.transform = "rotate(180deg)";
    }
  }
}
