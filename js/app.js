import {COURSES, getCourse, buildStudyPlan} from '../shared/curriculum.js';
import {TEACHERS, DEFAULT_TEACHER_ID, PROFANITY_LEVELS} from '../shared/teachers.js';
import {normalizeState, mergeLearningStates, progressFromAttempts} from '../shared/learning-state.js';
import {QUESTION_BANK} from '../data/question-bank.js?v=empty-bank-20261110';
import {createQuestionRegistry} from '../shared/question-bank.js';
const bankRegistry=createQuestionRegistry(QUESTION_BANK);
import {createExamMode} from './exam-mode.js';
import {captureLearningSnapshot} from '../shared/learning-migration.js';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let owner=null, scope='guest', state, revision=0, remoteChain=Promise.resolve(), saveTimer;
let tutorLesson=false,bankScope='all';let selectedQuestionId=null, answeredQuestionId=null, bankDifficulty='', teacherEpoch=0, activeRequest=null, conversations=new Map();
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
  $('message').value='';conversations=new Map();profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};selectedQuestionId=null;answeredQuestionId=null;
  renderLearning();renderTeachers();renderLessons();if(owner)await syncProfile(false);
}
const eligibleQuestions=()=>bankRegistry.getQuestions({...(bankScope==='course'?{courseId:course().id}:{}),...(bankDifficulty?{difficulty:bankDifficulty}:{})}).sort((a,b)=>Number(b.courseId===course().id)-Number(a.courseId===course().id));
const activeQuestion=()=>bankRegistry.getQuestion(selectedQuestionId);
const chatKey=()=>teacher().id+':'+(tutorLesson||!activeQuestion()?'lesson:'+course().id:selectedQuestionId);
function verifiedProgress(){const valid=new Set(bankRegistry.getQuestions({}).map(q=>q.id));return progressFromAttempts({...state,attempts:state.attempts.filter(a=>valid.has(a.exerciseId))})}

let lessonGroup='Tümü',examMode=null;
const shortGreeting={
 cagatay:'Hadi bakalım, şu karışık adımları birlikte toparlayalım.',
 beyza:'Sağlam bir çözümün temellerini birlikte atalım.',
 zeynep:'Canım, takıldığın adımı birlikte çözelim.',
 kemal:'Tanımı ve gerekçeyi adım adım inceleyelim.',
 mert:'Hazırız! Küçük bir adım, güçlü bir başlangıç.',
 elif:'Acele etmeyelim. Birlikte, küçük adımlarla ilerleyebiliriz.'
};
function renderLearning(){
 if(bankScope==='course'&&!bankRegistry.getQuestions({courseId:course().id}).length)bankScope='all';
 const questions=eligibleQuestions();
 if(!questions.some(q=>q.id===selectedQuestionId))selectedQuestionId=questions[0]?.id||null;
 const momentum=learningMomentum(),t=teacher();
 $('learningRoot').innerHTML=`<div class="page-heading"><h1>Soru çöz</h1><span class="count-badge">${bankRegistry.questions.length} soru</span></div><div class="practice-toolbar"><button id="browseCourses" class="topic-button"><span>${bankScope==='all'?'Tüm konular':esc(course().title)}</span><span aria-hidden="true">⌄</span></button><button id="allQuestions" class="text-button" ${bankScope==='all'?'hidden':''}>Tüm sorular</button><button id="examModeButton" class="smallbtn">Sınav Modu</button></div><div class="practice-layout"><div id="sourceQuestion" class="surface question-panel"></div><aside class="practice-aside"><div class="surface mentor-card"><span class="avatar" aria-hidden="true">${esc(t.avatar)}</span><h2>${esc(t.name)}</h2><p>${esc(t.tagline)}</p><button class="smallbtn" id="askLessonTeacher">Öğretmenime sor</button></div><div class="surface today-card"><p class="eyebrow">BUGÜN</p><div class="today-value"><span id="practiceToday">${momentum.practiceToday}</span><small>soru</small></div><button id="viewProgress" class="text-button">İlerlemeni gör →</button></div></aside></div>`;
 $('browseCourses').onclick=openCatalog;$('examModeButton').onclick=()=>examMode.open();
 $('allQuestions').onclick=()=>{bankScope='all';bankDifficulty='';selectedQuestionId=null;answeredQuestionId=null;renderLearning();renderChat()};
 $('askLessonTeacher').onclick=()=>openTeacher(true);
 $('viewProgress').onclick=()=>document.querySelector('[data-page=mockexam]')?.click();
 renderSourceQuestion();
}
function selectCourse(id){
 if(!getCourse(id))return;
 activeRequest?.abort();teacherEpoch++;$('message').value='';state.courseId=id;selectedQuestionId=null;answeredQuestionId=null;tutorLesson=false;bankDifficulty='';changed(true);
 const available=bankRegistry.getQuestions({courseId:id}).length;
 bankScope=available?'course':'all';renderLearning();renderTeachers();renderLessons();
 showPage(available?'study':'library');
 if(!available)showLesson(id);
}
function renderSourceQuestion(){
 const node=$('sourceQuestion'),q=activeQuestion(),questions=eligibleQuestions();
 if(!q){
  node.innerHTML=bankRegistry.questions.length
   ? '<div class="empty-state" role="status"><h2>Bu konuda soru yok</h2></div>'
   : '<div id="questionBankEmpty" class="empty-state" role="status"><h2>Henüz soru yok</h2></div>';
  return;
 }
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
  const all=document.createElement('button');all.textContent='Tüm konular';all.onclick=()=>{dialog.close();bankScope='all';bankDifficulty='';selectedQuestionId=null;answeredQuestionId=null;renderLearning();renderTeachers();showPage('study')};if(!query)list.append(all);
  for(const c of COURSES.filter(c=>(c.title+' '+c.group).toLocaleLowerCase('tr-TR').includes(query))){const button=document.createElement('button');button.textContent=c.title;const note=document.createElement('small'),count=bankRegistry.getQuestions({courseId:c.id}).length;note.textContent=count?count+' soru':'Konu anlatımı';button.append(note);button.onclick=()=>{dialog.close();selectCourse(c.id)};list.append(button)}
 };
 $('closeCatalog').onclick=()=>dialog.close();$('courseSearch').oninput=render;render();dialog.showModal();
}
function renderLessons(){
 const target=$('lessonList'),query=$('lessonSearch').value.toLocaleLowerCase('tr-TR');$('lessonCount').textContent=COURSES.length+' konu';target.replaceChildren();
 for(const c of COURSES.filter(c=>(lessonGroup==='Tümü'||c.group===lessonGroup)&&c.title.toLocaleLowerCase('tr-TR').includes(query))){const button=document.createElement('button');button.className='lesson-tile';const group=document.createElement('small');group.textContent=c.group;const title=document.createElement('strong');title.textContent=c.title;const note=document.createElement('span'),count=bankRegistry.getQuestions({courseId:c.id}).length;note.textContent=count?count+' soru · Konu anlatımı':'Konu anlatımı';button.append(group,title,note);button.onclick=()=>showLesson(c.id);target.append(button)}
 const groups=$('lessonGroups');groups.replaceChildren();for(const label of ['Tümü',...new Set(COURSES.map(c=>c.group))]){const button=document.createElement('button');button.textContent=label;button.className=label===lessonGroup?'active':'';button.onclick=()=>{lessonGroup=label;renderLessons()};groups.append(button)}
}
function showLesson(id){
 const c=getCourse(id);if(!c)return;
 const panel=$('lessonDetails'),count=bankRegistry.getQuestions({courseId:id}).length;panel.classList.remove('hide');
 panel.innerHTML=`<div class="dialog-heading"><h2>${esc(c.title)}</h2><button id="closeLesson" class="icon-button" aria-label="Anlatımı kapat">×</button></div><ol>${c.lessonSteps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><div class="lesson-actions">${count?'<button id="lessonPractice" class="btn">Soruları çöz</button>':''}<button id="lessonAskTeacher" class="smallbtn">Öğretmenime sor</button></div>`;
 $('closeLesson').onclick=()=>panel.classList.add('hide');
 if(count)$('lessonPractice').onclick=()=>selectCourse(id);
 $('lessonAskTeacher').onclick=()=>{selectCourse(id);openTeacher(true)};panel.scrollIntoView({block:'start',behavior:'smooth'});
}
function learningMomentum(){const attempts=state.attempts.filter(a=>bankRegistry.getQuestion(a.exerciseId)),day=new Date().toLocaleDateString();let consecutiveCorrect=0;for(let i=attempts.length-1;i>=0&&attempts[i].correct;i--)consecutiveCorrect++;return {consecutiveCorrect,practiceToday:attempts.filter(a=>new Date(a.at).toLocaleDateString()===day).length,dailyGoal:3}}
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
function renderChat(){const t=teacher(),q=tutorLesson?null:activeQuestion();$('aiQuestion').textContent=q?q.topic:course().title;$('chat').replaceChildren();bubble('ai',shortGreeting[t.id]);for(const message of conversations.get(chatKey())||[])bubble(message.role==='user'?'me':'ai',message.content);$('send').disabled=false}
function setupAI(){
 try{$('endpoint').value=localStorage.getItem('math_ai_worker_url')||'';$('access').value=sessionStorage.getItem('math_ai_access')||''}catch{}
 $('saveAI').onclick=()=>{try{const u=new URL($('endpoint').value.trim());if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('HTTPS Worker adresi gir.');localStorage.setItem('math_ai_worker_url',u.origin);sessionStorage.setItem('math_ai_access',$('access').value);$('aiStatus').textContent='Bağlantı ayarları kaydedildi.'}catch(e){$('aiStatus').textContent=e.message}};
 $('clearChat').onclick=()=>{activeRequest?.abort();conversations.delete(chatKey());teacherEpoch++;renderChat()};
 $('send').onclick=async()=>{
  if($('send').disabled)return;const text=$('message').value.trim();if(!text)return;if(text.length>2500){$('aiStatus').textContent='Sorunu en fazla 2500 karakterle yaz.';return}
  let base,token;try{base=localStorage.getItem('math_ai_worker_url');token=sessionStorage.getItem('math_ai_access')}catch{}
  if(!base||!token){$('aiStatus').textContent='Öğretmen bağlantısı için aşağıdaki ayarları tamamla.';return}
  const context=!tutorLesson&&activeQuestion()?{questionId:activeQuestion().id}:{mode:'lesson',courseId:course().id};const t=teacher(),epoch=teacherEpoch,history=conversations.get(chatKey())||[],user={role:'user',content:text};
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
 examMode?.close(false);
 document.querySelectorAll('.nav button').forEach(button=>button.classList.toggle('active',button.dataset.page===page));
 for(const id of ['study','teacher','library','mockexam']){const node=$(id);if(node)node.classList.toggle('hide',id!==page)}
 if(page==='library')renderLessons();
 window.scrollTo({top:0,behavior:'instant'});
}
document.querySelector('.nav').addEventListener('click',event=>{const button=event.target.closest('button[data-page]');if(button)showPage(button.dataset.page)});
$('accountButton').onclick=()=>{document.querySelector('[data-page=mockexam]')?.click();const panel=$('accountPanel');if(panel)panel.open=true};
document.querySelector('.brand').onclick=event=>{event.preventDefault();showPage('study')};
$('lessonSearch').oninput=renderLessons;$('teacherChange').onclick=()=>$('teacherDialog').showModal();$('closeTeacherDialog').onclick=()=>$('teacherDialog').close();$('closeSourceInfo').onclick=()=>$('sourceInfo').close();
examMode=createExamMode({onEnter:()=>{for(const id of ['study','teacher','library','mockexam'])$(id)?.classList.add('hide');document.querySelectorAll('.nav button').forEach(button=>button.classList.toggle('active',button.dataset.page==='study'))},onClose:()=>showPage('study')});
state=loadLocal();renderLearning();setupAI();renderTeachers();renderLessons();
window.addEventListener('ma-account-changed',changeAccount);changeAccount();
