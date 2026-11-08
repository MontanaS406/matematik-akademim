import {expect} from './fixtures.mjs';
import {QUESTION_BANK} from '../../data/question-bank.js';
import {getCourse} from '../../shared/curriculum.js';

export const HISTORY_KEY='matematik_akademim_exam_history_v11';
export async function currentQuestion(page){
 await expect(page.locator('#questionCard')).toBeVisible();
 const id=await page.locator('#questionCard').getAttribute('data-question-id'),question=QUESTION_BANK.questions.find(row=>row.id===id);
 expect(question).toBeTruthy();return question;
}
export async function selectFirstSource(page){return currentQuestion(page)}
export async function selectQuestionCourse(page,courseId){
 await page.locator('#browseCourses').click();await page.locator('#courseSearch').fill(getCourse(courseId).title);await page.locator('#courseList button').first().click();
 const question=await currentQuestion(page);expect(question.courseId).toBe(courseId);return question;
}
export async function openProgress(page){await page.getByRole('button',{name:'İlerleme',exact:true}).click();await expect(page.locator('#history')).toBeVisible()}
export async function openAccount(page){await page.locator('#accountButton').click();await expect(page.locator('#accountPanel')).toHaveAttribute('open','')}
export async function chooseTeacher(page,name){await page.locator('#teacherChange').click();await expect(page.locator('#teacherDialog')).toHaveAttribute('open','');await page.locator('#teacherPicker').getByRole('button',{name,exact:true}).click();await expect(page.locator('#teacherDialog')).not.toHaveAttribute('open','')}
export async function configureAI(page){
 const settings=page.locator('details').filter({has:page.locator('#endpoint')}).last();if(!await page.locator('#endpoint').isVisible())await settings.locator('summary').first().click();
 await page.locator('#endpoint').fill('https://tutor.example');await page.locator('#access').fill('test-only');await page.locator('#saveAI').click();
}
export async function openAdultOptions(page){if(!await page.locator('#profanityConsent').isVisible())await page.locator('details').filter({has:page.locator('#profanityConsent')}).last().locator('summary').first().click()}
