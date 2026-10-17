import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { listings, saved } from "./routes/listings";
import type { AppBindings } from "./env";
import { HttpError } from "./lib/errors";
import { clerkKeyResolver, requireAuth, type KeyResolver } from "./middleware/auth";
import { me } from "./routes/me";

export function createApp(resolveKey: KeyResolver = clerkKeyResolver) {
  const app = new Hono<AppBindings>();
  app.use("*", secureHeaders());
  app.use('*', cors({origin:(origin,c)=> (c.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).includes(origin)?origin:undefined,allowMethods:['GET','POST','PATCH','PUT','DELETE','OPTIONS'],allowHeaders:['Content-Type','Authorization'],maxAge:600}));
  app.use('/v1/*', bodyLimit({maxSize:16384,onError:c=>c.json({error:'body_too_large'},413)}));

  app.get("/health", (c) => c.json({ ok: true, env: c.env.ENVIRONMENT }));
  app.get('/v1/listings',async c=>c.json((await c.env.DB.prepare('SELECT l.*, p.display_name AS displayName FROM listings l JOIN profiles p ON p.user_id=l.owner_id JOIN users u ON u.id=l.owner_id WHERE u.status=\'active\' ORDER BY l.created_at DESC, l.id DESC LIMIT 200').all()).results));

  app.use("/v1/*", requireAuth(resolveKey));
  app.route("/v1/me", me);
  app.route('/v1/listings',listings);
  app.route('/v1/saved',saved);

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.code }, err.status as any);
    console.error("unhandled", err);
    return c.json({ error: "internal_error" }, 500);
  });
  return app;
}

const app = createApp();

export default {
  fetch: app.fetch,
};
