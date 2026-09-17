import { env } from "cloudflare:workers";
export function database() {
  if (!env.DB)
    throw new Error("Database is unavailable. Please try again later.");
  return env.DB;
}
export function fail(error: unknown) {
  console.error("Treefinder:", error);
  return Response.json(
    {
      error:
        "We could not connect to the community database. Your input has been kept; please try again.",
    },
    { status: 503 },
  );
}
