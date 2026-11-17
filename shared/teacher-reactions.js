// Short authored UI reactions stay separate from teaching dialogue examples.
import {TEACHER_PERSONAS} from './teacher-personas.js';
import {REACTIONS as cagatay} from './teacher-reactions/cagatay.js';
import {REACTIONS as beyza} from './teacher-reactions/beyza.js';
import {REACTIONS as zeynep} from './teacher-reactions/zeynep.js';
import {REACTIONS as kemal} from './teacher-reactions/kemal.js';
import {REACTIONS as mert} from './teacher-reactions/mert.js';
import {REACTIONS as elif} from './teacher-reactions/elif.js';
import {REACTIONS as riza} from './teacher-reactions/riza.js';
import {REACTIONS as nermin} from './teacher-reactions/nermin.js';
import {REACTIONS as bora} from './teacher-reactions/bora.js';
import {REACTIONS as derya} from './teacher-reactions/derya.js';
export const TEACHER_REACTION_VERSION='reaction-v1';
const additions=Object.freeze({cagatay,beyza,zeynep,kemal,mert,elif,riza,nermin,bora,derya});
const kinds=Object.freeze(['greeting','correct','incorrect','waiting']);
const legacy=(profile,kind)=>kind==='greeting'?[profile.greeting]:kind==='correct'?profile.correctResponses:kind==='incorrect'?profile.incorrectResponses:profile.waitingLines;
const pools=Object.freeze(Object.fromEntries(Object.entries(TEACHER_PERSONAS).map(([id,profile])=>[id,Object.freeze(Object.fromEntries(kinds.map(kind=>[kind,Object.freeze([...legacy(profile,kind),...additions[id][kind]])])))])));
export const TEACHER_REACTION_ADDITION_COUNT=Object.values(additions).reduce((sum,profile)=>sum+kinds.reduce((n,kind)=>n+profile[kind].length,0),0);
export const TEACHER_REACTION_COUNT=Object.values(pools).reduce((sum,profile)=>sum+kinds.reduce((n,kind)=>n+profile[kind].length,0),0);
export function getTeacherReactions(teacherId,kind){
 if(typeof teacherId!=='string'||!Object.hasOwn(pools,teacherId))throw new RangeError('Geçerli bir öğretmen seç.');
 if(!kinds.includes(kind))throw new RangeError('Öğretmen tepkisi geçersiz.');
 return pools[teacherId][kind];
}
