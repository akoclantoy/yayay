import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const port = Number(process.env.PORT ?? "3000");
const env = { ...process.env, PORT: String(port) };

export function assertRenderRuntimeConfig(currentEnv = process.env) {
  const isProductionRuntime =
    currentEnv.RENDER === "true" || currentEnv.NODE_ENV === "production";

  if (!isProductionRuntime) {
    return;
  }

  const databaseUrl = currentEnv.DATABASE_URL ?? currentEnv.DIRECT_URL;
  if (
    !databaseUrl ||
    /user:password@localhost|mysql:\/\/root:password@localhost|railway\.internal/i.test(databaseUrl)
  ) {
    throw new Error(
      "[start-render] Missing or invalid DATABASE_URL for Render. Set a reachable database URL in Render > Environment."
    );
  }

  const authSecret = currentEnv.AUTH_SECRET ?? currentEnv.NEXTAUTH_SECRET;
  if (!authSecret) {
    throw new Error(
      "[start-render] Missing AUTH_SECRET or NEXTAUTH_SECRET. Set one in Render > Environment before deployment."
    );
  }

  const appUrl =
    currentEnv.NEXTAUTH_URL ??
    currentEnv.AUTH_URL ??
    currentEnv.RENDER_EXTERNAL_URL ??
    currentEnv.RENDER_URL;

  if (!appUrl) {
    throw new Error(
      "[start-render] Missing NEXTAUTH_URL / AUTH_URL / RENDER_EXTERNAL_URL. Add the public app URL in Render > Environment."
    );
  }
}

async function main() {
  try {
    assertRenderRuntimeConfig(env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const setup = spawnSync(process.execPath, ["scripts/setup-db.mjs"], {
    stdio: "inherit",
    env,
  });

  if (setup.status !== 0) {
    console.warn(
      `[start-render] Database setup exited with status ${setup.status}. Continuing startup so the app can still bind to port ${port}.`
    );
  }

  const next = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", String(port)],
    {
      stdio: "inherit",
      env,
    }
  );

  next.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  next.on("error", (error) => {
    console.error("Failed to start Next.js server:", error);
    process.exit(1);
  });
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main();
}
