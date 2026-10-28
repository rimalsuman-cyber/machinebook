import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ mode }) => {
  const base = loadEnv(mode, process.cwd(), "").VITE_BASE_PATH || "/";
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        includeAssets: [
          "icon.svg",
          "icon-192.png",
          "icon-512.png",
          "apple-touch-icon.png",
        ],
        manifest: {
          name: "MachineBook Pro",
          short_name: "MachineBook",
          description: "Your industrial machine handbook",
          lang: "de",
          start_url: base,
          scope: base,
          display: "standalone",
          theme_color: "#102735",
          background_color: "#f3f6f8",
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png" },
            {
              src: "icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
          navigateFallback: "index.html",
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  };
});
