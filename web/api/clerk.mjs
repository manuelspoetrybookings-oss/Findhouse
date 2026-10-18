// Same-origin Clerk Frontend API proxy. The secret is read only at function runtime.
const upstreamOrigin='https://frontend-api.clerk.dev';
export async function proxyClerk(request,env=process.env,send=fetch){
 const proxyURL=env.CLERK_PROXY_URL||'https://rentarapp.vercel.app/__clerk';
 if(!env.CLERK_SECRET_KEY)return Response.json({error:'clerk_proxy_not_configured'},{status:503});
 const source=new URL(request.url),proxy=new URL(proxyURL);
 let path=source.pathname.startsWith('/__clerk')?source.pathname.slice('/__clerk'.length):'/'+(source.searchParams.get('__clerk_path')||'');
 source.searchParams.delete('__clerk_path');
 // Vercel also supplies the named rewrite capture as a query parameter.
 source.searchParams.delete('path');
 let decoded;try{decoded=decodeURIComponent(path);}catch{return new Response('Invalid path',{status:400});}
 if(!path.startsWith('/')||decoded.startsWith('//')||decoded.includes('\\')||decoded.split('/').includes('..'))return new Response('Invalid path',{status:400});
 const target=new URL(upstreamOrigin);target.pathname=path;target.search=source.search;
 const headers=new Headers(request.headers);
 for(const name of ['host','connection','content-length','accept-encoding','clerk-secret-key','clerk-proxy-url','x-forwarded-for','x-forwarded-host','x-forwarded-proto'])headers.delete(name);
 headers.set('Clerk-Proxy-Url',proxyURL);headers.set('Clerk-Secret-Key',env.CLERK_SECRET_KEY);
 // Vercel supplies this header; do not trust a caller-supplied forwarded-for chain.
 headers.set('X-Forwarded-For',request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim()||'');
 try{
  const response=await send(target,{method:request.method,headers,redirect:'manual',signal:AbortSignal.timeout(25000),...(!['GET','HEAD'].includes(request.method)?{body:request.body,duplex:'half'}:{})});
  const out=new Headers(response.headers);out.delete('content-encoding');out.delete('content-length');out.delete('clerk-secret-key');out.set('Cache-Control','no-store');
  const location=out.get('location');if(location){const redirect=new URL(location,upstreamOrigin);if(redirect.origin===upstreamOrigin){redirect.protocol=proxy.protocol;redirect.host=proxy.host;redirect.pathname=proxy.pathname.replace(/\/$/,'')+redirect.pathname;out.set('location',redirect.href);}}
  return new Response(response.body,{status:response.status,headers:out});
 }catch{return Response.json({error:'clerk_proxy_upstream_unavailable'},{status:502});}
}
export default {fetch:request=>proxyClerk(request)};
