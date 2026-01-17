import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/desktop/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      workbox: {
        navigateFallback: "/desktop/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
      },
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "Yuki OS",
        short_name: "Desktop",
        start_url: "/desktop/",
        display: "standalone",
        background_color: "#2e2e2e",
        theme_color: "#2e2e2e",
        icons: [
          {
            src: "/desktop/icons/icon-128.png",
            sizes: "128x128",
            type: "image/png"
          },
          {
            src: "/desktop/icons/icon-256.png",
            sizes: "256x256",
            type: "image/png"
          }
        ]
      }
    })
  ]
});
