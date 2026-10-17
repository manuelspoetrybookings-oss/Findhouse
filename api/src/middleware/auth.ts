import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type KeyLike } from "jose";
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../env";
import { HttpError } from "../lib/errors";
import { ulid } from "../lib/ulid";

export type KeyResolver = (env: AppBindings["Bindings"]) => JWTVerifyGetKey | KeyLike | Uint8Array;

const jwksCache = new Map<string, JWTVerifyGetKey>();

/** Default resolver: Clerk's JWKS (jose caches keys and handles rotation). */
export const clerkKeyResolver: KeyResolver = (env) => {
  if (!env.CLERK_JWKS_URL) throw new HttpError(500, "auth_not_configured");
  let jwks = jwksCache.get(env.CLERK_JWKS_URL);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(env.CLERK_JWKS_URL));
    jwksCache.set(env.CLERK_JWKS_URL, jwks);
  }
  return jwks;
};

/**
 * Verifies the Clerk session JWT, then loads (or lazily creates) the user row.
 * Role and status ALWAYS come from D1, never from token claims.
 */
export function requireAuth(resolveKey: KeyResolver = clerkKeyResolver): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const header = c.req.header("Authorization") ?? "";
    const m = /^Bearer (.+)$/.exec(header);
    if (!m) throw new HttpError(401, "missing_token");

    if (!c.env.CLERK_ISSUER) throw new HttpError(500, "auth_not_configured");
    if(c.env.ENVIRONMENT==='production' && !(c.env.ALLOWED_ORIGINS||'').split(',').some(x=>x.trim()))throw new HttpError(500,'origins_not_configured');

    let sub: string;
    let claims: Record<string, unknown>;
    try {
      const key = resolveKey(c.env) as any;
      const { payload } = await jwtVerify(m[1], key, {
        issuer: c.env.CLERK_ISSUER,
        algorithms: ["RS256"],
        clockTolerance: 5,
      });
      if (!payload.sub) throw new Error("no sub");
      if (typeof payload.exp !== 'number') throw new Error('missing expiration');
      const origins=(c.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
      if(origins.length && (typeof payload.azp!=='string'||!origins.includes(payload.azp)))throw new Error('unauthorized party');
      sub = payload.sub;
      claims = payload as Record<string, unknown>;
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(401, "invalid_token");
    }

    const now = Math.floor(Date.now() / 1000);
    let row = await c.env.DB.prepare("SELECT id, role, status FROM users WHERE clerk_user_id = ?")
      .bind(sub)
      .first<{ id: string; role: "user" | "moderator" | "admin"; status: string }>();

    if (!row) {
      const id = ulid();
      const email = typeof claims.email === "string" ? claims.email : null;
      const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim().slice(0, 80) : "New user";
      const handle = `user_${id.slice(-10).toLowerCase()}`;
      // Atomic: user + profile together. OR IGNORE handles concurrent first requests.
      await c.env.DB.batch([
        c.env.DB.prepare(
          "INSERT OR IGNORE INTO users (id, clerk_user_id, email, created_at, updated_at, last_seen_at) VALUES (?,?,?,?,?,?)",
        ).bind(id, sub, email, now, now, now),
        c.env.DB.prepare(
          "INSERT OR IGNORE INTO profiles (user_id, handle, display_name, created_at, updated_at) " +
            "SELECT id, ?, ?, ?, ? FROM users WHERE clerk_user_id = ? " +
            "AND NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = users.id)",
        ).bind(handle, name, now, now, sub),
      ]);
      row = await c.env.DB.prepare("SELECT id, role, status FROM users WHERE clerk_user_id = ?")
        .bind(sub)
        .first();
      if (!row) throw new HttpError(500, "user_create_failed");
    }

    if (row.status !== "active") throw new HttpError(403, "account_" + row.status);

    c.set("user", { id: row.id, clerkUserId: sub, role: row.role });
    await next();
  };
}

export const requireRole = (...roles: Array<"moderator" | "admin">): MiddlewareHandler<AppBindings> =>
  async (c, next) => {
    if (!roles.includes(c.get("user").role as any)) throw new HttpError(403, "forbidden");
    await next();
  };
