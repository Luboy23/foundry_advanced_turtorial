import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
});
