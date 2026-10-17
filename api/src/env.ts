export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  CLERK_ISSUER: string;
  CLERK_JWKS_URL: string;
  ALLOWED_ORIGINS?: string;
}

export type AuthUser = {
  id: string;
  clerkUserId: string;
  role: "user" | "moderator" | "admin";
};

export type AppVariables = { user: AuthUser };
export type AppBindings = { Bindings: Env; Variables: AppVariables };
