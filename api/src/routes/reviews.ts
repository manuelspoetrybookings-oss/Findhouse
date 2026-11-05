import { Hono } from 'hono';
import type { AppBindings } from '../env';
import { HttpError } from '../lib/errors';
import { ulid } from '../lib/ulid';
export const reviewCategories=['overall','road','security','electricity','landlord','flooding'] as const;
type ReviewRow={id:string;author_id:string;ratings:string;category_notes:string;photo_key:string|null};
const visible="FROM property_reviews r JOIN profiles p ON p.user_id=r.author_id JOIN users u ON u.id=r.author_id WHERE r.deleted_at IS NULL AND u.status='active'";
const fields='SELECT r.*,p.display_name AS displayName,p.handle';
export const publicReviews=new Hono<AppBindings>();
publicReviews.get('/',async c=>{
 const before=c.req.query('before')||'';
 const rows=await c.env.DB.prepare(`${fields} ${visible} AND (?='' OR r.id<?) ORDER BY r.id DESC LIMIT 30`).bind(before,before).all<ReviewRow>();
 return c.json(rows.results.map(r=>({...r,ratings:JSON.parse(r.ratings),category_notes:JSON.parse(r.category_notes),photo_key:undefined,hasPhoto:!!r.photo_key})));
});
publicReviews.get('/:id/photo',async c=>{
 const r=await c.env.DB.prepare(`${fields} ${visible} AND r.id=?`).bind(c.req.param('id')).first<ReviewRow>();
 if(!r?.photo_key)throw new HttpError(404,'not_found');
 const photo=await c.env.MEDIA.get(r.photo_key);if(!photo)throw new HttpError(404,'not_found');
 return new Response(photo.body,{headers:{'Content-Type':photo.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
});
function validate(b:unknown){
 if(!b||typeof b!=='object'||Array.isArray(b))throw new HttpError(400,'invalid_review');
 const input=b as Record<string,unknown>;
 const text=(key:string,min:number,max:number)=>{const v=input[key];if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)throw new HttpError(400,'invalid_'+key);return v.trim();};
 const propertyName=text('propertyName',2,100),area=text('area',2,180),notes=text('notes',1,2000);
 if(input.stayedHere!==true||input.acceptedDisclaimer!==true)throw new HttpError(400,'review_confirmation_required');
 const ratings:Record<string,number>={},categoryNotes:Record<string,string>={};
 for(const key of reviewCategories){
  const n=(input.ratings as Record<string,unknown>|undefined)?.[key];
  if(typeof n!=='number'||!Number.isInteger(n)||n<1||n>5)throw new HttpError(400,'invalid_rating_'+key);
  ratings[key]=n;
  const note=(input.categoryNotes as Record<string,unknown>|undefined)?.[key]??'';
  if(typeof note!=='string'||note.length>500)throw new HttpError(400,'invalid_note_'+key);
  categoryNotes[key]=note.trim();
 }
 return {propertyName,area,notes,ratings,categoryNotes};
}
export const reviews=new Hono<AppBindings>();
reviews.post('/',async c=>{
 let form:FormData;try{form=await c.req.formData();}catch{throw new HttpError(400,'invalid_form');}
 let body:unknown;try{body=JSON.parse(String(form.get('review')||''));}catch{throw new HttpError(400,'invalid_json');}
 const v=validate(body),photo=form.get('photo');
 let bytes:Uint8Array|undefined,mime:string|null=null;
 if(photo&&typeof photo!=='string'&&photo.size){
  if(photo.size>2*1024*1024)throw new HttpError(413,'photo_too_large');
  bytes=new Uint8Array(await photo.arrayBuffer());
  const matches=(sig:number[],offset=0)=>sig.every((n,i)=>bytes![offset+i]===n);
  mime=matches([137,80,78,71,13,10,26,10])?'image/png':matches([255,216,255])?'image/jpeg':matches([82,73,70,70])&&matches([87,69,66,80],8)?'image/webp':null;
  if(!mime)throw new HttpError(400,'unsupported_photo_format');
 }
 const id=ulid(),author=c.get('user').id,key=bytes?'reviews/'+author+'/'+id:null,now=Math.floor(Date.now()/1000);
 if(key&&bytes&&mime)await c.env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});
 try{await c.env.DB.prepare('INSERT INTO property_reviews (id,author_id,property_name,area,notes,ratings,category_notes,photo_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,author,v.propertyName,v.area,v.notes,JSON.stringify(v.ratings),JSON.stringify(v.categoryNotes),key,now,now).run();}
 catch(err){if(key)await c.env.MEDIA.delete(key);throw err;}
 return c.json({id},201);
});
reviews.delete('/:id',async c=>{
 const id=c.req.param('id'),user=c.get('user');
 const row=await c.env.DB.prepare('SELECT author_id FROM property_reviews WHERE id=? AND deleted_at IS NULL').bind(id).first<{author_id:string}>();
 if(!row)throw new HttpError(404,'not_found');
 if(row.author_id!==user.id&&user.role!=='admin')throw new HttpError(403,'forbidden');
 const now=Math.floor(Date.now()/1000);
 await c.env.DB.batch([
  c.env.DB.prepare('UPDATE property_reviews SET deleted_at=?,updated_at=? WHERE id=?').bind(now,now,id),
  c.env.DB.prepare('INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,metadata,created_at) VALUES (?,?,?,?,?,?,?)').bind(ulid(),user.id,'review.delete','property_review',id,'{}',now)
 ]);
 return c.json({ok:true});
});
