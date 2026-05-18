import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    target: "es2020",
    rollupOptions: {
      input: {
        main:      resolve(__dirname, "index.html"),
        embed:     resolve(__dirname, "embed.html"),
        debug:     resolve(__dirname, "debug.html"),
        viewImage: resolve(__dirname, "view-image.html"),
      },
    },
  },
});
