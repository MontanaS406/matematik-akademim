import {readFileSync} from 'node:fs';
import {createCipheriv,createHash,randomBytes} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {PRACTICE_DISTRIBUTIONS} from '../shared/practice-exams.js';

export const TEST_ARCHIVE_KEY=Buffer.alloc(32,42).toString('base64url');
// Synthetic source records exist only in tests. Production compiles the reviewed
// original question IDs and never creates replacement question text or options.
export function addCompiledAytFixture(index){
 const topicByQuestion={};let position=0;
 for(const topic of PRACTICE_DISTRIBUTIONS.AYT.topics)for(let n=0;n<topic.count;n++){
  const q=index.questions[position++];topicByQuestion[q.id]=topic.id;
  q.aytCompatibility={reviewed:true,topicId:topic.id,note:'Test-only compatibility review'};
  q.answer.evidence={docId:index.documents[1].id,page:1,questionNumber:q.number,label:'Test-only answer evidence',value:q.answer.value};
 }
 index.compiledExams=[{id:'compiled-source-AYT-fixture',type:'AYT',number:1,kind:'compiled',distributionVersion:'original-ayt-2025-v1',manifest:'c'.repeat(64),questionIds:index.questions.map(q=>q.id),topicByQuestion,actualCount:40,targetCount:40,isOfficial:false,origin:'ORIJINAL',answerKey:'A'.repeat(40),keyKind:'source_mapped',keyVerified:true}];
 index.counts.exams=2;index.counts.sourceExams=1;index.counts.compiledAytExams=1;
}
export function personalArchiveFixture(customize=()=>{}){
 const id='personal-1111111111111111',docId='pdf-aaaaaaaaaaaaaaaa',keyDocId='pdf-bbbbbbbbbbbbbbbb',assets=new Map();
 const seal=(data,resource)=>{const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(TEST_ARCHIVE_KEY,'base64url'),nonce);cipher.setAAD(Buffer.from(id+':'+resource));return Buffer.concat([Buffer.from('MAARC1\0\0'),nonce,cipher.update(data),cipher.final(),cipher.getAuthTag()])};
 const digest=data=>createHash('sha256').update(data).digest('hex');
 const image=readFileSync(new URL('./fixtures/personal-source.webp',import.meta.url));
 const makeDoc=(docId,fileName)=>{const asset='assets/personal-archive/'+id+'/'+docId+'-0001.bin',resource='page/'+docId+'/1',bytes=seal(image,resource);assets.set('/'+asset,bytes);return {id:docId,fileName,sha256:docId.slice(4).repeat(4),pages:[{number:1,rect:[0,0,300,220],width:300,height:220,resource,asset,sha256:digest(bytes)}]}};
 const documents=[makeDoc(docId,'PrivateFixtureBook.pdf'),makeDoc(keyDocId,'PrivateAnswerEvidence.pdf')];
 const questions=Array.from({length:40},(_,i)=>({id:'ORIG-FIXTURE-'+(i+1),origin:'ORIJINAL',docId,examType:'TYT',courseId:'geometry',topic:'Test-only source record',subtopic:null,topicReviewed:false,number:i+1,parts:[{page:1,rect:[0,0,300,220]}],printedPage:1,prompt:'Private fixture '+(i+1),options:[...'ABCDE'].map(letter=>({id:letter,text:letter})),hasChoices:true,answer:{value:'A',status:'publisher_unchecked'},solutionSteps:[],mathPassed:false,locationStatus:'captured'}));
 const exams=[{id:'original-exam-fixture',type:'TYT',number:1,docId,distributionVersion:'original-source-v1',manifest:'a'.repeat(64),questionIds:questions.map(q=>q.id),actualCount:40,targetCount:40,isOfficial:false,origin:'ORIJINAL',answerKey:'A'.repeat(40),keyVerified:true,keyKind:'publisher',keyDocId,keyPage:1}];
 const counts={documents:2,pages:2,records:40,duplicateCaptures:0,mathematicallyChecked:0,pendingReview:40,publisherAnswers:40,exams:1};
 const index={version:1,id,counts,documents,questions,exams};customize(index);const bytes=seal(gzipSync(Buffer.from(JSON.stringify(index))),'index'),asset='assets/personal-archive/'+id+'/index.bin';assets.set('/'+asset,bytes);
 const config={version:1,id,counts,index:{asset,resource:'index',sha256:digest(bytes),compression:'gzip'},crypto:{algorithm:'AES-GCM',bits:256,format:'MAARC1'}};
 return {config,index,assets,key:TEST_ARCHIVE_KEY};
}
