// Rebuild with npm run build:ai-bank; original sources stay separate.
import {IMPORTED_AI_QUESTIONS} from './ai/imported.js?v=issue11-20261113';
import {GENERATED_AI_QUESTIONS} from './ai/generated.js?v=issue11-20261113';
import {SOURCE_DERIVED_AI_QUESTIONS} from './source-derived-ai.js?v=issue11-20261113';
import {SOURCE_DERIVED_EXPANSION} from './source-derived-expansion.js?v=issue11-20261114';
import {SOURCE_READ_EVIDENCE} from './source-catalog.js?v=issue11-20261113';
export const AI_BANK = {schemaVersion: 1, sourceEvidence: SOURCE_READ_EVIDENCE, questions: [...IMPORTED_AI_QUESTIONS, ...GENERATED_AI_QUESTIONS, ...SOURCE_DERIVED_AI_QUESTIONS, ...SOURCE_DERIVED_EXPANSION]};
export const ORIGINAL_INDEX_SUMMARY = {sourceCount: 8, pageReferenceCount: 185, examIndexCount: 480, inlineQuestionCount: 0};
