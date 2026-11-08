import {test,expect} from './fixtures.mjs';
import {TURKISH_EXAMS} from '../../data/turkish-exams.js';
const source=TURKISH_EXAMS.find(row=>row.id==='osym-2023-tyt-math');

// Blank storage/renderer fixture only. No generated question enters the bank.
async function openSource(page){
 if(!await page.locator('#examModePage').isVisible())await page.locator('#examModeButton').click();
 await page.locator('#examFamily').selectOption(source.examType);await page.locator('#examYear').selectOption(String(source.year));await page.locator('#examBooklet').selectOption(source.id);await page.locator('#openExamBooklet').click();await expect(page.locator('#privateFile')).toBeVisible();
}
async function ready(page){await expect.poll(async()=>{for(const frame of page.frames().filter(frame=>frame.url().startsWith('chrome-extension://'))){try{return await frame.locator('pdf-viewer').evaluate(viewer=>viewer.loadState_)}catch{}}return null}).toBe('success')}
async function importBook(page,browser){
 const generator=await browser.newPage();let buffer;
 try{await generator.setContent(Array.from({length:32},(_,i)=>`<section style="page-break-after:always">Blank attempt automation fixture. Page ${i+1}.</section>`).join(''));buffer=await generator.pdf()}finally{await generator.close()}
 await page.goto('/');await openSource(page);await page.locator('#privateFile').setInputFiles({name:'attempt-fixture.pdf',mimeType:'application/pdf',buffer});await page.locator('#importPrivatePdf').click();await expect(page.locator('#privateStart')).toBeVisible();await ready(page);
 await page.clock.install({time:new Date('2026-11-08T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-08T12:00:01Z'));await page.locator('#privateStart').click();await expect(page.locator('#privatePause')).toHaveText('Duraklat');
}
async function book(page){return page.evaluate(async()=>{const {openPrivateLibrary}=await import('/shared/private-library.js');const api=openPrivateLibrary('guest');try{return (await api.list())[0]}finally{await api.close()}})}
async function confirmAction(page,id,message){
 await ready(page);const confirmation=page.waitForEvent('dialog').then(async dialog=>{expect(dialog.type()).toBe('confirm');expect(dialog.message()).toBe(message);await dialog.accept()});await Promise.all([confirmation,page.locator(id).click()]);
}
async function finish(page){await confirmAction(page,'#privateFinish','Özel çalışmayı bitirip süreyi durdurmak istiyor musun?');await expect(page.locator('#privateRestart')).toBeEnabled()}
async function restart(page){await confirmAction(page,'#privateRestart','Tamamlanan çalışmayı geçmişte saklayıp aynı kitapçığı yeniden çözmek istiyor musun?')}
async function keySettings(page){const details=page.locator('#privateStudy details').filter({has:page.locator('#privateManualKey')});if(!await page.locator('#privateManualKey').isVisible())await details.locator('summary').first().click()}
async function history(page){if(!await page.locator('#privateAttempts').evaluate(details=>details.open))await page.locator('#privateAttempts > summary').click()}
async function firstCompleted(page,browser){
 await importBook(page,browser);await page.locator('#privateChoices button').filter({hasText:new RegExp('^'+source.answerKey[0]+'$')}).click();await keySettings(page);await page.locator('#privateConfirmIdentity').check();await page.locator('#privateBindKey').click();await expect(page.locator('#privateStatus')).toContainText('Kaynak anahtarı doğrulandı');await page.clock.fastForward(9000);await finish(page);await expect(page.locator('#privateResult h3')).toHaveText('1.00 çalışma neti');return (await book(page)).progress;
}

test('restarting keeps the first result and read-only history does not alter the fresh attempt',async({page,browser})=>{
 const original=await firstCompleted(page,browser);await page.locator('#privateRestartLimit').selectOption('3600');await restart(page);await expect(page.locator('#privatePause')).toHaveText('Duraklat');await expect(page.locator('#privateClock')).toHaveText('00:00:00');await expect(page.locator('#privateChoices button[aria-pressed=true]')).toHaveCount(0);
 const fresh=await book(page);expect(fresh.attempts).toHaveLength(1);expect(fresh.attempts[0].progress).toEqual(original);expect(fresh.progress.limitSeconds).toBe(3600);expect(fresh.progress.binding).toBeNull();expect(fresh.progress.answers.every(answer=>answer===null)).toBe(true);
 await page.locator('#privateChoices button').filter({hasText:/^B$/}).click();await page.clock.fastForward(3000);await history(page);await expect(page.locator('#privateAttemptList button')).toHaveCount(1);await page.locator('#privateAttemptList button').click();await expect(page.locator('#privateAttemptView')).toBeVisible();await expect(page.locator('#privateAttemptView')).toContainText('1.00 çalışma neti');await expect(page.locator('#privateAttemptAnswers')).toContainText('1: '+source.answerKey[0]);await expect(page.locator('#privateAttemptView input,#privateAttemptView select,#privateAttemptView textarea')).toHaveCount(0);
 await expect(page.locator('#privateChoices button').filter({hasText:/^B$/})).toHaveAttribute('aria-pressed','true');await expect(page.locator('#privateClock')).toHaveText('00:00:03');await page.locator('#privateAttemptBack').click();await expect(page.locator('#privateAttemptView')).toBeHidden();
 await page.reload();await openSource(page);await page.locator('#privateBookList button').filter({hasText:source.title}).click();await expect(page.locator('#privateChoices button').filter({hasText:/^B$/})).toHaveAttribute('aria-pressed','true');await history(page);await expect(page.locator('#privateAttemptList button')).toHaveCount(1);const saved=await book(page);expect(saved.attempts[0].progress).toEqual(original);expect(saved.progress.answers[0]).toBe('B');
});

test('a failed atomic restart keeps the old result and a retry archives it exactly once',async({page,browser})=>{
 const original=await firstCompleted(page,browser);await page.locator('#privateRestartLimit').selectOption('3600');
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let reject=true;IDBObjectStore.prototype.put=function(value,...args){if(reject&&this.transaction.db.name==='MatematikAkademimPrivateLibraryV1'&&value.attempts?.length&&!value.progress?.finishedAt){reject=false;throw new DOMException('Injected restart storage failure','QuotaExceededError')}return put.call(this,value,...args)}});
 await restart(page);await expect(page.locator('#privateStatus')).toContainText('Yeni çalışma başlatılamadı');await expect(page.locator('#privateResult h3')).toHaveText('1.00 çalışma neti');await expect(page.locator('#privateRestartLimit')).toHaveValue('3600');const failed=await book(page);expect(failed.attempts).toEqual([]);expect(failed.progress).toEqual(original);
 await restart(page);await expect(page.locator('#privatePause')).toHaveText('Duraklat');const retried=await book(page);expect(retried.attempts).toHaveLength(1);expect(retried.attempts[0].progress).toEqual(original);expect(retried.progress.finishedAt).toBeNull();expect(retried.progress.answers.every(answer=>answer===null)).toBe(true);
});

test('leaving during restart cannot overwrite its new attempt with the old finished snapshot',async({page,browser})=>{
 const original=await firstCompleted(page,browser);
 await page.evaluate(()=>{const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');window.restartGate={hold:true,committed:0};Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...descriptor,set(callback){descriptor.set.call(this,event=>{if(this.db.name==='MatematikAkademimPrivateLibraryV1'&&this.mode==='readwrite'&&window.restartGate.hold){window.restartGate.committed++;window.restartGate.release=()=>{window.restartGate.hold=false;callback.call(this,event)}}else callback.call(this,event)})}})});
 await restart(page);await expect(page.locator('#privateRestart')).toBeDisabled();await expect.poll(()=>page.evaluate(()=>window.restartGate.committed)).toBe(1);await page.locator('#closeExamMode').click();await expect(page.locator('#examModePage')).toBeHidden();await page.evaluate(()=>window.restartGate.release());
 await openSource(page);await page.locator('#privateBookList button').filter({hasText:source.title}).click();await expect(page.locator('#privatePause')).toHaveText('Devam et');await expect(page.locator('#privateChoices button[aria-pressed=true]')).toHaveCount(0);const saved=await book(page);expect(saved.attempts).toHaveLength(1);expect(saved.attempts[0].progress).toEqual(original);expect(saved.progress.finishedAt).toBeNull();expect(saved.progress.pausedAt).not.toBeNull();
});

test('each archived manual result uses its own saved key across repeated attempts',async({page,browser})=>{
 await importBook(page,browser);await keySettings(page);await page.locator('#privateManualKey').fill('A'.repeat(40));await page.locator('#privateSaveKey').click();await expect(page.locator('#privateStatus')).toContainText('Kendi anahtarın');await page.locator('#privateChoices button').filter({hasText:/^A$/}).click();await finish(page);await page.locator('#privateManualScore').click();await expect(page.locator('#privateResult h3')).toHaveText('1.00 çalışma neti');
 await restart(page);await expect(page.locator('#privatePause')).toHaveText('Duraklat');await keySettings(page);await page.locator('#privateManualKey').fill('B'.repeat(40));await page.locator('#privateSaveKey').click();await expect(page.locator('#privateStatus')).toContainText('Kendi anahtarın');await page.locator('#privateChoices button').filter({hasText:/^A$/}).click();await finish(page);await page.locator('#privateManualScore').click();await expect(page.locator('#privateResult h3')).toHaveText('-0.25 çalışma neti');
 await restart(page);await expect(page.locator('#privatePause')).toHaveText('Duraklat');await history(page);await expect(page.locator('#privateAttemptList button')).toHaveCount(2);await page.locator('#privateAttemptList button').first().click();await expect(page.locator('#privateAttemptView')).toContainText('1.00 çalışma neti');await expect(page.locator('#privateAttemptView')).toContainText('manuel net');await page.locator('#privateAttemptList button').nth(1).click();await expect(page.locator('#privateAttemptView')).toContainText('-0.25 çalışma neti');const saved=await book(page);expect(saved.attempts.map(attempt=>attempt.answerKey.value[0])).toEqual(['A','B']);expect(saved.progress.answers.every(answer=>answer===null)).toBe(true);
});


test('a failed restart unlocks its original view even when another book-open request is waiting',async({page,browser})=>{
 const original=await firstCompleted(page,browser);
 await page.evaluate(()=>{
  window.failedRestartGate={hold:true,pending:false};
  const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'onabort');Object.defineProperty(IDBTransaction.prototype,'onabort',{...descriptor,set(callback){descriptor.set.call(this,event=>{if(this.db.name==='MatematikAkademimPrivateLibraryV1'&&this.mode==='readwrite'&&window.failedRestartGate.hold){window.failedRestartGate.pending=true;window.failedRestartGate.release=()=>{window.failedRestartGate.hold=false;callback.call(this,event)}}else callback.call(this,event)})}});
  const put=IDBObjectStore.prototype.put;let reject=true;IDBObjectStore.prototype.put=function(value,...args){if(reject&&this.transaction.db.name==='MatematikAkademimPrivateLibraryV1'&&value.attempts?.length&&!value.progress?.finishedAt){reject=false;throw new DOMException('Injected pending restart failure','QuotaExceededError')}return put.call(this,value,...args)};
 });
 await restart(page);await expect.poll(()=>page.evaluate(()=>window.failedRestartGate.pending)).toBe(true);await page.locator('#privateBookList button').filter({hasText:source.title}).click();await page.evaluate(()=>window.failedRestartGate.release());
 await expect(page.locator('#privateRestart')).toBeEnabled();await expect(page.locator('#privateResult h3')).toHaveText('1.00 çalışma neti');const failed=await book(page);expect(failed.attempts).toEqual([]);expect(failed.progress).toEqual(original);
 await restart(page);await expect(page.locator('#privatePause')).toHaveText('Duraklat');const saved=await book(page);expect(saved.attempts).toHaveLength(1);expect(saved.attempts[0].progress).toEqual(original);
});
