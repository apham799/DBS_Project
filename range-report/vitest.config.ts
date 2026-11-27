import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests use the same "@/..." imports as the app (tsconfig paths).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
