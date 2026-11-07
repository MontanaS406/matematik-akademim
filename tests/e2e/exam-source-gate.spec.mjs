import {test,expect} from './fixtures.mjs';
async function openLegacy(page){const panel=page.locator('#legacyExamWorkspace');await expect(panel).toBeAttached();if(await panel.getAttribute('open')===null)await page.locator('#legacyExamWorkspace > summary').click()}
const KEY='matematik_akademim_exam_history_v11';
async function home(page){await page.goto('/');await page.getByRole('button',{name:'📝 Denemeler'}).click();await openLegacy(page)}
async function start(page){await home(page);await page.locator('#startTYT').click()}

test('unverified TYT/AYT years are labelled local answer workspaces, never complete exams',async({page})=>{
 await home(page);await expect(page.locator('#realYear option')).toHaveCount(9);
 for(const year of ['2018','2023','2026']){
  await page.locator('#realYear').selectOption(year);
  await expect(page.locator('#examSourceGate')).toContainText('doğrulanmış TYT/AYT sınavı yok');
  await expect(page.locator('#startTYT')).toHaveText('TYT · 40 cevap alanı');
  await expect(page.locator('#startAYT')).toHaveText('AYT · 40 cevap alanı');
 }
 await page.locator('#startTYT').click();
 await expect(page.locator('#examInside')).toContainText('Yerel çalışma alanı');
 await expect(page.locator('#canonicalQuestion')).toBeEmpty();
 await expect(page.locator('#realPdf')).not.toHaveAttribute('src',/https?:/);
 await expect(page.locator('#examGrid button')).toHaveCount(40);
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k+'_guest_unfinished_exam')).source,KEY)).toBeNull();
});

test('even valid local PDF cannot bypass source and permission verification',async({page,browser})=>{
 const generator=await browser.newPage();await generator.setContent('<p>Local test file</p>');const pdf=await generator.pdf();await generator.close();
 await start(page);await expect(page.locator('#selectPdf')).toBeDisabled();await expect(page.locator('#pdfFile')).toBeDisabled();
 // Programmatic input bypass still reaches the handler: its own source gate must refuse it.
 await page.locator('#pdfFile').evaluate((input,bytes)=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(bytes)],'unknown.pdf',{type:'application/pdf'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))},[...pdf]);
 await expect(page.locator('#pdfStatus')).toContainText('doğrulanmadığı için bu dosya gösterilemez');
 await expect(page.locator('#realPdf')).not.toHaveAttribute('src',/^blob:/);
 await expect(page.locator('#canonicalQuestion')).toBeEmpty();
 page.once('dialog',dialog=>dialog.accept());await page.locator('#finishExam').click();
 await expect(page.locator('#manualKey')).toBeVisible();
 await expect(page.locator('#examBody')).toContainText('resmî olarak doğrulanmış sayılmaz');
 await page.locator('#saveUnscored').click();await openLegacy(page);
 await expect(page.locator('#history')).toContainText('Puanlanmadı');
 const result=await page.evaluate(k=>JSON.parse(localStorage.getItem(k+'_guest'))[0],KEY);
 expect(result.net).toBeNull();expect(result.verified).toBe(false);expect(result.source).toBeNull();
});

test('past personal results survive the source-only transition without rewriting stored history',async({page})=>{
 const record={id:'past-result',type:'AYT',year:2024,date:'2025-05-20T12:00:00Z',duration:1800,correct:22,wrong:8,blank:10,net:20,source:'https://old.example/retired.pdf',markedAnswers:Array(40).fill(null),details:[{legacy:'personal record'}]};
 await page.goto('/');const original=JSON.stringify([record]);await page.evaluate(({key,value})=>localStorage.setItem(key+'_guest',value),{key:KEY,value:original});await page.reload();
 await page.getByRole('button',{name:'📝 Denemeler'}).click();await openLegacy(page);
 await expect(page.locator('#recordCount')).toHaveText('1 kayıt');await expect(page.locator('#history')).toContainText('20.00 net');
 expect(await page.evaluate(k=>localStorage.getItem(k+'_guest'),KEY)).toBe(original);
});

test('restored draft ignores retired source URLs and still requires manual evaluation',async({page})=>{
 await page.goto('/');await page.evaluate(k=>localStorage.setItem(k+'_guest_unfinished_exam',JSON.stringify({type:'TYT',year:2023,started:Date.now(),index:0,limit:0,answers:Array(40).fill(null),source:'https://retired.example/book.pdf'})),KEY);
 await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#continueExam').click();
 await expect(page.locator('#realPdf')).not.toHaveAttribute('src',/retired\.example/);
 await expect(page.locator('#examInside')).toContainText('Yerel çalışma alanı');
 page.once('dialog',dialog=>dialog.accept());await page.locator('#finishExam').click();await expect(page.locator('#manualKey')).toBeVisible();
});

test('previous cached PDFs remain stored but cannot be rendered without verified rights',async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('MatematikAkademimPdf',1);req.onupgradeneeded=()=>req.result.createObjectStore('pdfs');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  await new Promise((resolve,reject)=>{const tx=db.transaction('pdfs','readwrite');tx.objectStore('pdfs').put(new Blob(['%PDF-1.4\n%%EOF'],{type:'application/pdf'}),'2026_TYT');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
 });
 await page.getByRole('button',{name:'📝 Denemeler'}).click();await openLegacy(page);await page.locator('#startTYT').click();
 await expect(page.locator('#pdfStatus')).toContainText('PDF yükleme kapalı');await expect(page.locator('#realPdf')).not.toHaveAttribute('src',/^blob:/);
 expect(await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('MatematikAkademimPdf',1);r.onsuccess=()=>resolve(r.result)});const count=await new Promise(resolve=>{const r=db.transaction('pdfs','readonly').objectStore('pdfs').count('2026_TYT');r.onsuccess=()=>resolve(r.result)});db.close();return count})).toBe(1);
});
