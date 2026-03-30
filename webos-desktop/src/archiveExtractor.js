import { unzip, gunzip, strFromU8 } from "fflate";
import SevenZip from "7z-wasm";
import { FileKind } from "./fs.js";
import { archiveBaseName, bytesToStoreContent, tarStr } from "./utils.js";

function toOwnedBytes(data) {
  return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}

let _7zipModule = null;
async function get7zip() {
  if (!_7zipModule) {
    _7zipModule = await SevenZip();
  }
  return _7zipModule;
}

export class ArchiveExtractor {
  constructor(fs, notify) {
    this.fs = fs;
    this.notify = notify;
  }

  async extract(itemName, currentPath, onComplete) {
    const lower = itemName.toLowerCase();
    this.notify(`Extracting "${itemName}"...`);
    try {
      const blob = await this.fs.readBinaryFile(currentPath, itemName);
      if (!blob) {
        this.notify(`Could not read "${itemName}" — was it uploaded as a binary file?`);
        return;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const baseName = archiveBaseName(itemName);
      const destPath = [...currentPath, baseName];
      await this.fs.ensureFolder(destPath);
      if (lower.endsWith(".zip")) {
        await this._extractZip(toOwnedBytes(bytes), destPath);
      } else if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
        const decompressed = await this._gunzipBytes(toOwnedBytes(bytes));
        await this._extractTar(decompressed, destPath);
      } else if (lower.endsWith(".tar.xz")) {
        const decompressed = await this._7zipDecompress(toOwnedBytes(bytes), itemName);
        await this._extractTar(decompressed, destPath);
      } else if (lower.endsWith(".gz") && !lower.endsWith(".tar.gz")) {
        const decompressed = await this._gunzipBytes(toOwnedBytes(bytes));
        const innerName = itemName.slice(0, -3);
        const text = strFromU8(decompressed, true);
        const kind = this.fs.inferKind ? this.fs.inferKind(innerName) : FileKind.TEXT;
        await this.fs.createFile(destPath, innerName, text, kind);
      } else if (lower.endsWith(".tar")) {
        await this._extractTar(bytes, destPath);
      } else if (lower.endsWith(".7z")) {
        await this._extract7z(toOwnedBytes(bytes), destPath);
      } else {
        this.notify(`Format not supported in browser: ${itemName}\nSupported: ZIP, GZ, TAR, TAR.GZ, TGZ, TAR.XZ, 7Z`);
        return;
      }
      this.notify(`Extracted to "${baseName}/"`);
      if (onComplete) await onComplete();
    } catch (err) {
      console.error("Extraction error:", err);
      this.notify(`Failed to extract "${itemName}": ${err.message || err}`);
    }
  }

  _gunzipBytes(bytes) {
    return new Promise((resolve, reject) => {
      gunzip(bytes, (err, data) => (err ? reject(err) : resolve(data)));
    });
  }

  async _7zipDecompress(bytes, fileName) {
    const sevenZip = await get7zip();
    const stream = sevenZip.FS.open(fileName, "w+");
    sevenZip.FS.write(stream, bytes, 0, bytes.length);
    sevenZip.FS.close(stream);
    sevenZip.callMain(["e", fileName, "-o/out", "-y"]);
    const outDir = "/out";
    const files = sevenZip.FS.readdir(outDir).filter((f) => f !== "." && f !== "..");
    if (files.length !== 1) {
      throw new Error(`Expected 1 decompressed file, got ${files.length}`);
    }
    const result = sevenZip.FS.readFile(`${outDir}/${files[0]}`);
    sevenZip.FS.unlink(fileName);
    sevenZip.FS.unlink(`${outDir}/${files[0]}`);
    return result;
  }

  async _extract7z(bytes, destPath) {
    const sevenZip = await get7zip();
    const archiveName = "input.7z";
    const stream = sevenZip.FS.open(archiveName, "w+");
    sevenZip.FS.write(stream, bytes, 0, bytes.length);
    sevenZip.FS.close(stream);
    sevenZip.callMain(["x", archiveName, "-o/out7z", "-y"]);
    const outDir = "/out7z";
    await this._collectSevenZipOutput(sevenZip, outDir, outDir, destPath);
    sevenZip.FS.unlink(archiveName);
  }

  async _collectSevenZipOutput(sevenZip, baseDir, currentDir, destPath) {
    const entries = sevenZip.FS.readdir(currentDir).filter((f) => f !== "." && f !== "..");
    for (const entry of entries) {
      const fullPath = `${currentDir}/${entry}`;
      const stat = sevenZip.FS.stat(fullPath);
      const isDir = sevenZip.FS.isDir(stat.mode);
      if (isDir) {
        const relParts = fullPath
          .slice(baseDir.length + 1)
          .split("/")
          .filter(Boolean);
        await this.fs.ensureFolder([...destPath, ...relParts]);
        await this._collectSevenZipOutput(sevenZip, baseDir, fullPath, destPath);
      } else {
        const relParts = fullPath
          .slice(baseDir.length + 1)
          .split("/")
          .filter(Boolean);
        const fileName = relParts.pop();
        const subPath = [...destPath, ...relParts];
        await this.fs.ensureFolder(subPath);
        const fileBytes = toOwnedBytes(sevenZip.FS.readFile(fullPath));
        const content = bytesToStoreContent(fileName, fileBytes);
        const kind = this.fs.inferKind ? this.fs.inferKind(fileName) : FileKind.TEXT;
        await this.fs.createFile(subPath, fileName, content, kind);
        sevenZip.FS.unlink(fullPath);
      }
    }
  }

  _extractZip(bytes, destPath) {
    return new Promise((resolve, reject) => {
      unzip(bytes, async (err, files) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          for (const [path, data] of Object.entries(files)) {
            if (path.endsWith("/")) continue;
            const parts = path.split("/").filter(Boolean);
            const fileName = parts.pop();
            const subPath = [...destPath, ...parts];
            await this.fs.ensureFolder(subPath);
            const content = bytesToStoreContent(fileName, toOwnedBytes(data));
            const kind = this.fs.inferKind ? this.fs.inferKind(fileName) : FileKind.TEXT;
            await this.fs.createFile(subPath, fileName, content, kind);
          }
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async _extractTar(bytes, destPath) {
    let offset = 0;
    while (offset + 512 <= bytes.length) {
      const header = bytes.slice(offset, offset + 512);
      const nameRaw = tarStr(header, 0, 100);
      if (!nameRaw) break;
      const size = parseInt(tarStr(header, 124, 12).trim(), 8) || 0;
      const typeflag = String.fromCharCode(header[156]);
      offset += 512;
      if (typeflag === "0" || typeflag === "\0") {
        const parts = nameRaw.replace(/\\/g, "/").split("/").filter(Boolean);
        const fileName = parts.pop();
        const subPath = [...destPath, ...parts];
        await this.fs.ensureFolder(subPath);
        const fileBytes = toOwnedBytes(bytes.slice(offset, offset + size));
        const content = bytesToStoreContent(fileName, fileBytes);
        const kind = this.fs.inferKind ? this.fs.inferKind(fileName) : FileKind.TEXT;
        await this.fs.createFile(subPath, fileName, content, kind);
      }
      offset += Math.ceil(size / 512) * 512;
    }
  }
}
