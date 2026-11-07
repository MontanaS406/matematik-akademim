import {test,expect} from './fixtures.mjs';
async function start(page){await page.goto('/');await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#startTYT').click()}
test('unapproved HTML and signature-prefixed payloads never become iframe content',async({page})=>{
 await start(page);await page.evaluate(()=>sessionStorage.setItem('pdf_probe','synthetic-only'));
 for(const content of ['<script>parent.__PDF_EXECUTED=true</script>','%PDF-1.4\n<script>parent.__PDF_EXECUTED=true</script>']){
  await page.locator('#pdfFile').setInputFiles({name:'fake.pdf',mimeType:'text/html',buffer:Buffer.from(content)});
  await expect(page.locator('#realPdf')).not.toHaveAttribute('src',/^blob:/);expect(await page.evaluate(()=>window.__PDF_EXECUTED)).toBeUndefined();
 }
 await expect(page.locator('#selectPdf')).toBeDisabled();
});
test('even a genuine local PDF requires verified source rights and matching publisher hash',async({page,browser})=>{
 const generator=await browser.newPage();await generator.setContent('<h1>Test document, not a reviewed source</h1>');const file=await generator.pdf();await generator.close();await start(page);
 await page.locator('#pdfFile').setInputFiles({name:'local.pdf',mimeType:'application/pdf',buffer:file});await expect(page.locator('#realPdf')).not.toHaveAttribute('src',/^blob:/);await expect(page.locator('#goMath')).toBeDisabled();await expect(page.locator('#pdfStatus')).toContainText('doğrulanmadığı');
});
test('unverified cached PDF is retained but never displayed',async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('MatematikAkademimPdf',1);req.onupgradeneeded=()=>req.result.createObjectStore('pdfs');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  await new Promise((resolve,reject)=>{const tx=db.transaction('pdfs','readwrite');tx.objectStore('pdfs').put(new Blob(['%PDF-1.4\nprivate historical content'],{type:'application/pdf'}),'2026_TYT');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
 });await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#startTYT').click();await expect(page.locator('#realPdf')).not.toHaveAttribute('src',/^blob:/);
 expect(await page.evaluate(async()=>{const db=await new Promise(resolve=>{const req=indexedDB.open('MatematikAkademimPdf',1);req.onsuccess=()=>resolve(req.result)});return new Promise(resolve=>{const req=db.transaction('pdfs').objectStore('pdfs').get('2026_TYT');req.onsuccess=()=>{resolve(!!req.result);db.close()}})})).toBe(true);
});
