import test from 'node:test';
import assert from 'node:assert/strict';
import {checkTutorDeployment} from '../scripts/verify-tutor-deployment.mjs';
import {SUPABASE_PUBLIC_CONFIG} from '../shared/supabase-config.js';
const workerUrl='https://worker.example',origin='https://montanas406.github.io';
const health={configured:true,provider:'gemini',auth:'supabase-session',accountProject:SUPABASE_PUBLIC_CONFIG.url,model:'gemini-3.5-flash-lite',billingPolicy:'no-automatic-fallback',teacherIds:Array.from({length:10},(_,i)=>'teacher-'+i),dialogueResponseCount:750};
const response=(value,status=200,allowed=origin)=>Response.json(value,{status,headers:{'Access-Control-Allow-Origin':allowed}});
test('deployment gate accepts only compatible account authentication and checks guest and invalid-session rejection without a real token',async()=>{
 const calls=[];const result=await checkTutorDeployment({workerUrl,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/health')?response(health):response({error:'Rejected'},401)}});
 assert.equal(result.ok,true);assert.equal(calls.length,3);assert.equal(calls[1].options.headers.Authorization,undefined);assert.match(calls[2].options.headers.Authorization,/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 const probe=calls[2].options.headers.Authorization.slice(7).split('.');assert.equal(Buffer.from(probe[1],'base64url').toString().includes('00000000-0000-4000-8000-000000000000'),true);assert.deepEqual(Buffer.from(probe[2],'base64url'),Buffer.alloc(32));
 assert.ok(calls.every(call=>call.options.redirect==='error'));assert.deepEqual(result.checks,['site-origin','gemini-configured','account-session-auth','account-project','model-policy','teacher-version','guest-denied','invalid-session-denied']);
 assert.deepEqual(result.sessionGates,[{kind:'guest',status:401,originAllowed:true,code:null},{kind:'invalid-session',status:401,originAllowed:true,code:null}]);
});
test('a configured old Gemini Worker does not pass the code-free account deployment gate',async()=>{
 let calls=0;const old={...health};delete old.auth;
 const result=await checkTutorDeployment({workerUrl,fetchImpl:async()=>{calls++;return response(old)}});
 assert.equal(result.ok,false);assert.equal(result.code,'WORKER_AUTH_OUTDATED');assert.equal(calls,1);
});
test('deployment stops for a wrong origin, missing key, different model or a gate that accepts guests',async()=>{
 for(const [payload,status,allowed,code]of [[health,200,'https://wrong.example','WORKER_ORIGIN_NOT_ALLOWED'],[{...health,configured:false},200,origin,'WORKER_NOT_CONFIGURED'],[{...health,accountProject:'https://wrong-project.example'},200,origin,'WORKER_AUTH_PROJECT_MISMATCH'],[{...health,model:'paid-model'},200,origin,'WORKER_MODEL_POLICY_MISMATCH'],[{...health,dialogueResponseCount:30},200,origin,'WORKER_TEACHER_VERSION_MISMATCH']]){
  const result=await checkTutorDeployment({workerUrl,fetchImpl:async()=>response(payload,status,allowed)});assert.equal(result.ok,false);assert.equal(result.code,code);
 }
 const result=await checkTutorDeployment({workerUrl,fetchImpl:async url=>url.endsWith('/health')?response(health):response({code:'TUTOR_AUTH_UNAVAILABLE',error:'private-upstream-fixture'},503)});assert.equal(result.ok,false);assert.equal(result.code,'WORKER_SESSION_GATE_MISMATCH');
 assert.deepEqual(result.sessionGates,[{kind:'guest',status:503,originAllowed:true,code:'TUTOR_AUTH_UNAVAILABLE'}]);assert.ok(!JSON.stringify(result).includes('private-upstream-fixture'));
});
test('invalid endpoints, redirects and failed health checks fail closed without logging credentials or arbitrary provider text',async()=>{
 for(const workerUrl of ['http://worker.example','https://name:private-fixture@worker.example','https://worker.example/api/tutor']){
  const result=await checkTutorDeployment({workerUrl,fetchImpl:async()=>{throw Error('Must not fetch')}});assert.equal(result.code,'INVALID_WORKER_URL');assert.ok(!JSON.stringify(result).includes('private-fixture'));
 }
 const failed=await checkTutorDeployment({workerUrl,fetchImpl:async()=>{throw Error('private-fixture')}});assert.equal(failed.code,'WORKER_HEALTH_UNAVAILABLE');assert.ok(!JSON.stringify(failed).includes('private-fixture'));
 const unsafe=await checkTutorDeployment({workerUrl,fetchImpl:async()=>response({...health,provider:'private-fixture'})});assert.equal(unsafe.code,'WORKER_NOT_CONFIGURED');assert.ok(!JSON.stringify(unsafe).includes('private-fixture'));
});
test('a failing invalid-session gate records only a safe public auth error category without weakening the release check',async()=>{
 let gates=0;const result=await checkTutorDeployment({workerUrl,fetchImpl:async url=>{
  if(url.endsWith('/health'))return response(health);
  if(url.includes('/auth/v1/user'))return Response.json({error_code:'bad_jwt',msg:'private-upstream-fixture'},{status:400});
  return response({code:++gates===1?'TUTOR_SESSION_REQUIRED':'TUTOR_AUTH_UNAVAILABLE'},gates===1?401:503);
 }});
 assert.equal(result.ok,false);assert.equal(result.code,'WORKER_SESSION_GATE_MISMATCH');assert.deepEqual(result.authDiagnostic,{status:400,code:'bad_jwt'});assert.ok(!JSON.stringify(result).includes('private-upstream-fixture'));
});
