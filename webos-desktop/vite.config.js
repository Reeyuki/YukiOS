import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const commitHash = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
})();

const readmeContent = readFileSync(resolve(process.cwd(), "../README.md"), "utf-8");

const isDevBuild = process.env.VITE_DEV_BUILD === "true";

export default defineConfig({
  base: "./",
  plugins: [viteSingleFile(), nodePolyfills()],
  define: {
    __GIT_COMMIT__: JSON.stringify(commitHash),
    __README_CONTENT__: JSON.stringify(readmeContent)
  },
  build: {
    target: "esnext",
    minify: !isDevBuild,
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      treeshake: !isDevBuild,
      external: ["three", /^three\/.*/],
      output: {
        inlineDynamicImports: true,
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
        manualChunks: undefined
      }
    }
  },
  esbuild: {
    minify: !isDevBuild,
    legalComments: "inline"
  }
});
