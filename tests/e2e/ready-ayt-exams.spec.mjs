import {test,expect} from './fixtures.mjs';
import {installApprovedArchive,ARCHIVE_USER} from './personal-archive-helpers.mjs';
import {addCompiledAytFixture} from '../personal-archive-fixture.mjs';

test('ready TYT and AYT exams open directly on the site for an approved account without a manual archive step',async({page})=>{
 const fixture=await installApprovedArchive(page,{customize:addCompiledAytFixture}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('#openReadyExams').click();
 await expect(page.locator('#originalExamList [data-original-exam-id]')).toHaveCount(1);
 await expect(page.locator('#personalArchiveKey,#openPersonalArchive,input[type=file]')).toHaveCount(0);
 await page.locator('#originalExamType').selectOption('AYT');await expect(page.locator('#originalExamList')).toContainText('40 soru');await expect(page.locator('#personalArchiveBody')).toContainText('31 matematik + 9 geometri');
 await page.locator('[data-original-exam-start]').click();await expect(page.locator('#originalExamOptical button')).toHaveCount(40);await expect(page.locator('#originalExamImage canvas')).toBeVisible();
 await expect(page.locator('#originalExamSourcePage')).toBeHidden();await expect(page.locator('#originalExamQuestion')).not.toContainText('Yayınevi:');
 for(const index of [0,15,30,39]){await page.locator(`[data-original-index="${index}"]`).click();await expect(page.locator('#originalExamQuestion')).toHaveAttribute('data-original-id',fixture.index.compiledExams[0].questionIds[index]);await expect(page.locator('#originalExamImage canvas')).toBeVisible()}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test('AYT answers resume after reload, publisher net is calculated, completion is ticked and retry preserves history',async({page})=>{
 await installApprovedArchive(page,{customize:addCompiledAytFixture});await page.clock.install();await page.goto('/');await page.locator('#openReadyExams').click();await page.locator('#originalExamType').selectOption('AYT');await page.locator('[data-original-exam-start]').click();
 await page.locator('[data-exam-original-option="A"]').click();await page.locator('[data-original-index="39"]').click();await page.locator('[data-exam-original-option="B"]').click();await page.clock.fastForward(65000);await page.locator('#pauseOriginalExam').click();const elapsed=await page.locator('#originalExamTimer').innerText();await page.clock.fastForward(120000);await expect(page.locator('#originalExamTimer')).toHaveText(elapsed);
 await page.reload();await page.locator('#openReadyExams').click();await page.locator('#originalExamType').selectOption('AYT');await page.locator('[data-original-exam-start]').click();await expect(page.locator('[data-exam-original-option="B"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#finishOriginalExam').click();await page.locator('#confirmOriginalExamFinish').click();await expect(page.locator('#originalExamResult')).toContainText('AYT');await expect(page.locator('#originalExamResult')).toContainText('0.75');await expect(page.locator('#originalAnswerEvidence')).toBeHidden();
 const before=await page.evaluate(id=>JSON.parse(localStorage.getItem('ma_original_exams_v1_'+id)).attempts,ARCHIVE_USER);expect(before).toHaveLength(1);expect(before[0].type).toBe('AYT');expect(before[0].result).toMatchObject({correct:1,wrong:1,blank:38,net:.75,isOfficial:false});
 await page.locator('#originalResultBack').click();await expect(page.locator('[data-original-exam-id] .exam-completed')).toBeVisible();await page.locator('[data-original-exam-start]').click();const after=await page.evaluate(id=>JSON.parse(localStorage.getItem('ma_original_exams_v1_'+id)).attempts,ARCHIVE_USER);expect(after).toHaveLength(2);expect(after[0]).toEqual(before[0]);expect(after[1].answers).toEqual(Array(40).fill(null));
});
