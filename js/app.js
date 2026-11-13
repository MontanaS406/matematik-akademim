import {COURSES, getCourse, buildStudyPlan} from '../shared/curriculum.js';
import {TEACHERS, DEFAULT_TEACHER_ID, PROFANITY_LEVELS} from '../shared/teachers.js';
import {normalizeState, mergeLearningStates, progressFromAttempts} from '../shared/learning-state.js';
import {QUESTION_BANK} from '../data/question-bank.js?v=ai-bank-20261112';
import {createQuestionRegistry} from '../shared/question-bank.js';
import {AI_BANK, ORIGINAL_INDEX_SUMMARY} from '../data/ai-bank.js?v=ai-bank-20261112';
import {createAiRegistry} from '../shared/ai-bank.js';
const aiRegistry=createAiRegistry(AI_BANK);
const bankRegistry=createQuestionRegistry(QUESTION_BANK);
import {captureLearningSnapshot} from '../shared/learning-migration.js';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let owner=null, scope='guest', state, revision=0, remoteChain=Promise.resolve(), saveTimer;
let tutorLesson=false,bankScope='all',bankPool='ai',bankExam='',bankSubtopic='',aiPool='';
let selectedQuestionId=null, answeredQuestionId=null, bankDifficulty='', teacherEpoch=0, activeRequest=null, conversations=new Map(),questionResponses=new Map();
let profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};
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
      const remote=await account.loadLearning();if(current!==scope)return;if(remote){if(!captureLearningSnapshot(localStorage,scope,remote,'remote'))throw Error('Önceki bulut kaydı yedeklenemedi');const before=[state.courseId,state.difficulty].join(':'),beforeTeacher=state.teacherId;state=mergeLearningStates(state,remote);if(before!==[state.courseId,state.difficulty].join(':')){selectedQuestionId=null;answeredQuestionId=null}if(generation!==revision)status('Yeni yerel değişiklikler korunarak birleştirildi.');saveLocal();window.dispatchEvent(new CustomEvent('ma-learning-changed'));renderLearning();if(beforeTeacher!==state.teacherId){profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};renderTeachers()}}if(!write){status('Öğrenme kaydın hazır.');return}
      const snapshot=normalizeState(state);await account.saveLearning(snapshot);
      if(current===scope)status('Öğretmen tercihin ve ilerlemen hesabına kaydedildi.');
    }catch{if(current===scope)status('Bulut öğrenme kaydı eşitlenemedi. Yerel kayıt korunuyor; yeniden eşitleyebilirsin.')}
  });return remoteChain;
}
async function changeAccount(){
  const next=window.MAAccount?.getUser()?.id||null;if(next===owner&&state)return;
  activeRequest?.abort();owner=next;scope=owner||'guest';revision++;clearTimeout(saveTimer);state=loadLocal();
  $('message').value='';conversations=new Map();questionResponses=new Map();profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};selectedQuestionId=null;answeredQuestionId=null;
  renderLearning();renderTeachers();renderLessons();if(owner)await syncProfile(false);
}
const isAiQuestion=q=>q?.origin==='AI_URETIMI';
const practiceQuestions=Object.freeze([...bankRegistry.questions,...aiRegistry.questions]);
const allPracticeQuestions=()=>practiceQuestions;
const registeredQuestion=id=>aiRegistry.getQuestion(id)||bankRegistry.getQuestion(id);
const poolQuestions=(filters={})=>bankPool==='ai'?aiRegistry.getQuestions({...filters,...(bankExam?{examType:bankExam}:{}),...(aiPool?{pool:aiPool}:{})}):bankPool==='original'?bankRegistry.getQuestions(filters):[];
const eligibleQuestions=()=>[...poolQuestions({...(bankScope==='course'?{courseId:course().id}:{}),...(bankDifficulty?{difficulty:bankDifficulty}:{}),...(bankSubtopic?{subtopic:bankSubtopic}:{})})].sort((a,b)=>Number(b.courseId===course().id)-Number(a.courseId===course().id));
const activeQuestion=()=>bankPool==='ai'?aiRegistry.getQuestion(selectedQuestionId):bankPool==='original'?bankRegistry.getQuestion(selectedQuestionId):null;
const chatKey=()=>teacher().id+':'+(tutorLesson||!activeQuestion()||isAiQuestion(activeQuestion())?'lesson:'+course().id:selectedQuestionId);
function verifiedProgress(){const valid=new Set(allPracticeQuestions().map(q=>q.id));return progressFromAttempts({...state,attempts:state.attempts.filter(a=>valid.has(a.exerciseId))})}
function resetPractice(){activeRequest?.abort();teacherEpoch++;$('message').value='';selectedQuestionId=null;answeredQuestionId=null;renderLearning();renderChat()}
const difficultyName=value=>({easy:'Kolay',medium:'Orta',hard:'Zor'}[value]||'Seviyesi belirtilmemiş');

let lessonGroup='Tümü';
const shortGreeting={
 cagatay:'Hadi bakalım, şu karışık adımları birlikte toparlayalım.',
 beyza:'Sağlam bir çözümün temellerini birlikte atalım.',
 zeynep:'Canım, takıldığın adımı birlikte çözelim.',
 kemal:'Tanımı ve gerekçeyi adım adım inceleyelim.',
 mert:'Hazırız! Küçük bir adım, güçlü bir başlangıç.',
 elif:'Acele etmeyelim. Birlikte, küçük adımlarla ilerleyebiliriz.'
};
function renderLearning(){
 const questions=eligibleQuestions();
 if(!questions.some(q=>q.id===selectedQuestionId))selectedQuestionId=questions[0]?.id||null;
 const momentum=learningMomentum(),t=teacher(),subtopics=[...new Set(poolQuestions(bankScope==='course'?{courseId:course().id}:{}).map(q=>q.subtopic).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
 $('learningRoot').innerHTML=`<div class="page-heading"><h1>Soru çöz</h1><span class="count-badge">${questions.length} soru</span></div><div class="practice-filters"><label>Havuz<select id="bankPool" class="field"><option value="ai">AI alıştırmaları</option><option value="original">Orijinal sorular</option><option value="osym">ÖSYM denemeleri</option></select></label><label>Sınav<select id="bankExam" class="field" ${bankPool!=='ai'?'disabled':''}><option value="">TYT ve AYT</option><option value="TYT">TYT</option><option value="AYT">AYT</option></select></label><div class="topic-filter"><span>Konu</span><button id="browseCourses" class="topic-button"><span>${bankScope==='all'?'Tüm konular':esc(course().title)}</span><span aria-hidden="true">⌄</span></button></div><label>Seviye<select id="bankDifficulty" class="field" ${bankPool==='osym'?'disabled':''}><option value="">Tüm seviyeler</option><option value="easy">Kolay</option><option value="medium">Orta</option><option value="hard">Zor</option></select></label></div><details class="extra-practice-filters" ${bankPool!=='ai'?'hidden':''}><summary>Diğer filtreler</summary><div class="practice-filter-details"><label>Alt konu<select id="bankSubtopic" class="field"><option value="">Tüm alt konular</option>${subtopics.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label><label>AI havuzu<select id="aiPool" class="field"><option value="">Tüm AI alıştırmaları</option><option value="imported">Arşivden aktarılan</option><option value="generated">Yeni üretilen</option></select></label></div></details><div class="practice-layout"><div id="sourceQuestion" class="surface question-panel"></div><aside class="practice-aside"><div class="surface mentor-card"><span class="avatar" aria-hidden="true">${esc(t.avatar)}</span><h2>${esc(t.name)}</h2><p>${esc(t.tagline)}</p><button class="smallbtn" id="askLessonTeacher">Öğretmenime sor</button></div><div class="surface today-card"><p class="eyebrow">BUGÜN</p><div class="today-value"><span id="practiceToday">${momentum.practiceToday}</span><small>soru</small></div><button id="viewProgress" class="text-button">İlerlemeni gör →</button></div></aside></div>`;
 for(const [id,value] of [['bankPool',bankPool],['bankExam',bankExam],['bankDifficulty',bankDifficulty],['bankSubtopic',bankSubtopic],['aiPool',aiPool]])$(id).value=value;
 $('bankPool').onchange=event=>{bankPool=event.target.value;bankScope='all';bankDifficulty='';bankSubtopic='';resetPractice()};
 $('bankExam').onchange=event=>{bankExam=event.target.value;bankSubtopic='';resetPractice()};
 $('bankDifficulty').onchange=event=>{bankDifficulty=event.target.value;resetPractice()};
 $('bankSubtopic').onchange=event=>{bankSubtopic=event.target.value;resetPractice()};
 $('aiPool').onchange=event=>{aiPool=event.target.value;bankSubtopic='';resetPractice()};
 $('browseCourses').onclick=openCatalog;
 $('askLessonTeacher').onclick=()=>{const q=activeQuestion();if(isAiQuestion(q)&&state.courseId!==q.courseId){state.courseId=q.courseId;changed(true)}openTeacher(true)};
 $('viewProgress').onclick=()=>document.querySelector('[data-page=mockexam]')?.click();
 renderSourceQuestion();
}
function selectCourse(id){
 if(!getCourse(id))return;
 activeRequest?.abort();teacherEpoch++;$('message').value='';state.courseId=id;selectedQuestionId=null;answeredQuestionId=null;tutorLesson=false;bankSubtopic='';changed(true);
 const available=poolQuestions({courseId:id}).length;
 bankScope='course';renderLearning();renderTeachers();renderLessons();
 showPage(available?'study':'library');
 if(!available)showLesson(id);
}
function renderSourceQuestion(){
 const node=$('sourceQuestion'),q=activeQuestion(),questions=eligibleQuestions();
 if(!q){
  node.innerHTML=bankPool==='ai'
   ? '<div id="questionBankEmpty" class="empty-state" role="status"><h2>Bu filtrelerde soru yok</h2><p>Başka bir konu veya seviye seçebilirsin. İnceleme bekleyen sorular çözüm havuzuna alınmaz.</p><button id="clearPracticeFilters" class="smallbtn">Filtreleri temizle</button></div>'
   : `<div id="questionBankEmpty" class="empty-state" role="status"><h2>Henüz soru yok</h2><p>${bankPool==='original'?`Arşivde ${Number(ORIGINAL_INDEX_SUMMARY.sourceCount)||0} kaynak için yalnızca dizin bilgisi var; soru içerikleri bu havuza aktarılmadı.`:'Bu bölümde henüz çözülebilir resmî sınav sorusu yok. AI alıştırmaları burada gösterilmez.'}</p></div>`;
  if($('clearPracticeFilters'))$('clearPracticeFilters').onclick=()=>{bankScope='all';bankExam='';bankDifficulty='';bankSubtopic='';aiPool='';resetPractice()};
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
 $('originalPrompt').textContent=q.prompt;node.querySelector('.question-id').textContent='Soru kimliği: '+q.id;
 for(const option of q.options){const button=document.createElement('button');button.dataset.option=option.id;button.textContent=option.id+') '+option.text;button.setAttribute('aria-pressed',String(response?.choice===option.id));button.onclick=()=>{questionResponses.set(q.id,{choice:option.id,checked:false});for(const item of $('sourceAnswerArea').children)item.setAttribute('aria-pressed',String(item===button));$('checkSourceAnswer').disabled=false};$('sourceAnswerArea').append(button)}
 $('checkSourceAnswer').disabled=!response?.choice;
 $('checkSourceAnswer').onclick=()=>{const chosen=questionResponses.get(q.id);if(!chosen?.choice||chosen.checked)return;questionResponses.set(q.id,{...chosen,checked:true});answerSource(chosen.choice);showAiAnswer(q)};
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
 $('sourceFeedback').textContent=(correct?'✓ Doğru. '+teacher().correctResponse:'Cevabın '+response.choice+'. Doğru cevap: '+q.answer.value+(option?' · '+option.text:'')+'. '+teacher().incorrectResponse);
 const solution=$('aiSolution');solution.hidden=false;const heading=document.createElement('h3');heading.textContent='Adım adım çözüm';const list=document.createElement('ol');for(const step of q.solutionSteps?.length?q.solutionSteps:[q.answer.solution]){if(!step)continue;const item=document.createElement('li');item.textContent=step;list.append(item)}solution.replaceChildren(heading,list);
}
const comparable=value=>String(value).trim().replace(/\s+/g,'').replace(/−/g,'-');
function disableSourceAnswer(){$('sourceAnswerArea').querySelectorAll('button,input').forEach(node=>node.disabled=true)}
function answerSource(value){
 const q=activeQuestion();if(!q||answeredQuestionId===q.id||!String(value).trim())return;
 const correct=comparable(value)===comparable(q.answer.value);answeredQuestionId=q.id;disableSourceAnswer();
 $('sourceFeedback').textContent=correct?'✓ '+q.answer.value+' · '+teacher().correctResponse:'Cevap: '+q.answer.value;
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
 if(count)$('lessonPractice').onclick=()=>{bankPool=aiRegistry.getQuestions({courseId:id}).length?'ai':'original';bankExam='';bankDifficulty='';aiPool='';selectCourse(id)};
 $('lessonAskTeacher').onclick=()=>{selectCourse(id);openTeacher(true)};panel.scrollIntoView({block:'start',behavior:'smooth'});
}
function learningMomentum(){const attempts=state.attempts.filter(a=>registeredQuestion(a.exerciseId)),day=new Date().toLocaleDateString();let consecutiveCorrect=0;for(let i=attempts.length-1;i>=0&&attempts[i].correct;i--)consecutiveCorrect++;return {consecutiveCorrect,practiceToday:attempts.filter(a=>new Date(a.at).toLocaleDateString()===day).length,dailyGoal:3}}
function openTeacher(lesson){tutorLesson=lesson;teacherEpoch++;activeRequest?.abort();renderChat();showPage('teacher')}
function renderTeachers(){
 activeRequest?.abort();const selected=teacher();$('teacherPicker').replaceChildren();
 for(const t of TEACHERS){const button=document.createElement('button');button.className='teacher-card';button.setAttribute('aria-pressed',String(t.id===selected.id));button.setAttribute('aria-label',t.name);button.innerHTML=`<span class="teacher-avatar" aria-hidden="true">${esc(t.avatar)}</span>${esc(t.name)}<small>${esc(t.tagline)}</small>`;button.onclick=()=>{activeRequest?.abort();state.teacherId=t.id;profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};changed(true);$('teacherDialog').close();renderTeachers();renderLearning()};$('teacherPicker').append(button)}
 $('selectedTeacherAvatar').textContent=selected.avatar;$('selectedTeacherName').textContent=selected.name;$('teacherDescription').textContent=selected.tagline;
 $('teacherOptions').innerHTML=selected.id==='cagatay'?`<details class="teacher-consent"><summary>Konuşma tarzı</summary><label><input id="adultConfirmed" type="checkbox">18 yaş ve üzerindeyim.</label><label><input id="profanityConsent" type="checkbox">Küfürlü mizah istiyorum.</label><label for="profanityLevel">Argo düzeyi</label><select class="field" id="profanityLevel">${PROFANITY_LEVELS.map(level=>`<option value="${esc(level.id)}">${esc(level.name)}</option>`).join('')}</select></details>`:'';
 if(selected.id==='cagatay'){
  const update=()=>{profanity.adultConfirmed=$('adultConfirmed').checked;profanity.profanityConsent=$('profanityConsent').checked;$('profanityLevel').disabled=!(profanity.adultConfirmed&&profanity.profanityConsent);if($('profanityLevel').disabled){profanity.profanityLevel='off';$('profanityLevel').value='off'}};
  $('adultConfirmed').checked=profanity.adultConfirmed;$('profanityConsent').checked=profanity.profanityConsent;$('profanityLevel').value=profanity.profanityLevel;
  const reset=()=>{activeRequest?.abort();teacherEpoch++;renderChat()};$('adultConfirmed').onchange=()=>{update();reset()};$('profanityConsent').onchange=()=>{update();reset()};$('profanityLevel').onchange=event=>{profanity.profanityLevel=event.target.value;reset()};update();
 }
 teacherEpoch++;renderChat();
}
function bubble(who,text){const node=document.createElement('div');node.className='bubble '+who;node.textContent=text;$('chat').append(node);if(!$('teacher').classList.contains('hide'))node.scrollIntoView({block:'nearest'});return node}
function renderChat(){const t=teacher(),q=tutorLesson||isAiQuestion(activeQuestion())?null:activeQuestion();$('aiQuestion').textContent=q?q.topic:course().title;$('chat').replaceChildren();bubble('ai',shortGreeting[t.id]);for(const message of conversations.get(chatKey())||[])bubble(message.role==='user'?'me':'ai',message.content);$('send').disabled=false}
function setupAI(){
 try{$('endpoint').value=localStorage.getItem('math_ai_worker_url')||'';$('access').value=sessionStorage.getItem('math_ai_access')||''}catch{}
 $('saveAI').onclick=()=>{try{const u=new URL($('endpoint').value.trim());if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('HTTPS Worker adresi gir.');localStorage.setItem('math_ai_worker_url',u.origin);sessionStorage.setItem('math_ai_access',$('access').value);$('aiStatus').textContent='Bağlantı ayarları kaydedildi.'}catch(e){$('aiStatus').textContent=e.message}};
 $('clearChat').onclick=()=>{activeRequest?.abort();conversations.delete(chatKey());teacherEpoch++;renderChat()};
 $('send').onclick=async()=>{
  if($('send').disabled)return;const text=$('message').value.trim();if(!text)return;if(text.length>2500){$('aiStatus').textContent='Sorunu en fazla 2500 karakterle yaz.';return}
  let base,token;try{base=localStorage.getItem('math_ai_worker_url');token=sessionStorage.getItem('math_ai_access')}catch{}
  if(!base||!token){$('aiStatus').textContent='Öğretmen bağlantısı için aşağıdaki ayarları tamamla.';return}
  const context=!tutorLesson&&activeQuestion()&&!isAiQuestion(activeQuestion())?{questionId:activeQuestion().id}:{mode:'lesson',courseId:course().id};const t=teacher(),epoch=teacherEpoch,history=conversations.get(chatKey())||[],user={role:'user',content:text};
  bubble('me',text);$('message').value='';const waiting=bubble('ai','Düşünüyorum…');$('send').disabled=true;activeRequest=new AbortController();const controller=activeRequest;const timer=setTimeout(()=>controller.abort(),45000);
  try{
   const requestMessages=[...history,user].slice(-11);while(new TextEncoder().encode(JSON.stringify(requestMessages)).length>12000&&requestMessages.length>1)requestMessages.splice(0,2);
   const r=await fetch(base+'/api/tutor',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({messages:requestMessages,...context,teacherId:t.id,helpMode:$('tutorMode').value,progressContext:learningMomentum(),...profanity})});
   const body=await r.json();if(!r.ok)throw Error(body.error||'Sunucu yanıt vermedi');if(epoch!==teacherEpoch)return;if((context.questionId?body.questionId!==context.questionId:body.mode!=='lesson'||body.courseId!==context.courseId)||body.isOfficialSolution===true)throw Error('Yanıt seçili kaynak sorusuyla eşleşmiyor.');
   const answer=String(body.answer||'Yanıt alınamadı');waiting.textContent=answer;conversations.set(chatKey(),[...history,user,{role:'assistant',content:answer.slice(0,2500)}].slice(-12));
  }catch(e){if(epoch===teacherEpoch)waiting.textContent=controller.signal.aborted?'İstek durduruldu. Tekrar deneyebilirsin.':'Bağlantı hatası: '+e.message}
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
