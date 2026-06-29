import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

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
      // Override the server entry so SSR errors render our custom error page.
      // NOTE: this MUST be `server.entry`, not `start.entry`. `start.entry` points
      // at the start-instance file (src/start.ts) that registers global function
      // middleware (attachSupabaseAuth); pointing it here drops the Authorization
      // header from every server-function call (e.g. getJoinContext on /welcome).
      server: { entry: "./src/server.ts" },
    }),
    nitro(),
    viteReact(),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
});
