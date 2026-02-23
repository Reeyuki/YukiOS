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

    const win = this.wm.createWindow(winId, "About Yuki OS", "700px", "600px");
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
        <div class="about-app-container" style="padding: 1.75rem 1.25rem 4rem; max-height: 80vh; overflow: auto; display: flex; flex-direction: column; box-sizing: border-box;">
          
          <!-- Header -->
          <div class="about-header" style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 2rem; padding-top: 0.25rem;">
            <div style="width: 100px; height: 100px; background: linear-gradient(135deg, var(--accent), var(--accent-hover)); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; animation: float 3s ease-in-out infinite;">
              <i class="fas fa-desktop" style="font-size: 3rem; color: var(--bg-primary);"></i>
            </div>
            <h1 style="font-size: 2rem; margin-bottom: 0; color: var(--text-primary); font-family: fontb; text-align: center; width: 100%;">Yuki OS</h1>
            <p style="color: var(--text-secondary); font-size: 1rem; margin: 0; text-align: center; width: 100%;">Version 1.0</p>
            <p style="color: var(--text-secondary); font-size: 0.9rem; max-width:700px; margin: 1rem auto 0; line-height:1.6; text-align: center;">
              A browser-based desktop environment that provides a unified windowed system for games, emulators, web apps, and interactive content.
              Yuki OS integrates multiple execution runtimes — Flash, EmulatorJS, WASM, Unity, HTML5, and more — into a single consistent desktop interface.
              Click an icon, content opens in a window. Simple as that.
            </p>
          </div>

          <!-- Developers Section -->
          <div class="about-section" style="margin-bottom: 2rem;">
            <h2 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; font-family: fontb;">
              <i class="fas fa-users" style="color: var(--accent);"></i> Developers
            </h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">
              Click on a developer's card to learn more about them and support their work.
            </p>

            <div class="developers-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; align-items: start;">

              <!-- Developer: reeyuki -->
              <div class="developer-card" style="background: rgba(30, 35, 48, 0.6); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: all 0.3s ease;">
                <div class="dev-header" onclick="window._aboutApp && window._aboutApp.toggleDevInfo('reeyuki')" style="padding: 1rem; cursor: pointer; display: flex; align-items: center; gap: 1rem; transition: background 0.2s; background: transparent;" onmouseover="this.style.background='rgba(125, 211, 192, 0.1)'" onmouseout="this.style.background='transparent'">
                  <div style="width: 50px; height: 50px; background: linear-gradient(135deg, var(--accent), var(--accent-hover)); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--bg-primary); flex-shrink: 0;">
                    <i class="fas fa-user"></i>
                  </div>
                  <div style="flex: 1;">
                    <div style="font-family: fontb; color: var(--text-primary); font-size: 1.1rem;">reeyuki</div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem;">Lead Developer &amp; Creator</div>
                  </div>
                  <i class="fas fa-chevron-down dev-chevron" id="chevron-reeyuki" style="color: var(--text-secondary); transition: transform 0.3s ease;"></i>
                </div>
                <div class="dev-info" id="devinfo-reeyuki" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease; background: rgba(21, 25, 35, 0.5);">
                  <div style="padding: 1rem; border-top: 1px solid var(--border);">
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem; line-height: 1.6;">
                      Creator of Yuki OS — building a unified browser desktop for games, emulators, and web apps. Passionate about runtime integration and seamless UX.
                    </p>
                    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                      <a href="https://github.com/reeyuki" target="_blank" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(125, 211, 192, 0.15); border: 1px solid rgba(125, 211, 192, 0.3); border-radius: 8px; color: var(--text-primary); text-decoration: none; font-size: 0.85rem; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(125, 211, 192, 0.25)'" onmouseout="this.style.background='rgba(125, 211, 192, 0.15)'">
                        <i class="fab fa-github"></i> GitHub
                      </a>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- Features Section -->
          <div class="about-section" style="margin-bottom: 2rem;">
            <h2 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; font-family: fontb;">
              <i class="fas fa-star" style="color: var(--accent);"></i> What's Inside
            </h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
              ${[
                [
                  "fa-window-restore",
                  "Windowed Multitasking",
                  "Drag, resize, and manage multiple windows simultaneously."
                ],
                [
                  "fa-layer-group",
                  "Multi-Runtime Support",
                  "Flash (Ruffle), EmulatorJS, WASM, Unity, HTML5, and more."
                ],
                [
                  "fa-folder-open",
                  "Virtual Filesystem",
                  "Full file system with explorer, file ops, and app integration."
                ],
                ["fa-gamepad", "Game Platform", "Run GBA, NDS, Flash, WASM, Unity, and indie HTML5 games."],
                ["fa-cube", "Modular Apps", "Terminal, browser, text editor, camera, and system utilities."],
                [
                  "fa-cloud-download-alt",
                  "Hybrid Asset System",
                  "Bundled, CDN, streamed, cached, and offline-ready assets."
                ]
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

          <!-- Footer -->
          <div class="about-footer" style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 1rem 1rem 0.5rem; border-top: 1px solid var(--border); margin-top: auto; background: transparent;">
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.75rem; text-align: center;">
              Made with <i class="fas fa-heart" style="color: #ef4444;"></i> by the Yuki OS team
            </p>
            <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
              <a href="https://github.com/reeyuki/yukios" target="_blank" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(125, 211, 192, 0.15); border: 1px solid rgba(125, 211, 192, 0.3); border-radius: 8px; color: var(--text-primary); text-decoration: none; font-size: 0.85rem; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(125, 211, 192, 0.25)'" onmouseout="this.style.background='rgba(125, 211, 192, 0.15)'">
                <i class="fab fa-github"></i> View on GitHub
              </a>
              <a href="#" onclick="event.preventDefault(); openApp('whatsnew');" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(125, 211, 192, 0.15); border: 1px solid rgba(125, 211, 192, 0.3); border-radius: 8px; color: var(--text-primary); text-decoration: none; font-size: 0.85rem; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(125, 211, 192, 0.25)'" onmouseout="this.style.background='rgba(125, 211, 192, 0.15)'">
                <i class="fas fa-star"></i> What's New
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
