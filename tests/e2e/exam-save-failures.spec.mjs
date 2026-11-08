import {test,expect} from './fixtures.mjs';
import {TURKISH_EXAMS} from '../../data/turkish-exams.js';

const source=TURKISH_EXAMS.find(row=>row.id==='osym-2023-tyt-math');
// Blank renderer/storage fixture only. No generated question enters the bank.
async function importPrivateBooklet(page,browser,row=source){
 const generator=await browser.newPage();let buffer;
 try{await generator.setContent(Array.from({length:32},(_,i)=>`<section style="page-break-after:always"><p>Blank save-failure automation fixture. Page ${i+1}.</p></section>`).join(''));buffer=await generator.pdf()}finally{await generator.close()}
 await page.goto('/');await openSavedSource(page,row);
 await page.locator('#privateFile').setInputFiles({name:'save-failure-fixture.pdf',mimeType:'application/pdf',buffer});await page.locator('#importPrivatePdf').click();await expect(page.locator('#privateStart')).toBeVisible();await expectNativeDocument(page);
 await page.clock.install({time:new Date('2026-11-08T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-08T12:00:01Z'));
}
async function openSavedSource(page,row=source){
 if(!await page.locator('#examModePage').isVisible())await page.locator('#examModeButton').click();
 await page.locator('#examFamily').selectOption(row.examType);await page.locator('#examYear').selectOption(String(row.year));await page.locator('#examBooklet').selectOption(row.id);await page.locator('#openExamBooklet').click();await expect(page.locator('#privateFile')).toBeVisible();
}
async function storedProgress(page){
 return page.evaluate(async()=>{const {openPrivateLibrary}=await import('/shared/private-library.js');const library=openPrivateLibrary('guest');try{return (await library.list())[0].progress}finally{await library.close()}});
}
async function rejectNextProgressWrite(page,kind){
 await page.evaluate(kind=>{const put=IDBObjectStore.prototype.put;let rejectNext=true;IDBObjectStore.prototype.put=function(value,...args){
  const progress=value.progress,matching=kind==='start'?!!progress:kind==='finish'?!!progress?.finishedAt:!!progress?.binding;
  if(rejectNext&&this.transaction.db.name==='MatematikAkademimPrivateLibraryV1'&&matching){rejectNext=false;throw new DOMException('Injected test storage failure','QuotaExceededError')}
  return put.call(this,value,...args);
 }},kind);
}
async function start(page){await page.locator('#privateStart').click();await expect(page.locator('#privatePause')).toHaveText('Duraklat')}
async function expectNativeDocument(page){await expect.poll(async()=>{for(const frame of page.frames().filter(frame=>frame.url().startsWith('chrome-extension://'))){try{return await frame.locator('pdf-viewer').evaluate(viewer=>viewer.loadState_)}catch{}}return null}).toBe('success')}
async function finish(page){
 await expectNativeDocument(page);
 const confirmation=page.waitForEvent('dialog').then(async dialog=>{expect(dialog.type()).toBe('confirm');expect(dialog.message()).toBe('Özel çalışmayı bitirip süreyi durdurmak istiyor musun?');await dialog.accept()});
 await Promise.all([confirmation,page.locator('#privateFinish').click()]);
}
async function openKeySettings(page){const details=page.locator('#privateStudy details').filter({has:page.locator('#privateManualKey')});if(!await page.locator('#privateManualKey').isVisible())await details.locator('summary').first().click()}

test('a rejected initial save does not create a running exam and can be retried',async({page,browser})=>{
 await importPrivateBooklet(page,browser);await page.locator('#privateTimeLimit').selectOption('3600');await rejectNextProgressWrite(page,'start');await page.locator('#privateStart').click();
 await expect(page.locator('#privateStatus')).toContainText('Başlangıç kaydedilemedi');await expect(page.locator('#privateStart')).toBeEnabled();await expect(page.locator('#privateTimeLimit')).toHaveValue('3600');await expect(page.locator('#privatePause')).toHaveCount(0);expect(await storedProgress(page)).toBeNull();
 await start(page);const saved=await storedProgress(page);expect(saved.startedAt).toBeGreaterThan(0);expect(saved.limitSeconds).toBe(3600);expect(saved.finishedAt).toBeNull();expect(saved.answers.every(answer=>answer===null)).toBe(true);
});

test('a rejected finish keeps durable marks and the unfinished attempt through reload',async({page,browser})=>{
 await importPrivateBooklet(page,browser);await start(page);await page.locator('#privateChoices button').first().click();await expect.poll(async()=>(await storedProgress(page)).answers[0]).toBe('A');await page.clock.fastForward(9000);
 const before=await storedProgress(page);await rejectNextProgressWrite(page,'finish');await finish(page);
 await expect(page.locator('#privateStatus')).toContainText('Bitiş kaydedilemedi');await expect(page.locator('#privatePause')).toHaveText('Duraklat');await expect(page.locator('#privateResult h3')).toHaveCount(0);await expect(page.locator('#privateChoices button').first()).toHaveAttribute('aria-pressed','true');expect(await storedProgress(page)).toEqual(before);
 await page.reload();await openSavedSource(page);await page.locator('#privateBookList button').filter({hasText:source.title}).first().click();await expect(page.locator('#privatePause')).toHaveText('Duraklat');await expect(page.locator('#privateResult h3')).toHaveCount(0);await expect(page.locator('#privateChoices button').first()).toHaveAttribute('aria-pressed','true');
 await finish(page);await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');const after=await storedProgress(page);expect(after.finishedAt).not.toBeNull();expect(after.answers).toEqual(before.answers);expect(after.finishedDuration).toBe(9);
});

test('a rejected source binding stays unscored and only a durable retry applies the key',async({page,browser})=>{
 await importPrivateBooklet(page,browser);await start(page);await page.locator('#privateChoices button').filter({hasText:new RegExp('^'+source.answerKey[0]+'$')}).click();await finish(page);await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');
 await openKeySettings(page);await page.locator('#privateConfirmIdentity').check();const before=await storedProgress(page);await rejectNextProgressWrite(page,'binding');await page.locator('#privateBindKey').click();
 await expect(page.locator('#privateStatus')).toContainText('Anahtar eşleştirmesi kaydedilemedi');await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');expect(await storedProgress(page)).toEqual(before);
 await expect(page.locator('#privateConfirmIdentity')).not.toBeChecked();await page.locator('#privateConfirmIdentity').check();await page.locator('#privateBindKey').click();await expect(page.locator('#privateResult h3')).toHaveText('1.00 çalışma neti');const after=await storedProgress(page);expect(after.binding.examId).toBe(source.id);expect(after.score.net).toBe(1);expect(after.answers).toEqual(before.answers);
});


test('a fresh file with the wrong publisher hash cannot bind or automatically score the 2024 source key',async({page,browser})=>{
 const row=TURKISH_EXAMS.find(item=>item.id==='osym-2024-tyt-math');expect(row.pdfSha256).toMatch(/^[a-f0-9]{64}$/);
 await importPrivateBooklet(page,browser,row);await openKeySettings(page);await expect(page.locator('#privateOfficialKey')).toContainText('eşleşmiyor');await expect(page.locator('#privateConfirmIdentity')).toHaveCount(0);await expect(page.locator('#privateBindKey')).toHaveCount(0);
 await start(page);await page.locator('#privateChoices button').filter({hasText:new RegExp('^'+row.answerKey[0]+'$')}).click();await finish(page);await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');const saved=await storedProgress(page);expect(saved.finishedAt).not.toBeNull();expect(saved.score).toBeNull();expect(saved.binding).toBeNull();expect(saved.answers[0]).toBe(row.answerKey[0]);
});
