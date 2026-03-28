import { unzip, gunzip, strFromU8 } from "fflate";
import { FileKind } from "./fs.js";
import { archiveBaseName, bytesToStoreContent, tarStr } from "./utils.js";

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
        await this._extractZip(bytes, destPath);
      } else if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
        const decompressed = await this._gunzipBytes(bytes);
        await this._extractTar(decompressed, destPath);
      } else if (lower.endsWith(".gz") && !lower.endsWith(".tar.gz")) {
        const decompressed = await this._gunzipBytes(bytes);
        const innerName = itemName.slice(0, -3);
        const text = strFromU8(decompressed, true);
        const kind = this.fs.inferKind ? this.fs.inferKind(innerName) : FileKind.TEXT;
        await this.fs.createFile(destPath, innerName, text, kind);
      } else if (lower.endsWith(".tar")) {
        await this._extractTar(bytes, destPath);
      } else {
        this.notify(`Format not supported in browser: ${itemName}\nSupported: ZIP, GZ, TAR, TAR.GZ, TGZ`);
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
            const content = bytesToStoreContent(fileName, data);
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
        const fileBytes = bytes.slice(offset, offset + size);
        const content = bytesToStoreContent(fileName, fileBytes);
        const kind = this.fs.inferKind ? this.fs.inferKind(fileName) : FileKind.TEXT;
        await this.fs.createFile(subPath, fileName, content, kind);
      }

      offset += Math.ceil(size / 512) * 512;
    }
  }
}
