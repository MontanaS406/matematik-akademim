#!/usr/bin/env python3
"""Independent AI exercises anchored to read original-source evidence.

Only metadata and abstract skill labels enter this reproducible authoring file.
Original publisher prose, figures and option sets stay in the private bank.
The public evidence file records the actual question/page that was read. This
script cannot create an ORIGINAL_TO_AI record without that checked evidence.
An independent checker, not this authoring module, decides playability.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path
from fractions import Fraction
from collections import Counter
import sympy as s

ROOT = Path(__file__).resolve().parents[2]
VERSION = 'direct-source-structural-v1'
x, y, z, a, b, t, m, n = s.symbols('x y z a b t m n', real=True)

def value_text(value):
    return s.sstr(s.simplify(value))

def exact(value):
    return s.sympify(value, rational=True, locals={'x':x,'y':y,'z':z,'a':a,'b':b,'t':t,'m':m,'n':n})

def display_text(text):
    """Separate numeric data from prose without rewriting mathematics."""
    text=re.sub(r'([A-Za-zÇĞİÖŞÜçğıöşü]{2,})(?=\d)',r'\1 ',text)
    return re.sub(r'(\d)(?=[a-zçğıöşü]{2,})',r'\1 ',text)

def options(value, identifier):
    value = exact(value)
    if 0 < value < 1:
        candidates=[value/2,1-value,2*value,(value+1)/2,s.Rational(1,2),s.Rational(1,3),s.Rational(1,4),s.Rational(2,3),s.Rational(3,4)]
        alternatives=[]
        for candidate in candidates:
            if 0<candidate<1 and candidate!=value and candidate not in alternatives:alternatives.append(candidate)
            if len(alternatives)==4:break
    elif value.is_Integer and value>=0:
        candidates=[value+d for d in (-2,-1,1,2,3,4,5)]
        alternatives=[candidate for candidate in candidates if candidate>=0][:4]
    else:
        alternatives = [value + delta for delta in (-3,-1,1,3)]
    position = int(hashlib.sha256(identifier.encode()).hexdigest()[:8], 16) % 5
    alternatives.insert(position, value)
    assert len({value_text(v) for v in alternatives}) == 5
    return [{'id': chr(65+i), 'text':value_text(v)} for i,v in enumerate(alternatives)], chr(65+position)

class Author:
    def __init__(self, evidence):
        self.parents = {}
        self.questions = []
        self.skipped = []
        for record in evidence:
            if record.get('readStatus') != 'read' or record.get('answerStatus') != 'verified':
                continue
            if record.get('origin') != 'ORIJINAL':
                continue
            for skill in record.get('generationSkills', []):
                if skill in self.parents:
                    raise ValueError('Ambiguous direct-source skill anchor: '+skill)
                self.parents[skill] = record

    def emit(self, skill, slug, prompt, answer, steps, spec, exam='TYT', course='statistics', topic='Veri ve istatistik', subtopic=None, difficulty='medium'):
        parent = self.parents.get(skill)
        if parent is None:
            self.skipped.append({'skill':skill,'template':slug,'reason':'verified_original_read_evidence_missing'})
            return
        if parent.get('examType') not in (None, exam):
            raise ValueError('Source exam classification differs from authored exercise: '+skill)
        identifier = 'AI-SOURCE-'+exam+'-'+slug.upper()
        opts, letter = options(answer, identifier)
        prompt=display_text(prompt)
        steps = [display_text(step) for step in [*steps, 'İstenen sonuç '+value_text(answer)+' olur.']]
        spec = {**spec, 'promptAnchor':prompt}
        source_id = parent['sourceQuestionId']
        provenance = {'derivationKind':'ORIGINAL_TO_AI','sourceQuestionId':source_id,
            'sourceDocumentId':parent['sourceDocumentId'],'physicalPage':parent['physicalPage'],
            'originalPdfPage':parent.get('originalPdfPage'),'sourceQuestionNumber':parent['questionNumber'],
            'sourceReadEvidenceId':parent['id'],'generationSkill':skill}
        self.questions.append({'id':identifier,'examType':exam,'courseId':course,'topic':topic,
            'subtopic':subtopic or skill,'difficulty':difficulty,
            'difficultyReason':{'easy':'Tek bir temel bağıntı ve açık veriyle hesap yapılır.',
                'medium':'Veriyi bir bağıntıya dönüştürüp en az iki işlem yapmak gerekir.',
                'hard':'Birden fazla koşul, ters işlem veya sonlu durum ayrımı birlikte kullanılır.'}[difficulty],
            'prompt':prompt,'options':opts,'answer':{'value':letter,'computedValue':value_text(answer),'solution':'\n'.join(steps)},
            'solutionSteps':steps,'origin':'AI_URETIMI','pool':'generated','derivationKind':'ORIGINAL_TO_AI',
            'parentQuestionId':source_id,'familyId':'source-'+skill,'templateId':slug,
            'provenance':provenance,'verificationSpec':spec,
            'verification':{'status':'pending_review','mathPassed':False,'methods':[],
                'reasons':['independent_generated_check_required'],'editorialStatus':'pending'}})

    def calc(self, skill, slug, prompt, answer, expression, steps, **kw):
        actual = s.simplify(exact(expression).doit())
        assert s.simplify(actual-exact(answer)) == 0, (slug, actual, answer)
        self.emit(skill,slug,prompt,answer,steps,{'type':'exact_expression','expression':expression},**kw)

    def solve(self, skill, slug, prompt, answer, equation, steps, variable='x', conditions=None, **kw):
        var = exact(variable)
        candidates = s.solve(exact(equation),var)
        conditions = conditions or []
        def accepts(candidate):
            for condition in conditions:
                left = exact(condition['left']).subs(var,candidate)
                right = exact(condition['right']).subs(var,candidate)
                op = condition['op']
                if not {'gt':lambda:left>right,'ge':lambda:left>=right,'lt':lambda:left<right,
                    'le':lambda:left<=right,'ne':lambda:left!=right,'eq':lambda:left==right}[op]():return False
            return True
        candidates = [r for r in candidates if r.is_real is not False and accepts(r)]
        assert len(candidates)==1 and s.simplify(candidates[0]-exact(answer))==0,(slug,candidates,answer)
        self.emit(skill,slug,prompt,answer,steps,{'kind':'exact_math','operation':'solve_parameter',
            'expression':equation,'variable':variable,'conditions':conditions},**kw)

    def identity(self, skill, slug, prompt, answer, equations, target, steps, variables=None, nonzero=None, **kw):
        variables = variables or ['x','y']
        symbols = [exact(v) for v in variables]
        branches = s.solve([exact(e) for e in equations],symbols,dict=True)
        results = []
        for branch in branches:
            if any(s.simplify(exact(v).subs(branch))==0 for v in nonzero or []):continue
            result = s.simplify(exact(target).subs(branch,simultaneous=True))
            assert not result.free_symbols,(slug,result)
            results.append(result)
        assert results and all(s.simplify(v-exact(answer))==0 for v in results),(slug,results,answer)
        self.emit(skill,slug,prompt,answer,steps,{'type':'rational_identity','variables':variables,
            'equations':equations,'expression':target,'nonzero':nonzero or []},**kw)

    def finite(self, skill, slug, prompt, answer, variables, predicate, objective, steps, **kw):
        # Construction values are explicitly authored; an independent checker
        # re-enumerates the stated domain and equations before playability.
        self.emit(skill,slug,prompt,answer,steps,{'type':'finite_search','variables':variables,
            'predicate':predicate,'objective':objective},**kw)

def mean_conservation(b):
    k='mean_conservation';common={'subtopic':'Toplamı koruyarak ortalama'}
    b.calc(k,'mean-equal-batch-load','Bir serada 4 tepside ortalama 18, diğer 6 tepside ortalama 23 fide vardır. Bütün tepsiler birlikte düşünüldüğünde tepsi başına ortalama kaç fide düşer?',21,'(4*18+6*23)/10',
        ['İki bölümün fide toplamları 4·18=72 ve 6·23=138 olur.','Toplam 210 fide, 10 tepsiye aittir; 210/10=21.'],**common)
    b.calc(k,'mean-offset-calibration','Bir sensörün beş ölçümünün ortalaması 16,4 derecedir. Cihazın her ölçümü gerçek değerden 1,6 derece fazla gösterdiği anlaşılıyor. Gerçek ölçümlerin ortalaması kaç derecedir?',s.Rational(74,5),'Rational(164,10)-Rational(16,10)',
        ['Her veriden aynı 1,6 çıkarılırsa ortalama da 1,6 azalır.','16,4−1,6=14,8=74/5.'],**common)
    b.calc(k,'mean-scale-and-shift','Bir veri grubunun aritmetik ortalaması 7’dir. Her değer önce 3 ile çarpılıp sonuçtan 4 çıkarılıyor. Yeni veri grubunun ortalaması kaçtır?',17,'3*7-4',
        ['Sabit ile çarpma ortalamaya da uygulanır: 3·7=21.','Her veriden 4 çıkarmak ortalamayı 4 azaltır: 21−4=17.'],**common)
    b.calc(k,'mean-error-replacement','Sekiz teslimatın ortalama süresi 32 dakikadır. Listede bir teslimat süresi 19 yerine yanlışlıkla 43 yazılmıştır. Hata düzeltilince ortalama kaç dakika olur?',29,'(8*32-43+19)/8',
        ['Yanlış toplam 8·32=256’dır.','43 yerine 19 yazılınca toplam 24 azalır; 232/8=29.'],**common)
    b.calc(k,'mean-unequal-periods','Bir istasyon ilk 2 saatte saatte ortalama 35, sonraki 3 saatte saatte ortalama 50 yolcu almıştır. Beş saatlik dönemde saatte ortalama kaç yolcu alınmıştır?',44,'(2*35+3*50)/5',
        ['İlk dönemde 70, ikinci dönemde 150 yolcu alınır.','220 yolcu 5 saate bölünür: 44.'],**common)
    b.calc(k,'mean-one-point-donation','Altı kutudaki vida sayılarının ortalaması 24’tür. Kutulardan birine 18 vida ekleniyor, diğer kutular değişmiyor. Yeni ortalama kaçtır?',27,'(6*24+18)/6',
        ['Kutuların sayısı 6, toplamları başlangıçta 144’tür.','Yeni toplam 162; ortalama 162/6=27 olur.'],**common)
    b.calc(k,'mean-two-groups-complement','12 öğrencinin sınav ortalaması 68’dir. Bunların 5’inin ortalaması 75 olduğuna göre kalan 7 öğrencinin ortalaması kaçtır?',63,'(12*68-5*75)/7',
        ['Bütün puanların toplamı 816; beş öğrencinin toplamı 375’tir.','Kalan toplam 441, öğrenci sayısı 7; 441/7=63.'],**common)
    b.calc(k,'mean-equal-weight-sessions','Bir koşucu pazartesi ve salı günlerinde sırasıyla 8 km ve 12 km koşuyor. Çarşamba iki günün aritmetik ortalaması kadar koşarsa üç günlük ortalaması kaç km olur?',10,'(8+12+(8+12)/2)/3',
        ['İlk iki günün ortalaması (8+12)/2=10’dur.','Üç günlük toplam 30, ortalama 30/3=10 olur.'],difficulty='easy',**common)
    b.calc(k,'mean-rebalance-invariant','Beş depodaki ürün sayılarının ortalaması 42’dir. Bir depodan diğerine 17 ürün taşınıyor; depoların sayısı değişmiyor ve ürün kaybı olmuyor. Yeni ortalama kaçtır?',42,'(5*42-17+17)/5',
        ['Taşıma toplam ürün sayısını değiştirmez.','Toplam 210, depo sayısı 5 olarak kalır; ortalama 42’dir.'],difficulty='easy',**common)
    b.identity(k,'mean-compare-hidden-totals','Dört sayının ortalaması 15, altı başka sayının ortalaması 20’dir. İki grubun toplamlarının farkı, büyük toplamdan küçük toplam çıkarılırsa kaçtır?',60,['x-4*15','y-6*20'],'y-x',
        ['Birinci toplam x=60, ikinci toplam y=120 bulunur.','İstenen fark 120−60=60’tır.'],**common)

def missing_mean(b):
    k='missing_mean';common={'subtopic':'Ortalamada eksik veri ve grup sayısı'}
    b.solve(k,'missing-two-additions','Altı ürünün ortalama kütlesi 12 gramdır. Kütleleri x ve x+4 gram olan iki ürün daha eklenince sekiz ürünün ortalaması 14 gram oluyor. x kaçtır?',18,'6*12+x+(x+4)-8*14',
        ['Başlangıç toplamı 72, son toplam 112 gramdır.','Eklenen iki ürünün toplamı 40: x+x+4=40, x=18.'],**common)
    b.solve(k,'missing-removed-observation','Dokuz günlük satış ortalaması 17 birimdir. Bir gün listeden çıkarılınca kalan sekiz günün ortalaması 16 oluyor. Çıkarılan gün kaç birim satış yapılmıştır?',25,'9*17-x-8*16',
        ['Dokuz günün toplamı 153, kalanların toplamı 128’dir.','Çıkarılan değer x=153−128=25.'],**common)
    b.solve(k,'missing-replacement-balance','Yedi sayının ortalaması 22’dir. Gruptaki 10 sayısı x ile değiştirilince ortalama 25 oluyor. x kaçtır?',31,'7*22-10+x-7*25',
        ['Toplam 154’ten 175’e, yani 21 artar.','10 yerine yazılan sayı 10+21=31 olmalıdır.'],**common)
    b.solve(k,'missing-integer-group-size','Bir atölyede 9 makinenin ortalama yaşı 6 yıldır. Yaşları 10 yıl olan x makine daha katılınca ortalama 7 yıl oluyor. x pozitif tam sayı olduğuna göre kaçtır?',3,'9*6+10*x-7*(9+x)',
        ['Toplam yaş 54+10x, makine sayısı 9+x’tir.','54+10x=63+7x denklemi 3x=9 verir; x=3.'],conditions=[{'left':'x','op':'gt','right':'0'}],**common)
    b.solve(k,'missing-empty-week','Bir kütüphanede ilk 4 günün ortalama ziyaretçi sayısı 30’dur. Sonraki 3 günün her birinde eşit sayıda ziyaretçi gelince yedi günlük ortalama 36 oluyor. Son üç günün her birinde kaç ziyaretçi gelmiştir?',44,'4*30+3*x-7*36',
        ['Haftanın toplamı 252, ilk dört günün toplamı 120’dir.','Son üç gün 132 ziyaretçi alır; 132/3=44.'],**common)
    b.identity(k,'missing-paired-values','Beş ölçümün ortalaması 18’dir. Üç ölçüm 12, 16 ve 20; kalan iki ölçümün farkı 6’dır. Büyük ölçüm kaçtır?',24,['x+y+12+16+20-5*18','y-x-6'],'y',
        ['İki bilinmeyenin toplamı 90−48=42’dir.','y−x=6 ve x+y=42 denklemlerinden büyük değer y=24 olur.'],difficulty='hard',**common)
    b.solve(k,'missing-excluded-group-size','Ortalaması 48 olan bir gruptan puanı 30 olan 4 kişi ayrılıyor. Kalanların ortalaması 54 olduğuna göre başlangıçta grupta kaç kişi vardır?',16,'48*x-4*30-54*(x-4)',
        ['Başlangıç toplamı 48x, kalan toplam 48x−120’dir.','48x−120=54x−216; 6x=96, x=16.'],conditions=[{'left':'x','op':'gt','right':'4'}],**common)
    b.solve(k,'missing-same-average-new-group','Bir veri grubunda 4 sayının ortalaması 13’tür. Bu gruba 9 ve x eklenince ortalama değişmiyor. x kaçtır?',17,'4*13+9+x-6*13',
        ['Ortalamanın aynı kalması için iki yeni sayının toplamı 2·13=26 olmalıdır.','9+x=26 olduğundan x=17.'],difficulty='easy',**common)
    b.solve(k,'missing-balanced-points','Üç sınavın not ortalaması 72’dir. Dördüncü sınav notu ilk üçünün toplamının üçte birinden 8 fazladır. Dört sınavın ortalaması kaçtır?',74,'4*x-(3*72+(3*72)/3+8)',
        ['İlk üç notun toplamı 216’dır; dördüncü not 216/3+8=80 olur.','Dört notun toplamı 296; ortalama 296/4=74.'],**common)
    b.identity(k,'missing-weighted-two-departments','A ve B ekiplerinde sırasıyla 4 ve 6 kişi vardır. A ekibinin ortalama günlük üretimi B’ninkinden kişi başına 5 fazladır. İki ekibin birleşik ortalaması 23 ise B ekibinin ortalaması kaçtır?',21,['x-y-5','4*x+6*y-10*23'],'y',
        ['A’nın ortalamasına y+5, B’ninkine y denir.','4(y+5)+6y=230; 10y=210, y=21.'],difficulty='hard',**common)

def order_statistics(b):
    k='order_statistics';common={'subtopic':'Sıralama, medyan ve açıklık'}
    rows=[
        ('median-sensor-order','Bir sensörün beş okuması 14, 9, 21, 12 ve 18’dir. Bu okumaların medyanı kaçtır?',14,[14,9,21,12,18],'median',['Sıralama 9,12,14,18,21 olur.','Beş değerin ortasındaki üçüncü değer 14’tür.']),
        ('median-even-two-centres','Altı yolculuğun süreleri 22, 15, 19, 28, 17 ve 25 dakikadır. Sürelerin medyanı kaç dakikadır?',s.Rational(41,2),[22,15,19,28,17,25],'median',['Sıralama 15,17,19,22,25,28’dir.','İki orta değer 19 ve22; medyan (19+22)/2=41/2.']),
        ('mode-unique-frequency','Bir depodan art arda çıkan paketlerin adetleri 3, 5, 3, 7, 5, 3, 9’dur. Tek olan tepe değeri kaçtır?',3,[3,5,3,7,5,3,9],'mode',['3 değeri üç, 5 değeri iki kez görülür; diğerleri birer kezdir.','En sık görülen tek değer 3’tür.'])]
    for slug,prompt,answer,values,operation,steps in rows:
        b.emit(k,slug,prompt,answer,steps,{'type':'statistics','values':values,'operation':operation},difficulty='easy',**common)
    b.calc(k,'range-extreme-removal','Yedi ölçüm küçükten büyüğe 4, 9, 10, 13, 18, 21, 30’dur. En küçük ve en büyük ölçüm çıkarılınca açıklık kaç olur?',12,'21-9',
        ['Kalan en küçük değer9, en büyük değer21 olur.','Açıklık 21−9=12’dir.'],difficulty='easy',**common)
    b.calc(k,'range-affine-change','Bir veri grubunun açıklığı 12’dir. Her değeri −2 ile çarpıp 5 ekleyince yeni açıklık kaç olur?',24,'2*12',
        ['Sabit 5 eklemek en büyükle en küçüğün farkını değiştirmez.','−2 ile çarpma sıralamayı ters çevirir ama uzaklıkları 2 katına çıkarır:24.'],**common)
    b.finite(k,'median-insertion-window','2, 6, 10 ve 14 sayılarına 0≤x≤20 koşulunu sağlayan x tam sayısı ekleniyor. Beş sayının medyanı 8 oluyorsa x kaçtır?',8,{'x':[0,20]},'((2==8)+(6==8)+(10==8)+(14==8)+(x==8)>0) and ((2<8)+(6<8)+(10<8)+(14<8)+(x<8)<=2) and ((2>8)+(6>8)+(10>8)+(14>8)+(x>8)<=2)',{'kind':'unique','expression':'x'},
        ['Dört bilinen sayı içinde8’den küçük2 ve6, büyük10 ve14 vardır.','Ortadaki değerin8 olması için eklenen sayı x=8 olmalıdır.'],**common)
    b.calc(k,'median-symmetric-pairs','Küçükten büyüğe sıralanmış beş sayı 11−a, 11−b, 11, 11+b, 11+a biçimindedir; a>b>0. Bu beş sayının aritmetik ortalaması kaçtır?',11,'((11-a)+(11-b)+11+(11+b)+(11+a))/5',
        ['Birinci ve sonuncu toplam22; ikinci ve dördüncü toplam22’dir.','Toplam55, ortalama55/5=11. a ve b birbirini götürür.'],**common)
    b.identity(k,'range-and-median-reconstruct','Artan sıradaki üç sayı x, 15, y’dir. Aritmetik ortalama16 ve açıklık14 olduğuna göre en büyük sayı kaçtır?',s.Rational(47,2),['x+15+y-3*16','y-x-14'],'y',
        ['İlk ve son sayının toplamı33’tür.','y−x=14 ve x+y=33; 2y=47, y=47/2.'],difficulty='hard',**common)
    b.calc(k,'mean-median-gap','Küçükten büyüğe 5, 8, 11, 17 ve 24 sayıları veriliyor. Aritmetik ortalama ile medyan arasındaki fark kaçtır?',2,'(5+8+11+17+24)/5-11',
        ['Ortanca üçüncü sayı11’dir.','Toplam65 olduğundan ortalama13; fark13−11=2.'],**common)
    b.finite(k,'range-unknown-outlier','Artan sırada 3, 7, 11, 16 ve x tam sayıları veriliyor; 17≤x≤40. Açıklık25 olduğuna göre bu grubun aritmetik ortalaması kaçtır?',13,{'x':[17,40]},'x-3==25',{'kind':'unique','expression':'(3+7+11+16+x)/5'},
        ['En büyük değer 3+25=28’dir.','Toplam65; beş sayının ortalaması65/5=13 olur.'],**common)

def set_cardinality(b):
    k='set_cardinality';kw={'course':'sets','topic':'Kümeler ve sayma','subtopic':'Ayrık bölgelerle eleman sayısı'}
    rows=[
        ('sets-two-route-union','Bir toplulukta 20 kişi yürüyüşe, 17 kişi bisiklete katılıyor; 6 kişi iki etkinliğe de katılıyor. En az birine katılan kaç kişi vardır?',31,'20+17-6',['İki liste toplanınca ortak 6 kişi iki kez sayılır.','Ortak kişiler bir kez çıkarılır: 20+17−6=31.']),
        ('sets-exactly-one-project','Bir okulda yalnız robotik projesinde 7, yalnız müzik projesinde 9, iki projede birden 4 öğrenci var. Yalnız bir projede çalışan kaç öğrenci vardır?',16,'7+9',['Yalnız bir projede çalışanlar, 7 ve 9 kişilik ayrık gruplardır.','Ortak 4 kişi istenen gruba girmez; 7+9=16.']),
        ('sets-neither-workshop','50 kişilik bir grupta A atölyesine 28, B atölyesine 25 kişi katılıyor; 10 kişi ikisine de katılıyor. Hiçbir atölyeye katılmayan kaç kişi vardır?',7,'50-(28+25-10)',['En az bir atölyeye katılan 28+25−10=43 kişi vardır.','Geriye 50−43=7 kişi kalır.']),
        ('sets-only-first-from-union','A ve B iki kümedir; s(A)=30, s(B)=21, s(A∪B)=40. A’da bulunup B’de bulunmayan kaç eleman vardır?',19,'30-(30+21-40)',['Kesişim 30+21−40=11 elemanlıdır.','Yalnız A’da bulunan 30−11=19 eleman vardır.']),
        ('sets-nested-reserves','B⊂A, s(A)=22 ve s(B)=8’dir. A−B kümesinin eleman sayısı kaçtır?',14,'22-8',['B’nin 8 elemanı A’nın içindedir.','A−B için bu 8 eleman çıkarılır: 22−8=14.']),
        ('sets-list-memberships','Bir dernekte yalnız A komitesinde 8, yalnız B komitesinde 5, ikisinde birden 6 üye var. A ve B listelerindeki üye sayıları toplanırsa kaç bulunur?',25,'(8+6)+(5+6)',['A listesi 14, B listesi 11 üyeden oluşur.','İki listenin toplamında ortak üyeler iki kez sayılır: 14+11=25.']),
        ('sets-three-union','Üç kümenin eleman sayıları 24, 20, 18; ikili kesişimlerinin eleman sayıları 10, 8, 6 ve üçlü kesişimin eleman sayısı 3’tür. Birleşimleri kaç elemanlıdır?',41,'24+20+18-10-8-6+3',['Üç kümenin eleman sayıları toplamı 62, ikili ortaklıklar toplamı 24’tür.','Üçlü ortaklık bir kez geri eklenir: 62−24+3=41.']),
        ('sets-exactly-two-of-three','A, B, C kümelerinde s(A∩B)=10, s(A∩C)=8, s(B∩C)=6, s(A∩B∩C)=3. Tam olarak iki kümede bulunan kaç eleman vardır?',15,'10+8+6-3*3',['İkili kesişimler toplamı 24’tür; üçlü kesişimin her elemanı 3 kez sayılmıştır.','Üçlü kesişim istenmediğinden 3·3 çıkarılır: 24−9=15.']),
        ('sets-de-morgan-count','40 elemanlı evrensel kümede s(A)=25, s(B)=23, s(A∪B)=35. s(A′∪B′) kaçtır?',27,'40-(25+23-35)',['A∩B’nin eleman sayısı 25+23−35=13’tür.','De Morgan kuralıyla A′∪B′=(A∩B)′ olur; 40−13=27.']),
        ('sets-reconstructed-intersection','A kümesinin 12 elemanı B’de bulunmuyor. B’nin A’da bulunmayan elemanlarının sayısı 7 ve s(A∪B)=25’tir. s(A∩B) kaçtır?',6,'25-12-7',['Birleşim, yalnız A’daki 12, yalnız B’deki 7 eleman ve ortak bölgeden oluşur.','Ortak bölge 25−12−7=6 elemanlıdır.'])]
    for slug,prompt,ans,expr,steps in rows:b.calc(k,slug,prompt,ans,expr,steps,**kw)

def integer_divisor_sets(b):
    k='integer_divisor_sets';kw={'course':'divisibility','topic':'Bölünebilme ve kümeler','subtopic':'Bölenleri koşulla seçme'}
    rows=[
        ('divisors-signed-cardinality','36’yı tam bölen sıfırdan farklı tam sayılardan oluşan küme kaç elemanlıdır?',18,{'d':[-36,36]},'d!=0 and 36%d==0',{'kind':'count','expression':'1'},['36’nın pozitif bölenleri 1, 2, 3, 4, 6, 9, 12, 18, 36 olmak üzere 9 tanedir.','Her pozitif bölenin negatifi de vardır; toplam 18.']),
        ('divisors-above-threshold','84’ün 7’den büyük pozitif tam sayı bölenleri kaç tanedir?',6,{'d':[8,84]},'84%d==0',{'kind':'count','expression':'1'},['7’den büyük bölenler 12, 14, 21, 28, 42, 84’tür.','Bu 6 sayı istenen kümeyi oluşturur.']),
        ('divisors-odd-only','72’nin pozitif ve tek tam sayı bölenleri kaç tanedir?',3,{'d':[1,72]},'72%d==0 and d%2==1',{'kind':'count','expression':'1'},['72=2³·3² için tek bölenler 2 çarpanı alamaz.','1, 3, 9 olmak üzere 3 tanedir.']),
        ('divisors-signed-sum','30’u tam bölen sıfırdan farklı bütün tam sayıların toplamı kaçtır?',0,{'d':[-30,30]},'d!=0 and 30%d==0',{'kind':'sum','expression':'d'},['Her pozitif d için −d de bölendir.','Bütün bölenler karşıt çiftlerle 0 toplamını verir.']),
        ('divisors-common-sum','48 ve 72’yi birden tam bölen pozitif tam sayıların toplamı kaçtır?',60,{'d':[1,48]},'48%d==0 and 72%d==0',{'kind':'sum','expression':'d'},['Ortak bölenler EBOB(48,72)=24’ün bölenleridir.','1+2+3+4+6+8+12+24=60.']),
        ('divisors-multiple-four','60’ın pozitif bölenlerinden 4’ün katı olanlar kaç tanedir?',4,{'d':[1,60]},'60%d==0 and d%4==0',{'kind':'count','expression':'1'},['4, 12, 20 ve 60 hem 60’ı böler hem 4’ün katıdır.','İstenen adet 4’tür.']),
        ('divisors-unordered-factor-pairs','a≤b olan pozitif tam sayılar için ab=90’dır. Kaç farklı (a,b) çifti vardır?',6,{'a':[1,90],'b':[1,90]},'a<=b and a*b==90',{'kind':'count','expression':'1'},['Çiftler (1,90), (2,45), (3,30), (5,18), (6,15), (9,10) şeklindedir.','a≤b koşulu her çifti bir kez saydırır; 6 çift vardır.']),
        ('divisors-closed-window','10≤d≤40 koşulunu sağlayan 120’nin pozitif böleni kaç farklı d vardır?',7,{'d':[10,40]},'120%d==0',{'kind':'count','expression':'1'},['Aralıktaki bölenler 10, 12, 15, 20, 24, 30, 40’tır.','Uçların dahil olduğu 7 değer sayılır.']),
        ('divisors-odd-quotient','42/d pozitif tek tam sayı olacak biçimde kaç pozitif tam sayı d vardır?',4,{'d':[1,42]},'42%d==0 and (42//d)%2==1',{'kind':'count','expression':'1'},['Tek bölüm 1, 3, 7 ve 21 olabilir.','Bunlara sırasıyla d=42, 14, 6 ve 2 denk gelir; 4 değer.']),
        ('divisors-union-of-two','A, 18’in; B, 24’ün pozitif tam sayı bölenleri kümesidir. A∪B kaç elemanlıdır?',10,{'d':[1,24]},'18%d==0 or 24%d==0',{'kind':'count','expression':'1'},['A’da 6, B’de 8 eleman vardır; ortak bölenler 1, 2, 3, 6’dır.','Birleşim 6+8−4=10 elemanlıdır.'])]
    for slug,prompt,ans,vs,pred,obj,steps in rows:b.finite(k,slug,prompt,ans,vs,pred,obj,steps,**kw)

def product_counting(b):
    k='product_counting';kw={'course':'probability','topic':'Sayma','subtopic':'Seçimleri koşullarla birleştirme'}
    rows=[
        ('counting-course-menu','Bir atölyede 4 başlangıç, 3 uygulama ve 2 kapanış oturumundan birer tane seçiliyor. Kaç farklı program oluşturulur?',24,'4*3*2',['Bağımsız üç aşamadaki seçenek sayıları çarpılır.','4·3·2=24 program vardır.']),
        ('counting-forbidden-outfit','4 üst, 3 alt ve 2 ayakkabıdan birer tane seçiliyor. Belirli bir üst ile belirli bir alt birlikte seçilemiyor; başka kısıt yoktur. Kaç kombinasyon vardır?',22,'4*3*2-2',['Kısıtsız 4·3·2=24 seçim vardır.','Yasak üst-alt ikilisi 2 ayakkabıyla kullanılabilir; 24−2=22.']),
        ('counting-two-distinct-digits','Bir kod, 3 harften biri ve ardından gelen iki farklı rakamdan oluşuyor. Kullanılabilir rakamlar 2, 3, 4, 5, 6, 7, 8, 9’dur. Kaç kod vardır?',168,'3*8*7',['İlk harf için 3; ilk rakam için 8; ikinci rakam için öncekinden farklı 7 seçenek vardır.','3·8·7=168.']),
        ('counting-direct-or-transfer','A’dan B’ye 3, B’den C’ye 4 farklı hat vardır. A’dan C’ye aktarmasız 2 hat daha vardır. Aktarmasız veya yalnız B’de bir aktarma yaparak kaç farklı yol seçilir?',14,'3*4+2',['B aktarmalı yollar 3·4=12 tanedir.','Aktarmasız 2 yol ayrı seçenektir; toplam 14.']),
        ('counting-distinct-even-digits','0, 2, 4, 6, 8 rakamlarıyla, rakamları farklı üç basamaklı kaç sayı yazılır?',48,'4*4*3',['Yüzler basamağı 0 olamaz: 4 seçenek.','Kalan basamaklarda sırasıyla 4 ve 3 seçenek vardır; 4·4·3=48.']),
        ('counting-exactly-one-green','Bir panelde birbirinden ayırt edilen 4 lamba vardır. Her lamba kırmızı veya yeşil yanar. Tam olarak bir lamba yeşil olacaksa kaç görünüm oluşur?',4,'4*1',['Yeşil yanacak tek lambanın konumu 4 şekilde seçilir.','Diğer üç lambanın kırmızı olması zorunludur.']),
        ('counting-additive-vehicle-types','Bir kiralama yerinde 3 elektrikli, 2 benzinli araç modeli vardır. Bir model ve 4 süre planından biri seçiliyor. Kaç farklı kiralama seçeneği vardır?',20,'(3+2)*4',['Bir model toplam 5 seçenekten seçilir.','Her biri 4 planla eşleşir; 5·4=20.']),
        ('counting-vowel-consonant-pattern','3 sesli ve 5 sessiz harften, ilk ve son harfi sesli, orta harfi sessiz olan 3 harfli kodlar oluşturuluyor. İki sesli harf farklı olacaksa kaç kod vardır?',30,'3*5*2',['İlk sesli için 3, orta sessiz için 5, son sesli için ilkinden farklı 2 seçenek vardır.','3·5·2=30.']),
        ('counting-letter-pair-and-digit','Bir şifre, 5 harften art arda seçilen iki farklı harf ve ardından 4 rakamdan seçilen bir rakamdan oluşuyor. Harflerin sırası önemlidir. Kaç şifre vardır?',80,'5*4*4',['İlk harf için 5, ikinci harf için 4; son rakam için 4 seçenek vardır.','5·4·4=80.']),
        ('counting-return-different-route','İki kent arasında birbirinden farklı 6 otobüs hattı vardır. Giderken ve dönerken aynı hat kullanılmayacaksa gidiş-dönüş kaç farklı şekilde planlanır?',30,'6*5',['Gidiş hattı 6 şekilde seçilir.','Dönüş için gidiş dışındaki 5 hat kalır; 6·5=30.'])]
    for slug,prompt,ans,expr,steps in rows:b.calc(k,slug,prompt,ans,expr,steps,**kw)

def sample_space_probability(b):
    k='sample_space_probability';kw={'course':'probability','topic':'Olasılık','subtopic':'Sonlu örnek uzayı sayarak olasılık'}
    rows=[
        ('probability-two-dice-seven','Birbirinden ayırt edilen iki adil altı yüzlü zar atılıyor. Üst yüzlerdeki sayıların toplamının 7 olma olasılığı kaçtır?',s.Rational(1,6),{'a':[1,6],'b':[1,6]},'a+b==7',{'kind':'sum','expression':'1/36'},['Toplamı 7 olan sıralı çiftler (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) şeklindedir.','36 eş olasılıklı sonuçtan 6’sı uygundur:6/36=1/6.']),
        ('probability-two-coins-one','İki adil madeni para birlikte atılıyor. Tam olarak birinin yazı gelme olasılığı kaçtır?',s.Rational(1,2),{'a':[0,1],'b':[0,1]},'a+b==1',{'kind':'sum','expression':'1/4'},['Yazı-tura ve tura-yazı olmak üzere iki uygun sonuç vardır.','Dört eş olasılıklı sonucun ikisi uygundur:2/4=1/2.']),
        ('probability-die-union','Adil bir zar atılıyor. Gelen sayının çift veya asal olma olasılığı kaçtır?',s.Rational(5,6),{'d':[1,6]},'d%2==0 or d==2 or d==3 or d==5',{'kind':'sum','expression':'1/6'},['Çift sayılar2,4,6; asal sayılar2,3,5’tir.','Birleşim2,3,4,5,6 olmak üzere5 sonuç içerir; olasılık5/6.']),
        ('probability-dice-small-sum','Birbirinden ayırt edilen iki adil zar atılıyor. Üst yüzlerin toplamının 5’ten küçük olma olasılığı kaçtır?',s.Rational(1,6),{'a':[1,6],'b':[1,6]},'a+b<5',{'kind':'sum','expression':'1/36'},['Toplam2 için1, toplam3 için2, toplam4 için3 uygun sıralı çift vardır.','Toplam6 uygun sonuç,36 olasılığa bölünür:1/6.']),
        ('probability-label-exclusion','1’den20’ye kadar numaralı özdeş kartlardan biri eş olasılıkla seçiliyor. Numaranın3’e bölünüp4’e bölünmeme olasılığı kaçtır?',s.Rational(1,4),{'n':[1,20]},'n%3==0 and n%4!=0',{'kind':'sum','expression':'1/20'},['3’ün katları3,6,9,12,15,18’dir. Bunlardan12,4’e de bölünür.','Uygun5 kart kalır;5/20=1/4.']),
        ('probability-two-spinners','Bir çarkın eş dilimleri1,2,3,4; diğerinin eş dilimleri1,2,3,4,5 ile etiketlidir. Bağımsız çevrilen çarkların aynı sayıda durma olasılığı kaçtır?',s.Rational(1,5),{'a':[1,4],'b':[1,5]},'a==b',{'kind':'sum','expression':'1/20'},['Ortak etiket1,2,3,4 için dört eşleşen sonuç vardır.','Toplam4·5=20 sonuç;4/20=1/5.']),
        ('probability-square-or-prime','1’den15’e kadar numaralanan15 karttan biri eş olasılıkla seçiliyor. Numaranın tam kare veya asal olma olasılığı kaçtır?',s.Rational(3,5),{'n':[1,15]},'n==1 or n==4 or n==9 or n==2 or n==3 or n==5 or n==7 or n==11 or n==13',{'kind':'sum','expression':'1/15'},['Tam kareler1,4,9; asallar2,3,5,7,11,13’tür; bu iki liste ayrıktır.','Uygun9 kart vardır;9/15=3/5.']),
        ('probability-three-coins-majority','Üç adil madeni para bağımsız atılıyor. En az ikisinin yazı gelme olasılığı kaçtır?',s.Rational(1,2),{'a':[0,1],'b':[0,1],'c':[0,1]},'a+b+c>=2',{'kind':'sum','expression':'1/8'},['Tam iki yazı3, üç yazı1 farklı biçimde gelir.','8 eş olasılıklı sonucun4’ü uygundur;4/8=1/2.']),
        ('probability-impossible-product','İki adil altı yüzlü zarın sıralı sonuçları düşünülüyor. Üst yüzlerdeki sayıların çarpımının36’dan büyük olduğu kaç sonuç vardır?',0,{'a':[1,6],'b':[1,6]},'a*b>36',{'kind':'count','expression':'1'},['Her zar en fazla6 gösterir; çarpım en fazla6·6=36’dır.','36’dan büyük çarpım imkânsızdır; uygun sonuç sayısı0.'])]
    for slug,prompt,ans,vs,pred,obj,steps in rows:b.finite(k,slug,prompt,ans,vs,pred,obj,steps,**kw)
    b.emit(k,'probability-unreplaced-matching','Bir torbada4 kırmızı ve3 mavi, birbirinden ayırt edilebilir7 bilye vardır. Geri koymadan rastgele iki bilye seçiliyor. İkisinin aynı renk olma olasılığı kaçtır?',s.Rational(3,7),
        ['Sıralı bütün seçimlerin sayısı7·6=42’dir.','İki kırmızı4·3=12, iki mavi3·2=6 sonuç verir;18/42=3/7.'],
        {'type':'counting','family':'probability','parameters':{'red':4,'blue':3,'draw':2,'event':'same_color'}},**kw)

def proposition_logic(b):
    k='proposition_logic';kw={'course':'sets','topic':'Mantık','subtopic':'Doğruluk tablosu ve koşul sayısı'}
    rows=[
        ('logic-disjunction-true','p ve q önermelerinin her biri0 veya1 doğruluk değerini alıyor. p∨q ifadesi kaç farklı(p,q) değer çiftinde doğrudur?',3,{'p':[0,1],'q':[0,1]},'p==1 or q==1',['Yalnız(0,0) çifti birleşik önermeyi yanlış yapar.','Dört çiftin diğer üçünde sonuç doğrudur.']),
        ('logic-implication-false','p→q önermesinin yanlış olduğu kaç farklı(p,q) doğruluk değeri çifti vardır?',1,{'p':[0,1],'q':[0,1]},'p==1 and q==0',['Koşullu önerme yalnız öncül doğru, sonuç yanlışken yanlıştır.','Bu yalnız(1,0) çiftidir.']),
        ('logic-negated-conjunction','p ve q için(p∧q)′ ifadesini doğru yapan kaç doğruluk değeri çifti vardır?',3,{'p':[0,1],'q':[0,1]},'not (p==1 and q==1)',['p∧q yalnız(1,1) için doğrudur.','Değili kalan üç çiftte doğrudur.']),
        ('logic-exclusive-choice','p ve q önermelerinden tam olarak birinin doğru olduğu kaç doğruluk değeri çifti vardır?',2,{'p':[0,1],'q':[0,1]},'p!=q',['Uygun çiftler(1,0) ve(0,1)’dir.','İki farklı değer çifti vardır.']),
        ('logic-nested-implication','p→(q∨r) önermesini yanlış yapan kaç farklı(p,q,r) üçlüsü vardır?',1,{'p':[0,1],'q':[0,1],'r':[0,1]},'p==1 and q==0 and r==0',['Yanlışlık için p=1 ve q∨r=0 gerekir.','İkinci şart q=r=0 demektir; yalnız(1,0,0) uygundur.']),
        ('logic-absorption-table','(p∨q)∧(p′∨q) ifadesi kaç farklı(p,q) doğruluk değeri çiftinde doğrudur?',2,{'p':[0,1],'q':[0,1]},'(p==1 or q==1) and (p==0 or q==1)',['q=1 olunca iki parantez de doğrudur ve p iki değeri alabilir.','q=0 olunca p ve p′ birlikte doğru olamaz; sonuç2’dir.']),
        ('logic-equivalence','(p→q)∧(q→p) ifadesini doğru yapan kaç doğruluk değeri çifti vardır?',2,{'p':[0,1],'q':[0,1]},'(p==0 or q==1) and (q==0 or p==1)',['Her iki koşulun doğru olması için p ve q eşit olmalıdır.','(0,0) ve(1,1) olmak üzere iki çift vardır.']),
        ('logic-triple-not-all','p∧q∧r önermesinin yanlış olduğu kaç doğruluk değeri üçlüsü vardır?',7,{'p':[0,1],'q':[0,1],'r':[0,1]},'not (p==1 and q==1 and r==1)',['Üç önerme için2³=8 doğruluk değeri üçlüsü vardır.','Yalnız(1,1,1) ifadesi doğrudur;8−1=7 üçlü yanlıştır.']),
        ('logic-tautology-count','(p→q)∨(q→p) ifadesi kaç farklı(p,q) doğruluk değeri çiftinde doğrudur?',4,{'p':[0,1],'q':[0,1]},'(p==0 or q==1) or (q==0 or p==1)',['İki koşullu önermenin aynı anda yanlış olması p=1,q=0 ve q=1,p=0 gerektirir; bu mümkün değildir.','Dört çiftin tamamında en az bir koşullu önerme doğrudur.']),
        ('logic-reconstruct-one-value','p=1, p∧r=0 ve p∨r=1 olduğu biliniyor. r’nin doğruluk değeri kaçtır?',0,{'r':[0,1]},'(1==1 and r==1)==False and (1==1 or r==1)', ['p=1 olduğundan p∧r, r ile aynı değerdedir.','Bu ifadenin0 olması r=0 gerektirir; birleşim koşulu da sağlanır.'])]
    for slug,prompt,ans,vs,pred,steps in rows:
        obj={'kind':'unique','expression':'r'} if slug=='logic-reconstruct-one-value' else {'kind':'count','expression':'1'}
        b.finite(k,slug,prompt,ans,vs,pred,obj,steps,**kw)

def ayt_inverse_affine(b):
    k='inverse_affine';kw={'exam':'AYT','course':'functions','topic':'Fonksiyonlar','subtopic':'Doğrusal fonksiyonun tersi'}
    b.solve(k,'affine-inverse-value','f:ℝ→ℝ, f(x)=4x−7 olsun. f⁻¹(13) kaçtır?',5,'4*x-7-13',['f⁻¹(13), f(x)=13 yapan girdidir.','4x−7=13 denklemi x=5 verir.'],difficulty='easy',**kw)
    b.solve(k,'affine-parameter-from-inverse','f(x)=ax+3 ve a≠0 olsun. f⁻¹(19)=4 olduğuna göre a kaçtır?',4,'4*a+3-19',['Ters eşitlik f(4)=19 biçiminde yazılır.','4a+3=19; a=4.'],variable='a',**kw)
    b.solve(k,'affine-shifted-input','Her gerçek x için f(2x+1)=6x−5 veriliyor. f⁻¹(10) kaçtır?',6,'3*x-8-10',['t=2x+1 yazılırsa f(t)=3t−8 olur.','3t−8=10 denkleminin çözümü t=6’dır.'],**kw)
    b.solve(k,'affine-inverse-translated-output','f(x)=−3x+8 ise f⁻¹(f(5)+6) kaçtır?',3,'-3*x+8-(-3*5+8+6)',['f(5)=−7 ve f(5)+6=−1’dir.','−3x+8=−1 denklemi x=3 verir.'],**kw)
    b.solve(k,'affine-crossed-inverse-equation','f(x)=2x+5 için f⁻¹(x)=3x−7 eşitliğini sağlayan x kaçtır?',s.Rational(9,5),'(x-5)/2-(3*x-7)',['f⁻¹(x)=(x−5)/2’dir.','x−5=6x−14;5x=9, x=9/5.'],difficulty='hard',**kw)
    b.solve(k,'affine-summed-preimages','f(x)=mx+2, m≠0 olsun. f⁻¹(1)+f⁻¹(9)=6 ise m kaçtır?',1,'(1-2)/m+(9-2)/m-6',['İki ters değer−1/m ve7/m’dir.','Toplam6/m=6; m=1 ve sıfırdan farklıdır.'],variable='m',conditions=[{'left':'m','op':'ne','right':'0'}],**kw)
    b.solve(k,'affine-inverse-fixed-input','f(x)=5x+4 için f⁻¹(2x+3)=x eşitliğini sağlayan x kaçtır?',s.Rational(-1,3),'2*x+3-(5*x+4)',['Ters fonksiyon uygulanarak2x+3=f(x)=5x+4 yazılır.','−3x=1; x=−1/3.'],**kw)
    b.identity(k,'affine-two-known-preimages','f(x)=ax+b olsun. f⁻¹(7)=2 ve f⁻¹(13)=5 veriliyor. f(0) kaçtır?',3,['2*a+b-7','5*a+b-13'],'b',['f(2)=7 ve f(5)=13 denklemleri yazılır.','Çıkarınca3a=6; a=2 ve b=3 bulunur.'],variables=['a','b'],**kw)
    b.calc(k,'affine-reversed-preimage-gap','f(x)=−2x+1 olsun. f⁻¹(−5)−f⁻¹(3) kaçtır?',4,'((-5-1)/(-2))-((3-1)/(-2))',['−2x+1=−5 için x=3; −2x+1=3 için x=−1’dir.','İstenen fark3−(−1)=4.'],**kw)
    b.solve(k,'affine-double-inverse-positive-slope','f(x)=ax+1 ve a>0 olsun. (f⁻¹∘f⁻¹)(7)=1 olduğuna göre a kaçtır?',2,'a*(a+1)+1-7',['İki kez f uygulanırsa f(f(1))=7 olur.','a(a+1)+1=7; a²+a−6=(a−2)(a+3)=0. Pozitif a=2 seçilir.'],variable='a',conditions=[{'left':'a','op':'gt','right':'0'}],difficulty='hard',**kw)

def ayt_rational_inverse(b):
    k='rational_inverse';kw={'exam':'AYT','course':'functions','topic':'Fonksiyonlar','subtopic':'Rasyonel fonksiyonda ters eşleştirme'}
    b.solve(k,'rational-inverse-clear-denominator','f(x)=(3x+2)/(x−4), x≠4 olsun. f⁻¹(5) kaçtır?',11,'3*x+2-5*(x-4)',['f(x)=5 yazılıp paydadan kurtarılır:3x+2=5x−20.','2x=22; x=11 ve yasak değer4 değildir.'],conditions=[{'left':'x','op':'ne','right':'4'}],**kw)
    b.solve(k,'rational-inverse-zero','f(x)=(2x−1)/(x+3), x≠−3 olsun. f⁻¹(0) kaçtır?',s.Rational(1,2),'2*x-1',['Kesrin sıfır olması için pay sıfır, payda sıfırdan farklı olmalıdır.','2x−1=0; x=1/2 ve payda7/2’dir.'],conditions=[{'left':'x','op':'ne','right':'-3'}],difficulty='easy',**kw)
    b.identity(k,'rational-two-parameter-observations','f(x)=(ax+b)/(x−2) için f⁻¹(4)=3 ve f(0)=−1 veriliyor. a+b kaçtır?',s.Rational(8,3),['3*a+b-4','b-2'],'a+b',['f(3)=4 denklemi3a+b=4 verir.','f(0)=−b/2=−1 olduğundan b=2, a=2/3; toplam8/3.'],variables=['a','b'],difficulty='hard',**kw)
    b.calc(k,'rational-self-inverse-composition','f(x)=(x+2)/(x−1) ve x≠1 olsun. (f∘f)(5) kaçtır?',5,'(((5+2)/(5-1))+2)/(((5+2)/(5-1))-1)',['f(5)=7/4 bulunur.','f(7/4)=(15/4)/(3/4)=5; iki adımda başlangıç değerine dönülür.'],**kw)
    b.calc(k,'rational-sum-of-two-preimages','f(x)=(4x−3)/(2x+5) olsun. f⁻¹(1)+f⁻¹(0) kaçtır?',s.Rational(19,4),'4+Rational(3,4)',['f(x)=1 denklemi4x−3=2x+5 verip x=4 yapar.','f(x)=0 denklemi x=3/4 verir; toplam19/4.'],**kw)
    b.solve(k,'rational-value-near-range-boundary','f(x)=(3x+1)/(2x−5) olsun. f⁻¹(2) kaçtır?',11,'3*x+1-2*(2*x-5)',['3x+1=4x−10 yazılır.','x=11 olur; payda17 olduğundan eşleştirme tanımlıdır.'],conditions=[{'left':'x','op':'ne','right':'5/2'}],**kw)
    b.calc(k,'rational-inverse-output-given','f(x)=(2x+1)/(x+4) olsun. f⁻¹(t)=−3 ise t kaçtır?',-5,'(2*(-3)+1)/(-3+4)',['Ters eşitlik t=f(−3) anlamına gelir.','t=(−6+1)/(−3+4)=−5.'],**kw)
    b.solve(k,'rational-coefficient-from-preimage','f(x)=(ax+2)/(x+1) için f⁻¹(3)=2 veriliyor. a kaçtır?',s.Rational(7,2),'2*a+2-3*(2+1)',['f(2)=3 eşitliği (2a+2)/3=3’tür.','2a+2=9; a=7/2.'],variable='a',**kw)
    b.solve(k,'rational-negative-target','f(x)=(x−3)/(2x+1) olsun. f⁻¹(−1/2) kaçtır?',s.Rational(5,4),'2*(x-3)+(2*x+1)',['2(x−3)=−(2x+1) yazılır.','4x=5; x=5/4 ve payda7/2 sıfır değildir.'],conditions=[{'left':'x','op':'ne','right':'-1/2'}],**kw)
    b.calc(k,'rational-domain-range-gap','f:ℝ−{a}→ℝ−{b}, f(x)=(5x+4)/(x+1) bire bir ve örtendir. b−a kaçtır?',6,'5-(-1)',['Paydanın sıfır olduğu a=−1 tanım kümesinden çıkarılır.','f(x)=5−1/(x+1) olduğundan b=5 alınamaz; b−a=6.'],**kw)

def ayt_functional_coefficients(b):
    k='functional_coefficients';kw={'exam':'AYT','course':'functions','topic':'Fonksiyonlar','subtopic':'Doğrusal bileşkede katsayı eşitleme'}
    b.identity(k,'coefficients-double-map','f(x)=ax+b için her gerçek x’te (f∘f)(x)=4x+9 ve a>0 veriliyor. f(5) kaçtır?',13,['a*a-4','a*b+b-9'],'5*a+b',
        ['Bileşke a²x+ab+b biçimindedir. a²=4 ve a>0’dan a=2 olur.','3b=9, b=3; f(5)=2·5+3=13.'],variables=['a','b'],nonzero=['a+2'],**kw)
    b.identity(k,'coefficients-input-difference','f(x)=ax+b olsun. Her x için f(x+2)−f(x)=6 ve f(1)=4 ise f⁻¹(10) kaçtır?',3,['2*a-6','a+b-4'],'(10-b)/a',
        ['İlk fark2a=6 verir; a=3’tür.','f(1)=4’ten b=1;3t+1=10 için t=3.'],variables=['a','b'],nonzero=['a'],**kw)
    b.identity(k,'coefficients-doubled-input','f(x)=ax+b için f(2x)=2f(x)+3 ve f(1)=2 her x’te sağlanıyor. f(−1) kaçtır?',-8,['b-(2*b+3)','a+b-2'],'-a+b',
        ['Sabit terimler eşitlenince b=2b+3, yani b=−3 olur.','a−3=2’den a=5; f(−1)=−5−3=−8.'],variables=['a','b'],**kw)
    b.identity(k,'coefficients-reflected-inputs','f(x)=ax+b olsun. Her x için f(x)+f(−x)=12 ve f(3)−f(1)=8 veriliyor. f⁻¹(14) kaçtır?',2,['2*b-12','2*a-8'],'(14-b)/a',
        ['Simetrik girdilerin toplamı2b=12 verir; b=6.','İkinci koşul2a=8 verir; a=4.4t+6=14 denklemi t=2 olur.'],variables=['a','b'],nonzero=['a'],**kw)
    b.identity(k,'coefficients-negative-double-map','f(x)=ax+b ve a<0 olsun. Her x için (f∘f)(x)=9x−8 ise f(2) kaçtır?',-2,['a*a-9','a*b+b+8'],'2*a+b',
        ['a²=9 ve a<0 olduğundan a=−3’tür.','−2b=−8’den b=4; f(2)=−6+4=−2.'],variables=['a','b'],nonzero=['a-3'],**kw)
    b.identity(k,'coefficients-threefold-input','f(x)=ax+b için f(3x+1)=3f(x)−4 ve f(0)=5 veriliyor. f(2) kaçtır?',17,['a+b-3*b+4','b-5'],'2*a+b',
        ['Sabit terimler a+b=3b−4 verir.','b=5 yerine yazılırsa a=6; f(2)=12+5=17.'],variables=['a','b'],**kw)
    b.identity(k,'coefficients-sum-and-difference','f(x)=ax+b için f(2)+f(4)=20 ve f(4)−f(2)=8 veriliyor. f(3) kaçtır?',10,['6*a+2*b-20','2*a-8'],'3*a+b',
        ['İkinci denklemden a=4 bulunur.','24+2b=20 olduğundan b=−2; f(3)=12−2=10.'],variables=['a','b'],**kw)
    b.identity(k,'coefficients-origin-orbit','f(x)=ax+b, f(0)=3 ve f(f(0))=12 ise f⁻¹(9) kaçtır?',2,['b-3','a*b+b-12'],'(9-b)/a',
        ['İlk eşitlik b=3; ikinci eşitlik3a+3=12 verir.','a=3 ve f(t)=3t+3; f(t)=9 için t=2.'],variables=['a','b'],nonzero=['a'],**kw)
    b.identity(k,'coefficients-composition-gap','f(x)=ax+b ve a>0 için her x’te f(f(x))−f(x)=6x+6 sağlanıyor. f(2) kaçtır?',8,['a*a-a-6','a*b-6'],'2*a+b',
        ['x katsayısı a²−a=6 verir; kökler3 ve−2’dir, pozitif olan3 seçilir.','ab=6’dan b=2; f(2)=6+2=8.'],variables=['a','b'],nonzero=['a+2'],difficulty='hard',**kw)
    b.identity(k,'coefficients-inverse-affine-form','f(x)=ax+b, a≠0 olsun. Ters fonksiyonu f⁻¹(x)=2x+7 olduğuna göre a+b kaçtır?',-3,['2*a-1','7*a+b'],'a+b',
        ['f(f⁻¹(x))=x eşitliği a(2x+7)+b=x biçimindedir.','2a=1 ve7a+b=0; a=1/2,b=−7/2, toplam−3.'],variables=['a','b'],nonzero=['a'],**kw)

def ayt_inverse_composition(b):
    k='inverse_composition';kw={'exam':'AYT','course':'functions','topic':'Fonksiyonlar','subtopic':'Ters bileşkeyi doğru sırayla uygulama'}
    b.solve(k,'composition-inverse-two-linear','f(x)=x−4 ve g(x)=3x+1 olsun. (g∘f)⁻¹(10) kaçtır?',7,'3*(x-4)+1-10',
        ['Önce g(f(x))=3x−11 bulunur.','3x−11=10 denklemi x=7 verir.'],**kw)
    b.solve(k,'composition-inverse-reversed-order','f(x)=2x−1 ve g(x)=x+3 olsun. (f∘g)⁻¹(20) kaçtır?',s.Rational(15,2),'2*(x+3)-1-20',
        ['f(g(x))=2x+5’tir.','2x+5=20 olduğundan x=15/2.'],**kw)
    b.solve(k,'composition-square-restricted','f:[−3/2,∞)→[0,∞), f(x)=2x+3 ve g:[0,∞)→[0,∞), g(x)=x² olsun. (g∘f)⁻¹(49) kaçtır?',2,'(2*x+3)**2-49',
        ['Bileşkenin değeri(2x+3)²’dir. f’nin değerleri negatif olmadığından2x+3=7 seçilir.','x=2 bulunur; diğer cebirsel kök−5 tanım aralığında değildir.'],conditions=[{'left':'x','op':'ge','right':'-3/2'}],difficulty='hard',**kw)
    b.identity(k,'composition-known-preimage','Bire bir ve örten f ve g için (g∘f)(x)=4x−5 ve f⁻¹(3)=2 veriliyor. g(3) kaçtır?',3,['x-2','y-(4*x-5)'],'y',
        ['f⁻¹(3)=2, f(2)=3 demektir.','g(3)=g(f(2))=4·2−5=3.'],**kw)
    b.identity(k,'composition-inverse-left-cancel','Bire bir ve örten f ve g için (g⁻¹∘f)(x)=2x+1 ve g(5)=11 veriliyor. f(2) kaçtır?',11,['x-(2*2+1)','y-11'],'y',
        ['x=2 yazılırsa g⁻¹(f(2))=5 olur.','Her iki tarafa g uygulanır: f(2)=g(5)=11.'],**kw)
    b.identity(k,'composition-conjugate-input','Bire bir ve örten f ve g için (f⁻¹∘g∘f)(x)=x+2, f(1)=3 ve f(3)=8 veriliyor. g(3) kaçtır?',8,['x-3','y-8'],'y',
        ['x=1 yazılırsa f⁻¹(g(f(1)))=3 olur.','f(1)=3 olduğundan f⁻¹(g(3))=3; f uygulanırsa g(3)=f(3)=8 bulunur.'],difficulty='hard',**kw)
    b.identity(k,'composition-inverse-input-known','Bire bir ve örten f ve g için (f∘g⁻¹)(x)=x+6 ve g(3)=8 veriliyor. f(3) kaçtır?',14,['x-8','y-(x+6)'],'y',
        ['g(3)=8 olduğundan g⁻¹(8)=3’tür.','x=8 için f(3)=8+6=14.'],**kw)
    b.identity(k,'composition-known-output-known-input','Bire bir ve örten f ve g için (g∘f⁻¹)(x)=2x−3 ve f(7)=5 veriliyor. g(7) kaçtır?',7,['x-5','y-(2*x-3)'],'y',
        ['f(7)=5 eşitliğinden f⁻¹(5)=7 elde edilir.','x=5 yazılınca g(7)=10−3=7 olur.'],**kw)
    b.identity(k,'composition-inverse-given-two-levels','Bire bir ve örten f ve g için (g∘f)⁻¹(4)=2 ve g⁻¹(4)=6 veriliyor. f(2) kaçtır?',6,['x-6','y-x'],'y',
        ['İlk eşitlik g(f(2))=4 anlamındadır.','g’nin4’e giden girdisi6 olduğundan f(2)=6’dır.'],**kw)
    b.identity(k,'composition-inverse-whole-map','Bire bir ve örten f ve g için (f⁻¹∘g)⁻¹(3)=7 ve g(7)=12 veriliyor. f(3) kaçtır?',12,['x-12','y-x'],'y',
        ['Ters eşitlik f⁻¹(g(7))=3 biçiminde açılır.','f uygulanırsa f(3)=g(7)=12 olur.'],difficulty='hard',**kw)

def ayt_domain_range(b):
    k='domain_range';kw={'exam':'AYT','course':'functions','topic':'Fonksiyonlar','subtopic':'Tanım ve görüntü kümesindeki dışlanan değerler'}
    b.calc(k,'domain-range-sum','f:ℝ−{a}→ℝ−{b}, f(x)=(4x−1)/(2x+3) bire bir ve örtendir. a+b kaçtır?',s.Rational(1,2),'-Rational(3,2)+2',
        ['Payda2x+3=0 için a=−3/2’dir.','y=2 denklemi−1=6 çelişkisi verdiğinden b=2; toplam1/2.'],**kw)
    b.calc(k,'domain-range-product','f:ℝ−{a}→ℝ−{b}, f(x)=(x+2)/(3x−6) bire bir ve örtendir. a·b kaçtır?',s.Rational(2,3),'2*Rational(1,3)',
        ['Payda3x−6=0 için a=2 bulunur.','Görüntüde alınamayan katsayı oranı b=1/3; çarpım2/3.'],**kw)
    b.solve(k,'domain-leading-parameter','f(x)=(ax+3)/(2x−4) fonksiyonunun görüntü kümesiℝ−{5}’tir. a kaçtır?',10,'a/2-5',
        ['Sabit olmayan doğrusal-kesirli fonksiyonda alınamayan değer baş katsayılar oranıdır.','a/2=5 denklemi a=10 verir; pay ve payda orantılı değildir.'],variable='a',**kw)
    b.solve(k,'domain-numerator-parameter','f(x)=(3x+b)/(x−2) ve f⁻¹(1)=4 veriliyor. b kaçtır?',-10,'3*4+b-(4-2)',
        ['Ters eşitlik f(4)=1 demektir.','(12+b)/2=1; b=−10.'],variable='b',**kw)
    b.calc(k,'domain-denominator-shift','f(x)=(x−5)/(x+a) fonksiyonunun tanım kümesiℝ−{−3}’tür. f(1) kaçtır?',-1,'(1-5)/(1+3)',
        ['Payda kökü−a=−3 olduğundan a=3’tür.','f(1)=(1−5)/(1+3)=−1.'],**kw)
    b.calc(k,'domain-pole-and-range-gap','f(x)=(kx+1)/(x−4) fonksiyonunun görüntü kümesiℝ−{2}’dir. Tanım kümesinden dışlanan değerle k’nin toplamı kaçtır?',6,'4+2',
        ['Payda x=4 için sıfır olur.','Görüntüden dışlanan değer k’dir; k=2 ve toplam4+2=6.'],**kw)
    b.finite(k,'domain-cancellation-finite-image','f:{1,2,3}→ℝ, f(x)=(2x−8)/(x−4) olsun. Görüntü kümesi kaç elemanlıdır?',1,{'y':[0,5]},'y==(2*1-8)/(1-4) or y==(2*2-8)/(2-4) or y==(2*3-8)/(3-4)',{'kind':'count','expression':'1'},
        ['Tanım kümesinde x=4 bulunmadığı için bütün girdilerde sadeleştirme yapılabilir.','f(1)=f(2)=f(3)=2; görüntü yalnız{2} olduğu için1 elemanlıdır.'],**kw)
    b.emit(k,'domain-removable-hole-image','f:ℝ−{3}→ℝ, f(x)=(x²−9)/(x−3) olsun. Görüntü kümesinde bulunmayan gerçek sayı kaçtır?',6,
        ['x≠3 için f(x)=x+3 olur.','x=3 girdi olarak çıkarılınca yalnız3+3=6 değeri alınamaz.'],
        {'kind':'exact_math','operation':'limit','expression':'(x*x-9)/(x-3)','variable':'x','point':'3'},**kw)
    b.calc(k,'domain-square-root-left-end','f(x)=√(x+4) fonksiyonunun en geniş gerçek tanım kümesi[a,∞), görüntü kümesi[b,∞) biçimindedir. a+b kaçtır?',-4,'-4+0',
        ['Karekök içi x+4≥0 için a=−4’tür.','Karekök değerleri0 ve üzerindedir; b=0 ve toplam−4.'],**kw)
    b.calc(k,'domain-decreasing-interval-width','f:[−2,1]→ℝ, f(x)=−3x+5 olsun. Görüntü aralığının uzunluğu kaçtır?',9,'(-3*(-2)+5)-(-3*1+5)',
        ['Doğrusal fonksiyon azalandır; uç değerler f(−2)=11 ve f(1)=2’dir.','Görüntü[2,11], uzunluğu11−2=9 olur.'],**kw)

def ayt_inverse_shift_parameter(b):
    k='inverse_shift_parameter';kw={'exam':'AYT','course':'functions','topic':'Fonksiyonlar','subtopic':'Ters bileşkeden parametre denklemi kurma'}
    b.solve(k,'inverse-relation-quadratic-shift','Tanımlı olduğu aralıkta (g⁻¹∘f)(x)=x²−3x+n ve g(10)=f(4) veriliyor. n kaçtır?',6,'4**2-3*4+n-10',
        ['g(10)=f(4) olduğundan g⁻¹(f(4))=10’dur.','16−12+n=10; n=6.'],variable='n',**kw)
    b.solve(k,'inverse-relation-linear-scale','(g⁻¹∘f)(x)=nx+4 ve g(16)=f(3) veriliyor. n kaçtır?',4,'3*n+4-16',
        ['Gözlem3n+4=16 eşitliğini verir.','3n=12 olduğundan n=4.'],variable='n',**kw)
    b.solve(k,'inverse-relation-shift-inside-square','Tanımlı olduğu aralıkta (g⁻¹∘f)(x)=(x+n)², g(25)=f(1) ve n>−1 veriliyor. n kaçtır?',4,'(1+n)**2-25',
        ['(1+n)²=25 olur; n=4 veya−6 elde edilir.','n>−1 koşulu4’ü seçer.'],variable='n',conditions=[{'left':'n','op':'gt','right':'-1'}],difficulty='hard',**kw)
    b.solve(k,'inverse-relation-reciprocal-scale','Tanımlı olduğu aralıkta (g⁻¹∘f)(x)=n/(x+1) ve g(6)=f(2) veriliyor. n kaçtır?',18,'n/(2+1)-6',
        ['x=2 için n/3=g⁻¹(f(2))=6 olur.','n=18 bulunur.'],variable='n',**kw)
    b.solve(k,'inverse-relation-rational-offset','Tanımlı olduğu aralıkta (g⁻¹∘f)(x)=(2x+n)/(x−1) ve g(5)=f(3) veriliyor. n kaçtır?',4,'(2*3+n)/(3-1)-5',
        ['Gözlem(6+n)/2=5 verir.','6+n=10; n=4.'],variable='n',**kw)
    b.solve(k,'inverse-relation-absolute-shift','Tanımlı olduğu aralıkta (g⁻¹∘f)(x)=|x−n|, g(4)=f(7) ve n<7 veriliyor. n kaçtır?',3,'(7-n)-4',
        ['|7−n|=4 eşitliği ve n<7 koşulu7−n=4 demektir.','n=3 olur.'],variable='n',conditions=[{'left':'n','op':'lt','right':'7'}],**kw)
    b.solve(k,'inverse-relation-reversed-functions','(f⁻¹∘g)(x)=x−n ve f(−2)=g(5) veriliyor. n kaçtır?',7,'5-n-(-2)',
        ['İkinci eşitliğe f⁻¹ uygulanırsa f⁻¹(g(5))=−2 olur.','5−n=−2; n=7.'],variable='n',**kw)
    b.solve(k,'inverse-relation-known-input-image','(g∘f⁻¹)(x)=3x+n, f(4)=2 ve g(4)=11 veriliyor. n kaçtır?',5,'3*2+n-11',
        ['f⁻¹(2)=4 olduğundan g(f⁻¹(2))=g(4)=11’dir.','6+n=11; n=5.'],variable='n',**kw)
    b.solve(k,'inverse-relation-cubic-shift','Tanımlı olduğu aralıkta (g⁻¹∘f)(x)=(x−n)³ ve g(−8)=f(1) veriliyor. n kaçtır?',3,'(1-n)**3+8',
        ['Gözlem(1−n)³=−8 eşitliğini verir.','Gerçek küp kök alınır:1−n=−2, n=3.'],variable='n',**kw)
    b.solve(k,'inverse-relation-radical-domain','Tanımlı olduğu aralıkta (g⁻¹∘f)(x)=√(x+n) ve g(5)=f(4) veriliyor. n kaçtır?',21,'4+n-25',
        ['√(4+n)=5 olup iki taraf da negatife düşmez.','Kareleri alınca4+n=25; n=21 ve kök içi25’tir.'],variable='n',**kw)

def ayt_involution_iterates(b):
    k='involution_iterates';kw={'exam':'AYT','course':'functions','topic':'Fonksiyonlar','subtopic':'Tekrarlı bileşke ve iki adımda geri dönüş'}
    b.calc(k,'iterate-reflection-odd','f(x)=7−x olsun. Başlangıç değeri2’ye f fonksiyonu21 kez art arda uygulanırsa kaç elde edilir?',5,'7-2',
        ['f(f(x))=7−(7−x)=x olduğundan her iki uygulama birbirini götürür.','21 tek olduğu için son değer f(2)=5’tir.'],**kw)
    b.calc(k,'iterate-fraction-even','f(x)=(x+3)/(x−1), x≠1 olsun.5’e f fonksiyonu18 kez uygulanırsa son değer kaç olur?',5,'(((5+3)/(5-1))+3)/(((5+3)/(5-1))-1)',
        ['İki bileşke sadeleştirilince f(f(x))=x bulunur.','18 uygulama9 çift oluşturur; başlangıç5’e dönülür.'],**kw)
    b.calc(k,'iterate-reciprocal-odd','f:ℝ−{0}→ℝ−{0}, f(x)=3/x olsun.6’ya f fonksiyonu17 kez uygulanırsa son değer kaçtır?',s.Rational(1,2),'3/6',
        ['f(f(x))=3/(3/x)=x olduğundan iki adımda geri dönüş vardır.','17 tek olduğu için bir uygulama kalır;3/6=1/2.'],**kw)
    b.calc(k,'iterate-negation-even','f(x)=−x olsun.7’ye f fonksiyonu202 kez uygulanırsa son değer kaçtır?',7,'(-1)**202*7',
        ['Her uygulama işareti değiştirir.','Çift202 uygulamada işaret başlangıçla aynıdır; sonuç7.'],**kw)
    b.calc(k,'iterate-translation-linear-growth','f(x)=x+4 olsun.1’e f fonksiyonu12 kez art arda uygulanırsa son değer kaçtır?',49,'1+12*4',
        ['Her uygulamada4 eklenir; bu fonksiyon iki adımda başlangıca dönmez.','12 kez toplam48 eklenir;1+48=49.'],**kw)
    b.calc(k,'iterate-dilation-geometric-growth','f(x)=2x olsun.3’e f fonksiyonu5 kez uygulanırsa son değer kaçtır?',96,'3*2**5',
        ['Her uygulama değeri2 ile çarpar.','Beş uygulamadan sonra3·2⁵=96 olur.'],**kw)
    b.calc(k,'iterate-rational-involution-odd','f(x)=x/(x−1), x≠1 olsun.3’e f fonksiyonu9 kez uygulanırsa son değer kaçtır?',s.Rational(3,2),'3/(3-1)',
        ['f(f(x))=x olur;3 ile3/2 arasında dönüşüm gerçekleşir.','9 tek olduğundan son değer f(3)=3/2.'],**kw)
    b.calc(k,'iterate-three-step-affine','f(x)=5−2x olsun. (f∘f∘f)(1) kaçtır?',7,'5-2*(5-2*(5-2*1))',
        ['İlk adım f(1)=3, ikinci adım f(3)=−1’dir.','Üçüncü adım f(−1)=7 olur.'],**kw)
    b.identity(k,'iterate-unknown-reflection','f(x)=a−x olsun.4’e f fonksiyonu15 kez uygulanınca9 elde ediliyor.4’e aynı fonksiyon16 kez uygulanırsa kaç elde edilir?',4,['a-4-9'],'a-(a-4)',
        ['f(f(x))=x olduğundan15 adım f(4)=a−4=9 verir; a=13’tür.','16 çift olduğundan sonuç başlangıç4’tür.'],variables=['a'],**kw)
    b.finite(k,'iterate-finite-involution-fixed-count','A={0,1,2} ve f:A→A bire bir ve örten olsun. Her x∈A için f(f(x))=x ve f(0)=1 veriliyor. f(x)=x eşitliğini sağlayan kaç x∈A vardır?',1,{'a':[0,2],'b':[0,2],'c':[0,2]},
        'a!=b and a!=c and b!=c and a==1 and (a*(a==0)+b*(a==1)+c*(a==2))==0 and (a*(b==0)+b*(b==1)+c*(b==2))==1 and (a*(c==0)+b*(c==1)+c*(c==2))==2',
        {'kind':'unique','expression':'(a==0)+(b==1)+(c==2)'},
        ['f(0)=1 ve f(f(0))=0 birlikte f(1)=0 verir.','Bire bir ve örtenlikten kalan değer f(2)=2 olmalıdır; tek sabit nokta2’dir.'],difficulty='hard',**kw)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-evidence',type=Path,default=ROOT/'data/source-read-evidence.json')
    parser.add_argument('--output',type=Path,default=ROOT/'work/issue11-generated-source-ai.json')
    args=parser.parse_args()
    payload=json.loads(args.source_evidence.read_text())
    evidence=payload.get('evidence',[]) if isinstance(payload,dict) else payload
    author=Author(evidence)
    for generate in [mean_conservation,missing_mean,order_statistics,set_cardinality,
            integer_divisor_sets,product_counting,sample_space_probability,proposition_logic,
            ayt_inverse_affine,ayt_rational_inverse,ayt_functional_coefficients,
            ayt_inverse_composition,ayt_domain_range,ayt_inverse_shift_parameter,ayt_involution_iterates]:
        generate(author)
    ids=[q['id'] for q in author.questions]
    assert len(ids)==len(set(ids))
    assert len({q['prompt'] for q in author.questions})==len(author.questions)
    result={'schemaVersion':1,'version':VERSION,'questions':author.questions,
        'summary':{'generated':len(author.questions),'TYT':sum(q['examType']=='TYT' for q in author.questions),
            'AYT':sum(q['examType']=='AYT' for q in author.questions),'sourceParents':len({q['parentQuestionId'] for q in author.questions}),
            'byDifficulty':dict(Counter(q['difficulty'] for q in author.questions)),
            'publicationStatus':'independent_QA_required','sourceProseOrImagesCopied':False},
        'ledger':[{'sourceQuestionId':record['sourceQuestionId'],'sourceReadEvidenceId':record['id'],
            'status':'authored' if any(q['parentQuestionId']==record['sourceQuestionId'] for q in author.questions) else 'not_authored_this_batch',
            'generatedIds':[q['id'] for q in author.questions if q['parentQuestionId']==record['sourceQuestionId']]}
            for record in evidence],
        'skipped':author.skipped}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result['summary'],ensure_ascii=False))

if __name__=='__main__':main()
