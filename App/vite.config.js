import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      include: "**/*.{js,jsx,ts,tsx}",
    }),
  ],
  server: {
    port: 10003,
    strictPort: true,
  },
  preview: {
    port: 10003,
    strictPort: true,
  },
});
