import { BaseApp } from "./core/BaseApp.js";
import { StorageKeys } from "./settings.js";
import { desktop } from "./desktop.js";

const NEWS_UPDATES = [
  {
    date: "May 9, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-star", "PWA Support", "Added progressive web app support for YukiOS"],
          ["fa-cubes", "3D Renderer Assets", "Fixed sample files of 3D Model Viewer and JsDos roms"],
          ["fa-brands fa-steam", "Steam Improvement", "Added data pack install option steam and optimize load speed"],
          ["fa-arrow-pointer", "Cursor Support", "Added custom cursor support"],
          ["fa-route", "Add proxy support for custom apps", "Added proxy support for created web apps"],
          ["fa-wrench", "App Creator Improvements", "Improved the App Creator workflow and usability."],
          ["fa-gamepad", "New Games: Azahar", "Added Azahar to the games collection."],
          ["fa-gamepad", "New Games: Fez", "Added Fez to the games collection."],
          ["fa-gamepad", "New Games: Happy Room", "Added Happy Room to the games collection."],
          [
            "fa-gamepad",
            "New Games: My Rusty Submarine, Upstream",
            "Added My Rusty Submarine and Upstream to the games collection."
          ],
          ["fa-rectangle-ad", "Ads", "Added ads integration."],
          ["fa-chart-line", "Analytics Toggle", "Added a settings toggle to enable or disable analytics."],
          ["fa-brands fa-youtube", "YouTube Utility App", "Added a YouTube utility app."],
          ["fa-brands fa-spotify", "Spotify Utility App", "Added a Spotify utility app."],
          ["fa-id-card", "Properties Page Improvements", "Improved the file/app properties page."],
          [
            "fa-up-down-left-right",
            "Desktop Stretch Scroll",
            "Added a Settings toggle to prevent desktop page stretch/scroll when dragging windows out of bounds"
          ]
        ]
      }
    ]
  },
  {
    date: "May 5, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-keyboard", "Start Menu Keybinds", "Open the start menu faster with Space, Tab, or Ctrl."],
          ["fa-trophy", "Achievements Toggle", "Quickly enable or disable achievements from settings."]
        ]
      }
    ]
  },
  {
    date: "May 4, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-right-left", "Import / Export", "Back up or migrate your setup with the new data import/export system."],
          ["fa-trophy", "Achievements UI Refresh", "Reworked the achievements interface for a cleaner experience."],
          ["fa-house", "Steam Home Button", "Added a add to home button in the Steam app."],
          ["fa-ellipsis", "Menus & Explorer Polish", "Improved context menus and refined explorer styling."]
        ]
      },
      {
        icon: "fa-bug-slash",
        title: "Fixes",
        items: [
          ["fa-trash", "Desktop Icon Deletion", "Fixed desktop icon deletion logic for deleting multiple icons."],
          ["fa-file-image", "File Thumbnails", "Fixed file image display issues in the explorer."]
        ]
      }
    ]
  },
  {
    date: "May 3, 2026",
    sections: [
      {
        icon: "fa-bug-slash",
        title: "Fixes",
        items: [["fa-ghost", "Game Fixes", "Fixed issues affecting Bendy and Isaac Rebirth."]]
      }
    ]
  },
  {
    date: "May 2, 2026",
    sections: [
      {
        icon: "fa-rocket",
        title: "Improvements",
        items: [
          [
            "fa-magnifying-glass",
            "Steam Launch from Search",
            "Launch Steam apps directly from the search/query experience."
          ],
          ["fa-link", "CDN Reliability", "Fixed a jsDelivr URL used for loading assets."],
          ["fa-book-open", "Game Descriptions", "Added game descriptions for better discovery."]
        ]
      }
    ]
  },
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
          ],
          [
            "fa-layer-group",
            "Virtual Workspaces",
            "Boost your productivity by organizing apps into multiple virtual desktops, allowing you to switch between different tasks seamlessly."
          ],
          [
            "fa-microsoft",
            "Window Snapping and Edge Tiling",
            "Organize your workspace by dragging windows to screen edges or using Super+Arrow keys to tile windows into halves or quarters."
          ],
          [
            "fa-sliders",
            "Audio Mixer",
            "Take full control of your soundscape with per-app volume controls with audio mixer."
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
          ["fa-video", "Yuki Convert", "Convert any file to other formats fuly locally without uploading to a server."],
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
          ["fa-panorama", "Wallpaper Shuffle", "Resolved a bug where wallpapers would sometimes skip unexpectedly."],
          ["fa-toolbox", "App Creator", "Corrected an import bug in the App Creator."]
        ]
      }
    ]
  }
];

const hashStringDjb2 = (text) => {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return `djb2:${(hash >>> 0).toString(16)}`;
};

export const getNewsContentSignature = () => {
  const minimal = NEWS_UPDATES.map((u) => ({
    date: u.date,
    sections: (u.sections || []).map((s) => ({
      icon: s.icon,
      title: s.title,
      items: (s.items || []).map(([i, t, d]) => [i, t, d])
    }))
  }));
  return hashStringDjb2(JSON.stringify(minimal));
};

export class NewsApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  open() {
    localStorage.setItem(StorageKeys.newsReadSignatureKey, getNewsContentSignature());
    localStorage.setItem(StorageKeys.newsSeenKey, "true");

    const winId = "news-yukios";
    if (this._isSingletonOpen(winId)) return;

    const win = this.wm.createWindow(winId, "What's New", "720px", "520px");
    Object.assign(win.style, { left: "180px", top: "70px" });

    const updates = NEWS_UPDATES;

    const renderSections = (sections) =>
      sections
        .map(
          (section) => `
        <div class="news-section">
          <h2 class="news-section-title">
            <i class="fas ${section.icon}"></i>
            <span>${section.title}</span>
          </h2>
          <div class="news-items">
            ${section.items
              .map(
                ([icon, title, desc]) => `
              <div class="news-item">
                <div class="news-item-icon" aria-hidden="true">
                  <i class="fas ${icon}"></i>
                </div>
                <div class="news-item-body">
                  <div class="news-item-title">${title}</div>
                  <div class="news-item-desc">${desc}</div>
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
      <div class="news-update">
        <div class="news-update-head">
          <div class="news-date">${update.date}</div>
          <div class="news-label">Yuki OS Update</div>
        </div>
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
        <style>
          .news-root {
            padding: 1.25rem 1.25rem 2.5rem;
            max-height: 100%;
            overflow-y: auto;
            box-sizing: border-box;
            background:
              radial-gradient(circle at 20% 0%, color-mix(in oklch, var(--brand) 16%, transparent), transparent 55%),
              radial-gradient(circle at 90% 25%, color-mix(in oklch, var(--brand) 10%, transparent), transparent 60%),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.04), transparent 40%),
              rgba(0, 0, 0, 0.12);
          }

          .news-hero {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 1rem 1rem;
            margin-bottom: 1.25rem;
            border-radius: 14px;
            border: 1px solid color-mix(in oklch, var(--border) 40%, transparent);
            background:
              linear-gradient(
                135deg,
                color-mix(in oklch, var(--brand) 20%, rgba(255, 255, 255, 0.06)),
                rgba(255, 255, 255, 0.03)
              );
            box-shadow:
              0 10px 30px rgba(0, 0, 0, 0.28),
              0 0 0 3px color-mix(in oklch, var(--brand) 12%, transparent);
          }

          .news-hero-left {
            display: flex;
            align-items: center;
            gap: 0.9rem;
            min-width: 0;
          }

          .news-hero-icon {
            width: 46px;
            height: 46px;
            border-radius: 12px;
            display: grid;
            place-items: center;
            flex-shrink: 0;
            background: linear-gradient(135deg, var(--brand), var(--brand-hover));
            box-shadow: 0 10px 24px var(--brand-glow);
          }

          .news-hero-icon i {
            font-size: 1.2rem;
            color: rgba(0, 0, 0, 0.85);
          }

          .news-hero-title {
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
            min-width: 0;
          }

          .news-hero-title h1 {
            margin: 0;
            font-size: 1.15rem;
            font-weight: 700;
            letter-spacing: 0.2px;
            color: var(--text-primary);
            line-height: 1.2;
          }

          .news-hero-title p {
            margin: 0;
            font-size: 0.85rem;
            color: var(--text-secondary);
            line-height: 1.35;
          }

          .news-hero-meta {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;
            justify-content: flex-end;
          }

          .news-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
            padding: 0.35rem 0.6rem;
            border-radius: 999px;
            font-size: 0.78rem;
            color: var(--text-primary);
            border: 1px solid color-mix(in oklch, var(--border) 45%, transparent);
            background: color-mix(in oklch, var(--brand) 10%, rgba(255, 255, 255, 0.04));
          }

          .news-pill i {
            color: var(--brand);
          }

          .news-update {
            padding: 1rem 1rem 0.75rem;
            border-radius: 14px;
            border: 1px solid color-mix(in oklch, var(--border) 38%, transparent);
            background: rgba(255, 255, 255, 0.035);
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
            margin-bottom: 1rem;
          }

          .news-update-head {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
            padding-bottom: 0.65rem;
            border-bottom: 1px solid color-mix(in oklch, var(--border) 28%, transparent);
          }

          .news-date {
            font-weight: 800;
            font-size: 0.92rem;
            color: var(--text-primary);
            letter-spacing: 0.2px;
          }

          .news-label {
            font-size: 0.8rem;
            color: var(--text-secondary);
            white-space: nowrap;
          }

          .news-section {
            margin-top: 0.9rem;
          }

          .news-section-title {
            display: flex;
            align-items: center;
            gap: 0.55rem;
            margin: 0 0 0.65rem;
            font-size: 0.95rem;
            font-weight: 800;
            color: var(--text-primary);
          }

          .news-section-title i {
            color: var(--brand);
          }

          .news-items {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.55rem;
          }

          .news-item {
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
            padding: 0.75rem 0.85rem;
            border-radius: 12px;
            border: 1px solid color-mix(in oklch, var(--border) 30%, transparent);
            background: rgba(0, 0, 0, 0.18);
            transition:
              transform 0.12s ease,
              background 0.12s ease,
              border-color 0.12s ease;
          }

          .news-item:hover {
            transform: translateY(-1px);
            background: rgba(0, 0, 0, 0.24);
            border-color: color-mix(in oklch, var(--brand) 35%, var(--border));
          }

          .news-item-icon {
            width: 34px;
            height: 34px;
            border-radius: 10px;
            display: grid;
            place-items: center;
            flex-shrink: 0;
            background: color-mix(in oklch, var(--brand) 12%, rgba(255, 255, 255, 0.03));
            border: 1px solid color-mix(in oklch, var(--brand) 22%, transparent);
          }

          .news-item-icon i {
            font-size: 0.95rem;
            color: var(--brand);
          }

          .news-item-body {
            min-width: 0;
          }

          .news-item-title {
            font-size: 0.9rem;
            font-weight: 800;
            color: var(--text-primary);
            line-height: 1.2;
            margin-bottom: 0.1rem;
          }

          .news-item-desc {
            font-size: 0.84rem;
            color: var(--text-secondary);
            line-height: 1.4;
          }
        </style>

        <div class="news-root">
          <div class="news-hero">
            <div class="news-hero-left">
              <div class="news-hero-icon" aria-hidden="true">
                <i class="fas fa-newspaper"></i>
              </div>
              <div class="news-hero-title">
                <h1>What’s New</h1>
                <p>Fresh features, improvements, and fixes in your desktop.</p>
              </div>
            </div>
            <div class="news-hero-meta">
              <div class="news-pill" title="Latest update shown first">
                <i class="fas fa-clock"></i>
                <span>Latest: ${updates[0]?.date ?? "—"}</span>
              </div>
            </div>
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
