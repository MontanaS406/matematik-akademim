import {test,expect} from './fixtures.mjs';
import {openAccount,HISTORY_KEY} from './source-helpers.mjs';

const session={access_token:'fake-alice',refresh_token:'fake-refresh',expires_at_ms:Date.now()+3600000,user:{id:'alice',email:'alice@example.test'}};
const oldRecord={id:'retained-alice-result',type:'TYT',year:2024,date:'2026-01-01T12:00:00Z',duration:60,correct:1,wrong:1,blank:38,net:0.75,markedAnswers:Array(40).fill(null)};
async function signedIn(page){
 await page.addInitScript(({session,key,record})=>{sessionStorage.setItem('ma_auth',JSON.stringify(session));localStorage.setItem(key+'_alice',JSON.stringify([record]))},{session,key:HISTORY_KEY,record:oldRecord});
 await page.goto('/');await openAccount(page);await expect(page.locator('#logoutBtn')).toBeVisible();
}

test('logout clears this device immediately and revokes only the captured server session',async({page})=>{
 let release,arrived,captured;const hold=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>arrived=resolve);
 await page.route('https://*.supabase.co/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname==='/auth/v1/logout'){captured={method:request.method(),scope:url.searchParams.get('scope'),authorization:request.headers().authorization,prefer:request.headers().prefer,body:request.postData()};arrived();await hold;return route.fulfill({status:204})}
  return route.fulfill({json:[]});
 });
 try{
  await signedIn(page);await page.locator('#logoutBtn').click();await seen;
  expect(await page.evaluate(()=>window.MAAccount.getUser())).toBeNull();expect(await page.evaluate(()=>sessionStorage.getItem('ma_auth'))).toBeNull();await expect(page.locator('#signIn')).toBeVisible();
  expect(captured).toEqual({method:'POST',scope:'local',authorization:'Bearer fake-alice',prefer:undefined,body:null});
  const response=page.waitForResponse(response=>new URL(response.url()).pathname==='/auth/v1/logout');release();await response;
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key+'_alice')),HISTORY_KEY)).toEqual([oldRecord]);
 }finally{release()}
});

test('offline logout retains local isolation and reports that server revocation was not confirmed',async({page})=>{
 await page.route('https://*.supabase.co/**',route=>new URL(route.request().url()).pathname==='/auth/v1/logout'?route.abort('internetdisconnected'):route.fulfill({json:[]}));
 await signedIn(page);await page.locator('#logoutBtn').click();await expect(page.locator('#syncStatus')).toContainText('Bu cihazdaki oturum kapatıldı. Sunucu çıkışı doğrulanamadı');
 expect(await page.evaluate(()=>window.MAAccount.getUser())).toBeNull();expect(await page.evaluate(()=>sessionStorage.getItem('ma_auth'))).toBeNull();expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key+'_alice')),HISTORY_KEY)).toEqual([oldRecord]);
});

test('a late old logout failure cannot sign out or overwrite the status of a new account',async({page})=>{
 let release,arrived;const hold=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>arrived=resolve);
 await page.route('https://*.supabase.co/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/auth/v1/logout'){arrived();await hold;return route.fulfill({status:503,json:{error:'offline old session'}})}
  if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:'fake-bob',refresh_token:'fake-bob-refresh',expires_in:3600,user:{id:'bob',email:'bob@example.test'}}});
  return route.fulfill({json:[]});
 });
 try{
  await signedIn(page);await page.locator('#logoutBtn').click();await seen;await page.locator('#userEmail').fill('bob@example.test');await page.locator('#userPassword').fill('fake-password');await page.locator('#signIn').click();await expect.poll(()=>page.evaluate(()=>window.MAAccount.getUser())).toEqual({id:'bob'});await expect(page.locator('#syncStatus')).toHaveText(/Kayıtların eşitlendi\.|Öğrenme kaydın hazır\./);
  const response=page.waitForResponse(response=>new URL(response.url()).pathname==='/auth/v1/logout');release();await response;
  await expect(page.locator('#account .account-identity')).toContainText('bob@example.test');await expect(page.locator('#syncStatus')).not.toContainText('Sunucu çıkışı');expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ma_auth')).user.id)).toBe('bob');
 }finally{release()}
});
