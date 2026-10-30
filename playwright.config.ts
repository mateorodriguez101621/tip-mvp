import { defineConfig, devices } from "@playwright/test";

// Los tests de punta a punta corren en modo local (sin Supabase) contra un build de producción,
// así no crean usuarios en la base. El aislamiento entre usuarios se verifica aparte con
// scripts/verificar-rls.mjs.
const PUERTO = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PUERTO}`, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] }, grepInvert: /@celular/ },
    { name: "celular", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } }, grep: /@celular/ },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}/panel`,
    env: { TIP_MODO_LOCAL: "1" },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
