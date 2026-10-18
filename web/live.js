// Loaded after the existing UI. API mutations replace the prototype's local actions.
if(!window.NAIJA_CONFIG.apiUrl){const notice=document.createElement('div');notice.className='feature-note';notice.style.margin='0';notice.style.borderRadius='0';notice.textContent='Account sign-in is connected. Listings will be available once the Cloudflare backend is connected.';document.querySelector('.app-shell').prepend(notice);}
window.addEventListener('nh-data',()=>{saved=window.NH.saved;posted=all().filter(p=>p.owner_id===window.NH.me?.id);render();});
window.addEventListener('nh-error',()=>toast('Connection error: '+window.NH.error));
profile=function(){const me=window.NH.me;if(!me)return pageHeader('Your account')+'<div class="page-pad"><button class="primary full" data-live-signin>Sign in</button></div>';return pageHeader('Your account')+`<div class="page-pad"><h2>${e(me.displayName)}</h2><p class="muted" style="margin:10px 0">@${e(me.handle)}</p><form id="live-profile" class="post-form" style="padding:15px 0"><label class="field">Display name<input name="displayName" maxlength="60" required value="${e(me.displayName)}"></label><label class="field">Bio<textarea name="bio" maxlength="280">${e(me.bio||'')}</textarea></label><button class="primary">Save profile</button></form><button class="city-button" data-screen="saved">${icon('heart')}Saved homes</button><button class="city-button" data-screen="my-listings">${icon('home')}My listings</button><button class="city-button" data-live-signout>Sign out</button></div>`;};
function requireSession(){if(!window.NH.me){window.NH.signIn().catch(err=>toast(err.message));return false}return true}
document.addEventListener('click',async event=>{
 const b=event.target.closest('button,a');if(!b)return;
 const action=b.dataset.action;
 if(!window.NAIJA_CONFIG.apiUrl&&(b.dataset.screen==='post'||b.dataset.screen==='profile'||b.dataset.save||action==='publish-post')){event.preventDefault();event.stopImmediatePropagation();modal('Backend setup pending','<p>Clerk sign-in is connected. Listings, profiles and saved homes will be available after the Cloudflare API is deployed and its URL is added to Vercel.</p>'+(window.Clerk?.session?'<button class="primary full" data-live-signout>Sign out</button>':'<button class="primary full" data-live-signin>Sign in</button>'));return}
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

// Community features use server records exclusively. No prototype conversations or requests.
const communityState={following:[],conversations:[],inspections:[],users:[],person:null,conversation:null,messages:[],inspection:null,loading:false,error:'',generation:0};
const communityAPI=(path,options)=>window.NH.request('/v1/community'+path,options);
const communityButton=(label,attrs,secondary=false)=>`<button type="button" class="${secondary?'secondary':'primary'}" ${attrs}>${e(label)}</button>`;
const communityEmpty=(label)=>empty(label,'');
const communityBaseRender=render,communityBaseHome=home,communityBaseDetail=detail,communityBaseProfile=profile;
home=function(){return communityBaseHome().replace(/<article class="feed-card">([\s\S]*?)<\/article>/g,(html)=>{
 const id=html.match(/data-detail="([^"]+)"/)?.[1],p=all().find(p=>p.id===id);if(!p)return html;
 return html.replace('data-message="0"',`data-peer="${e(p.owner_id)}"`).replace('data-screen="profile"',`data-person="${e(p.owner_id)}"`).replace('data-action="follow"',`data-follow="${e(p.owner_id)}"`).replace(/>Follow(?:ing)?<\/button>/,`>${communityState.following.includes(p.owner_id)?'Following':'Follow'}</button>`);
});};
detail=function(){const p=property();return communityBaseDetail().replace('data-message="0"',`data-peer="${e(p.owner_id)}"`).replace('Photo uploads and messaging are not enabled yet.','Photo uploads are not enabled yet.').replace('Contact the demo agent to try the messaging flow.','Message the listing owner to ask about the property.').replace('<div class="detail-agent">',`<div style="display:flex;gap:8px;margin:16px 0">${communityButton('Owner profile',`data-person="${e(p.owner_id)}"`)}${communityButton('Request inspection',`data-inspection-new="${e(p.id)}"`)}</div><div class="detail-agent">`);};
profile=function(){return communityBaseProfile()+ (window.NH.me?`<div class="page-pad"><p>${Number(window.NH.me.followersCount)||0} followers · ${Number(window.NH.me.followingCount)||0} following</p><div style="display:flex;gap:8px;margin-top:12px">${communityButton('Find people','data-community="people"')}${communityButton('Following','data-community="following"')}${communityButton('My inspections','data-community="inspections"')}</div></div>`:'');};
function communityHeader(title){return pageHeader(title)+`<div class="page-pad">${communityState.loading?'<p role="status">Loading…</p>':''}${communityState.error?`<p role="alert">${e(communityState.error)}</p>${communityButton('Retry','data-community-retry')}`:''}`;}
function peopleRows(users){return users.map(p=>`<article style="padding:14px 0;border-bottom:1px solid #eee;display:flex;gap:12px;align-items:center"><button data-person="${e(p.id)}" style="text-align:left;flex:1"><b>${e(p.displayName)}</b><p>@${e(p.handle||'')}</p></button>${communityButton('Message',`data-peer="${e(p.id)}"`)}</article>`).join('');}
function messageRows(){return communityState.messages.map(m=>`<div style="max-width:85%;white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;margin:8px ${m.senderId===window.NH.me?.id?'0 8px auto':'auto 8px 0'};border-radius:14px;background:${m.senderId===window.NH.me?.id?'#d3ff35':'#f0f1f3'}"><p>${e(m.body)}</p><small>${e(new Date(m.createdAt*1000).toLocaleString())}</small></div>`).join('')||'<p>No messages yet. Say hello.</p>';}
function communityView(){
 if(!window.NH.me)return communityHeader('Sign in to continue')+'<button class="primary full" data-live-signin>Sign in</button></div>';
 if(screen==='chats')return communityHeader('Chats')+communityButton('New conversation','data-community="people"')+`<div style="margin-top:16px">${communityState.conversations.map(c=>`<button class="chat-row" data-conversation="${e(c.id)}" style="width:100%;text-align:left"><div><h2>${e(c.displayName)}</h2><p>${e(c.lastMessage||'Start a conversation')}</p><small>${e(new Date(c.updatedAt*1000).toLocaleString())}</small></div></button>`).join('')||communityEmpty('No conversations yet.')}</div><p class="sample-note">Messages refresh every 5 seconds while this screen is open.</p></div>`;
 if(screen==='chat')return communityHeader(communityState.conversation?.displayName||'Conversation')+`<button data-person="${e(communityState.conversation?.peerId||'')}">View profile</button><button class="secondary full" data-older-messages>Load older messages</button><div id="live-message-list" role="log" aria-live="polite">${messageRows()}</div><form id="community-message" class="post-form"><label class="field">Message<textarea name="body" required maxlength="2000" placeholder="Write a message"></textarea></label><button class="primary full">Send</button></form><p class="sample-note">Only conversation participants can access these messages. Delivery refreshes every 5 seconds.</p></div>`;
 if(screen==='people'||screen==='following')return communityHeader(screen==='following'?'Following':'Find people')+`<form id="community-search" class="post-form"><label class="field">Name or handle<input name="q" maxlength="60" placeholder="Search people"></label><button class="primary">Search</button></form>${peopleRows(communityState.users.filter(p=>screen!=='following'||communityState.following.includes(p.id)))||communityEmpty('No people found.')}</div>`;
 if(screen==='person'){
 const p=communityState.person;if(!p)return communityHeader('Profile')+'</div>';
 const mine=p.id===window.NH.me.id;return communityHeader(p.displayName)+`<p>@${e(p.handle)}</p><p style="white-space:pre-wrap;margin:14px 0">${e(p.bio||'')}</p><p>${p.followersCount} followers · ${p.followingCount} following</p><div style="display:flex;gap:10px;margin:16px 0">${mine?communityButton('Edit profile','data-screen="profile"'):communityButton(p.followed?'Unfollow':'Follow',`data-follow="${e(p.id)}"`)+communityButton('Message',`data-peer="${e(p.id)}"`)}</div><h3>Listings</h3>${all().filter(l=>l.owner_id===p.id).map(p=>row(p)).join('')||communityEmpty('No listings yet.')}</div>`;
 }
 if(screen==='marketplace'||screen==='inspections')return communityHeader('Inspection requests')+communityButton('Post a request','data-inspection-new=""')+`<p class="sample-note">Find independent people to inspect a property. Providers are not verified by Lowoo. Budgets are proposals; no payment is collected here. Share access details privately after selecting a provider.</p>${communityState.inspections.map(r=>`<button data-inspection="${e(r.id)}" style="width:100%;text-align:left;padding:16px 0;border-bottom:1px solid #eee"><span class="request-badge">${e(r.status)}</span><h3>${e(r.title)}</h3><p>${e(r.area)} · ${money(r.budget)}</p><small>${e(r.requesterName)}${r.offered?' · You offered to help':''}</small></button>`).join('')||communityEmpty('No inspection requests yet.')}</div>`;
 if(screen==='inspection-new')return communityHeader('Request an inspection')+`<form id="community-inspection" class="post-form"><input type="hidden" name="listingId" value="${e(communityState.listingId||'')}"><label class="field">Title<input name="title" maxlength="100" required value="${e(communityState.listingTitle||'')}"></label><label class="field">Area<input name="area" maxlength="100" required value="${e(communityState.listingArea||'')}"></label><label class="field">What should be checked?<textarea name="details" maxlength="2000" required></textarea></label><label class="field">Proposed budget (₦)<input name="budget" type="number" min="0" max="100000000" step="1" value="5000" required></label><label class="field">Preferred date and time (optional)<input name="preferredAt" type="datetime-local"></label><p class="sample-note">Your title, area and instructions are visible to signed-in users while the request is open. Keep private addresses and contact details out of this form. Scheduling is a preference to confirm with your provider.</p><button class="primary full">Post request</button></form></div>`;
 if(screen==='inspection'){
 const r=communityState.inspection;if(!r)return communityHeader('Inspection')+'</div>';const mine=r.requester_id===window.NH.me.id,assigned=r.provider_id===window.NH.me.id;
 return communityHeader(r.title)+`<span class="request-badge">${e(r.status)}</span><p>${e(r.area)} · ${money(r.budget)}</p><p style="white-space:pre-wrap;margin:16px 0">${e(r.details)}</p>${r.preferred_at?`<p>Preferred: ${e(new Date(r.preferred_at).toLocaleString())}</p>`:''}${communityButton('Requester profile',`data-person="${e(r.requester_id)}"`)} ${!mine?communityButton('Message requester',`data-peer="${e(r.requester_id)}"`):''}${r.provider_id?`<p style="margin-top:16px">Selected provider</p>${communityButton('Provider profile',`data-person="${e(r.provider_id)}"`)} ${communityButton('Message provider',`data-peer="${e(r.provider_id)}"`)}`:''}
 ${r.status==='open'&&!mine?`<div style="margin:16px 0">${communityButton('Offer to inspect',`data-offer="${e(r.id)}"`)}</div>`:''}
 ${r.status==='open'&&mine?`<h3 style="margin-top:20px">Offers</h3>${r.offers.map(p=>`<div style="padding:12px 0"><button data-person="${e(p.id)}">${e(p.displayName)}</button> ${communityButton('Select provider',`data-assign="${e(p.id)}"`)} ${communityButton('Message',`data-peer="${e(p.id)}"`)}</div>`).join('')||'<p>No offers yet.</p>'}`:''}
 ${assigned&&r.status==='assigned'?'<form id="community-report" class="post-form"><label class="field">Inspection report<textarea name="report" maxlength="4000" required placeholder="Describe what you checked and found"></textarea></label><button class="primary full">Submit report</button></form>':''}
 ${r.report?`<h3 style="margin-top:20px">Report</h3><p style="white-space:pre-wrap">${e(r.report)}</p>`:''}
 ${mine&&r.status==='submitted'?communityButton('Confirm completion','data-inspection-action="complete"'):''}
 ${mine&&['open','assigned'].includes(r.status)?`<div style="margin-top:16px">${communityButton('Cancel request','data-inspection-action="cancel"',true)}</div>`:''}</div>`;
 }
 return communityBaseRender();
}
const communityScreens=['chats','chat','people','following','person','marketplace','inspections','inspection-new','inspection'];
render=function(){if(communityScreens.includes(screen)){bottom();$('#app').innerHTML=communityView();}else communityBaseRender();};
async function communityLoad(){
 if(!window.NH.me)return;const generation=++communityState.generation,target=screen;communityState.loading=true;communityState.error='';render();
 try{
  const f=await communityAPI('/following');if(generation!==communityState.generation)return;communityState.following=f.map(x=>x.id);
  let value;
  if(target==='chats')value=await communityAPI('/conversations');
  if(target==='people'||target==='following')value=await communityAPI('/users?q='+encodeURIComponent(communityState.query||'')+(target==='following'?'&following=1':''));
  if(target==='person')value=await communityAPI('/users/'+encodeURIComponent(communityState.personId));
  if(target==='marketplace'||target==='inspections')value=await communityAPI('/inspections');
  if(target==='inspection')value=await communityAPI('/inspections/'+encodeURIComponent(communityState.inspectionId));
  if(target==='chat')value=await communityAPI('/conversations/'+encodeURIComponent(communityState.conversation.id)+'/messages');
  if(generation!==communityState.generation||screen!==target)return;
  const key={chats:'conversations',people:'users',following:'users',person:'person',marketplace:'inspections',inspections:'inspections',inspection:'inspection',chat:'messages'}[target];if(key)communityState[key]=value;
 }catch(err){if(generation===communityState.generation)communityState.error=err.message;}finally{if(generation===communityState.generation){communityState.loading=false;render();}}
}
function communityOpen(target){if($('#modal').open)$('#modal').close();navigate(target);communityLoad();}
async function communityChat(peer){const {id}=await communityAPI('/conversations',{method:'POST',body:{userId:peer}});communityState.conversations=await communityAPI('/conversations');communityState.conversation=communityState.conversations.find(c=>c.id===id);communityState.messages=[];communityOpen('chat');}
document.addEventListener('click',async event=>{
 const b=event.target.closest('button,a');if(!b)return;const d=b.dataset;
 const handled=d.peer!==undefined||d.person!==undefined||d.follow!==undefined||d.community!==undefined||d.conversation!==undefined||d.inspection!==undefined||d.inspectionNew!==undefined||d.offer!==undefined||d.assign!==undefined||d.inspectionAction!==undefined||b.hasAttribute('data-older-messages')||b.hasAttribute('data-community-retry')||d.screen==='chats'||d.mode==='Marketplace'||d.action==='follow'||d.action==='new-chat'||d.message!==undefined;
 if(!handled)return;event.preventDefault();event.stopImmediatePropagation();if(!requireSession())return;b.disabled=true;
 try{
  if(d.peer!==undefined){await communityChat(d.peer);return;}
  if(d.person!==undefined){communityState.personId=d.person;communityState.person=null;communityOpen('person');return;}
  if(d.follow!==undefined){const id=d.follow;await communityAPI('/users/'+encodeURIComponent(id)+'/follow',{method:communityState.following.includes(id)?'DELETE':'PUT'});communityState.following=(await communityAPI('/following')).map(x=>x.id);await window.NH.syncUser();if(screen==='person')await communityLoad();else render();return;}
  if(d.conversation!==undefined){communityState.conversation=communityState.conversations.find(c=>c.id===d.conversation);communityState.messages=[];communityOpen('chat');return;}
  if(d.inspectionNew!==undefined){const p=all().find(p=>p.id===d.inspectionNew);communityState.listingId=p?.id||'';communityState.listingTitle=p?'Inspect '+p.title:'';communityState.listingArea=p?.area||'';communityOpen('inspection-new');return;}
  if(d.inspection!==undefined){communityState.inspectionId=d.inspection;communityState.inspection=null;communityOpen('inspection');return;}
  if(d.offer!==undefined){await communityAPI('/inspections/'+encodeURIComponent(d.offer)+'/offer',{method:'POST',body:{}});toast('Your offer was sent. The requester can select you.');await communityLoad();return;}
  if(d.assign!==undefined||d.inspectionAction!==undefined){await communityAPI('/inspections/'+encodeURIComponent(communityState.inspectionId),{method:'PATCH',body:d.assign?{action:'assign',providerId:d.assign}:{action:d.inspectionAction}});await communityLoad();return;}
  if(b.hasAttribute('data-older-messages')){const first=communityState.messages[0];if(!first){toast('No older messages.');return;}const older=await communityAPI('/conversations/'+encodeURIComponent(communityState.conversation.id)+'/messages?before='+encodeURIComponent(first.id));communityState.messages=[...older,...communityState.messages];$('#live-message-list').innerHTML=messageRows();if(!older.length)toast('You have reached the first message.');return;}
  if(b.hasAttribute('data-community-retry')){await communityLoad();return;}
  communityOpen(d.community|| (d.mode==='Marketplace'?'marketplace':d.screen==='chats'?'chats':'people'));
 }catch(err){toast(err.message);}finally{b.disabled=false;}
},true);
document.addEventListener('submit',async event=>{
 const id=event.target.id;if(!['community-search','community-message','community-inspection','community-report'].includes(id))return;
 event.preventDefault();event.stopImmediatePropagation();if(!requireSession())return;const f=new FormData(event.target),b=event.target.querySelector('button');b.disabled=true;
 try{
  if(id==='community-search'){communityState.query=f.get('q');await communityLoad();}
  if(id==='community-message'){const message=String(f.get('body')||'').trim();if(!message)return;await communityAPI('/conversations/'+encodeURIComponent(communityState.conversation.id)+'/messages',{method:'POST',body:{body:message}});await communityLoad();}
  if(id==='community-inspection'){const input=Object.fromEntries(f);input.budget=Number(input.budget);if(input.preferredAt)input.preferredAt=new Date(input.preferredAt).toISOString();const r=await communityAPI('/inspections',{method:'POST',body:input});communityState.inspectionId=r.id;communityState.inspection=null;communityOpen('inspection');toast('Inspection request posted.');}
  if(id==='community-report'){await communityAPI('/inspections/'+encodeURIComponent(communityState.inspectionId),{method:'PATCH',body:{action:'submit',report:f.get('report')}});await communityLoad();toast('Report sent to requester.');}
 }catch(err){toast(err.message);}finally{b.disabled=false;}
},true);
window.addEventListener('nh-data',()=>{if(!window.NH.me){communityState.generation++;communityState.following=[];communityState.conversations=[];communityState.messages=[];communityState.person=null;communityState.inspections=[];communityState.inspection=null;render();}else if(communityScreens.includes(screen))communityLoad();else communityAPI('/following').then(rows=>{communityState.following=rows.map(x=>x.id);render();}).catch(()=>{});});
let communityPollBusy=false;
setInterval(async()=>{
 if(communityPollBusy||document.hidden||!window.NH.me||!['chat','chats'].includes(screen))return;
 communityPollBusy=true;const target=screen,id=communityState.conversation?.id,user=window.NH.me.id;
 try{if(target==='chats'){const rows=await communityAPI('/conversations');if(screen===target&&window.NH.me?.id===user&&JSON.stringify(rows)!==JSON.stringify(communityState.conversations)){communityState.conversations=rows;render();}}
 else if(id){const rows=await communityAPI('/conversations/'+encodeURIComponent(id)+'/messages');if(screen==='chat'&&communityState.conversation?.id===id&&window.NH.me?.id===user){const existing=new Map(communityState.messages.map(m=>[m.id,m]));rows.forEach(m=>existing.set(m.id,m));const merged=[...existing.values()].sort((a,b)=>a.id.localeCompare(b.id));if(JSON.stringify(merged)!==JSON.stringify(communityState.messages)){communityState.messages=merged;$('#live-message-list').innerHTML=messageRows();}}}
 }catch(err){toast('Message refresh failed: '+err.message);}finally{communityPollBusy=false;}
},5000);
render();
document.addEventListener('submit',async event=>{
 if(event.target.id!=='live-profile')return;event.preventDefault();event.stopImmediatePropagation();const data=new FormData(event.target);const button=event.target.querySelector('button');button.disabled=true;
 try{await window.NH.request('/v1/me',{method:'PATCH',body:{displayName:data.get('displayName'),bio:data.get('bio')}});await window.NH.syncUser();toast('Profile saved.')}catch(err){toast(err.message)}finally{button.disabled=false}
},true);
