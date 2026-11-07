import {test as base, expect} from '@playwright/test';
// Browser tests use local HTTP content and explicitly mocked services only.
// Per-test mocks register later and take precedence. Browser-internal PDF resources
// must remain outside request interception so the native viewer can initialize.
export const test=base.extend({
  page:async({page},use)=>{
    await page.route(/^https?:\/\//,route=>{
      const url=new URL(route.request().url());
      if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
      return route.abort('blockedbyclient');
    });
    await use(page);
  }
});
export {expect};
