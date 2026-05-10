import { NextResponse } from "next/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { discoverSource } from "@/lib/discovery";
import { prisma } from "@/lib/prisma";
import { saveWriterWithArticles } from "@/lib/persistence";

export async function GET() {
  const writers = await prisma.writer.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { articles: true } } }
  });

  return NextResponse.json(writers);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url : "";
    const discovery = await discoverSource(url);
    const writer = await saveWriterWithArticles(discovery);
    return NextResponse.json(writer, { status: 201 });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This writer source has already been saved." }, { status: 409 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save this writer." },
      { status: 400 }
    );
  }
}
