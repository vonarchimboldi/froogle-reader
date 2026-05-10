import { prisma } from "../lib/prisma";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    throw new Error("Usage: npm run data:claim-all -- user@example.com");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true }
  });

  if (!user) {
    throw new Error(`No user found for ${email}. Sign up first, then run this script.`);
  }

  const totalWriters = await prisma.writer.count();
  const ownedWriters = await prisma.writer.count({
    where: { userId: user.id }
  });

  if (totalWriters === 0) {
    console.log("No writers found in this database.");
    return;
  }

  const result = await prisma.writer.updateMany({
    where: { userId: { not: user.id } },
    data: { userId: user.id }
  });

  console.log(
    `Database has ${totalWriters} writer(s). ${ownedWriters} already belonged to ${user.email}; moved ${result.count}.`
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
