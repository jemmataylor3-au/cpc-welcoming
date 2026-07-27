import { NextResponse, type NextRequest } from "next/server";

// Lightweight, Edge-Runtime-safe auth check.
//
// We deliberately do NOT import @supabase/ssr or @supabase/supabase-js
// here. Those packages pull in an optional realtime/websocket feature
// (unused by this app) that references Node.js-only globals (__dirname
// etc.) which crash when bundled into Next.js's Edge Runtime middleware —
// see https://github.com/supabase/supabase/issues/21009. Full Node.js
// runtime support for middleware only became stable in Next.js 15.5;
// this project is on 14.2.x, so that escape hatch isn't available here.
//
// Instead, middleware only checks whether a Supabase auth cookie is
// PRESENT, to decide whether to redirect to /login. This is an
// "optimistic" check, not a real validity check — a stale or tampered
// cookie would pass this check. Genuine session validation happens in
// Server Components via lib/supabase/server.ts, which runs in the normal
// Node.js server runtime (unaffected by this restriction), and all data
// access is additionally protected by Supabase Row Level Security
// regardless of what middleware decides — so this tradeoff affects UX
// (an expired-session user might briefly see a page before being bounced)
// rather than data security.
export async function middleware(request: NextRequest) {
  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));

  const isPublicRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth") ||
    request.nextUrl.pathname.startsWith("/register");

  if (!hasAuthCookie && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (hasAuthCookie && request.nextUrl.pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
