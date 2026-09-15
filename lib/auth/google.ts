/**
 * Google OAuth client id/secret are used only for Neon Auth sign-in.
 */
export const googleSignIn = {
  provider: "google" as const,
  callbackURL: "/dashboard",
};
