import {test,expect} from './fixtures.mjs';
import {TURKISH_EXAMS} from '../../data/turkish-exams.js';

async function seedLegacyResult(page,browser,source){
 // This blank document represents an older private record, not exam content.
 const generator=await browser.newPage();let buffer;
 try{await generator.setContent('<h1>Blank legacy storage fixture</h1>');buffer=await generator.pdf()}finally{await generator.close()}
 await page.goto('/');
 const legacy=await page.evaluate(async({bytes,source})=>{
  const {openPrivateLibrary}=await import('/shared/private-library.js');const library=openPrivateLibrary('guest');
  try{
   const book=await library.put({blob:new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),fileName:'legacy-private-booklet.pdf',metadata:{examType:source.examType,year:source.year,sourceTitle:source.title,sourceUrl:source.originalUrl,mathStartPage:source.mathStartPage,questionCount:source.questionCount,questionNumbers:source.questionNumbers,bookletId:source.id}});
   const now=Date.now(),answers=Array(40).fill(null);answers[0]=source.answerKey?.[0]||'A';
   await library.saveProgress(book.id,{answers,index:0,startedAt:now-15000,pausedAt:null,pausedMs:0,finishedAt:new Date(now-1000).toISOString(),finishedDuration:14,score:{correct:1,wrong:0,blank:39,net:1},binding:{examId:source.id,confirmedAt:new Date(now-2000).toISOString()}});
   const saved=await library.get(book.id);return {id:saved.id,sha256:saved.sha256,progress:saved.progress};
  }finally{await library.close()}
 },{bytes:Array.from(buffer),source});
 return legacy;
}
async function openSavedResult(page,source){
 await page.locator('#examModeButton').click();await page.locator('#examFamily').selectOption(source.examType);await page.locator('#examYear').selectOption(String(source.year));await page.locator('#examBooklet').selectOption(source.id);await page.locator('#openExamBooklet').click();
}
async function retainedProgress(page,id){
 return page.evaluate(async id=>{const {openPrivateLibrary}=await import('/shared/private-library.js');const library=openPrivateLibrary('guest');try{return (await library.get(id)).progress}finally{await library.close()}},id);
}

test('a previously confirmed result cannot remain trusted after the publisher hash disproves its file identity',async({page,browser})=>{
 const source=TURKISH_EXAMS.find(row=>row.id==='osym-2024-tyt-math');expect(source.pdfSha256).toMatch(/^[a-f0-9]{64}$/);
 const legacy=await seedLegacyResult(page,browser,source);expect(legacy.sha256).not.toBe(source.pdfSha256);

 await openSavedResult(page,source);
 await expect(page.locator('#privateBookList')).toContainText('eşleşmiyor');await expect(page.locator('#privateBookList')).not.toContainText('1.00 çalışma neti');
 await page.locator('#privateBookList button').filter({hasText:source.title}).click();
 await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');await expect(page.locator('#privateResult')).toContainText('eşleşmiyor');
 await expect(page.locator('#privateConfirmIdentity')).toHaveCount(0);await expect(page.locator('#privateBindKey')).toHaveCount(0);
 expect(await retainedProgress(page,legacy.id)).toEqual(legacy.progress);
});

test('a cancelled AYT result keeps the original answers but no longer displays its obsolete net',async({page,browser})=>{
 const source=TURKISH_EXAMS.find(row=>row.id==='osym-2026-ayt-math');expect(source.cancelledNumbers).toContain(23);
 const legacy=await seedLegacyResult(page,browser,source);await openSavedResult(page,source);
 await expect(page.locator('#privateBookList button')).toContainText(source.title);await expect(page.locator('#privateBookList')).not.toContainText('1.00 çalışma neti');
 await page.locator('#privateBookList button').filter({hasText:source.title}).click();
 await expect(page.locator('#privateResult h3')).toHaveText('Puanlanmadı');await expect(page.locator('#privateResult')).toContainText('İptal');
 await expect(page.locator('#privateConfirmIdentity')).toHaveCount(0);await expect(page.locator('#privateBindKey')).toHaveCount(0);
 expect(await retainedProgress(page,legacy.id)).toEqual(legacy.progress);
});
