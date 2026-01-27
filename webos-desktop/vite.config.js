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
    esbuildOptions: {
      minify: true,
      treeShaking: false
    }
  }
});
