import { BaseApp } from "./core/BaseApp.js";
import { StorageKeys } from "./settings.js";
import { desktop } from "./desktop.js";

const NEWS_UPDATES = [
  {
    date: "May 29, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [
          [
            "fa-bolt",
            "Power Indicator",
            "New tray app for power management. Switch between Turbo, Balanced, and Quality modes with a single click."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-sun",
            "Brightness App",
            "Quick controls for brightness and temperature, advanced toggle for contrast, gamma, and night mode."
          ],
          [
            "fa-arrows-alt",
            "Notification Position",
            "Choose where notifications appear: Bottom Right (default), Bottom Left, Top Right, or Top Left. Smart notification suppression for default position."
          ],
          [
            "fa-mouse-pointer",
            "Tray Context Menus",
            "Right-click tray icons for quick actions. Power modes, brightness presets, Steam library/store, and recent games."
          ]
        ]
      }
    ]
  },
  {
    date: "May 29, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [
          [
            "fa-bolt",
            "Power Indicator",
            "New tray app for power management. Switch between Turbo, Balanced, and Quality modes with a single click."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-sun",
            "Brightness App Redesign",
            "Compact width-oriented design like real tray apps. Quick controls for brightness and temperature, advanced toggle for contrast, gamma, and night mode."
          ],
          [
            "fa-arrows-alt",
            "Notification Position",
            "Choose where notifications appear: Bottom Right (default), Bottom Left, Top Right, or Top Left. Smart notification suppression for default position."
          ]
        ]
      }
    ]
  },
  {
    date: "May 26, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [
          [
            "fa-robot",
            "Yuki AI Assistant",
            "Intelligent Local AI assistant powered by WebLLM. Execute OS actions, workspace controls, app launches, manage files, and get contextual help with automation support."
          ],
          [
            "fa-user-gear",
            "Setup Profile Step",
            "You can now choose your nickname and avatar during your first-time setup, with a final preview of your profile before you finish."
          ],
          [
            "fa-book-open",
            "Yuki OS Guide",
            "Discover what Yuki OS can do with the new system-wide guide. Browse apps, explore features, and understand the system architecture."
          ],
          [
            "fa-th-list",
            "Installed Apps",
            "Manage all your apps in one place. Rename, enable/disable, and uninstall apps with bulk selection support."
          ],
          [
            "fa-clipboard",
            "Clipboard Manager",
            "System-wide clipboard with history support. Access via tray icon, view history, copy items, and clear clipboard."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-eye-slash",
            "Transparent UI Toggle",
            "Make your taskbar and start menu fully transparent with the new Transparent UI setting in the appearance options."
          ],
          ["fa-bell", "Smart Notification Icons", "Notifications now automatically use app icons."],
          ["fa-maximize", "GUI Scaling", "Adjust the scale of your user interface."],
          ["fa-cubes", "App Creator Improvements", "Fixed URL validation to auto-add https://, improved proxy."]
        ]
      }
    ]
  },
  {
    date: "May 25, 2026",
    sections: [
      {
        icon: "fa-palette",
        title: "Theming System",
        items: [
          [
            "fa-swatchbook",
            "Theme Presets & Custom Themes",
            "Expanded theming system with improved consistency across all themes and better custom theme support."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-up-right-and-down-left-from-center",
            "Alt+Right-Click Window Resize",
            "Hold Alt or Super key and right-click drag anywhere on a window to resize it quickly."
          ]
        ]
      }
    ]
  },
  {
    date: "May 24, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-rocket",
            "Setup Wizard Enhancement",
            "Enhanced setup wizard with keyboard shortcuts reference, filesystem introduction, turbo mode selection, start menu pinning, and transparency level options."
          ]
        ]
      }
    ]
  },
  {
    date: "May 23, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-cube", "Yuki Blender", "Added new blender app with enchanced 3d functionality."],
          ["fa-database", "Storage Editor", "Added new Storage Editor app."],
          [
            "fa-film",
            "Window Animation System",
            "Added 35-effect window animation engine: customize open, close, and minimize animations plus click bubble feedback."
          ],
          ["fa-window-maximize", "Improve taskbar previews", "Improved taskbar window previews."]
        ]
      }
    ]
  },
  {
    date: "May 22, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-gamepad", "Azahar Emulator", "Add azahar emulator with 3ds support"],
          ["fa-rocket", "Setup Wizard", "Introduced first-time setup wizard for system personalization."],
          ["fa-steam", "Steam Play Counts", "Introduced steam play count display for every game."],
          ["fa-gamepad", "LuminSDK Catalog", "Added LuminSDK with 1000+ games catalog to steam app."],
          ["fa-video", "Yuki Convert Upgrade", "Added video and audio format support for file conversion."],
          ["fa-window-maximize", "Context Menu Fixes", "Fixed desktop context menu overflow issues."]
        ]
      }
    ]
  },
  {
    date: "May 21, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-thumbtack", "Taskbar Pinning Behaviour Improvement", "Improved taskbar pinning behaviour."],
          ["fa-gamepad", "Games Migration", "Fix 1000+ games images/loading."],
          ["fa-image", "Fix wallpapers display", "Fixed wallpapers display issue."],
          ["fa-trophy", "Improve achievements app ui", "Improved achievements app styling."]
        ]
      }
    ]
  },
  {
    date: "May 19, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-window-maximize", "Add Tray Bar", "Added a new tray bar managing background applications."],
          [
            "fa-table-cells-large",
            "Start Menu Customization",
            "Add option to customize start menu categories and items."
          ],
          ["fa-rocket", "Turbo Mode", "Added turbo mode to os."],
          ["fa-gear", "Settings App", "Reworked settings app interface and navigation."],
          ["fa-minimize", "Window Animations", "Added smooth window drag animations."]
        ]
      }
    ]
  },
  {
    date: "May 18, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [["fa-star", "Angry Birds 2", "Added angry birds 2 / Lobotomy Corp."]]
      }
    ]
  },
  {
    date: "May 17, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-user-circle",
            "New Login Screen",
            "Added nickname and profile selection on startup to initialize your session."
          ],
          [
            "fa-lock",
            "Desktop Lock Screen",
            "Lock your session quickly to prevent unauthorized access while keeping your workspace running."
          ],
          [
            "fa-terminal",
            "Unified Command Palette",
            "Launch apps, open files, apply themes, or run system commands globally via Ctrl+K or F1."
          ],
          [
            "fa-keyboard",
            "Keyboard Shortcuts App",
            "Explore all global hotkeys and built-in application shortcuts in one central utility."
          ],
          [
            "fa-window-restore",
            "Window Session Persistence",
            "Automatically saves and restores open window states, layout, and positioning across reloads."
          ]
        ]
      }
    ]
  },
  {
    date: "May 15, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-wifi", "CDN Mirror Selection", "Added CDN Mirror Selection option."],
          ["fa-gear", "Settings & UI Improvement", "Added setting categories and Theme Selection"]
        ]
      }
    ]
  },
  {
    date: "May 14, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-star", "Steam Improvement", "Improved steam ui and added settings."],
          ["fa-film", "Ruffle App", "Added ruffle."],
          ["fa-star", "Slime Rancher and TABS", "Added Slime Rancher and TABS."]
        ]
      }
    ]
  },
  {
    date: "May 9, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-steam-symbol", "Steam Improvement", "Improved steam ui and added settings."],
          ["fa-film", "Ruffle App", "Added ruffle."],
          ["fa-mobile-screen", "PWA Support", "Added progressive web app support for YukiOS."],
          ["fa-sliders", "Taskbar Customization support", "Added taskbar alignment options."],
          ["fa-user", "Profile Customization support", "Added Customize Profile app."],
          ["fa-brands fa-steam", "Steam Improvement", "Added data pack install option steam and optimize load speed"],
          ["fa-arrow-pointer", "Cursor Support", "Added custom cursor support"],
          ["fa-route", "Add proxy support for custom apps", "Added proxy support for created web apps"],
          ["fa-wrench", "App Creator Improvements", "Improved the App Creator workflow and usability."],
          [
            "fa-gamepad",
            "New Games: Happy Room, Fez, TABS, Slime Rancher",
            "Added Happy Room, Fez,TABS,Slime Rancher to the games collection."
          ],
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
          ["fa-link", "CDN Reliability", "Fixed a statically URL used for loading assets."],
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
          ["fa-code", "Yuki Code", "A powerful code editor is now available as a built-in app."],
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
          ["fa-film", "Video Turbo", "Smoother video playback across the system."]
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

export const updateNewsBadge = () => {
  const currentSignature = getNewsContentSignature();
  const storedSignature = localStorage.getItem(StorageKeys.newsReadSignatureKey);
  const hasUnreadNews = currentSignature !== storedSignature;

  const badge = document.querySelector(".news-badge");
  if (badge) {
    badge.style.display = hasUnreadNews ? "flex" : "none";
  }
};

export class NewsApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  initNews() {
    localStorage.setItem(StorageKeys.newsReadSignatureKey, getNewsContentSignature());
    localStorage.setItem(StorageKeys.newsSeenKey, "true");
    window._newsApp = this;
    updateNewsBadge();
  }

  open() {
    if (this._isSingletonOpen("news-yukios")) return;

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

    const content = `
      <div class="window-header">
        <span>What's New</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="window-content" style="padding:0; height: calc(100% - 40px); overflow: hidden;">
        <div class="news-root">
          <div class="news-hero">
            <div class="news-hero-left">
              <div class="news-hero-icon" aria-hidden="true">
                <i class="fas fa-newspaper"></i>
              </div>
              <div class="news-hero-title">
                <h1>What's New</h1>
                <p>Fresh features, improvements, and fixes in your desktop.</p>
              </div>
            </div>
            <div class="news-hero-meta">
              <div class="news-pill" title="Latest update shown first">
                <i class="fas fa-clock"></i>
                <span>Latest: ${updates[0]?.date ?? "-"}</span>
              </div>
            </div>
          </div>

          ${updatesHtml}
        </div>
      </div>
    `;

    const win = this.wm.createWindow("news-yukios", "What's New", "720px", "520px");
    win.innerHTML = content;
    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "What's New", "fa fa-newspaper");
    this.wm.bringToFront(win);

    this.initNews();
  }
}
