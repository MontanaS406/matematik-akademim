import {QUESTION_BANK} from '../../data/question-bank.js';
import {getCourse} from '../../shared/curriculum.js';
export async function selectFirstSource(page){const question=QUESTION_BANK.questions[0];await page.locator('#browseCourses').click();await page.locator('#courseSearch').fill(getCourse(question.courseId).title);await page.locator('#courseList button').first().click();return question}
