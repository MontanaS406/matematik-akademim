import test from 'node:test';
import assert from 'node:assert/strict';
import {createTutorClient,TutorClientError} from '../js/tutor-client.js';
const CONFIG_URL='https://site.example/data/tutor-config.json',WORKER='https://tutor.example';
const OWNER='00000000-0000-4000-8000-000000000001';
const payload={mode:'chat',teacherId:'elif',messages:[{role:'user',content:'Kendi yazdığım soruyu açıkla.'}]};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve}};
const fails=(status,code)=>error=>error instanceof TutorClientError&&error.status===status&&error.code===code;
function fixture({config={workerUrl:WORKER},model=()=>Response.json({answer:'Kısa açıklama.'}),session}={}){
 let owner=OWNER,accessToken='fixture-account-session';const calls=[];
 const api={getUser:()=>owner?{id:owner}:null,getTutorSession:session||(async()=>({userId:owner,accessToken}))};
 const client=createTutorClient({configUrl:CONFIG_URL,account:()=>api,fetchImpl:async(url,options)=>{calls.push({url:String(url),options});return String(url)===CONFIG_URL?Response.json(config):model(url,options)}});
 return{client,calls,api,setOwner:value=>owner=value,setToken:value=>accessToken=value};
}

test('central endpoint configuration is fetched once without credentials and returned as an immutable normalized origin',async()=>{
 const gate=deferred(),calls=[];
 const client=createTutorClient({configUrl:CONFIG_URL,account:()=>null,fetchImpl:async(url,options)=>{calls.push({url:String(url),options});return gate.promise}});
 const first=client.getConfig(),second=client.getConfig();assert.equal(calls.length,1);
 gate.resolve(Response.json({workerUrl:WORKER+'/',GEMINI_API_KEY:'ignored-server-field'}));
 const a=await first,b=await second;assert.strictEqual(a,b);assert.ok(Object.isFrozen(a));assert.deepEqual(a,{workerUrl:WORKER});assert.throws(()=>a.workerUrl='https://wrong.example',TypeError);
 assert.strictEqual(await client.getConfig(),a);assert.equal(calls.length,1);
 assert.equal(calls[0].url,CONFIG_URL);assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers,undefined);assert.ok(calls[0].options.signal instanceof AbortSignal);
});
test('normal account sessions are refreshed by the account API for each request and never replaced by a shared access code',async()=>{
 const f=fixture();let sessionReads=0;const original=f.api.getTutorSession;f.api.getTutorSession=async()=>{sessionReads++;return original()};
 const local=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),session=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');let storageReads=0;
 const oldStore={getItem:()=>{storageReads++;return'legacy-code-or-attacker-endpoint'}};
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:oldStore});Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:oldStore});
 try{
  await f.client.request(payload);f.setToken('newly-refreshed-fixture-session');await f.client.request(payload);
  const requests=f.calls.filter(call=>call.url!==CONFIG_URL);assert.equal(requests.length,2);assert.equal(sessionReads,2);assert.equal(storageReads,0);
  assert.equal(requests[0].options.headers.Authorization,'Bearer fixture-account-session');assert.equal(requests[1].options.headers.Authorization,'Bearer newly-refreshed-fixture-session');
  for(const request of requests){assert.equal(request.url,WORKER+'/api/tutor');assert.equal(request.options.redirect,'error');assert.equal(request.options.credentials,'omit');assert.deepEqual(JSON.parse(request.options.body),payload);assert.equal(new Headers(request.options.headers).get('x-goog-api-key'),null)}
 }finally{if(local)Object.defineProperty(globalThis,'localStorage',local);else delete globalThis.localStorage;if(session)Object.defineProperty(globalThis,'sessionStorage',session);else delete globalThis.sessionStorage}
});
test('guests or an unavailable account session cannot fetch a provider or spend quota',async()=>{
 for(const api of [null,{getUser:()=>null},{getUser:()=>({id:OWNER})}]){
  let calls=0;const client=createTutorClient({configUrl:CONFIG_URL,account:()=>api,fetchImpl:async()=>{calls++;throw Error('No network expected')}});
  await assert.rejects(client.request(payload),fails(401,'TUTOR_SESSION_REQUIRED'));assert.equal(calls,0);
 }
});
test('unsafe, absent or malformed endpoints fail before obtaining a session or sending account credentials',async()=>{
 for(const config of [null,[],{}, {workerUrl:''},{workerUrl:42},{workerUrl:'http://tutor.example'},{workerUrl:'https://name:password@tutor.example'},{workerUrl:'https://tutor.example/private'},{workerUrl:'https://tutor.example/?key=secret'},{workerUrl:'https://tutor.example/#fragment'}]){
  let sessionReads=0;const f=fixture({config,session:async()=>{sessionReads++;return{userId:OWNER,accessToken:'fixture'}}});
  await assert.rejects(f.client.request(payload),fails(503,'TUTOR_SERVICE_NOT_CONFIGURED'));assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,CONFIG_URL);assert.equal(sessionReads,0);
 }
});
test('configuration redirects and failures are not cached as a successful service and can be retried safely',async()=>{
 for(const firstResponse of [()=>new Response('unavailable',{status:503}),()=>new Response('not-json'),()=>{const response=Response.json({workerUrl:WORKER});Object.defineProperty(response,'redirected',{value:true});return response}]){
  let calls=0;const client=createTutorClient({configUrl:CONFIG_URL,account:()=>null,fetchImpl:async()=>++calls===1?firstResponse():Response.json({workerUrl:WORKER})});
  await assert.rejects(client.getConfig(),fails(503,'TUTOR_SERVICE_NOT_CONFIGURED'));assert.deepEqual(await client.getConfig(),{workerUrl:WORKER});assert.equal(calls,2);
 }
});
test('account changes while loading central configuration prevent any session read or Worker request',async()=>{
 const gate=deferred();let owner=OWNER,sessionReads=0,calls=0;
 const api={getUser:()=>owner?{id:owner}:null,getTutorSession:async()=>{sessionReads++;return{userId:OWNER,accessToken:'fixture'}}};
 const client=createTutorClient({configUrl:CONFIG_URL,account:()=>api,fetchImpl:async()=>{calls++;return gate.promise}});
 const rejected=assert.rejects(client.request(payload),fails(409,'TUTOR_ACCOUNT_CHANGED'));owner=null;gate.resolve(Response.json({workerUrl:WORKER}));await rejected;assert.equal(calls,1);assert.equal(sessionReads,0);
});
test('a refresh result cannot authorize a changed account or a mismatched session owner',async()=>{
 const gate=deferred(),seen=deferred();const f=fixture({session:async()=>{seen.resolve();return gate.promise}});await f.client.getConfig();
 const rejected=assert.rejects(f.client.request(payload),fails(409,'TUTOR_ACCOUNT_CHANGED'));await seen.promise;f.setOwner('00000000-0000-4000-8000-000000000002');gate.resolve({userId:OWNER,accessToken:'old-session'});await rejected;assert.equal(f.calls.length,1);
 const mismatch=fixture({session:async()=>({userId:'different-account',accessToken:'fixture'})});await assert.rejects(mismatch.client.request(payload),fails(409,'TUTOR_ACCOUNT_CHANGED'));assert.equal(mismatch.calls.length,1);
});
test('account replacement or logout while the Worker answers makes the old response unusable',async()=>{
 const gate=deferred(),seen=deferred();const f=fixture({model:async()=>{seen.resolve();return gate.promise}});
 const rejected=assert.rejects(f.client.request(payload),fails(409,'TUTOR_ACCOUNT_CHANGED'));await seen.promise;f.setOwner(null);gate.resolve(Response.json({answer:'Previous account private response'}));await rejected;assert.equal(f.calls.length,2);
 let currentApi={getUser:()=>({id:OWNER}),getTutorSession:async()=>({userId:OWNER,accessToken:'fixture'})};const configGate=deferred();
 const client=createTutorClient({configUrl:CONFIG_URL,account:()=>currentApi,fetchImpl:async()=>configGate.promise});const changed=assert.rejects(client.request(payload),fails(409,'TUTOR_ACCOUNT_CHANGED'));currentApi={...currentApi};configGate.resolve(Response.json({workerUrl:WORKER}));await changed;
});
test('invalid token data and a failed account refresh never become an outbound authorization header',async()=>{
 for(const accessToken of [undefined,null,'','has whitespace','x'.repeat(8193)]){
  const f=fixture({session:async()=>({userId:OWNER,accessToken})});await assert.rejects(f.client.request(payload),fails(401,'TUTOR_SESSION_REQUIRED'));assert.equal(f.calls.length,1);
 }
 const failure=Object.assign(Error('Oturum yenilenemedi.'),{status:401});const f=fixture({session:async()=>{throw failure}});await assert.rejects(f.client.request(payload),error=>error===failure);assert.equal(f.calls.length,1);
});
test('cancellation before authorization or after refresh prevents a Worker call',async()=>{
 const controller=new AbortController();controller.abort();let reads=0;const f=fixture({session:async()=>{reads++;return{userId:OWNER,accessToken:'fixture'}}});
 await assert.rejects(f.client.request(payload,{signal:controller.signal}),error=>error.name==='AbortError');assert.equal(f.calls.length,1);assert.equal(reads,0);
 const gate=deferred(),seen=deferred(),later=new AbortController();const pending=fixture({session:async()=>{seen.resolve();return gate.promise}});const rejected=assert.rejects(pending.client.request(payload,{signal:later.signal}),error=>error.name==='AbortError');await seen.promise;later.abort();gate.resolve({userId:OWNER,accessToken:'fixture'});await rejected;assert.equal(pending.calls.length,1);
});
test('quota errors are returned once for the UI and cannot trigger a model switch or automatic retry',async()=>{
 const f=fixture({model:async()=>Response.json({code:'AI_QUOTA_EXHAUSTED'},{status:429})});
 const response=await f.client.request(payload);assert.equal(response.status,429);assert.equal((await response.json()).code,'AI_QUOTA_EXHAUSTED');assert.equal(f.calls.length,2);assert.equal(f.calls[1].url,WORKER+'/api/tutor');
});
