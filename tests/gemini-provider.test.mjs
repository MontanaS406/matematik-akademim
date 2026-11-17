import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_GEMINI_MODEL,resolveGeminiModel,GeminiServiceError,generateGemini} from '../cloudflare-worker/gemini.js';

const env={GEMINI_API_KEY:'unit-test-secret',GEMINI_MODEL:'gemini-3.5-flash-lite'};
const responseSchema={type:'object',properties:{mode:{type:'string',enum:['chat']},explanation:{type:'string'}},required:['mode','explanation'],additionalProperties:false};
const request={env,instructions:'SERVER-OWNED-TEACHER-STYLE',messages:[{role:'user',content:'Önceki mesaj.'},{role:'assistant',content:'Önceki yanıt.'},{role:'user',content:'Şimdi gönderdiğim soruyu çöz.'}],responseSchema};
const providerPayload={candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify({mode:'chat',explanation:'AI açıklaması.'})}]}}]};
function assertService(error,status,code){assert.ok(error instanceof GeminiServiceError);assert.equal(error.status,status);assert.equal(error.code,code);assert.doesNotMatch(error.message+' '+JSON.stringify(error),/unit-test-secret|PRIVATE-PROVIDER-DETAIL|legacy-provider/);return true;}

test('only the explicitly selected free-tier-capable model is accepted, with no alternate paid model or endpoint',()=>{
 assert.equal(DEFAULT_GEMINI_MODEL,'gemini-3.5-flash-lite');assert.equal(resolveGeminiModel(),DEFAULT_GEMINI_MODEL);assert.equal(resolveGeminiModel(DEFAULT_GEMINI_MODEL),DEFAULT_GEMINI_MODEL);
 for(const value of ['gemini-4-carbon','gemini-4-argon','gemini-3.5-pro','models/gemini-3.5-flash-lite','https://attacker.example/path',`${DEFAULT_GEMINI_MODEL}:streamGenerateContent`,{},null]){
  assert.throws(()=>resolveGeminiModel(value),error=>assertService(error,503,'AI_MODEL_UNAVAILABLE'));
 }
});

test('Gemini REST authentication keeps the key in a server header and maps conversation roles without changing the user question',async()=>{
 let observed;
 const result=await generateGemini({...request,fetchImpl:async(url,options)=>{observed={url,options,payload:JSON.parse(options.body)};return Response.json(providerPayload)}});
 assert.deepEqual(result,providerPayload);
 assert.equal(observed.url,`https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`);
 assert.doesNotMatch(observed.url,/unit-test-secret|\?key=/);assert.equal(new Headers(observed.options.headers).get('x-goog-api-key'),'unit-test-secret');assert.equal(observed.options.method,'POST');
 assert.equal(observed.options.redirect,'error','a custom API-key header must never follow an unexpected provider redirect');
 assert.deepEqual(observed.payload.systemInstruction,{parts:[{text:request.instructions}]});
 assert.deepEqual(observed.payload.contents,[{role:'user',parts:[{text:request.messages[0].content}]},{role:'model',parts:[{text:request.messages[1].content}]},{role:'user',parts:[{text:request.messages[2].content}]}]);
 assert.equal(observed.payload.generationConfig.responseMimeType,'application/json');assert.deepEqual(observed.payload.generationConfig.responseJsonSchema,responseSchema);assert.equal(observed.payload.generationConfig.maxOutputTokens,2048);
 assert.equal(observed.payload.tools,undefined);assert.equal(observed.payload.cachedContent,undefined);assert.equal(observed.payload.store,undefined);assert.equal(observed.payload.model,undefined);
 assert.ok(observed.options.signal instanceof AbortSignal);
});

test('missing Gemini key or unsupported configuration fails before any provider call, even with a legacy OpenAI key',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return Response.json(providerPayload)};
 await assert.rejects(generateGemini({...request,env:{...env,GEMINI_API_KEY:'',OPENAI_API_KEY:'legacy-provider-must-not-run'},fetchImpl}),error=>assertService(error,503,'AI_CONFIGURATION_REQUIRED'));
 await assert.rejects(generateGemini({...request,env:{...env,GEMINI_MODEL:'gemini-4-carbon'},fetchImpl}),error=>assertService(error,503,'AI_MODEL_UNAVAILABLE'));
 assert.equal(calls,0);
});

test('a 429 response stops once and exposes only the safe retry delay, never billing upgrade or provider detail',async()=>{
 let calls=0;
 await assert.rejects(generateGemini({...request,fetchImpl:async()=>{calls++;return Response.json({error:{message:'PRIVATE-PROVIDER-DETAIL unit-test-secret'}},{status:429,headers:{'Retry-After':'120'}})}}),error=>{assertService(error,429,'AI_QUOTA_EXHAUSTED');assert.equal(String(error.retryAfter),'120');return true});
 assert.equal(calls,1,'quota errors must not trigger an automatic retry or paid fallback');
});

test('malformed retry headers cannot become unbounded or invented quota-reset promises',async()=>{
 for(const value of ['-1','0','Infinity','120 extra','900000','Mon, 16 Nov 2026 00:00:00 GMT']){
  await assert.rejects(generateGemini({...request,fetchImpl:async()=>new Response('{}',{status:429,headers:{'Retry-After':value}})}),error=>{assertService(error,429,'AI_QUOTA_EXHAUSTED');assert.equal(error.retryAfter,undefined);return true});
 }
});

test('billing, key and missing-model failures remain closed without a request to any replacement model',async()=>{
 const expected=new Map([[402,[503,'AI_FREE_TIER_REQUIRED']],[401,[503,'AI_PROVIDER_CONFIGURATION']],[403,[503,'AI_PROVIDER_CONFIGURATION']],[404,[503,'AI_MODEL_UNAVAILABLE']],[500,[502,'AI_UPSTREAM_ERROR']],[503,[502,'AI_UPSTREAM_ERROR']]]);
 for(const [status,[publicStatus,code]]of expected){
  let calls=0;
  await assert.rejects(generateGemini({...request,fetchImpl:async()=>{calls++;return new Response('PRIVATE-PROVIDER-DETAIL unit-test-secret',{status})}}),error=>assertService(error,publicStatus,code));
  assert.equal(calls,1);
 }
});

test('network failures and invalid provider JSON remain sanitized and never retry',async()=>{
 let calls=0;
 await assert.rejects(generateGemini({...request,fetchImpl:async()=>{calls++;throw Error('PRIVATE-PROVIDER-DETAIL unit-test-secret')}}),error=>assertService(error,502,'AI_UPSTREAM_ERROR'));
 assert.equal(calls,1);
 await assert.rejects(generateGemini({...request,fetchImpl:async()=>new Response('not JSON',{status:200})}),error=>assertService(error,502,'AI_UPSTREAM_ERROR'));
});

test('the browser remains a Worker client and never contains a Gemini key or direct provider request',()=>{
 for(const file of ['index.html','js/app.js','js/exams.js']){
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.equal(/AIza[0-9A-Za-z_-]{35}/.test(source),false,file+' must not contain a Google API key');
  assert.equal(/https:\/\/generativelanguage\.googleapis\.com/.test(source),false,file+' must use the Worker rather than call Gemini from the browser');
 }
});
