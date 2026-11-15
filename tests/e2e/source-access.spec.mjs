import {test, expect} from './fixtures.mjs';
import {personalArchiveFixture} from '../personal-archive-fixture.mjs';
import {openAccount} from './source-helpers.mjs';

const USERS = {
  admin: {id:'20000000-0000-4000-8000-000000000001', email:'owner@example.test'},
  alice: {id:'20000000-0000-4000-8000-000000000002', email:'alice@example.test'},
  bob: {id:'20000000-0000-4000-8000-000000000003', email:'bob@example.test'}
};

async function install(page, initial = {}) {
  const fixture = personalArchiveFixture(), calls = [], requestUrls = [];
  const states = {admin:'approved', alice:'none', bob:'none', ...initial};
  let archiveHold = null, wrongStatusOwner = false;
  page.on('request', request => requestUrls.push(request.url()));
  await page.route('**/data/personal-archive.json', route => route.fulfill({json:fixture.config}));
  await page.route('**/assets/personal-archive/**', route => {
    const bytes = fixture.assets.get(new URL(route.request().url()).pathname);
    return bytes ? route.fulfill({body:bytes, contentType:'application/octet-stream'}) : route.abort();
  });
  const row = name => ({userId:USERS[name].id, email:USERS[name].email,
    status:states[name], requestedAt:'2026-11-15T10:00:00Z', decidedAt:states[name] === 'pending' ? null : '2026-11-15T11:00:00Z'});
  await page.route('https://*.supabase.co/**', async route => {
    const req = route.request(), url = new URL(req.url());
    const body = req.postDataJSON();
    if (url.pathname === '/auth/v1/token') {
      const name = Object.keys(USERS).find(name => USERS[name].email === body?.email);
      if (!name) return route.fulfill({status:400, json:{error:'Unknown test account'}});
      // Deliberately untrusted metadata must not grant administrative controls.
      return route.fulfill({json:{access_token:'fake-source-'+name, refresh_token:'fake-refresh-'+name,
        expires_in:3600, user:{...USERS[name], user_metadata:{isAdmin:true, role:'admin', email_verified:true}}}});
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({status:204});
    if (!url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({json:[]});
    const actor = req.headers().authorization?.replace('Bearer fake-source-', '');
    const name = url.pathname.split('/').pop();
    calls.push({name, actor, body, url:req.url()});
    const deny = () => route.fulfill({status:403, json:{code:'42501', message:'Test server denied source access'}});
    if (!USERS[actor]) return deny();
    if (name === 'ma_source_access_status') return route.fulfill({json:{
      userId:wrongStatusOwner ? USERS.bob.id : USERS[actor].id, email:USERS[actor].email,
      confirmed:true, isAdmin:actor === 'admin', status:states[actor], bundleReady:true
    }});
    if (name === 'ma_source_access_request') {
      if (states[actor] === 'none') states[actor] = 'pending';
      return route.fulfill({json:{userId:USERS[actor].id, email:USERS[actor].email,
        confirmed:true, isAdmin:actor === 'admin', status:states[actor], bundleReady:true}});
    }
    if (name === 'ma_source_access_members') {
      if (actor !== 'admin') return deny();
      return route.fulfill({json:Object.keys(USERS).filter(name => states[name] !== 'none').map(row)});
    }
    if (name === 'ma_source_access_set_member') {
      if (actor !== 'admin') return deny();
      const target = Object.keys(USERS).find(name => body.target_user_id === USERS[name].id ||
        body.target_email?.toLowerCase() === USERS[name].email);
      if (!target || target === 'admin' && !body.allowed) return deny();
      states[target] = body.allowed ? 'approved' : 'revoked';
      return route.fulfill({json:row(target)});
    }
    if (name === 'ma_source_archive_access') {
      if (states[actor] !== 'approved') return deny();
      if (archiveHold?.actor === actor) { const hold=archiveHold; hold.arrive(); await hold.promise; }
      return route.fulfill({json:{bundleId:fixture.config.id, key:fixture.key}});
    }
    return deny();
  });
  return {fixture, states, calls, requestUrls,
    spoofStatusOwner() { wrongStatusOwner = true; },
    holdArchive(actor) {
      let release, arrive;
      const promise = new Promise(resolve => release = resolve), arrived = new Promise(resolve => arrive = resolve);
      archiveHold = {actor, promise, arrive};
      return {arrived, release};
    }
  };
}

async function login(page, name) {
  await openAccount(page);
  if (await page.locator('#logoutBtn').isVisible()) await page.locator('#logoutBtn').click();
  await page.locator('#userEmail').fill(USERS[name].email);
  await page.locator('#userPassword').fill('test-source-password');
  await page.locator('#signIn').click();
  await expect.poll(() => page.evaluate(() => window.MAAccount.getUser())).toEqual({id:USERS[name].id});
}
async function originals(page) {
  await page.locator('.nav [data-page="study"]').click();
  await page.locator('#bankPool').selectOption('original');
}
async function openedQuestions(page) {
  await originals(page);
  await expect(page.locator('#personalArchiveRoot')).toBeVisible();
  await page.locator('[data-archive-tab="questions"]').click();
  await expect(page.locator('#archiveOriginalImage canvas')).toBeVisible();
}
async function expectNoStoredKey(page, fixture) {
  const stored = await page.evaluate(() => ({local:Object.entries(localStorage), session:Object.entries(sessionStorage)}));
  expect(JSON.stringify(stored)).not.toContain(fixture.key);
  expect(await page.locator('body').innerHTML()).not.toContain(fixture.key);
  expect(page.url()).not.toContain(fixture.key);
}

test('a valid retired fragment and forged local approval cannot unlock sources without an authenticated account', async({page}) => {
  const server = await install(page), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(key => {
    sessionStorage.setItem('ma_personal_archive_access_v1_guest', key);
    localStorage.setItem('source-access-role', JSON.stringify({isAdmin:true, status:'approved'}));
  }, server.fixture.key);
  await page.goto('/#archive='+server.fixture.key);
  await page.locator('#openReadyExams').click();
  await expect(page.locator('#sourceAccessLogin')).toBeVisible();
  await expect(page.locator('#sourceQuestion')).toContainText('Denemeler için giriş yap');
  await expect(page.locator('#personalArchiveRoot, #archiveOriginalImage canvas')).toHaveCount(0);
  await expect(page.locator('#personalArchiveKey,#unlockPersonalArchive,input[type=file]')).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe('');
  expect(server.calls).toEqual([]);
  expect(server.requestUrls.some(url => url.includes('/assets/personal-archive/'))).toBe(false);
  expect(await page.locator('body').innerText()).not.toContain('PrivateFixtureBook');
  await expectNoStoredKey(page, server.fixture);
  expect(errors).toEqual([]);
});

test('a normal account can request access but metadata and direct RPC calls cannot self-approve or obtain a key', async({page}) => {
  const server = await install(page);
  await page.goto('/'); await login(page, 'alice'); await originals(page);
  await expect(page.locator('#requestSourceAccess')).toBeVisible();
  await page.locator('#requestSourceAccess').click();
  await expect(page.locator('#sourceQuestion')).toContainText('Erişim isteğin yönetici onayını bekliyor');
  expect(server.states.alice).toBe('pending');
  await expect(page.locator('#requestSourceAccess')).toHaveCount(0);
  await openAccount(page);
  await expect(page.locator('.source-access-grant,[data-source-approve],[data-source-revoke]')).toHaveCount(0);
  const denied = await page.evaluate(async id => {
    const results = [];
    for (const [name, params] of [
      ['ma_source_access_set_member', {target_user_id:id, allowed:true}],
      ['ma_source_archive_access', {}]
    ]) {
      try { await window.MAAccount.sourceRpc(name, params); results.push(false); }
      catch { results.push(true); }
    }
    return results;
  }, USERS.alice.id);
  expect(denied).toEqual([true,true]); expect(server.states.alice).toBe('pending');
  await expect(page.locator('#personalArchiveRoot')).toHaveCount(0);
  await expectNoStoredKey(page, server.fixture);
});

test('server-verified administrator can approve and revoke pending accounts and approve a registered email', async({page}) => {
  const server = await install(page, {alice:'pending'});
  await page.goto('/'); await login(page, 'admin'); await openAccount(page);
  const alice = page.locator(`[data-source-member-id="${USERS.alice.id}"]`);
  await expect(alice).toContainText('Onay bekliyor');
  await alice.locator('[data-source-approve]').click();
  await expect(alice).toContainText('Onaylı'); expect(server.states.alice).toBe('approved');
  expect(server.calls.find(call => call.name === 'ma_source_access_set_member')?.body)
    .toEqual({target_user_id:USERS.alice.id, allowed:true});
  await alice.locator('[data-source-revoke]').click();
  await expect(alice).toContainText('Erişim kapalı'); expect(server.states.alice).toBe('revoked');
  await page.locator('.source-access-grant input[name="source-access-email"]').fill(USERS.bob.email);
  await page.locator('.source-access-grant').getByRole('button', {name:'İzin ver', exact:true}).click();
  await expect(page.locator(`[data-source-member-id="${USERS.bob.id}"]`)).toContainText('Onaylı');
  expect(server.calls.filter(call => call.name === 'ma_source_access_set_member').at(-1).body)
    .toEqual({target_email:USERS.bob.email, allowed:true});
  await expectNoStoredKey(page, server.fixture);
});

test('approved sources open from server permission and keep the decryption key out of DOM, URLs and browser storage', async({page}) => {
  const server = await install(page, {alice:'approved'});
  await page.goto('/'); await login(page, 'alice'); await openedQuestions(page);
  await expect(page.locator('#archiveQuestion')).toHaveAttribute('data-original-id','ORIG-FIXTURE-1');
  await page.locator('#archiveAnswerArea [data-original-option="C"]').click();
  const stored = await page.evaluate(id => localStorage.getItem('ma_original_practice_v1_'+id), USERS.alice.id);
  expect(JSON.parse(stored)[0].answer).toBe('C');
  await expectNoStoredKey(page, server.fixture);
  expect(server.requestUrls.some(url => url.includes(server.fixture.key))).toBe(false);
  expect(server.calls.some(call => call.name === 'ma_source_archive_access' && call.actor === 'alice')).toBe(true);
  expect(server.calls.every(call => !JSON.stringify(call.body).includes(server.fixture.key))).toBe(true);
  await page.reload(); await openedQuestions(page);
  expect(await page.evaluate(id => localStorage.getItem('ma_original_practice_v1_'+id), USERS.alice.id)).toBe(stored);
  expect(server.calls.filter(call => call.name === 'ma_source_archive_access' && call.actor === 'alice').length).toBeGreaterThanOrEqual(2);
  await expectNoStoredKey(page, server.fixture);
});

test('revocation on the same account clears decrypted contents on focus without deleting previous answers', async({page}) => {
  const server = await install(page, {alice:'approved'});
  await page.goto('/'); await login(page, 'alice'); await openedQuestions(page);
  await page.locator('#archiveAnswerArea [data-original-option="B"]').click();
  const before = await page.evaluate(id => localStorage.getItem('ma_original_practice_v1_'+id), USERS.alice.id);
  server.states.alice = 'revoked';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#personalArchiveRoot,#archiveOriginalImage canvas')).toHaveCount(0);
  await expect(page.locator('#sourceQuestion')).toContainText('Bu hesabın kaynak erişimi kapalı');
  expect(await page.locator('body').innerText()).not.toContain('PrivateFixtureBook');
  expect(await page.evaluate(() => window.MAPersonalArchive.getSummary())).toEqual({exams:[],practice:[]});
  expect(await page.evaluate(id => localStorage.getItem('ma_original_practice_v1_'+id), USERS.alice.id)).toBe(before);
  await expectNoStoredKey(page, server.fixture);
});

test('a late archive grant from the previous account cannot reveal sources after signing into another account', async({page}) => {
  const server = await install(page, {alice:'approved', bob:'pending'}), held = server.holdArchive('alice');
  try {
    await page.goto('/'); await login(page, 'alice'); await held.arrived;
    await login(page, 'bob'); await originals(page);
    await expect(page.locator('#sourceQuestion')).toContainText('Erişim isteğin yönetici onayını bekliyor');
    const response = page.waitForResponse(response => response.url().endsWith('/rpc/ma_source_archive_access'));
    held.release(); await response;
    await expect(page.locator('#personalArchiveRoot,#archiveOriginalImage canvas')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toContain('PrivateFixtureBook');
    expect(await page.evaluate(() => window.MAAccount.getUser())).toEqual({id:USERS.bob.id});
    expect(server.requestUrls.some(url => url.includes('/assets/personal-archive/'))).toBe(false);
    await expectNoStoredKey(page, server.fixture);
  } finally { held.release(); }
});

test('an access status for a different user fails closed before any protected archive request', async({page}) => {
  const server = await install(page, {alice:'approved'}); server.spoofStatusOwner();
  await page.goto('/'); await login(page, 'alice'); await originals(page);
  await expect(page.locator('#sourceQuestion')).toContainText('Erişim doğrulanamadı');
  expect(server.calls.some(call => call.name === 'ma_source_archive_access')).toBe(false);
  await expect(page.locator('#personalArchiveRoot,#archiveOriginalImage canvas')).toHaveCount(0);
  await expectNoStoredKey(page, server.fixture);
});
