import {test,expect} from './fixtures.mjs';
import {AI_BANK} from '../../data/ai-bank.js';
import {createAiRegistry} from '../../shared/ai-bank.js';
import {getCourse} from '../../shared/curriculum.js';
import {TEACHERS} from '../../shared/teachers.js';
import {SOURCED_ARCHIVE_SUMMARY,SOURCE_DOCUMENTS,SOURCE_READ_EVIDENCE} from '../../data/source-catalog.js';
import {configureAI,openAccount} from './source-helpers.mjs';
const registry=createAiRegistry(AI_BANK);
const current=async page=>registry.getQuestion(await page.locator('#questionCard').getAttribute('data-question-id'));
const openFilters=async page=>{const filters=page.locator('.extra-practice-filters');if(!await filters.evaluate(node=>node.open))await filters.locator('summary').click()};

test('AI practice renders one usable question and reveals the explanation only after an explicit check',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
 await expect(page.locator('#bankPool')).toHaveValue('ai');await expect(page.locator('#questionCard')).toHaveCount(1);await expect(page.locator('#questionCard')).toHaveAttribute('data-origin','AI_URETIMI');
 const q=await current(page);expect(q).not.toBeNull();expect(q.verification.mathPassed).toBe(true);expect(q.verification.status).toBe('automated_verified');
 await expect(page.locator('#sourceAnswerArea button')).toHaveCount(5);await expect(page.locator('#checkSourceAnswer')).toBeDisabled();await expect(page.locator('#aiSolution')).toBeHidden();
 const wrong=q.options.find(option=>option.id!==q.answer.value);await page.locator(`[data-option="${wrong.id}"]`).click();await expect(page.locator('#sourceFeedback')).toBeEmpty();await expect(page.locator('#aiSolution')).toBeHidden();
 await page.locator(`[data-option="${q.answer.value}"]`).click();await expect(page.locator(`[data-option="${q.answer.value}"]`)).toHaveAttribute('aria-pressed','true');await page.locator('#checkSourceAnswer').click();
 await expect(page.locator('#sourceFeedback')).toContainText('Doğru.');await expect(page.locator('#aiSolution')).toBeVisible();for(const step of q.solutionSteps)await expect(page.locator('#aiSolution')).toContainText(step);
 await expect(page.locator('#checkSourceAnswer')).toBeDisabled();const attempts=await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_guest')).attempts);expect(attempts).toHaveLength(1);expect(attempts[0]).toMatchObject({exerciseId:q.id,correct:true,courseId:q.courseId});
 await page.locator('#nextSource').click();await expect(page.locator('#aiSolution')).toBeHidden();await expect(page.locator('#questionCard')).toHaveCount(1);await page.locator('#previousSource').click();await expect(page.locator('#aiSolution')).toBeVisible();await expect(page.locator('#checkSourceAnswer')).toBeDisabled();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_guest')).attempts.length)).toBe(1);
 await page.locator('.nav').getByRole('button',{name:'İlerleme',exact:true}).click();await expect(page.locator('#progressSummary .stat-card strong')).toHaveText(['1','1','0']);await page.reload();await page.locator('.nav').getByRole('button',{name:'İlerleme',exact:true}).click();await expect(page.locator('#progressSummary .stat-card strong')).toHaveText(['1','1','0']);expect(errors).toEqual([]);
});

test('wrong AI choices show the correct option, explanation and a single recorded attempt',async({page})=>{
 await page.goto('/');const q=await current(page),wrong=q.options.find(option=>option.id!==q.answer.value);
 await page.locator(`[data-option="${wrong.id}"]`).click();await page.locator('#checkSourceAnswer').click();await expect(page.locator('#sourceFeedback')).toContainText('Doğru cevap: '+q.answer.value);await expect(page.locator('#sourceFeedback')).toContainText(TEACHERS.find(teacher=>teacher.id==='elif').incorrectResponse);await expect(page.locator(`[data-option="${wrong.id}"]`)).toHaveClass(/incorrect-choice/);await expect(page.locator(`[data-option="${q.answer.value}"]`)).toHaveClass(/correct-choice/);
 const attempts=await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_guest')).attempts);expect(attempts).toHaveLength(1);expect(attempts[0]).toMatchObject({exerciseId:q.id,correct:false});
});

test('AI, archive index and official exams remain separate without upload controls',async({page})=>{
 await page.goto('/');await expect(page.locator('#learningRoot .count-badge')).toHaveText(registry.stats.usable+' soru');await page.locator('.question-verification summary').click();await expect(page.locator('.question-verification')).toContainText('çıkmış sınav sorusu değildir');await expect(page.locator('.question-verification')).toContainText('İnsan editör incelemesi bekliyor');
 for(const pool of ['original','osym']){await page.locator('#bankPool').selectOption(pool);await expect(page.locator('#questionBankEmpty')).toBeVisible();await expect(page.locator('#questionCard')).toHaveCount(0);await expect(page.locator('#learningRoot .count-badge')).toHaveText('0 soru')}
 await expect(page.locator('#questionBankEmpty')).toContainText('AI alıştırmaları burada gösterilmez');await page.locator('#bankPool').selectOption('ai');await expect(page.locator('#questionCard')).toBeVisible();await expect(page.locator('input[type=file],iframe')).toHaveCount(0);await expect(page.locator('.nav button')).toHaveCount(4);
 expect(await page.locator('body').innerText()).not.toMatch(/pdf|dosya\s*(?:seç|yükle)|kitapçık\s*aktar/iu);
});

test('exam, topic, difficulty, subtopic and generation-pool filters use the checked registry',async({page})=>{
 await page.goto('/');const seed=registry.questions.find(q=>q.examType==='AYT'&&q.difficulty&&q.pool==='generated');expect(seed).toBeTruthy();
 await page.locator('#bankExam').selectOption(seed.examType);await page.locator('#bankDifficulty').selectOption(seed.difficulty);await page.locator('#browseCourses').click();await page.locator('#courseSearch').fill(getCourse(seed.courseId).title);await page.locator('#courseList button').first().click();
 await page.locator('#bankDifficulty').selectOption(seed.difficulty);await openFilters(page);await page.locator('#aiPool').selectOption('generated');await openFilters(page);await page.locator('#bankSubtopic').selectOption(seed.subtopic);
 const expected=registry.getQuestions({examType:seed.examType,courseId:seed.courseId,difficulty:seed.difficulty,pool:'generated',subtopic:seed.subtopic});await expect(page.locator('#learningRoot .count-badge')).toHaveText(expected.length+' soru');
 const actual=await current(page);expect(actual).toMatchObject({examType:seed.examType,courseId:seed.courseId,difficulty:seed.difficulty,pool:'generated',subtopic:seed.subtopic});await expect(page.locator('#questionCard')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('read original documents stay outside the public question pool until publication permission is verified',async({page})=>{
 await page.goto('/');await page.locator('#bankPool').selectOption('original');
 await expect(page.locator('#questionBankEmpty h2')).toHaveText('Yayımlanabilir orijinal soru yok');await expect(page.locator('#learningRoot .count-badge')).toHaveText('0 soru');
 await expect(page.locator('#sourceArchiveDetails')).not.toHaveAttribute('open','');await expect(page.locator('#questionCard')).toHaveCount(0);await expect(page.locator('input[type=file],iframe')).toHaveCount(0);
 await page.locator('#sourceArchiveDetails>summary').click();await expect(page.locator('#sourceArchiveSummary')).toContainText(SOURCED_ARCHIVE_SUMMARY.pdfCount+' kaynak dosyası');await expect(page.locator('#sourceArchiveSummary')).toContainText(SOURCED_ARCHIVE_SUMMARY.pageCount+' sayfa');await expect(page.locator('#sourceArchiveSummary')).toContainText(SOURCED_ARCHIVE_SUMMARY.privateVerifiedQuestions+' soru özel arşivde doğrulandı');
 const evidence=SOURCE_READ_EVIDENCE[0],doc=SOURCE_DOCUMENTS.find(row=>row.id===evidence.sourceDocumentId);expect(evidence.readStatus).toBe('read');
 await expect(page.locator('#sourceReadEvidence')).toContainText(doc.fileName);await expect(page.locator('#sourceReadEvidence')).toContainText('Dosya sayfası '+evidence.physicalPage);await expect(page.locator('#sourceReadEvidence')).toContainText('soru '+evidence.questionNumber);
 await page.locator('.source-document-list>summary').click();await expect(page.locator('#sourceDocumentList>li')).toHaveCount(SOURCE_DOCUMENTS.length);await expect(page.locator('#sourceDocumentList')).toContainText('yayımlama izni doğrulanmadı');
 await expect(page.locator('#sourceArchiveDetails img,#sourceArchiveDetails iframe,#sourceArchiveDetails a')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('original-to-AI derivation uses verified read evidence and stays separate from AI-to-AI and original pools',async({page})=>{
 await page.goto('/');await openFilters(page);await page.locator('#aiDerivation').selectOption('ORIGINAL_TO_AI');
 const expected=registry.getQuestions({derivationKind:'ORIGINAL_TO_AI'});expect(expected.length).toBeGreaterThan(0);await expect(page.locator('#learningRoot .count-badge')).toHaveText(expected.length+' soru');
 const q=await current(page);expect(q.derivationKind).toBe('ORIGINAL_TO_AI');await page.locator('.question-verification>summary').click();await expect(page.locator('.ai-lineage')).toContainText('Orijinal → AI');await expect(page.locator('.question-verification')).toContainText(q.provenance.sourceQuestionId);await expect(page.locator('.source-lineage-location')).toContainText('Dosya sayfası '+q.provenance.physicalPage);
 await expect(page.locator('#questionCard')).toHaveAttribute('data-origin','AI_URETIMI');await expect(page.locator('#questionCard img,#questionCard iframe')).toHaveCount(0);
 await openFilters(page);await page.locator('#aiDerivation').selectOption('AI_TO_AI');const previous=registry.getQuestions({derivationKind:'AI_TO_AI'});await expect(page.locator('#learningRoot .count-badge')).toHaveText(previous.length+' soru');expect((await current(page)).derivationKind).toBe('AI_TO_AI');
 await openFilters(page);await page.locator('#aiDerivation').selectOption('ORIGINAL_TO_AI');await openFilters(page);await page.locator('#aiPool').selectOption('imported');await expect(page.locator('#questionBankEmpty')).toBeVisible();await page.locator('#clearPracticeFilters').click();await expect(page.locator('#learningRoot .count-badge')).toHaveText(registry.stats.usable+' soru');
 await page.locator('#bankPool').selectOption('original');await expect(page.locator('#learningRoot .count-badge')).toHaveText('0 soru');await expect(page.locator('#questionCard')).toHaveCount(0);
});

test('AI teacher help uses lesson context and never passes an AI id as a real-source question',async({page})=>{
 await page.goto('/');const q=await current(page);await page.locator('#askTeacher').click();await expect(page.locator('#teacher')).toBeVisible();await configureAI(page);let sent;
 await page.route('https://tutor.example/api/tutor',route=>{sent=route.request().postDataJSON();return route.fulfill({json:{mode:'lesson',courseId:q.courseId,isOfficialSolution:false,answer:'Konunun yöntemini adım adım inceleyelim.'}})});
 await page.locator('#message').fill('Bu konunun yöntemini açıkla.');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('yöntemini adım adım');expect(sent).toMatchObject({mode:'lesson',courseId:q.courseId});expect(sent).not.toHaveProperty('questionId');expect(sent).not.toHaveProperty('question');
});

test('AI answers and solutions stay account-specific while guest attempts survive login and logout',async({page})=>{
 await page.route('https://*.supabase.co/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:'fake-alice',refresh_token:'fake-refresh',expires_in:3600,user:{id:'alice',email:'alice@example.test'}}});
  return route.fulfill({json:[]});
 });
 await page.goto('/');const guestQuestion=await current(page);
 await page.locator(`[data-option="${guestQuestion.answer.value}"]`).click();await page.locator('#checkSourceAnswer').click();await expect(page.locator('#aiSolution')).toBeVisible();
 const guestState=await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest'));
 expect(JSON.parse(guestState).attempts).toHaveLength(1);
 await openAccount(page);await page.locator('#userEmail').fill('alice@example.test');await page.locator('#userPassword').fill('fake-password');await page.locator('#signIn').click();await expect.poll(()=>page.evaluate(()=>window.MAAccount.getUser())).toEqual({id:'alice'});
 await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();await expect(page.locator('#aiSolution')).toBeHidden();await expect(page.locator('#sourceFeedback')).toBeEmpty();await expect(page.locator('#checkSourceAnswer')).toBeDisabled();
 const aliceQuestion=await current(page),wrong=aliceQuestion.options.find(option=>option.id!==aliceQuestion.answer.value);
 await page.locator(`[data-option="${wrong.id}"]`).click();await page.locator('#checkSourceAnswer').click();await expect(page.locator('#sourceFeedback')).toContainText('Doğru cevap: '+aliceQuestion.answer.value);
 const aliceState=await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_alice')));
 expect(aliceState.attempts).toHaveLength(1);expect(aliceState.attempts[0]).toMatchObject({exerciseId:aliceQuestion.id,correct:false});expect(await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest'))).toBe(guestState);
 await openAccount(page);await page.locator('#logoutBtn').click();await expect.poll(()=>page.evaluate(()=>window.MAAccount.getUser())).toBeNull();await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();
 await expect(page.locator('#aiSolution')).toBeHidden();await expect(page.locator('#sourceFeedback')).toBeEmpty();expect(await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest'))).toBe(guestState);
 await page.locator('.nav').getByRole('button',{name:'İlerleme',exact:true}).click();await expect(page.locator('#progressSummary .stat-card strong')).toHaveText(['1','1','0']);
});
