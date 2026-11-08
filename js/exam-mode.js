import {EXAM_FAMILIES,KPSS_LEVELS,modeBooklets,modeSetup,validateExamSelection} from '../shared/exam-mode-catalog.js';
export function createExamMode({onEnter,onClose}={}){
 const section=document.createElement('section');section.id='examModePage';section.className='app-page exam-mode-page hide';document.querySelector('.wrap').append(section);
 const el=id=>section.querySelector('#'+id);
 let active=false,generation=0,disposePrivate=null,closing=Promise.resolve(),selection={family:'TYT',year:2026,kpssLevel:'KPSS_LISANS',bookletId:''};
 const owner=()=>window.MAAccount?.getUser()?.id||'guest';
 function saveSelection(){try{sessionStorage.setItem('ma_exam_mode_selection_'+owner(),JSON.stringify(selection))}catch{}}
 function restoreSelection(){try{const saved=JSON.parse(sessionStorage.getItem('ma_exam_mode_selection_'+owner())||'null');if(saved)selection={...validateExamSelection(saved),bookletId:typeof saved.bookletId==='string'?saved.bookletId:''}}catch{}}
 function releasePrivate(){const dispose=disposePrivate;disposePrivate=null;if(dispose){try{closing=Promise.resolve(dispose()).catch(()=>{})}catch{closing=Promise.resolve()}}el('privateLibraryRoot')?.replaceChildren();return closing}
 function render(){
  section.innerHTML=`<div class="page-heading"><div><button id="closeExamMode" class="text-button">← Soru çöze dön</button><h1>Sınav Modu</h1></div><span class="count-badge">Özel çalışma</span></div><details id="examModeSetup" class="surface exam-mode-setup" open><summary>Sınav ve kitapçık</summary><div class="exam-mode-fields"><label for="examFamily">Sınav<select id="examFamily" class="field">${EXAM_FAMILIES.map(f=>`<option>${f}</option>`).join('')}</select></label><label for="examYear">Yıl<select id="examYear" class="field">${Array.from({length:9},(_,i)=>2026-i).map(y=>`<option>${y}</option>`).join('')}</select></label><label id="examKpssLabel" for="examKpssLevel">KPSS düzeyi<select id="examKpssLevel" class="field">${Object.entries(KPSS_LEVELS).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label class="booklet-field" for="examBooklet">Kitapçık<select id="examBooklet" class="field"></select></label></div><p id="examModeNote" class="exam-muted"></p><div class="exam-mode-actions"><a id="officialBookletLink" target="_blank" rel="noopener noreferrer">ÖSYM kaynağı</a><button id="openExamBooklet" class="btn">Kitapçığı aç</button></div></details><p id="examModeStatus" class="status-note" role="status"></p><div id="privateLibraryRoot"></div>`;
  el('examFamily').value=selection.family;el('examYear').value=selection.year;el('examKpssLevel').value=selection.kpssLevel;
  const update=()=>{selection.family=el('examFamily').value;selection.year=Number(el('examYear').value);selection.kpssLevel=el('examKpssLevel').value;selection.bookletId='';renderBooklets();saveSelection()};
  el('examFamily').onchange=update;el('examYear').onchange=update;el('examKpssLevel').onchange=update;
  el('examBooklet').onchange=()=>{selection.bookletId=el('examBooklet').value;renderNotice();saveSelection()};
  el('closeExamMode').onclick=()=>close();el('openExamBooklet').onclick=openBooklet;renderBooklets();
 }
 function renderBooklets(){
  const entries=modeBooklets(selection),select=el('examBooklet'),previous=selection.bookletId;select.replaceChildren();
  for(const row of entries){const option=document.createElement('option');option.value=row.id;option.textContent=row.title;select.append(option)}
  const own=document.createElement('option');own.value='custom';own.textContent='Kendi özgün kitapçığım';select.append(own);
  selection.bookletId=entries.some(row=>row.id===previous)?previous:entries[0]?.id||'custom';select.value=selection.bookletId;
  el('examKpssLabel').classList.toggle('hide',selection.family!=='KPSS');renderNotice();
 }
 function renderNotice(){
  const setup=modeSetup(selection),link=el('officialBookletLink');
  link.href=setup.sourceUrl||(selection.family==='KPSS'?'https://www.osym.gov.tr/':'https://www.osym.gov.tr/SinavGrubu/Menu/314');
  el('examModeNote').textContent=setup.partial?'Kamuya açık kısmi kitapçık: 3 matematik sorusu. Tam deneme değildir; doğrulanmış tam anahtar yok.':setup.examId?'Özgün PDF’ni seç. Sorular, şekiller ve optik form birlikte açılır; dosyan cihazında kalır.':'Kendi kitapçığını seçebilirsin. Soru sayısını ve özgün numaraları kontrol et; doğrulanmamış anahtarla resmî net üretilmez.';
 }
 async function openBooklet(){
  const request=++generation,button=el('openExamBooklet');button.disabled=true;
  try{
   const setup=modeSetup(selection);saveSelection();await releasePrivate();
   const {mountPrivateExams}=await import('./private-exams.js');
   if(!active||request!==generation)return;
   const root=el('privateLibraryRoot');disposePrivate=mountPrivateExams(root,owner(),{examTypes:[setup.examType],initialExamId:setup.examId,initialType:setup.examType,initialYear:setup.year});
   window.dispatchEvent(new CustomEvent('ma-configure-private-exam',{detail:setup}));
   const panel=root.querySelector('#privateLibraryPanel');if(panel)panel.open=true;
   const importer=root.querySelector('#privateImportPanel');if(importer)importer.open=true;
   root.scrollIntoView({block:'start'});
  }catch(error){if(active&&request===generation)el('examModeStatus').textContent=error.message}
  finally{if(active&&request===generation&&el('openExamBooklet'))el('openExamBooklet').disabled=false}
 }
 function open(){if(active)return;active=true;generation++;restoreSelection();render();section.classList.remove('hide');onEnter?.();section.scrollIntoView({block:'start'})}
 function close(notify=true){if(!active)return closing;active=false;generation++;window.dispatchEvent(new CustomEvent('ma-exam-mode-exit'));const task=releasePrivate();section.replaceChildren();section.classList.add('hide');if(notify)onClose?.();return task}
 const focusWork=()=>{if(active&&el('examModeSetup'))el('examModeSetup').open=false};
 window.addEventListener('ma-private-exam-active',focusWork);
 return {open,close,isOpen:()=>active};
}
