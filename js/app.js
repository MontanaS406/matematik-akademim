import {createPracticeExamController} from './practice-exams.js?v=account-teachers-20261117';
import {createPersonalArchiveController} from './personal-archive.js?v=account-teachers-20261117';
import {createSourceAccessController} from './source-access.js?v=account-teachers-20261117';
import {COURSES, getCourse, buildStudyPlan} from '../shared/curriculum.js';
import {TEACHERS, DEFAULT_TEACHER_ID, PROFANITY_LEVELS, getTeacherLine} from '../shared/teachers.js?v=account-teachers-20261117';
import {getTeacherDialogues,getTeacherDialogueVariants,DIALOGUE_CATEGORIES} from '../shared/teacher-dialogues.js?v=account-teachers-20261117';
import {normalizeState, mergeLearningStates, progressFromAttempts} from '../shared/learning-state.js?v=account-teachers-20261117';
import {QUESTION_BANK} from '../data/question-bank.js?v=account-teachers-20261117';
import {createQuestionRegistry} from '../shared/question-bank.js';
import {AI_BANK} from '../data/ai-bank.js?v=account-teachers-20261117';
import {SOURCED_ARCHIVE_SUMMARY, SOURCE_DOCUMENTS, SOURCE_READ_EVIDENCE} from '../data/source-catalog.js?v=account-teachers-20261117';
import {createAiRegistry, aiDerivationKind} from '../shared/ai-bank.js';
import {createTutorClient} from './tutor-client.js';
const tutorClient=createTutorClient();
const aiRegistry=createAiRegistry(AI_BANK);
const bankRegistry=createQuestionRegistry(QUESTION_BANK);
const practiceExams=createPracticeExamController({registry:aiRegistry,root:document.getElementById('practiceExamRoot'),learningRoot:document.getElementById('learningRoot')});
const sourceAccess=createSourceAccessController();
window.MASourceAccess={mountAccountPanel:node=>sourceAccess.mountAccountPanel(node)};
const personalArchive=createPersonalArchiveController({accessController:sourceAccess});
import {captureLearningSnapshot} from '../shared/learning-migration.js';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let owner=null, scope='guest', state, revision=0, remoteChain=Promise.resolve(), saveTimer;
let teacherTask='chat',teachingLevel='auto',bankScope='all',bankPool='ai',bankExam='',bankSubtopic='',aiPool='',aiDerivation='';
let selectedQuestionId=null, answeredQuestionId=null, bankDifficulty='', teacherEpoch=0, activeRequest=null, conversations=new Map(),questionResponses=new Map();
let profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};
let dialogueCategory='',dialogueScenarioId='start',dialogueVariant=0;
let greetingChoices=new Map(),greetingCounters=new Map();
const teacher=()=>TEACHERS.find(t=>t.id===state.teacherId)||TEACHERS.find(t=>t.id===DEFAULT_TEACHER_ID);
const course=()=>getCourse(state.courseId)||COURSES[0];
const key=()=>`ma_learning_v1_${scope}`;
function loadLocal(){try{return normalizeState(JSON.parse(localStorage.getItem(key())||'null'))}catch{return normalizeState(null)}}
function status(message){const node=$('profileStatus')||$('syncStatus');if(node)node.textContent=message}
function saveLocal(){try{if(!captureLearningSnapshot(localStorage,scope,localStorage.getItem(key())))throw Error('Önceki kayıt yedeklenemedi');localStorage.setItem(key(),JSON.stringify(state));return true}catch{status('İlerleme bu tarayıcıya kaydedilemedi. Depolama izinlerini kontrol et.');return false}}
function changed(preferences=false){revision++;if(preferences)state.preferencesAt=new Date().toISOString();saveLocal();window.dispatchEvent(new CustomEvent('ma-learning-changed'));clearTimeout(saveTimer);if(owner)saveTimer=setTimeout(()=>syncProfile(),700)}
async function syncProfile(write=true){
  const account=window.MAAccount;const current=scope;const generation=revision;
  if(!owner||!account){status('İlerlemen bu tarayıcıda. Hesabına girerek buluta kaydedebilirsin.');return}
  status('Öğrenme kaydı eşitleniyor…');
  remoteChain=remoteChain.catch(()=>{}).then(async()=>{
    if(current!==scope)return;
    try{
      const remote=await account.loadLearning();if(current!==scope)return;
      if(remote){
        if(!captureLearningSnapshot(localStorage,scope,remote,'remote'))throw Error('Önceki bulut kaydı yedeklenemedi');
        const before=[state.courseId,state.difficulty].join(':'),beforeTeacher=state.teacherId;
        state=mergeLearningStates(state,remote);
        const contextChanged=before!==[state.courseId,state.difficulty].join(':');
        if(contextChanged){if(teacherTask!=='chat'){activeRequest?.abort();teacherEpoch++}selectedQuestionId=null;answeredQuestionId=null}
        if(generation!==revision)status('Yeni yerel değişiklikler korunarak birleştirildi.');
        saveLocal();window.dispatchEvent(new CustomEvent('ma-learning-changed'));renderLearning();
        if(beforeTeacher!==state.teacherId){profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};renderTeachers()}
        else if(contextChanged&&teacherTask!=='chat')renderChat();
      }
      if(!write){status('Öğrenme kaydın hazır.');return}
      const snapshot=normalizeState(state);await account.saveLearning(snapshot);
      if(current===scope)status('Öğretmen tercihin ve ilerlemen hesabına kaydedildi.');
    }catch{if(current===scope)status('Bulut öğrenme kaydı eşitlenemedi. Yerel kayıt korunuyor; yeniden eşitleyebilirsin.')}
  });return remoteChain;
}
async function changeAccount(){
  const next=window.MAAccount?.getUser()?.id||null;if(next===owner&&state)return;
  activeRequest?.abort();owner=next;scope=owner||'guest';revision++;clearTimeout(saveTimer);state=loadLocal();
  $('message').value='';conversations=new Map();questionResponses=new Map();greetingChoices=new Map();greetingCounters=new Map();profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};dialogueCategory='';dialogueScenarioId='start';dialogueVariant=0;teacherTask='chat';teachingLevel='auto';selectedQuestionId=null;answeredQuestionId=null;
  renderLearning();renderTeachers();renderLessons();if(owner)await syncProfile(false);
}
const isAiQuestion=q=>q?.origin==='AI_URETIMI';
const practiceQuestions=Object.freeze([...bankRegistry.questions,...aiRegistry.questions]);
const allPracticeQuestions=()=>practiceQuestions;
const registeredQuestion=id=>aiRegistry.getQuestion(id)||bankRegistry.getQuestion(id);
const poolQuestions=(filters={})=>bankPool==='ai'?aiRegistry.getQuestions({...filters,...(bankExam?{examType:bankExam}:{}),...(aiPool?{pool:aiPool}:{}),...(aiDerivation?{derivationKind:aiDerivation}:{})}):bankPool==='original'?bankRegistry.getQuestions(filters):[];
const eligibleQuestions=()=>[...poolQuestions({...(bankScope==='course'?{courseId:course().id}:{}),...(bankDifficulty?{difficulty:bankDifficulty}:{}),...(bankSubtopic?{subtopic:bankSubtopic}:{})})].sort((a,b)=>Number(b.courseId===course().id)-Number(a.courseId===course().id));
const activeQuestion=()=>bankPool==='ai'?aiRegistry.getQuestion(selectedQuestionId):bankPool==='original'?bankRegistry.getQuestion(selectedQuestionId):null;
const explainableSource=()=>{const q=activeQuestion();return q&&!isAiQuestion(q)&&q.displayMode==='inline'&&typeof q.prompt==='string'&&q.prompt.trim()?q:null};
const chatKey=()=>teacher().id+':'+(teacherTask==='chat'?'chat':teacherTask==='lesson'?'lesson:'+course().id:'source:'+(explainableSource()?.id||''));
const teacherContext=()=>teacherTask==='chat'?{mode:'chat'}:teacherTask==='lesson'?{mode:'lesson',courseId:course().id}:{mode:'source',questionId:explainableSource()?.id};
function verifiedProgress(){const valid=new Set(allPracticeQuestions().map(q=>q.id));return progressFromAttempts({...state,attempts:state.attempts.filter(a=>valid.has(a.exerciseId))})}
function resetPractice(){activeRequest?.abort();teacherEpoch++;$('message').value='';selectedQuestionId=null;answeredQuestionId=null;renderLearning();renderChat()}
const difficultyName=value=>({easy:'Kolay',medium:'Orta',hard:'Zor'}[value]||'Seviyesi belirtilmemiş');
const derivationName=value=>({AI_ARCHIVE_IMPORT:'AI arşivi',AI_TO_AI:'AI → AI',ORIGINAL_TO_AI:'Orijinal → AI'}[value]||'Köken incelemede');
const sourceDocument=id=>SOURCE_DOCUMENTS.find(document=>document.id===id);
const sourceLocation=source=>[
 Number.isInteger(source.physicalPage)&&source.physicalPage>0?'Dosya sayfası '+source.physicalPage:null,
 Number.isInteger(source.printedPage)&&source.printedPage>0?'basılı sayfa '+source.printedPage:null,
 Number.isInteger(source.originalPdfPage)&&source.originalPdfPage>0?'ana belge sayfası '+source.originalPdfPage:null,
 source.questionNumber!==undefined&&source.questionNumber!==null?'soru '+source.questionNumber:null
].filter(Boolean).join(' · ');
function renderOriginalEmpty(node){personalArchive.mount(node)}

function renderAiLineage(node,q){
 const kind=aiDerivationKind(q),paragraph=document.createElement('p');paragraph.className='ai-lineage';paragraph.dataset.derivation=kind;
 paragraph.textContent=kind==='ORIGINAL_TO_AI'?'Orijinal → AI: okunan kaynak sorunun becerisinden bağımsız yeni alıştırma.':kind==='AI_TO_AI'?'AI → AI: mevcut AI alıştırmasından türetildi.':'AI arşivinden aktarılan alıştırma.';
 node.append(paragraph);
 if(kind==='ORIGINAL_TO_AI'){
  const provenance=q.provenance,evidence=SOURCE_READ_EVIDENCE.find(row=>row.id===provenance.sourceReadEvidenceId),doc=sourceDocument(provenance.sourceDocumentId),location=document.createElement('p');
  location.className='source-lineage-location';location.textContent=(doc?.fileName||'Kaynak belgesi')+' — '+sourceLocation(evidence||{physicalPage:provenance.physicalPage,originalPdfPage:provenance.originalPdfPage,questionNumber:provenance.sourceQuestionNumber});node.append(location);
  const parent=document.createElement('p');parent.className='question-id';parent.textContent='Kaynak soru kimliği: '+provenance.sourceQuestionId;node.append(parent);
 }
}

let lessonGroup='Tümü';
function renderLearning(){
 const questions=eligibleQuestions();
 const questionCountLabel=bankPool==='original'?(personalArchive.isUnlocked()?personalArchive.getCount().toLocaleString('tr-TR')+' kayıt':'Hesap erişimi'):questions.length+' soru';
 if(!questions.some(q=>q.id===selectedQuestionId))selectedQuestionId=questions[0]?.id||null;
 const momentum=learningMomentum(),t=teacher(),subtopics=[...new Set(poolQuestions(bankScope==='course'?{courseId:course().id}:{}).map(q=>q.subtopic).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
 $('learningRoot').innerHTML=`<div class="page-heading"><h1>Soru çöz</h1><div class="practice-mode-actions"><span class="count-badge">${questionCountLabel}</span><button id="openReadyExams" class="btn">TYT / AYT Denemeler</button><button id="openPracticeExams" class="smallbtn">AI denemeleri</button></div></div><div class="practice-filters ${bankPool==='original'?'personal-pool-filters':''}"><label>Havuz<select id="bankPool" class="field"><option value="ai">AI alıştırmaları</option><option value="original">Orijinal sorular</option><option value="osym">ÖSYM denemeleri</option></select></label><label>Sınav<select id="bankExam" class="field" ${bankPool!=='ai'?'disabled':''}><option value="">TYT ve AYT</option><option value="TYT">TYT</option><option value="AYT">AYT</option></select></label><div class="topic-filter"><span>Konu</span><button id="browseCourses" class="topic-button"><span>${bankScope==='all'?'Tüm konular':esc(course().title)}</span><span aria-hidden="true">⌄</span></button></div><label>Seviye<select id="bankDifficulty" class="field" ${bankPool==='osym'?'disabled':''}><option value="">Tüm seviyeler</option><option value="easy">Kolay</option><option value="medium">Orta</option><option value="hard">Zor</option></select></label></div><details class="extra-practice-filters" ${bankPool!=='ai'?'hidden':''}><summary>Diğer filtreler</summary><div class="practice-filter-details"><label>Alt konu<select id="bankSubtopic" class="field"><option value="">Tüm alt konular</option>${subtopics.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label><label>AI havuzu<select id="aiPool" class="field"><option value="">Tüm AI alıştırmaları</option><option value="imported">Arşivden aktarılan</option><option value="generated">Yeni üretilen</option></select></label><label>Türetme kökeni<select id="aiDerivation" class="field"><option value="">Tüm kökenler</option><option value="AI_ARCHIVE_IMPORT">AI arşivi</option><option value="AI_TO_AI">AI → AI</option><option value="ORIGINAL_TO_AI">Orijinal → AI</option></select></label></div></details><div class="practice-layout ${bankPool==='original'?'personal-pool-layout':''}"><div id="sourceQuestion" class="surface question-panel"></div><aside class="practice-aside"><div class="surface mentor-card"><span class="avatar" aria-hidden="true">${esc(t.avatar)}</span><h2>${esc(t.name)}</h2><p>${esc(t.tagline)}</p><button class="smallbtn" id="askLessonTeacher">Öğretmenime sor</button></div><div class="surface today-card"><p class="eyebrow">BUGÜN</p><div class="today-value"><span id="practiceToday">${momentum.practiceToday}</span><small>soru</small></div><button id="viewProgress" class="text-button">İlerlemeni gör →</button></div></aside></div>`;
 for(const [id,value] of [['bankPool',bankPool],['bankExam',bankExam],['bankDifficulty',bankDifficulty],['bankSubtopic',bankSubtopic],['aiPool',aiPool],['aiDerivation',aiDerivation]])$(id).value=value;
 $('bankPool').onchange=event=>{if(bankPool==='original'&&!personalArchive.pause()){event.target.value=bankPool;return}bankPool=event.target.value;bankScope='all';bankDifficulty='';bankSubtopic='';resetPractice()};
 $('bankExam').onchange=event=>{bankExam=event.target.value;bankSubtopic='';resetPractice()};
 $('bankDifficulty').onchange=event=>{bankDifficulty=event.target.value;resetPractice()};
 $('bankSubtopic').onchange=event=>{bankSubtopic=event.target.value;resetPractice()};
 $('aiPool').onchange=event=>{aiPool=event.target.value;bankSubtopic='';resetPractice()};
 $('aiDerivation').onchange=event=>{aiDerivation=event.target.value;bankSubtopic='';resetPractice()};
 $('openReadyExams').onclick=()=>{if(!personalArchive.pause())return;bankPool='original';renderLearning();personalArchive.openExams()};
 $('openPracticeExams').onclick=()=>{if(personalArchive.pause())practiceExams.open()};
 $('browseCourses').onclick=openCatalog;
 $('askLessonTeacher').onclick=()=>{const q=activeQuestion();if(isAiQuestion(q)&&state.courseId!==q.courseId){state.courseId=q.courseId;changed(true)}openTeacher(true)};
 $('viewProgress').onclick=()=>document.querySelector('[data-page=mockexam]')?.click();
 renderSourceQuestion();
}
function selectCourse(id){
 if(!getCourse(id))return;
 activeRequest?.abort();teacherEpoch++;$('message').value='';state.courseId=id;selectedQuestionId=null;answeredQuestionId=null;bankSubtopic='';changed(true);
 const available=poolQuestions({courseId:id}).length;
 bankScope='course';renderLearning();renderTeachers();renderLessons();
 showPage(available?'study':'library');
 if(!available)showLesson(id);
}
function renderSourceQuestion(){
 const node=$('sourceQuestion'),q=activeQuestion(),questions=eligibleQuestions();
 if(!q){
  if(bankPool==='original'){renderOriginalEmpty(node);return}
  node.innerHTML=bankPool==='ai'
   ? '<div id="questionBankEmpty" class="empty-state" role="status"><h2>Bu filtrelerde soru yok</h2><p>Başka bir konu veya seviye seçebilirsin. İnceleme bekleyen sorular çözüm havuzuna alınmaz.</p><button id="clearPracticeFilters" class="smallbtn">Filtreleri temizle</button></div>'
   : '<div id="questionBankEmpty" class="empty-state" role="status"><h2>Henüz soru yok</h2><p>Bu bölümde henüz çözülebilir resmî sınav sorusu yok. AI alıştırmaları burada gösterilmez.</p></div>';
  if($('clearPracticeFilters'))$('clearPracticeFilters').onclick=()=>{bankScope='all';bankExam='';bankDifficulty='';bankSubtopic='';aiPool='';aiDerivation='';resetPractice()};
  return;
 }
 if(isAiQuestion(q)){renderAiQuestion(node,q,questions);return}
 const index=questions.findIndex(item=>item.id===q.id);
 node.innerHTML=`<article id="questionCard" data-question-id="${esc(q.id)}"><div class="question-top"><span class="topic-label">${esc(q.topic)}</span><div class="row"><span class="question-count">${index+1} / ${questions.length}</span><button id="openSourceInfo" class="icon-button" aria-label="Soru bilgisi">i</button></div></div><div id="originalPrompt" class="question-body"></div><div id="sourceAnswerArea"></div><p id="sourceFeedback" class="answer-feedback" role="status"></p><div class="question-footer"><div class="question-nav"><button id="previousSource" aria-label="Önceki soru" ${index<=0?'disabled':''}>←</button><button id="nextSource" aria-label="Sonraki soru" ${index>=questions.length-1?'disabled':''}>→</button></div><button id="askTeacher" class="text-button teacher-help">Öğretmene sor</button></div></article>`;
 const prompt=$('originalPrompt'),parts=q.prompt.split('\n');
 if(parts.length>1){const instruction=document.createElement('p');instruction.className='question-instruction';instruction.textContent=parts.shift();prompt.append(instruction,document.createTextNode('\n'))}
 const expression=document.createElement('div');expression.className='question-expression';expression.textContent=parts.join('\n');prompt.append(expression);
 const area=$('sourceAnswerArea');
 if(q.options.length){
  area.className='exercise-choices';for(const option of q.options){const button=document.createElement('button');button.textContent=option.id+') '+option.text;button.onclick=()=>answerSource(option.id);area.append(button)}
 }else{
  area.innerHTML='<form id="answerForm" class="answer-form"><label for="sourceResponse">Cevabın</label><div class="answer-row"><input id="sourceResponse" class="field" autocomplete="off" maxlength="200" aria-label="Cevabın"><button id="checkSourceAnswer" type="submit" class="btn">Kontrol et</button></div></form>';
  $('answerForm').onsubmit=event=>{event.preventDefault();answerSource($('sourceResponse').value)};
 }
 $('openSourceInfo').onclick=()=>{
  $('sourceAttribution').textContent=q.source.license.attribution;
  $('originalSourceLink').href=q.originalUrl||q.source.originalUrl;$('licenseLink').href=q.source.license.url;$('answerEvidenceLink').href=q.answer.evidenceUrl;
  $('sourceInfo').showModal();
 };
 const navigate=delta=>{activeRequest?.abort();teacherEpoch++;$('message').value='';selectedQuestionId=questions[index+delta]?.id||q.id;answeredQuestionId=null;renderSourceQuestion();renderChat()};
 $('previousSource').onclick=()=>navigate(-1);$('nextSource').onclick=()=>navigate(1);$('askTeacher').onclick=()=>openTeacher(false);
 if(answeredQuestionId===q.id)disableSourceAnswer();
}
function renderAiQuestion(node,q,questions){
 const index=questions.findIndex(item=>item.id===q.id),response=questionResponses.get(q.id);
 node.innerHTML=`<article id="questionCard" class="ai-question" data-question-id="${esc(q.id)}" data-origin="AI_URETIMI"><div class="question-top"><span class="topic-label">${esc(q.examType)} · ${esc(q.topic)}</span><span class="question-count">${index+1} / ${questions.length}</span></div><div class="ai-question-label"><span class="ai-badge">AI ÜRETİMİ</span><span>${esc(difficultyName(q.difficulty))}</span></div><div id="originalPrompt" class="question-body ai-prompt"></div><div id="sourceAnswerArea" class="exercise-choices" role="group" aria-label="Cevap seçenekleri"></div><div class="answer-actions"><button id="checkSourceAnswer" class="btn" disabled>Kontrol et</button></div><p id="sourceFeedback" class="answer-feedback" role="status"></p><section id="aiSolution" class="ai-solution" aria-label="Açıklamalı çözüm" hidden></section><details class="question-verification"><summary>Soru bilgisi</summary><p>AI tarafından ${q.pool==='generated'?'yeni üretilen':'arşivden aktarılan'} alıştırma; çıkmış sınav sorusu değildir.</p><p>Matematiksel kontrol: otomatik. İnsan editör incelemesi bekliyor.</p><p class="question-id"></p></details><div class="question-footer"><div class="question-nav"><button id="previousSource" aria-label="Önceki soru" ${index<=0?'disabled':''}>←</button><button id="nextSource" aria-label="Sonraki soru" ${index>=questions.length-1?'disabled':''}>→</button></div><button id="askTeacher" class="text-button teacher-help">Konuyu öğretmenime sor</button></div></article>`;
 $('originalPrompt').textContent=q.prompt;node.querySelector('.question-id').textContent='Soru kimliği: '+q.id;renderAiLineage(node.querySelector('.question-verification'),q);
 for(const option of q.options){const button=document.createElement('button');button.dataset.option=option.id;button.textContent=option.id+') '+option.text;button.setAttribute('aria-pressed',String(response?.choice===option.id));button.onclick=()=>{questionResponses.set(q.id,{choice:option.id,checked:false});for(const item of $('sourceAnswerArea').children)item.setAttribute('aria-pressed',String(item===button));$('checkSourceAnswer').disabled=false};$('sourceAnswerArea').append(button)}
 $('checkSourceAnswer').disabled=!response?.choice;
 $('checkSourceAnswer').onclick=()=>{const chosen=questionResponses.get(q.id);if(!chosen?.choice||chosen.checked)return;questionResponses.set(q.id,{...chosen,checked:true,feedbackVariant:state.attempts.filter(a=>registeredQuestion(a.exerciseId)).length});answerSource(chosen.choice);showAiAnswer(q)};
 const navigate=delta=>{activeRequest?.abort();teacherEpoch++;$('message').value='';selectedQuestionId=questions[index+delta]?.id||q.id;answeredQuestionId=null;renderSourceQuestion();renderChat()};
 $('previousSource').onclick=()=>navigate(-1);$('nextSource').onclick=()=>navigate(1);
 $('askTeacher').onclick=()=>{if(state.courseId!==q.courseId){state.courseId=q.courseId;changed(true)}openTeacher(true)};
 if(response?.checked){answeredQuestionId=q.id;showAiAnswer(q)}
}
function showAiAnswer(q){
 const response=questionResponses.get(q.id);if(!response?.checked)return;
 disableSourceAnswer();$('checkSourceAnswer').disabled=true;
 const correct=response.choice===q.answer.value;
 for(const button of $('sourceAnswerArea').children){if(button.dataset.option===q.answer.value)button.classList.add('correct-choice');else if(button.dataset.option===response.choice)button.classList.add('incorrect-choice')}
 const option=q.options.find(item=>item.id===q.answer.value);
 const reaction=getTeacherLine(teacher().id,correct?'correct':'incorrect',response.feedbackVariant||0,profanity);
 $('sourceFeedback').textContent=(correct?'✓ Doğru. '+reaction:'Cevabın '+response.choice+'. Doğru cevap: '+q.answer.value+(option?' · '+option.text:'')+'. '+reaction);
 const solution=$('aiSolution');solution.hidden=false;const heading=document.createElement('h3');heading.textContent='Adım adım çözüm';const list=document.createElement('ol');for(const step of q.solutionSteps?.length?q.solutionSteps:[q.answer.solution]){if(!step)continue;const item=document.createElement('li');item.textContent=step;list.append(item)}solution.replaceChildren(heading,list);
}
const comparable=value=>String(value).trim().replace(/\s+/g,'').replace(/−/g,'-');
function disableSourceAnswer(){$('sourceAnswerArea').querySelectorAll('button,input').forEach(node=>node.disabled=true)}
function answerSource(value){
 const q=activeQuestion();if(!q||answeredQuestionId===q.id||!String(value).trim())return;
 const correct=comparable(value)===comparable(q.answer.value);answeredQuestionId=q.id;disableSourceAnswer();
 $('sourceFeedback').textContent=correct?'✓ '+q.answer.value+' · '+getTeacherLine(teacher().id,'correct',state.attempts.filter(a=>registeredQuestion(a.exerciseId)).length,profanity):'Cevap: '+q.answer.value;
 if(!correct&&!q.options.length)return;
 state.attempts.push({id:crypto.randomUUID(),courseId:q.courseId,exerciseId:q.id,correct,difficulty:q.difficulty||'unclassified',at:new Date().toISOString()});state=normalizeState(state);changed();if($('practiceToday'))$('practiceToday').textContent=learningMomentum().practiceToday;
}
function openCatalog(){
 let dialog=$('courseCatalog');if(!dialog){dialog=document.createElement('dialog');dialog.id='courseCatalog';dialog.className='course-catalog';document.body.append(dialog)}
 dialog.innerHTML='<div class="dialog-heading"><h2>Konu seç</h2><button class="icon-button" id="closeCatalog" aria-label="Kapat">×</button></div><label class="sr-only" for="courseSearch">Konu ara</label><input class="field" id="courseSearch" type="search" placeholder="Konu ara"><div id="courseList" class="course-list"></div>';
 const render=()=>{
  const query=$('courseSearch').value.toLocaleLowerCase('tr-TR'),list=$('courseList');list.replaceChildren();
  const all=document.createElement('button');all.textContent='Tüm konular';all.onclick=()=>{dialog.close();bankScope='all';bankDifficulty='';bankSubtopic='';selectedQuestionId=null;answeredQuestionId=null;renderLearning();renderTeachers();showPage('study')};if(!query)list.append(all);
  for(const c of COURSES.filter(c=>(c.title+' '+c.group).toLocaleLowerCase('tr-TR').includes(query))){const button=document.createElement('button');button.textContent=c.title;const note=document.createElement('small'),count=poolQuestions({courseId:c.id}).length;note.textContent=count?count+(bankPool==='ai'?' AI alıştırması':' soru'):'Konu anlatımı';button.append(note);button.onclick=()=>{dialog.close();selectCourse(c.id)};list.append(button)}
 };
 $('closeCatalog').onclick=()=>dialog.close();$('courseSearch').oninput=render;render();dialog.showModal();
}
function renderLessons(){
 const target=$('lessonList'),query=$('lessonSearch').value.toLocaleLowerCase('tr-TR');$('lessonCount').textContent=COURSES.length+' konu';target.replaceChildren();
 for(const c of COURSES.filter(c=>(lessonGroup==='Tümü'||c.group===lessonGroup)&&c.title.toLocaleLowerCase('tr-TR').includes(query))){const button=document.createElement('button');button.className='lesson-tile';const group=document.createElement('small');group.textContent=c.group;const title=document.createElement('strong');title.textContent=c.title;const note=document.createElement('span'),count=allPracticeQuestions().filter(q=>q.courseId===c.id).length;note.textContent=count?count+' soru · Konu anlatımı':'Konu anlatımı';button.append(group,title,note);button.onclick=()=>showLesson(c.id);target.append(button)}
 const groups=$('lessonGroups');groups.replaceChildren();for(const label of ['Tümü',...new Set(COURSES.map(c=>c.group))]){const button=document.createElement('button');button.textContent=label;button.className=label===lessonGroup?'active':'';button.onclick=()=>{lessonGroup=label;renderLessons()};groups.append(button)}
}
function showLesson(id){
 const c=getCourse(id);if(!c)return;
 const panel=$('lessonDetails'),count=allPracticeQuestions().filter(q=>q.courseId===id).length;panel.classList.remove('hide');
 panel.innerHTML=`<div class="dialog-heading"><h2>${esc(c.title)}</h2><button id="closeLesson" class="icon-button" aria-label="Anlatımı kapat">×</button></div><ol>${c.lessonSteps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><div class="lesson-actions">${count?'<button id="lessonPractice" class="btn">Soruları çöz</button>':''}<button id="lessonAskTeacher" class="smallbtn">Öğretmenime sor</button></div>`;
 $('closeLesson').onclick=()=>panel.classList.add('hide');
 if(count)$('lessonPractice').onclick=()=>{bankPool=aiRegistry.getQuestions({courseId:id}).length?'ai':'original';bankExam='';bankDifficulty='';aiPool='';aiDerivation='';selectCourse(id)};
 $('lessonAskTeacher').onclick=()=>{selectCourse(id);openTeacher(true)};panel.scrollIntoView({block:'start',behavior:'smooth'});
}
function learningMomentum(){const attempts=state.attempts.filter(a=>registeredQuestion(a.exerciseId)),day=new Date().toLocaleDateString();let consecutiveCorrect=0;for(let i=attempts.length-1;i>=0&&attempts[i].correct;i--)consecutiveCorrect++;return {consecutiveCorrect,practiceToday:attempts.filter(a=>new Date(a.at).toLocaleDateString()===day).length,dailyGoal:3}}
function openTeacher(lesson){teacherTask=lesson?'lesson':explainableSource()?'source':'chat';teacherEpoch++;activeRequest?.abort();renderChat();showPage('teacher')}
function teacherProfilePreview(t){
 return `<details id="teacherPersonality" class="teacher-personality"><summary>Karakteri tanı</summary><p class="teacher-role">${esc(t.role)}</p><p>${esc(t.description)}</p><h3>Nasıl anlatır</h3><ol id="teacherMethod">${t.teachingMethod.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><div id="teacherStyleSamples"><h3>Hazır konuşma örnekleri</h3>${t.sampleDialogue.map(pair=>`<article class="teacher-style-sample"><p class="sample-student">Öğrenci: ${esc(pair.student)}</p><p class="sample-teacher">${esc(t.name)}: ${esc(pair.teacher)}</p></article>`).join('')}</div><details id="teacherDialoguePool" class="teacher-dialogue-pool"><summary>Diyalog havuzu · <span id="dialoguePoolCount">${getTeacherDialogues(t.id).length}</span> durum</summary><p class="dialogue-disclosure">Hazır karakter örnekleri; canlı AI yanıtı değildir.</p><div class="dialogue-filters"><label for="dialogueCategory">Başlık<select id="dialogueCategory" class="field"><option value="">Tüm durumlar</option>${Object.entries(DIALOGUE_CATEGORIES).map(([id,title])=>`<option value="${esc(id)}" ${id===dialogueCategory?'selected':''}>${esc(title)}</option>`).join('')}</select></label><label for="dialogueScenario">Durum<select id="dialogueScenario" class="field"></select></label></div><article id="dialogueSample" class="dialogue-pool-sample" aria-live="polite"></article><div class="dialogue-variant-controls"><span id="dialogueVariantPosition" role="status"></span><button id="nextDialogueVariant" type="button" class="smallbtn">Başka örnek</button></div></details></details>`;
}
function renderDialoguePool(){
 const rows=getTeacherDialogues(teacher().id,dialogueCategory?{category:dialogueCategory}:{});
 if(!rows.some(row=>row.id===dialogueScenarioId)){dialogueScenarioId=rows[0].id;dialogueVariant=0}
 $('dialogueScenario').replaceChildren(...rows.map(row=>{const option=document.createElement('option');option.value=row.id;option.textContent=row.title;return option}));
 $('dialogueScenario').value=dialogueScenarioId;
 renderDialogueExample();
}
function renderDialogueExample(){
 const variants=getTeacherDialogueVariants(teacher().id,dialogueScenarioId);dialogueVariant%=variants.length;
 const row=variants[dialogueVariant],student=document.createElement('p'),reply=document.createElement('p');
 student.className='sample-student';student.textContent='Öğrenci: '+row.student;
 reply.className='sample-teacher';reply.textContent=teacher().name+': '+row.teacher;
 $('dialogueSample').replaceChildren(student,reply);
 $('dialogueVariantPosition').textContent=(dialogueVariant+1)+' / '+variants.length;
 $('dialogueVariantPosition').hidden=variants.length<2;
 $('nextDialogueVariant').hidden=variants.length<2;
}
function renderTeachers(){
 activeRequest?.abort();const selected=teacher();$('teacherPicker').replaceChildren();
 for(const t of TEACHERS){const button=document.createElement('button');button.className='teacher-card';button.setAttribute('aria-pressed',String(t.id===selected.id));button.setAttribute('aria-label',t.name);button.innerHTML=`<span class="teacher-avatar" aria-hidden="true">${esc(t.avatar)}</span>${esc(t.name)}<small>${esc(t.tagline)}</small>`;button.onclick=()=>{activeRequest?.abort();state.teacherId=t.id;profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};changed(true);$('teacherDialog').close();renderTeachers();renderLearning()};$('teacherPicker').append(button)}
 $('selectedTeacherAvatar').textContent=selected.avatar;$('selectedTeacherName').textContent=selected.name;$('teacherDescription').textContent=selected.tagline;
 $('teacherOptions').innerHTML=teacherProfilePreview(selected)+(selected.id==='cagatay'?`<details class="teacher-consent"><summary>Konuşma tarzı</summary><label><input id="adultConfirmed" type="checkbox">18 yaş ve üzerindeyim.</label><label><input id="profanityConsent" type="checkbox">Küfürlü mizah istiyorum.</label><label for="profanityLevel">Argo düzeyi</label><select class="field" id="profanityLevel">${PROFANITY_LEVELS.map(level=>`<option value="${esc(level.id)}">${esc(level.name)}</option>`).join('')}</select></details>`:'');
 renderDialoguePool();
 $('dialogueCategory').onchange=event=>{dialogueCategory=event.target.value;dialogueVariant=0;renderDialoguePool()};
 $('dialogueScenario').onchange=event=>{dialogueScenarioId=event.target.value;dialogueVariant=0;renderDialogueExample()};
 $('nextDialogueVariant').onclick=()=>{dialogueVariant++;renderDialogueExample()};
 if(selected.id==='cagatay'){
  const update=()=>{profanity.adultConfirmed=$('adultConfirmed').checked;profanity.profanityConsent=$('profanityConsent').checked;$('profanityLevel').disabled=!(profanity.adultConfirmed&&profanity.profanityConsent);if($('profanityLevel').disabled){profanity.profanityLevel='off';$('profanityLevel').value='off'}};
  $('adultConfirmed').checked=profanity.adultConfirmed;$('profanityConsent').checked=profanity.profanityConsent;$('profanityLevel').value=profanity.profanityLevel;
  const reset=()=>{activeRequest?.abort();teacherEpoch++;renderChat()};$('adultConfirmed').onchange=()=>{update();reset()};$('profanityConsent').onchange=()=>{update();reset()};$('profanityLevel').onchange=event=>{profanity.profanityLevel=event.target.value;reset()};update();
 }
 teacherEpoch++;renderChat();
}
function bubble(who,text){const node=document.createElement('div');node.className='bubble '+who;node.textContent=text;$('chat').append(node);if(!$('teacher').classList.contains('hide'))node.scrollIntoView({block:'nearest'});return node}
function greetingVariant(){const key=chatKey(),id=teacher().id;if(!greetingChoices.has(key)){const next=greetingCounters.get(id)||0;greetingChoices.set(key,next);greetingCounters.set(id,next+1)}return greetingChoices.get(key)}
function renderChat(){
 const t=teacher(),q=explainableSource(),sourceOption=$('teacherTask').querySelector('[value=source]');
 sourceOption.hidden=!q;sourceOption.disabled=!q;if(teacherTask==='source'&&!q)teacherTask='chat';
 $('teacherTask').value=teacherTask;$('teachingLevel').value=teachingLevel;
 $('aiQuestion').textContent=teacherTask==='chat'?'Sohbet ve yazdığın sorular':teacherTask==='lesson'?course().title:q.topic;
 $('message').placeholder=teacherTask==='chat'?'Sorunu veya merak ettiğin konuyu yaz…':'Takıldığın adımı yaz…';
 $('chat').replaceChildren();bubble('ai',getTeacherLine(t.id,'greeting',greetingVariant(),profanity));
 for(const message of conversations.get(chatKey())||[])bubble(message.role==='user'?'me':'ai',message.content);
 $('send').disabled=false;
 const signedIn=!!window.MAAccount?.getUser()?.id;
 $('teacherSignIn').hidden=signedIn;
 $('aiStatus').textContent=signedIn?'':'Öğretmenler hazır. Mesajlaşmak için hesabına giriş yap.';
}
function tutorRequestMessages(history,user){
 const messages=[...history,user].slice(-11).map(message=>({role:message.role,content:message.role==='assistant'&&message.content.length>2500?message.content.slice(0,1700)+'\n[Önceki açıklamanın orta bölümü gönderim için kısaltıldı.]\n'+message.content.slice(-700):message.content}));
 while(new TextEncoder().encode(JSON.stringify(messages)).length>12000&&messages.length>1)messages.splice(0,2);
 return messages;
}
function setupAI(){
 $('teacherSignIn').onclick=()=>$('accountButton').click();
 const resetTask=()=>{activeRequest?.abort();teacherEpoch++;$('aiStatus').textContent='';renderChat()};
 $('teacherTask').onchange=event=>{const value=event.target.value;if(!['chat','lesson','source'].includes(value)||value==='source'&&!explainableSource())return;teacherTask=value;resetTask()};
 $('teachingLevel').onchange=event=>{const value=event.target.value;if(!['auto','beginner','intermediate','advanced'].includes(value))return;teachingLevel=value;resetTask()};
 $('tutorMode').onchange=resetTask;
 $('clearChat').onclick=()=>{activeRequest?.abort();conversations.delete(chatKey());greetingChoices.delete(chatKey());teacherEpoch++;renderChat()};
 $('send').onclick=async()=>{
  if($('send').disabled)return;const text=$('message').value.trim();if(!text)return;if(text.length>2500){$('aiStatus').textContent='Sorunu en fazla 2500 karakterle yaz.';return}
  if(!window.MAAccount?.getUser()?.id){$('aiStatus').textContent='Öğretmeninle konuşmak için hesabına giriş yap.';$('teacherSignIn').hidden=false;return}
  const context=teacherContext();const t=teacher(),epoch=teacherEpoch,conversationKey=chatKey(),history=conversations.get(conversationKey)||[],user={role:'user',content:text};
  bubble('me',text);$('message').value='';const waiting=bubble('ai',getTeacherLine(t.id,'waiting',history.filter(message=>message.role==='assistant').length,profanity));$('send').disabled=true;activeRequest=new AbortController();const controller=activeRequest;const timer=setTimeout(()=>controller.abort(),45000);
  try{
   const requestMessages=tutorRequestMessages(history,user);
   const r=await tutorClient.request({messages:requestMessages,...context,teacherId:t.id,helpMode:$('tutorMode').value,teachingLevel,progressContext:learningMomentum(),...profanity},{signal:controller.signal});
   const body=await r.json();if(!r.ok){const error=Error(body.error||'Sunucu yanıt vermedi');error.status=r.status;throw error}
   if(epoch!==teacherEpoch||conversationKey!==chatKey())return;
   const matchesContext=context.mode==='chat'?body.mode==='chat'&&body.isOfficialSolution===false&&body.questionId===undefined&&body.courseId===undefined&&body.source===undefined:context.mode==='source'?body.questionId===context.questionId:body.mode==='lesson'&&body.courseId===context.courseId;
   if(!matchesContext||body.isOfficialSolution===true)throw Error('Yanıt seçili sohbet veya ders bağlamıyla eşleşmiyor.');
   if(body.teacherId!==undefined&&body.teacherId!==t.id)throw Error('Yanıt seçili öğretmenle eşleşmiyor.');
   if(typeof body.answer!=='string'||!body.answer.trim()||body.answer.length>10000)throw Error('Öğretmen yanıtı geçerli bir metin içermiyor.');
   const answer=body.answer.trim();waiting.textContent=answer;$('aiStatus').textContent='';$('teacherSignIn').hidden=true;conversations.set(conversationKey,[...history,user,{role:'assistant',content:answer}].slice(-12));
  }catch(e){if(epoch===teacherEpoch&&conversationKey===chatKey()){
   waiting.textContent=controller.signal.aborted?'İstek durduruldu. Tekrar deneyebilirsin.':[401,403,429].includes(e.status)?e.message:'Bağlantı hatası: '+e.message;
   if(e.status===429)$('aiStatus').textContent='İstek sınırına ulaşıldı. Otomatik tekrar veya başka modele geçiş yapılmadı.';
   if(e.status===401){$('aiStatus').textContent='Hesabına yeniden giriş yaparak devam edebilirsin.';$('teacherSignIn').hidden=false}
   if(e.status===403)$('aiStatus').textContent='Hesabının öğretmen erişimi için yönetici onayı gerekiyor.';
   if(!controller.signal.aborted&&!$('message').value)$('message').value=text;
  }}
  finally{clearTimeout(timer);if(activeRequest===controller)activeRequest=null;if(epoch===teacherEpoch)$('send').disabled=false}
 };
}function showPage(page){
 document.querySelectorAll('.nav button').forEach(button=>button.classList.toggle('active',button.dataset.page===page));
 for(const id of ['study','teacher','library','mockexam']){const node=$(id);if(node)node.classList.toggle('hide',id!==page)}
 if(page==='library')renderLessons();
 window.scrollTo({top:0,behavior:'instant'});
}
document.querySelector('.nav').addEventListener('click',event=>{const button=event.target.closest('button[data-page]');if(button)showPage(button.dataset.page)});
$('accountButton').onclick=()=>{document.querySelector('[data-page=mockexam]')?.click();const panel=$('accountPanel');if(panel)panel.open=true};
document.querySelector('.brand').onclick=event=>{event.preventDefault();showPage('study')};
$('lessonSearch').oninput=renderLessons;$('teacherChange').onclick=()=>$('teacherDialog').showModal();$('closeTeacherDialog').onclick=()=>$('teacherDialog').close();$('closeSourceInfo').onclick=()=>$('sourceInfo').close();
state=loadLocal();renderLearning();setupAI();renderTeachers();renderLessons();
window.addEventListener('ma-account-changed',changeAccount);changeAccount();

window.addEventListener('ma-personal-archive-open',()=>{practiceExams.close();bankPool='original';bankScope='all';renderLearning();showPage('study')});
window.addEventListener('ma-personal-archive-unlocked',()=>{if(bankPool==='original')renderLearning()});
window.addEventListener('ma-personal-archive-changed',()=>{if(bankPool==='original'){const badge=$('learningRoot').querySelector('.count-badge');if(badge)badge.textContent=personalArchive.isUnlocked()?personalArchive.getCount().toLocaleString('tr-TR')+' kayıt':'Hesap erişimi'}});
