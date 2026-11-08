import {test,expect} from './fixtures.mjs';
import {COURSES} from '../../shared/curriculum.js';
import {QUESTION_BANK} from '../../data/question-bank.js';
import {currentQuestion,selectQuestionCourse,openAccount} from './source-helpers.mjs';
const forbidden=/pdf|dosya\s*(?:seç|yükle)|kitapçık\s*aktar/iu;
async function expectSimpleSurface(page){
 expect(await page.locator('body').innerText()).not.toMatch(forbidden);expect(await page.locator('input[type=file],iframe').evaluateAll(elements=>elements.filter(element=>!element.closest('#examModePage')).length)).toBe(0);await expect(page.locator('#examModePage')).toBeHidden();
 const labels=await page.locator('[aria-label],[title]').evaluateAll(elements=>elements.filter(element=>!element.closest('#examModePage')).map(element=>(element.getAttribute('aria-label')||'')+' '+(element.getAttribute('title')||'')).join('\n'));expect(labels).not.toMatch(forbidden);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}

test('fresh home opens a real question with a compact usable answer action',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');const question=await currentQuestion(page);
 await expect(page.locator('#originalPrompt')).toHaveText(question.prompt);await expect(page.locator('#checkSourceAnswer')).toBeVisible();await expect(page.locator('#nextSource')).toBeEnabled();
 for(const name of ['Soru çöz','Konular','Öğretmen','İlerleme'])await expect(page.locator('.nav').getByRole('button',{name,exact:true})).toBeVisible();
 expect((await page.locator('body').innerText()).split(/\s+/).filter(Boolean).length).toBeLessThan(130);
 const action=await page.locator('#checkSourceAnswer').boundingBox(),height=page.viewportSize().height;expect(action.y+action.height).toBeLessThan(height-60);
 await expectSimpleSurface(page);expect(errors).toEqual([]);
});
test('answering and moving next uses actual registry entries and preserves personal progress',async({page})=>{
 await page.goto('/');const question=await currentQuestion(page);await page.locator('#sourceResponse').fill(question.answer.value);await page.locator('#checkSourceAnswer').click();await expect(page.locator('#sourceFeedback')).toContainText(question.answer.value);
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_guest')));expect(before.attempts.at(-1)).toMatchObject({exerciseId:question.id,correct:true});
 await page.locator('#nextSource').click();const next=await currentQuestion(page);expect(next.id).not.toBe(question.id);await expect(page.locator('#originalPrompt')).toHaveText(next.prompt);
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_guest')).attempts)).toContainEqual(before.attempts.at(-1));await page.locator('.nav').getByRole('button',{name:'İlerleme',exact:true}).click();await expect(page.locator('#progressSummary .stat-card strong').first()).toHaveText('1');await expect(page.locator('#progressSummary .stat-card strong').nth(1)).toHaveText('1');
});
test('the four normal tabs and dialogs stay free of the separate exam upload interface',async({page})=>{
 await page.goto('/');await expectSimpleSurface(page);await page.locator('#openSourceInfo').click();await expect(page.locator('#sourceInfo')).toHaveAttribute('open','');await expectSimpleSurface(page);await page.keyboard.press('Escape');
 await page.locator('#browseCourses').click();await expectSimpleSurface(page);await page.keyboard.press('Escape');
 for(const name of ['Konular','Öğretmen','İlerleme','Soru çöz']){await page.locator('.nav').getByRole('button',{name,exact:true}).click();await expectSimpleSurface(page)}
 await openAccount(page);await expectSimpleSurface(page);
});
test('source information stays secondary and retains required attribution without changing the exercise',async({page})=>{
 await page.goto('/');const question=await currentQuestion(page),source=QUESTION_BANK.sources.find(row=>row.id===question.sourceId);
 await expect(page.locator('#sourceInfo')).not.toHaveAttribute('open','');await page.locator('#openSourceInfo').click();await expect(page.locator('#sourceAttribution')).toHaveText(source.license.attribution);await expect(page.locator('#originalSourceLink')).toHaveAttribute('href',question.originalUrl||source.originalUrl);await expect(page.locator('#licenseLink')).toHaveAttribute('href',source.license.url);await expect(page.locator('#answerEvidenceLink')).toHaveAttribute('href',question.answer.evidenceUrl);await page.keyboard.press('Escape');await expect(page.locator('#originalPrompt')).toHaveText(question.prompt);
});
test('topic selection uses existing questions and all theory lessons remain reachable',async({page})=>{
 await page.goto('/');const before=await selectQuestionCourse(page,'equations');await page.locator('.nav').getByRole('button',{name:'Konular',exact:true}).click();await page.locator('#lessonSearch').fill(COURSES.at(-1).title);await expect(page.locator('#lessonList button')).toHaveCount(1);await page.locator('#lessonList button').first().click();
 for(const step of COURSES.at(-1).lessonSteps)await expect(page.locator('#lessonDetails')).toContainText(step);await expect(page.locator('#lessonAskTeacher')).toBeEnabled();await expectSimpleSurface(page);await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();expect((await currentQuestion(page)).id).toBe(before.id);await page.locator('#nextSource').click();expect((await currentQuestion(page)).courseId).toBe('equations');
});
