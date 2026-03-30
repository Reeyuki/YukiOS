import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "esnext",
    minify: true,
    sourcemap: false,
    cssCodeSplit: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      treeshake: false,
      external: ["three", /^three\/.*/],
      output: {
        manualChunks: undefined
      }
    }
  },
  esbuild: {
    minify: true,
    treeShaking: false,
    legalComments: "none"
  },
  optimizeDeps: {
    exclude: ["7z-wasm"],
    esbuildOptions: {
      minify: true,
      treeShaking: false
    }
  }
});
