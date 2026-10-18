import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=path.join(root,'.env');const local=existsSync(file)?parseEnv(readFileSync(file,'utf8')):{};
const key=process.env.CLERK_PUBLISHABLE_KEY||local.CLERK_PUBLISHABLE_KEY||'';
const api=process.env.CLOUDFLARE_API_URL||local.CLOUDFLARE_API_URL||'';
if(!/^pk_(test|live)_[A-Za-z0-9_-]+={0,2}$/.test(key))throw Error('Set CLERK_PUBLISHABLE_KEY to the publishable key from Clerk.');
let domain;try{domain=Buffer.from(key.split('_').slice(2).join('_'),'base64').toString('utf8').replace(/\$$/,'');}catch{}
if(!domain||!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(domain))throw Error('Invalid Clerk publishable key domain. Copy the complete key from Clerk.');
const url=api?new URL(api):null;if(url&&(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw Error('CLOUDFLARE_API_URL must be an HTTPS origin (or local HTTP during development).');
const output=path.join(root,process.argv.includes('--web-root')?'web/dist':'dist');mkdirSync(output,{recursive:true});for(const name of ['index.html','style.css','app-v2.js','auth.js','live.js'])cpSync(path.join(root,'web',name),path.join(output,name));
writeFileSync(path.join(output,'config.js'),'window.NAIJA_CONFIG = '+JSON.stringify({live:true,clerkPublishableKey:key,apiUrl:url?.origin||null,backendConfigured:!!url})+';\n');
const scripts=`<script defer src="config.js"></script><script defer crossorigin="anonymous" src="https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js"></script><script defer crossorigin="anonymous" data-clerk-publishable-key="${key}" src="https://${domain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js"></script><script defer src="auth.js"></script><script defer src="app-v2.js"></script><script defer src="live.js"></script>`;
const html=readFileSync(path.join(root,'web/index.html'),'utf8').replace(/<script src="app-v2\.js[^\"]*"><\/script>/,scripts);
writeFileSync(path.join(output,'index.html'),html);
console.log('Built Vercel frontend. Only publishable configuration was emitted.');

