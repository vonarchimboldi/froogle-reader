import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { apiJson, handleOptions } from "@/lib/api-response";
import { createSession, hashPassword, normalizeEmail, sessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export { handleOptions as OPTIONS };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const password = typeof body.password === "string" ? body.password : "";

  if (!email.includes("@")) {
    return apiJson({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (password.length < 8) {
    return apiJson({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(password)
      },
      select: { id: true, email: true }
    });
    const session = await createSession(user.id);

    return apiJson(
      { user, token: session.token },
      { status: 201, headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } }
    );
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      return apiJson({ error: "An account with this email already exists." }, { status: 409 });
    }

    return apiJson({ error: "Could not create account." }, { status: 500 });
  }
}
