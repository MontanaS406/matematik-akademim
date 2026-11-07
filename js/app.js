import {COURSES, getCourse, buildStudyPlan} from '../shared/curriculum.js';
import {TEACHERS, DEFAULT_TEACHER_ID, PROFANITY_LEVELS} from '../shared/teachers.js';
import {normalizeState, mergeLearningStates, progressFromAttempts} from '../shared/learning-state.js';
import {QUESTION_BANK} from '../data/question-bank.js';
import {TURKISH_EXAMS} from '../data/turkish-exams.js';
import {createQuestionRegistry} from '../shared/question-bank.js';
const bankRegistry=createQuestionRegistry(QUESTION_BANK);
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
function status(message){const node=$('profileStatus');if(node)node.textContent=message}
function saveLocal(){try{if(!captureLearningSnapshot(localStorage,scope,localStorage.getItem(key())))throw Error('Önceki kayıt yedeklenemedi');localStorage.setItem(key(),JSON.stringify(state));return true}catch{status('İlerleme bu tarayıcıya kaydedilemedi. Depolama izinlerini kontrol et.');return false}}
function changed(preferences=false){revision++;if(preferences)state.preferencesAt=new Date().toISOString();saveLocal();clearTimeout(saveTimer);if(owner)saveTimer=setTimeout(()=>syncProfile(),700)}
async function syncProfile(write=true){
  const account=window.MAAccount;const current=scope;const generation=revision;
  if(!owner||!account){status('İlerlemen bu tarayıcıda. Hesabına girerek buluta kaydedebilirsin.');return}
  status('Öğrenme kaydı eşitleniyor…');
  remoteChain=remoteChain.catch(()=>{}).then(async()=>{
    if(current!==scope)return;
    try{
      const remote=await account.loadLearning();if(current!==scope)return;if(remote){if(!captureLearningSnapshot(localStorage,scope,remote,'remote'))throw Error('Önceki bulut kaydı yedeklenemedi');const before=[state.courseId,state.difficulty].join(':'),beforeTeacher=state.teacherId;state=mergeLearningStates(state,remote);if(before!==[state.courseId,state.difficulty].join(':')){selectedQuestionId=null;answeredQuestionId=null}if(generation!==revision)status('Yeni yerel değişiklikler korunarak birleştirildi.');saveLocal();renderLearning();if(beforeTeacher!==state.teacherId){profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};renderTeachers()}}if(!write){status('Hesabına özel öğrenme kaydı yüklendi.');return}
      const snapshot=normalizeState(state);await account.saveLearning(snapshot);
      if(current===scope)status('Öğretmen tercihin ve ilerlemen hesabına kaydedildi.');
    }catch{if(current===scope)status('Bulut öğrenme kaydı eşitlenemedi. Yerel kayıt korunuyor; yeniden eşitleyebilirsin.')}
  });return remoteChain;
}
async function changeAccount(){
  const next=window.MAAccount?.getUser()?.id||null;if(next===owner&&state)return;
  activeRequest?.abort();owner=next;scope=owner||'guest';revision++;clearTimeout(saveTimer);state=loadLocal();
  $('message').value='';conversations=new Map();profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};selectedQuestionId=null;answeredQuestionId=null;
  renderLearning();renderTeachers();if(owner)await syncProfile(false);
}
const eligibleQuestions=()=>bankRegistry.getQuestions({...(bankScope==='course'?{courseId:course().id}:{}),...(bankDifficulty?{difficulty:bankDifficulty}:{})}).sort((a,b)=>Number(b.courseId===course().id)-Number(a.courseId===course().id));
const activeQuestion=()=>bankRegistry.getQuestion(selectedQuestionId);
const chatKey=()=>teacher().id+':'+(tutorLesson||!activeQuestion()?'lesson:'+course().id:selectedQuestionId);
function verifiedProgress(){const valid=new Set(bankRegistry.getQuestions({}).map(q=>q.id));return progressFromAttempts({...state,attempts:state.attempts.filter(a=>valid.has(a.exerciseId))})}
function openPrivateBooklet(examId=null){
 document.querySelector('[data-page=mockexam]')?.click();const panel=$('privateLibraryPanel');if(panel){panel.open=true;window.dispatchEvent(new CustomEvent('ma-select-private-booklet',{detail:{examId}}));panel.scrollIntoView({block:'start'})}
}
function renderExamChooser(target,prefix){
 target.innerHTML=`<div class="exam-setup"><label>Sınav<select id="${prefix}ExamType" class="field"><option>TYT</option><option>AYT</option></select></label><label>Yıl<select id="${prefix}ExamYear" class="field"></select></label></div><div id="${prefix}ExamInfo"></div>`;
 const type=$(prefix+'ExamType'),year=$(prefix+'ExamYear');
 const render=()=>{const row=TURKISH_EXAMS.find(r=>r.examType===type.value&&r.year===Number(year.value));const info=$(prefix+'ExamInfo');info.replaceChildren();if(!row)return;
  const description=document.createElement('p');description.textContent=`${row.year} ${row.examType} · 40 matematik sorusu · ÖSYM temel kitapçığı`;info.append(description);
  const actions=document.createElement('div');actions.className='learning-controls';const link=document.createElement('a');link.className='btn secondary';link.href=row.originalUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Resmî soru PDF’sini aç';const solve=document.createElement('button');solve.className='btn';solve.textContent='PDF’mi seç ve çöz';solve.onclick=()=>openPrivateBooklet(row.id);actions.append(link,solve);info.append(actions);
  const note=document.createElement('p');note.className='progress-note';note.textContent=row.cancelledNumbers.length?'İptalli soru var. Kitapçığı çözebilirsin; otomatik net kapalı.':'Resmî PDF’yi cihazına indirip seç. Sorular, şekiller ve optik form birlikte açılır; dosyan cihazında kalır.';info.append(note);
 };
 const years=()=>{year.replaceChildren();for(const row of TURKISH_EXAMS.filter(r=>r.examType===type.value).slice().reverse()){const option=document.createElement('option');option.value=row.year;option.textContent=row.year;year.append(option)}render()};type.onchange=years;year.onchange=render;years();
}
function renderLearning(){
 const c=course(),questions=eligibleQuestions(),p=verifiedProgress()[c.id]||{correct:0,total:0};
 if(!questions.some(q=>q.id===selectedQuestionId))selectedQuestionId=questions[0]?.id||null;
 const published=bankRegistry.getQuestions({}),turkish=published.filter(q=>q.language==='tr');
 $('learningRoot').innerHTML=`<div class="hero"><div class="muted tiny">Matematik Akademim</div><h1>${esc(c.title)}</h1><div class="muted">Konunu öğren, gerçek sorularla çalış.</div></div><div class="learning-controls"><button class="btn secondary" id="browseCourses">Konular · ${COURSES.length}</button><button class="btn" id="askLessonTeacher">Öğretmenime sor</button></div><div class="card question-bank-card"><div class="row"><h2>Gerçek sorular</h2><span class="progress-note">${turkish.length?turkish.length+' Türkçe · ':''}${published.length} toplam</span></div><div class="learning-controls"><label for="bankScope">Sorular</label><select id="bankScope" class="field"><option value="all">Tüm konular</option><option value="course">Bu konu</option></select><label for="bankDifficulty">Düzey</label><select id="bankDifficulty" class="field"><option value="">Tümü</option><option value="easy">Kolay</option><option value="medium">Orta</option><option value="hard">Zor</option></select></div><div id="sourceQuestion"></div></div><div class="card lesson-card"><details id="courseLesson" open><summary>Konu anlatımı</summary><ol>${c.lessonSteps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol></details></div><div class="card"><h2>TYT / AYT çıkmış sorular</h2><p class="progress-note">Gerçek ÖSYM kitapçığını seç, sorularını uygulamada çöz.</p><div id="homeRealExams"></div><button class="smallbtn" id="openPrivateExams">Kendi soru PDF’mi aç</button></div><details class="card"><summary>İlerlemem ve çalışma planım</summary><p class="progress-note">${p.total} kaynaklı yanıt · ${p.correct} eşleşen cevap. Önceki kişisel kayıtların korunuyor. Eski yanıt sayısı: ${state.attempts.filter(a=>!bankRegistry.getQuestion(a.exerciseId)).length}.</p><ol id="planList"></ol><button class="smallbtn" id="syncLearning">Öğrenme kaydını eşitle</button><span id="profileStatus" role="status" class="progress-note"></span></details>`;
 $('bankScope').value=bankScope;$('bankScope').onchange=e=>{bankScope=e.target.value;selectedQuestionId=null;answeredQuestionId=null;renderLearning();renderTeachers()};$('bankDifficulty').value=bankDifficulty;$('bankDifficulty').onchange=e=>{bankDifficulty=e.target.value;selectedQuestionId=null;answeredQuestionId=null;renderLearning();renderTeachers()};
 $('askLessonTeacher').onclick=()=>{tutorLesson=true;showPage('teacher');teacherEpoch++;renderChat()};$('openPrivateExams').onclick=()=>openPrivateBooklet();$('browseCourses').onclick=openCatalog;$('topicButton').onclick=openCatalog;$('syncLearning').onclick=()=>syncProfile();renderExamChooser($('homeRealExams'),'home');renderPlan();renderSourceQuestion();
}
function selectCourse(id){if(!getCourse(id))return;tutorLesson=false;bankScope='course';activeRequest?.abort();$('message').value='';state.courseId=id;selectedQuestionId=null;answeredQuestionId=null;changed(true);renderLearning();renderTeachers()}
function renderPlan(){const plan=buildStudyPlan(verifiedProgress());$('planList').innerHTML=plan.map(p=>`<li><button class="smallbtn" data-course-id="${esc(p.courseId)}">${esc(p.title)}</button> · ${p.minutes} dk</li>`).join('');$('planList').querySelectorAll('button').forEach(b=>b.onclick=()=>selectCourse(b.dataset.courseId))}
function renderSourceQuestion(){
 const node=$('sourceQuestion'),q=activeQuestion(),questions=eligibleQuestions();
 if(!q){node.innerHTML='<p class="progress-note" id="emptySourceBank">Bu konu için henüz kaynaklı soru yok. Aşağıdaki konulardan gerçek bir soru seçebilir veya kendi PDF’ni açabilirsin.</p><div class="source-topic-list" id="availableSourceTopics"></div>';const groups=new Map();for(const item of bankRegistry.getQuestions({})){const group=groups.get(item.courseId)||{count:0,turkish:false};group.count++;group.turkish||=item.language==='tr';groups.set(item.courseId,group)}for(const [id,group]of [...groups].sort((a,b)=>Number(b[1].turkish)-Number(a[1].turkish))){const button=document.createElement('button');button.className='smallbtn';button.textContent=getCourse(id).title+' · '+group.count+' soru'+(group.turkish?' · Türkçe':' · İngilizce');button.onclick=()=>selectCourse(id);$('availableSourceTopics').append(button)}return}
 const source=q.source,index=questions.findIndex(item=>item.id===q.id);
 node.innerHTML=`<article id="questionCard" data-question-id="${esc(q.id)}"><div class="row"><b>${esc(q.topic)}</b><span>${index+1} / ${questions.length}</span></div><div id="originalPrompt" class="exercise-prompt"></div><div id="sourceAnswerArea"></div><p id="sourceFeedback" role="status"></p><details><summary>Kaynak bilgisi</summary><p id="sourceAttribution"></p><p><a id="originalSourceLink" target="_blank" rel="noopener noreferrer">Orijinal kaynak</a> · <a id="licenseLink" target="_blank" rel="noopener noreferrer">Lisans</a> · <a id="answerEvidenceLink" target="_blank" rel="noopener noreferrer">Cevap doğrulaması</a></p><p class="progress-note">Kaynak denetimi: ${esc(source.verification.checkedAt)}. Yanıt kaynağın cevap anahtarından doğrulandı.</p></details><div class="learning-controls"><button class="smallbtn" id="previousSource" ${index<=0?'disabled':''}>Önceki</button><button class="smallbtn" id="nextSource" ${index>=questions.length-1?'disabled':''}>Sonraki</button><button class="btn secondary" id="askTeacher">Öğretmenime sor</button></div></article>`;
 if(q.displayMode==='inline')$('originalPrompt').textContent=q.prompt;else{const frame=document.createElement('iframe');frame.title='İzinli orijinal kaynak';frame.src=(q.originalUrl||source.originalUrl)+(q.page?'#page='+q.page:'');frame.style.cssText='width:100%;height:60vh;border:0';$('originalPrompt').append(frame)}$('sourceAttribution').textContent=source.license.attribution;$('originalSourceLink').href=q.originalUrl||source.originalUrl;$('licenseLink').href=source.license.url;$('answerEvidenceLink').href=q.answer.evidenceUrl;
 const area=$('sourceAnswerArea');if(q.options.length){area.className='exercise-choices';q.options.forEach(option=>{const b=document.createElement('button');b.textContent=option.id+') '+option.text;b.onclick=()=>answerSource(option.id);area.append(b)})}else{area.innerHTML='<p class="progress-note">Cevabını yaz; ardından doğru cevabı kontrol et.</p><label for="sourceResponse">Cevabın</label><input id="sourceResponse" class="field" autocomplete="off" maxlength="200"><button id="checkSourceAnswer" class="btn secondary">Cevabı kontrol et</button>';$('checkSourceAnswer').onclick=()=>answerSource($('sourceResponse').value)}
 const navigate=delta=>{activeRequest?.abort();$('message').value='';selectedQuestionId=questions[index+delta]?.id||q.id;answeredQuestionId=null;teacherEpoch++;renderSourceQuestion();renderChat()};$('previousSource').onclick=()=>navigate(-1);$('nextSource').onclick=()=>navigate(1);$('askTeacher').onclick=()=>{tutorLesson=false;showPage('teacher');teacherEpoch++;renderChat()};
 if(answeredQuestionId===q.id)disableSourceAnswer();
}
const comparable=value=>String(value).trim().replace(/\s+/g,'').replace(/−/g,'-');
function disableSourceAnswer(){$('sourceAnswerArea').querySelectorAll('button,input').forEach(el=>el.disabled=true)}
function answerSource(value){const q=activeQuestion();if(!q||answeredQuestionId===q.id||!String(value).trim())return;const correct=comparable(value)===comparable(q.answer.value);answeredQuestionId=q.id;disableSourceAnswer();$('sourceFeedback').textContent=(correct?teacher().correctResponse:'Yanıtın kaynak cevabıyla aynı biçimde eşleşmedi. Eşdeğer farklı gösterimleri otomatik değerlendiremeyebiliriz.')+' Kaynak cevabı: '+q.answer.value;
 if(!correct&&!q.options.length)return;state.attempts.push({id:crypto.randomUUID(),courseId:q.courseId,exerciseId:q.id,correct,difficulty:q.difficulty||'unclassified',at:new Date().toISOString()});state=normalizeState(state);changed();renderPlan();}
function openCatalog(){
 let dialog=$('courseCatalog');if(!dialog){dialog=document.createElement('dialog');dialog.id='courseCatalog';dialog.className='course-catalog';document.body.append(dialog)}
 dialog.innerHTML=`<div class="row"><h2>Konu seç</h2><button class="smallbtn" id="closeCatalog">Kapat</button></div><label for="courseSearch">Konu ara</label><input class="field" id="courseSearch" type="search" placeholder="Örneğin türev, kesirler…"><div id="courseList" class="course-list"></div>`;
 const render=()=>{const query=$('courseSearch').value.toLocaleLowerCase('tr-TR');const list=$('courseList');list.replaceChildren();COURSES.filter(c=>`${c.title} ${c.group}`.toLocaleLowerCase('tr-TR').includes(query)).forEach(c=>{const b=document.createElement('button');b.textContent=c.title;const small=document.createElement('small');small.textContent=c.group;b.append(small);b.onclick=()=>{dialog.close();selectCourse(c.id)};list.append(b)})};
 $('closeCatalog').onclick=()=>dialog.close();$('courseSearch').oninput=render;render();dialog.showModal();
}
function learningMomentum(){const attempts=state.attempts.filter(a=>bankRegistry.getQuestion(a.exerciseId)),day=new Date().toLocaleDateString();let consecutiveCorrect=0;for(let i=attempts.length-1;i>=0&&attempts[i].correct;i--)consecutiveCorrect++;return {consecutiveCorrect,practiceToday:attempts.filter(a=>new Date(a.at).toLocaleDateString()===day).length,dailyGoal:3}}
function renderTeachers(){
 activeRequest?.abort();const selected=teacher();$('teacherPicker').className='teacher-grid';$('teacherPicker').replaceChildren();
 TEACHERS.forEach(t=>{const b=document.createElement('button');b.className='teacher-card';b.setAttribute('aria-pressed',String(t.id===selected.id));b.setAttribute('aria-label',t.name);b.innerHTML=`<span class="teacher-avatar" aria-hidden="true">${esc(t.avatar)}</span>${esc(t.name)}<small>${esc(t.tagline)}</small>`;b.onclick=()=>{activeRequest?.abort();state.teacherId=t.id;profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};changed(true);renderTeachers()};$('teacherPicker').append(b)});
 const momentum=learningMomentum();$('teacherDescription').textContent=selected.description+(selected.id==='mert'?` Bugünkü antrenman: ${momentum.practiceToday}/${momentum.dailyGoal} yanıt; son doğru serin: ${momentum.consecutiveCorrect}.`:'');
 $('teacherOptions').innerHTML=selected.id==='cagatay'?`<details class="teacher-consent"><summary>İsteğe bağlı yetişkin argo modu</summary><label><input id="adultConfirmed" type="checkbox">18 yaş ve üzerindeyim.</label><label><input id="profanityConsent" type="checkbox">Bu sohbet için küfürlü mizahı açıkça seçiyorum.</label><label for="profanityLevel">Argo düzeyi</label><select class="field" id="profanityLevel">${PROFANITY_LEVELS.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select></details>`:'';
 if(selected.id==='cagatay'){
  $('adultConfirmed').checked=profanity.adultConfirmed;$('profanityConsent').checked=profanity.profanityConsent;$('profanityLevel').value=profanity.profanityLevel;
  const update=()=>{profanity.adultConfirmed=$('adultConfirmed').checked;profanity.profanityConsent=$('profanityConsent').checked;$('profanityLevel').disabled=!(profanity.adultConfirmed&&profanity.profanityConsent);if($('profanityLevel').disabled){profanity.profanityLevel='off';$('profanityLevel').value='off'}};
  const resetRequest=()=>{activeRequest?.abort();teacherEpoch++;renderChat()};$('adultConfirmed').onchange=()=>{update();resetRequest()};$('profanityConsent').onchange=()=>{update();resetRequest()};$('profanityLevel').onchange=e=>{profanity.profanityLevel=e.target.value;resetRequest()};update();
 }
 teacherEpoch++;renderChat();$('aiStatus').textContent='';
}
function bubble(who,text){const node=document.createElement('div');node.className='bubble '+who;node.textContent=text;$('chat').append(node);node.scrollIntoView({block:'nearest'});return node}
function renderChat(){const t=teacher(),q=tutorLesson?null:activeQuestion();$('aiQuestion').textContent=q?'Seçili kaynak sorusu: '+activeQuestion().source.name+' · '+activeQuestion().number:'Konu: '+course().title+' · Konuyu veya takıldığın adımı sorabilirsin.';$('chat').replaceChildren();bubble('ai',q?t.greeting:({cagatay:'Hadi başlayalım. Takıldığın konuyu yaz, lafı dolandırmadan üzerinden geçelim.',beyza:'Matematiğin sağlam temellerini birlikte kuralım; mimarlığa giden yolda bu konu da işimize yarayacak.',zeynep:'Canım, takıldığın konuyu birlikte anlaşılır hâle getirelim.',kemal:'Önce tanımı, sonra mantığını inceleyelim. Açıklamamı istediğin kavramı yaz.',mert:'Hazırız! Bugün küçük bir adım atalım; çalışacağın konuyu yaz.',elif:'Acele etmeyelim. Konuyu küçük adımlarla birlikte öğrenebiliriz.'}[t.id]));for(const m of conversations.get(chatKey())||[])bubble(m.role==='user'?'me':'ai',m.content);$('send').disabled=false}

function setupAI(){
 try{$('endpoint').value=localStorage.getItem('math_ai_worker_url')||'';$('access').value=sessionStorage.getItem('math_ai_access')||''}catch{}
 $('saveAI').onclick=()=>{try{const u=new URL($('endpoint').value.trim());if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('HTTPS Worker adresi gir.');localStorage.setItem('math_ai_worker_url',u.origin);sessionStorage.setItem('math_ai_access',$('access').value);$('aiStatus').textContent='Bağlantı ayarları kaydedildi.'}catch(e){$('aiStatus').textContent=e.message}};
 $('clearChat').onclick=()=>{activeRequest?.abort();conversations.delete(chatKey());teacherEpoch++;renderChat()};
 $('send').onclick=async()=>{
  if($('send').disabled)return;const text=$('message').value.trim();if(!text)return;if(text.length>2500){$('aiStatus').textContent='Sorunu en fazla 2500 karakterle yaz.';return}
  let base,token;try{base=localStorage.getItem('math_ai_worker_url');token=sessionStorage.getItem('math_ai_access')}catch{}
  if(!base||!token){$('aiStatus').textContent='Önce bağlantı ayarlarını doldur.';return}
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
}
function showPage(page){document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));['study','teacher','library','mockexam'].forEach(id=>{const el=$(id);if(el)el.classList.toggle('hide',id!==page)})}
document.querySelectorAll('.nav button').forEach(b=>{if(b.dataset.page!=='mockexam')b.onclick=()=>showPage(b.dataset.page)});
function renderLibrary(){const node=$('examLinks');node.replaceChildren();const chooser=document.createElement('div');node.append(chooser);renderExamChooser(chooser,'library');const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Soru bankası kaynakları ve kullanım bilgileri';details.append(summary);const unique=new Map(bankRegistry.getQuestions({}).map(q=>[q.source.id,q.source]));for(const source of unique.values()){const link=document.createElement('a');link.className='link';link.href=source.originalUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent=source.title+' · '+source.license.name;details.append(link)}node.append(details)}
state=loadLocal();renderLearning();setupAI();renderTeachers();renderLibrary();
window.addEventListener('ma-account-changed',changeAccount);changeAccount();
