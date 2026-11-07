import {test,expect} from './fixtures.mjs';
import {TEACHERS} from '../../shared/teachers.js';
import {COURSES,diagnosticQuestions} from '../../shared/curriculum.js';
test('curriculum lesson, three levels, test and diagnostic produce a personal plan',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('#learningRoot h1')).toHaveText(COURSES[0].title);
 await page.locator('#courseLesson summary').click();await expect(page.locator('.worked')).toContainText(COURSES[0].example.answer);
 await page.locator('#learningChoices').getByRole('button',{name:String(COURSES[0].exercises.easy.answer),exact:true}).click();
 await expect(page.locator('#learningFeedback')).toContainText('Doğru cevap');
 await page.locator('#learningDifficulty').selectOption('hard');await expect(page.locator('#learningQuiz')).toContainText(COURSES[0].exercises.hard.prompt);
 await page.getByText('Seviyem ve çalışma planım',{exact:true}).click();await page.locator('#topicTest').click();
 for(const d of ['easy','medium','hard']){await page.locator('#learningChoices').getByRole('button',{name:String(COURSES[0].exercises[d].answer),exact:true}).click();await page.locator('#nextLearning').click()}
 await expect(page.locator('#learningQuiz')).toContainText('3 / 3 doğru');
 await page.locator('#startDiagnostic').click();
 for(const q of diagnosticQuestions()){await page.locator('#learningChoices').getByRole('button',{name:String(q.answer),exact:true}).click();await page.locator('#nextLearning').click()}
 await expect(page.locator('#learningQuiz')).toContainText('Seviye taraması tamamlandı');
 await expect(page.locator('#diagnosticSummary')).toContainText('Son tarama');await expect(page.locator('#planList li').first()).toBeVisible();
 await page.reload();await page.getByText('Seviyem ve çalışma planım',{exact:true}).click();await expect(page.locator('#diagnosticSummary')).toContainText('Son tarama');expect(errors).toEqual([]);
});
test('all requested teachers switch in one click with distinct greetings and adult opt-in',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'✧ AI Hoca'}).click();
 for(const t of TEACHERS){await page.getByRole('button',{name:t.name,exact:true}).click();await expect(page.locator('#chat')).toContainText(t.greeting);await expect(page.getByRole('button',{name:t.name,exact:true})).toHaveAttribute('aria-pressed','true')}
 await page.getByRole('button',{name:'Çağatay Hoca',exact:true}).click();await page.getByText('İsteğe bağlı yetişkin argo modu',{exact:true}).click();await expect(page.locator('#profanityLevel')).toBeDisabled();
 await page.locator('#adultConfirmed').check();await expect(page.locator('#profanityLevel')).toBeDisabled();await page.locator('#profanityConsent').check();await page.locator('#profanityLevel').selectOption('heavy');
 await page.locator('summary').filter({hasText:'AI bağlantı ayarları'}).click();await page.locator('#endpoint').fill('https://tutor.example');await page.locator('#access').fill('test-only');await page.locator('#saveAI').click();
 const payloads=[];await page.route('https://tutor.example/api/tutor',route=>{payloads.push(route.request().postDataJSON());return route.fulfill({json:{answer:'Denklemi kontrol edelim.'}})});
 await page.locator('#message').fill('3x+5=20');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('Denklemi kontrol');
 expect(payloads[0]).toMatchObject({teacherId:'cagatay',profanityLevel:'heavy',adultConfirmed:true,profanityConsent:true,helpMode:'hint'});
 await page.getByRole('button',{name:'Beyza Öğretmen',exact:true}).click();await expect(page.locator('#chat')).not.toContainText('Denklemi kontrol');
 await page.locator('#tutorMode').selectOption('solution');await page.locator('#message').fill('Bir üçgenin alanı');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('Denklemi kontrol');expect(payloads[1]).toMatchObject({teacherId:'beyza',profanityLevel:'off',adultConfirmed:false,helpMode:'solution'});
 await page.reload();await page.getByRole('button',{name:'✧ AI Hoca'}).click();await expect(page.getByRole('button',{name:'Beyza Öğretmen',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>localStorage.getItem('ma_learning_v1_guest'))).not.toContain('adultConfirmed');
});
test('account-specific teacher preference loads from cloud and never leaks into guest',async({page})=>{
 await page.goto('/');await page.evaluate(()=>sessionStorage.setItem('ma_auth',JSON.stringify({access_token:'fake-a',refresh_token:'fake-r',expires_at_ms:Date.now()+3600000,user:{id:'alice'}})));
 const cloudPreferencesAt=new Date().toISOString();const writes=[];await page.route('https://*.supabase.co/**',route=>{const req=route.request(),url=new URL(req.url());if(url.pathname==='/rest/v1/learning_profiles'){if(req.method()==='POST'){writes.push(req.postDataJSON());return route.fulfill({json:[]})}return route.fulfill({json:[{user_id:'alice',state:{teacherId:'kemal',preferencesAt:cloudPreferencesAt,attempts:[]}}]})}return route.fulfill({json:[]})});
 await page.reload();await page.getByRole('button',{name:'✧ AI Hoca'}).click();await expect(page.getByRole('button',{name:'Profesör Kemal',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Beyza Öğretmen',exact:true}).click();await expect.poll(()=>writes.length).toBeGreaterThan(0);expect(writes.at(-1).user_id).toBe('alice');expect(writes.at(-1).state.teacherId).toBe('beyza');
 await page.locator('#message').fill('Önceki kullanıcının yazılmamış sorusu');await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#logoutBtn').click();await page.getByRole('button',{name:'✧ AI Hoca'}).click();await expect(page.locator('#message')).toHaveValue('');await expect(page.getByRole('button',{name:'Elif Öğretmen',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('course search reaches university lessons and mobile layout stays in viewport',async({page})=>{
 await page.goto('/');await page.locator('#browseCourses').click();await expect(page.locator('#courseList button')).toHaveCount(COURSES.length);
 const last=COURSES.at(-1);await page.locator('#courseSearch').fill(last.title);await page.locator('#courseList button').first().click();await expect(page.locator('#learningRoot h1')).toHaveText(last.title);await page.locator('#courseLesson summary').click();await expect(page.locator('.worked')).toContainText(last.example.answer);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('revoking profanity consent cancels the pending response',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'✧ AI Hoca'}).click();await page.getByRole('button',{name:'Çağatay Hoca',exact:true}).click();await page.getByText('İsteğe bağlı yetişkin argo modu',{exact:true}).click();await page.locator('#adultConfirmed').check();await page.locator('#profanityConsent').check();await page.locator('#profanityLevel').selectOption('extreme');
 await page.locator('#teacher summary').filter({hasText:'AI bağlantı ayarları'}).click();await page.locator('#endpoint').fill('https://tutor.example');await page.locator('#access').fill('test-only');await page.locator('#saveAI').click();
 let release,arrived;const hold=new Promise(r=>release=r),seen=new Promise(r=>arrived=r);await page.route('https://tutor.example/api/tutor',async route=>{arrived();await hold;await route.fulfill({json:{answer:'Old intense response'}})});
 await page.locator('#message').fill('Denklem çöz');await page.locator('#send').click();await seen;await page.locator('#profanityConsent').uncheck();release();await expect(page.locator('#profanityLevel')).toHaveValue('off');await expect(page.locator('#send')).toBeEnabled();await expect(page.locator('#chat')).not.toContainText('Old intense response');
});
test('Mert uses actual local practice counts and streaks',async({page})=>{
 await page.goto('/');await page.evaluate(()=>{const at=new Date().toISOString();localStorage.setItem('ma_learning_v1_guest',JSON.stringify({teacherId:'mert',attempts:[{id:'a1',courseId:'numbers',exerciseId:'numbers-easy',difficulty:'easy',correct:true,at},{id:'a2',courseId:'numbers',exerciseId:'numbers-medium',difficulty:'medium',correct:true,at}]}))});await page.reload();await page.getByRole('button',{name:'✧ AI Hoca'}).click();await expect(page.locator('#teacherDescription')).toContainText('2/3');await expect(page.locator('#teacherDescription')).toContainText('serin: 2');
});
test('delayed initial cloud load merges old and new attempts before autosave',async({page})=>{
 await page.goto('/');await page.evaluate(()=>sessionStorage.setItem('ma_auth',JSON.stringify({access_token:'fake-a',refresh_token:'fake-r',expires_at_ms:Date.now()+3600000,user:{id:'alice'}})));
 const cloudAttempt={id:'remote-1',courseId:'numbers',exerciseId:'numbers-medium',correct:true,difficulty:'medium',at:new Date(Date.now()-60000).toISOString()};
 let release,arrived;const hold=new Promise(r=>release=r),seen=new Promise(r=>arrived=r);let first=true;const writes=[];
 await page.route('https://*.supabase.co/**',async route=>{const req=route.request();if(new URL(req.url()).pathname!=='/rest/v1/learning_profiles')return route.fulfill({json:[]});if(req.method()==='POST'){writes.push(req.postDataJSON());return route.fulfill({json:[]})}if(first){first=false;arrived();await hold}return route.fulfill({json:[{user_id:'alice',state:{teacherId:'elif',attempts:[cloudAttempt]}}]})});
 await page.reload();await seen;await page.locator('#learningChoices').getByRole('button',{name:String(COURSES[0].exercises.easy.answer),exact:true}).click();
 await page.waitForTimeout(800);expect(writes).toHaveLength(0);release();await expect.poll(()=>writes.length).toBeGreaterThan(0);
 expect(writes.at(-1).state.attempts).toHaveLength(2);expect(writes.at(-1).state.attempts.map(a=>a.id)).toContain('remote-1');
 await expect(page.locator('#learningChoices button').first()).toBeDisabled();
});
