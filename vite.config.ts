import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Standalone TanStack Start config — no Lovable wrapper.
//
// Deploy target: set the Nitro preset via env var on the host.
//   Vercel:      NITRO_PRESET=vercel        (set automatically by Vercel)
//   Cloudflare:  NITRO_PRESET=cloudflare-module
//   Node:        NITRO_PRESET=node-server
//   Netlify:     NITRO_PRESET=netlify
// In Vercel project settings, Vercel auto-detects and sets this; you usually
// don't need to add it manually.
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Override server entry so SSR errors render our custom error page.
      start: { entry: "./src/server.ts" },
    }),
    viteReact(),

  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
});
