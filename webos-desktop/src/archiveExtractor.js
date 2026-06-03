import { unzip, gunzip, strFromU8, zipSync, gzipSync, compressSync, decompressSync } from "fflate";
import { getLibraryUrl } from "./shared/cdnConfig.js";
import { archiveBaseName, tarStr } from "./utils/utils.js";
import { os } from "./os/index.js";
import { FileKind } from "./fs.js";

function toOwnedBytes(data) {
  return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}

let _7zipModule = null;
async function get7zip() {
  if (!_7zipModule) {
    const libUrl = getLibraryUrl("7z-wasm");
    const { default: SevenZip } = await import(/* @vite-ignore */ `${libUrl}`);
    _7zipModule = await SevenZip({
      locateFile: (path, prefix) => {
        if (path.endsWith(".wasm")) {
          return libUrl.replace("7zz.es6.js", "7zz.wasm");
        }
        return prefix + path;
      }
    });
  }
  return _7zipModule;
}

let _archiveWasmModule = null;
async function getArchiveWasm() {
  if (!_archiveWasmModule) {
    const libUrl = getLibraryUrl("archive-wasm");
    const module = await import(/* @vite-ignore */ `${libUrl}`);
    _archiveWasmModule = module;
  }
  return _archiveWasmModule;
}

const MAGIC_BYTES = {
  zip: [0x50, 0x4b, 0x03, 0x04],
  zip_spanned: [0x50, 0x4b, 0x07, 0x08],
  zip_empty: [0x50, 0x4b, 0x05, 0x06],
  tar: null,
  gzip: [0x1f, 0x8b],
  bzip2: [0x42, 0x5a, 0x68],
  xz: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00],
  lzma: [0x5d, 0x00, 0x00],
  rar4: [0x52, 0x61, 0x72, 0x21, 0x4a, 0x41, 0x52],
  rar5: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00],
  "7z": [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]
};

function detectArchiveFormat(bytes, fileName) {
  if (bytes.length < 4) return null;

  const checkMagic = (magic) => {
    if (!magic) return false;
    for (let i = 0; i < magic.length; i++) {
      if (bytes[i] !== magic[i]) return false;
    }
    return true;
  };

  if (checkMagic(MAGIC_BYTES.zip) || checkMagic(MAGIC_BYTES.zip_spanned) || checkMagic(MAGIC_BYTES.zip_empty)) {
    return "zip";
  }
  if (checkMagic(MAGIC_BYTES["7z"])) return "7z";
  if (checkMagic(MAGIC_BYTES.rar4) || checkMagic(MAGIC_BYTES.rar5)) return "rar";
  if (checkMagic(MAGIC_BYTES.xz)) return "xz";
  if (checkMagic(MAGIC_BYTES.bzip2)) return "bz2";
  if (checkMagic(MAGIC_BYTES.gzip)) return "gz";
  if (checkMagic(MAGIC_BYTES.lzma)) return "lzma";

  const lower = fileName.toLowerCase();
  if (lower.endsWith(".tar")) return "tar";

  return null;
}

function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

import { AppSource } from "./AppSource.js";

export class ArchiveExtractor {
  constructor(fs, notify, appSource = AppSource.ARCHIVE_EXTRACTOR) {
    this.fs = fs;
    this.notify = notify;
    this.appSource = appSource;
  }

  async createArchive(items, options = {}) {
    const { format = "zip", compressionLevel = 6, outputPath, archiveName, password = null } = options;

    const filesMap = await this._collectFilesRecursively(items);

    let zipped;
    if (format === "zip") {
      if (password) {
        zipped = await this._createZipWithPassword(filesMap, compressionLevel, password);
      } else {
        zipped = zipSync(filesMap, { level: compressionLevel });
      }
    } else if (format === "tar") {
      zipped = this._createTar(filesMap);
    } else if (format === "tar.gz" || format === "tgz") {
      const tarBytes = this._createTar(filesMap);
      zipped = gzipSync(tarBytes, { level: compressionLevel });
    } else if (format === "tar.bz2" || format === "tbz2") {
      const tarBytes = this._createTar(filesMap);
      zipped = compressSync(tarBytes, { level: compressionLevel });
    } else if (format === "tar.xz" || format === "txz") {
      const tarBytes = this._createTar(filesMap);
      zipped = await this._create7z(filesMap, compressionLevel);
    } else if (format === "gz") {
      const fileEntries = Object.entries(filesMap);
      if (fileEntries.length !== 1) {
        throw new Error("Gzip format only supports single-file compression. Use .tar.gz for multiple files.");
      }
      const fileEntry = fileEntries[0];
      if (!fileEntry) throw new Error("No file to compress");
      zipped = gzipSync(fileEntry[1], { level: compressionLevel });
    } else if (format === "bz2") {
      const fileEntries = Object.entries(filesMap);
      if (fileEntries.length !== 1) {
        throw new Error("Bzip2 format only supports single-file compression. Use .tar.bz2 for multiple files.");
      }
      const fileEntry = fileEntries[0];
      if (!fileEntry) throw new Error("No file to compress");
      zipped = compressSync(fileEntry[1], { level: compressionLevel });
    } else if (format === "7z") {
      zipped = await this._create7z(filesMap, compressionLevel);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    const fullName = `${archiveName}.${format}`;
    const blob = new Blob([new Uint8Array(zipped)]);

    if (outputPath) {
      const uniqueName = await this.fs.getUniqueFileName(outputPath, fullName);
      await os.fs.writeBinaryFile(outputPath, uniqueName, blob, FileKind.OTHER, "static/icons/zip.webp");
      return { success: true, path: [...outputPath, uniqueName], name: uniqueName };
    }

    return { success: true, blob, name: fullName };
  }

  async extract(itemName, currentPath, onComplete, password = null) {
    const lower = itemName.toLowerCase();
    this.notify(`Extracting "${itemName}"...`, "info", 5000, null, this.appSource);
    try {
      let blob;
      try {
        blob = await this.fs.readBinaryFile(currentPath, itemName);
      } catch (e) {
        blob = await os.fs.read([...currentPath, itemName]);
      }
      if (!blob) {
        this.notify(
          `Could not read "${itemName}" - was it uploaded as a binary file?`,
          "error",
          5000,
          "fas fa-exclamation-triangle",
          this.appSource
        );
        return;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const detectedFormat = detectArchiveFormat(bytes, itemName);
      const baseName = archiveBaseName(itemName);
      const destPath = [...currentPath, baseName];
      await os.fs.mkdir(destPath);

      if (detectedFormat === "zip" && !password) {
        await this._extractZip(toOwnedBytes(bytes), destPath);
      } else if (detectedFormat === "zip" && password) {
        await this._extractZipWithPassword(toOwnedBytes(bytes), destPath, password);
      } else if (detectedFormat === "7z" || (lower.endsWith(".7z") && !detectedFormat)) {
        await this._extract7z(toOwnedBytes(bytes), destPath);
      } else if (detectedFormat === "rar" || (lower.endsWith(".rar") && !detectedFormat)) {
        await this._extractWithArchiveWasm(bytes, destPath, password);
      } else if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
        const decompressed = await this._gunzipBytes(toOwnedBytes(bytes));
        await this._extractTar(decompressed, destPath);
      } else if (lower.endsWith(".tar.bz2") || lower.endsWith(".tbz2")) {
        const decompressed = await this._bunzip2Bytes(toOwnedBytes(bytes));
        await this._extractTar(decompressed, destPath);
      } else if (lower.endsWith(".tar.xz")) {
        const decompressed = await this._xzDecompress(toOwnedBytes(bytes));
        await this._extractTar(decompressed, destPath);
      } else if (detectedFormat === "xz" || (lower.endsWith(".xz") && !lower.endsWith(".tar.xz"))) {
        const decompressed = await this._xzDecompress(toOwnedBytes(bytes));
        const innerName = itemName.slice(0, -3);
        const blob = new Blob([decompressed]);
        const kind = this._inferFileKind(innerName);
        const icon = this._inferFileIcon(innerName);
        await os.fs.writeBinaryFile(destPath, innerName, blob, kind, icon);
      } else if (detectedFormat === "bz2" || (lower.endsWith(".bz2") && !lower.endsWith(".tar.bz2"))) {
        const decompressed = await this._bunzip2Bytes(toOwnedBytes(bytes));
        const innerName = itemName.slice(0, -4);
        const blob = new Blob([new Uint8Array(decompressed)]);
        const kind = this._inferFileKind(innerName);
        const icon = this._inferFileIcon(innerName);
        await os.fs.writeBinaryFile(destPath, innerName, blob, kind, icon);
      } else if (lower.endsWith(".gz") && !lower.endsWith(".tar.gz")) {
        const decompressed = await this._gunzipBytes(toOwnedBytes(bytes));
        const innerName = itemName.slice(0, -3);
        const blob = new Blob([decompressed]);
        const kind = this._inferFileKind(innerName);
        const icon = this._inferFileIcon(innerName);
        await os.fs.writeBinaryFile(destPath, innerName, blob, kind, icon);
      } else if (detectedFormat === "tar" || lower.endsWith(".tar")) {
        await this._extractTar(bytes, destPath);
      } else {
        await this._extractWithArchiveWasm(bytes, destPath, password);
      }

      this.notify(`Extracted to "${baseName}/"`, "success", 5000, null, this.appSource);
      if (onComplete) await onComplete();
    } catch (err) {
      console.error("Extraction error:", err);
      this.notify(
        `Failed to extract "${itemName}": ${err.message || err}`,
        "error",
        5000,
        "fas fa-times-circle",
        this.appSource
      );
    }
  }

  _gunzipBytes(bytes) {
    return new Promise((resolve, reject) => {
      gunzip(bytes, (err, data) => (err ? reject(err) : resolve(data)));
    });
  }

  _bunzip2Bytes(bytes) {
    try {
      return decompressSync(bytes);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async _xzDecompress(bytes) {
    const archiveWasm = await getArchiveWasm();
    try {
      const entries = archiveWasm.extract(bytes);
      for (const entry of entries) {
        if (entry.type === "FILE") {
          return entry.data;
        }
      }
      throw new Error("No file found in xz archive");
    } catch (e) {
      throw new Error(`XZ decompression failed: ${e.message}`);
    }
  }

  async _7zipDecompress(bytes, fileName) {
    const sevenZip = await get7zip();
    const tempId = generateTempId();
    const tempFileName = `${tempId}_${fileName}`;
    const outDir = `/out_${tempId}`;

    try {
      sevenZip.FS.mkdir(outDir);
    } catch (e) {}

    const stream = sevenZip.FS.open(tempFileName, "w+");
    sevenZip.FS.write(stream, bytes, 0, bytes.length);
    sevenZip.FS.close(stream);
    sevenZip.callMain(["e", tempFileName, `-o${outDir}`, "-y"]);
    const files = sevenZip.FS.readdir(outDir).filter((f) => f !== "." && f !== "..");
    if (files.length !== 1) {
      throw new Error(`Expected 1 decompressed file, got ${files.length}`);
    }
    const result = sevenZip.FS.readFile(`${outDir}/${files[0]}`);
    sevenZip.FS.unlink(tempFileName);
    sevenZip.FS.unlink(`${outDir}/${files[0]}`);
    try {
      sevenZip.FS.rmdir(outDir);
    } catch (e) {}
    return result;
  }

  async _extract7z(bytes, destPath) {
    const sevenZip = await get7zip();
    const tempId = generateTempId();
    const archiveName = `input_${tempId}.7z`;
    const outDir = `/out7z_${tempId}`;

    try {
      sevenZip.FS.mkdir(outDir);
    } catch (e) {}

    const stream = sevenZip.FS.open(archiveName, "w+");
    sevenZip.FS.write(stream, bytes, 0, bytes.length);
    sevenZip.FS.close(stream);
    sevenZip.callMain(["x", archiveName, `-o${outDir}`, "-y"]);
    await this._collectSevenZipOutput(sevenZip, outDir, outDir, destPath);
    sevenZip.FS.unlink(archiveName);

    const cleanupDir = (currentPath) => {
      try {
        const entries = sevenZip.FS.readdir(currentPath).filter((e) => e !== "." && e !== "..");
        for (const entry of entries) {
          const full = `${currentPath}/${entry}`;
          const stat = sevenZip.FS.stat(full);
          if (sevenZip.FS.isDir(stat.mode)) {
            cleanupDir(full);
            sevenZip.FS.rmdir(full);
          } else {
            sevenZip.FS.unlink(full);
          }
        }
        sevenZip.FS.rmdir(currentPath);
      } catch (e) {}
    };
    cleanupDir(outDir);
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
        await os.fs.mkdir([...destPath, ...relParts]);
        await this._collectSevenZipOutput(sevenZip, baseDir, fullPath, destPath);
      } else {
        const relParts = fullPath
          .slice(baseDir.length + 1)
          .split("/")
          .filter(Boolean);
        const fileName = relParts.pop();
        const subPath = [...destPath, ...relParts];
        await os.fs.mkdir(subPath);
        const fileBytes = toOwnedBytes(sevenZip.FS.readFile(fullPath));
        const blob = new Blob([fileBytes]);
        const kind = this._inferFileKind(fileName);
        const icon = this._inferFileIcon(fileName);
        await os.fs.writeBinaryFile(subPath, fileName, blob, kind, icon);
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
            await os.fs.mkdir(subPath);
            const fileBytes = toOwnedBytes(data);
            const blob = new Blob([fileBytes]);
            const ext = fileName.split(".").pop().toLowerCase();
            const kind = this._inferFileKind(fileName);
            const icon = this._inferFileIcon(fileName);
            await os.fs.writeBinaryFile(subPath, fileName, blob, kind, icon);
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
      if (!nameRaw || nameRaw.length === 0) {
        offset += 512;
        continue;
      }

      const size = parseInt(tarStr(header, 124, 12).trim(), 8) || 0;
      const typeflag = String.fromCharCode(header[156]);
      const mode = parseInt(tarStr(header, 100, 8).trim(), 8) || 0o644;
      const checksum = parseInt(tarStr(header, 148, 8).trim(), 8) || 0;

      let computedChecksum = 0;
      for (let i = 0; i < 512; i++) {
        computedChecksum += header[i];
      }
      for (let i = 148; i < 156; i++) {
        computedChecksum -= header[i];
      }
      computedChecksum += 32 * 8;

      if (computedChecksum !== checksum) {
        console.warn(`Tar checksum mismatch for ${nameRaw}: expected ${checksum}, got ${computedChecksum}`);
      }

      offset += 512;

      const parts = nameRaw.replace(/\\/g, "/").split("/").filter(Boolean);
      const fileName = parts.pop();
      const subPath = [...destPath, ...parts];

      if (typeflag === "0" || typeflag === "\0") {
        await os.fs.mkdir(subPath);
        const fileBytes = toOwnedBytes(bytes.slice(offset, offset + size));
        const blob = new Blob([fileBytes]);
        const kind = this._inferFileKind(fileName);
        const icon = this._inferFileIcon(fileName);
        await os.fs.writeBinaryFile(subPath, fileName, blob, kind, icon);
      } else if (typeflag === "5") {
        await os.fs.mkdir([...destPath, ...parts, fileName]);
      } else if (typeflag === "2") {
        const linkTarget = tarStr(header, 157, 100);
        console.log(`Symlink: ${nameRaw} -> ${linkTarget} (symlinks not supported in virtual FS)`);
      } else if (typeflag === "1") {
        const linkTarget = tarStr(header, 157, 100);
        console.log(`Hard link: ${nameRaw} -> ${linkTarget} (hard links not supported in virtual FS)`);
      } else if (typeflag === "L" || typeflag === "K") {
        const longName = strFromU8(bytes.slice(offset, offset + size), true);
        offset += Math.ceil(size / 512) * 512;
        const nextHeader = bytes.slice(offset, offset + 512);
        const nextTypeflag = String.fromCharCode(nextHeader[156]);
        offset += 512;
        const nextSize = parseInt(tarStr(nextHeader, 124, 12).trim(), 8) || 0;
        if (nextTypeflag === "0" || nextTypeflag === "\0") {
          const longParts = longName.replace(/\\/g, "/").split("/").filter(Boolean);
          const longFileName = longParts.pop();
          const longSubPath = [...destPath, ...longParts];
          await os.fs.mkdir(longSubPath);
          const fileBytes = toOwnedBytes(bytes.slice(offset, offset + nextSize));
          const blob = new Blob([fileBytes]);
          const kind = this._inferFileKind(longFileName);
          const icon = this._inferFileIcon(longFileName);
          await os.fs.writeBinaryFile(longSubPath, longFileName, blob, kind, icon);
          offset += Math.ceil(nextSize / 512) * 512;
          continue;
        }
      }

      offset += Math.ceil(size / 512) * 512;
    }
  }

  async _collectFilesRecursively(items) {
    const filesMap = {};

    for (const item of items) {
      const path = Array.isArray(item.path) ? item.path : [item.path];
      const name = item.name;
      const isFile = item.isFile ?? true;

      await this._collectFileRecursive(path, name, isFile, "", filesMap);
    }

    return filesMap;
  }

  async _collectFileRecursive(pathParts, itemName, isFile, prefix, filesMap) {
    const subPath = [...pathParts, itemName];
    if (isFile) {
      let bytes;
      try {
        const blob = await this.fs.readBinaryFile(pathParts, itemName);
        if (blob) {
          bytes = new Uint8Array(await blob.arrayBuffer());
        }
      } catch (e) {
        const blob = await os.fs.read([...pathParts, itemName]);
        if (blob) {
          bytes = new Uint8Array(await blob.arrayBuffer());
        } else {
          const text = await this.fs.getFileContent(pathParts, itemName);
          bytes = new TextEncoder().encode(typeof text === "string" ? text : "");
        }
      }
      filesMap[prefix + itemName] = bytes;
    } else {
      const folderEntries = await os.fs.readdir(subPath).catch(() => ({}));
      for (const [childName, childData] of Object.entries(folderEntries)) {
        const childIsFile = childData?.type === "file";
        await this._collectFileRecursive(subPath, childName, childIsFile, prefix + itemName + "/", filesMap);
      }
    }
  }

  _inferFileKind(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"];
    const textExts = ["txt", "md", "html", "json", "xml", "yaml", "yml", "csv"];
    const audioExts = ["mp3", "wav", "ogg", "flac", "m4a"];
    const videoExts = ["mp4", "webm", "mov", "avi", "mkv"];

    if (imageExts.includes(ext)) return FileKind.IMAGE;
    if (textExts.includes(ext)) return FileKind.TEXT;
    if (audioExts.includes(ext)) return FileKind.AUDIO;
    if (videoExts.includes(ext)) return FileKind.VIDEO;
    return FileKind.OTHER;
  }

  _inferFileIcon(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    const iconMap = {
      png: "fa-file-image",
      jpg: "fa-file-image",
      jpeg: "fa-file-image",
      gif: "fa-file-image",
      webp: "fa-file-image",
      svg: "fa-file-image",
      ico: "fa-file-image",
      bmp: "fa-file-image",
      txt: "fa-file-alt",
      md: "fa-file-alt",
      html: "fa-file-code",
      json: "fa-file-code",
      xml: "fa-file-code",
      yaml: "fa-file-code",
      yml: "fa-file-code",
      csv: "fa-file-csv",
      mp3: "fa-file-audio",
      wav: "fa-file-audio",
      ogg: "fa-file-audio",
      flac: "fa-file-audio",
      m4a: "fa-file-audio",
      mp4: "fa-file-video",
      webm: "fa-file-video",
      mov: "fa-file-video",
      avi: "fa-file-video",
      mkv: "fa-file-video"
    };
    return iconMap[ext] || "fa-file";
  }

  _createTar(filesMap) {
    const chunks = [];
    const writeString = (buf, offset, str, len) => {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(str);
      for (let i = 0; i < len; i++) {
        buf[offset + i] = i < encoded.length ? encoded[i] : 0;
      }
    };

    const writeOctal = (buf, offset, value, len) => {
      const str = value.toString(8).padStart(len - 1, "0");
      writeString(buf, offset, str, len - 1);
      buf[offset + len - 1] = 0;
    };

    const paths = Object.keys(filesMap).sort();
    const directories = new Set();

    for (const path of paths) {
      const parts = path.split("/").filter(Boolean);
      for (let i = 1; i < parts.length; i++) {
        const dirPath = parts.slice(0, i).join("/");
        directories.add(dirPath);
      }
    }

    for (const dirPath of Array.from(directories).sort()) {
      const header = new Uint8Array(512);
      writeString(header, 0, dirPath, 100);
      writeOctal(header, 100, 0o755, 8);
      writeOctal(header, 108, 0, 8);
      writeOctal(header, 116, 0, 8);
      writeOctal(header, 124, 0, 12);
      writeOctal(header, 136, Math.floor(Date.now() / 1000), 12);
      writeOctal(header, 148, 0, 8);
      writeString(header, 156, "5", 1);
      writeString(header, 257, "ustar", 6);
      writeString(header, 263, "00", 2);
      writeString(header, 329, "root", 5);
      writeString(header, 337, "root", 5);

      let checksum = 0;
      for (let i = 0; i < 512; i++) {
        checksum += header[i];
      }
      for (let i = 148; i < 156; i++) {
        checksum -= header[i];
      }
      checksum += 32 * 8;
      writeOctal(header, 148, checksum, 8);
      header[155] = 32;

      chunks.push(header);
    }

    for (const [path, bytes] of Object.entries(filesMap)) {
      const header = new Uint8Array(512);
      writeString(header, 0, path, 100);
      writeOctal(header, 100, 0o644, 8);
      writeOctal(header, 108, 0, 8);
      writeOctal(header, 116, 0, 8);
      writeOctal(header, 124, bytes.length, 12);
      writeOctal(header, 136, Math.floor(Date.now() / 1000), 12);
      writeOctal(header, 148, 0, 8);
      writeString(header, 156, "0", 1);
      writeString(header, 257, "ustar", 6);
      writeString(header, 263, "00", 2);
      writeString(header, 329, "root", 5);
      writeString(header, 337, "root", 5);

      let checksum = 0;
      for (let i = 0; i < 512; i++) {
        checksum += header[i];
      }
      for (let i = 148; i < 156; i++) {
        checksum -= header[i];
      }
      checksum += 32 * 8;
      writeOctal(header, 148, checksum, 8);
      header[155] = 32;

      chunks.push(header);
      chunks.push(bytes);
      const padding = (512 - (bytes.length % 512)) % 512;
      if (padding > 0) {
        chunks.push(new Uint8Array(padding));
      }
    }

    chunks.push(new Uint8Array(1024));
    let totalLen = 0;
    for (const c of chunks) totalLen += c.length;
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  }

  async _create7z(filesMap, compressionLevel) {
    const sevenZip = await get7zip();
    const tempId = generateTempId();
    const tempDir = `/7z_temp_${tempId}`;

    try {
      sevenZip.FS.mkdir(tempDir);
    } catch (e) {}

    const writeToFS = (dirPath, filename, bytes) => {
      const parts = dirPath.split("/").filter(Boolean);
      let current = tempDir;
      for (const p of parts) {
        current += "/" + p;
        try {
          sevenZip.FS.mkdir(current);
        } catch (e) {}
      }
      const fullPath = `${current}/${filename}`;
      const stream = sevenZip.FS.open(fullPath, "w+");
      sevenZip.FS.write(stream, bytes, 0, bytes.length);
      sevenZip.FS.close(stream);
    };

    const filesToCompress = [];
    for (const [relPath, bytes] of Object.entries(filesMap)) {
      const slashIndex = relPath.lastIndexOf("/");
      const dirPath = slashIndex > 0 ? relPath.substring(0, slashIndex) : "";
      const filename = slashIndex > 0 ? relPath.substring(slashIndex + 1) : relPath;
      writeToFS(dirPath, filename, bytes);
      const topLevelName = relPath.split("/")[0];
      if (!filesToCompress.includes(topLevelName)) {
        filesToCompress.push(topLevelName);
      }
    }

    const archiveFile = `/output_${tempId}.7z`;
    try {
      sevenZip.FS.unlink(archiveFile);
    } catch (e) {}

    sevenZip.callMain([
      "a",
      archiveFile,
      ...filesToCompress.map((f) => `${tempDir}/${f}`),
      `-mx=${compressionLevel}`,
      "-y"
    ]);

    const result = new Uint8Array(sevenZip.FS.readFile(archiveFile));

    try {
      sevenZip.FS.unlink(archiveFile);
    } catch (e) {}

    const cleanupDir = (currentPath) => {
      try {
        const entries = sevenZip.FS.readdir(currentPath).filter((e) => e !== "." && e !== "..");
        for (const entry of entries) {
          const full = `${currentPath}/${entry}`;
          const stat = sevenZip.FS.stat(full);
          if (sevenZip.FS.isDir(stat.mode)) {
            cleanupDir(full);
            sevenZip.FS.rmdir(full);
          } else {
            sevenZip.FS.unlink(full);
          }
        }
        sevenZip.FS.rmdir(currentPath);
      } catch (e) {}
    };
    cleanupDir(tempDir);

    return result;
  }

  async _extractWithArchiveWasm(bytes, destPath, password = null) {
    const archiveWasm = await getArchiveWasm();
    const options = password ? { password } : undefined;
    const entries = archiveWasm.extract(bytes, options);

    for (const entry of entries) {
      if (entry.type === "FILE") {
        const parts = entry.path.split("/").filter(Boolean);
        const fileName = parts.pop();
        const subPath = [...destPath, ...parts];
        await os.fs.mkdir(subPath);
        const blob = new Blob([entry.data]);
        const kind = this._inferFileKind(fileName);
        const icon = this._inferFileIcon(fileName);
        await os.fs.writeBinaryFile(subPath, fileName, blob, kind, icon);
      } else if (entry.type === "DIRECTORY") {
        const parts = entry.path.split("/").filter(Boolean);
        await os.fs.mkdir([...destPath, ...parts]);
      }
    }
  }

  async _extractZipWithPassword(bytes, destPath, password) {
    const archiveWasm = await getArchiveWasm();
    try {
      const entries = archiveWasm.extract(bytes, { password });

      for (const entry of entries) {
        if (entry.type === "FILE") {
          const parts = entry.path.split("/").filter(Boolean);
          const fileName = parts.pop();
          const subPath = [...destPath, ...parts];
          await os.fs.mkdir(subPath);
          const blob = new Blob([entry.data]);
          const kind = this._inferFileKind(fileName);
          const icon = this._inferFileIcon(fileName);
          await os.fs.writeBinaryFile(subPath, fileName, blob, kind, icon);
        } else if (entry.type === "DIRECTORY") {
          const parts = entry.path.split("/").filter(Boolean);
          await os.fs.mkdir([...destPath, ...parts]);
        }
      }
    } catch (e) {
      if (e.message && e.message.includes("password")) {
        throw new Error("Incorrect password or encrypted archive not supported");
      }
      throw e;
    }
  }

  async _createZipWithPassword(filesMap, compressionLevel, password) {
    const archiveWasm = await getArchiveWasm();
    try {
      const entries = [];
      for (const [path, bytes] of Object.entries(filesMap)) {
        entries.push({
          path,
          data: bytes,
          type: "FILE"
        });
      }
      const result = archiveWasm.create(entries, { password, compressionLevel });
      return new Uint8Array(result);
    } catch (e) {
      this.notify(
        `Password-protected ZIP creation not fully supported: ${e.message}. Falling back to standard ZIP.`,
        "info",
        5000,
        "fas fa-info-circle",
        this.appSource
      );
      return zipSync(filesMap, { level: compressionLevel });
    }
  }

  async _createXz(bytes) {
    throw new Error("XZ compression not yet implemented via archive-wasm. Use 7zip-wasm fallback.");
  }

  async extractStreaming(itemName, currentPath, onComplete, chunkSize = 1024 * 1024) {
    this.notify(
      `Streaming extraction not yet implemented. Falling back to full extraction.`,
      "info",
      5000,
      "fas fa-info-circle",
      this.appSource
    );
    return this.extract(itemName, currentPath, onComplete);
  }
}
