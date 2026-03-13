import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
    plugins: [react()],
    base: command === "serve" ? "/" : "/hono-note/frontend/",
    server: {
        open: "/",
        proxy: {
            "/hono-note": {
                target: "http://localhost:9010",
                changeOrigin: true,
            },
        },
    },
}));
