import {buildPracticeExamCatalog, PRACTICE_DISTRIBUTIONS, scorePracticeExam} from '../shared/practice-exams.js';
import {
  createPracticeAttempt, normalizePracticeExamStore, elapsedPracticeSeconds,
  updatePracticeAnswer, movePracticeQuestion, pausePracticeAttempt,
  resumePracticeAttempt, finishPracticeAttempt, checkpointPracticeAttempt
} from '../shared/practice-exam-state.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const storageKey = owner => 'ma_practice_exams_v1_' + owner;
const clock = seconds => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');

// This controller never writes to legacy attempts, learning profiles or Supabase.
// A separate owner-scoped store retains every completed run when a student retries.
export function createPracticeExamController({registry, root, learningRoot}) {
  const catalog = buildPracticeExamCatalog(registry.questions);
  let owner = window.MAAccount?.getUser()?.id || 'guest';
  let store, writable = true, message = '', activeId = null, resultId = null;
  let type = 'TYT', query = '', visibleCount = 24, opened = false, ticks = 0;
  const find = id => root.querySelector('#' + id);
  const attemptById = id => store.attempts.find(attempt => attempt.id === id);
  const active = () => attemptById(activeId);
  const examFor = attempt => catalog.getExam(attempt?.examId);
  const notify = () => window.dispatchEvent(new CustomEvent('ma-practice-exams-changed', {detail:{userId:owner === 'guest' ? null : owner}}));

  function readStore() {
    const raw = localStorage.getItem(storageKey(owner));
    const normalized = normalizePracticeExamStore(raw ? JSON.parse(raw) : {version:1, attempts:[]}, catalog);
    if (!normalized) throw Error('Desteklenmeyen kayıt biçimi');
    return normalized;
  }
  function load() {
    writable = true;
    message = '';
    try {
      store = readStore();
      // An abruptly closed tab may miss pagehide. Count only its last saved
      // checkpoint, never the hours spent away from this application.
      store.attempts = store.attempts.map(attempt => attempt.status === 'running' ? pausePracticeAttempt(attempt, attempt.updatedAt) : attempt);
    } catch {
      store = {version:1, attempts:[], retained:[]};
      writable = false;
      message = 'Deneme kayıtları okunamadı. Mevcut kayıtların üzerine yazılmadı; tarayıcının depolama izinlerini kontrol et.';
    }
  }
  function notice() {
    const target = find('practiceExamNotice');
    if (target) { target.textContent = message; target.hidden = !message; }
  }
  function commit(attempt) {
    if (!writable) { notice(); return false; }
    try {
      // Merge by attempt ID so a retry never replaces its predecessor and a
      // different tab cannot silently remove other completed attempts.
      const disk = readStore();
      const diskAttempt = disk.attempts.find(row => row.id === attempt.id);
      const base = store.attempts.find(row => row.id === attempt.id);
      if (diskAttempt && (!base || diskAttempt.updatedAt > base.updatedAt ||
          diskAttempt.status === 'completed' && JSON.stringify(diskAttempt) !== JSON.stringify(attempt) ||
          JSON.stringify([diskAttempt.answers, diskAttempt.index]) !== JSON.stringify([base.answers, base.index]))) {
        store = disk;
        store.attempts = store.attempts.map(row => row.status === 'running' ? pausePracticeAttempt(row, row.updatedAt) : row);
        activeId = null; resultId = null;
        message = 'Bu deneme başka bir sekmede güncellendi. Son kayıt yüklendi; listeden devam edebilirsin.';
        if (opened) renderList();
        notify();
        return false;
      }
      const merged = new Map([...disk.attempts, ...store.attempts].map(row => [row.id, row]));
      for (const row of disk.attempts) {
        const current = merged.get(row.id);
        if (row.status === 'completed' || row.updatedAt > current.updatedAt) merged.set(row.id, row);
      }
      const saved = merged.get(attempt.id);
      if (saved?.status === 'completed' && attempt.status !== 'completed') throw Error('Deneme başka bir sekmede tamamlandı');
      merged.set(attempt.id, attempt);
      const next = {...disk, ...store, attempts:[...merged.values()], retained:disk.retained || []};
      localStorage.setItem(storageKey(owner), JSON.stringify(next));
      store = next;
      message = '';
      notice();
      notify();
      return true;
    } catch {
      message = 'Değişiklik kaydedilemedi. Önceki kayıt korundu. Depolama alanını ve izinlerini kontrol edip tekrar dene.';
      notice();
      return false;
    }
  }
  function pause() {
    const attempt = active();
    return !attempt || attempt.status !== 'running' || commit(pausePracticeAttempt(attempt));
  }
  function header(title, action = 'closePracticeExams') {
    return `<div class="page-heading practice-exam-heading"><div><p class="eyebrow">AI ALIŞTIRMA DENEMELERİ</p><h1>${escapeHtml(title)}</h1></div><button class="smallbtn" id="${action}">${action === 'closePracticeExams' ? 'Soru çöze dön' : 'Deneme listesi'}</button></div><p id="practiceExamNotice" class="practice-exam-notice" role="status" ${message ? '' : 'hidden'}>${escapeHtml(message)}</p>`;
  }
  function bindExit(id, handler) { find(id).onclick = handler; }
  function showList() {
    if (!pause()) return;
    activeId = null; resultId = null;
    renderList();
    window.scrollTo({top:0, behavior:'instant'});
  }
  function close() {
    if (!pause()) return;
    opened = false;
    root.hidden = true;
    learningRoot.hidden = false;
  }
  function open() {
    opened = true;
    root.hidden = false;
    learningRoot.hidden = true;
    if (activeId && active()) renderSession();
    else if (resultId && attemptById(resultId)) renderResult();
    else renderList();
  }
  function distributionDetails() {
    const stats = catalog.byType[type];
    return `<details class="practice-distribution"><summary>Konu dağılımı ve havuz bilgisi</summary><p>Paylaştığın tablonun 2025 sütunu temel alındı. ${type === 'TYT' ? 'TYT görselinde geometri dağılımı bulunmadığı için bu liste 30 matematik sorusundan oluşur.' : 'AYT hedefi 31 matematik + 9 geometri sorusudur. Eksik konular başka sorularla doldurulmaz.'}</p><div class="practice-distribution-grid">${stats.topics.filter(topic => topic.count).map(topic => `<p class="${topic.missing ? 'practice-shortage' : ''}"><span>${escapeHtml(topic.label)}</span><strong>${topic.count} soru${topic.missing ? ' · '+topic.missing+' eksik' : ''}</strong></p>`).join('')}</div><p>${stats.matchedQuestionCount} farklı soru bu listede kullanılıyor. Konu havuzlarının büyüklükleri farklı olduğu için sorular farklı denemelerde tekrar edebilir; aynı denemede tekrar yoktur.</p><p>${stats.excludedQuestionIds.length} soru bu yılın dağılımına girmiyor; tekli Soru Çöz bölümünde korunuyor.</p><p>Cevap anahtarları otomatik matematik kontrolünden geçen AI alıştırmalarına aittir. Bu denemeler resmî ÖSYM sınavı değildir.</p><p>Kayıtlar bu tarayıcıda ${owner === 'guest' ? 'misafir alanında' : 'hesabına ayrılmış alanda'} saklanır; başka cihaza eşitlenmez. ${store.retained?.length ? store.retained.length+' eski veya tanınmayan kayıt silinmeden korunuyor.' : ''}</p></details>`;
  }
  function renderCards() {
    const all = catalog.exams.filter(exam => exam.type === type && (!query || String(exam.number).includes(query.trim())));
    const grid = find('practiceExamList');
    grid.replaceChildren();
    for (const exam of all.slice(0, visibleCount)) {
      const attempts = store.attempts.filter(attempt => attempt.examId === exam.id);
      const finished = attempts.filter(attempt => attempt.status === 'completed').sort((a,b) => b.completedAt - a.completedAt);
      const draft = attempts.filter(attempt => attempt.status !== 'completed').sort((a,b) => b.updatedAt - a.updatedAt)[0];
      const card = document.createElement('article');
      card.className = 'surface practice-exam-card';
      card.dataset.practiceExamId = exam.id;
      card.innerHTML = `<div class="section-heading"><h2>${exam.number}. Deneme</h2>${finished.length ? '<span class="exam-completed" aria-label="Tamamlandı">✓</span>' : ''}</div><p class="exam-card-meta">${exam.type} · ${exam.actualCount}${!exam.completeDistribution ? '/'+exam.targetCount : ''} soru</p><p class="exam-card-status">${!exam.completeDistribution ? (exam.targetCount-exam.actualCount)+' soru eksik · Kısmi deneme' : finished.length ? finished.length+' kez tamamlandı' : draft ? 'Yarım kalan deneme' : 'Çözmeye hazır'}</p><div class="exam-card-actions"></div>`;
      const actions = card.querySelector('.exam-card-actions');
      const button = (text, attribute, handler, primary = false) => {
        const node = document.createElement('button');
        node.className = primary ? 'btn' : 'smallbtn'; node.textContent = text; node.setAttribute(attribute, exam.id); node.disabled = !writable;
        node.onclick = handler; actions.append(node);
      };
      if (draft) button('Devam et', 'data-resume-exam', () => { if (commit(resumePracticeAttempt(draft))) { activeId = draft.id; resultId = null; renderSession(); } }, true);
      else button(finished.length ? 'Bir daha çöz' : 'Başla', finished.length ? 'data-retry-exam' : 'data-start-exam', () => start(exam), true);
      if (finished.length) button('Sonucu gör', 'data-review-exam', () => { resultId = finished[0].id; activeId = null; renderResult(); });
      grid.append(card);
    }
    if (!all.length) grid.innerHTML = '<p class="empty-state">Bu numarayla deneme bulunamadı.</p>';
    find('practiceExamListCount').textContent = Math.min(visibleCount, all.length) + ' / ' + all.length + ' deneme';
    find('showMorePracticeExams').hidden = all.length <= visibleCount;
  }
  function renderList() {
    root.innerHTML = header('Denemeler') + `<p class="practice-exam-intro">Konu dağılımına göre hazırlanmış çalışma listesi. Tamamladıkların ✓ ile işaretlenir. Aynı soru farklı denemelerde yer alabilir.</p><div class="practice-exam-controls"><label>Sınav<select id="practiceExamType" class="field"><option value="TYT">TYT · ${catalog.byType.TYT.actualCount} matematik sorusu</option><option value="AYT">AYT · ${catalog.byType.AYT.actualCount}/${catalog.byType.AYT.targetCount} soru${catalog.byType.AYT.completeDistribution ? '' : ' · kısmi'}</option></select></label><label>Deneme ara<input id="practiceExamSearch" class="field" type="search" inputmode="numeric" placeholder="Deneme numarası" maxlength="5"></label></div>${distributionDetails()}<div class="section-heading"><h2>${type} denemeleri</h2><span id="practiceExamListCount" class="muted"></span></div><div id="practiceExamList" class="practice-exam-grid"></div><button id="showMorePracticeExams" class="smallbtn">Diğer denemeleri göster</button>`;
    find('practiceExamType').value = type; find('practiceExamSearch').value = query;
    find('practiceExamType').onchange = event => { type = event.target.value; query = ''; visibleCount = 24; renderList(); };
    find('practiceExamSearch').oninput = event => { query = event.target.value; visibleCount = 24; renderCards(); };
    find('showMorePracticeExams').onclick = () => { visibleCount += 24; renderCards(); };
    bindExit('closePracticeExams', close); renderCards();
  }
  function start(exam) {
    const attempt = createPracticeAttempt(exam, {id:crypto.randomUUID(), now:Date.now()});
    if (!commit(attempt)) return;
    activeId = attempt.id; resultId = null; renderSession();
    window.scrollTo({top:0, behavior:'instant'});
  }
  function renderSession() {
    const attempt = active(), exam = examFor(attempt);
    if (!attempt || !exam) { activeId = null; renderList(); return; }
    const paused = attempt.status === 'paused';
    root.innerHTML = header(exam.type+' · '+exam.number+'. Deneme', 'practiceExamLeave') + `<section id="practiceExamSession"><div class="practice-exam-toolbar"><span>${exam.actualCount} soru${!exam.completeDistribution ? ' · Kısmi deneme ('+exam.targetCount+' hedef)' : ''}</span><div class="row"><time id="practiceExamTimer" class="exam-clock" aria-label="Geçen süre">${clock(elapsedPracticeSeconds(attempt))}</time><button id="pausePracticeExam" class="smallbtn">${paused ? 'Devam et' : 'Duraklat'}</button></div></div><p class="exam-paused-note" ${paused ? '' : 'hidden'}>Süre durdu. Soruları görmek için devam et.</p><div class="practice-exam-session-layout"><article id="practiceExamQuestion" class="surface practice-exam-question ai-question" ${paused ? 'hidden' : ''}></article><aside class="surface practice-exam-optical"><h2>Cevap kâğıdı</h2><p id="practiceExamAnswered" class="muted"></p><div id="practiceExamOptical" class="optical-grid" aria-label="Soru numaraları"></div><button id="finishPracticeExam" class="btn">Denemeyi bitir</button></aside></div></section><dialog id="practiceExamFinishDialog" class="app-dialog"><h2>Deneme bitirilsin mi?</h2><p>${attempt.answers.filter(answer => answer === null).length} boş sorun var. Bitirdikten sonra sonuçları ve çözümleri görebilirsin.</p><div class="exam-card-actions"><button id="cancelFinishPracticeExam" class="smallbtn">Devam et</button><button id="confirmFinishPracticeExam" class="btn">Bitir ve sonucu gör</button></div></dialog>`;
    bindExit('practiceExamLeave', showList);
    find('pausePracticeExam').onclick = () => { const current = active(); if (commit(current.status === 'running' ? pausePracticeAttempt(current) : resumePracticeAttempt(current))) renderSession(); };
    find('finishPracticeExam').onclick = () => find('practiceExamFinishDialog').showModal();
    find('cancelFinishPracticeExam').onclick = () => find('practiceExamFinishDialog').close();
    find('confirmFinishPracticeExam').onclick = finish;
    renderQuestion(); renderOptical();
  }
  function renderQuestion() {
    const attempt = active(), exam = examFor(attempt), q = registry.getQuestion(attempt.questionIds[attempt.index]);
    const target = find('practiceExamQuestion');
    if (!target || !q) return;
    target.dataset.questionId = q.id;
    const topic = PRACTICE_DISTRIBUTIONS[exam.type].topics.find(row => row.id === exam.topicByQuestion[q.id]);
    target.innerHTML = `<div class="question-top"><span class="topic-label">${escapeHtml(topic?.label || q.topic)}</span><span class="question-count">${attempt.index+1} / ${exam.actualCount}</span></div><span class="ai-badge">AI ÜRETİMİ</span><div class="ai-prompt"></div><div id="practiceExamOptions" class="exercise-choices" role="group" aria-label="Cevap seçenekleri"></div><button id="clearPracticeExamAnswer" class="text-button">İşaretimi kaldır</button><div class="exam-question-actions"><button id="practiceExamPrevious" class="smallbtn" ${attempt.index === 0 ? 'disabled' : ''}>← Önceki</button><button id="practiceExamNext" class="smallbtn" ${attempt.index === exam.actualCount-1 ? 'disabled' : ''}>Sonraki →</button></div>`;
    target.querySelector('.ai-prompt').textContent = q.prompt;
    for (const option of q.options) {
      const button = document.createElement('button');
      button.dataset.option = option.id; button.textContent = option.id+') '+option.text;
      button.setAttribute('aria-pressed', String(attempt.answers[attempt.index] === option.id));
      button.disabled = attempt.status !== 'running';
      button.onclick = () => answer(option.id); find('practiceExamOptions').append(button);
    }
    find('clearPracticeExamAnswer').disabled = attempt.status !== 'running' || attempt.answers[attempt.index] === null;
    find('clearPracticeExamAnswer').onclick = () => answer(null);
    find('practiceExamPrevious').onclick = () => navigate(attempt.index-1);
    find('practiceExamNext').onclick = () => navigate(attempt.index+1);
  }
  function renderOptical() {
    const attempt = active(), target = find('practiceExamOptical');
    if (!attempt || !target) return;
    target.replaceChildren();
    find('practiceExamAnswered').textContent = attempt.answers.filter(Boolean).length+' / '+attempt.answers.length+' işaretlendi';
    for (let i = 0; i < attempt.answers.length; i++) {
      const button = document.createElement('button');
      button.dataset.index = i; button.className = attempt.answers[i] ? 'answered' : '';
      button.textContent = (i+1)+(attempt.answers[i] ? ' · '+attempt.answers[i] : '');
      button.setAttribute('aria-label', (i+1)+'. soru'+(attempt.answers[i] ? ', '+attempt.answers[i]+' işaretli' : ', boş'));
      if (i === attempt.index) button.setAttribute('aria-current', 'true');
      button.disabled = attempt.status !== 'running'; button.onclick = () => navigate(i); target.append(button);
    }
  }
  function answer(value) {
    const attempt = active();
    if (!attempt || attempt.status !== 'running') return;
    if (commit(updatePracticeAnswer(attempt, attempt.index, value))) {
      renderQuestion(); renderOptical();
      find('practiceExamOptions')?.querySelector(`[data-option="${value}"]`)?.focus({preventScroll:true});
    }
  }
  function navigate(index) {
    if (commit(movePracticeQuestion(active(), index))) {
      renderQuestion(); renderOptical();
      const target = find('practiceExamQuestion'); target.tabIndex = -1; target.focus({preventScroll:true}); target.scrollIntoView({block:'start', behavior:'instant'});
    }
  }
  function finish() {
    const attempt = active(), exam = examFor(attempt), score = scorePracticeExam(exam, attempt.answers, registry);
    if (!score) { find('practiceExamFinishDialog')?.close(); message = 'Bu denemenin cevapları doğrulanamadı; sonuç üretilmedi. Cevapların korunuyor.'; notice(); return; }
    if (!commit(finishPracticeAttempt(attempt, score))) { find('practiceExamFinishDialog')?.close(); return; }
    resultId = attempt.id; activeId = null; renderResult();
  }
  function renderResult() {
    const attempt = attemptById(resultId), exam = examFor(attempt);
    if (!attempt || attempt.status !== 'completed' || !exam) { resultId = null; renderList(); return; }
    const score = scorePracticeExam(exam, attempt.answers, registry);
    root.innerHTML = header(exam.type+' · '+exam.number+'. Deneme', 'returnToPracticeExams') + `<section id="practiceExamResult" class="surface practice-exam-result"><h2>✓ Deneme tamamlandı</h2><p>${exam.actualCount} soruluk ${exam.completeDistribution ? 'matematik denemesi' : 'kısmi deneme'} · ${clock(elapsedPracticeSeconds(attempt))}</p>${score ? `<div class="practice-score-grid"><div><strong>${score.correct}</strong><span>Doğru</span></div><div><strong>${score.wrong}</strong><span>Yanlış</span></div><div><strong>${score.blank}</strong><span>Boş</span></div><div><strong>${score.net.toFixed(2)}</strong><span>Alıştırma neti</span></div></div>` : '<p role="status">Cevap anahtarı doğrulanamadı; puan gösterilmiyor.</p>'}<p class="muted">Net = doğru − yanlış / 4. AI alıştırma sonucudur; resmî sınav sonucu değildir.${!exam.completeDistribution ? ' Eksik konular bu sonuçta değerlendirilmez.' : ''}</p><div class="exam-card-actions"><button id="retryPracticeExam" class="btn">Bir daha çöz</button></div><div id="practiceExamReview" class="practice-review-list"></div></section>`;
    bindExit('returnToPracticeExams', showList);
    find('retryPracticeExam').onclick = () => {
      const draft = store.attempts.filter(row => row.examId === exam.id && row.status !== 'completed').sort((a,b) => b.updatedAt-a.updatedAt)[0];
      if (draft) { if (commit(resumePracticeAttempt(draft))) { activeId = draft.id; resultId = null; renderSession(); } }
      else start(exam);
    };
    for (let i = 0; i < exam.questionIds.length; i++) {
      const q = registry.getQuestion(exam.questionIds[i]);
      if (!q) continue;
      const selected = attempt.answers[i], correct = selected === q.answer.value, details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = (i+1)+'. soru · '+(selected ? correct ? '✓ Doğru' : 'Yanlış · '+selected : 'Boş')+' · Doğru: '+q.answer.value;
      const prompt = document.createElement('p'); prompt.className = 'ai-prompt'; prompt.textContent = q.prompt;
      const options = document.createElement('p'); options.className = 'exam-review-options'; options.textContent = q.options.map(option => option.id+') '+option.text).join('\n');
      const list = document.createElement('ol');
      for (const step of q.solutionSteps?.length ? q.solutionSteps : [q.answer.solution]) { if (step) { const item = document.createElement('li'); item.textContent = step; list.append(item); } }
      details.append(summary, prompt, options, list); find('practiceExamReview').append(details);
    }
  }
  function summary() {
    return store.attempts.filter(attempt => attempt.status === 'completed').map(attempt => ({
      id:attempt.id, type:attempt.type, number:attempt.number, completedAt:attempt.completedAt,
      duration:elapsedPracticeSeconds(attempt), score:scorePracticeExam(examFor(attempt), attempt.answers, registry),
      answeredQuestionIds:attempt.questionIds.filter((id,index) => attempt.answers[index] !== null)
    }));
  }
  function openResult(id) {
    const attempt = attemptById(id);
    if (!attempt || attempt.status !== 'completed' || !pause()) return;
    document.querySelector('.nav [data-page="study"]')?.click();
    resultId = id; activeId = null; opened = true; root.hidden = false; learningRoot.hidden = true; renderResult();
  }
  load();
  window.MAPracticeExams = {getSummary:summary, openResult};
  window.addEventListener('ma-account-changed', () => {
    const next = window.MAAccount?.getUser()?.id || 'guest';
    if (next === owner) return;
    pause(); owner = next; activeId = null; resultId = null; query = ''; load(); close(); notify();
  });
  document.querySelector('.nav').addEventListener('click', event => {
    const target = event.target.closest('button[data-page]');
    if (target && target.dataset.page !== 'study') {
      if (!pause()) { event.stopImmediatePropagation(); event.preventDefault(); }
      else if (opened && active()) renderSession();
    }
  }, true);
  window.addEventListener('beforeunload', event => { if (!pause()) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('pagehide', pause);
  window.addEventListener('storage', event => {
    if (event.key !== storageKey(owner)) return;
    activeId = null; resultId = null; load();
    message = 'Deneme kaydı başka bir sekmede değişti. Son kayıt yüklendi.';
    if (opened) renderList(); notify();
  });
  setInterval(() => {
    const attempt = active();
    if (!attempt || !opened || attempt.status !== 'running') return;
    const target = find('practiceExamTimer'); if (target) target.textContent = clock(elapsedPracticeSeconds(attempt));
    if (++ticks % 5 === 0) commit(checkpointPracticeAttempt(attempt));
  }, 1000);
  return {open, close};
}
