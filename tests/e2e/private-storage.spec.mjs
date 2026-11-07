import {test,expect} from './fixtures.mjs';
test('private PDFs and keys are owner-scoped, deduplicated and never uploaded',async({page})=>{
 const external=[];page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:8080'))external.push(request.url())});await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {openPrivateLibrary}=await import('/shared/private-library.js'),alice=openPrivateLibrary('alice'),bob=openPrivateLibrary('bob');
  const metadata={examType:'TYT',year:2024,sourceTitle:'Private local document',mathStartPage:1,questionCount:2};
  try{
   const pdf=new Blob(['%PDF-1.4\n<script>parent.PDF_SCRIPT_EXECUTED=true</script>\n%%EOF'],{type:'text/html'});
   const first=await alice.put({blob:pdf,metadata,answerKey:{value:'AB',verified:true,provenance:'official'}}),second=await alice.put({blob:pdf,metadata});
   const bobRead=await bob.get(first.id),bobDelete=await bob.remove(first.id),bobList=await bob.list(),aliceList=await alice.list();
   const file=await alice.get(first.id);let otherUpdateRejected=false;try{await bob.update(first.id,{answerKey:'CD'})}catch{otherUpdateRejected=true}
   return {sameId:first.id===second.id,bobRead,bobDelete,bobCount:bobList.length,aliceCount:aliceList.length,listHasBlob:'blob' in aliceList[0],mime:file.blob.type,key:file.answerKey,otherUpdateRejected,byteLength:file.byteLength};
  }finally{await alice.close();await bob.close()}
 });
 expect(result).toMatchObject({sameId:true,bobRead:null,bobDelete:false,bobCount:0,aliceCount:1,listHasBlob:false,mime:'application/pdf',key:{value:'AB',provenance:'user-entered',verified:false},otherUpdateRejected:true});expect(result.byteLength).toBeGreaterThan(5);expect(external).toEqual([]);
});
test('saved private progress retains original answers and rejects ambiguous count replacement',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const {openPrivateLibrary}=await import('/shared/private-library.js');const library=openPrivateLibrary('alice');const metadata={examType:'AYT',year:2025,sourceTitle:'Private AYT',mathStartPage:2,questionCount:2};
  try{
   const blob=new Blob(['%PDF-1.4\nprivate test\n%%EOF'],{type:'application/pdf'}),record=await library.put({blob,metadata,answerKey:'AB'}),startedAt=Date.now()-3000;
   await library.saveProgress(record.id,{answers:['A',null],index:1,flags:[false,true],topics:['Denklemler',null],startedAt,pausedAt:null,pausedMs:1000,finishedDuration:null,finishedAt:null,limitSeconds:3600,binding:{examId:'osym-ayt-2025',confirmedAt:new Date().toISOString(),verified:true},access_token:'not-stored'});
   const repeat=await library.put({blob,metadata});let countRejected=false;try{await library.update(record.id,{metadata:{questionCount:3},answerKey:null})}catch{countRejected=true}
   const beforeClear=await library.get(record.id);await library.saveProgress(record.id,null);await library.update(record.id,{metadata:{questionCount:3},answerKey:null});const updated=await library.get(record.id);
   return {createdAtPreserved:record.createdAt===repeat.createdAt,countRejected,progress:beforeClear.progress,updatedCount:updated.metadata.questionCount,updatedProgress:updated.progress,updatedKey:updated.answerKey};
  }finally{await library.close()}
 });
 expect(result.createdAtPreserved).toBe(true);expect(result.countRejected).toBe(true);expect(result.progress.answers).toEqual(['A',null]);expect(result.progress.flags).toEqual([false,true]);expect(result.progress.access_token).toBeUndefined();expect(result.progress.binding.examId).toBe('osym-ayt-2025');expect(result.progress.binding.verified).toBeUndefined();expect(result.updatedCount).toBe(3);expect(result.updatedProgress).toBeNull();expect(result.updatedKey).toBeNull();
});
test('private library rejects fake PDFs without changing saved files',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const {openPrivateLibrary}=await import('/shared/private-library.js'),library=openPrivateLibrary('guest');const metadata={examType:'OTHER',year:null,sourceTitle:'Local file',questionCount:1};
  try{const original=await library.put({blob:new Blob(['%PDF-1.4\noriginal\n%%EOF']),metadata});let rejected=false;try{await library.put({blob:new Blob(['<script>bad()</script>'],{type:'application/pdf'}),metadata})}catch{rejected=true}return {rejected,count:(await library.list()).length,stillSaved:!!await library.get(original.id)}}finally{await library.close()}
 });expect(result).toEqual({rejected:true,count:1,stillSaved:true});
});
test('old metadata is normalized on read and ongoing work cannot be silently moved to another exam',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const {openPrivateLibrary,PRIVATE_LIBRARY_DATABASE}=await import('/shared/private-library.js');const store=openPrivateLibrary('compat');const record=await store.put({blob:new Blob(['%PDF-1.4\nold private file'],{type:'application/pdf'}),metadata:{examType:'TYT',year:2024,sourceTitle:'Old private source',questionCount:2}});
  await store.saveProgress(record.id,{answers:['A',null],index:0,startedAt:Date.now(),pausedAt:null,pausedMs:0,finishedDuration:null,finishedAt:null,limitSeconds:0});
  const denied=await store.update(record.id,{metadata:{examType:'AYT',year:2025}}).then(()=>false,()=>true);
  await store.close();const db=await new Promise(resolve=>{const req=indexedDB.open(PRIVATE_LIBRARY_DATABASE,1);req.onsuccess=()=>resolve(req.result)});await new Promise((resolve,reject)=>{const tx=db.transaction('books','readwrite'),books=tx.objectStore('books'),req=books.get(['compat',record.id]);req.onsuccess=()=>{delete req.result.metadata.questionNumbers;books.put(req.result)};tx.oncomplete=resolve;tx.onerror=reject});db.close();
  const restored=await store.get(record.id);await store.close();return {denied,numbers:restored.metadata.questionNumbers,answer:restored.progress.answers[0],year:restored.metadata.year};
 });expect(result).toEqual({denied:true,numbers:[1,2],answer:'A',year:2024});
});
