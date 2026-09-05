import { getApiAuth, apiAuthError, toJsonResponse } from "@/lib/apiAuth";
import { listPublicTasks, upsertPublicTask } from "@/lib/solomonPublic";

export async function GET(req: Request) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { searchParams } = new URL(req.url);
  return toJsonResponse(
    await listPublicTasks(auth, {
      projectId: searchParams.get("projectId"),
      status: searchParams.get("status"),
    }),
  );
}

export async function POST(req: Request) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const body = await req.json();
  return toJsonResponse(await upsertPublicTask(auth, body));
}
