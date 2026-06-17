# Yuki OS - Agent Reference

## Hard Rules

- Never run `npm/pnpm format` or `npm/pnpm bf`
- Never add comments, docstrings, or `/* */` blocks in CSS, JS, or HTML other than "JSDoc" for complex functions
- Never spawn a browser for testing
- Before finalizing any code changes, run `pnpm build:dev` in `webos-desktop/`. A change that breaks the build is
  incomplete.
- Always use CSS variables from `src/styles/style.css`. Never hardcode colors.
- When making significant changes, new features, or new apps: you must register them in src/news.js with an icon, title,
  and a punchy, active-voice description under 15 words. Bad: 'First-time setup now includes a dedicated profile
  step...' Good: 'Choose your nickname and avatar during setup, with a quick final preview!'
- Whenever you define a new app to appJauncher or gamesJist, define description for it on gameDescriptions.js
- Always use StorageKeys from `src/StorageKeys.js` for localStorage access. Never hardcode localStorage key strings.
  Import StorageKeys and use the defined constants. If a new key is needed, add it to StorageKeys.js first.
- Always use `os.storage` API instead of bare `localStorage`; the storage module handles serialization/deserialization
  automatically.
- Never use browser native alerts, prompts, or confirms (alert(), prompt(), confirm()). Always use the shared dialog
  utilities from `src/shared/dialogs.js` instead. Import and use `showAlert`, `showPrompt`, `showConfirm`,
  `customAlert`, `customPrompt`, or `customConfirm` as appropriate.
- Never use `document.querySelector`, `document.querySelectorAll`, or direct DOM manipulation methods. Always use the
  utility functions from `src/shared/domUtils.js` instead. Import and use `$` (querySelector), `$$` (querySelectorAll),
  `bindEvent`, `toggleClass`, `setText`, `setHTML`, `createElement`, etc. For general utility functions, use
  `src/utils/utils.js` (e.g., `formatSize`, `isImageFile`, `isTextFile`, `pluralize`).
- Use os.notify.send() for discrete, user-facing application events that represent a state change or completion, and
  ensure notifications are not emitted from high-frequency, repeating, or continuously-updating processes.
- If a change introduces a new system, abstraction, manager, API surface, or reusable capability, create a new file and
  integrate it via imports. Only modify existing files if the change is a direct refinement of existing logic without
  introducing a new responsibility boundary.

---

## Code Quality Guidelines

Write modular, clean, and DRY code. Follow these principles:

- **Modularity**: Separate concerns into focused modules. Each file should have a single, clear responsibility. Avoid
  monolithic files that handle multiple unrelated concerns.
- **Single Responsibility**: Functions and classes should do one thing well. If a function does more than one thing,
  split it into smaller, focused functions.
- **DRY (Don't Repeat Yourself)**: Never duplicate logic. Use shared utilities from `src/shared/` instead of
  reimplementing common functionality. If you find yourself writing the same code in multiple places, extract it into a
  reusable function.
- **Prefer Existing Utilities**: Before writing new utility functions, check `src/shared/` for existing helpers. Common
  patterns like dialogs, asset resolution, and platform detection already have implementations.
- **Clean Function Names**: Use descriptive, action-oriented function names. `installApp()` is better than `doIt()`.
  `validateUrl()` is better than `check()`.
- **Avoid Deep Nesting**: More than 3 levels of nesting indicates a need for refactoring. Use early returns and guard
  clauses to reduce nesting.
- **Keep Functions Small**: Functions should fit on a screen (typically < 50 lines). If a function is longer, consider
  splitting it into smaller helper functions.
- **Use Meaningful Variables**: Variable names should reveal intent. `userList` is better than `data`. `isValid` is
  better than `flag`.
- **Avoid Magic Numbers/Strings**: Extract constants to the top of the file or a constants file. Use CSS variables for
  styling values.
- **Consistent Patterns**: Follow existing patterns in the codebase. If similar apps use a certain structure, follow
  that structure for new apps.
- **Enforce KISS and YAGNI:** Write the absolute minimum code required to make current tests pass; do not build abstract
  factories, extra interfaces, or future-proof scaffolding for features that are not explicitly requested in the prompt.

---

## Styling System

Yuki OS uses a dark glassmorphism theme with a comprehensive theming system. All rules below are non-negotiable.

- **CSS Variables**: Use `--brand` (accent), `--text-primary`, `--text-secondary`, `--bg-primary`, `--bg-secondary`,
  `--glass`, `--glass-border`, `--error`. Never introduce new hues or hardcoded values.
- **Color Hue**: All colors use unified hue 265 (purple). Never mix in gray or blue hues.
- **Glassmorphism**: `backdrop-filter: blur(32px+)`, semi-transparent `rgba` backgrounds (0.6–0.98 opacity), subtle
  borders (`rgba(255,255,255,0.08–0.12)`).
- **Depth**: Multi-layer box shadows - `0 24px 64px rgba(0,0,0,0.65)` + inset highlight.
- **Typography**: System fonts or JetBrains Mono for code. 13–16px base (minimum 12px for any readable text). Opacity
  0.7–0.9 for secondary text. Never use font-size below 12px for user-facing content unless absolutely necessary (e.g.,
  badges, timestamps).
- **Radius**: 6–14px depending on element size.
- **Transitions**: 0.1–0.2s for hover states.
- **Light Theme**: Override via `html[data-theme="light"]` with solid colors (`#fff`, `#f0f0f0`, `#111`, `#666`).
- **Scrollbars**: 8px width, `rgba(255,255,255,0.12)` thumb.
- **Checkboxes/Inputs**: Never use native browser checkboxes, plain inputs, or dropdowns. Always use `appearance: none`,
  `-webkit-appearance: none`, custom border/background, and `::after` pseudo-element for checkmarks via CSS variables.
- **Theming System**: Comprehensive theme engine with 25+ built-in themes, transparent UI toggle, advanced brightness
  controls, and GUI scale options. Themes are managed via `settings.js` and applied through CSS variables.
- Never introduce new inline styles.
- Prefer CSS classes.
- Existing inline styles may be migrated to css classes when touched.
- New declarative UI definitions should use class names instead of style objects.

## File Size Guidelines

Target maximums:

- Utility modules: <300 lines
- Runtime modules: <500 lines
- Apps: <1000 lines

When a file exceeds these sizes:

- Prefer extracting focused modules.
- Prefer composition over adding more methods.
- New features should be added to extracted modules when possible.

## Do not increase file size when a clean extraction is feasible.

## Architecture

```
main.js initializes services
    ↓
Services Container (WindowManager, FileSystemManager, NotificationCenter, EventBus)
    ↓
40+ Applications (all inherit BaseApp, receive injected services)
    ↓
Desktop UI renders windows, taskbar, start menu
```

**App lifecycle:**

1. **Definition** - App class created in `src/apps/`
2. **Registration** - App added to `APP_DEFINITIONS` in `AppLoader.js` and metadata to `SYSTEM_APPS` in
   `AppRegistryConfig.js`
3. **Instantiation** - `loadApps(services)` in `main.js` instantiates all registered apps and attaches to `services`
   object
4. **Launch** - `AppLauncher.launch(appId)` dispatches
5. **Open** - `app.open()` creates window via `WindowManager`
6. **Close** - `onClose(winId)` cleanup hook called

---

## OS Bridge API

The OS Bridge provides a unified API surface for applications to interact with system services. Instead of directly
accessing kernel services (WindowManager, FileSystemManager, NotificationCenter, EventBus, TrayManager, AppLauncher),
apps should use the `os.*` bridge.

**Import:**

```javascript
import { os } from "./os/index.js";
```

### Window API - `os.window`

| Method                                      | Purpose                                     |
| ------------------------------------------- | ------------------------------------------- |
| `create(id, title, width, height, options)` | Create styled window element                |
| `close(win)`                                | Close window, cleanup, remove taskbar entry |
| `focus(win)`                                | Raise z-index, focus window                 |
| `minimize(win)`                             | Hide window, mark taskbar minimized         |
| `maximize(win)`                             | Expand/restore window                       |
| `bringToFront(win)`                         | Raise z-index, focus window                 |
| `addToTaskbar(winId, title, icon, color)`   | Add window to taskbar                       |
| `removeFromTaskbar(winId)`                  | Remove window from taskbar                  |
| `getWindowControls(externalUrl)`            | Get window control buttons HTML             |

### Filesystem API - `os.fs`

| Method                                                | Purpose                                                |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `read(path, options)`                                 | Read file content (options: { encoding: "binary" })    |
| `write(path, content, options)`                       | Write file content (options: { encoding, kind, icon }) |
| `readdir(path)`                                       | Get directory contents                                 |
| `mkdir(path)`                                         | Create directory recursively                           |
| `delete(path, name)`                                  | Delete file or directory                               |
| `exists(path)`                                        | Check if path exists                                   |
| `copy(source, destination)`                           | Copy file/directory                                    |
| `rename(oldPath, newPath)`                            | Rename file/directory                                  |
| `isFile(path)`                                        | Check if path is a file                                |
| `getFileKind(path)`                                   | Get file kind/metadata                                 |
| `getFileIcon(path)`                                   | Get file icon path                                     |
| `writeBinaryFile(path, name, blob, kind, icon)`       | Write binary file to blob storage                      |
| `readBinaryFile(path, name)`                          | Read binary file from blob storage                     |
| `deleteBinaryFile(path, name)`                        | Delete binary file from blob storage                   |
| `renameBinaryFile(path, oldName, newName)`            | Rename binary file in blob storage                     |
| `createFile(path, name, content, kind, icon, faIcon)` | Create file                                            |
| `createFolder(path, name)`                            | Create folder                                          |
| `deleteItem(path, name)`                              | Delete item (file or folder)                           |
| `renameItem(path, oldName, newName)`                  | Rename item                                            |
| `updateFile(path, name, content, meta)`               | Update file                                            |

**Note:** Binary file methods use blob storage and require separate `name` parameter.

### Notification API - `os.notify`

| Method                          | Purpose                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| `send(title, message, options)` | Show toast notification (options: { type, duration, icon, appSource }) |
| `clear(id)`                     | Clear specific notification by ID                                      |
| `clearAll()`                    | Clear all notifications                                                |
| `getAll()`                      | Get all notifications                                                  |
| `getCount()`                    | Get notification count                                                 |
| `setDoNotDisturb(enabled)`      | Set do-not-disturb mode                                                |
| `getDoNotDisturb()`             | Get do-not-disturb status                                              |

### Tray API - `os.tray`

| Method                                  | Purpose                                 |
| --------------------------------------- | --------------------------------------- |
| `register(winId, icon, label, options)` | Register window to system tray          |
| `unregister(winId)`                     | Remove window from system tray          |
| `updateIcon(winId, newIcon)`            | Update tray icon                        |
| `updateLabel(winId, newLabel)`          | Update tray label                       |
| `updateContextMenuItems(winId, items)`  | Update context menu items               |
| `sendToTray(winId)`                     | Hide window + taskbar → tray            |
| `restoreFromTray(winId)`                | Restore window + taskbar from tray      |
| `getTrayItems()`                        | Get Map of all tray items (raw)         |
| `getAllItems()`                         | Get array of all tray items (formatted) |
| `updateItemVisibility(winId, visible)`  | Update item visibility                  |
| `isRegistered(winId)`                   | Check if window is registered           |

## Tray Register options:

- `resident: boolean` - App stays in tray permanently (cannot be restored to window)
- `showInTray: boolean` - App shows in tray icon area
- `onClick: function` - Callback when tray icon clicked
- `onQuit: function` - Callback when app is quit from tray
- `contextMenuItems: array` - Custom context menu items (objects with label, action, icon, type)
- `priority: number` - Sorting priority (higher = more prominent)

### App API - `os.app`

| Method                              | Purpose                      |
| ----------------------------------- | ---------------------------- |
| `launch(appId, options)`            | Launch app by ID             |
| `launchGame(appId, isSwf, options)` | Launch game with SWF support |
| `close(winId)`                      | Close app by window ID       |
| `getRunningApps()`                  | Get list of running apps     |
| `getAllApps()`                      | Get all registered apps      |
| `getAppInfo(appId)`                 | Get app metadata             |
| `hasApp(appId)`                     | Check if app is registered   |
| `searchApps(query)`                 | Search apps by title         |

### Events API - `os.events`

| Method                 | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `on(event, handler)`   | Register listener                              |
| `off(event, handler)`  | Unregister listener                            |
| `emit(event, data)`    | Fire event to all listeners                    |
| `once(event, handler)` | Register one-time listener                     |
| `clear(event)`         | Clear all listeners for an event or all events |
| `listenerCount(event)` | Get listener count for an event                |

**Standard events:** `SETTINGS_CHANGED`, `WINDOW_CREATED`, `WINDOW_FOCUSED`, `WINDOW_CLOSED`, `FILE_CHANGED`,
`SESSION_INITIALIZED`, `AI_ACTION_EXECUTED`

### Storage API - `os.storage`

| Method            | Purpose                        |
| ----------------- | ------------------------------ |
| `get(key)`        | Get value from storage         |
| `set(key, value)` | Set value in storage           |
| `remove(key)`     | Remove value from storage      |
| `clear()`         | Clear all storage              |
| `has(key)`        | Check if key exists in storage |

---

## Shared Utilities - `src/shared/`

Always prefer these over reimplementing logic.

### `dialogs.js`

| Function                                                | Return                    |
| ------------------------------------------------------- | ------------------------- |
| `showAlert(title, message, buttonText)`                 | `Promise<void>`           |
| `showPrompt(title, message, defaultValue, confirmText)` | `Promise<string \| null>` |
| `showConfirm(title, message, confirmText, cancelText)`  | `Promise<boolean>`        |
| `customAlert(message, title)`                           | `Promise<void>`           |
| `customPrompt(message, defaultValue, title)`            | `Promise<string \| null>` |
| `customConfirm(message, title)`                         | `Promise<boolean>`        |

### `conflictDialog.js`

| Function                                                       | Return                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `showConflictDialog(fileName)`                                 | `Promise<{ action, applyToAll }>` - action: `replace`/`keep`/`skip` |
| `resolveConflicts(items, existsCheck, getKey, applyToAllInit)` | `Promise<Array<{ item, action }>>`                                  |

### Other shared helpers

| File               | Exports                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `contextMenu.js`   | `showContextMenu`, `showDynamicContextMenu`, `showStartStyleMenu`, `hideMenu`, `refreshIcons`   |
| `assetResolver.js` | `resolveUrl`, `resolveYukiAsset`, `fetchHtmlAsBlobUrl`, `resolveIconUrl`, `resolveWallpaperUrl` |
| `iframeUtils.js`   | `resolveUrl`, `fetchHtmlAsBlobUrl`, `looksLikeHtml`, `isCdnGhUrl`                               |
| `cdnConfig.js`     | `CDN_CONFIG`, `getLibraryUrl`, `getRepoUrl`                                                     |
| `iconUtils.js`     | `resolveDesktopIcon`                                                                            |
| `platformUtils.js` | `detectOS`, `isMobile`, `getBrowser`                                                            |
| `coreMap.js`       | `detectCore`, `coreLabel`, `ROM_EXTS`                                                           |
| `weatherCodes.js`  | `WEATHER_CODES`, `getWeatherIcon`, `getWeatherInfo`                                             |
| `iframeAttrs.js`   | `IFRAME_ATTRS`                                                                                  |

---

## App Registry

### AppLauncher - `appLauncher.js`

Central dispatcher. `launch(appId, swf, extra)` is the main entry point. Routes to app instance or creates sandboxed
iframe for games. Handles analytics, achievements, Steam stats. Integrates with installed apps registry for app
management.

### gamesList - `gamesList.js`

Registry of 3700+ games/apps. `appMap[appId]` contains `{ type, title, url, icon, action }`.

- Types: `"system"`, `"game"`, `"html"`, `"remote"`

### gameDescriptions - `gameDescriptions.js`

Rich metadata per app: title, description, genre, year, developer.

### appCreator - `appCreator.js`

UI to create custom shortcuts to external URLs. Auto-detects favicon, supports per-app CORS proxy. Saves to
`/home/reeyuki/Apps/`.

### installedApps - `installedApps.js`

App registry system for managing installed/uninstalled apps. Provides dynamic app metadata, disable/uninstall support,
and custom naming. Integrates with AppLauncher for app management.

---

## Application Catalog

### File & Explorer

| App              | File                  | Key Methods                                                                                                                                              |
| ---------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ExplorerApp      | `explorer.js`         | `open(path)`, `navigateTo(path)`, `deleteFile(path)`, `renameFile(old, new)`, `openSaveDialog(defaultFileName, onSave)`, `openDirectoryDialog(onSelect)` |
| fileDisplay      | `fileDisplay.js`      | Renders images, video, PDF, code, text, markdown                                                                                                         |
| archiveExtractor | `archiveExtractor.js` | ZIP/7z extraction, list archive contents                                                                                                                 |

---

## File/Directory Selection Dialogs

The Explorer app provides built-in dialog methods for file and directory selection. These should be used instead of
native browser dialogs or manual path input.

### Explorer Dialog Methods

**Access Explorer app from services:**

```javascript
const explorerApp = this.services.explorerApp;
```

#### `openSaveDialog(defaultFileName, onSave)`

Opens a file save dialog with Explorer UI. User can navigate directories and enter a filename.

**Parameters:**

- `defaultFileName` (string): Suggested filename for the save dialog
- `onSave` (function): Callback that receives `(path, filename)` when user clicks Save

**Usage:**

```javascript
explorerApp.openSaveDialog("myfile.txt", (path, filename) => {
  const fullPath = path.join("/");
  const filePath = `${fullPath}/${filename}`;
  await os.fs.write(fullPath, filename, content);
});
```

#### `openDirectoryDialog(onSelect)`

Opens a directory selection dialog with Explorer UI. User can navigate and select a directory.

**Parameters:**

- `onSelect` (function): Callback that receives `path` (array) when user clicks Select

**Usage:**

```javascript
explorerApp.openDirectoryDialog((path) => {
  const pathStr = path.join("/");
  await os.fs.mkdir(pathStr);
});
```

#### `open(path, callback)`

Opens Explorer in file selection mode when a callback is provided.

**Parameters:**

- `path` (array|string): Initial path to navigate to
- `callback` (function): Callback that receives selected file path when user selects a file

**Usage:**

```javascript
explorerApp.open(["Documents"], (selectedPath) => {
  console.log("Selected file:", selectedPath);
});
```

### Best Practices

- **Always use Explorer dialogs** for file/directory selection instead of `showPrompt` for manual path input
- **Use `openDirectoryDialog`** when you need the user to select a directory (e.g., save location)
- **Use `openSaveDialog`** when saving a file with a user-specified name
- **Use `open` with callback** when you need the user to select an existing file
- **Handle null/undefined returns** - callbacks may not be called if user cancels the dialog

### Productivity

| App            | File        | Notes                                     |
| -------------- | ----------- | ----------------------------------------- |
| NotepadApp     | -           | Text editor, file save/load               |
| MarkdownApp    | -           | Split-pane editor with live preview       |
| YukiCode       | `monaco.js` | Monaco editor (VSCode engine) integration |
| CalculatorApp  | -           | Scientific calculator with memory         |
| OfficeAppProxy | `office.js` | Office 365 viewer for .docx/.xlsx/.pptx   |

### Media & Emulators

| App        | File         | Notes                              |
| ---------- | ------------ | ---------------------------------- |
| Camera     | -            | Webcam access, photo capture       |
| Model3DApp | `model3d.js` | Three.js viewer for OBJ, GLTF, GLB |
| YouTubeApp | -            | YouTube integration                |
| JsDosApp   | `jsdos.js`   | DOS emulation + Ruffle Flash       |
| V86App     | `v86.js`     | x86-64 full system emulation       |

### System Utilities

| App                  | File                  | Notes                                                                                |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------ |
| TerminalApp          | -                     | CLI: ls, cd, mkdir, rm, cp, mv, cat, pwd, etc.                                       |
| TaskManagerApp       | -                     | Window/process list, close apps                                                      |
| SettingsApp          | -                     | Theme, wallpaper, taskbar, sound, DND, language, GUI scale, brightness, transparency |
| ProfileCustomizerApp | -                     | Username, profile picture, desktop colors                                            |
| AchievementsApp      | -                     | Tracks launches, playtime milestones, friend stats                                   |
| AboutApp             | -                     | System info, version, credits                                                        |
| newsApp              | `news.js`             | News aggregation with categories, unread bubble                                      |
| WeatherApp           | `weather.js`          | Current weather and forecast                                                         |
| CategoriesApp        | `categories.js`       | Organize games by genre/tag                                                          |
| GuideApp             | `yukiOsGuide.js`      | Interactive guide and tutorial system                                                |
| ClipboardManagerApp  | `clipboardManager.js` | Clipboard history and management                                                     |

### System Services

| Service       | File               | Role                                                        |
| ------------- | ------------------ | ----------------------------------------------------------- |
| DesktopUI     | `desktopui.js`     | Desktop background, taskbar, start menu                     |
| startMenu     | `startMenu.js`     | Start menu and app grid UI                                  |
| system.js     | -                  | Wallpaper and theme management                              |
| wallpapers.js | -                  | Wallpaper store (13 default + custom)                       |
| settings.js   | -                  | Preference storage (localStorage wrapper)                   |
| audioMixer.js | -                  | Global audio, per-app volume via `createAudioTrack(appId)`  |
| analytics.js  | -                  | Usage tracking (launches, playtime, features, friend stats) |
| clippy.js     | -                  | Virtual assistant with contextual tips                      |
| BrowserApp    | -                  | Lightweight web browser with bookmarks                      |
| installedApps | `installedApps.js` | App registry for installed/uninstalled apps management      |
| networkTray   | `networkTray.js`   | Network status display in system tray                       |
| powerTray     | `powerTray.js`     | Battery/power indicator in system tray                      |

---

## Adding a New Declarative App

Follow these steps to add a new app using the declarative framework:

### 1. Create App File

Create `src/apps/myApp.js`:

```javascript
import { BaseApp } from "./core/BaseApp.js";
import { PersistenceTypes } from "./runtime/AppSchema.js";

export class MyApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  getDeclarativeSchema(opts) {
    return {
      id: "my-app",
      name: "My App",
      icon: "fas fa-star",
      windows: [
        {
          id: "my-app-window",
          title: "My App",
          size: ["500px", "400px"],
          icon: "fas fa-star",
          ui: {
            type: "element",
            tag: "div",
            props: {
              className: "my-app-container"
            },
            children: [
              {
                type: "element",
                tag: "button",
                props: {
                  textContent: "Click Me"
                },
                events: {
                  click: {
                    type: "custom:myAction",
                    stopPropagation: true
                  }
                }
              }
            ]
          },
          events: {
            window: {
              keydown: {
                type: "custom:handleKeydown",
                stopPropagation: false
              }
            }
          }
        }
      ],
      state: {
        initial: {
          count: 0
        },
        persistence: PersistenceTypes.MEMORY
      },
      actions: {
        myAction: (payload, event, element, state) => {
          state.count += 1;
        },
        handleKeydown: (payload, event, element, state) => {
          if (event.key === "Enter") {
            // Handle enter key
          }
        }
      },
      onMount: (win, state, actionExecutor) => {
        // Optional initialization logic
      }
    };
  }

  onClose(winId) {}
}
```

### 2. Add to AppLoader.js

Add entry to `APP_DEFINITIONS` in `src/AppLoader.js`:

```javascript
const APP_DEFINITIONS = [
  // ... existing entries
  { serviceKey: "myApp", AppClass: MyApp, enhanced: true }
];
```

### 3. Add to AppRegistryConfig.js

Add metadata to `SYSTEM_APPS` in `src/AppRegistryConfig.js`:

```javascript
export const SYSTEM_APPS = {
  // ... existing entries
  myApp: {
    serviceKey: "myApp",
    type: "system",
    title: "My App",
    icon: "fas fa-star",
    launchType: "instance",
    windowIdPatterns: ["my-app"],
    category: "office",
    clippy: { message: "Your app description here.", animation: ClippyAnimation.Show }
  }
};
```

### 4. Add CSS Styling

Create `src/styles/myApp.css` with Yuki OS styling:

```css
.my-app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  padding: 16px;
  gap: 16px;
}
```

### 5. Import CSS in index.html

Add link tag to `index.html`:

```html
<link href="src/styles/myApp.css" rel="stylesheet" />
```

### 6. Add Description to gameDescriptions.js

Add entry to `src/games/gameDescriptions.js`:

```javascript
export const APP_DESCRIPTIONS = {
  // ... existing entries
  myApp: "Brief description under 15 words."
};
```

### 7. Register in news.js

Add entry to `NEWS_UPDATES` in `src/news.js`:

```javascript
const NEWS_UPDATES = [
  {
    date: "CURRENT_DATE",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [["fa-star", "My App", "Punchy, active-voice description under 15 words."]]
      }
    ]
  }
  // ... existing entries
];
```

### 8. Verify Build

Run build to verify:

```bash
cd webos-desktop && pnpm build:dev
```

---

## Declarative Apps Framework

Apps must define structure declaratively via `getDeclarativeSchema(opts)` instead of imperative code.

```javascript
getDeclarativeSchema(opts) {
  return {
    id: "my-app",
    name: "My App",
    icon: "fas fa-star",
    windows: [{
      id: "my-app",
      title: "My App",
      size: ["400px", "300px"],
      icon: "fas fa-star",
      iconColor: "#4f9eff",
      ui: "<div>App UI</div>",
      events: {
        "#my-button": {
          click: { type: "custom:myAction", stopPropagation: true }
        }
      }
    }],
    state: {
      initial: { value: 0 },
      persistence: "memory"
    },
    actions: {
      myAction: (payload, event, element, state) => {
        state.value += 1;
      }
    },
    onMount: "initMyApp"
  };
}
```

**Runtime components:** | File | Role | |------|------| | `runtime/StateManager.js` | Manages local app state, optional
persistence | | `runtime/AppRenderer.js` | Parses window configs, mounts into DOM via WindowHelper | |
`runtime/EventBinder.js` | Maps element events to actions | | `runtime/ActionExecutor.js` | Dispatches actions, modifies
state, runs system ops |

**HybridAdapter** (`runtime/HybridAdapter.js`) - `enhanceBaseApp(BaseAppClass)` wraps `open()` to check for a
declarative schema first; falls back transparently to imperative `open()` if none found. Also translates legacy
multi-parameter signatures (e.g. `open(title, content, filePath)`) into structured `opts` objects.
