import { apiJson, handleOptions } from "@/lib/api-response";
import { discoverSource } from "@/lib/discovery";

export { handleOptions as OPTIONS };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url : "";
    const result = await discoverSource(url);
    return apiJson(result);
  } catch (error) {
    return apiJson(
      { error: error instanceof Error ? error.message : "Could not preview this source." },
      { status: 400 }
    );
  }
}
