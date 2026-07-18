import { inferKind } from "./shared/fileKindDetector.js";

export class ISOFileSystem {
  constructor(buffer) {
    this.buffer = buffer;
    this.sectorSize = 2048;
    this.volumeLabel = "";
    this.rootDir = null;

    this.parseVolumeDescriptors();
  }

  readByte(offset) {
    if (offset >= this.buffer.byteLength) return 0;
    return new DataView(this.buffer, offset, 1).getUint8(0);
  }

  readBoth(offset) {
    const dv = new DataView(this.buffer);
    return dv.getUint32(offset, true);
  }

  readStr(offset, len) {
    const bytes = new Uint8Array(this.buffer, offset, len);
    let end = len;
    for (let i = 0; i < len; i++) {
      if (bytes[i] === 0) {
        end = i;
        break;
      }
    }
    return new TextDecoder("ascii").decode(bytes.slice(0, end));
  }

  readUcs2Str(offset, byteLen) {
    const chars = [];
    for (let i = 0; i < byteLen; i += 2) {
      if (offset + i + 1 >= this.buffer.byteLength) break;
      const high = this.readByte(offset + i);
      const low = this.readByte(offset + i + 1);
      if (high === 0 && low === 0) break;
      chars.push(String.fromCharCode((high << 8) | low));
    }
    return chars.join("");
  }

  parseVolumeDescriptors() {
    for (let sector = 16; sector < 128; sector++) {
      const off = sector * this.sectorSize;
      if (off + 8 > this.buffer.byteLength) break;

      const type = this.readByte(off);
      const id = this.readStr(off + 1, 5);
      if (id !== "CD001") continue;

      if (type === 1) {
        this.volumeLabel = this.readStr(off + 40, 32).trim();
        this.parseRootRecord(off + 156, false);
      } else if (type === 2) {
        const escSeq = this.readStr(off + 88, 3);
        if (escSeq === "%/@" || escSeq === "%/C" || escSeq === "%/E") {
          const jolietLabel = this.readUcs2Str(off + 40, 32).trim();
          if (jolietLabel) this.volumeLabel = jolietLabel;
          this.parseRootRecord(off + 156, true);
        }
      } else if (type === 255) {
        break;
      }
    }
  }

  debugInfo() {
    return {
      volumeLabel: this.volumeLabel,
      hasRootDir: this.rootDir !== null,
      rootExtent: this.rootDir?.extent,
      rootSize: this.rootDir?.size,
      rootEntries: this.rootDir?.entries ? [...this.rootDir.entries.keys()] : null,
      bufferSize: this.buffer.byteLength
    };
  }

  parseRootRecord(offset, joliet) {
    const len = this.readByte(offset);
    if (len < 34) return;
    const extent = this.readBoth(offset + 2);
    const size = this.readBoth(offset + 10);
    this.rootDir = { extent, size, joliet, entries: null };
  }

  ensureDirParsed(dirNode) {
    if (dirNode.entries) return;
    const entries = new Map();
    const off = dirNode.extent * this.sectorSize;
    let pos = 0;

    while (pos < dirNode.size) {
      const recordLen = this.readByte(off + pos);
      if (recordLen < 34) {
        pos += recordLen || 1;
        continue;
      }

      const fileFlags = this.readByte(off + pos + 25);
      const nameLen = this.readByte(off + pos + 32);
      const isDir = !!(fileFlags & 0x02);

      let rawName;
      if (dirNode.joliet && nameLen > 1) {
        rawName = this.readUcs2Str(off + pos + 33, nameLen);
      } else {
        rawName = this.readStr(off + pos + 33, nameLen);
      }

      if (rawName === "\x00" || rawName === "" || rawName === "\x01") {
        pos += recordLen;
        continue;
      }

      let name = rawName;
      const semi = name.indexOf(";");
      if (semi > 0) name = name.substring(0, semi);
      if (!name) {
        pos += recordLen;
        continue;
      }

      const extent = this.readBoth(off + pos + 2);
      const fileSize = this.readBoth(off + pos + 10);

      if (isDir) {
        entries.set(name, {
          type: "dir",
          extent,
          size: fileSize,
          joliet: dirNode.joliet,
          entries: null
        });
      } else {
        entries.set(name, { type: "file", extent, size: fileSize });
      }

      pos += recordLen;
    }

    dirNode.entries = entries;
  }

  readdir(dirPath) {
    const node = this.resolveDir(dirPath);
    if (!node) return {};
    this.ensureDirParsed(node);

    const result = {};
    for (const [name, entry] of node.entries) {
      if (entry.type === "dir") {
        result[name] = {};
      } else {
        result[name] = {
          type: "file",
          kind: inferKind(name),
          icon: "static/icons/file.webp",
          faIcon: null,
          content: "",
          size: entry.size
        };
      }
    }
    return result;
  }

  resolveDir(dirPath) {
    if (!dirPath || dirPath === "") return this.rootDir;
    if (!this.rootDir) return null;

    const parts = dirPath.split("/").filter(Boolean);
    let current = this.rootDir;
    this.ensureDirParsed(current);

    for (const part of parts) {
      if (!current.entries) return null;
      const entry = current.entries.get(part);
      if (!entry || entry.type !== "dir") return null;
      current = entry;
      this.ensureDirParsed(current);
    }
    return current;
  }

  readFile(filePath) {
    const parts = filePath.split("/").filter(Boolean);
    const fileName = parts.pop();
    const dirPath = parts.join("/");

    const node = this.resolveDir(dirPath);
    if (!node) return null;

    const entry = node.entries?.get(fileName);
    if (!entry || entry.type !== "file") return null;

    const offset = entry.extent * this.sectorSize;
    const size = Math.min(entry.size, this.buffer.byteLength - offset);
    if (size <= 0) return new ArrayBuffer(0);

    return this.buffer.slice(offset, offset + size);
  }

  getFileSize(filePath) {
    const parts = filePath.split("/").filter(Boolean);
    const fileName = parts.pop();
    const dirPath = parts.join("/");

    const node = this.resolveDir(dirPath);
    if (!node) return null;

    const entry = node.entries?.get(fileName);
    if (!entry || entry.type !== "file") return null;
    return entry.size;
  }
}
