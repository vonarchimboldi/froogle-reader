import { apiJson, handleOptions, unauthorized } from "@/lib/api-response";
import { getAuthUser } from "@/lib/auth";
import { SourceType } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { discoverSource } from "@/lib/discovery";
import { prisma } from "@/lib/prisma";
import { saveWriterWithArticles } from "@/lib/persistence";

export { handleOptions as OPTIONS };

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  await replaceAtlanticCompleteFeed(user.id);

  const writers = await prisma.writer.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { articles: true } } }
  });

  return apiJson(writers);
}

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url : "";
    const discovery = await discoverSource(url);
    const writer = await saveWriterWithArticles(user.id, discovery);
    return apiJson(writer, { status: 201 });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      return apiJson({ error: "This writer source has already been saved." }, { status: 409 });
    }

    return apiJson(
      { error: error instanceof Error ? error.message : "Could not save this writer." },
      { status: 400 }
    );
  }
}

async function replaceAtlanticCompleteFeed(userId: string) {
  const atlanticWriters = await prisma.writer.findMany({
    where: {
      userId,
      OR: [
        { sourceUrl: "https://www.theatlantic.com/feed/all" },
        { sourceUrl: "https://www.theatlantic.com/feed/all/" }
      ]
    },
    select: { id: true }
  });

  if (atlanticWriters.length === 0) return;

  const derekWriter = await prisma.writer.findFirst({
    where: {
      userId,
      OR: [
        { sourceUrl: "https://www.derekthompson.org/feed" },
        { sourceUrl: "https://www.derekthompson.org/feed/" }
      ]
    },
    select: { id: true }
  });

  const atlanticIds = atlanticWriters.map((writer) => writer.id);
  await prisma.article.deleteMany({ where: { writerId: { in: atlanticIds } } });

  if (derekWriter) {
    await prisma.writer.deleteMany({ where: { id: { in: atlanticIds } } });
    return;
  }

  const [primaryAtlanticWriter, ...duplicateAtlanticWriters] = atlanticIds;
  if (duplicateAtlanticWriters.length) {
    await prisma.writer.deleteMany({ where: { id: { in: duplicateAtlanticWriters } } });
  }

  await prisma.writer.update({
    where: { id: primaryAtlanticWriter },
    data: {
      name: "Derek Thompson",
      publication: "A newsletter about abundance and building a better world.",
      sourceUrl: "https://www.derekthompson.org/feed",
      sourceType: SourceType.RSS,
      lastCheckedAt: null
    }
  });
}
