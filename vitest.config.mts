/// <reference types="vitest/config" />
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
