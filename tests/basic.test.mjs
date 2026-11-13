import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {QUESTION_BANK} from '../data/question-bank.js';
import {createQuestionRegistry,verifiedExam} from '../shared/question-bank.js';
import {parseAnswerKey,scorePrivateExam} from '../shared/private-exam.js';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const account=fs.readFileSync(new URL('../js/exams.js',import.meta.url),'utf8');
const application=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const scripts=Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi),match=>match[1]);

test('entrypoint contains the learning views and loads the application modules',()=>{
 for(const marker of ['id="study"','id="teacher"','id="library"'])assert.ok(html.includes(marker),`Missing ${marker}`);
 assert.match(html,/src="js\/app\.js/);assert.match(html,/src="js\/exams\.js/);
 const urls=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(match=>new URL(match[1],'https://app.example/'));
 const appVersion=urls.find(url=>url.pathname==='/js/app.js').searchParams.get('v');assert.match(appVersion,/^ai-bank-\d{8}$/);
 for(const file of ['app.js','exams.js']){
  assert.equal(urls.find(url=>url.pathname==='/js/'+file).searchParams.get('v'),appVersion);
  const code=fs.readFileSync(new URL('../js/'+file,import.meta.url),'utf8'),bankImport=code.match(/from\s+['"]([^'"]*data\/question-bank\.js[^'"]*)['"]/);
  assert.ok(bankImport,'Each browser module must name the current cache identity');assert.equal(new URL(bankImport[1],'https://app.example/js/').searchParams.get('v'),appVersion);
 }

});
test('all browser and worker modules parse',()=>{
 assert.ok(scripts.length>=2,'Expected application module scripts');
 for(const dir of ['js','shared','cloudflare-worker','data'])for(const file of fs.readdirSync(new URL('../'+dir+'/',import.meta.url)).filter(file=>file.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',new URL('../'+dir+'/'+file,import.meta.url).pathname],{encoding:'utf8'});assert.equal(result.status,0,result.stderr)}
 scripts.forEach((source,index)=>assert.doesNotThrow(()=>new vm.Script(source,{filename:`inline-${index}.js`})));
});
test('the public application has no upload route or file-picker controller',()=>{
 assert.doesNotMatch(html,/type\s*=\s*["']file["']/i);
 assert.doesNotMatch(application+account,/mountPrivateExams|createExamMode|examModeButton|from\s+['"]\.\/(?:private-exams|exam-mode)\.js/);
 for(const file of ['js/exam-mode.js','js/private-exams.js'])assert.equal(fs.existsSync(new URL('../'+file,import.meta.url)),false,'Removed upload controller must not remain publicly served');
});
test('the empty public registry cannot advertise or restore an official exam',()=>{
 const registry=createQuestionRegistry(QUESTION_BANK);assert.equal(registry.questions.length,0);
 assert.equal(verifiedExam(QUESTION_BANK,'TYT',2026),null);assert.equal(verifiedExam(QUESTION_BANK,'AYT',2026),null);
});
test('no server API keys are included in application files',()=>{
 for(const file of ['index.html','js/app.js','js/exams.js','cloudflare-worker/worker.js'])assert.doesNotMatch(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),/sb_secret_|sk-proj-[A-Za-z0-9]/);
});
test('retained scoring model preserves four-wrong deduction without exposing a bare-sheet UI',()=>{
 const key=parseAnswerKey('A'.repeat(40),40),score=answers=>scorePrivateExam(answers,key,{manual:true});
 assert.equal(score(Array(40).fill('A')).net,40);assert.equal(score(Array(40).fill('B')).net,-10);
 const blank=score(Array(40).fill(null));assert.equal(blank.net,0);assert.equal(blank.blank,40);
});
