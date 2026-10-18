import { Hono } from "hono";
import { community } from './routes/community';
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
  app.use('*', cors({origin:(origin,c)=> (c.env.ALLOWED_ORIGINS||'').split(',').map((x: string)=>x.trim()).includes(origin)?origin:undefined,allowMethods:['GET','POST','PATCH','PUT','DELETE','OPTIONS'],allowHeaders:['Content-Type','Authorization'],maxAge:600}));
  app.use('/v1/*', (c,next)=>bodyLimit({maxSize:c.req.path==='/v1/me/avatar'?2*1024*1024:16384,onError:c=>c.json({error:'body_too_large'},413)})(c,next));

  app.get('/v1/avatars/:id',async c=>{
    const row=await c.env.DB.prepare("SELECT p.avatar_key FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=? AND u.status='active'").bind(c.req.param('id')).first<{avatar_key:string|null}>();
    if(!row?.avatar_key)throw new HttpError(404,'not_found');
    const object=await c.env.MEDIA.get(row.avatar_key);if(!object)throw new HttpError(404,'not_found');
    return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'}});
  });

  app.get("/health", (c) => c.json({ ok: true, env: c.env.ENVIRONMENT }));
  app.get('/v1/listings',async c=>c.json((await c.env.DB.prepare('SELECT l.*, p.display_name AS displayName, p.avatar_key AS avatarKey FROM listings l JOIN profiles p ON p.user_id=l.owner_id JOIN users u ON u.id=l.owner_id WHERE u.status=\'active\' ORDER BY l.created_at DESC, l.id DESC LIMIT 200').all()).results));

  app.use("/v1/*", requireAuth(resolveKey));
  app.route("/v1/me", me);
  app.route('/v1/listings',listings);
  app.route('/v1/saved',saved);
  app.route('/v1/community',community);

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
