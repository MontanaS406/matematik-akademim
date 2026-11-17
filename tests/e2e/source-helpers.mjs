import {expect} from './fixtures.mjs';
export const HISTORY_KEY='matematik_akademim_exam_history_v11';
export const TUTOR_USER_ID='00000000-0000-4000-8000-000000000001';
export const TUTOR_ACCESS_TOKEN='test-tutor-session-access';
export async function openProgress(page){await page.getByRole('button',{name:'İlerleme',exact:true}).click();await expect(page.locator('#history')).toBeVisible()}
export async function openAccount(page){await page.locator('#accountButton').click();await expect(page.locator('#accountPanel')).toHaveAttribute('open','')}
export async function chooseTeacher(page,name){await page.locator('#teacherChange').click();await expect(page.locator('#teacherDialog')).toHaveAttribute('open','');await page.locator('#teacherPicker').getByRole('button',{name,exact:true}).click();await expect(page.locator('#teacherDialog')).not.toHaveAttribute('open','')}
export async function prepareTutorConfig(page,workerUrl='https://tutor.example'){
 await page.route('**/data/tutor-config.json*',route=>route.fulfill({json:{workerUrl}}));
}
// A normal persisted Supabase session, not a production auth bypass. Test-only
// markers keep reloads realistic after logout without reseeding the account.
export async function prepareTutorAccount(page,{userId=TUTOR_USER_ID,email='tutor-fixture@example.test',accessToken=TUTOR_ACCESS_TOKEN,initialAccessToken=accessToken,refreshToken='test-tutor-session-refresh',status='approved',confirmed=true,expired=false,session=true,remoteState=null,onRefresh}={}){
 await prepareTutorConfig(page);
 const profile=remoteState||{teacherId:'elif',courseId:null,difficulty:'easy',preferencesAt:'1970-01-01T00:00:00.000Z',attempts:[]};
 let savedProfile=profile;
 await page.route('https://*.supabase.co/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  const current={id:userId,email};
  if(path==='/auth/v1/token'){
   if(url.searchParams.get('grant_type')==='refresh_token')onRefresh?.(request.postDataJSON());
   return route.fulfill({json:{access_token:accessToken,refresh_token:refreshToken,expires_in:3600,user:current}});
  }
  if(path==='/auth/v1/user')return route.fulfill({json:current});
  if(path==='/auth/v1/logout')return route.fulfill({status:204});
  if(path==='/rest/v1/rpc/ma_source_access_status'||path==='/rest/v1/rpc/ma_source_access_request')return route.fulfill({json:{userId,email,confirmed,isAdmin:false,status,bundleReady:false}});
  if(path==='/rest/v1/learning_profiles'){
   if(request.method()==='POST'){savedProfile=request.postDataJSON().state;return route.fulfill({json:[]})}
   return route.fulfill({json:[{user_id:userId,state:savedProfile}]});
  }
  return route.fulfill({json:[]});
 });
 if(session)await page.addInitScript(({userId,email,accessToken,initialAccessToken,refreshToken,expired})=>{
  const marker='test_tutor_session_seeded';if(sessionStorage.getItem(marker))return;sessionStorage.setItem(marker,'1');
  sessionStorage.setItem('ma_auth',JSON.stringify({access_token:initialAccessToken,refresh_token:refreshToken,expires_at_ms:Date.now()+(expired?-1000:3600000),user:{id:userId,email}}));
 },{userId,email,accessToken,initialAccessToken,refreshToken,expired});
 return {userId,accessToken,email};
}
export async function configureAI(page){
 // Legacy test callsites now verify the visitor is never asked for credentials
 // or a Worker URL. The owner config and normal account are prepared beforehand.
 await expect(page.locator('#endpoint,#access,#saveAI,.connection-settings')).toHaveCount(0);
}
export async function signInTutor(page,email='tutor-fixture@example.test',password='fake-tutor-password'){
 await openAccount(page);await page.locator('#userEmail').fill(email);await page.locator('#userPassword').fill(password);await page.locator('#signIn').click();
}
export async function openAdultOptions(page){if(!await page.locator('#profanityConsent').isVisible())await page.locator('details').filter({has:page.locator('#profanityConsent')}).last().locator('summary').first().click()}
