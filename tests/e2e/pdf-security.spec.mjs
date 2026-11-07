import {test, expect} from '@playwright/test';
async function start(page){await page.goto('/');await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#startTYT').click()}
test('HTML disguised as PDF cannot execute or read parent session data',async({page})=>{
  await start(page);await page.evaluate(()=>sessionStorage.setItem('pdf_probe','synthetic-only'));
  await expect(page.locator('#selectPdf')).toHaveAccessibleName('PDF dosyası seç');
  await page.locator('#pdfFile').setInputFiles({name:'evil.pdf',mimeType:'text/html',buffer:Buffer.from('<script>parent.__PDF_EXECUTED = parent.sessionStorage.getItem("pdf_probe") === "synthetic-only"</script>')});
  await expect(page.locator('#pdfStatus')).toContainText('Geçerli bir PDF');
  await expect(page.locator('#realPdf')).not.toHaveAttribute('src',/^blob:/);
  expect(await page.evaluate(()=>window.__PDF_EXECUTED)).toBeUndefined();
  await expect(page.locator('#goMath')).toBeDisabled();
});
test('cached malicious HTML is rejected before iframe source assignment',async({page})=>{
  await page.goto('/');await page.evaluate(async()=>{
    sessionStorage.setItem('pdf_probe','synthetic-only');
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('MatematikAkademimPdf',1);req.onupgradeneeded=()=>req.result.createObjectStore('pdfs');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
    await new Promise((resolve,reject)=>{const tx=db.transaction('pdfs','readwrite');tx.objectStore('pdfs').put(new Blob(['<script>parent.__PDF_EXECUTED = parent.sessionStorage.getItem("pdf_probe") === "synthetic-only"</script>'],{type:'text/html'}),'2026_TYT');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
  });
  await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#startTYT').click();
  await expect(page.locator('#pdfStatus')).toContainText('Kaydedilen dosya güvenli bir PDF');
  await expect(page.locator('#realPdf')).not.toHaveAttribute('src',/^blob:/);expect(await page.evaluate(()=>window.__PDF_EXECUTED)).toBeUndefined();
});
test('signature-valid payload always receives PDF MIME even with HTML content',async({page})=>{
  await start(page);
  const chooser=page.waitForEvent('filechooser');await page.locator('#selectPdf').focus();await page.keyboard.press('Enter');await chooser;
  // MIME from a selected or cached file is untrusted even with a valid signature.
  await page.locator('#pdfFile').setInputFiles({name:'book.pdf',mimeType:'text/html',buffer:Buffer.from('%PDF-1.4\n<script>parent.__PDF_EXECUTED=true</script>\n%%EOF')});
  await expect(page.locator('#pdfStatus')).toContainText('kaydedildi');await expect(page.locator('#realPdf')).toHaveAttribute('src',/^blob:/);
  expect(await page.locator('#realPdf').evaluate(async frame=>(await fetch(frame.src.split('#')[0])).headers.get('content-type'))).toBe('application/pdf');
  expect(await page.evaluate(()=>window.__PDF_EXECUTED)).toBeUndefined();
  await expect(page.locator('#goMath')).toBeEnabled();
});
test('real PDF reaches native viewer rendering instead of only assigning a source',async({page,browser},testInfo)=>{
  const generator=await browser.newPage();await generator.setContent('<h1>PDF VIEW TEST</h1><p>Local test document</p>');const pdf=await generator.pdf();await generator.close();
  await start(page);await page.locator('#pdfFile').setInputFiles({name:'valid.pdf',mimeType:'application/pdf',buffer:pdf});
  await expect.poll(()=>page.frames().some(frame=>frame.url().startsWith('chrome-extension://'))).toBe(true);
  const viewer=page.frames().find(frame=>frame.url().startsWith('chrome-extension://'));
  await expect.poll(()=>viewer.locator('pdf-viewer').evaluate(element=>element.loadState_)).toBe('success');
  await expect(viewer.locator('pdf-viewer embed[type="application/x-google-chrome-pdf"]')).toBeVisible();
  await page.locator('#realPdf').screenshot({path:testInfo.outputPath('rendered-local-pdf.png')});
});
test('cached signature-prefixed HTML also receives forced PDF MIME',async({page})=>{
  await page.goto('/');await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('MatematikAkademimPdf',1);req.onupgradeneeded=()=>req.result.createObjectStore('pdfs');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
    await new Promise((resolve,reject)=>{const tx=db.transaction('pdfs','readwrite');tx.objectStore('pdfs').put(new Blob(['%PDF-1.4\n<script>parent.__PDF_EXECUTED=true</script>'],{type:'text/html'}),'2026_TYT');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
  });
  await page.getByRole('button',{name:'📝 Denemeler'}).click();await page.locator('#startTYT').click();await expect(page.locator('#realPdf')).toHaveAttribute('src',/^blob:/);
  expect(await page.locator('#realPdf').evaluate(async frame=>(await fetch(frame.src.split('#')[0])).headers.get('content-type'))).toBe('application/pdf');expect(await page.evaluate(()=>window.__PDF_EXECUTED)).toBeUndefined();
});
