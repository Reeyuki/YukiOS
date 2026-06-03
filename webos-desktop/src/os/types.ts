/**
 * TypeScript type definitions for Yuki OS Bridge Layer
 */

export interface WindowOptions {
  width?: string | number;
  height?: string | number;
  position?: { x: number; y: number };
  isGame?: boolean;
  appId?: string;
  appType?: string;
  forceId?: string;
  icon?: string;
  iconColor?: string;
  autoMount?: boolean;
  autoFocus?: boolean;
  skipAutoSetup?: boolean;
  externalUrl?: string;
  skipHeader?: boolean;
}

export interface WindowHandle {
  id: string;
  element: HTMLElement;
}

export type FileKind = "text" | "image" | "video" | "audio" | "rom" | "other";

export interface FileMetadata {
  type: "file" | "directory";
  kind?: FileKind;
  icon?: string;
  faIcon?: string;
  size?: number;
  content?: string | Uint8Array;
}

export interface FileSystemEntry {
  [key: string]: FileMetadata | FileSystemEntry;
}

export interface ReadFileOptions {
  encoding?: "utf8" | "binary";
}

export interface WriteFileOptions {
  encoding?: "utf8" | "binary";
  kind?: FileKind;
  icon?: string;
}

export type NotificationType = "info" | "success" | "warning" | "error";

export interface NotificationOptions {
  type?: NotificationType;
  duration?: number;
  icon?: string;
  appSource?: string;
}

export interface TrayOptions {
  resident?: boolean;
  showInTray?: boolean;
  onClick?: () => void;
  onQuit?: () => void;
  contextMenuItems?: Array<{
    label: string;
    action: () => void;
  }>;
  priority?: number;
}

export interface TrayItem {
  winId: string;
  icon: string;
  label: string;
  options: TrayOptions;
}

export type AppType = "system" | "game" | "swf" | "gba" | "nds" | "psp" | "megadrive" | "genesis" | "html" | "remote";

export interface AppInfo {
  type: AppType;
  title: string;
  icon?: string;
  url?: string;
  swf?: string;
  html?: string;
  action?: (extra?: any) => void;
}

export interface LaunchOptions {
  forceId?: string;
  width?: string | number;
  height?: string | number;
  steamGameId?: string;
  source?: string;
  originalName?: string;
  analyticsBase?: any;
  type?: string;
}

export type EventHandler = (data?: any) => void;

export interface EventBusEvents {
  "window:created": { winId: string };
  "window:focused": { winId: string };
  "window:minimized": { winId: string };
  "window:closed": { winId: string };
  "window:fullscreen": { winId: string };
  "window:snapped": { winId: string; zone: string };
  "settings:changed": { key: string; value: any };
  "app:launched": { appId: string };
  notify: { title: string; message: string };
  "achievement:trigger": { achievementId: string };
  "terminal:cmd-executed": { command: string };
  "desktop:wallpaper-changed": { wallpaper: string };
  "desktop:login-wallpaper-changed": { wallpaper: string };
  "desktop:icon-added": { icon: string };
  "desktop:icon-removed": { icon: string };
  "workspace:switched": { workspaceId: number };
  "workspace:added": { workspaceId: number };
  "workspace:removed": { workspaceId: number };
  "file:changed": { path: string };
  "session:initialized": { sessionId: string };
  "system:locked": {};
  "system:unlocked": {};
  "clipboard:update": { content: any };
  "clipboard:read": {};
  "clipboard:clear": {};
}

export interface OSServices {
  windowManager: any;
  fileSystemManager: any;
  notificationCenter: any;
  appLauncher: any;
  eventBus: any;
}

export interface StorageAPI {
  get(key: string): any;
  set(key: string, value: any): void;
  remove(key: string): void;
  clear(): void;
  has(key: string): boolean;
}

declare global {
  interface Window {
    __osBridgeLegacyWarnings?: boolean;
  }
}
