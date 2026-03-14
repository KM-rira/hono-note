import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    base: "/",
    server: {
        open: "/",
        proxy: {
            "/hono-note/backend": {
                target: "http://localhost:9010",
                changeOrigin: true,
            },
        },
    },
});
