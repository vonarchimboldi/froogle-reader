import { apiJson, handleOptions, unauthorized } from "@/lib/api-response";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export { handleOptions as OPTIONS };

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const writer = await prisma.writer.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true }
    });

    if (!writer) return apiJson({ error: "Writer not found." }, { status: 404 });

    await prisma.writer.delete({ where: { id: writer.id } });
    return apiJson({ ok: true });
  } catch {
    return apiJson({ error: "Writer not found." }, { status: 404 });
  }
}
