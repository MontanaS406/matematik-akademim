import {COURSES, getCourse, diagnosticQuestions, assessDiagnostic, buildStudyPlan} from '../shared/curriculum.js';
import {TEACHERS, DEFAULT_TEACHER_ID, PROFANITY_LEVELS} from '../shared/teachers.js';
import {normalizeState, mergeLearningStates, progressFromAttempts} from '../shared/learning-state.js';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let owner=null, scope='guest', state, revision=0, remoteChain=Promise.resolve(), saveTimer;
let quiz=null, diagnostic=null, teacherEpoch=0, activeRequest=null, conversations=new Map();
let profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};
const teacher=()=>TEACHERS.find(t=>t.id===state.teacherId)||TEACHERS.find(t=>t.id===DEFAULT_TEACHER_ID);
const course=()=>getCourse(state.courseId)||COURSES[0];
const key=()=>`ma_learning_v1_${scope}`;
function loadLocal(){try{return normalizeState(JSON.parse(localStorage.getItem(key())||'null'))}catch{return normalizeState(null)}}
function status(message){const node=$('profileStatus');if(node)node.textContent=message}
function saveLocal(){try{localStorage.setItem(key(),JSON.stringify(state));return true}catch{status('İlerleme bu tarayıcıya kaydedilemedi. Depolama izinlerini kontrol et.');return false}}
function changed(preferences=false){revision++;if(preferences)state.preferencesAt=new Date().toISOString();saveLocal();clearTimeout(saveTimer);if(owner)saveTimer=setTimeout(()=>syncProfile(),700)}
async function syncProfile(write=true){
  const account=window.MAAccount;const current=scope;const generation=revision;
  if(!owner||!account){status('İlerlemen bu tarayıcıda. Hesabına girerek buluta kaydedebilirsin.');return}
  status('Öğrenme kaydı eşitleniyor…');
  remoteChain=remoteChain.catch(()=>{}).then(async()=>{
    if(current!==scope)return;
    try{
      const remote=await account.loadLearning();if(current!==scope)return;if(remote){const before=[state.courseId,state.difficulty].join(':'),beforeTeacher=state.teacherId;state=mergeLearningStates(state,remote);if(before!==[state.courseId,state.difficulty].join(':')){quiz=null;diagnostic=null}if(generation!==revision)status('Yeni yerel değişiklikler korunarak birleştirildi.');saveLocal();renderLearning();if(beforeTeacher!==state.teacherId){profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};renderTeachers()}}if(!write){status('Hesabına özel öğrenme kaydı yüklendi.');return}
      const snapshot=normalizeState(state);await account.saveLearning(snapshot);
      if(current===scope)status('Öğretmen tercihin ve ilerlemen hesabına kaydedildi.');
    }catch{if(current===scope)status('Bulut öğrenme kaydı eşitlenemedi. Yerel kayıt korunuyor; yeniden eşitleyebilirsin.')}
  });return remoteChain;
}
async function changeAccount(){
  const next=window.MAAccount?.getUser()?.id||null;if(next===owner&&state)return;
  activeRequest?.abort();owner=next;scope=owner||'guest';revision++;clearTimeout(saveTimer);state=loadLocal();
  $('message').value='';conversations=new Map();profanity={profanityLevel:'off',adultConfirmed:false,profanityConsent:false};diagnostic=null;quiz=null;
  renderLearning();renderTeachers();if(owner)await syncProfile(false);
}
function newQuiz(){const c=course();quiz={courseId:c.id,items:[c.exercises[state.difficulty]],index:0,answered:false,score:0}}
function renderLearning(){
 const c=course(),progress=progressFromAttempts(state),p=progress[c.id]||{correct:0,total:0};
 $('learningRoot').innerHTML=`<div class="hero"><div class="muted tiny">Özgün öğrenme yolu · Sıfırdan üniversiteye</div><h1>${esc(c.title)}</h1><div class="muted">Küçük bir adım seç, örneği incele, kendini dene.</div></div><div class="learning-controls"><button class="btn secondary" id="browseCourses">Konular · ${COURSES.length}</button><label for="learningDifficulty">Düzey</label><select id="learningDifficulty" class="field"><option value="easy">Kolay</option><option value="medium">Orta</option><option value="hard">Zor</option></select></div><div class="card"><details id="courseLesson"><summary>Konu anlatımı ve çözümlü örnek</summary><ol>${c.lessonSteps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><div class="worked"><b>${esc(c.example.problem)}</b><ol>${c.example.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>Sonuç: ${esc(c.example.answer)}</div>${c.prerequisites.length?`<p class="progress-note">Önce: ${c.prerequisites.map(id=>esc(getCourse(id)?.title||id)).join(', ')}</p>`:''}</details><p class="progress-note">${p.total} yanıt · ${p.correct} doğru · Özgün alıştırmalar, çıkmış sınav sorusu değildir.</p><div id="learningQuiz"></div></div><details class="card"><summary>Seviyem ve çalışma planım</summary><p class="progress-note">Seviye taraması kısa bir başlangıç önerisi verir; tüm matematik yeterliliğini ölçmez.</p><div class="learning-controls"><button class="btn secondary" id="startDiagnostic">8 soruluk seviye taraması</button><button class="smallbtn" id="topicTest">3 soruluk konu testi</button><button class="smallbtn" id="reviewLearning">Yanlışlarımı tekrar et</button></div><p id="diagnosticSummary" class="practice-feedback"></p><ol id="planList"></ol></details><div class="learning-controls"><button class="smallbtn" id="syncLearning">Öğrenme kaydını eşitle</button><span id="profileStatus" role="status" class="progress-note"></span></div>`;
 $('learningDifficulty').value=state.difficulty;
 $('learningDifficulty').onchange=e=>{state.difficulty=e.target.value;quiz=null;diagnostic=null;changed(true);renderLearning()};
 $('browseCourses').onclick=openCatalog;$('topicButton').onclick=openCatalog;
 $('syncLearning').onclick=()=>syncProfile();$('startDiagnostic').onclick=startDiagnostic;
 $('topicTest').onclick=()=>{diagnostic=null;quiz={courseId:c.id,items:['easy','medium','hard'].map(d=>({...c.exercises[d],difficulty:d})),index:0,answered:false,score:0};renderQuiz();$('learningQuiz').scrollIntoView({block:'center',behavior:'smooth'})};
 $('reviewLearning').onclick=()=>{const seen=new Set();const wrong=state.attempts.filter(a=>!a.correct).reverse().filter(a=>{if(seen.has(a.exerciseId))return false;seen.add(a.exerciseId);return true}).slice(0,10);const items=wrong.flatMap(a=>{const c=getCourse(a.courseId),ex=c?.exercises[a.difficulty];return ex&&ex.id===a.exerciseId?[{...ex,courseId:c.id,difficulty:a.difficulty}]:[]});if(!items.length){$('diagnosticSummary').textContent='Tekrar listende yanlış yanıt yok.';return}diagnostic=null;quiz={items,index:0,answered:false,score:0};renderQuiz();$('learningQuiz').scrollIntoView({block:'center'})};
 renderPlan();if(!quiz&&!diagnostic)newQuiz();renderQuiz();
}
function selectCourse(id){if(!getCourse(id))return;state.courseId=id;diagnostic=null;quiz=null;changed(true);renderLearning()}
function renderPlan(){
 const progress=progressFromAttempts(state);let plan=buildStudyPlan(progress);
 if(state.diagnostic){const result=assessDiagnostic(state.diagnostic.responses);$('diagnosticSummary').textContent=`Son tarama: ${result.level}. Öncelik: ${result.recommendations.map(id=>getCourse(id)?.title).filter(Boolean).join(', ')}`;
 const suggested=result.recommendations.filter(id=>{const p=progress[id];return !p||p.total<3||p.correct/p.total<0.8}).map(id=>({courseId:id,title:getCourse(id)?.title,minutes:20,reason:'Seviye taramasına göre öneri; ön koşulları örnekle kontrol et.'}));
 const ids=new Set();plan=[...suggested,...plan].filter(p=>{if(ids.has(p.courseId))return false;ids.add(p.courseId);return true});}
 $('planList').innerHTML=plan.slice(0,5).map(p=>`<li><button class="smallbtn" data-course-id="${esc(p.courseId)}">${esc(p.title)}</button> · ${p.minutes} dk <span class="progress-note">${esc(p.reason)}</span></li>`).join('');
 $('planList').querySelectorAll('button').forEach(b=>b.onclick=()=>selectCourse(b.dataset.courseId));
}
function startDiagnostic(){diagnostic={items:diagnosticQuestions(),index:0,responses:[],answered:false};quiz=null;renderQuiz();$('learningQuiz').scrollIntoView({block:'center'})}
function renderQuiz(){
 const target=$('learningQuiz'),model=diagnostic||quiz;if(!target||!model)return;
 const item=model.items[model.index];if(!item){
   target.innerHTML=`<h2>${diagnostic?'Seviye taraması':'Çalışma'} tamamlandı</h2><p>${diagnostic?'Önerilerini çalışma planında görebilirsin.':`${model.score} / ${model.items.length} doğru`}</p><button class="btn secondary" id="restartPractice">Alıştırmaya dön</button>`;
   $('restartPractice').onclick=()=>{diagnostic=null;quiz=null;renderLearning()};return;
 }
 const alreadyAnswered=model.answered===true&&model.answeredIndex===model.index;target.innerHTML=`<p class="progress-note">${diagnostic?'Seviye taraması':'Özgün çalışma'} · ${model.index+1} / ${model.items.length}</p><div class="exercise-prompt">${esc(item.prompt)}</div><div class="exercise-choices" id="learningChoices"></div><p class="practice-feedback" id="learningFeedback" role="status"></p><button class="btn secondary hide" id="nextLearning">${model.index+1===model.items.length?'Sonucu gör':'Sonraki soru'}</button>`;
 const choices=[...item.choices];for(let i=choices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]]}choices.forEach(value=>{const button=document.createElement('button');button.textContent=String(value);button.onclick=()=>answerLearning(value,button);$('learningChoices').append(button)});
 $('nextLearning').onclick=()=>{model.index++;model.answered=false;renderQuiz()};if(alreadyAnswered)paintAnswer(item,model.answerValue);
}
function paintAnswer(item,value){const correct=String(value)===String(item.answer);
 $('learningChoices').querySelectorAll('button').forEach(b=>{b.disabled=true;if(b.textContent===String(item.answer))b.dataset.state='correct'});if(!correct){const chosen=[...$('learningChoices').querySelectorAll('button')].find(b=>b.textContent===String(value));if(chosen)chosen.dataset.state='wrong'};
 $('learningFeedback').textContent=`${correct?teacher().correctResponse:teacher().incorrectResponse}\nDoğru cevap: ${item.answer}. ${item.explanation}`;$('nextLearning').classList.remove('hide');
}
function answerLearning(value,button){
 const model=diagnostic||quiz;if(!model||model.answered)return;model.answered=true;const item=model.items[model.index],correct=String(value)===String(item.answer);
 model.answeredIndex=model.index;model.answerValue=value;paintAnswer(item,value);
 if(diagnostic){model.responses.push({courseId:item.courseId,correct});if(model.responses.length===model.items.length){const result=assessDiagnostic(model.responses);state.diagnostic={at:new Date().toISOString(),level:result.level,responses:model.responses};changed();renderPlan()}}
 else{if(correct)model.score++;state.attempts.push({id:crypto.randomUUID(),courseId:item.courseId||model.courseId||course().id,exerciseId:item.id,correct,difficulty:item.difficulty||state.difficulty,at:new Date().toISOString()});state=normalizeState(state);changed();renderPlan()}
}
function openCatalog(){
 let dialog=$('courseCatalog');if(!dialog){dialog=document.createElement('dialog');dialog.id='courseCatalog';dialog.className='course-catalog';document.body.append(dialog)}
 dialog.innerHTML=`<div class="row"><h2>Konu seç</h2><button class="smallbtn" id="closeCatalog">Kapat</button></div><label for="courseSearch">Konu ara</label><input class="field" id="courseSearch" type="search" placeholder="Örneğin türev, kesirler…"><div id="courseList" class="course-list"></div>`;
 const render=()=>{const query=$('courseSearch').value.toLocaleLowerCase('tr-TR');const list=$('courseList');list.replaceChildren();COURSES.filter(c=>`${c.title} ${c.group}`.toLocaleLowerCase('tr-TR').includes(query)).forEach(c=>{const b=document.createElement('button');b.textContent=c.title;const small=document.createElement('small');small.textContent=c.group;b.append(small);b.onclick=()=>{dialog.close();selectCourse(c.id)};list.append(b)})};
 $('closeCatalog').onclick=()=>dialog.close();$('courseSearch').oninput=render;render();dialog.showModal();
}
function learningMomentum(){const attempts=state.attempts,day=new Date().toLocaleDateString();let consecutiveCorrect=0;for(let i=attempts.length-1;i>=0&&attempts[i].correct;i--)consecutiveCorrect++;return {consecutiveCorrect,practiceToday:attempts.filter(a=>new Date(a.at).toLocaleDateString()===day).length,dailyGoal:3}}
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
function renderChat(){const t=teacher();$('chat').replaceChildren();bubble('ai',t.greeting);for(const m of conversations.get(t.id)||[])bubble(m.role==='user'?'me':'ai',m.content);$('send').disabled=false}
function setupAI(){
 try{$('endpoint').value=localStorage.getItem('math_ai_worker_url')||'';$('access').value=sessionStorage.getItem('math_ai_access')||''}catch{}
 $('saveAI').onclick=()=>{try{const u=new URL($('endpoint').value.trim());if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('HTTPS Worker adresi gir.');localStorage.setItem('math_ai_worker_url',u.origin);sessionStorage.setItem('math_ai_access',$('access').value);$('aiStatus').textContent='Bağlantı ayarları kaydedildi.'}catch(e){$('aiStatus').textContent=e.message}};
 $('clearChat').onclick=()=>{activeRequest?.abort();conversations.delete(teacher().id);teacherEpoch++;renderChat()};
 $('send').onclick=async()=>{
  if($('send').disabled)return;const text=$('message').value.trim();if(!text)return;if(text.length>2500){$('aiStatus').textContent='Sorunu en fazla 2500 karakterle yaz.';return}
  let base,token;try{base=localStorage.getItem('math_ai_worker_url');token=sessionStorage.getItem('math_ai_access')}catch{}
  if(!base||!token){$('aiStatus').textContent='Önce bağlantı ayarlarını doldur.';return}
  const t=teacher(),epoch=teacherEpoch,history=conversations.get(t.id)||[],user={role:'user',content:text};
  bubble('me',text);$('message').value='';const waiting=bubble('ai','Düşünüyorum…');$('send').disabled=true;activeRequest=new AbortController();const controller=activeRequest;const timer=setTimeout(()=>controller.abort(),45000);
  try{
   const requestMessages=[...history,user].slice(-11);while(new TextEncoder().encode(JSON.stringify(requestMessages)).length>12000&&requestMessages.length>1)requestMessages.splice(0,2);
   const r=await fetch(base+'/api/tutor',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({messages:requestMessages,topic:course().title,difficulty:state.difficulty,teacherId:t.id,helpMode:$('tutorMode').value,progressContext:learningMomentum(),...profanity})});
   const body=await r.json();if(!r.ok)throw Error(body.error||'Sunucu yanıt vermedi');if(epoch!==teacherEpoch)return;
   const answer=String(body.answer||'Yanıt alınamadı');waiting.textContent=answer;conversations.set(t.id,[...history,user,{role:'assistant',content:answer.slice(0,2500)}].slice(-12));
  }catch(e){if(epoch===teacherEpoch)waiting.textContent=controller.signal.aborted?'İstek durduruldu. Tekrar deneyebilirsin.':'Bağlantı hatası: '+e.message}
  finally{clearTimeout(timer);if(activeRequest===controller)activeRequest=null;if(epoch===teacherEpoch)$('send').disabled=false}
 };
}
state=loadLocal();renderLearning();setupAI();renderTeachers();
window.addEventListener('ma-account-changed',changeAccount);changeAccount();
