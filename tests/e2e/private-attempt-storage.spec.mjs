import {test,expect} from './fixtures.mjs';

test('restarting a private booklet archives finished attempts and snapshots without changing owner boundaries',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {openPrivateLibrary,PRIVATE_LIBRARY_DATABASE}=await import('/shared/private-library.js');
  const alice=openPrivateLibrary('alice'),bob=openPrivateLibrary('bob');
  const blob=new Blob(['%PDF-1.4\nBlank storage fixture, no question content.\n%%EOF'],{type:'application/pdf'}),metadata={examType:'OTHER',year:null,sourceTitle:'Blank persistence fixture',questionCount:2};
  const base=Date.now(),fresh=startedAt=>({answers:[null,null],index:0,startedAt,pausedAt:null,pausedMs:0,finishedAt:null,finishedDuration:null,score:null,binding:null});
  try{
   const original=await alice.put({blob,metadata,answerKey:'AB'});
   // Simulate a pre-feature record: reading must not require a schema upgrade.
   await alice.close();const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(PRIVATE_LIBRARY_DATABASE,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
   await new Promise((resolve,reject)=>{const tx=db.transaction('books','readwrite'),store=tx.objectStore('books'),request=store.get(['alice',original.id]);request.onsuccess=()=>{delete request.result.attempts;store.put(request.result)};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});db.close();
   const legacy=await alice.get(original.id);
   const finished={...fresh(base-20000),answers:['A',null],finishedAt:new Date(base-10000).toISOString(),finishedDuration:10,score:{correct:1,wrong:0,blank:1,net:1}};
   const first=(await alice.saveProgress(original.id,finished)).progress;
   const second=await alice.restart(original.id,fresh(base-9000));
   await alice.update(original.id,{answerKey:'CD',metadata:{sourceTitle:'Changed current title'}});
   const secondFinished={...second.progress,answers:['C','D'],finishedAt:new Date(base-1000).toISOString(),finishedDuration:8,score:{correct:2,wrong:0,blank:0,net:2}};
   const secondSaved=(await alice.saveProgress(original.id,secondFinished)).progress;
   const third=await alice.restart(original.id,fresh(base));
   const repeat=await alice.put({blob,metadata:{...metadata,sourceTitle:'Current title'},answerKey:'DE'});
   const beforeClear=await alice.get(original.id);let clearTaggedDenied=false;try{await alice.saveProgress(original.id,null)}catch{clearTaggedDenied=true}
   // An older restored row can contain only archives and no active work.
   const historyDb=await new Promise((resolve,reject)=>{const request=indexedDB.open(PRIVATE_LIBRARY_DATABASE,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});await new Promise((resolve,reject)=>{const tx=historyDb.transaction('books','readwrite'),books=tx.objectStore('books'),request=books.get(['alice',original.id]);request.onsuccess=()=>{request.result.progress=null;books.put(request.result)};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});historyDb.close();
   const deny=async action=>{try{await action();return false}catch{return true}};
   const identityUpdateDenied=await deny(()=>alice.update(original.id,{metadata:{questionCount:3},answerKey:null}));
   const identityPutDenied=await deny(()=>alice.put({blob,metadata:{...metadata,questionCount:3},answerKey:null}));
   const otherRestartDenied=await deny(()=>bob.restart(original.id,fresh(base)));
   const afterClear=await alice.get(original.id),listed=(await alice.list())[0];
   return {legacyHistory:legacy.attempts,history:third.attempts,first,secondSaved,repeatHistory:repeat.attempts,beforeClearHistory:beforeClear.attempts,afterClearHistory:afterClear.attempts,afterClearProgress:afterClear.progress,clearTaggedDenied,createdAtPreserved:original.createdAt===third.createdAt,hasBlob:'blob' in listed,hasOwner:'owner' in listed,identityUpdateDenied,identityPutDenied,otherRestartDenied,bobRead:await bob.get(original.id),bobCount:(await bob.list()).length};
  }finally{await alice.close();await bob.close()}
 });
 expect(result.legacyHistory).toEqual([]);expect(result.history).toHaveLength(2);expect(result.history.map(item=>item.id)).toEqual(['attempt-1','attempt-2']);
 expect(result.history[0].progress).toEqual(result.first);expect(result.history[0].answerKey.value).toBe('AB');expect(result.history[0].answerKey.verified).toBe(false);expect(result.history[0].metadata.sourceTitle).toBe('Blank persistence fixture');
 expect(result.history[1].progress).toEqual(result.secondSaved);expect(result.history[1].answerKey.value).toBe('CD');expect(result.history[1].metadata.sourceTitle).toBe('Changed current title');
 expect(result.repeatHistory).toEqual(result.history);expect(result.beforeClearHistory).toEqual(result.history);expect(result.afterClearHistory).toEqual(result.history);expect(result.afterClearProgress).toBeNull();
 expect(result).toMatchObject({clearTaggedDenied:true,createdAtPreserved:true,hasBlob:false,hasOwner:false,identityUpdateDenied:true,identityPutDenied:true,otherRestartDenied:true,bobRead:null,bobCount:0});
});

test('restart is atomic on storage failure and refuses unfinished or nonblank replacement attempts',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {openPrivateLibrary}=await import('/shared/private-library.js');const library=openPrivateLibrary('guest');
  const base=Date.now(),metadata={examType:'OTHER',year:null,sourceTitle:'Blank restart failure fixture',questionCount:2},fresh=startedAt=>({answers:[null,null],index:0,startedAt,pausedAt:null,pausedMs:0,finishedAt:null,finishedDuration:null,score:null,binding:null});
  const denied=async action=>{try{await action();return false}catch{return true}};
  try{
   const book=await library.put({blob:new Blob(['%PDF-1.4\nNo exam content.\n%%EOF']),metadata});
   await library.saveProgress(book.id,fresh(base-20000));const unfinished=await library.get(book.id),unfinishedDenied=await denied(()=>library.restart(book.id,fresh(base)));
   const afterUnfinished=await library.get(book.id);
   const completed=await library.saveProgress(book.id,{...fresh(base-20000),answers:['A',null],finishedAt:new Date(base-1000).toISOString(),finishedDuration:19,score:{correct:1,wrong:0,blank:1,net:1}});
   const mutations=[{answers:['A',null]},{index:1},{flags:[true,false]},{topics:['Sayılar',null]},{questionPages:[1,null]},{startedAt:base-2000},{finishedAt:new Date(base).toISOString(),finishedDuration:0},{binding:{examId:'test-only',confirmedAt:new Date(base).toISOString()}}];
   const replacementsDenied=[];for(const patch of mutations)replacementsDenied.push(await denied(()=>library.restart(book.id,{...fresh(base),...patch})));
   const clearCompletedDenied=await denied(()=>library.saveProgress(book.id,null)),replaceCompletedDenied=await denied(()=>library.saveProgress(book.id,fresh(base)));
   const put=IDBObjectStore.prototype.put;let failNext=true;IDBObjectStore.prototype.put=function(value,...args){if(failNext&&this.transaction.db.name==='MatematikAkademimPrivateLibraryV1'&&value.attempts?.length){failNext=false;throw new DOMException('Injected restart write failure','QuotaExceededError')}return put.call(this,value,...args)};
   const failed=await denied(()=>library.restart(book.id,fresh(base))),afterFailure=await library.get(book.id);
   IDBObjectStore.prototype.put=put;
   const retried=await library.restart(book.id,fresh(base));
   return {unfinishedDenied,unfinishedUnchanged:JSON.stringify(unfinished)===JSON.stringify(afterUnfinished),replacementsDenied,clearCompletedDenied,replaceCompletedDenied,failed,failedProgress:afterFailure.progress,failedHistory:afterFailure.attempts,completedProgress:completed.progress,retriedHistory:retried.attempts,retriedProgress:retried.progress};
  }finally{await library.close()}
 });
 expect(result.unfinishedDenied).toBe(true);expect(result.unfinishedUnchanged).toBe(true);expect(result.replacementsDenied.every(Boolean)).toBe(true);expect(result.clearCompletedDenied).toBe(true);expect(result.replaceCompletedDenied).toBe(true);expect(result.failed).toBe(true);
 expect(result.failedProgress).toEqual(result.completedProgress);expect(result.failedHistory).toEqual([]);expect(result.retriedHistory).toHaveLength(1);expect(result.retriedHistory[0].progress).toEqual(result.completedProgress);expect(result.retriedProgress.answers).toEqual([null,null]);expect(result.retriedProgress.finishedAt).toBeNull();
});


test('a stale tab cannot replace a new same-millisecond attempt with the old completed snapshot',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const {openPrivateLibrary}=await import('/shared/private-library.js');const library=openPrivateLibrary('guest');
  const startedAt=Date.now(),metadata={examType:'OTHER',year:null,sourceTitle:'Blank same-time generation fixture',questionCount:1},fresh={answers:[null],index:0,startedAt,pausedAt:null,pausedMs:0,finishedAt:null,finishedDuration:null,score:null,binding:null};
  const deny=async action=>{try{await action();return false}catch{return true}};
  try{
   const book=await library.put({blob:new Blob(['%PDF-1.4\nNo questions.\n%%EOF']),metadata});
   const first=(await library.saveProgress(book.id,{...fresh,finishedAt:new Date(startedAt).toISOString(),finishedDuration:0})).progress;
   const second=await library.restart(book.id,fresh);const missingGenerationDenied=await deny(()=>library.saveProgress(book.id,first));
   const secondFinished={...second.progress,finishedAt:new Date(startedAt).toISOString(),finishedDuration:0};await library.saveProgress(book.id,secondFinished);
   const third=await library.restart(book.id,fresh);const staleGenerationDenied=await deny(()=>library.saveProgress(book.id,secondFinished));
   const changedTimeDenied=await deny(()=>library.saveProgress(book.id,{...third.progress,startedAt:startedAt-1}));
   const after=await library.get(book.id);await library.saveProgress(book.id,{...after.progress,flags:[true]});
   return {missingGenerationDenied,staleGenerationDenied,changedTimeDenied,firstHasGeneration:'attemptId' in first,secondGeneration:second.progress.attemptId,thirdGeneration:third.progress.attemptId,retained:after.progress,thirdProgress:third.progress,history:after.attempts,updated:(await library.get(book.id)).progress};
  }finally{await library.close()}
 });
 expect(result).toMatchObject({missingGenerationDenied:true,staleGenerationDenied:true,changedTimeDenied:true,firstHasGeneration:false,secondGeneration:'attempt-2',thirdGeneration:'attempt-3'});
 expect(result.retained).toEqual(result.thirdProgress);expect(result.history).toHaveLength(2);expect(result.updated.attemptId).toBe('attempt-3');expect(result.updated.flags).toEqual([true]);
});
