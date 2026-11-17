// The site owner configures one public endpoint. Visitors use their normal
// account session; no shared access code or per-browser endpoint is consulted.
export class TutorClientError extends Error {
 constructor(message,{status=503,code='TUTOR_SERVICE_NOT_CONFIGURED'}={}){super(message);this.name='TutorClientError';this.status=status;this.code=code;}
}
const notReady=()=>new TutorClientError('Öğretmen hizmeti henüz hazır değil. Daha sonra yeniden dene.');
const loginRequired=()=>new TutorClientError('Öğretmeninle konuşmak için hesabına giriş yap.',{status:401,code:'TUTOR_SESSION_REQUIRED'});
const accountChanged=()=>new TutorClientError('Hesap değişti. Mesajını yeniden gönderebilirsin.',{status:409,code:'TUTOR_ACCOUNT_CHANGED'});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function createTutorClient({fetchImpl=globalThis.fetch,account=()=>window.MAAccount,configUrl=new URL('../data/tutor-config.json',import.meta.url)}={}){
 let configTask=null;
 const currentId=()=>{try{return account()?.getUser()?.id||null}catch{return null}};
 async function getConfig(){
  if(configTask)return configTask;
  const task=(async()=>{
   let response,value;try{response=await fetchImpl(configUrl,{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(5000)});if(!response.ok||response.redirected)throw notReady();value=await response.json()}catch{throw notReady()}
   if(!object(value)||typeof value.workerUrl!=='string'||!value.workerUrl.trim())throw notReady();
   let url;try{url=new URL(value.workerUrl.trim())}catch{throw notReady()}
   if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw notReady();
   return Object.freeze({workerUrl:url.origin});
  })();
  configTask=task;
  try{return await task}catch(error){if(configTask===task)configTask=null;throw error}
 }
 async function request(payload,{signal}={}){
  const api=account(),owner=currentId();
  if(!owner||typeof api?.getTutorSession!=='function')throw loginRequired();
  const same=()=>account()===api&&currentId()===owner;
  const config=await getConfig();if(!same())throw accountChanged();signal?.throwIfAborted();
  const session=await api.getTutorSession();
  if(!same()||session?.userId!==owner)throw accountChanged();
  if(typeof session.accessToken!=='string'||!session.accessToken||session.accessToken.length>8192||/\s/.test(session.accessToken))throw loginRequired();
  signal?.throwIfAborted();
  const response=await fetchImpl(config.workerUrl+'/api/tutor',{method:'POST',redirect:'error',credentials:'omit',signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.accessToken},body:JSON.stringify(payload)});
  if(!same())throw accountChanged();
  return response;
 }
 return Object.freeze({getConfig,request});
}
