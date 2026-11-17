import {SUPABASE_PUBLIC_CONFIG} from '../shared/supabase-config.js';

// Account identity and approval are checked by Supabase on every tutor request.
// A client claim, local role or old shared access code never grants access.
export class TutorAuthError extends Error {
 constructor(message,{status=503,code='TUTOR_AUTH_UNAVAILABLE'}={}){
  super(message);this.name='TutorAuthError';this.status=status;this.code=code;
 }
}
const unavailable=()=>new TutorAuthError('Öğretmen erişimi şu anda doğrulanamadı. Daha sonra yeniden dene.');
const invalidSession=()=>new TutorAuthError('Oturumun doğrulanamadı. Hesabına yeniden giriş yap.',{status:401,code:'TUTOR_SESSION_INVALID'});
const approvalRequired=()=>new TutorAuthError('Öğretmen erişimi için hesabının doğrulanmış ve yönetici tarafından onaylanmış olması gerekiyor.',{status:403,code:'TUTOR_ACCESS_REQUIRED'});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function resolveTutorAuthConfig(env={}){
 if(!object(env))throw unavailable();
 const rawUrl=env.SUPABASE_URL===undefined?SUPABASE_PUBLIC_CONFIG.url:env.SUPABASE_URL;
 const key=env.SUPABASE_PUBLISHABLE_KEY===undefined?SUPABASE_PUBLIC_CONFIG.key:env.SUPABASE_PUBLISHABLE_KEY;
 if(typeof rawUrl!=='string'||typeof key!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{10,200}$/.test(key))throw unavailable();
 let url;try{url=new URL(rawUrl)}catch{throw unavailable()}
 if(url.protocol!=='https:'||!url.hostname||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw unavailable();
 return Object.freeze({url:url.origin,key});
}
export function readTutorBearer(request){
 const authorization=request.headers.get('Authorization')||'';
 const match=/^Bearer ([^\s,]+)$/i.exec(authorization);
 if(!match||match[1].length>8192)throw new TutorAuthError('Öğretmeninle konuşmak için hesabına giriş yap.',{status:401,code:'TUTOR_SESSION_REQUIRED'});
 return match[1];
}
async function verifiedJson(fetchImpl,url,options,stage){
 let response;try{response=await fetchImpl(url,{...options,redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(5000)})}catch{throw unavailable()}
 if(response.redirected)throw unavailable();
 if(!response.ok){
  if(response.status===401||stage==='user'&&response.status===403)throw invalidSession();
  if(stage==='approval'&&response.status===403)throw approvalRequired();
  throw unavailable();
 }
 try{const value=await response.json();if(!object(value))throw unavailable();return value}catch(error){if(error instanceof TutorAuthError)throw error;throw unavailable()}
}
export async function authorizeTutorAccount(request,env={}, {fetchImpl=globalThis.fetch}={}){
 const token=readTutorBearer(request),config=resolveTutorAuthConfig(env);
 const headers={apikey:config.key,Authorization:'Bearer '+token,Accept:'application/json'};
 const user=await verifiedJson(fetchImpl,config.url+'/auth/v1/user',{method:'GET',headers},'user');
 if(typeof user.id!=='string'||!uuid.test(user.id))throw invalidSession();
 const approval=await verifiedJson(fetchImpl,config.url+'/rest/v1/rpc/ma_source_access_status',{
  method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'
 },'approval');
 if(approval.userId!==user.id||typeof approval.confirmed!=='boolean'||typeof approval.status!=='string')throw unavailable();
 if(approval.confirmed!==true||approval.status!=='approved')throw approvalRequired();
 return Object.freeze({id:user.id});
}
