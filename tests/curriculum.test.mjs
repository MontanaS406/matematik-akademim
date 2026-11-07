import test from 'node:test';import assert from 'node:assert/strict';
import {COURSES,getCourse,buildStudyPlan} from '../shared/curriculum.js';
test('27 concept lessons preserve prerequisite order without carrying authored questions',()=>{
 assert.equal(COURSES.length,27);const seen=new Set();for(const course of COURSES){for(const id of course.prerequisites)assert.ok(seen.has(id));seen.add(course.id);assert.ok(course.lessonSteps.length>=3);assert.equal('exercises' in course,false);assert.equal('example' in course,false);assert.equal('prompt' in course,false);assert.ok(course.lessonSteps.every(s=>!s.includes('?')))}assert.equal(getCourse('unknown'),null);
});
test('study plan preserves prerequisite and malformed-progress protections',()=>{
 assert.deepEqual(buildStudyPlan().map(p=>p.courseId),['numbers']);assert.deepEqual(buildStudyPlan({numbers:{correct:1,total:1}}).map(p=>p.courseId),['numbers']);
 assert.ok(buildStudyPlan({numbers:{correct:4,total:5}}).some(p=>p.courseId==='fractions'));assert.ok(!buildStudyPlan({numbers:{correct:4,total:5}}).some(p=>p.courseId==='derivative'));
 assert.deepEqual(buildStudyPlan(Object.create({numbers:{correct:5,total:5}})).map(p=>p.courseId),['numbers']);
});
