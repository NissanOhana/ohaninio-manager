import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../dist/web",
    emptyDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:4201",
      "/ws": { target: "ws://localhost:4201", ws: true },
    },
  },
});
