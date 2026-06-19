import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~encore/auth": path.resolve(__dirname, "encore.gen/auth/index.ts"),
      "~encore/clients": path.resolve(__dirname, "encore.gen/clients/index.js"),
    },
  },
});
