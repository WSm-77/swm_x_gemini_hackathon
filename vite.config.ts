import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";

const scribeServiceUrl = process.env.VITE_SCRIBE_SERVICE_URL ?? "http://localhost:8787";
const factCheckerServiceUrl = process.env.VITE_FACT_CHECKER_SERVICE_URL ?? "http://localhost:8788";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
    port: 5170,
    proxy: {
      "/health": {
        target: scribeServiceUrl,
        changeOrigin: true,
      },
      "/sessions": {
        target: scribeServiceUrl,
        changeOrigin: true,
      },
      "/ws/notes": {
        target: scribeServiceUrl,
        changeOrigin: true,
        ws: true,
      },
      "/ws/fact-check": {
        target: factCheckerServiceUrl,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@types": path.resolve(__dirname, "./src/types"),
    },
  },
});
