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

  private async _resolve(path: string | string[]): Promise<string> {
    await this.fs.fsReady;
    return Array.isArray(path) ? path.join("/") : path;
  }

  /**
   * Read file content
   * @param path - File path (relative to user home) - can be string or array
   * @param options - Read options
   * @returns File content as string or Uint8Array
   */
  async read(path: string | string[], options: ReadFileOptions = {}): Promise<string | Uint8Array> {
    const pathStr = await this._resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);

    if (options.encoding === "binary") {
      return await this.fs.pRead("readFile", fullPath);
    }
    return await this.fs.pRead("readFile", fullPath, "utf8");
  }

  /**
   * Write file content
   * @param path - File path (relative to user home) - can be string or array
   * @param content - Content to write (string or Uint8Array)
   * @param options - Write options
   */
  async write(path: string | string[], content: string | Uint8Array, options: WriteFileOptions = {}): Promise<void> {
    const pathStr = await this._resolve(path);
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

  /**
   * Read directory contents
   * @param path - Directory path (relative to user home) - can be string or array
   * @returns Directory contents as object
   */
  async readdir(path: string | string[]): Promise<FileSystemEntry> {
    const pathStr = await this._resolve(path);
    return await this.fs.getFolder(pathStr);
  }

  /**
   * Create directory
   * @param path - Directory path (relative to user home) - can be string or array
   */
  async mkdir(path: string | string[]): Promise<void> {
    const pathStr = await this._resolve(path);
    await this.fs.ensureFolder(pathStr);
  }

  /**
   * Delete file or directory
   * @param path - Path to delete - can be string or array
   * @param name - Name of item (for directory deletion)
   */
  async delete(path: string | string[], name?: string): Promise<void> {
    const pathStr = await this._resolve(path);

    if (name) {
      await this.fs.deleteItem(pathStr, name);
    } else {
      const dir = this.fs.dirname(pathStr);
      const basename = this.fs.basename(pathStr);
      await this.fs.deleteItem(dir, basename);
    }
  }

  /**
   * Check if path exists
   * @param path - Path to check - can be string or array
   * @returns True if exists
   */
  async exists(path: string | string[]): Promise<boolean> {
    const pathStr = await this._resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    return await this.fs.exists(fullPath);
  }

  /**
   * Copy file or directory
   * @param source - Source path - can be string or array
   * @param destination - Destination path - can be string or array
   */
  async copy(source: string | string[], destination: string | string[]): Promise<void> {
    const sourceStr = await this._resolve(source);
    const destStr = await this._resolve(destination);

    const sourcePath = this.fs.resolveUserPath(sourceStr);
    const destPath = this.fs.resolveUserPath(destStr);

    const content = await this.fs.pRead("readFile", sourcePath);
    await this.fs.ensureFolder(this.fs.dirname(destStr));
    await this.fs.safeWriteFile(destPath, content);
  }

  /**
   * Rename/move file or directory
   * @param oldPath - Current path - can be string or array
   * @param newPath - New path - can be string or array
   */
  async rename(oldPath: string | string[], newPath: string | string[]): Promise<void> {
    const oldStr = await this._resolve(oldPath);
    const newStr = await this._resolve(newPath);

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

  /**
   * Get file metadata
   * @param path - File path
   * @param name - File name
   * @returns File metadata
   */
  async getMetadata(path: string, name: string): Promise<{ kind?: FileKind; icon?: string }> {
    await this.fs.fsReady;
    const dir = this.fs.resolveUserPath(path);
    const meta = await this.fs.readMeta(dir);
    return meta[name] || {};
  }

  /**
   * Infer file kind from filename
   * @param filename - Filename to analyze
   * @returns File kind
   */
  inferKind(filename: string): FileKind {
    return this.fs.inferKind(filename);
  }

  /**
   * Check if path is a file (not a directory)
   * @param path - File path (relative to user home) - can be string or array
   * @returns True if path is a file
   */
  async isFile(path: string | string[]): Promise<boolean> {
    const pathStr = await this._resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    const dir = this.fs.dirname(fullPath);
    const basename = this.fs.basename(fullPath);
    const folder = await this.fs.getFolder(dir);
    const item = folder[basename];
    return item && item.type === "file";
  }

  /**
   * Get file kind for a specific file
   * @param path - File path (relative to user home) - can be string or array
   * @returns File kind
   */
  async getFileKind(path: string | string[]): Promise<FileKind | undefined> {
    const pathStr = await this._resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    const dir = this.fs.dirname(fullPath);
    const basename = this.fs.basename(fullPath);
    const meta = await this.fs.readMeta(dir);
    return meta[basename]?.kind;
  }

  /**
   * Get file icon for a specific file
   * @param path - File path (relative to user home) - can be string or array
   * @returns File icon path
   */
  async getFileIcon(path: string | string[]): Promise<string | undefined> {
    const pathStr = await this._resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    const dir = this.fs.dirname(fullPath);
    const basename = this.fs.basename(fullPath);
    const meta = await this.fs.readMeta(dir);
    return meta[basename]?.icon;
  }

  /**
   * Write binary file to blob storage
   * @param path - Directory path (relative to user home) - can be string or array
   * @param name - File name
   * @param blob - Blob content
   * @param kind - File kind
   * @param icon - File icon
   */
  async writeBinaryFile(
    path: string | string[],
    name: string,
    blob: Blob,
    kind?: FileKind,
    icon?: string
  ): Promise<string> {
    const pathStr = await this._resolve(path);
    return await this.fs.writeBinaryFile(pathStr, name, blob, kind, icon);
  }

  /**
   * Read binary file from blob storage
   * @param path - Directory path (relative to user home) - can be string or array
   * @param name - File name
   * @returns Blob content
   */
  async readBinaryFile(path: string | string[], name: string): Promise<Blob | null> {
    const pathStr = await this._resolve(path);
    return await this.fs.readBinaryFile(pathStr, name);
  }

  /**
   * Delete binary file from blob storage
   * @param path - Directory path (relative to user home) - can be string or array
   * @param name - File name
   */
  async deleteBinaryFile(path: string | string[], name: string): Promise<void> {
    const pathStr = await this._resolve(path);
    await this.fs.deleteBinaryFile(pathStr, name);
  }

  /**
   * Rename binary file in blob storage
   * @param path - Directory path (relative to user home) - can be string or array
   * @param oldName - Current file name
   * @param newName - New file name
   */
  async renameBinaryFile(path: string | string[], oldName: string, newName: string): Promise<void> {
    const pathStr = await this._resolve(path);
    await this.fs.renameBinaryFile(pathStr, oldName, newName);
  }

  /**
   * Create a new file
   * @param path - Directory path (relative to user home) - can be string or array
   * @param name - File name
   * @param content - File content
   * @param kind - File kind
   * @param icon - File icon
   * @param faIcon - Font Awesome icon
   */
  async createFile(
    path: string | string[],
    name: string,
    content: string,
    kind?: FileKind,
    icon?: string,
    faIcon?: string
  ): Promise<string> {
    const pathStr = await this._resolve(path);
    return await this.fs.createFile(pathStr, name, content, kind, icon, faIcon);
  }

  /**
   * Create a new folder
   * @param path - Directory path (relative to user home) - can be string or array
   * @param name - Folder name
   */
  async createFolder(path: string | string[], name: string): Promise<string> {
    const pathStr = await this._resolve(path);
    return await this.fs.createFolder(pathStr, name);
  }

  /**
   * Delete a file or folder
   * @param path - Directory path (relative to user home) - can be string or array
   * @param name - Item name
   */
  async deleteItem(path: string | string[], name: string): Promise<void> {
    const pathStr = await this._resolve(path);
    await this.fs.deleteItem(pathStr, name);
  }

  /**
   * Rename a file or folder
   * @param path - Directory path (relative to user home) - can be string or array
   * @param oldName - Current name
   * @param newName - New name
   */
  async renameItem(path: string | string[], oldName: string, newName: string): Promise<void> {
    const pathStr = await this._resolve(path);
    await this.fs.renameItem(pathStr, oldName, newName);
  }

  /**
   * Update file content
   * @param path - Directory path (relative to user home) - can be string or array
   * @param name - File name
   * @param content - New content
   * @param meta - Optional metadata
   */
  async updateFile(
    path: string | string[],
    name: string,
    content: string,
    meta?: { kind?: FileKind; icon?: string }
  ): Promise<void> {
    const pathStr = await this._resolve(path);
    await this.fs.updateFile(pathStr, name, content);
    if (meta?.kind || meta?.icon) {
      const dir = this.fs.resolveUserPath(pathStr);
      await this.fs.writeMeta(dir, name, { kind: meta.kind, icon: meta.icon });
    }
  }

  async trashFile(path: string | string[], name?: string): Promise<any> {
    const pathStr = await this._resolve(path);
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
}
