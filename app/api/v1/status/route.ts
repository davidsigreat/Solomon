import { getApiAuth, apiAuthError } from "@/lib/apiAuth";
import { getPortfolioStatus } from "@/lib/solomonPublic";

export const dynamic = "force-dynamic";

/** Cross-project status for every project the API key can access. */
export async function GET(req: Request) {
  let auth;
  try {
    auth = await getApiAuth(req);
  } catch {
    return apiAuthError({ ok: false, status: 401 });
  }
  if (!auth.ok) return apiAuthError(auth);

  const payload = await getPortfolioStatus(auth);
  return Response.json(payload);
}
