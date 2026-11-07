import {test, expect} from './fixtures.mjs';
import {selectFirstSource} from './source-helpers.mjs';
const KEY='matematik_akademim_exam_history_v11';
const go=async page=>{await page.goto('/');await page.getByRole('button',{name:'📝 Denemeler'}).click()};
const start=async page=>{await go(page);await page.locator('#startTYT').click()};
const finish=async page=>{page.once('dialog',d=>d.accept());await page.locator('#finishExam').click()};
test('40 answers, reload, keyboard navigation and manual result persisted once',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await expect(page.locator('#examGrid button')).toHaveCount(40);
  await page.locator('#examOptions').getByRole('button',{name:'A',exact:true}).click();
  await expect(page.locator('#examOptions button').first()).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('B');
  await expect(page.locator('#markedCount')).toHaveText('2 / 40 işaretli');
  await page.reload();await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#continueExam').click();
  await expect(page.locator('#currentQ')).toHaveText('2');
  await expect(page.locator('#markedCount')).toHaveText('2 / 40 işaretli');
  await finish(page);await expect(page.locator('#manualKey')).toBeVisible();
  await page.locator('#manualKey').fill('A'.repeat(39));await page.locator('#verifyManual').click();
  await expect(page.locator('#manualMessage')).toContainText('Tam 40');
  await page.locator('#manualKey').fill('A'.repeat(40));await page.locator('#verifyManual').click();
  await expect(page.locator('#examBody h1')).toHaveText('0.75 net');
  await page.locator('#backExams').click();await expect(page.locator('#recordCount')).toHaveText('1 kayıt');
  expect(await page.evaluate(k=>localStorage.getItem(k+'_guest_unfinished_exam'),KEY)).toBeNull();
  expect(errors).toEqual([]);
});
test('wall clock survives reload and automatically finishes at limit',async({page})=>{
  await page.clock.install();await start(page);
  await page.clock.fastForward(65000);await expect(page.locator('#examClock')).toHaveText('00:01:05');
  await page.evaluate(k=>{const key=k+'_guest_unfinished_exam';const s=JSON.parse(localStorage.getItem(key));s.limit=3600;s.started=Date.now()-3601000;localStorage.setItem(key,JSON.stringify(s))},KEY);
  await page.reload();await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#continueExam').click();
  await expect(page.locator('#manualKey')).toBeVisible();await expect(page.locator('#examBody h1')).toHaveText('01:00:00');
});
test('corrupt drafts cannot inject HTML or invalid choices',async({page})=>{
  await page.goto('/');await page.evaluate(k=>localStorage.setItem(k+'_guest_unfinished_exam',JSON.stringify({year:2026,type:'<img src=x onerror=alert(1)>',answers:Array(40).fill('Z'),index:0,started:Date.now(),limit:0})),KEY);
  await page.getByRole('button',{name:'📝 Denemeler'}).click();await expect(page.locator('#continueExam')).toHaveCount(0);
});
test('mobile workspace fits viewport and unknown PDF remains blocked',async({page})=>{
  await start(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#pdfFile').setInputFiles({name:'practice.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')});
  await expect(page.locator('#pdfStatus')).toContainText('doğrulanmadığı');
  await expect(page.locator('#selectPdf')).toBeDisabled();await expect(page.locator('#realPdf')).not.toHaveAttribute('src',/^blob:/);
});
test('mock Supabase signup, login, owner filter, upload and logout isolation',async({page})=>{
  const writes=[];const reads=[];
  await page.route('https://*.supabase.co/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname==='/auth/v1/signup')return route.fulfill({json:{user:{id:'alice'}}});
    if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:'fake-alice',refresh_token:'fake-refresh',expires_in:3600,user:{id:'alice',email:'alice@example.test'}}});
    if(request.method()==='POST'){writes.push(request.postDataJSON());return route.fulfill({json:[]})}
    reads.push(url.searchParams.get('user_id'));
    // Deliberately misbehaving fake service: client must also ignore another owner's rows.
    return route.fulfill({json:[{id:'foreign',user_id:'bob',exam_type:'AYT',correct:40,wrong:0,blank:0,net:40,duration_seconds:60,answers:{},created_at:new Date().toISOString()}]});
  });
  await go(page);await page.locator('#userEmail').fill('alice@example.test');await page.locator('#userPassword').fill('fake-password');await page.locator('#signUp').click();
  await expect(page.locator('#syncStatus')).toContainText('doğrulama');await page.locator('#signIn').click();
  await expect(page.locator('#syncStatus')).toContainText('eşitlendi');await expect(page.locator('#recordCount')).toHaveText('0 kayıt');
  await page.locator('#startTYT').click();await finish(page);await page.locator('#manualKey').fill('A'.repeat(40));await page.locator('#verifyManual').click();
  await expect(page.locator('#syncStatus')).toHaveText('Bulut kaydı tamamlandı.');
  expect(reads.every(x=>x==='eq.alice')).toBe(true);expect(writes).toHaveLength(1);expect(writes[0].user_id).toBe('alice');expect(writes[0].answers.markedAnswers).toHaveLength(40);
  await page.locator('#backExams').click();await page.locator('#logoutBtn').click();await expect(page.locator('#recordCount')).toHaveText('0 kayıt');
  expect(await page.evaluate(()=>sessionStorage.getItem('ma_auth'))).toBeNull();
});
test('AI response is text and recovers from error',async({page})=>{
  await page.goto('/');const source=await selectFirstSource(page);await page.getByRole('button',{name:'✧ AI Hoca'}).click();await page.locator('#teacher summary').filter({hasText:'AI bağlantı ayarları'}).click();
  await page.locator('#endpoint').fill('https://tutor.example');await page.locator('#access').fill('fake-access');await page.locator('#saveAI').click();
  let fail=true;await page.route('https://tutor.example/api/tutor',route=>route.fulfill({status:fail?502:200,json:fail?{error:'Tekrar dene'}:{questionId:source.id,isOfficialSolution:false,answer:'<img src=x onerror=alert(1)> açıklama'}}));
  await page.locator('#message').fill('Seçili kaynak sorusundaki adımı açıkla.');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('Tekrar dene');
  fail=false;await page.locator('#message').fill('Seçili kaynak sorusundaki adımı açıkla.');await page.locator('#send').click();await expect(page.locator('#chat')).toContainText('<img');await expect(page.locator('#chat img')).toHaveCount(0);
  await expect(page.locator('#send')).toBeEnabled();
});
test('unscored result retains answers and exports CSV without claiming official score',async({page})=>{
  await start(page);await page.keyboard.press('C');await finish(page);await page.locator('#saveUnscored').click();
  await expect(page.locator('#history')).toContainText('Puanlanmadı');
  const stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k+'_guest'))[0],KEY);
  expect(stored.net).toBeNull();expect(stored.markedAnswers[0]).toBe('C');expect(stored.verified).toBe(false);
  const downloadPromise=page.waitForEvent('download');await page.locator('#exportHistory').click();const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('deneme-gecmisim.csv');
  await page.reload();await page.getByRole('button',{name:'📝 Denemeler'}).click();await expect(page.locator('#history')).toContainText('Puanlanmadı');
  await page.getByRole('button',{name:'Manuel anahtarla değerlendir'}).click();await page.locator('#manualKey').fill('C'.repeat(40));await page.locator('#verifyManual').click();await expect(page.locator('#examBody h1')).toHaveText('1.00 net');await page.locator('#backExams').click();await expect(page.locator('#recordCount')).toHaveText('1 kayıt');
});
test('finished but unevaluated attempt keeps stopped duration after reload',async({page})=>{
  await page.clock.install();await start(page);await page.clock.fastForward(10000);await finish(page);
  await page.clock.fastForward(120000);await page.reload();await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#continueExam').click();
  await expect(page.locator('#manualKey')).toBeVisible();await expect(page.locator('#examBody h1')).toHaveText('00:00:10');
});
test('late cloud response after logout cannot populate guest history',async({page})=>{
  await page.goto('/');await page.evaluate(()=>sessionStorage.setItem('ma_auth',JSON.stringify({access_token:'fake-alice',refresh_token:'fake-refresh',expires_at_ms:Date.now()+3600000,user:{id:'alice'}})));
  await page.reload();let release;const held=new Promise(resolve=>release=resolve);let arrived;const seen=new Promise(resolve=>arrived=resolve);
  await page.route('https://*.supabase.co/**',async route=>{arrived();await held;await route.fulfill({json:[{id:'alice-record',user_id:'alice',exam_type:'TYT',correct:40,wrong:0,blank:0,net:40,duration_seconds:60,answers:{},created_at:new Date().toISOString()}]})});
  await page.getByRole('button',{name:'📝 Denemeler'}).click();await seen;await page.locator('#logoutBtn').click();release();
  await expect(page.locator('#recordCount')).toHaveText('0 kayıt');
  await page.waitForTimeout(100);expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k+'_guest')||'[]').length,KEY)).toBe(0);
});
test('storage quota failure keeps draft and avoids duplicate result',async({page})=>{
  await start(page);await finish(page);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.endsWith('_guest'))throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,key,value)}});
  await page.locator('#manualKey').fill('A'.repeat(40));await page.locator('#verifyManual').click();
  await expect(page.locator('#storageStatus')).toContainText('Tarayıcı kaydı yapılamadı');await expect(page.locator('#manualKey')).toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k+'_guest_unfinished_exam')!==null,KEY)).toBe(true);
});
test('expired token refresh preserves local results and draft',async({page})=>{
  await page.goto('/');await page.evaluate(k=>{
    sessionStorage.setItem('ma_auth',JSON.stringify({access_token:'expired',refresh_token:'fake-refresh',expires_at_ms:0,user:{id:'alice'}}));
    localStorage.setItem(k+'_alice',JSON.stringify([{id:'local-result',type:'TYT',year:2025,date:new Date().toISOString(),duration:60,correct:1,wrong:1,blank:38,net:0.75,verified:false,markedAnswers:Array(40).fill(null)}]));
    localStorage.setItem(k+'_alice_unfinished_exam',JSON.stringify({year:2025,type:'TYT',answers:Array(40).fill('A'),index:3,limit:0,started:Date.now()}));
  },KEY);let refreshes=0;
  await page.route('https://*.supabase.co/**',async route=>{
    const request=route.request();if(new URL(request.url()).pathname==='/auth/v1/token'){refreshes++;return route.fulfill({json:{access_token:'fresh-alice',refresh_token:'new-refresh',expires_in:3600,user:{id:'alice'}}})}
    expect(request.headers().authorization).toBe('Bearer fresh-alice');return route.fulfill({json:[]});
  });
  await page.reload();await page.getByRole('button',{name:'📝 Denemeler'}).click();await expect(page.locator('#syncStatus')).toContainText('eşitlendi');expect(refreshes).toBe(1);
  await expect(page.locator('#recordCount')).toHaveText('1 kayıt');await page.locator('#continueExam').click();await expect(page.locator('#currentQ')).toHaveText('4');await expect(page.locator('#markedCount')).toHaveText('40 / 40 işaretli');
});
