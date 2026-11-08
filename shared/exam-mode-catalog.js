import {TURKISH_EXAMS} from '../data/turkish-exams.js';
export const EXAM_FAMILIES=Object.freeze(['TYT','AYT','KPSS']);
export const KPSS_LEVELS=Object.freeze({KPSS_LISANS:'Lisans',KPSS_ONLISANS:'Ön Lisans',KPSS_ORTAOGRETIM:'Ortaöğretim'});
const partialKpss={id:'osym-2024-kpss-onlisans-public-partial',examType:'KPSS_ONLISANS',year:2024,title:'2024 KPSS Ön Lisans · yayımlanan %10',originalUrl:'https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/ONL/kitapcik01092024.pdf',questionCount:3,questionNumbers:[33,39,57],mathStartPage:1,partial:true};
export function validateExamSelection(input){
 const family=input?.family,year=Number(input?.year),kpssLevel=input?.kpssLevel||'KPSS_LISANS';
 if(!EXAM_FAMILIES.includes(family)||!Number.isInteger(year)||year<2018||year>2026||!Object.hasOwn(KPSS_LEVELS,kpssLevel))throw Error('Sınav seçimi geçersiz.');
 return {family,year,kpssLevel};
}
export function modeBooklets(input){const s=validateExamSelection(input);return s.family==='KPSS'?(s.year===2024&&s.kpssLevel==='KPSS_ONLISANS'?[partialKpss]:[]):TURKISH_EXAMS.filter(row=>row.examType===s.family&&row.year===s.year)}
export function modeSetup(input){
 const s=validateExamSelection(input),booklets=modeBooklets(s),booklet=booklets.find(row=>row.id===input.bookletId),examType=s.family==='KPSS'?s.kpssLevel:s.family;
 if(input.bookletId&&input.bookletId!=='custom'&&!booklet)throw Error('Kitapçık bu sınav ve yılla eşleşmiyor.');
 if(booklet)return {examType,year:s.year,sourceTitle:booklet.title,sourceUrl:booklet.originalUrl,questionCount:booklet.questionCount,questionNumbers:booklet.questionNumbers.slice(),mathStartPage:booklet.mathStartPage,examId:booklet.partial?null:booklet.id,partial:booklet.partial===true};
 const questionCount=s.family==='KPSS'?30:40;
 return {examType,year:s.year,sourceTitle:`${s.year} ${s.family==='KPSS'?'KPSS '+KPSS_LEVELS[s.kpssLevel]:s.family} · kendi kitapçığım`,sourceUrl:null,questionCount,questionNumbers:Array.from({length:questionCount},(_,i)=>i+1),mathStartPage:1,examId:null,partial:false};
}
