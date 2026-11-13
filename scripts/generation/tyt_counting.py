"""Deterministic, source-anchored TYT counting/statistics authoring batch.

No original publisher question is read here. Only accessible AI parent IDs from
this task's uploaded JSON are anchors. Every emitted result is recalculated by
an independent finite enumeration or exact-integer operation.
"""
from __future__ import annotations
from collections import Counter
from fractions import Fraction
from itertools import combinations, permutations, product
from math import comb, factorial, gcd
import hashlib
import json
from pathlib import Path

VERSION = 'tyt-counting-v1'


def text_number(x):
    q = Fraction(x)
    return str(q.numerator) if q.denominator == 1 else f'{q.numerator}/{q.denominator}'


def five_options(value, identifier):
    value = Fraction(value)
    if 0 < value < 1:
        candidates = [1-value, value/2, value*2, value+Fraction(1,10), value-Fraction(1,10)]
        candidates += [Fraction(i,j) for j in range(2,19) for i in range(0,j+1)]
        candidates = [x for x in candidates if 0 <= x <= 1]
    else:
        candidates = [value+d for d in [-2,-1,1,2,3,4,5,6]]
        candidates += [value*2, value/2, Fraction(0)]
        if value >= 0:
            candidates = [x for x in candidates if x >= 0]
    seen = {value}; alternatives=[]
    for x in candidates:
        x=Fraction(x)
        if x not in seen:
            seen.add(x);alternatives.append(x)
        if len(alternatives)==4:break
    assert len(alternatives)==4
    position=int(hashlib.sha256(identifier.encode()).hexdigest()[:8],16)%5
    choices=alternatives[:];choices.insert(position,value)
    assert len(set(choices))==5 and choices.count(value)==1
    return [{'id':chr(65+i),'text':text_number(x)} for i,x in enumerate(choices)],chr(65+position)


class Batch:
    def __init__(self, parents):
        self.parents={p['id']:p for p in parents};self.questions=[];self.ledger=[]
    def emit(self, parent_id, family, variant, prompt, answer, independent, explanation, params, method, difficulty=None):
        assert parent_id in self.parents, parent_id
        answer,independent=Fraction(answer),Fraction(independent)
        if answer!=independent:raise AssertionError((family,variant,answer,independent))
        p=self.parents[parent_id];identifier=f'AI-NEW-TYT-C-{family.upper()}-{variant:02d}'
        options,letter=five_options(answer,identifier)
        difficulty=difficulty or ('easy' if variant<=4 else 'medium' if variant<=10 else 'hard')
        steps=list(explanation)+[f'Sonuç {text_number(answer)} olur.']
        row={'id':identifier,'examType':'TYT','courseId':p['courseId'],'topic':p['topic'],'subtopic':family,
             'difficulty':difficulty,'difficultyReason':{'easy':'Tek temel sayma/ortalama kuralı ve doğrudan işlem.','medium':'Birden fazla koşulu veya ters yönde bir bağıntıyı birlikte kullanma.','hard':'Daraltılmış örnek uzay, tamamlayıcı durum veya çok aşamalı kısıt analizi.'}[difficulty],
             'prompt':prompt,'options':options,'answer':{'value':letter,'computedValue':text_number(answer),'solution':'\n'.join(steps)},
             'solutionSteps':steps,'origin':'AI_URETIMI','pool':'generated','parentQuestionId':parent_id,
             'familyId':family,'templateId':f'{family}-{variant:02d}','parameters':params,'verificationSpec':{'type':'counting','family':family,'parameters':params,'promptAnchor':prompt},
             'verification':{'mathPassed':True,'status':'automated_verified','validator':VERSION,
                'methods':['Kapalı bağıntı / doğrudan matematiksel çözüm',method],
                'computedValue':text_number(independent),'scope':'exact_result_and_five_options',
                'checks':{'independentResultMatches':True,'fiveOptions':True,'uniqueEquivalentOptions':True,'singleCorrectOption':True},
                'editorialStatus':'pending'},'publicationStatus':'ready_for_review'}
        assert sum(Fraction(o['text'])==answer for o in options)==1
        self.questions.append(row)
    def coverage(self, parent_id, topics, family):
        ids=[p['id'] for p in self.parents.values() if p['topic'] in topics]
        self.ledger.append({'familyId':family,'representativeParentQuestionId':parent_id,'accessibleEquivalentParents':ids,
                            'basis':'Accessible AI prompts share this mathematical skill; original referenced PDF was not inspected.',
                            'generatedIds':[q['id'] for q in self.questions if q['familyId']==family]})


def probability_batch(b):
    pid='V3-TYT-028-01';family='probability';r,blue,g=5,4,3
    bag=['R']*r+['B']*blue
    def chance(draw,predicate,replace=False,condition=lambda xs:True,items=bag):
        events=product(range(len(items)),repeat=draw) if replace else permutations(range(len(items)),draw)
        good=total=0
        for indices in events:
            colors=tuple(items[i] for i in indices)
            if condition(colors):total+=1;good+=bool(predicate(colors))
        assert total
        return Fraction(good,total)
    def emit(v,p,a,check,steps,params):b.emit(pid,family,v,p,a,check,steps,params,'Etiketli fiziksel nesnelerin sıralı çekilişlerini tek tek sayma')
    emit(1,'Bir kutuda 5 kırmızı ve 4 mavi rozet vardır. Geri koymadan iki rozet seçiliyor. İkisinin de kırmızı olma olasılığı nedir?',Fraction(comb(r,2),comb(9,2)),chance(2,lambda x:x.count('R')==2),['Sırasız tüm ikili seçim sayısı C(9,2)=36’dır.','İstenen kırmızı ikililer C(5,2)=10 tanedir; olasılık 10/36’dır.'],{'red':r,'blue':blue,'draw':2,'event':'all_red'})
    emit(2,'5 kırmızı ve 4 mavi taş arasından geri koymadan iki taş çekiliyor. Taşların farklı renkli olma olasılığı kaçtır?',Fraction(r*blue,comb(9,2)),chance(2,lambda x:len(set(x))==2),['Bir kırmızı ve bir mavi, 5·4=20 farklı sırasız ikili oluşturur.','Tüm ikililer 36 tanedir; istenen olasılık 20/36’dır.'],{'red':r,'blue':blue,'draw':2,'event':'mixed'})
    emit(3,'5 kırmızı ve 4 mavi kalem arasından rastgele üç kalem seçiliyor. Tam ikisinin kırmızı olma olasılığı nedir?',Fraction(comb(r,2)*blue,comb(9,3)),chance(3,lambda x:x.count('R')==2),['İki kırmızı C(5,2), bir mavi C(4,1) yolla seçilir.','Toplam C(9,3)=84 seçim vardır; 40/84 bulunur.'],{'red':r,'blue':blue,'draw':3,'event':'exactly_two_red'})
    emit(4,'5 kırmızı ve 4 mavi bilyeden geri koymadan üçü alınıyor. En az bir kırmızı bilye gelme olasılığı kaçtır?',1-Fraction(comb(blue,3),comb(9,3)),chance(3,lambda x:'R' in x),['İstenen durumun tersi, üç bilyenin de mavi olmasıdır.','Ters olayın olasılığı C(4,3)/C(9,3)=4/84’tür; 1’den çıkarılır.'],{'red':r,'blue':blue,'draw':3,'event':'at_least_one_red'})
    emit(5,'Bir kesede 5 kırmızı ve 4 mavi boncuk bulunuyor. Rastgele seçilen üç boncuğun tek renk olma olasılığı kaçtır?',Fraction(comb(r,3)+comb(blue,3),comb(9,3)),chance(3,lambda x:len(set(x))==1),['Üç kırmızı veya üç mavi seçilebilir; bu olaylar ayrıdır.','Uygun seçim sayısı C(5,3)+C(4,3)=14, tüm seçim sayısı 84’tür.'],{'red':r,'blue':blue,'draw':3,'event':'same_color'})
    emit(6,'5 kırmızı ve 4 mavi bilyeden geri koymadan sırayla iki bilye çekiliyor. İlk bilyenin rengine bakılmaksızın ikinci çekilen bilyenin kırmızı olma olasılığı nedir?',Fraction(5,9),chance(2,lambda x:x[1]=='R'),['Etiketli her fiziksel bilye ikinci sırada eşit olasılıkla bulunur.','Dokuz bilyenin beşi kırmızı olduğundan olasılık5/9’dur.'],{'red':5,'blue':4,'draw':2,'event':'second_red'})
    emit(7,'5 kırmızı ve 4 mavi jetondan bir jeton çekilip geri konuyor, sonra yeniden çekiliyor. İkisinin de kırmızı olma olasılığı nedir?',Fraction(5,9)**2,chance(2,lambda x:x.count('R')==2,True),['Geri koyma nedeniyle her çekilişte kırmızı olasılığı 5/9’dur.','Bağımsız iki olasılık çarpılır.'],{'red':r,'blue':blue,'draw':2,'replace':True,'event':'all_red'})
    emit(8,'5 kırmızı ve 4 mavi karttan bir kart çekilip yerine konarak iki çekiliş yapılıyor. İki çekilişin renklerinin farklı olma olasılığı kaçtır?',Fraction(2*5*4,9**2),chance(2,lambda x:len(set(x))==2,True),['Kırmızı-mavi ve mavi-kırmızı sıralamaları ayrıdır.','Her biri (5/9)(4/9) olasılıklıdır; iki sonuç toplanır.'],{'red':r,'blue':blue,'draw':2,'replace':True,'event':'mixed'})
    items=['R']*5+['B']*4+['G']*3
    emit(9,'Bir torbada 5 kırmızı, 4 mavi ve 3 yeşil taş vardır. Geri koymadan seçilen üç taşın her birinin farklı renkli olma olasılığı nedir?',Fraction(5*4*3,comb(12,3)),chance(3,lambda x:len(set(x))==3,items=items),['Her renkten bir taş seçmek 5·4·3=60 yolla mümkündür.','Tüm üçlüler C(12,3)=220 tanedir.'],{'red':5,'blue':4,'green':3,'draw':3,'event':'one_each'})
    emit(10,'5 kırmızı, 4 mavi ve 3 yeşil top arasından üç top rastgele seçiliyor. Hiç mavi top seçilmeme olasılığı kaçtır?',Fraction(comb(8,3),comb(12,3)),chance(3,lambda x:'B' not in x,items=items),['Mavi olmayan 5+3=8 top vardır.','Uygun üçlüler C(8,3)=56, tüm üçlüler 220 tanedir.'],{'red':5,'blue':4,'green':3,'draw':3,'event':'no_blue'})
    emit(11,'5 kırmızı ve 4 mavi bilyeden iki bilye seçiliyor. En az birinin kırmızı olma olasılığı nedir?',1-Fraction(comb(4,2),comb(9,2)),chance(2,lambda x:'R' in x),['Ters olay iki bilyenin de mavi olmasıdır.','Toplam36 ikiliden6’sı iki mavidir; istenen30/36 olur.'],{'red':5,'blue':4,'draw':2,'event':'at_least_one_red'})
    items2=['R']*4+['B']*3+['G']*2
    emit(12,'4 kırmızı, 3 mavi ve 2 yeşil kart arasından iki kart seçiliyor. Seçilenlerin aynı renk olma olasılığı nedir?',Fraction(comb(4,2)+comb(3,2)+comb(2,2),comb(9,2)),chance(2,lambda x:len(set(x))==1,items=items2),['Aynı renkte ikili sayısı C(4,2)+C(3,2)+C(2,2)=10’dur.','Dokuz karttan toplam C(9,2)=36 ikili seçilir.'],{'red':4,'blue':3,'green':2,'draw':2,'event':'same_color'})
    a=['R']*3+['B']*2;c=['R']*2+['B']*4;good=total=0
    for color in a:
        for drawn in c+[color]:total+=1;good+=drawn=='R'
    emit(13,'A kutusunda 3 kırmızı ve 2 mavi; B kutusunda 2 kırmızı ve 4 mavi top vardır. A’dan rastgele bir top B’ye aktarılıyor. Ardından B’den rastgele çekilen bir topun kırmızı olma olasılığı nedir?',Fraction(3,5)*Fraction(3,7)+Fraction(2,5)*Fraction(2,7),Fraction(good,total),['Aktarılan top kırmızıysa B’de kırmızı çekme olasılığı 3/7, maviyse 2/7 olur.','Toplam olasılık (3/5)(3/7)+(2/5)(2/7) olarak bulunur.'],{'bagA':[3,2],'bagB':[2,4],'event':'transfer_then_red'})
    outcomes=list(product(range(1,7),repeat=2));count=sum((x+y)%3==0 for x,y in outcomes)
    emit(14,'Adil iki altı yüzlü zar birlikte atılıyor. Üstteki sayıların toplamının 3’ün katı olma olasılığı nedir?',Fraction(1,3),Fraction(count,len(outcomes)),['Her zarın kalan sınıfları 0, 1, 2 için ikişer yüzü vardır.','Toplamın kalanı sıfır için kalan çiftleri (0,0), (1,2), (2,1) olur: 3·4=12 sonuç.'],{'faces':6,'dice':2,'event':'sum_multiple_three'})
    emit(15,'5 kız ve 4 erkek arasından rastgele üç kişilik ekip seçiliyor. Ekibin en az iki kız içermesi olasılığı nedir?',Fraction(comb(5,2)*4+comb(5,3),comb(9,3)),chance(3,lambda x:x.count('R')>=2),['İki kız-bir erkek veya üç kız seçilir: C(5,2)·4+C(5,3)=50.','Tüm üç kişilik ekipler C(9,3)=84 tanedir; olasılık50/84’tür.'],{'girls':5,'boys':4,'team':3,'event':'at_least_two_girls'})
    b.coverage(pid,['Olasılık'],family)


def combinations_batch(b):
    pid='V3-TYT-029-01';family='combinations'
    def add(v,p,a,check,steps,params):b.emit(pid,family,v,p,a,check,steps,params,'Farklı elemanlardan oluşan alt kümeleri tek tek listeleme')
    def subsets(n,k,pred=lambda x:True):return sum(bool(pred(x)) for x in combinations(range(n),k))
    add(1,'Bir atölyedeki 9 öğrenciden sıralama gözetilmeden 3 kişilik ekip kaç farklı biçimde seçilebilir?',comb(9,3),subsets(9,3),['Ekipte görev veya sıra ayrımı yoktur.','C(9,3)=9·8·7/(3·2·1) uygulanır.'],{'n':9,'k':3,'constraint':'none'})
    add(2,'10 kişiden 4 kişilik kurul seçilecek. Belirli iki kişinin kurulda bulunması zorunluysa kaç farklı kurul seçilebilir?',comb(8,2),subsets(10,4,lambda x:0 in x and 1 in x),['Zorunlu iki kişi ayrılınca kalan 8 kişiden 2 kişi seçilir.','Sıra gözetilmediği için C(8,2) kullanılır.'],{'n':10,'k':4,'mandatory':[0,1]})
    add(3,'10 adaydan 3 kişilik jüri seçilecek. İki aday katılamadığına göre kaç jüri kurulabilir?',comb(8,3),subsets(10,3,lambda x:0 not in x and 1 not in x),['Katılamayan iki aday çıkarılınca 8 aday kalır.','Üç kişilik seçim sayısı C(8,3)’tür.'],{'n':10,'k':3,'excluded':[0,1]})
    add(4,'5 kız ve 4 erkek öğrenci arasından tam 2 kız ve 1 erkek içeren kaç farklı ekip seçilir?',comb(5,2)*4,subsets(9,3,lambda x:sum(i<5 for i in x)==2),['İki kız C(5,2), bir erkek C(4,1) yolla seçilir.','Bağımsız seçim sayıları çarpılır.'],{'girls':5,'boys':4,'team':3,'girlsRequired':2})
    add(5,'9 öğrenciden 3 kişilik ekip seçiliyor. Belirli iki öğrenciden en az birini içeren kaç ekip vardır?',comb(9,3)-comb(7,3),subsets(9,3,lambda x:0 in x or 1 in x),['Tüm ekiplerden belirli iki öğrenciyi de içermeyenler çıkarılır.','C(9,3)−C(7,3) hesaplanır.'],{'n':9,'k':3,'atLeastOne':[0,1]})
    add(6,'9 kişiden üç kişilik kurul seçilecek. İki kardeş aynı kurulda bulunamayacaksa kaç seçim mümkündür?',comb(9,3)-7,subsets(9,3,lambda x:not(0 in x and 1 in x)),['Tüm C(9,3) kurullar içinden iki kardeşi birlikte içerenler çıkarılır.','İki kardeş sabitken üçüncü kişi 7 yolla seçilir.'],{'n':9,'k':3,'notTogether':[0,1]})
    add(7,'9 kişiden üç kişilik ekip seçiliyor. Ayla ile Bora ya birlikte seçilecek ya da ikisi de seçilmeyecek. Kaç ekip oluşturulur?',7+comb(7,3),subsets(9,3,lambda x:(0 in x)==(1 in x)),['İkisi birlikteyse üçüncü kişi 7 yolla seçilir.','İkisi de dışarıdaysa kalan 7 kişiden 3 kişi seçilir; ayrık durumlar toplanır.'],{'n':9,'k':3,'togetherOrNeither':[0,1]})
    add(8,'5 kız ve 5 erkek arasından kız ve erkek sayısı eşit olan dört kişilik kaç ekip seçilir?',comb(5,2)**2,subsets(10,4,lambda x:sum(i<5 for i in x)==2),['Eşit sayıda olma koşulu iki kız ve iki erkek gerektirir.','C(5,2)·C(5,2) hesaplanır.'],{'girls':5,'boys':5,'team':4,'equalGroups':True})
    check=sum(1 for captain in range(9) for team in combinations([i for i in range(9) if i!=captain],3))
    add(9,'9 kişiden bir başkan ve birbirine eş görevli 3 yardımcı seçiliyor. Kaç farklı görev dağılımı yapılabilir?',9*comb(8,3),check,['Başkan 9 farklı kişi olabilir.','Başkan dışındaki 8 kişiden sırasız 3 yardımcı seçilir.'],{'n':9,'assistants':3,'roles':'one_captain_unordered_helpers'})
    add(10,'1’den 9’a numaralanmış sandalyelerden, hiçbir ikisi yan yana olmayacak biçimde 4 sandalye kaç farklı şekilde seçilir?',comb(6,4),subsets(9,4,lambda x:all(y-x>1 for x,y in zip(x,x[1:]))),['Seçilen a₁<a₂<a₃<a₄ için araya en az bir boşluk gerekir.','bᵢ=aᵢ−(i−1) dönüşümüyle 1–6 arasından 4 farklı sayı seçilir: C(6,4).'],{'positions':9,'choose':4,'nonAdjacent':True})
    add(11,'1,2,…,8 sayılarından toplamı çift olacak şekilde üç farklı sayı kaç biçimde seçilebilir?',comb(4,3)+comb(4,2)*4,subsets(8,3,lambda x:sum(i+1 for i in x)%2==0),['Toplam çiftse seçilen tek sayı adedi 0 veya 2’dir.','Üç çift için C(4,3), iki tek-bir çift için C(4,2)·4 seçim vardır.'],{'values':list(range(1,9)),'choose':3,'sumParity':'even'})
    add(12,'9 adayın 4’ü mühendis, 5’i tasarımcıdır. En az iki mühendis içeren üç kişilik kaç kurul seçilebilir?',comb(4,2)*5+comb(4,3),subsets(9,3,lambda x:sum(i<4 for i in x)>=2),['İki mühendis-bir tasarımcı veya üç mühendis durumları vardır.','C(4,2)·5+C(4,3) bulunur.'],{'engineers':4,'designers':5,'choose':3,'minEngineers':2})
    add(13,'8 öğrenci, adı veya sırası olmayan dörder kişilik iki gruba ayrılacak. Kaç farklı ayrılma vardır?',comb(8,4)//2,subsets(8,4,lambda x:0 in x),['İlk dörtlü C(8,4) yolla seçilince öbür dörtlü belirlenir.','Grupların adı olmadığından her ayrılma iki kez sayılmıştır; 2’ye bölünür.'],{'n':8,'groupSize':4,'unlabelledGroups':2})
    paths=list(product('RU',repeat=5));check=sum(seq.count('R')==3 for seq in paths)
    add(14,'Bir robot hedefe ulaşmak için 3 kez sağa, 2 kez yukarı gitmelidir. Adımlar farklı sıralarla atılabiliyorsa kaç en kısa yol vardır?',comb(5,2),check,['Beş adımın ikisinin yeri yukarı hareketi için seçilir.','Kalan üç adım sağa olur; C(5,2) farklı yol bulunur.'],{'right':3,'up':2,'shortestOnly':True})
    add(15,'1’den 10’a kadar sayılardan seçilen üç farklı sayının en büyüğü 8 olacak. Kaç farklı üçlü seçilebilir?',comb(7,2),subsets(10,3,lambda x:max(x)==7),['En büyük sayı 8 olduğundan 8 seçilmek zorundadır.','Diğer iki sayı 1–7 arasından C(7,2) yolla seçilir.'],{'n':10,'choose':3,'maximum':8})
    b.coverage(pid,['Kombinasyon'],family)


def permutations_batch(b):
    pid='V3-TYT-043-01';family='permutations'
    def add(v,p,a,check,steps,params):b.emit(pid,family,v,p,a,check,steps,params,'Etiketli dizilişleri / izin verilen şifreleri tek tek üretme')
    add(1,'8 farklı yarışmacı arasından altın, gümüş ve bronz madalya kaç farklı biçimde verilebilir?',8*7*6,sum(1 for _ in permutations(range(8),3)),['Madalyalar farklı görevlerdir; sıralama önemlidir.','Altın için 8, gümüş için 7, bronz için 6 seçenek vardır.'],{'n':8,'positions':3})
    add(2,'7 farklı kitap boş bir rafta kaç farklı sırayla dizilebilir?',factorial(7),sum(1 for _ in permutations(range(7))),['İlk yerden son yere seçenek sayıları 7,6,…,1’dir.','Çarpım 7! olur.'],{'books':7,'positions':7})
    add(3,'6 farklı kitap arasında A ile B’nin yan yana durması isteniyor. Kaç farklı sıra oluşturulur?',2*factorial(5),sum(abs(x.index(0)-x.index(1))==1 for x in permutations(range(6))),['A ve B tek blok sayılınca 5 nesne sıralanır.','Blok kendi içinde AB veya BA olabilir; 2·5! hesaplanır.'],{'n':6,'adjacent':[0,1]})
    add(4,'6 farklı kitabın A ve B adlı ikisi yan yana gelmeyecek. Kaç farklı rafta diziliş mümkündür?',factorial(6)-2*factorial(5),sum(abs(x.index(0)-x.index(1))!=1 for x in permutations(range(6))),['Tüm 6! dizilişten A ve B’nin yan yana olduğu 2·5! diziliş çıkarılır.'],{'n':6,'notAdjacent':[0,1]})
    add(5,'A ve B dâhil 5 farklı kişi bir sıraya diziliyor. A’nın B’nin solunda olduğu kaç diziliş vardır?',factorial(5)//2,sum(x.index(0)<x.index(1) for x in permutations(range(5))),['Her diziliş A ile B yer değiştirerek karşıt koşullu bir dizilişle eşleşir.','Dolayısıyla 5! dizilişin yarısı uygundur.'],{'n':5,'leftOf':[0,1]})
    digits=range(6);check=sum(x[0]!=0 for x in permutations(digits,3))
    add(6,'0,1,2,3,4,5 rakamlarıyla rakamları farklı kaç üç basamaklı doğal sayı yazılır?',5*5*4,check,['Yüzler basamağı sıfır olamaz: 5 seçenek vardır.','Kalan basamaklara sırayla 5 ve 4 seçenek kalır.'],{'digits':list(digits),'length':3,'repeat':False,'leadingZero':False})
    add(7,'1,2,…,6 sembollerinden dört haneli şifreler kuruluyor. Semboller tekrar edebiliyorsa kaç farklı şifre vardır?',6**4,sum(1 for _ in product(range(1,7),repeat=4)),['Dört konumun her biri bağımsız olarak 6 sembol alabilir.','Çarpma kuralıyla 6⁴ hesaplanır.'],{'digits':list(range(1,7)),'length':4,'repeat':True})
    add(8,'0,1,2,3,4,5 rakamlarıyla rakam tekrarı olmadan, 5 ile bölünebilen kaç üç basamaklı sayı yazılır?',5*4+4*4,sum(x[0]!=0 and x[-1] in (0,5) for x in permutations(range(6),3)),['Son basamak 0 ise ilk iki basamak 5·4 yolla seçilir.','Son basamak 5 ise yüzler için 4, onlar için 4 seçenek vardır; durumlar toplanır.'],{'digits':list(range(6)),'length':3,'divisibleBy':5,'repeat':False})
    add(9,'ANANAS kelimesinin bütün harfleri kullanılarak anlamlı veya anlamsız kaç farklı diziliş yapılabilir?',factorial(6)//(factorial(3)*factorial(2)),len(set(permutations('ANANAS'))),['Altı harfin 3’ü A, 2’si N’dir.','Aynı harflerin yer değiştirmesi yeni diziliş üretmez; 6!/(3!·2!) hesaplanır.'],{'letters':'ANANAS','allUsed':True})
    add(10,'Birbirinden farklı 4 kız ve 3 erkek, yan yana aynı cinsiyetten iki kişi gelmeyecek biçimde sıraya diziliyor. Kaç diziliş olur?',factorial(4)*factorial(3),sum(all((x[i]<4)!=(x[i+1]<4) for i in range(6)) for x in permutations(range(7))),['Dört kız bulunduğundan düzen K-E-K-E-K-E-K olmak zorundadır.','Kızlar 4!, erkekler 3! yolla kendi yerlerine yerleşir.'],{'girls':4,'boys':3,'alternating':True})
    add(11,'6 farklı kişi yuvarlak bir masaya oturacak. Yalnız dönmeyle aynı olan oturmalar bir kabul edilirse kaç düzen vardır?',factorial(5),sum(1 for _ in permutations(range(1,6))),['Dönme eşitliğini kaldırmak için bir kişi sabitlenir.','Kalan 5 kişi 5! yolla sıralanır; yansımalar ayrı sayılır.'],{'people':6,'rotationEquivalent':True,'reflectionEquivalent':False})
    circles=[(0,)+x for x in permutations(range(1,7))];check=sum((x.index(1)-x.index(0))%7 not in(1,6) for x in circles)
    add(12,'7 farklı kişi yuvarlak masaya oturuyor. A ve B komşu olmayacak; dönmeyle aynı düzenler bir kabul edilecek. Kaç oturma vardır?',factorial(6)-2*factorial(5),check,['Tüm dairesel düzenler 6! tanedir.','A-B blok kabul edilirse yan yana olanlar 2·5! tanedir; bunlar çıkarılır.'],{'people':7,'rotationEquivalent':True,'notAdjacent':[0,1]})
    add(13,'A ve B dâhil 6 farklı kitap diziliyor. A ile B arasında tam iki kitap bulunacaksa kaç farklı diziliş olur?',3*2*factorial(4),sum(abs(x.index(0)-x.index(1))==3 for x in permutations(range(6))),['A ve B’nin konum çiftleri (1,4),(2,5),(3,6) olabilir.','Üç konum çifti, iki A-B sırası ve kalan kitaplar için 4! çarpılır.'],{'books':6,'betweenPair':[0,1],'betweenCount':2})
    add(14,'5 yarışmacının ilk üçe sıralaması belirlenecek. Belirli bir yarışmacının ilk üçte olduğu kaç farklı sonuç vardır?',5*4*3-4*3*2,sum(0 in x for x in permutations(range(5),3)),['Tüm sıralamalar P(5,3), belirli yarışmacının olmadığı sıralamalar P(4,3)’tür.','Farkları alınır.'],{'contestants':5,'top':3,'mandatory':0})
    seq=(3,1,5,2,4);ordered=sorted(permutations(range(1,6)));rank=ordered.index(seq)+1
    add(15,'1,2,3,4,5 rakamları birer kez kullanılarak oluşturulan beş basamaklı sayılar küçükten büyüğe diziliyor. 31524 kaçıncı sıradadır?',2*factorial(4)+2*factorial(2)+1,rank,['3’ten küçük ilk rakamlar 1 ve 2 için 2·4!=48 sayı vardır.','31 ile başlayanlarda üçüncü rakamı 5’ten küçük 2 veya 4 seçilen 2·2!=4 sayı daha vardır.','31524’ten önce toplam 52 sayı vardır; sıra 53’tür.'],{'digits':[1,2,3,4,5],'target':list(seq),'order':'lexicographic'})
    b.coverage(pid,['Permütasyon'],family)


def valuation(n,p):
    result=0
    while n:
        n//=p;result+=n
    return result


def actual_v(n,p):
    result=0
    while n and n%p==0:n//=p;result+=1
    return result


def zeros(n):return len(str(n))-len(str(n).rstrip('0'))


def factorial_batch(b):
    pid='V3-TYT-040-01';family='factorial';
    def add(v,p,a,number,steps,params,prime=10):
        check=zeros(number) if prime==10 else actual_v(number,prime)
        b.emit(pid,family,v,p,a,check,steps,params,'Tam sayıyı ayrı yoldan oluşturup ondalık sondaki sıfırları / asal kuvveti bölerek sayma')
    add(1,'75! sayısının ondalık yazımının sonunda kaç sıfır vardır?',valuation(75,5),factorial(75),['Her sıfır için 2 ve 5 çarpanı gerekir; 5 çarpanı daha azdır.','⌊75/5⌋+⌊75/25⌋=15+3 hesaplanır.'],{'factorials':[[75,1]],'base':10})
    add(2,'100!/50! tam sayısının sonunda kaç sıfır bulunur?',valuation(100,5)-valuation(50,5),factorial(100)//factorial(50),['Bölümde 51’den 100’e kadar olan çarpanlar kalır.','5 çarpanları için (20+4)−(10+2) hesaplanır.'],{'factorials':[[100,1],[50,-1]],'base':10})
    prod=1
    for n in range(31,76):prod*=n
    add(3,'31·32·33·…·75 çarpımının sonunda kaç sıfır vardır?',valuation(75,5)-valuation(30,5),prod,['Çarpım 75!/30! biçimindedir.','5 çarpanı sayısı (15+3)−(6+1) olarak bulunur.'],{'productRange':[31,75],'base':10})
    add(4,'12!·25! sayısının sonunda kaç sıfır vardır?',valuation(12,5)+valuation(25,5),factorial(12)*factorial(25),['Çarpımda asal çarpan üsleri toplanır.','5 sayısı 12!’de 2, 25!’de 5+1=6 kez vardır.'],{'factorials':[[12,1],[25,1]],'base':10})
    add(5,'(20!)³ sayısının sonunda kaç sıfır vardır?',3*valuation(20,5),factorial(20)**3,['20! içinde 5 çarpanı ⌊20/5⌋=4 kez bulunur.','Üçüncü kuvvet asal çarpan üslerini üçle çarpar.'],{'factorials':[[20,3]],'base':10})
    target=10;minimum=next(n for n in range(1,100) if zeros(factorial(n))>=target)
    b.emit(pid,family,6,'n! sayısının sonunda en az 10 sıfır bulunmasını sağlayan en küçük pozitif n kaçtır?',45,minimum,['40! ve 44! için 5 çarpanı sayısı 8+1=9’dur.','45! için 9+1=10 olur; bu koşulu ilk sağlayan n=45’tir.'],{'minTrailingZeros':10,'searchRange':[1,99]},'Tam faktöriyellerin ondalık yazımlarını sıralı tarama')
    cnt=sum(zeros(factorial(n))==12 for n in range(1,101))
    b.emit(pid,family,7,'1≤n≤100 olmak üzere n! sayısının sonunda tam 12 sıfır bulunan kaç n tam sayısı vardır?',5,cnt,['50! için 10+2=12 sıfır vardır; 51!,52!,53!,54! için sayı değişmez.','55! yeni bir 5 çarpanı içerdiğinden 13 sıfıra çıkar; yalnız 50–54 uygundur.'],{'exactZeros':12,'nRange':[1,100]},'1–100 faktöriyellerini tam sayı olarak hesaplayıp sondaki sıfırları sayma')
    add(8,'5ᵏ sayısı 80! sayısını bölüyor. k’nin alabileceği en büyük tam sayı değeri kaçtır?',valuation(80,5),factorial(80),['80! içindeki 5 çarpanları sayılır.','⌊80/5⌋+⌊80/25⌋=16+3 bulunur.'],{'factorials':[[80,1]],'prime':5},5)
    num=factorial(60)//(factorial(15)*factorial(30))
    add(9,'60!/(15!·30!) tam sayısının sonunda kaç sıfır vardır?',valuation(60,5)-valuation(15,5)-valuation(30,5),num,['5 çarpanlarının üsleri bölümde çıkarılır.','(12+2)−3−(6+1) hesaplanır; 2 çarpanı sayısı bundan büyüktür.'],{'factorials':[[60,1],[15,-1],[30,-1]],'base':10})
    add(10,'C(100,40)=100!/(40!·60!) tam sayısının sonunda kaç sıfır vardır?',valuation(100,5)-valuation(40,5)-valuation(60,5),comb(100,40),['Binom katsayısı bir tam sayıdır; 5 çarpanı üssü 24−9−14=1’dir.','2 çarpanı üssü en az 1 olduğundan sondaki sıfır sayısı 1’dir.'],{'binomial':[100,40],'base':10})
    add(11,'50!/(25!)² tam sayısının sonunda kaç sıfır vardır?',valuation(50,5)-2*valuation(25,5),comb(50,25),['Paydaki 5 çarpanı üssü 12, paydadaki toplam üs 2·6=12’dir.','Bölümde 5 çarpanı kalmadığı için son basamak sıfır olamaz.'],{'binomial':[50,25],'base':10})
    add(12,'2ᵏ sayısının 15! sayısını bölmesini sağlayan en büyük tam sayı k kaçtır?',valuation(15,2),factorial(15),['2,4,8 katları sırayla sayılır.','⌊15/2⌋+⌊15/4⌋+⌊15/8⌋=7+3+1 hesaplanır.'],{'factorials':[[15,1]],'prime':2},2)
    b.emit(pid,family,13,'90! sayısı, 91·92·…·100 ile çarpılıp 100! elde ediliyor. Sondaki sıfır sayısı kaç artar?',valuation(100,5)-valuation(90,5),zeros(factorial(100))-zeros(factorial(90)),['100! içindeki 5 üssü 24, 90! içindeki 5 üssü 18+3=21’dir.','Yeni çarpanlar üç ek sıfır oluşturur.'],{'fromFactorial':90,'toFactorial':100},'İki ayrı faktöriyel sonucunun sondaki sıfır sayılarını karşılaştırma')
    add(14,'40!·8·125 tam sayısının sonunda kaç sıfır vardır?',valuation(40,5)+3,factorial(40)*8*125,['8·125=1000 olduğundan üç sıfır eklenir.','40! için 8+1=9 sıfır vardır; toplam 12 olur.'],{'factorials':[[40,1]],'extraFactors':[8,125],'base':10})
    z=valuation(80,5);number=factorial(80)//10**z
    add(15,'80! sayısının ondalık yazımının sonundaki sıfırların tamamı siliniyor. Kalan tam sayı en çok kaç kez ardışık olarak 2’ye tam bölünebilir?',valuation(80,2)-valuation(80,5),number,['80! içindeki 2 üssü 40+20+10+5+2+1=78; 5 üssü 19’dur.','19 sıfır silmek 19 tane 10, dolayısıyla 19 tane 2 çarpanını kaldırır.','Kalan 2 üssü 78−19’dur.'],{'stripTrailingZerosOfFactorial':80,'prime':2},2)
    b.coverage(pid,['Faktöriyel'],family)
