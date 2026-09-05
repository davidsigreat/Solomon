/** Requested on every Google sign-in so calendar list can run after reconnect. */
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

/**
 * Neon Auth / Better Auth stores Google tokens on neon_auth.account.
 * Google only returns a refresh token on consent; without access_type=offline
 * + prompt=consent, reconnect keeps a session but no persisted calendar grant.
 */
export const googleCalendarSignIn = {
  provider: "google" as const,
  callbackURL: "/dashboard",
  scopes: [GOOGLE_CALENDAR_SCOPE],
  additionalParams: {
    access_type: "offline",
    prompt: "consent",
  },
};
