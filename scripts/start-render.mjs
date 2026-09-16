import { spawn, spawnSync } from "node:child_process";

const port = Number(process.env.PORT ?? "18012");
const env = { ...process.env, PORT: String(port) };

const setup = spawnSync(process.execPath, ["scripts/setup-db.mjs"], {
  stdio: "inherit",
  env,
});

if (setup.status !== 0) {
  console.warn(
    `[start-render] Database setup exited with status ${setup.status}. Continuing startup so the app can still bind to port ${port}.`
  );
}

const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  stdio: "inherit",
  env,
});

next.on("exit", (code) => {
  process.exit(code ?? 0);
});

next.on("error", (error) => {
  console.error("Failed to start Next.js server:", error);
  process.exit(1);
});
