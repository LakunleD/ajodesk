import { redirect } from "next/navigation";
import { clearSession } from "@/lib/session";

/**
 * The API rejected the session (expired token, or a collector that no longer exists, e.g.
 * after switching databases). Pages can't delete cookies while rendering, so they redirect
 * here; clearing it stops the app from bouncing between /login and protected pages.
 * Uses redirect() for a relative Location: request.url inside the container is 0.0.0.0.
 */
export async function GET() {
  await clearSession();
  redirect("/login?expired=1");
}
