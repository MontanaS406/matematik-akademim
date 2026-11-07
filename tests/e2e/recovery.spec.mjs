import {test,expect} from './fixtures.mjs';
import {QUESTION_BANK} from '../../data/question-bank.js';
import {TURKISH_EXAMS} from '../../data/turkish-exams.js';

test('a fresh user immediately sees a real exercise and can save a correct answer',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
 const id=await page.locator('#questionCard').getAttribute('data-question-id'),q=QUESTION_BANK.questions.find(row=>row.id===id);
 expect(q).toBeTruthy();await expect(page.locator('#originalPrompt')).toHaveText(q.prompt);await expect(page.locator('#courseLesson')).toHaveAttribute('open','');await expect(page.locator('.question-bank-card')).toContainText('142 toplam');
 await page.locator('#sourceResponse').fill(q.answer.value);await page.locator('#checkSourceAnswer').click();await expect(page.locator('#sourceFeedback')).toContainText(q.answer.value);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_guest')));expect(saved.attempts.at(-1)).toMatchObject({exerciseId:q.id,correct:true});expect(errors).toEqual([]);
});
test('home exam selection opens the matching private booklet without asking users to type metadata',async({page})=>{
 await page.goto('/');await page.locator('#homeExamYear').selectOption('2024');const row=TURKISH_EXAMS.find(r=>r.year===2024&&r.examType==='TYT');
 await expect(page.locator('#homeExamInfo a')).toHaveAttribute('href',row.originalUrl);await page.locator('#homeExamInfo button').click();
 await expect(page.locator('#privateLibraryPanel')).toHaveAttribute('open','');await expect(page.locator('#privateKnownExam')).toHaveValue(row.id);await expect(page.locator('#privateFile')).toBeVisible();await expect(page.locator('#privateSourceDetails')).not.toHaveAttribute('open','');await expect(page.locator('#privateSourceUrl')).toHaveValue(row.originalUrl);
});
test('the exam tab starts with actual PDF import and keeps the bare answer sheet secondary',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'📝 Denemeler'}).click();await expect(page.locator('#privateLibraryPanel')).toHaveAttribute('open','');await expect(page.locator('#privateFile')).toBeVisible();await expect(page.locator('#legacyExamWorkspace')).not.toHaveAttribute('open','');await expect(page.locator('#startTYT')).not.toBeVisible();
});
test('course teaching stays available when that course has no question bank item',async({page})=>{
 await page.goto('/');await page.locator('#browseCourses').click();await page.locator('#courseSearch').fill('Kesirler');await page.locator('#courseList button').first().click();await page.locator('#askLessonTeacher').click();await expect(page.locator('#send')).toBeEnabled();
 await page.locator('#teacher summary').filter({hasText:'AI bağlantı ayarları'}).click();await page.locator('#endpoint').fill('https://tutor.example');await page.locator('#access').fill('test-only');await page.locator('#saveAI').click();let sent;
 await page.route('https://tutor.example/api/tutor',route=>{sent=route.request().postDataJSON();return route.fulfill({json:{mode:'lesson',courseId:'fractions',isOfficialSolution:false,answer:'Kesirde payda eş parçaların sayısını belirtir.'}})});
 await page.locator('#message').fill('Pay ve paydayı açıkla.');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('payda eş parçaların');expect(sent).toMatchObject({mode:'lesson',courseId:'fractions'});expect(sent.questionId).toBeUndefined();
});
