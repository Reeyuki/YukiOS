export const FileKind = { TEXT: "text", IMAGE: "image", VIDEO: "video", AUDIO: "audio", ROM: "rom", OTHER: "other" };

export class FileKindDetector {
  inferKind(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"].includes(ext)) return FileKind.IMAGE;
    if (["txt", "js", "json", "md", "html", "css", "xml", "yaml", "yml", "ini", "cfg", "log"].includes(ext))
      return FileKind.TEXT;
    if (["mp4", "webm", "ogv", "mov"].includes(ext)) return FileKind.VIDEO;
    if (["mp3", "ogg", "wav", "flac", "aac", "m4a", "opus", "wma"].includes(ext)) return FileKind.AUDIO;
    return FileKind.OTHER;
  }

  _mimeFromName(name) {
    const ext = name.split(".").pop().toLowerCase();
    const map = {
      mp3: "audio/mpeg",
      ogg: "audio/ogg",
      wav: "audio/wav",
      flac: "audio/flac",
      aac: "audio/aac",
      m4a: "audio/mp4",
      opus: "audio/opus",
      wma: "audio/x-ms-wma",
      mp4: "video/mp4",
      webm: "video/webm",
      ogv: "video/ogg",
      mov: "video/quicktime",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
      avif: "image/avif",
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ppt: "application/vnd.ms-powerpoint",
      zip: "application/zip",
      gz: "application/gzip",
      tar: "application/x-tar",
      rar: "application/vnd.rar",
      "7z": "application/x-7z-compressed"
    };
    return map[ext] ?? "application/octet-stream";
  }

  _isBinaryName(name) {
    const ext = name.split(".").pop().toLowerCase();
    const textExts = new Set([
      "txt",
      "js",
      "json",
      "css",
      "xml",
      "yaml",
      "yml",
      "ini",
      "cfg",
      "log",
      "md",
      "markdown",
      "html",
      "htm",
      "csv",
      "rtf",
      "ts",
      "jsx",
      "tsx",
      "sh",
      "bat",
      "py",
      "rb",
      "php",
      "desktop"
    ]);
    return !textExts.has(ext);
  }
}
