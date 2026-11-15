import {test,expect} from './fixtures.mjs';
import {TEACHERS} from '../../shared/teachers.js';
import {AI_BANK} from '../../data/ai-bank.js';
import {createAiRegistry} from '../../shared/ai-bank.js';
const registry=createAiRegistry(AI_BANK);
const teacherById=id=>TEACHERS.find(teacher=>teacher.id===id);
import {chooseTeacher,configureAI,openAdultOptions} from './source-helpers.mjs';

async function openLessonTeacher(page){
 await page.goto('/');await page.locator('#bankPool').selectOption('original');await expect(page.locator('#questionCard')).toHaveCount(0);
 await page.locator('.nav').getByRole('button',{name:'Konular',exact:true}).click();await page.locator('#lessonSearch').fill('Kesirler');await page.locator('#lessonList button').first().click();await page.locator('#lessonAskTeacher').click();await expect(page.locator('#teacher')).toBeVisible();
}
const lessonReply=answer=>({mode:'lesson',courseId:'fractions',isOfficialSolution:false,answer});

test('all ten teachers keep distinct greetings and stored choices in lesson mode',async({page})=>{
 await openLessonTeacher(page);const greetings=new Set();
 for(const teacher of TEACHERS){await chooseTeacher(page,teacher.name);await expect(page.locator('#selectedTeacherName')).toHaveText(teacher.name);greetings.add(await page.locator('#chat').innerText());expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_guest')).teacherId)).toBe(teacher.id)}expect(greetings.size).toBe(10);
 await chooseTeacher(page,'Çağatay Hoca');await openAdultOptions(page);await expect(page.locator('#profanityLevel')).toBeDisabled();await page.locator('#adultConfirmed').check();await expect(page.locator('#profanityLevel')).toBeDisabled();await page.locator('#profanityConsent').check();await page.locator('#profanityLevel').selectOption('heavy');await configureAI(page);const sent=[];
 await page.route('https://tutor.example/api/tutor',route=>{const body=route.request().postDataJSON();sent.push(body);return route.fulfill({json:lessonReply('Bu konuyu tanımlarından başlayarak açıklayalım.')})});
 await page.locator('#message').fill('Pay ve paydayı açıkla.');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('Bu konuyu tanımlarından');expect(sent[0]).toMatchObject({mode:'lesson',courseId:'fractions',teacherId:'cagatay',profanityLevel:'heavy',adultConfirmed:true,profanityConsent:true,helpMode:'hint'});expect(sent[0]).not.toHaveProperty('question');expect(sent[0]).not.toHaveProperty('questionId');
 await chooseTeacher(page,'Beyza Öğretmen');await page.locator('#tutorMode').selectOption('solution');await page.locator('#message').fill('Pay ve paydayı açıkla.');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('Bu konuyu tanımlarından');expect(sent[1]).toMatchObject({mode:'lesson',courseId:'fractions',teacherId:'beyza',profanityLevel:'off',adultConfirmed:false,helpMode:'solution'});expect(sent[1]).not.toHaveProperty('questionId');
 await page.reload();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#selectedTeacherName')).toHaveText('Beyza Öğretmen');expect(await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest'))).not.toContain('adultConfirmed');
});
test('ten teacher cards show distinct avatars and character previews stay local, collapsed and tied to the selected teacher',async({page})=>{
 await openLessonTeacher(page);await configureAI(page);let modelRequests=0;
 await page.route('https://tutor.example/api/tutor',route=>{modelRequests++;return route.fulfill({json:lessonReply('Bu yanıt otomatik istenmemeli.')})});
 await page.locator('#teacherChange').click();await expect(page.locator('#teacherPicker .teacher-card')).toHaveCount(10);
 const avatars=await page.locator('#teacherPicker .teacher-avatar').allTextContents();expect(new Set(avatars).size).toBe(10);
 for(const teacher of TEACHERS)await expect(page.locator('#teacherPicker').getByRole('button',{name:teacher.name,exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 const methods=new Set(),dialogues=new Set();
 for(const id of ['beyza','riza','nermin','bora','derya']){
  const teacher=teacherById(id);await chooseTeacher(page,teacher.name);
  await expect(page.locator('#teacherPersonality')).not.toHaveAttribute('open','');await expect(page.locator('#teacherMethod')).toBeHidden();
  await page.locator('#teacherPersonality').getByText('Karakteri tanı',{exact:true}).click();
  await expect(page.locator('#teacherMethod li')).toHaveText(teacher.teachingMethod);
  await expect(page.locator('#teacherStyleSamples')).toContainText('Hazır konuşma örnekleri');await expect(page.locator('#teacherStyleSamples .teacher-style-sample')).toHaveCount(3);
  for(const [index,sample]of teacher.sampleDialogue.entries()){
   const example=page.locator('#teacherStyleSamples .teacher-style-sample').nth(index);await expect(example).toContainText(sample.student);await expect(example).toContainText(sample.teacher);
  }
  methods.add(await page.locator('#teacherMethod').innerText());dialogues.add(await page.locator('#teacherStyleSamples').innerText());
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 }
 expect(methods.size).toBe(5);expect(dialogues.size).toBe(5);expect(modelRequests).toBe(0);
});
test('new teacher choices round-trip separately in guest and signed-in accounts without replacing earlier IDs or consent',async({page})=>{
 const remoteAt=new Date(Date.now()-60000).toISOString(),writes=[];
 await page.route('https://*.supabase.co/**',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:'fake-teacher-access',refresh_token:'fake-teacher-refresh',expires_in:3600,user:{id:'teacher-user',email:'teacher-fixture@example.test'}}});
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204});
  if(url.pathname==='/rest/v1/learning_profiles'){
   if(request.method()==='POST'){writes.push(request.postDataJSON());return route.fulfill({json:[]})}
   return route.fulfill({json:[{user_id:'teacher-user',state:{teacherId:'bora',preferencesAt:remoteAt,attempts:[]}}]});
  }
  return route.fulfill({json:[]});
 });
 await openLessonTeacher(page);await chooseTeacher(page,'Derya Dedektif');await page.reload();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#selectedTeacherName')).toHaveText('Derya Dedektif');
 await page.locator('#accountButton').click();await page.locator('#userEmail').fill('teacher-fixture@example.test');await page.locator('#userPassword').fill('fake-teacher-password');await page.locator('#signIn').click();
 await expect.poll(()=>page.evaluate(()=>window.MAAccount.getUser())).toEqual({id:'teacher-user'});await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#selectedTeacherName')).toHaveText('Bora Kaptan');
 await chooseTeacher(page,'Nermin Şef');await expect.poll(()=>writes.length).toBeGreaterThan(0);expect(writes.at(-1)).toMatchObject({user_id:'teacher-user',state:{teacherId:'nermin'}});
 await page.locator('#accountButton').click();await page.locator('#logoutBtn').click();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#selectedTeacherName')).toHaveText('Derya Dedektif');
 const stored=await page.evaluate(()=>({guest:JSON.parse(localStorage.getItem('ma_learning_v1_guest')),account:JSON.parse(localStorage.getItem('ma_learning_v1_teacher-user'))}));expect(stored.guest.teacherId).toBe('derya');expect(stored.account.teacherId).toBe('nermin');expect(JSON.stringify(stored)).not.toContain('adultConfirmed');
});
test('correct and incorrect AI-practice feedback uses the selected new teacher without requesting a new question',async({page})=>{
 const sent=[];await page.route('https://tutor.example/api/tutor',route=>{sent.push(route.request().postDataJSON());return route.fulfill({json:lessonReply('İstenmemeli.')})});
 await page.goto('/');await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await chooseTeacher(page,'Bora Kaptan');await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();
 const first=registry.getQuestion(await page.locator('#questionCard').getAttribute('data-question-id'));await page.locator(`[data-option="${first.answer.value}"]`).click();await page.locator('#checkSourceAnswer').click();await expect(page.locator('#sourceFeedback')).toContainText(teacherById('bora').correctResponse);await expect(page.locator('#sourceFeedback')).not.toContainText(teacherById('elif').correctResponse);
 await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await chooseTeacher(page,'Nermin Şef');await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();await page.locator('#nextSource').click();
 const next=registry.getQuestion(await page.locator('#questionCard').getAttribute('data-question-id')),wrong=next.options.find(option=>option.id!==next.answer.value);await page.locator(`[data-option="${wrong.id}"]`).click();await page.locator('#checkSourceAnswer').click();const feedback=await page.locator('#sourceFeedback').innerText();expect(teacherById('nermin').incorrectResponses.some(line=>feedback.includes(line))).toBe(true);expect(teacherById('bora').incorrectResponses.some(line=>feedback.includes(line))).toBe(false);expect(sent).toHaveLength(0);
 const attempts=await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_guest')).attempts);expect(attempts).toHaveLength(2);expect(attempts.map(attempt=>attempt.correct)).toEqual([true,false]);
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
