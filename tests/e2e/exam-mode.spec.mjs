import {test,expect} from './fixtures.mjs';
import {TURKISH_EXAMS} from '../../data/turkish-exams.js';
import {openAccount} from './source-helpers.mjs';

const source=TURKISH_EXAMS.find(row=>row.id==='osym-2023-tyt-math');
function captureHttp(page){const requests=[];page.on('request',request=>{if(/^https?:/.test(request.url())){let url=request.url();try{url=decodeURIComponent(url)}catch{}requests.push(url+'\n'+(request.postData()||''))}});return requests}
// Blank synthetic documents exercise the private renderer/storage only. They are
// never question-bank content or proof of a real publisher file's identity.
async function blankDocument(browser,marker='PRIVATE EXAM TEST DOCUMENT'){
 const generator=await browser.newPage();
 try{await generator.setContent(Array.from({length:32},(_,index)=>`<section style="page-break-after:always"><h1>${marker}</h1><p>Blank automation fixture. Page ${index+1}; no exam question content.</p></section>`).join(''));return await generator.pdf()}
 finally{await generator.close()}
}
async function enterMode(page,{navigate=true}={}){
 if(navigate)await page.goto('/');
 if(!await page.locator('#examModePage').isVisible())await page.locator('#examModeButton').click();
 await expect(page.locator('#examModePage')).toBeVisible();
 await expect(page.locator('.nav button')).toHaveCount(4);
}
async function openReviewed(page,row=source){
 await page.locator('#examFamily').selectOption(row.examType);await page.locator('#examYear').selectOption(String(row.year));await page.locator('#examBooklet').selectOption(row.id);await page.locator('#openExamBooklet').click();
 await expect(page.locator('#privateLibraryPanel')).toHaveAttribute('open','');await expect(page.locator('#privateKnownExam')).toHaveValue(row.id);
}
async function importReviewed(page,browser,{row=source,key=''}={}){
 await enterMode(page);await openReviewed(page,row);
 if(key){await page.locator('#privateSourceDetails > summary').click();await page.locator('#privateImportKey').fill(key)}
 await page.locator('#privateFile').setInputFiles({name:'private-exam-marker.pdf',mimeType:'application/pdf',buffer:await blankDocument(browser)});await page.locator('#importPrivatePdf').click();await expect(page.locator('#privateBookTitle')).toBeVisible();
}
async function openKeySettings(page){
 const details=page.locator('#privateStudy details').filter({has:page.locator('#privateManualKey')});if(!await page.locator('#privateManualKey').isVisible())await details.locator('summary').first().click();
}
async function finish(page){page.once('dialog',dialog=>dialog.accept());await page.locator('#privateFinish').click()}
async function expectCleanNormalMode(page){
 await expect(page.locator('#examModePage')).toBeHidden();await expect(page.locator('#study')).toBeVisible();await expect(page.locator('input[type=file],iframe')).toHaveCount(0);
 expect(await page.locator('body').innerText()).not.toMatch(/pdf|dosya\s*(?:seç|yükle)|kitapçık\s*aktar/iu);
 await expect(page.locator('.nav button')).toHaveCount(4);
}

test('exam mode is explicit and returning restores the unchanged four-tab question interface',async({page})=>{
 await page.goto('/');await expectCleanNormalMode(page);const before=await page.locator('#questionCard').getAttribute('data-question-id');
 await enterMode(page,{navigate:false});await openReviewed(page);await expect(page.locator('#privateFile')).toBeVisible();await expect(page.locator('#study')).toBeHidden();
 await page.locator('#closeExamMode').click();await expectCleanNormalMode(page);await expect(page.locator('#questionCard')).toHaveAttribute('data-question-id',before);
});
test('private exam renders in the native viewer and resumes 40 answers and paused time without uploads',async({page,browser})=>{
 const bodies=captureHttp(page);await importReviewed(page,browser);
 await expect(page.locator('#privatePdf')).toHaveAttribute('src',/^blob:/);await expect(page.locator('#privateGrid button')).toHaveCount(40);
 await expect.poll(()=>page.frames().some(frame=>frame.url().startsWith('chrome-extension://'))).toBe(true);const viewer=page.frames().find(frame=>frame.url().startsWith('chrome-extension://'));await expect.poll(()=>viewer.locator('pdf-viewer').evaluate(element=>element.loadState_)).toBe('success');
 await page.clock.install();await page.locator('#privateStart').click();await page.locator('#privateChoices button').filter({hasText:/^A$/}).click();await page.clock.fastForward(9000);await page.locator('#privatePause').click();await expect(page.locator('#privatePause')).toHaveText('Devam et');await page.clock.fastForward(60000);await expect(page.locator('#privateClock')).toHaveText('00:00:09');
 await page.reload();await enterMode(page,{navigate:false});await openReviewed(page);await page.locator('#privateBookList button').filter({hasText:'2023'}).click();await expect(page.locator('#privatePause')).toHaveText('Devam et');await expect(page.locator('#privateChoices button').first()).toHaveAttribute('aria-pressed','true');await expect(page.locator('#privateClock')).toHaveText('00:00:09');
 await page.locator('#privatePause').click();await page.clock.fastForward(3000);await expect(page.locator('#privateClock')).toHaveText('00:00:12');await page.locator('#closeExamMode').click();await expectCleanNormalMode(page);
 expect(bodies.join('\n')).not.toMatch(/%PDF|PRIVATE EXAM TEST DOCUMENT|private-exam-marker/);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('reviewed official key never scores until the local booklet identity is explicitly confirmed',async({page,browser})=>{
 await importReviewed(page,browser);await page.locator('#privateStart').click();await page.locator('#privateChoices button').filter({hasText:new RegExp('^'+source.answerKey[0]+'$')}).click();await finish(page);await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');
 await openKeySettings(page);await page.locator('#privateBindKey').click();await expect(page.locator('#privateStatus')).toContainText('işaretle');await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');
 await page.locator('#privateConfirmIdentity').check();await page.locator('#privateBindKey').click();await expect(page.locator('#privateResult h3')).toHaveText('1.00 çalışma neti');await expect(page.locator('#privateResult')).toContainText('1 doğru / 0 yanlış / 39 boş');await expect(page.locator('#privateResult')).toContainText('dosya bağımsız doğrulanmadı');
});
test('unknown KPSS key remains unverified even when a user JSON claims official verification',async({page,browser})=>{
 await enterMode(page);await page.locator('#examFamily').selectOption('KPSS');await page.locator('#examYear').selectOption('2025');await page.locator('#examKpssLevel').selectOption('KPSS_LISANS');await page.locator('#examBooklet').selectOption('custom');await page.locator('#openExamBooklet').click();
 await expect(page.locator('#privateType')).toHaveValue('KPSS_LISANS');await expect(page.locator('#privateCount')).toHaveValue('30');await page.locator('#privateFile').setInputFiles({name:'kpss-private-fixture.pdf',mimeType:'application/pdf',buffer:await blankDocument(browser)});await page.locator('#importPrivatePdf').click();await page.locator('#privateStart').click();await expect(page.locator('#privateGrid button')).toHaveCount(30);
 await openKeySettings(page);const key='ABCDE'.repeat(6);await page.locator('#privateKeyFile').setInputFiles({name:'my-private-key.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({key,verified:true,provenance:'official-source'}))});await expect(page.locator('#privateManualKey')).toHaveValue(key);await expect(page.locator('#privateStatus')).toContainText('resmî sayılmaz');await page.locator('#privateChoices button').first().click();await finish(page);await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');await expect(page.locator('#privateConfirmIdentity')).toHaveCount(0);
 await page.locator('#privateManualScore').click();await expect(page.locator('#privateResult h3')).toHaveText('1.00 çalışma neti');await expect(page.locator('#privateResult')).toContainText('manuel');
});
for(const id of ['osym-2019-tyt-math','osym-2026-ayt-math'])test(`${id} cancellation cannot produce a net from obsolete or user-entered letters`,async({page,browser})=>{
 const row=TURKISH_EXAMS.find(item=>item.id===id);await importReviewed(page,browser,{row,key:'A'.repeat(40)});await page.locator('#privateStart').click();await finish(page);await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');await expect(page.locator('#privateResult')).toContainText('İptal');await expect(page.locator('#privateManualScore')).toHaveCount(0);await expect(page.locator('#privateConfirmIdentity')).toHaveCount(0);
});
test('switching accounts never exposes another owner document, private key or HTTP document bytes',async({page,browser})=>{
 const bodies=captureHttp(page),key='ABCDE'.repeat(8);await importReviewed(page,browser,{key});
 await page.route('https://*.supabase.co/**',route=>new URL(route.request().url()).pathname==='/auth/v1/token'?route.fulfill({json:{access_token:'fake-alice',refresh_token:'fake-refresh',expires_in:3600,user:{id:'alice'}}}):route.fulfill({json:[]}));
 await openAccount(page);await expect(page.locator('#examModePage')).toBeHidden();await page.locator('#userEmail').fill('alice@example.test');await page.locator('#userPassword').fill('fake-password');await page.locator('#signIn').click();await expect.poll(()=>page.evaluate(()=>window.MAAccount.getUser())).toEqual({id:'alice'});
 await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();await enterMode(page,{navigate:false});await openReviewed(page);await expect(page.locator('#privateBookList')).toContainText('kitapçık bulunmuyor');await expect(page.locator('#privateStudy')).toBeEmpty();
 await openAccount(page);await page.locator('#logoutBtn').click();await page.locator('.nav').getByRole('button',{name:'Soru çöz',exact:true}).click();await enterMode(page,{navigate:false});await openReviewed(page);await page.locator('#privateBookList button').filter({hasText:'2023'}).click();await expect(page.locator('#privateManualKey')).toHaveValue(key);
 expect(bodies.join('\n')).not.toMatch(/%PDF|PRIVATE EXAM TEST DOCUMENT|private-exam-marker/);expect(bodies.join('\n')).not.toContain(key);
});
test('uploaded document MIME and user title cannot execute HTML in the application',async({page})=>{
 await enterMode(page);await page.locator('#examFamily').selectOption('KPSS');await page.locator('#examBooklet').selectOption('custom');await page.locator('#openExamBooklet').click();await page.locator('#privateTitle').fill('<img src=x onerror="window.EXAM_HTML_EXECUTED=true">');
 await page.locator('#privateFile').setInputFiles({name:'untrusted.pdf',mimeType:'text/html',buffer:Buffer.from('%PDF-1.4\n<script>parent.EXAM_HTML_EXECUTED=true</script>')});await page.locator('#importPrivatePdf').click();await expect(page.locator('#privateBookTitle')).toBeVisible();await expect(page.locator('#privateBookTitle img')).toHaveCount(0);expect(await page.evaluate(()=>window.EXAM_HTML_EXECUTED)).toBeUndefined();expect(await page.locator('#privatePdf').evaluate(async frame=>(await fetch(frame.src.split('#')[0])).headers.get('content-type'))).toBe('application/pdf');
});
test('partial public KPSS booklet preserves three original question numbers without claiming a full official score',async({page,browser})=>{
 await enterMode(page);await page.locator('#examFamily').selectOption('KPSS');await page.locator('#examYear').selectOption('2024');await page.locator('#examKpssLevel').selectOption('KPSS_ONLISANS');await page.locator('#examBooklet').selectOption('osym-2024-kpss-onlisans-public-partial');
 await expect(page.locator('#officialBookletLink')).toHaveAttribute('href','https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/ONL/kitapcik01092024.pdf');await expect(page.locator('#examModeNote')).toContainText('3 matematik sorusu');await expect(page.locator('#examModeNote')).toContainText('Tam deneme değildir');await page.locator('#openExamBooklet').click();
 await expect(page.locator('#privateCount')).toHaveValue('3');await expect(page.locator('#privateQuestionNumbers')).toHaveValue('33, 39, 57');await page.locator('#privateFile').setInputFiles({name:'partial-kpss-private-fixture.pdf',mimeType:'application/pdf',buffer:await blankDocument(browser)});await page.locator('#importPrivatePdf').click();await page.locator('#privateStart').click();
 await expect(page.locator('#privateGrid button')).toHaveCount(3);expect(await page.locator('#privateGrid button').allTextContents()).toEqual(['33','39','57']);await finish(page);await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');await expect(page.locator('#privateConfirmIdentity')).toHaveCount(0);await expect(page.locator('#privateBindKey')).toHaveCount(0);
});
