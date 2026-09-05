import { NextResponse } from "next/server";

/** Names Neon Auth always sets (see @neondatabase/auth/next/server). */
export const KNOWN_NEON_AUTH_COOKIES = [
  "__Secure-neon-auth.session_token",
  "__Secure-neon-auth.local.session_data",
  "__Secure-neon-auth.session_challange",
] as const;

const EPOCH_GMT = "Thu, 01 Jan 1970 00:00:00 GMT";

export function collectAuthCookieNames(cookieHeader: string | null): string[] {
  const names = new Set<string>(KNOWN_NEON_AUTH_COOKIES);
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const name = part.split("=", 1)[0]?.trim();
      if (name && isAuthCookieName(name)) names.add(name);
    }
  }
  return [...names];
}

function isAuthCookieName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("neon-auth") ||
    n.includes("session_token") ||
    n.includes("session_data") ||
    n.includes("session_challange") ||
    n.includes("better-auth")
  );
}

/** Expire headers matching how Neon mints cookies: Path=/, Secure, HttpOnly, SameSite=Lax. */
export function buildExpireSetCookieHeaders(
  cookieHeader: string | null,
  host: string | null,
): string[] {
  const hostname = host?.split(":")[0] ?? "";
  const headers: string[] = [];
  for (const name of collectAuthCookieNames(cookieHeader)) {
    headers.push(...expireVariants(name, hostname));
  }
  return headers;
}

function expireVariants(name: string, hostname: string): string[] {
  const common = `${name}=; Path=/; Expires=${EPOCH_GMT}; Max-Age=0; HttpOnly; Secure`;
  const variants = [
    `${common}; SameSite=Lax`,
    `${common}; SameSite=Strict`,
  ];
  if (hostname && hostname !== "localhost") {
    variants.push(`${common}; SameSite=Lax; Domain=${hostname}`);
    variants.push(`${common}; SameSite=Strict; Domain=${hostname}`);
  }
  return variants;
}

export function applyExpireSetCookies(
  response: NextResponse,
  cookieHeader: string | null,
  host: string | null,
): void {
  for (const header of buildExpireSetCookieHeaders(cookieHeader, host)) {
    response.headers.append("Set-Cookie", header);
  }
}
