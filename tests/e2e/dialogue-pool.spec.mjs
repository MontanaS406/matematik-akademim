import {test,expect} from './fixtures.mjs';
import {TEACHERS} from '../../shared/teachers.js';
import {DIALOGUE_SCENARIOS,DIALOGUE_CATEGORIES} from '../../shared/teacher-dialogue-scenarios.js';
import {getTeacherDialogue} from '../../shared/teacher-dialogues.js';
import {chooseTeacher,configureAI} from './source-helpers.mjs';

async function openPool(page){
 await page.goto('/');await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();
 await page.locator('#teacherPersonality > summary').click();
 await expect(page.locator('#teacherDialoguePool')).not.toHaveAttribute('open','');
 await page.locator('#teacherDialoguePool > summary').click();
}

test('dialogue pool stays collapsed until requested and browsing all categories is local and read-only',async({page})=>{
 let modelRequests=0;await page.route('https://tutor.example/api/tutor',route=>{modelRequests++;return route.fulfill({json:{error:'A preview must not call the model'}})});
 await openPool(page);await configureAI(page);
 const before=await page.evaluate(()=>({state:localStorage.getItem('ma_learning_v1_guest'),history:localStorage.getItem('matematik_akademim_exam_history_v11')}));
 await expect(page.locator('#dialoguePoolCount')).toContainText('60');
 await expect(page.locator('#dialogueScenario option')).toHaveCount(60);
 for(const category of Object.keys(DIALOGUE_CATEGORIES)){
  await page.locator('#dialogueCategory').selectOption(category);
  const expected=DIALOGUE_SCENARIOS.filter(row=>row.category===category);
  await expect(page.locator('#dialogueScenario option')).toHaveCount(expected.length);
  await page.locator('#dialogueScenario').selectOption(expected.at(-1).id);
  const sample=getTeacherDialogue('elif',expected.at(-1).id);await expect(page.locator('#dialogueSample')).toContainText(sample.student);await expect(page.locator('#dialogueSample')).toContainText(sample.teacher);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 }
 await page.locator('#dialogueCategory').selectOption('');await expect(page.locator('#dialogueScenario option')).toHaveCount(60);
 const after=await page.evaluate(()=>({state:localStorage.getItem('ma_learning_v1_guest'),history:localStorage.getItem('matematik_akademim_exam_history_v11')}));
 expect(after).toEqual(before);expect(modelRequests).toBe(0);
});

test('the same dialogue scenario can be compared across all ten teachers without copying a previous voice',async({page})=>{
 await openPool(page);await page.locator('#dialogueCategory').selectOption('concept');await page.locator('#dialogueScenario').selectOption('logarithm');
 const voices=new Set();
 for(const teacher of TEACHERS){
  await chooseTeacher(page,teacher.name);
  if(await page.locator('#teacherPersonality').getAttribute('open')===null)await page.locator('#teacherPersonality > summary').click();
  if(await page.locator('#teacherDialoguePool').getAttribute('open')===null)await page.locator('#teacherDialoguePool > summary').click();
  await expect(page.locator('#dialogueScenario')).toHaveValue('logarithm');
  const sample=getTeacherDialogue(teacher.id,'logarithm');await expect(page.locator('#dialogueSample')).toContainText(sample.teacher);await expect(page.locator('#dialogueSample')).toContainText(sample.student);
  voices.add(await page.locator('#dialogueSample').innerText());
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 }
 expect(voices.size).toBe(10);
 await page.reload();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();
 await expect(page.locator('#selectedTeacherName')).toHaveText('Derya Dedektif');await expect(page.locator('#teacherPersonality')).not.toHaveAttribute('open','');
});

test('previewing an unsupported question request does not produce a question or enter the live conversation',async({page})=>{
 await openPool(page);const before=await page.locator('#chat').innerText(),questionId=await page.locator('#questionCard').getAttribute('data-question-id');
 await page.locator('#dialogueCategory').selectOption('boundaries');await page.locator('#dialogueScenario').selectOption('no_new_questions');
 await expect(page.locator('#dialogueSample')).toContainText(getTeacherDialogue('elif','no_new_questions').teacher);
 await expect(page.locator('#chat')).toHaveText(before);await expect(page.locator('#message')).toHaveValue('');
 await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();
 await expect(page.locator('#questionCard')).toHaveAttribute('data-origin','AI_URETIMI');await expect(page.locator('#questionCard')).toHaveAttribute('data-question-id',questionId);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_guest')||'{"attempts":[]}').attempts.length)).toBe(0);
});
