import {test,expect} from './fixtures.mjs';
async function openLegacy(page){const panel=page.locator('#legacyExamWorkspace');await expect(panel).toBeAttached();if(await panel.getAttribute('open')===null)await page.locator('#legacyExamWorkspace > summary').click()}
import {TURKISH_EXAMS} from '../../data/turkish-exams.js';
const first=TURKISH_EXAMS.find(row=>row.id==='osym-2023-tyt-math');
async function enter(page){await page.goto('/');await page.locator('#openPrivateExams').click();await expect(page.locator('#privateLibraryPanel')).toHaveAttribute('open','')}
async function pdf(browser){const generator=await browser.newPage();await generator.setContent('<h1>PRIVATE TEST DOCUMENT</h1><p>Synthetic fixture only; no actual exam copied.</p>');const result=await generator.pdf();await generator.close();return result}
async function importBook(page,browser,{known=first.id,count=40,type='TYT',key=''}={}){
 await enter(page);if(known)await page.locator('#privateKnownExam').selectOption(known);else{await page.locator('#privateType').selectOption(type);await page.locator('#privateTitle').fill('Kullanıcıya ait gerçek kaynağın test temsili');await page.locator('#privateSourceUrl').fill('https://www.osym.gov.tr/test-source');await page.locator('#privateCount').fill(String(count))}
 if(key){if(await page.locator('#privateSourceDetails').getAttribute('open')===null)await page.locator('#privateSourceDetails > summary').click();await page.locator('#privateImportKey').fill(key)}
 await page.locator('#privateFile').setInputFiles({name:'private-marker-secret-file.pdf',mimeType:'application/pdf',buffer:await pdf(browser)});await page.locator('#importPrivatePdf').click();await expect(page.locator('#privateBookTitle')).toBeVisible();
}
test('private import renders the PDF, never uploads bytes, resumes answers and preserves pause timing',async({page,browser})=>{
 const bodies=[];page.on('request',request=>{if(request.postData())bodies.push(request.postData())});await importBook(page,browser);
 await expect(page.locator('#privateGrid button')).toHaveCount(40);await expect(page.locator('#privatePdf')).toHaveAttribute('src',/^blob:/);
 await expect.poll(()=>page.frames().some(frame=>frame.url().startsWith('chrome-extension://'))).toBe(true);const viewer=page.frames().find(frame=>frame.url().startsWith('chrome-extension://'));await expect.poll(()=>viewer.locator('pdf-viewer').evaluate(el=>el.loadState_)).toBe('success');
 await page.clock.install();await page.locator('#privateStart').click();await page.locator('#privatePage').fill('24');await page.locator('#privateJumpPage').click();await page.locator('#privateChoices button').filter({hasText:/^A$/}).click();await page.clock.fastForward(9000);await page.locator('#privatePause').click();await page.clock.fastForward(60000);await expect(page.locator('#privateClock')).toHaveText('00:00:09');
 await page.reload();await page.locator('#openPrivateExams').click();await page.locator('#privateBookList button').first().click();await expect(page.locator('#privatePause')).toHaveText('Devam et');await expect(page.locator('#privatePage')).toHaveValue('24');await expect(page.locator('#privateChoices button').first()).toHaveAttribute('aria-pressed','true');await page.locator('#privatePause').click();await page.clock.fastForward(3000);await expect(page.locator('#privateClock')).toHaveText('00:00:12');
 expect(bodies.join('\n')).not.toContain('private-marker-secret-file');expect(bodies.join('\n')).not.toContain('PRIVATE TEST DOCUMENT');expect(bodies.join('\n')).not.toContain('%PDF');
});
test('reviewed Turkish source key grades only after explicit booklet identity confirmation',async({page,browser})=>{
 await importBook(page,browser);await page.locator('#privateStart').click();await page.locator('#privateChoices button').filter({hasText:new RegExp('^'+first.answerKey[0]+'$')}).click();
 await page.locator('#privateStudy summary').filter({hasText:'Cevap anahtarı'}).click();await page.locator('#privateConfirmIdentity').check();await page.locator('#privateBindKey').click();await expect(page.locator('#privateStatus')).toContainText('kullanıcı teyidine');
 page.once('dialog',dialog=>dialog.accept());await page.locator('#privateFinish').click();await expect(page.locator('#privateResult h3')).toHaveText('1.00 çalışma neti');await expect(page.locator('#privateResult')).toContainText('dosya bağımsız doğrulanmadı');
 await page.reload();await page.locator('#openPrivateExams').click();await expect(page.locator('#privateBookList')).toContainText('1.00 çalışma neti');
});
test('unverified private keys never score automatically and noncontiguous original numbers remain intact',async({page,browser})=>{
 await enter(page);await page.locator('#privateType').selectOption('DGS');await page.locator('#privateTitle').fill('Kısmi gerçek kitapçığın test temsili');await page.locator('#privateSourceUrl').fill('https://www.osym.gov.tr/test-only-partial');await page.locator('#privateCount').fill('5');await page.locator('#privateQuestionNumbers').fill('1,5,11,15,43');await page.locator('#privateImportKey').fill('ABCDE');await page.locator('#privateFile').setInputFiles({name:'subset.pdf',mimeType:'application/pdf',buffer:await pdf(browser)});await page.locator('#importPrivatePdf').click();await expect(page.locator('#privateBookTitle')).toBeVisible();
 await page.locator('#privateStart').click();await expect(page.locator('#privateGrid button')).toHaveCount(5);await expect(page.locator('#privateGrid button').last()).toHaveText('43');await page.locator('#privateChoices button').first().click();page.once('dialog',d=>d.accept());await page.locator('#privateFinish').click();await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');await page.locator('#privateManualScore').click();await expect(page.locator('#privateResult h3')).toHaveText('1.00 çalışma neti');await expect(page.locator('#privateResult')).toContainText('manuel');
});
test('cancelled 2026 AYT cannot be scored using its obsolete printed letter or a user key',async({page,browser})=>{
 const cancelled=TURKISH_EXAMS.find(row=>row.year===2026&&row.examType==='AYT');await importBook(page,browser,{known:cancelled.id,key:'A'.repeat(40)});await page.locator('#privateStart').click();page.once('dialog',d=>d.accept());await page.locator('#privateFinish').click();await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');await expect(page.locator('#privateResult')).toContainText('İptal');await expect(page.locator('#privateManualScore')).toHaveCount(0);
});
test('switching from guest to a signed-in account hides guest PDFs and keys',async({page,browser})=>{
 await importBook(page,browser,{key:'A'.repeat(40)});await page.route('https://*.supabase.co/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:'fake-alice',refresh_token:'fake-refresh',expires_in:3600,user:{id:'alice'}}});return route.fulfill({json:[]})});
 await page.locator('#userEmail').fill('alice@example.test');await page.locator('#userPassword').fill('fake-password');await page.locator('#signIn').click();await expect(page.locator('#privateBookList')).toContainText('kitapçık bulunmuyor');await expect(page.locator('#privateStudy')).toBeEmpty();
 await page.locator('#logoutBtn').click();await expect(page.locator('#privateBookList button')).toHaveCount(1);await page.locator('#privateBookList button').click();await expect(page.locator('#privateManualKey')).toHaveValue('A'.repeat(40));
});
test('private key JSON cannot promote user data into an official key or upload it',async({page,browser})=>{
 await importBook(page,browser,{known:'',count:5,type:'DGS'});await page.locator('#privateStart').click();await page.locator('#privateStudy summary').filter({hasText:'Cevap anahtarı'}).click();
 await page.locator('#privateKeyFile').setInputFiles({name:'key.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({key:'ABCDE',verified:true,provenance:'official-source'}))});await expect(page.locator('#privateManualKey')).toHaveValue('ABCDE');await expect(page.locator('#privateStatus')).toContainText('resmî sayılmaz');
 page.once('dialog',d=>d.accept());await page.locator('#privateFinish').click();await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');
});
test('private PDF bytes and user metadata never execute HTML in the parent page',async({page})=>{
 await enter(page);await page.evaluate(()=>sessionStorage.setItem('private_pdf_probe','synthetic-only'));
 await page.locator('#privateTitle').fill('<img src=x onerror="window.PRIVATE_EXECUTED=true">');await page.locator('#privateSourceUrl').fill('https://www.osym.gov.tr/test-only');await page.locator('#privateCount').fill('1');
 await page.locator('#privateFile').setInputFiles({name:'untrusted.pdf',mimeType:'text/html',buffer:Buffer.from('%PDF-1.4\n<script>parent.PRIVATE_EXECUTED=parent.sessionStorage.getItem("private_pdf_probe")</script>')});await page.locator('#importPrivatePdf').click();await expect(page.locator('#privateBookTitle')).toBeVisible();
 await expect(page.locator('#privatePdf')).toHaveAttribute('src',/^blob:/);expect(await page.locator('#privatePdf').evaluate(async frame=>(await fetch(frame.src.split('#')[0])).headers.get('content-type'))).toBe('application/pdf');expect(await page.evaluate(()=>window.PRIVATE_EXECUTED)).toBeUndefined();await expect(page.locator('#privateBookTitle img')).toHaveCount(0);
});
test('private wrong-answer review follows saved source numbers and user topic labels',async({page,browser})=>{
 await importBook(page,browser);await page.locator('#privateStart').click();const wrong=first.answerKey[0]==='A'?'B':'A';await page.locator('#privateChoices button').filter({hasText:new RegExp('^'+wrong+'$')}).click();await page.locator('#privateTopic').selectOption('Denklemler');
 await page.locator('#privateStudy summary').filter({hasText:'Cevap anahtarı'}).click();await page.locator('#privateConfirmIdentity').check();await page.locator('#privateBindKey').click();page.once('dialog',d=>d.accept());await page.locator('#privateFinish').click();
 await page.locator('#privateResult summary').click();await expect(page.locator('#privateResult')).toContainText('Denklemler: 0 D / 1 Y / 0 B');await expect(page.locator('#privateResult')).toContainText('1. soru: '+wrong+' → '+first.answerKey[0]);await page.locator('#privateResult button').filter({hasText:'1. soru:'}).first().click();await expect(page.locator('#privateCurrent')).toContainText('1. soru');
});
test('standard and private exams pause each other on every resume',async({page,browser})=>{
 await importBook(page,browser);await page.clock.install();await page.locator('#privateStart').click();await page.clock.fastForward(4000);
 await openLegacy(page);await page.locator('#startTYT').click();await expect(page.locator('#privatePause')).toHaveText('Devam et');await page.clock.fastForward(5000);await expect(page.locator('#privateClock')).toHaveText('00:00:04');
 await page.locator('#privatePause').click();await expect(page.locator('#pauseExam')).toHaveText('Devam et');await page.clock.fastForward(3000);await expect(page.locator('#examClock')).toHaveText('00:00:05');
 await page.locator('#pauseExam').click();await expect(page.locator('#privatePause')).toHaveText('Devam et');await page.clock.fastForward(2000);await expect(page.locator('#privateClock')).toHaveText('00:00:07');await expect(page.locator('#examClock')).toHaveText('00:00:07');
});
test('switching private PDFs pauses the previous work and invalid start pages cannot lose autosaves',async({page,browser})=>{
 await importBook(page,browser);await page.clock.install();await page.locator('#privatePage').fill('');await page.locator('#privateStart').click();await expect(page.locator('#privateStatus')).toContainText('geçerli bir PDF sayfası');await expect(page.locator('#privateStart')).toBeVisible();
 await page.locator('#privatePage').fill('23');await page.locator('#privateStart').click();await page.clock.fastForward(4000);
 await page.locator('#privateImportPanel > summary').click();await page.locator('#privateKnownExam').selectOption('osym-2024-tyt-math');await page.locator('#privateFile').setInputFiles({name:'second-private.pdf',mimeType:'application/pdf',buffer:Buffer.concat([await pdf(browser),Buffer.from('\n% second private test document')])});await page.locator('#importPrivatePdf').click();await expect(page.locator('#privateBookTitle')).toContainText('2024');await page.locator('#privateStart').click();await page.clock.fastForward(12000);
 await page.locator('#privateBookList button').filter({hasText:'2023'}).click();await expect(page.locator('#privatePause')).toHaveText('Devam et');await expect(page.locator('#privateClock')).toHaveText('00:00:04');
});
