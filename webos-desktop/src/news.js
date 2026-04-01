import { desktop } from "./desktop.js";

export class NewsApp {
  constructor(windowManager) {
    this.wm = windowManager;
  }

  open() {
    const winId = "news-yukios";
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const win = this.wm.createWindow(winId, "What's New", "720px", "680px");
    Object.assign(win.style, { left: "180px", top: "70px" });

    const updates = [
      {
        date: "April 2026",
        sections: [
          {
            icon: "fa-wand-magic-sparkles",
            title: "Features & Improvements",
            items: [
              [
                "fa-trophy",
                "Achievements System",
                "A new achievements system has been added to track your milestones and progress across the OS."
              ],
              [
                "fa-gamepad",
                "JsDos gui support",
                "You can now upload jsdos files directly at jsdos app and play featured jsdos games."
              ]
            ]
          }
        ]
      },
      {
        date: "March 2026",
        sections: [
          {
            icon: "fa-rocket",
            title: "New Apps",
            items: [
              ["fa-code", "Monaco Editor", "A powerful code editor is now available as a built-in app."],
              ["fa-file-lines", "Markdown Viewer", "Open and read Markdown files directly in the system."],
              ["fa-cube", "3D Model Viewer", "View 3D models without any external software."],
              ["fa-file-word", "Full Office Suite", "Create and edit office documents right in your workspace."],
              ["fa-calendar-days", "Calendar", "Stay organized with a built-in calendar app."],
              [
                "fa-note-sticky",
                "Notepad Enhancements",
                "Notepad now handles large files gracefully with a prompt before opening heavy content."
              ],
              ["fa-paintbrush", "LibreSprite", "Pixel art editor is now included."],
              ["fa-comments", "Kivi IRC", "IRC client added for real-time chat."]
            ]
          },
          {
            icon: "fa-gamepad",
            title: "New Games",
            items: [
              [
                "fa-car",
                "New Titles",
                "Added gnmath game category and several new games including Earn to Die, Rotate, Slither/Yorg io, Angry Birds Series,Solar Smash, Trollface Quest, and more."
              ],
              ["fa-floppy-disk", "Classic DOS Games", "Classic DOS games are now playable through jsdos integration."]
            ]
          },
          {
            icon: "fa-wand-magic-sparkles",
            title: "Features & Improvements",
            items: [
              ["fa-bell", "Notification Center", "A centralized place to view system notifications."],
              ["fa-music", "Audio Playback", "You can now play audio files directly."],
              ["fa-globe", "HTML File Support", "HTML files can now be opened and rendered."],
              [
                "fa-file-zipper",
                "Archive Support",
                "Extract 7z and .tar.xz archives, in addition to zip files now available via right-click context menu."
              ],
              ["fa-bolt", "ROM Caching", "Games load faster thanks to local ROM caching."],
              ["fa-bolt", "File Download", "You can now download files from explorer right clicking to files."],
              ["fa-image", "Dynamic Favicon", "The browser tab icon now updates to reflect what you're doing."],
              [
                "fa-video",
                "Yuki Convert",
                "Convert any file to other formats fuly locally without uploading to a server."
              ],
              ["fa-window-restore", "Window Icons", "App windows now display their respective icons in the title bar."],
              ["fa-bars", "Window Header Menu", "Right-click on a window header for quick actions."],
              ["fa-i-cursor", "F2 Rename in Explorer", "Press F2 to rename files quickly, just like a native OS."],
              ["fa-hand", "Drag to Desktop", "Drag files from apps directly to the desktop to save them."],
              [
                "fa-arrows-rotate",
                "Desktop Auto-Refresh",
                "The desktop now automatically reflects file changes without a manual refresh."
              ],
              ["fa-film", "Video Performance", "Smoother video playback across the system."]
            ]
          },
          {
            icon: "fa-bug-slash",
            title: "Bug Fixes",
            items: [
              ["fa-file-pdf", "PDF Support", "Fixed an issue with PDF file support."],
              [
                "fa-panorama",
                "Wallpaper Shuffle",
                "Resolved a bug where wallpapers would sometimes skip unexpectedly."
              ],
              ["fa-toolbox", "App Creator", "Corrected an import bug in the App Creator."]
            ]
          }
        ]
      }
    ];

    const renderSections = (sections) =>
      sections
        .map(
          (section) => `
        <div style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.9rem; display: flex; align-items: center; gap: 0.5rem; font-family: fontb; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
            <i class="fas ${section.icon}" style="color: var(--accent);"></i> ${section.title}
          </h2>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${section.items
              .map(
                ([icon, title, desc]) => `
              <div style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.7rem 0.9rem; background: rgba(30, 35, 48, 0.5); border: 1px solid var(--border); border-radius: 9px;">
                <i class="fas ${icon}" style="color: var(--accent); font-size: 0.95rem; margin-top: 0.15rem; flex-shrink: 0;"></i>
                <div>
                  <span style="font-family: fontb; color: var(--text-primary); font-size: 0.875rem;">${title}: </span>
                  <span style="color: var(--text-primary); font-size: 0.85rem; line-height: 1.5;">${desc}</span>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
        )
        .join("");

    const updatesHtml = updates
      .map(
        (update) => `
      <div style="margin-bottom: 2.5rem;">
        <p style="color: var(--text-primary); font-size: 0.9rem; margin: 0 0 1.5rem; opacity: 0.7;">${update.date} — Yuki OS Update</p>
        ${renderSections(update.sections)}
      </div>
    `
      )
      .join("");

    win.innerHTML = `
      <div class="window-header">
        <span>What's New</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="window-content" style="padding:0; height: calc(100% - 40px); overflow: hidden;">
        <div style="padding: 1.75rem 1.5rem 3rem; max-height: 100%; overflow-y: auto; box-sizing: border-box;">

          <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 2rem;">
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, var(--accent), var(--accent-hover)); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; animation: float 3s ease-in-out infinite;">
              <i class="fas fa-newspaper" style="font-size: 2.25rem; color: var(--bg-primary);"></i>
            </div>
            <h1 style="font-size: 1.75rem; margin: 0 0 0.25rem; color: var(--text-primary); font-family: fontb;">What's New</h1>
          </div>

          ${updatesHtml}

        </div>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "What's New", "fa fa-newspaper");

    window._newsApp = this;
  }
}
