import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare-worker/worker.js';
const env = {OPENAI_API_KEY:'test-only', APP_ACCESS_TOKEN:'test-access', ALLOWED_ORIGINS:'https://school.example'};
const req = (body, headers={}) => new Request('https://worker.example/api/tutor', {method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer test-access',Origin:'https://school.example',...headers},body:JSON.stringify(body)});
const valid = {messages:[{role:'user',content:'2+2 neden 4?'}]};
test('worker denies untrusted origin and missing authorization', async()=>{
  assert.equal((await worker.fetch(req(valid,{Origin:'https://evil.example'}),env)).status,403);
  assert.equal((await worker.fetch(req(valid,{Authorization:''}),env)).status,401);
});
test('worker rejects malformed payloads without throwing',async()=>{
  for(const body of [null,[],{}, {messages:[null]}, {messages:[{role:'system',content:'x'}]}, {messages:[{role:'user',content:' '}]}, {messages:[{role:'assistant',content:'x'}]}]) assert.equal((await worker.fetch(req(body),env)).status,400);
  assert.equal((await worker.fetch(req(valid,{'Content-Type':'text/plain'}),env)).status,415);
});
test('worker enforces real UTF-8 body bytes without a length header',async()=>{
  assert.equal((await worker.fetch(req({messages:[{role:'user',content:'ş'.repeat(9000)}]}),env)).status,413);
});
test('worker rate limit prevents upstream calls',async()=>{
  const r=await worker.fetch(req(valid),{...env,TUTOR_LIMITER:{limit:async()=>({success:false})}});
  assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'60');
});
test('worker successful response and upstream failure handling',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async(url,options)=>{const b=JSON.parse(options.body);assert.equal(b.store,false);assert.equal(b.input[0].role,'user');return Response.json({output:[{content:[{type:'output_text',text:'Dört eder.'}]}]})};
    let r=await worker.fetch(req(valid),env);assert.equal(r.status,200);assert.deepEqual(await r.json(),{answer:'Dört eder.'});assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://school.example');
    globalThis.fetch=async()=>new Response('private upstream details',{status:500});r=await worker.fetch(req(valid),env);assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/private/);
    globalThis.fetch=async()=>Response.json({output:[]});assert.equal((await worker.fetch(req(valid),env)).status,502);
    globalThis.fetch=async()=>{throw Error('secret')};assert.equal((await worker.fetch(req(valid),env)).status,502);
  }finally{globalThis.fetch=original}
});
