import {test,expect} from './fixtures.mjs';
import {chooseTeacher,configureAI,prepareTutorAccount,prepareTutorConfig,TUTOR_USER_ID,signInTutor} from './source-helpers.mjs';
// User-submitted numeric problems below are test fixtures, never question-bank entries.
const reply=(answer,extra={})=>({mode:'chat',answer,isOfficialSolution:false,teacherId:'elif',provider:'gemini',...extra});
const learningSnapshot=page=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>/^ma_learning_|^ma_original_|exam_history/.test(key))));
async function openChat(page,{authenticated=true}={}){if(authenticated)await prepareTutorAccount(page);await page.goto('/');await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#teacherTask')).toHaveValue('chat');await configureAI(page)}
async function send(page,message){await page.locator('#message').fill(message);await page.locator('#send').click()}

test('long solutions stay complete when returning to a teacher while outgoing history remains within provider limits',async({page})=>{
 const tail='SONUC-KONTROLU: x=4, özgün koşullar sağlanıyor.';
 const longAnswer='Çözümün başlangıcı. '+('Gerekçeli işlem adımını koşullarıyla kontrol edelim. '.repeat(90))+tail;
 expect(longAnswer.length).toBeGreaterThan(2500);expect(longAnswer.length).toBeLessThan(10000);
 const sent=[];await page.route('https://tutor.example/api/tutor',route=>{sent.push(route.request().postDataJSON());return route.fulfill({json:reply(sent.length===1?longAnswer:'Son kontrolü birlikte inceleyebiliriz.')})});
 await openChat(page);const before=await page.evaluate(id=>JSON.parse(localStorage.getItem('ma_learning_v1_'+id)||'{"attempts":[]}').attempts,TUTOR_USER_ID);
 await send(page,'Yazdığım denklemin adımlarını açıkla.');await expect(page.locator('#chat')).toContainText(tail);
 await chooseTeacher(page,'Beyza Öğretmen');await chooseTeacher(page,'Elif Öğretmen');await expect(page.locator('#chat .bubble').last()).toHaveText(longAnswer);
 await page.locator('#teacherTask').selectOption('lesson');await page.locator('#teacherTask').selectOption('chat');await expect(page.locator('#chat .bubble').last()).toHaveText(longAnswer);
 await send(page,'Son kontrolün gerekçesini tekrar açıkla.');await expect(page.locator('#chat')).toContainText('Son kontrolü birlikte');
 const history=sent[1].messages;expect(history).toHaveLength(3);expect(history[1].content).toContain('Çözümün başlangıcı.');expect(history[1].content).toContain(tail);expect(history[1].content).toContain('gönderim için kısaltıldı');
 expect(history.every(message=>message.content.length<=2500)).toBe(true);expect(new TextEncoder().encode(JSON.stringify(history)).length).toBeLessThanOrEqual(12000);
 await expect(page.locator('#chat')).toContainText(longAnswer);expect(await page.evaluate(id=>JSON.parse(localStorage.getItem('ma_learning_v1_'+id)||'{"attempts":[]}').attempts,TUTOR_USER_ID)).toEqual(before);
});

test('typed mathematics and natural follow-up use the selected teacher and level without changing question or progress records',async({page})=>{
 const sent=[];await page.route('https://tutor.example/api/tutor',route=>{sent.push(route.request().postDataJSON());return route.fulfill({json:reply(sent.length===1?'Temel planında önce her iki taraftan 3 çıkarırız; 2x=8 olur. İki tarafa bölme ruhsatıyla x=4 buluruz.':'Mimarlık masasında merak etmek serbest; anlatımın temposunu birlikte ayarlayabiliriz.',{teacherId:'beyza'})})});
 await openChat(page);await chooseTeacher(page,'Beyza Öğretmen');await page.locator('#teachingLevel').selectOption('beginner');await page.locator('#tutorMode').selectOption('solution');
 const before=await learningSnapshot(page),questionId=await page.locator('#questionCard').getAttribute('data-question-id');
 await send(page,'2x + 3 = 11 denklemini adım adım çöz.');await expect(page.locator('#chat')).toContainText('x=4');
 expect(sent[0]).toMatchObject({mode:'chat',teacherId:'beyza',teachingLevel:'beginner',helpMode:'solution'});expect(sent[0]).not.toHaveProperty('courseId');expect(sent[0]).not.toHaveProperty('questionId');expect(sent[0].messages).toEqual([{role:'user',content:'2x + 3 = 11 denklemini adım adım çöz.'}]);
 await send(page,'Teşekkürler, bugün biraz yavaş ilerlemek istiyorum.');await expect(page.locator('#chat')).toContainText('temposunu birlikte');
 expect(sent[1].messages).toHaveLength(3);expect(sent[1].messages[1]).toMatchObject({role:'assistant'});expect(sent[1].messages[2].content).toContain('yavaş');
 expect(await learningSnapshot(page)).toEqual(before);await expect(page.locator('#questionCard')).toHaveAttribute('data-question-id',questionId);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});

test('an explicit lesson entry remains bound to its course and switching to chat removes that binding',async({page})=>{
 const sent=[];await page.route('https://tutor.example/api/tutor',route=>{const body=route.request().postDataJSON();sent.push(body);return route.fulfill({json:body.mode==='lesson'?{mode:'lesson',courseId:body.courseId,answer:'Payda sıfır olamaz.',isOfficialSolution:false,teacherId:'elif',provider:'gemini'}:reply('Yazdığın sorunun verilenlerinden ilerleyebiliriz.')})});
 await prepareTutorAccount(page);await page.goto('/');await page.locator('.nav').getByRole('button',{name:'Konular',exact:true}).click();await page.locator('#lessonSearch').fill('Kesirler');await page.locator('#lessonList button').first().click();await page.locator('#lessonAskTeacher').click();
 await expect(page.locator('#teacherTask')).toHaveValue('lesson');await configureAI(page);await send(page,'Paydanın koşulunu açıkla.');await expect(page.locator('#chat')).toContainText('sıfır olamaz');expect(sent[0]).toMatchObject({mode:'lesson',courseId:'fractions',helpMode:'hint',teachingLevel:'auto'});
 await page.locator('#teacherTask').selectOption('chat');await send(page,'Şimdi yazdığım soruyu çözmek istiyorum.');await expect(page.locator('#chat')).toContainText('verilenlerinden');expect(sent[1].mode).toBe('chat');expect(sent[1]).not.toHaveProperty('courseId');expect(sent[1].messages).toHaveLength(1);
 await page.locator('#teacherTask').selectOption('lesson');await expect(page.locator('#chat')).toContainText('Payda sıfır olamaz.');await expect(page.locator('#chat')).not.toContainText('verilenlerinden');
});

test('switching tasks or teaching level aborts pending replies and keeps them out of the new conversation',async({page})=>{
 let release,arrived;const held=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>arrived=resolve);const sent=[];
 await page.route('https://tutor.example/api/tutor',async route=>{const body=route.request().postDataJSON();sent.push(body);if(sent.length===1){arrived();await held;await route.fulfill({json:reply('STALE-CHAT-ANSWER')}).catch(()=>{});return}await route.fulfill({json:body.mode==='lesson'?{mode:'lesson',courseId:body.courseId,answer:'Güncel ders yanıtı.',isOfficialSolution:false,teacherId:'elif',provider:'gemini'}:reply('Yeni düzeye göre anlatım.')})});
 await openChat(page);
 try{
  await send(page,'Bu konuda yardımcı olur musun.');await seen;await page.locator('#teacherTask').selectOption('lesson');await page.locator('#teachingLevel').selectOption('advanced');release();await expect(page.locator('#send')).toBeEnabled();await expect(page.locator('#chat')).not.toContainText('STALE-CHAT-ANSWER');
  await send(page,'Tanımı açıkla.');await expect(page.locator('#chat')).toContainText('Güncel ders yanıtı.');expect(sent[1]).toMatchObject({mode:'lesson',teachingLevel:'advanced'});
  await page.locator('#teacherTask').selectOption('chat');await expect(page.locator('#chat')).not.toContainText('STALE-CHAT-ANSWER');await expect(page.locator('#chat')).not.toContainText('Güncel ders yanıtı.');await send(page,'Sade bir açıklama istiyorum.');await expect(page.locator('#chat')).toContainText('Yeni düzeye');expect(sent[2].messages).toHaveLength(1);
 }finally{release()}
});

test('quota exhaustion never retries or switches a provider and the original draft can be retried manually',async({page})=>{
 await page.clock.install();let calls=0;const requests=[];
 await page.route('https://tutor.example/api/tutor',route=>{calls++;requests.push(route.request().postDataJSON());return route.fulfill({status:calls===1?429:200,json:calls===1?{code:'FREE_QUOTA_EXHAUSTED',error:'Gemini kullanım kotasına ulaşıldı.'}:reply('Manuel denemenin yanıtı.')})});
 await openChat(page);const message='Bu tanımı daha sade anlat.';await send(page,message);await expect(page.locator('#chat')).toContainText('kotasına ulaşıldı');await expect(page.locator('#aiStatus')).toContainText('Otomatik tekrar');await expect(page.locator('#send')).toBeEnabled();await expect(page.locator('#message')).toHaveValue(message);
 await page.clock.runFor(180000);expect(calls).toBe(1);
 await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('Manuel denemenin');expect(calls).toBe(2);expect(requests[1].messages).toEqual(requests[0].messages);await expect(page.locator('#aiStatus')).toBeEmpty();
});

test('chat replies cannot impersonate a course or another teacher and valid replies are displayed as text',async({page})=>{
 let calls=0;await page.route('https://tutor.example/api/tutor',route=>{calls++;return route.fulfill({json:calls===1?reply('WRONG-TEACHER',{teacherId:'kemal'}):calls===2?reply('WRONG-CONTEXT',{courseId:'fractions'}):reply('<img src=x onerror=alert(1)> güvenli metin')})});
 await openChat(page);await send(page,'Merhaba.');await expect(page.locator('#chat')).toContainText('eşleşmiyor');await expect(page.locator('#chat')).not.toContainText('WRONG-TEACHER');
 await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('bağlamıyla eşleşmiyor');await expect(page.locator('#chat')).not.toContainText('WRONG-CONTEXT');
 await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('<img');await expect(page.locator('#chat img')).toHaveCount(0);
});

test('chat history and teaching preferences remain isolated across approved accounts and logout',async({page})=>{
 let calls=0;await page.route('https://tutor.example/api/tutor',route=>{calls++;return route.fulfill({json:reply(calls===1?'FIRST-ACCOUNT-PRIVATE-CHAT':'SECOND-ACCOUNT-PRIVATE-CHAT')})});
 await openChat(page);await page.locator('#teachingLevel').selectOption('advanced');await send(page,'Kendi çalışmam hakkında konuşmak istiyorum.');await expect(page.locator('#chat')).toContainText('FIRST-ACCOUNT-PRIVATE-CHAT');
 await page.locator('#accountButton').click();await page.locator('#logoutBtn').click();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#chat')).not.toContainText('FIRST-ACCOUNT-PRIVATE-CHAT');
 await prepareTutorAccount(page,{userId:'second-chat-user',email:'second-chat@example.test',accessToken:'second-chat-access',session:false});await signInTutor(page,'second-chat@example.test');await expect.poll(()=>page.evaluate(()=>window.MAAccount.getUser())).toEqual({id:'second-chat-user'});
 await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#chat')).not.toContainText('FIRST-ACCOUNT-PRIVATE-CHAT');await expect(page.locator('#teachingLevel')).toHaveValue('auto');await expect(page.locator('#teacherTask')).toHaveValue('chat');
 await send(page,'Kavram anlatımını sade tut.');await expect(page.locator('#chat')).toContainText('SECOND-ACCOUNT-PRIVATE-CHAT');
 await page.locator('#accountButton').click();await page.locator('#logoutBtn').click();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#chat')).not.toContainText('SECOND-ACCOUNT-PRIVATE-CHAT');await expect(page.locator('#chat')).not.toContainText('FIRST-ACCOUNT-PRIVATE-CHAT');
 expect(calls).toBe(2);
});

test('empty, nontext and oversized upstream replies are rejected while preserving the manual retry draft',async({page})=>{
 const invalid=[{unexpected:'object'},'','x'.repeat(10001)];let calls=0;
 await page.route('https://tutor.example/api/tutor',route=>route.fulfill({json:reply(invalid[calls++])}));
 await openChat(page);const draft='Bu kavramı açıkla.';
 for(let i=0;i<invalid.length;i++){
  await send(page,draft);await expect(page.locator('#chat .bubble').last()).toHaveText('Bağlantı hatası: Öğretmen yanıtı geçerli bir metin içermiyor.');await expect(page.locator('#message')).toHaveValue(draft);await expect(page.locator('#send')).toBeEnabled();
 }
 expect(calls).toBe(3);await expect(page.locator('#chat')).not.toContainText('[object Object]');
});

test('a background course preference sync cannot discard a course-independent chat reply',async({page})=>{
 const uid='chat-profile-race',oldAt='2026-11-01T00:00:00.000Z',newAt=new Date(Date.now()+60000).toISOString();
 await page.addInitScript(({uid,oldAt})=>localStorage.setItem('ma_learning_v1_'+uid,JSON.stringify({teacherId:'elif',courseId:'fractions',preferencesAt:oldAt,attempts:[]})),{uid,oldAt});
 let releaseProfile,profileArrived,releaseAnswer,answerArrived;
 const profileHold=new Promise(resolve=>releaseProfile=resolve),profileSeen=new Promise(resolve=>profileArrived=resolve),answerHold=new Promise(resolve=>releaseAnswer=resolve),answerSeen=new Promise(resolve=>answerArrived=resolve);
 await page.route('https://*.supabase.co/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(path==='/auth/v1/token')return route.fulfill({json:{access_token:'test-profile-chat-access',refresh_token:'test-profile-chat-refresh',expires_in:3600,user:{id:uid,email:'profile-chat@example.test'}}});
  if(path==='/rest/v1/rpc/ma_source_access_status')return route.fulfill({json:{userId:uid,email:'profile-chat@example.test',confirmed:true,isAdmin:false,status:'approved',bundleReady:false}});
  if(path==='/rest/v1/learning_profiles'&&request.method()==='GET'){profileArrived();await profileHold;return route.fulfill({json:[{user_id:uid,state:{teacherId:'elif',courseId:'powers',preferencesAt:newAt,attempts:[]}}]}).catch(()=>{})}
  return route.fulfill({json:[]});
 });
 let sent;await page.route('https://tutor.example/api/tutor',async route=>{sent=route.request().postDataJSON();answerArrived();await answerHold;await route.fulfill({json:reply('COURSE-INDEPENDENT-CHAT-ANSWER')}).catch(()=>{})});
 try{
  await prepareTutorConfig(page);await openChat(page,{authenticated:false});await page.locator('#accountButton').click();await page.locator('#userEmail').fill('profile-chat@example.test');await page.locator('#userPassword').fill('fake-profile-chat-password');await page.locator('#signIn').click();await profileSeen;
  await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await send(page,'Bugün nasıl çalışacağımı konuşalım.');await answerSeen;releaseProfile();
  await expect.poll(()=>page.evaluate(uid=>JSON.parse(localStorage.getItem('ma_learning_v1_'+uid)).courseId,uid)).toBe('powers');await expect(page.locator('#teacherTask')).toHaveValue('chat');await expect(page.locator('#send')).toBeDisabled();
  releaseAnswer();await expect(page.locator('#chat')).toContainText('COURSE-INDEPENDENT-CHAT-ANSWER');expect(sent.mode).toBe('chat');expect(sent).not.toHaveProperty('courseId');
 }finally{releaseProfile();releaseAnswer()}
});
