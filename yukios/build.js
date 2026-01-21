const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const srcWeb = path.join(__dirname, "../webos-desktop/dist");
const srcStatic = path.join(__dirname, "../static");
const srcStaticResource = path.join(__dirname, "./resources/static");
const destResources = path.join(__dirname, "resources");

execSync("pnpm run build", { cwd: path.join(__dirname, "../webos-desktop"), stdio: "inherit" });

fs.cpSync(srcWeb, destResources, { recursive: true });

fs.mkdirSync(srcStaticResource, { recursive: true });
fs.readdirSync(srcStatic, { withFileTypes: true }).forEach((entry) => {
  const srcPath = path.join(srcStatic, entry.name);
  const destPath = path.join(srcStaticResource, entry.name);
  if (entry.isDirectory() && (entry.name === "gtavc/assets" || entry.name === "games")) return;
  fs.cpSync(srcPath, destPath, { recursive: true });
});

const assetsSrc = path.join(destResources, "assets");
const desktopDest = path.join(destResources, "desktop");
fs.mkdirSync(desktopDest, { recursive: true });
fs.readdirSync(assetsSrc).forEach((file) => {
  fs.renameSync(path.join(assetsSrc, file), path.join(desktopDest, file));
});
