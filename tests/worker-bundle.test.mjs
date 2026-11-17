import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sourceWorker from '../cloudflare-worker/worker.js';
import bundleWorker from '../cloudflare-worker/bundle/worker.js';
const env={GEMINI_API_KEY:'bundle-fixture-key',APP_ACCESS_TOKEN:'bundle-fixture-access',ALLOWED_ORIGINS:'https://school.example'};
test('dashboard bundle is self-contained and exposes the same health contract as the modular Worker',async()=>{
 const request=()=>new Request('https://worker.example/health');
 assert.deepEqual(await (await bundleWorker.fetch(request(),env)).json(),await (await sourceWorker.fetch(request(),env)).json());
 const code=readFileSync(new URL('../cloudflare-worker/bundle/worker.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/from\s*["']\.\.?\//,'dashboard deployment must not need repository imports');
 assert.doesNotMatch(code,/api\.openai\.com|OPENAI_API_KEY|OPENAI_MODEL|AIza[\w-]{25,}/);
});
test('the exact dashboard bundle can solve a user-provided problem through Gemini and never calls a fallback',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({mode:'chat',explanation:'Her iki taraftan 1 çıkarılır; x = 1. Yerine koyunca verilen eşitlik sağlanır.'})}]}}]})};
 try{
  const response=await bundleWorker.fetch(new Request('https://worker.example/api/tutor',{method:'POST',headers:{Origin:'https://school.example','Content-Type':'application/json',Authorization:'Bearer bundle-fixture-access'},body:JSON.stringify({mode:'chat',teacherId:'beyza',helpMode:'solution',messages:[{role:'user',content:'Benim sorum x+1=2, adım adım çöz.'}]})}),env);
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.provider,'gemini');assert.equal(body.teacherId,'beyza');assert.equal(body.mode,'chat');assert.equal(body.isOfficialSolution,false);
  assert.equal(calls.length,1);assert.equal(calls[0].url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(calls[0].options.headers['x-goog-api-key'],'bundle-fixture-key');assert.equal(calls[0].options.redirect,'error');
 }finally{globalThis.fetch=original}
});
