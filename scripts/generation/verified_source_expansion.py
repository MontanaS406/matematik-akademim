#!/usr/bin/env python3
"""Eighty structurally distinct exercises from eight newly read private originals.

Actual source pages were read during authoring. This contains only new prose
and source identity metadata, never publisher statements or original figures.
The independent verifier and cross-bank quarantine decide usability.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import sympy as s
from source_derived_generator import Author as BaseAuthor, options

ROOT=Path(__file__).resolve().parents[2]
PARENTS={
 'sample_spread':'ORIG-38351d2b9e81-P002-Q04',
 'mode_median':'ORIG-38351d2b9e81-P002-Q05',
 'frequency':'ORIG-38351d2b9e81-P002-Q06',
 'missing_grade':'ORIG-38351d2b9e81-P003-Q08',
 'score_audit':'ORIG-38351d2b9e81-P003-Q09',
 'finite_image':'ORIG-8d0018059e5e-P002-Q07',
 'binomial_relations':'ORIG-ff7d09cc8415-P003-Q09',
 'pascal_structure':'ORIG-ff7d09cc8415-P004-Q12',
}

class Author(BaseAuthor):
    def __init__(self,evidence):
        by_id={p['sourceQuestionId']:p for p in evidence}
        super().__init__([{**by_id[q],'generationSkills':[skill]} for skill,q in PARENTS.items()])
    def emit(self,skill,slug,prompt,answer,steps,spec,**kw):
        super().emit(skill,'verified14-'+slug,prompt,answer,steps,spec,**kw)
        q=self.questions[-1];q['id']=q['id'].replace('AI-SOURCE-','AI-VERIFIED-',1)
        q['options'],q['answer']['value']=options(answer,q['id'])
        q['familyId']='verified-source-'+skill

def spread(b):
    k='sample_spread';kw={'course':'statistics','topic':'Veri ve İstatistik','subtopic':'Örneklem varyansı ve standart sapma'}
    # Each question explicitly states n−1 when it matters, unlike ambiguous
    # population/sample terminology in otherwise similar source material.
    rows=[
      ('centered-three','2, 4, 6 ölçümlerinin örneklem standart sapması kaçtır? Kareli sapmaların toplamını n−1’e bölüp karekök alınız.',2,'sqrt(((2-4)**2+(4-4)**2+(6-4)**2)/(3-1))',['Ortalama 4, kareli sapmaların toplamı 8.','Örneklem varyansı 8/2=4, standart sapma 2.'],'easy'),
      ('negative-calibration','Bir ölçüm grubunun örneklem standart sapması 4’tür. Her x ölçümü 5−2x ile değiştirilirse yeni örneklem standart sapması kaç olur?',8,'sqrt((-2)**2*4**2)',['Sabit eklemek merkezlenmiş farkları değiştirmez.','−2 ile çarpma her sapmanın mutlak değerini iki katına çıkarır; yeni sapma 8.'],'medium'),
      ('four-point-variance','1, 3, 5, 7 veri grubunda kareli sapmalar toplamı n−1’e bölünerek bulunan örneklem varyansı kaçtır?',s.Rational(20,3),'((1-4)**2+(3-4)**2+(5-4)**2+(7-4)**2)/(4-1)',['Ortalama 4; kareli sapmalar 9,1,1,9.','Toplam 20, örneklem paydası 3; sonuç 20/3.'],'easy'),
      ('population-ratio','Beş farklı ölçüm için aynı kareli sapmalar toplamı kullanılıyor. Birinci varyans n−1’e, ikinci varyans n’ye bölünerek hesaplanıyor. Birinci varyansın ikinciye oranı kaçtır?',s.Rational(5,4),'5/(5-1)',['Farklı ölçümlerde kareli sapmalar toplamı sıfır değildir.','Q/4 ile Q/5’in oranı 5/4 olur.'],'medium'),
      ('from-residual-energy','Dört ölçümün aritmetik ortalamadan sapmalarının kareleri toplamı 48’dir. Örneklem paydası n−1 kullanılırsa standart sapma kaçtır?',4,'sqrt(48/(4-1))',['Örneklem varyansı 48/3=16.','Standart sapma √16=4.'],'easy'),
      ('recover-sample-size','Bir veri grubunda kareli sapmalar toplamı 54, n−1 paydalı örneklem standart sapması 3’tür. Veri sayısı n kaçtır?',7,'54/3**2+1',['9=54/(n−1) ⇒ n−1=6.','Veri sayısı 7 olur.'],'medium'),
      ('constant-sensor','Aynı sıcaklığı gösteren altı sensörün her biri 11 değerini kaydetmiştir. n−1 paydalı örneklem varyansı kaçtır?',0,'6*(11-11)**2/(6-1)',['Bütün değerler ortalamaya eşit.','Altı sapmanın her biri sıfır, varyans da sıfır.'],'easy'),
      ('sample-population-gap','1, 5, 9 ölçümlerinde örneklem varyansı n−1, anakütle varyansı n paydasıyla hesaplanıyor. İki varyansın farkı kaçtır?',s.Rational(16,3),'((1-5)**2+(5-5)**2+(9-5)**2)*(1/(3-1)-1/3)',['Kareli sapmalar toplamı 32.','32/2−32/3=16/3.'],'medium'),
      ('remove-center','−2, 0, 2 ölçümlerinden ortadaki 0 siliniyor. Her iki durumda da n−1 paydalı örneklem varyansı kullanılıyor. Yeni varyans eskisinin kaç katıdır?',2,'(((-2)**2+2**2)/(2-1))/(((-2)**2+0**2+2**2)/(3-1))',['Her iki ortalama da sıfır ve kareli sapmalar toplamı 8.','Payda 2’den 1’e indiği için varyans 4’ten 8’e çıkar; oran 2.'],'hard'),
      ('pairwise-distance','Beş sayının tüm sırasız ikilileri arasındaki farkların kareleri toplamı 60’tır. Σ(i<j)(xi−xj)²=n·Σ(xi−ortalama)² özdeşliğiyle n−1 paydalı örneklem varyansını bulunuz.',3,'60/(5*(5-1))',['Özdeşlikten merkezli kareler toplamı 60/5=12.','Örneklem varyansı 12/4=3.'],'hard'),
    ]
    for slug,prompt,value,expr,steps,diff in rows:b.calc(k,slug,prompt,value,expr,steps,difficulty=diff,**kw)

def ordering(b):
    k='mode_median';kw={'course':'statistics','topic':'Veri ve İstatistik','subtopic':'Mod, medyan ve sıralama'}
    rows=[
      ('paired-centers','1, 2, 2, 3, 7 verilerinin modu ile medyanının toplamı kaçtır?',4,'2+2',['Sıralı beş değerin ortadaki elemanı 2.','En sık görülen de 2; toplam 4.']),
      ('outlier-median','0, 2, 4, 6, 8 listesine 100 ekleniyor. Yeni listenin medyanı kaçtır?',5,'(4+6)/2',['Altı değer sıralandığında ortadaki iki değer 4 ve 6.','Medyan bu iki sayının ortalaması, 5’tir.']),
      ('new-modal-value','1, 3, 5, 7 verilerine iki tane 9 ekleniyor. Yeni grubun modu eksi medyanı kaçtır?',3,'9-(5+7)/2',['Yeni tek mod 9, ortadaki değerler 5 ve 7.','Medyan 6, fark 9−6=3.']),
      ('monotone-transform','Bir grubun tek modu 5, medyanı 3’tür. Her veri x yerine 2x−1 alınırsa yeni mod ile yeni medyan arasındaki fark kaçtır?',4,'(2*5-1)-(2*3-1)',['Artan doğrusal dönüşüm sıralamayı ve tekrar sayılarını korur.','Yeni merkezler 9 ve 5; fark 4.']),
      ('frequency-middle','Bir listede 1 iki kez, 3 dört kez, 7 bir kez yer alıyor. Mod ile medyan arasındaki mutlak fark kaçtır?',0,'abs(3-3)',['Yedi gözlemin dördüncüsü 3.','En sık görülen değer de 3; fark sıfır.']),
      ('remove-modal-block','1, 1, 3, 5, 5, 5, 9 listesindeki bütün 5’ler siliniyor. Kalan grubun medyanı eksi modu kaçtır?',1,'(1+3)/2-1',['Kalan liste 1,1,3,9; medyan (1+3)/2=2.','Tek mod 1 olduğundan fark 1.']),
      ('square-order','1, 4, 4, 7, 10 verilerinin her birinin karesi alınıyor. Yeni listenin medyanı kaçtır?',16,'4**2',['Pozitif sayılarda kare alma sıralamayı korur.','Ortadaki 4 sayısının karesi 16.']),
      ('merged-middle','Bir kutuda 1,2,3; diğerinde 10,11 etiketli kartlar var. Bütün kart etiketlerinin birlikte medyanı kaçtır?',3,'(1+2+3+10+11)-(1+2+10+11)',['Birleşik sıralama 1,2,3,10,11.','Beş değerin üçüncüsü 3.']),
    ]
    for row in rows:b.calc(k,*row,**kw)
    b.finite(k,'repeated-frequency-threshold','2 bir kez, 4 k kez, 8 iki kez yazılıyor. Tek modun 4, medyanın da 4 olması için pozitif tam sayı k en az kaçtır?',3,{'k':[1,20]},'k>2',{'kind':'min','expression':'k'},['4’ün tek mod olması için k>2 olmalı.','k=3 iken sıralı altı değerin ortadaki ikisi 4; en küçük k=3.'],difficulty='hard',**kw)
    b.finite(k,'unknown-repeated-entry','1,3,5,7,x listesinin tek modu 7’dir. x bir rakam olduğuna göre medyan kaçtır?',5,{'x':[0,9]},'x==7',{'kind':'unique','expression':'5+(x-7)'},['Tekrar edilen tek sayının 7 olması x=7 gerektirir.','1,3,5,7,7 listesinin medyanı 5.'],**kw)

def frequencies(b):
    k='frequency';kw={'course':'statistics','topic':'Veri ve İstatistik','subtopic':'Frekans tablosundan istatistik'}
    rows=[
      ('weighted-travel','Bir durakta bekleme süresi 2 dakika olan 3, 5 dakika olan 2, 8 dakika olan 1 kişi vardır. Ortalama bekleme kaç dakikadır?',4,'(2*3+5*2+8)/6',['Toplam bekleme 6+10+8=24 dakika.','Altı kişiye bölünce ortalama 4 dakika.']),
      ('median-from-counts','Bir atölyede 10 cm uzunlukta 2, 20 cm uzunlukta 3, 40 cm uzunlukta 1 çubuk var. Uzunlukların medyanı kaç cm’dir?',20,'(20+20)/2',['Sıralı altı çubuğun üçüncü ve dördüncüsü 20 cm.','Medyan 20 cm.']),
      ('modal-ticket','Satılan bilet fiyatları 15 TL için 4 adet, 20 TL için 7 adet, 30 TL için 3 adettir. Fiyatların modu kaç TL’dir?',20,'15+5',['En yüksek frekans 7.','Bu frekansa ait bilet fiyatı 20 TL.']),
      ('range-ignores-frequency','Ölçüm tablosunda 4 gram 12 kez, 9 gram 1 kez, 17 gram 2 kez görülüyor. Ölçüm açıklığı kaç gramdır?',13,'17-4',['Açıklık en büyük değer eksi en küçük değerdir.','Frekanslardan bağımsız olarak 17−4=13.']),
      ('merge-equal-groups','İki şubeden ilkinin 4 ürünü ortalama 12 TL, ikincinin 6 ürünü ortalama 17 TL’dir. On ürünün ortalama fiyatı kaç TL’dir?',15,'(4*12+6*17)/(4+6)',['Fiyat toplamları 48 ve 102.','150/10=15 TL.']),
      ('frequency-correction','10,20,30 değerlerinin frekansları sırasıyla 2,3,1 yazılmıştır. Son değerin frekansının aslında 3 olduğu anlaşılıyor. Doğru ortalama kaçtır?',s.Rational(85,4),'(10*2+20*3+30*3)/(2+3+3)',['Yeni gözlem sayısı 8, değer toplamı 170.','170/8=85/4.']),
      ('threshold-percentage','Bir kitaplıkta 100 sayfalık 3, 200 sayfalık 5, 300 sayfalık 2 kitap var. En az 200 sayfalı kitapların yüzdesi kaçtır?',70,'100*(5+2)/(3+5+2)',['Koşulu sağlayan 7, toplam 10 kitap.','7/10 ×100=%70.']),
      ('population-spread','0 değeri iki kez, 3 değeri dört kez kaydediliyor. Kareli sapmalar toplamının veri sayısına bölündüğü anakütle varyansı kaçtır?',2,'(2*(0-2)**2+4*(3-2)**2)/6',['Ortalama (0+12)/6=2.','Varyans (8+4)/6=2.']),
      ('cumulative-position','Sıralı veride 2 sayısı 3 kez, 5 sayısı 4 kez, 9 sayısı 2 kez yer alıyor. Baştan sekizinci değer kaçtır?',9,'2+5+2',['İlk üç konum 2, sonraki dört konum 5.','Sekizinci ve dokuzuncu konumlar 9.']),
    ]
    for row in rows:b.calc(k,*row,**kw)
    b.finite(k,'reverse-frequency','Bir listede 4 iki kez, 10 k kez görülüyor. Aritmetik ortalama 8 ise pozitif tam sayı k kaçtır?',4,{'k':[1,20]},'4*2+10*k==8*(2+k)',{'kind':'unique','expression':'k'},['8+10k=16+8k.','2k=8 ⇒ k=4.'],difficulty='hard',**kw)

def missing(b):
    k='missing_grade';kw={'course':'statistics','topic':'Veri ve İstatistik','subtopic':'Ortalama koşulundan bilinmeyen bulma'}
    rows=[
      ('remaining-project','Üç proje notunun ortalaması 78 olmalıdır. İlk iki not 71 ve 83 ise üçüncü not kaç olmalıdır?',80,'3*78-71-83',['Gereken toplam 234.','Bilinen 154 çıkarılınca 80 kalır.']),
      ('double-weight-final','Bir derste ara sınav %40, final %60 ağırlıklıdır. Ara sınav 65 ve hedef başarı notu 80 ise finalden kaç alınmalıdır?',90,'(80-65*Rational(2,5))/Rational(3,5)',['Ara sınavın katkısı 26.','Final katkısı 54 olmalı; 54/0,6=90.']),
      ('paired-missing','Dört deney sonucunun ortalaması 20. İlk ikisi 12 ve 18, son ikisi birbirinden 6 farklıdır. Son iki sonucun küçüğü kaçtır?',22,'(4*20-12-18-6)/2',['Son iki deney toplamı 50.','Küçük x, büyük x+6 ise 2x+6=50; x=22.']),
      ('remove-known-mean','Beş teslimatın ortalama süresi 18 dakikadır. En uzun 30 dakikalık teslimat çıkarılırsa diğer dördünün ortalaması kaç olur?',15,'(5*18-30)/4',['Toplam süre 90; çıkarılınca 60 kalır.','Dört teslimatın ortalaması 60/4=15.']),
      ('add-to-mean','Dört sıcaklık ölçümünün ortalaması 9’dur. Beşinci ölçüm eklenince ortalama 11 oluyor. Eklenen sıcaklık kaçtır?',19,'5*11-4*9',['Önce toplam 36, sonra 55.','Yeni değer fark olan 19.']),
      ('batch-conservation','On makinenin günlük ortalaması 24 parça. Altısının ortalaması 20 ise kalan dört makinenin ortalaması kaç parçadır?',30,'(10*24-6*20)/4',['Toplam 240 parçanın 120’si ilk gruptadır.','Kalan 120 parça dört makineye ait; ortalama 30.']),
      ('replace-a-grade','Altı notun ortalaması 60’tır. 42 olan tek not silinip yerine x yazılınca ortalama 65 oluyor. x kaçtır?',72,'6*65-(6*60-42)',['Ortalama 5 artması toplamın 30 artması demektir.','42 yerine 72 yazılmalıdır.']),
      ('minimal-integer-score','İlk üç sınav notu 62, 70, 73’tür. Dört sınavın ortalamasının en az 70 olması için son sınavdaki en küçük tam sayı not kaçtır?',75,'4*70-62-70-73',['İlk toplam 205, hedef toplam en az 280.','Son not en az 75 olmalı.']),
      ('two-stage-rating','Bir oyunun ilk beş turundaki ortalama puan 14, sonraki üç turundaki 22’dir. Dokuz turun genel ortalaması 18 olsun diye dokuzuncu turda kaç puan gerekir?',26,'9*18-5*14-3*22',['İlk sekiz turun puanı 70+66=136.','Hedef 162; son tur 26 puan.']),
      ('unknown-weighted-hour','Bir cihaz 2 saat saatte 15 litre, sonraki 3 saat saatte x litre üretmiştir. Beş saatin ortalama üretim hızı 21 litre/saat ise x kaçtır?',25,'(5*21-2*15)/3',['Toplam üretim 105 litre; ilk bölüm 30.','Kalan 75 litre üç saatte üretilir; x=25.']),
    ]
    for i,row in enumerate(rows):b.calc(k,*row,difficulty='hard' if i in (1,2,7) else 'medium',**kw)

def correction(b):
    k='score_audit';kw={'course':'statistics','topic':'Veri ve İstatistik','subtopic':'Toplam ve ortalamada düzeltmeler'}
    rows=[
      ('mixed-audit','On iki öğrencinin ortalaması 64. Üç not 4’er puan yükseltilip iki not 6’şar puan düşürülüyor. Yeni ortalama kaçtır?',64,'64+(3*4-2*6)/12',['Artış 12, azalış da 12; toplam değişmez.','Öğrenci sayısı da değişmediği için ortalama 64.']),
      ('digit-reversal','Yirmi kişilik sınıfta bir not 46 yerine 64 yazılmıştır. Yanlış ortalama 72 ise doğru ortalama kaçtır?',s.Rational(711,10),'72-(64-46)/20',['Toplam 18 fazla yazılmıştır.','Ortalama 18/20=0,9 düşer; 71,1.']),
      ('missing-mark-count','On beş öğrencinin ortalamasını 2 puan yükseltmek için bazı notlara 5’er puan ekleniyor. Kaç not düzeltilmiştir?',6,'15*2/5',['Gereken toplam artış 30 puan.','Her not 5 artıyorsa 30/5=6 not.']),
      ('equal-total-different-count','Bir kursun 10 katılımcısının puan ortalaması 18. 30 puanlı biri ayrılıp 12 puanlı biri katılırsa yeni ortalama kaç olur?',s.Rational(81,5),'(10*18-30+12)/10',['Toplam 180’den 162’ye iner, kişi sayısı 10 kalır.','Yeni ortalama 16,2=81/5.']),
      ('class-size-from-error','Tek bir kağıtta 24 puanlık fazla hesap düzeltilince sınıf ortalaması 1,5 puan azalıyor. Sınıfta kaç öğrenci vardır?',16,'24/Rational(3,2)',['Toplam azalış = öğrenci sayısı × ortalama azalışı.','n=24/1,5=16.']),
      ('audit-target','Sekiz notun ortalaması 50. Bir not 12 puan artırılıyor. Ortalama 53 olsun diye ikinci bir not kaç puan artırılmalıdır?',12,'8*(53-50)-12',['Toplam artış 24 olmalı.','İlk 12 puandan sonra ikinci not için 12 puan gerekir.']),
      ('withdraw-and-correct','Beş kişinin ortalaması 40. 20 puanlı kişi ayrıldıktan sonra kalanlardan birine 12 puan ekleniyor. Son ortalama kaçtır?',48,'(5*40-20+12)/4',['Toplam 200’den 180’e düşer, sonra 192 olur.','Dört kişi kaldığı için 192/4=48.']),
      ('team-exchange','A takımında 6 kişinin ortalaması 70, B takımında 4 kişinin ortalaması 55. A’daki 80 puanlı kişi ile B’deki 50 puanlı kişi yer değiştiriyor. A’nın yeni ortalaması kaçtır?',65,'(6*70-80+50)/6',['A toplamı 420−80+50=390.','Altı kişi için 390/6=65.']),
      ('partial-credit-audit','On kağıdın ortalaması 60. Dördünde birer soruya eksik verilen 3 puan eklenip bir kağıttaki 2 fazla puan çıkarılıyor. Yeni ortalama kaçtır?',61,'60+(4*3-2)/10',['Net toplam artış 12−2=10.','On kağıtta ortalama 1 artar, 61 olur.']),
      ('aggregate-transfer','Bir değerlendirici beş kağıdın her birinden 2 puan kesip aynı toplam puanı diğer üç kağıda eşit dağıtıyor. Sekiz kağıdın ilk ortalaması 74 ise son ortalaması kaçtır?',74,'(8*74-5*2+5*2)/8',['Kesilen 10 puanın tamamı tekrar dağıtılıyor.','Toplam ve kağıt sayısı sabit; ortalama 74 kalır.']),
    ]
    for i,row in enumerate(rows):b.calc(k,*row,difficulty='hard' if i in (4,6,7) else 'medium',**kw)

def images(b):
    k='finite_image';kw={'course':'sets','topic':'Kümeler','subtopic':'Sonlu kümenin dönüşümle görüntüsü'}
    rows=[
      ('symmetric-collapse','A={−2,−1,1,2} ve B={x²:x∈A}. B’nin elemanlarının toplamı kaçtır?',5,'1**2+2**2',['Görüntüde −2 ile 2 aynı 4’ü, −1 ile 1 aynı 1’i verir.','Tekrarsız B={1,4}; toplam 5.']),
      ('absolute-shift','A={−3,0,3,5}. B={|x−1|:x∈A} kümesinin eleman sayısı kaçtır?',3,'1+1+1',['Görüntüler 4,1,2,4.','Tekrarsız görüntü {1,2,4}, üç elemanlı.']),
      ('image-intersection','A={0,1,2,3}, B={2x+1:x∈A}, C={1,3,5}. B∩C elemanlarının toplamı kaçtır?',9,'1+3+5',['B={1,3,5,7}.','C bu kümenin içinde; ortak eleman toplamı 9.']),
      ('composition-finite','A={1,2,4}, B={2x−1:x∈A}, C={y+3:y∈B}. C’nin en büyük elemanı kaçtır?',10,'(2*4-1)+3',['Birleşik dönüşüm x↦2x+2.','En büyük giriş 4 için en büyük görüntü 10.']),
      ('rational-domain-filter','A={−1,0,1,2}. B={1/(x+1):x∈A ve x≠−1}. B’nin elemanları toplamı kaçtır?',s.Rational(11,6),'1/(0+1)+1/(1+1)+1/(2+1)',['Tanımsız giriş −1 atılır.','1+1/2+1/3=11/6.']),
      ('image-gap','A={−2,0,1,4} ve B={x²−2x:x∈A}. B’nin en büyük ve en küçük elemanları farkı kaçtır?',9,'8-(-1)',['Görüntüler 8,0,−1,8; B={−1,0,8}.','En büyük 8, en küçük −1; fark 9.']),
      ('constant-on-domain','A={−3,−1,1,3}. Her x∈A için x tek olduğundan B={x² mod 8:x∈A} kümesi kaç elemanlıdır?',1,'(9%8+1%8)/2',['1 ve 9’un 8 ile bölümünden kalan 1.','B={1}; tek elemanlı.']),
      ('square-then-union','A={−1,0,2}, B={x²:x∈A}. A∪B kümesinin elemanları toplamı kaçtır?',6,'-1+0+1+2+4',['B={0,1,4}.','Birleşim {−1,0,1,2,4}; toplam 6.']),
      ('absolute-preimage-count','A={−4,−2,0,2,4}. |x|=2 koşulunu sağlayan A elemanları toplamı kaçtır?',0,'-2+2',['Uygun girdiler −2 ve 2.','Toplamları sıfır.']),
      ('noninjective-set-product','A={−2,−1,0,1,2}, B={x(x−1):x∈A}. B’nin sıfır olmayan farklı elemanlarının çarpımı kaçtır?',12,'2*6',['Görüntüler 6,2,0,0,2; B={0,2,6}.','Sıfır dışı farklı değerler 2 ve 6; çarpım 12.']),
    ]
    for i,row in enumerate(rows):b.calc(k,*row,difficulty='hard' if i in (4,5,9) else 'medium',**kw)

def binomial_relations(b):
    k='binomial_relations';kw={'exam':'AYT','course':'probability','topic':'Sayma ve Binom','subtopic':'Kombinasyon bağıntıları ve simetri'}
    b.finite(k,'symmetry-two-branches','C(12,k)=C(12,2k−3) eşitliğinde her iki alt indis de 0 ile 12 arasında tam sayıdır. Uygun k değerlerinin toplamı kaçtır?',8,{'k':[0,12]},'0<=2*k-3 and 2*k-3<=12 and binomial(12,k)==binomial(12,2*k-3)',{'kind':'sum','expression':'k'},['Aynı indis: k=2k−3 ⇒ k=3.','Tümler indis: k+2k−3=12 ⇒ k=5; toplam 8.'],**kw)
    b.finite(k,'adjacent-equal','C(7,k)=C(7,k+1) ve 0≤k≤6 tam sayı ise k kaçtır?',3,{'k':[0,6]},'binomial(7,k)==binomial(7,k+1)',{'kind':'unique','expression':'k'},['Komşu terimler ancak orta çiftte eşittir.','(7−k)/(k+1)=1 ⇒ k=3.'],**kw)
    b.finite(k,'recover-upper-index','n≥2 tam sayı ve C(n,2)=28 ise n kaçtır?',8,{'n':[2,50]},'binomial(n,2)==28',{'kind':'unique','expression':'n'},['n(n−1)/2=28.','(n−8)(n+7)=0; pozitif kök 8.'],**kw)
    b.calc(k,'adjacent-ratio','C(9,4)/C(9,3) oranı kaçtır?',s.Rational(3,2),'binomial(9,4)/binomial(9,3)',['Faktöriyeller sadeleşince (9−3)/(3+1) kalır.','6/4=3/2.'],**kw)
    b.calc(k,'pascal-merge','C(8,3)+C(8,4) toplamı kaçtır?',126,'binomial(8,3)+binomial(8,4)',['Pascal bağıntısı toplamı C(9,4) yapar.','C(9,4)=126.'],**kw)
    b.finite(k,'ratio-recovers-integral-index','0≤k≤7 tam sayı ve C(8,k+1)=2·C(8,k) ise k kaçtır?',2,{'k':[0,7]},'binomial(8,k+1)==2*binomial(8,k)',{'kind':'unique','expression':'k'},['(8−k)/(k+1)=2.','8−k=2k+2 ⇒ k=2.'],difficulty='hard',**kw)
    b.calc(k,'weighted-cancellation','3·C(10,3)/C(9,2) ifadesinin değeri kaçtır?',10,'3*binomial(10,3)/binomial(9,2)',['r·C(n,r)=n·C(n−1,r−1).','Pay 10·C(9,2), oran 10.'],**kw)
    b.calc(k,'successive-difference','C(10,4)−C(9,4) farkı kaçtır?',84,'binomial(10,4)-binomial(9,4)',['Pascal bağıntısından fark C(9,3).','C(9,3)=84.'],**kw)
    b.calc(k,'partitioned-team','Dört mühendis ve beş tasarımcıdan üç kişilik ekip seçiliyor. En az bir mühendis içeren ekip sayısı kaçtır?',74,'binomial(9,3)-binomial(5,3)',['Tüm ekipler C(9,3)=84.','Mühendissiz C(5,3)=10 ekip çıkarılır; 74.'],**kw)
    b.calc(k,'diagonal-summation','C(3,2)+C(4,2)+C(5,2)+C(6,2) toplamı kaçtır?',34,'binomial(3,2)+binomial(4,2)+binomial(5,2)+binomial(6,2)',['Hokey sopası bağıntısında C(7,3) toplamına C(2,2)=1 de dahildir.','İstenen 35−1=34.'],difficulty='hard',**kw)

def pascal_structure(b):
    k='pascal_structure';kw={'exam':'AYT','course':'probability','topic':'Sayma ve Binom','subtopic':'Pascal üçgeni ve binom toplamları'}
    rows=[
      ('row-with-edges-removed','Pascal üçgeninin dokuz elemanlı satırındaki en soldaki ve en sağdaki 1 siliniyor. Kalan sayıların toplamı kaçtır?',254,'2**8-2',['Dokuz elemanlı satırın indisi 8; tüm toplam 2⁸=256.','Kenarların toplamı 2 çıkarılınca 254.']),
      ('odd-position-sum','Pascal üçgeninde n=6 satırı C(6,0),…,C(6,6) biçimindedir. İndisi tek olan terimlerin toplamı kaçtır?',32,'binomial(6,1)+binomial(6,3)+binomial(6,5)',['(1+1)⁶ ile (1−1)⁶ birlikte tek ve çift indis toplamlarının eşit olduğunu gösterir.','Her biri 2⁵=32.']),
      ('alternating-row','C(5,0)−C(5,1)+C(5,2)−C(5,3)+C(5,4)−C(5,5) kaçtır?',0,'binomial(5,0)-binomial(5,1)+binomial(5,2)-binomial(5,3)+binomial(5,4)-binomial(5,5)',['Toplam (1−1)⁵ açılımıdır.','Sonuç sıfır.']),
      ('weighted-indices','Σ(k=0…5) k·C(5,k) toplamı kaçtır?',80,'1*binomial(5,1)+2*binomial(5,2)+3*binomial(5,3)+4*binomial(5,4)+5*binomial(5,5)',['k·C(5,k)=5·C(4,k−1).','Toplam 5·2⁴=80.']),
      ('square-sum','Pascal üçgeninde n=4 satırının elemanlarının kareleri toplamı kaçtır?',70,'binomial(4,0)**2+binomial(4,1)**2+binomial(4,2)**2+binomial(4,3)**2+binomial(4,4)**2',['Satır 1,4,6,4,1.','Kareler toplamı 1+16+36+16+1=70.']),
      ('recover-center','Pascal üçgeninin bir satırındaki sayıların toplamı 64’tür. Bu satırın ortadaki sayısı kaçtır?',20,'binomial(6,3)',['2ⁿ=64 ⇒ n=6; satır yedi elemanlı.','Ortadaki sayı C(6,3)=20.']),
      ('neighboring-row-growth','Pascal üçgeninde n=7 satırının toplamı ile n=6 satırının toplamı arasındaki fark kaçtır?',64,'2**7-2**6',['Her yeni satırın toplamı öncekinin iki katı.','128−64=64.']),
      ('weighted-second-moment','Σ(k=0…4) k²·C(4,k) toplamı kaçtır?',80,'1**2*binomial(4,1)+2**2*binomial(4,2)+3**2*binomial(4,3)+4**2*binomial(4,4)',['k²=k(k−1)+k ayrımı kullanılır.','4·3·2²+4·2³=48+32=80.']),
      ('evaluated-binomial','C(4,0)+2·C(4,1)+4·C(4,2)+8·C(4,3)+16·C(4,4) toplamı kaçtır?',81,'binomial(4,0)+2*binomial(4,1)+4*binomial(4,2)+8*binomial(4,3)+16*binomial(4,4)',['Toplam (1+2)⁴ binom açılımıdır.','3⁴=81.']),
      ('row-entry-product','Pascal üçgeninin sekiz elemanlı satırında soldan ikinci ile sağdan ikinci terimin çarpımı kaçtır?',49,'binomial(7,1)*binomial(7,6)',['Satırın indisi 7’dir; simetrik iki terim 7.','Çarpımları 49.']),
    ]
    for i,row in enumerate(rows):b.calc(k,*row,difficulty='hard' if i in (3,4,7,8) else 'medium',**kw)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-evidence',type=Path,default=ROOT/'data/source-read-evidence.json')
    p.add_argument('--output',type=Path,default=ROOT/'work/nov14-verified-source-expansion.json')
    a=p.parse_args();author=Author(json.loads(a.source_evidence.read_text())['evidence'])
    for fn in [spread,ordering,frequencies,missing,correction,images,binomial_relations,pascal_structure]:fn(author)
    # Independent verification receives the raw data/domain, not the author's
    # already selected median/mode/image cardinality. It re-sorts, enumerates
    # and collapses repeated values on its own.
    stats={
      'centered-three':([2,4,6],'sqrt(sample_variance)'),
      'four-point-variance':([1,3,5,7],'sample_variance'),
      'constant-sensor':([11]*6,'sample_variance'),
      'sample-population-gap':([1,5,9],'sample_variance-population_variance'),
      'paired-centers':([1,2,2,3,7],'mode+median'),
      'outlier-median':([0,2,4,6,8,100],'median'),
      'new-modal-value':([1,3,5,7,9,9],'mode-median'),
      'frequency-middle':([1,1,3,3,3,3,7],'abs(mode-median)'),
      'remove-modal-block':([1,1,3,9],'median-mode'),
      'square-order':([1,16,16,49,100],'median'),
      'merged-middle':([1,2,3,10,11],'median'),
      'weighted-travel':([2,2,2,5,5,8],'mean'),
      'median-from-counts':([10,10,20,20,20,40],'median'),
      'modal-ticket':([15]*4+[20]*7+[30]*3,'mode'),
      'range-ignores-frequency':([4]*12+[9]+[17]*2,'spread'),
      'frequency-correction':([10]*2+[20]*3+[30]*3,'mean'),
      'population-spread':([0]*2+[3]*4,'population_variance'),
    }
    imagespecs={
      'symmetric-collapse':([-2,-1,1,2],'x**2','sum'),
      'absolute-shift':([-3,0,3,5],'abs(x-1)','count'),
      'composition-finite':([1,2,4],'(2*x-1)+3','maximum'),
      'rational-domain-filter':([0,1,2],'1/(x+1)','sum'),
      'image-gap':([-2,0,1,4],'x**2-2*x','range'),
      'constant-on-domain':([-3,-1,1,3],'x**2%8','count'),
      'noninjective-set-product':([-2,-1,0,1,2],'x*(x-1)','product_nonzero'),
    }
    for q in author.questions:
        slug=q['templateId'].removeprefix('verified14-')
        if slug in stats:
            values,objective=stats[slug]
            q['verificationSpec']={'type':'data_summary','values':values,'objective':objective,'promptAnchor':q['prompt']}
        if slug in imagespecs:
            domain,expr,op=imagespecs[slug]
            q['verificationSpec']={'type':'finite_image','domain':domain,'expression':expr,'operation':op,'promptAnchor':q['prompt']}
        if slug=='cumulative-position':
            q['verificationSpec']={'type':'data_summary','values':[2]*3+[5]*4+[9]*2,'operation':'order','oneBasedIndex':8,'promptAnchor':q['prompt']}
    assert len(author.questions)==80
    counts=Counter(q['parentQuestionId'] for q in author.questions);assert set(counts.values())=={10}
    result={'schemaVersion':1,'version':'verified-private-source-structures-v1','questions':author.questions,
        'ledger':[{'sourceQuestionId':qid,'generatedIds':[q['id'] for q in author.questions if q['parentQuestionId']==qid]} for qid in PARENTS.values()]}
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'drafts':80,'parents':8,'independentAuditRequired':True}))

if __name__=='__main__':main()
