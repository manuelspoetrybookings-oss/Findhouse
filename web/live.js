// Loaded after the existing UI. API mutations replace the prototype's local actions.
window.addEventListener('nh-data',()=>{saved=window.NH.saved;posted=all().filter(p=>p.owner_id===window.NH.me?.id);render();});
window.addEventListener('nh-error',()=>toast('Connection error: '+window.NH.error));
profile=function(){const me=window.NH.me;if(!me)return pageHeader('Your account')+'<div class="page-pad"><button class="primary full" data-live-signin>Sign in</button></div>';return pageHeader('Your account')+`<div class="page-pad"><h2>${e(me.displayName)}</h2><p class="muted" style="margin:10px 0">@${e(me.handle)}</p><form id="live-profile" class="post-form" style="padding:15px 0"><label class="field">Display name<input name="displayName" maxlength="60" required value="${e(me.displayName)}"></label><label class="field">Bio<textarea name="bio" maxlength="280">${e(me.bio||'')}</textarea></label><button class="primary">Save profile</button></form><button class="city-button" data-screen="saved">${icon('heart')}Saved homes</button><button class="city-button" data-screen="my-listings">${icon('home')}My listings</button><button class="city-button" data-live-signout>Sign out</button></div>`;};
function requireSession(){if(!window.NH.me){window.NH.signIn().catch(err=>toast(err.message));return false}return true}
document.addEventListener('click',async event=>{
 const b=event.target.closest('button,a');if(!b)return;
 const action=b.dataset.action;
 const unavailable=b.dataset.message!==undefined||b.dataset.screen==='chats'||b.dataset.mode==='Marketplace'||action==='follow'||action==='new-chat';
 if(unavailable){event.preventDefault();event.stopImmediatePropagation();modal('Coming next','<p>Messaging, following and inspection services are not connected yet. Real sign-in, profiles, listings and saved homes are enabled in this version.</p>');return}
 if(action==='tour'||action==='photo-next'||action==='photo-prev'){event.preventDefault();event.stopImmediatePropagation();toast('Photo uploads are not enabled yet. This cover is illustrative.');return}
 if(action==='signin'||b.hasAttribute('data-live-signin')){event.preventDefault();event.stopImmediatePropagation();window.NH.signIn().catch(err=>toast(err.message));return}
 if(b.hasAttribute('data-live-signout')){event.preventDefault();event.stopImmediatePropagation();try{await window.Clerk.signOut();navigate('welcome')}catch(err){toast(err.message)}return}
 if((b.dataset.screen==='post'||b.dataset.screen==='profile')&&!requireSession()){event.preventDefault();event.stopImmediatePropagation();return}
 const mutation=b.dataset.save?'save':b.dataset.delete?'delete':action==='publish-post'?'post':null;
 if(!mutation)return;event.preventDefault();event.stopImmediatePropagation();if(!requireSession())return;b.disabled=true;
 try{
  if(mutation==='post'){await window.NH.request('/v1/listings',{method:'POST',body:draft});await window.NH.refresh();posted=all().filter(p=>p.owner_id===window.NH.me.id);draft={};postStep=1;navigate('my-listings');toast('Property published.');}
  if(mutation==='delete'){await window.NH.request('/v1/listings/'+encodeURIComponent(b.dataset.delete),{method:'DELETE'});await window.NH.refresh();navigate('my-listings');toast('Property removed.');}
  if(mutation==='save'){const id=b.dataset.save;await window.NH.request('/v1/saved/'+encodeURIComponent(id),{method:saved.includes(id)?'DELETE':'PUT'});await window.NH.syncUser();toast(saved.includes(id)?'Home saved.':'Home removed from saved.');}
 }catch(err){toast(err.message)}finally{b.disabled=false}
},true);
document.addEventListener('submit',async event=>{
 if(event.target.id!=='live-profile')return;event.preventDefault();event.stopImmediatePropagation();const data=new FormData(event.target);const button=event.target.querySelector('button');button.disabled=true;
 try{await window.NH.request('/v1/me',{method:'PATCH',body:{displayName:data.get('displayName'),bio:data.get('bio')}});await window.NH.syncUser();toast('Profile saved.')}catch(err){toast(err.message)}finally{button.disabled=false}
},true);
