import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi), m => m[1]);

test('HTML contains app and main views', () => {
  for (const marker of ['id="study"', 'id="teacher"', "sec.id='mockexam'", 'id="examBody"']) {
    assert.ok(html.includes(marker), `Missing ${marker}`);
  }
});
test('all inline browser scripts parse', () => {
  assert.ok(scripts.length >= 2, 'Expected inline scripts');
  scripts.forEach((js, i) => assert.doesNotThrow(() => new vm.Script(js, {filename: `inline-${i}.js`})));
});
test('real exam source mapping includes TYT and AYT', () => {
  for (const k of ['const OFFICIAL=', 'const ANSWER_KEYS=', '2023', '2024', '2025', '2026', 'TYT', 'AYT']) {
    assert.ok(html.includes(k), `Missing ${k}`);
  }
});
test('40-question answer sheet and timing are implemented', () => {
  assert.match(html, /Array\(40\)/);
  assert.match(html, /const elapsed=\(\)=>/);
  assert.match(html, /function finish\(/);
});
test('no server API keys in checked files', () => {
  for (const path of [new URL('../index.html', import.meta.url), new URL('../cloudflare-worker/worker.js', import.meta.url)]) {
    const body = fs.readFileSync(path, 'utf8');
    assert.doesNotMatch(body, /sb_secret_|sk-proj-[A-Za-z0-9]/);
  }
});
