import { apiJson, handleOptions } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export { handleOptions as OPTIONS };

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return apiJson({ ok: true });
  } catch {
    return apiJson({ ok: false }, { status: 500 });
  }
}
