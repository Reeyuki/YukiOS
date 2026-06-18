import { defineConfig } from "vitest/config";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [nodePolyfills()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{js,ts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{js,ts}"]
    }
  },
  esbuild: {
    loader: "ts",
    include: /\.(ts|js)$/
  }
});
