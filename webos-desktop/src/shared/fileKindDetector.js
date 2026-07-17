export const FileKind = {
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  ROM: "rom",
  FONT: "font",
  OTHER: "other"
};

export const IMAGE_EXTS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
  "ico",
  "heic",
  "heif",
  "tiff",
  "tif",
  "raw",
  "cr2",
  "nef",
  "dng",
  "arw",
  "psd",
  "ai",
  "eps"
];

export const VIDEO_EXTS = [
  "mp4",
  "webm",
  "ogv",
  "mov",
  "mkv",
  "avi",
  "m4v",
  "wmv",
  "flv",
  "hevc",
  "mpg",
  "mpeg",
  "m2ts",
  "ts",
  "3gp",
  "asf"
];

export const AUDIO_EXTS = [
  "mp3",
  "ogg",
  "wav",
  "flac",
  "aac",
  "m4a",
  "opus",
  "wma",
  "alac",
  "mid",
  "midi",
  "aiff",
  "caf"
];

export const OFFICE_EXTS = [
  "docx",
  "doc",
  "xlsx",
  "xls",
  "sldx",
  "csv",
  "odt",
  "ods",
  "pdf",
  "odp",
  "pptx",
  "ppt",
  "odg",
  "ott",
  "ots",
  "otp",
  "vsd",
  "vsdx",
  "pub",
  "xps",
  "wpd",
  "rtfx"
];

export const ZIP_EXTS = ["zip", "gz", "tgz", "tar", "rar", "7z", "bz2", "xz", "lz", "lzma", "zst", "cab", "dmg", "pak"];

export const ISO_EXTS = ["iso", "bin", "img", "nrg", "mdf", "cdi"];

export const EXE_EXTS = ["exe", "msi", "com", "bat", "cmd", "jsdos"];
export const SWF_EXTS = ["swf"];

export const MODEL3D_EXTS = ["obj", "gltf", "glb", "fbx", "dae", "3ds", "usdz", "stl", "ply", "x", "blend"];

export const EBOOK_EXTS = ["epub", "mobi", "azw", "azw3", "fb2"];
export const FONT_EXTS = ["ttf", "otf", "woff", "woff2"];
export const DISK_EXTS = ["vhd", "vhdx", "vmdk", "img", "qcow2"];
export const SHORTCUT_EXTS = ["torrent", "url", "webloc", "lnk", "desktop"];
export const HTML_EXTS = ["html", "htm", "xhtml"];
export const MARKDOWN_EXTS = ["md", "markdown"];

export const TEXT_EXTS = [
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
  "rtf",
  "ts",
  "tsx",
  "jsx",
  "mjs",
  "cjs",
  "sh",
  "bash",
  "zsh",
  "env",
  "sql",
  "py",
  "java",
  "cs",
  "cpp",
  "c",
  "h",
  "hpp",
  "go",
  "rs",
  "php",
  "scala",
  "sc",
  "lua",
  "elm",
  "nim",
  "asm",
  "v",
  "zig",
  "astro",
  "solid",
  "mdx",
  "jsonc",
  "toml",
  "conf",
  "config"
];

export const CODE_EXTS = [
  "ts",
  "tsx",
  "jsx",
  "mjs",
  "cjs",
  "js",
  "css",
  "py",
  "java",
  "cs",
  "cpp",
  "c",
  "h",
  "hpp",
  "go",
  "rs",
  "php",
  "sh",
  "bash",
  "zsh",
  "sql",
  "env",
  "scss",
  "sass",
  "less",
  "vue",
  "svelte",
  "kt",
  "kts",
  "swift",
  "rb",
  "dart",
  "toml",
  "properties",
  "ini",
  "cfg",
  "lock",
  "dockerfile",
  "makefile",
  "yml",
  "yaml",
  "scala",
  "sc",
  "lua",
  "elm",
  "nim",
  "asm",
  "v",
  "zig",
  "astro",
  "solid",
  "mdx",
  "jsonc",
  "conf",
  "config"
];

const ALL_TEXT_EXTS = new Set([...TEXT_EXTS, ...HTML_EXTS, ...MARKDOWN_EXTS]);

export function getExt(name) {
  return name.split(".").pop().toLowerCase();
}

export function fileKindFromName(name) {
  const ext = getExt(name);
  if (IMAGE_EXTS.includes(ext)) return FileKind.IMAGE;
  if (VIDEO_EXTS.includes(ext)) return FileKind.VIDEO;
  if (AUDIO_EXTS.includes(ext)) return FileKind.AUDIO;
  if (SWF_EXTS.includes(ext)) return FileKind.OTHER;
  if (ZIP_EXTS.includes(ext)) return FileKind.OTHER;
  if (EBOOK_EXTS.includes(ext)) return FileKind.OTHER;
  if (FONT_EXTS.includes(ext)) return FileKind.FONT;
  if (DISK_EXTS.includes(ext)) return FileKind.ROM;
  if (ISO_EXTS.includes(ext)) return FileKind.ROM;
  if (SHORTCUT_EXTS.includes(ext)) return FileKind.OTHER;
  if (HTML_EXTS.includes(ext)) return FileKind.OTHER;
  if (MARKDOWN_EXTS.includes(ext)) return FileKind.TEXT;
  if (TEXT_EXTS.includes(ext)) return FileKind.TEXT;
  return FileKind.OTHER;
}

export function inferKind(fileName) {
  const ext = getExt(fileName);
  if (IMAGE_EXTS.includes(ext)) return FileKind.IMAGE;
  if (TEXT_EXTS.concat(HTML_EXTS, MARKDOWN_EXTS).includes(ext)) return FileKind.TEXT;
  if (VIDEO_EXTS.includes(ext)) return FileKind.VIDEO;
  if (AUDIO_EXTS.includes(ext)) return FileKind.AUDIO;
  return FileKind.OTHER;
}

export function isImageFile(name) {
  return IMAGE_EXTS.includes(getExt(name));
}
export function isVideoFile(name) {
  return VIDEO_EXTS.includes(getExt(name));
}
export function isAudioFile(name) {
  return AUDIO_EXTS.includes(getExt(name));
}
export function isOfficeFile(name) {
  return OFFICE_EXTS.includes(getExt(name));
}
export function isZipFile(name) {
  return ZIP_EXTS.includes(getExt(name));
}
export function isISOFile(name) {
  return ISO_EXTS.includes(getExt(name));
}
export function isExeFile(name) {
  return EXE_EXTS.includes(getExt(name));
}
export function isSwfFile(name) {
  return SWF_EXTS.includes(getExt(name));
}
export function isModel3DFile(name) {
  return MODEL3D_EXTS.includes(getExt(name));
}
export function isEbookFile(name) {
  return EBOOK_EXTS.includes(getExt(name));
}
export function isFontFile(name) {
  return FONT_EXTS.includes(getExt(name));
}
export function isDiskFile(name) {
  return DISK_EXTS.includes(getExt(name));
}
export function isShortcutFile(name) {
  return SHORTCUT_EXTS.includes(getExt(name));
}
export function isHtmlFile(name) {
  return HTML_EXTS.includes(getExt(name));
}
export function isMarkdownFile(name) {
  return MARKDOWN_EXTS.includes(getExt(name));
}
export function isCodeFile(name) {
  return CODE_EXTS.includes(getExt(name));
}
export function isJsonFile(name) {
  return getExt(name) === "json";
}

export const VIDEO_MIME_MAP = {
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  m4v: "video/x-m4v",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  hevc: "video/hevc",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  m2ts: "video/mp2t",
  ts: "video/mp2t",
  "3gp": "video/3gpp",
  asf: "video/x-ms-asf"
};

export const IMAGE_MIME_MAP = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  avif: "image/avif",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  raw: "image/raw",
  cr2: "image/x-canon-cr2",
  nef: "image/x-nikon-nef",
  dng: "image/x-adobe-dng",
  arw: "image/x-sony-arw",
  psd: "image/vnd.adobe.photoshop",
  ai: "application/postscript",
  eps: "application/postscript"
};

export function mimeFromName(name) {
  const ext = getExt(name);
  const map = {
    ...IMAGE_MIME_MAP,
    ...VIDEO_MIME_MAP,
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    flac: "audio/flac",
    aac: "audio/aac",
    m4a: "audio/mp4",
    opus: "audio/opus",
    wma: "audio/x-ms-wma",
    alac: "audio/alac",
    mid: "audio/midi",
    midi: "audio/midi",
    aiff: "audio/aiff",
    caf: "audio/x-caf",
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

export function isBinaryName(name) {
  const ext = getExt(name);
  return !ALL_TEXT_EXTS.has(ext);
}
