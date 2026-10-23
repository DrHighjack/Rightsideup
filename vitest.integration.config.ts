import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/database.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
    server: { deps: { inline: ["next-auth"] } },
    env: {
      DATABASE_URL: "postgresql://integration:integration@127.0.0.1:1/rightsignup_integration",
      AUTH_SECRET: "disposable-integration-auth-secret-not-for-production",
      AUTH_TRUST_HOST: "true",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});