import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { execSync } from "child_process";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const commitHash = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
})();

const isDevBuild = process.env.VITE_DEV_BUILD === "true";

export default defineConfig({
  base: "./",
  plugins: [viteSingleFile(), nodePolyfills()],
  define: {
    __GIT_COMMIT__: JSON.stringify(commitHash)
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
