import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proxyClerk} from '../web/api/clerk.mjs';
test('Clerk proxy fixes upstream, preserves body/query, uses trusted client IP and never follows redirects',async()=>{
 const env={CLERK_SECRET_KEY:'test-server-only',CLERK_PROXY_URL:'https://rentarapp.vercel.app/__clerk'};
 let called=false;
 const response=await proxyClerk(new Request('https://rentarapp.vercel.app/api/clerk?__clerk_path=v1/client/sign_ins&__clerk_api_version=2026-01-01',{method:'POST',headers:{'Content-Type':'application/json','x-forwarded-for':'spoofed','x-vercel-forwarded-for':'203.0.113.1','Clerk-Secret-Key':'injected'},body:'{"identifier":"test"}'}),env,async(url,options)=>{
  called=true;assert.equal(url.origin,'https://frontend-api.clerk.dev');assert.equal(url.pathname,'/v1/client/sign_ins');assert.equal(url.searchParams.has('__clerk_path'),false);assert.equal(url.searchParams.get('__clerk_api_version'),'2026-01-01');assert.equal(options.redirect,'manual');assert.equal(options.headers.get('Clerk-Secret-Key'),'test-server-only');assert.equal(options.headers.get('X-Forwarded-For'),'203.0.113.1');assert.equal(await new Response(options.body).text(),'{"identifier":"test"}');
  return new Response(null,{status:307,headers:{location:'https://frontend-api.clerk.dev/v1/client','Clerk-Secret-Key':'should-not-return'}});
 });
 assert.equal(called,true);assert.equal(response.status,307);assert.equal(response.headers.get('location'),'https://rentarapp.vercel.app/__clerk/v1/client');assert.equal(response.headers.has('Clerk-Secret-Key'),false);
});
test('proxy rejects invalid paths, fails closed without credentials and sanitizes upstream failures',async()=>{
 assert.equal((await proxyClerk(new Request('https://rentarapp.vercel.app/__clerk/v1/environment'),{})).status,503);
 assert.equal((await proxyClerk(new Request('https://rentarapp.vercel.app/api/clerk?__clerk_path=%2F%2Fevil.example'),{CLERK_SECRET_KEY:'hidden'})).status,400);
 const r=await proxyClerk(new Request('https://rentarapp.vercel.app/__clerk/v1/environment'),{CLERK_SECRET_KEY:'hidden'},async()=>{throw Error('hidden')});assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/hidden/);
});
