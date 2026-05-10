import EmbeddedPostgres from "embedded-postgres";

const pg = new EmbeddedPostgres({
  databaseDir: "./.embedded-postgres",
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
  onLog: (message) => process.stdout.write(String(message)),
  onError: (message) => process.stderr.write(String(message))
});

async function main() {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("writer_reader").catch((error) => {
    if (!String(error?.message ?? error).includes("already exists")) {
      throw error;
    }
  });

  console.log("\nEmbedded PostgreSQL is running on localhost:5432");
  console.log("Press Ctrl+C to stop it.");
}

async function shutdown() {
  await pg.stop().catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch(async (error) => {
  console.error(error);
  await pg.stop().catch(() => undefined);
  process.exit(1);
});
