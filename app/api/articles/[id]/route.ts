import { apiJson, handleOptions, unauthorized } from "@/lib/api-response";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export { handleOptions as OPTIONS };

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const data: { isRead?: boolean; isFavorite?: boolean; isBookmarked?: boolean } = {};

    if (typeof body.isRead === "boolean") data.isRead = body.isRead;
    if (typeof body.isFavorite === "boolean") data.isFavorite = body.isFavorite;
    if (typeof body.isBookmarked === "boolean") data.isBookmarked = body.isBookmarked;

    if (Object.keys(data).length === 0) {
      return apiJson({ error: "No article fields to update." }, { status: 400 });
    }

    const article = await prisma.article.findFirst({
      where: { id: params.id, writer: { userId: user.id } }
    });

    if (!article) return apiJson({ error: "Article not found." }, { status: 404 });

    const updatedArticle = await prisma.article.update({
      where: { id: article.id },
      data
    });
    return apiJson(updatedArticle);
  } catch {
    return apiJson({ error: "Article not found." }, { status: 404 });
  }
}
