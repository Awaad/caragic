import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import glsl from "vite-plugin-glsl";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY_TARGET ?? "http://localhost:8000";

  return {
    plugins: [
      react(),
      glsl({
        include: ["**/*.glsl", "**/*.vert", "**/*.frag"],
        defaultExtension: "glsl",
      }),
    ],
    appType: "spa",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: ["card-dev.gedoawad.com"],
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
        },
        "/tap": { target: apiTarget, changeOrigin: true },
        "/c": { target: apiTarget, changeOrigin: true },
      },
    },
  };
});