// One pinned Gemini model with a documented free tier. Billing is a Google
// project setting: the operator must keep that project unlinked from billing.
// No SDK, fallback model, paid tool, automatic retry or API key in a URL.
export const DEFAULT_GEMINI_MODEL='gemini-3.5-flash-lite';
export class GeminiServiceError extends Error {
 constructor(message,{status=502,code='AI_UPSTREAM_ERROR',retryAfter}={}){super(message);this.name='GeminiServiceError';this.status=status;this.code=code;if(retryAfter!==undefined)this.retryAfter=retryAfter;}
}
export function resolveGeminiModel(model=DEFAULT_GEMINI_MODEL){
 if(model!==DEFAULT_GEMINI_MODEL)throw new GeminiServiceError('Ücretsiz katman için izin verilen Gemini modeli yapılandırılmalı. Otomatik model değişimi kapalı.',{status:503,code:'AI_MODEL_UNAVAILABLE'});
 return model;
}
function retryDelay(response){const value=response.headers.get('Retry-After');return value&&/^\d{1,5}$/.test(value)&&Number(value)>0&&Number(value)<=86400?Number(value):undefined;}
export async function generateGemini({env,instructions,messages,responseSchema,fetchImpl=(...args)=>globalThis.fetch(...args)}){
 const model=resolveGeminiModel(env.GEMINI_MODEL);
 if(typeof env.GEMINI_API_KEY!=='string'||!env.GEMINI_API_KEY.trim())throw new GeminiServiceError('Gemini bağlantısı henüz yapılandırılmadı.',{status:503,code:'AI_CONFIGURATION_REQUIRED'});
 let response;
 try{
  response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{
   method:'POST',signal:AbortSignal.timeout(30000),redirect:'error',
   headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
   body:JSON.stringify({systemInstruction:{parts:[{text:instructions}]},contents:messages.map(message=>({role:message.role==='assistant'?'model':'user',parts:[{text:message.content}]})),generationConfig:{maxOutputTokens:2048,responseMimeType:'application/json',responseJsonSchema:responseSchema}})
  });
 }catch{throw new GeminiServiceError('Gemini servisine bağlanılamadı. Tekrar deneyebilirsin.');}
 if(!response.ok){
  if(response.status===429)throw new GeminiServiceError('Gemini kotası veya istek sınırı doldu. Daha sonra yeniden dene; başka modele otomatik geçilmedi.',{status:429,code:'AI_QUOTA_EXHAUSTED',retryAfter:retryDelay(response)});
  if(response.status===402)throw new GeminiServiceError('Gemini projesinin ücretsiz katman ayarını kontrol et. Ücretli kullanıma otomatik geçiş yapılmadı.',{status:503,code:'AI_FREE_TIER_REQUIRED'});
  if([401,403].includes(response.status))throw new GeminiServiceError('Gemini anahtarı veya proje erişimi doğrulanamadı. Worker ayarlarını kontrol et.',{status:503,code:'AI_PROVIDER_CONFIGURATION'});
  if(response.status===404)throw new GeminiServiceError('Yapılandırılan Gemini modeli şu anda kullanılamıyor. Otomatik model değişimi kapalı.',{status:503,code:'AI_MODEL_UNAVAILABLE'});
  throw new GeminiServiceError('Gemini servisi geçici olarak yanıt veremedi. Tekrar deneyebilirsin.');
 }
 try{return await response.json()}catch{throw new GeminiServiceError('Gemini yanıtı okunamadı. Tekrar deneyebilirsin.');}
}
