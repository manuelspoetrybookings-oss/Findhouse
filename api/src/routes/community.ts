import {Hono} from 'hono';
import type {AppBindings} from '../env';
import {HttpError} from '../lib/errors';
import {ulid} from '../lib/ulid';

export const community=new Hono<AppBindings>();
const now=()=>Math.floor(Date.now()/1000);
async function body(c:any){const b=await c.req.json().catch(()=>{throw new HttpError(400,'invalid_json')});if(!b||typeof b!=='object'||Array.isArray(b))throw new HttpError(400,'invalid_body');return b;}
function text(b:any,k:string,max:number){if(typeof b[k]!=='string'||!b[k].trim()||b[k].trim().length>max)throw new HttpError(400,'invalid_'+k);return b[k].trim();}
async function active(db:D1Database,id:string){if(!await db.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(id).first())throw new HttpError(404,'user_not_found');}
const profileSQL=`SELECT p.user_id AS id,p.handle,p.display_name AS displayName,p.bio,p.avatar_key AS avatarKey,p.address,CASE WHEN p.share_phone=1 THEN p.contact_phone ELSE NULL END AS phone,p.followers_count AS followersCount,p.following_count AS followingCount FROM profiles p JOIN users u ON u.id=p.user_id WHERE u.status='active'`;
community.get('/users',async c=>{
 const q=(c.req.query('q')||'').trim().slice(0,60);
 const followed=c.req.query('contacts')==='1';
 return c.json((await c.env.DB.prepare(profileSQL+" AND p.user_id<>? AND (p.handle LIKE ? OR p.display_name LIKE ?)"+(followed?' AND EXISTS(SELECT 1 FROM follows WHERE follower_id=? AND followed_id=p.user_id)':'')+" ORDER BY p.display_name LIMIT 100").bind(c.get('user').id,'%'+q+'%','%'+q+'%',...(followed?[c.get('user').id]:[])).all()).results);
});
community.get('/users/:id',async c=>{
 const p=await c.env.DB.prepare(profileSQL+' AND p.user_id=?').bind(c.req.param('id')).first();if(!p)throw new HttpError(404,'not_found');
 const followed=!!await c.env.DB.prepare('SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?').bind(c.get('user').id,c.req.param('id')).first();return c.json({...p,added:followed});
});
community.get('/contacts',async c=>c.json((await c.env.DB.prepare('SELECT followed_id AS id FROM follows WHERE follower_id=?').bind(c.get('user').id).all()).results));
community.put('/users/:id/contact',async c=>{const id=c.req.param('id'),me=c.get('user').id;if(id===me)throw new HttpError(400,'cannot_add_self');await active(c.env.DB,id);await c.env.DB.prepare('INSERT OR IGNORE INTO follows VALUES (?,?,?)').bind(me,id,now()).run();return c.json({ok:true});});
community.delete('/users/:id/contact',async c=>{await c.env.DB.prepare('DELETE FROM follows WHERE follower_id=? AND followed_id=?').bind(c.get('user').id,c.req.param('id')).run();return c.json({ok:true});});
community.get('/conversations',async c=>{
 const me=c.get('user').id;return c.json((await c.env.DB.prepare(`SELECT c.id,p.user_id AS peerId,p.display_name AS displayName,
 (SELECT body FROM messages WHERE conversation_id=c.id ORDER BY id DESC LIMIT 1) AS lastMessage,
 COALESCE((SELECT created_at FROM messages WHERE conversation_id=c.id ORDER BY id DESC LIMIT 1),c.created_at) AS updatedAt
 FROM conversations c JOIN profiles p ON p.user_id=CASE WHEN c.user_a=? THEN c.user_b ELSE c.user_a END
 WHERE c.user_a=? OR c.user_b=? ORDER BY updatedAt DESC,c.id DESC LIMIT 100`).bind(me,me,me).all()).results);
});
community.post('/conversations',async c=>{
 const b=await body(c),peer=text(b,'userId',100),me=c.get('user').id;if(peer===me)throw new HttpError(400,'cannot_message_self');await active(c.env.DB,peer);
 const [a,z]=[me,peer].sort();await c.env.DB.prepare('INSERT OR IGNORE INTO conversations VALUES (?,?,?,?)').bind(ulid(),a,z,now()).run();
 return c.json(await c.env.DB.prepare('SELECT id FROM conversations WHERE user_a=? AND user_b=?').bind(a,z).first());
});
async function member(c:any){const id=c.req.param('id'),me=c.get('user').id;if(!await c.env.DB.prepare('SELECT id FROM conversations WHERE id=? AND (user_a=? OR user_b=?)').bind(id,me,me).first())throw new HttpError(404,'not_found');return id;}
community.get('/conversations/:id/messages',async c=>{const id=await member(c);const before=c.req.query('before');return c.json((await c.env.DB.prepare('SELECT * FROM (SELECT id,sender_id AS senderId,body,created_at AS createdAt FROM messages WHERE conversation_id=? AND id<? ORDER BY id DESC LIMIT 100) ORDER BY id').bind(id,before||'~').all()).results);});
community.post('/conversations/:id/messages',async c=>{const id=await member(c),b=await body(c),message=text(b,'body',2000),mid=ulid();await c.env.DB.prepare('INSERT INTO messages VALUES (?,?,?,?,?)').bind(mid,id,c.get('user').id,message,now()).run();return c.json({id:mid},201);});

community.get('/inspections',async c=>{
 const me=c.get('user').id;
 return c.json((await c.env.DB.prepare(`SELECT r.id,r.requester_id AS requesterId,r.provider_id AS providerId,r.title,r.area,r.budget,r.preferred_at AS preferredAt,r.status,r.created_at AS createdAt,p.display_name AS requesterName,
 EXISTS(SELECT 1 FROM inspection_offers o WHERE o.request_id=r.id AND o.provider_id=?) AS offered
 FROM inspection_requests r JOIN profiles p ON p.user_id=r.requester_id JOIN users u ON u.id=r.requester_id
 WHERE u.status='active' AND (r.status='open' OR r.requester_id=? OR r.provider_id=?) ORDER BY r.created_at DESC,r.id DESC LIMIT 100`).bind(me,me,me).all()).results);
});
community.post('/inspections',async c=>{
 const b=await body(c),title=text(b,'title',100),area=text(b,'area',100),details=text(b,'details',2000);
 if(!Number.isSafeInteger(b.budget)||b.budget<0||b.budget>100000000)throw new HttpError(400,'invalid_budget');
 let preferred:string|null=null;if(b.preferredAt){const d=new Date(b.preferredAt);if(!Number.isFinite(d.getTime())||d.getTime()<Date.now())throw new HttpError(400,'invalid_preferredAt');preferred=d.toISOString();}
 const listing=b.listingId?text(b,'listingId',100):null;if(listing&&!await c.env.DB.prepare('SELECT id FROM listings WHERE id=?').bind(listing).first())throw new HttpError(404,'listing_not_found');
 const id=ulid(),t=now();await c.env.DB.prepare('INSERT INTO inspection_requests (id,requester_id,listing_id,title,area,details,budget,preferred_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,c.get('user').id,listing,title,area,details,b.budget,preferred,t,t).run();return c.json({id},201);
});
community.get('/inspections/:id',async c=>{
 const r=await c.env.DB.prepare('SELECT r.*,p.display_name AS requesterName FROM inspection_requests r JOIN profiles p ON p.user_id=r.requester_id WHERE r.id=?').bind(c.req.param('id')).first<any>();if(!r)throw new HttpError(404,'not_found');
 const me=c.get('user').id;if(r.status!=='open'&&r.requester_id!==me&&r.provider_id!==me)throw new HttpError(404,'not_found');
 const offers=r.requester_id===me?(await c.env.DB.prepare('SELECT o.provider_id AS id,p.display_name AS displayName FROM inspection_offers o JOIN profiles p ON p.user_id=o.provider_id JOIN users u ON u.id=o.provider_id WHERE o.request_id=? AND u.status=\'active\' ORDER BY o.created_at').bind(r.id).all()).results:[];
 return c.json({...r,offers,report:r.requester_id===me||r.provider_id===me?r.report:null});
});
community.post('/inspections/:id/offer',async c=>{const r=await c.env.DB.prepare('SELECT * FROM inspection_requests WHERE id=?').bind(c.req.param('id')).first<any>(),me=c.get('user').id;if(!r||r.status!=='open')throw new HttpError(409,'request_not_open');if(r.requester_id===me)throw new HttpError(400,'cannot_offer_own_request');await c.env.DB.prepare("INSERT OR IGNORE INTO inspection_offers SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM inspection_requests WHERE id=? AND status='open')").bind(r.id,me,now(),r.id).run();return c.json({ok:true});});
community.patch('/inspections/:id',async c=>{
 const b=await body(c),id=c.req.param('id'),me=c.get('user').id;let result;
 if(b.action==='assign'){
  const provider=text(b,'providerId',100);await active(c.env.DB,provider);
  result=await c.env.DB.prepare("UPDATE inspection_requests SET provider_id=?,status='assigned',updated_at=? WHERE id=? AND requester_id=? AND status='open' AND EXISTS(SELECT 1 FROM inspection_offers WHERE request_id=? AND provider_id=?)").bind(provider,now(),id,me,id,provider).run();
 }else if(b.action==='submit'){
  const report=text(b,'report',4000);result=await c.env.DB.prepare("UPDATE inspection_requests SET report=?,status='submitted',updated_at=? WHERE id=? AND provider_id=? AND status='assigned'").bind(report,now(),id,me).run();
 }else if(b.action==='complete')result=await c.env.DB.prepare("UPDATE inspection_requests SET status='completed',updated_at=? WHERE id=? AND requester_id=? AND status='submitted'").bind(now(),id,me).run();
 else if(b.action==='cancel')result=await c.env.DB.prepare("UPDATE inspection_requests SET status='cancelled',updated_at=? WHERE id=? AND requester_id=? AND status IN ('open','assigned')").bind(now(),id,me).run();
 else throw new HttpError(400,'invalid_action');
 if(!result.meta.changes)throw new HttpError(409,'action_not_allowed');return c.json({ok:true});
});
