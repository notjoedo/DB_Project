import { requireUser } from "@/lib/auth";
import { reportsFor } from "@/lib/reports";

/** The statistical reports this user's roles allow. */
export async function GET(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  try {
    return Response.json({ groups: await reportsFor(user) });
  } catch (error) {
    console.error("Reports:", error);
    return Response.json({ error: "Could not load reports." }, { status: 503 });
  }
}
