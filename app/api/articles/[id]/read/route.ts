import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const isRead = Boolean(body.isRead);
    const article = await prisma.article.update({
      where: { id: params.id },
      data: { isRead }
    });
    return NextResponse.json(article);
  } catch {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
}
