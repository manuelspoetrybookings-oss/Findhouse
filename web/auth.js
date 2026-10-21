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
window.addEventListener('load',async()=>{
 try{if(!window.Clerk)throw Error('Clerk could not load. Check the publishable key and network.');await window.Clerk.load({
 ui:{ClerkUI:window.__internal_ClerkUICtor},
 appearance:{
  variables:{colorPrimary:'#25f420',colorPrimaryForeground:'#10120c',colorForeground:'#171a13',colorBackground:'#ffffff',colorInputBackground:'#ffffff',colorInputForeground:'#171a13',colorMutedForeground:'#68705e',colorNeutral:'#171a13',borderRadius:'16px',fontFamily:'Arial, sans-serif'},
  elements:{
   cardBox:{borderRadius:'24px',boxShadow:'0 24px 80px rgba(0,0,0,.2)'},
   card:{background:'#fff',border:'1px solid #edf0e6'},
   headerTitle:{color:'#171a13',fontWeight:'800',letterSpacing:'-.03em'},
   formButtonPrimary:{background:'#25f420',backgroundImage:'none',color:'#10120c',border:'none',boxShadow:'none',fontWeight:'700',minHeight:'46px','&:hover':{background:'#25f420'}},
   socialButtonsBlockButton:{background:'#fff',border:'1px solid #dfe4d5',color:'#171a13',boxShadow:'none',minHeight:'44px'},
   formFieldInput:{border:'1px solid #dfe4d5',borderRadius:'12px',boxShadow:'none','&:focus':{borderColor:'#25f420',boxShadow:'0 0 0 3px rgba(37,244,32,.25)'}},
   footer:{background:'#efffee',backgroundImage:'none'},
   footerActionLink:{color:'#526b00',fontWeight:'700'},
   modalCloseButton:{color:'#171a13'},
  }
 },
 localization:{signIn:{start:{title:'Sign in to rentar',titleCombined:'Sign in to rentar',subtitle:'Your next home starts here.'}},signUp:{start:{title:'Create your rentar account',titleCombined:'Create your rentar account',subtitle:'Find a home. Connect with people.'}}}
 });window.NH.ready=true;
 window.Clerk.addListener(()=>{window.NH.syncUser().catch(err=>{window.NH.error=err.message;window.dispatchEvent(new Event('nh-error'));});});
 await Promise.all([window.NAIJA_CONFIG.apiUrl?window.NH.refresh():Promise.resolve(),window.NH.syncUser()]);
 }catch(err){window.NH.error=err.message;window.dispatchEvent(new Event('nh-error'));}
});
