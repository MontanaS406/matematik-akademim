import test from 'node:test';import assert from 'node:assert/strict';
import {modeBooklets,modeSetup} from '../shared/exam-mode-catalog.js';
import {PRIVATE_EXAM_NOTICES} from '../data/turkish-exams.js';
test('the 2024 KPSS Lisans public selection keeps its three original mathematics positions and cancellation scope',()=>{
 const selection={family:'KPSS',year:2024,kpssLevel:'KPSS_LISANS',bookletId:'osym-2024-kpss-lisans-public-partial'},rows=modeBooklets(selection),setup=modeSetup(selection);
 assert.equal(rows.length,1);assert.equal(setup.partial,true);assert.equal(setup.examId,null);assert.equal(setup.questionCount,3);assert.deepEqual(setup.questionNumbers,[31,41,46]);assert.equal(setup.mathStartPage,12);assert.equal(setup.sourceUrl,'https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/LISANS/GYGK14072024.pdf');assert.equal(setup.answerKey,undefined);
 const notice=PRIVATE_EXAM_NOTICES.find(row=>row.examType==='KPSS_LISANS'&&row.year===2024);assert.deepEqual(notice.cancelledNumbers,[42]);assert.ok(!setup.questionNumbers.includes(42),'cancelled full-booklet position is outside the three publicly released questions');
 assert.equal(modeBooklets({...selection,year:2025}).length,0);assert.throws(()=>modeSetup({...selection,kpssLevel:'KPSS_ONLISANS'}));
});
