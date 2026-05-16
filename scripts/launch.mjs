import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const isMac = process.platform === "darwin";
const nodeBin = process.execPath;
const appUrl = "http://127.0.0.1:3000";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? "inherit",
      shell: false,
      ...options
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
    child.on("error", reject);
  });
}

function waitForPort(port, host = "127.0.0.1", timeoutMs = 20000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, host);
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
        } else {
          setTimeout(attempt, 350);
        }
      });
    };
    attempt();
  });
}

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect(port, host);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function openApp() {
  if (isMac) {
    spawn("open", [appUrl], { stdio: "ignore", detached: true }).unref();
  }
}

async function main() {
  if (await isPortOpen(3000)) {
    console.log(`Froogle Reader is already running at ${appUrl}`);
    openApp();
    return;
  }

  let db;
  if (await isPortOpen(5432)) {
    console.log("PostgreSQL is already running on localhost:5432");
  } else {
    console.log("Starting embedded PostgreSQL...");
    db = spawn(nodeBin, ["scripts/embedded-db.mjs"], {
      stdio: "inherit",
      shell: false
    });
  }

  const stopDb = () => {
    if (db && !db.killed) db.kill("SIGTERM");
  };

  process.on("SIGINT", () => {
    stopDb();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    stopDb();
    process.exit(0);
  });

  await waitForPort(5432);
  console.log("Applying database migrations...");
  await run(nodeBin, ["node_modules/.bin/prisma", "migrate", "deploy"]);

  openApp();

  console.log(`Starting Froogle Reader at ${appUrl}`);
  await run(nodeBin, ["node_modules/.bin/next", "dev", "-H", "127.0.0.1", "-p", "3000"]);
  stopDb();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
