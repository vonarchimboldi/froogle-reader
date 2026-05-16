import { apiJson, handleOptions } from "@/lib/api-response";
import { createSession, isAdminEmail, normalizeEmail, sessionCookie, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export { handleOptions as OPTIONS };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const password = typeof body.password === "string" ? body.password : "";

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true }
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return apiJson({ error: "Invalid email or password." }, { status: 401 });
  }

  const session = await createSession(user.id);

  return apiJson(
    { user: { id: user.id, email: user.email, isAdmin: isAdminEmail(user.email) }, token: session.token },
    { headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } }
  );
}
