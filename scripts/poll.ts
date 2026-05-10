import { prisma } from "../lib/prisma";
import { pollWriterSources } from "../lib/poll";

async function main() {
  const summary = await pollWriterSources();
  console.log(`Polling ${summary.checked} writer source${summary.checked === 1 ? "" : "s"}...`);

  for (const failure of summary.failures) {
    console.error(`FAILED ${failure.writerName} (${failure.sourceUrl}): ${failure.error}`);
  }

  console.log(
    `Done. Added ${summary.created} article${summary.created === 1 ? "" : "s"} with ${
      summary.failures.length
    } failure${summary.failures.length === 1 ? "" : "s"}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
