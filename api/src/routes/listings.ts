import {Hono} from 'hono';
import type {AppBindings} from '../env';
import {HttpError} from '../lib/errors';
import {ulid} from '../lib/ulid';
export const listings=new Hono<AppBindings>();
listings.post('/',async c=>{
 const b=await c.req.json().catch(()=>{throw new HttpError(400,'invalid_json')});
 if(!b||typeof b!=='object'||Array.isArray(b))throw new HttpError(400,'invalid_body');
 const text=(key:string,max:number)=>{if(typeof b[key]!=='string'||!b[key].trim()||b[key].trim().length>max)throw new HttpError(400,'invalid_'+key);return b[key].trim()};
 const title=text('title',100),description=text('description',1000),area=text('area',100);
 if(!['Rent','Buy'].includes(b.mode)||!['Apartment','Duplex','Self Contain','Bungalow','Terrace'].includes(b.type))throw new HttpError(400,'invalid_category');
 for(const [key,min,max] of [['price',1,999999999999],['beds',0,30],['baths',1,30]] as const)if(!Number.isSafeInteger(b[key])||b[key]<min||b[key]>max)throw new HttpError(400,'invalid_'+key);
 const id=ulid();await c.env.DB.prepare('INSERT INTO listings (id,owner_id,title,description,area,type,mode,price,beds,baths,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,c.get('user').id,title,description,area,b.type,b.mode,b.price,b.beds,b.baths,Math.floor(Date.now()/1000)).run();return c.json({id},201);
});
listings.delete('/:id',async c=>{
 const result=await c.env.DB.prepare('DELETE FROM listings WHERE id=? AND owner_id=?').bind(c.req.param('id'),c.get('user').id).run();
 if(!result.meta.changes)throw new HttpError(404,'not_found');return c.json({ok:true});
});
export const saved=new Hono<AppBindings>();
saved.get('/',async c=>c.json((await c.env.DB.prepare('SELECT listing_id AS id FROM saved_listings WHERE user_id=?').bind(c.get('user').id).all()).results));
saved.put('/:id',async c=>{const id=c.req.param('id');if(!await c.env.DB.prepare('SELECT id FROM listings WHERE id=?').bind(id).first())throw new HttpError(404,'not_found');await c.env.DB.prepare('INSERT OR IGNORE INTO saved_listings (user_id,listing_id) VALUES (?,?)').bind(c.get('user').id,id).run();return c.json({ok:true})});
saved.delete('/:id',async c=>{await c.env.DB.prepare('DELETE FROM saved_listings WHERE user_id=? AND listing_id=?').bind(c.get('user').id,c.req.param('id')).run();return c.json({ok:true})});
