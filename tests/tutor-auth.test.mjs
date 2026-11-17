import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPABASE_PUBLIC_CONFIG} from '../shared/supabase-config.js';
import {authorizeTutorAccount,resolveTutorAuthConfig,readTutorBearer,TutorAuthError} from '../cloudflare-worker/tutor-auth.js';
import worker from '../cloudflare-worker/worker.js';

const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const token='fixture-session-access',env={GEMINI_API_KEY:'fixture-gemini-key',ALLOWED_ORIGINS:'https://school.example'};
const request=(authorization='Bearer '+token)=>new Request('https://worker.example/api/tutor',{headers:authorization===null?{}:{Authorization:authorization}});
const granted=(extra={})=>({userId:id,confirmed:true,status:'approved',isAdmin:false,bundleReady:false,...extra});
const denied=(status,code)=>error=>error instanceof TutorAuthError&&error.status===status&&(code===undefined||error.code===code);
const authStub=({user={id},approval=granted(),userStatus=200,approvalStatus=200,calls=[]}={})=>async(url,options)=>{
 calls.push({url,options});return url.endsWith('/auth/v1/user')?Response.json(user,{status:userStatus}):Response.json(approval,{status:approvalStatus});
};
const tutorRequest=()=>new Request('https://worker.example/api/tutor',{method:'POST',headers:{Origin:'https://school.example','Content-Type':'application/json',Authorization:'Bearer '+token,'CF-Connecting-IP':'forged-ip'},body:JSON.stringify({mode:'chat',teacherId:'beyza',helpMode:'solution',messages:[{role:'user',content:'Kendi yazdığım sorunun yöntemini açıkla.'}],approved:true,isAdmin:true,userId:other})});
async function withFetch(stub,fn){const original=globalThis.fetch;globalThis.fetch=stub;try{await fn()}finally{globalThis.fetch=original}}

test('browser and Worker share only the same publishable Supabase project identity',()=>{
 const config=resolveTutorAuthConfig();assert.ok(Object.isFrozen(SUPABASE_PUBLIC_CONFIG));assert.ok(Object.isFrozen(config));assert.deepEqual(config,SUPABASE_PUBLIC_CONFIG);
 assert.match(config.key,/^sb_publishable_/);assert.ok(config.url.startsWith('https://'));
 assert.deepEqual(resolveTutorAuthConfig({SUPABASE_URL:'https://project.example/',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public_fixture_key'}),{url:'https://project.example',key:'sb_publishable_public_fixture_key'});
});
test('invalid origins and private or malformed keys fail before sending any session token',async()=>{
 for(const options of [null,[],{SUPABASE_URL:'http://project.example'},{SUPABASE_URL:'https://user:password@project.example'},{SUPABASE_URL:'https://project.example/path'},{SUPABASE_URL:'https://project.example/?key=value'},{SUPABASE_URL:'https://project.example/#token'},{SUPABASE_URL:''},{SUPABASE_PUBLISHABLE_KEY:'sb_secret_should_never_be_used'},{SUPABASE_PUBLISHABLE_KEY:'eyJhbGciOiJIUzI1NiJ9.service_role.signature'},{SUPABASE_PUBLISHABLE_KEY:null}]){
  let calls=0;assert.throws(()=>resolveTutorAuthConfig(options),denied(503));
  await assert.rejects(authorizeTutorAccount(request(),options,{fetchImpl:async()=>{calls++;throw Error('must not call')}}),denied(503));assert.equal(calls,0);
 }
});
test('missing or malformed authorization cannot be replaced by a legacy shared code setting',async()=>{
 for(const authorization of [null,'','Basic secret','Bearer ','Bearer one two','Bearer one,two','Bearer '+('x'.repeat(8193))]){
  assert.throws(()=>readTutorBearer(request(authorization)),denied(401,'TUTOR_SESSION_REQUIRED'));
  let calls=0;await assert.rejects(authorizeTutorAccount(request(authorization),{APP_ACCESS_TOKEN:'old-code'},{fetchImpl:async()=>{calls++;throw Error('must not call')}}),denied(401));assert.equal(calls,0);
 }
 assert.equal(readTutorBearer(request('bearer '+token)),token);
});
test('identity and current approval are verified separately without requesting archive credentials',async()=>{
 const calls=[],actor=await authorizeTutorAccount(request(),{}, {fetchImpl:authStub({calls})});
 assert.deepEqual(actor,{id});assert.ok(Object.isFrozen(actor));assert.equal(calls.length,2);
 assert.equal(calls[0].url,SUPABASE_PUBLIC_CONFIG.url+'/auth/v1/user');assert.equal(calls[0].options.method,'GET');
 assert.equal(calls[1].url,SUPABASE_PUBLIC_CONFIG.url+'/rest/v1/rpc/ma_source_access_status');assert.equal(calls[1].options.method,'POST');assert.equal(calls[1].options.body,'{}');
 for(const call of calls){assert.equal(call.options.headers.apikey,SUPABASE_PUBLIC_CONFIG.key);assert.equal(call.options.headers.Authorization,'Bearer '+token);assert.equal(call.options.redirect,'error');assert.equal(call.options.credentials,'omit');assert.equal(call.options.cache,'no-store');assert.ok(call.options.signal instanceof AbortSignal);assert.ok(!call.url.includes(token));assert.ok(!call.url.includes('archive_access'));}
 assert.equal(Object.keys(actor).length,1,'email, tokens and archive details must not escape authorization');
});
test('rejected sessions and invalid user identities never proceed to permission lookup',async()=>{
 for(const userStatus of [401,403]){
  const calls=[];await assert.rejects(authorizeTutorAccount(request(),{}, {fetchImpl:authStub({userStatus,calls})}),denied(401,'TUTOR_SESSION_INVALID'));assert.equal(calls.length,1);
 }
 for(const user of [{},{id:''},{id:'forged-client-user'},{id:other,user_metadata:{approved:true}},[]]){
  const calls=[];
  const approval=granted();
  const expected=user.id===other?503:user instanceof Array?503:401;
  await assert.rejects(authorizeTutorAccount(request(),{}, {fetchImpl:authStub({user,approval,calls})}),denied(expected));
  assert.equal(calls.length,user.id===other?2:1);
 }
});
test('pending, revoked and unconfirmed membership cannot be bypassed by admin or client metadata',async()=>{
 for(const approval of [granted({status:'none'}),granted({status:'pending'}),granted({status:'revoked'}),granted({status:'email_unconfirmed',confirmed:false}),granted({confirmed:false}),granted({status:'pending',isAdmin:true}),granted({status:'approved',confirmed:'true'})]){
  await assert.rejects(authorizeTutorAccount(request(),{}, {fetchImpl:authStub({user:{id,user_metadata:{isAdmin:true,approved:true},app_metadata:{role:'admin'}},approval})}),denied(typeof approval.confirmed==='boolean'?403:503));
 }
});
test('permission replies must name exactly the server-verified user and use the expected shape',async()=>{
 for(const approval of [granted({userId:other}),granted({userId:undefined}),granted({status:true}),[],null]){
  await assert.rejects(authorizeTutorAccount(request(),{}, {fetchImpl:authStub({approval})}),denied(503,'TUTOR_AUTH_UNAVAILABLE'));
 }
});
test('permission status failures are sanitized and do not retry or silently allow access',async()=>{
 for(const [approvalStatus,expected]of [[401,401],[403,403],[404,503],[429,503],[500,503]]){
  const calls=[];
  await assert.rejects(authorizeTutorAccount(request(),{}, {fetchImpl:authStub({approvalStatus,approval:{error:'sensitive upstream response'},calls})}),error=>{assert.ok(denied(expected)(error));assert.doesNotMatch(error.message,/sensitive/);return true});assert.equal(calls.length,2);
 }
});
test('network, redirect and malformed JSON responses fail closed without exposing upstream detail',async()=>{
 for(const stage of ['user','approval'])for(const bad of [()=>{throw Error('private network detail')},()=>new Response('private upstream detail',{status:500}),()=>new Response('{ invalid JSON'),()=>new Response(null,{status:302,headers:{Location:'https://other.example'}}),()=>{const response=Response.json({id});Object.defineProperty(response,'redirected',{value:true});return response}]){
  let calls=0;
  const fetchImpl=async(url)=>{calls++;if(stage==='approval'&&url.endsWith('/auth/v1/user'))return Response.json({id});return bad()};
  await assert.rejects(authorizeTutorAccount(request(),{}, {fetchImpl}),error=>{assert.ok(denied(503)(error));assert.doesNotMatch(error.message,/private|upstream|network|other\.example/);return true});assert.equal(calls,stage==='user'?1:2);
 }
});
test('approval is checked for every call so revocation takes effect without a cached grant',async()=>{
 let approvals=0,calls=0;const fetchImpl=async(url)=>{calls++;return Response.json(url.endsWith('/auth/v1/user')?{id}:granted({status:++approvals===1?'approved':'revoked'}))};
 assert.deepEqual(await authorizeTutorAccount(request(),{}, {fetchImpl}),{id});
 await assert.rejects(authorizeTutorAccount(request(),{}, {fetchImpl}),denied(403));assert.equal(approvals,2);assert.equal(calls,4);
});
test('forged JWT claims and a legacy static access code do not count as a verified account',async()=>{
 const forged='eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiIsImFwcHJvdmVkIjp0cnVlfQ.';
 for(const value of [forged,'old-shared-access']){
  const calls=[];await assert.rejects(authorizeTutorAccount(request('Bearer '+value),{APP_ACCESS_TOKEN:value},{fetchImpl:authStub({userStatus:401,calls})}),denied(401));assert.equal(calls.length,1);
 }
});
test('health describes account-session authentication without requiring or exposing a shared code',async()=>{
 const response=await worker.fetch(new Request('https://worker.example/health'),env),health=await response.json();assert.equal(health.configured,true);assert.equal(health.auth,'supabase-session');assert.doesNotMatch(JSON.stringify(health),/fixture-gemini-key|access_token|APP_ACCESS_TOKEN|sb_publishable/);
 const invalid=await worker.fetch(new Request('https://worker.example/health'),{...env,SUPABASE_PUBLISHABLE_KEY:'sb_secret_private_fixture'});assert.equal((await invalid.json()).configured,false);
});
test('unapproved or invalid accounts never call Gemini even with a forged client approval',async()=>{
 for(const userStatus of [401,200]){
  const urls=[];await withFetch(async(url)=>{urls.push(url);if(url.endsWith('/auth/v1/user'))return Response.json({id},{status:userStatus});if(url.endsWith('/ma_source_access_status'))return Response.json(granted({status:'revoked'}));throw Error('Gemini must not be called')},async()=>{
   const response=await worker.fetch(tutorRequest(),env);assert.equal(response.status,userStatus===401?401:403);
  });assert.ok(urls.every(url=>url.startsWith(SUPABASE_PUBLIC_CONFIG.url)));assert.equal(urls.length,userStatus===401?1:2);
 }
});
test('rate limiting uses the verified account ID rather than the caller-supplied IP header',async()=>{
 const keys=[],urls=[];await withFetch(authStub({calls:urls}),async()=>{
  const response=await worker.fetch(tutorRequest(),{...env,TUTOR_LIMITER:{limit:async({key})=>{keys.push(key);return {success:false}}}});assert.equal(response.status,429);
 });assert.deepEqual(keys,[id]);assert.equal(urls.length,2);
});
test('an approved ordinary session reaches Gemini without any separate shared access code',async()=>{
 const calls=[];await withFetch(async(url,options)=>{
  calls.push({url,options});if(url.startsWith(SUPABASE_PUBLIC_CONFIG.url))return authStub() (url,options);
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({mode:'chat',explanation:'Seçili matematik adımının gerekçesini birlikte inceleyelim.'})}]}}]});
 },async()=>{
  const response=await worker.fetch(tutorRequest(),env);assert.equal(response.status,200);const answer=await response.json();assert.equal(answer.teacherId,'beyza');assert.equal(answer.mode,'chat');
 });assert.equal(calls.length,3);assert.ok(calls[2].url.startsWith('https://generativelanguage.googleapis.com/'));assert.equal(calls[2].options.headers['x-goog-api-key'],'fixture-gemini-key');
});
