/**
 * Filesystem API
 * Wraps FileSystemManager to provide clean OS-level file operations
 */

import type {
  FileKind,
  FileSystemEntry,
  ReadFileOptions,
  WriteFileOptions,
  FileSystemManagerService
} from "./types.js";

export class FileSystemAPI {
  private fs: FileSystemManagerService;

  constructor(fileSystemManager: FileSystemManagerService) {
    this.fs = fileSystemManager;
  }

  private async resolve(path: string | string[]): Promise<string> {
    await this.fs.fsReady;
    return Array.isArray(path) ? path.join("/") : path;
  }

  async read(path: string | string[], options: ReadFileOptions = {}): Promise<string | Uint8Array> {
    const pathStr = await this.resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);

    if (options.encoding === "binary") {
      return await this.fs.pRead("readFile", fullPath);
    }
    return await this.fs.pRead("readFile", fullPath, "utf8");
  }

  async write(path: string | string[], content: string | Uint8Array, options: WriteFileOptions = {}): Promise<void> {
    const pathStr = await this.resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    const dir = this.fs.dirname(fullPath);

    await this.fs.ensureFolder(this.fs.dirname(pathStr));

    if (options.encoding === "binary" || content instanceof Uint8Array) {
      await this.fs.safeWriteFile(fullPath, content);
    } else {
      await this.fs.safeWriteFile(fullPath, content as string);
    }

    if (options.kind || options.icon) {
      await this.fs.writeMeta(dir, this.fs.basename(pathStr), {
        kind: options.kind,
        icon: options.icon
      });
    }

    await this.fs.notifyDesktopChange(pathStr);
  }

  async readdir(path: string | string[]): Promise<FileSystemEntry> {
    const pathStr = await this.resolve(path);
    return await this.fs.getFolder(pathStr);
  }

  async mkdir(path: string | string[]): Promise<void> {
    const pathStr = await this.resolve(path);
    await this.fs.ensureFolder(pathStr);
  }

  async delete(path: string | string[], name?: string): Promise<void> {
    const pathStr = await this.resolve(path);

    if (name) {
      await this.fs.deleteItem(pathStr, name);
    } else {
      const dir = this.fs.dirname(pathStr);
      const basename = this.fs.basename(pathStr);
      await this.fs.deleteItem(dir, basename);
    }
  }

  async exists(path: string | string[]): Promise<boolean> {
    const pathStr = await this.resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    return await this.fs.exists(fullPath);
  }

  async copy(source: string | string[], destination: string | string[]): Promise<void> {
    const sourceStr = await this.resolve(source);
    const destStr = await this.resolve(destination);

    const sourcePath = this.fs.resolveUserPath(sourceStr);
    const destPath = this.fs.resolveUserPath(destStr);

    const content = await this.fs.pRead("readFile", sourcePath);
    await this.fs.ensureFolder(this.fs.dirname(destStr));
    await this.fs.safeWriteFile(destPath, content);
  }

  async rename(oldPath: string | string[], newPath: string | string[]): Promise<void> {
    const oldStr = await this.resolve(oldPath);
    const newStr = await this.resolve(newPath);

    const oldDir = this.fs.dirname(oldStr);
    const oldName = this.fs.basename(oldStr);
    const newDir = this.fs.dirname(newStr);
    const newName = this.fs.basename(newStr);

    if (oldDir === newDir) {
      await this.fs.renameItem(oldDir, oldName, newName);
    } else {
      await this.copy(oldStr, newStr);
      await this.delete(oldStr);
    }
  }

  async getMetadata(path: string, name: string): Promise<{ kind?: FileKind; icon?: string }> {
    await this.fs.fsReady;
    const dir = this.fs.resolveUserPath(path);
    const meta = await this.fs.readMeta(dir);
    return meta[name] || {};
  }

  async calcDirSize(path: string | string[]): Promise<{ size: number; files: number; dirs: number }> {
    let size = 0;
    let files = 0;
    let dirs = 0;
    try {
      const entries = await this.readdir(path);
      const pathStr = await this.resolve(path);
      for (const [name, entry] of Object.entries(entries)) {
        if (entry.type === "file") {
          files++;
          size += entry.size ?? 0;
        } else {
          dirs++;
          const sub = await this.calcDirSize(this.fs.paths.join(pathStr, name));
          size += sub.size;
          files += sub.files;
          dirs += sub.dirs;
        }
      }
    } catch {}
    return { size, files, dirs };
  }

  inferKind(filename: string): FileKind {
    return this.fs.inferKind(filename);
  }

  async isFile(path: string | string[]): Promise<boolean> {
    const pathStr = await this.resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    const dir = this.fs.dirname(fullPath);
    const basename = this.fs.basename(fullPath);
    const folder = await this.fs.getFolder(dir);
    const item = folder[basename];
    return item && item.type === "file";
  }

  async getFileKind(path: string | string[]): Promise<FileKind | undefined> {
    const pathStr = await this.resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    const dir = this.fs.dirname(fullPath);
    const basename = this.fs.basename(fullPath);
    const meta = await this.fs.readMeta(dir);
    return meta[basename]?.kind;
  }

  async getFileIcon(path: string | string[]): Promise<string | undefined> {
    const pathStr = await this.resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    const dir = this.fs.dirname(fullPath);
    const basename = this.fs.basename(fullPath);
    const meta = await this.fs.readMeta(dir);
    return meta[basename]?.icon;
  }

  async writeBinaryFile(
    path: string | string[],
    name: string,
    blob: Blob,
    kind?: FileKind,
    icon?: string
  ): Promise<string> {
    const pathStr = await this.resolve(path);
    return await this.fs.writeBinaryFile(pathStr, name, blob, kind, icon);
  }

  async readBinaryFile(path: string | string[], name: string): Promise<Blob | null> {
    const pathStr = await this.resolve(path);
    return await this.fs.readBinaryFile(pathStr, name);
  }

  async deleteBinaryFile(path: string | string[], name: string): Promise<void> {
    const pathStr = await this.resolve(path);
    await this.fs.deleteBinaryFile(pathStr, name);
  }

  async renameBinaryFile(path: string | string[], oldName: string, newName: string): Promise<void> {
    const pathStr = await this.resolve(path);
    await this.fs.renameBinaryFile(pathStr, oldName, newName);
  }

  async createFile(
    path: string | string[],
    name: string,
    content: string,
    kind?: FileKind,
    icon?: string,
    faIcon?: string
  ): Promise<string> {
    const pathStr = await this.resolve(path);
    return await this.fs.createFile(pathStr, name, content, kind, icon, faIcon);
  }

  async createFolder(path: string | string[], name: string): Promise<string> {
    const pathStr = await this.resolve(path);
    return await this.fs.createFolder(pathStr, name);
  }

  async deleteItem(path: string | string[], name: string): Promise<void> {
    const pathStr = await this.resolve(path);
    await this.fs.deleteItem(pathStr, name);
  }

  async renameItem(path: string | string[], oldName: string, newName: string): Promise<void> {
    const pathStr = await this.resolve(path);
    await this.fs.renameItem(pathStr, oldName, newName);
  }

  async updateFile(
    path: string | string[],
    name: string,
    content: string,
    meta?: { kind?: FileKind; icon?: string }
  ): Promise<void> {
    const pathStr = await this.resolve(path);
    await this.fs.updateFile(pathStr, name, content);
    if (meta?.kind || meta?.icon) {
      const dir = this.fs.resolveUserPath(pathStr);
      await this.fs.writeMeta(dir, name, { kind: meta.kind, icon: meta.icon });
    }
  }

  async trashFile(path: string | string[], name?: string): Promise<any> {
    const pathStr = await this.resolve(path);
    if (name) {
      return await this.fs.trash.moveToTrash(pathStr, name);
    }
    const dir = this.fs.dirname(pathStr);
    const basename = this.fs.basename(pathStr);
    return await this.fs.trash.moveToTrash(dir, basename);
  }

  async getTrashItems(): Promise<any[]> {
    await this.fs.fsReady;
    return await this.fs.trash.getItems();
  }

  async restoreTrashItem(id: string): Promise<any> {
    await this.fs.fsReady;
    return await this.fs.trash.restoreItem(id);
  }

  async restoreAllTrashItems(): Promise<any[]> {
    await this.fs.fsReady;
    return await this.fs.trash.restoreAll();
  }

  async deleteTrashItem(id: string): Promise<void> {
    await this.fs.fsReady;
    await this.fs.trash.deletePermanently(id);
  }

  async emptyTrash(): Promise<void> {
    await this.fs.fsReady;
    await this.fs.trash.emptyTrash();
  }

  async getTrashCount(): Promise<number> {
    await this.fs.fsReady;
    return await this.fs.trash.getItemCount();
  }

  async pickDirectory(): Promise<any> {
    return await this.fs.mountManager.pickDirectory();
  }

  registerMount(handle: any, label: string): string {
    return this.fs.mountManager.registerMount(handle, label);
  }

  unmount(label: string): void {
    this.fs.mountManager.unmount(label);
  }

  getMounts(): Array<{ label: string; mountPoint: string }> {
    return this.fs.mountManager.getMounts();
  }
}
