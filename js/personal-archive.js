import {archiveAssetUrl,decodeArchiveKey,decryptArchiveAsset,createPersonalArchive,scoreOriginalArchiveExam} from '../shared/personal-archive.js';
import {createPracticeAttempt,normalizePracticeExamStore,elapsedPracticeSeconds,updatePracticeAnswer,movePracticeQuestion,pausePracticeAttempt,resumePracticeAttempt,checkpointPracticeAttempt,finishPracticeAttempt} from '../shared/practice-exam-state.js';
import {getCourse} from '../shared/curriculum.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=doc=>String(doc?.fileName||'Kaynak').replace(/\.pdf$/i,'').replaceAll('_',' ').replace(/\bPDF\b/gi,'').replace(/\s+/g,' ').trim();
const time=seconds=>[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
const fold=value=>String(value??'').toLocaleLowerCase('tr-TR');

export function createPersonalArchiveController(){
 let archive=null,access=null,config=null,root=null,epoch=0,owner=window.MAAccount?.getUser()?.id||'guest';
 let mode='questions',docFilter='',courseFilter='',examFilter='',query='',selectedId=null,checkedId=null;
 let activeId=null,resultId=null,store={version:1,attempts:[],retained:[]},canSave=true,error='',tick=0;
 const bitmaps=new Map(),blobUrls=new Set();
 const imageRequests=new WeakMap();
 const el=id=>root?.querySelector('#'+id);
 const storageKey=()=>`ma_original_exams_v1_${owner}`;
 const accessKey=()=>`ma_personal_archive_access_v1_${owner}`;
 const active=()=>store.attempts.find(row=>row.id===activeId);
 const notify=()=>window.dispatchEvent(new CustomEvent('ma-personal-archive-changed'));
 const notice=()=>{const node=el('personalArchiveStatus');if(node)node.textContent=error};
 async function fetchBytes(asset){const response=await fetch(archiveAssetUrl(asset),{referrerPolicy:'no-referrer'});if(!response.ok)throw Error('Kaynak görüntüsü alınamadı.');return response.arrayBuffer()}
 async function loadConfig(){
  if(!config){const response=await fetch(new URL('../data/personal-archive.json',import.meta.url),{cache:'no-store',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('Arşiv şu anda açılamıyor.');const value=await response.json();if(value?.version!==1||!/^personal-[a-f0-9]{16}$/.test(value.id)||value.index?.resource!=='index'||value.index?.compression!=='gzip')throw Error('Arşiv kaydı geçersiz.');archiveAssetUrl(value.index.asset);config=value}
  return config;
 }
 function loadStore(){
  canSave=true;
  try{const raw=localStorage.getItem(storageKey());const next=normalizePracticeExamStore(raw?JSON.parse(raw):null,archive);if(!next)throw Error();store=next;store.attempts=store.attempts.map(row=>row.status==='running'?pausePracticeAttempt(row,row.updatedAt):row)}
  catch{canSave=false;store={version:1,attempts:[],retained:[]};error='Eski kayıt okunamadı; üzerine yazılmadı.'}
 }
 function save(attempt){
  if(!canSave)return false;
  try{
   const raw=localStorage.getItem(storageKey()),disk=normalizePracticeExamStore(raw?JSON.parse(raw):null,archive);if(!disk)throw Error();
   const old=disk.attempts.find(row=>row.id===attempt.id),base=store.attempts.find(row=>row.id===attempt.id);
   if(old&&(!base||old.updatedAt>base.updatedAt||old.status==='completed'&&JSON.stringify(old)!==JSON.stringify(attempt)||JSON.stringify([old.answers,old.index])!==JSON.stringify([base.answers,base.index]))){store=disk;activeId=null;resultId=null;error='Deneme başka bir sekmede güncellendi. Son kayıt yüklendi.';render();return false}
   const rows=new Map([...disk.attempts,...store.attempts].map(row=>[row.id,row]));
   for(const row of disk.attempts)if(row.status==='completed'||row.updatedAt>rows.get(row.id).updatedAt)rows.set(row.id,row);
   rows.set(attempt.id,attempt);const next={...disk,...store,attempts:[...rows.values()],retained:disk.retained};
   localStorage.setItem(storageKey(),JSON.stringify(next));store=next;error='';notice();notify();return true;
  }catch{error='Cevaplar kaydedilemedi. Önceki kayıt korundu; depolama alanını kontrol et.';notice();return false}
 }
 function pause(){const row=active();return !row||row.status!=='running'||save(pausePracticeAttempt(row))}
 function releaseImages(){for(const url of blobUrls)URL.revokeObjectURL(url);blobUrls.clear();for(const promise of bitmaps.values())promise.then(bitmap=>bitmap.close()).catch(()=>{});bitmaps.clear()}
 function closeDialogs(){document.querySelectorAll('[data-personal-dialog]').forEach(dialog=>{dialog.close();dialog.remove()})}
 function lock(){if(!pause())return false;epoch++;try{sessionStorage.removeItem(accessKey())}catch{}archive=null;access=null;activeId=null;resultId=null;selectedId=null;checkedId=null;releaseImages();closeDialogs();store={version:1,attempts:[],retained:[]};error='';notify();render();return true}
 async function unlock(value){
  decodeArchiveKey(value);const generation=++epoch;error='Arşiv açılıyor…';notice();
  try{
   const descriptor=await loadConfig(),bytes=await fetchBytes(descriptor.index.asset);
   const compressed=await decryptArchiveAsset(bytes,value,descriptor.id,'index',descriptor.index.sha256);
   const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
   if(new TextEncoder().encode(raw).length>100000000)throw Error('Arşiv boyutu desteklenmiyor.');
   const next=createPersonalArchive(JSON.parse(raw));if(generation!==epoch)return false;if(next.id!==descriptor.id)throw Error('Arşiv kimliği eşleşmiyor.');
   access=value;archive=next;error='';loadStore();try{sessionStorage.setItem(accessKey(),value)}catch{}
   closeDialogs();window.dispatchEvent(new CustomEvent('ma-personal-archive-unlocked'));notify();render();return true;
  }catch{if(generation===epoch){error='Arşiv açılamadı. Kişisel erişim bağlantısını veya anahtarını kontrol et.';notice();const node=document.getElementById('personalArchiveUnlockStatus');if(node)node.textContent=error}return false}
 }
 function showUnlock(){
  closeDialogs();const dialog=document.createElement('dialog');dialog.id='personalArchiveUnlock';dialog.dataset.personalDialog='';dialog.className='app-dialog';
  dialog.innerHTML='<div class="dialog-heading"><h2>Kişisel arşivini aç</h2><button class="icon-button" id="closePersonalUnlock" aria-label="Kapat">×</button></div><form id="personalUnlockForm"><label for="personalArchiveKey">Erişim anahtarı</label><input class="field" id="personalArchiveKey" type="password" autocomplete="off" spellcheck="false" required maxlength="43"><button class="btn" id="unlockPersonalArchive">Arşivi aç</button><p id="personalArchiveUnlockStatus" role="status"></p></form>';
  document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.querySelector('#closePersonalUnlock').onclick=()=>{dialog.close();dialog.remove()};dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const button=dialog.querySelector('#unlockPersonalArchive');button.disabled=true;try{await unlock(dialog.querySelector('#personalArchiveKey').value.trim())}catch{dialog.querySelector('#personalArchiveUnlockStatus').textContent='Erişim anahtarı geçersiz.'}finally{button.disabled=false}};dialog.showModal();
 }
 function renderGate(){
  if(!root?.isConnected)return;
  root.innerHTML='<div id="questionBankEmpty" class="empty-state" role="status"><h2>Kişisel soru arşivin</h2><p>Gönderdiğin kaynaklar, özgün soru görüntüleri ve denemelerle burada.</p><button id="openPersonalArchive" class="btn">Arşivimi aç</button><p id="personalArchiveStatus" class="status-note"></p></div>';
  el('openPersonalArchive').onclick=showUnlock;notice();
 }
 function shell(){
  root.innerHTML=`<div id="personalArchiveRoot"><div class="section-heading"><div><h2>Gönderdiğin sorular</h2><p class="muted">${archive.counts.documents} kaynak · ${archive.counts.pages.toLocaleString('tr-TR')} sayfa · ${archive.counts.records.toLocaleString('tr-TR')} kayıt</p></div><button id="lockPersonalArchive" class="smallbtn">Kilitle</button></div><div class="filter-pills" id="personalArchiveTabs"><button data-archive-tab="questions">Sorular</button><button data-archive-tab="exams">Denemeler (${archive.exams.length})</button><button data-archive-tab="sources">Kaynaklar</button></div><p id="personalArchiveStatus" class="status-note" role="status"></p><div id="personalArchiveBody"></div></div>`;
  el('lockPersonalArchive').onclick=lock;root.querySelectorAll('[data-archive-tab]').forEach(button=>{button.classList.toggle('active',button.dataset.archiveTab===mode);button.onclick=()=>{if(!pause())return;epoch++;activeId=null;resultId=null;mode=button.dataset.archiveTab;render()}});notice();
 }
 function render(){
  if(!root?.isConnected)return;if(!archive){renderGate();return}shell();
  if(activeId)renderSession();else if(resultId)renderResult();else if(mode==='exams')renderExams();else if(mode==='sources')renderSources();else renderQuestions();
 }
 function filtered(){return archive.questions.filter(q=>(!docFilter||q.docId===docFilter)&&(!courseFilter||q.courseId===courseFilter)&&(!examFilter||q.examType===examFilter)&&(!query||fold(q.prompt+' '+q.topic+' '+q.subtopic+' '+title(archive.getDocument(q.docId))).includes(fold(query))))}
 function renderQuestions(){
  const courses=[...new Map(archive.questions.filter(q=>q.courseId).map(q=>[q.courseId,getCourse(q.courseId)?.title||q.topic])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'tr'));
  el('personalArchiveBody').innerHTML=`<div class="archive-filters"><label>Kaynak<select id="archiveSource" class="field"><option value="">Bütün kaynaklar</option>${archive.documents.filter(doc=>archive.questions.some(q=>q.docId===doc.id)).map(doc=>`<option value="${esc(doc.id)}">${esc(title(doc))}</option>`).join('')}</select></label><label>Sınav<select id="archiveLevel" class="field"><option value="">Tümü</option><option value="TYT">TYT</option><option value="AYT">AYT</option></select></label><label>Konu<select id="archiveCourse" class="field"><option value="">Bütün konular</option>${courses.map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('')}</select></label><label>Ara<input id="archiveSearch" class="field" type="search" maxlength="100" placeholder="Konu veya kaynak"></label></div><p class="muted archive-review-note">Özgün görüntü esastır. İnceleme bekleyen konu ve cevaplar ayrıca belirtilir.</p><div id="archiveQuestionArea"></div>`;
  for(const [id,value]of[['archiveSource',docFilter],['archiveCourse',courseFilter],['archiveLevel',examFilter],['archiveSearch',query]])el(id).value=value;
  for(const id of ['archiveSource','archiveCourse','archiveLevel'])el(id).onchange=()=>{docFilter=el('archiveSource').value;courseFilter=el('archiveCourse').value;examFilter=el('archiveLevel').value;selectedId=null;checkedId=null;renderQuestion()};
  el('archiveSearch').oninput=event=>{query=event.target.value;selectedId=null;checkedId=null;renderQuestion()};renderQuestion();
 }
 function renderQuestion(){
  const rows=filtered();let q=rows.find(row=>row.id===selectedId)||rows[0];selectedId=q?.id||null;
  const area=el('archiveQuestionArea');if(!q){area.innerHTML='<p class="empty-state">Bu seçimde kayıt bulunamadı.</p>';return}
  const index=rows.indexOf(q),doc=archive.getDocument(q.docId);
  area.innerHTML=`<article id="archiveQuestion" data-original-id="${esc(q.id)}"><div class="question-top"><span class="topic-label">${esc(q.examType||'Ortak')} · ${esc(q.topic)}</span><span class="question-count">${index+1} / ${rows.length}</span></div><p class="muted archive-source-label">${esc(title(doc))} · ${q.parts[0]?'Sayfa '+q.parts[0].page:'Konum incelemede'}${q.number!==null?' · Soru '+esc(q.number):''}</p><div id="archiveOriginalImage" class="archive-image" role="status">Soru açılıyor…</div><button id="archiveFullPage" class="text-button">Asıl sayfayı göster</button><div id="archiveAnswerArea" class="archive-answer-area"></div><div id="archiveAnswerFeedback" class="answer-feedback" role="status"></div><section id="archiveSolution" class="ai-solution" hidden></section><details class="question-verification"><summary>Soru bilgisi</summary><p>ORİJİNAL · Özgün kaynak görüntüsü.</p><p>${q.mathPassed?'Bağımsız matematik kontrolü geçti; insan editör incelemesi bekliyor.':'Matematik kontrolü henüz tamamlanmadı. Konu etiketi ön inceleme düzeyinde olabilir.'}</p><p class="question-id">${esc(q.id)}</p></details><div class="question-footer"><button id="previousArchiveQuestion" class="smallbtn" ${index?'':'disabled'}>← Önceki</button><button id="nextArchiveQuestion" class="smallbtn" ${index<rows.length-1?'':'disabled'}>Sonraki →</button></div></article>`;
  const go=delta=>{selectedId=rows[index+delta].id;checkedId=null;renderQuestion()};el('previousArchiveQuestion').onclick=()=>go(-1);el('nextArchiveQuestion').onclick=()=>go(1);el('archiveFullPage').onclick=()=>showPage(doc.id,q.parts[0]?.page||1);
  const answerArea=el('archiveAnswerArea');
  if(q.hasChoices||q.options.length===5){for(const letter of 'ABCDE'){const button=document.createElement('button');button.textContent=letter;button.dataset.originalOption=letter;button.className='smallbtn';button.onclick=()=>checkQuestion(q,letter);answerArea.append(button)}}else{
   answerArea.innerHTML='<form id="archiveWrittenAnswerForm"><label for="archiveWrittenAnswer">Cevabın veya çözüm notun</label><input id="archiveWrittenAnswer" class="field" autocomplete="off" maxlength="300" required><button class="smallbtn" id="saveArchiveWrittenAnswer">Cevabımı kaydet</button><p class="muted">Açık uçlu veya seçenek yerleşimi incelemede olan kayıt. Şık uydurulmaz; soru özgün görüntüdedir.</p></form>';
   el('archiveWrittenAnswerForm').onsubmit=event=>{event.preventDefault();const value=el('archiveWrittenAnswer').value.trim();if(!value||checkedId===q.id||!saveSoloResponse(q,value))return;checkedId=q.id;el('archiveWrittenAnswer').disabled=true;el('saveArchiveWrittenAnswer').disabled=true;el('archiveAnswerFeedback').textContent='Cevabın kaydedildi. Bu yanıt için doğrulanmış anahtar eşleşmesi yok; puan verilmedi.'};
  }
  paintQuestion(q,el('archiveOriginalImage'));
 }
 function checkQuestion(q,letter){
  if(checkedId===q.id||!saveSoloResponse(q,letter))return;checkedId=q.id;const feedback=el('archiveAnswerFeedback');
  root.querySelectorAll('[data-original-option]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.originalOption===letter));button.disabled=true});
  const value=q.answer.value;
  feedback.textContent=q.mathPassed&&/^[ABCDE]$/.test(value)?(letter===value?'✓ Doğru.':'Doğru cevap: '+value)+ ' Bağımsız kontrol edilmiş cevap.':value?'Arşivdeki cevap kaydı: '+value+'. Bağımsız kontrolü henüz tamamlanmadı; doğrulanmış sonuç sayılmadı.':'Cevap anahtarı henüz eşleşmedi. Yanlış sonuç üretilmedi.';
  if(q.solutionSteps.length){const section=el('archiveSolution');section.hidden=false;const heading=document.createElement('h3');heading.textContent='Kayıtlı çözüm';const list=document.createElement('ol');for(const step of q.solutionSteps){const item=document.createElement('li');item.textContent=step;list.append(item)}section.append(heading,list)}
 }
 function saveSoloResponse(q,response){
  try{const key='ma_original_practice_v1_'+owner,raw=localStorage.getItem(key),rows=raw?JSON.parse(raw):[];if(!Array.isArray(rows))throw Error();rows.push({id:crypto.randomUUID(),questionId:q.id,answer:response,correct:q.mathPassed&&q.hasChoices&&/^[ABCDE]$/.test(q.answer.value)&&/^[ABCDE]$/.test(response)?response===q.answer.value:null,at:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(rows));error='';notice();notify();return true}catch{error='Yanıt bu tarayıcıya kaydedilemedi. Önceki kayıtlar korundu.';notice();return false}
 }
 function addImageTools(target,canvas){
  const tools=document.createElement('div');tools.className='archive-zoom-tools';let zoom=1;
  const less=document.createElement('button'),more=document.createElement('button'),label=document.createElement('span');less.type=more.type='button';less.textContent='−';more.textContent='+';less.setAttribute('aria-label','Görüntüyü küçült');more.setAttribute('aria-label','Görüntüyü büyüt');
  const set=()=>{canvas.style.maxWidth='none';canvas.style.width=(zoom*100)+'%';label.textContent=Math.round(zoom*100)+'%';less.disabled=zoom<=1;more.disabled=zoom>=3};less.onclick=()=>{zoom=Math.max(1,zoom-.5);set()};more.onclick=()=>{zoom=Math.min(3,zoom+.5);set()};tools.append(less,label,more);target.prepend(tools);set();
 }
 async function pageBitmap(docId,number){
  const doc=archive.getDocument(docId),page=doc?.pages[number-1];if(!page)throw Error('Kaynak sayfası bulunamadı.');
  const id=docId+':'+number;
  if(!bitmaps.has(id)){
   const bundle=archive.id,key=access;
   const promise=(async()=>createImageBitmap(new Blob([await decryptArchiveAsset(await fetchBytes(page.asset),key,bundle,page.resource,page.sha256)],{type:'image/webp'})))();
   bitmaps.set(id,promise);promise.catch(()=>bitmaps.delete(id));
   if(bitmaps.size>5){const oldest=bitmaps.keys().next().value;const old=bitmaps.get(oldest);bitmaps.delete(oldest);old.then(bitmap=>setTimeout(()=>bitmap.close(),10000)).catch(()=>{})}
  }
  return bitmaps.get(id);
 }
 async function paintQuestion(q,target){
  const generation=epoch,ownArchive=archive,request=Symbol();imageRequests.set(target,request);
  try{
   if(!q.parts.length)throw Error('Konum incelemede. Asıl kaynağın bütün sayfaları Kaynaklar bölümünde açık.');
   const pieces=[];
   for(const part of q.parts){const page=archive.getDocument(q.docId).pages[part.page-1],bitmap=await pageBitmap(q.docId,part.page),r=part.rect||page.rect;
    const sx=Math.max(0,Math.floor((r[0]-page.rect[0])/(page.rect[2]-page.rect[0])*bitmap.width)),sy=Math.max(0,Math.floor((r[1]-page.rect[1])/(page.rect[3]-page.rect[1])*bitmap.height));
    const sw=Math.max(1,Math.min(bitmap.width-sx,Math.ceil((r[2]-r[0])/(page.rect[2]-page.rect[0])*bitmap.width))),sh=Math.max(1,Math.min(bitmap.height-sy,Math.ceil((r[3]-r[1])/(page.rect[3]-page.rect[1])*bitmap.height)));
    pieces.push({bitmap,sx,sy,sw,sh});
   }
   if(generation!==epoch||ownArchive!==archive||!target.isConnected||imageRequests.get(target)!==request)return;
   const canvas=document.createElement('canvas');canvas.width=Math.max(...pieces.map(p=>p.sw));canvas.height=pieces.reduce((sum,p)=>sum+p.sh,0)+12*(pieces.length-1);const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);let y=0;
   for(const p of pieces){context.drawImage(p.bitmap,p.sx,p.sy,p.sw,p.sh,0,y,p.sw,p.sh);y+=p.sh+12}
   canvas.setAttribute('aria-label','Özgün soru, şekiller ve seçenekler');canvas.setAttribute('role','img');target.replaceChildren(canvas);addImageTools(target,canvas);target.removeAttribute('role');
  }catch(e){if(generation===epoch&&target.isConnected&&imageRequests.get(target)===request)target.textContent=e.message||'Görüntü açılamadı; asıl sayfayı görüntüleyebilirsin.'}
 }
 function renderSources(){
  el('personalArchiveBody').innerHTML='<label>Kaynak<select id="archiveDocumentSelect" class="field"></select></label><div class="archive-page-tools"><button id="archivePreviousPage" class="smallbtn">← Önceki</button><span id="archivePageCount"></span><button id="archiveNextPage" class="smallbtn">Sonraki →</button></div><div id="archiveSourcePage" class="archive-image"></div>';
  const select=el('archiveDocumentSelect');for(const doc of archive.documents){const option=document.createElement('option');option.value=doc.id;option.textContent=title(doc);select.append(option)}
  let page=1;select.value=docFilter&&archive.getDocument(docFilter)?docFilter:archive.documents[0].id;
  const draw=()=>{const doc=archive.getDocument(select.value);el('archivePageCount').textContent=page+' / '+doc.pages.length;el('archivePreviousPage').disabled=page===1;el('archiveNextPage').disabled=page===doc.pages.length;paintPage(doc.id,page,el('archiveSourcePage'))};
  select.onchange=()=>{page=1;draw()};el('archivePreviousPage').onclick=()=>{page--;draw()};el('archiveNextPage').onclick=()=>{page++;draw()};draw();
 }
 async function paintPage(docId,number,target){const generation=epoch,request=Symbol();imageRequests.set(target,request);target.textContent='Sayfa açılıyor…';try{const bitmap=await pageBitmap(docId,number);if(generation!==epoch||!target.isConnected||imageRequests.get(target)!==request)return;const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);canvas.setAttribute('aria-label','Özgün kaynak sayfası '+number);canvas.setAttribute('role','img');target.replaceChildren(canvas);addImageTools(target,canvas)}catch{if(generation===epoch&&target.isConnected&&imageRequests.get(target)===request)target.textContent='Sayfa alınamadı. Yeniden deneyebilirsin.'}}
 function showPage(docId,number){
  const dialog=document.createElement('dialog');dialog.className='app-dialog archive-page-dialog';dialog.dataset.personalDialog='';dialog.innerHTML='<div class="dialog-heading"><h2>Özgün sayfa</h2><button class="icon-button" aria-label="Kapat">×</button></div><div class="archive-image" id="personalPageImage"></div>';
  document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.querySelector('button').onclick=()=>{dialog.close();dialog.remove()};dialog.showModal();paintPage(docId,number,dialog.querySelector('#personalPageImage'));
 }
 function renderExams(){
  const body=el('personalArchiveBody');body.innerHTML='<p class="muted">Gönderdiğin özgün TYT denemeleri. Her biri 40 soru; sorular değiştirilmez. Sonuç yayınevinin cevap anahtarına göre hesaplanır.</p><div id="originalExamList" class="practice-exam-grid"></div>';
  for(const exam of archive.exams){const rows=store.attempts.filter(row=>row.examId===exam.id),done=rows.filter(row=>row.status==='completed').sort((a,b)=>b.completedAt-a.completedAt),draft=rows.filter(row=>row.status!=='completed').sort((a,b)=>b.updatedAt-a.updatedAt)[0];const card=document.createElement('article');card.className='surface practice-exam-card';card.dataset.originalExamId=exam.id;card.innerHTML=`<div class="section-heading"><h2>${exam.number}. Deneme</h2>${done.length?'<span class="exam-completed" aria-label="Tamamlandı">✓</span>':''}</div><p class="exam-card-meta">Orijinal · TYT · 40 soru</p><div class="exam-card-actions"></div>`;
   const actions=card.querySelector('.exam-card-actions'),button=document.createElement('button');button.className='btn';button.textContent=draft?'Devam et':done.length?'Bir daha çöz':'Başla';button.dataset.originalExamStart=exam.id;button.disabled=!canSave;button.onclick=()=>{const row=draft?resumePracticeAttempt(draft):createPracticeAttempt(exam,{id:crypto.randomUUID()});if(save(row)){activeId=row.id;resultId=null;render();window.scrollTo({top:0,behavior:'instant'})}};actions.append(button);
   if(done.length){const review=document.createElement('button');review.className='smallbtn';review.textContent='Sonucu gör';review.dataset.originalExamReview=done[0].id;review.onclick=()=>{resultId=done[0].id;activeId=null;render()};actions.append(review)}el('originalExamList').append(card);
  }
 }
 function renderSession(){
  const row=active(),exam=archive.getExam(row?.examId);if(!row||!exam){activeId=null;renderExams();return}const paused=row.status==='paused';
  el('personalArchiveBody').innerHTML=`<div class="practice-exam-toolbar"><h3>Orijinal TYT · ${exam.number}. Deneme</h3><time id="originalExamTimer" class="exam-clock">${time(elapsedPracticeSeconds(row))}</time><button id="pauseOriginalExam" class="smallbtn">${paused?'Devam et':'Duraklat'}</button><button id="leaveOriginalExam" class="smallbtn">Deneme listesi</button></div><p class="exam-paused-note" ${paused?'':'hidden'}>Süre durdu. Soruları görmek için devam et.</p><div class="practice-exam-session-layout"><article id="originalExamQuestion" class="surface practice-exam-question" ${paused?'hidden':''}></article><aside class="surface practice-exam-optical"><h3>Cevap kâğıdı</h3><div id="originalExamOptical" class="optical-grid"></div><button id="finishOriginalExam" class="btn">Denemeyi bitir</button></aside></div><dialog id="originalExamFinishDialog" class="app-dialog"><h2>Deneme bitirilsin mi?</h2><p>${row.answers.filter(v=>v===null).length} boş soru var.</p><button id="cancelOriginalExamFinish" class="smallbtn">Devam et</button><button id="confirmOriginalExamFinish" class="btn">Bitir ve sonucu gör</button></dialog>`;
  el('pauseOriginalExam').onclick=()=>{if(save(paused?resumePracticeAttempt(active()):pausePracticeAttempt(active())))render()};el('leaveOriginalExam').onclick=()=>{if(pause()){activeId=null;render()}};
  el('finishOriginalExam').onclick=()=>el('originalExamFinishDialog').showModal();el('cancelOriginalExamFinish').onclick=()=>el('originalExamFinishDialog').close();el('confirmOriginalExamFinish').onclick=()=>{const current=active(),score=scoreOriginalArchiveExam(exam,current.answers,archive);if(!score){el('originalExamFinishDialog').close();error='Anahtar doğrulanamadı. Cevapların korundu; sonuç üretilmedi.';notice();return}if(save(finishPracticeAttempt(current,score))){resultId=current.id;activeId=null;render()}else el('originalExamFinishDialog')?.close()};renderExamQuestion();
 }
 function renderExamQuestion(){
  const row=active(),q=archive.getQuestion(row.questionIds[row.index]),target=el('originalExamQuestion');target.dataset.originalId=q.id;
  target.innerHTML=`<div class="question-top"><span class="topic-label">Özgün soru</span><span>${row.index+1} / 40</span></div><div id="originalExamImage" class="archive-image"></div><button id="originalExamSourcePage" class="text-button">Asıl sayfayı göster</button><div id="originalExamChoices" class="archive-answer-area"></div><div class="exam-question-actions"><button id="previousOriginalExamQuestion" class="smallbtn" ${row.index?'':'disabled'}>← Önceki</button><button id="nextOriginalExamQuestion" class="smallbtn" ${row.index<39?'':'disabled'}>Sonraki →</button></div>`;
  for(const letter of 'ABCDE'){const button=document.createElement('button');button.textContent=letter;button.className='smallbtn';button.dataset.examOriginalOption=letter;button.setAttribute('aria-pressed',String(row.answers[row.index]===letter));button.disabled=row.status!=='running';button.onclick=()=>{if(save(updatePracticeAnswer(active(),row.index,row.answers[row.index]===letter?null:letter)))renderExamQuestion()};el('originalExamChoices').append(button)}
  const navigate=index=>{if(save(movePracticeQuestion(active(),index))){renderExamQuestion();el('originalExamQuestion').scrollIntoView({behavior:'instant',block:'start'})}};
  el('previousOriginalExamQuestion').onclick=()=>navigate(row.index-1);el('nextOriginalExamQuestion').onclick=()=>navigate(row.index+1);el('originalExamSourcePage').onclick=()=>showPage(q.docId,q.parts[0]?.page||1);paintQuestion(q,el('originalExamImage'));
  const sheet=el('originalExamOptical');sheet.replaceChildren();row.answers.forEach((answer,i)=>{const button=document.createElement('button');button.textContent=(i+1)+(answer?' · '+answer:'');button.dataset.originalIndex=i;button.className=answer?'answered':'';if(i===row.index)button.setAttribute('aria-current','true');button.disabled=row.status!=='running';button.onclick=()=>navigate(i);sheet.append(button)});
 }
 function renderResult(){
  const row=store.attempts.find(attempt=>attempt.id===resultId),exam=archive.getExam(row?.examId),score=scoreOriginalArchiveExam(exam,row?.answers,archive);if(!row||row.status!=='completed'||!score){resultId=null;renderExams();return}
  el('personalArchiveBody').innerHTML=`<section id="originalExamResult" class="surface practice-exam-result"><h2>✓ ${exam.number}. Deneme tamamlandı</h2><p>40 soru · ${time(elapsedPracticeSeconds(row))}</p><div class="practice-score-grid"><div><strong>${score.correct}</strong><span>Doğru</span></div><div><strong>${score.wrong}</strong><span>Yanlış</span></div><div><strong>${score.blank}</strong><span>Boş</span></div><div><strong>${score.net.toFixed(2)}</strong><span>Alıştırma neti</span></div></div><p class="muted">Yayınevi anahtarına göre hesaplandı. Bütün soruların bağımsız matematik kontrolü tamamlanmadı; resmî ÖSYM sonucu değildir.</p><div class="exam-card-actions"><button id="originalResultBack" class="smallbtn">Deneme listesi</button><button id="retryOriginalExam" class="btn">Bir daha çöz</button><button id="originalAnswerEvidence" class="smallbtn">Cevap anahtarını göster</button></div><div id="originalExamReview" class="practice-review-list"></div></section>`;
  el('originalResultBack').onclick=()=>{resultId=null;render()};el('retryOriginalExam').onclick=()=>{const fresh=createPracticeAttempt(exam,{id:crypto.randomUUID()});if(save(fresh)){activeId=fresh.id;resultId=null;render()}};el('originalAnswerEvidence').onclick=()=>showPage(exam.keyDocId,exam.keyPage);
  exam.questionIds.forEach((id,i)=>{const q=archive.getQuestion(id),details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=(i+1)+'. soru · Cevabın: '+(row.answers[i]||'Boş')+' · Yayınevi: '+exam.answerKey[i];details.append(summary);details.addEventListener('toggle',()=>{if(details.open&&!details.querySelector('.archive-image')){const image=document.createElement('div');image.className='archive-image';details.append(image);paintQuestion(q,image);if(q.solutionSteps.length){const text=document.createElement('p');text.textContent=q.solutionSteps.join('\n');details.append(text)}}});el('originalExamReview').append(details)});
 }
 function mount(node){root=node;render()}
 function summary(){
  if(!archive)return {exams:[],practice:[]};let practice=[];try{const rows=JSON.parse(localStorage.getItem('ma_original_practice_v1_'+owner)||'[]');if(Array.isArray(rows))practice=rows.filter(row=>archive.getQuestion(row?.questionId)&&typeof row.answer==='string'&&row.answer.trim()&&row.answer.length<=300).map(row=>{const q=archive.getQuestion(row.questionId);return {...row,correct:q.mathPassed&&q.hasChoices&&/^[ABCDE]$/.test(q.answer.value)&&/^[ABCDE]$/.test(row.answer)?row.answer===q.answer.value:null}})}catch{}
  return {practice,exams:store.attempts.filter(row=>row.status==='completed').map(row=>({id:row.id,type:row.type,number:row.number,completedAt:row.completedAt,duration:elapsedPracticeSeconds(row),score:scoreOriginalArchiveExam(archive.getExam(row.examId),row.answers,archive),answeredQuestionIds:row.questionIds.filter((id,i)=>row.answers[i]!==null)}))};
 }
 window.MAPersonalArchive={getSummary:summary,openResult:id=>{const row=store.attempts.find(item=>item.id===id);if(!archive||row?.status!=='completed'||!pause())return;resultId=id;activeId=null;mode='exams';window.dispatchEvent(new CustomEvent('ma-personal-archive-open'));render()}};
 window.addEventListener('ma-account-changed',()=>{const next=window.MAAccount?.getUser()?.id||'guest';if(next===owner)return;pause();epoch++;try{sessionStorage.removeItem(accessKey())}catch{}archive=null;access=null;releaseImages();closeDialogs();owner=next;activeId=null;resultId=null;selectedId=null;store={version:1,attempts:[],retained:[]};error='';notify();render()});
 window.addEventListener('storage',event=>{if(event.key===storageKey()&&archive){epoch++;activeId=null;resultId=null;loadStore();error='Başka sekmedeki son kayıt yüklendi.';render()}});
 document.querySelector('.nav').addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(button&&button.dataset.page!=='study'){if(!pause()){event.preventDefault();event.stopImmediatePropagation()}else if(activeId)render()}},true);
 window.addEventListener('beforeunload',event=>{if(!pause()){event.preventDefault();event.returnValue=''}});window.addEventListener('pagehide',pause);
 setInterval(()=>{const row=active();if(!archive||!root?.isConnected||!row||row.status!=='running')return;const node=el('originalExamTimer');if(node)node.textContent=time(elapsedPracticeSeconds(row));if(++tick%5===0)save(checkpointPracticeAttempt(row))},1000);
 window.addEventListener('load',async()=>{const params=new URLSearchParams(location.hash.slice(1)),value=params.get('archive');if(value){history.replaceState(history.state,'',location.pathname+location.search);window.dispatchEvent(new CustomEvent('ma-personal-archive-open'));try{await unlock(value)}catch{error='Erişim bağlantısı geçersiz.';notice()}}else{let saved;try{saved=sessionStorage.getItem(accessKey())}catch{}if(saved)await unlock(saved)}});
 return {mount,isUnlocked:()=>!!archive,getCount:()=>archive?.questions.length||0,lock,openExams:()=>{mode='exams';if(!archive){showUnlock();return}if(pause()){activeId=null;resultId=null;render()}},pause:()=>{const saved=pause();if(saved&&activeId&&root?.isConnected)render();return saved}};
}
