import { Hono } from "hono";
import type { AppBindings } from "../env";
import { HttpError } from "../lib/errors";
import { ulid } from "../lib/ulid";

export const me = new Hono<AppBindings>();

me.get("/", async (c) => {
  const u = c.get("user");
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.role, p.handle, p.display_name AS displayName, p.avatar_key AS avatarKey,
            p.bio, p.state, p.city, p.contact_phone AS phone, p.share_phone AS sharePhone, p.address, p.is_spotter AS isSpotter, p.is_inspector AS isInspector,
            p.followers_count AS followersCount, p.following_count AS followingCount,
            EXISTS (SELECT 1 FROM verification_records v WHERE v.user_id = u.id AND v.kind='identity' AND v.status='approved') AS identityVerified
       FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`,
  ).bind(u.id).first();
  if (!row) throw new HttpError(404, "not_found");
  return c.json(row);
});

const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

me.patch("/", async (c) => {
  const u = c.get("user");
  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { throw new HttpError(400, "invalid_json"); }
  if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'invalid_body');

  const sets: string[] = [];
  const vals: unknown[] = [];
  const str = (k: string, col: string, max: number, min = 0) => {
    if (body[k] === undefined) return;
    if (typeof body[k] !== "string") throw new HttpError(400, `invalid_${k}`);
    const v = (body[k] as string).trim();
    if (v.length < min || v.length > max) throw new HttpError(400, `invalid_${k}`);
    sets.push(`${col} = ?`); vals.push(v === "" ? null : v);
  };
  str("displayName", "display_name", 60, 1);
  str("bio", "bio", 280);
  str("state", "state", 40);
  str("city", "city", 60);
  str('address','address',180);
  if(body.phone!==undefined){
    if(typeof body.phone!=='string')throw new HttpError(400,'invalid_phone');
    const phone=body.phone.replace(/[\s()-]/g,'');
    if(phone&&!/^\+[1-9][0-9]{7,14}$/.test(phone))throw new HttpError(400,'invalid_phone');
    sets.push('contact_phone = ?');vals.push(phone||null);
  }
  if(body.sharePhone!==undefined){if(typeof body.sharePhone!=='boolean')throw new HttpError(400,'invalid_sharePhone');sets.push('share_phone = ?');vals.push(body.sharePhone?1:0);}
  if (body.handle !== undefined) {
    if (typeof body.handle !== "string" || !HANDLE_RE.test(body.handle.trim().toLowerCase())) throw new HttpError(400, "invalid_handle");
    sets.push("handle = ?"); vals.push(body.handle.trim().toLowerCase());
  }
  if (body.isInspector !== undefined) {
    // Self-declared interest only; inspector privileges require an approved 'inspector' verification (Milestone 5).
    if (typeof body.isInspector !== "boolean") throw new HttpError(400, "invalid_isInspector");
    sets.push("is_inspector = ?"); vals.push(body.isInspector ? 1 : 0);
  }
  if (sets.length === 0) throw new HttpError(400, "no_changes");

  const now = Math.floor(Date.now() / 1000);
  sets.push("updated_at = ?"); vals.push(now);
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE profiles SET ${sets.join(", ")} WHERE user_id = ?`).bind(...vals, u.id),
      c.env.DB.prepare(
        "INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?,?,?,?,?,?,?)",
      ).bind(ulid(), u.id, "profile.update", "profile", u.id, JSON.stringify({ fields: Object.keys(body) }), now),
    ]);
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw new HttpError(409, "handle_taken");
    throw e;
  }
  return c.json({ ok: true });
});

me.post('/avatar',async c=>{
 const bytes=new Uint8Array(await c.req.arrayBuffer());
 if(bytes.length===0||bytes.length>2*1024*1024)throw new HttpError(413,'photo_too_large');
 const matches=(signature:number[],offset=0)=>signature.every((n,i)=>bytes[offset+i]===n);
 const mime=matches([137,80,78,71,13,10,26,10])?'image/png':matches([255,216,255])?'image/jpeg':matches([82,73,70,70])&&matches([87,69,66,80],8)?'image/webp':null;
 if(!mime)throw new HttpError(400,'unsupported_photo_format');
 const id=c.get('user').id,key='avatars/'+id+'/'+ulid();
 const old=await c.env.DB.prepare('SELECT avatar_key FROM profiles WHERE user_id=?').bind(id).first<{avatar_key:string|null}>();
 await c.env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});
 try{await c.env.DB.prepare('UPDATE profiles SET avatar_key=?,updated_at=? WHERE user_id=?').bind(key,Math.floor(Date.now()/1000),id).run();}
 catch(err){await c.env.MEDIA.delete(key);throw err;}
 if(old?.avatar_key?.startsWith('avatars/'+id+'/'))await c.env.MEDIA.delete(old.avatar_key).catch(err=>console.error('old_avatar_cleanup_failed',err));
 return c.json({ok:true},201);
});
me.delete('/avatar',async c=>{
 const id=c.get('user').id,old=await c.env.DB.prepare('SELECT avatar_key FROM profiles WHERE user_id=?').bind(id).first<{avatar_key:string|null}>();
 await c.env.DB.prepare('UPDATE profiles SET avatar_key=NULL WHERE user_id=?').bind(id).run();
 if(old?.avatar_key?.startsWith('avatars/'+id+'/'))await c.env.MEDIA.delete(old.avatar_key);
 return c.json({ok:true});
});
