import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const webPort = Number(env.WEB_PORT ?? process.env.WEB_PORT ?? 5173);
  const apiUrl =
    env.API_URL?.trim() ||
    process.env.API_URL?.trim() ||
    `http://127.0.0.1:${env.API_PORT ?? process.env.API_PORT ?? 3001}`;

  return {
    plugins: [react()],
    server: {
      port: webPort,
      proxy: {
        "/api": apiUrl,
      },
    },
  };
});
