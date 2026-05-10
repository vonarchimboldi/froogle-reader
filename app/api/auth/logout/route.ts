import { apiJson, handleOptions } from "@/lib/api-response";
import { clearSessionCookie, getRequestToken, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export { handleOptions as OPTIONS };

export async function POST(request: Request) {
  const token = getRequestToken(request);

  if (token) {
    await prisma.session.delete({ where: { tokenHash: hashToken(token) } }).catch(() => undefined);
  }

  return apiJson({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}
