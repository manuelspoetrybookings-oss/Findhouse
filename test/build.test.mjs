import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {readFileSync} from 'node:fs';
const key='pk_test_'+Buffer.from('sample.clerk.accounts.dev$').toString('base64');
test('build exposes only publishable key and API origin',()=>{
 const result=spawnSync(process.execPath,['scripts/build.mjs'],{encoding:'utf8',env:{...process.env,CLERK_PUBLISHABLE_KEY:key,CLOUDFLARE_API_URL:'https://example.workers.dev',CLERK_SECRET_KEY:'secret-must-not-ship',CLOUDFLARE_API_TOKEN:'token-must-not-ship'}});
 assert.equal(result.status,0,result.stderr);const config=readFileSync('dist/config.js','utf8');assert.match(config,/example.workers.dev/);assert.doesNotMatch(config,/secret-must-not-ship|token-must-not-ship/);const html=readFileSync('dist/index.html','utf8');assert.match(html,/@clerk\/clerk-js@6/);assert.match(html,/live.js/);assert.match(html,/config.js/);
});
test('build rejects missing or malformed configuration',()=>{
 const result=spawnSync(process.execPath,['scripts/build.mjs'],{encoding:'utf8',env:{...process.env,CLERK_PUBLISHABLE_KEY:'invalid',CLOUDFLARE_API_URL:'https://example.workers.dev'}});assert.notEqual(result.status,0);
});
test('missing backend produces explicit setup state without a fake endpoint',()=>{
 const result=spawnSync(process.execPath,['scripts/build.mjs'],{encoding:'utf8',env:{...process.env,CLERK_PUBLISHABLE_KEY:key,CLOUDFLARE_API_URL:''}});assert.equal(result.status,0,result.stderr);const config=readFileSync('dist/config.js','utf8');assert.match(config,/"apiUrl":null/);assert.match(config,/"backendConfigured":false/);
});
test('isolated Vercel web root builds without exposing backend source',()=>{const result=spawnSync(process.execPath,['scripts/build.mjs','--web-root'],{encoding:'utf8',env:{...process.env,CLERK_PUBLISHABLE_KEY:key,CLOUDFLARE_API_URL:''}});assert.equal(result.status,0,result.stderr);const config=readFileSync('web/dist/config.js','utf8');assert.match(config,/"backendConfigured":false/);});
