// Rebuild with npm run build:ai-bank; original sources stay separate.
import {IMPORTED_AI_QUESTIONS} from './ai/imported.js?v=ai-bank-20261112';
import {GENERATED_AI_QUESTIONS} from './ai/generated.js?v=ai-bank-20261112';
export const AI_BANK = {schemaVersion: 1, questions: [...IMPORTED_AI_QUESTIONS, ...GENERATED_AI_QUESTIONS]};
export const ORIGINAL_INDEX_SUMMARY = {sourceCount: 8, pageReferenceCount: 185, examIndexCount: 480, inlineQuestionCount: 0};
