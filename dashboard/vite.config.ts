import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev-only proxy: injects the API key server-side so the browser never
// holds it. In production nginx does the same (see nginx.conf.template).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL ?? "http://localhost:8000",
        changeOrigin: true,
        headers: { "X-API-Key": process.env.VITE_API_KEY ?? "dev-secret-key" },
      },
    },
  },
});
