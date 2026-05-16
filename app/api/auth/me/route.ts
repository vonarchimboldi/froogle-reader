import { apiJson, handleOptions, unauthorized } from "@/lib/api-response";
import { getAuthUser, isAdminEmail } from "@/lib/auth";

export { handleOptions as OPTIONS };

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  return apiJson({ user: { ...user, isAdmin: isAdminEmail(user.email) } });
}
