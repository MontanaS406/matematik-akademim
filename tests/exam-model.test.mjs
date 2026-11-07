import test from 'node:test';
import assert from 'node:assert/strict';
import {EXAM_YEARS, elapsedSeconds, pauseSession, resumeSession, validateDraft, fullSessionSeconds, reviewQuestions, topicStats, compareRecords} from '../shared/exam-model.js';
const draft = () => ({type:'TYT',year:2018,started:1000,index:0,limit:3600,answers:Array(40).fill(null)});
test('2018–2026 drafts use 40 valid answers and reject malformed time state',()=>{
  assert.equal(EXAM_YEARS.length,9);assert.ok(validateDraft(draft(),20000));
  for(const bad of [{year:2017},{type:'fake'},{answers:Array(39).fill(null)},{index:40},{started:30000},{pausedMs:30000},{pausedAt:30000},{pausedAt:500},{pausedMs:-1}])assert.equal(validateDraft({...draft(),...bad},20000),null);
});
test('pause/resume excludes paused time exactly once and supports reload',()=>{
  const s=draft();assert.equal(elapsedSeconds(s,12000),11);pauseSession(s,12000);pauseSession(s,14000);
  assert.equal(elapsedSeconds(s,70000),11);
  const restored=validateDraft(JSON.parse(JSON.stringify(s)),70000);assert.ok(restored);
  resumeSession(restored,70000);resumeSession(restored,80000);assert.equal(elapsedSeconds(restored,80000),21);
  restored.finishedDuration=21;assert.equal(elapsedSeconds(restored,150000),21);
});
test('full session presets distinguish historical TYT and AYT',()=>{
  assert.equal(fullSessionSeconds(2018,'TYT'),8100);assert.equal(fullSessionSeconds(2020,'TYT'),9900);assert.equal(fullSessionSeconds(2021,'TYT'),8100);assert.equal(fullSessionSeconds(2026,'AYT'),10800);
});
test('review and topic stats require an actual saved key and user labels',()=>{
  const r={markedAnswers:['A','B',...Array(38).fill(null)],answerKey:'A'.repeat(40),topics:['Sayılar','Sayılar']};
  assert.equal(reviewQuestions(r)[1].status,'wrong');assert.deepEqual(topicStats(r),[{topic:'Sayılar',correct:1,wrong:1,blank:0,total:2}]);
  assert.deepEqual(topicStats({...r,answerKey:null}),[]);assert.deepEqual(topicStats({...r,topics:[]}),[]);
});
test('comparison rejects different types/modes and never scores null net as zero',()=>{
  const a={type:'TYT',net:null,duration:30,year:2024};const b={type:'TYT',net:10,duration:60,year:2025};
  assert.equal(compareRecords(a,b).netDifference,null);assert.equal(compareRecords({...a,net:7},b).netDifference,3);
  assert.equal(compareRecords(a,{...b,type:'AYT'}),null);assert.equal(compareRecords(a,{...b,mode:'full'}),null);
});
