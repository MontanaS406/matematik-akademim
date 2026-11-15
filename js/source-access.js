const ACCESS_STATES = new Set(['none', 'pending', 'approved', 'revoked', 'email_unconfirmed']);
const memberLabels = {none:'Başvuru yok', pending:'Onay bekliyor', approved:'Onaylı', revoked:'Erişim kapalı', email_unconfirmed:'E-posta doğrulanmadı'};
const accountUserId = () => {
  try { const id = window.MAAccount?.getUser()?.id; return typeof id === 'string' && id ? id : null; }
  catch { return null; }
};
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function accessStatus(value, owner) {
  if (!value || Array.isArray(value) || value.userId !== owner ||
      typeof value.email !== 'string' || value.email.length > 320 ||
      typeof value.confirmed !== 'boolean' || typeof value.isAdmin !== 'boolean' ||
      typeof value.bundleReady !== 'boolean' || !ACCESS_STATES.has(value.status) ||
      value.status === 'approved' && !value.confirmed || value.isAdmin && !value.confirmed) {
    throw Error('Geçersiz erişim yanıtı');
  }
  // Only the server's status fields are retained. Archive credentials never
  // enter this controller, its public API, DOM, events or browser storage.
  return Object.freeze({userId:owner, email:value.email, confirmed:value.confirmed,
    isAdmin:value.isAdmin, status:value.status, bundleReady:value.bundleReady});
}
function member(value) {
  if (!value || Array.isArray(value) || typeof value.userId !== 'string' || !value.userId ||
      value.userId.length > 100 || typeof value.email !== 'string' || value.email.length > 320 ||
      !ACCESS_STATES.has(value.status)) throw Error('Geçersiz üye yanıtı');
  const date = raw => typeof raw === 'string' && Number.isFinite(Date.parse(raw)) ? raw : null;
  return Object.freeze({userId:value.userId, email:value.email, status:value.status,
    requestedAt:date(value.requestedAt), decidedAt:date(value.decidedAt)});
}
function serviceError(error, fallback) {
  const code = String(error?.code || '');
  return ['PGRST202', 'PGRST106', '42883'].includes(code) || error?.status === 404
    ? 'Kaynak erişim hizmeti henüz kullanıma hazır değil. Daha sonra yeniden dene.'
    : fallback;
}

// These controls describe a server-verified permission. They are not an access
// boundary: every protected source request must also be authorised by the RPC
// and database policies. Nothing is inferred from a local role or email address.
export function createSourceAccessController({onChange} = {}) {
  let owner = accountUserId(), epoch = 0, statusRevision = 0, phase = 'idle', status = null, statusTask = null;
  let errorMessage = '', requestBusy = false, adminBusy = false, memberPhase = 'idle';
  let members = [], memberMessage = '', memberError = '', memberRevision = 0, memberTask = null;
  let lastPublished = '', destroyed = false;
  const gates = new Set(), accountPanels = new Set();
  const getStatus = () => accountUserId() === owner && (phase === 'ready' || phase === 'loading') ? status : null;
  const current = (id, generation) => !destroyed && owner === id && epoch === generation && accountUserId() === id;
  const isAdmin = () => accountUserId() === owner && getStatus()?.isAdmin === true && getStatus()?.confirmed === true;
  const rpc = (name, params = {}) => {
    if (typeof window.MAAccount?.sourceRpc !== 'function') {
      const error = Error('Erişim hizmeti hazır değil'); error.code = 'PGRST202'; throw error;
    }
    return window.MAAccount.sourceRpc(name, params);
  };
  function button(label, action, {id, className='smallbtn', disabled=false} = {}) {
    const node = element('button', label, className);
    node.type = 'button'; node.disabled = disabled;
    if (id) node.id = id;
    node.onclick = action;
    return node;
  }
  function openAccount() { document.getElementById('accountButton')?.click(); }
  function publish() {
    renderAll();
    const safe = getStatus(), next = JSON.stringify([owner, safe]);
    if (next === lastPublished) return;
    lastPublished = next;
    try { onChange?.(safe); } catch { /* A view callback cannot retain a revoked permission. */ }
    window.dispatchEvent(new CustomEvent('ma-source-access-changed', {detail:{
      userId:owner, status:safe?.status || null,
      approved:safe?.confirmed === true && safe.status === 'approved'
    }}));
  }
  function clearForAccount(next) {
    owner = next; epoch++; statusRevision++; status = null; phase = 'idle'; statusTask = null;
    errorMessage = ''; requestBusy = false; adminBusy = false;
    members = []; memberPhase = 'idle'; memberMessage = ''; memberError = '';
    memberRevision++; memberTask = null;
    publish();
  }
  async function refresh() {
    if (destroyed) return null;
    const next = accountUserId();
    if (next !== owner) clearForAccount(next);
    if (!owner) { phase = 'ready'; status = null; publish(); return null; }
    if (statusTask?.owner === owner) return statusTask.promise;
    const id = owner, generation = epoch, revision = ++statusRevision;
    // A same-account refresh keeps the last server-verified status while the
    // request is in flight. A normal focus/poll must not unload an active exam.
    // A failed verification, changed account or explicit revoke clears it.
    phase = 'loading'; errorMessage = ''; requestBusy = false;
    publish();
    const task = {owner:id, promise:null};
    task.promise = (async () => {
      try {
        const response = await Promise.resolve().then(() => rpc('ma_source_access_status'));
        if (!current(id, generation) || revision !== statusRevision) return null;
        status = accessStatus(response, id); phase = 'ready';
        if (!status.isAdmin) {
          members = []; memberPhase = 'idle'; memberRevision++; memberTask = null; adminBusy = false;
        }
        publish();
        return status;
      } catch (error) {
        if (!current(id, generation) || revision !== statusRevision) return null;
        status = null; phase = 'error';
        members = []; memberPhase = 'idle'; memberRevision++; memberTask = null; adminBusy = false;
        errorMessage = serviceError(error, 'Erişim durumu doğrulanamadı. Bağlantını kontrol edip yeniden dene.');
        publish(); return null;
      } finally {
        if (statusTask === task) statusTask = null;
      }
    })();
    statusTask = task;
    return task.promise;
  }
  async function requestAccess() {
    if (!owner || accountUserId() !== owner || requestBusy || phase !== 'ready' || status?.status === 'approved' || status?.status === 'email_unconfirmed') return;
    const id = owner, generation = epoch, revision = ++statusRevision;
    requestBusy = true; errorMessage = ''; renderAll();
    try {
      const response = await rpc('ma_source_access_request');
      if (!current(id, generation) || revision !== statusRevision) return;
      status = accessStatus(response, id); phase = 'ready'; requestBusy = false;
      publish();
    } catch (error) {
      if (!current(id, generation) || revision !== statusRevision) return;
      requestBusy = false; status = null; phase = 'error';
      errorMessage = serviceError(error, 'Erişim isteğin kaydedilemedi. Yeniden deneyebilirsin.');
      publish();
    }
  }
  async function loadMembers(force = false) {
    if (!isAdmin() || destroyed) return;
    if (memberTask && !force) return memberTask;
    const id = owner, generation = epoch, revision = ++memberRevision;
    memberPhase = 'loading'; memberError = ''; renderAll();
    const task = (async () => {
      try {
        const response = await Promise.resolve().then(() => rpc('ma_source_access_members'));
        if (!current(id, generation) || revision !== memberRevision || !isAdmin()) return;
        if (!Array.isArray(response)) throw Error('Geçersiz üye listesi');
        const rows = response.map(member);
        if (new Set(rows.map(row => row.userId)).size !== rows.length) throw Error('Tekrarlanan üye kaydı');
        members = rows; memberPhase = 'ready';
      } catch (error) {
        if (!current(id, generation) || revision !== memberRevision) return;
        members = []; memberPhase = 'error';
        memberError = serviceError(error, 'Üye listesi okunamadı. Yeniden deneyebilirsin.');
        if (error?.status === 401 || error?.status === 403) { await refresh(); return; }
      } finally {
        if (current(id, generation) && revision === memberRevision) {
          memberTask = null; renderAll();
        }
      }
    })();
    memberTask = task; return task;
  }
  async function setMember(params) {
    if (!isAdmin() || adminBusy || destroyed) return;
    const id = owner, generation = epoch;
    adminBusy = true; memberMessage = 'Erişim güncelleniyor…'; memberError = ''; renderAll();
    try {
      const response = await rpc('ma_source_access_set_member', params);
      if (!current(id, generation) || !isAdmin()) return;
      const updated = member(response);
      if (params.target_user_id && updated.userId !== params.target_user_id ||
          updated.status !== (params.allowed ? 'approved' : 'revoked')) throw Error('İzin değişikliği doğrulanamadı');
      adminBusy = false;
      memberMessage = params.allowed ? 'Hesabın kaynak erişimi onaylandı.' : 'Hesabın kaynak erişimi kapatıldı.';
      if (updated.userId === owner) {
        if (!params.allowed) { status = null; phase = 'idle'; publish(); }
        await refresh(); return;
      }
      await loadMembers(true);
    } catch (error) {
      if (!current(id, generation)) return;
      adminBusy = false; memberMessage = '';
      memberError = serviceError(error, 'İzin değişikliği doğrulanamadı. Kayıtlı hesabı kontrol edip yeniden dene.');
      if (error?.status === 401 || error?.status === 403) { await refresh(); return; }
      renderAll();
    }
  }
  function description() {
    if (!owner) return {title:'Denemeler için giriş yap', text:'Kaynaklara erişim hesabın için kontrol edilir.'};
    if ((phase === 'idle' || phase === 'loading') && !status) return {title:'Erişim kontrol ediliyor', text:'Hesabının erişim durumu doğrulanıyor.'};
    if (phase === 'error') return {title:'Erişim doğrulanamadı', text:errorMessage};
    if (status?.status === 'email_unconfirmed') return {title:'E-posta doğrulaması gerekli', text:'E-postandaki doğrulama bağlantısını açıp yeniden giriş yap.'};
    if (status?.status === 'approved') return status.bundleReady
      ? {title:'Denemeler hazırlanıyor', text:'Erişimin onaylandı. Deneme listesi açılıyor…'}
      : {title:'Erişimin onaylandı', text:'Sorular henüz kullanıma hazır değil. Daha sonra yeniden dene.'};
    return {title:'Erişim onayı bekleniyor', text:status?.status === 'pending'
      ? 'Erişim isteğin yönetici onayını bekliyor.'
      : status?.status === 'revoked' ? 'Bu hesabın kaynak erişimi kapalı. Yöneticiyle iletişime geç.'
      : 'Hesabın henüz onaylanmadı. Kaynaklara erişmek için bir istek gönderebilirsin.'};
  }
  function appendActions(node, accountPanel = false) {
    if (!owner) {
      node.append(button('Giriş yap', openAccount, {id:accountPanel ? undefined : 'sourceAccessLogin', className:'btn'}));
      return;
    }
    if (phase === 'idle' || phase === 'loading') return;
    if (phase === 'ready' && status?.status === 'none') {
      node.append(button(requestBusy ? 'İstek gönderiliyor…' : 'Erişim iste', requestAccess,
        {id:accountPanel ? undefined : 'requestSourceAccess', className:'btn', disabled:requestBusy}));
    }
    node.append(button('Yeniden kontrol et', refresh,
      {id:accountPanel ? undefined : 'refreshSourceAccess', disabled:requestBusy || adminBusy}));
  }
  function paintGate(node) {
    node.replaceChildren(); node.classList.add('source-access-gate');
    node.setAttribute('aria-busy', String(phase === 'loading' || requestBusy));
    const message = description(), heading = element('h2', message.title), note = element('p', message.text, 'source-access-note');
    note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
    const panel=element('div');panel.id='questionBankEmpty';panel.setAttribute('role','status');panel.append(heading,note);node.append(panel);
    const actions = element('div', undefined, 'source-access-actions'); appendActions(actions); panel.append(actions);
  }
  function paintAccountPanel(node) {
    node.replaceChildren(); node.classList.add('source-access-account');
    const message = description(); node.append(element('h3', isAdmin() ? 'Kaynak erişim yönetimi' : 'Kaynak erişimi'));
    const note = element('p', message.text, 'source-access-note'); note.setAttribute('role', 'status'); node.append(note);
    if (!isAdmin()) {
      const actions = element('div', undefined, 'source-access-actions'); appendActions(actions, true); node.append(actions); return;
    }
    const form = element('form', undefined, 'source-access-grant');
    const label = element('label', 'Kayıtlı hesaba izin ver');
    const email = element('input', undefined, 'field');
    email.type = 'email'; email.required = true; email.maxLength = 254;
    email.autocomplete = 'off'; email.placeholder = 'Kayıtlı hesabın e-posta adresi';
    email.name = 'source-access-email'; email.disabled = adminBusy;
    label.append(email);
    const submit = element('button', 'İzin ver', 'smallbtn'); submit.type = 'submit'; submit.disabled = adminBusy;
    form.append(label, submit);
    form.onsubmit = event => {
      event.preventDefault(); const targetEmail = email.value.trim();
      if (!targetEmail || !form.reportValidity()) return;
      setMember({target_email:targetEmail, allowed:true});
    };
    node.append(form);
    const actionNote = element('p', memberError || memberMessage, 'source-access-note');
    actionNote.setAttribute('role', 'status'); actionNote.setAttribute('aria-live', 'polite'); node.append(actionNote);
    if (memberPhase === 'loading' || memberPhase === 'idle') node.append(element('p', 'Üyeler yükleniyor…', 'source-access-note'));
    if (memberPhase === 'ready' && !members.length) node.append(element('p', 'Henüz erişim isteği yok.', 'source-access-note'));
    const list = element('div', undefined, 'source-access-members');
    for (const row of members) {
      const item = element('article', undefined, 'source-access-member'); item.dataset.sourceMemberId = row.userId;
      const identity = element('div', undefined, 'source-access-identity');
      identity.append(element('strong', row.email || 'Kayıtlı hesap'), element('span', memberLabels[row.status]));
      const actions = element('div', undefined, 'source-access-actions');
      if(row.userId===owner){actions.append(element('span','Yönetici'));}
      else if (row.status !== 'approved') {
        const allow = button('Onayla', () => setMember({target_user_id:row.userId, allowed:true}), {disabled:adminBusy});
        allow.dataset.sourceApprove = row.userId; actions.append(allow);
      } else {
        const revoke = button('Erişimi kapat', () => setMember({target_user_id:row.userId, allowed:false}), {disabled:adminBusy});
        revoke.dataset.sourceRevoke = row.userId; actions.append(revoke);
      }
      item.append(identity, actions); list.append(item);
    }
    node.append(list);
    node.append(button('Üye listesini yenile', () => loadMembers(true), {id:'reloadSourceAccessMembers', disabled:adminBusy || memberPhase === 'loading'}));
    if (memberPhase === 'idle' && !memberTask) queueMicrotask(() => { if (node.isConnected && isAdmin()) loadMembers(); });
  }
  function renderAll() {
    for (const node of gates) { if (!node.isConnected) gates.delete(node); else paintGate(node); }
    for (const node of accountPanels) { if (!node.isConnected) accountPanels.delete(node); else paintAccountPanel(node); }
  }
  function renderGate(node) { if (!node) return; gates.add(node); paintGate(node); }
  function releaseGate(node) {
    gates.delete(node);
    node?.classList.remove('source-access-gate'); node?.removeAttribute('aria-busy');
  }
  function mountAccountPanel(node) { if (!node) return; accountPanels.add(node); paintAccountPanel(node); }
  function accountChanged() { clearForAccount(accountUserId()); refresh(); }
  function checkOnFocus() { if (accountUserId()) refresh(); }
  function visibilityChanged() { if (document.visibilityState === 'visible') checkOnFocus(); }
  window.addEventListener('ma-account-changed', accountChanged);
  window.addEventListener('focus', checkOnFocus);
  document.addEventListener('visibilitychange', visibilityChanged);
  queueMicrotask(() => { if (!destroyed) refresh(); });
  return {
    getStatus, refresh, renderGate, releaseGate, mountAccountPanel,
    destroy() {
      destroyed = true; epoch++; statusRevision++; memberRevision++; status = null; members = [];
      gates.clear(); accountPanels.clear();
      window.removeEventListener('ma-account-changed', accountChanged);
      window.removeEventListener('focus', checkOnFocus);
      document.removeEventListener('visibilitychange', visibilityChanged);
    }
  };
}
