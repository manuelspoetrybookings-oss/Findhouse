import {describe,it,expect} from 'vitest';
import {generateKeyPair,SignJWT} from 'jose';
import {createApp} from '../src/index';import {makeD1} from './helpers/d1';
describe('live listing authorization',()=>{
 it('allows public browsing, authenticated creation and saving, but rejects another owner and wrong authorized party',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256');const {d1}=makeD1();const app=createApp(()=>publicKey);
 const env={DB:d1,ENVIRONMENT:'production',CLERK_ISSUER:'https://clerk.example',CLERK_JWKS_URL:'unused',ALLOWED_ORIGINS:'https://homes.vercel.app'} as any;
 const token=(sub:string,azp='https://homes.vercel.app')=>new SignJWT({azp}).setProtectedHeader({alg:'RS256'}).setIssuer(env.CLERK_ISSUER).setSubject(sub).setIssuedAt().setExpirationTime('5m').sign(privateKey);
 const one=await token('user-one'),two=await token('user-two');
 const request=(path:string,method='GET',jwt?:string,body?:unknown)=>app.request(path,{method,headers:{...(jwt?{Authorization:'Bearer '+jwt}:{}),'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})},env);
 expect((await request('/v1/listings')).status).toBe(200);
 expect((await request('/v1/listings','POST',undefined,{})).status).toBe(401);
 expect((await request('/v1/me','GET',await token('intruder','https://evil.example'))).status).toBe(401);
 const data={title:'Lekki home',description:'Bright apartment',area:'Lekki, Lagos',type:'Apartment',mode:'Rent',price:3500000,beds:3,baths:3};
 expect((await request('/v1/listings','POST',one,{...data,price:-1})).status).toBe(400);
 const created=await request('/v1/listings','POST',one,data);expect(created.status).toBe(201);const {id}=await created.json() as {id:string};
 expect((await request('/v1/listings/'+id,'DELETE',two)).status).toBe(404);
 expect((await request('/v1/saved/'+id,'PUT',two)).status).toBe(200);
 expect(await (await request('/v1/saved','GET',two)).json()).toEqual([{id}]);
 expect((await request('/v1/listings/'+id,'DELETE',one)).status).toBe(200);
 expect(await (await request('/v1/saved','GET',two)).json()).toEqual([]);
 const allowed=await app.request('/v1/listings',{method:'OPTIONS',headers:{Origin:'https://homes.vercel.app','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}},env);
 expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://homes.vercel.app');
 const denied=await app.request('/v1/listings',{headers:{Origin:'https://evil.example'}},env);expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull();
 });
});
