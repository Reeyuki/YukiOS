const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const srcWeb = path.join(__dirname, "../webos-desktop/dist");
const srcStatic = path.join(__dirname, "../static");
const srcStaticResource = path.join(__dirname, "./resources/static");
const destResources = path.join(__dirname, "resources");

execSync("pnpm run build-win", {
  cwd: path.join(__dirname, "../webos-desktop"),
  stdio: "inherit"
});

fs.cpSync(srcWeb, destResources, { recursive: true });

fs.mkdirSync(srcStaticResource, { recursive: true });

fs.readdirSync(srcStatic, { withFileTypes: true }).forEach((entry) => {
  const srcPath = path.join(srcStatic, entry.name);
  const destPath = path.join(srcStaticResource, entry.name);

  if (entry.isDirectory() && entry.name === "games") return;

  if (entry.isDirectory() && entry.name === "gtavc") {
    fs.cpSync(srcPath, destPath, {
      recursive: true,
      filter: (src) => !src.includes(`${path.sep}gtavc${path.sep}assets`)
    });
    return;
  }

  fs.cpSync(srcPath, destPath, { recursive: true });
});


const assetsSrc = path.join(destResources, "assets");
const desktopDest = path.join(destResources, "desktop");
const indexHtmlSrc= path.join(srcWeb, "index.html");
const indexHtmlDest = path.join(destResources, "index.html");
fs.mkdirSync(desktopDest, { recursive: true });
fs.readdirSync(assetsSrc).forEach((file) => {
  fs.renameSync(path.join(assetsSrc, file), path.join(desktopDest, file));
});

fs.renameSync(path.join(indexHtmlSrc), path.join(indexHtmlDest))