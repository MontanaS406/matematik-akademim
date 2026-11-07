import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const exams = fs.readFileSync(new URL('../js/exams.js',import.meta.url),'utf8');
const scripts = Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi), m => m[1]);

test('HTML contains app and main views', () => {
  for (const marker of ['id="study"', 'id="teacher"', "sec.id='mockexam'", 'id="examBody"']) {
    assert.ok((html+exams).includes(marker), `Missing ${marker}`);
  }
});
test('all inline browser scripts parse', () => {
  assert.ok(scripts.length >= 2, 'Expected module scripts');
  for(const dir of ['js','shared','cloudflare-worker'])for(const file of fs.readdirSync(new URL('../'+dir+'/',import.meta.url)).filter(f=>f.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',new URL('../'+dir+'/'+file,import.meta.url).pathname],{encoding:'utf8'});assert.equal(result.status,0,result.stderr)}
  scripts.forEach((js, i) => assert.doesNotThrow(() => new vm.Script(js, {filename: `inline-${i}.js`})));
});
test('real exam source mapping includes TYT and AYT', () => {
  for (const k of ['const OFFICIAL=', 'const ANSWER_KEYS=', '2023', '2024', '2025', '2026', 'TYT', 'AYT']) {
    assert.ok(exams.includes(k), `Missing ${k}`);
  }
});
test('40-question answer sheet and timing are implemented', () => {
  assert.match(exams, /Array\(40\)/);
  assert.match(exams, /const elapsed=\(\)=>/);
  assert.match(exams, /function finish\(/);
});
test('no server API keys in checked files', () => {
  for (const path of [new URL('../index.html', import.meta.url), new URL('../cloudflare-worker/worker.js', import.meta.url)]) {
    const body = fs.readFileSync(path, 'utf8');
    assert.doesNotMatch(body, /sb_secret_|sk-proj-[A-Za-z0-9]/);
  }
});
test('unverified keys cannot be used for official automatic scores',()=>{
  const match=exams.match(/const ANSWER_KEYS=(\{[^;]*\});/);
  assert.ok(match);assert.equal(Object.keys(vm.runInNewContext('('+match[1]+')')).length,0);
  assert.doesNotMatch(exams,/2026 AYT 23.*(?:cevabı A|cevabı A'dır)/);
});
test('scoring extremes and blanks obey four-wrong deduction',()=>{
  const fn=exams.match(/function calcStats\(ans,key\)\{[^\n]+/)[0];
  const score=vm.runInNewContext('('+fn+')');
  assert.equal(score(Array(40).fill('A'),'A'.repeat(40)).net,40);
  assert.equal(score(Array(40).fill('B'),'A'.repeat(40)).net,-10);
  const blank=score(Array(40).fill(null),'A'.repeat(40));assert.equal(blank.net,0);assert.equal(blank.blank,40);
});
