import {test,expect} from './fixtures.mjs';
import {TEACHERS} from '../../shared/teachers.js';
import {COURSES,getCourse} from '../../shared/curriculum.js';
import {QUESTION_BANK} from '../../data/question-bank.js';
import {getEligibleQuestions} from '../../shared/question-bank.js';

const first=getEligibleQuestions(QUESTION_BANK,{courseId:'equations'})[0];
const sourceFor=q=>QUESTION_BANK.sources.find(s=>s.id===q.sourceId);
const storedKey='ma_learning_v1_guest';
async function selectCourse(page,id){
  await page.locator('#browseCourses').click();
  await page.locator('#courseSearch').fill(getCourse(id).title);
  await page.locator('#courseList button').first().click();
  await expect(page.locator('#learningRoot h1')).toHaveText(getCourse(id).title);
}
async function selectSource(page,q=first){
  await selectCourse(page,q.courseId);
  while(await page.locator('#questionCard').getAttribute('data-question-id')!==q.id){
    await page.locator('#nextSource').click();
  }
  await expect(page.locator('#questionCard')).toHaveAttribute('data-question-id',q.id);
}
async function configureAI(page){
  await page.locator('#teacher summary').filter({hasText:'AI bağlantı ayarları'}).click();
  await page.locator('#endpoint').fill('https://tutor.example');
  await page.locator('#access').fill('test-only');
  await page.locator('#saveAI').click();
}

test('empty topic preserves explanations and never substitutes an authored question',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  await selectCourse(page,'fractions');
  await expect(page.locator('#learningRoot h1')).toHaveText(getCourse('fractions').title);
  await expect(page.locator('#emptySourceBank')).toContainText('Bu konu için henüz kaynaklı soru yok');
  await expect(page.locator('#questionCard')).toHaveCount(0);
  for(const id of ['quickPractice','learningChoices','startDiagnostic','topicTest','learningQuiz'])await expect(page.locator('#'+id)).toHaveCount(0);
  await expect(page.locator('#courseLesson')).toHaveAttribute('open','');
  await expect(page.locator('#courseLesson li')).toHaveCount(getCourse('fractions').lessonSteps.length);
  await expect(page.locator('.worked')).toHaveCount(0);
  await page.getByRole('button',{name:'✧ AI Hoca'}).click();
  await expect(page.locator('#send')).toBeEnabled();
  await expect(page.locator('#aiQuestion')).toContainText('Konu: '+getCourse('fractions').title);
  expect(errors).toEqual([]);
});

test('source cards preserve exact original questions, answer keys and license metadata',async({page})=>{
  await page.goto('/');await selectSource(page);
  const rows=getEligibleQuestions(QUESTION_BANK,{courseId:first.courseId}).slice(0,2);
  for(let i=0;i<rows.length;i++){
    const q=rows[i],s=sourceFor(q);
    await expect(page.locator('#questionCard')).toHaveAttribute('data-question-id',q.id);
    expect(await page.locator('#originalPrompt').textContent()).toBe(q.prompt);
    await page.locator('#questionCard summary').click();
    await expect(page.locator('#sourceAttribution')).toHaveText(s.license.attribution);
    await expect(page.locator('#originalSourceLink')).toHaveAttribute('href',q.originalUrl||s.originalUrl);
    await expect(page.locator('#licenseLink')).toHaveAttribute('href',s.license.url);
    await expect(page.locator('#answerEvidenceLink')).toHaveAttribute('href',q.answer.evidenceUrl);
    if(i<rows.length-1)await page.locator('#nextSource').click();
  }
  await expect(page.locator('#previousSource')).toBeEnabled();
  await page.locator('#sourceResponse').fill(rows.at(-1).answer.value);
  await page.locator('#checkSourceAnswer').click();
  await expect(page.locator('#sourceFeedback')).toContainText('Kaynak cevabı: '+rows.at(-1).answer.value);
  await expect(page.locator('#checkSourceAnswer')).toBeDisabled();
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),storedKey);
  expect(saved.attempts.at(-1)).toMatchObject({exerciseId:rows.at(-1).id,correct:true});
  await page.locator('#bankDifficulty').selectOption('hard');
  await expect(page.locator('#emptySourceBank')).toBeVisible();
  await expect(page.locator('#questionCard')).toHaveCount(0);
});

test('every displayed question belongs to the reviewed production registry',async({page})=>{
  await page.goto('/');
  for(const courseId of [...new Set(QUESTION_BANK.questions.map(q=>q.courseId))]){
    await selectCourse(page,courseId);
    const expected=getEligibleQuestions(QUESTION_BANK,{courseId});
    for(let i=0;i<expected.length;i++){
      const id=await page.locator('#questionCard').getAttribute('data-question-id');
      expect(id).toBe(expected[i].id);
      expect(await page.locator('#originalPrompt').textContent()).toBe(expected[i].prompt);
      if(i<expected.length-1)await page.locator('#nextSource').click();
    }
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('all six teachers keep their personalities and receive only the selected source ID',async({page})=>{
  await page.goto('/');await selectSource(page);await page.locator('#askTeacher').click();
  await expect(page.locator('#aiQuestion')).toContainText(first.number);
  for(const t of TEACHERS){
    await page.getByRole('button',{name:t.name,exact:true}).click();
    await expect(page.locator('#chat')).toContainText(t.greeting);
    await expect(page.getByRole('button',{name:t.name,exact:true})).toHaveAttribute('aria-pressed','true');
  }
  await page.getByRole('button',{name:'Çağatay Hoca',exact:true}).click();
  await page.getByText('İsteğe bağlı yetişkin argo modu',{exact:true}).click();
  await expect(page.locator('#profanityLevel')).toBeDisabled();
  await page.locator('#adultConfirmed').check();await expect(page.locator('#profanityLevel')).toBeDisabled();
  await page.locator('#profanityConsent').check();await page.locator('#profanityLevel').selectOption('heavy');
  await configureAI(page);
  const payloads=[];
  await page.route('https://tutor.example/api/tutor',route=>{const body=route.request().postDataJSON();payloads.push(body);return route.fulfill({json:{answer:'AI açıklaması — resmî çözüm değildir. Seçili kaynaktaki eşitlik adımını inceleyelim.',questionId:body.questionId}})});
  await page.locator('#message').fill('Seçili sorunun çözüm adımını açıkla.');await page.locator('#send').click();
  await expect(page.locator('#chat')).toContainText('Seçili kaynaktaki eşitlik');
  expect(payloads[0]).toMatchObject({questionId:first.id,teacherId:'cagatay',profanityLevel:'heavy',adultConfirmed:true,profanityConsent:true,helpMode:'hint'});
  expect(payloads[0]).not.toHaveProperty('question');expect(payloads[0]).not.toHaveProperty('topic');
  await page.getByRole('button',{name:'Beyza Öğretmen',exact:true}).click();
  await expect(page.locator('#chat')).not.toContainText('Seçili kaynaktaki eşitlik');
  await page.locator('#tutorMode').selectOption('solution');await page.locator('#message').fill('Seçili kaynak sorusunun tam çözümünü açıkla.');await page.locator('#send').click();
  await expect(page.locator('#chat')).toContainText('Seçili kaynaktaki eşitlik');
  expect(payloads[1]).toMatchObject({questionId:first.id,teacherId:'beyza',profanityLevel:'off',adultConfirmed:false,helpMode:'solution'});
  await page.getByRole('button',{name:'⌂ Ders'}).click();await page.locator('#nextSource').click();await page.locator('#askTeacher').click();
  await expect(page.locator('#chat')).not.toContainText('Seçili kaynaktaki eşitlik');
  await page.reload();await page.getByRole('button',{name:'✧ AI Hoca'}).click();
  await expect(page.getByRole('button',{name:'Beyza Öğretmen',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(k=>localStorage.getItem(k),storedKey)).not.toContain('adultConfirmed');
});

test('teacher preference is account-specific and old personal records remain intact',async({page})=>{
  const at=new Date(Date.now()-60000).toISOString();
  const legacy={id:'legacy-attempt',courseId:'numbers',exerciseId:'numbers-easy',difficulty:'easy',correct:true,at};
  const oldExam={id:'old-exam',type:'TYT',year:2024,date:at,duration:60,correct:1,wrong:1,blank:38,net:0.75,verified:false,markedAnswers:Array(40).fill(null)};
  await page.goto('/');await page.evaluate(({legacy,oldExam})=>{
    sessionStorage.setItem('ma_auth',JSON.stringify({access_token:'fake-a',refresh_token:'fake-r',expires_at_ms:Date.now()+3600000,user:{id:'alice'}}));
    localStorage.setItem('ma_learning_v1_alice',JSON.stringify({attempts:[legacy],diagnostic:{at:legacy.at,level:'Eski değerlendirme',responses:[{courseId:'numbers',correct:true}]}}));
    localStorage.setItem('matematik_akademim_exam_history_v11_alice',JSON.stringify([oldExam]));
  },{legacy,oldExam});
  const cloudPreferencesAt=new Date().toISOString(),writes=[];
  await page.route('https://*.supabase.co/**',route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname==='/rest/v1/learning_profiles'){
      if(req.method()==='POST'){writes.push(req.postDataJSON());return route.fulfill({json:[]})}
      return route.fulfill({json:[{user_id:'alice',state:{teacherId:'kemal',preferencesAt:cloudPreferencesAt,attempts:[]}}]});
    }
    return route.fulfill({json:[]});
  });
  await page.reload();await page.getByRole('button',{name:'✧ AI Hoca'}).click();
  await expect(page.getByRole('button',{name:'Profesör Kemal',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Beyza Öğretmen',exact:true}).click();await expect.poll(()=>writes.length).toBeGreaterThan(0);
  expect(writes.at(-1).user_id).toBe('alice');expect(writes.at(-1).state.teacherId).toBe('beyza');
  expect(writes.at(-1).state.attempts).toContainEqual(legacy);
  expect(writes.at(-1).state.diagnostic.level).toBe('Eski değerlendirme');
  await page.getByRole('button',{name:'⌂ Ders'}).click();
  await expect(page.locator('#questionCard')).not.toHaveAttribute('data-question-id','numbers-easy');
  await page.getByText('İlerlemem ve çalışma planım',{exact:true}).click();await expect(page.locator('#learningRoot')).toContainText('Eski yanıt sayısı: 1');
  await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#legacyExamWorkspace summary').first().click();await expect(page.locator('#recordCount')).toHaveText('1 kayıt');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('matematik_akademim_exam_history_v11_alice'))[0])).toMatchObject(oldExam);
  await page.getByRole('button',{name:'✧ AI Hoca'}).click();await page.locator('#message').fill('Önceki kullanıcının yazılmamış açıklama talebi');
  await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#logoutBtn').click();await page.getByRole('button',{name:'✧ AI Hoca'}).click();
  await expect(page.locator('#message')).toHaveValue('');await expect(page.getByRole('button',{name:'Elif Öğretmen',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('uncovered advanced topics keep their lessons and show the exact empty state',async({page})=>{
  await page.goto('/');await page.locator('#browseCourses').click();await expect(page.locator('#courseList button')).toHaveCount(COURSES.length);
  const last=COURSES.at(-1);await page.locator('#courseSearch').fill(last.title);await page.locator('#courseList button').first().click();
  await expect(page.locator('#learningRoot h1')).toHaveText(last.title);await expect(page.locator('#courseLesson')).toHaveAttribute('open','');
  await expect(page.locator('#courseLesson li')).toHaveCount(last.lessonSteps.length);
  await expect(page.locator('#emptySourceBank')).toContainText('Bu konu için henüz kaynaklı soru yok');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('revoking consent cancels the source-bound pending response',async({page})=>{
  await page.goto('/');await selectSource(page);await page.locator('#askTeacher').click();await page.getByRole('button',{name:'Çağatay Hoca',exact:true}).click();
  await page.getByText('İsteğe bağlı yetişkin argo modu',{exact:true}).click();await page.locator('#adultConfirmed').check();await page.locator('#profanityConsent').check();await page.locator('#profanityLevel').selectOption('extreme');await configureAI(page);
  let release,arrived;const hold=new Promise(r=>release=r),seen=new Promise(r=>arrived=r);
  await page.route('https://tutor.example/api/tutor',async route=>{arrived();await hold;await route.fulfill({json:{answer:'Old consent response',questionId:first.id}})});
  try{
    await page.locator('#message').fill('Seçili kaynak sorusunun yöntemini açıkla.');await page.locator('#send').click();await seen;
    await page.locator('#profanityConsent').uncheck();release();
    await expect(page.locator('#profanityLevel')).toHaveValue('off');await expect(page.locator('#send')).toBeEnabled();await expect(page.locator('#chat')).not.toContainText('Old consent response');
  }finally{release()}
});

test('Mert counts reviewed source work without reclassifying old generated exercises',async({page})=>{
  await page.goto('/');await page.evaluate(({first})=>{
    const at=new Date().toISOString();
    localStorage.setItem('ma_learning_v1_guest',JSON.stringify({teacherId:'mert',attempts:[
      {id:'old',courseId:'numbers',exerciseId:'numbers-easy',difficulty:'easy',correct:true,at},
      {id:'real',courseId:first.courseId,exerciseId:first.id,difficulty:'unclassified',correct:true,at}
    ]}));
  },{first});
  await page.reload();await page.getByRole('button',{name:'✧ AI Hoca'}).click();await expect(page.locator('#teacherDescription')).toContainText('1/3');await expect(page.locator('#teacherDescription')).toContainText('serin: 1');
});

test('delayed cloud load merges retained old history with newly answered source work',async({page})=>{
  await page.goto('/');await page.evaluate(()=>sessionStorage.setItem('ma_auth',JSON.stringify({access_token:'fake-a',refresh_token:'fake-r',expires_at_ms:Date.now()+3600000,user:{id:'alice'}})));
  const cloudAttempt={id:'remote-legacy',courseId:'numbers',exerciseId:'numbers-medium',correct:true,difficulty:'medium',at:new Date(Date.now()-60000).toISOString()};
  let release,arrived;const hold=new Promise(r=>release=r),seen=new Promise(r=>arrived=r);let firstRead=true;const writes=[];
  await page.route('https://*.supabase.co/**',async route=>{
    const req=route.request();if(new URL(req.url()).pathname!=='/rest/v1/learning_profiles')return route.fulfill({json:[]});
    if(req.method()==='POST'){writes.push(req.postDataJSON());return route.fulfill({json:[]})}
    if(firstRead){firstRead=false;arrived();await hold}
    return route.fulfill({json:[{user_id:'alice',state:{teacherId:'elif',attempts:[cloudAttempt]}}]});
  });
  try{
    await page.reload();await seen;await selectSource(page);await page.locator('#sourceResponse').fill(first.answer.value);await page.locator('#checkSourceAnswer').click();
    await page.waitForTimeout(800);expect(writes).toHaveLength(0);release();await expect.poll(()=>writes.length).toBeGreaterThan(0);
    expect(writes.at(-1).state.attempts).toHaveLength(2);expect(writes.at(-1).state.attempts).toContainEqual(cloudAttempt);
    expect(writes.at(-1).state.attempts.some(a=>a.exerciseId===first.id&&a.correct)).toBe(true);
    await expect(page.locator('#checkSourceAnswer')).toBeDisabled();
  }finally{release()}
});
