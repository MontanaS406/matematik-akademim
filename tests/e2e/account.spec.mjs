import {test,expect} from './fixtures.mjs';
import {HISTORY_KEY,openAccount,openProgress,chooseTeacher} from './source-helpers.mjs';
const session=(user='alice',expired=false)=>({access_token:expired?'expired':'fake-'+user,refresh_token:'fake-refresh',expires_at_ms:expired?0:Date.now()+3600000,user:{id:user,email:user+'@example.test'}});
const localRecord=(id='saved-result')=>({id,type:'TYT',year:2024,date:'2026-01-01T12:00:00Z',duration:60,correct:1,wrong:1,blank:38,net:0.75,markedAnswers:Array(40).fill(null)});
const dbRecord=(id,user)=>({id,user_id:user,exam_type:'TYT',correct:40,wrong:0,blank:0,net:40,duration_seconds:60,answers:{year:2025},created_at:new Date().toISOString()});

test('signup confirmation, login and history reads stay owner-scoped and logout isolates guests',async({page})=>{
 const reads=[];
 await page.route('https://*.supabase.co/**',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname==='/auth/v1/signup')return route.fulfill({json:{user:{id:'alice'}}});
  if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:'fake-alice',refresh_token:'fake-refresh',expires_in:3600,user:{id:'alice',email:'alice@example.test'}}});
  if(url.pathname==='/rest/v1/exam_results'&&request.method()==='GET'){reads.push(url.searchParams.get('user_id'));return route.fulfill({json:[dbRecord('foreign','bob')]})}
  return route.fulfill({json:[]});
 });
 await page.goto('/');await openAccount(page);await page.locator('#userEmail').fill('alice@example.test');await page.locator('#userPassword').fill('fake-password');await page.locator('#signUp').click();await expect(page.locator('#syncStatus')).toContainText('doğrulama');await page.locator('#signIn').click();await expect.poll(()=>page.evaluate(()=>window.MAAccount.getUser())).toEqual({id:'alice'});await expect.poll(()=>reads.length).toBeGreaterThan(0);
 expect(reads.length).toBeGreaterThan(0);expect(reads.every(value=>value==='eq.alice')).toBe(true);await expect(page.locator('#history .history-row')).toHaveCount(0);expect(await page.evaluate(()=>window.MAAccount.getUser())).toEqual({id:'alice'});
 await page.locator('#logoutBtn').click();expect(await page.evaluate(()=>sessionStorage.getItem('ma_auth'))).toBeNull();expect(await page.evaluate(()=>window.MAAccount.getUser())).toBeNull();await expect(page.locator('#history .history-row')).toHaveCount(0);
});
test('old personal history and unfinished records remain byte-for-byte intact without old UI',async({page})=>{
 const record=localRecord(),draft={type:'TYT',year:2024,index:3,answers:Array(40).fill('A'),started:Date.now(),limit:0},original=JSON.stringify([record,{unrecognizedLegacy:true,retain:'personal'}]),unfinished=JSON.stringify(draft);
 await page.goto('/');await page.evaluate(({key,original,unfinished})=>{localStorage.setItem(key+'_guest',original);localStorage.setItem(key+'_guest_unfinished_exam',unfinished)},{key:HISTORY_KEY,original,unfinished});await page.reload();await openProgress(page);await expect(page.locator('#history')).toContainText('0.75 net');await expect(page.locator('#history .history-row')).toHaveCount(1);
 expect(await page.evaluate(key=>localStorage.getItem(key+'_guest'),HISTORY_KEY)).toBe(original);expect(await page.evaluate(key=>localStorage.getItem(key+'_guest_unfinished_exam'),HISTORY_KEY)).toBe(unfinished);
});
test('late history response after logout never writes into guest history',async({page})=>{
 await page.addInitScript(value=>sessionStorage.setItem('ma_auth',JSON.stringify(value)),session());let release,arrived;const held=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>arrived=resolve);
 await page.route('https://*.supabase.co/**',async route=>{if(new URL(route.request().url()).pathname!=='/rest/v1/exam_results')return route.fulfill({json:[]});arrived();await held;return route.fulfill({json:[dbRecord('late-alice','alice')]})});
 try{await page.goto('/');await openAccount(page);await seen;await page.locator('#logoutBtn').click();const response=page.waitForResponse(r=>r.url().includes('/rest/v1/exam_results'));release();await response;await expect(page.locator('#history .history-row')).toHaveCount(0);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key+'_guest')||'[]'),HISTORY_KEY)).toEqual([])}finally{release()}
});
test('expired token refreshes once and preserves the exact existing result and draft',async({page})=>{
 const record=localRecord('local-result'),draft=JSON.stringify({year:2025,type:'TYT',answers:Array(40).fill('A'),index:3,limit:0,started:Date.now()});
 await page.addInitScript(({auth,key,record,draft})=>{sessionStorage.setItem('ma_auth',JSON.stringify(auth));localStorage.setItem(key+'_alice',JSON.stringify([record]));localStorage.setItem(key+'_alice_unfinished_exam',draft)},{auth:session('alice',true),key:HISTORY_KEY,record,draft});let refreshes=0;const headers=[];
 await page.route('https://*.supabase.co/**',route=>{const request=route.request(),url=new URL(request.url());if(url.pathname==='/auth/v1/token'){refreshes++;return route.fulfill({json:{access_token:'fresh-alice',refresh_token:'new-refresh',expires_in:3600,user:{id:'alice'}}})}headers.push(request.headers().authorization);return route.fulfill({json:[]})});
 await page.goto('/');await openAccount(page);await expect.poll(()=>headers.length).toBeGreaterThan(0);expect(refreshes).toBe(1);expect(headers.every(value=>value==='Bearer fresh-alice')).toBe(true);await expect(page.locator('#history')).toContainText('0.75 net');
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key+'_alice')),HISTORY_KEY)).toEqual([record]);expect(await page.evaluate(key=>localStorage.getItem(key+'_alice_unfinished_exam'),HISTORY_KEY)).toBe(draft);
});
test('account facade exposes only identity, ignores a foreign profile and bounds UTF-8 writes',async({page})=>{
 await page.addInitScript(value=>sessionStorage.setItem('ma_auth',JSON.stringify(value)),session());const posted=[],filters=[];
 await page.route('https://*.supabase.co/**',route=>{const request=route.request(),url=new URL(request.url());if(url.pathname==='/rest/v1/learning_profiles'){filters.push(url.searchParams.get('user_id'));if(request.method()==='POST'){posted.push(request.postDataJSON());return route.fulfill({json:[]})}return route.fulfill({json:[{user_id:'bob',state:{private:true}}]})}return route.fulfill({json:[]})});
 await page.goto('/');await expect.poll(()=>page.evaluate(()=>window.MAAccount?.getUser())).toEqual({id:'alice'});expect(await page.evaluate(()=>window.MAAccount.loadLearning())).toBeNull();await page.evaluate(()=>window.MAAccount.saveLearning({teacherId:'beyza',attempts:[]}));expect(posted).toContainEqual(expect.objectContaining({user_id:'alice',state:{teacherId:'beyza',attempts:[]}}));expect(filters.filter(Boolean).every(value=>value==='eq.alice')).toBe(true);expect(await page.evaluate(()=>window.MAAccount.saveLearning({big:'ş'.repeat(60000)}).then(()=>false,()=>true))).toBe(true);
});
test('teacher choice and retained personal attempts are account-specific',async({page})=>{
 const at=new Date(Date.now()-60000).toISOString(),legacy={id:'legacy-attempt',courseId:'numbers',exerciseId:'numbers-easy',difficulty:'easy',correct:true,at};
 await page.addInitScript(({auth,legacy})=>{sessionStorage.setItem('ma_auth',JSON.stringify(auth));localStorage.setItem('ma_learning_v1_alice',JSON.stringify({attempts:[legacy],diagnostic:{at:legacy.at,level:'Eski değerlendirme',responses:[{courseId:'numbers',correct:true}]}}))},{auth:session(),legacy});const writes=[],cloudPreferencesAt=new Date().toISOString();
 await page.route('https://*.supabase.co/**',route=>{const request=route.request(),url=new URL(request.url());if(url.pathname==='/rest/v1/learning_profiles'){if(request.method()==='POST'){writes.push(request.postDataJSON());return route.fulfill({json:[]})}return route.fulfill({json:[{user_id:'alice',state:{teacherId:'kemal',preferencesAt:cloudPreferencesAt,attempts:[]}}]})}return route.fulfill({json:[]})});
 await page.goto('/');await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#selectedTeacherName')).toHaveText('Profesör Kemal');await chooseTeacher(page,'Beyza Öğretmen');await expect.poll(()=>writes.length).toBeGreaterThan(0);const saved=writes.at(-1);expect(saved.user_id).toBe('alice');expect(saved.state.teacherId).toBe('beyza');expect(saved.state.attempts).toContainEqual(legacy);expect(saved.state.diagnostic.level).toBe('Eski değerlendirme');
 await page.locator('#message').fill('Önceki kullanıcıya ait gönderilmemiş mesaj');await openAccount(page);await page.locator('#logoutBtn').click();await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await expect(page.locator('#message')).toHaveValue('');await expect(page.locator('#selectedTeacherName')).toHaveText('Elif Öğretmen');
});
test('delayed profile load merges new teacher preferences with retained old attempts while the bank is empty',async({page})=>{
 await page.addInitScript(value=>sessionStorage.setItem('ma_auth',JSON.stringify(value)),session());const old={id:'remote-legacy',courseId:'numbers',exerciseId:'numbers-medium',correct:true,difficulty:'medium',at:new Date(Date.now()-60000).toISOString()};let release,arrived,firstRead=true;const hold=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>arrived=resolve),writes=[];
 await page.route('https://*.supabase.co/**',async route=>{const req=route.request();if(new URL(req.url()).pathname!=='/rest/v1/learning_profiles')return route.fulfill({json:[]});if(req.method()==='POST'){writes.push(req.postDataJSON());return route.fulfill({json:[]})}if(firstRead){firstRead=false;arrived();await hold}return route.fulfill({json:[{user_id:'alice',state:{teacherId:'elif',attempts:[old]}}]})});
 try{await page.goto('/');await seen;await page.locator('.nav').getByRole('button',{name:'Öğretmen',exact:true}).click();await chooseTeacher(page,'Beyza Öğretmen');await page.waitForTimeout(750);expect(writes).toHaveLength(0);release();await expect.poll(()=>writes.length).toBeGreaterThan(0);expect(writes.at(-1).state.attempts).toContainEqual(old);expect(writes.at(-1).state.teacherId).toBe('beyza');expect(writes.at(-1).state.attempts).toHaveLength(1);await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();await expect(page.locator('#questionBankEmpty')).toBeVisible();await expect(page.locator('#questionCard')).toHaveCount(0)}finally{release()}
});
