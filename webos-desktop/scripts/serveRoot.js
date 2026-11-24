import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { dirname, extname, join, normalize, relative, sep } from "path";
import { fileURLToPath } from "url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const rootDir = join(currentDir, "..", "..");
const distDir = join(currentDir, "..", "dist");
const hostArgIndex = process.argv.findIndex((arg) => arg === "--host");
const hostName =
  process.env.HOST ||
  (hostArgIndex !== -1 ? process.argv[hostArgIndex + 1] : null) ||
  "0.0.0.0";
const rootPort = 4001;
const distPort = 4000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
  ".opus": "audio/ogg; codecs=opus",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".avif": "image/avif",
  ".heic": "image/heic",
  ".apng": "image/apng",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".cjs": "text/javascript; charset=utf-8",
  ".jsonld": "application/ld+json",
  ".webmanifest": "application/manifest+json",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
  ".ini": "text/plain; charset=utf-8",
  ".cfg": "text/plain; charset=utf-8",
  ".py": "text/x-python; charset=utf-8",
  ".pyc": "application/x-python-code",
  ".sh": "text/x-shellscript; charset=utf-8",
  ".bat": "text/plain; charset=utf-8",
  ".cmd": "text/plain; charset=utf-8",
  ".ps1": "text/plain; charset=utf-8",
  ".diff": "text/plain; charset=utf-8",
  ".patch": "text/plain; charset=utf-8",
  ".rtf": "application/rtf",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".epub": "application/epub+zip",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".br": "application/brotli",
  ".zst": "application/zstd",
  ".tar": "application/x-tar",
  ".7z": "application/x-7z-compressed",
  ".rar": "application/vnd.rar",
  ".jar": "application/java-archive",
  ".apk": "application/vnd.android.package-archive",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".dll": "application/vnd.microsoft.portable-executable",
  ".bin": "application/octet-stream",
  ".dat": "application/octet-stream",
  ".data": "application/octet-stream",
  ".img": "application/octet-stream",
  ".iso": "application/x-iso9660-image",
  ".wasm2": "application/wasm",
  ".exr": "image/x-exr",
  ".hdr": "image/vnd.radiance",
  ".ktx2": "image/ktx2",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".blend": "application/x-blender",
  ".obj": "text/plain; charset=utf-8",
  ".fbx": "application/octet-stream",
  ".stl": "application/sla",
  ".woff2.json": "application/json; charset=utf-8",
  ".part1": "application/octet-stream",
  ".part2": "application/octet-stream",
  ".part3": "application/octet-stream",
  ".example": "text/plain; charset=utf-8",
  ".jsdos": "application/json; charset=utf-8",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Access-Control-Allow-Methods":
    "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, Accept-Ranges",
  "Access-Control-Max-Age": "86400",
};

function resolveSafePath(baseDir, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const fullPath = join(baseDir, normalized);
  const relPath = relative(baseDir, fullPath);
  const outsideRoot = relPath.startsWith(`..${sep}`) || relPath === "..";
  if (outsideRoot) {
    return null;
  }
  return fullPath;
}

async function serveFile(filePath, response, method, request) {
  const content = await readFile(filePath);
  const mimeType =
    mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  const rangeHeader = request && request.headers ? request.headers.range : null;
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : content.length - 1;
      if (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start <= end &&
        start < content.length
      ) {
        const safeEnd = Math.min(end, content.length - 1);
        const chunk = content.subarray(start, safeEnd + 1);
        response.writeHead(206, {
          "Content-Type": mimeType,
          "Content-Length": chunk.length,
          "Content-Range": `bytes ${start}-${safeEnd}/${content.length}`,
          "Accept-Ranges": "bytes",
          ...corsHeaders,
        });
        response.end(method === "HEAD" ? undefined : chunk);
        return;
      }
    }
  }
  response.writeHead(200, {
    "Content-Type": mimeType,
    "Content-Length": content.length,
    "Accept-Ranges": "bytes",
    ...corsHeaders,
  });
  if (method === "HEAD") {
    response.end();
    return;
  }
  response.end(content);
}

function startStaticServer(baseDir, port) {
  const server = createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        response.writeHead(204, { ...corsHeaders });
        response.end();
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, {
          "Content-Type": "text/plain; charset=utf-8",
          ...corsHeaders,
        });
        response.end("Method Not Allowed");
        return;
      }
      let targetPath = resolveSafePath(baseDir, request.url || "/");
      if (!targetPath) {
        response.writeHead(403, {
          "Content-Type": "text/plain; charset=utf-8",
          ...corsHeaders,
        });
        response.end("Forbidden");
        return;
      }
      const fileInfo = await stat(targetPath).catch(() => null);
      if (fileInfo && fileInfo.isDirectory()) {
        targetPath = join(targetPath, "index.html");
      }
      await serveFile(targetPath, response, request.method, request);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        response.writeHead(404, {
          "Content-Type": "text/plain; charset=utf-8",
          ...corsHeaders,
        });
        response.end("Not Found");
        return;
      }
      response.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8",
        ...corsHeaders,
      });
      response.end("Internal Server Error");
    }
  });
  server.listen(port, hostName, () => {
    console.log(`Serving ${baseDir} at http://${hostName}:${port}`);
  });
  return server;
}

const serveTarget = process.argv[2] || "all";
if (serveTarget === "dist") {
  startStaticServer(distDir, distPort);
} else if (serveTarget === "root") {
  startStaticServer(rootDir, rootPort);
} else {
  startStaticServer(distDir, distPort);
  startStaticServer(rootDir, rootPort);
}
