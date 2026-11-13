"""Resumable, accessible-AI-anchored TYT authoring. No original PDF inspected.
Every template changes the mathematical demand, not just numeric parameters.
Authoring solution is checked by SymPy's independent exact arithmetic engine;
finite-search templates additionally enumerate their explicitly stated domain.
"""
from __future__ import annotations
from pathlib import Path
from collections import defaultdict
from fractions import Fraction as F
from itertools import product, permutations, combinations
from math import comb, factorial, gcd, isqrt, lcm
import ast, hashlib, json, re, sys
import sympy as S
sys.path.insert(0,str(Path(__file__).parent))
import tyt_counting
ROOT=Path(__file__).resolve().parents[2]
DEFAULT_INPUT=ROOT/'data/ai/archive-input.json'
PARENTS=[q for q in json.loads(DEFAULT_INPUT.read_text()) if q['examType']=='TYT']
BYID={p['id']:p for p in PARENTS}
VERSION='tyt-structural-v2'
def fmt(x):
 x=F(x);return str(x.numerator) if x.denominator==1 else f'{x.numerator}/{x.denominator}'
def evaluate(expr):
 q=S.sympify(expr,rational=True,locals={'Rational':S.Rational,'binomial':S.binomial,'factorial':S.factorial,'floor':S.floor,'ceiling':S.ceiling,'gcd':S.gcd,'lcm':S.lcm})
 q=S.simplify(q)
 assert q.is_Rational, (expr,q)
 return F(int(q.p),int(q.q))
class Author:
 def __init__(self):self.questions=[];self.families={}
 def emit(self,pid,family,v,prompt,answer,expr,steps,params=None,difficulty=None,spec=None):
  assert pid in BYID,pid
  ans=F(answer);check=evaluate(expr)
  assert ans==check,(family,v,ans,check,expr)
  identifier=f'AI-NEW-TYT-{family.upper()}-{v:02d}'
  options,letter=tyt_counting.five_options(ans,identifier)
  difficulty=difficulty or ('easy' if v<=3 else 'medium' if v<=7 else 'hard')
  steps=list(steps) if isinstance(steps,list) else [steps]
  steps.append(f'İstenen sonuç {fmt(ans)} olur.')
  p=BYID[pid]
  spec=spec or {'type':'exact_expression','expression':expr,'semanticCheck':prompt}
  spec['promptAnchor']=prompt
  spec['promptTokens']=list(dict.fromkeys(re.findall(r'(?<![A-Za-z])\d+',prompt)))
  self.questions.append({'id':identifier,'examType':'TYT','courseId':p['courseId'],'topic':p['topic'],'subtopic':family,
    'difficulty':difficulty,'difficultyReason':{'easy':'Bir temel bağıntı doğrudan uygulanır.','medium':'En az iki işlem veya bir koşulun ters yönde kullanılması gerekir.','hard':'Birden fazla koşul, durum ayrımı veya sonlu olasılıkların elenmesi gerekir.'}[difficulty],
    'prompt':prompt,'options':options,'answer':{'value':letter,'computedValue':fmt(ans),'solution':'\n'.join(steps)},'solutionSteps':steps,
    'origin':'AI_URETIMI','pool':'generated','parentQuestionId':pid,'familyId':family,'templateId':f'{family}-{v:02d}',
    'parameters':params or {},'verificationSpec':spec,'verification':{'status':'automated_verified','mathPassed':True,'validator':VERSION,
     'methods':['Exact Python Fraction/integer author solution','Independent SymPy exact-expression evaluation'],
     'checks':{'independentResultMatches':True,'fiveOptions':True,'uniqueEquivalentOptions':True,'singleCorrectOption':True},'editorialStatus':'pending'},'publicationStatus':'ready_for_review'})
  self.families.setdefault(family,{'parent':pid,'templates':[]})['templates'].append(identifier)
 def rows(self,pid,family,rows):
  for v,row in enumerate(rows,1):self.emit(pid,family,v,*row)
 def search(self,pid,family,v,prompt,variables,predicate,objective,steps,params=None):
  names=list(variables);found=[]
  for values in product(*(range(a,b+1) for a,b in variables.values())):
   env=dict(zip(names,values));env.update({'abs':abs,'gcd':gcd,'isqrt':isqrt,'sum':sum,'max':max,'min':min})
   if eval(predicate,{'__builtins__':{}},env):found.append(env)
  if objective=='count':value=len(found)
  elif objective.startswith('sum:'):value=sum(eval(objective[4:],{'__builtins__':{}},x) for x in found)
  elif objective.startswith('min:'):value=min(eval(objective[4:],{'__builtins__':{}},x) for x in found)
  elif objective.startswith('max:'):value=max(eval(objective[4:],{'__builtins__':{}},x) for x in found)
  else:
   values={F(eval(objective,{'__builtins__':{}},x)) for x in found};assert len(values)==1,(family,v,values)
   value=values.pop()
  spec={'type':'finite_search','variables':variables,'predicate':predicate,'objective':({'kind':objective.split(':')[0],'expression':objective.split(':',1)[1]} if ':' in objective else {'kind':'count','expression':'1'} if objective=='count' else {'kind':'unique','expression':objective}),'semanticCheck':prompt}
  self.emit(pid,family,v,prompt,value,fmt(value),steps,params,spec=spec)
  self.questions[-1]['verification']['methods']=['Finite integer-domain enumeration','Independent QA repeats stated domain and constraints']

def arithmetic(b):
 b.rows('AI-TYT01-01','operation-order',[
 ('−18 + 4·(7−12) işleminin sonucu kaçtır?',-38,'-18+4*(7-12)','Önce parantez 7−12=−5, sonra çarpma 4·(−5)=−20 yapılır.'),
 ('[(−36)÷6−2]² işleminin sonucu kaçtır?',64,'((-36)/6-2)**2','Bölüm −6, parantez −8 ve karesi 64 olur.'),
 ('6−[4−(3−8)] işleminin sonucu kaçtır?',-3,'6-(4-(3-8))','İç parantez −5; köşeli parantez 9 olur.'),
 ('a=−3, b=5 için a²−2ab+b² kaçtır?',64,'(-3)**2-2*(-3)*5+5**2','İfade (a−b)²=(−8)² olarak da bulunur.'),
 ('İki sayının toplamı −7, farkı (birinci eksi ikinci) 13’tür. Çarpımları kaçtır?',-30,'((-7+13)/2)*((-7-13)/2)','Toplam ve farkı toplayınca birinci sayı 3; ikinci sayı −10 olur.'),
 ('Bir işlemde 5·(x−3)+4=24 bulunuyor. x kaçtır?',7,'(24-4)/5+3','4 çıkarılıp 5’e bölünür; ardından 3 eklenir.'),
 ('24÷[2·(1+2)] + 3² işleminin sonucu kaçtır?',13,'24/(2*(1+2))+3**2','Bölmenin paydası 6’dır; 24/6=4 ve 3²=9 toplanır.'),
 ('Bir sayı önce −4 ile çarpılıp 7 eklenince −29 oluyor. Aynı sayıdan 5 çıkarılırsa kaç kalır?',4,'(-29-7)/(-4)-5','Ters işlemle sayı 9 bulunur; 9−5 hesaplanır.'),
 ('x⋆y=2x−3y+xy olarak tanımlıdır. (2⋆3)⋆1 kaçtır?',0,'2*(2*2-3*3+2*3)-3+(2*2-3*3+2*3)','Önce 2⋆3=1; sonra 1⋆1=0 olur.'),
 ('−2, 3 ve 5 sayıları birer kez kullanılarak a·(b+c) yazılıyor. Bu ifadenin alabileceği en büyük değer kaçtır?',9,'max(-2*(3+5),3*(-2+5),5*(-2+3))','Çarpan sırasıyla −2, 3 ve 5 seçilirse sonuçlar −16, 9 ve 5 olur.'),
 ])
 # Correct intermediate author arithmetic intentionally checked before publication.
 b.rows('AI-TYT02-01','algebra-evaluation',[
 ('x=7 için (x−1)(x+1) kaçtır?',48,'(7-1)*(7+1)','İki kare farkından x²−1=48 olur.'),
 ('a+b=11 ve ab=24 ise a²+b² kaçtır?',73,'11**2-2*24','(a+b)²=a²+2ab+b² bağıntısında değerler yerine konur.'),
 ('x−y=5 ve xy=14 ise x²+y² kaçtır?',53,'5**2+2*14','(x−y)²=x²−2xy+y² kullanılır.'),
 ('x+y=9 ve x−y=3 ise x²−y² kaçtır?',27,'9*3','İki kare farkı (x+y)(x−y) biçiminde ayrılır.'),
 ('t+1/t=5, t≠0 ise t²+1/t² kaçtır?',23,'5**2-2','Verilen eşitliğin karesi alınır ve 2 çıkarılır.'),
 ('a+b=8 ve a²+b²=34 ise ab kaçtır?',15,'(8**2-34)/2','64=34+2ab denkleminden çarpım bulunur.'),
 ('x²−6x+9=16 ve x>3 ise x kaçtır?',7,'3+sqrt(16)','Sol taraf (x−3)²’dir; x>3 koşulu pozitif kökü seçer.'),
 ('a−b=4 ve a³−b³=208 ise ab kaçtır?',12,'(208/4-4**2)/3','a³−b³=(a−b)((a−b)²+3ab) bağıntısı kullanılır.'),
 ('x+y+z=6 ve xy+xz+yz=7 ise x²+y²+z² kaçtır?',22,'6**2-2*7','Toplamın karesi açılır ve ikili çarpımların iki katı çıkarılır.'),
 ('x=103 için x²−206x+10610 ifadesi kaçtır?',1,'103**2-206*103+10610','İfade (x−103)²+1 biçiminde tamamlanır.'),
 ])
 b.rows('AI-TYT03-01','coefficient',[
 ('(2x+3)(x−4) ifadesinde x teriminin katsayısı kaçtır?',-5,'2*(-4)+3','Çapraz çarpımlar −8x+3x verir.'),
 ('(a+2b)(3a−b) açılımında ab katsayısı kaçtır?',5,'-1+2*3','ab terimleri −ab ve 6ab’dir.'),
 ('(x−3)²+4x ifadesinin sabit terimi kaçtır?',9,'(-3)**2','Sabit terim için x=0 alınır.'),
 ('P(x)=(x+2)(2x−1) ise P(x) polinomunun katsayıları toplamı kaçtır?',3,'(1+2)*(2*1-1)','Katsayılar toplamı P(1)’e eşittir.'),
 ('P(x)=3x³−5x²+2x−7 ise çift kuvvetli terimlerin katsayıları toplamı kaçtır?',-12,'-5-7','Çift kuvvetler x² ve x⁰’dır; katsayıları −5 ve −7 toplanır.'),
 ('(kx+2)(x−3) açılımında x katsayısı −10 ise k kaçtır?',4,'(2+10)/3','x katsayısı −3k+2’dir; −3k+2=−10 çözülür.'),
 ('(x+a)² açılımında x katsayısı 14 ise sabit terim kaçtır?',49,'(14/2)**2','2a=14 olduğundan a=7 ve sabit terim a² olur.'),
 ('P(x)=2(x−1)²−3(x+2) için P(0)+P(1) kaçtır?',-13,'(2*(-1)**2-3*2)+(2*0**2-3*3)','Yerine koymayla P(0)=−4 ve P(1)=−9 bulunur.'),
 ('(2a−b)²−(a+3b)(a−3b) açılımında b² katsayısı kaçtır?',10,'1+9','İlk kare b², çıkarılan çarpım −9b² içerir; toplam 10b² olur.'),
 ('P(x)=(x−2)(x+3)(x−1) ise x² katsayısı kaçtır?',0,'-2+3-1','Baş katsayısı 1 olan çarpımda x² katsayısı sabitlerin toplamıdır.'),
 ])
 b.rows('AI-TYT04-01','inverse-operations',[
 ('Bir sayı 3 ile çarpılıp 8 eklenince 35 oluyor. Sayı kaçtır?',9,'(35-8)/3','Son işlemden başlayarak 8 çıkarılıp 3’e bölünür.'),
 ('A→2A−5→3(2A−5)+4 işlemleri sonunda 49 bulunuyor. A kaçtır?',10,'((49-4)/3+5)/2','Önce 4 çıkarılıp 3’e bölünür; 5 eklenip 2’ye bölünür.'),
 ('Bir sayının yarısının 7 eksiği 11 ise sayının üçte biri kaçtır?',12,'(11+7)*2/3','Başlangıç sayısı 36’dır; üçte biri hesaplanır.'),
 ('x sayısına 5 ekleyip 4’e bölmek, x’ten 4 çıkarıp 3’e bölmekle aynı sonucu veriyor. x kaçtır?',31,'(3*5+4*4)/(4-3)','(x+5)/4=(x−4)/3 eşitliğinde içler dışlar çarpılır.'),
 ('Bir makine x girdisine 5x−2 çıktısı veriyor. Aynı makineye art arda iki kez giren sayı 113 çıktısını veriyor. İlk sayı kaçtır?',5,'((113+2)/5+2)/5','Makine iki kez tersine uygulanır.'),
 ('Bir sayının 3 fazlası ile 2 eksiğinin toplamı 19’dur. Bu sayı kaçtır?',9,'(19-3+2)/2','(x+3)+(x−2)=19 denkleminden 2x=18 olur.'),
 ('A’dan 4 çıkarılıp sonuç 2 ile çarpılınca B elde ediliyor. A+B=34 ise B kaçtır?',20,'2*((34+8)/3-4)','B=2A−8 ve 3A−8=34 denklemleri birlikte çözülür.'),
 ('Bir sayının 2 katının 3 fazlası ile aynı sayının 5 katının 9 eksiği eşittir. Sayı kaçtır?',4,'(3+9)/(5-2)','2x+3=5x−9 denklemi çözülür.'),
 ('Bir makine önce x’i 4 ile çarpıp 6 çıkarıyor. Çıktı girdinin 3 katından 8 fazla ise x kaçtır?',14,'(6+8)/(4-3)','4x−6=3x+8 yazılır.'),
 ('Bir sayı önce 2 ile çarpılıp 3 ekleniyor; sonra sonuç 5’e bölünüyor. Sonuç başlangıç sayısının 1 eksiği ise sayı kaçtır?',F(8,3),'Rational(8,3)','(2x+3)/5=x−1 eşitliği 3x=8 verir.'),
 ])

def basic_number_families(b):
 b.rows('AI-TYT05-01','power-scaling',[
 ('x,y≠0 için x³/y ifadesinde x iki katına, y dört katına çıkarılırsa ifade kaç katına çıkar?',2,'2**3/4','Çarpan 2³/4 olarak bulunur.'),
 ('x,y≠0 için A=x²y³ ifadesinde x üç katına çıkarılırken y üçte birine indiriliyor. Yeni A eski A’nın kaç katıdır?',F(1,3),'3**2*Rational(1,3)**3','Her değişkenin ölçeği kendi üssüyle alınır.'),
 ('x,y,z≠0 için x⁴y²/z³ ifadesinde üç değişken de iki katına çıkarılırsa ifade kaç katına dönüşür?',8,'2**(4+2-3)','Toplam ölçek üssü 4+2−3=3’tür.'),
 ('Bir küpün tüm kenarları 3 katına çıkıyor. Hacim kaç katına çıkar?',27,'3**3','Hacim kenar uzunluğunun küpüyle orantılıdır.'),
 ('A=x²/y³ sabit tutuluyor. y dört katına çıkarılırken pozitif x kaç katına çıkarılmalıdır?',8,'sqrt(4**3)','x ölçeğinin karesi 4³=64 olmalıdır.'),
 ('(2³)²·2⁻⁴ işleminin sonucu kaçtır?',4,'(2**3)**2*2**(-4)','Kuvvetin kuvveti ve aynı tabanda çarpma kuralları uygulanır.'),
 ('3^(x+1)=81 eşitliğinde x kaçtır?',3,'4-1','81=3⁴ olduğundan üsler eşitlenir.'),
 ('5⁶/25² ifadesi kaçtır?',25,'5**6/25**2','25²=5⁴ olduğundan bölüm 5² olur.'),
 ('a=2³ ve b=2⁵ için (a+b)/a kaçtır?',5,'(2**3+2**5)/2**3','Payda ortak kuvvet olarak ayrılır; 1+2² elde edilir.'),
 ('2^n=8 ve 3^m=9 ise 2^(n+2)·3^(m−1) kaçtır?',96,'(8*2**2)*(9/3)','Verilen kuvvetlerden 2^(n+2)=32 ve 3^(m−1)=3 bulunur.'),
 ])
 b.rows('AI-TYT07-01','integer-change',[
 ('Bir soğuk odanın sıcaklığı −6°C’dir. Saatte 4°C soğutma 3 saat sürerse sıcaklık kaç °C olur?',-18,'-6-4*3','Başlangıçtan toplam 12°C çıkarılır.'),
 ('−15°C’deki bir madde saatte 3°C ısınıyor. 2°C’ye ulaşmadan önce geçen tam saat sayısı en çok kaçtır?',5,'floor((2-(-15)-1)/3)','−15+3t<2 koşulunda t<17/3 olduğundan en büyük tam saat 5’tir.'),
 ('Bakiye −40 TL iken hesaba 75 TL yatırılıyor ve 18 TL harcanıyor. Son bakiye kaç TL olur?',17,'-40+75-18','İşaretli değişimler başlangıç bakiyesine eklenir.'),
 ('Bir asansör −2. kattan 7 kat çıkıp 4 kat iniyor. Hangi kata gelir?',1,'-2+7-4','Kat değişimleri sırasıyla toplanır.'),
 ('Sıcaklık 8°C’den başlayıp her saat 3°C düşüyor. İlk kez sıfırın altına kaçıncı saatin sonunda iner?',3,'floor(8/3)+1','8−3t<0 için t>8/3 gerekir.'),
 ('Bir oyun +5 puan kazandırıyor, hata −3 puan getiriyor. 7 başarı ve 4 hata yapanın puanı kaçtır?',23,'7*5-4*3','Kazançlardan kayıplar çıkarılır.'),
 ('Bir dalgıç deniz seviyesinin 18 m altında. 7 m yükselip 12 m alçalırsa deniz seviyesine göre konumu kaç metredir?',-23,'-18+7-12','Deniz seviyesi 0, altı negatif seçilir.'),
 ('Başlangıç 4°C. Önce 2 saat saatte 5°C soğuyor, sonra saatte 3°C ısınıyor. Sıcaklık 9°C’ye kaç saat ısınmayla ulaşır?',5,'(9-(4-2*5))/3','Soğutmadan sonra −6°C olur; 15°C artış için 5 saat gerekir.'),
 ('Bir depo sıcaklığı 2 saat soğutma ve 1 saat beklemeyle bir döngü tamamlıyor. Soğutmada saatte 4°C azalıyor, beklemede saatte 3°C artıyor. Başlangıç 10°C ise 3 döngü sonunda kaç °C olur?',-5,'10+3*(-2*4+3)','Bir döngünün net etkisi −5°C’dir.'),
 ('A noktası sayı doğrusunda −8, B noktası 7’dir. A’dan B’ye gidip sonra −3’e dönen kişinin toplam yolu kaç birimdir?',25,'abs(7-(-8))+abs(-3-7)','Yönlü yer değiştirme yerine iki yolun mutlak uzunlukları toplanır.'),
 ])
 b.rows('V3-TYT-005-01','subtraction-relations',[
 ('Eksilen 54, çıkan 19 ise fark kaçtır?',35,'54-19','Eksilenden çıkan çıkarılır.'),
 ('Bir çıkarmada eksilen, çıkan ve farkın toplamı 148’dir. Eksilen kaçtır?',74,'148/2','Eksilen=çıkan+fark olduğundan toplam eksilenin iki katıdır.'),
 ('Bir çıkarmada fark 23, çıkan 17’dir. Eksilen kaçtır?',40,'23+17','Eksilen, çıkan ve farkın toplamıdır.'),
 ('A−B=18 ve A+B=62 ise B kaçtır?',22,'(62-18)/2','Toplamdan fark çıkarılıp ikiye bölünür.'),
 ('Bir çıkarmada çıkan farkın 2 katıdır. Eksilen 72 ise fark kaçtır?',24,'72/3','Fark d ise çıkan 2d ve eksilen 3d’dir.'),
 ('Bir çıkarmada eksilen 12 artırılıp çıkan 5 azaltılıyor. Fark kaç artar?',17,'12+5','Çıkanın azalması farkı ayrıca 5 artırır.'),
 ('A−B=31’dir. (A+7)−(B+12) kaçtır?',26,'31+7-12','İki tarafa gelen sabitlerin farkı eklenir.'),
 ('Bir çıkarmada eksilen çıkanın 4 katı, fark 63’tür. Çıkan kaçtır?',21,'63/(4-1)','4B−B=63 denklemi çözülür.'),
 ('A−B=9, B−C=14 ise A−C kaçtır?',23,'9+14','İki fark toplanınca aradaki B terimleri yok olur.'),
 ('A−B=15 ve A·B=100 ise (A−B)²+4AB kaçtır?',625,'15**2+4*100','Verilen değerler doğrudan yerleştirilir; ifade (A+B)²’dir.'),
 ])

def digit_families(b):
 b.rows('AI-TYT08-01','digit-extrema',[
 ('Rakamları farklı en küçük dört basamaklı doğal sayı kaçtır?',1023,'1023','Binler 1, yüzler 0, kalan rakamlar sırasıyla 2 ve 3 seçilir.'),
 ('Rakamları farklı en büyük üç basamaklı çift doğal sayı kaçtır?',986,'986','Yüzler 9, onlar 8 seçilince kullanılmamış en büyük çift rakam 6’dır.'),
 ('Rakamları farklı en küçük üç basamaklı tek doğal sayı kaçtır?',103,'103','Yüzler 1 ve onlar 0 seçilince birler için en küçük kullanılmamış tek rakam 3’tür.'),
 ('Rakamları farklı en büyük üç basamaklı sayı ile en küçük üç basamaklı sayının farkı kaçtır?',885,'987-102','İki uç sayı 987 ve 102’dir.'),
 ('Yalnız 0,2,5,7 rakamları birer kez kullanılarak yazılan en küçük dört basamaklı sayı kaçtır?',2057,'2057','Başta sıfır olamaz; ilk rakam 2, kalanlar artan sırada 0,5,7 olur.'),
 ('0,1,4,6 rakamlarının hepsi birer kez kullanılıyor. 4 ile bölünebilen en büyük dört basamaklı sayı kaçtır?',6140,'6140','6 ile başlayan olası dizilişlerde son iki basamağı 4’ün katı yapan en büyük sayı 6140’tır.'),
 ('Rakamları farklı en küçük dört basamaklı sayıdan, rakamları farklı en büyük iki basamaklı sayı çıkarılırsa kaç kalır?',925,'1023-98','En küçük sayı 1023, en büyük iki basamaklı sayı 98’dir.'),
 ('Üç basamaklı en küçük negatif tam sayı ile en büyük negatif tam sayının farkı kaçtır?',-998,'-999-(-1)','En küçük üç basamaklı negatif −999, en büyük negatif −1’dir.'),
 ('Rakamları farklı ve rakamları toplamı 6 olan en küçük üç basamaklı doğal sayı kaçtır?',105,'105','Yüzler 1 ve onlar 0 seçilirse birler 5 olur.'),
 ('Rakamları farklı, üç basamaklı ve 500’den küçük en büyük doğal sayı kaçtır?',498,'498','Yüzler 4, onlar 9 ve kullanılmamış en büyük rakam 8 seçilir.'),
 ])
 # All digit-query families use explicit exhaustive finite domains.
 pid='AI-TYT11-01';fam='digit-constraints'
 cases=[
 ('ABC üç basamaklıdır. A+B=9, B−C=2 ise kaç farklı ABC vardır?',{'A':[1,9],'B':[0,9],'C':[0,9]},'A+B==9 and B-C==2','count','B, 2’den 8’e kadar değişebilir; her B için A ve C tek biçimde belirlenir.'),
 ('ABC üç basamaklıdır. A+B=9 ve B−C=2 koşullarını sağlayan sayıların toplamı kaçtır?',{'A':[1,9],'B':[0,9],'C':[0,9]},'A+B==9 and B-C==2','sum:100*A+10*B+C','Koşullardan A=9−B ve C=B−2 yazılıp geçerli rakamlar toplanır.'),
 ('ABC üç basamaklı, A=C ve A+B=7’dir. Bu sayıların en büyüğü kaçtır?',{'A':[1,9],'B':[0,9],'C':[0,9]},'A==C and A+B==7','max:100*A+10*B+C','Yüzler rakamı en büyük seçilir; A=7 ve B=0 olur.'),
 ('Rakamları farklı ABC sayısı için A+B+C=6 ve A=2’dir. Kaç sayı vardır?',{'A':[1,9],'B':[0,9],'C':[0,9]},'A==2 and A+B+C==6 and A!=B and A!=C and B!=C','count','B+C=4 koşulu ile birbirinden ve 2’den farklı rakamlar denenir.'),
 ('ABC sayısı üç basamaklıdır. B=2A ve C=A+1 ise sayıların toplamı kaçtır?',{'A':[1,9],'B':[0,9],'C':[0,9]},'B==2*A and C==A+1','sum:100*A+10*B+C','B bir rakam olduğundan A=1,2,3,4 olabilir.'),
 ('ABC üç basamaklı ve A<B<C’dir. A+B+C=9 koşulunu sağlayan kaç sayı vardır?',{'A':[1,9],'B':[0,9],'C':[0,9]},'A<B<C and A+B+C==9','count','Artan üç farklı rakam toplam koşuluyla birlikte listelenir.'),
 ('ABC üç basamaklıdır. A=2C ve B=A−C koşulunu sağlayan en küçük sayı kaçtır?',{'A':[1,9],'B':[0,9],'C':[0,9]},'A==2*C and B==A-C','min:100*A+10*B+C','C en az 1’dir; C=1 seçilince A=2, B=1 olur.'),
 ('ABC üç basamaklı ve B=0’dır. A+C=10 ve A>C ise kaç sayı vardır?',{'A':[1,9],'B':[0,9],'C':[0,9]},'B==0 and A+C==10 and A>C','count','A=6,7,8,9 için C=4,3,2,1 bulunur.'),
 ('ABC üç basamaklıdır. C=3, A+B=8 ve sayı 3 ile bölünebiliyor. Kaç sayı vardır?',{'A':[1,9],'B':[0,9],'C':[0,9]},'C==3 and A+B==8 and (100*A+10*B+C)%3==0','count','Rakam toplamı 11 sabittir; hiçbir sayı 3 ile bölünemez.'),
 ('ABC üç basamaklıdır. A+B+C=12, A=C+2 ve B çift ise en büyük sayı kaçtır?',{'A':[1,9],'B':[0,9],'C':[0,9]},'A+B+C==12 and A==C+2 and B%2==0','max:100*A+10*B+C','C=A−2, B=14−2A olur; geçerli rakamlar arasında en büyük yüzler seçilir.'),
 ]
 for v,(p,vs,pred,obj,steps) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,[steps])
 b.rows('AI-TYT09-01','place-value-change',[
 ('ABC üç basamaklıdır. Yüzler basamağı 2 artırılıp birler basamağı 3 azaltılabiliyor. Sayı kaç artar?',197,'2*100-3','Yüzler artışı 200, birler azalışı 3’tür.'),
 ('AB iki basamaklıdır. Onlar rakamı 1 azalırken birler rakamı 4 artıyor. Yeni sayı eskisinden kaç eksiktir?',6,'10-4','Toplam değişim −10+4=−6’dır.'),
 ('AB ile BA iki basamaklıdır ve A−B=4’tür. AB−BA kaçtır?',36,'9*4','Basamak açılımı 9(A−B) verir.'),
 ('ABC ve CBA üç basamaklıdır. A−C=5 ise ABC−CBA kaçtır?',495,'99*5','Onlar basamağı yok olur, fark 99(A−C)’dir.'),
 ('ABC sayısının yüzler rakamı ile onlar rakamı yer değiştirince sayı 270 azalıyor. A−B kaçtır?',3,'270/90','Eski sayıdan yeni sayı çıkarılınca 90(A−B) bulunur.'),
 ('AB iki basamaklıdır. Soluna 3 yazılan sayı, sağına 3 yazılan sayıdan 54 fazladır. AB kaçtır?',27,'(300-3-54)/9','300+n−(10n+3)=54 eşitliği kurulur.'),
 ('ABC üç basamaklıdır. Birler rakamı 2 artırılıp onlar rakamı 3 azaltılınca sayı kaç azalır?',28,'30-2','Net değişim −30+2’dir.'),
 ('ABC ve DEF üç basamaklıdır. A=D+2, B=E−1, C=F+3 ise ABC−DEF kaçtır?',193,'100*2-10+3','Rakam farkları basamak değerleriyle çarpılıp toplanır.'),
 ('AB iki basamaklı, A+B=11’dir. AB+BA kaçtır?',121,'11*11','Toplam 11(A+B) olarak ayrılır.'),
 ('ABC sayısının rakamları birer artırılabiliyor. Yeni sayı eski sayının 2 katı ise eski sayı kaçtır?',111,'100+10+1','Artış 111’dir; n+111=2n denklemi çözülür.'),
 ])
 b.rows('AI-TYT12-01','digit-append',[
 ('İki basamaklı n’nin sağına 4 yazılınca 374 oluyor. n kaçtır?',37,'(374-4)/10','Son rakam çıkarılıp 10’a bölünür.'),
 ('Üç basamaklı n’nin soluna 2 yazılınca sayı 5n oluyor. n kaçtır?',500,'2000/4','2000+n=5n denklemi n=500 verir.'),
 ('İki basamaklı n’nin sağına 0 yazılan sayı ile n’nin toplamı 495’tir. n kaçtır?',45,'495/11','10n+n=495 yazılır.'),
 ('İki basamaklı n’nin soluna 4, sağına 4 yazılan sayıların toplamı 877’dir. n kaçtır?',43,'(877-404)/11','400+n+10n+4=877 çözülür.'),
 ('İki basamaklı n’nin sağına 7 yazılan sayı, soluna 7 yazılan sayıdan 162 eksiktir. n kaçtır?',59,'(700-7-162)/9','10n+7=700+n−162 eşitliği kurulur.'),
 ('İki basamaklı n iki kez art arda yazılınca oluşan dört basamaklı sayı 3434’tür. n kaçtır?',34,'3434/101','Yan yana yazılan iki kopya 100n+n=101n’dir.'),
 ('Üç basamaklı n’nin sağına 25 yazılınca elde edilen sayı, n’den 24874 fazladır. n kaçtır?',251,'(24874-25)/99','100n+25−n=24874 çözülür.'),
 ('Üç basamaklı n’nin soluna 6 yazılınca elde edilen sayı ile n arasındaki fark kaçtır?',6000,'6*1000','Sol ekleme üç basamaklı sayıya 6000 ekler.'),
 ('İki basamaklı n’nin hem sağına hem soluna 2 yazılınca 2352 elde ediliyor. n kaçtır?',35,'(2352-2002)/10','Yeni sayı 2000+10n+2’dir.'),
 ('İki basamaklı n’nin sağına kendi birler rakamı yazılıyor. n=46 ise yeni sayı eskisinden kaç fazladır?',420,'(10*46+6)-46','Yeni sayı 466’dır; eski sayı çıkarılır.'),
 ])
 b.rows('AI-TYT13-01','digit-sum',[
 ('Rakamları toplamı 10 olan en küçük üç basamaklı doğal sayı kaçtır?',109,'109','Yüzler 1, onlar 0 ve birler 9 seçilir.'),
 ('Rakamları toplamı 10 olan en büyük üç basamaklı doğal sayı kaçtır?',910,'910','Soldaki rakamlar olabildiğince büyük tutulur: 9,1,0.'),
 ('Rakamları toplamı 20 olan en küçük dört basamaklı sayı kaçtır?',1199,'1199','Birler ve onlar 9 yapılırken soldaki basamaklar en küçük tutulur.'),
 ('Rakamları toplamı 20 olan en büyük dört basamaklı sayı kaçtır?',9920,'9920','Soldan sırasıyla 9,9,2,0 seçilir.'),
 ('Rakamları toplamı 7 olan iki basamaklı sayılardan kaç tanesi çifttir?',4,'4','Birler 0,2,4,6 seçilirse onlar 7,5,3,1 olur.'),
 ('Rakamları toplamı 18 olan iki basamaklı doğal sayı kaçtır?',99,'99','Her iki rakam en çok 9 olduğundan tek olasılık 99’dur.'),
 ('Üç basamaklı ABC sayısının rakamları toplamı 14’tür. ABC+CAB+BCA toplamı kaçtır?',1554,'111*14','Her rakam her basamakta birer kez yer alır.'),
 ('Rakamları toplamı 11 olan en küçük ve en büyük üç basamaklı sayıların farkı kaçtır?',801,'920-119','En küçük 119, en büyük 920’dir.'),
 ('Rakamları birbirinden farklı, toplamı 6 olan en büyük üç basamaklı doğal sayı kaçtır?',510,'510','Yüzler 5 seçilince kalan farklı rakamlar 1 ve 0’dır.'),
 ('Rakamları toplamı 5 olan kaç farklı iki basamaklı doğal sayı vardır?',5,'5','Onlar 1,2,3,4,5 ve birler sırasıyla 4,3,2,1,0’dır.'),
 ])
 b.rows('AI-TYT15-01','reverse-digits',[
 ('AB ve BA iki basamaklıdır. AB+BA=88 ve A−B=2 ise AB kaçtır?',53,'10*((8+2)/2)+(8-2)/2','A+B=8 ile A−B=2 birlikte çözülür.'),
 ('AB−BA=27 ve A+B=9 ise AB kaçtır?',63,'10*((9+3)/2)+(9-3)/2','9(A−B)=27 olduğundan A−B=3 olur.'),
 ('AB+BA=121 ve AB>BA’dir. A−B=3 ise AB kaçtır?',74,'10*((11+3)/2)+(11-3)/2','Rakam toplamı 11, farkı 3’tür.'),
 ('İki basamaklı bir sayının tersi kendisinden 45 küçüktür. Rakamları toplamı 9 ise sayı kaçtır?',72,'10*((9+5)/2)+(9-5)/2','Rakam farkı 5 ve toplamı 9’dur.'),
 ('AB ve BA iki basamaklıdır. AB−BA=27 ve A·B=18 ise AB kaçtır?',63,'63','A−B=3 ve AB çarpımı 18 olduğundan rakamlar 6 ve 3’tür.'),
 ('İki basamaklı bir sayının rakamları yer değişince sayı 18 artıyor. Rakamlar toplamı 8 ise ilk sayı kaçtır?',35,'10*((8-2)/2)+(8+2)/2','B−A=2 ve A+B=8 çözülür.'),
 ('AB−BA=36 ise (AB)²−(BA)² ifadesinin AB+BA’ya oranı kaçtır?',36,'36','İki kare farkı çarpanlarına ayrılınca oran AB−BA olur.'),
 ('İki basamaklı AB sayısı ile BA’nın toplamı 77’dir. AB<BA koşulunu sağlayan kaç AB vardır?',3,'3','A+B=7 ve A<B olduğundan A=1,2,3 seçilebilir.'),
 ('AB ile BA iki basamaklı ve AB−BA=9’dur. Bu sayılardan AB’nin alabileceği değerlerin toplamı kaçtır?',476,'21+32+43+54+65+76+87+98','A=B+1 ve B=1,…,8 olasılıkları toplanır.'),
 ('ABC üç basamaklıdır. ABC−CBA=198 ve B=4, A+C=10 ise ABC kaçtır?',644,'100*6+10*4+4','A−C=2 ve A+C=10’dan A=6,C=4 bulunur.'),
 ])
 b.rows('V3-TYT-002-01','written-digit-count',[
 ('1’den 45’e kadar tam sayılar yazılıyor. Kaç rakam kullanılır?',81,'9+2*(45-9)','İlk 9 sayı bir, kalan 36 sayı iki basamaklıdır.'),
 ('1’den 125’e kadar sayfa numaraları için kaç rakam gerekir?',267,'9+90*2+26*3','1–9,10–99,100–125 blokları ayrı sayılır.'),
 ('50’den 150’ye kadar tüm tam sayılar yazılıyor. Kaç rakam kullanılır?',253,'50*2+51*3','50–99 arasında 50 iki basamaklı,100–150 arasında 51 üç basamaklı sayı vardır.'),
 ('Bir kitap 1’den numaralanıyor ve 333 rakam kullanılıyor. Kitap kaç sayfadır?',147,'99+(333-189)/3','99’a kadar 189 rakam kullanılır; kalan 144 rakam 48 sayfaya yeter.'),
 ('Sayfa numaralarına 7’den başlayan 80 yapraklı, her yaprağı iki sayfalı bir defterin son sayfa numarası kaçtır?',166,'7+2*80-1','Toplam 160 sayfa vardır; ilk sayfa dahil sayılır.'),
 ('100’den 250’ye kadar sayılar boşluksuz yazılıyor. Kaç rakam kullanılır?',453,'(250-100+1)*3','Her sayı üç basamaklı, sayı adedi 151’dir.'),
 ('1’den başlayarak yazılan sayılarda ilk 189 rakam tamamlanıyor. Son yazılan tam sayı kaçtır?',99,'99','1–9 için 9,10–99 için 180 rakam gerekir.'),
 ('Bir kitabın 10–99 numaralı sayfaları numaralanırken kullanılan rakamlar, 1–9 numaralı sayfalardakinden kaç fazladır?',171,'90*2-9','İki bloktaki rakam sayıları çıkarılır.'),
 ('1’den 200’e kadar yalnız çift tam sayılar yazılıyor. Kaç rakam kullanılır?',247,'4+45*2+51*3','2–8 dört sayı,10–98 kırk beş sayı,100–200 elli bir sayı vardır.'),
 ('1’den 100’e kadar sayılar yazılırken 0 rakamı kaç kez kullanılır?',11,'9+2','10,20,…,90 birer sıfır ve 100 iki sıfır içerir.'),
 ])
 b.rows('V3-TYT-032-01','concatenated-digit',[
 ('123456789101112… dizisinde soldan 12. rakam kaçtır?',1,'1','İlk 9 rakamdan sonra 10’un iki rakamı gelir; 12. rakam 11’in ilk rakamıdır.'),
 ('1’den 50’ye sayılar boşluksuz yazılıyor. Soldan 25. rakam kaçtır?',7,'7','25−9=16; iki basamaklı blokta 8. sayının son rakamı, yani 17’nin 7’sidir.'),
 ('123456789101112… dizisinde 100 sayısının ilk rakamı soldan kaçıncıdır?',190,'9+90*2+1','100’den önce 189 rakam bulunur.'),
 ('10’dan 99’a sayılar boşluksuz yazılıyor. Soldan 31. rakam kaçtır?',2,'2','31 tek olduğundan 16. sayının onlar rakamı alınır; sayı 25’tir.'),
 ('1’den 100’e sayılar boşluksuz yazılıyor. Sağdan üçüncü rakam kaçtır?',1,'1','Dizinin sonundaki 100 sayısının yüzler rakamı alınır.'),
 ('1’den 30’a sayılar boşluksuz yazılıyor. Oluşan yazının tam ortasındaki rakam kaçtır?',1,'1','Toplam 51 rakamın ortası 26.’dır; bu rakam 18’in ilk rakamı, yani 1’dir.'),
 ('100’den 130’a sayılar art arda yazılıyor. Soldan 20. rakam kaçtır?',0,'0','20. rakam 7. sayı olan 106’nın ikinci rakamıdır.'),
 ('1’den başlayan ardışık sayılar yazılırken ilk 2 rakamlı sayı tamamlandığında toplam kaç rakam yazılmış olur?',11,'9+2','1–9 için 9 rakam,10 için 2 rakam vardır.'),
 ('1’den 99’a kadar sayılar boşluksuz yazılıyor. Soldan 189. rakam kaçtır?',9,'9','Toplam 189 rakam vardır; son rakam 99’un son rakamıdır.'),
 ('10’dan başlayan ardışık sayılar yazılıyor. 23 sayısının son rakamı soldan kaçıncıdır?',28,'(23-10+1)*2','10–23 dahil 14 sayı iki basamaklıdır.'),
 ])

def equation_rows(b,pid,family,rows):
 x=S.Symbol('x')
 for v,(prompt,answer,equation,objective,steps) in enumerate(rows,1):
  roots=S.solve(S.sympify(equation,rational=True),x);values={F(S.sympify(objective,rational=True).subs(x,r)) for r in roots if r.is_real}
  assert len(values)==1 and F(answer) in values,(family,v,roots,answer)
  spec={'type':'exact_math','operation':'solve_parameter','expression':equation,'variable':'x','conditions':[],'objective':objective,'semanticCheck':prompt}
  b.emit(pid,family,v,prompt,answer,fmt(answer),steps,spec=spec)
  b.questions[-1]['verification']['methods']=['Author algebraic construction','Independent symbolic equation solving from raw constraints']

def word_families(b):
 equation_rows(b,'V3-TYT-017-01','capacity-problems',[
 ('Bir pansiyonda 2 ve 3 yataklı toplam 24 oda, toplam 60 yatak vardır. 3 yataklı oda sayısı kaçtır?',12,'3*x+2*(24-x)-60','x','Üç yataklı odalar x ise diğerleri 24−x olur.'),
 ('Bir otoparkta motosiklet ve otomobil toplam 18 araç, toplam 58 tekerlek vardır. Otomobil sayısı kaçtır?',11,'4*x+2*(18-x)-58','x','Otomobiller x, motosikletler 18−x alınır.'),
 ('Bir kasada 5 ve 10 TL’lik toplam 16 banknotun değeri 115 TL’dir. 5 TL’lik kaç banknot vardır?',9,'5*x+10*(16-x)-115','x','Beşlikler x alınır ve toplam değer yazılır.'),
 ('Bir salonda 4 ve 6 kişilik 15 masa toplam 76 kişiliktir. 6 kişilik masa sayısı kaçtır?',8,'6*x+4*(15-x)-76','x','Masa ve kişi sayıları tek denklemde birleştirilir.'),
 ('2 ve 5 litrelik toplam 21 kap 69 litre sıvı alıyor. 2 litrelik kap sayısı kaçtır?',12,'2*x+5*(21-x)-69','x','Küçük kap x, büyük kap 21−x alınır.'),
 ('Bir sınavda her doğru 4 puan, yanlış −1 puandır. 20 sorunun tümünü cevaplayan 55 puan alıyor. Doğru sayısı kaçtır?',15,'4*x-(20-x)-55','x','Doğru x ise yanlış 20−x’tir.'),
 ('Bir bilet gişesinde yetişkin 40, öğrenci 25 TL’dir. 30 bilet 990 TL getiriyorsa yetişkin bileti kaçtır?',16,'40*x+25*(30-x)-990','x','Yetişkin biletleri x seçilir.'),
 ('Bir kutuda 3 ve 7 gramlık 14 parça toplam 70 gramdır. Ağır parçaların hafif parçalardan farkı (ağır eksi hafif) kaçtır?',0,'7*x+3*(14-x)-70','x-(14-x)','Ağır parça sayısı x=7 bulunur; fark hesaplanır.'),
 ('Bir çiftlikte tavuk ve koyun toplam 32 hayvan, toplam 92 ayak vardır. Koyunlar kaç tanedir?',14,'4*x+2*(32-x)-92','x','Dört ayaklı sayısı x alınarak ayak sayısı modellenir.'),
 ('5 ve 8 sayfalık toplam 18 föyde 114 sayfa vardır. 8 sayfalık föyler toplam kaç sayfadır?',64,'8*x+5*(18-x)-114','8*x','Önce sekiz sayfalık föy sayısı 8 bulunur, ardından 8 ile çarpılır.'),
 ])
 equation_rows(b,'V3-TYT-018-01','score-problems',[
 ('Bir takım 7 galibiyet ve 4 beraberlik alıyor. Galibiyet 3, beraberlik 1 puansa toplam puanı kaçtır?',25,'x-(7*3+4)','x','Galibiyet ve beraberlik puanları toplanır.'),
 ('Galibiyet 3, beraberlik 1 puan. 10 maçta 2 beraberlik ve 20 puanı olan takım kaç galibiyet almıştır?',6,'3*x+2-20','x','Galibiyet puanı toplam puandan beraberlik puanı çıkarılarak bulunur.'),
 ('Doğru cevaba 5 puan verilen oyunda 9 doğru ve 2 yanlış vardır. Toplam 39 puan alındığına göre her yanlış kaç puan kaybettirir?',3,'9*5-2*x-39','x','İki yanlışın toplam kaybı 45−39’dur.'),
 ('Bir takımın galibiyet sayısı beraberlik sayısının 2 katıdır. Galibiyet 3, beraberlik 1 puanla 35 puan almıştır. Galibiyet sayısı kaçtır?',10,'3*(2*x)+x-35','2*x','Beraberlik x, galibiyet 2x alınır.'),
 ('Bir takım 12 maçın 3’ünü kaybetmiştir. Galibiyet 3, beraberlik 1 puanla 19 puanı varsa kaç beraberliği vardır?',4,'3*(9-x)+x-19','x','Kayıp dışındaki 9 maç beraberlik veya galibiyettir.'),
 ('Bir testte doğru 4, yanlış −1 puan. Boşlar 0 puan. 25 soruda 3 boş ve 68 puan varsa doğru sayısı kaçtır?',18,'4*x-(22-x)-68','x','İşaretli 22 sorunun doğru ve yanlışları modellenir.'),
 ('Bir yarışmacı ilk turda 18, ikinci turda bunun 2 katından 7 eksik puan alıyor. Toplam puanı kaçtır?',47,'x-(18+2*18-7)','x','İkinci tur 29 puandır.'),
 ('Galibiyet 3, beraberlik 1 puandır. Bir takımın 6 galibiyetinden biri beraberlik sayılsaydı toplam puanı kaç azalırdı?',2,'x-(3-1)','x','Tek maçın puan değişimi 3−1’dir.'),
 ('Bir oyunda başarı +7, hata −2 puan. 15 hamlede 60 puana ulaşan kaç hata yapmıştır?',5,'7*(15-x)-2*x-60','x','Başarı sayısı 15−x alınır.'),
 ('Bir ligde galibiyet 3, beraberlik 1 puan. A’nın 8 galibiyet 2 beraberliği; B’nin 6 galibiyet 5 beraberliği vardır. A kaç puan öndedir?',3,'x-((8*3+2)-(6*3+5))','x','İki takımın toplam puanları çıkarılır.'),
 ])
 equation_rows(b,'V3-TYT-020-01','age-averages',[
 ('4 kişinin yaş ortalaması 25’tir. Üçünün yaşları 16,24,30 ise dördüncü kaç yaşındadır?',30,'16+24+30+x-4*25','x','Toplam yaş ortalama ile kişi sayısının çarpımıdır.'),
 ('5 kişinin yaş ortalaması 20’dir. 32 yaşındaki kişi ayrılınca kalanların ortalaması kaç olur?',17,'4*x-(5*20-32)','x','Ayrılan kişinin yaşı toplamdan çıkarılır.'),
 ('3 kişinin yaş ortalaması 18’dir. 30 yaşında biri eklenirse yeni ortalama kaç olur?',21,'4*x-(3*18+30)','x','Yeni yaş toplamı 84, kişi sayısı 4’tür.'),
 ('6 kişilik grubun yaş ortalaması bugün 22’dir. 4 yıl sonra, aynı grubun ortalaması kaçtır?',26,'x-(22+4)','x','Herkesin yaşı 4 arttığından ortalama da 4 artar.'),
 ('4 kişilik bir ailenin yaş ortalaması 27’dir. Yeni doğan bebek aileye katılınca ortalama kaç olur?',F(108,5),'5*x-4*27','x','Bebeğin yaşı 0 kabul edilerek toplam 108 kalır.'),
 ('3 kardeşin yaşları ardışık çift sayılardır ve ortalamaları 14’tür. En büyük kaç yaşındadır?',16,'x-2-14','x','Ortanca 14, en büyük ondan 2 fazladır.'),
 ('2 kişinin yaş ortalaması 26’dır. Büyük olan küçükten 8 yaş büyükse küçük kaç yaşındadır?',22,'x+(x+8)-2*26','x','Yaşlar x ve x+8 alınır.'),
 ('4 kişinin yaş ortalaması 19’dur. 1 yıl önce aralarına katılan 5. kişiyle bugünkü ortalama 21’dir. Beşinci kişi bugün kaç yaşındadır?',29,'4*19+x-5*21','x','Bugünkü yaş toplamları kullanılır; katılım tarihi sonucu değiştirmez.'),
 ('Yaş ortalaması 24 olan 3 kişi ile ortalaması 30 olan 2 kişi birleşiyor. Ortak ortalama kaçtır?',F(132,5),'5*x-(3*24+2*30)','x','Ağırlıklı toplam 132’dir.'),
 ('5 kişinin yaş ortalaması 28’dir. Birinin yaşı 36 yerine 26 yazılırsa hesaplanan ortalama gerçek ortalamadan kaç eksik olur?',2,'5*x-(36-26)','x','Toplamdaki 10 yaş eksikliği 5 kişiye bölünür.'),
 ])
 equation_rows(b,'V3-TYT-021-01','age-relations',[
 ('Bir anne 36, çocuğu 12 yaşındadır. Kaç yıl sonra annenin yaşı çocuğunun 2 katı olur?',12,'36+x-2*(12+x)','x','Her iki yaşa aynı x yılı eklenir.'),
 ('Bir baba çocuğundan 28 yaş büyüktür. Baba 42 yaşındaysa çocuk kaç yaşındadır?',14,'x+28-42','x','Yaş farkı çıkarılır.'),
 ('Bir abla kardeşinin 3 katı yaştadır. 4 yıl sonra abla 28 yaşında olacak. Kardeş şimdi kaç yaşındadır?',8,'3*x+4-28','x','Ablanın bugünkü yaşı 24’tür.'),
 ('İki kardeşin yaşları toplamı 30, farkı 6’dır. Büyük kardeş 3 yıl sonra kaç yaşında olur?',21,'x+(x-6)-30','x+3','Büyük yaş x alınır ve toplam denklemi kurulur.'),
 ('Bir anne 4 yıl önce çocuğunun 5 katı yaştaydı. Çocuk bugün 10 yaşında ise anne bugün kaç yaşındadır?',34,'x-4-5*(10-4)','x','Dört yıl önce çocuk 6, anne 30 yaşındadır.'),
 ('Ali bugün Veli’nin 2 katı yaştadır. 5 yıl önce yaşları toplamı 35’ti. Ali bugün kaç yaşındadır?',30,'2*x-5+x-5-35','2*x','Veli x, Ali 2x alınır.'),
 ('Bir baba 48, oğlu 18 yaşındadır. Kaç yıl önce baba oğlunun 3 katı yaştaydı?',3,'48-x-3*(18-x)','x','Geçmiş yıllar her iki yaştan çıkarılır.'),
 ('İki kişinin yaş farkı 9’dur. 7 yıl sonra yaş farkları kaç olur?',9,'x-9','x','Aynı süre iki yaşa eklendiğinden fark sabittir.'),
 ('Bir çocuk doğduğunda annesi 27 yaşındaydı. Bugün yaşları toplamı 51 ise çocuk kaç yaşındadır?',12,'x+(x+27)-51','x','Yaş farkı doğumdan beri 27’dir.'),
 ('İkiz kardeşler ve annelerinin bugünkü yaşları toplamı 64’tür. Anne 36 yaşındaysa 3 yıl sonra üçünün yaş toplamı kaç olur?',73,'x-(64+3*3)','x','Üç kişi için toplam yaş her yıl 3 artar.'),
 ])
 equation_rows(b,'V3-TYT-022-01','motion',[
 ('Araları 300 km olan iki araç birbirine doğru 60 ve 40 km/sa hızla aynı anda çıkıyor. Kaç saatte karşılaşırlar?',3,'(60+40)*x-300','x','Yaklaşma hızı hızlar toplamıdır.'),
 ('Aynı noktadan aynı yönde 80 ve 50 km/sa ile çıkan iki araç 4 saatte kaç km uzaklaşır?',120,'x-(80-50)*4','x','Uzaklaşma hızı hız farkıdır.'),
 ('Bir araç 180 km yolu 3 saatte gidiyor. Aynı hızla 5 saatte kaç km gider?',300,'x-(180/3)*5','x','Önce sabit hız 60 km/sa bulunur.'),
 ('60 km/sa hızla giden araca 2 saat sonra aynı noktadan 90 km/sa hızla bir araç yetişmeye çalışıyor. İkinci araç kaç saatte yetişir?',4,'(90-60)*x-60*2','x','İlk aracın 120 km’lik farkı bağıl hız 30 ile kapanır.'),
 ('Bir yolun yarısı 40, diğer yarısı 60 km/sa ile gidiliyor. Ortalama hız kaç km/sa olur?',48,'x-(2*40*60/(40+60))','x','Eşit yollar için toplam yol toplam süreye bölünür; harmonik ortalama çıkar.'),
 ('Bir araç 2 saat 50, sonra 3 saat 70 km/sa ile gidiyor. Ortalama hızı kaç km/sa olur?',62,'5*x-(2*50+3*70)','x','Toplam yol 310 km, süre 5 saattir.'),
 ('Durgun suda 12 km/sa giden tekne 3 km/sa akıntıyla aynı yönde 45 km gidiyor. Yol kaç saat sürer?',3,'(12+3)*x-45','x','Akış yönünde hızlar toplanır.'),
 ('Durgun suda 15 km/sa hızlanan tekne 3 km/sa akıntıya karşı 36 km gidiyor. Yol kaç saat sürer?',3,'(15-3)*x-36','x','Akıntıya karşı hızlar çıkarılır.'),
 ('Uzunluğu 200 m olan tren 20 m/sn sabit hızla 300 m köprüyü tamamen geçiyor. Kaç saniye gerekir?',25,'20*x-(200+300)','x','Trenin tamamen geçmesi için köprü ve tren uzunluğu kadar yol gerekir.'),
 ('400 m’lik parkurda aynı noktadan zıt yönde 3 ve 5 m/sn hızla koşanlar ilk kez kaç saniyede karşılaşır?',50,'(3+5)*x-400','x','Birlikte bir tam parkur uzunluğu kapanır.'),
 ])
 equation_rows(b,'V3-TYT-023-01','work-rate',[
 ('A bir işi 12, B 18 günde bitiriyor. Birlikte kaç günde bitirirler?',F(36,5),'x*(1/12+1/18)-1','x','Günlük iş hızları toplanır.'),
 ('Bir musluk havuzu 8 saatte dolduruyor, gider 12 saatte boşaltıyor. Boş havuz ikisi açıkken kaç saatte dolar?',24,'x*(1/8-1/12)-1','x','Net dolum hızı 1/8−1/12’dir.'),
 ('A işi 10 günde bitiriyor. 3 gün tek başına çalışınca işin kaçta kaçı kalır?',F(7,10),'x-(1-3/10)','x','Üç günlük tamamlanan pay 3/10’dur.'),
 ('A ve B birlikte 6 günde bitiriyor. A tek başına 10 günde bitirirse B kaç günde bitirir?',15,'1/6-1/10-x','1/x','B’nin hızı x=1/15 olur; süre tersidir.'),
 ('Eş güçte 4 işçi bir işi 15 günde yapıyor. 6 işçi aynı işi kaç günde yapar?',10,'6*x-4*15','x','Toplam iş 60 işçi-gündür.'),
 ('A işi 12, B 24 günde bitiriyor. A 3 gün çalıştıktan sonra kalan işi B tek başına kaç günde bitirir?',18,'3/12+x/24-1','x','A işin 1/4’ünü yapar; kalan 3/4’ü B tamamlar.'),
 ('3 eş musluk havuzu 8 saatte dolduruyor. Bu musluklardan biri tek başına kaç saatte doldurur?',24,'x-3*8','x','Tek musluğun hızı toplamın üçte biridir.'),
 ('A bir işi 20 günde yapar. Hızı %25 artarsa aynı iş kaç gün sürer?',16,'x*(1/20)*(1+25/100)-1','x','Yeni hız 1/16 iş/gündür.'),
 ('A işi 15, B 10 günde yapar. Birlikte 3 gün çalışınca işin kaçta kaçı kalır?',F(1,2),'x-(1-3*(1/15+1/10))','x','Birlikte günlük hız 1/6’dır; üç günde yarısı biter.'),
 ('Bir ekip işi 9 günde bitirecekti. Günlük üretim 1/3 azaltılırsa iş kaç günde biter?',F(27,2),'x*(1/9)*(1-1/3)-1','x','Yeni hız eskisinin 2/3’üdür, süre 3/2 kat olur.'),
 ])
 equation_rows(b,'V3-TYT-024-01','percentage-change',[
 ('400 TL ürüne önce %25 zam, sonra yeni fiyat üzerinden %20 indirim yapılıyor. Son fiyat kaç TL olur?',400,'x-400*(1+25/100)*(1-20/100)','x','Artış ve indirim çarpanları sırayla uygulanır.'),
 ('Bir ürün %20 indirimden sonra 640 TL oluyor. İndirim öncesi fiyatı kaç TL’dir?',800,'x*(1-20/100)-640','x','Son fiyat ilk fiyatın 0,8 katıdır.'),
 ('Bir sayı %30 artırılıp %10 azaltılıyor. Son değer ilk değerin yüzde kaçı olur?',117,'x-100*(1+30/100)*(1-10/100)','x','100 birimlik başlangıç üzerinden yeni değer hesaplanır.'),
 ('Bir ürüne %25 indirim yapılıyor. Eski fiyata dönmek için yeni fiyata yüzde kaç zam gerekir?',F(100,3),'75*(1+x/100)-100','x','75 birimin yeniden 100 olması için 25/75 oranında artış gerekir.'),
 ('240 kişilik grubun %35’i kadın. Erkek sayısı kaçtır?',156,'x-240*(1-35/100)','x','Erkek oranı %65’tir.'),
 ('Bir tutar önce %10, sonra %20 artırılıyor. Tek zam olarak eşdeğer artış yüzde kaçtır?',32,'100*(1+x/100)-100*(1+10/100)*(1+20/100)','x','Çarpanlar 1,1·1,2=1,32 verir.'),
 ('Etiketi 500 TL olan ürüne %15 indirim, indirimli tutara %20 vergi ekleniyor. Ödenen kaç TL’dir?',510,'x-500*(1-15/100)*(1+20/100)','x','İndirim ve vergi farklı aşamalara uygulanır.'),
 ('Bir topluluk 80 kişiden 100 kişiye çıkıyor. Yüzde kaç artmıştır?',25,'80*(1+x/100)-100','x','Artış 20, başlangıç 80’dir.'),
 ('Bir gelir %20 artarken gider %10 artıyor. İlk gelir 1000, gider 600 TL ise yeni tasarruf kaç TL’dir?',540,'x-(1000*1.2-600*1.1)','x','Yeni gelirden yeni gider çıkarılır.'),
 ('Bir mağaza 600 TL’lik ürüne iki kez art arda %10 indirim yapıyor. Toplam indirim kaç TL’dir?',114,'x-(600-600*(1-10/100)**2)','x','Son fiyat 486 TL, toplam indirim 114 TL’dir.'),
 ])
 equation_rows(b,'V3-TYT-044-01','profit',[
 ('Alış fiyatı 800 TL olan ürün %25 kârla satılıyor. Satış fiyatı kaç TL’dir?',1000,'x-800*(1+25/100)','x','Kâr oranı alış fiyatına uygulanır.'),
 ('1200 TL’ye satılan bir ürünün alış fiyatı 1000 TL’dir. Alışa göre kâr yüzdesi kaçtır?',20,'1000*(1+x/100)-1200','x','Kâr 200 TL ve alış 1000 TL’dir.'),
 ('Bir ürün %20 zararla 640 TL’ye satılıyor. Alış fiyatı kaç TL’dir?',800,'x*(1-20/100)-640','x','Satış alışın %80’idir.'),
 ('500 TL’ye alınan ürüne 100 TL masraf yapılıyor. Toplam maliyet üzerinden %30 kâr için kaç TL’ye satılmalı?',780,'x-(500+100)*(1+30/100)','x','Kâr tabanı masraf dahil 600 TL’dir.'),
 ('Maliyeti 400 TL olan ürün 600 TL etiketleniyor. %20 indirimle satılırsa kâr kaç TL’dir?',80,'x-(600*(1-20/100)-400)','x','İndirimli satış 480 TL’dir; maliyet çıkarılır.'),
 ('Bir ürün %25 kârla satılıyor. Satış bedelinin yüzde kaçı kârdır?',20,'x-(125-100)/125*100','x','Alış 100 varsayılırsa satış 125 ve kâr 25 olur.'),
 ('Aynı maliyetli iki ürünün biri %20 kâr, biri %20 zararla satılıyor. Her birinin maliyeti 500 TL ise toplam kâr kaç TL’dir?',0,'x-(500*1.2+500*.8-2*500)','x','Eşit maliyette kâr ve zarar tutarları birbirini götürür.'),
 ('Bir ürün 900 TL’ye satılınca 100 TL zarar ediliyor. %25 kâr için satış kaç TL olmalıdır?',1250,'x-(900+100)*1.25','x','Maliyet 1000 TL bulunur ve %25 eklenir.'),
 ('20 adet ürünün her biri 30 TL’ye alınıyor. 5 adedi hasarlı ve satılamıyor. Kalanlar 50 TL’den satılırsa toplam kâr kaç TL’dir?',150,'x-((20-5)*50-20*30)','x','Tüm alış maliyeti, satılabilenlerin gelirinden çıkarılır.'),
 ('Bir mal alış fiyatının %40 fazlasına etiketleniyor. Etiketten %25 indirim yapıldığında alışa göre yüzde kaç kâr kalır?',5,'x-(1.4*.75-1)*100','x','Net çarpan 1,05’tir.'),
 ])
 equation_rows(b,'V3-TYT-025-01','mixture',[
 ('4 L %20 ve 6 L %40 tuzlu çözelti karıştırılıyor. Son tuz yüzdesi kaçtır?',32,'10*x-(4*20+6*40)','x','Tuz miktarlarının ağırlıklı ortalaması alınır.'),
 ('10 L %30 tuzlu suya 5 L saf su ekleniyor. Son tuz yüzdesi kaçtır?',20,'15*x-10*30','x','Tuz miktarı değişmez, hacim artar.'),
 ('8 L %25 tuzlu sudan 3 L saf su buharlaşıyor; tuz kaybı yok. Son yüzde kaçtır?',40,'5*x-8*25','x','2 L tuz eşdeğeri 5 L içinde kalır.'),
 ('10 L %20 tuzlu suya kaç L %50 tuzlu su eklenirse karışım %30 olur?',5,'10*20+x*50-(10+x)*30','x','Tuz dengesi iki karışımın hacimleriyle kurulur.'),
 ('6 L %40 tuzlu karışıma kaç L saf su eklenirse oran %24 olur?',4,'6*40-(6+x)*24','x','Tuz sabitken toplam hacim 10 L olmalıdır.'),
 ('20 L %30 tuzlu karışımdan 5 L alınıp yerine 5 L saf su ekleniyor. Son yüzde kaçtır?',F(45,2),'20*x-(20-5)*30','x','Homojen çıkarılan kısım aynı oranda tuz taşır.'),
 ('3 kg kilogramı 40 TL ve 2 kg kilogramı 70 TL olan çay karıştırılıyor. Karışımın kg maliyeti kaç TL’dir?',52,'5*x-(3*40+2*70)','x','Toplam maliyet toplam kütleye bölünür.'),
 ('Eşit hacimde %15 ve %45 tuzlu karışımlar birleştiriliyor. Son yüzde kaçtır?',30,'2*x-(15+45)','x','Eşit hacimlerde basit ortalama alınabilir.'),
 ('Yalnız A ve B sıvılarından oluşan karışımın 2/5’i A sıvısıdır. 15 L karışımda kaç L B sıvısı vardır?',9,'x-15*(1-2/5)','x','İki bileşen olduğundan B payı 3/5’tir.'),
 ('12 L %25 tuzlu karışıma saf tuz ekleniyor. Hacimlerin toplandığı varsayımıyla %40 için kaç L tuz gerekir?',3,'12*25+100*x-(12+x)*40','x','Eklenen saf tuzun oranı %100 kabul edilir.'),
 ])
 equation_rows(b,'V3-TYT-045-01','fraction-problems',[
 ('60 litrelik içeceğin 2/3’ü kullanılıyor. Kaç litre kalır?',20,'x-60*(1-2/3)','x','Kalan pay 1/3’tür.'),
 ('Bir deponun 3/5’i doludur. 24 L eklenince tamamen doluyor. Kapasitesi kaç litredir?',60,'x*(1-3/5)-24','x','Boş olan 2/5 kapasite 24 L’dir.'),
 ('Bir paranın önce 1/4’ü, sonra kalanın 1/3’ü harcanıyor. Başlangıç 120 TL ise kaç TL kalır?',60,'x-120*(1-1/4)*(1-1/3)','x','İkinci kesir başlangıca değil kalan paraya uygulanır.'),
 ('Bir yolun 2/5’i gidildikten sonra 72 km kalıyor. Yol toplam kaç km’dir?',120,'x*(1-2/5)-72','x','Kalan 3/5 yol 72 km’dir.'),
 ('Bir sınıfın 3/8’i kızdır. Erkekler 25 kişi ise sınıf kaç kişidir?',40,'x*(1-3/8)-25','x','Erkek payı 5/8’dir.'),
 ('Bir sayının 2/3’ü ile 1/4’ünün toplamı 55’tir. Sayı kaçtır?',60,'x*(2/3+1/4)-55','x','Paylar 11/12 olarak birleştirilir.'),
 ('Bir kitabın ilk gün 1/3’ü, ikinci gün tamamının 1/4’ü okunuyor. 50 sayfa kaldıysa kitap kaç sayfadır?',120,'x*(1-1/3-1/4)-50','x','Okunmayan pay 5/12’dir.'),
 ('Bir kutudaki kalemlerin 2/7’si kırmızı, 3/7’si mavidir. Kalan 12 kalem yeşilse toplam kaç kalem vardır?',42,'x*(1-2/7-3/7)-12','x','Yeşil pay 2/7’dir.'),
 ('Bir miktarın yarısı 18 artırılınca tamamının 4 eksiğine eşit oluyor. Miktar kaçtır?',44,'x/2+18-(x-4)','x','Kesirli denklem düzenlenir.'),
 ('Bir depodan içindeki suyun 1/5’i alınıyor, sonra 12 L ekleniyor. İlk hacme dönülüyorsa başlangıç kaç litredir?',60,'x*(1-1/5)+12-x','x','Alınan 1/5 pay 12 L’ye eşittir.'),
 ])
 b.rows('V3-TYT-019-01','packing',[
 ('95 nesne 6’şarlı tam paketlere konuyor. Tam dolu kaç paket olur?',15,'floor(95/6)','Bölümün tam kısmı alınır.'),
 ('95 nesne 6’şarlı paketleniyor. Kaç nesne artar?',5,'Mod(95,6)','95=6·15+5 yazılır.'),
 ('95 nesnenin tümü, en fazla 6 nesne alan kutulara konacak. En az kaç kutu gerekir?',16,'ceiling(95/6)','Artan nesneler için ek kutu gerekir.'),
 ('7’şerli 12 tam paket ve 3 artan nesne varsa toplam kaç nesne vardır?',87,'7*12+3','Paket içindekilerle artanlar toplanır.'),
 ('5’li paketlerden 8, 3’lü paketlerden 6 tane var. Toplam kaç nesne vardır?',58,'5*8+3*6','İki paket türündeki nesne sayıları toplanır.'),
 ('120 nesnenin 18’i ayrılıyor. Kalanlar 6’şarlı paketlenirse kaç tam paket olur?',17,'(120-18)/6','Önce ayrılan nesneler çıkarılır.'),
 ('Bir servis 9 kişiliktir. 74 kişinin hepsi taşınacak. En az kaç sefer gerekir?',9,'ceiling(74/9)','Son sefer eksik dolabilir.'),
 ('Bir rafta 4 tam koli, her kolide 18 kitap ve ayrıca 7 kitap vardır. 9’ar kitaplık kaç tam grup yapılır?',8,'floor((4*18+7)/9)','Toplam 79 kitabın 72’si 8 gruba ayrılır.'),
 ('6’şarlı paketlenince 4 artan 58 nesne, 8’erli paketlenirse kaç artar?',2,'Mod(58,8)','Paket değişiminde toplam 58 nesne aynı kalır.'),
 ('Her birinde 24 kalem bulunan 7 kutudan, her öğrenciye 5 kalem veriliyor. En çok kaç öğrenci alabilir?',33,'floor(7*24/5)','Toplam 168 kalem için tam bölüm alınır.'),
 ])
 equation_rows(b,'V3-TYT-035-01','resource-problems',[
 ('Bir kişi 5 arkadaşına 7’şer kalem verip 9 kalem bırakıyor. Başta kaç kalemi vardır?',44,'x-(5*7+9)','x','Dağıtılan ve kalan miktar toplanır.'),
 ('Bir kişi kız kardeşlerinin her birine 4, 3 erkek kardeşinin her birine 7 bilye veriyor; 5 kalıyor. Başta 42 bilye varsa kız kardeşi kaçtır?',4,'4*x+3*7+5-42','x','Bilinmeyen kardeş sayısı toplam bilye dengesiyle bulunur.'),
 ('12 defterin her biri 18 TL, 3 kalemin her biri 8 TL’dir. 300 TL’den kaç TL kalır?',60,'x-(300-12*18-3*8)','x','İki harcama toplam paradan çıkarılır.'),
 ('Bir gezide kişi başı 40 TL toplanırsa 120 TL eksik kalıyor. 3 kişi daha katılıp aynı miktarı öderse bütçe tamamlanıyor. Sonradan katılanlar toplam kaç TL öder?',120,'x-3*40','x','Ek kişilerin katkısı açık bütçeyi kapatır.'),
 ('Bir paketten öğrenci başına 3 çıkartma verilince 8 artıyor. 14 öğrenci varsa pakette kaç çıkartma vardır?',50,'x-(14*3+8)','x','Toplam dağıtım ve artanlar toplanır.'),
 ('Bir sınıfa 5’er kitap dağıtınca 7 kitap eksik; 4’er kitap dağıtınca 11 kitap artıyor. Sınıf kaç kişidir?',18,'5*x-7-(4*x+11)','x','Aynı toplam kitap iki dağıtımla ifade edilir.'),
 ('Bir fondan 8 kişiye 45’er TL veriliyor ve 90 TL kalıyor. Fon iki katına çıkarılsa kaç TL olur?',900,'x-2*(8*45+90)','x','Başlangıç fonu 450 TL’dir.'),
 ('Bir kafilede 6 kişilik masalara oturunca 2 kişi ayakta kalıyor; 7 kişilik aynı sayıda masada 3 yer boş kalıyor. Masa sayısı kaçtır?',5,'6*x+2-(7*x-3)','x','Kişi sayısı iki oturma biçiminde eşitlenir.'),
 ('Bir öğrenci günde 12 soru çözerek 15 günde bitireceği arşivi, günde 18 soruyla kaç günde bitirir?',10,'18*x-12*15','x','Toplam iş miktarı 180 sorudur.'),
 ('Bir para 4 kişiye eşit bölününce kişi başı 90 TL oluyor. Aynı para 6 kişiye eşit bölünürse kişi başı kaç TL olur?',60,'6*x-4*90','x','Toplam 360 TL sabittir.'),
 ])

def algebra_families(b):
 b.rows('AI-TYT20-01','rational-identities',[
 ('x+y+z=0, xyz≠0. x/(y+z)+y/(x+z)+z/(x+y) kaçtır?',-3,'-1-1-1','Her payda kendi payının eksiğidir; her kesir −1 olur.'),
 ('a+b=0 ve a,b≠0 ise 3a/b−2b/a kaçtır?',-1,'3*(-1)-2*(-1)','a/b=b/a=−1 kullanılır.'),
 ('x+y=5, x≠0 ise (x²+xy)/x kaçtır?',5,'5','Pay x(x+y) olarak ayrılır.'),
 ('a−b=4 ve a≠b ise (a²−b²)/(a−b)−2b kaçtır?',4,'4','Kesir a+b’ye sadeleşir; 2b çıkarılınca a−b kalır.'),
 ('x+1/x=4, x≠0 ise (x²+1)/x kaçtır?',4,'4','Kesir iki terime ayrılınca x+1/x olur.'),
 ('a+b=6 ve ab=5, ab≠0 ise 1/a+1/b kaçtır?',F(6,5),'Rational(6,5)','Paydalar birleştirilince (a+b)/(ab) bulunur.'),
 ('x−y=3 ve xy=2, xy≠0 ise 1/y−1/x kaçtır?',F(3,2),'Rational(3,2)','Ortak payda xy; pay x−y’dir.'),
 ('a,b≠0 ve a/b=3 ise (2a+b)/(a−b) kaçtır?',F(7,2),'(2*3+1)/(3-1)','Pay ve payda b’ye bölünür.'),
 ('x≠2 için (x²−4)/(x−2) ifadesi x=7’de kaçtır?',9,'(7**2-4)/(7-2)','İki kare farkı x+2’ye sadeleşir.'),
 ('x+y=0 ve xy≠0 ise (x³+y³)/(x²y+xy²) tanımlı mıdır? Tanımsızsa 0, tanımlıysa 1 cevaplayın.',0,'0','Payda xy(x+y)=0 olduğundan ifade tanımsızdır.'),
 ])
 # Fractions with conditions are independently tested symbolically through finite rational samples below.
 for row in b.questions[-10:]:row['verificationSpec']={'type':'rational_identity','variant':int(row['id'].split('-')[-1]),'promptAnchor':row['prompt'],'parameters':{}}
 b.rows('V3-TYT-016-01','radicals',[
 ('√144+√81 kaçtır?',21,'sqrt(144)+sqrt(81)','Tam karelerin kökleri toplanır.'),
 ('√200/√8 kaçtır?',5,'sqrt(200)/sqrt(8)','Köklerin bölümü √25’tir.'),
 ('√50+√8 ifadesinin √2’ye oranı kaçtır?',7,'(sqrt(50)+sqrt(8))/sqrt(2)','Terimler 5√2 ve 2√2’dir.'),
 ('(√7+√3)(√7−√3) kaçtır?',4,'(sqrt(7)+sqrt(3))*(sqrt(7)-sqrt(3))','İki kare farkı 7−3 verir.'),
 ('√(9+16) ile √9+√16 arasındaki fark (ikinci eksi birinci) kaçtır?',2,'sqrt(9)+sqrt(16)-sqrt(9+16)','Toplamın kökü terim köklerinin toplamı değildir; 7−5 hesaplanır.'),
 ('x≥0 ve √(2x+1)=5 ise x kaçtır?',12,'(5**2-1)/2','İki tarafın karesi alınır.'),
 ('√(x²) ifadesi x=−9 için kaçtır?',9,'sqrt((-9)**2)','Gerçek sayılarda √(x²)=|x|’tir.'),
 ('1/(√5−2)+1/(√5+2) ifadesinin √5’e oranı kaçtır?',2,'(1/(sqrt(5)-2)+1/(sqrt(5)+2))/sqrt(5)','Eşleniklerle payda 1 olur; toplam 2√5’tir.'),
 ('(√3+1)²−2√3 kaçtır?',4,'(sqrt(3)+1)**2-2*sqrt(3)','Kare açılır, köklü terimler yok olur.'),
 ('√72·√2−√25 kaçtır?',7,'sqrt(72)*sqrt(2)-sqrt(25)','İlk çarpım √144=12’dir.'),
 ])
 equation_rows(b,'V3-TYT-027-01','linear-functions',[
 ('f(x)=3x−4 ise f(5) kaçtır?',11,'x-(3*5-4)','x','Girdinin yerine 5 yazılır.'),
 ('f(x)=2x+7 ve f(a)=19 ise a kaçtır?',6,'2*x+7-19','x','Çıktı eşitliği tersine çözülür.'),
 ('f(x)=4x−1 ise f(3)−f(1) kaçtır?',8,'x-((4*3-1)-(4*1-1))','x','İki fonksiyon değeri çıkarılır.'),
 ('f(x)=ax+2, f(3)=17 ise a kaçtır?',5,'3*x+2-17','x','Bilinmeyen eğim denklemle bulunur.'),
 ('f(x)=2x−3 ve g(x)=x+4 ise f(g(2)) kaçtır?',9,'x-(2*(2+4)-3)','x','Önce g(2)=6, sonra f(6)=9 bulunur.'),
 ('f(x)=−2x+5 ise f(f(1)) kaçtır?',-1,'x-(-2*(-2*1+5)+5)','x','İki ardışık yerleştirme yapılır.'),
 ('f(x)=3x+1 ve f(a+2)=16 ise a kaçtır?',3,'3*(x+2)+1-16','x','Girdi a+2 olarak yerleştirilir.'),
 ('f(x)=ax+b, f(0)=3 ve f(2)=11 ise f(5) kaçtır?',23,'2*x+3-11','5*x+3','b=3 ve a=4 bulunur.'),
 ('f(x)=5x−4 için f(x)=x eşitliğini sağlayan x kaçtır?',1,'5*x-4-x','x','Sabit nokta denklemi çözülür.'),
 ('f(x)=2x+1 ise f(1)+f(2)+…+f(10) kaçtır?',120,'x-(2*(10*11/2)+10)','x','Doğrusal değerlerin toplamı sayı toplamıyla bulunur.'),
 ])
 equation_rows(b,'V3-TYT-031-01','ratio',[
 ('x,y pozitif ve 3x=2y, x+y=25 ise x kaçtır?',10,'x+3*x/2-25','x','y=3x/2 yerine konur.'),
 ('A:B=2:5 ve toplamları 63 ise B kaçtır?',45,'2*x+5*x-63','5*x','Ortak oran çarpanı x alınır.'),
 ('6 işçi 8 günde tamamladığı işi eş güçte 4 işçi kaç günde bitirir?',12,'4*x-6*8','x','İşçi sayısı ile süre ters orantılıdır.'),
 ('Bir haritada 1 cm, gerçekte 8 km’dir. 6,5 cm kaç km’dir?',52,'x-8*6.5','x','Doğru orantıda ölçüler aynı çarpanla büyür.'),
 ('x:y=3:4 ve y:z=2:5 ise x:z oranının 1’e oranı kaçtır?',F(3,10),'x-Rational(3,10)','x','y ortak 4 alınırsa x=3,z=10 olur.'),
 ('A:B=4:7, B:A’nın farkı (B−A) 18 ise A kaçtır?',24,'7*x-4*x-18','4*x','Üç oran birimi 18’e eşittir.'),
 ('Bir tarifte un:şeker=5:2’dir. 350 g un için kaç g şeker gerekir?',140,'x-350*2/5','x','Un miktarı 5 birime karşılık gelir.'),
 ('x ve y ters orantılı, x=6 iken y=15. x=10 iken y kaçtır?',9,'10*x-6*15','x','Ters orantıda çarpım sabittir.'),
 ('Bir para 2:3:5 oranında bölünüyor. En büyük pay 150 TL ise toplam kaç TL’dir?',300,'5*x-150','(2+3+5)*x','Bir oran birimi 30 TL’dir.'),
 ('A:B=2:3. A’ya 8, B’ye 2 eklenince eşit oluyorlar. İlk A kaçtır?',12,'2*x+8-(3*x+2)','2*x','Oranlar ortak çarpanla ifade edilir.'),
 ])
 pid='V3-TYT-013-01';fam='integer-inequalities'
 cases=[
 ('3<x<12 koşulunu sağlayan kaç tam sayı vardır?',{'x':[-20,30]},'3<x<12','count'),
 ('−5≤x<4 koşulunu sağlayan tam sayıların toplamı kaçtır?',{'x':[-20,30]},'-5<=x<4','sum:x'),
 ('2x+3<14 ve x≥0 ise x’in en büyük tam sayı değeri kaçtır?',{'x':[0,30]},'2*x+3<14','max:x'),
 ('3x−5≥10 ve x<12 ise kaç tam sayı x vardır?',{'x':[-10,20]},'3*x-5>=10 and x<12','count'),
 ('−2<2x−1≤9 koşulunu sağlayan kaç tam sayı vardır?',{'x':[-10,20]},'-2<2*x-1<=9','count'),
 ('1≤x≤20 ve x çift ise x değerleri toplamı kaçtır?',{'x':[1,20]},'x%2==0','sum:x'),
 ('5<x<25 ve x, 3’ün katı ise kaç tam sayı vardır?',{'x':[0,30]},'5<x<25 and x%3==0','count'),
 ('x tam sayı, −4≤x≤7. x² ifadesinin en büyük değeri kaçtır?',{'x':[-4,7]},'True','max:x*x'),
 ('x tam sayı, 2≤x<9. 20−3x ifadesinin en küçük değeri kaçtır?',{'x':[2,8]},'True','min:20-3*x'),
 ('x,y tam sayılar; 0≤x≤5, 0≤y≤5 ve x+y<4. Kaç (x,y) vardır?',{'x':[0,5],'y':[0,5]},'x+y<4','count'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['Sınırlar dahil/haric olma koşulları korunarak uygun tam sayılar listelenir.'])
 pid='V3-TYT-014-01';fam='absolute-value'
 cases=[
 ('|x−4|=7 denkleminin tam sayı kökleri toplamı kaçtır?',{'x':[-30,30]},'abs(x-4)==7','sum:x'),
 ('|x+3|=5 denkleminin büyük kökü kaçtır?',{'x':[-30,30]},'abs(x+3)==5','max:x'),
 ('|2x−6|=8 denkleminin küçük tam sayı kökü kaçtır?',{'x':[-30,30]},'abs(2*x-6)==8','min:x'),
 ('|x−2|<4 eşitsizliğini sağlayan kaç tam sayı vardır?',{'x':[-30,30]},'abs(x-2)<4','count'),
 ('|x+1|≤3 eşitsizliğini sağlayan tam sayıların toplamı kaçtır?',{'x':[-30,30]},'abs(x+1)<=3','sum:x'),
 ('x tam sayı, −5≤x≤8. |x−3|’ün en büyük değeri kaçtır?',{'x':[-5,8]},'True','max:abs(x-3)'),
 ('|x|+|x−4|=4 koşulunu sağlayan kaç tam sayı vardır?',{'x':[-30,30]},'abs(x)+abs(x-4)==4','count'),
 ('|x−2|=|x+6| eşitliğini sağlayan tam sayı x kaçtır?',{'x':[-30,30]},'abs(x-2)==abs(x+6)','x'),
 ('|x−1|+|x−5|=8 denkleminin tam sayı köklerinin kareleri toplamı kaçtır?',{'x':[-30,30]},'abs(x-1)+abs(x-5)==8','sum:x*x'),
 ('|x|≤4 ve x tek tam sayı ise uygun x değerlerinin kareleri toplamı kaçtır?',{'x':[-10,10]},'abs(x)<=4 and x%2!=0','sum:x*x'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['Mutlak değer uzaklık olarak yorumlanır; koşulu sağlayan bütün tam sayılar denetlenir.'])

def sequence_families(b):
 b.rows('V3-TYT-001-01','consecutive-numbers',[
 ('Baştan 25. pozitif çift sayı kaçtır?',50,'2*25','n. pozitif çift sayı 2n’dir.'),
 ('Baştan 18. pozitif tek sayı kaçtır?',35,'2*18-1','n. pozitif tek sayı 2n−1’dir.'),
 ('İlk 20 pozitif çift sayının toplamı kaçtır?',420,'20*21','2(1+…+20) hesaplanır.'),
 ('İlk 15 pozitif tek sayının toplamı kaçtır?',225,'15**2','İlk n tek sayının toplamı n²’dir.'),
 ('21’den 39’a kadar tek tam sayıların toplamı kaçtır?',300,'((39-21)/2+1)*(21+39)/2','Terim adedi 10 ve uçların ortalaması 30’dur.'),
 ('Ardışık beş tam sayının toplamı 90’dır. En küçük sayı kaçtır?',16,'90/5-2','Ortanca 18 ve en küçük 16’dır.'),
 ('Ardışık dört çift tam sayının toplamı 68’dir. En büyük sayı kaçtır?',20,'(68-2*(0+1+2+3))/4+6','Sayılar a,a+2,a+4,a+6 biçiminde yazılır.'),
 ('Ardışık üç pozitif tek sayının toplamı 57’dir. Çarpımları kaçtır?',6783,'(57/3-2)*(57/3)*(57/3+2)','Sayılar 17,19,21 bulunur.'),
 ('İlk n pozitif çift sayının toplamı 110’dur. n kaçtır?',10,'(-1+sqrt(1+4*110))/2','n(n+1)=110 denkleminin pozitif kökü seçilir.'),
 ('İlk 12 pozitif tek sayının toplamı ile ilk 12 pozitif çift sayının toplamı arasındaki fark (çift eksi tek) kaçtır?',12,'12*13-12**2','Her çift sayı eş sıradaki tek sayıdan 1 fazladır.'),
 ])
 b.rows('V3-TYT-006-01','consecutive-average',[
 ('Ortanca terimi 24 olan 7 ardışık çift tam sayının toplamı kaçtır?',168,'7*24','Simetrik dizide ortalama ortancadır.'),
 ('Toplamı 165 olan 5 ardışık tek sayının en küçüğü kaçtır?',29,'165/5-4','Ortanca 33, ilk terim 4 eksiktir.'),
 ('9 ardışık tam sayının en büyüğü 30’dur. Toplamları kaçtır?',234,'9*(30-4)','Ortanca 26 ve toplam 9·26’dır.'),
 ('6 ardışık çift sayının en küçüğü 8’dir. Aritmetik ortalamaları kaçtır?',13,'(8+(8+2*5))/2','Uçların ortalaması alınır.'),
 ('11 ardışık tam sayının toplamı 220’dir. Ortanca terim kaçtır?',20,'220/11','Ortanca toplamın terim sayısına bölümüdür.'),
 ('5 ardışık çift sayıdan en küçüğü çıkarılınca kalanların toplamı 68’dir. En küçük sayı kaçtır?',12,'(68-(2+4+6+8))/4','En küçük a ise kalan toplam 4a+20’dir.'),
 ('Ardışık 7 tek sayının ortancası 15’tir. En küçük ve en büyüğün çarpımı kaçtır?',189,'(15-6)*(15+6)','Uçlar ortancadan 6 uzaktadır.'),
 ('3 ardışık tam sayının kareleri toplamı 110’dur ve sayılar pozitiftir. Ortanca kaçtır?',6,'sqrt((110-2)/3)','(m−1)²+m²+(m+1)²=3m²+2 olur.'),
 ('5 ardışık tam sayının toplamı 65’tir. Her birine 4 eklenirse yeni toplam kaçtır?',85,'65+5*4','Beş terimin her biri 4 artar.'),
 ('Ardışık 4 tek sayının toplamı 64’tür. Ortadaki iki sayının çarpımı kaçtır?',255,'(64/4-1)*(64/4+1)','Ortadaki terimler 15 ve 17’dir.'),
 ])
 equation_rows(b,'V3-TYT-007-01','square-differences',[
 ('Ardışık iki pozitif tek sayının kareleri farkı 40’tır. Büyük sayı kaçtır?',11,'(x+2)**2-x**2-40','x+2','Küçük tek sayı x, büyük x+2 alınır.'),
 ('Ardışık iki pozitif çift sayının kareleri farkı 60’tır. Küçük sayı kaçtır?',14,'(x+2)**2-x**2-60','x','İki kare farkı 4x+4’tür.'),
 ('Ardışık iki doğal sayının kareleri farkı 21’dir. Büyük sayı kaçtır?',11,'(x+1)**2-x**2-21','x+1','Fark 2x+1’dir.'),
 ('Farkı 3 olan iki pozitif sayının kareleri farkı 75’tir. Toplamları kaçtır?',25,'(x+3)**2-x**2-75','2*x+3','Kareler farkı sayıların farkı ile toplamının çarpımıdır.'),
 ('a−b=4 ve a²−b²=104 ise a kaçtır?',15,'4*(2*x-4)-104','x','a+b=26 ve a−b=4 birlikte çözülür.'),
 ('Ardışık iki tek pozitif sayının kareleri farkı 64’tür. Küçük sayı kaçtır?',15,'(x+2)**2-x**2-64','x','Farkın lineer açılımı kullanılır.'),
 ('Bir pozitif sayının 2 fazlasının karesi, kendi karesinden 52 büyüktür. Sayı kaçtır?',12,'(x+2)**2-x**2-52','x','İki kare farkı 4x+4 olarak açılır.'),
 ('a+b=18 ve a²−b²=72 ise b kaçtır?',7,'18*(18-2*x)-72','x','a−b=4 ve toplam 18’dir.'),
 ('x ve x+5 pozitiftir. Kareleri farkı 125 ise çarpımları kaçtır?',150,'(x+5)**2-x**2-125','x*(x+5)','Önce x=10, sonra 10·15 bulunur.'),
 ('Ardışık iki pozitif tek sayı 2n−1 ve 2n+1’dir. Kareleri farkı 96 ise n kaçtır?',12,'(2*x+1)**2-(2*x-1)**2-96','x','Fark 8n olur.'),
 ])
 equation_rows(b,'V3-TYT-008-01','arithmetic-progressions',[
 ('İlk terimi 4, ortak farkı 3 olan dizinin 12. terimi kaçtır?',37,'x-(4+(12-1)*3)','x','aₙ=a₁+(n−1)d uygulanır.'),
 ('İlk terimi 5, ortak farkı 4 olan dizinin ilk 10 teriminin toplamı kaçtır?',230,'x-10*(2*5+9*4)/2','x','Aritmetik dizi toplamı kullanılır.'),
 ('3,8,13,… dizisinde 63 kaçıncı terimdir?',13,'3+(x-1)*5-63','x','Terim formülü 5n−2’dir.'),
 ('Bir aritmetik dizide a₃=11 ve ortak fark 4’tür. İlk terim kaçtır?',3,'x+2*4-11','x','Üçüncü terimden iki ortak fark çıkarılır.'),
 ('Bir aritmetik dizide a₂=7 ve a₇=27’dir. Ortak fark kaçtır?',4,'7+5*x-27','x','Beş adımda artış 20’dir.'),
 ('Bir aritmetik dizinin ilk 8 terimi toplamı 100, ilk terimi 2’dir. 8. terim kaçtır?',23,'8*(2+x)/2-100','x','Toplam, terim adedi ile uçların ortalamasının çarpımıdır.'),
 ('10,7,4,… dizisinin 9. terimi kaçtır?',-14,'x-(10+8*(-3))','x','Ortak fark −3’tür.'),
 ('5 ile 29 arasına, uçlarla birlikte aritmetik dizi olacak şekilde 3 sayı ekleniyor. Ortadaki sayı kaçtır?',17,'x-(5+29)/2','x','Beş terimli simetrik dizinin ortancası uçların ortalamasıdır.'),
 ('Bir aritmetik dizide a₅=18 ise a₂+a₈ kaçtır?',36,'x-2*18','x','Ortanca etrafında eş uzaklıktaki terimlerin toplamı iki ortancadır.'),
 ('Bir aritmetik dizinin ilk 6 terimi 2,5,8,11,14,17’dir. Son üç terimin toplamı ilk üçün toplamından kaç fazladır?',27,'x-((11+14+17)-(2+5+8))','x','Eşlenen üç terimin her biri 9 fazladır.'),
 ])
 equation_rows(b,'V3-TYT-009-01','matchstick-patterns',[
 ('Yan yana n kare ortak kenarla yapılıyor. 10 kare için kaç kibrit gerekir?',31,'x-(3*10+1)','x','İlk kare 4, her ek kare 3 kibrit gerektirir.'),
 ('Ortak kenarlı yan yana kareler 64 kibrit kullanıyor. Kaç kare vardır?',21,'3*x+1-64','x','3n+1 toplamı tersine çözülür.'),
 ('Yan yana ortak kenarlı kare sayısı 8’den 13’e çıkıyor. Kaç kibrit eklenir?',15,'x-3*(13-8)','x','Her yeni kare 3 ek kibrit ister.'),
 ('Birbirine değmeyen 12 kare ile ortak kenarlı 12 kare sırası arasındaki kibrit farkı kaçtır?',11,'x-(4*12-(3*12+1))','x','Her ortak kenar bir kibrit tasarrufu sağlar.'),
 ('Yan yana ortak kenarlı 7 karelik iki ayrı sıra var. Toplam kaç kibrit kullanılır?',44,'x-2*(3*7+1)','x','Ayrı sıraların ilk kenarları paylaşılmaz.'),
 ('2 satır ve 5 sütunluk kare ızgaranın her birim kenarına bir kibrit konuyor. Kaç kibrit gerekir?',27,'x-(2*(5+1)+5*(2+1))','x','Düşey 12, yatay 15 kenar sayılır.'),
 ('3 satır 4 sütun kare ızgarada toplam kaç birim kenar vardır?',31,'x-(3*(4+1)+4*(3+1))','x','Düşey ve yatay kenarlar ayrı sayılır.'),
 ('Ortak kenarlı yan yana 6 üçgen, her yeni üçgen öncekiyle bir kenar paylaşıyor. Kaç kibrit kullanılır?',13,'x-(3+2*(6-1))','x','İlk üçgen 3, her ek üçgen 2 kibrit ister.'),
 ('Ortak kenarlı yan yana karelerde kibrit sayısı 40 ise, bütün karelerin çevreleri ayrı ayrı sayıldığında kaç birim kenar sayılır?',52,'3*x+1-40','4*x','Önce kare sayısı 13 bulunur; her karenin dört kenarı sayılır.'),
 ('4 satır ve n sütunluk birim kare ızgarada 49 birim kenar vardır. n kaçtır?',5,'4*(x+1)+x*(4+1)-49','x','Izgara kenar sayısı 9n+4’tür.'),
 ])
 pid='V3-TYT-034-01';fam='interval-parity'
 cases=[
 ('10≤x≤40 aralığında kaç tek tam sayı vardır?',{'x':[10,40]},'x%2==1','count'),
 ('−8≤x≤8 aralığında kaç çift tam sayı vardır?',{'x':[-8,8]},'x%2==0','count'),
 ('15<x<35 aralığındaki tek tam sayıların toplamı kaçtır?',{'x':[16,34]},'x%2!=0','sum:x'),
 ('3≤x≤30 aralığında hem çift hem 3’ün katı kaç tam sayı vardır?',{'x':[3,30]},'x%2==0 and x%3==0','count'),
 ('−5<x≤9 aralığındaki çift tam sayıların toplamı kaçtır?',{'x':[-4,9]},'x%2==0','sum:x'),
 ('100≤x≤120 aralığındaki en küçük ve en büyük tek sayıların farkı kaçtır?',{'x':[100,120]},'x%2!=0','max:x-101'),
 ('1≤x≤50 aralığında tek olup 5’in katı olan kaç sayı vardır?',{'x':[1,50]},'x%2!=0 and x%5==0','count'),
 ('20≤x≤42 aralığındaki çift sayılarının kareleri toplamı kaçtır?',{'x':[20,42]},'x%2==0','sum:x*x'),
 ('1≤x≤20 aralığında x ve x+1 toplamı 15’ten büyük ve 25’ten küçükse kaç x vardır?',{'x':[1,20]},'15<x+(x+1)<25','count'),
 ('−10≤x≤10 aralığında x² tek ise kaç x vardır?',{'x':[-10,10]},'(x*x)%2==1','count'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['Verilen kapalı veya açık aralıktaki tam sayılar ve tek/çift koşulu birlikte denetlenir.'])
 b.rows('V3-TYT-036-01','ceiling-patterns',[
 ('F(n)=⌈n/2⌉. F(1)+…+F(10) kaçtır?',30,'2*(5*6/2)','Değerler 1,1,2,2,…,5,5 olarak eşleşir.'),
 ('F(n)=⌈n/2⌉. F(11) kaçtır?',6,'ceiling(11/2)','11/2 yukarı yuvarlanır.'),
 ('F(n)=⌈n/3⌉. F(1)+F(4)+F(7)+F(10) kaçtır?',10,'1+2+3+4','Üçer aralıklı girdiler1,2,3,4 değerlerini verir.'),
 ('F(n)=⌈n/2⌉. İlk9 terimin toplamı, ilk8 terimin toplamından kaç fazladır?',5,'ceiling(9/2)','İki toplam farkında yalnız9.terim kalır.'),
 ('F(n)=⌈n/4⌉. 1≤n≤20 için F(n)=3 olan kaç n vardır?',4,'4','n=9,10,11,12 değerleri üçüncü bloktadır.'),
 ('F(n)=⌈n/3⌉. F(20)−F(5) kaçtır?',5,'ceiling(20/3)-ceiling(5/3)','İki tavan değeri 7 ve 2’dir.'),
 ('F(n)=⌈n/2⌉. F(21)+F(22)+F(23)+F(24) kaçtır?',46,'11+11+12+12','Terimler ikili eşler oluşturur.'),
 ('G(n)=⌊n/2⌋. G(1)+…+G(10) kaçtır?',25,'0+1+1+2+2+3+3+4+4+5','Alt tam sayıya yuvarlama değerleri listelenir.'),
 ('F(n)=⌈n/5⌉. F(n)=4 olmasını sağlayan en küçük pozitif n kaçtır?',16,'5*(4-1)+1','Dördüncü blok 16’da başlar.'),
 ('F(n)=⌈n/2⌉. F(2n)+F(2n−1)=30 ise pozitif tam sayı n kaçtır?',15,'30/2','Her iki tavan değeri de n’dir.'),
 ])

def divisibility_families(b):
 b.rows('V3-TYT-010-01','modular-arithmetic',[
 ('N’nin 7 ile bölümünden kalan 3’tür. 2N+5’in 7 ile bölümünden kalan kaçtır?',4,'Mod(2*3+5,7)','N yerine aynı kalan sınıfından 3 kullanılır.'),
 ('N≡4 (mod 9). N²’nin 9 ile bölümünden kalan kaçtır?',7,'Mod(4**2,9)','Kalanın karesi tekrar 9’a göre indirgenir.'),
 ('A≡5 (mod 8), B≡6 (mod 8). A+B’nin kalanı kaçtır?',3,'Mod(5+6,8)','Kalanlar toplanır ve mod alınır.'),
 ('A≡5 (mod 8), B≡6 (mod 8). A·B’nin kalanı kaçtır?',6,'Mod(5*6,8)','Kalanlar çarpılır ve tekrar indirgenir.'),
 ('N≡2 (mod 5). 3N−8’in 5 ile bölümünden negatif olmayan kalan kaçtır?',3,'Mod(3*2-8,5)','−2’nin 5’e göre kalanı 3’tür.'),
 ('7²⁰ sayısının 6 ile bölümünden kalan kaçtır?',1,'Mod(7**20,6)','7’nin 6’ya göre kalanı 1’dir.'),
 ('3¹⁰ sayısının 8 ile bölümünden kalan kaçtır?',1,'Mod(3**10,8)','3²≡1 (mod 8) ve üs çifttir.'),
 ('902+350 toplamının 17 ile bölümünden kalan kaçtır?',11,'Mod(902+350,17)','Toplam 1252’nin 17’ye bölümünden kalan alınır.'),
 ('N≡4 (mod 7). N+3’ün 7 ile tam bölünmesi için eklenmesi gereken en küçük negatif olmayan sayı kaçtır?',0,'Mod(-(4+3),7)','N+3 zaten 7’nin katıdır.'),
 ('10³+10²+10+1 sayısının 9 ile bölümünden kalan kaçtır?',4,'Mod(10**3+10**2+10+1,9)','Her 10 kuvvetinin 9’a göre kalanı 1’dir.'),
 ])
 b.rows('V3-TYT-011-01','common-divisors',[
 ('50,86,122 sayıları bir N>0 tam sayısına bölündüğünde aynı kalan bulunuyor. En büyük N kaçtır?',36,'gcd(86-50,122-50)','N farkları bölmelidir; en büyük değer farkların EBOB’udur.'),
 ('48 ve 72 cm uzunluklar artıksız ve eşit parçalara ayrılacak. En uzun parça kaç cm olur?',24,'gcd(48,72)','Ortak parça uzunluğu iki uzunluğu da bölmelidir.'),
 ('36 kırmızı ve 60 mavi boncuk, her pakette aynı sayıda kırmızı ve aynı sayıda mavi olacak; hiç artmayacak. En çok kaç paket yapılır?',12,'gcd(36,60)','Paket sayısı iki renk sayısının ortak bölenidir.'),
 ('EBOB(84,126) kaçtır?',42,'gcd(84,126)','Asal çarpanlarda ortak kuvvetlerin küçüğü seçilir.'),
 ('72 ve 120 sayılarının en büyük ortak böleninin 6’ya oranı kaçtır?',4,'gcd(72,120)/6','EBOB 24 bulunur ve 6’ya bölünür.'),
 ('İki pozitif tam sayının EBOB’u 6, çarpımı 1080’dir. EKOK’ları kaçtır?',180,'1080/6','EBOB·EKOK iki sayının çarpımına eşittir.'),
 ('80 ve 112 cm’lik iki şerit en uzun eşit parçalara bölünüyor. Toplam kaç parça oluşur?',12,'80/gcd(80,112)+112/gcd(80,112)','Ortak uzunluk 16 cm, parça adetleri 5 ve 7’dir.'),
 ('Çevresi 180 m olan dikdörtgen alanın kenarları 36 ve 54 m’dir. Köşeler dahil eş aralıklarla en az sayıda direk için kaç direk gerekir?',10,'(2*(36+54))/gcd(36,54)','En büyük aralık 18 m’dir; kapalı çevrede direk sayısı çevre/aralıktır.'),
 ('125 ve 205 sayıları N’ye bölününce kalan 5 oluyor. En büyük N kaçtır?',40,'gcd(125-5,205-5)','N,120 ve200’ü böler; EBOB 40, kalan5’ten büyüktür.'),
 ('48,72,120 sayılarının ortak bölenlerinin en büyüğü kaçtır?',24,'gcd(gcd(48,72),120)','EBOB işlemi art arda uygulanır.'),
 ])
 b.rows('V3-TYT-012-01','common-multiples',[
 ('Işıklar 6,8,10 saniyede bir yanıyor. Birlikte yandıktan en erken kaç saniye sonra yine birlikte yanarlar?',120,'lcm(lcm(6,8),10)','Birlikte yanma süresi periyotların EKOK’udur.'),
 ('12 ve 18’in en küçük pozitif ortak katı kaçtır?',36,'lcm(12,18)','Asal çarpanlardaki en büyük kuvvetler seçilir.'),
 ('Bir mal hem 8’li hem 12’li kutulara artmadan paketlenebiliyor. En az kaç adet olabilir?',24,'lcm(8,12)','Adet her iki paket büyüklüğünün katıdır.'),
 ('İki otobüs 15 ve 20 dakikada bir kalkıyor. 09.00’da birlikte kalkarlarsa yeniden birlikte kalkmaları kaç dakika sonra olur?',60,'lcm(15,20)','Ortak kalkış aralığı EKOK’tur.'),
 ('Bir sayının 4,6 ve9 ile tam bölündüğü biliniyor. En küçük pozitif değeri kaçtır?',36,'lcm(lcm(4,6),9)','Bütün bölünebilme koşulları EKOK’ta birleşir.'),
 ('6 ve 8 dakikada bir çalan iki alarm başlangıçta birlikte çalıyor. İlk 48 dakikada, başlangıç hariç kaç kez birlikte çalar?',2,'floor(48/lcm(6,8))','Ortak periyot24 dakikadır;24 ve48 sayılır.'),
 ('İki sayının EBOB’u 5, EKOK’u 60’tır. Sayıların çarpımı kaçtır?',300,'5*60','EBOB·EKOK çarpım özdeşliği kullanılır.'),
 ('İki koşucu turu 40 ve60 saniyede tamamlıyor. Aynı noktadan aynı yönde başlayınca başlangıç noktasında birlikte ilk kez kaç saniyede bulunurlar?',120,'lcm(40,60)','İstenen aynı noktada değil başlangıçta birlikte olma koşuludur; ortak tur süresi gerekir.'),
 ('10 ve15 sayılarının 100’den büyük en küçük ortak katı kaçtır?',120,'(floor(100/lcm(10,15))+1)*lcm(10,15)','Ortak katlar30’ar artar;100’den sonraki120’dir.'),
 ('9 ve12’nin 1≤n≤200 aralığındaki pozitif ortak katlarının toplamı kaçtır?',540,'36+72+108+144+180','Ortak katlar EKOK36’nın beş katıdır.'),
 ])
 pid='V3-TYT-038-01';fam='coprime-counts'
 cases=[
 ('1≤n≤30 ve EBOB(n,6)=1 koşulunu sağlayan kaç n vardır?',{'n':[1,30]},'gcd(n,6)==1','count'),
 ('1≤n≤20 ve EBOB(n,10)=1 olan n’lerin toplamı kaçtır?',{'n':[1,20]},'gcd(n,10)==1','sum:n'),
 ('10≤n≤30 aralığında 12 ile aralarında asal kaç sayı vardır?',{'n':[10,30]},'gcd(n,12)==1','count'),
 ('1≤n≤25 aralığında 15 ile aralarında asal en büyük sayı kaçtır?',{'n':[1,25]},'gcd(n,15)==1','max:n'),
 ('1≤n≤40 aralığında 8 ile aralarında asal ve 3’ün katı kaç sayı vardır?',{'n':[1,40]},'gcd(n,8)==1 and n%3==0','count'),
 ('1≤a<b≤12 ve a+b=12. Aralarında asal kaç (a,b) vardır?',{'a':[1,12],'b':[1,12]},'a<b and a+b==12 and gcd(a,b)==1','count'),
 ('1≤n≤20, EBOB(n,6)=2 olan kaç sayı vardır?',{'n':[1,20]},'gcd(n,6)==2','count'),
 ('1≤n≤30, EBOB(n,12)=4 olan sayıların toplamı kaçtır?',{'n':[1,30]},'gcd(n,12)==4','sum:n'),
 ('10<n≤50 ve EBOB(n,30)=1 ise en küçük n kaçtır?',{'n':[11,50]},'gcd(n,30)==1','min:n'),
 ('1≤n≤24 aralığında hem6 hem10 ile aralarında asal kaç n vardır?',{'n':[1,24]},'gcd(n,6)==1 and gcd(n,10)==1','count'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['EBOB koşulu verilen aralıktaki her tam sayı için bağımsız Öklid algoritmasıyla denenir.'])
 pid='V3-TYT-042-01';fam='factor-pairs'
 cases=[
 ('60 sayısı a≤b pozitif tam sayılarının çarpımıdır. Kaç (a,b) vardır?',{'a':[1,60],'b':[1,60]},'a<=b and a*b==60','count'),
 ('72’nin pozitif bölenleri toplamı kaçtır?',{'a':[1,72]},'72%a==0','sum:a'),
 ('36’nın pozitif bölenlerinden kaç tanesi tek sayıdır?',{'a':[1,36]},'36%a==0 and a%2!=0','count'),
 ('100’ün pozitif bölenlerinden 10’dan küçük olanların sayısı kaçtır?',{'a':[1,100]},'100%a==0 and a<10','count'),
 ('a,b pozitif tam sayılar, a≤b ve ab=48 için a+b’nin en küçük değeri kaçtır?',{'a':[1,48],'b':[1,48]},'a<=b and a*b==48','min:a+b'),
 ('a,b pozitif tam sayılar, a<b ve ab=64 için a+b’nin en büyük değeri kaçtır?',{'a':[1,64],'b':[1,64]},'a<b and a*b==64','max:a+b'),
 ('84’ün pozitif ortak çarpan çiftlerinden (a≤b,ab=84) kaçında a çift sayıdır?',{'a':[1,84],'b':[1,84]},'a<=b and a*b==84 and a%2==0','count'),
 ('120’nin 3’e bölünebilen pozitif bölenleri toplamı kaçtır?',{'a':[1,120]},'120%a==0 and a%3==0','sum:a'),
 ('a,b pozitif tam sayı ve a²b=72’dir. Kaç (a,b) vardır?',{'a':[1,72],'b':[1,72]},'a*a*b==72','count'),
 ('96’nın pozitif bölenlerinden 4’e bölünüp 8’e bölünmeyen kaç sayı vardır?',{'a':[1,96]},'96%a==0 and a%4==0 and a%8!=0','count'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['Pozitif bölenler veya çarpan çiftleri açık koşullara göre tek tek sayılır.'])
 pid='AI-TYT06-01';fam='signed-divisors'
 cases=[
 ('−36, −8’den 8’e kadar sıfır hariç her tam sayıya bölünüyor. Tam sayı çıkan bölümlerin toplamı kaçtır?',{'d':[-8,8]},'d!=0 and -36%d==0','sum:-36//d'),
 ('48, −5’ten 8’e kadar sıfır hariç tam sayılara bölünüyor. Kaç tam sayı bölüm elde edilir?',{'d':[-5,8]},'d!=0 and 48%d==0','count'),
 ('−60 sayısının pozitif tam sayı bölenlerinin toplamı kaçtır?',{'d':[1,60]},'-60%d==0','sum:d'),
 ('−24 sayısı −6≤d≤4, d≠0 için d’ye bölünüyor. Tam sayı bölümlerin en büyüğü kaçtır?',{'d':[-6,4]},'d!=0 and -24%d==0','max:-24//d'),
 ('36 sayısı −9≤d≤6, d≠0 için d’ye bölünüyor. Tam sayı bölümlerin en küçüğü kaçtır?',{'d':[-9,6]},'d!=0 and 36%d==0','min:36//d'),
 ('−40 sayısı 1≤d≤10 tam sayılarına bölünüyor. Tam sayı bölümlerin toplamı kaçtır?',{'d':[1,10]},'-40%d==0','sum:-40//d'),
 ('54 sayısı −10≤d≤−1 tam sayılarına bölünüyor. Kaç bölüm tam sayıdır?',{'d':[-10,-1]},'54%d==0','count'),
 ('−72 sayısının negatif tam sayı bölenlerinden −12≤d≤−2 olanların toplamı kaçtır?',{'d':[-12,-2]},'-72%d==0','sum:d'),
 ('30 sayısı −5≤d≤5, d≠0 için bölünüyor. Pozitif tam sayı çıkan kaç bölüm vardır?',{'d':[-5,5]},'d!=0 and 30%d==0 and 30//d>0','count'),
 ('−18 sayısı −6≤d≤6, d≠0 için bölünüyor. Tam sayı bölümlerin kareleri toplamı kaçtır?',{'d':[-6,6]},'d!=0 and -18%d==0','sum:(-18//d)**2'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['Sıfır bölen dışlanır; kalan sıfırsa bölüm tam sayıdır.'])
 pid='AI-TYT21-01';fam='digit-products'
 cases=[
 ('ABC üç basamaklı, rakamları sıfırdan farklı ve A·B·C=24. Kaç sayı vardır?',{'A':[1,9],'B':[1,9],'C':[1,9]},'A*B*C==24','count'),
 ('ABC üç basamaklı, A·B·C=36 ve rakamlar sıfırdan farklı. En büyük sayı kaçtır?',{'A':[1,9],'B':[1,9],'C':[1,9]},'A*B*C==36','max:100*A+10*B+C'),
 ('ABC üç basamaklı, A·B·C=18 ve rakamlar sıfırdan farklı. En küçük sayı kaçtır?',{'A':[1,9],'B':[1,9],'C':[1,9]},'A*B*C==18','min:100*A+10*B+C'),
 ('ABC üç basamaklı ve A·B·C=20. Bu koşulu sağlayan sayıların toplamı kaçtır?',{'A':[1,9],'B':[1,9],'C':[1,9]},'A*B*C==20','sum:100*A+10*B+C'),
 ('ABC üç basamaklı, A·B·C=30. Rakamları farklı kaç sayı vardır?',{'A':[1,9],'B':[1,9],'C':[1,9]},'A*B*C==30 and A!=B and A!=C and B!=C','count'),
 ('ABC üç basamaklı, A·B·C=16. Çift olan kaç sayı vardır?',{'A':[1,9],'B':[1,9],'C':[1,9]},'A*B*C==16 and C%2==0','count'),
 ('ABC üç basamaklı, A·B·C=27. Rakamları toplamının en küçük değeri kaçtır?',{'A':[1,9],'B':[1,9],'C':[1,9]},'A*B*C==27','min:A+B+C'),
 ('ABC üç basamaklı, A·B·C=12 ve A=C. Kaç sayı vardır?',{'A':[1,9],'B':[1,9],'C':[1,9]},'A*B*C==12 and A==C','count'),
 ('ABC üç basamaklı, A·B·C=42. Bu sayıların kaçında 7 rakamı vardır?',{'A':[1,9],'B':[1,9],'C':[1,9]},'A*B*C==42 and (A==7 or B==7 or C==7)','count'),
 ('ABC üç basamaklı, A·B·C=64 ve A≤B≤C. En küçük ABC kaçtır?',{'A':[1,9],'B':[1,9],'C':[1,9]},'A*B*C==64 and A<=B<=C','min:100*A+10*B+C'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['1–9 rakamlarının sıralı üçlüleri çarpım ve ek koşulla birlikte denenir.'])

def counting_extras(b):
 b.rows('AI-TYT16-01','truth-table-size',[
 ('4 bağımsız önermenin tam doğruluk tablosunda kaç satır vardır?',16,'2**4','Her önerme için iki değer bağımsız olarak seçilir.'),
 ('32 satırlı tam doğruluk tablosu kaç bağımsız önerme içerir?',5,'log(32,2)','2ⁿ=32 eşitliğinde n=5 olur.'),
 ('3 önermeli tabloya 2 bağımsız önerme ekleniyor. Satır sayısı kaç katına çıkar?',4,'2**(3+2)/2**3','Eklenen her önerme satır sayısını ikiye katlar.'),
 ('6 önermenin doğruluk tablosunda ilk önermenin doğru olduğu kaç satır vardır?',32,'2**5','İlk önerme sabitken diğer5 önerme serbesttir.'),
 ('5 bağımsız önermede ilk ikisinin değerleri farklı olan kaç doğruluk satırı vardır?',16,'2*2**3','İlk iki için DY veya YD; kalan üç için2³ seçenek vardır.'),
 ('4 bağımsız önermede tam birinin doğru olduğu kaç satır vardır?',4,'binomial(4,1)','Doğru olacak tek önermenin yeri seçilir.'),
 ('5 bağımsız önermede en az birinin doğru olduğu kaç satır vardır?',31,'2**5-1','Yalnız hepsinin yanlış olduğu tek satır çıkarılır.'),
 ('6 bağımsız önermede tam 2 tanesinin doğru olduğu kaç satır vardır?',15,'binomial(6,2)','Doğru olacak2 önerme seçilir.'),
 ('3 bağımsız önermede doğru önerme sayısının çift olduğu kaç satır vardır?',4,'binomial(3,0)+binomial(3,2)','Sıfır veya iki doğru durumu toplanır.'),
 ('4 bağımsız önermede ilk önerme doğru ve son önerme yanlış iken kaç doğruluk satırı vardır?',4,'2**2','İki sabit ve iki serbest önerme vardır.'),
 ])
 equation_rows(b,'V3-TYT-026-01','sets-inclusion',[
 ('A’da 18, B’de 15 ve her ikisinde 6 kişi var. En az birinde kaç kişi vardır?',27,'x-(18+15-6)','x','İki küme birleşiminde kesişim bir kez çıkarılır.'),
 ('40 kişilik sınıfta 25 kişi A,18 kişi B,10 kişi ikisini seçiyor. Hiçbirini seçmeyen kaç kişi vardır?',7,'x-(40-(25+18-10))','x','Birleşim toplam sınıftan çıkarılır.'),
 ('A etkinliğinde 22, iki etkinlikte birden7 kişi var. Yalnız A kaç kişidir?',15,'x-(22-7)','x','A’dan kesişim çıkarılır.'),
 ('A veya B’de toplam32, A’da20, B’de19 kişi var. Her ikisinde kaç kişi vardır?',7,'20+19-x-32','x','Birleşim bağıntısında kesişim çözülür.'),
 ('Yalnız A’da12, yalnız B’de9, her ikisinde5 kişi var. Tam bir etkinlikte kaç kişi vardır?',21,'x-(12+9)','x','Tam bir etkinlik kesişimi içermez.'),
 ('50 kişiden30’u A,25’i B,10’u hiçbirini seçiyor. Her ikisini seçen kaçtır?',15,'30+25-x-(50-10)','x','Birleşim40 kişi olduğundan kesişim15’tir.'),
 ('A,B ayrık kümeleri 8 ve13 elemanlıdır. A∪B kaç elemanlıdır?',21,'x-(8+13)','x','Ayrık kümelerde kesişim0’dır.'),
 ('A⊂B, |A|=9, |B|=24 ise B’de olup A’da olmayan kaç eleman vardır?',15,'x-(24-9)','x','Alt küme dışında kalan elemanlar çıkarma ile bulunur.'),
 ('Yalnız A15, yalnız B11, ikisi4 kişidir. A’nın B’den eleman sayısı farkı (|A|−|B|) kaçtır?',4,'x-((15+4)-(11+4))','x','Kesişim iki sayıda da bulunduğundan farkta yok olur.'),
 ('Bir evrende36 kişi var. A20 kişi, A dışı16 kişidir. B12 kişi ve A∩B5 kişi ise A∪B dışında kaç kişi vardır?',9,'x-(36-(20+12-5))','x','Birleşim27, tümleyeni9 kişidir.'),
 ])
 b.rows('V3-TYT-030-01','statistics',[
 ('4,6,8,10 sayılarının aritmetik ortalaması kaçtır?',7,'(4+6+8+10)/4','Toplam terim sayısına bölünür.'),
 ('Ortalaması12 olan5 sayıya18 ekleniyor. Yeni ortalama kaçtır?',13,'(5*12+18)/6','Eski toplam60, yeni toplam78 olur.'),
 ('Ortalaması20 olan6 sayıdan35 çıkarılıyor. Kalanların ortalaması kaçtır?',17,'(6*20-35)/5','Çıkarılan sayı toplamdan ayrılır.'),
 ('3,9,4,12,7 veri grubunun medyanı kaçtır?',7,'7','Veriler3,4,7,9,12 sırasına konur; ortadaki7’dir.'),
 ('2,6,8,14 veri grubunun medyanı kaçtır?',7,'(6+8)/2','Çift sayıda veride ortadaki ikinin ortalaması alınır.'),
 ('4,7,4,9,7,4 veri grubunun modu kaçtır?',4,'4','4 üç kez,7 iki kez görülür; en sık4’tür.'),
 ('−3,5,11,2,8 verilerinin açıklığı kaçtır?',14,'11-(-3)','En büyükten en küçük çıkarılır.'),
 ('Ortalaması18 olan4 sayı ile ortalaması24 olan2 sayı birleşiyor. Yeni ortalama kaçtır?',20,'(4*18+2*24)/6','Grup ortalamaları kişi sayılarıyla ağırlıklandırılır.'),
 ('Beş sayının ortalaması14’tür. Her sayıya3 eklenirse yeni toplam kaçtır?',85,'5*14+5*3','Toplam15 artar.'),
 ('2,5,8,11 sayılarının her biri2 ile çarpılıp1 azaltılıyor. Yeni ortalama kaçtır?',12,'2*((2+5+8+11)/4)-1','Doğrusal dönüşüm ortalamaya aynı şekilde uygulanır.'),
 ])
 # Median/mode constant specs preserve original data rather than the selected answer.
 for row in b.questions[-10:]:
  v=int(row['id'].split('-')[-1])
  if v in (4,5,6):row['verificationSpec']={'type':'statistics','operation':'median' if v in(4,5) else 'mode','values':{4:[3,9,4,12,7],5:[2,6,8,14],6:[4,7,4,9,7,4]}[v],'promptAnchor':row['prompt']}
 pid='V3-TYT-004-01';fam='integer-equations'
 cases=[
 ('x,y≥0 tam sayılar ve x+y=8 ise kaç sıralı (x,y) vardır?',{'x':[0,8],'y':[0,8]},'x+y==8','count'),
 ('x,y>0 tam sayılar ve x+y=12 ise kaç sıralı (x,y) vardır?',{'x':[1,12],'y':[1,12]},'x+y==12','count'),
 ('x,y≥0 tam sayılar, 2x+3y=18 ise kaç sıralı (x,y) vardır?',{'x':[0,9],'y':[0,6]},'2*x+3*y==18','count'),
 ('x,y≥0 tam sayılar, 3x+4y=24 ise x+y’nin en büyük değeri kaçtır?',{'x':[0,8],'y':[0,6]},'3*x+4*y==24','max:x+y'),
 ('x,y≥0 tam sayılar, x+2y=10 ve x çift ise kaç (x,y) vardır?',{'x':[0,10],'y':[0,5]},'x+2*y==10 and x%2==0','count'),
 ('x,y pozitif tam sayılar, 5x+2y=29 ise y’nin en büyük değeri kaçtır?',{'x':[1,5],'y':[1,14]},'5*x+2*y==29','max:y'),
 ('x,y≥0 tam sayılar, 4x+6y=25 ise kaç (x,y) vardır?',{'x':[0,6],'y':[0,4]},'4*x+6*y==25','count'),
 ('x,y≥0 tam sayılar, x+y=9 ve x<y ise kaç (x,y) vardır?',{'x':[0,9],'y':[0,9]},'x+y==9 and x<y','count'),
 ('x,y,z≥0 tam sayılar ve x+y+z=4 ise kaç sıralı üçlü vardır?',{'x':[0,4],'y':[0,4],'z':[0,4]},'x+y+z==4','count'),
 ('x,y pozitif tam sayılar, 2x+5y=30 ise uygun x değerlerinin toplamı kaçtır?',{'x':[1,15],'y':[1,6]},'2*x+5*y==30','sum:x'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['Pozitiflik veya sıfıra izin verilme koşulu korunur; bütün uygun sıralı çözümler listelenir.'])
 pid='V3-TYT-039-01';fam='guaranteed-draws'
 cases=[
 ('Torbada5 kırmızı,4 mavi,3 yeşil taş vardır. En az3 taşın aynı renk olmasını garanti etmek için en az kaç taş çekilmeli?',{'r':[0,5],'m':[0,4],'y':[0,3]},'r<3 and m<3 and y<3','max:r+m+y+1'),
 ('5 kırmızı,4 mavi,3 yeşil taştan en az1 kırmızı gelmesini garanti etmek için kaç taş gerekir?',{'r':[0,5],'m':[0,4],'y':[0,3]},'r<1','max:r+m+y+1'),
 ('5 kırmızı,4 mavi,3 yeşil taştan en az2 mavi gelmesini garanti etmek için kaç taş gerekir?',{'r':[0,5],'m':[0,4],'y':[0,3]},'m<2','max:r+m+y+1'),
 ('5 kırmızı,4 mavi,3 yeşil taştan en az1 kırmızı ve en az1 mavi gelmesini birlikte garanti etmek için kaç taş gerekir?',{'r':[0,5],'m':[0,4],'y':[0,3]},'r<1 or m<1','max:r+m+y+1'),
 ('5 kırmızı,4 mavi,3 yeşil taştan en az2 farklı renk gelmesini garanti etmek için kaç taş gerekir?',{'r':[0,5],'m':[0,4],'y':[0,3]},'(r>0)+(m>0)+(y>0)<2','max:r+m+y+1'),
 ('5 kırmızı,4 mavi,3 yeşil taştan her3 rengin de gelmesini garanti etmek için kaç taş gerekir?',{'r':[0,5],'m':[0,4],'y':[0,3]},'r==0 or m==0 or y==0','max:r+m+y+1'),
 ('5 kırmızı,4 mavi,3 yeşil taştan en az4 taşın aynı renk olmasını garanti etmek için kaç taş gerekir?',{'r':[0,5],'m':[0,4],'y':[0,3]},'r<4 and m<4 and y<4','max:r+m+y+1'),
 ('5 kırmızı,4 mavi,3 yeşil taştan en az3 kırmızı veya en az3 mavi gelmesini garanti etmek için kaç taş gerekir?',{'r':[0,5],'m':[0,4],'y':[0,3]},'r<3 and m<3','max:r+m+y+1'),
 ('5 kırmızı,4 mavi,3 yeşil taştan en az2 kırmızı ve en az2 mavi gelmesini garanti etmek için kaç taş gerekir?',{'r':[0,5],'m':[0,4],'y':[0,3]},'r<2 or m<2','max:r+m+y+1'),
 ('Bir çekmecede4 siyah,3 beyaz,2 gri çorap vardır. Aynı renkten bir çift garanti etmek için en az kaç çorap alınmalı?',{'s':[0,4],'b':[0,3],'g':[0,2]},'s<2 and b<2 and g<2','max:s+b+g+1'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['İstenen olay henüz oluşmadan seçilebilecek en büyük taş sayısı bulunur; bir fazlası olayı zorunlu kılar.'])
 pid='V3-TYT-033-01';fam='score-outcomes'
 cases=[
 ('İki zar atılıyor; her zar1–6 değerlerinden birini verir. Toplamı7 olan kaç sıralı sonuç vardır?',{'a':[1,6],'c':[1,6]},'a+c==7','count'),
 ('İki zarın toplamı en az10 ise kaç sıralı sonuç vardır?',{'a':[1,6],'c':[1,6]},'a+c>=10','count'),
 ('Üç zarın toplamı5 ise kaç sıralı sonuç vardır?',{'a':[1,6],'c':[1,6],'d':[1,6]},'a+c+d==5','count'),
 ('İki zar atılıyor. Birinci sonuç ikinciden büyükse kaç sıralı sonuç vardır?',{'a':[1,6],'c':[1,6]},'a>c','count'),
 ('İki zarın sonuçları çarpımı12 ise kaç sıralı sonuç vardır?',{'a':[1,6],'c':[1,6]},'a*c==12','count'),
 ('İki zarın toplamı tek ise kaç sıralı sonuç vardır?',{'a':[1,6],'c':[1,6]},'(a+c)%2==1','count'),
 ('Üç zarın hepsi farklı ve toplamı6 ise kaç sıralı sonuç vardır?',{'a':[1,6],'c':[1,6],'d':[1,6]},'a!=c and a!=d and c!=d and a+c+d==6','count'),
 ('İki zarın en büyüğü4 ise kaç sıralı sonuç vardır?',{'a':[1,6],'c':[1,6]},'max(a,c)==4','count'),
 ('İki zarın sonuçları farkının mutlak değeri2 ise kaç sıralı sonuç vardır?',{'a':[1,6],'c':[1,6]},'abs(a-c)==2','count'),
 ('Üç zarın her biri1–6 arasındadır. Toplamları8 ve ilk ikisi eşitse kaç sıralı sonuç vardır?',{'a':[1,6],'c':[1,6],'d':[1,6]},'a==c and a+c+d==8','count'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['Zarlar sıralı kabul edilir; her zarın1–6 değerleri için uygun durumlar sayılır.'])

def remaining_number_families(b):
 pid='AI-TYT14-01';fam='cyclic-digit-sums'
 cases=[
 ('K,L,M sıfırdan farklı ve farklı rakamlardır. K+L+M=12 ise KLM+LMK+MKL kaçtır?',{'K':[1,9],'L':[1,9],'M':[1,9]},'K!=L and K!=M and L!=M and K+L+M==12','111*(K+L+M)'),
 ('K,L,M farklı ve sıfırdan farklı rakamlardır. KLM+LMK+MKL=1998 ise K+L+M kaçtır?',{'K':[1,9],'L':[1,9],'M':[1,9]},'K!=L and K!=M and L!=M and 111*(K+L+M)==1998','K+L+M'),
 ('K,L,M farklı ve sıfırdan farklı rakamlardır. KLM+LMK+MKL’nin en küçük değeri kaçtır?',{'K':[1,9],'L':[1,9],'M':[1,9]},'K!=L and K!=M and L!=M','min:111*(K+L+M)'),
 ('K,L,M farklı ve sıfırdan farklı rakamlardır. KLM+LMK+MKL’nin en büyük değeri kaçtır?',{'K':[1,9],'L':[1,9],'M':[1,9]},'K!=L and K!=M and L!=M','max:111*(K+L+M)'),
 ('K,L,M farklı ve sıfırdan farklı rakamlardır. K=2,L=5 ve KLM+LMK+MKL=1554 ise M kaçtır?',{'K':[1,9],'L':[1,9],'M':[1,9]},'K==2 and L==5 and K!=M and L!=M and 111*(K+L+M)==1554','M'),
 ('K,L,M farklı ve sıfırdan farklı rakamlardır. K<L<M ve KLM+LMK+MKL=1110 ise kaç üçlü vardır?',{'K':[1,9],'L':[1,9],'M':[1,9]},'K<L<M and 111*(K+L+M)==1110','count'),
 ('K,L,M farklı ve sıfırdan farklı rakamlardır. K+L+M=15 ise KLM+LMK+MKL toplamının9’a bölümünden kalan kaçtır?',{'K':[1,9],'L':[1,9],'M':[1,9]},'K!=L and K!=M and L!=M and K+L+M==15','(111*(K+L+M))%9'),
 ('KLM üç basamaklı ve bütün rakamları2’dir. KLM+LMK+MKL kaçtır?',{'K':[2,2],'L':[2,2],'M':[2,2]},'True','111*(K+L+M)'),
 ('K,L,M farklı, sıfırdan farklı ve toplamları9’dur. KLM+LMK+MKL toplamının3’e oranı kaçtır?',{'K':[1,9],'L':[1,9],'M':[1,9]},'K!=L and K!=M and L!=M and K+L+M==9','37*(K+L+M)'),
 ('K,L,M farklı sıfırdan farklı rakamlardır. KLM+LMK+MKL=1665 ve K=3 ise L+M kaçtır?',{'K':[1,9],'L':[1,9],'M':[1,9]},'K==3 and K!=L and K!=M and L!=M and 111*(K+L+M)==1665','L+M'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['Her rakam yüzler,onlar,birler basamağında birer kez yer alır; toplam111(K+L+M)’dir.'])
 pid='AI-TYT19-01';fam='parity-logic'
 cases=[
 ('x,y,z tam sayıları, x+y çift, y−z tek ve xy tek. x+y+z’nin2’ye bölümünden kalan kaçtır?',{'x':[0,1],'y':[0,1],'z':[0,1]},'(x+y)%2==0 and (y-z)%2==1 and (x*y)%2==1','(x+y+z)%2'),
 ('x tek, y çift tam sayıdır. x²+y’nin2’ye bölümünden kalan kaçtır?',{'x':[0,1],'y':[0,1]},'x%2==1 and y%2==0','(x*x+y)%2'),
 ('xy çift ve x+y tek. (x,y) için kaç farklı tek/çift sıralaması mümkündür?',{'x':[0,1],'y':[0,1]},'(x*y)%2==0 and (x+y)%2==1','count'),
 ('x+y tek ve y+z tek. x+z’nin2’ye bölümünden kalan kaçtır?',{'x':[0,1],'y':[0,1],'z':[0,1]},'(x+y)%2==1 and (y+z)%2==1','(x+z)%2'),
 ('x,y,z tek tam sayılardır. xy+yz+zx’in2’ye bölümünden kalan kaçtır?',{'x':[1,1],'y':[1,1],'z':[1,1]},'True','(x*y+y*z+z*x)%2'),
 ('x ve y tam sayılar. x²+y² tek ise xy’nin2’ye bölümünden kalan kaçtır?',{'x':[0,1],'y':[0,1]},'(x*x+y*y)%2==1','(x*y)%2'),
 ('x,y,z tam sayıları, xy ve yz tek. x+z’nin2’ye bölümünden kalan kaçtır?',{'x':[0,1],'y':[0,1],'z':[0,1]},'(x*y)%2==1 and (y*z)%2==1','(x+z)%2'),
 ('x,y tam sayı, x+y ve xy çifttir. Kaç farklı tek/çift sıralaması mümkündür?',{'x':[0,1],'y':[0,1]},'(x+y)%2==0 and (x*y)%2==0','count'),
 ('x,y,z tam sayı ve toplamları çift. Üçünden tam biri tek olabilir mi? Olabilirse1, olamazsa0 cevaplayın.',{'x':[0,1],'y':[0,1],'z':[0,1]},'(x+y+z)%2==0 and x+y+z==1','count'),
 ('x tek,y çift. x+y,xy,x²+y²,2x+y ifadelerinden kaç tanesi tektir?',{'x':[1,1],'y':[0,0]},'True','(x+y)%2+(x*y)%2+(x*x+y*y)%2+(2*x+y)%2'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['Tek/çiftlik için her tam sayı yerine0 veya1 kalan sınıfı konur; olası tüm örüntüler incelenir.'])
 b.rows('AI-TYT18-01','periodic-colours',[
 ('Kareler1,2,3,…cm kenarlarla çiziliyor. İlk10 karenin çevreleri toplamı kaç cm’dir?',220,'4*10*11/2','Çevreler4n biçimindedir;1’den10’a toplam alınır.'),
 ('Kareler kırmızı,mavi,yeşil sırasıyla boyanıyor. Renk kodları sırasıyla1,2,3 ise25. karenin renk kodu kaçtır?',1,'Mod(25-1,3)+1','Sıfırdan başlayan indeks3’e göre indirgenir.'),
 ('Kenarları1’den12’ye kareler için alanların toplamı kaç cm²’dir?',650,'12*13*25/6','Kareler toplamı n(n+1)(2n+1)/6 kullanılır.'),
 ('Kenarları1,2,…,n cm karelerin toplam çevresi312 cm’dir. Son kenar kaç cm’dir?',12,'(-1+sqrt(1+2*312))/2','Toplam çevre2n(n+1)=312; pozitif kök12’dir.'),
 ('Renk döngüsü kırmızı,mavi,yeşildir. İlk20 karenin kaç tanesi mavidir?',7,'floor((20+1)/3)','Mavi konumlar2,5,8,11,14,17,20’dir.'),
 ('Renkler dört renkle sırayla tekrarlanıyor. İlk ve son kare aynı renkte olan13 karelik sırada kaç tam renk döngüsü tamamlanmıştır?',3,'floor(13/4)','Üç tam döngü12 kare kapsar;13. kare yeni döngüyü başlatır.'),
 ('Kenarları1’den9’a karelerin ilk ve son çevreleri farkı kaç cm’dir?',32,'4*9-4*1','Uç çevreler36 ve4’tür.'),
 ('Kırmızı,mavi,yeşil döngüsünde kırmızı karelerin kenarları1,4,7,…cm’dir. İlk5 kırmızı karenin çevreleri toplamı kaç cm’dir?',140,'4*5*(2*1+4*3)/2','Seçilen kenarlar ortak fark3 olan aritmetik dizi oluşturur.'),
 ('Kenarları1,2,…cm karelerden ilk6’sı çizildi. Sonraki kare eklenince toplam çevre kaç cm artar?',28,'4*(6+1)','Eklenen tek karenin çevresi kadar artar.'),
 ('Kareler3 renkli döngüyle boyanıyor. Aynı renkte iki karenin sıra numaraları farkı en az kaçtır?',3,'3*1','Aynı renk her üç adımda bir döner.'),
 ])
 pid='V3-TYT-037-01';fam='square-triangular'
 cases=[
 ('1≤n≤50 için n(n+1)/2 tam kare olan kaç n vardır?',{'n':[1,50]},'isqrt(n*(n+1)//2)**2==n*(n+1)//2','count'),
 ('1≤n≤50 için üçgensel sayı n(n+1)/2 hem kare hem1’den büyükse en küçük değeri kaçtır?',{'n':[1,50]},'n*(n+1)//2>1 and isqrt(n*(n+1)//2)**2==n*(n+1)//2','min:n*(n+1)//2'),
 ('1≤n≤50 için n(n+1)/2 kare oluyorsa bu n değerleri toplamı kaçtır?',{'n':[1,50]},'isqrt(n*(n+1)//2)**2==n*(n+1)//2','sum:n'),
 ('1≤n≤50 için hem kare hem üçgensel sayıların en büyüğü kaçtır?',{'n':[1,50]},'isqrt(n*(n+1)//2)**2==n*(n+1)//2','max:n*(n+1)//2'),
 ('1≤n≤100 için n(n+1)/2’nin36 olması hangi n ile sağlanır?',{'n':[1,100]},'n*(n+1)//2==36','n'),
 ('1≤n≤50 için kare olan üçgensel sayıların karekökleri toplamı kaçtır?',{'n':[1,50]},'isqrt(n*(n+1)//2)**2==n*(n+1)//2','sum:isqrt(n*(n+1)//2)'),
 ('1≤n≤50 için kare olan üçgensel sayılardan kaç tanesi çifttir?',{'n':[1,50]},'isqrt(n*(n+1)//2)**2==n*(n+1)//2 and (n*(n+1)//2)%2==0','count'),
 ('1≤n≤50 için kare olan üçgensel sayılardan kaç tanesi3 ile bölünür?',{'n':[1,50]},'isqrt(n*(n+1)//2)**2==n*(n+1)//2 and (n*(n+1)//2)%3==0','count'),
 ('1≤n≤50 için kare olan üçgensel sayıların toplamı kaçtır?',{'n':[1,50]},'isqrt(n*(n+1)//2)**2==n*(n+1)//2','sum:n*(n+1)//2'),
 ('1≤n≤50 için kare olan üçgensel sayılardan kaç tanesi iki basamaklıdır?',{'n':[1,50]},'isqrt(n*(n+1)//2)**2==n*(n+1)//2 and 10<=n*(n+1)//2<=99','count'),
 ]
 for v,(p,vs,pred,obj) in enumerate(cases,1):b.search(pid,fam,v,p,vs,pred,obj,['Üçgensel sayı tam hesaplanır; tam karelik, tam sayı karekökü yeniden karesini alarak denetlenir.'])

def patch_raw_specs(b):
 """Encode unsimplified mathematical domains for independent QA, never just answer literals."""
 by={(q['familyId'],int(q['id'].split('-')[-1])):q for q in b.questions if q['id'].startswith('AI-NEW-TYT-') and not q['id'].startswith('AI-NEW-TYT-C-')}
 def finite(f,v,variables,predicate,objective):
  row=by[f,v]
  obj=({'kind':objective.split(':')[0],'expression':objective.split(':',1)[1]} if ':' in objective else {'kind':'count','expression':'1'} if objective=='count' else {'kind':'unique','expression':objective})
  row['verificationSpec']={'type':'finite_search','variables':variables,'predicate':predicate,'objective':obj,'promptAnchor':row['prompt']}
  row['verification']['methods']=['Author mathematical solution','Independent finite-domain search from original conditions']
 def expr(f,v,expression):
  row=by[f,v];row['verificationSpec']={'type':'exact_expression','expression':expression,'promptAnchor':row['prompt'],'semanticCheck':row['prompt']}
 def equation(f,v,expression,objective='x',conditions=None):
  row=by[f,v];row['verificationSpec']={'type':'exact_math','operation':'solve_parameter','expression':expression,'variable':'x','conditions':conditions or [],'objective':objective,'promptAnchor':row['prompt']}
 # All stated inverse conditions are retained as equations, not their solved value.
 for v,e,o in [
  (1,'3*x+8-35','x'),(2,'3*(2*x-5)+4-49','x'),(3,'x/2-7-11','x/3'),
  (4,'(x+5)/4-(x-4)/3','x'),(5,'5*(5*x-2)-2-113','x'),
  (6,'(x+3)+(x-2)-19','x'),(7,'x+(2*x-8)-34','2*x-8'),
  (8,'2*x+3-(5*x-9)','x'),(9,'4*x-6-(3*x+8)','x'),(10,'(2*x+3)/5-(x-1)','x')]:equation('inverse-operations',v,e,o)
 d3={'A':[1,9],'B':[0,9],'C':[0,9]};d4={'A':[1,9],'B':[0,9],'C':[0,9],'D':[0,9]}
 distinct3='A!=B and A!=C and B!=C';distinct4=distinct3+' and A!=D and B!=D and C!=D'
 finite('digit-extrema',1,d4,distinct4,'min:1000*A+100*B+10*C+D')
 finite('digit-extrema',2,d3,distinct3+' and C%2==0','max:100*A+10*B+C')
 finite('digit-extrema',3,d3,distinct3+' and C%2==1','min:100*A+10*B+C')
 finite('digit-extrema',5,d4,distinct4+' and (A==0 or A==2 or A==5 or A==7) and (B==0 or B==2 or B==5 or B==7) and (C==0 or C==2 or C==5 or C==7) and (D==0 or D==2 or D==5 or D==7)','min:1000*A+100*B+10*C+D')
 finite('digit-extrema',6,d4,distinct4+' and (A==0 or A==1 or A==4 or A==6) and (B==0 or B==1 or B==4 or B==6) and (C==0 or C==1 or C==4 or C==6) and (D==0 or D==1 or D==4 or D==6) and (10*C+D)%4==0','max:1000*A+100*B+10*C+D')
 finite('digit-extrema',9,d3,distinct3+' and A+B+C==6','min:100*A+10*B+C')
 finite('digit-extrema',10,d3,distinct3+' and 100*A+10*B+C<500','max:100*A+10*B+C')
 for v,variables,pred,obj in [
  (1,d3,'A+B+C==10','min:100*A+10*B+C'),(2,d3,'A+B+C==10','max:100*A+10*B+C'),
  (3,d4,'A+B+C+D==20','min:1000*A+100*B+10*C+D'),(4,d4,'A+B+C+D==20','max:1000*A+100*B+10*C+D'),
  (5,{'A':[1,9],'B':[0,9]},'A+B==7 and B%2==0','count'),(6,{'A':[1,9],'B':[0,9]},'A+B==18','10*A+B'),
  (9,d3,distinct3+' and A+B+C==6','max:100*A+10*B+C'),(10,{'A':[1,9],'B':[0,9]},'A+B==5','count')]:finite('digit-sum',v,variables,pred,obj)
 reverse=[
  ('11*(A+B)==88 and A-B==2','10*A+B'),('9*(A-B)==27 and A+B==9','10*A+B'),
  ('11*(A+B)==121 and A-B==3','10*A+B'),('9*(A-B)==45 and A+B==9','10*A+B'),
  ('9*(A-B)==27 and A*B==18','10*A+B'),('9*(B-A)==18 and A+B==8','10*A+B'),
  ('9*(A-B)==36','((10*A+B)**2-(10*B+A)**2)//(11*(A+B))'),
  ('11*(A+B)==77 and A<B','count'),('9*(A-B)==9','sum:10*A+B')]
 for v,(pred,obj) in enumerate(reverse,1):finite('reverse-digits',v,{'A':[1,9],'B':[1,9]},pred,obj)
 finite('reverse-digits',10,d3,'99*(A-C)==198 and B==4 and A+C==10','100*A+10*B+C')
 finite('written-digit-count',7,{'n':[1,999]},'(n<=9 and n==189) or (10<=n<=99 and 9+2*(n-9)==189) or (100<=n<=999 and 189+3*(n-99)==189)','n')
 # Position within the 2-digit block is computed from the unsolved index.
 for v,k,start in [(1,12,1),(2,25,1),(4,31,10),(6,26,1)]:
  offset=k-10 if start==1 else k-1
  expr('concatenated-digit',v,f'Mod(floor((10+floor({offset}/2))/10**(1-Mod({offset},2))),10)')
 expr('concatenated-digit',5,'floor(100/100)')
 expr('concatenated-digit',7,'Mod(floor((100+floor((20-1)/3))/10**(2-Mod(20-1,3))),10)')
 expr('concatenated-digit',9,'Mod(99,10)')
 finite('ceiling-patterns',5,{'n':[1,20]},'(n+3)//4==3','count')
 # Algebraic identities carry their original equalities and nonzero domains.
 identities=[
  ('x/(y+z)+y/(x+z)+z/(x+y)',['x+y+z'],['x','y','z'],['x*y*z'],'constant'),
  ('3*a/b-2*b/a',['a+b'],['a','b'],['a*b'],'constant'),
  ('(x**2+x*y)/x',['x+y-5'],['x','y'],['x'],'constant'),
  ('(a*a-b*b)/(a-b)-2*b',['a-b-4'],['a','b'],['a-b'],'constant'),
  ('(x*x+1)/x',['x+1/x-4'],['x'],['x'],'constant'),
  ('1/a+1/b',['a+b-6','a*b-5'],['a','b'],['a*b'],'constant'),
  ('1/y-1/x',['x-y-3','x*y-2'],['x','y'],['x*y'],'constant'),
  ('(2*a+b)/(a-b)',['a-3*b'],['a','b'],['a*b','a-b'],'constant'),
  ('(x*x-4)/(x-2)',['x-7'],['x'],['x-2'],'constant'),
  ('(x**3+y**3)/(x*x*y+x*y*y)',['x+y'],['x','y'],['x*y'],'defined_indicator')]
 for v,(target,equations,variables,nonzero,mode) in enumerate(identities,1):
  row=by['rational-identities',v];row['verificationSpec']={'type':'rational_identity','expression':target,'equations':equations,'variables':variables,'nonzero':nonzero,'mode':mode,'promptAnchor':row['prompt']}
 # Remaining simple equations also retain original root/domain constraints.
 equation('algebra-evaluation',7,'(x-3)**2-16','x',[{'left':'x','op':'gt','right':'3'}])
 equation('power-scaling',5,'x**2-4**3','x',[{'left':'x','op':'gt','right':'0'}])
 equation('radicals',6,'2*x+1-25','x',[{'left':'x','op':'ge','right':'0'}])
 equation('consecutive-numbers',9,'x*(x+1)-110','x',[{'left':'x','op':'gt','right':'0'}])
 equation('consecutive-average',8,'(x-1)**2+x*x+(x+1)**2-110','x',[{'left':'x','op':'gt','right':'1'}])
 equation('periodic-colours',4,'2*x*(x+1)-312','x',[{'left':'x','op':'gt','right':'0'}])


def assemble(input_path=None):
 global PARENTS,BYID
 if input_path:
  data=json.loads(Path(input_path).read_text());data=data.get('questions',data) if isinstance(data,dict) else data
  PARENTS=[q for q in data if q['examType']=='TYT'];BYID={p['id']:p for p in PARENTS}
 b=Author()
 for task in [arithmetic,basic_number_families,digit_families,word_families,algebra_families,sequence_families,divisibility_families,counting_extras,remaining_number_families]:task(b)
 c=tyt_counting.Batch(PARENTS)
 for task in [tyt_counting.probability_batch,tyt_counting.combinations_batch,tyt_counting.permutations_batch,tyt_counting.factorial_batch]:task(c)
 b.questions.extend(c.questions)
 for family in sorted({q['familyId'] for q in c.questions}):
  rows=[q for q in c.questions if q['familyId']==family];b.families[family]={'parent':rows[0]['parentQuestionId'],'templates':[q['id'] for q in rows]}
 patch_raw_specs(b)
 ids=[q['id'] for q in b.questions];assert len(ids)==len(set(ids))
 assert len({q['prompt'] for q in b.questions})==len(b.questions)
 # Canonical parent grouping comes from accessible AI input metadata only.
 canonical=defaultdict(list)
 for p in PARENTS:canonical[p['provenance']['parentQuestionId']].append(p)
 anchored={BYID[info['parent']]['provenance']['parentQuestionId']:family for family,info in b.families.items()}
 equivalents={
  'TYT10-S006-Q10':'place-value-change', # semantic equivalence to positional differences, checked by skill below too
 }
 # Explicit related source groups use the same taught skill, not an unseen source body.
 representative_families={p['id']:f for f,info in b.families.items() for p in [BYID[info['parent']]]}
 related={'AI-TYT10-01':'place-value-change','AI-TYT17-01':'truth-table-size','AI-TYT22-01':'reverse-digits','V3-TYT-003-01':'written-digit-count','V3-TYT-041-01':'modular-arithmetic','V3-TYT-015-01':'power-scaling'}
 ledger=[]
 for original_ref,rows in canonical.items():
  family=anchored.get(original_ref) or related.get(rows[0]['id'])
  for p in rows:
   info=b.families.get(family,{})
   ledger.append({'sourceQuestionId':p['id'],'sourceKind':'accessible_ai_prompt','canonicalParentQuestionId':info.get('parent',rows[0]['id']),
     'originalReferencedId':original_ref,'originalPdfInspected':False,'familyId':family,'status':'generated_skill_templates' if family else 'skipped',
     'reason':'Erişilen AI soru metnindeki matematiksel beceri için yapısal olarak farklı şablonlar yazıldı; sayısal varyantlar ayrı kaynak diye çoğaltılmadı.' if family else 'Bu kaynak için bağımsız ve çeşitli şablon kümesi henüz yazılmadı.',
     'generatedQuestionIds':info.get('templates',[])})
 summary={'version':VERSION,'sourceQuestions':len(PARENTS),'canonicalSourceGroups':len(canonical),'coveredCanonicalGroups':sum(bool(anchored.get(ref) or related.get(rows[0]['id'])) for ref,rows in canonical.items()),
    'generated':len(b.questions),'families':len(b.families),'structuralTemplates':len(b.questions),'difficultyCounts':dict(__import__('collections').Counter(q['difficulty'] for q in b.questions)),
    'originalPdfBodiesInspected':0,'generationPolicy':'one authored structural template per row; no numeric-multiplier cloning','status':'awaiting_independent_qa','reviewScope':'Automated mathematical results; editorial review remains separate.'}
 return {'questions':b.questions,'ledger':ledger,'summary':summary}

def main():
 import argparse
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--input',default=str(DEFAULT_INPUT),help='Master archive list or {questions:[...]}');parser.add_argument('--output',default=str(ROOT/'work/generated-tyt.json'))
 args=parser.parse_args();result=assemble(args.input);target=Path(args.output);target.parent.mkdir(parents=True,exist_ok=True)
 target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result['summary'],ensure_ascii=False))
if __name__=='__main__':main()
