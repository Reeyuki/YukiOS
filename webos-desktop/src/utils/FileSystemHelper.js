export class FileSystemHelper {
  constructor(fileSystem) {
    this.fs = fileSystem;
  }

  async ensureDirectory(path) {
    await this.fs.p("mkdir", path, { recursive: true }).catch(() => {});
  }

  async safeReadDirectory(dir) {
    try {
      return await this.fs.pRead("readdir", dir);
    } catch {
      return [];
    }
  }

  async safeReadFile(filePath, encoding = "utf8") {
    try {
      return await this.fs.pRead("readFile", filePath, encoding);
    } catch {
      return null;
    }
  }

  async safeWriteFile(path, content) {
    try {
      if (content instanceof Uint8Array) {
        await this.fs.p("writeFile", path, content);
      } else {
        const bytes = new TextEncoder().encode(content);
        await this.fs.p("writeFile", path, bytes);
      }
    } catch (e) {
      console.warn(`FileSystemHelper: safeWriteFile failed for ${path}, trying alternative approach:`, e);
      try {
        if (content instanceof Uint8Array) {
          const text = new TextDecoder("utf-8", { fatal: false }).decode(content);
          await this.fs.p("writeFile", path, text);
        } else {
          await this.fs.p("writeFile", path, content);
        }
      } catch (e2) {
        console.error(`FileSystemHelper: Failed to write file ${path}:`, e2);
        throw e2;
      }
    }
  }

  async ensureFolder(pathArray) {
    const path = this.fs.join(...pathArray);
    await this.ensureDirectory(path);
  }

  async getFolderContents(pathArray) {
    try {
      return await this.fs.getFolder(pathArray);
    } catch {
      return {};
    }
  }

  async deleteFile(path) {
    await this.fs.p("unlink", path).catch(() => {});
  }

  async directoryExists(path) {
    try {
      const stat = await this.fs.pStat(path);
      return stat && stat.isDirectory();
    } catch {
      return false;
    }
  }

  async fileExists(path) {
    try {
      const stat = await this.fs.pStat(path);
      return stat && stat.isFile();
    } catch {
      return false;
    }
  }
}
