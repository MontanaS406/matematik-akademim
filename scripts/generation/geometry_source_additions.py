#!/usr/bin/env python3
"""Twenty self-contained TYT exercises from two privately read geometry originals.

No source prose, diagram, crop or publisher choices are reproduced here. Each
exercise has its own complete conditions; the source identities bind read evidence.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import sympy as s
from source_derived_generator import Author as BaseAuthor, options, value_text

ROOT=Path(__file__).resolve().parents[2]
VERSION='read-geometry-twenty-structural-v1'
PARENTS={
    'triangle_altitude_area':'ORIG-947e47592d94-P001-Q01',
    'partitioned_polygon_area':'ORIG-947e47592d94-P002-Q07',
}
# Mistakes measured by the choices include using one subtriangle, adding an
# external projection, omitting one half, using the wrong base and admitting
# boundary lattice points. Preserve deterministic answer positions.
DISTRACTORS={
    'two-internal-right-triangles':[60,90,150,420],
    'external-altitude-difference':[30,96,126,132],
    'recover-missing-oblique-side':[12,15,21,25],
    'isosceles-half-base':[24,60,64,80],
    'shared-altitude-segment-ratio':[16,32,40,64],
    'midpoint-subtriangle-coordinates':[12,18,27,36],
    'vertex-parallel-translation':[7,28,63,70],
    'integer-right-triangle-perimeter':[6,8,12,14],
    'heron-to-another-altitude':[s.Rational(63,10),12,18,s.Rational(252,13)],
    'largest-integer-area-fixed-hypotenuse':[84,100,s.Rational(625,4),300],
    'concave-coordinate-height-recovery':[2,3,7,9],
    'diagonal-opposite-distances':[20,35,70,110],
    'interior-cutout-area':[45,54,108,153],
    'square-corner-trim':[20,60,90,100],
    'crossing-diagonal-four-regions':[54,60,84,111],
    'right-triangle-shared-diagonal':[20,24,40,88],
    'recover-opposite-height':[4,5,8,10],
    'coordinate-free-horizontal-position':[16,24,32,80],
    'two-stage-base-and-height-ratio':[12,18,36,60],
    'count-lattice-concave-vertices':[6,8,9,14],
}


class Author(BaseAuthor):
    def __init__(self,evidence):
        by_id={row['sourceQuestionId']:row for row in evidence}
        chosen=[]
        for skill,identifier in PARENTS.items():
            parent=by_id.get(identifier)
            if not parent or parent.get('readStatus')!='read' or parent.get('answerStatus')!='verified':
                raise ValueError('Actually read and independently approved geometry source required: '+identifier)
            chosen.append({**parent,'generationSkills':[skill]})
        super().__init__(chosen)

    def emit(self,skill,slug,prompt,answer,steps,spec,**kw):
        model=kw.pop('model')
        super().emit(skill,'geometry-add-'+slug,prompt,answer,steps,spec,
                     exam='TYT',course='geometry',topic='Üçgenler ve Alan',**kw)
        q=self.questions[-1]
        q['id']=q['id'].replace('AI-SOURCE-','AI-GEOMETRY-READ-',1)
        _,letter=options(answer,q['id']);values=list(DISTRACTORS[slug])
        values.insert(ord(letter)-65,answer)
        assert len({value_text(v) for v in values})==5
        q['options']=[{'id':chr(65+i),'text':value_text(v)} for i,v in enumerate(values)]
        q['answer']['value']=letter
        q['familyId']='read-geometry-'+skill
        q['variationStructure']=slug
        q['geometricModel']=model
        q['verificationSpec']['rawGeometry']=model
        q['provenance']['sourceSha256']=self.parents[skill]['sha256']
        q['provenance']['printedPage']=self.parents[skill].get('printedPage')
        q['provenance']['authoringVersion']=VERSION


def triangle_altitude_area(b):
    key='triangle_altitude_area'
    b.calc(key,'two-internal-right-triangles',
      'ABC üçgeninde A’dan BC’ye indirilen dikmenin ayağı H, B ile C arasındadır. AH=15 cm, AB=17 cm ve AC=25 cm ise üçgenin alanı kaç cm²dir?',210,
      '(sqrt(17**2-15**2)+sqrt(25**2-15**2))*15/2',
      ['Dik üçgenlerde BH=√(17²−15²)=8 ve HC=√(25²−15²)=20.',
       'H iç noktadır; BC=8+20=28. Alan 28·15/2=210.'],
      subtopic='İç yükseklik ve Pisagor',difficulty='easy',
      model={'kind':'triangle_internal_altitude','altitude':15,'adjacentSides':[17,25],'footInsideBase':True,'target':'area'})
    b.calc(key,'external-altitude-difference',
      'B, C ve H aynı doğru üzerinde bu sırayla bulunuyor. AH bu doğruya diktir. AH=12 cm, AB=20 cm ve AC=13 cm ise ABC üçgeninin alanı kaç cm²dir?',66,
      '(sqrt(20**2-12**2)-sqrt(13**2-12**2))*12/2',
      ['AH dış yüksekliktir. BH=16 ve CH=5 bulunur.',
       'B−C−H sıralamasında BC=BH−CH=11. Alan 11·12/2=66.'],
      subtopic='Dış yükseklikte taban farkı',difficulty='medium',
      model={'kind':'triangle_external_altitude','collinearOrder':['B','C','H'],'altitude':12,'AB':20,'AC':13,'target':'area'})
    b.calc(key,'recover-missing-oblique-side',
      'ABC üçgeninde A’dan BC’ye inen yüksekliğin ayağı H, BC’nin içindedir. Alan 84 cm², AH=8 cm ve AB=10 cm olduğuna göre AC kaç cm’dir?',17,
      'sqrt((2*84/8-sqrt(10**2-8**2))**2+8**2)',
      ['Alan bağıntısı BC=2·84/8=21 verir. ABH dik üçgeninden BH=6.',
       'HC=21−6=15; AHC dik üçgeninde AC=√(15²+8²)=17.'],
      subtopic='Alandan kenarı geri bulma',difficulty='medium',
      model={'kind':'recover_side_from_area_and_internal_altitude','area':84,'altitude':8,'knownAdjacentSide':10,'footInsideBase':True,'target':'otherAdjacentSide'})
    b.calc(key,'isosceles-half-base',
      'İkizkenar bir üçgenin eş kenarları 10’ar cm, tabanı 16 cm’dir. Bu üçgenin alanı kaç cm²dir?',48,
      '16*sqrt(10**2-(16/2)**2)/2',
      ['Tepe yüksekliği tabanı 8 ve 8 olarak iki eş parçaya ayırır.',
       'Yükseklik √(10²−8²)=6; alan 16·6/2=48.'],
      subtopic='İkizkenar üçgende yükseklik',difficulty='easy',
      model={'kind':'isosceles_triangle_area','equalSide':10,'base':16,'target':'area'})
    b.calc(key,'shared-altitude-segment-ratio',
      'ABC üçgeninin alanı 64 cm²dir. D, BC üzerinde ve BD:DC=3:5 olduğuna göre ABD üçgeninin alanı kaç cm²dir?',24,
      '64*3/(3+5)',
      ['ABD ve ADC üçgenlerinin A’dan BC’ye yükseklikleri aynıdır.',
       'ABD’nin alanı bütünün 3/8’i, yani 64·3/8=24’tür.'],
      subtopic='Ortak yükseklikte alan oranı',difficulty='medium',
      model={'kind':'shared_altitude_area_ratio','wholeArea':64,'baseSegmentRatio':[3,5],'target':'firstSubtriangleArea'})
    b.calc(key,'midpoint-subtriangle-coordinates',
      'Dik koordinat düzleminde A=(2,6), B=(−4,0), C=(8,0) olsun. M, BC’nin; N, AC’nin orta noktasıdır. AMN üçgeninin alanı kaç birimkaredir?',9,
      '(6-0)*(((2+8)/2)-2)/2',
      ['M=(2,0), N=(5,3). AM düşey ve uzunluğu 6’dır.',
       'N’nin x=2 doğrusuna uzaklığı 3. Alan 6·3/2=9.'],
      subtopic='Orta noktalar ve taban yüksekliği',difficulty='medium',
      model={'kind':'coordinate_midpoint_triangle','A':[2,6],'B':[-4,0],'C':[8,0],'M':'midpoint(B,C)','N':'midpoint(A,C)','target':'area(AMN)'})
    b.calc(key,'vertex-parallel-translation',
      'B=(0,0), C=(10,0) ve A=(1,7) noktaları veriliyor. A noktası yatay doğrultuda 8 birim sağa taşınarak A′ elde ediliyor. A′BC üçgeninin alanı kaç birimkaredir?',35,
      '(10-0)*7/2',
      ['A′=(9,7) olur. Yatay hareket BC tabanına olan 7 birimlik uzaklığı değiştirmez.',
       'Alan 10·7/2=35’tir.'],
      subtopic='Paralel taşımada alanın değişmemesi',difficulty='easy',
      model={'kind':'parallel_translation_invariance','A':[1,7],'B':[0,0],'C':[10,0],'translation':[8,0],'target':'translatedTriangleArea'})
    b.finite(key,'integer-right-triangle-perimeter',
      'Kenar uzunlukları pozitif tam sayı olan bir dik üçgenin çevresi 24 cm, alanı 24 cm²dir. Hipotenüs kaç cm’dir?',10,
      {'u':[1,23],'v':[1,23]},
      'u*v==48 and u+v+sqrt(u**2+v**2)==24',
      {'kind':'unique','expression':'sqrt(u**2+v**2)'},
      ['Dik kenarlar u,v için uv/2=24, yani uv=48.',
       'Hipotenüs c=24−u−v ve c²=u²+v². Bu eşitliklerden u+v=14, c=10 çıkar.',
       'u,v=6,8 koşulları sağlar. Yer değiştirmeleri hipotenüsü değiştirmez.'],
      subtopic='Çevre ve alandan tam sayı üçgen',difficulty='hard',
      model={'kind':'integer_right_triangle_inverse','perimeter':24,'area':24,'legDomain':'positive integers <24','target':'hypotenuse'})
    b.calc(key,'heron-to-another-altitude',
      'Kenarları 13 cm, 20 cm ve 21 cm olan bir üçgenin 20 cm’lik kenarına ait yüksekliği kaç cm’dir?',s.Rational(63,5),
      '2*sqrt(((13+20+21)/2)*((13+20+21)/2-13)*((13+20+21)/2-20)*((13+20+21)/2-21))/20',
      ['Yarı çevre 27; Heron bağıntısıyla alan √(27·14·7·6)=126.',
       '20 cm’lik tabana ait yükseklik 2·126/20=63/5’tir.'],
      subtopic='Heron alanından farklı tabana yükseklik',difficulty='hard',
      model={'kind':'heron_area_to_altitude','sides':[13,20,21],'targetBase':20,'target':'altitude'})
    b.finite(key,'largest-integer-area-fixed-hypotenuse',
      'Hipotenüsü 25 cm olan bir dik üçgenin iki dik kenarı da pozitif tam sayıdır. Üçgenin alanı en fazla kaç cm² olabilir?',150,
      {'u':[1,24],'v':[1,24]},'u**2+v**2==25**2',
      {'kind':'max','expression':'u*v/2'},
      ['u²+v²=625 için pozitif tam sayı kenar çiftleri, sıralama dışında (7,24) ve (15,20)’dir.',
       'Alanlar 84 ve 150 olur; en büyük alan 150.','Sonlu tarama, 1≤u,v≤24 aralığındaki bütün olasılıkları denetler.'],
      subtopic='Pisagor koşulunda tam sayı alan optimizasyonu',difficulty='hard',
      model={'kind':'integer_pythagorean_area_max','hypotenuse':25,'legDomain':'positive integers1..24','target':'maximumArea'})


def partitioned_polygon_area(b):
    key='partitioned_polygon_area'
    b.solve(key,'concave-coordinate-height-recovery',
      'A=(0,8), B=(0,0), C=(12,0) ve D=(3,t) noktaları veriliyor; 0<t<6. A−B−C−D sırasıyla birleştirilen içbükey dörtgenin alanı 42 birimkare ise t kaçtır?',5,
      '(12*t+3*8)/2-42',
      ['BD köşegeni, dörtgeni ABD ve BCD üçgenlerine ayırır.',
       'ABD’nin alanı 8·3/2=12; BCD’nin alanı 12t/2=6t.',
       '12+6t=42 ⇒ t=5; 0<t<6 koşulu sağlanır.'],
      variable='t',conditions=[{'left':'t','op':'gt','right':'0'},{'left':'t','op':'lt','right':'6'}],
      subtopic='İçbükey dörtgende eksik koordinat',difficulty='medium',
      model={'kind':'concave_coordinate_quadrilateral','vertices':[[0,8],[0,0],[12,0],[3,'t']],'parameterDomain':[0,6],'area':42,'target':'t'})
    b.calc(key,'diagonal-opposite-distances',
      'ABCD dörtgeninin BD köşegeni dörtgenin içinde kalıyor. BD=10 cm; A ve C, BD doğrusunun farklı taraflarında ve bu doğruya uzaklıkları sırasıyla 4 cm ve 7 cm’dir. Dörtgenin alanı kaç cm²dir?',55,
      '10*(4+7)/2',
      ['BD tabanlı ABD ve BCD üçgenlerinin alanları 20 ve 35’tir.',
       'Üçgenler köşegenin iki tarafında olduğundan alanlar toplanır: 55.'],
      subtopic='Köşegen ve karşılıklı yükseklikler',difficulty='easy',
      model={'kind':'diagonal_triangle_sum','diagonal':10,'oppositeDistances':[4,7],'diagonalInside':True,'target':'quadrilateralArea'})
    b.calc(key,'interior-cutout-area',
      'ABC üçgeninde BC=18 cm ve A’nın BC doğrusuna uzaklığı 12 cm’dir. İç bölgedeki D noktasının BC’ye uzaklığı 5 cm’dir. BCD üçgeni çıkarıldığında kalan ABD ve ACD bölgelerinin toplam alanı kaç cm²dir?',63,
      '18*12/2-18*5/2',
      ['ABC alanı 108, BCD alanı 45’tir.',
       'D içeride olduğundan kalan iki bölge çakışmaz; toplamları 108−45=63.'],
      subtopic='İç üçgeni çıkararak alan',difficulty='medium',
      model={'kind':'interior_triangle_cutout','base':18,'outerAltitude':12,'interiorPointDistance':5,'pointInside':True,'target':'remainingArea'})
    b.calc(key,'square-corner-trim',
      'ABCD karesinin kenarı 10 cm’dir. P, BC kenarı üzerinde ve BP=4 cm’dir. Köşeler çevre boyunca A−B−C−D sırasında olduğuna göre APCD dörtgeninin alanı kaç cm²dir?',80,
      '10**2-10*4/2',
      ['Kareden ABP dik üçgeni kesilmiştir.',
       'Karenin alanı 100, kesilen üçgenin alanı 10·4/2=20.','Kalan APCD alanı 80.'],
      subtopic='Kareden köşe üçgeni çıkarma',difficulty='easy',
      model={'kind':'square_corner_cutout','side':10,'cutPointOn':'BC','BP':4,'target':'area(APCD)'})
    b.identity(key,'crossing-diagonal-four-regions',
      'Dışbükey ABCD dörtgeninin köşegenleri O’da kesişiyor. AO:OC=2:3, BO:OD=4:5 ve AOB üçgeninin alanı 24 cm²dir. Dörtgenin alanı kaç cm²dir?',135,
      ['x-24','2*y-3*x','4*z-5*y','4*w-5*x'],'x+y+z+w',
      ['AOB ile BOC aynı B yüksekliğini paylaşır: BOC alanı 24·3/2=36.',
       'BOC ile COD için BO:OD=4:5; COD alanı 36·5/4=45.',
       'AOD alanı 24·5/4=30. Dört alanın toplamı 24+36+45+30=135.'],
      variables=['x','y','z','w'],
      subtopic='Kesişen köşegenlerde dört alt alan',difficulty='hard',
      model={'kind':'four_diagonal_region_ratios','AOtoOC':[2,3],'BOtoOD':[4,5],'areaAOB':24,'convex':True,'target':'wholeArea'})
    b.calc(key,'right-triangle-shared-diagonal',
      'ABCD dörtgeninde BD iç köşegendir ve A ile C, BD’nin farklı taraflarındadır. BCD üçgeni C’de diktir; BC=6 cm, CD=8 cm. A’nın BD doğrusuna uzaklığı 4 cm ise dörtgenin alanı kaç cm²dir?',44,
      '6*8/2+sqrt(6**2+8**2)*4/2',
      ['BCD’nin alanı 6·8/2=24; Pisagor’dan BD=10.',
       'ABD’nin alanı 10·4/2=20. Toplam 44.'],
      subtopic='Pisagorla bulunan köşegen ve alan toplamı',difficulty='medium',
      model={'kind':'right_triangle_plus_shared_diagonal_triangle','rightLegs':[6,8],'otherVertexDistance':4,'oppositeSides':True,'target':'wholeArea'})
    b.solve(key,'recover-opposite-height',
      'ABCD dörtgeninde BD=12 cm’lik iç köşegendir. A ile C bu doğrunun farklı taraflarındadır. A’nın BD doğrusuna uzaklığı 4 cm, dörtgenin alanı 60 cm² olduğuna göre C’nin BD doğrusuna uzaklığı kaç cm’dir?',6,
      '12*(4+x)/2-60',
      ['İki üçgenin ortak tabanı BD’dir; alan toplamı 12·(4+h)/2.',
       '6(4+h)=60 ⇒ h=6. Pozitif uzaklık koşulu sağlanır.'],
      conditions=[{'left':'x','op':'gt','right':'0'}],
      subtopic='Toplam alandan karşı yüksekliği bulma',difficulty='medium',
      model={'kind':'inverse_diagonal_area_sum','diagonal':12,'knownDistance':4,'wholeArea':60,'oppositeSides':True,'target':'unknownDistance'})
    b.calc(key,'coordinate-free-horizontal-position',
      'A=(t,6), B=(−3,0), C=(2,−4), D=(5,0) ve 0<t<4 olsun. Noktalar A−B−C−D sırasında birleştiriliyor. Dörtgenin alanı kaç birimkaredir?',40,
      '((t*0+(-3)*(-4)+2*0+5*6)-(6*(-3)+0*2+(-4)*5+0*t))/2',
      ['BD, x ekseni üzerinde 8 birimdir. A ve C eksenin farklı tarafındadır.',
       'ABD alanı 8·6/2=24, BCD alanı 8·4/2=16; toplam 40.',
       'A’nın yatay konumu t, iki üçgenin yüksekliklerini değiştirmez.'],
      subtopic='Koordinat konumundan bağımsız alt alanlar',difficulty='medium',
      model={'kind':'coordinate_quadrilateral_area_invariance','vertices':[['t',6],[-3,0],[2,-4],[5,0]],'parameterDomain':[0,4],'target':'wholeArea'})
    b.calc(key,'two-stage-base-and-height-ratio',
      'ABC üçgeninin alanı 90 cm²dir. D, BC üzerinde BD:DC=2:3 olacak şekilde; E ise AD üzerinde AE:ED=1:2 olacak şekilde seçiliyor. BED üçgeninin alanı kaç cm²dir?',24,
      '90*2/(2+3)*2/(1+2)',
      ['ABD alanı, ortak yükseklikten bütün alanın 2/5’i: 36.',
       'E, A’dan D’ye yolun 1/3’ündedir; BC’ye uzaklığı A’nın uzaklığının 2/3’üdür.',
       'BD tabanlı BED alanı 36·2/3=24.'],
      subtopic='İki aşamalı taban ve yükseklik oranı',difficulty='hard',
      model={'kind':'nested_area_ratios','wholeArea':90,'BDtoDC':[2,3],'AEtoED':[1,2],'pointEOn':'AD','target':'area(BED)'})
    b.finite(key,'count-lattice-concave-vertices',
      'A=(0,12), B=(0,0), C=(12,0). D=(p,q), ABC üçgeninin kesin iç bölgesindeki bir kafes noktasıdır; p ve q pozitif tam sayıdır. A−B−C−D dörtgeninin alanı 48 birimkare olacak şekilde kaç farklı D vardır?',7,
      {'p':[1,11],'q':[1,11]},'p+q<12 and (12*q+12*p)/2==48',{'kind':'count'},
      ['BD ile iki üçgene ayırınca ABD alanı 6p, BCD alanı 6q olur.',
       '6(p+q)=48 ⇒ p+q=8. Pozitif tam sayı çiftleri (1,7),…,(7,1) olmak üzere 7 tanedir.',
       'Hepsinde p+q=8<12 olduğundan D kesin içeridedir.'],
      subtopic='Alan koşulunda kafes noktası sayma',difficulty='hard',
      model={'kind':'lattice_concave_quadrilateral','A':[0,12],'B':[0,0],'C':[12,0],'D':['p','q'],'insideCondition':'p>0,q>0,p+q<12','area':48,'target':'pointCount'})


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source-evidence',type=Path,default=ROOT/'data/source-read-evidence.json')
    parser.add_argument('--output',type=Path,default=ROOT/'work/geometry-source-additions.json')
    args=parser.parse_args();payload=json.loads(args.source_evidence.read_text())
    author=Author(payload if isinstance(payload,list) else payload['evidence'])
    for family in (triangle_altitude_area,partitioned_polygon_area):
        before=len(author.questions);family(author)
        assert len(author.questions)-before==10,family.__name__
    assert len(author.questions)==20 and len({q['id'] for q in author.questions})==20
    assert len({q['prompt'] for q in author.questions})==20
    report={'schemaVersion':1,'generator':VERSION,'questions':author.questions,
      'summary':{'total':20,'byExam':dict(Counter(q['examType'] for q in author.questions)),
                 'parents':2,'byParent':dict(Counter(q['parentQuestionId'] for q in author.questions)),
                 'byDifficulty':dict(Counter(q['difficulty'] for q in author.questions))},
      'ledger':[{'sourceQuestionId':parent,'skill':skill,'count':10,
                 'generatedIds':[q['id'] for q in author.questions if q['parentQuestionId']==parent]}
                for skill,parent in PARENTS.items()],
      'independentVerificationRequired':True}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report['summary'],ensure_ascii=False))


if __name__=='__main__':main()
