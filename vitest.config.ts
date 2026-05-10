import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/firebase.ts", "src/lib/cloudRepository.ts", "src/lib/storageRepository.ts"],
    },
  },
});
