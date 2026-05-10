import { existsSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";

const apiDir = "app/api";
const disabledApiDir = "app/_api.capacitor-build";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      CAPACITOR_BUILD: "1"
    }
  });

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

if (existsSync(disabledApiDir)) {
  throw new Error(`${disabledApiDir} already exists. Restore or remove it before building mobile assets.`);
}

let movedApi = false;

try {
  if (existsSync(apiDir)) {
    renameSync(apiDir, disabledApiDir);
    movedApi = true;
  }

  run("npx", ["prisma", "generate"]);
  run("npx", ["next", "build"]);
} finally {
  if (movedApi) {
    renameSync(disabledApiDir, apiDir);
  }
}
