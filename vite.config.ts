import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "prompt",
            includeAssets: ["icon.svg", "icon-192.png", "icon-512.png", "garden.jpg"],
            manifest: {
                name: "芸窗 · Ephemera",
                short_name: "芸窗",
                description: "把平凡的日子，写成值得珍藏的故事。",
                lang: "zh-CN",
                start_url: "/",
                display: "standalone",
                background_color: "#f7f7f0",
                theme_color: "#354e3f",
                icons: [
                    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
                    {
                        src: "/icon-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any maskable"
                    }
                ]
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,svg,png,jpg,woff2}"],
                navigateFallback: "index.html",
                maximumFileSizeToCacheInBytes: 4000000
            }
        })
    ],
    build: {
        modulePreload: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ["react", "react-dom", "react-dom/client"],
                    supabase: ["@supabase/supabase-js"],
                    icons: ["lucide-react"]
                }
            }
        }
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true }
});
