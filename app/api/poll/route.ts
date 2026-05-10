import { apiJson, handleOptions, unauthorized } from "@/lib/api-response";
import { getAuthUser } from "@/lib/auth";
import { pollWriterSources } from "@/lib/poll";

export { handleOptions as OPTIONS };

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const summary = await pollWriterSources(user.id);
    return apiJson(summary);
  } catch (error) {
    return apiJson(
      { error: error instanceof Error ? error.message : "Could not check sources." },
      { status: 500 }
    );
  }
}
