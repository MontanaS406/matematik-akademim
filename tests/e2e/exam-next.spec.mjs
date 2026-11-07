import {test,expect} from './fixtures.mjs';
async function openLegacy(page){const panel=page.locator('#legacyExamWorkspace');await expect(panel).toBeAttached();if(await panel.getAttribute('open')===null)await page.locator('#legacyExamWorkspace > summary').click()}
const KEY='matematik_akademim_exam_history_v11';
async function go(page){await page.goto('/');await page.getByRole('button',{name:'📝 Denemeler'}).click();await openLegacy(page)}
async function begin(page){await go(page);await page.locator('#startTYT').click()}
async function finish(page){page.once('dialog',d=>d.accept());await page.locator('#finishExam').click()}
test('paused clock and flags survive reload and resume without counting pause',async({page})=>{
  await page.clock.install();await begin(page);await page.clock.fastForward(12000);await page.locator('#flagQuestion').click();await page.locator('#pauseExam').click();
  await expect(page.locator('#examWork')).toBeHidden();await page.clock.fastForward(120000);await expect(page.locator('#examClock')).toHaveText('00:00:12');
  await page.reload();await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#continueExam').click();await expect(page.locator('#pauseExam')).toHaveText('Devam et');
  await page.locator('#pauseExam').click();await expect(page.locator('#flagQuestion')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#examGrid button').first()).toHaveAccessibleName(/sonra çözmek için işaretli/);
  await page.clock.fastForward(3000);await expect(page.locator('#examClock')).toHaveText('00:00:15');
});
test('local PDF only 2018 selection and full-session countdown are separate from practice',async({page})=>{
  await go(page);await expect(page.locator('#realYear option')).toHaveCount(9);await page.locator('#realYear').selectOption('2018');await page.locator('#examMode').selectOption('full');await expect(page.locator('#examLimit')).toBeDisabled();await page.locator('#startTYT').click();
  await expect(page.locator('#examRemaining')).toHaveText('Kalan 02:15:00');await expect(page.locator('#realPdf')).not.toHaveAttribute('src',/https:/);
  const s=await page.evaluate(k=>JSON.parse(localStorage.getItem(k+'_guest_unfinished_exam')),KEY);expect(s.source).toBeNull();expect(s.mode).toBe('full');expect(s.answers).toHaveLength(40);
});
test('manual saved key enables wrong question review and user-labelled topic analysis',async({page})=>{
  await begin(page);await page.locator('#examOptions').getByRole('button',{name:'B',exact:true}).click();await page.getByText('Konu etiketi ekle',{exact:true}).click();await page.locator('#questionTopic').selectOption('Sayılar');await finish(page);await page.locator('#manualKey').fill('A'.repeat(40));await page.locator('#verifyManual').click();await page.locator('#backExams').click();await openLegacy(page);
  await page.getByText('Yanlışlar ve konu analizi',{exact:true}).click();await expect(page.locator('#history')).toContainText('Sayılar: 0 D / 1 Y / 0 B');await expect(page.locator('#history')).toContainText('1. soru B → A');
  await page.reload();await page.getByRole('button',{name:'📝 Denemeler'}).click();await openLegacy(page);await expect(page.getByText('Yanlışlar ve konu analizi',{exact:true})).toHaveCount(1);
});
test('history compares only like-for-like exam type and mode',async({page})=>{
  await page.goto('/');await page.evaluate(k=>localStorage.setItem(k+'_guest',JSON.stringify([{id:'a',type:'TYT',year:2024,date:'2026-01-01T00:00:00Z',duration:60,correct:10,wrong:0,blank:30,net:10},{id:'b',type:'TYT',year:2025,date:'2026-01-02T00:00:00Z',duration:50,correct:12,wrong:0,blank:28,net:12},{id:'c',type:'AYT',year:2025,date:'2026-01-03T00:00:00Z',duration:70,correct:10,wrong:0,blank:30,net:10}])),KEY);await page.reload();
  await page.getByRole('button',{name:'📝 Denemeler'}).click();await openLegacy(page);await page.getByText('İki denemeyi karşılaştır',{exact:true}).click();await page.locator('#compareFirst').selectOption('a');await page.locator('#compareSecond').selectOption('b');await expect(page.locator('#compareResult')).toContainText('+2.00');await expect(page.locator('#compareResult')).toContainText('−00:00:10');await page.locator('#compareSecond').selectOption('c');await expect(page.locator('#compareResult')).toContainText('Aynı sınav türünü');
});
test('account learning facade bounds state and exposes only user identity',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('ma_auth',JSON.stringify({access_token:'fake-alice',refresh_token:'fake-refresh',expires_at_ms:Date.now()+3600000,user:{id:'alice'}})));
  const posted=[];await page.route('https://*.supabase.co/**',async route=>{const request=route.request(),url=new URL(request.url());if(url.pathname==='/rest/v1/learning_profiles'){if(request.method()==='POST'){posted.push(request.postDataJSON());return route.fulfill({json:[]})}return route.fulfill({json:[{user_id:'bob',state:{private:true}}]})}return route.fulfill({json:[]})});
  await page.goto('/');await page.waitForFunction(()=>window.MAAccount);
  expect(await page.evaluate(()=>window.MAAccount.getUser())).toEqual({id:'alice'});
  expect(await page.evaluate(()=>window.MAAccount.loadLearning())).toBeNull();
  await page.evaluate(()=>window.MAAccount.saveLearning({selectedTeacher:'selin',progress:{}}));
  expect(posted.some(r=>r.user_id==='alice'&&r.state.selectedTeacher==='selin')).toBe(true);
  expect(await page.evaluate(()=>window.MAAccount.saveLearning({big:'ş'.repeat(60000)}).then(()=>false,()=>true))).toBe(true);
});
