import {test,expect} from './fixtures.mjs';
import {COURSES} from '../../shared/curriculum.js';
import {openAccount} from './source-helpers.mjs';
const forbidden=/pdf|dosya\s*(?:seç|yükle)|kitapçık\s*aktar/iu;
async function expectEmptyBank(page){
 await expect(page.locator('#questionBankEmpty')).toBeVisible();await expect(page.locator('#questionBankEmpty')).toHaveAttribute('role','status');await expect(page.locator('#questionBankEmpty h2')).toHaveText('Henüz soru yok');
 await expect(page.locator('#questionCard,#originalPrompt,#sourceAnswerArea,#sourceResponse,#checkSourceAnswer,#openSourceInfo,#askTeacher')).toHaveCount(0);await expect(page.locator('#learningRoot .count-badge')).toHaveText('0 soru');
}
async function expectSimpleSurface(page){
 expect(await page.locator('body').innerText()).not.toMatch(forbidden);expect(await page.locator('input[type=file],iframe').evaluateAll(elements=>elements.filter(element=>!element.closest('#examModePage')).length)).toBe(0);await expect(page.locator('#examModePage')).toBeHidden();
 const labels=await page.locator('[aria-label],[title]').evaluateAll(elements=>elements.filter(element=>!element.closest('#examModePage')).map(element=>(element.getAttribute('aria-label')||'')+' '+(element.getAttribute('title')||'')).join('\n'));expect(labels).not.toMatch(forbidden);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}

test('fresh home has no questions while the compact four-section interface remains usable',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await expectEmptyBank(page);
 for(const name of ['Soru çöz','Konular','Öğretmen','İlerleme'])await expect(page.locator('.nav').getByRole('button',{name,exact:true})).toBeVisible();
 await expect(page.locator('.nav button')).toHaveCount(4);await expect(page.locator('#examModeButton')).toBeVisible();await expect(page.locator('#browseCourses')).toBeVisible();
 expect((await page.locator('body').innerText()).split(/\s+/).filter(Boolean).length).toBeLessThan(130);await expectSimpleSurface(page);expect(errors).toEqual([]);
});
test('old personal attempts remain stored without restoring a removed question on reload or navigation',async({page})=>{
 const retained={teacherId:'beyza',courseId:'equations',attempts:[{id:'retained-before-empty',courseId:'equations',exerciseId:'tuba-sm14-p7-brackets',correct:true,difficulty:'unclassified',at:'2026-01-01T12:00:00Z'}]},raw=JSON.stringify(retained);
 await page.addInitScript(raw=>localStorage.setItem('ma_learning_v1_guest',raw),raw);await page.goto('/');await expectEmptyBank(page);
 for(const name of ['İlerleme','Konular','Öğretmen','Soru çöz'])await page.locator('.nav').getByRole('button',{name,exact:true}).click();await expectEmptyBank(page);
 expect(await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest'))).toBe(raw);await page.reload();await expectEmptyBank(page);expect(await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest'))).toBe(raw);
});
test('normal tabs, lesson catalog and account controls stay separate from the exam workspace',async({page})=>{
 await page.goto('/');await expectSimpleSurface(page);await page.locator('#browseCourses').click();await expect(page.locator('#courseCatalog')).toHaveAttribute('open','');await expectSimpleSurface(page);await page.keyboard.press('Escape');
 for(const name of ['Konular','Öğretmen','İlerleme','Soru çöz']){await page.locator('.nav').getByRole('button',{name,exact:true}).click();await expectSimpleSurface(page)}
 await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await page.locator('#teacherChange').click();await expect(page.locator('#teacherDialog')).toHaveAttribute('open','');await expectSimpleSurface(page);await page.keyboard.press('Escape');
 await openAccount(page);await expectSimpleSurface(page);await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();await expectEmptyBank(page);
});
test('all theory lessons remain reachable without offering placeholder practice questions',async({page})=>{
 await page.goto('/');await page.locator('.nav').getByRole('button',{name:'Konular',exact:true}).click();await expect(page.locator('#lessonList button')).toHaveCount(COURSES.length);await expect(page.locator('#lessonPractice')).toHaveCount(0);
 await page.locator('#lessonSearch').fill(COURSES.at(-1).title);await expect(page.locator('#lessonList button')).toHaveCount(1);await page.locator('#lessonList button').first().click();
 for(const step of COURSES.at(-1).lessonSteps)await expect(page.locator('#lessonDetails')).toContainText(step);await expect(page.locator('#lessonAskTeacher')).toBeEnabled();await expect(page.locator('#lessonPractice')).toHaveCount(0);await expectSimpleSurface(page);
 await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();await expectEmptyBank(page);await page.locator('#browseCourses').click();await page.locator('#courseSearch').fill('Denklemler');await page.locator('#courseList button').first().click();await expect(page.locator('#library')).toBeVisible();await expect(page.locator('#lessonPractice')).toHaveCount(0);
 await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();await expectEmptyBank(page);
});
