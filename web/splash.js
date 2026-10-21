// The saved hint controls presentation only. Clerk remains the source of authentication.
(()=>{
 const root=document.documentElement,overlay=document.getElementById('loading-splash');let timer,generation=0;
 function show(){generation++;root.classList.add('rentar-splash-visible');overlay?.setAttribute('aria-hidden','false');const app=document.querySelector?.('.app-shell');if(app)app.inert=true;clearTimeout(timer);timer=setTimeout(hide,12000);}
 function hide(){generation++;clearTimeout(timer);root.classList.remove('rentar-splash-visible');overlay?.setAttribute('aria-hidden','true');const app=document.querySelector?.('.app-shell');if(app)app.inert=false;}
 async function finish(waitForMedia=true){
  if(!waitForMedia){hide();return;}
  const cycle=generation;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const app=document.getElementById('app'),bounds=app?.getBoundingClientRect();
  const media=[...(app?.querySelectorAll('img,video')||[])].filter(el=>{const r=el.getBoundingClientRect();return bounds&&r.bottom>bounds.top&&r.top<bounds.bottom&&r.width>0&&r.height>0;}).slice(0,6);
  const pending=media.map(el=>new Promise(resolve=>{
   if(el.tagName==='IMG'&&el.complete||el.tagName==='VIDEO'&&el.readyState>=2){resolve();return;}
   el.addEventListener(el.tagName==='IMG'?'load':'loadeddata',resolve,{once:true});el.addEventListener('error',resolve,{once:true});
  }));
  let timeout;await Promise.race([Promise.allSettled(pending),new Promise(resolve=>{timeout=setTimeout(resolve,6000);})]);clearTimeout(timeout);if(cycle===generation)hide();
 }
 window.RentarLoading={show,hide,finish};
 if(root.classList.contains('rentar-splash-visible'))show();
})();
