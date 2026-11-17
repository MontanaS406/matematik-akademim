import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sourceWorker from '../cloudflare-worker/worker.js';
import bundleWorker from '../cloudflare-worker/bundle/worker.js';
import {SUPABASE_PUBLIC_CONFIG} from '../shared/supabase-config.js';
const env={GEMINI_API_KEY:'bundle-fixture-key',ALLOWED_ORIGINS:'https://school.example'};
const ACTOR_ID='00000000-0000-4000-8000-000000000001',SESSION='bundle-fixture-session';
const request=(token=SESSION)=>new Request('https://worker.example/api/tutor',{method:'POST',headers:{Origin:'https://school.example','Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({mode:'chat',teacherId:'beyza',helpMode:'solution',messages:[{role:'user',content:'Benim sorum x+1=2, adım adım çöz.'}]})});
async function withTransport(fn,{status='approved'}={}){
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{
  const headers=new Headers(options.headers),target=new URL(url);calls.push({url,options});assert.equal(options.redirect,'error');
  if(target.origin===SUPABASE_PUBLIC_CONFIG.url){
   assert.equal(headers.get('apikey'),SUPABASE_PUBLIC_CONFIG.key);assert.equal(headers.get('x-goog-api-key'),null);
   if(headers.get('Authorization')!=='Bearer '+SESSION)return Response.json({error:'Invalid fixture session'},{status:401});
   if(target.pathname==='/auth/v1/user')return Response.json({id:ACTOR_ID});
   assert.equal(target.pathname,'/rest/v1/rpc/ma_source_access_status');assert.deepEqual(JSON.parse(options.body),{});
   return Response.json({userId:ACTOR_ID,confirmed:true,status,isAdmin:false,bundleReady:false});
  }
  assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(headers.get('x-goog-api-key'),'bundle-fixture-key');assert.equal(headers.get('apikey'),null);assert.equal(headers.get('Authorization'),null);
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({mode:'chat',explanation:'Her iki taraftan 1 çıkarılır; x = 1. Yerine koyunca verilen eşitlik sağlanır.'})}]}}]});
 };
 try{await fn(calls)}finally{globalThis.fetch=original}
}
test('dashboard bundle is self-contained and exposes the same account-based health contract as the modular Worker',async()=>{
 const request=()=>new Request('https://worker.example/health');
 const health=await (await bundleWorker.fetch(request(),env)).json();
 assert.deepEqual(health,await (await sourceWorker.fetch(request(),env)).json());assert.equal(health.auth,'supabase-session');assert.equal(health.configured,true);
 const code=readFileSync(new URL('../cloudflare-worker/bundle/worker.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/from\s*["']\.\.?\//,'dashboard deployment must not need repository imports');
 assert.doesNotMatch(code,/api\.openai\.com|OPENAI_API_KEY|OPENAI_MODEL|AIza[\w-]{25,}/);
});
test('the exact dashboard bundle verifies the approved account before solving a user-provided problem through Gemini',async()=>{
 await withTransport(async calls=>{
  const response=await bundleWorker.fetch(request(),env);
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.provider,'gemini');assert.equal(body.teacherId,'beyza');assert.equal(body.mode,'chat');assert.equal(body.isOfficialSolution,false);
  assert.deepEqual(calls.map(call=>new URL(call.url).pathname),['/auth/v1/user','/rest/v1/rpc/ma_source_access_status','/v1beta/models/gemini-3.5-flash-lite:generateContent']);
  assert.equal(calls.length,3,'two account checks and exactly one model call');
 });
});
test('the deployed dashboard bundle refuses legacy codes and revoked users without a Gemini call',async()=>{
 await withTransport(async calls=>{
  const response=await bundleWorker.fetch(request('obsolete-shared-code'),{...env,APP_ACCESS_TOKEN:'obsolete-shared-code'});
  assert.equal(response.status,401);assert.equal((await response.json()).code,'TUTOR_SESSION_INVALID');assert.deepEqual(calls.map(call=>new URL(call.url).pathname),['/auth/v1/user']);
 });
 await withTransport(async calls=>{
  const response=await bundleWorker.fetch(request(),env);assert.equal(response.status,403);assert.equal((await response.json()).code,'TUTOR_ACCESS_REQUIRED');assert.equal(calls.length,2);
 },{status:'revoked'});
});
