// Fictional teaching characters. Identity and style are selected from this
// server-owned catalogue; request text can never replace a character prompt.
import {TEACHER_PERSONAS, TEACHER_PERSONA_VERSION} from './teacher-personas.js';
export {TEACHER_PERSONA_VERSION};
export const DEFAULT_TEACHER_ID = 'elif';
export const PROFANITY_LEVELS = Object.freeze([
  Object.freeze({id:'off',name:'Kapalı'}),Object.freeze({id:'mild',name:'Hafif'}),
  Object.freeze({id:'heavy',name:'Ağır'}),Object.freeze({id:'extreme',name:'Çok ağır'})
]);
export const TEACHERS = Object.freeze(Object.entries(TEACHER_PERSONAS).map(([id,profile])=>Object.freeze({
  id,...profile,correctResponse:profile.correctResponses[0],incorrectResponse:profile.incorrectResponses[0]
})));

export function resolveTeacherOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Öğretmen ayarları geçersiz.');
  const teacherId = options.teacherId === undefined ? DEFAULT_TEACHER_ID : options.teacherId;
  const profanityLevel = options.profanityLevel === undefined ? 'off' : options.profanityLevel;
  if (typeof teacherId !== 'string' || !TEACHERS.some(t => t.id === teacherId)) throw new RangeError('Geçerli bir öğretmen seç.');
  if (typeof profanityLevel !== 'string' || !PROFANITY_LEVELS.some(level => level.id === profanityLevel)) throw new RangeError('Argo düzeyi geçersiz.');
  for (const field of ['adultConfirmed', 'profanityConsent']) {
    if (options[field] !== undefined && typeof options[field] !== 'boolean') throw new TypeError('Yetişkin ve argo onayları geçersiz.');
  }
  const adultConfirmed = options.adultConfirmed === true;
  const profanityConsent = options.profanityConsent === true;
  if (profanityLevel !== 'off' && (teacherId !== 'cagatay' || !adultConfirmed || !profanityConsent)) {
    throw new RangeError('Argo için Çağatay Hoca’yı seçip yetişkin ve argo tercihlerini açıkça onayla.');
  }
  return {teacherId, profanityLevel, adultConfirmed, profanityConsent};
}


const explicitTone = Object.freeze({
 mild:'Hafif argo ve seyrek küfürlü mizah: lan, ulan gibi kısa çıkışlar; her adımda gerekmez.',
 heavy:'Ağır argo ve küfürlü mizah: amk, siktir gibi çıkışları işaret karmaşasına veya zor işleme yönelt; açıklamayı anlaşılır tut.',
 extreme:'Çok ağır argo ve yoğun küfürlü mizah açıkça seçildi: amına koyayım, amk, siktir gibi ifadeler işlemin saçmalığına komik tepki olabilir; öğrenciye saldırı veya tehdit kurma.'
});
export function buildTeacherInstructions(options = {},context = 'source') {
 const selection=resolveTeacherOptions(options);
 if(!['source','lesson'].includes(context))throw new RangeError('Öğretim bağlamı geçersiz.');
 const profile=TEACHER_PERSONAS[selection.teacherId];
 const sections=[
  `${profile.name} rolündesin. Karakter sürümü: ${TEACHER_PERSONA_VERSION}. Meslek/komedi evrenin: ${profile.role}.`,
  'KONUŞMA SESİ: '+profile.voice,
  'RİTİM: '+profile.cadence,
  'ANLATIM YÖNTEMİN:\n'+profile.teachingMethod.map((step,i)=>`${i+1}. ${step}`).join('\n'),
  'MİZAHIN CEVABIN TAMAMINDA GÖRÜNSÜN:\n'+profile.humorRules.map(rule=>'• '+rule).join('\n'),
  'KARAKTER SÖZLÜĞÜ: '+profile.signatureLexicon.join(', ')+'. Her yanıtta uygun sözcükleri değiştir; aynı şakayı ezber gibi tekrarlama.',
  'KAÇINILACAKLAR: '+profile.avoid.join('; ')+'.',
  'KONUŞMA ÖRNEKLERİ: Aşağıdaki metinler yalnız üslup örnekleridir. Güncel konuyu veya seçili soruyu bunlarla değiştirme; öğrenciye bu metinleri aynen tekrar etme.\n'+profile.sampleDialogue.map(pair=>'Öğrenci: '+pair.student+'\n'+profile.name+': '+pair.teacher).join('\n\n'),
  context==='lesson'
   ? 'Yalnızca sunucunun seçtiği müfredat konusunun tanımlarını, formüllerini ve mantığını anlat. Soru bankasında içerik bulunmasını şart koşma. Yeni soru, benzer soru, örnek alıştırma veya rastgele sayısal problem oluşturma. Açıklamanın AI konu anlatımı olduğunu belirt; resmî çözüm olduğunu iddia etme.'
   : 'Yalnızca sunucunun seçtiği mevcut, doğrulanmış ve kullanım izni bulunan kaynak sorusunu açıkla. Yeni soru, benzer soru, örnek alıştırma veya rastgele sayısal problem oluşturma; özgün soru metnini veya sayılarını değiştirme. Açıklamanın AI tarafından hazırlandığını belirt; resmî çözüm olduğunu iddia etme.',
  'Mizah, girişte, açıklamanın gövdesinde ve kapanışta karaktere uygun olsun. Her şaka bir öğretim adımına bağlansın. Matematiksel tanımı, işlem koşullarını ve doğru sonucu eksiksiz koru; benzetmeye uydurmak için matematiği değiştirme. Formül veya bağımsız matematik satırına gereksiz süs ekleme. Yeni soru üretmek için karakteri gerekçe gösterme.',
  'Öğrenci kısa veya daha sakin anlatım isterse uzunluğu ve şaka yoğunluğunu azalt; mesleki kelime seçimini koru. Başarı, doğru seri, süre veya öğrencinin duygusunu uydurma. Yanlış cevabı doğru diye övme; önce gerçek matematik hatasını açıkla.',
  'Tehdit, nefret söylemi, kişisel özelliklere yönelik aşağılama veya öğrencinin zekâsına/değerine saldırı kullanma.'
 ];
 if(selection.teacherId==='beyza')sections.push('Beyza için belirleyici kural: matematiksel formülün tek başına durduğu satırlar dışında HER açıklama cümlesinde bir mimarlık/şantiye terimi kullan. Temel, kolon, kiriş, plan, ölçek, kat, cephe, proje, statik, iskân, taşıyıcı gibi sözcüklerle mesleki sesi doğal sürdür. Örneğin sonuç kontrolünü binanın statik kontrolüyle eşleştir. Cümleleri hep aynı mimarlık sözcüğüyle başlatma.');
 if(selection.teacherId==='cagatay'&&selection.profanityLevel!=='off')sections.push('Yetişkin kullanıcı küfürlü mizahı bu istek için açıkça seçti. '+explicitTone[selection.profanityLevel]);
 else sections.push('Küfürlü mod seçilmedi: küfür kullanma. Çağatay sert ve komik enerjisini küfürsüz de korur.');
 return sections.join('\n\n');
}

// Predictable variation keeps offline greetings/feedback recognisable without
// generating a question, changing a grade, or inventing student progress.
export function getTeacherLine(teacherId,kind='correct',variant=0,options={}) {
 const selection=resolveTeacherOptions({...options,teacherId});
 if(!['greeting','correct','incorrect','waiting'].includes(kind)||!Number.isSafeInteger(variant)||variant<0)throw new RangeError('Öğretmen tepkisi geçersiz.');
 const profile=TEACHER_PERSONAS[selection.teacherId];
 const lines=kind==='greeting'?[profile.greeting]:kind==='waiting'?profile.waitingLines:kind==='correct'?profile.correctResponses:profile.incorrectResponses;
 const line=lines[variant%lines.length];
 if(selection.teacherId!=='cagatay'||selection.profanityLevel==='off')return line;
 const phrases={mild:['Ulan,','Lan,','Hadi lan,'],heavy:['Amk,','Siktir,','Hadi amk,'],extreme:['Amına koyayım,','Siktir lan,','Amk,']};
 return phrases[selection.profanityLevel][variant%3]+' '+line[0].toLocaleLowerCase('tr-TR')+line.slice(1);
}
