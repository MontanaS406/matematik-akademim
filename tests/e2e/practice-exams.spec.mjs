import {test, expect} from './fixtures.mjs';
import {AI_BANK} from '../../data/ai-bank.js';
import {createAiRegistry} from '../../shared/ai-bank.js';
import {HISTORY_KEY, openAccount} from './source-helpers.mjs';

const registry = createAiRegistry(AI_BANK);
const STORAGE_KEY = 'ma_practice_exams_v1_guest';
const question = async page => registry.getQuestion(await page.locator('#practiceExamQuestion').getAttribute('data-question-id'));
const readAttempts = (page, key=STORAGE_KEY) => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{"attempts":[]}').attempts, key);

async function openList(page, type='TYT') {
  if (await page.locator('#openPracticeExams').isVisible()) await page.locator('#openPracticeExams').click();
  await expect(page.locator('#practiceExamRoot')).toBeVisible();
  await expect(page.locator('#learningRoot')).toBeHidden();
  await page.locator('#practiceExamType').selectOption(type);
}
async function startFirst(page, type='TYT') {
  await openList(page, type);
  const card=page.locator('[data-practice-exam-id]').first();
  const examId=await card.getAttribute('data-practice-exam-id');
  await card.locator('[data-start-exam]').click();
  await expect(page.locator('#practiceExamSession')).toBeVisible();
  return examId;
}
async function finish(page) {
  await page.locator('#finishPracticeExam').click();
  await expect(page.locator('#practiceExamFinishDialog')).toHaveAttribute('open','');
  await page.locator('#confirmFinishPracticeExam').click();
  await expect(page.locator('#practiceExamResult')).toBeVisible();
}

test('numbered TYT exams use existing verified questions and preserve optical answers when navigating', async({page}) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  const examId=await startFirst(page);
  await expect(page.locator('#practiceExamOptical button[data-index]')).toHaveCount(36);
  const attempts=await readAttempts(page);
  expect(attempts).toHaveLength(1);
  expect(attempts[0].examId).toBe(examId);
  expect(attempts[0].questionIds).toHaveLength(36);
  expect(new Set(attempts[0].questionIds).size).toBe(36);
  for(const id of attempts[0].questionIds) {
    const q=registry.getQuestion(id);
    expect(q).not.toBeNull();expect(q.examType).toBe('TYT');
    expect(q.origin).toBe('AI_URETIMI');expect(q.verification.mathPassed).toBe(true);
  }
  expect(attempts[0].questionIds.slice(0,30).every(id=>registry.getQuestion(id).courseId!=='geometry')).toBe(true);
  const geometryTopics=[];
  for(let index=30;index<36;index++) {
    await page.locator(`#practiceExamOptical [data-index="${index}"]`).click();
    expect((await question(page)).courseId).toBe('geometry');
    geometryTopics.push(await page.locator('#practiceExamQuestion .topic-label').innerText());
  }
  expect(geometryTopics.sort()).toEqual(['Açılar ve Üçgenler','Açılar ve Üçgenler','Açılar ve Üçgenler','Açılar ve Üçgenler','Çokgenler','Kare'].sort());
  expect(attempts[0].questionIds.join('|')).not.toMatch(/MIDPOINT-SUBTRIANGLE-COORDINATES|VERTEX-PARALLEL-TRANSLATION|CONCAVE-COORDINATE-HEIGHT-RECOVERY|COORDINATE-FREE-HORIZONTAL-POSITION|COUNT-LATTICE-CONCAVE-VERTICES/);
  await page.locator('#practiceExamOptical [data-index="0"]').click();
  const first=await question(page);
  await expect(page.locator('#practiceExamQuestion')).toContainText(first.prompt);
  await expect(page.locator('#practiceExamOptions button')).toHaveCount(5);
  for(const option of first.options)await expect(page.locator(`#practiceExamOptions [data-option="${option.id}"]`)).toContainText(option.text);
  await page.locator(`#practiceExamOptions [data-option="${first.answer.value}"]`).click();
  await expect(page.locator(`#practiceExamOptions [data-option="${first.answer.value}"]`)).toHaveAttribute('aria-pressed','true');
  await page.locator('#practiceExamNext').click();
  expect((await question(page)).id).not.toBe(first.id);
  await page.locator('#practiceExamOptical [data-index="0"]').click();
  await expect(page.locator('#practiceExamQuestion')).toHaveAttribute('data-question-id',first.id);
  await expect(page.locator(`#practiceExamOptions [data-option="${first.answer.value}"]`)).toHaveAttribute('aria-pressed','true');
  expect((await readAttempts(page))[0].answers[0]).toBe(first.answer.value);
  await page.locator('#finishPracticeExam').click();
  await page.locator('#cancelFinishPracticeExam').click();
  expect((await readAttempts(page))[0].status).toBe('running');
  await expect(page.locator('#practiceExamResult')).toHaveCount(0);
  await expect(page.locator('input[type=file],iframe')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('TYT geometry follows the supplied 2025 quotas and shows the four unavailable slots honestly',async({page})=>{
  await page.goto('/');await openList(page);
  const card=page.locator('[data-practice-exam-id]').first();
  await expect(card).toContainText(/36(?:\s*soru)?\s*\/\s*40/);
  await expect(card).toContainText('4 soru eksik');
  await page.locator('.practice-distribution:not(#previousPracticeExams) > summary').click();
  for(const [label,count,missing] of [['Açılar ve Üçgenler',4,0],['Çokgenler',1,0],['Kare',1,0],['Katı Cisimler',2,2],['Yamuk',1,1],['Dikdörtgen',1,1]]) {
    const row=page.locator('.practice-distribution-grid p').filter({has:page.getByText(label,{exact:true})});
    await expect(row).toContainText(count+' soru');
    if(missing)await expect(row).toContainText(missing+' eksik');
  }
  await expect(page.locator('.practice-distribution-grid')).not.toContainText('Analitik Geometri');
  await expect(page.locator('.practice-distribution-grid')).not.toContainText('Çember ve Daire');
  await expect(page.locator('input[type=file],iframe')).toHaveCount(0);
});

test('previous 30-question TYT attempts stay distinct, resume unchanged and retry their original manifest',async({page})=>{
  await page.goto('/');
  const seeded=await page.evaluate(async key=>{
    const [{AI_BANK},{createAiRegistry},{buildPracticeExamCatalog,scorePracticeExam},state,frozen]=await Promise.all([
      import('/data/ai-bank.js'),import('/shared/ai-bank.js'),import('/shared/practice-exams.js'),
      import('/shared/practice-exam-state.js'),fetch('/data/practice-exams-v1.json').then(response=>response.json())
    ]);
    const registry=createAiRegistry(AI_BANK),catalog=buildPracticeExamCatalog(registry.questions),now=Date.now()-120000;
    const oldFirst=catalog.getExam(frozen.exams.find(exam=>exam.type==='TYT'&&exam.number===1).id);
    const oldSecond=catalog.getExam(frozen.exams.find(exam=>exam.type==='TYT'&&exam.number===2).id);
    if(oldFirst?.actualCount!==30||oldSecond?.actualCount!==30)throw Error('Previous manifests must resolve as 30-question exams.');
    const answerFirst=registry.getQuestion(oldFirst.questionIds[0]).answer.value;
    const answerSecond=registry.getQuestion(oldSecond.questionIds[0]).answer.value;
    let completed=state.createPracticeAttempt(oldFirst,{id:'legacy-completed-30',now});
    completed=state.updatePracticeAnswer(completed,0,answerFirst,now+1000);
    completed=state.finishPracticeAttempt(completed,scorePracticeExam(oldFirst,completed.answers,registry),now+10000);
    let paused=state.createPracticeAttempt(oldSecond,{id:'legacy-paused-30',now:now+20000});
    paused=state.updatePracticeAnswer(paused,0,answerSecond,now+21000);
    paused=state.pausePracticeAttempt(paused,now+30000);
    localStorage.setItem(key,JSON.stringify({version:1,attempts:[completed,paused]}));
    return {completed,paused,answerSecond};
  },STORAGE_KEY);
  await page.reload();await openList(page);
  const currentCard=page.locator('[data-practice-exam-id]').first();
  await expect(currentCard).toContainText(/36(?:\s*soru)?\s*\/\s*40/);
  await expect(currentCard.locator('.exam-completed')).toHaveCount(0);
  await expect(currentCard.locator('[data-start-exam]')).toBeVisible();
  const openPrevious=async()=>{
    const details=page.locator('#previousPracticeExams');
    if(!await details.evaluate(node=>node.open))await details.locator(':scope > summary').click();
  };
  await openPrevious();
  let previousCompleted=page.locator('[data-previous-attempt-id="legacy-completed-30"]');
  await previousCompleted.locator('[data-review-previous-attempt]').click();
  await expect(page.locator('#previousPracticeResultNote')).toBeVisible();
  await expect(page.locator('#previousPracticeResultNote')).toContainText('30');
  await expect(page.locator('#practiceExamReview details')).toHaveCount(30);
  await page.locator('#returnToPracticeExams').click();await openPrevious();
  await page.locator('[data-previous-attempt-id="legacy-paused-30"] [data-resume-previous-attempt]').click();
  await expect(page.locator('#practiceExamOptical button[data-index]')).toHaveCount(30);
  await expect(page.locator('#previousPracticeExamNote')).toBeVisible();
  await expect(page.locator('#previousPracticeExamNote')).toContainText('30');
  await expect(page.locator(`#practiceExamOptions [data-option="${seeded.answerSecond}"]`)).toHaveAttribute('aria-pressed','true');
  let resumed=(await readAttempts(page)).find(attempt=>attempt.id==='legacy-paused-30');
  expect(resumed.answers).toEqual(seeded.paused.answers);expect(resumed.questionIds).toEqual(seeded.paused.questionIds);
  await page.reload();await openList(page);await openPrevious();
  await page.locator('[data-previous-attempt-id="legacy-paused-30"] [data-resume-previous-attempt]').click();
  await expect(page.locator('#practiceExamOptical button[data-index]')).toHaveCount(30);
  resumed=(await readAttempts(page)).find(attempt=>attempt.id==='legacy-paused-30');
  expect(resumed.answers).toEqual(seeded.paused.answers);expect(resumed.questionIds).toEqual(seeded.paused.questionIds);
  await finish(page);
  const after=await readAttempts(page);
  expect(after.find(attempt=>attempt.id==='legacy-completed-30')).toEqual(seeded.completed);
  expect(after.find(attempt=>attempt.id==='legacy-paused-30').result).toMatchObject({correct:1,wrong:0,blank:29,total:30,net:1,isOfficial:false});
  await page.locator('#returnToPracticeExams').click();await openPrevious();
  await page.locator('[data-previous-attempt-id="legacy-paused-30"] [data-retry-previous-attempt]').click();
  await expect(page.locator('#practiceExamOptical button[data-index]')).toHaveCount(30);
  await expect(page.locator('#previousPracticeExamNote')).toBeVisible();
  const retried=await readAttempts(page),fresh=retried.find(attempt=>!['legacy-completed-30','legacy-paused-30'].includes(attempt.id));
  expect(fresh.questionIds).toEqual(seeded.paused.questionIds);expect(fresh.answers).toEqual(Array(30).fill(null));
  expect(fresh.examId).toBe(seeded.paused.examId);
  await page.locator('#practiceExamLeave').click();
  await expect(page.locator('[data-practice-exam-id]').first().locator('.exam-completed')).toHaveCount(0);
  await page.locator('[data-practice-exam-id]').first().locator('[data-start-exam]').click();
  await expect(page.locator('#practiceExamOptical button[data-index]')).toHaveCount(36);
});

test('paused and unfinished exam resumes after reload with its answers and elapsed time', async({page}) => {
  await page.clock.install();
  await page.goto('/');const examId=await startFirst(page);
  const first=await question(page);
  await page.locator(`#practiceExamOptions [data-option="${first.answer.value}"]`).click();
  await page.clock.fastForward(65000);
  await page.locator('#pausePracticeExam').click();
  const paused=(await readAttempts(page))[0];
  expect(paused.status).toBe('paused');expect(paused.elapsedMs).toBeGreaterThanOrEqual(65000);
  const clock=await page.locator('#practiceExamTimer').innerText();
  await page.clock.fastForward(120000);
  await expect(page.locator('#practiceExamTimer')).toHaveText(clock);
  await expect(page.locator('#practiceExamOptions button').first()).toBeDisabled();
  await page.reload();await openList(page);
  await page.locator(`[data-practice-exam-id="${examId}"] [data-resume-exam]`).click();
  await expect(page.locator('#practiceExamQuestion')).toHaveAttribute('data-question-id',first.id);
  await expect(page.locator(`#practiceExamOptions [data-option="${first.answer.value}"]`)).toHaveAttribute('aria-pressed','true');
  const resumed=(await readAttempts(page))[0];
  expect(resumed.id).toBe(paused.id);expect(resumed.questionIds).toEqual(paused.questionIds);
  expect(resumed.elapsedMs).toBeGreaterThanOrEqual(paused.elapsedMs);
  // A resumed attempt must not include the two minutes spent paused.
  expect(resumed.elapsedMs).toBeLessThan(paused.elapsedMs+5000);
});

test('finishing adds a persistent check mark and retry keeps the completed attempt intact', async({page}) => {
  const preserved={
    learning:JSON.stringify({teacherId:'beyza',courseId:'equations',difficulty:'easy',preferencesAt:'2026-01-01T12:00:00.000Z',attempts:[]}),
    history:JSON.stringify([{id:'retained-before-practice-exams',type:'TYT',date:'2026-01-01T12:00:00.000Z',duration:120,correct:1,wrong:1,blank:38,net:0.75}])
  };
  await page.addInitScript(({preserved,historyKey})=>{
    if(localStorage.getItem('ma_learning_v1_guest')===null)localStorage.setItem('ma_learning_v1_guest',preserved.learning);
    if(localStorage.getItem(historyKey)===null)localStorage.setItem(historyKey,preserved.history);
  },{preserved,historyKey:HISTORY_KEY+'_guest'});
  await page.goto('/');const examId=await startFirst(page);
  const first=await question(page);
  await page.locator(`#practiceExamOptions [data-option="${first.answer.value}"]`).click();
  await page.locator('#practiceExamNext').click();
  const second=await question(page),wrong=second.options.find(option=>option.id!==second.answer.value);
  await page.locator(`#practiceExamOptions [data-option="${wrong.id}"]`).click();
  await finish(page);
  const completed=(await readAttempts(page))[0];
  expect(completed.status).toBe('completed');
  expect(completed.result).toMatchObject({correct:1,wrong:1,blank:34,net:0.75,total:36,isOfficial:false});
  await expect(page.locator('#practiceExamResult')).toContainText(/net/i);
  const review=page.locator('#practiceExamReview details').first();
  await review.locator('summary').click();
  await expect(review).toContainText(first.prompt);
  for(const option of first.options)await expect(review).toContainText(option.text);
  for(const step of first.solutionSteps)await expect(review).toContainText(step);
  expect(await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest'))).toBe(preserved.learning);
  expect(await page.evaluate(key=>localStorage.getItem(key),HISTORY_KEY+'_guest')).toBe(preserved.history);
  await page.locator('.nav').getByRole('button',{name:'İlerleme',exact:true}).click();
  await expect(page.locator('#progressSummary .stat-card strong')).toHaveText(['2','1','2']);
  await expect(page.locator('#practiceExamHistory')).toContainText('0.75 alıştırma neti');
  await page.locator(`[data-practice-result-id="${completed.id}"]`).click();
  await expect(page.locator('#practiceExamResult')).toBeVisible();
  await page.locator('#returnToPracticeExams').click();
  let card=page.locator(`[data-practice-exam-id="${examId}"]`);
  await expect(card.locator('.exam-completed')).toBeVisible();
  await expect(card.locator('[data-review-exam]')).toBeVisible();
  await expect(card.locator('[data-retry-exam]')).toHaveText('Bir daha çöz');
  await page.reload();await openList(page);
  card=page.locator(`[data-practice-exam-id="${examId}"]`);
  await expect(card.locator('.exam-completed')).toBeVisible();
  await card.locator('[data-retry-exam]').click();
  await expect(page.locator('#practiceExamSession')).toBeVisible();
  const retried=await readAttempts(page);
  expect(retried).toHaveLength(2);
  expect(retried.find(attempt=>attempt.id===completed.id)).toEqual(completed);
  const fresh=retried.find(attempt=>attempt.id!==completed.id);
  expect(fresh.examId).toBe(examId);expect(fresh.questionIds).toEqual(completed.questionIds);
  expect(fresh.answers).toEqual(Array(36).fill(null));expect(fresh.status).toBe('running');
  await page.locator('#practiceExamLeave').click();
  card=page.locator(`[data-practice-exam-id="${examId}"]`);
  await expect(card.locator('.exam-completed')).toBeVisible();
  await expect(card.locator('[data-resume-exam]')).toBeVisible();
});

test('AYT shows an explicitly incomplete distribution and uses AYT questions without invented replacements', async({page}) => {
  await page.goto('/');await openList(page,'AYT');
  const card=page.locator('[data-practice-exam-id]').first();
  await expect(card).toContainText(/24(?:\s*soru)?\s*\/\s*40/);
  await expect(page.locator('#practiceExamRoot')).toContainText(/eksik/i);
  await expect(page.locator('#practiceExamRoot')).toContainText(/AI/);
  await card.locator('[data-start-exam]').click();
  await expect(page.locator('#practiceExamOptical button[data-index]')).toHaveCount(24);
  const attempt=(await readAttempts(page))[0];expect(attempt.type).toBe('AYT');
  expect(new Set(attempt.questionIds).size).toBe(24);
  for(const id of attempt.questionIds)expect(registry.getQuestion(id)?.examType).toBe('AYT');
  await finish(page);
  const result=(await readAttempts(page))[0].result;
  expect(result).toMatchObject({correct:0,wrong:0,blank:24,total:24,net:0,isOfficial:false});
  await expect(page.locator('#practiceExamResult')).toContainText(/24/);
});

test('exam interface stays compact on a narrow screen and preserves all four menus', async({page}) => {
  await page.setViewportSize({width:390,height:844});await page.goto('/');await openList(page);
  for(const name of ['Soru çöz','Konular','Öğretmen','İlerleme'])await expect(page.locator('.nav').getByRole('button',{name,exact:true})).toBeVisible();
  await expect(page.locator('.nav button')).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('[data-practice-exam-id]').first().locator('[data-start-exam]').click();
  await expect(page.locator('#practiceExamOptions button')).toHaveCount(5);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#practiceExamOptical [data-index="35"]').click();
  await expect(page.locator('#practiceExamNext')).toBeDisabled();
  await expect(page.locator('#practiceExamPrevious')).toBeEnabled();
  await page.locator('#practiceExamLeave').click();
  await page.locator('#closePracticeExams').click();
  await expect(page.locator('#learningRoot')).toBeVisible();
  await expect(page.locator('#questionCard')).toBeVisible();
  await expect(page.locator('input[type=file],iframe')).toHaveCount(0);
});

test('guest exam answers remain isolated from a signed-in account and return after logout', async({page}) => {
  await page.route('https://*.supabase.co/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:'fake-alice',refresh_token:'fake-refresh',expires_in:3600,user:{id:'alice',email:'alice@example.test'}}});
    return route.fulfill({json:[]});
  });
  await page.goto('/');const examId=await startFirst(page);
  const first=await question(page);await page.locator(`#practiceExamOptions [data-option="${first.answer.value}"]`).click();
  await page.locator('#practiceExamLeave').click();
  const guestBefore=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  await openAccount(page);await page.locator('#userEmail').fill('alice@example.test');await page.locator('#userPassword').fill('fake-password');await page.locator('#signIn').click();
  await expect.poll(()=>page.evaluate(()=>window.MAAccount.getUser())).toEqual({id:'alice'});
  await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();
  await openList(page);
  const card=page.locator(`[data-practice-exam-id="${examId}"]`);
  await expect(card.locator('[data-resume-exam]')).toHaveCount(0);
  await card.locator('[data-start-exam]').click();
  expect((await readAttempts(page,'ma_practice_exams_v1_alice'))[0].answers).toEqual(Array(36).fill(null));
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(guestBefore);
  await page.locator('#practiceExamLeave').click();
  await openAccount(page);await page.locator('#logoutBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.MAAccount.getUser())).toBeNull();
  await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();await openList(page);
  await page.locator(`[data-practice-exam-id="${examId}"] [data-resume-exam]`).click();
  await expect(page.locator(`#practiceExamOptions [data-option="${first.answer.value}"]`)).toHaveAttribute('aria-pressed','true');
});

test('a denied practice-exam write cannot start an unsaved attempt or create a completion mark', async({page}) => {
  await page.addInitScript(key=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(name,value){
      if(name===key)throw new DOMException('Storage is full.','QuotaExceededError');
      return original.call(this,name,value);
    };
  },STORAGE_KEY);
  await page.goto('/');await openList(page);
  await page.locator('[data-practice-exam-id]').first().locator('[data-start-exam]').click();
  await expect(page.locator('#practiceExamSession')).toHaveCount(0);
  await expect(page.locator('.exam-completed')).toHaveCount(0);
  await expect(page.locator('#practiceExamNotice')).toBeVisible();
  await expect(page.locator('#practiceExamNotice')).toHaveAttribute('role','status');
  await expect(page.locator('#practiceExamNotice')).toContainText('kaydedilemedi');
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBeNull();
});

test('an unreadable existing practice-exam store is preserved and blocks replacement attempts', async({page}) => {
  const raw='{"version":1,"attempts":[unreadable-existing-record';
  await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:STORAGE_KEY,raw});
  await page.goto('/');await openList(page);
  const button=page.locator('[data-practice-exam-id]').first().locator('[data-start-exam]');
  await expect(button).toBeDisabled();
  await button.evaluate(node=>node.click());
  await expect(page.locator('#practiceExamNotice')).toContainText('okunamadı');
  await expect(page.locator('#practiceExamSession')).toHaveCount(0);
  await expect(page.locator('.exam-completed')).toHaveCount(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(raw);
  await page.locator('#practiceExamType').selectOption('AYT');
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(raw);
});

test('a stale tab cannot overwrite a newer answer sheet from another tab', async({page}) => {
  const clockBase=Date.now()-5000;
  await page.clock.install({time:new Date(clockBase)});await page.clock.pauseAt(new Date(clockBase+1000));
  // Reproduce a sleeping tab that has not yet delivered its storage event.
  await page.addInitScript(key=>window.addEventListener('storage',event=>{
    if(event.key===key)event.stopImmediatePropagation();
  },true),STORAGE_KEY);
  await page.goto('/');const examId=await startFirst(page);
  const first=await question(page),wrong=first.options.find(option=>option.id!==first.answer.value);
  const second=await page.context().newPage();
  try {
    await second.goto('/');await openList(second);
    await second.locator(`[data-practice-exam-id="${examId}"] [data-resume-exam]`).click();
    await second.locator(`#practiceExamOptions [data-option="${first.answer.value}"]`).click();
    await second.locator('#pausePracticeExam').click();
    const newer=await second.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
    await page.clock.setSystemTime(new Date());
    await page.locator(`#practiceExamOptions [data-option="${wrong.id}"]`).click();
    await expect(page.locator('#practiceExamNotice')).toContainText('başka bir sekmede güncellendi');
    await expect(page.locator('#practiceExamSession')).toHaveCount(0);
    expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(newer);
    await page.locator(`[data-practice-exam-id="${examId}"] [data-resume-exam]`).click();
    await expect(page.locator(`#practiceExamOptions [data-option="${first.answer.value}"]`)).toHaveAttribute('aria-pressed','true');
  } finally { await second.close(); }
});
