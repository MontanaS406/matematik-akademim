import {test,expect} from './fixtures.mjs';
import {TEACHERS} from '../../shared/teachers.js';
import {chooseTeacher,configureAI,openAdultOptions} from './source-helpers.mjs';

async function openLessonTeacher(page){
 await page.goto('/');await expect(page.locator('#questionCard')).toHaveCount(0);
 await page.locator('.nav').getByRole('button',{name:'Konular',exact:true}).click();await page.locator('#lessonSearch').fill('Kesirler');await page.locator('#lessonList button').first().click();await page.locator('#lessonAskTeacher').click();await expect(page.locator('#teacher')).toBeVisible();
}
const lessonReply=answer=>({mode:'lesson',courseId:'fractions',isOfficialSolution:false,answer});

test('all six teachers keep distinct greetings and stored choices while the bank is empty',async({page})=>{
 await openLessonTeacher(page);const greetings=new Set();
 for(const teacher of TEACHERS){await chooseTeacher(page,teacher.name);await expect(page.locator('#selectedTeacherName')).toHaveText(teacher.name);greetings.add(await page.locator('#chat').innerText());expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_guest')).teacherId)).toBe(teacher.id)}expect(greetings.size).toBe(6);
 await chooseTeacher(page,'Çağatay Hoca');await openAdultOptions(page);await expect(page.locator('#profanityLevel')).toBeDisabled();await page.locator('#adultConfirmed').check();await expect(page.locator('#profanityLevel')).toBeDisabled();await page.locator('#profanityConsent').check();await page.locator('#profanityLevel').selectOption('heavy');await configureAI(page);const sent=[];
 await page.route('https://tutor.example/api/tutor',route=>{const body=route.request().postDataJSON();sent.push(body);return route.fulfill({json:lessonReply('Bu konuyu tanımlarından başlayarak açıklayalım.')})});
 await page.locator('#message').fill('Pay ve paydayı açıkla.');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('Bu konuyu tanımlarından');expect(sent[0]).toMatchObject({mode:'lesson',courseId:'fractions',teacherId:'cagatay',profanityLevel:'heavy',adultConfirmed:true,profanityConsent:true,helpMode:'hint'});expect(sent[0]).not.toHaveProperty('question');expect(sent[0]).not.toHaveProperty('questionId');
 await chooseTeacher(page,'Beyza Öğretmen');await page.locator('#tutorMode').selectOption('solution');await page.locator('#message').fill('Pay ve paydayı açıkla.');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('Bu konuyu tanımlarından');expect(sent[1]).toMatchObject({mode:'lesson',courseId:'fractions',teacherId:'beyza',profanityLevel:'off',adultConfirmed:false,helpMode:'solution'});expect(sent[1]).not.toHaveProperty('questionId');
 await page.reload();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#selectedTeacherName')).toHaveText('Beyza Öğretmen');expect(await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest'))).not.toContain('adultConfirmed');
});
test('lesson AI response is text-only and recovers after an upstream failure without a question',async({page})=>{
 await openLessonTeacher(page);await configureAI(page);let fail=true;
 await page.route('https://tutor.example/api/tutor',route=>route.fulfill({status:fail?502:200,json:fail?{error:'Tekrar dene'}:lessonReply('<img src=x onerror=alert(1)> açıklama')}));
 await page.locator('#message').fill('Bu tanımı açıkla.');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('Tekrar dene');await expect(page.locator('#send')).toBeEnabled();fail=false;await page.locator('#message').fill('Bu tanımı açıkla.');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('<img');await expect(page.locator('#chat img')).toHaveCount(0);await expect(page.locator('#send')).toBeEnabled();
});
test('lesson teaching is available without inventing or requiring an exercise',async({page})=>{
 await openLessonTeacher(page);await configureAI(page);let sent;
 await page.route('https://tutor.example/api/tutor',route=>{sent=route.request().postDataJSON();return route.fulfill({json:lessonReply('Payda, eş parçaların sayısını belirtir.')})});
 await page.locator('#message').fill('Pay ve paydayı açıkla.');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('eş parçaların');expect(sent).toMatchObject({mode:'lesson',courseId:'fractions'});expect(sent.questionId).toBeUndefined();await expect(page.locator('#questionCard')).toHaveCount(0);
});
test('revoking adult consent aborts a pending lesson reply and prevents stale text',async({page})=>{
 await openLessonTeacher(page);await chooseTeacher(page,'Çağatay Hoca');await openAdultOptions(page);await page.locator('#adultConfirmed').check();await page.locator('#profanityConsent').check();await page.locator('#profanityLevel').selectOption('extreme');await configureAI(page);let release,arrived;const hold=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>arrived=resolve);
 await page.route('https://tutor.example/api/tutor',async route=>{arrived();await hold;await route.fulfill({json:lessonReply('Old consent response')})});
 try{await page.locator('#message').fill('Bu tanımı açıkla.');await page.locator('#send').click();await seen;await page.locator('#profanityConsent').uncheck();release();await expect(page.locator('#profanityLevel')).toHaveValue('off');await expect(page.locator('#send')).toBeEnabled();await expect(page.locator('#chat')).not.toContainText('Old consent response')}finally{release()}
});
test('changing teachers during a lesson request prevents the old teacher reply from entering the new chat',async({page})=>{
 await openLessonTeacher(page);await configureAI(page);let release,arrived;const hold=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>arrived=resolve);
 await page.route('https://tutor.example/api/tutor',async route=>{arrived();await hold;await route.fulfill({json:lessonReply('Previous teacher private answer')})});
 try{await page.locator('#message').fill('Bu tanımı açıkla.');await page.locator('#send').click();await seen;await chooseTeacher(page,'Beyza Öğretmen');release();await expect(page.locator('#selectedTeacherName')).toHaveText('Beyza Öğretmen');await expect(page.locator('#chat')).not.toContainText('Previous teacher private answer');await expect(page.locator('#send')).toBeEnabled()}finally{release()}
});
