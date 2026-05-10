import { apiJson, handleOptions } from "@/lib/api-response";
import { pollWriterSources } from "@/lib/poll";

export { handleOptions as OPTIONS };

export async function POST() {
  try {
    const summary = await pollWriterSources();
    return apiJson(summary);
  } catch (error) {
    return apiJson(
      { error: error instanceof Error ? error.message : "Could not check sources." },
      { status: 500 }
    );
  }
}
