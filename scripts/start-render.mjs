import { execSync, spawn, spawnSync } from "node:child_process";
import net from "node:net";

const port = Number(process.env.PORT ?? "3000");
const env = { ...process.env, PORT: String(port) };

async function isPortInUse(portNumber) {
  return await new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close(() => resolve(false));
    });

    server.listen(portNumber, "0.0.0.0");
  });
}

function clearPortIfNeeded(portNumber) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr :${portNumber}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });

      const pidMatches = [...output.matchAll(/LISTENING\s+(\d+)/g)];
      for (const match of pidMatches) {
        const pid = Number(match[1]);
        if (Number.isFinite(pid)) {
          try {
            execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
            console.warn(`[start-render] Cleared stale process ${pid} from port ${portNumber}.`);
          } catch {}
        }
      }
      return;
    }

    const commands = [
      `fuser -k ${portNumber}/tcp 2>/dev/null || true`,
      `lsof -ti tcp:${portNumber} | xargs -r kill -9 2>/dev/null || true`,
      `ss -ltnp '( sport = :${portNumber} )' 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | xargs -r kill -9 2>/dev/null || true`,
    ];

    for (const command of commands) {
      try {
        execSync(command, { stdio: "ignore" });
      } catch {}
    }
  } catch {}
}

async function main() {
  const portTaken = await isPortInUse(port);

  if (portTaken) {
    console.warn(`[start-render] Port ${port} is already in use. Clearing stale listener before startup...`);
    clearPortIfNeeded(port);
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
}

main();
