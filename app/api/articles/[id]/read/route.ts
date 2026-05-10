import { apiJson, handleOptions } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export { handleOptions as OPTIONS };

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const isRead = Boolean(body.isRead);
    const article = await prisma.article.update({
      where: { id: params.id },
      data: { isRead }
    });
    return apiJson(article);
  } catch {
    return apiJson({ error: "Article not found." }, { status: 404 });
  }
}
