import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// The refresh token is an httpOnly cookie scoped to /api/v1/auth — the dev server
// proxies /api so the browser stays same-origin with the backend.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8001";

  return {
    plugins: [
      react(),
      // Installable app (home-screen icon, full screen). The service worker precaches only the built app shell;
      // /api is never cached (live gym data, per-login access). New builds wait for the user's "Reload".
      VitePWA({
        registerType: "prompt",
        includeAssets: ["favicon.ico", "apple-touch-icon.png"],
        manifest: {
          name: "Stag Fitness - Gym Management",
          short_name: "Stag Fitness",
          description: "Members, renewals, payments, staff and QR attendance for your gym.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "any",
          background_color: "#ffffff",
          theme_color: "#c93434",
          icons: [
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
        },
        
      }),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target, changeOrigin: true },
      },
    },
    // Phone testing of the built app through an HTTPS tunnel (VS Code ports / cloudflared / ngrok);
    // Vite blocks unknown hosts otherwise. The /api proxy above is reused by `vite preview`.
    preview: {
      allowedHosts: [".devtunnels.ms", ".trycloudflare.com", ".ngrok-free.app"],
    },
  };
});
