import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ajodesk_session";
const PUBLIC_PATHS = ["/login", "/register"];
/** Always reachable: clears a rejected session cookie. */
const SESSION_RESET_PATH = "/session/expired";

/**
 * Optimistic redirect only: real authorization happens in the API on every call.
 * Signed-out visitors go to /login; a visitor with a session cookie skips /login. /register
 * stays reachable either way, because the proxy can't tell a valid cookie from a stale one.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === SESSION_RESET_PATH) return NextResponse.next();
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!hasSession && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (hasSession && pathname === "/login" && !request.nextUrl.searchParams.has("expired")) {
    return NextResponse.redirect(new URL("/contributors", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|ico)$).*)"],
};
