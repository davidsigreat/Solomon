import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";

const neonAuth = auth.middleware({ loginUrl: "/login" });

/**
 * Gate protected pages before HTML ships. `/login`, `/api/**` (including
 * `/api/auth/**` and API-key routes), and static assets are outside the
 * matcher so they stay reachable without a session cookie.
 */
export function proxy(request: NextRequest) {
  return neonAuth(request);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/admin/:path*",
    "/analytics/:path*",
    "/notifications/:path*",
  ],
};
