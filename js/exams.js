import {QUESTION_BANK} from '../data/question-bank.js';
import {verifiedExam} from '../shared/question-bank.js';
import {EXAM_YEARS, TOPIC_LABELS, validAnswers, normalizeFlags, normalizeTopics, elapsedSeconds, pauseSession, resumeSession, fullSessionSeconds, validateDraft, reviewQuestions, topicStats, compareRecords} from '../shared/exam-model.js';

(()=>{
const el=id=>document.getElementById(id);
const nav=document.querySelector('.nav');const tab=document.createElement('button');tab.textContent='📝 Denemeler';tab.dataset.page='mockexam';nav.append(tab);
const sec=document.createElement('section');sec.id='mockexam';sec.className='hide exam-wrap';document.querySelector('.wrap').append(sec);
const KEY='matematik_akademim_exam_history_v11';let records=[];try{records=JSON.parse(localStorage.getItem(KEY)||'[]')}catch{};if(!Array.isArray(records))records=[];
let session=null,ticker=null,auth=null,config={url:'https://clgtwtfzhkwhiuvrmimi.supabase.co',key:'sb_publishable_aJDmKhDc4TlY2Op374nZEA_3mtBq2FQ'};records=[];let activeKey=KEY+'_guest';function loadRecords(k){activeKey=k;try{records=JSON.parse(localStorage.getItem(k)||'[]')}catch{records=[]}if(!Array.isArray(records))records=[];records=records.filter(validRecord).map(r=>({...r,verified:false}))}loadRecords(activeKey);
function validRecord(r){return r&&typeof r.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(r.id)&&['TYT','AYT'].includes(r.type)&&Number.isFinite(Date.parse(r.date))&&Number.isFinite(r.duration)&&r.duration>=0&&[r.correct,r.wrong,r.blank].every(v=>Number.isInteger(v)&&v>=0&&v<=40)&&(r.net===null||Number.isFinite(r.net))&&(!r.year||EXAM_YEARS.includes(r.year))&&(!r.markedAnswers||(Array.isArray(r.markedAnswers)&&r.markedAnswers.length===40&&r.markedAnswers.every(a=>a===null||/^[ABCDE]$/.test(a))))}
const safe=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const save=()=>{try{localStorage.setItem(activeKey,JSON.stringify(records));return true}catch{storageError();return false}};
function storageError(){const target=el('storageStatus');if(target)target.textContent='Tarayıcı kaydı yapılamadı. Depolama alanını ve tarayıcı izinlerini kontrol et; bu ekranı kapatmadan cevaplarını yedekle.'}
const seconds=n=>`${Math.floor(n/3600).toString().padStart(2,'0')}:${Math.floor(n%3600/60).toString().padStart(2,'0')}:${Math.floor(n%60).toString().padStart(2,'0')}`;
const elapsed=()=>elapsedSeconds(session);
function shell(){sec.innerHTML=`<div class="hero"><div class="muted tiny">Matematik Akademim</div><h1>Denemelerim</h1><div class="muted">Doğrulanmış sınavlar, yerel kitapçık çalışması ve kişisel sonuçların.</div></div><p id="storageStatus" role="status" class="exam-muted"></p><div id="examBody"></div>`;home()}
// A local answer sheet never establishes a source's identity, completeness or rights.
// Canonical full exams can only come from the reviewed question registry.
const OFFICIAL=Object.fromEntries(EXAM_YEARS.map(year=>[year,{TYT:null,AYT:null,start:{TYT:1,AYT:1}}]));
const examCache=new Map();
const examFor=(type,year)=>{const key=type+'_'+Number(year);if(!examCache.has(key))examCache.set(key,verifiedExam(QUESTION_BANK,type,Number(year)));return examCache.get(key)};
const sourceFor=(type,year)=>examFor(type,year)?.source.originalUrl||null;
const pdfFor=(type,year)=>{const approved=examFor(type,year);return approved?.source.license.allowsEmbed===true&&/^[a-f0-9]{64}$/.test(approved.source.pdfSha256||'')?approved:null};

let pdfObjectURL=null; let finalSnapshot=null;let loginBusy=false;let refreshTask=null;let syncingEpoch=null;let accountEpoch=0;
const draftKey=()=>activeKey+'_unfinished_exam';
const writeDraft=()=>{if(session)try{localStorage.setItem(draftKey(),JSON.stringify(session))}catch{storageError()}};
function readDraft(){try{const d=validateDraft(JSON.parse(localStorage.getItem(draftKey())||'null'));return d?{...d,source:sourceFor(d.type,d.year)}:null}catch{return null}}
function clearDraft(){try{localStorage.removeItem(draftKey())}catch{}}
function idb(){return new Promise((res,rej)=>{try{let req=indexedDB.open('MatematikAkademimPdf',1);req.onupgradeneeded=()=>req.result.createObjectStore('pdfs');req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)}catch(e){rej(e)}})}
async function getPDF(key){let db=await idb();return new Promise((res,rej)=>{let t=db.transaction('pdfs','readonly');let q=t.objectStore('pdfs').get(key);q.onsuccess=()=>{let v=q.result;db.close();res(v)};q.onerror=()=>{db.close();rej(q.error)}})}
async function putPDF(key,blob){let db=await idb();return new Promise((res,rej)=>{let t=db.transaction('pdfs','readwrite');t.objectStore('pdfs').put(blob,key);t.oncomplete=()=>{db.close();res()};t.onerror=()=>{db.close();rej(t.error)}})}
function getBookID(){return session.year+'_'+session.type}
async function setPDFSource(blob,expectedSession=session){
const approved=expectedSession&&pdfFor(expectedSession.type,expectedSession.year);
if(!approved)throw Error('Kaynak, kullanım izni, tamlık ve özgün PDF özeti doğrulanmadığı için bu dosya gösterilemez.');
if(!(blob instanceof Blob)||blob.size>50*1024*1024||await blob.slice(0,5).text()!=='%PDF-')throw Error('Geçerli bir PDF dosyası seçmelisin.');
const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
if(digest!==approved.source.pdfSha256)throw Error('Dosya, doğrulanmış kaynak PDF’siyle eşleşmiyor.');
if(session!==expectedSession||!el('realPdf'))return false;
const frame=el('realPdf');const pdf=new Blob([blob],{type:'application/pdf'});
if(pdfObjectURL)URL.revokeObjectURL(pdfObjectURL);
pdfObjectURL=URL.createObjectURL(pdf);frame.src=pdfObjectURL+'#page='+OFFICIAL[session.year].start[session.type]+'&zoom=page-fit';
el('goMath').disabled=false;el('enlargePdf').disabled=false;
el('pdfStatus').textContent='Kaynağı, kullanım izni ve dosya özeti doğrulanmış özgün PDF gösteriliyor.';return true;
}
async function showStoredPdf(){
const s=session;if(!s||!el('realPdf'))return;
const approved=examFor(s.type,s.year),pdf=pdfFor(s.type,s.year);
if(!pdf){el('pdfStatus').textContent=approved?'Doğrulanmış sorular aşağıdaki kartta özgün sırasıyla gösterilir. PDF için izin ve dosya özeti doğrulanmadığından PDF yükleme kapalı.':'Kaynak, kullanım izni ve 40 soruluk tamlık doğrulanmadığı için soru veya yerel PDF gösterilmez. PDF yükleme kapalı; eski dosyalar ve kişisel kayıtlar silinmedi.';return}
try{const blob=await getPDF(getBookID());if(session!==s)return;if(blob){await setPDFSource(blob,s);return}}
catch{if(session!==s)return;el('pdfStatus').textContent='Önbellekteki dosya doğrulanmış kaynakla eşleşmedi; gösterilmedi.'}
try{const response=await fetch(pdf.source.originalUrl,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Kaynak PDF yüklenemedi');const blob=await response.blob();if(session===s)await setPDFSource(blob,s)}
catch{if(session===s&&el('pdfStatus'))el('pdfStatus').textContent='İzinli PDF teknik olarak içeride açılamadı. Yalnızca aynı doğrulanmış dosyayı seçebilirsin; eşleşmeyen dosya gösterilmez.'}
}

function stopTick(){if(ticker){clearInterval(ticker);ticker=null}}
function updateClock(){if(!session)return;let t=el('examClock');if(t)t.textContent=seconds(elapsed());const remaining=el('examRemaining');if(remaining)remaining.textContent=session.limit?'Kalan '+seconds(Math.max(0,session.limit-elapsed())):'Serbest süre';if(session.limit && elapsed()>=session.limit){finish(true)}}
function home(){writeDraft();stopTick();session=null;if(pdfObjectURL){URL.revokeObjectURL(pdfObjectURL);pdfObjectURL=null;}
el('examBody').innerHTML=`<div class="card"><h2>Kaynak denetimli sınav ve kitapçık çalışması</h2><p class="exam-muted">2018–2026 TYT / AYT için yalnızca kaynağı, kullanım izni, özgün 40 soru sırası ve cevap anahtarı doğrulanan sınavlar tam deneme olarak açılır. Doğrulanmış sınav bulunmadığında soru veya yerel PDF gösterilmez. Mevcut kayıtlar ve boş cevap alanları korunur; bu alanların varlığı sınavın tamlığını doğrulamaz.</p><div class="exam-setup"><div><label for="examMode">Çalışma modu</label><select id="examMode" class="exam-select"><option value="math">Yalnızca matematik</option><option value="full">Tam oturum süre ön ayarı</option></select></div><div><label for="realYear">Yıl</label><select id="realYear" class="exam-select">${Object.keys(OFFICIAL).reverse().map(y=>`<option value="${y}">${y}</option>`).join('')}</select></div><div><label for="examLimit">Süre sınırı</label><select id="examLimit" class="exam-select"><option value="0">Serbest kronometre</option><option value="3600">60 dakika</option><option value="5400">90 dakika</option></select></div></div><p id="examModeNote" class="exam-muted">Serbest veya süreli cevap çalışma alanı; kaynaksız soru gösterilmez.</p><div class="exam-tabs"><button class="btn" id="startTYT">TYT · 40 cevap alanı</button><button class="btn secondary" id="startAYT">AYT · 40 cevap alanı</button></div><div id="continueHolder"></div><p class="exam-muted" id="examSourceGate" role="status"></p></div><div class="card"><h2>Hesabım ve bulut kayıt</h2><div id="account"></div></div><div class="card"><div class="row"><h2>Deneme geçmişi</h2><button class="smallbtn" id="exportHistory">CSV indir</button><span class="exam-muted" id="recordCount"></span></div><div id="history"></div><div id="comparison"></div></div>`;
function updateSourceGate(){const year=Number(el('realYear').value);const tyt=examFor('TYT',year),ayt=examFor('AYT',year);el('startTYT').textContent=tyt?'TYT Matematik · 40 doğrulanmış soru':'TYT · 40 cevap alanı';el('startAYT').textContent=ayt?'AYT Matematik · 40 doğrulanmış soru':'AYT · 40 cevap alanı';el('examSourceGate').textContent=tyt||ayt?'Yalnızca doğrulanmış oturum tam sınav olarak açılır. Diğer oturumda soru gösterilmez.':'Bu yıl için tamlığı, kullanım izni ve nihai anahtarı doğrulanmış TYT/AYT sınavı yok. Boş cevap alanı açılır; kaynaksız soru veya PDF gösterilmez, otomatik resmî puanlama yapılmaz.'}el('realYear').onchange=updateSourceGate;updateSourceGate();el('examMode').onchange=()=>{const full=el('examMode').value==='full';el('examLimit').disabled=full;el('examModeNote').textContent=full?'Seçilen yılın TYT/AYT süre ön ayarı kullanılır. Bu süre ön ayarı soru ya da kitapçık sağlamaz; diğer derslerin testleri bu alana dahil değildir.':'Serbest veya süreli cevap çalışma alanı; kaynaksız soru gösterilmez.'};el('startTYT').onclick=()=>start('TYT');el('startAYT').onclick=()=>start('AYT');let d=readDraft();if(d){el('continueHolder').innerHTML=`<button class="btn secondary wide" id="continueExam">Yarım kalan ${d.year} ${d.type} denemeye dön</button>`;el('continueExam').onclick=()=>{session=d;if(d.finishedDuration!==undefined){finish(true);return}renderExam();if(session)ticker=setInterval(updateClock,1000)}}account();history();el('exportHistory').onclick=exportHistory}
function exportHistory(){const rows=[['Tür','Yıl','Tarih','Doğru','Yanlış','Boş','Net','Süre (sn)','Değerlendirme'],...records.map(r=>[r.type,r.year||'',r.date,r.correct,r.wrong,r.blank,r.net??'',r.duration,r.net===null?'Puanlanmadı':r.verified?'Resmî':'Manuel'])];const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='deneme-gecmisim.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function history(){if(!el('history'))return;el('recordCount').textContent=records.length+' kayıt';el('history').innerHTML=records.length?records.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).map(r=>`<div class="exam-result"><b>${safe(r.type)} ${r.year?safe(r.year):'Eski alıştırma'} · ${r.net===null?'Puanlanmadı':Number(r.net).toFixed(2)+' net'}</b><div class="exam-muted">${safe(new Date(r.date).toLocaleString('tr-TR'))} · ${r.net===null?'Cevap anahtarı bekliyor':r.correct+' D / '+r.wrong+' Y / '+r.blank+' B'} · ${seconds(r.duration)} ${r.year?'· '+(r.verified?'ÖSYM cevap anahtarı':r.net===null?'Anahtar bekleniyor':'Doğrulanmamış değerlendirme'):''}</div>${Array.isArray(r.markedAnswers)&&r.markedAnswers.length===40?'<details><summary>Cevaplarımı göster</summary><p class="exam-muted">'+r.markedAnswers.map((a,i)=>(i+1)+': '+safe(a||'Boş')).join(' · ')+'</p></details>':''}${historyReview(r)}${r.net===null&&r.markedAnswers?.length===40?'<button class="smallbtn review-result" data-record="'+safe(r.id)+'">Manuel anahtarla değerlendir</button>':''}</div>`).join(''):'<p class="exam-muted">Henüz kaydedilmiş deneme yok.</p>';sec.querySelectorAll('.review-result').forEach(b=>b.onclick=()=>{const rec=records.find(r=>r.id===b.dataset.record);if(rec)reviewUnscored(rec)});renderComparison()}
function historyReview(record){
const review=reviewQuestions(record);if(!review.length)return '';
const wrongs=review.filter(q=>q.status!=='correct');const groups=topicStats(record);
return `<details><summary>Yanlışlar ve konu analizi</summary><p class="exam-muted">Kaydedilmiş manuel anahtara göre. Konular senin etiketlerindir.</p><div class="wrong-list">${wrongs.length?wrongs.map(q=>`<span>${q.number}. soru <b>${q.answer||'Boş'} → ${q.key}</b>${q.topic?' · '+safe(q.topic):''}</span>`).join(''):'<p>Yanlış veya boş yok.</p>'}</div>${groups.length?groups.map(g=>`<p class="exam-muted">${safe(g.topic)}: ${g.correct} D / ${g.wrong} Y / ${g.blank} B (${g.total} etiketli soru)</p>`).join(''):'<p class="exam-muted">Konu etiketi yok; konu başarısı hesaplanmadı.</p>'}</details>`;
}
function renderComparison(){
const holder=el('comparison');if(!holder)return;const sorted=records.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
if(sorted.length<2){holder.innerHTML='';return}
const options=sorted.map(r=>`<option value="${safe(r.id)}">${safe(r.year||'Eski')} ${safe(r.type)} · ${safe(new Date(r.date).toLocaleDateString('tr-TR'))} · ${r.net===null?'Puanlanmadı':r.net.toFixed(2)+' net'} · ${r.mode==='full'?'Oturum süreli':'Matematik'}</option>`).join('');
holder.innerHTML=`<details><summary>İki denemeyi karşılaştır</summary><label for="compareFirst">İlk deneme</label><select id="compareFirst" class="exam-select">${options}</select><label for="compareSecond">İkinci deneme</label><select id="compareSecond" class="exam-select">${options}</select><p id="compareResult" class="exam-muted" role="status"></p></details>`;
el('compareSecond').value=sorted.at(-1).id;el('compareFirst').value=sorted.at(-2).id;
const update=()=>{const first=records.find(r=>r.id===el('compareFirst').value),second=records.find(r=>r.id===el('compareSecond').value);const result=compareRecords(first,second);el('compareResult').textContent=first?.id===second?.id?'İki farklı deneme seç.':!result?'Aynı sınav türünü ve çalışma modunu seç.':`${result.netDifference===null?'Net karşılaştırması için iki sonuç da puanlanmalı.':'İkinci denemenin net farkı: '+(result.netDifference>=0?'+':'')+result.netDifference.toFixed(2)+'.'} Süre farkı: ${result.durationDifference>=0?'+':'−'}${seconds(Math.abs(result.durationDifference))}. Farklı kitapçıkların zorlukları değişebilir.`};
el('compareFirst').onchange=update;el('compareSecond').onchange=update;update();
}
function start(type){let year=Number(el('realYear').value);if(readDraft()&&!confirm('Yarım kalmış sınavın üzerine yeni bir sınav başlatılsın mı?'))return;stopTick();clearDraft();session={type,year,started:Date.now(),answers:Array(40).fill(null),index:0,mode:el('examMode').value,pausedMs:0,pausedAt:null,flags:Array(40).fill(false),topics:Array(40).fill(null),limit:el('examMode').value==='full'?fullSessionSeconds(year,type):Number(el('examLimit').value),source:sourceFor(type,year)};writeDraft();renderExam();if(session)ticker=setInterval(updateClock,1000)}
function renderExam(){if(!session)return;let s=session;let wrapper=el('examBody');wrapper.innerHTML=`<div id="examInside"><div class="exam-top"><b>${s.year} ${s.type} · ${examFor(s.type,s.year)?'Doğrulanmış sınav':'Yerel çalışma alanı'}</b><span class="exam-timer" id="examClock">${seconds(elapsed())}</span><span class="exam-muted" id="examRemaining"></span><button class="smallbtn" id="pauseExam">Duraklat</button><span class="exam-muted" id="markedCount"></span></div><p id="pauseNotice" class="exam-muted hide" role="status">Deneme duraklatıldı. Devam ettiğinde süre ve cevap kâğıdı açılır.</p><div class="exam-main" id="examWork"><div class="pdf-box"><div class="row"><strong>${examFor(s.type,s.year)?'Doğrulanmış kaynak':'Doğrulanmış kitapçık bulunmuyor'}</strong><button id="goMath" class="smallbtn" disabled>Kitapçığın başına dön</button></div><iframe title="Yüklenen sınav kitapçığı" id="realPdf" allow="fullscreen"></iframe><div class="pdf-toolbar"><button class="smallbtn" id="selectPdf" ${pdfFor(s.type,s.year)?'':'disabled'}>Doğrulanmış PDF dosyası seç</button><input id="pdfFile" type="file" accept="application/pdf,.pdf" hidden ${pdfFor(s.type,s.year)?'':'disabled'}><button id="enlargePdf" class="smallbtn" disabled>Tam ekran</button></div><div id="pdfStatus" class="exam-muted"></div></div><div class="optik-box"><div class="row"><strong>Optik cevap kâğıdım</strong><span class="exam-muted">${examFor(s.type,s.year)?'40 doğrulanmış soru':'40 cevap alanı'}</span></div><div id="examGrid" class="exam-grid"></div><div id="canonicalQuestion"></div><div class="current-answer">${examFor(s.type,s.year)?'Soru':'Cevap alanı'} <b id="currentQ">1</b> — Cevabını seç</div><div id="examOptions" class="exam-options"></div><div class="exam-tabs"><button class="smallbtn" id="clearChoice">Cevabı boş bırak</button><button class="smallbtn" id="flagQuestion" aria-pressed="false">Sonra çözmek için işaretle</button></div><details><summary>Konu etiketi ekle</summary><label for="questionTopic" class="exam-muted">Konu (senin seçimin)</label><select id="questionTopic" class="exam-select"><option value="">Henüz sınıflandırılmadı</option>${TOPIC_LABELS.map(topic=>`<option value="${safe(topic)}">${safe(topic)}</option>`).join('')}</select><p class="exam-muted">Konu analizi yalnızca senin etiketlediğin soruları kullanır.</p></details><div class="exam-tabs"><button class="btn secondary" id="prevExam">← Önceki</button><button class="btn secondary" id="nextExam">Sonraki →</button></div><button class="btn wide" id="finishExam">Denemeyi bitir ve netimi hesapla</button><p class="exam-muted">Cevaplarını seçtikçe otomatik saklanır. Yanlışların ve süren bitirince kaydedilir.</p></div></div></div>`;
el('goMath').onclick=()=>{let frame=el('realPdf');if(!frame.getAttribute('src'))return;let root=frame.src.split('#')[0];frame.src=root+'#page='+OFFICIAL[s.year].start[s.type]+'&zoom=page-fit'};
el('enlargePdf').onclick=()=>{let frame=el('realPdf');if(frame.requestFullscreen)frame.requestFullscreen().catch(()=>{})};
el('selectPdf').onclick=()=>el('pdfFile').click();
el('pdfFile').onchange=async e=>{
const book=getBookID(),file=e.target.files[0];if(!file)return;
try{
if(!await setPDFSource(file,s))return;
try{await putPDF(book,new Blob([file],{type:'application/pdf'}));if(session!==s||!el('pdfStatus'))return;el('pdfStatus').textContent='Doğrulanmış kaynak PDF’si bu tarayıcıya kaydedildi.'}
catch{if(session===s&&el('pdfStatus'))el('pdfStatus').textContent='Kitapçık bu oturumda açıldı; tarayıcı PDF dosyasını kalıcı kaydetmeye izin vermedi.'}
}catch(error){if(session===s&&el('pdfStatus'))el('pdfStatus').textContent=error.message}
};
el('pauseExam').onclick=()=>{if(session.pausedAt==null)pauseSession(session);else resumeSession(session);writeDraft();updatePauseUI();updateClock()};el('flagQuestion').onclick=()=>{if(!session||session.pausedAt!=null)return;session.flags[session.index]=!session.flags[session.index];writeDraft();updateOptik()};el('questionTopic').onchange=()=>{if(!session||session.pausedAt!=null)return;session.topics[session.index]=el('questionTopic').value||null;writeDraft()};el('prevExam').onclick=()=>changeQuestion(-1);el('nextExam').onclick=()=>changeQuestion(1);el('clearChoice').onclick=()=>pickOption(null);el('finishExam').onclick=()=>finish(false);updateOptik();showStoredPdf();updatePauseUI();updateClock()}
function updatePauseUI(){if(!session)return;const paused=session.pausedAt!=null;el('pauseExam').textContent=paused?'Devam et':'Duraklat';el('pauseExam').setAttribute('aria-pressed',String(paused));el('examWork').classList.toggle('hide',paused);el('pauseNotice').classList.toggle('hide',!paused)}
function changeQuestion(delta){if(!session||session.pausedAt!=null)return;session.index=Math.max(0,Math.min(39,session.index+delta));writeDraft();updateOptik()}
function pickOption(x){if(!session||session.pausedAt!=null)return;session.answers[session.index]=x;writeDraft();updateOptik()}
function updateOptik(){let s=session;if(!s)return;s.flags=normalizeFlags(s.flags);s.topics=normalizeTopics(s.topics);let grid=el('examGrid');if(!grid)return;grid.innerHTML='';s.answers.forEach((ans,i)=>{let b=document.createElement('button');b.textContent=i+1;b.title=(i+1)+'. soru';b.setAttribute('aria-label',(i+1)+'. soru, '+(ans||'boş')+(s.flags[i]?', sonra çözmek için işaretli':''));b.setAttribute('aria-current',i===s.index?'step':'false');b.className=(ans!==null?'marked ':'')+(i===s.index?'current ':'')+(s.flags[i]?'flagged':'');if(s.flags[i])b.textContent+=' ⚑';b.onclick=()=>{if(s.pausedAt!=null)return;s.index=i;writeDraft();updateOptik()};grid.append(b)});let opts=el('examOptions');opts.innerHTML='';'ABCDE'.split('').forEach(letter=>{let b=document.createElement('button');b.textContent=letter;b.setAttribute('aria-pressed',String(s.answers[s.index]===letter));b.className=s.answers[s.index]===letter?'chosen':'';b.onclick=()=>pickOption(letter);opts.append(b)});el('flagQuestion').setAttribute('aria-pressed',String(s.flags[s.index]));el('flagQuestion').textContent=s.flags[s.index]?'İşareti kaldır':'Sonra çözmek için işaretle';el('questionTopic').value=s.topics[s.index]||'';renderCanonicalQuestion(s);el('currentQ').textContent=s.index+1;el('markedCount').textContent=s.answers.filter(v=>v!==null).length+' / 40 işaretli';el('prevExam').disabled=s.index===0;el('nextExam').disabled=s.index===39}
function renderCanonicalQuestion(s){
const target=el('canonicalQuestion'),approved=examFor(s.type,s.year);if(!target)return;
target.replaceChildren();if(!approved)return;
const q=approved.questions[s.index];
if(q.displayMode!=='inline'){const note=document.createElement('p');note.className='exam-muted';note.textContent='Özgün soru, izinli kaynak görüntüleyicisinde incelenir.';target.append(note);return}
const label=document.createElement('p');label.className='exam-muted';label.textContent=`${s.year} ${s.type} Matematik — ${q.number}. Soru — ${q.source.publisher}`;
const prompt=document.createElement('p');prompt.className='exercise-prompt';prompt.textContent=q.prompt;
const options=document.createElement('ol');options.setAttribute('aria-label','Özgün seçenekler');
q.options.forEach(option=>{const row=document.createElement('li');row.textContent=`${option.id}) ${option.text}`;options.append(row)});
const attribution=document.createElement('p');attribution.className='exam-muted';attribution.textContent=q.source.license.attribution;target.append(label,prompt,options,attribution);
}
function calcStats(ans,key){let correct=0,wrong=0,blank=0;ans.forEach((x,i)=>{if(x===null||x===undefined)blank++;else if(x===key[i])correct++;else wrong++});return{correct,wrong,blank,net:correct-wrong/4}}
function finish(auto){if(!session)return;if(!auto&&!confirm('Denemeyi bitirip kronometreyi durdurmak istiyor musun?'))return;let s=session;let duration=s.finishedDuration??(s.limit?Math.min(elapsed(),s.limit):elapsed());s.finishedDuration=duration;writeDraft();stopTick();session=null;const approved=examFor(s.type,s.year);let key=approved?.answerKey||null;finalSnapshot={s,duration,key};if(key){showScoredResult(key,true)}else{el('examBody').innerHTML=`<div class="card"><h2>${s.year} ${s.type} çalışman bitti</h2><h1>${seconds(duration)}</h1><p>Bu yılın nihai cevap anahtarı doğrulanmadı. İstersen kendi anahtarını girerek manuel değerlendirebilirsin. Bu sonuç resmî olarak doğrulanmış sayılmaz; cevapların değerlendirme tamamlanana kadar saklanır.</p><label for="manualKey">Nihai cevap anahtarı (1–40)</label><textarea id="manualKey" aria-label="Manuel cevap anahtarı" class="field" rows="3" placeholder="40 adet A–E harfi, araya boşluk koyabilirsin"></textarea><p id="manualMessage" class="exam-muted"></p><button class="btn wide" id="verifyManual">Bu anahtara göre hesapla</button><button class="btn secondary" id="saveUnscored">Puanlamadan geçmişe kaydet</button><button class="btn secondary" id="goHome">Sonra değerlendir</button></div>`;el('verifyManual').onclick=()=>{let k=el('manualKey').value.toUpperCase().replace(/\s/g,'');if(k.length!==40||!/^[ABCDE]{40}$/.test(k)){el('manualMessage').textContent='Tam 40 adet A, B, C, D veya E cevabı gir.';return}showScoredResult(k,false)};el('saveUnscored').onclick=saveUnscored;el('goHome').onclick=home}}
function storeResult(rec){const previous=records.slice();const index=records.findIndex(r=>r.id===rec.id);if(index<0)records.push(rec);else records[index]=rec;if(save())return true;records=previous;return false}
function reviewUnscored(rec){if(readDraft()&&!confirm('Yarım kalan denemenin yerine bu sonucu değerlendirmek istiyor musun?'))return;session={type:rec.type,year:rec.year,started:Date.now(),finishedDuration:rec.duration,answers:rec.markedAnswers.slice(),index:0,limit:0,pausedAt:null,pausedMs:0,mode:rec.mode||'math',flags:normalizeFlags(rec.flags),topics:normalizeTopics(rec.topics),source:rec.source,recordId:rec.id,originalDate:rec.date};finish(true)}
function saveUnscored(){
if(!finalSnapshot)return;
const {s,duration}=finalSnapshot;
const rec={id:s.recordId||crypto.randomUUID(),type:s.type,year:s.year,verified:false,date:s.originalDate||new Date().toISOString(),duration,correct:0,wrong:0,blank:s.answers.filter(a=>a===null).length,net:null,details:[],source:s.source,markedAnswers:s.answers,mode:s.mode||'math',limit:s.limit,flags:normalizeFlags(s.flags),topics:normalizeTopics(s.topics)};
if(!storeResult(rec))return;clearDraft();finalSnapshot=null;home();if(auth)upload(rec);
}
async function showScoredResult(key,official){if(!finalSnapshot)return;let {s,duration}=finalSnapshot;let v=calcStats(s.answers,key);let rec={id:s.recordId||crypto.randomUUID(),type:s.type,year:s.year,verified:official,date:s.originalDate||new Date().toISOString(),duration,correct:v.correct,wrong:v.wrong,blank:v.blank,net:v.net,answerKey:key,details:[],source:s.source,markedAnswers:s.answers,mode:s.mode||'math',limit:s.limit,flags:normalizeFlags(s.flags),topics:normalizeTopics(s.topics)};if(!storeResult(rec))return;clearDraft();finalSnapshot=null;let wrongs=s.answers.map((a,i)=>({i:i+1,a,key:key[i]})).filter(v=>v.a!==v.key);el('examBody').innerHTML=`<div class="card"><h2>${s.year} ${s.type} · Deneme karnen</h2><h1>${v.net.toFixed(2)} net</h1><div class="score-grid"><div><b>${v.correct}</b><span>Doğru</span></div><div><b>${v.wrong}</b><span>Yanlış</span></div><div><b>${v.blank}</b><span>Boş</span></div><div><b>${seconds(duration)}</b><span>Süre</span></div></div><p class="exam-muted">${official?'Kaynağı, kullanım izni, 40 özgün sorusu ve nihai cevap anahtarı doğrulanmış ÖSYM sınavına göre puanlandı.':'Kullanıcı tarafından girilen cevap anahtarına göre hesaplandı.'}</p><h2>Tekrar bakılacak sorular</h2><div class="wrong-list">${wrongs.length?wrongs.map(x=>`<span>${x.i}. soru <b>${x.a||'Boş'} → ${x.key}</b></span>`).join(''):'<p>Hepsini doğru yaptın!</p>'}</div><p id="syncStatus" class="exam-muted">${auth?'Buluta kaydediliyor...':'Sonuç bu tarayıcıya kaydedildi. Bulut için hesabına giriş yap.'}</p><button class="btn wide" id="backExams">Denemelere dön</button></div>`;el('backExams').onclick=home;if(auth)await upload(rec)}
window.addEventListener('keydown',e=>{if(!session||session.pausedAt!=null||sec.classList.contains('hide'))return;if(e.target.closest('input,textarea,select'))return;let val=e.key.toUpperCase();if('ABCDE'.includes(val)&&val.length===1)pickOption(val);else if(e.key==='ArrowLeft'){e.preventDefault();changeQuestion(-1)}else if(e.key==='ArrowRight'){e.preventDefault();changeQuestion(1)}});
async function api(path,method='GET',body=null,token=null){let r=await fetch(config.url+path,{method,signal:AbortSignal.timeout(20000),headers:{apikey:config.key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(method==='POST'?{'Prefer':'resolution=merge-duplicates,return=representation'}:{})},...(body!==null?{body:JSON.stringify(body)}:{})});if(!r.ok){let x=await r.text();throw Error(x.slice(0,250))}return r.status===204?null:await r.json()}
async function ensureToken(){
if(!auth)throw Error('Önce giriş yap.');
if(Date.now()<auth.expires_at_ms-60000)return true;
if(refreshTask)return refreshTask;
const current=auth;
refreshTask=(async()=>{try{
const r=await api('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:current.refresh_token});
if(auth!==current)throw Error('Hesap değişti');
if(!r.access_token||!r.refresh_token||r.user?.id!==current.user.id)throw Error('Geçersiz oturum yanıtı');
auth={...r,expires_at_ms:Date.now()+(r.expires_in||3600)*1000};
sessionStorage.setItem('ma_auth',JSON.stringify(auth));return true;
}catch{throw Error('Oturum yenilenemedi. Yeniden giriş yap veya tekrar dene.')}finally{refreshTask=null}})();
return refreshTask;
}
function setAuth(r){if(!r.access_token||!r.refresh_token||!r.user?.id)throw Error('Geçersiz oturum yanıtı');writeDraft();stopTick();session=null;finalSnapshot=null;auth={...r,expires_at_ms:Date.now()+(r.expires_in||3600)*1000};sessionStorage.setItem('ma_auth',JSON.stringify(auth));loadRecords(KEY+'_'+auth.user.id);accountEpoch++;notifyAccount()}
function signOut(){writeDraft();stopTick();session=null;finalSnapshot=null;auth=null;sessionStorage.removeItem('ma_auth');loadRecords(KEY+'_guest');accountEpoch++;notifyAccount();account();history()}
function toDb(r){return{id:r.id,user_id:auth.user.id,exam_type:r.type,correct:r.correct,wrong:r.wrong,blank:r.blank,net:r.net,duration_seconds:r.duration,answers:{details:r.details||[],year:r.year||null,source:r.source||null,markedAnswers:r.markedAnswers||null,verified:!!r.verified,answerKey:r.answerKey||null,mode:r.mode||'math',limit:r.limit||0,flags:normalizeFlags(r.flags),topics:normalizeTopics(r.topics)},created_at:r.date}}
function fromDb(r){return{id:r.id,type:r.exam_type,date:r.created_at,duration:r.duration_seconds,correct:r.correct,wrong:r.wrong,blank:r.blank,net:r.net===null?null:Number(r.net),details:r.answers?.details||[],year:r.answers?.year||null,source:r.answers?.source||null,markedAnswers:r.answers?.markedAnswers||null,verified:false,answerKey:r.answers?.answerKey||null,mode:r.answers?.mode==='full'?'full':'math',limit:r.answers?.limit||0,flags:normalizeFlags(r.answers?.flags),topics:normalizeTopics(r.answers?.topics)}}
function sameAccount(owner,epoch){return auth?.user?.id===owner&&accountEpoch===epoch}
async function upload(rec){
const owner=auth?.user?.id,epoch=accountEpoch;
try{
await ensureToken();if(!sameAccount(owner,epoch))return false;
await api('/rest/v1/exam_results?on_conflict=id','POST',toDb(rec),auth.access_token);
if(!sameAccount(owner,epoch))return false;
if(el('syncStatus'))el('syncStatus').textContent='Bulut kaydı tamamlandı.';return true;
}catch(e){if(sameAccount(owner,epoch)&&el('syncStatus'))el('syncStatus').textContent='Buluta kayıt başarısız: '+e.message;return false}
}
async function sync(){
if(!auth)return;const owner=auth.user.id,epoch=accountEpoch;if(syncingEpoch===epoch)return;syncingEpoch=epoch;
try{
await ensureToken();if(!sameAccount(owner,epoch))return;
let remote=await api('/rest/v1/exam_results?user_id=eq.'+encodeURIComponent(owner)+'&select=*&order=created_at.desc&limit=1000','GET',null,auth.access_token);
if(!sameAccount(owner,epoch))return;if(!Array.isArray(remote))throw Error('Geçersiz bulut kayıt yanıtı');
remote=remote.filter(r=>r?.user_id===owner);const ids=new Set(records.map(r=>r.id));
remote.forEach(r=>{if(!ids.has(r.id)){const rec=fromDb(r);if(validRecord(rec)){records.push(rec);ids.add(r.id)}}});save();
const remoteIds=new Set(remote.map(r=>r.id));let failures=0;
for(const record of records.filter(r=>!remoteIds.has(r.id))){if(!sameAccount(owner,epoch))return;if(!await upload(record))failures++}
if(!sameAccount(owner,epoch))return;history();
if(el('syncStatus'))el('syncStatus').textContent=failures?failures+' kayıt buluta aktarılamadı.':'Bulut kayıtları eşitlendi.';
}catch(e){if(sameAccount(owner,epoch)&&el('syncStatus'))el('syncStatus').textContent='Senkronizasyon hatası: '+e.message}
finally{if(syncingEpoch===epoch)syncingEpoch=null}
}
function account(){let a=el('account');if(!a)return;if(auth){a.innerHTML=`<p>👤 ${safe(auth.user.email||'Giriş yapıldı')}</p><div class="exam-tabs"><button class="btn secondary" id="syncBtn">Kayıtları eşitle</button><button class="btn ghost" id="logoutBtn">Çıkış</button></div><p class="exam-muted" id="syncStatus"></p>`;el('syncBtn').onclick=sync;el('logoutBtn').onclick=signOut;return}a.innerHTML=`<p class="exam-muted">Kendi hesabınla giriş yap; deneme kayıtların hesabına özel bulutta saklansın.</p><label for="userEmail">E-posta</label><input id="userEmail" type="email" autocomplete="email" placeholder="E-posta"><label for="userPassword">Şifre</label><input id="userPassword" type="password" autocomplete="current-password" placeholder="Şifre (en az 6 karakter)"><div class="exam-tabs"><button class="btn" id="signIn">Giriş yap</button><button class="btn secondary" id="signUp">Hesap oluştur</button></div><p id="syncStatus" class="exam-muted"></p>`;el('signIn').onclick=()=>login(false);el('signUp').onclick=()=>login(true)}
async function login(signup){if(loginBusy)return;loginBusy=true;let status=el('syncStatus');el('signIn').disabled=true;el('signUp').disabled=true;try{let email=el('userEmail').value.trim(),password=el('userPassword').value;if(!email||password.length<6)throw Error('E-posta ve en az 6 karakterlik şifre gir.');let r=await api('/auth/v1/'+(signup?'signup':'token?grant_type=password'),'POST',{email,password});if(!r.access_token){status.textContent='Hesap açıldı. E-postandaki doğrulama bağlantısını onaylayıp giriş yap.';return}setAuth(r);account();history();await sync()}catch(e){status.textContent='Hata: '+e.message}finally{loginBusy=false;if(el('signIn'))el('signIn').disabled=false;if(el('signUp'))el('signUp').disabled=false}}
function notifyAccount(){window.dispatchEvent(new CustomEvent('ma-account-changed',{detail:{userId:auth?.user.id||null}}))}
function boundedLearningState(state){
if(!state||typeof state!=='object'||Array.isArray(state))throw Error('Geçersiz öğrenme kaydı');
const serialized=JSON.stringify(state);if(new TextEncoder().encode(serialized).byteLength>100000)throw Error('Öğrenme kaydı çok büyük');
return JSON.parse(serialized);
}
window.MAAccount={
getUser:()=>auth?.user?.id?{id:auth.user.id}:null,
async loadLearning(){
const owner=auth?.user?.id,epoch=accountEpoch;if(!owner)return null;
await ensureToken();if(auth?.user?.id!==owner||epoch!==accountEpoch)throw Error('Hesap değişti');
const rows=await api('/rest/v1/learning_profiles?user_id=eq.'+encodeURIComponent(owner)+'&select=*','GET',null,auth.access_token);
if(auth?.user?.id!==owner||epoch!==accountEpoch)throw Error('Hesap değişti');
if(!Array.isArray(rows))throw Error('Öğrenme kaydı okunamadı');
const record=rows.find(r=>r?.user_id===owner);return record?boundedLearningState(record.state):null;
},
async saveLearning(state){
const owner=auth?.user?.id,epoch=accountEpoch;if(!owner)throw Error('Önce giriş yap.');
const payload=boundedLearningState(state);await ensureToken();
if(auth?.user?.id!==owner||epoch!==accountEpoch)throw Error('Hesap değişti');
await api('/rest/v1/learning_profiles?on_conflict=user_id','POST',{user_id:owner,state:payload,updated_at:new Date().toISOString()},auth.access_token);
if(auth?.user?.id!==owner||epoch!==accountEpoch)throw Error('Hesap değişti');return true;
}
};
try{let a=JSON.parse(sessionStorage.getItem('ma_auth')||'null');if(a?.access_token&&a?.user){auth=a;loadRecords(KEY+'_'+a.user.id)}}catch{}
notifyAccount();
nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{if(b!==tab)sec.classList.add('hide')}));tab.onclick=()=>{document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b===tab));['study','teacher','library'].forEach(id=>el(id).classList.add('hide'));sec.classList.remove('hide');shell();if(auth)sync()};
})();
