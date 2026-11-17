import {test,expect} from './fixtures.mjs';
import {prepareTutorAccount,prepareTutorConfig,signInTutor,configureAI,TUTOR_ACCESS_TOKEN,TUTOR_USER_ID} from './source-helpers.mjs';
const reply=answer=>({mode:'chat',answer,isOfficialSolution:false,teacherId:'elif',provider:'gemini'});
async function teacherPage(page){await page.goto('/');await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await configureAI(page)}
async function send(page,text){await page.locator('#message').fill(text);await page.locator('#send').click()}

test('teachers are present for a visitor and normal approved account login replaces all access-code setup',async({page})=>{
 await prepareTutorAccount(page,{session:false});const requests=[];
 await page.route('https://tutor.example/api/tutor',route=>{requests.push({body:route.request().postDataJSON(),authorization:route.request().headers().authorization});return route.fulfill({json:reply('Hesabınla öğretmenin hazır.')})});
 await teacherPage(page);await expect(page.locator('#selectedTeacherName')).toHaveText('Elif Öğretmen');await expect(page.locator('#teacherPicker .teacher-card')).toHaveCount(10);await expect(page.locator('#teacherSignIn')).toBeVisible();
 await send(page,'Merhaba öğretmenim.');await expect(page.locator('#aiStatus')).toContainText('hesabına giriş yap');expect(requests).toHaveLength(0);
 await page.locator('#teacherSignIn').click();await expect(page.locator('#accountPanel')).toHaveAttribute('open','');await page.locator('#userEmail').fill('tutor-fixture@example.test');await page.locator('#userPassword').fill('fake-tutor-password');await page.locator('#signIn').click();
 await expect.poll(()=>page.evaluate(()=>window.MAAccount.getUser())).toEqual({id:TUTOR_USER_ID});await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#teacherSignIn')).toBeHidden();
 await send(page,'Kavramı birlikte inceleyelim.');await expect(page.locator('#chat')).toContainText('Hesabınla öğretmenin hazır');expect(requests).toHaveLength(1);expect(requests[0].authorization).toBe('Bearer '+TUTOR_ACCESS_TOKEN);
 expect(JSON.stringify(requests[0].body)).not.toMatch(/accessToken|APP_ACCESS_TOKEN|GEMINI_API_KEY/);await configureAI(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});

test('a persisted normal session refreshes automatically and remains ready after reload without a code field',async({page})=>{
 let refreshes=0;await prepareTutorAccount(page,{expired:true,initialAccessToken:'expired-old-session',onRefresh:()=>refreshes++});const tokens=[];
 await page.route('https://tutor.example/api/tutor',route=>{tokens.push(route.request().headers().authorization);return route.fulfill({json:reply('Yenilenen oturumunla devam edebiliriz.')})});
 await teacherPage(page);await send(page,'Tanımı açıkla.');await expect(page.locator('#chat')).toContainText('Yenilenen oturumunla');expect(refreshes).toBe(1);expect(tokens).toEqual(['Bearer '+TUTOR_ACCESS_TOKEN]);
 await page.reload();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await configureAI(page);await send(page,'Şimdi ipucunu açıkla.');await expect(page.locator('#chat')).toContainText('Yenilenen oturumunla');expect(tokens).toEqual(['Bearer '+TUTOR_ACCESS_TOKEN,'Bearer '+TUTOR_ACCESS_TOKEN]);expect(refreshes).toBe(1);
});

test('server permission revocation is shown as account approval and never retries with a legacy shared code',async({page})=>{
 await prepareTutorAccount(page);await page.addInitScript(()=>{sessionStorage.setItem('math_ai_access','obsolete-shared-code');localStorage.setItem('math_ai_worker_url','https://untrusted-tutor.example');localStorage.setItem('teacher_admin','true')});let calls=0,untrusted=0;
 await page.route('https://untrusted-tutor.example/**',route=>{untrusted++;return route.abort()});
 await page.route('https://tutor.example/api/tutor',route=>{calls++;expect(route.request().headers().authorization).toBe('Bearer '+TUTOR_ACCESS_TOKEN);return route.fulfill({status:calls===1?200:403,json:calls===1?reply('İlk izinli konuşma.'):{code:'TUTOR_ACCESS_DENIED',error:'Öğretmen erişimi için yönetici onayı gerekiyor.'}})});
 await teacherPage(page);await send(page,'Merhaba.');await expect(page.locator('#chat')).toContainText('İlk izinli konuşma');await send(page,'İzni tekrar kontrol et.');await expect(page.locator('#aiStatus')).toContainText('yönetici onayı');await expect(page.locator('#message')).toHaveValue('İzni tekrar kontrol et.');await expect(page.locator('#send')).toBeEnabled();expect(calls).toBe(2);expect(untrusted).toBe(0);await configureAI(page);
});

test('logout clears a pending teacher reply and the next visitor cannot reuse the old session',async({page})=>{
 await prepareTutorAccount(page);let release,arrived;const hold=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>arrived=resolve);let calls=0;
 await page.route('https://tutor.example/api/tutor',async route=>{calls++;arrived();await hold;await route.fulfill({json:reply('PRIVATE-OLD-ACCOUNT-REPLY')}).catch(()=>{})});
 await teacherPage(page);
 try{
  await send(page,'Kendi sorumu konuşalım.');await seen;await page.locator('#accountButton').click();await page.locator('#logoutBtn').click();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();release();
  await expect(page.locator('#chat')).not.toContainText('PRIVATE-OLD-ACCOUNT-REPLY');await expect(page.locator('#teacherSignIn')).toBeVisible();await send(page,'Misafir olarak tekrar deniyorum.');await expect(page.locator('#aiStatus')).toContainText('hesabına giriş yap');expect(calls).toBe(1);expect(await page.evaluate(()=>sessionStorage.getItem('ma_auth'))).toBeNull();
 }finally{release()}
});

for(const workerUrl of ['', 'https://untrusted-tutor.example/path?key=bad'])test('invalid owner endpoint never sends the account session to '+(workerUrl?'an arbitrary address':'a missing address'),async({page})=>{
 await prepareTutorAccount(page);await prepareTutorConfig(page,workerUrl);let calls=0;
 await page.route('https://tutor.example/**',route=>{calls++;return route.abort()});await page.route('https://untrusted-tutor.example/**',route=>{calls++;return route.abort()});
 await teacherPage(page);await send(page,'Kavramı açıkla.');await expect(page.locator('#chat')).toContainText('Öğretmen hizmeti henüz hazır değil');await expect(page.locator('#message')).toHaveValue('Kavramı açıkla.');expect(calls).toBe(0);await configureAI(page);
});

test('a rejected session offers only the normal account login without displaying an access-code prompt',async({page})=>{
 await prepareTutorAccount(page);let calls=0;await page.route('https://tutor.example/api/tutor',route=>{calls++;return route.fulfill({status:401,json:{code:'TUTOR_SESSION_INVALID',error:'Oturumun doğrulanamadı.'}})});
 await teacherPage(page);await send(page,'İpucu ver.');await expect(page.locator('#teacherSignIn')).toBeVisible();await expect(page.locator('#aiStatus')).toContainText('yeniden giriş');await page.locator('#teacherSignIn').click();await expect(page.locator('#accountPanel')).toHaveAttribute('open','');expect(calls).toBe(1);await configureAI(page);
});
