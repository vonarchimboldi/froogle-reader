import { apiJson, handleOptions, unauthorized } from "@/lib/api-response";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export { handleOptions as OPTIONS };

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const writerId = searchParams.get("writerId");
  const filter = searchParams.get("filter");

  const articles = await prisma.article.findMany({
    where: {
      ...(filter === "favorites" ? { isFavorite: true } : {}),
      ...(filter === "bookmarks" ? { isBookmarked: true } : {}),
      writer: {
        userId: user.id,
        ...(writerId ? { id: writerId } : {})
      }
    },
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
