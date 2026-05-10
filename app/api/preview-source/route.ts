import { NextResponse } from "next/server";
import { discoverSource } from "@/lib/discovery";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url : "";
    const result = await discoverSource(url);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not preview this source." },
      { status: 400 }
    );
  }
}
