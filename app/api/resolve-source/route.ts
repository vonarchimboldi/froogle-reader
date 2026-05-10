import { apiJson, handleOptions, unauthorized } from "@/lib/api-response";
import { getAuthUser } from "@/lib/auth";
import { resolveSourceFromDescription } from "@/lib/source-resolver";

export { handleOptions as OPTIONS };

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const description = typeof body.description === "string" ? body.description : "";
    const result = await resolveSourceFromDescription(description);
    return apiJson(result);
  } catch (error) {
    return apiJson(
      { error: error instanceof Error ? error.message : "Could not find a source for this writer." },
      { status: 400 }
    );
  }
}
