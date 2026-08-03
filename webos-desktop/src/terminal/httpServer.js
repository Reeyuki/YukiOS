import { os, brand } from "../framework.js";
import {
  buildDirectoryHtml,
  getMimeType,
  isDirEntry,
  isTextContentType,
  joinPath,
  readOsTheme,
  splitPath
} from "../shared/virtualFsNet.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function serveVirtualDirectory(fs, urlPath, fsPath, baseUrl, theme) {
  const entries = await fs.readdir(fsPath || "/");
  const relPath = urlPath === "/" ? "" : String(urlPath).replace(/^\/+|\/+$/g, "");
  const base = baseUrl + (relPath ? "/" + relPath + "/" : "/");
  const html = buildDirectoryHtml(relPath, entries, null, { theme, base });
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function serveVirtualFile(fs, dirSegments, name, pathStr) {
  const mime = getMimeType(name);
  const isMedia =
    mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/") || mime === "application/pdf";
  if (!isMedia && isTextContentType(mime)) {
    const text = await fs.read(pathStr);
    return new Response(text ?? "", { status: 200, headers: { "Content-Type": mime + "; charset=utf-8" } });
  }
  const dirStr = joinPath(dirSegments) || "/";
  let blob = await fs.readBinaryFile(dirStr, name);
  if (!blob) {
    const content = await fs.getFileContent(dirStr, name);
    blob = content instanceof Blob ? content : content != null ? new Blob([String(content)], { type: mime }) : null;
  }
  if (!blob) {
    return new Response("Could not read file: " + name, { status: 500, headers: { "Content-Type": "text/plain" } });
  }
  return new Response(blob, { status: 200, headers: { "Content-Type": mime } });
}

export function createVirtualFsHandler(fs, rootSegments, options = {}) {
  const theme = options.theme || readOsTheme();
  const baseUrl = options.baseUrl || "";
  return async (request) => {
    try {
      const url = new URL(request.url || "/", "http://localhost");
      const pathname = decodeURIComponent(url.pathname);
      const relSegments = splitPath(pathname);
      if (!relSegments.length) {
        const rootPath = joinPath(rootSegments) || "/";
        return serveVirtualDirectory(fs, "/", rootPath, baseUrl, theme);
      }
      const fullSegments = [...rootSegments, ...relSegments];
      const pathStr = joinPath(fullSegments);
      const dirSegments = fullSegments.slice(0, -1);
      const name = fullSegments[fullSegments.length - 1];
      const dirStr = joinPath(dirSegments) || "/";
      if (dirStr && !(await fs.exists(dirStr))) {
        return new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain" } });
      }
      const entries = await fs.readdir(dirStr);
      const entry = entries[name];
      if (!entry) {
        return new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain" } });
      }
      if (isDirEntry(entry)) {
        return serveVirtualDirectory(fs, pathname, pathStr, baseUrl, theme);
      }
      return serveVirtualFile(fs, dirSegments, name, pathStr);
    } catch (err) {
      return new Response("Internal Server Error: " + String(err?.message || err), {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
  };
}

export async function startVirtualHttpServer(ctx, options) {
  const port = Number(options.port) || 8000;
  const rootSegments = Array.isArray(options.rootSegments) ? options.rootSegments : [];
  if (os.ports.isRegistered(port)) {
    ctx.printError("python: http.server: address already in use: port " + port);
    return;
  }
  const rootPath = "/" + joinPath(rootSegments);
  const handler = createVirtualFsHandler(ctx.fs, rootSegments, {
    theme: readOsTheme(),
    baseUrl: "http://localhost:" + port
  });
  os.ports.register(port, handler, rootSegments);
  ctx.print("Serving HTTP on 0.0.0.0 port " + port + " (http://localhost:" + port + "/) ...");
  ctx.print("Serving directory " + rootPath);
  ctx.print(
    "Press Ctrl+C to stop the server. Open the " + brand("Yuki Browser") + " and go to http://localhost:" + port + "/"
  );
  while (!ctx.getStopRequested()) {
    await sleep(250);
  }
  os.ports.unregister(port);
  ctx.print("Serving HTTP on port " + port + " stopped.");
}
