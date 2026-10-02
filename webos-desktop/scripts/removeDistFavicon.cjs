// Removes dist/favicon.ico before packaging with electron-builder.
const fs = require("node:fs");
const path = require("node:path");

const target = path.join(__dirname, "..", "dist", "favicon.ico");

if (fs.existsSync(target)) {
  fs.unlinkSync(target);
  console.log("Removed dist/favicon.ico");
}
