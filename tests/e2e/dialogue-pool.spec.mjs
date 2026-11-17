import {test,expect} from './fixtures.mjs';
import {TEACHERS,getTeacherLine} from '../../shared/teachers.js';
import {DIALOGUE_SCENARIOS,DIALOGUE_CATEGORIES} from '../../shared/teacher-dialogue-scenarios.js';
import {getTeacherDialogue} from '../../shared/teacher-dialogues.js';
import {chooseTeacher,configureAI,prepareTutorConfig} from './source-helpers.mjs';

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

test('another prepared example cycles locally and a single-variant concept never inherits the previous alternative',async({page})=>{
 let requests=0;await page.route('https://tutor.example/api/tutor',route=>{requests++;return route.fulfill({json:{error:'A preview must remain local'}})});
 await openPool(page);await configureAI(page);
 const before=await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest')),chat=await page.locator('#chat').innerText();
 await expect(page.locator('#dialogueScenario')).toHaveValue('start');await expect(page.locator('#nextDialogueVariant')).toBeVisible();await expect(page.locator('#dialogueVariantPosition')).toHaveText('1 / 2');
 const base=getTeacherDialogue('elif','start',0),alternate=getTeacherDialogue('elif','start',1);
 await expect(page.locator('#dialogueSample')).toContainText(base.teacher);
 await page.locator('#nextDialogueVariant').click();await expect(page.locator('#dialogueVariantPosition')).toHaveText('2 / 2');await expect(page.locator('#dialogueSample')).toContainText(alternate.teacher);
 await page.locator('#nextDialogueVariant').click();await expect(page.locator('#dialogueVariantPosition')).toHaveText('1 / 2');await expect(page.locator('#dialogueSample')).toContainText(base.teacher);
 await page.locator('#dialogueCategory').selectOption('concept');await page.locator('#dialogueScenario').selectOption('logarithm');await expect(page.locator('#nextDialogueVariant')).toBeHidden();await expect(page.locator('#dialogueSample')).toContainText(getTeacherDialogue('elif','logarithm').teacher);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);await expect(page.locator('#chat')).toHaveText(chat);
 expect(await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest'))).toBe(before);expect(requests).toBe(0);
});

test('clearing a chat rotates its greeting while navigation and reload do not persist or mix old conversation counters',async({page})=>{
 await page.goto('/');await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();
 const greetings=TEACHERS.find(teacher=>teacher.id==='elif').greetingResponses;
 const state=await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest'));
 await expect(page.locator('#chat')).toHaveText(getTeacherLine('elif','greeting',0));
 for(let variant=1;variant<=greetings.length;variant++){
  await page.locator('#clearChat').click();await expect(page.locator('#chat')).toHaveText(getTeacherLine('elif','greeting',variant));
  await page.locator('.nav').getByRole('button',{name:'Konular',exact:true}).click();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#chat')).toHaveText(getTeacherLine('elif','greeting',variant));
 }
 expect(await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest'))).toBe(state);
 await page.locator('#clearChat').click();await expect(page.locator('#chat')).toHaveText(getTeacherLine('elif','greeting',1));
 await page.reload();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#chat')).toHaveText(getTeacherLine('elif','greeting',0));
});

test('guest greeting rotations cannot leak into an account session or back after logout',async({page})=>{
 await page.route('https://*.supabase.co/**',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:'fake-dialogue-access',refresh_token:'fake-dialogue-refresh',expires_in:3600,user:{id:'dialogue-user',email:'dialogue-fixture@example.test'}}});
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204});
  if(url.pathname==='/rest/v1/learning_profiles')return route.fulfill({json:request.method()==='POST'?[]:[{user_id:'dialogue-user',state:{teacherId:'elif',preferencesAt:'2026-11-16T00:00:00.000Z',attempts:[]}}]});
  return route.fulfill({json:[]});
 });
 await page.goto('/');await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();
 await page.locator('#clearChat').click();await page.locator('#clearChat').click();await expect(page.locator('#chat')).toHaveText(getTeacherLine('elif','greeting',2));
 await page.locator('#accountButton').click();await page.locator('#userEmail').fill('dialogue-fixture@example.test');await page.locator('#userPassword').fill('fake-dialogue-password');await page.locator('#signIn').click();
 await expect.poll(()=>page.evaluate(()=>window.MAAccount.getUser())).toEqual({id:'dialogue-user'});await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#chat')).toHaveText(getTeacherLine('elif','greeting',0));
 await page.locator('#clearChat').click();await expect(page.locator('#chat')).toHaveText(getTeacherLine('elif','greeting',1));
 await page.locator('#accountButton').click();await page.locator('#logoutBtn').click();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#chat')).toHaveText(getTeacherLine('elif','greeting',0));
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_guest')||'{"attempts":[]}').attempts.length)).toBe(0);
});

test('a newer remote course profile discards an in-flight old lesson reply without losing either history',async({page})=>{
 const localAttempt={id:'local-kept',courseId:'fractions',exerciseId:'legacy-fraction-result',correct:false,difficulty:'easy',at:'2026-11-01T00:00:00.000Z'};
 const remoteAttempt={id:'remote-kept',courseId:'powers',exerciseId:'legacy-power-result',correct:true,difficulty:'easy',at:'2026-11-02T00:00:00.000Z'};
 const remoteAt=new Date(Date.now()+3600000).toISOString();
 await page.addInitScript(state=>localStorage.setItem('ma_learning_v1_course-sync-user',JSON.stringify(state)),{teacherId:'elif',courseId:'fractions',difficulty:'easy',preferencesAt:'2026-11-01T00:00:00.000Z',attempts:[localAttempt]});
 let releaseProfile,releaseAi,profileArrived,aiArrived,oldAiSettled,oldRequest,profileGets=0;
 const profileHeld=new Promise(resolve=>releaseProfile=resolve),aiHeld=new Promise(resolve=>releaseAi=resolve),profileSeen=new Promise(resolve=>profileArrived=resolve),aiSeen=new Promise(resolve=>aiArrived=resolve),oldAiDone=new Promise(resolve=>oldAiSettled=resolve);
 const sent=[];
 await page.route('https://*.supabase.co/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:'fake-course-sync-access',refresh_token:'fake-course-sync-refresh',expires_in:3600,user:{id:'course-sync-user',email:'course-sync-fixture@example.test'}}});
  if(url.pathname==='/rest/v1/rpc/ma_source_access_status')return route.fulfill({json:{userId:'course-sync-user',email:'course-sync-fixture@example.test',confirmed:true,isAdmin:false,status:'approved',bundleReady:false}});
  if(url.pathname==='/rest/v1/learning_profiles'&&request.method()==='GET'){
   profileGets++;if(profileGets===1){profileArrived();await profileHeld}
   return route.fulfill({json:[{user_id:'course-sync-user',state:{teacherId:'elif',courseId:'powers',difficulty:'easy',preferencesAt:remoteAt,attempts:[remoteAttempt]}}]});
  }
  return route.fulfill({json:[]});
 });
 await page.route('https://tutor.example/api/tutor',async route=>{
  const request=route.request(),body=request.postDataJSON();sent.push(body);
  if(sent.length===1){oldRequest=request;aiArrived();await aiHeld;try{return await route.fulfill({json:{mode:'lesson',courseId:'fractions',teacherId:'elif',isOfficialSolution:false,answer:'Discarded fraction response from the previous course'}})}finally{oldAiSettled()}}
  return route.fulfill({json:{mode:'lesson',courseId:'powers',teacherId:'elif',isOfficialSolution:false,answer:'Current power lesson reply'}});
 });
 try{
  await prepareTutorConfig(page);await page.goto('/');await page.locator('#accountButton').click();await page.locator('#userEmail').fill('course-sync-fixture@example.test');await page.locator('#userPassword').fill('fake-course-sync-password');await page.locator('#signIn').click();
  await expect.poll(()=>page.evaluate(()=>window.MAAccount.getUser())).toEqual({id:'course-sync-user'});await profileSeen;
  await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await page.locator('#teacherTask').selectOption('lesson');await expect(page.locator('#selectedTeacherName')).toHaveText('Elif Öğretmen');await expect(page.locator('#aiQuestion')).toContainText('Kesirler');await configureAI(page);
  await page.locator('#message').fill('Pay ve paydayı açıkla.');await page.locator('#send').click();await aiSeen;expect(sent[0]).toMatchObject({mode:'lesson',courseId:'fractions',teacherId:'elif'});
  releaseProfile();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_course-sync-user')).courseId)).toBe('powers');await expect(page.locator('#aiQuestion')).toContainText('Üslü');await expect(page.locator('#send')).toBeEnabled();
  releaseAi();await oldAiDone;const response=await oldRequest.response();if(response)await response.finished();
  await expect(page.locator('#chat')).not.toContainText('Discarded fraction response');
  await page.locator('#message').fill('Negatif üs kavramını açıkla.');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('Current power lesson reply');expect(sent[1]).toMatchObject({mode:'lesson',courseId:'powers',teacherId:'elif'});expect(JSON.stringify(sent[1].messages)).not.toContain('Discarded fraction response');
  await chooseTeacher(page,'Beyza Öğretmen');await chooseTeacher(page,'Elif Öğretmen');await expect(page.locator('#chat')).toContainText('Current power lesson reply');await expect(page.locator('#chat')).not.toContainText('Discarded fraction response');
  const attempts=await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_learning_v1_course-sync-user')).attempts);expect(attempts.find(row=>row.id==='local-kept')).toEqual(localAttempt);expect(attempts.find(row=>row.id==='remote-kept')).toEqual(remoteAttempt);expect(attempts).toHaveLength(2);
 }finally{releaseProfile();releaseAi()}
});
