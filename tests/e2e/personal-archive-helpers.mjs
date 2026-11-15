import {expect} from './fixtures.mjs';
import {personalArchiveFixture} from '../personal-archive-fixture.mjs';

export const ARCHIVE_USER='archive-test-user';
export async function installApprovedArchive(page,{customize,wrongKey=false}={}){
 const fixture=personalArchiveFixture(customize);
 await page.route('**/data/personal-archive.json',route=>route.fulfill({json:fixture.config}));
 await page.route('**/assets/personal-archive/**',route=>{const bytes=fixture.assets.get(new URL(route.request().url()).pathname);return bytes?route.fulfill({body:bytes,contentType:'application/octet-stream'}):route.abort()});
 await page.route('https://*.supabase.co/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/ma_source_access_status'))return route.fulfill({json:{userId:ARCHIVE_USER,email:'archive@example.test',confirmed:true,isAdmin:false,status:'approved',bundleReady:true}});
  if(path.endsWith('/ma_source_archive_access'))return route.fulfill({json:{bundleId:fixture.config.id,key:wrongKey?'A'.repeat(43):fixture.key}});
  return path==='/auth/v1/logout'?route.fulfill({status:204}):route.fulfill({json:[]});
 });
 await page.addInitScript(user=>{
  if(!sessionStorage.getItem('ma_auth'))sessionStorage.setItem('ma_auth',JSON.stringify({access_token:'fake-archive-user',refresh_token:'fake-refresh',expires_at_ms:Date.now()+3600000,user:{id:user,email:'archive@example.test'}}));
 },ARCHIVE_USER);
 return fixture;
}
export async function openApprovedArchive(page){
 await page.goto('/');await page.locator('#bankPool').selectOption('original');
 await expect(page.locator('#personalArchiveRoot')).toBeVisible();await expect(page.locator('#archiveOriginalImage canvas')).toBeVisible();
}
