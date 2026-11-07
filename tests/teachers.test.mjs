import test from 'node:test';
import assert from 'node:assert/strict';
import {TEACHERS, PROFANITY_LEVELS, DEFAULT_TEACHER_ID, resolveTeacherOptions, buildTeacherInstructions} from '../shared/teachers.js';

test('six requested teachers expose distinct metadata and default to a calm beginner', () => {
  assert.deepEqual(TEACHERS.map(t => t.id), ['cagatay', 'beyza', 'zeynep', 'kemal', 'mert', 'elif']);
  assert.equal(DEFAULT_TEACHER_ID, 'elif');
  for (const field of ['name', 'avatar', 'tagline', 'description', 'greeting', 'correctResponse', 'incorrectResponse']) {
    assert.equal(new Set(TEACHERS.map(t => t[field])).size, 6, field);
    assert.ok(TEACHERS.every(t => typeof t[field] === 'string' && t[field].length > 0));
  }
  assert.equal(PROFANITY_LEVELS.length, 4);
});
test('teacher instructions implement architecture, romance, proofs, coaching and small steps', () => {
  const instructions = TEACHERS.map(t => buildTeacherInstructions({teacherId: t.id}));
  assert.equal(new Set(instructions).size, 6);
  assert.match(instructions[1], /ölçekli plan/);
  assert.match(instructions[2], /paralel doğruların imkânsız aşkı/);
  assert.match(instructions[3], /gerekçelendir/);
  assert.match(instructions[4], /ısınma/);
  assert.match(instructions[5], /tek yeni fikir/);
  assert.ok(instructions.every(i => i.includes('küfür kullanma')));
  assert.ok(instructions.every(i => i.includes('Yeni soru, benzer soru, örnek alıştırma veya rastgele sayısal problem oluşturma')));
  assert.ok(instructions.every(i => !i.includes('kontrol sorusu kullan')));
});
test('profanity requires a known level and two explicit adult opt-ins for Çağatay', () => {
  assert.deepEqual(resolveTeacherOptions(), {teacherId: 'elif', profanityLevel: 'off', adultConfirmed: false, profanityConsent: false});
  for (const options of [
    null, [], {teacherId: '__proto__'}, {teacherId: 'unknown'}, {profanityLevel: 'unlimited'},
    {teacherId: 'cagatay', profanityLevel: 'heavy'},
    {teacherId: 'cagatay', profanityLevel: 'heavy', adultConfirmed: true},
    {teacherId: 'cagatay', profanityLevel: 'heavy', adultConfirmed: 'true', profanityConsent: true},
    {teacherId: 'elif', profanityLevel: 'heavy', adultConfirmed: true, profanityConsent: true}
  ]) assert.throws(() => resolveTeacherOptions(options));
  for (const profanityLevel of ['mild', 'heavy', 'extreme']) {
    const instructions = buildTeacherInstructions({teacherId: 'cagatay', profanityLevel, adultConfirmed: true, profanityConsent: true});
    assert.match(instructions, /açıkça seçti/);
    assert.doesNotMatch(instructions, /küfür kullanma/);
    assert.match(instructions, /Tehdit, nefret söylemi/);
  }
});
