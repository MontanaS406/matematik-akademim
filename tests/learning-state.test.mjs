import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState, mergeLearningStates, progressFromAttempts} from '../shared/learning-state.js';
const at = '2026-11-07T01:00:00.000Z';
const outcome = (id, correct=true, extra={}) => ({id, courseId:'fractions', exerciseId:'fractions-easy', correct, difficulty:'easy', at, ...extra});
test('profile normalization whitelists learning data and discards secrets/consent',()=>{
  for(const input of [null,undefined,[],42,'bad']) assert.equal(normalizeState(input).teacherId,'elif');
  const state=normalizeState({teacherId:'beyza',courseId:'fractions',difficulty:'medium',preferencesAt:at,adultConfirmed:true,profanityConsent:true,access_token:'do-not-store',chat:['private'],attempts:[outcome('good'),outcome('invalid','true'),outcome('bad-date',true,{at:'not a date'}),null]});
  assert.equal(state.teacherId,'beyza');assert.equal(state.attempts.length,1);
  assert.deepEqual(Object.keys(state),['teacherId','courseId','difficulty','preferencesAt','attempts','diagnostic']);
  assert.doesNotMatch(JSON.stringify(state),/do-not-store|private|adultConfirmed|profanityConsent/);
});
test('profile merge unions attempts without double counting, keeping latest preferences',()=>{
  const a={teacherId:'elif',preferencesAt:at,attempts:[outcome('one'),outcome('two',false)]};
  const b={teacherId:'kemal',preferencesAt:'2026-11-07T02:00:00.000Z',attempts:[outcome('one'),outcome('three')]};
  const state=mergeLearningStates(a,b);
  assert.equal(state.teacherId,'kemal');assert.equal(state.attempts.length,3);
  assert.deepEqual({...progressFromAttempts(state).fractions},{correct:2,total:3});
  assert.deepEqual(mergeLearningStates(state,state),state);
  assert.deepEqual(mergeLearningStates(a,b),mergeLearningStates(b,a));
});
test('same-id outcomes resolve deterministically and latest diagnostic wins',()=>{
  const a={attempts:[outcome('same')],diagnostic:{at,level:'Başlangıç',responses:[{courseId:'fractions',correct:false}]}};
  const b={attempts:[outcome('same',false,{at:'2026-11-07T02:00:00.000Z'})],diagnostic:{at:'2026-11-07T02:00:00.000Z',level:'Temel',responses:[{courseId:'fractions',correct:true}]}};
  const merged=mergeLearningStates(a,b);assert.equal(merged.attempts.length,1);assert.equal(merged.attempts[0].correct,false);assert.equal(merged.diagnostic.level,'Temel');
  assert.deepEqual(merged,mergeLearningStates(b,a));
});
test('large histories are bounded in count and UTF-8 bytes',()=>{
  const attempts=Array.from({length:1200},(_,i)=>outcome('attempt-'+String(i).padStart(4,'0'),true,{at:new Date(Date.parse(at)+i*1000).toISOString()}));
  const state=normalizeState({attempts});
  assert.ok(state.attempts.length<=1000);assert.ok(state.attempts.length>100);
  assert.ok(new TextEncoder().encode(JSON.stringify(state)).length<98000);
  assert.equal(state.attempts.at(-1).id,'attempt-1199');
});
test('unsafe identifiers do not poison progress records',()=>{
  const state=normalizeState({teacherId:'<script>',courseId:'__proto__',attempts:[outcome('bad',true,{courseId:'__proto__'}),outcome('constructor',true,{courseId:'constructor'})]});
  assert.equal(state.teacherId,'elif');assert.equal(state.courseId,null);
  const progress=progressFromAttempts(state);assert.equal(Object.getPrototypeOf(progress),null);assert.deepEqual(progress.constructor,{correct:1,total:1});
});
