import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
    plugins: [react()],
    base: mode === "production" ? "/hono-note/frontend/" : "/",
    server: {
        open: "/",
        proxy: {
            "/hono-note/backend": {
                target: "http://localhost:9010",
                changeOrigin: true,
            },
        },
    },
}));
