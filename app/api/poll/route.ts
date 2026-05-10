import { NextResponse } from "next/server";
import { pollWriterSources } from "@/lib/poll";

export async function POST() {
  try {
    const summary = await pollWriterSources();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not check sources." },
      { status: 500 }
    );
  }
}
