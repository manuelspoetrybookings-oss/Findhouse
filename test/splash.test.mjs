import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import vm from 'node:vm';
function fixture(media=[]){
 const classes=new Set(),timers=new Map();let next=0;const attrs={};
 const app={getBoundingClientRect:()=>({top:0,bottom:500}),querySelectorAll:()=>media};
 const context={document:{documentElement:{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)}},getElementById:id=>id==='app'?app:{setAttribute:(k,v)=>attrs[k]=v}},window:{},requestAnimationFrame:fn=>fn(),setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(readFileSync('web/splash.js','utf8'),context);return {loading:context.window.RentarLoading,classes,timers,attrs};
}
test('splash waits for visible media, then releases the app on load',async()=>{
 const events={};const f=fixture([{tagName:'IMG',complete:false,getBoundingClientRect:()=>({top:10,bottom:100,width:100,height:90}),addEventListener:(event,fn)=>events[event]=fn}]);
 f.loading.show();const done=f.loading.finish();await Promise.resolve();assert.equal(f.classes.has('rentar-splash-visible'),true);events.load();await done;assert.equal(f.classes.size,0);assert.equal(f.attrs['aria-hidden'],'true');assert.equal(f.timers.size,0);
});
test('failed media and the startup timeout never trap users behind the splash',async()=>{
 const events={};const f=fixture([{tagName:'VIDEO',readyState:0,getBoundingClientRect:()=>({top:0,bottom:50,width:100,height:50}),addEventListener:(event,fn)=>events[event]=fn}]);
 f.loading.show();let done=f.loading.finish();await Promise.resolve();events.error();await done;assert.equal(f.classes.size,0);
 f.loading.show();[...f.timers.values()].find(t=>t.ms===12000).fn();assert.equal(f.classes.size,0);
});
test('signed-out visitors can skip the splash immediately',async()=>{const f=fixture();assert.equal(f.classes.size,0);f.loading.show();await f.loading.finish(false);assert.equal(f.classes.size,0);});
