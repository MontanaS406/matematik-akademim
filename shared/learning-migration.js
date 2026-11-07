// A one-time, exact snapshot before the source-only app writes a previous profile.
// This never edits the source profile, exam history, auth storage or an existing snapshot.
export const snapshotKey=(owner,origin='local')=>'ma_source_bank_backup_v1_'+encodeURIComponent(owner||'guest')+'_'+origin;
export function captureLearningSnapshot(storage,owner,value,origin='local'){
 if(value==null)return true;
 try{const key=snapshotKey(owner,origin);if(storage.getItem(key)!==null)return true;const raw=typeof value==='string'?value:JSON.stringify(value);storage.setItem(key,raw);return storage.getItem(key)===raw}catch{return false}
}
