import {COURSES, getCourse, buildStudyPlan} from '../shared/curriculum.js';
import {TEACHERS, DEFAULT_TEACHER_ID, PROFANITY_LEVELS} from '../shared/teachers.js';
import {normalizeState, mergeLearningStates, progressFromAttempts} from '../shared/learning-state.js';
import {QUESTION_BANK} from '../data/question-bank.js';
import {getEligibleQuestions,getPublishedQuestionById} from '../shared/question-bank.js';
import {captureLearningSnapshot} from '../shared/learning-migration.js';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let owner=null, scope='guest', state, revision=0, remoteChain=Promise.resolve(), saveTimer;
let selectedQuestionId=null, answeredQuestionId=null, bankDifficulty='', teacherEpoch=0, activeRequest=null, conversations=new Map();
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
const eligibleQuestions=()=>getEligibleQuestions(QUESTION_BANK,{courseId:course().id,...(bankDifficulty?{difficulty:bankDifficulty}:{})});
const activeQuestion=()=>getPublishedQuestionById(QUESTION_BANK,selectedQuestionId);
const chatKey=()=>teacher().id+':'+(selectedQuestionId||'none');
function verifiedProgress(){const valid=new Set(getEligibleQuestions(QUESTION_BANK,{}).map(q=>q.id));return progressFromAttempts({...state,attempts:state.attempts.filter(a=>valid.has(a.exerciseId))})}
function renderLearning(){
 const c=course(),questions=eligibleQuestions(),p=verifiedProgress()[c.id]||{correct:0,total:0};
 if(!questions.some(q=>q.id===selectedQuestionId))selectedQuestionId=questions[0]?.id||null;
 $('learningRoot').innerHTML=`<div class="hero"><div class="muted tiny">Kaynaklı matematik soru bankası</div><h1>${esc(c.title)}</h1><div class="muted">Yalnızca kaynağı, cevabı ve kullanım hakkı doğrulanan sorular.</div></div><div class="learning-controls"><button class="btn secondary" id="browseCourses">Konular · ${COURSES.length}</button><label for="bankDifficulty">İncelenmiş düzey</label><select id="bankDifficulty" class="field"><option value="">Tümü</option><option value="easy">Kolay</option><option value="medium">Orta</option><option value="hard">Zor</option></select></div><div class="card"><details id="courseLesson"><summary>Konu anlatımı</summary><ol>${c.lessonSteps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol></details><p class="progress-note">${questions.length} doğrulanmış ve izinli soru · ${p.total} kaynaklı yanıt · ${p.correct} eşleşen cevap</p><div id="sourceQuestion"></div></div><details class="card"><summary>İlerlemem ve çalışma planım</summary><p class="progress-note">Önceki sistemdeki kişisel kayıtların korunur; kaldırılan soru metinleri yeniden gösterilmez. Eski yanıt sayısı: ${state.attempts.filter(a=>!getPublishedQuestionById(QUESTION_BANK,a.exerciseId)).length}.</p><p class="progress-note">Kaynaklı bir seviye taraması henüz doğrulanmadığı için tarama ve eski konu testleri kapalıdır.</p><ol id="planList"></ol></details><div class="learning-controls"><button class="smallbtn" id="syncLearning">Öğrenme kaydını eşitle</button><span id="profileStatus" role="status" class="progress-note"></span></div>`;
 $('bankDifficulty').value=bankDifficulty;$('bankDifficulty').onchange=e=>{bankDifficulty=e.target.value;selectedQuestionId=null;answeredQuestionId=null;renderLearning();renderTeachers()};
 $('browseCourses').onclick=openCatalog;$('topicButton').onclick=openCatalog;$('syncLearning').onclick=()=>syncProfile();renderPlan();renderSourceQuestion();
}
function selectCourse(id){if(!getCourse(id))return;activeRequest?.abort();$('message').value='';state.courseId=id;selectedQuestionId=null;answeredQuestionId=null;changed(true);renderLearning();renderTeachers()}
function renderPlan(){const plan=buildStudyPlan(verifiedProgress());$('planList').innerHTML=plan.map(p=>`<li><button class="smallbtn" data-course-id="${esc(p.courseId)}">${esc(p.title)}</button> · ${p.minutes} dk</li>`).join('');$('planList').querySelectorAll('button').forEach(b=>b.onclick=()=>selectCourse(b.dataset.courseId))}
function renderSourceQuestion(){
 const node=$('sourceQuestion'),q=activeQuestion(),questions=eligibleQuestions();
 if(!q){node.innerHTML='<p class="note" id="emptySourceBank">Bu konu için doğrulanmış ve kullanım izni bulunan soru henüz eklenmedi.</p>';return}
 const source=q.source,index=questions.findIndex(item=>item.id===q.id);
 node.innerHTML=`<article id="questionCard" data-question-id="${esc(q.id)}"><div class="row"><b>${esc(source.publisher)} · ${esc(source.name)}</b><span>${index+1} / ${questions.length}</span></div><p class="progress-note">${q.year} · ${esc(q.section||'')} · ${q.page?'Sayfa '+q.page+' · ':''}Soru ${esc(q.number)} · ${esc(q.topic)} · ${q.difficulty?esc(q.difficulty):'Zorluk analiz edilmedi'}</p><p class="progress-note">Kaynağın özgün dili ve soru ifadesi korunmuştur. Soru ID: ${esc(q.id)}</p><div id="originalPrompt" class="exercise-prompt"></div><div id="sourceAnswerArea"></div><p id="sourceFeedback" role="status"></p><details><summary>Kaynak ve kullanım izni</summary><p id="sourceAttribution"></p><p><a id="originalSourceLink" target="_blank" rel="noopener noreferrer">Orijinal kaynak</a> · <a id="licenseLink" target="_blank" rel="noopener noreferrer">Lisans</a> · <a id="answerEvidenceLink" target="_blank" rel="noopener noreferrer">Cevap doğrulaması</a></p><p class="progress-note">Kaynak denetimi: ${esc(source.verification.checkedAt)}. Yanıt kaynağın cevap anahtarından doğrulandı.</p></details><div class="learning-controls"><button class="smallbtn" id="previousSource" ${index<=0?'disabled':''}>Önceki</button><button class="smallbtn" id="nextSource" ${index>=questions.length-1?'disabled':''}>Sonraki</button><button class="btn secondary" id="askTeacher">Bu soruyu öğretmenle incele</button></div></article>`;
 if(q.displayMode==='inline')$('originalPrompt').textContent=q.prompt;else{const frame=document.createElement('iframe');frame.title='İzinli orijinal kaynak';frame.src=(q.originalUrl||source.originalUrl)+(q.page?'#page='+q.page:'');frame.style.cssText='width:100%;height:60vh;border:0';$('originalPrompt').append(frame)}$('sourceAttribution').textContent=source.license.attribution;$('originalSourceLink').href=q.originalUrl||source.originalUrl;$('licenseLink').href=source.license.url;$('answerEvidenceLink').href=q.answer.evidenceUrl;
 const area=$('sourceAnswerArea');if(q.options.length){area.className='exercise-choices';q.options.forEach(option=>{const b=document.createElement('button');b.textContent=option.id+') '+option.text;b.onclick=()=>answerSource(option.id);area.append(b)})}else{area.innerHTML='<p class="progress-note">Kaynak açık uçludur; uygulama A–E seçeneği üretmez.</p><label for="sourceResponse">Yanıtın (kaynak cevap anahtarıyla aynı biçimde)</label><input id="sourceResponse" class="field" autocomplete="off" maxlength="200"><button id="checkSourceAnswer" class="btn secondary">Kaynak cevabıyla karşılaştır</button>';$('checkSourceAnswer').onclick=()=>answerSource($('sourceResponse').value)}
 const navigate=delta=>{activeRequest?.abort();$('message').value='';selectedQuestionId=questions[index+delta]?.id||q.id;answeredQuestionId=null;teacherEpoch++;renderSourceQuestion();renderChat()};$('previousSource').onclick=()=>navigate(-1);$('nextSource').onclick=()=>navigate(1);$('askTeacher').onclick=()=>{showPage('teacher');teacherEpoch++;renderChat()};
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
function learningMomentum(){const attempts=state.attempts.filter(a=>getPublishedQuestionById(QUESTION_BANK,a.exerciseId)),day=new Date().toLocaleDateString();let consecutiveCorrect=0;for(let i=attempts.length-1;i>=0&&attempts[i].correct;i--)consecutiveCorrect++;return {consecutiveCorrect,practiceToday:attempts.filter(a=>new Date(a.at).toLocaleDateString()===day).length,dailyGoal:3}}
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
function renderChat(){const t=teacher();$('aiQuestion').textContent=activeQuestion()?'Seçili kaynak sorusu: '+activeQuestion().source.name+' · '+activeQuestion().number:'Önce soru bankasından doğrulanmış bir kaynak sorusu seç.';$('chat').replaceChildren();bubble('ai',t.greeting);for(const m of conversations.get(chatKey())||[])bubble(m.role==='user'?'me':'ai',m.content);$('send').disabled=!activeQuestion()}
function setupAI(){
 try{$('endpoint').value=localStorage.getItem('math_ai_worker_url')||'';$('access').value=sessionStorage.getItem('math_ai_access')||''}catch{}
 $('saveAI').onclick=()=>{try{const u=new URL($('endpoint').value.trim());if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('HTTPS Worker adresi gir.');localStorage.setItem('math_ai_worker_url',u.origin);sessionStorage.setItem('math_ai_access',$('access').value);$('aiStatus').textContent='Bağlantı ayarları kaydedildi.'}catch(e){$('aiStatus').textContent=e.message}};
 $('clearChat').onclick=()=>{activeRequest?.abort();conversations.delete(chatKey());teacherEpoch++;renderChat()};
 $('send').onclick=async()=>{
  if($('send').disabled||!activeQuestion())return;const text=$('message').value.trim();if(!text)return;if(text.length>2500){$('aiStatus').textContent='Sorunu en fazla 2500 karakterle yaz.';return}
  let base,token;try{base=localStorage.getItem('math_ai_worker_url');token=sessionStorage.getItem('math_ai_access')}catch{}
  if(!base||!token){$('aiStatus').textContent='Önce bağlantı ayarlarını doldur.';return}
  const t=teacher(),epoch=teacherEpoch,history=conversations.get(chatKey())||[],user={role:'user',content:text};
  bubble('me',text);$('message').value='';const waiting=bubble('ai','Düşünüyorum…');$('send').disabled=true;activeRequest=new AbortController();const controller=activeRequest;const timer=setTimeout(()=>controller.abort(),45000);
  try{
   const requestMessages=[...history,user].slice(-11);while(new TextEncoder().encode(JSON.stringify(requestMessages)).length>12000&&requestMessages.length>1)requestMessages.splice(0,2);
   const r=await fetch(base+'/api/tutor',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({messages:requestMessages,questionId:activeQuestion().id,teacherId:t.id,helpMode:$('tutorMode').value,progressContext:learningMomentum(),...profanity})});
   const body=await r.json();if(!r.ok)throw Error(body.error||'Sunucu yanıt vermedi');if(epoch!==teacherEpoch)return;if(body.questionId!==activeQuestion()?.id||body.isOfficialSolution===true)throw Error('Yanıt seçili kaynak sorusuyla eşleşmiyor.');
   const answer=String(body.answer||'Yanıt alınamadı');waiting.textContent=answer;conversations.set(chatKey(),[...history,user,{role:'assistant',content:answer.slice(0,2500)}].slice(-12));
  }catch(e){if(epoch===teacherEpoch)waiting.textContent=controller.signal.aborted?'İstek durduruldu. Tekrar deneyebilirsin.':'Bağlantı hatası: '+e.message}
  finally{clearTimeout(timer);if(activeRequest===controller)activeRequest=null;if(epoch===teacherEpoch)$('send').disabled=!activeQuestion()}
 };
}
function showPage(page){document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));['study','teacher','library','mockexam'].forEach(id=>{const el=$(id);if(el)el.classList.toggle('hide',id!==page)})}
document.querySelectorAll('.nav button').forEach(b=>{if(b.dataset.page!=='mockexam')b.onclick=()=>showPage(b.dataset.page)});
function renderLibrary(){const node=$('examLinks');node.replaceChildren();const info=document.createElement('p');info.className='note';info.textContent='ÖSYM ve MEB içeriklerinin erişilebilir olması yeniden yayımlama izni değildir. Doğrulanmamış kitapçık veya sorular buradan yüklenmez.';node.append(info);const unique=new Map(getEligibleQuestions(QUESTION_BANK,{}).map(q=>[q.source.id,q.source]));for(const source of unique.values()){const link=document.createElement('a');link.className='link';link.href=source.originalUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent=source.name+' · '+source.license.name;node.append(link)}}
state=loadLocal();renderLearning();setupAI();renderTeachers();renderLibrary();
window.addEventListener('ma-account-changed',changeAccount);changeAccount();
