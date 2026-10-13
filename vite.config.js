import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/PennyLedger-merged/",
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: {
    env: { VITE_API_BASE_URL: "http://localhost/PennyLedger/public/index.php" },
    include: ["tests/**/*.test.{js,jsx}"],
    environment: "jsdom",
    setupFiles: "./tests/setup.js",
    css: false,
    restoreMocks: true,
  },
});
