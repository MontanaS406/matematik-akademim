// Optional publisher integration test. Protected booklet bytes stay in the CI
// runner's memory and local browser storage; this script creates no artifacts.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium,expect} from '@playwright/test';
import {TURKISH_EXAMS} from '../data/turkish-exams.js';
import {verifiedOfficialKey} from '../shared/private-exam.js';

if (process.env.RUN_OFFICIAL_BOOKLET_SMOKE !== '1') {
  process.stdout.write(JSON.stringify({status:'skipped',reason:'Set RUN_OFFICIAL_BOOKLET_SMOKE=1 in GitHub Actions to enable the publisher integration test.'}) + '\n');
  process.exit(0);
}
if (process.env.GITHUB_ACTIONS !== 'true') {
  process.stderr.write(JSON.stringify({status:'failed',reason:'This opt-in integration test runs only in GitHub Actions; it is not a local publisher-download fallback.'}) + '\n');
  process.exit(1);
}

const baseURL = 'http://127.0.0.1:8188';
const maximumBytes = 50 * 1024 * 1024;
const abort = new AbortController();
const repository = fileURLToPath(new URL('../',import.meta.url));
let server;
let browser;
let deadline;

async function downloadBooklet(row) {
  assert.ok(verifiedOfficialKey(row),'The selected source must have a reviewed, complete and uncancelled key.');
  const url = new URL(row.originalUrl);
  assert.equal(url.protocol,'https:');
  assert.equal(url.hostname,'dokuman.osym.gov.tr');
  assert.equal(url.username,'');
  assert.equal(url.password,'');
  let response;
  try { response = await fetch(url,{redirect:'error',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20000)])}); }
  catch (error) { throw Error('Publisher download failed for ' + row.id + ': ' + error.message); }
  assert.equal(response.status,200,'Publisher download failed for ' + row.id + ': HTTP ' + response.status);
  const announcedBytes = Number(response.headers.get('content-length') || 0);
  assert.ok(announcedBytes <= maximumBytes,'Publisher file exceeds the private library size limit.');
  assert.ok(response.body,'Publisher response had no body.');
  const reader = response.body.getReader();
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        await reader.cancel();
        throw Error('Publisher file exceeds the private library size limit.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  const buffer = Buffer.concat(chunks);
  assert.equal(buffer.subarray(0,5).toString('ascii'),'%PDF-','Publisher returned something other than PDF bytes.');
  assert.ok(buffer.byteLength >= 100000,'Publisher response is too small to be the reviewed complete booklet.');
  const sha256=createHash('sha256').update(buffer).digest('hex');
  assert.equal(sha256,row.pdfSha256,'Publisher file changed; do not trust a different file or silently update its digest.');
  assert.equal(buffer.byteLength,row.pdfHashVerification?.byteLength,'Publisher byte length no longer matches its reviewed hash evidence.');
  return {row,buffer,sha256};
}

async function waitForServer() {
  for (let attempt=0;attempt<40;attempt++) {
    if (server.exitCode !== null) throw Error('Local test server exited before becoming ready.');
    try {
      const response = await fetch(baseURL,{signal:AbortSignal.timeout(500)});
      if (response.ok) return;
    } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('Local test server did not become ready.');
}

async function enterBooklet(page,row,{navigate=true}={}) {
  if (navigate) await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  if (!await page.locator('#examModePage').isVisible()) await page.locator('#examModeButton').click();
  await page.locator('#examFamily').selectOption(row.examType);
  await page.locator('#examYear').selectOption(String(row.year));
  await page.locator('#examBooklet').selectOption(row.id);
  await page.locator('#openExamBooklet').click();
  await expect(page.locator('#privateFile')).toBeVisible();
}

async function expectNativeDocument(page) {
  await expect(page.locator('#privatePdf')).toHaveAttribute('src',/^blob:/);
  await expect.poll(async()=>{
    for (const frame of page.frames().filter(frame=>frame.url().startsWith('chrome-extension://'))) {
      try { return await frame.locator('pdf-viewer').evaluate(viewer=>viewer.loadState_); }
      catch {}
    }
    return null;
  },{timeout:25000,message:'The actual publisher booklet must load in Chromium’s native PDF viewer.'}).toBe('success');
}

async function checkBooklet(download,device) {
  const {row,buffer,sha256} = download;
  const context = await browser.newContext(device==='mobile'?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:900}});
  const page = await context.newPage();
  let externalBodyAttempts = 0;
  page.on('request',request=>{
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== baseURL && request.postData()) externalBodyAttempts++;
  });
  // Browser-internal extension resources remain outside interception so the
  // genuine native viewer can render. App requests may reach only local HTTP.
  await context.route(/^https?:\/\//,route=>new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort('blockedbyclient'));
  page.setDefaultTimeout(8000);
  try {
    await enterBooklet(page,row);
    await page.locator('#privateFile').setInputFiles({name:row.id + '.pdf',mimeType:'application/pdf',buffer});
    await page.locator('#importPrivatePdf').click();
    await expect(page.locator('#privateBookTitle')).toHaveText(row.title);
    await expectNativeDocument(page);
    await expect(page.locator('#privateGrid button')).toHaveCount(40);
    await page.clock.install({time:new Date('2026-11-08T12:00:00Z')});
    await page.clock.pauseAt(new Date('2026-11-08T12:00:01Z'));
    await page.locator('#privateStart').click();
    await expect(page.locator('#privatePause')).toHaveText('Duraklat');
    await page.locator('#privateChoices button').filter({hasText:new RegExp('^' + row.answerKey[0] + '$')}).click();
    await page.clock.fastForward(9000);
    await page.locator('#privatePause').click();
    // The public control is redrawn only after its progress write completes.
    // Wait for that completed state before advancing time or navigating away.
    await expect(page.locator('#privatePause')).toHaveText('Devam et');
    await page.clock.fastForward(60000);
    await expect(page.locator('#privateClock')).toHaveText('00:00:09');
    await page.locator('#privatePause').click();
    await expect(page.locator('#privatePause')).toHaveText('Duraklat');
    await page.clock.fastForward(3000);
    await page.locator('#privatePause').click();
    await expect(page.locator('#privatePause')).toHaveText('Devam et');
    await expect(page.locator('#privateClock')).toHaveText('00:00:12');

    await page.reload({waitUntil:'domcontentloaded'});
    await enterBooklet(page,row,{navigate:false});
    await page.locator('#privateBookList button').filter({hasText:row.title}).first().click();
    await expectNativeDocument(page);
    await expect(page.locator('#privatePause')).toHaveText('Devam et');
    await expect(page.locator('#privateClock')).toHaveText('00:00:12');
    await expect(page.locator('#privateChoices button').filter({hasText:new RegExp('^' + row.answerKey[0] + '$')})).toHaveAttribute('aria-pressed','true');
    await page.locator('#privateStudy details > summary').filter({hasText:'Cevap anahtarı'}).click();
    await expect(page.locator('#privateOfficialKey')).toContainText('SHA-256');
    await expect(page.locator('#privateConfirmIdentity')).toHaveCount(0);
    const confirmation=page.waitForEvent('dialog').then(async dialog=>{
      assert.equal(dialog.type(),'confirm');
      assert.equal(dialog.message(),'Özel çalışmayı bitirip süreyi durdurmak istiyor musun?');
      await dialog.accept();
    });
    await Promise.all([confirmation,page.locator('#privateFinish').click()]);
    await expect(page.locator('#privateResult h3')).toHaveText('1.00 çalışma neti');
    await expect(page.locator('#privateResult')).toContainText('1 doğru / 0 yanlış / 39 boş');
    await expect(page.locator('#privateResult')).toContainText('SHA-256 ile doğrulandı');
    await expect(page.locator('#privateManualScore')).toHaveCount(0);
    // A pre-hash record may contain a manual result. Recognizing the source
    // later must not relabel that old number as a verified source result.
    await page.evaluate(async examId=>{
      const {openPrivateLibrary} = await import('/shared/private-library.js');
      const library = openPrivateLibrary('guest');
      try {
        const record=(await library.list()).find(record=>record.metadata.bookletId===examId);
        await library.update(record.id,{answerKey:'A'.repeat(40)});
        await library.saveProgress(record.id,{...record.progress,binding:null,score:{correct:0,wrong:1,blank:39,net:-0.25}});
      } finally { await library.close(); }
    },row.id);
    await page.reload({waitUntil:'domcontentloaded'});
    await enterBooklet(page,row,{navigate:false});
    await page.locator('#privateBookList button').filter({hasText:row.title}).first().click();
    await expectNativeDocument(page);
    await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');
    await expect(page.locator('#privateManualScore')).toHaveCount(0);
    await expect(page.locator('#privateRecalculate')).toBeVisible();
    const retainedNet=await page.evaluate(async examId=>{
      const {openPrivateLibrary}=await import('/shared/private-library.js');
      const library=openPrivateLibrary('guest');
      try{return (await library.list()).find(record=>record.metadata.bookletId===examId).progress.score.net}
      finally{await library.close()}
    },row.id);
    assert.equal(retainedNet,-0.25,'Opening an old result must not overwrite its stored data.');
    await page.locator('#privateRecalculate').click();
    await expect(page.locator('#privateResult h3')).toHaveText('1.00 çalışma neti');
    await expect(page.locator('#privateResult')).toContainText('SHA-256 ile doğrulandı');
    const saved = await page.evaluate(async examId=>{
      const {openPrivateLibrary} = await import('/shared/private-library.js');
      const library = openPrivateLibrary('guest');
      try {
        const row = (await library.list()).find(record=>record.metadata.bookletId === examId);
        return row ? {sha256:row.sha256,answers:row.progress?.answers.filter(Boolean).length,duration:row.progress?.finishedDuration,net:row.progress?.score?.net} : null;
      } finally { await library.close(); }
    },row.id);
    assert.deepEqual(saved,{sha256,answers:1,duration:12,net:1});
    assert.equal(externalBodyAttempts,0,'The private booklet or answers must never be posted to an external service.');
    process.stdout.write(JSON.stringify({status:'passed',device,exam:row.examType,id:row.id,year:row.year,bytes:buffer.byteLength,sha256,viewLoaded:true,answerFields:40,persistedMarks:saved.answers,pausedSecondsExcluded:true,resumedAfterReload:true,duration:saved.duration,practiceNet:saved.net,fileIdentity:'sha256',legacyManualScoreRechecked:true,externalBodyAttempts}) + '\n');
  } finally { await context.close(); }
}

try {
  const timedOut = new Promise((_,reject)=>{ deadline=setTimeout(()=>{abort.abort();reject(Error('Official booklet smoke exceeded its 115-second deadline.'));},115000); });
  await Promise.race([(async()=>{
    const rows = ['TYT','AYT'].map(type=>TURKISH_EXAMS.find(row=>row.year===2024 && row.examType===type));
    assert.ok(rows.every(Boolean),'Both reviewed 2024 publisher booklets are required.');
    const downloads = await Promise.all(rows.map(downloadBooklet));
    server = spawn('python3',['-m','http.server','8188','--bind','127.0.0.1'],{cwd:repository,stdio:'ignore'});
    await waitForServer();
    browser = await chromium.launch({headless:true,channel:'chromium',...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
    for (const download of downloads) for (const device of ['desktop','mobile']) await checkBooklet(download,device);
  })(),timedOut]);
} catch (error) {
  process.exitCode=1;
  process.stderr.write(JSON.stringify({status:'failed',stage:'official-booklet-integration',reason:error.message}) + '\n');
} finally {
  clearTimeout(deadline);
  abort.abort();
  await browser?.close();
  server?.kill('SIGTERM');
}
