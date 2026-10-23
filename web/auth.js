// Clerk is loaded from its own Frontend API domain by the build script.
window.NH={ready:false,error:null,me:null,listings:[],saved:[],
 async request(path,{method='GET',body,auth=true}={}){
  if(!window.NAIJA_CONFIG.apiUrl)throw Error('Cloudflare is not connected yet. Add CLOUDFLARE_API_URL in Vercel and redeploy.');
  const headers={};if(body!==undefined)headers['Content-Type']='application/json';
  if(auth){if(!this.ready)throw Error('Sign-in is still loading. Please try again.');const token=await window.Clerk.session?.getToken();if(!token)throw Error('Please sign in first.');headers.Authorization='Bearer '+token;}
  const response=await fetch(window.NAIJA_CONFIG.apiUrl+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Request failed.');return data;
 },
 async refresh(){this.listings=await this.request('/v1/listings',{auth:false});window.dispatchEvent(new Event('nh-data'));},
 async signIn(){if(!this.ready)throw Error(this.error||'Sign-in is still loading. Please try again.');window.Clerk.openSignIn();},
 async syncUser(){this.me=null;this.saved=[];if(window.Clerk.session&&window.NAIJA_CONFIG.apiUrl){const [me,saved]=await Promise.all([this.request('/v1/me'),this.request('/v1/saved')]);this.me=me;this.saved=saved.map(x=>x.id);}window.dispatchEvent(new Event('nh-data'));}
};
async function initializeRentarAuth(){
 try{if(!window.Clerk)throw Error('Clerk could not load. Check the publishable key and network.');await window.Clerk.load({
 ui:{ClerkUI:window.__internal_ClerkUICtor},
 appearance:{
  variables:{colorPrimary:'#a7ea07',colorPrimaryForeground:'#10120c',colorForeground:'#171a13',colorBackground:'#ffffff',colorInputBackground:'#ffffff',colorInputForeground:'#171a13',colorMutedForeground:'#68705e',colorNeutral:'#171a13',borderRadius:'16px',fontFamily:'Arial, sans-serif'},
  elements:{
   cardBox:{borderRadius:'24px',boxShadow:'0 24px 80px rgba(0,0,0,.2)'},
   card:{background:'#fff',border:'1px solid #edf0e6'},
   headerTitle:{color:'#171a13',fontWeight:'800',letterSpacing:'-.03em'},
   formButtonPrimary:{background:'#a7ea07',backgroundImage:'none',color:'#10120c',border:'none',boxShadow:'none',fontWeight:'700',minHeight:'46px','&:hover':{background:'#a7ea07'}},
   socialButtonsBlockButton:{background:'#fff',border:'1px solid #dfe4d5',color:'#171a13',boxShadow:'none',minHeight:'44px'},
   formFieldInput:{border:'1px solid #dfe4d5',borderRadius:'12px',boxShadow:'none','&:focus':{borderColor:'#a7ea07',boxShadow:'0 0 0 3px rgba(167,234,7,.25)'}},
   footer:{background:'#f5fde6',backgroundImage:'none'},
   footerActionLink:{color:'#526b00',fontWeight:'700'},
   modalCloseButton:{color:'#171a13'},
  }
 },
 localization:{signIn:{start:{title:'Sign in to rentar',titleCombined:'Sign in to rentar',subtitle:'Your next home starts here.'}},signUp:{start:{title:'Create your rentar account',titleCombined:'Create your rentar account',subtitle:'Find a home. Connect with people.'}}}
 });window.NH.ready=true;
 let sessionId=window.Clerk.session?.id||null;
 async function loadSession(initial){
  const signedIn=!!window.Clerk.session;
  try{localStorage.setItem('rentar-authenticated',signedIn?'1':'0');}catch{}
  if(signedIn)window.RentarLoading?.show();else window.RentarLoading?.hide();
  window.dispatchEvent(new CustomEvent('nh-session',{detail:{signedIn,initial}}));
  try{await Promise.all([window.NAIJA_CONFIG.apiUrl?window.NH.refresh():Promise.resolve(),window.NH.syncUser()]);}
  catch(err){window.NH.error=err.message;window.dispatchEvent(new Event('nh-error'));}
  finally{await window.RentarLoading?.finish(signedIn);}
 }
 await loadSession(true);
 window.Clerk.addListener(()=>{const next=window.Clerk.session?.id||null;if(next!==sessionId){sessionId=next;loadSession(false);}});
 }catch(err){window.NH.error=err.message;window.dispatchEvent(new Event('nh-error'));window.RentarLoading?.hide();}
}
if(document.readyState==='complete')initializeRentarAuth();else window.addEventListener('DOMContentLoaded',initializeRentarAuth,{once:true});
