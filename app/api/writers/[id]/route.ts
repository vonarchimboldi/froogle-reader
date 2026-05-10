import { apiJson, handleOptions } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export { handleOptions as OPTIONS };

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.writer.delete({ where: { id: params.id } });
    return apiJson({ ok: true });
  } catch {
    return apiJson({ error: "Writer not found." }, { status: 404 });
  }
}
