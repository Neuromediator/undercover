import { defineConfig } from "@playwright/test";

// The tests change claims, so they run their own backend, database and dashboard.
const BACKEND = "http://127.0.0.1:8100";
const DASHBOARD = "http://localhost:5273";

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e/test-results",
  reporter: "list",
  use: { baseURL: DASHBOARD },
  webServer: [
    {
      command:
        "uv run -m backend.seed && uv run -m uvicorn backend.main:app --port 8100",
      env: { UNDERCOVER_DB: "e2e/e2e.db" },
      url: `${BACKEND}/api/health`,
      reuseExistingServer: false,
    },
    {
      command: "npx vite dashboard --port 5273 --strictPort",
      env: { API_URL: BACKEND },
      url: DASHBOARD,
      reuseExistingServer: false,
    },
  ],
});
