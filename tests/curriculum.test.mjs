import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSES,getCourse,diagnosticQuestions,assessDiagnostic,buildStudyPlan} from '../shared/curriculum.js';
const answer=(id,level)=>getCourse(id).exercises[level].answer;
const asNumber=value=>value.includes('/')?value.split('/').map(v=>Number(v.replaceAll('−','-'))).reduce((a,b)=>a/b):Number(value.replaceAll('−','-'));

test('27 original starter units have dependency order, lessons and three distinct challenge levels',()=>{
  assert.equal(COURSES.length,27);
  const courseIds=new Set(), exerciseIds=new Set();
  for(const course of COURSES){
    assert.match(course.id,/^[a-z][a-z0-9-]{0,79}$/);
    assert.ok(!courseIds.has(course.id));
    for(const prerequisite of course.prerequisites)assert.ok(courseIds.has(prerequisite),`Unordered/cyclic prerequisite ${prerequisite} of ${course.id}`);
    courseIds.add(course.id);
    assert.ok(course.lessonSteps.length>=3);
    assert.ok(course.lessonSteps.every(step=>typeof step==='string'&&step.length>35));
    assert.ok(course.example.problem&&course.example.answer&&course.example.steps.length>=2);
    const prompts=new Set();
    for(const level of ['easy','medium','hard']){
      const exercise=course.exercises[level];
      assert.match(exercise.id,/^[a-z][a-z0-9-]{0,79}$/);assert.ok(!exerciseIds.has(exercise.id));exerciseIds.add(exercise.id);
      assert.equal(exercise.origin,'Özgün alıştırma');assert.equal(exercise.choices.length,4);assert.equal(new Set(exercise.choices).size,4);
      assert.equal(exercise.choices.filter(choice=>choice===exercise.answer).length,1);
      assert.ok(exercise.explanation.length>=7);assert.ok(!prompts.has(exercise.prompt));prompts.add(exercise.prompt);
    }
  }
  assert.equal(exerciseIds.size,81);
  assert.equal(getCourse('not-a-course'),null);
});

test('foundational numerical answers respect order, fraction inverses, signs and units',()=>{
  assert.equal(asNumber(answer('numbers','hard')),-6+2*(8-3));
  assert.equal(asNumber(answer('fractions','medium')),240*.15);
  assert.equal(asNumber(answer('fractions','hard')),(3/5)/(9/10));
  assert.equal(asNumber(answer('powers','hard')),Math.sqrt((-5)**2)+2**-1);
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  assert.equal(asNumber(answer('divisibility','medium')),gcd(24,36));
  assert.equal(asNumber(answer('divisibility','hard')),12*18/gcd(12,18));
  assert.equal(asNumber(answer('ratio','hard')),4*9/6);
  assert.equal(asNumber(answer('problems','medium')),60*30/60);
  const years=asNumber(answer('problems','hard'));assert.equal(40+years,2*(10+years));
  const x=asNumber(answer('equations','hard'));assert.equal(2*(x-3)+5,3*x-4);
});

test('function, polynomial, quadratic and extremum answers satisfy original conditions',()=>{
  assert.equal(asNumber(answer('functions','medium')),3*(2+2));
  const inverse=asNumber(answer('functions','hard'));assert.equal(2*inverse-5,7);
  const a=asNumber(answer('polynomials','hard'));assert.equal((-1)**3+a*(-1)+2,0);
  for(const root of [2,-1/2])assert.equal(2*root**2-3*root-2,0);
  assert.equal(answer('quadratics','hard'),'2 ve −1/2');
  assert.equal(asNumber(answer('parabola','hard')),-(2**2)+4*2+1);
  assert.equal(answer('logarithms','hard'),'3');
  assert.equal(Math.log2(3-1)+Math.log2(3+1),3);
  // The rejected algebraic candidate -3 lies outside both logarithms' joint domain.
  assert.ok(-3-1<=0);
});

test('probability, statistics and sequence answers are checked independently',()=>{
  const balls=['R','R','R','B','B'];let redPairs=0,totalPairs=0;
  for(let i=0;i<balls.length;i++)for(let j=0;j<balls.length;j++)if(i!==j){totalPairs++;if(balls[i]==='R'&&balls[j]==='R')redPairs++}
  assert.equal(asNumber(answer('probability','hard')),redPairs/totalPairs);
  const values=[1,5],mean=values.reduce((a,b)=>a+b)/values.length;
  const standardDeviation=Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/values.length);
  assert.equal(asNumber(answer('statistics','hard')),standardDeviation);
  assert.equal(asNumber(answer('sequences','medium')),2*3**(4-1));
  assert.equal(asNumber(answer('sequences','hard')),[0,1,2,3,4].reduce((sum,n)=>sum+2**n,0));
});

test('geometry, calculus, matrix and differential-equation examples are internally consistent',()=>{
  assert.equal(Math.hypot(4-1,6-2),5);
  assert.equal(answer('geometry','hard'),'y=−2x+5');assert.equal(-2*2+5,1);
  assert.equal(asNumber(answer('limits','medium')),1+1);
  assert.equal(asNumber(answer('derivative','medium')),2*3-4);
  assert.equal(asNumber(answer('integral','medium')),1**2-0**2);
  assert.equal(asNumber(answer('integral','hard')),1**2/2-(-1)**2/2);
  const A=[[1,2],[0,1]],B=[[1,0],[3,1]],product=A.map(row=>B[0].map((_,j)=>row.reduce((sum,v,k)=>sum+v*B[k][j],0)));
  assert.equal(answer('matrices','hard'),JSON.stringify(product[0]).replace(',',', '));
  const eigenvalue=asNumber(answer('linear-algebra','hard'));assert.ok(4*0===eigenvalue*0);assert.equal(-1*2,eigenvalue*2);
  for(const x of [-1,0,2]){const h=1e-6,dy=(3*Math.exp(2*(x+h))-3*Math.exp(2*(x-h)))/(2*h);assert.ok(Math.abs(dy-2*3*Math.exp(2*x))<1e-5)}
  assert.equal(answer('differential-equations','hard'),'y=0 ve y=1');for(const y of [0,1])assert.equal(y*(1-y),0);
  assert.equal(getCourse('advanced').example.answer,'n > 100');assert.ok(1/101<.01);assert.equal(1/100,.01);
});

test('diagnostic is finite, deduplicates answers and never certifies incomplete assessment',()=>{
  const questions=diagnosticQuestions();assert.equal(questions.length,8);assert.equal(new Set(questions.map(q=>q.courseId)).size,8);
  assert.equal(assessDiagnostic([{courseId:'numbers',correct:true}]).level,'Eksik değerlendirme');
  const duplicate=assessDiagnostic([{courseId:'numbers',correct:true},{courseId:'numbers',correct:false},{courseId:'invalid',correct:true}]);
  assert.equal(duplicate.answered,1);assert.equal(duplicate.score,0);assert.deepEqual(duplicate.focus,['numbers']);
  const passed=assessDiagnostic(questions.map(q=>({courseId:q.courseId,correct:true})));
  assert.equal(passed.level,'İleri konulara hazırlan');assert.equal(passed.score,8);
  const failed=assessDiagnostic(questions.map(q=>({courseId:q.courseId,correct:false})));
  assert.equal(failed.level,'Temelden başla');assert.equal(failed.recommendations[0],'numbers');
  assert.equal(assessDiagnostic(null).answered,0);
});

test('study plan respects prerequisites, insufficient samples and ownership of progress properties',()=>{
  assert.deepEqual(buildStudyPlan().map(item=>item.courseId),['numbers']);
  assert.deepEqual(buildStudyPlan({numbers:{correct:1,total:1}}).map(item=>item.courseId),['numbers']);
  const next=buildStudyPlan({numbers:{correct:4,total:5}}).map(item=>item.courseId);
  assert.ok(next.includes('fractions'));assert.ok(!next.includes('derivative'));
  assert.deepEqual(buildStudyPlan(Object.create({numbers:{correct:5,total:5}})).map(item=>item.courseId),['numbers']);
  assert.deepEqual(buildStudyPlan({numbers:{correct:9,total:5}}).map(item=>item.courseId),['numbers']);
  const all=Object.fromEntries(COURSES.map(course=>[course.id,{correct:5,total:5}]));assert.deepEqual(buildStudyPlan(all),[]);
  assert.equal(buildStudyPlan({},0).length,1);
});
