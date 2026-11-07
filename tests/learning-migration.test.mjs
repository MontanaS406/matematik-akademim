import test from 'node:test';import assert from 'node:assert/strict';
import {captureLearningSnapshot,snapshotKey} from '../shared/learning-migration.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),map}};
test('source-only migration snapshots exact previous records once without changing the original',()=>{
 const s=memory(),raw='{"teacherId":"beyza","attempts":[{"id":"old"}],"diagnostic":{"level":"old"}}';s.setItem('ma_learning_v1_alice',raw);
 assert.equal(captureLearningSnapshot(s,'alice',raw),true);assert.equal(s.getItem(snapshotKey('alice')),raw);assert.equal(s.getItem('ma_learning_v1_alice'),raw);
 assert.equal(captureLearningSnapshot(s,'alice','{"new":true}'),true);assert.equal(s.getItem(snapshotKey('alice')),raw);
 assert.equal(captureLearningSnapshot(s,'bob',{teacherId:'elif'},'remote'),true);assert.notEqual(s.getItem(snapshotKey('bob','remote')),raw);
});
test('failed snapshot cannot silently count as a safe migration',()=>{
 const s=memory();s.setItem('original','untouched');s.setItem=()=>{throw Error('QuotaExceeded')};assert.equal(captureLearningSnapshot(s,'alice',{attempts:[]}),false);assert.equal(s.getItem('original'),'untouched');
 assert.equal(captureLearningSnapshot(s,'alice',null),true);
});
