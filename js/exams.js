import {EXAM_YEARS, normalizeFlags, normalizeTopics} from '../shared/exam-model.js';
import {QUESTION_BANK} from '../data/question-bank.js';
import {normalizeState} from '../shared/learning-state.js';

// Existing account and history keys are retained. Retired study drafts and local
// document stores are deliberately left untouched by this presentation module.
const HISTORY_KEY = 'matematik_akademim_exam_history_v11';
const config = {
  url: 'https://clgtwtfzhkwhiuvrmimi.supabase.co',
  key: 'sb_publishable_aJDmKhDc4TlY2Op374nZEA_3mtBq2FQ'
};
const el = id => document.getElementById(id);
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const reviewedIds = new Set(QUESTION_BANK.questions.map(question => question.id));
let auth = null;
let accountEpoch = 0;
let activeKey = HISTORY_KEY + '_guest';
let records = [];
let retainedRows = [];
let loginBusy = false;
let refreshTask = null;
let syncingEpoch = null;
let showAll = false;

const nav = document.querySelector('.nav');
const tab = document.createElement('button');
tab.dataset.page = 'mockexam';
tab.setAttribute('aria-label', 'İlerleme');
tab.innerHTML = '<span class="nav-icon" aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 20V13 M12 20V7 M19 20V3"/></svg></span><span>İlerleme</span>';
nav.append(tab);
const section = document.createElement('section');
section.id = 'mockexam';
section.className = 'hide progress-page';
document.querySelector('.wrap').append(section);

function validRecord(record) {
  return record && typeof record.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(record.id) &&
    ['TYT','AYT'].includes(record.type) && Number.isFinite(Date.parse(record.date)) &&
    Number.isFinite(record.duration) && record.duration >= 0 &&
    [record.correct,record.wrong,record.blank].every(value => Number.isInteger(value) && value >= 0 && value <= 40) &&
    (record.net === null || Number.isFinite(record.net)) && (!record.year || EXAM_YEARS.includes(record.year)) &&
    (!record.markedAnswers || Array.isArray(record.markedAnswers) && record.markedAnswers.length === 40 &&
      record.markedAnswers.every(answer => answer === null || /^[ABCDE]$/.test(answer)));
}
function loadRecords(key) {
  activeKey = key;
  try { retainedRows = JSON.parse(localStorage.getItem(key) || '[]'); } catch { retainedRows = []; }
  if (!Array.isArray(retainedRows)) retainedRows = [];
  records = retainedRows.filter(validRecord).map(record => ({...record, verified: false}));
  showAll = false;
}
function saveRecords() {
  try {
    const existingIds = new Set(records.map(record => record.id));
    // Unrecognised historical rows are retained even when they cannot be shown.
    const next = [...retainedRows.filter(record => !existingIds.has(record?.id)), ...records];
    localStorage.setItem(activeKey, JSON.stringify(next));
    retainedRows = next;
    return true;
  } catch {
    setStatus('Kayıt bu cihazda saklanamadı. Yeniden deneyebilirsin.');
    return false;
  }
}
function setStatus(message) {
  const target = el('syncStatus');
  if (target) target.textContent = message;
}
function duration(value) {
  const minutes = Math.floor(value / 60);
  return minutes < 60 ? minutes + ' dk' : Math.floor(minutes / 60) + ' sa ' + minutes % 60 + ' dk';
}
function renderProgress() {
  let state;
  try { state = normalizeState(JSON.parse(localStorage.getItem('ma_learning_v1_' + (auth?.user.id || 'guest')) || 'null')); }
  catch { state = normalizeState(null); }
  const attempts = state.attempts.filter(attempt => reviewedIds.has(attempt.exerciseId));
  const solved = new Set(attempts.map(attempt => attempt.exerciseId)).size;
  const correct = attempts.filter(attempt => attempt.correct).length;
  const target = el('progressSummary');
  if (!target) return;
  target.innerHTML = `<div class="stat-grid"><div class="stat-card"><strong>${solved}</strong><span>Çözülen soru</span></div><div class="stat-card"><strong>${correct}</strong><span>Doğru yanıt</span></div><div class="stat-card"><strong>${records.length}</strong><span>Deneme kaydı</span></div></div>`;
}
function renderHistory() {
  const target = el('history');
  if (!target) return;
  el('recordCount').textContent = records.length ? records.length + ' kayıt' : '';
  target.replaceChildren();
  if (!records.length) {
    const note = document.createElement('p');
    note.className = 'empty-state';
    note.textContent = 'Geçmiş çalışmaların burada görünecek.';
    target.append(note);
  } else {
    const sorted = records.slice().sort((a,b) => new Date(b.date) - new Date(a.date));
    for (const record of showAll ? sorted : sorted.slice(0,5)) {
      const row = document.createElement('article');
      row.className = 'history-row';
      const name = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = record.type + (record.year ? ' ' + record.year : '');
      const meta = document.createElement('span');
      meta.className = 'muted';
      meta.textContent = new Date(record.date).toLocaleDateString('tr-TR') + ' · ' + duration(record.duration);
      name.append(title,meta);
      const score = document.createElement('strong');
      score.className = 'history-score';
      score.textContent = record.net === null ? 'Puanlanmadı' : record.net.toFixed(2) + ' net';
      row.append(name,score);
      if (record.markedAnswers?.length === 40) {
        const details = document.createElement('details');
        details.className = 'history-answers';
        const summary = document.createElement('summary');
        summary.textContent = 'Cevaplar';
        const answers = document.createElement('p');
        answers.textContent = record.markedAnswers.map((answer,index) => (index+1) + ': ' + (answer || '—')).join(' · ');
        details.append(summary,answers);
        row.append(details);
      }
      target.append(row);
    }
    if (!showAll && sorted.length > 5) {
      const more = document.createElement('button');
      more.id = 'showAllHistory';
      more.className = 'smallbtn';
      more.textContent = 'Tümünü gör';
      more.onclick = () => { showAll = true; renderHistory(); };
      target.append(more);
    }
  }
  renderProgress();
}
function shell() {
  section.innerHTML = `<div class="page-heading"><h1>İlerlemen</h1></div><div id="progressSummary"></div><section class="card progress-history"><div class="section-heading"><h2>Geçmiş çalışmalar</h2><span id="recordCount" class="muted"></span></div><div id="history"></div></section><details id="accountPanel" class="card account-panel"><summary>Hesabım</summary><div id="account"></div></details>`;
  renderAccount();
  renderHistory();
}
function renderAccount() {
  const target = el('account');
  if (!target) return;
  if (auth) {
    target.innerHTML = `<p class="account-identity">${safe(auth.user.email || 'Giriş yapıldı')}</p><div class="account-actions"><button class="btn secondary" id="syncBtn">Eşitle</button><button class="smallbtn" id="logoutBtn">Çıkış yap</button></div><p id="syncStatus" class="muted" role="status" aria-live="polite"></p>`;
    el('syncBtn').onclick = sync;
    el('logoutBtn').onclick = signOut;
  } else {
    target.innerHTML = `<form id="accountForm"><label for="userEmail">E-posta</label><input class="field" id="userEmail" type="email" autocomplete="email" required placeholder="E-posta adresin"><label for="userPassword">Şifre</label><input class="field" id="userPassword" type="password" autocomplete="current-password" required minlength="6" placeholder="En az 6 karakter"><div class="account-actions"><button class="btn" id="signIn" type="submit">Giriş yap</button><button class="smallbtn" id="signUp" type="button">Hesap oluştur</button></div></form><p id="syncStatus" class="muted" role="status" aria-live="polite"></p>`;
    el('accountForm').onsubmit = event => { event.preventDefault(); login(false); };
    el('signUp').onclick = () => login(true);
  }
}
async function api(path,method='GET',body=null,token=null) {
  const response = await fetch(config.url + path, {
    method,signal:AbortSignal.timeout(20000),
    headers:{apikey:config.key,'Content-Type':'application/json',...(token ? {Authorization:'Bearer ' + token} : {}),...(method === 'POST' && path.startsWith('/rest/v1/') ? {Prefer:'resolution=merge-duplicates,return=representation'} : {})},
    ...(body !== null ? {body:JSON.stringify(body)} : {})
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw Error('Giriş bilgilerini kontrol et.');
    if (response.status === 429) throw Error('Biraz bekleyip tekrar dene.');
    throw Error('İşlem tamamlanamadı. Tekrar dene.');
  }
  return response.status === 204 ? null : response.json();
}
function sameAccount(owner,epoch) { return auth?.user?.id === owner && accountEpoch === epoch; }
async function ensureToken() {
  if (!auth) throw Error('Önce giriş yap.');
  if (Date.now() < auth.expires_at_ms - 60000) return true;
  if (refreshTask) return refreshTask;
  const current = auth;
  refreshTask = (async () => {
    try {
      const response = await api('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:current.refresh_token});
      if (auth !== current) throw Error('Hesap değişti.');
      if (!response.access_token || !response.refresh_token || response.user?.id !== current.user.id) throw Error('Oturum yenilenemedi.');
      auth = {...response,expires_at_ms:Date.now() + (response.expires_in || 3600)*1000};
      sessionStorage.setItem('ma_auth',JSON.stringify(auth));
      return true;
    } catch { throw Error('Oturum yenilenemedi. Tekrar giriş yap.'); }
    finally { refreshTask = null; }
  })();
  return refreshTask;
}
function notifyAccount() {
  window.dispatchEvent(new CustomEvent('ma-account-changed',{detail:{userId:auth?.user.id || null}}));
}
function setAuth(response) {
  if (!response.access_token || !response.refresh_token || typeof response.user?.id !== 'string' || !response.user.id) throw Error('Oturum açılamadı.');
  const next = {...response,expires_at_ms:Date.now() + (response.expires_in || 3600)*1000};
  sessionStorage.setItem('ma_auth',JSON.stringify(next));
  auth = next;
  loadRecords(HISTORY_KEY + '_' + auth.user.id);
  accountEpoch++;
  notifyAccount();
}
async function signOut() {
  const previous = auth;
  auth = null;
  try { sessionStorage.removeItem('ma_auth'); } catch {}
  loadRecords(HISTORY_KEY + '_guest');
  accountEpoch++;
  const logoutEpoch = accountEpoch;
  notifyAccount();
  renderAccount();
  renderHistory();
  if (!previous?.access_token) return;
  try {
    // Revoke only the captured session. Local isolation happens immediately and
    // never depends on a remote response or signs out a later login.
    await api('/auth/v1/logout?scope=local','POST',null,previous.access_token);
  } catch {
    if (!auth && accountEpoch === logoutEpoch) setStatus('Bu cihazdaki oturum kapatıldı. Sunucu çıkışı doğrulanamadı; bağlantını kontrol et.');
  }
}
async function login(signup) {
  if (loginBusy) return;
  loginBusy = true;
  const status = el('syncStatus');
  el('signIn').disabled = true;
  el('signUp').disabled = true;
  try {
    const email = el('userEmail').value.trim();
    const password = el('userPassword').value;
    if (!email || password.length < 6) throw Error('E-posta ve en az 6 karakterlik şifre gir.');
    const response = await api('/auth/v1/' + (signup ? 'signup' : 'token?grant_type=password'),'POST',{email,password});
    if (!response.access_token) {
      status.textContent = 'E-postandaki doğrulama bağlantısını açıp giriş yap.';
      return;
    }
    setAuth(response);
    renderAccount();
    renderHistory();
    sync();
  } catch (error) { status.textContent = error instanceof TypeError ? 'Bağlantı kurulamadı. Tekrar dene.' : error.message; }
  finally {
    loginBusy = false;
    if (el('signIn')) el('signIn').disabled = false;
    if (el('signUp')) el('signUp').disabled = false;
  }
}
function fromDb(record) {
  return {id:record.id,type:record.exam_type,date:record.created_at,duration:record.duration_seconds,
    correct:record.correct,wrong:record.wrong,blank:record.blank,net:record.net === null ? null : Number(record.net),
    details:record.answers?.details || [],year:record.answers?.year || null,source:record.answers?.source || null,
    markedAnswers:record.answers?.markedAnswers || null,verified:false,answerKey:record.answers?.answerKey || null,
    mode:record.answers?.mode === 'full' ? 'full' : 'math',limit:record.answers?.limit || 0,
    flags:normalizeFlags(record.answers?.flags),topics:normalizeTopics(record.answers?.topics)};
}
function toDb(record,owner) {
  return {id:record.id,user_id:owner,exam_type:record.type,correct:record.correct,wrong:record.wrong,blank:record.blank,
    net:record.net,duration_seconds:record.duration,
    answers:{details:record.details || [],year:record.year || null,source:record.source || null,markedAnswers:record.markedAnswers || null,
      verified:false,answerKey:record.answerKey || null,mode:record.mode || 'math',limit:record.limit || 0,
      flags:normalizeFlags(record.flags),topics:normalizeTopics(record.topics)},created_at:record.date};
}
async function uploadRecord(record,owner,epoch) {
  try {
    await ensureToken();
    if (!sameAccount(owner,epoch)) return false;
    await api('/rest/v1/exam_results?on_conflict=id','POST',toDb(record,owner),auth.access_token);
    return sameAccount(owner,epoch);
  } catch { return false; }
}
async function sync() {
  if (!auth) return;
  const owner = auth.user.id,epoch = accountEpoch;
  if (syncingEpoch === epoch) return;
  syncingEpoch = epoch;
  setStatus('Eşitleniyor…');
  try {
    await ensureToken();
    if (!sameAccount(owner,epoch)) return;
    const response = await api('/rest/v1/exam_results?user_id=eq.' + encodeURIComponent(owner) + '&select=*&order=created_at.desc&limit=1000','GET',null,auth.access_token);
    if (!sameAccount(owner,epoch)) return;
    if (!Array.isArray(response)) throw Error('Kayıtlar okunamadı.');
    const remote = response.filter(record => record?.user_id === owner);
    const ids = new Set(records.map(record => record.id));
    let changed = false;
    for (const row of remote) {
      const record = fromDb(row);
      if (!ids.has(record.id) && validRecord(record)) { records.push(record);ids.add(record.id);changed = true; }
    }
    if (changed) saveRecords();
    const remoteIds = new Set(remote.map(record => record.id));
    let failures = 0;
    for (const record of records.filter(record => !remoteIds.has(record.id))) {
      if (!sameAccount(owner,epoch)) return;
      if (!await uploadRecord(record,owner,epoch)) failures++;
    }
    if (!sameAccount(owner,epoch)) return;
    renderHistory();
    setStatus(failures ? 'Bazı kayıtlar eşitlenemedi. Tekrar deneyebilirsin.' : 'Kayıtların eşitlendi.');
  } catch (error) { if (sameAccount(owner,epoch)) setStatus(error instanceof TypeError ? 'Bağlantı kurulamadı. Tekrar dene.' : error.message); }
  finally { if (syncingEpoch === epoch) syncingEpoch = null; }
}
function boundedLearningState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw Error('Geçersiz öğrenme kaydı.');
  const serialized = JSON.stringify(state);
  if (new TextEncoder().encode(serialized).byteLength > 100000) throw Error('Öğrenme kaydı çok büyük.');
  return JSON.parse(serialized);
}
window.MAAccount = {
  getUser:() => auth?.user?.id ? {id:auth.user.id} : null,
  async loadLearning() {
    const owner = auth?.user?.id,epoch = accountEpoch;
    if (!owner) return null;
    await ensureToken();
    if (!sameAccount(owner,epoch)) throw Error('Hesap değişti.');
    const rows = await api('/rest/v1/learning_profiles?user_id=eq.' + encodeURIComponent(owner) + '&select=*','GET',null,auth.access_token);
    if (!sameAccount(owner,epoch)) throw Error('Hesap değişti.');
    if (!Array.isArray(rows)) throw Error('Öğrenme kaydı okunamadı.');
    const record = rows.find(row => row?.user_id === owner);
    return record ? boundedLearningState(record.state) : null;
  },
  async saveLearning(state) {
    const owner = auth?.user?.id,epoch = accountEpoch;
    if (!owner) throw Error('Önce giriş yap.');
    const payload = boundedLearningState(state);
    await ensureToken();
    if (!sameAccount(owner,epoch)) throw Error('Hesap değişti.');
    await api('/rest/v1/learning_profiles?on_conflict=user_id','POST',{user_id:owner,state:payload,updated_at:new Date().toISOString()},auth.access_token);
    if (!sameAccount(owner,epoch)) throw Error('Hesap değişti.');
    return true;
  }
};

try {
  const saved = JSON.parse(sessionStorage.getItem('ma_auth') || 'null');
  if (saved?.access_token && saved?.refresh_token && typeof saved.user?.id === 'string') auth = saved;
} catch {}
loadRecords(HISTORY_KEY + '_' + (auth?.user.id || 'guest'));
shell();
notifyAccount();
function openProgress() {
  document.querySelectorAll('.nav button').forEach(button => button.classList.toggle('active',button === tab));
  ['study','teacher','library'].forEach(id => el(id)?.classList.add('hide'));
  section.classList.remove('hide');
  renderProgress();
  renderHistory();
  if (auth) sync();
}
nav.querySelectorAll('button').forEach(button => button.addEventListener('click',() => { if (button !== tab) section.classList.add('hide'); }));
tab.onclick = openProgress;
window.addEventListener('ma-learning-changed',renderProgress);
