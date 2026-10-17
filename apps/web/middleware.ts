import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth-session";

// A quick first check: no session cookie means the sign-in page. Whether the cookie is
// still good is the API's call; the app layout sends an expired one to sign in as well.
export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sign-in|sign-up).*)"],
};
