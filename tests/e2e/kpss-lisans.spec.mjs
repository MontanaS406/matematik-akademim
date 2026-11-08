import {test,expect} from './fixtures.mjs';
test('KPSS Lisans opens only the reviewed public partial booklet with its original mathematics numbering',async({page})=>{
 await page.goto('/');await page.locator('#examModeButton').click();await page.locator('#examFamily').selectOption('KPSS');await page.locator('#examYear').selectOption('2024');await page.locator('#examKpssLevel').selectOption('KPSS_LISANS');await page.locator('#examBooklet').selectOption('osym-2024-kpss-lisans-public-partial');
 await expect(page.locator('#examModeNote')).toContainText('Tam deneme değildir');await expect(page.locator('#officialBookletLink')).toHaveAttribute('href','https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/LISANS/GYGK14072024.pdf');await page.locator('#openExamBooklet').click();
 await expect(page.locator('#privateType')).toHaveValue('KPSS_LISANS');await expect(page.locator('#privateCount')).toHaveValue('3');await expect(page.locator('#privateQuestionNumbers')).toHaveValue('31, 41, 46');await expect(page.locator('#privateMathPage')).toHaveValue('12');await expect(page.locator('#privateKnownExam')).toHaveValue('');await expect(page.locator('#privateImportKey')).toHaveValue('');
});
