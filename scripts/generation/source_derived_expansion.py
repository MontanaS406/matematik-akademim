#!/usr/bin/env python3
"""Additional independent structures for previously read original questions.

The private source statements/options/solutions were read during authoring.
Only source identity metadata and newly authored mathematics enter this file.
This module does not modify PR #12's first 150 exercises or its legacy bank.
"""
from __future__ import annotations
import argparse
from collections import Counter
import json
from pathlib import Path
from math import factorial
import sympy as s
from source_derived_generator import Author as BaseAuthor, options

ROOT = Path(__file__).resolve().parents[2]
VERSION = 'source-expansion-structural-v1'
PARENTS = {
 'nested':'ORIG-8d0018059e5e-P001-Q02',
 'venn':'ORIG-cca82e35aa09-P001-Q01',
 'digits':'ORIG-ff7d09cc8415-P001-Q02',
 'factorial':'ORIG-ff7d09cc8415-P001-Q03',
 'permutation':'ORIG-ff7d09cc8415-P001-Q04',
 'support':'ORIG-d39fa5113294-P001-Q02',
 'disjoint':'ORIG-d39fa5113294-P001-Q03',
 'equivalence':'ORIG-cf320c53b2bb-P001-Q02',
 'tautology':'ORIG-cf320c53b2bb-P001-Q04',
 'steps':'ORIG-7fc331f83bce-P003-Q01',
 'relations':'ORIG-9317e24dc024-P4-Q15',
 'restricted':'ORIG-9317e24dc024-P7-Q23',
 'counterexample':'ORIG-9317e24dc024-P8-Q25',
 'inverse_expression':'ORIG-9317e24dc024-P8-Q26',
 'composition_replacement':'ORIG-9317e24dc024-P4-Q14',
}

class Author(BaseAuthor):
    def __init__(self,evidence):
        by_id={row['sourceQuestionId']:row for row in evidence}
        selected=[]
        for skill,identifier in PARENTS.items():
            row=by_id.get(identifier)
            if not row or row.get('readStatus')!='read' or row.get('answerStatus')!='verified':
                raise ValueError('A checked, read original is required: '+identifier)
            selected.append({**row,'generationSkills':[skill]})
        super().__init__(selected)

    def emit(self,skill,slug,prompt,answer,steps,spec,**kw):
        super().emit(skill,'nov14-'+slug,prompt,answer,steps,spec,**kw)
        q=self.questions[-1]
        q['id']=q['id'].replace('AI-SOURCE-','AI-NEXT-',1)
        q['options'],q['answer']['value']=options(answer,q['id'])
        q['familyId']='source-next-'+skill

def nested_sets(b):
    k='nested';kw={'course':'sets','topic':'Kümeler','subtopic':'Eleman ile alt kümenin ayrımı'}
    tasks=[
      ('nested-numeric-members','A={1,{1},2,{2,3},4} kümesinin doğal sayı olan kaç elemanı vardır?',3,{'i':[1,5]},'i in (1,3,5)',
       ['1, 2 ve 4 doğrudan elemandır; {1} ve {2,3} ise küme nesneleridir.','Doğal sayı elemanların sayısı 3’tür.']),
      ('nested-set-valued-members','B={0,1,{0},{1},{0,1}} kümesinin elemanlarından kaç tanesi aynı zamanda B’nin bir alt kümesidir?',3,{'i':[1,5]},'i in (3,4,5)',
       ['{0}, {1} ve {0,1} yalnız B’nin elemanlarından oluşur.','0 ve 1 küme değildir; koşulu sağlayan üç küme elemanı vardır.']),
      ('nested-required-object','C={a,b,{a},{a,b}} kümesinin {a} elemanını içeren kaç alt kümesi vardır?',8,{'u':[0,1],'v':[0,1],'w':[0,1],'z':[0,1]},'w == 1',
       ['{a} tek bir zorunlu elemandır.','Diğer üç eleman bağımsız alınabilir veya alınmayabilir: 2³=8.']),
      ('nested-two-element-subsets','D={2,5,{2,5},∅} kümesinin iki elemanlı kaç alt kümesi vardır?',6,{'u':[0,1],'v':[0,1],'w':[0,1],'z':[0,1]},'u+v+w+z == 2',
       ['Boş küme de D’nin bir elemanıdır; toplam dört farklı eleman vardır.','İki eleman seçme sayısı C(4,2)=6’dır.']),
      ('nested-intersection-objects','A={1,2,{1,2},{3}} ve B={2,{1,2},3} için A∩B kaç elemanlıdır?',2,{'i':[1,4]},'i in (2,3)',
       ['Ortak nesneler 2 ve {1,2}’dir.','{3} ile 3 aynı nesne değildir; ortak eleman sayısı 2 olur.']),
      ('nested-powerset-members','A={0,1} ve B={∅,{0},{1},{0,1},2} veriliyor. B∩P(A) kaç elemanlıdır?',4,{'i':[1,5]},'i <= 4',
       ['P(A)={∅,{0},{1},{0,1}} biçimindedir.','Bu dört kümenin hepsi B’de vardır; 2 küme değildir.']),
      ('nested-forbidden-nested-object','A={x,y,{x},∅} kümesinin {x} elemanını içermeyen, fakat x elemanını içeren kaç alt kümesi vardır?',4,{'u':[0,1],'v':[0,1],'w':[0,1],'z':[0,1]},'u == 1 and w == 0',
       ['x alınır, {x} alınmaz; bunlar iki farklı elemandır.','y ve ∅ serbest olduğundan 2²=4 seçenek vardır.']),
      ('nested-subset-both-numbers','A={1,2,{1},3,{2,3}} kümesinin 1 ve 2 elemanlarını birlikte içeren kaç alt kümesi vardır?',8,{'u':[0,1],'v':[0,1],'w':[0,1],'z':[0,1],'t':[0,1]},'u == 1 and v == 1',
       ['1 ve 2 zorunlu seçilir.','Kalan üç nesnenin her biri için iki karar verilir: 8.']),
      ('nested-symmetric-difference','A={a,{a},b} ve B={{a},b,{b}} için A△B kaç elemanlıdır?',2,{'i':[1,4]},'i in (1,4)',
       ['Ortak nesneler {a} ve b’dir.','Yalnız bir kümede bulunan nesneler a ve {b} olduğundan sonuç 2’dir.']),
      ('nested-proper-subsets','A={∅,{∅},1} kümesinin kendisi dışında kaç alt kümesi vardır?',7,{'u':[0,1],'v':[0,1],'w':[0,1]},'not (u == 1 and v == 1 and w == 1)',
       ['∅ ile {∅} farklı iki elemandır; A’nın üç elemanı vardır.','Toplam 2³ alt kümeden A’nın kendisi çıkarılır: 8−1=7.']),
    ]
    for slug,prompt,answer,variables,predicate,steps in tasks:
        b.finite(k,slug,prompt,answer,variables,predicate,{'kind':'count'},steps,**kw)

def venn_operations(b):
    k='venn';kw={'course':'sets','topic':'Kümeler','subtopic':'Küme işlemleri ve tümleyen'}
    tasks=[
      ('venn-outside-first-inside-union','E={1,2,3,4,5,6,7,8,9,10}, A={1,2,5}, B={2,3,6}, C={6,7,9}. A′∩(B∪C) kaç elemanlıdır?',4,'x not in (1,2,5) and x in (2,3,6,7,9)',[1,10],['B∪C={2,3,6,7,9}.','A’daki 2 çıkarılır; {3,6,7,9} kalır.']),
      ('venn-difference-of-intersections','E={0,1,2,3,4,5,6,7,8}, A={0,2,4,6,8}, B={2,3,4,5}, C={4,5,6}. (A∩B)−C kaç elemanlıdır?',1,'x in (0,2,4,6,8) and x in (2,3,4,5) and x not in (4,5,6)',[0,8],['A∩B={2,4}.','C’de bulunan 4 çıkarılır ve yalnız 2 kalır.']),
      ('venn-de-morgan-explicit','E={1,2,3,4,5,6,7,8}, A={1,3,5}, B={3,4,5,6}. (A∪B)′ kaç elemanlıdır?',3,'x not in (1,3,4,5,6)',[1,8],['A∪B={1,3,4,5,6}.','E’de olup birleşimde olmayan {2,7,8} üç elemanlıdır.']),
      ('venn-complement-intersection','E={1,2,3,4,5,6,7,8,9}, A={1,2,4,7}, B={2,3,4,8}. A′∪B′ kaç elemanlıdır?',7,'not (x in (1,2,4,7) and x in (2,3,4,8))',[1,9],['De Morgan ile A′∪B′=(A∩B)′.','Kesişim {2,4} olduğundan 9−2=7.']),
      ('venn-exactly-one-of-three','E={1,2,3,4,5,6,7,8}, A={1,2,3}, B={3,4,5}, C={5,6}. Yalnız bir kümede bulunan kaç eleman vardır?',4,'(x in (1,2,3) and x not in (3,4,5) and x not in (5,6)) or (x not in (1,2,3) and x in (3,4,5) and x not in (5,6)) or (x not in (1,2,3) and x not in (3,4,5) and x in (5,6))',[1,8],['Yalnız A’da {1,2}, yalnız B’de {4}, yalnız C’de {6} vardır.','2+1+1=4.']),
      ('venn-symmetric-overlap','E={1,2,3,4,5,6,7}, A={1,3,5,7}, B={2,3,6,7}. A△B kaç elemanlıdır?',4,'(x in (1,3,5,7) and x not in (2,3,6,7)) or (x not in (1,3,5,7) and x in (2,3,6,7))',[1,7],['Ortak elemanlar 3 ve 7’dir.','Yalnız bir kümedeki {1,2,5,6} dört elemanlıdır.']),
      ('venn-complement-restriction','E={0,1,2,3,4,5,6,7,8,9}, A={0,1,2,3}, B={2,3,4,5}. (A−B)′∩B kaç elemanlıdır?',4,'not (x in (0,1,2,3) and x not in (2,3,4,5)) and x in (2,3,4,5)',[0,9],['A−B={0,1}, bu küme B ile ayrık.','B’nin bütün elemanları (A−B)′ içinde kalır; sonuç 4.']),
      ('venn-two-stage-filter','E={1,2,3,4,5,6,7,8,9,10,11,12}, A çift sayılar, B üçe bölünen sayılardır. A∩B′ kaç elemanlıdır?',4,'x%2 == 0 and x%3 != 0',[1,12],['A={2,4,6,8,10,12}.','B’deki 6 ve 12 çıkarılır; dört sayı kalır.']),
      ('venn-cartesian-filter','A={1,2,3}, B={2,4,6}. A×B’de x<y koşulunu sağlayan kaç (x,y) sıralı ikilisi vardır?',7,'x < y',None,['x=1 için 3; x=2 için 2; x=3 için 2 uygun y vardır.','Toplam 3+2+2=7.']),
      ('venn-minimal-universe','E={1,2,3,4,5,6,7,8}, A={1,2,3,4}, B={3,4,5}. (A∩B)∪(A′∩B′) kaç elemanlıdır?',5,'(x in (1,2,3,4) and x in (3,4,5)) or (x not in (1,2,3,4) and x not in (3,4,5))',[1,8],['İlk kesişim {3,4}, ikinci kesişim {6,7,8}.','Bu ayrık kümelerin birleşimi beş elemanlıdır.']),
    ]
    for slug,prompt,value,predicate,domain,steps in tasks:
        variables={'x':domain} if domain else {'x':[1,3],'y':[1,6]}
        if domain is None:predicate='y in (2,4,6) and '+predicate
        b.finite(k,slug,prompt,value,variables,predicate,{'kind':'count'},steps,**kw)

def digit_counting(b):
    k='digits';kw={'course':'numbers','topic':'Sayılar ve basamaklar','subtopic':'Basamak koşullarına göre sayma'}
    rows=[
      ('digits-distinct-five','0,1,3,5,7 rakamlarıyla rakamları farklı üç basamaklı kaç sayı yazılır?',48,{'a':[0,7],'b':[0,7],'c':[0,7]},'a in (1,3,5,7) and b in (0,1,3,5,7) and c in (0,1,3,5,7) and a!=b and a!=c and b!=c',{'kind':'count'},['Yüzler basamağı 4 türlü seçilir.','Kalan rakamlardan onlar için 4, birler için 3 seçim: 4·4·3=48.']),
      ('digits-all-even-four','0,2,4,6 rakamlarının her birini bir kez kullanarak dört basamaklı kaç çift sayı yazılır?',18,{'a':[0,6],'b':[0,6],'c':[0,6],'d':[0,6]},'a in (2,4,6) and b in (0,2,4,6) and c in (0,2,4,6) and d in (0,2,4,6) and a!=b and a!=c and a!=d and b!=c and b!=d and c!=d',{'kind':'count'},['Bütün rakamlar çift; yalnız başa sıfır gelmesi yasaktır.','3·3·2·1=18.']),
      ('digits-last-zero-case','0,1,2,3 rakamlarıyla rakamları farklı üç basamaklı kaç çift sayı yazılır?',10,{'a':[0,3],'b':[0,3],'c':[0,3]},'a!=0 and a!=b and a!=c and b!=c and c%2==0',{'kind':'count'},['Son rakam 0 ise 3·2=6 sayı vardır.','Son rakam 2 ise başa 1 veya 3 gelir; 2·2=4. Toplam 10.']),
      ('digits-palindromic-code','0,2,4,7 rakamları kullanılarak üç basamaklı kaç palindrom sayı yazılabilir? Rakam tekrarına izin vardır.',12,{'a':[0,7],'b':[0,7],'c':[0,7]},'a in (2,4,7) and b in (0,2,4,7) and c==a',{'kind':'count'},['Yüzler ve birler aynı seçilir; sıfır dışı 3 seçim vardır.','Orta rakam 4 türlü: 3·4=12.']),
      ('digits-exactly-one-zero','0,1,2,3,4 rakamlarıyla, sıfırın tam bir kez geçtiği üç basamaklı kaç sayı yazılır? Diğer rakamlar tekrar edebilir.',32,{'a':[0,4],'b':[0,4],'c':[0,4]},'a!=0 and ((b==0 and c!=0) or (b!=0 and c==0))',{'kind':'count'},['Sıfır onlar veya birler basamağında olur.','Her durumda diğer iki basamak 4’er türlü: 2·4·4=32.']),
      ('digits-increasing-pair','1,2,4,6,8 rakamlarıyla onlar basamağı birler basamağından küçük olan iki basamaklı kaç sayı yazılır?',10,{'a':[1,8],'b':[1,8]},'a in (1,2,4,6,8) and b in (1,2,4,6,8) and a<b',{'kind':'count'},['Her iki farklı rakam çifti küçük olan başa gelecek biçimde tek sayı verir.','C(5,2)=10.']),
      ('digits-divisible-five-repeat','0,1,2,5,8 rakamlarıyla üç basamaklı ve 5’e bölünen kaç sayı yazılır? Rakamlar tekrar edebilir.',40,{'a':[0,8],'b':[0,8],'c':[0,8]},'a in (1,2,5,8) and b in (0,1,2,5,8) and c in (0,5)',{'kind':'count'},['Birler basamağı 0 veya 5’tir.','Yüzler için 4, onlar için 5, birler için 2 seçim: 40.']),
      ('digits-distinct-sum','0,1,2,3,4 rakamlarıyla rakamları farklı ve rakamları toplamı 6 olan üç basamaklı kaç sayı yazılır?',10,{'a':[0,4],'b':[0,4],'c':[0,4]},'a!=0 and a!=b and a!=c and b!=c and a+b+c==6',{'kind':'count'},['Uygun üçlü kümeler {0,2,4} ile {1,2,3}’tür.','İlkinden 6−2=4, ikinciden 6 sıralama; toplam 10.']),
      ('digits-largest-admissible','0,2,3,7 rakamlarıyla rakamları farklı üç basamaklı sayılar yazılıyor. En büyük sayı kaçtır?',732,{'a':[0,7],'b':[0,7],'c':[0,7]},'a in (2,3,7) and b in (0,2,3,7) and c in (0,2,3,7) and a!=b and a!=c and b!=c',{'kind':'max','expression':'100*a+10*b+c'},['En büyük yüzler rakamı 7 seçilir.','Kalan en büyük rakamlar 3 ve 2 olduğundan sayı 732.']),
      ('digits-open-hundreds-range','1,3,5,7,9 rakamlarıyla 300’den büyük ve 700’den küçük üç basamaklı kaç sayı yazılır? Rakamlar tekrar edebilir.',50,{'a':[1,9],'b':[1,9],'c':[1,9]},'a in (3,5) and b in (1,3,5,7,9) and c in (1,3,5,7,9)',{'kind':'count'},['Yüzler basamağı 3 veya 5’tir.','Diğer iki basamak 5’er türlü: 2·5·5=50.']),
    ]
    for slug,prompt,value,variables,predicate,obj,steps in rows:b.finite(k,slug,prompt,value,variables,predicate,obj,steps,**kw)

def factorial_structures(b):
    k='factorial';kw={'course':'probability','topic':'Sayma','subtopic':'Faktöriyel oranları ve koşullar'}
    b.finite(k,'factorial-adjacent-ratio-inverse','n≥2 bir tam sayı ve n!/(n−2)!=30 ise n kaçtır?',6,{'n':[2,30]},'n*(n-1)==30',{'kind':'unique','expression':'n'},['Aradaki çarpanlar n(n−1)=30 olur.','6·5=30 olduğundan n=6.'],**kw)
    b.calc(k,'factorial-ratio-of-differences','(9!−8!)/(8!−7!) ifadesinin değeri kaçtır?',s.Rational(64,7),'(factorial(9)-factorial(8))/(factorial(8)-factorial(7))',['Pay 8!·8, payda 7!·7 biçiminde yazılır.','Oran 8·8/7=64/7 olur.'],**kw)
    b.calc(k,'factorial-difference-collapse','8!/7!−7!/6! ifadesinin değeri kaçtır?',1,'factorial(8)/factorial(7)-factorial(7)/factorial(6)',['İlk oran 8, ikinci oran 7’dir.','Fark 8−7=1.'],difficulty='easy',**kw)
    b.calc(k,'factorial-weighted-telescope','1·1!+2·2!+3·3!+4·4! toplamı kaçtır?',119,'1*factorial(1)+2*factorial(2)+3*factorial(3)+4*factorial(4)',['k·k!=(k+1)!−k! yazılır.','Ara terimler yok olur: 5!−1!=120−1=119.'],**kw)
    b.calc(k,'factorial-common-factor-difference','(9!−8!)/8! ifadesi kaçtır?',8,'(factorial(9)-factorial(8))/factorial(8)',['Pay 8!·(9−1) olarak yazılır.','8! sadeleşir ve 8 kalır.'],**kw)
    b.calc(k,'factorial-ratio-of-sums','(7!+6!)/(6!−5!) ifadesinin değeri kaçtır?',s.Rational(48,5),'(factorial(7)+factorial(6))/(factorial(6)-factorial(5))',['Pay 6!·8, payda 5!·5’tir.','Oran (6·8)/5=48/5.'],**kw)
    b.finite(k,'factorial-valid-domain-count','n bir tam sayıdır. (n−4)!/(8−n)! ifadesinin tanımlı olduğu kaç n değeri vardır?',5,{'n':[-10,20]},'n-4>=0 and 8-n>=0',{'kind':'count'},['Faktöriyel girdileri negatif olamaz: n≥4 ve n≤8.','4,5,6,7,8 olmak üzere 5 değer vardır.'],**kw)
    b.calc(k,'factorial-prime-five-exponent','25! sayısında çarpan olarak en fazla kaç tane 5 bulunur?',6,'floor(25/5)+floor(25/25)',['Her 5’in katı bir, her 25’in katı bir ek 5 verir.','5+1=6.'],**kw)
    b.finite(k,'factorial-first-thousand-multiple','n! sayısı 1000’e tam bölünüyor. Pozitif tam sayı n’nin en küçük değeri kaçtır?',15,{'n':[1,30]},'factorial(n)%1000 == 0',{'kind':'min','expression':'n'},['1000=2³·5³; sınırlayıcı çarpan 5’tir.','15!’te üç tane 5 vardır; daha küçük faktöriyellerde yeterli 5 yoktur.'],difficulty='hard',**kw)
    b.calc(k,'factorial-central-selection','Sekiz kişiden sıra gözetmeden dört kişi seçilecektir. 8!/(4!·4!) işlemiyle bulunan seçim sayısı kaçtır?',70,'factorial(8)/(factorial(4)*factorial(4))',['8!/(4!4!)=(8·7·6·5)/(4·3·2·1).','1680/24=70.'],**kw)

def permutation_structures(b):
    k='permutation';kw={'course':'probability','topic':'Sayma','subtopic':'Sıralama ve permütasyon koşulları'}
    rows=[
      ('permutation-three-medals','Altı finalist arasından altın, gümüş ve bronz ödülleri farklı kişilere veriliyor. Kaç sonuç vardır?',120,'6*5*4',['Ödüllerin türleri farklı olduğundan sıra önemlidir.','6·5·4=120.']),
      ('permutation-adjacent-books','Beş farklı kitap bir rafa diziliyor. Belirlenmiş iki kitap yan yana bulunacaksa kaç diziliş vardır?',48,'2*factorial(4)',['İki kitap tek blok kabul edilince dört nesne 4! türlü dizilir.','Blok içi sıra 2 türlü: 2·24=48.']),
      ('permutation-fixed-winner','Altı kişilik yarışta ilk üç sıra doldurulacak ve Ayla mutlaka birinci olacaktır. Kaç farklı ilk üç vardır?',20,'5*4',['Birinci sıra sabittir.','İkinci ve üçüncü sıraya kalan 5 kişiden sıralı seçim: 5·4=20.']),
      ('permutation-fixed-final-letter','A,B,C,D,E harfleriyle tekrarsız dört harfli bir kod yazılıyor. Son harf A ise kaç kod vardır?',24,'4*3*2',['A sona sabitlenir.','Diğer üç yere dört farklı harften sıralı seçim yapılır: 24.']),
      ('permutation-ranked-assistants','Yedi öğrenciden bir başkan, birinci yardımcı ve ikinci yardımcı seçiliyor. Aynı kişi iki görev alamaz. Kaç seçim vardır?',210,'7*6*5',['Üç görev birbirinden farklıdır.','7·6·5=210.']),
      ('permutation-relative-letter-order','A,E,K,L harfleri birer kez kullanılarak diziliyor. A harfi E’den önce gelecekse kaç diziliş vardır?',12,'factorial(4)/2',['4! dizilişin her birinde A ile E yer değiştirilerek eşlenir.','Yarısında A önce gelir: 24/2=12.']),
      ('permutation-round-table','Beş kişi yuvarlak masa etrafına oturuyor. Yalnız döndürmeler aynı, ayna görüntüleri farklı sayılıyor. Kaç oturma vardır?',24,'factorial(4)',['Bir kişinin yeri sabitlenerek dönme eşdeğerliği kaldırılır.','Kalan dört kişi 4!=24 türlü oturur.']),
      ('permutation-mandatory-selected-book','Beş farklı kitaptan üçü seçilip sıralanıyor. Belirli bir kitap mutlaka kullanılacaksa kaç sonuç vardır?',36,'5*4*3-4*3*2',['Bütün sıralı seçimler 60’tır.','Belirli kitabı içermeyen 24 seçim çıkarılır: 36.']),
      ('permutation-odd-distinct-number','1,2,3,4 rakamlarından tekrarsız üç basamaklı kaç tek sayı yazılır?',12,'2*3*2',['Birler basamağı 1 veya 3’tür.','Kalan iki konuma 3 ve 2 seçim: 12.']),
      ('permutation-separated-consonants','A,E,I,B,C harflerinin her biri bir kez kullanılarak diziliyor. B ve C yan yana olmayacaksa kaç diziliş vardır?',72,'factorial(5)-2*factorial(4)',['Toplam 5!=120 diziliş vardır.','B,C bloğuyla 2·4!=48 yasak diziliş çıkarılır: 72.']),
    ]
    for slug,prompt,value,expr,steps in rows:b.calc(k,slug,prompt,value,expr,steps,**kw)

def event_support(b):
    k='support';kw={'course':'probability','topic':'Olasılık','subtopic':'Örnek uzayın sınırları ve imkânsız olay'}
    b.finite(k,'support-largest-two-dice-sum','İki standart altı yüzlü zarın üst yüzlerindeki sayılar toplanıyor. Mümkün olan en büyük toplam kaçtır?',12,{'a':[1,6],'b':[1,6]},'True',{'kind':'max','expression':'a+b'},['Her zar en çok 6 gelir.','6+6=12 mümkündür ve daha büyük toplam olamaz.'],difficulty='easy',**kw)
    b.finite(k,'support-unattainable-target-count','İki standart zar atılıyor. 1’den 20’ye kadar toplam hedefleri içinde kaç tanesi hiçbir sonuçla elde edilemez?',9,{'n':[1,20]},'n<2 or n>12',{'kind':'count'},['Mümkün toplamlar 2’den 12’ye kadardır.','1 ve 13–20 arasındaki sekiz hedef imkânsızdır; toplam 9.'],**kw)
    b.finite(k,'support-zero-product','İki standart zar atılıyor. Üst yüzlerdeki sayıların çarpımının sıfır olduğu kaç sıralı sonuç vardır?',0,{'a':[1,6],'b':[1,6]},'a*b==0',{'kind':'count'},['Zarlarda 0 yüzü yoktur.','İki pozitif sayının çarpımı sıfır olamaz.'],**kw)
    b.finite(k,'support-product-spread','İlk kutudan 2,5,8 sayılarından, ikinci kutudan 1,4 sayılarından biri seçilip çarpılıyor. En büyük ve en küçük çarpımın farkı kaçtır?',30,{'a':[2,8],'b':[1,4]},'a in (2,5,8) and b in (1,4)',{'kind':'max','expression':'a*b-2'},['En küçük çarpım 2·1=2, en büyük çarpım 8·4=32’dir.','Fark 32−2=30.'],**kw)
    b.finite(k,'support-square-threshold','1’den 9’a kadar numaralı dokuz karttan birinin numarası seçiliyor. Karesi 36’dan büyük olan kaç kart numarası mümkündür?',3,{'n':[1,9]},'n*n>36',{'kind':'count'},['Pozitif n için n²>36 ancak n>6 iken sağlanır.','7,8,9 olmak üzere üç kart.'],**kw)
    b.finite(k,'support-four-sided-targets','İki dört yüzlü zarın yüzleri 1,2,3,4’tür. Toplam hedefleri 1,2,8,9,10 arasından kaç tanesi mümkündür?',2,{'n':[1,10]},'n in (1,2,8,9,10) and n>=2 and n<=8',{'kind':'count'},['Mümkün toplam aralığı 2–8’dir.','Listedeki yalnız 2 ve 8 bu aralıktadır.'],**kw)
    b.finite(k,'support-distinct-card-sums','1,2,3,4 numaralı kartlardan iki farklı kart seçiliyor. 0’dan 10’a kadar kaç tam sayı, seçilen iki numaranın toplamı olamaz?',6,{'n':[0,10]},'n<3 or n>7',{'kind':'count'},['Mümkün toplamlar 3,4,5,6,7’dir.','0–10 arasındaki 11 hedeften 5’i mümkün; 6’sı imkânsızdır.'],**kw)
    b.calc(k,'support-certain-even-label','Yüzleri 2,4,6,8,10 ile etiketlenmiş adil bir beş yüzlü zar atılıyor. Çift sayı gelme olasılığı kaçtır?',1,'5/5',['Beş yüzün tamamı çift sayı taşır.','Uygun çıktı sayısı/örnek uzay sayısı=5/5=1.'],difficulty='easy',**kw)
    b.solve(k,'support-inverse-maximum','Bir zarın yüzlerinde 1’den n’ye kadar ardışık pozitif tam sayılar vardır. Bu zar ile standart altı yüzlü zarın sonuçları çarpıldığında en büyük değer 42 olabiliyor. n kaçtır?',7,'6*x-42',['En büyük çarpım n·6’dır.','6n=42 ⇒ n=7.'],conditions=[{'left':'x','op':'gt','right':'0'}],**kw)
    b.finite(k,'support-bounded-difference','Birinci çark 1,3,5; ikinci çark 2,4,6 değerlerini alıyor. İki değerin mutlak farkının 4 olduğu kaç sıralı çıktı vardır?',0,{'a':[1,5],'b':[2,6]},'a in (1,3,5) and b in (2,4,6) and (a-b==4 or b-a==4)',{'kind':'count'},['Tek sayı ile çift sayının farkı daima tektir.','4 çift olduğundan böyle bir çıktı yoktur.'],**kw)

def disjoint_events(b):
    k='disjoint';kw={'course':'probability','topic':'Olasılık','subtopic':'Ayrık olaylar ve birleşim'}
    b.finite(k,'disjoint-explicit-union','Örnek uzay {1,2,3,4,5,6,7,8,9,10}; A={1,3,5}, B={2,4,6}. A∪B kaç elemanlıdır?',6,{'x':[1,10]},'x in (1,3,5) or x in (2,4,6)',{'kind':'count'},['Kesişim boş olduğu için elemanlar iki kez sayılmaz.','3+3=6.'],**kw)
    b.calc(k,'disjoint-parity-partition','1’den 12’ye kadar numaralı kartlardan biri eş olasılıkla seçiliyor. A çift, B tek numara olayıdır. A∪B olasılığı kaçtır?',1,'6/12+6/12',['Her çıktı tam olarak A veya B’ye girer.','Ayrık iki olay örnek uzayı kaplar; toplam olasılık 1.'],**kw)
    b.finite(k,'disjoint-not-disjoint-detection','Örnek uzay 1’den 12’ye kadardır. A üçe bölünen, B ise 8’den büyük sayı olayıdır. A∩B kaç elemanlıdır?',2,{'x':[1,12]},'x%3==0 and x>8',{'kind':'count'},['8’den büyük üç katları 9 ve 12’dir.','Kesişim iki elemanlı olduğu için olaylar ayrık değildir.'],**kw)
    b.finite(k,'disjoint-separating-threshold','Örnek uzay {1,2,...,10}. A={x:x≤k}, B={x:x≥7}. k∈{1,2,...,10} için A ile B’nin ayrık olduğu kaç k değeri vardır?',6,{'k':[1,10]},'k<7',{'kind':'count'},['A’nın en büyük elemanı 7’ye ulaşmamalıdır.','k=1,2,3,4,5,6 mümkündür.'],**kw)
    b.finite(k,'disjoint-exactly-one-property','1’den 12’ye kadar bir tam sayı seçiliyor. Sayının çift olma ve üçe bölünme özelliklerinden tam birini taşıdığı kaç çıktı vardır?',6,{'x':[1,12]},'(x%2==0 and x%3!=0) or (x%2!=0 and x%3==0)',{'kind':'count'},['Çiftler 6, üç katları 4; her ikisini taşıyanlar 6 ve 12’dir.','Tam bir özellik: 6+4−2·2=6.'],**kw)
    b.calc(k,'disjoint-probability-complement','A ile B ayrık olaylardır. P(A)=1/5 ve P(B)=3/10 ise hiçbirinin gerçekleşmeme olasılığı kaçtır?',s.Rational(1,2),'1-1/5-3/10',['Ayrık olayların birleşimi 1/5+3/10=1/2.','Tümleyen olasılığı 1−1/2=1/2.'],**kw)
    b.finite(k,'disjoint-dice-equivalent-events','İki standart zar atılıyor. A toplamın 3, B çarpımın 2 olmasıdır. A∩B’de kaç sıralı sonuç vardır?',2,{'a':[1,6],'b':[1,6]},'a+b==3 and a*b==2',{'kind':'count'},['Her iki koşulu (1,2) ile (2,1) sağlar.','İki olay bu deneyde aynı iki çıktıyı içerir.'],**kw)
    b.calc(k,'disjoint-largest-second-set','30 elemanlı bir örnek uzayda A olayı 17 elemanlıdır. A ile ayrık B olayının eleman sayısı en çok kaçtır?',13,'30-17',['B, A’nın dışında kalmalıdır.','A’nın dışında 30−17=13 çıktı vardır.'],**kw)
    b.finite(k,'disjoint-withdraw-one-common','A={1,2,3,4}, B={4,5,6}. Yalnız B’den eleman silerek iki küme ayrık yapılacak. En az kaç eleman silinmelidir?',1,{'x':[1,6]},'x in (1,2,3,4) and x in (4,5,6)',{'kind':'count'},['Ortak tek eleman 4’tür.','B’den yalnız 4’ü silmek yeterlidir.'],**kw)
    b.calc(k,'disjoint-union-probability-counts','12 eş olasılıklı çıktıdan A={2,4,6,8,10,12}, B={3,9} olayları tanımlanıyor. A veya B olasılığı kaçtır?',s.Rational(2,3),'(6+2)/12',['A’daki sayılar çift, B’dekiler tek olduğu için olaylar ayrıktır.','Birleşim 8 çıktı; 8/12=2/3.'],**kw)

def logical_equivalence(b):
    k='equivalence';kw={'course':'sets','topic':'Mantık','subtopic':'Önerme eşdeğerliği ve doğruluk koşulları'}
    rows=[
      ('logic-equal-truth-values','p ve q önermeleri için p≡q doğrudur. Kaç farklı (p,q) doğruluk değeri çifti vardır?',2,{'p':[0,1],'q':[0,1]},'p==q',['Eşdeğerlik iki doğruluk değeri aynı iken doğrudur.','(0,0) ve (1,1) olmak üzere iki çift.']),
      ('logic-negated-equal-values','p′≡q doğru olacak biçimde kaç farklı (p,q) doğruluk değeri çifti vardır?',2,{'p':[0,1],'q':[0,1]},'1-p==q',['q, p’nin değili olmalıdır.','(0,1) ve (1,0) olmak üzere iki çift.']),
      ('logic-one-free-proposition','p=1 ve q=0 koşullarında r serbesttir. (p,q,r) için kaç doğruluk ataması vardır?',2,{'p':[0,1],'q':[0,1],'r':[0,1]},'p==1 and q==0',['p ve q sabittir.','r=0 veya r=1 seçilebilir.']),
      ('logic-exactly-one-true','p∨q doğru, p∧q yanlıştır. Kaç farklı (p,q) doğruluk değeri çifti vardır?',2,{'p':[0,1],'q':[0,1]},'(p or q) and not (p and q)',['En az biri doğru, ikisi birlikte doğru değildir.','Tam biri doğrudur: (1,0),(0,1).']),
      ('logic-implication-chain','p, p→q ve q→r önermelerinin tümü doğrudur. Kaç farklı (p,q,r) doğruluk ataması vardır?',1,{'p':[0,1],'q':[0,1],'r':[0,1]},'p and ((not p) or q) and ((not q) or r)',['p doğru olduğundan ilk gerektirme q’yu doğru yapar.','q doğru olduğundan r de doğrudur; yalnız (1,1,1).']),
      ('logic-equal-pair-fixed-third','p′ yanlış ve q≡r doğrudur. Kaç farklı (p,q,r) ataması vardır?',2,{'p':[0,1],'q':[0,1],'r':[0,1]},'p==1 and q==r',['p=1 sabittir.','q,r ikisi birden 0 veya ikisi birden 1 olabilir.']),
      ('logic-equivalence-transitivity','p≡q, q≡r, p≡r ifadelerinden tam ikisinin doğru olduğu kaç doğruluk ataması vardır?',0,{'p':[0,1],'q':[0,1],'r':[0,1]},'(p==q and q==r and p!=r) or (p==q and q!=r and p==r) or (p!=q and q==r and p==r)',['İki eşitlik doğruysa üçüncü eşitlik de doğru olur.','Tam iki doğru eşitlik mümkün değildir.']),
      ('logic-equal-then-different','p≡q doğru ve q≡r yanlıştır. Kaç farklı (p,q,r) ataması vardır?',2,{'p':[0,1],'q':[0,1],'r':[0,1]},'p==q and q!=r',['p=q değeri 0 veya 1 seçilir.','r bunun zıddı olmak zorundadır; iki atama.']),
      ('logic-equal-to-disjunction','p≡(q∨r) doğru olacak biçimde kaç (p,q,r) doğruluk ataması vardır?',4,{'p':[0,1],'q':[0,1],'r':[0,1]},'p==1-(1-q)*(1-r)',['q,r için dört çift vardır.','Her çift q∨r’yi ve dolayısıyla p’yi tek biçimde belirler.']),
      ('logic-mutual-implication-equality','(p→q)≡(q→p) ifadesini doğru yapan kaç (p,q) doğruluk değeri çifti vardır?',2,{'p':[0,1],'q':[0,1]},'((not p) or q)==((not q) or p)',['p≠q olursa gerektirmelerden yalnız biri yanlıştır.','p=q olan iki çiftte gerektirmeler eşdeğerdir.']),
    ]
    for slug,prompt,value,variables,pred,steps in rows:b.finite(k,slug,prompt,value,variables,pred,{'kind':'count'},steps,**kw)

def tautological_reasoning(b):
    k='tautology';kw={'course':'sets','topic':'Mantık','subtopic':'Totoloji, çelişki ve sadeleştirme'}
    rows=[
      ('tautology-no-false-input','p∨p′ devresinin çıkışını 0 yapan kaç (p,q) doğruluk ataması vardır? q devrede kullanılmayan bir giriş olabilir.',0,{'p':[0,1],'q':[0,1]},'not (p or not p)',['p ile değili birlikte yanlış olamaz.','q ne olursa olsun çıkış 1; uygun atama yoktur.']),
      ('tautology-distributive-reduction','(p∧q)∨(p∧q′) çıkışının 1 olduğu kaç (p,q) ataması vardır?',2,{'p':[0,1],'q':[0,1]},'(p and q) or (p and not q)',['p ortak alınır: p∧(q∨q′)=p.','p=1 iken q’nun iki değeri de uygundur.']),
      ('tautology-contradiction-extension','p∧p′∧r ifadesi kaç (p,q,r) doğruluk atamasında 0’dır?',8,{'p':[0,1],'q':[0,1],'r':[0,1]},'not (p and not p and r)',['p∧p′ daima 0’dır.','Üç değişkenin 2³=8 atamasında da sonuç 0.']),
      ('tautology-absorption-pair','p∧(p∨q) ifadesi doğruyken p′∨r de doğru olsun. Kaç (p,q,r) ataması vardır?',2,{'p':[0,1],'q':[0,1],'r':[0,1]},'p and (p or q) and ((not p) or r)',['İlk koşul p=1 gerektirir.','İkinci koşul r=1 yapar; q serbest olduğundan iki atama.']),
      ('tautology-modus-ponens-counterexample','[(p→q)∧p]→q önermesini yanlış yapan kaç (p,q) ataması vardır?',0,{'p':[0,1],'q':[0,1]},'not ((not (((not p) or q) and p)) or q)',['Yanlış gerektirmede öncül doğru, sonuç yanlış olmalıdır.','Öncül p=1 ve p→q doğru dediğinden q=1 çıkar; çelişki.']),
      ('tautology-de-morgan-nand','(p∧q)′ doğru ve p doğru olduğunda q kaç değer alabilir?',1,{'p':[0,1],'q':[0,1]},'not (p and q) and p',['p=1 için p∧q=q.','q’nun değili doğru olacağından yalnız q=0 mümkündür.']),
      ('tautology-three-switch-parity','p,q,r girişlerinden tam ikisi 1 olduğunda bir lamba yanıyor. Kaç giriş üçlüsünde lamba yanar?',3,{'p':[0,1],'q':[0,1],'r':[0,1]},'p+q+r==2',['Sönük kalacak tek giriş seçilir.','Üç girişten biri seçileceği için 3 durum.']),
      ('tautology-equivalence-contradiction','(p≡q)∧(p≡q′) ifadesini doğru yapan kaç (p,q) ataması vardır?',0,{'p':[0,1],'q':[0,1]},'p==q and p==(not q)',['p aynı anda q’ya ve q’nun değiline eşit olamaz.','İfade çelişkidir.']),
      ('tautology-material-implication','p∨q′ ifadesi yalnız bir (p,q) atamasında yanlıştır. Bu atamada p+q kaçtır?',1,{'p':[0,1],'q':[0,1]},'not (p or not q)',{'kind':'unique','expression':'p+q'},['Yanlış veya ifadesinde her iki parça yanlıştır.','p=0, q=1; toplam 1.']),
      ('tautology-conditional-circuit','(p→q)∧(p→q′) devresi 1 çıkışı veriyor. Kaç farklı (p,q) ataması vardır?',2,{'p':[0,1],'q':[0,1]},'((not p) or q) and ((not p) or (not q))',['İfade p′∨(q∧q′)=p′ biçiminde sadeleşir.','p=0, q ise serbest: iki atama.']),
    ]
    for row in rows:
        if len(row)==7:slug,prompt,value,variables,pred,obj,steps=row
        else:slug,prompt,value,variables,pred,steps=row;obj={'kind':'count'}
        b.finite(k,slug,prompt,value,variables,pred,obj,steps,**kw)

def motion_steps(b):
    k='steps';kw={'course':'problems','topic':'Problemler','subtopic':'Birim adım, yön ve uzaklık'}
    b.solve(k,'motion-calibrated-forward','Bir robot duvardan 11 metre uzaktadır. Eşit uzunlukta 4 adım uzaklaşınca mesafe 13 metre oluyor. İlk konumuna döndükten sonra duvara uzaklığını 8 metreye indirmek için kaç eşit adımı duvara doğru atmalıdır?',6,'11-x*((13-11)/4)-8',['Bir adım (13−11)/4=0,5 metredir.','11−8=3 metre yaklaşmak için 3/0,5=6 adım gerekir.'],**kw)
    b.solve(k,'motion-return-after-detour','Bir yürüyüşçü başlangıç çizgisinden aynı doğrultuda 9 eşit adım ileri, ardından 4 eşit adım geri gidiyor ve çizgiden 3 metre uzakta kalıyor. Bir adım kaç metredir?',s.Rational(3,5),'(9-4)*x-3',['Net ilerleme 5 adımdır.','5 adım 3 metre olduğundan bir adım 3/5 metredir.'],**kw)
    b.calc(k,'motion-two-robots-step-ratio','Birinci robot 8 adımda, ikinci robot 12 adımda aynı 6 metrelik yolu alıyor. Birinci robotun adım uzunluğunun ikincininkine oranı kaçtır?',s.Rational(3,2),'(6/8)/(6/12)',['Adım uzunlukları 6/8 ve 6/12 metredir.','Oran 12/8=3/2.'],**kw)
    b.solve(k,'motion-mixed-step-lengths','Bir oyuncak 0,4 metrelik x kısa adım ve 0,7 metrelik 6 uzun adımla toplam 7 metre gidiyor. x kaçtır?',7,'Rational(4,10)*x+6*Rational(7,10)-7',['Uzun adımlar 4,2 metredir.','Kalan 2,8 metreyi 0,4’e böl: 7 kısa adım.'],**kw)
    b.calc(k,'motion-half-distance-target','Bir sensörün duvara uzaklığı 18 metredir. Her adım 0,75 metre yaklaşır. Başlangıç uzaklığını yarıya indirmek için kaç adım gerekir?',12,'(18-18/2)/Rational(75,100)',['Hedef uzaklık 9 metredir.','9 metre yaklaşma /0,75 metre =12 adım.'],**kw)
    b.solve(k,'motion-symmetric-readings','Bir çocuk aynı başlangıç noktasından yapılan iki ayrı denemede duvara doğru 3, duvardan uzağa 5 eşit adım atıyor. Denemelerin sonundaki duvar uzaklıkları sırasıyla 8 ve 12 metredir. Bir adım uzunluğu kaç metredir?',s.Rational(1,2),'8+3*x+5*x-12',['İki konumun farkı toplam 8 adımdır.','12−8=4 metre; adım 4/8=1/2 metre.'],**kw)
    b.calc(k,'motion-reading-error-cancels','Bir ölçer her okumaya 0,2 metre fazla ekliyor. Robot 5 eşit adım uzaklaşmadan önce 6,2; sonra 8,7 metre okuyor. Gerçek adım uzunluğu kaç metredir?',s.Rational(1,2),'(Rational(87,10)-Rational(62,10))/5',['Sabit ölçüm hatası fark alınca yok olur.','2,5/5=0,5 metre.'],**kw)
    b.solve(k,'motion-changing-stride','Bir sporcu ilk 5 adımını 0,6 metre, sonraki adımlarını 0,8 metre uzunlukta atıyor. Toplam 11 metre gittiğinde kaç uzun adım atmıştır?',10,'5*Rational(6,10)+Rational(8,10)*x-11',['İlk beş adım 3 metre eder.','Kalan 8 metre /0,8=10 uzun adım.'],**kw)
    b.calc(k,'motion-reverse-number','Bir araç her komutta 1,2 metre ileri veya 0,8 metre geri gidiyor. 7 ileri, 3 geri komutundan sonra net kaç metre ilerler?',6,'7*Rational(12,10)-3*Rational(8,10)',['İleri toplam 8,4, geri toplam 2,4 metredir.','Net 8,4−2,4=6 metre.'],**kw)
    b.solve(k,'motion-equal-total-trips','A robotu x adımının her birini 0,9 metre, B robotu x+3 adımının her birini 0,6 metre atıyor. Aldıkları yollar eşitse x kaçtır?',6,'Rational(9,10)*x-Rational(6,10)*(x+3)',['0,9x=0,6x+1,8.','0,3x=1,8 ⇒ x=6.'],**kw)

def functional_relations(b):
    k='relations';kw={'exam':'AYT','course':'functions','topic':'Fonksiyonlar','subtopic':'Ters bileşkeden fonksiyon bağıntısı'}
    tasks=[
      ('relation-inverse-value','f,g:ℝ→ℝ bire bir ve örtendir. g⁻¹∘f birim fonksiyon ve f(x)+g(x)=8x−6 ise f⁻¹(17) kaçtır?',5,'4*x-3-17',['g⁻¹∘f=I ⇒ f=g.','f(x)=4x−3; 4x−3=17 ⇒ x=5.']),
      ('relation-weighted-sum','f,g:ℝ→ℝ bire bir ve örtendir. f⁻¹∘g=I ve 2f(x)+3g(x)=15x+20 ise f(−2) kaçtır?',-2,'x-(3*(-2)+4)',['f=g olduğundan 5f(x)=15x+20.','f(x)=3x+4, f(−2)=−2.']),
      ('relation-two-iterate','g⁻¹∘f=I ve f(x)+g(x)=4x+2 olan bijektif f,g için f(f(3)) kaçtır?',15,'x-(2*(2*3+1)+1)',['f=g=2x+1 olur.','f(3)=7 ve f(7)=15.']),
      ('relation-fixed-point','f,g bijektif, f⁻¹∘g=I ve f(x)+g(x)=6x−8. f(t)=t eşitliğini sağlayan t kaçtır?',2,'(3*x-4)-x',['f=g=3x−4.','3t−4=t ⇒ t=2.']),
      ('relation-summed-preimages','f,g bijektif, g⁻¹∘f=I ve f(x)+g(x)=2x+10. f⁻¹(7)+g⁻¹(12) kaçtır?',9,'x-((7-5)+(12-5))',['f=g=x+5, tersleri x−5 olur.','2+7=9.']),
      ('relation-parameter-observation','f,g:ℝ→ℝ bijektif ve f⁻¹∘g=I. f(x)+g(x)=2ax+6 ve f(4)=15 ise a kaçtır?',3,'4*x+3-15',['f=g olduğundan f(x)=ax+3.','4a+3=15 ⇒ a=3.']),
      ('relation-image-interval','f,g:ℝ→ℝ bijektif, g⁻¹∘f=I ve f(x)+g(x)=−4x+12. f([1,4]) görüntü aralığının uzunluğu kaçtır?',6,'x-((-2*1+6)-(-2*4+6))',['f=g=−2x+6 azalandır.','Uç görüntüler 4 ve −2; aralık uzunluğu 6.']),
      ('relation-crossed-identity','f,g:ℝ→ℝ bijektif, g⁻¹(f(3x))=3x ve f(x)+g(x)=10x−4. (g∘f⁻¹)(9) kaçtır?',9,'x-9',['3x bütün gerçek sayıları tarar; f=g olur.','g∘f⁻¹ birim olduğundan sonuç 9.']),
      ('relation-reconstruct-zero','f,g bijektif, f⁻¹∘g=I. f(x)+g(x)=−6x+18 ise f’nin sıfırı kaçtır?',3,'-3*x+9',['f=g=−3x+9.','−3x+9=0 ⇒ x=3.']),
      ('relation-inverse-composed-mix','f,g:ℝ→ℝ bijektif, g⁻¹∘f=I ve f(x)+2g(x)=9x−12. f(g⁻¹(6))+g(f⁻¹(3)) kaçtır?',9,'x-(6+3)',['f=g=3x−4.','Her iki bileşke birimdir; toplam 6+3=9.']),
    ]
    for slug,prompt,value,equation,steps in tasks:b.solve(k,slug,prompt,value,equation,steps,**kw)

def restricted_inverses(b):
    k='restricted';kw={'exam':'AYT','course':'functions','topic':'Fonksiyonlar','subtopic':'Tanım aralığına göre ters fonksiyon'}
    tasks=[
      ('restrict-right-square','f:[2,∞)→[0,∞), f(x)=(x−2)². f⁻¹(25) kaçtır?',7,'(x-2)**2-25',[{'left':'x','op':'ge','right':'2'}],['Kök denklemi x−2=±5 verir.','x≥2 nedeniyle yalnız x=7 kabul edilir.']),
      ('restrict-left-square','f:(−∞,3]→[0,∞), f(x)=(x−3)². f⁻¹(25) kaçtır?',-2,'(x-3)**2-25',[{'left':'x','op':'le','right':'3'}],['İki cebirsel kök 8 ve −2’dir.','Tanım aralığı yalnız −2’yi kabul eder.']),
      ('restrict-left-absolute','f:(−∞,4]→[0,∞), f(x)=|x−4|. f⁻¹(9) kaçtır?',-5,'(4-x)-9',[{'left':'x','op':'le','right':'4'}],['x≤4 iken |x−4|=4−x.','4−x=9 ⇒ x=−5.']),
      ('restrict-square-root','f:[−3,∞)→[0,∞), f(x)=√(x+3). f⁻¹(4) kaçtır?',13,'x+3-16',[{'left':'x','op':'ge','right':'-3'}],['√(x+3)=4 eşitliği kare alınarak çözülür.','x+3=16 ⇒ x=13.']),
      ('restrict-negative-reciprocal','f:(−∞,0)→(−∞,0), f(x)=6/x. f⁻¹(−3) kaçtır?',-2,'6+3*x',[{'left':'x','op':'lt','right':'0'}],['6/x=−3 ⇒ 6=−3x.','x=−2 negatif tanım aralığındadır.']),
      ('restrict-decreasing-parabola','f:[0,∞)→(−∞,5], f(x)=5−x². f⁻¹(−11) kaçtır?',4,'5-x*x+11',[{'left':'x','op':'ge','right':'0'}],['x²=16 çıkar.','x≥0 koşuluyla x=4.']),
      ('restrict-cubic-unique','f:ℝ→ℝ, f(x)=x³−1. f⁻¹(26) kaçtır?',3,'x**3-27',[],['f sıkı artandır, dolayısıyla her görüntünün tek ön görüntüsü vardır.','x³=27 ⇒ x=3.']),
      ('restrict-minimum-domain-bound','f:[a,∞)→[0,∞), f(x)=(x−3)² bir bijeksiyondur. a’nın mümkün değeri kaçtır?',3,'2*(x-3)',[],['Örtenlik için tepe noktasındaki 0 görüntüsü alınmalıdır.','Bire birlik için tepenin soluna geçilemez; başlangıç a=3 olmalıdır.']),
      ('restrict-shifted-root-equation','f:[1,∞)→[0,∞), f(x)=√(x−1). f⁻¹(6)−f⁻¹(2) kaçtır?',32,'x-((6**2+1)-(2**2+1))',[],['Ters bağıntı f⁻¹(t)=t²+1’dir.','37−5=32.']),
      ('restrict-composed-square','f:[0,∞)→[2,∞), f(x)=x²+2 ve g(x)=3x−1. (g∘f⁻¹)(18) kaçtır?',11,'x-(3*4-1)',[],['f⁻¹(18)=√16=4; negatif kök tanım aralığında yoktur.','g(4)=12−1=11.']),
    ]
    for slug,prompt,value,equation,conditions,steps in tasks:b.solve(k,slug,prompt,value,equation,steps,conditions=conditions,**kw)

def counterexample_structures(b):
    k='counterexample';kw={'exam':'AYT','course':'functions','topic':'Fonksiyonlar','subtopic':'İnvolüsyon, sabit nokta ve bileşke'}
    b.solve(k,'counter-reflection-fixed-point','f(x)=12−x fonksiyonunun kendisiyle bileşkesi birimdir. f(t)=t eşitliğini sağlayan t kaçtır?',6,'12-x-x',['Sabit nokta 12−t=t denklemini sağlar.','2t=12 ⇒ t=6.'],**kw)
    b.calc(k,'counter-noncommuting-reflections','f(x)=10−x ve g(x)=6−x için (f∘g)(4)−(g∘f)(4) kaçtır?',8,'(10-(6-4))-(6-(10-4))',['f(g(4))=f(2)=8.','g(f(4))=g(6)=0; fark 8.'],**kw)
    b.solve(k,'counter-reciprocal-fixed-positive','f:(0,∞)→(0,∞), f(x)=9/x. Pozitif sabit noktası kaçtır?',3,'x*x-9',['9/x=x ⇒ x²=9.','Pozitif tanım aralığında yalnız 3 kabul edilir.'],conditions=[{'left':'x','op':'gt','right':'0'}],**kw)
    b.calc(k,'counter-mobius-odd-iteration','f(x)=(2x+3)/(x−2) fonksiyonu uygun tanım aralığında kendisinin tersidir. f’nin 2025 kez art arda uygulanmasıyla 3 sayısından hangi sayı elde edilir?',9,'(2*3+3)/(3-2)',['f(f(x))=x; ardışık uygulamalar ikişer yok olur.','2025 tek olduğu için f(3)=9 kalır.'],**kw)
    b.solve(k,'counter-affine-involution-slope','f(x)=ax+7 ve f(f(x))=x her gerçek x için sağlanıyor. a kaçtır?',-1,'7*x+7',['İki kez uygulamada sabit terim 7a+7=0 olmalıdır.','a=−1, ayrıca a²=1 koşulunu da sağlar.'],**kw)
    b.solve(k,'counter-affine-commutation','f(x)=2x+3, g(x)=ax+1. f∘g=g∘f olduğuna göre a kaçtır?',s.Rational(4,3),'2+3-(3*x+1)',['f(g(x))=2ax+5, g(f(x))=2ax+3a+1.','5=3a+1 ⇒ a=4/3.'],**kw)
    b.calc(k,'counter-reflection-double-sum','f(x)=8−x için f(2)+f(f(2))+f(f(f(2))) kaçtır?',14,'(8-2)+2+(8-2)',['f(2)=6 ve iki uygulama başlangıca döndürür.','6+2+6=14.'],**kw)
    b.finite(k,'counter-finite-involutions','{1,2,3} kümesinden kendisine bijektif f fonksiyonları içinde f∘f=I koşulunu sağlayan kaç fonksiyon vardır?',4,{'a':[1,3],'b':[1,3],'c':[1,3]},'a!=b and a!=c and b!=c and a*(a==1)+b*(a==2)+c*(a==3)==1 and a*(b==1)+b*(b==2)+c*(b==3)==2 and a*(c==1)+b*(c==2)+c*(c==3)==3',{'kind':'count'},['Kimlik fonksiyonu ve bir elemanı sabit bırakıp diğer ikisini değiştiren üç eşleme uygundur.','Toplam 1+3=4.'],difficulty='hard',**kw)
    b.solve(k,'counter-nonlinear-inverse-not-equal','f:[0,∞)→[0,∞), f(x)=x². f(t)=f⁻¹(t) eşitliğinin 1’den büyük olmayan pozitif çözümü kaçtır?',1,'x**4-x',['t²=√t ve t>0 olduğundan kare alıp t ile bölünür: t³=1.','Tek pozitif çözüm 1’dir.'],conditions=[{'left':'x','op':'gt','right':'0'}],**kw)
    b.calc(k,'counter-inverse-translation-distance','f(x)=x+5 ve g=f⁻¹ olsun. (f∘f)(2)−(g∘g)(2) kaçtır?',20,'(2+5+5)-(2-5-5)',['f iki kez 10 ekler; g iki kez 10 çıkarır.','12−(−8)=20.'],**kw)

def inverse_in_function_value(b):
    k='inverse_expression';kw={'exam':'AYT','course':'functions','topic':'Fonksiyonlar','subtopic':'Ters fonksiyonu fonksiyon değeriyle ifade etme'}
    rows=[
      ('inverse-value-affine-offset','f(x)=3x−2 için f⁻¹(x)=(f(x)+k)/9 özdeşliği geçerlidir. k kaçtır?',8,'x-8',['t=f(x) ise x=(t+2)/3.','f⁻¹(x)=(x+2)/3=(t+8)/9; k=8.']),
      ('inverse-value-affine-negative-offset','f(x)=2x+5 için f⁻¹(x)=(f(x)−k)/4 yazılıyor. k kaçtır?',15,'x-15',['t=f(x) ⇒ x=(t−5)/2.','(x−5)/2=(t−15)/4; k=15.']),
      ('inverse-value-reciprocal-shift','f(x)=1/(x−2) ve t=f(x). Ortak tanım aralığında f⁻¹(x)=(at+2)/(2t+1) ise a kaçtır?',5,'x-5',['f⁻¹(u)=2+1/u.','x=2+1/t yerine yazılınca (5t+2)/(2t+1) çıkar; a=5.']),
      ('inverse-value-self-reciprocal','f(x)=(x+1)/(x−1), x≠1. f⁻¹(7) kaçtır?',s.Rational(4,3),'x-(7+1)/(7-1)',['y=(x+1)/(x−1) eşitliğinde x=(y+1)/(y−1) olur.','Fonksiyon kendisinin tersidir; sonuç 8/6=4/3.']),
      ('inverse-value-mobius-denominator','f(x)=(2x+1)/(x−1), t=f(x). f⁻¹(x)=(2t−1)/(k−t) yazılabiliyorsa k kaçtır?',5,'x-5',['f⁻¹(u)=(u+1)/(u−2).','x=(t+1)/(t−2) yerine koyulunca (2t−1)/(5−t) bulunur.']),
      ('inverse-value-unit-shift-ratio','f(x)=x/(x+1) ve t=f(x). f⁻¹(x)=t/(1−kt) özdeşliğindeki k kaçtır?',2,'x-2',['f⁻¹(u)=u/(1−u), x=t/(1−t).','Yerine koyunca t/(1−2t) elde edilir; k=2.']),
      ('inverse-value-shifted-mobius-constant','f(x)=(x−3)/(x+2) ve t=f(x). Ortak tanım aralığında f⁻¹(x)=−(t+k)/(3t+2) ise k kaçtır?',9,'x-9',['f⁻¹(u)=(2u+3)/(1−u).','x=(2t+3)/(1−t) yazılınca −(t+9)/(3t+2) bulunur.']),
      ('inverse-value-mobius-second-constant','f(x)=(3x+2)/(x−4), t=f(x). f⁻¹(x)=(18t−16)/(t+k) yazılabiliyorsa k kaçtır?',11,'x-11',['f⁻¹(u)=(4u+2)/(u−3).','x=(4t+2)/(t−3) yerleştirilince payda t+11 olur.']),
      ('inverse-value-root-polynomial','x≥0 için f(x)=√(x+4), t=f(x). f⁻¹(x) fonksiyonu t türünden t⁴−8t²+k biçiminde yazılıyor. k kaçtır?',12,'x-12',['f⁻¹(u)=u²−4 ve x=t²−4.','(t²−4)²−4=t⁴−8t²+12; k=12.']),
      ('inverse-value-log-two-layers','f(x)=log₂x ve f(x)=3 olduğu biliniyor. f⁻¹(x) kaçtır?',256,'x-2**(2**3)',['f(x)=3 ⇒ x=2³=8.','Ters fonksiyon f⁻¹(u)=2ᵘ; sonuç 2⁸=256.']),
    ]
    for slug,prompt,value,equation,steps in rows:b.solve(k,slug,prompt,value,equation,steps,**kw)

def composition_replacement(b):
    kw={'exam':'AYT','course':'functions','topic':'Fonksiyonlar','subtopic':'Ters bileşke ve girdi koşulu','difficulty':'hard'}
    b.solve('composition_replacement','composition-preimage-constraint-chain','f,g:ℝ→ℝ bijektif, (f∘g)(x)=2x−5 ve g(4)=7 olsun. f⁻¹(3)+g⁻¹(7) toplamı kaçtır?',11,'x-(7+4)',['x=4 yazılınca f(g(4))=3 ve g(4)=7 olduğundan f(7)=3.','f⁻¹(3)=7 ve g⁻¹(7)=4; toplam 11.'],**kw)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-evidence',type=Path,default=ROOT/'data/source-read-evidence.json')
    parser.add_argument('--output',type=Path,default=ROOT/'work/nov14-source-expansion.json')
    args=parser.parse_args()
    payload=json.loads(args.source_evidence.read_text())
    evidence=payload['evidence'] if isinstance(payload,dict) else payload
    author=Author(evidence)
    for task in [nested_sets,venn_operations,digit_counting,factorial_structures,permutation_structures,event_support,disjoint_events,logical_equivalence,tautological_reasoning,motion_steps,functional_relations,restricted_inverses,counterexample_structures,inverse_in_function_value,composition_replacement]:
        task(author)
    ids=[q['id'] for q in author.questions]
    assert len(ids)==len(set(ids))==141
    assert len({q['prompt'] for q in author.questions})==141
    result={'schemaVersion':1,'version':VERSION,'questions':author.questions,
            'summary':{'generated':len(ids),'byExam':dict(Counter(q['examType'] for q in author.questions)),
                       'sourceParents':len({q['parentQuestionId'] for q in author.questions}),
                       'sourceBodiesReadDuringAuthoring':True,'publicationStatus':'independent_QA_required'},
            'ledger':[{'sourceQuestionId':identifier,'skill':skill,
                       'generatedIds':[q['id'] for q in author.questions if q['parentQuestionId']==identifier]}
                      for skill,identifier in PARENTS.items()]}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result['summary'],ensure_ascii=False))

if __name__=='__main__':main()
