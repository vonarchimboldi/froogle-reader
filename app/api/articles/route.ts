import { apiJson, handleOptions } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export { handleOptions as OPTIONS };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const writerId = searchParams.get("writerId");

  const articles = await prisma.article.findMany({
    where: writerId ? { writerId } : undefined,
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { discoveredAt: "desc" }],
    include: {
      writer: {
        select: {
          id: true,
          name: true,
          publication: true
        }
      }
    },
    take: 200
  });

  return apiJson(articles);
}
