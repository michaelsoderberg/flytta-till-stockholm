import { NextRequest, NextResponse } from "next/server";

/**
 * HTTP Basic Auth in front of the whole site. The app must not be public until the licences of all
 * sources are verified (see CLAUDE.md), so on Vercel it is closed unless credentials are configured,
 * or SITE_PUBLIC=1 is set once the licences are cleared. Locally (no VERCEL env) it is open.
 */
export function middleware(req: NextRequest) {
  if (process.env.SITE_PUBLIC === "1") return NextResponse.next();
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !password) {
    return process.env.VERCEL
      ? new NextResponse("Basic auth is not configured", { status: 503 })
      : NextResponse.next();
  }
  if (safeEqual(req.headers.get("authorization") ?? "", `Basic ${btoa(`${user}:${password}`)}`)) {
    return NextResponse.next();
  }
  return new NextResponse("Inloggning krävs", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Kommunkollen", charset="UTF-8"' },
  });
}

/** Constant-time comparison (the Edge runtime has no node:crypto timingSafeEqual). */
function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a.charCodeAt(i) || 0) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  // The cron route has its own secret, so GitHub Actions can reach it without the site password.
  matcher: ["/((?!api/cron/|_next/static|_next/image|favicon.ico).*)"],
};
