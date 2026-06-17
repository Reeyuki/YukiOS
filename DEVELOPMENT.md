# Development Guide - Yuki OS

This guide covers how to create new applications, add functionalities, and contribute to Yuki OS.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Creating a New App](#creating-a-new-app)
- [App Architecture](#app-architecture)
- [OS Bridge API](#os-bridge-api)
- [Styling Guidelines](#styling-guidelines)
- [Creating Themes](#creating-themes)
- [Testing](#testing)
- [Build & Deployment](#build--deployment)

---

## Prerequisites

- Node.js and pnpm installed
- Basic knowledge of JavaScript/ES6+
- Understanding of DOM manipulation
- Familiarity with CSS and theming

---

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd yukios
   ```

2. **Install dependencies**

   ```bash
   cd webos-desktop
   pnpm install
   ```

3. **Start development server**

   ```bash
   pnpm run dev
   ```

4. **Build for production**
   ```bash
   pnpm run build:dev
   ```

---

## Creating a New App

Yuki OS uses a declarative app framework with a centralized manifest system. Follow these steps to create a new
application:

### Step 1: Create the App File

Create a new file in `webos-desktop/src/apps/` directory:

```javascript
// src/apps/myApp.js
import "../styles/myApp.css";
import { BaseApp } from "../core/BaseApp.js";
import { PersistenceTypes } from "../runtime/AppSchema.js";

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

  onClose(winId) {
    // Cleanup logic when window closes
  }
}
```

### Step 2: Add CSS Styling

Create `webos-desktop/src/styles/myApp.css`:

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

**Important:** Import the CSS at the top of your app file (as shown in Step 1). Do not add `<link>` tags to
`index.html`.

### Step 3: Add Entry to AppManifest.js

Add a manifest entry to `webos-desktop/src/registry/AppManifest.js`:

```javascript
import { ClippyAnimation } from "../ai/clippy.js";

export const APP_MANIFESTS = [
  // ... existing entries
  {
    serviceKey: "myApp",
    enhanced: true,
    type: "system",
    title: "My App",
    icon: "fas fa-star",
    launchType: "instance",
    windowIdPatterns: ["my-app"],
    category: "office",
    clippy: { message: "Your app description here.", animation: ClippyAnimation.Show },
    description: "Brief description under 15 words for the app guide."
  }
];
```

**Manifest fields:**

- `serviceKey` - Unique identifier for the app
- `enhanced` - Whether to apply HybridAdapter enhancement
- `type` - App type (usually "system")
- `title` - Display name
- `icon` - Font Awesome icon class or CDN URL
- `launchType` - "instance", "steam", "iframe", or "method"
- `windowIdPatterns` - Array of window ID patterns
- `category` - App category (development, graphics, games, help, internet, media, office, system)
- `clippy` - Clippy message and animation
- `description` - App description for the guide
- `news` (optional) - News entry for the What's New app
- `onLoad` (optional) - Callback when app loads
- `isHeavy` (optional) - Mark as resource-intensive
- `persistContentState` (optional) - Persist window content
- `excludeFromInstalledApps` (optional) - Exclude from Installed Apps
- `launchMethod` (optional) - Custom launch method name
- `source` (optional) - URL for iframe launch type

### Step 4: Register in AppLoader.js

Add import and entry to `APP_DEFINITIONS` in `webos-desktop/src/AppLoader.js`:

```javascript
import { MyApp } from "./apps/myApp.js";

const APP_DEFINITIONS = [
  // ... existing entries
  { serviceKey: "myApp", AppClass: MyApp, enhanced: true }
];
```

### Step 5: Verify Build

Run the build to ensure everything works:

```bash
cd webos-desktop && pnpm build:dev
```

The build will automatically validate the registry via the prebuild script.

---

## Adding a Web App (URL-based)

For simple web apps that just load a URL in scramjet, you can use the web app system instead of creating a full app
class. Web Apps use scramjet proxy underneath.

### Step 1: Add Entry to AppManifest.js

Add a manifest entry to `webos-desktop/src/registry/AppManifest.js` with `targetUrl` and `windowSize` fields:

```javascript
export const APP_MANIFESTS = [
  // ... existing entries
  {
    serviceKey: "myWebApp",
    enhanced: true,
    type: "system",
    title: "My Web App",
    icon: "fas fa-globe",
    launchType: "instance",
    windowIdPatterns: ["my-web-app"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Your app description here.", animation: ClippyAnimation.Show },
    description: "Brief description under 15 words for the app guide.",
    targetUrl: "https://example.com",
    windowSize: ["90vw", "85vh"]
  }
];
```

### Step 2: Verify Build

```bash
cd webos-desktop && pnpm build:dev
```

---

## App Architecture

### App Lifecycle

1. **Definition** - App class created in `src/apps/`
2. **Registration** - App added to `APP_DEFINITIONS` in `AppLoader.js` and metadata to `SYSTEM_APPS` in
   `AppRegistryConfig.js`
3. **Instantiation** - `loadApps(services)` in `main.js` instantiates all registered apps and attaches to `services`
   object
4. **Launch** - `AppLauncher.launch(appId)` dispatches
5. **Open** - `app.open()` creates window via `WindowManager`
6. **Close** - `onClose(winId)` cleanup hook called

### Declarative Schema Structure

Apps must define structure declaratively via `getDeclarativeSchema(opts)`:

```javascript
getDeclarativeSchema(opts) {
  return {
    id: "my-app",              // Unique app identifier
    name: "My App",            // Display name
    icon: "fas fa-star",       // Font Awesome icon
    windows: [{
      id: "my-app",            // Window ID
      title: "My App",         // Window title
      size: ["400px", "300px"], // Width, height
      icon: "fas fa-star",     // Window icon
      ui: "<div>App UI</div>", // HTML or declarative UI
      events: {                // Event handlers
        "#my-button": {
          click: { type: "custom:myAction", stopPropagation: true }
        }
      }
    }],
    state: {
      initial: { value: 0 },   // Initial state
      persistence: "memory"     // Persistence type
    },
    actions: {
      myAction: (payload, event, element, state) => {
        state.value += 1;
      }
    },
    onMount: "initMyApp"       // Mount callback
  };
}
```

---

## OS Bridge API

The OS Bridge provides a unified API surface for applications to interact with system services. Apps should use the
`os.*` bridge.

**Import:**

```javascript
import { os } from "../os/index.js";
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

**Tray Register options:**

- `resident: boolean` - App stays in tray permanently
- `showInTray: boolean` - App shows in tray icon area
- `onClick: function` - Callback when tray icon clicked
- `onQuit: function` - Callback when app is quit from tray
- `contextMenuItems: array` - Custom context menu items
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

## Styling Guidelines

Yuki OS uses a dark glassmorphism theme with a comprehensive theming system.

### CSS Variables

Always use these CSS variables from `src/styles/style.css`:

- `--brand` (accent color)
- `--text-primary`
- `--text-secondary`
- `--bg-primary`
- `--bg-secondary`
- `--glass`
- `--glass-border`
- `--error`

**Never introduce new hues or hardcoded colors.**

### Color Hue

All colors use unified hue 265 (purple). Never mix in gray or blue hues.

### Glassmorphism

- `backdrop-filter: blur(32px+)`
- Semi-transparent `rgba` backgrounds (0.6–0.98 opacity)
- Subtle borders (`rgba(255,255,255,0.08–0.12)`)

### Depth

Multi-layer box shadows:

- `0 24px 64px rgba(0,0,0,0.65)` + inset highlight

### Typography

- System fonts or JetBrains Mono for code
- 13–16px base (minimum 12px for readable text)
- Opacity 0.7–0.9 for secondary text
- Never use font-size below 12px for user-facing content

### Radius

6–14px depending on element size.

### Light Theme

Override via `html[data-theme="light"]` with solid colors (`#fff`, `#f0f0f0`, `#111`, `#666`).

### Scrollbars

8px width, `rgba(255,255,255,0.12)` thumb.

### Checkboxes/Inputs

Never use native browser checkboxes, plain inputs, or dropdowns. Always use:

- `appearance: none`
- `-webkit-appearance: none`
- Custom border/background
- `::after` pseudo-element for checkmarks via CSS variables

### Best Practices

- Never introduce new inline styles
- Prefer CSS classes
- Existing inline styles may be migrated to CSS classes when touched
- New declarative UI definitions should use class names instead of style objects

---

## Creating Themes

Yuki OS has a comprehensive theming system with 25+ built-in themes and support for custom themes. Themes are managed via `src/shared/themeEngine.js`.

### Theme Structure

Each theme is defined as an object with the following properties:

```javascript
{
  value: "my-theme",           // Unique identifier (required)
  label: "My Theme",          // Display name (required)
  icon: "fas fa-palette",     // Font Awesome icon (optional, defaults to palette)
  category: "special",        // "basic", "special", or "custom"
  colors: {                   // CSS variable overrides (optional)
    "--brand": "#8b5cf6",
    "--bg-primary": "#1a1a2e",
    // ... more CSS variables
  }
}
```

### Adding Built-in Themes

To add a new built-in theme, modify the `BUILTIN_THEMES` array in `src/shared/themeEngine.js`:

```javascript
const BUILTIN_THEMES = [
  // ... existing themes
  {
    value: "my-new-theme",
    icon: "fas fa-star",
    label: "My New Theme",
    category: "special",
    colors: {
      "--brand": "#8b5cf6",
      "--bg-primary": "#1a1a2e",
      "--bg-secondary": "#16213e",
      "--text-primary": "#ffffff",
      "--text-secondary": "#a0a0a0",
      "--glass": "rgba(26, 26, 46, 0.8)",
      "--glass-border": "rgba(255, 255, 255, 0.1)"
    }
  }
];
```

### Theme Color Variables

Themes can override any CSS variable defined in `src/styles/style.css`. Common variables:

**Core Colors:**
- `--brand` - Accent/primary color
- `--text-primary` - Main text color
- `--text-secondary` - Secondary text color
- `--bg-primary` - Primary background
- `--bg-secondary` - Secondary background
- `--glass` - Glassmorphism background
- `--glass-border` - Glass border color
- `--error` - Error state color

**Additional Variables:**
- `--window-bg` - Window background
- `--taskbar-bg` - Taskbar background
- `--startmenu-bg` - Start menu background
- `--input-bg` - Input field background
- `--input-border` - Input field border


---

## Shared Utilities

Always prefer these shared utilities over reimplementing logic.

### Dialogs - `src/shared/dialogs.js`

| Function                                                | Return                    |
| ------------------------------------------------------- | ------------------------- |
| `showAlert(title, message, buttonText)`                 | `Promise<void>`           |
| `showPrompt(title, message, defaultValue, confirmText)` | `Promise<string \| null>` |
| `showConfirm(title, message, confirmText, cancelText)`  | `Promise<boolean>`        |
| `customAlert(message, title)`                           | `Promise<void>`           |
| `customPrompt(message, defaultValue, title)`            | `Promise<string \| null>` |
| `customConfirm(message, title)`                         | `Promise<boolean>`        |

**Never use browser native alerts, prompts, or confirms.**

### DOM Utilities - `src/shared/domUtils.js`

Import and use these instead of direct DOM manipulation:

```javascript
import { $, $$, bindEvent, toggleClass, setText, setHTML, createElement } from "./shared/domUtils.js";
```

| Function                                      | Parameters                                                          | Purpose                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `$(selector, root)`                           | selector: string, root: Document = document                         | Query single element (querySelector)                                        |
| `$$(selector, root)`                          | selector: string, root: Document = document                         | Query all elements (querySelectorAll)                                       |
| `queryAll(selectors, root)`                   | selectors: string[], root: Document = document                      | Query multiple selectors, returns object mapping                            |
| `bindEvent(element, event, handler, options)` | element: Element, event: string, handler: Function, options: Object | Add single event listener                                                   |
| `bindEvents(element, events)`                 | element: Element, events: Object                                    | Add multiple event listeners                                                |
| `toggleClass(element, className, condition)`  | element: Element, className: string, condition: boolean             | Toggle class with optional condition                                        |
| `addClass(element, className)`                | element: Element, className: string                                 | Add class to element                                                        |
| `removeClass(element, className)`             | element: Element, className: string                                 | Remove class from element                                                   |
| `setClasses(element, classes)`                | element: Element, classes: string                                   | Set element className                                                       |
| `setStyle(element, styles)`                   | element: Element, styles: Object                                    | Apply multiple styles to element                                            |
| `setText(element, text)`                      | element: Element, text: string                                      | Set element textContent                                                     |
| `setHTML(element, html)`                      | element: Element, html: string                                      | Set element innerHTML                                                       |
| `createElement(tag, options)`                 | tag: string, options: Object                                        | Create element with options (className, id, text, html, attributes, styles) |

### General Utilities - `src/utils/utils.js`

Common utility functions like `formatSize`, `isImageFile`, `isTextFile`, `pluralize`.

### Storage

Always use `os.storage` API instead of bare `localStorage`:

```javascript
import { os } from "./os/index.js";

// Read
const value = await os.storage.get(StorageKeys.MY_KEY);

// Write
await os.storage.set(StorageKeys.MY_KEY, value);
```

Always use StorageKeys from `src/StorageKeys.js` for localStorage access. Never hardcode localStorage key strings.

### File/Directory Selection Dialogs

Use Explorer app's built-in dialog methods:

```javascript
const explorerApp = this.services.explorerApp;

// Save dialog
explorerApp.openSaveDialog("myfile.txt", (path, filename) => {
  const fullPath = path.join("/");
  const filePath = `${fullPath}/${filename}`;
  await os.fs.write(fullPath, filename, content);
});

// Directory selection
explorerApp.openDirectoryDialog((path) => {
  const pathStr = path.join("/");
  await os.fs.mkdir(pathStr);
});

// File selection
explorerApp.open(["Documents"], (selectedPath) => {
  console.log("Selected file:", selectedPath);
});
```

---

## Code Quality Guidelines

Write modular, clean, and DRY code:

- **Modularity**: Separate concerns into focused modules. Each file should have a single, clear responsibility.
- **Single Responsibility**: Functions and classes should do one thing well.
- **DRY**: Never duplicate logic. Use shared utilities from `src/shared/`.
- **Prefer Existing Utilities**: Check `src/shared/` for existing helpers before writing new ones.
- **Clean Function Names**: Use descriptive, action-oriented function names.
- **Avoid Deep Nesting**: More than 3 levels of nesting indicates a need for refactoring.
- **Keep Functions Small**: Functions should fit on a screen (typically < 50 lines).
- **Use Meaningful Variables**: Variable names should reveal intent.
- **Avoid Magic Numbers/Strings**: Extract constants to the top of the file.

### File Size Guidelines

Target maximums:

- Utility modules: <300 lines
- Runtime modules: <500 lines
- Apps: <1000 lines

When a file exceeds these sizes, prefer extracting focused modules.

---

## Build & Deployment

```bash
# Development
pnpm run dev

# Development build
pnpm run build:dev

# Production build
pnpm run build

# Preview production build
pnpm run preview
```

Single-file build output is supported for easy deployment.

---

## Important Rules

- Run pnpm format before committing.
- Always use CSS variables defined at :root from `src/styles/style.css`. Never hardcode colors
- Whenever you define a new app to appLauncher or gamesList, define description for it on `gameDescriptions.js`
- Always use StorageKeys from `src/StorageKeys.js` for localStorage access
- Always use `os.storage` API instead of bare `localStorage`
- Never use browser native alerts, prompts, or confirms. Always use shared dialog utilities from `src/shared/dialogs.js`
- Never use `document.querySelector`, `document.querySelectorAll`, or direct DOM manipulation methods. Always use
  utility functions from `src/shared/domUtils.js`
- Use `os.notify.send()` for discrete, user-facing application events that represent a state change or completion

---

## Need Help?

- Join the [Discord](https://discord.gg/uFuGfseB9Z) community
- Check the [AGENTS.md](AGENTS.md) for detailed technical reference
- Review existing apps in `webos-desktop/src/apps/` for examples
