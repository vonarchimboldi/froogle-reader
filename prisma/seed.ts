import { PrismaClient, SourceType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const writer = await prisma.writer.upsert({
    where: { sourceUrl: "https://example.com/demo-writer.xml" },
    update: {},
    create: {
      name: "Demo Writer",
      publication: "Example Daily",
      sourceUrl: "https://example.com/demo-writer.xml",
      sourceType: SourceType.RSS,
      lastCheckedAt: new Date()
    }
  });

  await prisma.article.upsert({
    where: { canonicalUrl: "https://example.com/demo/first-brief" },
    update: {},
    create: {
      writerId: writer.id,
      title: "A short demo brief for the reader",
      url: "https://example.com/demo/first-brief",
      canonicalUrl: "https://example.com/demo/first-brief",
      summary: "Seed data so the interface has something to show before connecting a live source.",
      publishedAt: new Date(),
      rawData: { source: "seed" }
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
