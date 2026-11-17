// Public deployment compatibility check. Never sends a real session or asks the
// model to generate anything; this gate must pass before publishing the client.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SUPABASE_PUBLIC_CONFIG} from '../shared/supabase-config.js';
const SITE_ORIGIN='https://montanas406.github.io';
export async function checkTutorDeployment({workerUrl,fetchImpl=globalThis.fetch,origin=SITE_ORIGIN}={}){
 const result={ok:false,workerUrl:null,health:null,checks:[],sessionGates:[],code:null};
 const fail=(code)=>({...result,code});
 let base;try{const u=new URL(workerUrl);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')return fail('INVALID_WORKER_URL');base=u.origin;result.workerUrl=base}catch{return fail('INVALID_WORKER_URL')}
 const get=async(path,options={})=>fetchImpl(base+path,{...options,redirect:'error',credentials:'omit',signal:AbortSignal.timeout(15000),headers:{Origin:origin,...options.headers}});
 let response,health;
 try{response=await get('/health');if(!response.ok||response.redirected)return fail('WORKER_HEALTH_UNAVAILABLE');health=await response.json()}catch{return fail('WORKER_HEALTH_UNAVAILABLE')}
 if(!health||typeof health!=='object'||Array.isArray(health))return fail('INVALID_WORKER_HEALTH');
 result.health={configured:health.configured===true,provider:health.provider==='gemini'?'gemini':'unsupported',auth:health.auth==='supabase-session'?'supabase-session':health.auth===undefined?null:'unsupported',model:health.model==='gemini-3.5-flash-lite'?health.model:'unsupported',teacherCount:Array.isArray(health.teacherIds)?health.teacherIds.length:0,dialogueResponseCount:health.dialogueResponseCount};
 if(response.headers.get('Access-Control-Allow-Origin')!==origin)return fail('WORKER_ORIGIN_NOT_ALLOWED');result.checks.push('site-origin');
 if(health.provider!=='gemini'||health.configured!==true)return fail('WORKER_NOT_CONFIGURED');result.checks.push('gemini-configured');
 if(health.auth!=='supabase-session')return fail('WORKER_AUTH_OUTDATED');result.checks.push('account-session-auth');
 if(health.model!=='gemini-3.5-flash-lite'||health.billingPolicy!=='no-automatic-fallback')return fail('WORKER_MODEL_POLICY_MISMATCH');result.checks.push('model-policy');
 if(!Array.isArray(health.teacherIds)||new Set(health.teacherIds).size!==10||health.dialogueResponseCount!==750)return fail('WORKER_TEACHER_VERSION_MISMATCH');result.checks.push('teacher-version');
 const body=JSON.stringify({mode:'chat',teacherId:'elif',messages:[{role:'user',content:'Merhaba.'}]});
 // Probe actual server verification with a well-formed JWT whose signature is
 // deliberately invalid. This is synthetic data, never a real user's session.
 const invalidSession=[{alg:'HS256',typ:'JWT'},{iss:SUPABASE_PUBLIC_CONFIG.url+'/auth/v1',aud:'authenticated',sub:'00000000-0000-4000-8000-000000000000',role:'authenticated',exp:Math.floor(Date.now()/1000)+300}].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).concat(Buffer.alloc(32).toString('base64url')).join('.');
 for(const authorization of [null,'Bearer '+invalidSession]){
  try{
   const denied=await get('/api/tutor',{method:'POST',headers:{'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},body});
   const gate={kind:authorization?'invalid-session':'guest',status:denied.status,originAllowed:denied.headers.get('Access-Control-Allow-Origin')===origin,code:null};
   try{const detail=await denied.json();if(typeof detail?.code==='string'&&/^TUTOR_[A-Z_]{1,60}$/.test(detail.code))gate.code=detail.code}catch{}
   result.sessionGates.push(gate);
   if(denied.status!==401||!gate.originAllowed)return fail('WORKER_SESSION_GATE_MISMATCH');
  }catch{return fail('WORKER_SESSION_GATE_UNAVAILABLE')}
 }
 result.checks.push('guest-denied','invalid-session-denied');return {...result,ok:true,code:'READY'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const {workerUrl}=JSON.parse(readFileSync(new URL('../data/tutor-config.json',import.meta.url),'utf8'));
 const result=await checkTutorDeployment({workerUrl});mkdirSync('work',{recursive:true});writeFileSync('work/tutor-live-preflight.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
}
