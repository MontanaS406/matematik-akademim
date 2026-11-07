import {test,expect} from './fixtures.mjs';
const row=(id,user)=>({id,user_id:user,exam_type:'TYT',correct:40,wrong:0,blank:0,net:40,duration_seconds:60,answers:{year:2025},created_at:new Date().toISOString()});
for(const nextUser of ['alice','bob'])test(`old exam response ignored after logout and ${nextUser} login`,async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('ma_auth',JSON.stringify({access_token:'fake-initial',refresh_token:'fake-refresh',expires_at_ms:Date.now()+3600000,user:{id:'alice'}})));
  let release,seen;const held=new Promise(resolve=>release=resolve),firstSeen=new Promise(resolve=>seen=resolve);let gets=0;
  await page.route('https://*.supabase.co/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:'fake-new-'+nextUser,refresh_token:'fake-new-refresh',expires_in:3600,user:{id:nextUser}}});
    if(url.pathname!=='/rest/v1/exam_results')return route.fulfill({json:[]});
    if(request.method()==='POST')return route.fulfill({json:[]});
    gets++;if(gets===1){seen();await held;return route.fulfill({json:[row('old-session-row','alice')]})}
    return route.fulfill({json:[row('new-session-row',nextUser)]});
  });
  try{
    await page.goto('/');await page.getByRole('button',{name:'📝 Denemeler'}).click();await firstSeen;await page.locator('#logoutBtn').click();
    await page.locator('#userEmail').fill(nextUser+'@example.test');await page.locator('#userPassword').fill('fake-password');await page.locator('#signIn').click();
    await expect(page.locator('#syncStatus')).toContainText('eşitlendi');expect(gets).toBe(2);
    const oldResponse=page.waitForResponse(response=>response.url().includes('/rest/v1/exam_results')&&response.request().method()==='GET');release();await oldResponse;
    await expect(page.locator('#recordCount')).toHaveText('1 kayıt');
    const ids=await page.evaluate(user=>JSON.parse(localStorage.getItem('matematik_akademim_exam_history_v11_'+user)).map(r=>r.id),nextUser);expect(ids).toEqual(['new-session-row']);
  }finally{release()}
});
