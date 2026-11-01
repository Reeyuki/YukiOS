export const CONVERT_FORMATS = {
  image: [
    "png",
    "jpg",
    "jpeg",
    "webp",
    "bmp",
    "svg",
    "gif",
    "ico",
    "tiff",
    "tif",
    "avif",
    "heic",
    "heif",
    "psd",
    "raw",
    "cr2",
    "nef",
    "arw",
    "dng",
    "ai",
    "eps",
    "jxl",
    "bpg",
    "jp2",
  ],
  text: [
    "txt",
    "md",
    "html",
    "json",
    "rtf",
    "xml",
    "yaml",
    "yml",
    "log",
    "ini",
    "cfg",
    "conf",
    "toml",
    "tex",
    "rst",
    "adoc",
    "org",
  ],
  structured: ["json", "csv", "xml", "yaml", "yml", "tsv", "toml", "ini"],
  audio: [
    "mp3",
    "wav",
    "ogg",
    "flac",
    "m4a",
    "aac",
    "opus",
    "webm",
    "wma",
    "aiff",
    "au",
    "ra",
    "amr",
    "3gp",
    "mp4a",
    "ac3",
    "dts",
    "ape",
    "wv",
    "tta",
    "mka",
    "caf",
    "gsm",
    "alac",
    "mid",
    "midi",
  ],
  video: [
    "mp4",
    "webm",
    "mov",
    "avi",
    "mkv",
    "ogv",
    "flv",
    "wmv",
    "m4v",
    "3gp",
    "ts",
    "mts",
    "m2ts",
    "vob",
    "divx",
    "xvid",
    "rm",
    "rmvb",
    "asf",
    "mxf",
    "f4v",
    "hevc",
    "mpg",
    "mpeg",
  ],
};

export function getFileExtension(name) {
  const parts = String(name).split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

export function getFileNameWithoutExtension(name) {
  const parts = String(name).split(".");
  return parts.length > 1 ? parts.slice(0, -1).join(".") : String(name);
}

export function detectCategory(ext) {
  const target = String(ext || "").toLowerCase();
  if (!target) return null;
  const images = [
    "png",
    "jpg",
    "jpeg",
    "webp",
    "bmp",
    "svg",
    "gif",
    "ico",
    "tiff",
    "tif",
    "psd",
    "raw",
    "cr2",
    "nef",
    "arw",
    "dng",
    "heic",
    "heif",
    "avif",
    "ai",
    "eps",
    "jxl",
    "bpg",
    "jp2",
  ];
  const texts = [
    "txt",
    "md",
    "html",
    "json",
    "log",
    "rtf",
    "xml",
    "yaml",
    "yml",
    "ini",
    "cfg",
    "conf",
    "toml",
    "tex",
    "rst",
    "adoc",
    "org",
  ];
  const structured = [
    "json",
    "csv",
    "xml",
    "yaml",
    "yml",
    "tsv",
    "toml",
    "ini",
  ];
  const audio = [
    "mp3",
    "wav",
    "ogg",
    "flac",
    "m4a",
    "aac",
    "wma",
    "opus",
    "aiff",
    "au",
    "ra",
    "amr",
    "3gp",
    "mp4a",
    "ac3",
    "dts",
    "ape",
    "wv",
    "tta",
    "mka",
    "caf",
    "gsm",
  ];
  const video = [
    "mp4",
    "webm",
    "mov",
    "avi",
    "mkv",
    "flv",
    "wmv",
    "m4v",
    "3gp",
    "ogv",
    "ts",
    "mts",
    "m2ts",
    "vob",
    "divx",
    "xvid",
    "rm",
    "rmvb",
    "asf",
    "mxf",
    "f4v",
  ];
  if (images.includes(target)) return "image";
  if (audio.includes(target)) return "audio";
  if (video.includes(target)) return "video";
  if (structured.includes(target)) return "structured";
  if (texts.includes(target)) return "text";
  return null;
}

export function getTargetFormats(ext) {
  const target = String(ext || "").toLowerCase();
  const category = detectCategory(target);
  if (!category) return [];
  return CONVERT_FORMATS[category].filter((format) => format !== target);
}

export function mdToHtml(md) {
  const html = String(md)
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*)\*/gim, "<em>$1</em>")
    .replace(/`([^`]+)`/gim, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="blank">$1</a>')
    .replace(/^\s*\n/gm, "<br />")
    .replace(/^ - (.*$)/gim, "<ul><li>$1</li></ul>")
    .replace(/^ \* (.*$)/gim, "<ul><li>$1</li></ul>")
    .replace(/<\/ul>\s*<ul>/gim, "")
    .replace(/^\s*([0-9]+)\. (.*$)/gim, "<ol><li>$2</li></ol>")
    .replace(/<\/ol>\s*<ol>/gim, "");
  return html;
}

function stripHtmlTags(value) {
  return String(value).replace(/<[^>]*>/g, "");
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (match, digits) =>
      String.fromCharCode(parseInt(digits, 10)),
    );
}

export function stripHtml(html) {
  const withoutScripts = String(html)
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, "");
  return decodeHtmlEntities(stripHtmlTags(withoutScripts));
}

export function htmlToMd(html) {
  const md = String(html)
    .replace(/<h1>(.*?)<\/h1>/gim, "# $1\n")
    .replace(/<h2>(.*?)<\/h2>/gim, "## $1\n")
    .replace(/<h3>(.*?)<\/h3>/gim, "### $1\n")
    .replace(/<strong>(.*?)<\/strong>/gim, "**$1**")
    .replace(/<b>(.*?)<\/b>/gim, "**$1**")
    .replace(/<em>(.*?)<\/em>/gim, "*$1*")
    .replace(/<i>(.*?)<\/i>/gim, "*$1*")
    .replace(/<code>(.*?)<\/code>/gim, "`$1`")
    .replace(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/gim, "[$2]($1)")
    .replace(/<li>(.*?)<\/li>/gim, "- $1\n")
    .replace(/<ul[^>]*>/gim, "")
    .replace(/<\/ul>/gim, "\n")
    .replace(/<ol[^>]*>/gim, "")
    .replace(/<\/ol>/gim, "\n")
    .replace(/<br\s*\/?>/gim, "\n")
    .replace(/<p[^>]*>/gim, "")
    .replace(/<\/p>/gim, "\n\n");
  return decodeHtmlEntities(stripHtmlTags(md));
}

export function stripMd(md) {
  return String(md)
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "");
}

export function flattenJson(obj, prefix = "") {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenJson(value, flatKey));
    } else {
      result[flatKey] = value;
    }
  }
  return result;
}

export function jsonToCsv(json, delimiter = ",") {
  let arr = Array.isArray(json) ? json : [json];
  arr = arr.map((item) =>
    typeof item === "object" && item !== null
      ? flattenJson(item)
      : { value: item },
  );
  const allKeys = [...new Set(arr.flatMap((item) => Object.keys(item)))];
  const header = allKeys
    .map((key) => `"${String(key).replace(/"/g, '""')}"`)
    .join(delimiter);
  const rows = arr.map((item) => {
    return allKeys
      .map((key) => {
        const val =
          item[key] === undefined || item[key] === null ? "" : item[key];
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(delimiter);
  });
  return [header, ...rows].join("\n");
}

function parseCsvRow(line, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function coerceCsvValue(value) {
  let val = value === undefined ? "" : value;
  if (val.startsWith('"') && val.endsWith('"')) {
    val = val.slice(1, -1).replace(/""/g, '"');
  }
  if (!isNaN(Number(val)) && val !== "") return Number(val);
  if (String(val).toLowerCase() === "true") return true;
  if (String(val).toLowerCase() === "false") return false;
  return val;
}

export function csvToJson(csv, delimiter = ",") {
  const lines = String(csv)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const headers = parseCsvRow(lines[0], delimiter);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvRow(lines[i], delimiter);
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = coerceCsvValue(values[idx]);
    });
    rows.push(obj);
  }
  return rows;
}

function coerceYamlScalar(value) {
  let val = String(value).trim();
  if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1);
  if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1);
  if (val.toLowerCase() === "true") return true;
  if (val.toLowerCase() === "false") return false;
  if (!isNaN(Number(val)) && val !== "") return Number(val);
  return val;
}

export function yamlToJson(yaml) {
  const lines = String(yaml).split("\n");
  const result = {};
  const stack = [result];
  const indents = [-1];
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.search(/\S/);
    const cleanLine = line.trim();
    const colonIndex = cleanLine.indexOf(":");
    if (colonIndex === -1) continue;
    const key = cleanLine.slice(0, colonIndex).trim();
    const rawVal = cleanLine.slice(colonIndex + 1).trim();
    const val = rawVal === "" ? "" : coerceYamlScalar(rawVal);
    while (indent <= indents[indents.length - 1]) {
      stack.pop();
      indents.pop();
    }
    const parent = stack[stack.length - 1];
    if (val === "") {
      const nextObj = {};
      if (Array.isArray(parent)) {
        parent.push({ [key]: nextObj });
      } else {
        parent[key] = nextObj;
      }
      stack.push(nextObj);
      indents.push(indent);
    } else if (Array.isArray(parent)) {
      parent.push({ [key]: val });
    } else {
      parent[key] = val;
    }
  }
  return result;
}

export function jsonToYaml(obj, depth = 0) {
  let yaml = "";
  const indent = "  ".repeat(depth);
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === "object" && item !== null) {
        yaml += `${indent}-\n${jsonToYaml(item, depth + 1)}`;
      } else {
        yaml += `${indent}- ${item}\n`;
      }
    }
  } else if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        yaml += `${indent}${key}:\n${jsonToYaml(value, depth + 1)}`;
      } else {
        yaml += `${indent}${key}: ${value}\n`;
      }
    }
  } else {
    yaml += `${indent}${obj}\n`;
  }
  return yaml;
}

function parseXmlFragment(fragment) {
  const children = {};
  const pattern = /<([A-Za-z_][\w:.-]*)(\s[^>]*)?>([\s\S]*?)<\/\1\s*>/g;
  let match = null;
  let found = false;
  while ((match = pattern.exec(fragment)) !== null) {
    found = true;
    const name = match[1];
    const value = parseXmlFragment(match[3]);
    if (children[name]) {
      if (!Array.isArray(children[name])) {
        children[name] = [children[name]];
      }
      children[name].push(value);
    } else {
      children[name] = value;
    }
  }
  if (!found) return String(fragment).trim();
  return children;
}

export function xmlToJson(xmlStr) {
  const clean = String(xmlStr)
    .replace(/<\?[^?]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<([A-Za-z_][\w:.-]*)(\s[^>]*)?\/>/g, "<$1></$1>")
    .trim();
  const root = clean.match(
    /^<([A-Za-z_][\w:.-]*)(\s[^>]*)?>([\s\S]*)<\/\1\s*>$/,
  );
  if (!root) return clean;
  return parseXmlFragment(root[3]);
}

export function jsonToXml(obj, rootName = "root") {
  const parseObj = (val, key) => {
    if (Array.isArray(val)) {
      return val.map((item) => parseObj(item, key)).join("");
    }
    if (typeof val === "object" && val !== null) {
      let inner = "";
      for (const [childKey, childVal] of Object.entries(val)) {
        inner += parseObj(childVal, childKey);
      }
      return `<${key}>${inner}</${key}>`;
    }
    return `<${key}>${val}</${key}>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${parseObj(obj, rootName)}`;
}

export function normalizeWhitespace(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function convertTxtSource(targetFormat, text) {
  if (targetFormat === "md") return text;
  if (targetFormat === "html") {
    return `<pre style="font-family:monospace;color:#fff;background:#1e1e24;padding:12px;border-radius:6px;overflow:auto;">${text}</pre>`;
  }
  if (targetFormat === "json")
    return JSON.stringify({ content: text }, null, 2);
  return null;
}

function convertMdSource(targetFormat, text) {
  if (targetFormat === "txt") return stripMd(text);
  if (targetFormat === "html") return mdToHtml(text);
  if (targetFormat === "json")
    return JSON.stringify({ markdown: text, html: mdToHtml(text) }, null, 2);
  return null;
}

function convertHtmlSource(targetFormat, text) {
  if (targetFormat === "txt") return stripHtml(text);
  if (targetFormat === "md") return htmlToMd(text);
  if (targetFormat === "json") return JSON.stringify({ html: text }, null, 2);
  return null;
}

function convertJsonTextSource(targetFormat, text) {
  if (targetFormat === "txt") return text;
  if (targetFormat === "html") return `<pre>${text}</pre>`;
  if (targetFormat === "md") {
    try {
      const parsed = JSON.parse(text);
      return `## JSON Data Export\n\n` + jsonToYaml(parsed);
    } catch (err) {
      return text;
    }
  }
  return null;
}

export function convertTextContent({
  sourceExt,
  targetFormat,
  text,
  cleanup = false,
}) {
  let working = text === undefined || text === null ? "" : String(text);
  if (cleanup) working = normalizeWhitespace(working);
  const source = String(sourceExt).toLowerCase();
  const target = String(targetFormat).toLowerCase();
  if (source === target) return working;
  if (source === "txt") return convertTxtSource(target, working);
  if (source === "md") return convertMdSource(target, working);
  if (source === "html") return convertHtmlSource(target, working);
  if (source === "json") return convertJsonTextSource(target, working);
  return null;
}

export function parseStructuredSource(sourceExt, text) {
  const source = String(sourceExt).toLowerCase();
  const content = String(text);
  if (source === "json") return JSON.parse(content);
  if (source === "csv") return csvToJson(content, ",");
  if (source === "tsv") return csvToJson(content, "\t");
  if (source === "xml") return xmlToJson(content);
  if (source === "yaml" || source === "yml") return yamlToJson(content);
  return null;
}

function flattenParsedItems(parsed, flatten) {
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  if (!flatten) return arr;
  return arr.map((item) =>
    typeof item === "object" && item !== null ? flattenJson(item) : item,
  );
}

function stringifyStructuredTarget(parsed, targetFormat, pretty, flatten) {
  const target = String(targetFormat).toLowerCase();
  const items = flattenParsedItems(parsed, flatten);
  if (target === "json") return JSON.stringify(items, null, pretty ? 2 : 0);
  if (target === "csv") return jsonToCsv(items, ",");
  if (target === "tsv") return jsonToCsv(items, "\t");
  if (target === "xml") return jsonToXml(parsed, "root");
  if (target === "yaml" || target === "yml") return jsonToYaml(parsed);
  return null;
}

export function convertStructuredContent({
  sourceExt,
  targetFormat,
  text,
  pretty = true,
  flatten = false,
}) {
  const parsed = parseStructuredSource(sourceExt, text);
  if (parsed === null || parsed === undefined)
    throw new Error("Failed to parse source file.");
  return stringifyStructuredTarget(parsed, targetFormat, pretty, flatten);
}

function resolveImageMime(targetFormat) {
  if (targetFormat === "jpg") return "image/jpeg";
  if (targetFormat === "svg") return "image/svg+xml";
  return `image/${targetFormat}`;
}

function computeImageDimensions(naturalWidth, naturalHeight, options) {
  let width = parseInt(options.width, 10) || naturalWidth;
  let height = parseInt(options.height, 10) || naturalHeight;
  const scaleVal = parseFloat(options.scale) || 100;
  if (scaleVal !== 100) {
    width = Math.round(width * (scaleVal / 100));
    height = Math.round(height * (scaleVal / 100));
  }
  return { width, height };
}

function createConvertCanvas(width, height, canvasFactory) {
  if (canvasFactory) return canvasFactory(width, height);
  const scope = globalThis;
  if (scope.OffscreenCanvas) return new scope.OffscreenCanvas(width, height);
  if (scope.document) return scope.document.createElement("canvas");
  throw new Error("No canvas available.");
}

async function decodeImageSource(blob, imageSource) {
  if (imageSource) return imageSource;
  const scope = globalThis;
  if (blob && scope.createImageBitmap) return scope.createImageBitmap(blob);
  throw new Error("Image not fully loaded.");
}

function canvasToBlob(canvas, mime, quality) {
  if (canvas.convertToBlob)
    return canvas.convertToBlob({ type: mime, quality });
  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), mime, quality);
  });
}

export async function convertImageBlob({
  blob = null,
  image = null,
  targetFormat,
  options = {},
}) {
  const source = await decodeImageSource(
    blob,
    image || options.imageSource || null,
  );
  const naturalWidth = source.naturalWidth || source.width;
  const naturalHeight = source.naturalHeight || source.height;
  const dims = computeImageDimensions(naturalWidth, naturalHeight, options);
  const canvas = createConvertCanvas(
    dims.width,
    dims.height,
    options.canvasFactory || null,
  );
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext("2d");
  if (options.flatten) {
    ctx.fillStyle = options.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, dims.width, dims.height);
  }
  ctx.drawImage(source, 0, 0, dims.width, dims.height);
  const mime = resolveImageMime(String(targetFormat).toLowerCase());
  const quality = (parseInt(options.quality, 10) || 90) / 100;
  const output = await canvasToBlob(canvas, mime, quality);
  if (!output) throw new Error("Canvas encoding failed.");
  return output;
}

export function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  writeString(0, "RIFF");
  view.setUint32(4, bufferLength - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += 2;
    }
  }
  return arrayBuffer;
}

export function mixChannelsToCount(channels, targetCount) {
  if (channels.length === targetCount) return channels;
  if (channels.length === 0) throw new Error("Audio not fully loaded.");
  if (targetCount === 1) {
    const length = channels[0].length;
    const mixed = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (const channel of channels) sum += channel[i];
      mixed[i] = sum / channels.length;
    }
    return [mixed];
  }
  return Array.from({ length: targetCount }, (item, index) =>
    Float32Array.from(channels[index % channels.length]),
  );
}

export function resampleChannelData(data, fromRate, toRate) {
  if (fromRate === toRate) return Float32Array.from(data);
  const ratio = toRate / fromRate;
  const nextLength = Math.max(1, Math.round(data.length * ratio));
  const next = new Float32Array(nextLength);
  for (let i = 0; i < nextLength; i++) {
    const position = i / ratio;
    const before = Math.floor(position);
    const after = Math.min(data.length - 1, before + 1);
    const fraction = position - before;
    next[i] = data[before] * (1 - fraction) + data[after] * fraction;
  }
  return next;
}

export function applyGainToChannels(channels, gain) {
  if (!gain || gain === 1) return channels;
  return channels.map((channel) => channel.map((sample) => sample * gain));
}

export function normalizeChannelsToPeak(channels, peak = 0.95) {
  let max = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const abs = Math.abs(channel[i]);
      if (abs > max) max = abs;
    }
  }
  if (max === 0) return channels;
  const factor = peak / max;
  return channels.map((channel) => channel.map((sample) => sample * factor));
}

export function trimSilenceFromChannels(channels, threshold = 0.01) {
  const total = channels[0].length;
  let start = 0;
  let end = total;
  const isAudible = (index) =>
    channels.some((channel) => Math.abs(channel[index]) > threshold);
  while (start < total && !isAudible(start)) start++;
  while (end > start && !isAudible(end - 1)) end--;
  if (start === 0 && end === total) return channels;
  if (start >= end) return channels.map((channel) => channel.slice(0, 0));
  return channels.map((channel) => channel.slice(start, end));
}

function extractChannelList(audioBuffer) {
  const list = [];
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    list.push(Float32Array.from(audioBuffer.getChannelData(i)));
  }
  return list;
}

function wrapChannelsAsBuffer(channels, sampleRate) {
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length: channels[0].length,
    getChannelData: (index) => channels[index],
  };
}

export function convertAudioSamples({
  audioBuffer,
  sampleRate,
  channels,
  volumeBoost = 0,
  normalize = false,
  trim = false,
}) {
  if (!audioBuffer) throw new Error("Audio not fully loaded.");
  let list = extractChannelList(audioBuffer);
  let rate = audioBuffer.sampleRate;
  const targetRate = parseInt(sampleRate, 10) || audioBuffer.sampleRate;
  const targetCount = parseInt(channels, 10) || audioBuffer.numberOfChannels;
  if (targetCount !== list.length) list = mixChannelsToCount(list, targetCount);
  if (targetRate !== rate) {
    list = list.map((channel) =>
      resampleChannelData(channel, rate, targetRate),
    );
    rate = targetRate;
  }
  const gain = Math.pow(10, (parseFloat(volumeBoost) || 0) / 20);
  list = applyGainToChannels(list, gain);
  if (trim) list = trimSilenceFromChannels(list, 0.01);
  if (normalize) list = normalizeChannelsToPeak(list, 0.95);
  return { channels: list, sampleRate: rate };
}

export function convertAudioBufferToWav({
  audioBuffer,
  sampleRate,
  channels,
  volumeBoost,
  normalize,
  trim,
}) {
  const processed = convertAudioSamples({
    audioBuffer,
    sampleRate,
    channels,
    volumeBoost,
    normalize,
    trim,
  });
  const wavBytes = audioBufferToWav(
    wrapChannelsAsBuffer(processed.channels, processed.sampleRate),
  );
  return new Blob([wavBytes], { type: "audio/wav" });
}

let ffmpegModuleInstance = null;
let ffmpegModulePromise = null;

export async function ensureFFmpegWasm() {
  if (ffmpegModuleInstance) return ffmpegModuleInstance;
  if (ffmpegModulePromise) return ffmpegModulePromise;
  ffmpegModulePromise = (async () => {
    const { createFFmpeg } =
      await import("https://fastly.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js");
    const ffmpeg = createFFmpeg({
      log: false,
      corePath:
        "https://fastly.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js",
    });
    await ffmpeg.load();
    ffmpegModuleInstance = ffmpeg;
    return ffmpeg;
  })();
  return ffmpegModulePromise;
}

export function getFfmpegMimeType(format) {
  const mimeMap = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    m4a: "audio/mp4",
    aac: "audio/aac",
    opus: "audio/opus",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    gif: "image/gif",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    tiff: "image/tiff",
    bmp: "image/bmp",
  };
  return mimeMap[String(format).toLowerCase()] || "application/octet-stream";
}

async function toByteArray(inputData) {
  if (inputData instanceof Blob)
    return new Uint8Array(await inputData.arrayBuffer());
  return inputData;
}

function unlinkQuiet(ffmpeg, name) {
  try {
    ffmpeg.FS("unlink", name);
  } catch (err) {
    return;
  }
}

export async function ffmpegConvert(
  inputData,
  inputExt,
  outputExt,
  extraArgs = [],
  runner = null,
) {
  const data = await toByteArray(inputData);
  if (runner) return runner(data, inputExt, outputExt, extraArgs);
  const ffmpeg = await ensureFFmpegWasm();
  const inputName = `input.${inputExt}`;
  const outputName = `output.${outputExt}`;
  unlinkQuiet(ffmpeg, inputName);
  unlinkQuiet(ffmpeg, outputName);
  ffmpeg.FS("writeFile", inputName, data);
  await ffmpeg.run("-i", inputName, ...extraArgs, outputName);
  const outData = ffmpeg.FS("readFile", outputName);
  unlinkQuiet(ffmpeg, inputName);
  unlinkQuiet(ffmpeg, outputName);
  return new Blob([outData.buffer], { type: getFfmpegMimeType(outputExt) });
}

export async function convertAudioFormat(
  blob,
  targetFormat,
  bitrate,
  runner = null,
) {
  if (targetFormat === "wav") return blob;
  const bitrateArg = bitrate ? [`-b:a`, `${Math.round(bitrate / 1000)}k`] : [];
  return ffmpegConvert(blob, "wav", targetFormat, bitrateArg, runner);
}

export async function convertAudioBuffer({
  audioBuffer = null,
  targetFormat,
  sampleRate,
  channels,
  bitrate,
  volumeBoost = 0,
  normalize = false,
  trim = false,
  ffmpegRunner = null,
}) {
  if (!audioBuffer) throw new Error("Audio not fully loaded.");
  const wavBlob = convertAudioBufferToWav({
    audioBuffer,
    sampleRate,
    channels,
    volumeBoost,
    normalize,
    trim,
  });
  if (String(targetFormat).toLowerCase() === "wav") return wavBlob;
  return convertAudioFormat(wavBlob, targetFormat, bitrate, ffmpegRunner);
}

export function getVideoMimeType(format, codec) {
  const codecMap = {
    h264: "avc1.42E01E",
    vp9: "vp09.00.10.08",
    av1: "av01.0.01M.08",
  };
  const codecStr = codecMap[codec] || codec;
  if (format === "mp4") return `video/mp4; codecs="${codecStr}"`;
  if (format === "webm") return `video/webm; codecs="${codecStr}"`;
  if (format === "mov") return `video/quicktime`;
  if (format === "avi") return `video/x-msvideo`;
  if (format === "mkv") return `video/x-matroska`;
  return `video/${format}`;
}

export function buildVideoConvertArgs({
  targetFormat,
  resolution = "original",
  fps = "original",
  bitrate = 0,
  codec = "h264",
  audioCodec = "aac",
  mute = false,
}) {
  const args = [];
  if (resolution !== "original") {
    args.push("-vf", `scale=${resolution}`);
  }
  if (fps !== "original") {
    args.push("-r", fps);
  }
  if (bitrate > 0) {
    args.push("-b:v", `${bitrate}`);
  }
  if (mute || audioCodec === "none") {
    args.push("-an");
  } else {
    args.push("-c:a", "aac", "-b:a", "128k");
  }
  let outputExt = targetFormat;
  switch (codec) {
    case "h264_nvenc":
    case "h264_amf":
      args.push("-c:v", "libx264");
      break;
    case "h264":
      args.push("-c:v", "libx264");
      break;
    case "vp9":
      args.push("-c:v", "libvpx-vp9");
      outputExt = "webm";
      break;
    case "hevc":
      args.push("-c:v", "libx265");
      outputExt = "mp4";
      break;
    default:
      args.push("-c:v", "libx264");
  }
  return { args, outputExt };
}

export async function convertVideoBlob({
  blob,
  sourceExt,
  targetFormat,
  options = {},
  ffmpegRunner = null,
}) {
  if (!blob) throw new Error("Video source not available.");
  const built = buildVideoConvertArgs({ targetFormat, ...options });
  return ffmpegConvert(
    blob,
    sourceExt,
    built.outputExt,
    built.args,
    ffmpegRunner,
  );
}

export async function convertFileBlob({
  blob = null,
  text = null,
  sourceExt,
  targetFormat,
  options = {},
}) {
  const source = String(sourceExt).toLowerCase();
  const target = String(targetFormat).toLowerCase();
  const category = detectCategory(source);
  if (!category) throw new Error(`Unsupported file extension: .${source}`);
  if (category === "image") {
    const outputBlob = await convertImageBlob({
      blob,
      image: options.imageSource || null,
      targetFormat: target,
      options,
    });
    return { blob: outputBlob, text: null };
  }
  if (category === "text") {
    const outputText = convertTextContent({
      sourceExt: source,
      targetFormat: target,
      text: text || "",
      cleanup: options.cleanup || false,
    });
    return { blob: null, text: outputText };
  }
  if (category === "structured") {
    const outputText = convertStructuredContent({
      sourceExt: source,
      targetFormat: target,
      text: text || "",
      pretty: options.pretty !== false,
      flatten: options.flatten || false,
    });
    return { blob: null, text: outputText };
  }
  if (category === "audio") {
    const outputBlob = await convertAudioBuffer({
      audioBuffer: options.audioBuffer || null,
      targetFormat: target,
      sampleRate: options.sampleRate,
      channels: options.channels,
      bitrate: options.bitrate,
      volumeBoost: options.volumeBoost || 0,
      normalize: options.normalize || false,
      trim: options.trim || false,
      ffmpegRunner: options.ffmpegRunner || null,
    });
    return { blob: outputBlob, text: null };
  }
  const outputBlob = await convertVideoBlob({
    blob,
    sourceExt: source,
    targetFormat: target,
    options,
    ffmpegRunner: options.ffmpegRunner || null,
  });
  return { blob: outputBlob, text: null };
}
