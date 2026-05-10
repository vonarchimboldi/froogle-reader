import { prisma } from "../lib/prisma";

const LEGACY_USER_ID = "legacy-local-user";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    throw new Error("Usage: npm run data:claim-legacy -- user@example.com");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true }
  });

  if (!user) {
    throw new Error(`No user found for ${email}. Sign up first, then run this script.`);
  }

  if (user.id === LEGACY_USER_ID) {
    throw new Error("Refusing to move data to the legacy account.");
  }

  const legacyWriterCount = await prisma.writer.count({
    where: { userId: LEGACY_USER_ID }
  });

  if (legacyWriterCount === 0) {
    console.log("No legacy writers found. Nothing to move.");
    return;
  }

  const existingDestinationCount = await prisma.writer.count({
    where: { userId: user.id }
  });

  if (existingDestinationCount > 0) {
    throw new Error(
      `${user.email} already has ${existingDestinationCount} writer(s). Move or delete those before claiming legacy data.`
    );
  }

  const result = await prisma.writer.updateMany({
    where: { userId: LEGACY_USER_ID },
    data: { userId: user.id }
  });

  console.log(`Moved ${result.count} writer(s) and their articles to ${user.email}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
