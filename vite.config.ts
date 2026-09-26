import { defineConfig } from "vite";

export default defineConfig({
  build: {rollupOptions: {input: {main:"index.html",check:"connection-check.html"}}},
  server: {
    port: 5173,
    proxy: { "/api": {target:process.env.MATCH_SERVER_URL || "http://127.0.0.1:3001",ws:true}, "/health": process.env.MATCH_SERVER_URL || "http://127.0.0.1:3001" },
  },
});
