import {test,expect} from './fixtures.mjs';

// Blank renderer fixture only; no generated question enters the application bank.
async function startPrivateExam(page,browser){
 const generator=await browser.newPage();let buffer;
 try{await generator.setContent('<h1>Blank storage automation fixture</h1>');buffer=await generator.pdf()}finally{await generator.close()}
 await page.goto('/');await page.locator('#examModeButton').click();await page.locator('#examYear').selectOption('2023');await page.locator('#examBooklet').selectOption('osym-2023-tyt-math');await page.locator('#openExamBooklet').click();
 await page.locator('#privateFile').setInputFiles({name:'storage-fixture.pdf',mimeType:'application/pdf',buffer});await page.locator('#importPrivatePdf').click();await expect(page.locator('#privateStart')).toBeVisible();
 await page.clock.install({time:new Date('2026-11-08T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-08T12:00:01Z'));await page.locator('#privateStart').click();await expect(page.locator('#privatePause')).toHaveText('Duraklat');
}
async function storedProgress(page){
 return page.evaluate(async()=>{const {openPrivateLibrary}=await import('/shared/private-library.js');const library=openPrivateLibrary('guest');try{return (await library.list())[0].progress}finally{await library.close()}});
}

test('pause waits for durable completion and blocks opposite transitions and answer edits',async({page,browser})=>{
 await startPrivateExam(page,browser);await page.clock.fastForward(9000);
 // Delay only delivery of the next real transaction's completion event. The
 // browser still commits normally; the UI must await its storage promise.
 await page.evaluate(()=>{const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');window.pauseSaveGate={hold:true,committed:0};Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...descriptor,set(callback){descriptor.set.call(this,event=>{if(this.db.name==='MatematikAkademimPrivateLibraryV1'&&this.mode==='readwrite'&&window.pauseSaveGate.hold){window.pauseSaveGate.committed++;window.pauseSaveGate.release=()=>{window.pauseSaveGate.hold=false;callback.call(this,event)}}else callback.call(this,event)})}})});
 await page.locator('#privatePause').click();await expect(page.locator('#privatePause')).toHaveText('Kaydediliyor…');await expect(page.locator('#privatePause')).toBeDisabled();await expect(page.locator('#privateFinish')).toBeDisabled();await expect(page.locator('#privateChoices button').first()).toBeDisabled();
 // DOM clicks model rapid repeated input without Playwright waiting for enable.
 await page.locator('#privatePause').evaluate(button=>{button.click();button.click()});await page.locator('#privateChoices button').first().evaluate(button=>button.click());
 await expect.poll(()=>page.evaluate(()=>window.pauseSaveGate.committed)).toBe(1);await page.clock.fastForward(60000);await expect(page.locator('#privateClock')).toHaveText('00:00:09');
 const paused=await storedProgress(page);expect(paused.pausedAt).not.toBeNull();expect(paused.answers.every(value=>value===null)).toBe(true);
 await page.evaluate(()=>window.pauseSaveGate.release());await expect(page.locator('#privatePause')).toHaveText('Devam et');await expect(page.locator('#privatePause')).toBeEnabled();
 await page.locator('#privatePause').click();await expect(page.locator('#privatePause')).toHaveText('Duraklat');await page.clock.fastForward(3000);await expect(page.locator('#privateClock')).toHaveText('00:00:12');expect((await storedProgress(page)).pausedMs).toBe(60000);
});

test('failed pause restores the running timer and preserves the last durable answers',async({page,browser})=>{
 await startPrivateExam(page,browser);await page.locator('#privateChoices button').first().click();await expect.poll(async()=>(await storedProgress(page)).answers[0]).toBe('A');await page.clock.fastForward(9000);
 const before=await storedProgress(page);
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let rejectNextPause=true;IDBObjectStore.prototype.put=function(value,...args){if(rejectNextPause&&this.transaction.db.name==='MatematikAkademimPrivateLibraryV1'&&value.progress?.pausedAt!==null){rejectNextPause=false;throw new DOMException('Test storage failure','QuotaExceededError')}return put.call(this,value,...args)}});
 await page.locator('#privatePause').click();await expect(page.locator('#privateStatus')).toContainText('Süre durumu kaydedilemedi; önceki duruma dönüldü.');await expect(page.locator('#privatePause')).toHaveText('Duraklat');await expect(page.locator('#privatePause')).toBeEnabled();await expect(page.locator('#privateChoices button').first()).toBeEnabled();await expect(page.locator('#privateChoices button').first()).toHaveAttribute('aria-pressed','true');
 expect(await storedProgress(page)).toEqual(before);await page.clock.fastForward(3000);await expect(page.locator('#privateClock')).toHaveText('00:00:12');
 await page.locator('#privatePause').click();await expect(page.locator('#privatePause')).toHaveText('Devam et');expect((await storedProgress(page)).pausedAt).not.toBeNull();
});
