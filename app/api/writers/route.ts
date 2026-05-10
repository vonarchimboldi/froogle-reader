import { apiJson, handleOptions, unauthorized } from "@/lib/api-response";
import { getAuthUser } from "@/lib/auth";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { discoverSource } from "@/lib/discovery";
import { prisma } from "@/lib/prisma";
import { saveWriterWithArticles } from "@/lib/persistence";

export { handleOptions as OPTIONS };

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

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
