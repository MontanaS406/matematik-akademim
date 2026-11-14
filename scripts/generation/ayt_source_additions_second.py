#!/usr/bin/env python3
"""Second atomic AYT batch, from ten additional actually read originals.

The private original statements, five choices and solutions were read. The
source graph and the previously ambiguous log equality were visually checked.
No original publisher text or image is reproduced in this authoring module.
The first hundred exercises and the frozen 1,778-record bank are untouched.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import sympy as s

from ayt_source_additions import Author as FirstAuthor
from source_derived_generator import Author as BaseAuthor, options

ROOT=Path(__file__).resolve().parents[2]
VERSION='read-ayt-second-ten-structural-variants-v1'
PARENTS={
    'trigonometric_limits':'ORIG-1fda1064551b-P001-Q03',
    'one_sided_limits':'ORIG-1fda1064551b-P001-Q04',
    'first_derivative_parameter':'ORIG-d7f29d828181-P001-Q02',
    'polynomial_operator_identities':'ORIG-d7f29d828181-P001-Q04',
    'fundamental_calculus_relations':'ORIG-214b2c524989-P001-Q01',
    'exact_differentials':'ORIG-214b2c524989-P001-Q04',
    'explicit_sequence_terms':'ORIG-53bc4bf33464-P001-Q01',
    'nested_geometric_sequences':'ORIG-53bc4bf33464-P001-Q03',
    'exponential_inverse_operations':'ORIG-8acb0d08e272-P001-Q02',
    'coupled_logarithmic_systems':'ORIG-8acb0d08e272-P001-Q04',
}
x,t,a,b,c,d,n,j=s.symbols('x t a b c d n j',real=True)
SYMBOLS={str(v):v for v in (x,t,a,b,c,d,n,j)}


class Author(FirstAuthor):
    def __init__(self,evidence):
        by_id={row['sourceQuestionId']:row for row in evidence}
        chosen=[]
        for skill,identifier in PARENTS.items():
            parent=by_id.get(identifier)
            if not parent or parent.get('readStatus')!='read' or parent.get('answerStatus')!='verified':
                raise ValueError('An actually read, approved original is required: '+identifier)
            chosen.append({**parent,'generationSkills':[skill]})
        BaseAuthor.__init__(self,chosen)

    def emit(self,skill,slug,prompt,answer,steps,spec,structure=None,**kw):
        if slug in {
            'trig-direct-combined-value','branch-symmetric-continuity',
            'slope-inner-linear-factor','operator-linear-multiplier',
            'ftc-direct-upper-endpoint','differential-rational-endpoints',
            'term-consecutive-increment','geometric-last-increment',
            'exponent-growth-factor','logs-translated-argument',
        }:
            kw['difficulty']='easy'
        BaseAuthor.emit(self,skill,'ayt-add2-'+slug,prompt,answer,steps,spec,exam='AYT',**kw)
        q=self.questions[-1]
        q['id']=q['id'].replace('AI-SOURCE-','AI-AYT-READ2-',1)
        q['options'],q['answer']['value']=options(answer,q['id'])
        q['familyId']='read-ayt-second-'+skill
        q['variationStructure']=structure or slug
        parent=self.parents[skill]
        q['provenance'].update(sourceSha256=parent['sha256'],printedPage=parent.get('printedPage'),authoringVersion=VERSION)

    def branches(self,skill,slug,prompt,answer,left,right,point,objective,steps,point_value=None,two_sided=False,**kw):
        # A discontinuous Piecewise must not be passed to SymPy's generic
        # limit, which may select the value branch on both sides. The typed
        # checker independently takes the two explicitly declared branches.
        l=s.limit(s.sympify(left,locals={'x':x}),x,s.sympify(point),dir='-')
        r=s.limit(s.sympify(right,locals={'x':x}),x,s.sympify(point),dir='+')
        assert not two_sided or s.simplify(l-r)==0
        actual=s.sympify(objective,locals={'L':l,'R':r,'V':s.sympify(point_value or 0)})
        assert s.simplify(actual-s.sympify(answer))==0,(slug,actual,answer)
        spec={'type':'piecewise_limits','point':str(point),'leftExpression':left,'rightExpression':right,'objectiveExpression':objective}
        if point_value is not None:spec['pointValue']=str(point_value)
        if two_sided:spec['requireTwoSided']=True
        self.emit(skill,slug,prompt,answer,steps,spec,**kw)

    def operator(self,skill,slug,prompt,answer,operator,right,variables,target,steps,**kw):
        additional=kw.pop('additional_equations',[])
        raw=s.sympify(operator,locals=SYMBOLS,rational=True)
        rhs=s.sympify(right,locals=SYMBOLS,rational=True)
        coefficients=s.Poly(s.expand(raw.doit()-rhs),x).all_coeffs()
        coefficients += [s.sympify(expr,locals=SYMBOLS,rational=True).doit() for expr in additional]
        unknowns=[SYMBOLS[name] for name in variables]
        solutions=s.solve(coefficients,unknowns,dict=True)
        results=[s.simplify(s.sympify(target,locals=SYMBOLS).subs(sol,simultaneous=True)) for sol in solutions]
        assert results and all(not result.free_symbols and s.simplify(result-s.sympify(answer))==0 for result in results),(slug,solutions,results,answer)
        spec={'type':'polynomial_operator_identity','operatorExpression':operator,
              'rightExpression':right,'polynomialVariable':'x','variables':variables,'targetExpression':target}
        if additional:spec['additionalEquations']=additional
        self.emit(skill,slug,prompt,answer,steps,spec,**kw)

    def derivative(self,skill,slug,prompt,answer,expression,point,steps,order=1,**kw):
        raw=s.sympify(expression,locals=SYMBOLS,rational=True)
        actual=s.diff(raw,x,order).subs(x,s.sympify(point)).doit()
        assert s.simplify(actual-s.sympify(answer))==0,(slug,actual,answer)
        self.emit(skill,slug,prompt,answer,steps,
                  {'kind':'exact_math','operation':'derivative','expression':expression,'variable':'x','order':order,'point':str(point)},**kw)

    def coupled(self,skill,slug,prompt,answer,equations,target,steps,nonzero=None,**kw):
        raw=[s.expand_log(s.sympify(expr,locals=SYMBOLS,rational=True).doit()) for expr in equations]
        branches=s.solve(raw,[a,b],dict=True)
        actual=[]
        for branch in branches:
            if any(s.simplify(s.sympify(expr,locals=SYMBOLS).subs(branch))==0 for expr in nonzero or []):continue
            value=s.simplify(s.sympify(target,locals=SYMBOLS).subs(branch,simultaneous=True))
            assert not value.free_symbols,(slug,branch,value)
            actual.append(value)
        assert actual and all(s.simplify(value-s.sympify(answer))==0 for value in actual),(slug,branches,actual,answer)
        self.emit(skill,slug,prompt,answer,steps,{'type':'rational_identity','variables':['a','b'],
                  'equations':equations,'expression':target,'nonzero':nonzero or []},**kw)

    def solve_objective(self,skill,slug,prompt,answer,equation,target,steps,**kw):
        raw=s.expand_log(s.sympify(equation,locals=SYMBOLS,rational=True).doit())
        roots=s.solveset(raw,x,domain=s.S.Reals)
        assert isinstance(roots,s.FiniteSet) and len(roots)==1,(slug,roots)
        actual=s.sympify(target,locals=SYMBOLS).subs(x,next(iter(roots)))
        assert s.simplify(actual-s.sympify(answer))==0,(slug,actual,answer)
        self.emit(skill,slug,prompt,answer,steps,{'kind':'exact_math','operation':'solve_parameter',
                  'variable':'x','expression':equation,'objective':target},**kw)


def trigonometric_limits(q):
    key='trigonometric_limits';kw={'course':'limits','topic':'Limit ve Süreklilik','subtopic':'Trigonometrik süreklilik, oranlar ve tek yanlı davranış'}
    rows=[
        ('trig-direct-combined-value','lim(x→π/2) [sinx+cos(2x)] kaçtır? Açılar radyandır.',0,'sin(x)+cos(2*x)','pi/2',
         ['Sinüs ve kosinüs süreklidir; doğrudan yerine koyulur.','sin(π/2)+cosπ=1−1=0.']),
        ('trig-tangent-ratio','lim(x→π/3) tanx/sinx kaçtır? Açılar radyandır.',2,'tan(x)/sin(x)','pi/3',
         ['sinx sıfır olmadığı yakın çevrede tanx/sinx=1/cosx.','cos(π/3)=1/2 olduğundan sonuç 2.']),
        ('trig-double-angle-quotient','lim(x→π/3) cos(2x)/cosx kaçtır? Açılar radyandır.',-1,'cos(2*x)/cos(x)','pi/3',
         ['Pay cos(2π/3)=−1/2, payda cos(π/3)=1/2’ye yaklaşır.','Bölüm −1 olur.']),
        ('trig-root-composition','lim(x→π/2) √(1+sinx) kaçtır? Açılar radyandır.',s.sqrt(2),'sqrt(1+sin(x))','pi/2',
         ['sinx→1 olduğundan kök içi 2’ye yaklaşır.','Pozitif kök çevresinde süreklilik sonucu √2.']),
        ('trig-squared-frequency','lim(x→π/6) [sin²x+cos²(3x)] kaçtır? Açılar radyandır.',s.Rational(1,4),'sin(x)**2+cos(3*x)**2','pi/6',
         ['sin(π/6)=1/2 ve cos(π/2)=0.','Karelerinin toplamı 1/4+0=1/4.']),
        ('trig-reciprocal-product','lim(x→π/4) 1/(sinx·cosx) kaçtır? Açılar radyandır.',2,'1/(sin(x)*cos(x))','pi/4',
         ['sin(π/4)·cos(π/4)=(√2/2)²=1/2.','Payda sıfır değildir; tersin limiti 2.']),
        ('trig-combined-frequency','lim(x→π/6) [sin(2x)+2cosx] kaçtır? Açılar radyandır.',3*s.sqrt(3)/2,'sin(2*x)+2*cos(x)','pi/6',
         ['sin(π/3)=√3/2, cos(π/6)=√3/2.','Toplam √3/2+√3=3√3/2.']),
        ('trig-small-angle-two-frequencies','lim(x→0) sinx/tan(3x) kaçtır? Açılar radyandır.',s.Rational(1,3),'sin(x)/tan(3*x)',0,
         ['İfade (sinx/x)·[3x/tan(3x)]·(1/3) biçiminde ayrılır.','İlk iki çarpanın limitleri 1’dir; sonuç 1/3.']),
    ]
    for slug,prompt,answer,expr,point,steps in rows:q.limit(key,slug,prompt,answer,expr,steps,point=point,**kw)
    q.raw_solve(key,'trig-response-offset','Açılar radyandır. lim(x→π/6) [a+sinx]=5/2 ise a kaçtır?',2,
                'a+sin(pi/6)-Rational(5,2)', ['Süreklilikten limit a+1/2’dir.','a+1/2=5/2 ⇒ a=2.'],**kw)
    q.limit(key,'trig-left-cosine-sign','lim(x→(π/2)⁻) |cosx|/cosx kaçtır? Açılar radyandır.',1,'Abs(cos(x))/cos(x)',
            ['π/2’ye soldan yeterince yakın açılarda cosx pozitiftir.','Bu aralıkta |cosx|/cosx=1 olduğundan tek yanlı limit 1.'],point='pi/2',direction='-',difficulty='hard',**kw)


def one_sided_limits(q):
    key='one_sided_limits';kw={'course':'limits','topic':'Limit ve Süreklilik','subtopic':'Parçalı fonksiyonda yaklaşım ve nokta değerinin ayrımı'}
    q.branches(key,'branch-jump-size','f(x), x<1 için x²+1; x≥1 için 5’tir. Sağdan limitten soldan limit çıkarılırsa kaç bulunur?',3,'x**2+1','5',1,'R-L',
               ['Soldan gelen parabol kolu 2’ye, sağdaki sabit kol 5’e yaklaşır.','Sağ−sol farkı 5−2=3.'],**kw)
    q.branches(key,'branch-limit-product','f(x), x<2 için 2x−1; x≥2 için x²+2’dir. x=2’deki soldan ve sağdan limitlerin çarpımı kaçtır?',18,'2*x-1','x**2+2',2,'L*R',
               ['Sol limit 2·2−1=3; sağ limit 2²+2=6.','Çarpım 3·6=18.'],**kw)
    q.branches(key,'branch-isolated-point','f(x), x<0 için x+2; x=0 için −7; x>0 için 2−x’tir. lim(x→0)f(x)−f(0) kaçtır?',9,'x+2','2-x',0,'L-V',
               ['İki taraftan yaklaşımın değeri de 2 olduğu için iki yanlı limit 2.','Nokta değeri −7 olduğundan 2−(−7)=9.'],point_value=-7,two_sided=True,**kw)
    q.raw_solve(key,'branch-continuity-parameter','f(x), x≤2 için ax+1; x>2 için x²−1’dir. f, x=2’de sürekli ise a kaçtır?',1,
                'Subs(a*x+1,x,2)-Subs(x**2-1,x,2)',
                ['Nokta değeri ve sol limit 2a+1; sağ limit 3’tür.','Süreklilik 2a+1=3 gerektirir; a=1.'],**kw)
    q.limit(key,'branch-removable-hole','x≠3 için f(x)=(x²−9)/(x−3), x=3 için f(3)=k’dir. Süreklilik için k kaç olmalıdır?',6,'(x**2-9)/(x-3)',
            ['x≠3 için f(x)=x+3 olur.','3’teki limit 6 olduğundan nokta değeri k=6 seçilmelidir.'],point=3,**kw)
    q.limit(key,'branch-reversed-input-approach','g(t), t<1 için 5−t; t≥1 için t²+1’dir. lim(x→0⁺)g(1−x) kaçtır?',4,'5-(1-x)',
            ['x>0 iken 1−x<1 olduğundan g’nin sol kolu kullanılır.','g(1−x)=4+x ve sağdan limit 4’tür.'],point=0,direction='+',difficulty='hard',**kw)
    q.branches(key,'branch-symmetric-continuity','f(x), x<0 için 3−x; x≥0 için 3+x’tir. lim(x→0)f(x) kaçtır?',3,'3-x','3+x',0,'L',
               ['Sol kol 3’e, sağ kol da 3’e yaklaşır.','İki yanlı limit 3’tür.'],two_sided=True,**kw)
    q.raw_solve(key,'branch-limit-without-continuity','f(x), x<1 için x+a; x=1 için 9; x>1 için 2x−a’dır. x=1’de iki yanlı limitin var olması için a kaç olmalıdır?',s.Rational(1,2),
                'Subs(x+a,x,1)-Subs(2*x-a,x,1)',
                ['İki yanlı limit için yalnız sol ve sağ yaklaşımlar eşit olmalı; nokta değeri 9 bu eşitliği etkilemez.','1+a=2−a ⇒ 2a=1 ⇒ a=1/2.'],difficulty='hard',**kw)
    q.limit(key,'branch-opposite-input-ratio','f(t), t<0 için t²+4; t≥0 için 2t+1’dir. lim(h→0⁺)f(−h)/f(h) kaçtır?',4,'((-x)**2+4)/(2*x+1)',
            ['h>0 iken −h sol kola, h sağ kola düşer.','Oran (h²+4)/(2h+1) olur ve 4’e yaklaşır.'],point=0,direction='+',difficulty='hard',**kw)
    q.finite(key,'branch-count-failed-limits','f(x), x<0 için x+1; 0≤x≤1 için 2; x>1 için 3−x’tir. {0,1} kümesindeki kaç noktada iki yanlı limit yoktur?',1,
             {'z':[0,1]},'(z==0 and z+1!=2) or (z==1 and 2!=3-z)',{'kind':'count'},
             ['0’da sol limit 1, sağ limit 2 olduğundan limit yoktur.','1’de iki taraftaki limit de 2; yalnız bir noktada limit yoktur.'],**kw)


def first_derivative_parameter(q):
    key='first_derivative_parameter';kw={'course':'derivative','topic':'Türev','subtopic':'Eğim, çarpım, bölüm ve zincir koşullarından parametre'}
    rows=[
        ('slope-linear-times-quadratic','f(x)=(x+a)(x²+1) ve f′(1)=10 ise a kaçtır?',3,'Subs(Derivative((x+a)*(x**2+1),x),x,1)-10',
         ['Çarpım kuralıyla f′(1)=2+2(1+a)=4+2a.','4+2a=10 ⇒ a=3.']),
        ('slope-quotient-coefficient','f(x)=(ax+1)/(x+2) ve f′(0)=3/4 ise a kaçtır?',2,'Subs(Derivative((a*x+1)/(x+2),x),x,0)-Rational(3,4)',
         ['Bölüm kuralı f′(x)=(2a−1)/(x+2)² verir.','(2a−1)/4=3/4 ⇒ a=2.']),
        ('slope-exponential-amplitude','f(x)=a·2ˣ+x ve f′(0)=1+3ln2 ise a kaçtır?',3,'Subs(Derivative(a*2**x+x,x),x,0)-(1+3*log(2))',
         ['f′(0)=a·ln2+1.','ln2≠0 olduğundan a·ln2=3ln2 ⇒ a=3.']),
        ('slope-inner-linear-factor','f(x)=sin(ax) ve f′(0)=5 ise a kaçtır? Açılar radyandır.',5,'Subs(Derivative(sin(a*x),x),x,0)-5',
         ['Zincir kuralı f′(x)=a·cos(ax) verir.','0’da cos0=1 olduğundan a=5.']),
        ('slope-composite-branch','a>−1, f(x)=(x²+a)³ ve f′(1)=24 ise a kaçtır?',1,'Subs(Derivative((x**2+a)**3,x),x,1)-24',
         ['f′(1)=6(1+a)²=24; (1+a)²=4.','a=1 veya a=−3 çıkar; a>−1 koşulu a=1’i seçer.']),
        ('slope-tangent-parallel','f(x)=ax²+3x eğrisinin x=2 noktasındaki teğeti y=11x−2 doğrusuna paraleldir. a kaçtır?',2,'Subs(Derivative(a*x**2+3*x,x),x,2)-11',
         ['Paralel doğruların eğimleri aynıdır; f′(2)=11.','4a+3=11 ⇒ a=2.']),
        ('slope-matching-two-curves','f(x)=ax²+x ve g(x)=x³ eğrilerinin x=2’deki teğetleri paraleldir. a kaçtır?',s.Rational(11,4),'Subs(Derivative(a*x**2+x,x),x,2)-Subs(Derivative(x**3,x),x,2)',
         ['İki eğim 4a+1 ve 12’dir.','4a+1=12 ⇒ a=11/4.']),
        ('slope-scaled-difference-quotient','f(x)=x²+ax ve lim(h→0)[f(1+2h)−f(1)]/h=20 ise a kaçtır?',8,'Subs(Derivative((1+2*x)**2+a*(1+2*x),x),x,0)-20',
         ['Artış 2h olduğundan limit 2f′(1)=2(2+a)’dır.','4+2a=20 ⇒ a=8.']),
        ('slope-opposite-point-sum','f(x)=ax³−x ve f′(1)+f′(−1)=16 ise a kaçtır?',3,'Subs(Derivative(a*x**3-x,x),x,1)+Subs(Derivative(a*x**3-x,x),x,-1)-16',
         ['f′(x)=3ax²−1; iki noktada da 3a−1 olur.','6a−2=16 ⇒ a=3.']),
        ('slope-positive-location','f(x)=x³ için f′(a)=12 ve a>0 ise a kaçtır?',2,'Subs(Derivative(x**3,x),x,a)-12',
         ['f′(a)=3a²=12; a²=4.','Pozitiflik koşulundan a=2.']),
    ]
    for slug,prompt,answer,expr,steps in rows:
        conditions=([{'left':'a','op':'gt','right':'-1'}] if 'composite-branch' in slug else
                    [{'left':'a','op':'gt','right':'0'}] if 'positive-location' in slug else [])
        q.raw_solve(key,slug,prompt,answer,expr,steps,conditions=conditions,difficulty='hard' if any(t in slug for t in ('quotient','composite','scaled')) else 'medium',**kw)


def polynomial_operator_identities(q):
    key='polynomial_operator_identities';kw={'course':'derivative','topic':'Türev','subtopic':'Polinom ve türev kimliğinde derece ile katsayı eşleştirme'}
    rows=[
        ('operator-linear-multiplier','P bir polinomdur. P′(x)+2P(x)=6x+5 ise P(2) kaçtır?',7,
         'Derivative(a*x+b,x)+2*(a*x+b)','6*x+5',['a','b'],'2*a+b',
         ['P’nin en yüksek derecesi sağ taraf nedeniyle 1’dir; P=ax+b yazılır.','2a=6 ve a+2b=5 ⇒ a=3,b=1.','P(2)=7.']),
        ('operator-subtracted-derivative','P bir polinomdur. P(x)−P′(x)=x²+1 ise P(−1) kaçtır?',2,
         '(a*x**2+b*x+c)-Derivative(a*x**2+b*x+c,x)','x**2+1',['a','b','c'],'a-b+c',
         ['En yüksek derece 2; P=ax²+bx+c yazılır.','a=1, b−2a=0 ve c−b=1 ⇒ b=2,c=3.','P(−1)=1−2+3=2.']),
        ('operator-euler-coefficients','P bir polinomdur. xP′(x)+P(x)=9x²+4x+1 ise P(1) kaçtır?',6,
         'x*Derivative(a*x**2+b*x+c,x)+(a*x**2+b*x+c)','9*x**2+4*x+1',['a','b','c'],'a+b+c',
         ['xP′+P’de n. dereceli katsayı n+1 ile çarpılır; derece 2 olur.','3a=9,2b=4,c=1 ⇒ P=3x²+2x+1.','P(1)=6.']),
        ('operator-free-quadratic-kernel','Derecesi en fazla 2 olan P polinomu xP′(x)−2P(x)=3x+4 eşitliğini sağlar. P′(0)+P(0) kaçtır?',-5,
         'x*Derivative(a*x**2+b*x+c,x)-2*(a*x**2+b*x+c)','3*x+4',['a','b','c'],'b+c',
         ['P=ax²+bx+c yazılır; a’lı terimler yok olur ve −bx−2c=3x+4 çıkar.','b=−3,c=−2; a’nın serbest olması istenen toplamı etkilemez.','P′(0)+P(0)=−5.']),
        ('operator-second-derivative','P bir polinomdur. P″(x)+P(x)=2x²+4x+7 ise P(0) kaçtır?',3,
         'Derivative(a*x**2+b*x+c,x,2)+(a*x**2+b*x+c)','2*x**2+4*x+7',['a','b','c'],'c',
         ['P terimi en yüksek dereceyi taşıdığından derece 2’dir.','a=2,b=4 ve c+2a=7 ⇒ c=3.','P(0)=3.']),
        ('operator-shifted-polynomial','P bir polinomdur. P′(x)+P(x+1)=2x²+10x+8 ise P(−1) kaçtır?',2,
         'Derivative(a*x**2+b*x+c,x)+(a*(x+1)**2+b*(x+1)+c)','2*x**2+10*x+8',['a','b','c'],'a-b+c',
         ['P=ax²+bx+c yazılır; katsayılar a,4a+b,a+2b+c olur.','a=2,b=2,c=2 bulunur.','P(−1)=2.']),
        ('operator-cubic-triangular-system','P bir polinomdur. P′(x)+P(x)=x³+3x²+5x+6 ise P(1) kaçtır?',7,
         'Derivative(a*x**3+b*x**2+c*x+d,x)+(a*x**3+b*x**2+c*x+d)','x**3+3*x**2+5*x+6',['a','b','c','d'],'a+b+c+d',
         ['P’nin derecesi 3’tür; en yüksek katsayıdan başlanır.','a=1,b+3a=3,c+2b=5,d+c=6 ⇒ b=0,c=5,d=1.','P(1)=7.']),
        ('operator-affine-weighted-derivative','P bir polinomdur. (x+1)P′(x)+P(x)=6x²+10x+7 ise P(1) kaçtır?',9,
         '(x+1)*Derivative(a*x**2+b*x+c,x)+(a*x**2+b*x+c)','6*x**2+10*x+7',['a','b','c'],'a+b+c',
         ['P=ax²+bx+c için katsayılar 3a,2a+2b,b+c’dir.','a=2,b=3,c=4 bulunur.','P(1)=9.']),
        ('operator-constant-cancels','Derecesi en fazla 3 olan P için P″(x)+2P′(x)=12x²+12x+4’tür. P(2)−P(0) kaçtır?',20,
         'Derivative(a*x**3+b*x**2+c*x+d,x,2)+2*Derivative(a*x**3+b*x**2+c*x+d,x)','12*x**2+12*x+4',['a','b','c','d'],'8*a+4*b+2*c',
         ['Katsayılar 6a=12,6a+4b=12,2b+2c=4 verir; a=2,b=0,c=2.','Sabit d belirsizdir ama iki değer çıkarıldığında yok olur.','P(2)−P(0)=16+4=20.']),
        ('operator-origin-value-feedback','P bir polinom, P′(x)=P(0)x+6x²+1 ve P(1)=6’dır. P′(1) kaçtır?',9,
         'Derivative(a*x**3+b*x**2+c*x+d,x)','d*x+6*x**2+1',['a','b','c','d'],'3*a+2*b+c',
         ['Türev kimliğinden a=2,2b=d,c=1 çıkar.','P(1)=6 ⇒ b+d=3; dolayısıyla b=1,d=2.','P′(1)=6+2+1=9.']),
    ]
    for slug,prompt,answer,operator,right,variables,target,steps in rows:
        extra={'additional_equations':['Subs(a*x**3+b*x**2+c*x+d,x,1)-6']} if 'feedback' in slug else {}
        q.operator(key,slug,prompt,answer,operator,right,variables,target,steps,difficulty='hard' if any(t in slug for t in ('free','shift','cubic','cancels','feedback')) else 'medium',**extra,**kw)


def fundamental_calculus_relations(q):
    key='fundamental_calculus_relations';kw={'course':'integral','topic':'İntegral','subtopic':'Türev-integral ilişkisi ve değişken sınırlar'}
    rows=[
        ('ftc-direct-upper-endpoint','F(x)=∫₀ˣ(t²+1)dt ise F′(2) kaçtır?',5,'Integral(t**2+1,(t,0,x))',2,1,
         ['Temel teoremle F′(x)=x²+1.','F′(2)=5.']),
        ('ftc-quadratic-upper-chain','G(x)=∫₀^(x²)(t+1)dt ise G′(1) kaçtır?',4,'Integral(t+1,(t,0,x**2))',1,1,
         ['Değişken üst sınır için G′(x)=(x²+1)·2x.','x=1 konursa 4 bulunur.']),
        ('ftc-both-endpoints-move','H(x)=∫ₓ^(2x)t²dt ise H′(1) kaçtır?',7,'Integral(t**2,(t,x,2*x))',1,1,
         ['Üst sınırın katkısı (2x)²·2, alt sınırın katkısı −x² olur.','H′(x)=7x²; H′(1)=7.']),
        ('ftc-remove-two-constants','d/dx(x⁵−2x³)=∫f′(x)dx eşitliği sağlanıyor. f″(1) kaçtır?',48,'x**5-2*x**3',1,3,
         ['Sağ taraf f(x)+C olduğundan f, sol taraftaki türeve bir sabit farkla eşittir.','f″, verilen polinomun üçüncü türevidir: 60x²−12.','1’de sonuç 48.']),
        ('ftc-trigonometric-antiderivative','∫f′(x)dx=x³+sinx+C ise f′(0) kaçtır? Açılar radyandır.',1,'x**3+sin(x)',0,1,
         ['Eşitliğin iki tarafı türevlenir; f′(x)=3x²+cosx.','0’da 0+1=1.']),
        ('ftc-derivative-of-slope-integral','F′(x)=∫₀ˣ2t dt ise F″(3) kaçtır?',6,'Integral(2*t,(t,0,x))',3,1,
         ['Verilen eşitlik bir kez türevlenirse F″(x)=2x olur.','F″(3)=6.']),
        ('ftc-integrand-contains-parameter','F(x)=∫₀ˣ(x+t)dt ise F′(2) kaçtır?',6,'Integral(x+t,(t,0,x))',2,1,
         ['İntegralde x, t’ye göre sabittir; F(x)=x²+x²/2=3x²/2.','F′(x)=3x ve F′(2)=6.']),
        ('ftc-recover-integrand-derivative','∫₀ˣf(t)dt=x³+2x eşitliği tüm x için sağlanıyor. f′(1) kaçtır?',6,'x**3+2*x',1,2,
         ['Birinci türev f(x)=3x²+2’yi verir.','İkinci türev f′(x)=6x olduğundan f′(1)=6.']),
        ('ftc-symmetric-moving-bounds','F(x)=∫₋ₓˣ(t³+t²)dt ise F′(1) kaçtır?',2,'Integral(t**3+t**2,(t,-x,x))',1,1,
         ['Simetrik sınırlar arasında t³’ün integrali 0 olur; F(x)=2x³/3.','F′(x)=2x² ve F′(1)=2.']),
    ]
    for slug,prompt,answer,expr,point,order,steps in rows:
        q.derivative(key,slug,prompt,answer,expr,point,steps,order=order,difficulty='hard' if any(t in slug for t in ('both','parameter','symmetric','quadratic')) else 'medium',**kw)
    q.calc(key,'ftc-endpoint-difference','∫₁ˣf′(t)dt=x²−1 ise f(3)−f(1) kaçtır?',8,
           'Subs(x**2-1,x,3)',['Temel teoremle sol taraf f(x)−f(1)’dir.','x=3 için f(3)−f(1)=3²−1=8.'],**kw)


def exact_differentials(q):
    key='exact_differentials';kw={'course':'integral','topic':'İntegral','subtopic':'Tam diferansiyel, uç değerler ve değişken değiştirme'}
    rows=[
        ('differential-rational-endpoints','∫₀¹ d[x²/(x+1)] kaçtır?',s.Rational(1,2),'(2*x*(x+1)-x**2)/(x+1)**2',0,1,
         ['Tam diferansiyelin integrali içteki fonksiyonun uç değer farkıdır.','1²/(1+1)−0²/(0+1)=1/2.']),
        ('differential-shifted-cube','∫₁³ d[(x−1)³] kaçtır?',8,'3*(x-1)**2',1,3,
         ['Uç değerler (3−1)³=8 ve (1−1)³=0’dır.','Fark 8.']),
        ('differential-reverse-reciprocal','∫₂⁰ d[1/(x+1)] kaçtır?',s.Rational(2,3),'-1/(x+1)**2',2,0,
         ['Sınırların yönü korunarak son değer eksi ilk değer alınır.','1/(0+1)−1/(2+1)=1−1/3=2/3.']),
        ('differential-sine-product-endpoints','∫₀^(π/4) d(sinx·cosx) kaçtır? Açılar radyandır.',s.Rational(1,2),'cos(x)**2-sin(x)**2',0,'pi/4',
         ['Tam diferansiyelin integrali sinx·cosx çarpımının uç değer farkıdır.','π/4’te değer (√2/2)²=1/2, 0’da 0; fark 1/2.']),
        ('differential-complete-period','∫₀^π d[cos(2x)] kaçtır? Açılar radyandır.',0,'-2*sin(2*x)',0,'pi',
         ['İç fonksiyonun ilk ve son değerleri cos0=1 ve cos2π=1’dir.','Net değişim 0.']),
        ('differential-logarithmic-composition','∫₀¹ d[ln(1+x³)] kaçtır?',s.log(2),'3*x**2/(1+x**3)',0,1,
         ['İçteki fonksiyonun son ve ilk değerleri ln2 ve ln1’dir.','Fark ln2 olur.']),
        ('differential-weighted-substitution','∫₀¹(x+1) d[(x+1)²] kaçtır?',s.Rational(14,3),'2*(x+1)**2',0,1,
         ['d[(x+1)²]=2(x+1)dx olduğundan integrand 2(x+1)²’dir.','[2(x+1)³/3]₀¹=2(8−1)/3=14/3.']),
        ('differential-product-net-change','∫₀¹ d[(x²+1)(x+2)] kaçtır?',4,'2*x*(x+2)+(x**2+1)',0,1,
         ['Çarpımı açmak zorunlu değildir; iç fonksiyonun uç değerleri yeterlidir.','x=1’de 6, x=0’da 2; fark 4.']),
    ]
    for slug,prompt,answer,expr,lower,upper,steps in rows:
        q.integral(key,slug,prompt,answer,expr,lower,upper,steps,difficulty='hard' if 'weighted' in slug else 'medium',**kw)
    q.integral(key,'differential-initial-constant','F(x)=∫d[(x+1)⁴] ve F(0)=5 ise F(1) kaçtır?',20,'4*(x+1)**3',0,1,
               ['F(x)=(x+1)⁴+C; F(0)=5 ⇒ C=4.','F(1)=16+4=20.'],offset=5,**kw)
    q.raw_solve(key,'differential-unknown-coefficient','∫₀² d(ax²+x)=14 ise a kaçtır?',3,
                'Subs(a*x**2+x,x,2)-Subs(a*x**2+x,x,0)-14',
                ['Tam diferansiyelin toplam değişimi 4a+2’dir.','4a+2=14 ⇒ a=3.'],**kw)


def explicit_sequence_terms(q):
    key='explicit_sequence_terms';kw={'course':'sequences','topic':'Diziler','subtopic':'Genel terim, indis, dönüşüm ve terim koşulları'}
    q.calc(key,'term-consecutive-increment','aₙ=n(n+1) dizisinde a₅−a₄ kaçtır?',10,
           '5*(5+1)-4*(4+1)',['a₅=30 ve a₄=20.','Fark 10.'],**kw)
    q.emit(key,'term-alternating-sum','aₙ=(−1)ⁿ(n+2) dizisinin ilk dört teriminin toplamı kaçtır?',2,
           ['İlk dört terim −3,4,−5,6’dır.','Toplam (−3+4)+(−5+6)=2.'],
           {'kind':'exact_math','operation':'sequence_sum','expression':'(-1)**x*(x+2)','start':1,'end':4},**kw)
    q.finite(key,'term-index-from-value','aₙ=2n+1, n=1,2,… dizisinde 25 değeri kaçıncı terimdir?',12,
             {'n':[1,30]},'2*n+1==25',{'kind':'unique','expression':'n'},
             ['2n+1=25 denklemi 2n=24 verir.','n=12 olduğundan 25, on ikinci terimdir.'],**kw)
    q.calc(key,'term-doubled-index-identity','aₙ=n², n=1,2,… dizisi için a₂ₙ−4aₙ kaçtır?',0,
           '(2*n)**2-4*n**2',['a₂ₙ=(2n)²=4n².','4aₙ de 4n² olduğundan fark her pozitif tam sayı n için 0.'],**kw)
    q.calc(key,'term-rational-ratio','aₙ=1/[n(n+1)] dizisinde a₃/a₂ kaçtır?',s.Rational(1,2),
           '(1/(3*(3+1)))/(1/(2*(2+1)))',['a₃=1/12, a₂=1/6.','(1/12)/(1/6)=1/2.'],**kw)
    q.finite(key,'term-exponential-first-threshold','aₙ=2ⁿ, n=1,2,… dizisinde 50’den büyük olan ilk terimin indisi kaçtır?',6,
             {'n':[1,20]},'2**n>50',{'kind':'min','expression':'n'},
             ['Dizi kesin artandır; 2⁵=32≤50 ve 2⁶=64>50.','İlk uygun indis 6’dır.'],difficulty='hard',**kw)
    q.finite(key,'term-first-ten-minimum','aₙ=n²−6n+12 dizisinin ilk on terimi içinde en küçük terim değeri kaçtır?',3,
             {'n':[1,10]},'True',{'kind':'min','expression':'n**2-6*n+12'},
             ['Genel terim (n−3)²+3 biçimindedir.','n=3, ilk on indis içindedir; en küçük değer 3.'],**kw)
    q.calc(key,'term-derived-sequence','aₙ=3n−2 ve bₙ=aₙ₊₁+aₙ olarak tanımlanıyor. b₄ kaçtır?',23,
           '(3*(4+1)-2)+(3*4-2)',['b₄=a₅+a₄=13+10.','b₄=23.'],**kw)
    q.calc(key,'term-reciprocal-product','aₙ=n+1/n, n=1,2,… dizisinde a₂·a₃ kaçtır?',s.Rational(25,3),
           '(2+Rational(1,2))*(3+Rational(1,3))',['a₂=5/2 ve a₃=10/3.','Çarpımları 50/6=25/3.'],**kw)
    q.finite(key,'term-absolute-window','aₙ=|n−4| dizisinin ilk sekiz teriminden kaçı 2’den büyük değildir?',5,
             {'n':[1,8]},'Abs(n-4)<=2',{'kind':'count'},
             ['|n−4|≤2 eşitsizliği 2≤n≤6 verir.','2,3,4,5,6 indisleri olmak üzere 5 terim uygundur.'],**kw)


def nested_geometric_sequences(q):
    key='nested_geometric_sequences';kw={'course':'sequences','topic':'Diziler','subtopic':'Geometrik kısmi toplam, yineleme ve iç içe toplam'}
    q.calc(key,'geometric-last-increment','bₙ=1+2+2²+…+2ⁿ⁻¹ ise b₄−b₃ kaçtır?',8,
           'Sum(2**j,(j,0,3))-Sum(2**j,(j,0,2))',['İki toplamın ortak ilk üç terimi yok olur.','Yalnız 2³=8 kalır.'],**kw)
    q.finite(key,'geometric-index-inverse','bₙ=1+2+2²+…+2ⁿ⁻¹ dizisinde bₙ=63 ise n kaçtır?',6,
             {'n':[1,12]},'2**n-1==63',{'kind':'unique','expression':'n'},
             ['Geometrik toplam bₙ=(2ⁿ−1)/(2−1)=2ⁿ−1.','2ⁿ=64 ⇒ n=6.'],**kw)
    q.emit(key,'geometric-alternating-partial','bₙ=1−2+4−8+…+(−2)ⁿ⁻¹ ise b₄ kaçtır?',-5,
           ['İlk dört terim 1,−2,4,−8’dir.','1−2+4−8=−5.'],
           {'kind':'exact_math','operation':'sequence_sum','expression':'(-2)**(x-1)','start':1,'end':4},**kw)
    q.calc(key,'geometric-remainder-ratio','bₙ=1+1/2+1/2²+…+1/2ⁿ⁻¹ ise (2−b₅)/(2−b₃) kaçtır?',s.Rational(1,4),
           '(2-Sum(Rational(1,2)**j,(j,0,4)))/(2-Sum(Rational(1,2)**j,(j,0,2)))',
           ['Geometrik toplam bₙ=2−2^(1−n) olur.','Oran 2⁻⁴/2⁻²=1/4.'],difficulty='hard',**kw)
    q.calc(key,'geometric-double-sum-recurrence','bₖ=1+2+…+2ᵏ⁻¹ ve cₙ=b₁+b₂+…+bₙ olsun. c₅−2c₄ kaçtır?',5,
           'Sum(Sum(2**j,(j,0,n-1)),(n,1,5))-2*Sum(Sum(2**j,(j,0,n-1)),(n,1,4))',
           ['b₁,…,b₅ sırasıyla 1,3,7,15,31’dir.','c₄=26, c₅=57; 57−2·26=5.'],difficulty='hard',**kw)
    q.emit(key,'geometric-weighted-position','bₙ=∑ⱼ₌₁ⁿ j·2ʲ⁻¹ ise b₄ kaçtır?',49,
           ['Terimler 1·1,2·2,3·4,4·8’dir.','Toplam 1+4+12+32=49.'],
           {'kind':'exact_math','operation':'sequence_sum','expression':'x*2**(x-1)','start':1,'end':4},**kw)
    q.finite(key,'geometric-unknown-ratio','r pozitif tam sayıdır. 1+r+r²+r³=40 ise r kaçtır?',3,
             {'r':[1,10]},'1+r+r**2+r**3==40',{'kind':'unique','expression':'r'},
             ['r=3 için 1+3+9+27=40.','Pozitif r’de toplam kesin artandır; bu nedenle başka r yoktur.'],**kw)
    q.calc(key,'geometric-shifted-exponent-window','aₖ=2ᵏ+2ᵏ⁺¹+…+2²ᵏ olarak tanımlanıyor. a₂ kaçtır?',28,
           'Sum(2**j,(j,2,4))',['k=2 için üsler 2’den 4’e kadardır.','a₂=4+8+16=28.'],**kw)
    q.calc(key,'geometric-general-recurrence','bₙ=1+3+3²+…+3ⁿ⁻¹ için bₙ₊₁−3bₙ ifadesi her pozitif tam sayı n’de kaça eşittir?',1,
           '(3**(n+1)-1)/2-3*(3**n-1)/2',
           ['bₙ=(3ⁿ−1)/2 kapalı biçimi kullanılır.','Fark [3ⁿ⁺¹−1−3ⁿ⁺¹+3]/2=1 olur.'],difficulty='hard',**kw)
    q.finite(key,'geometric-divisibility-pattern','bₙ=1+2+…+2ⁿ⁻¹ dizisinin ilk altı teriminden kaçı 7’ye tam bölünür?',2,
             {'n':[1,6]},'(2**n-1)%7==0',{'kind':'count'},
             ['İlk altı kısmi toplam 1,3,7,15,31,63’tür.','7 ve 63 bölünür; 2 terim uygundur.'],difficulty='hard',**kw)


def exponential_inverse_operations(q):
    key='exponential_inverse_operations';kw={'course':'logarithms','topic':'Logaritma','subtopic':'Üstel büyüme, ters işlem ve logaritmayla çözüm'}
    rows=[
        ('exponent-growth-factor','B(t)=5·2ᵗ büyüklüğü 35 olduğunda t kaçtır?',s.log(7)/s.log(2),'5*2**x-35',
         ['5·2ᵗ=35 ⇒ 2ᵗ=7.','2 tabanında logaritma alınır: t=log₂7.']),
        ('exponent-reciprocal-base','(1/3)ˣ=5 ise x kaçtır?',-s.log(5)/s.log(3),'Rational(1,3)**x-5',
         ['(1/3)ˣ=3⁻ˣ olduğundan −x=log₃5.','x=−log₃5.']),
        ('exponent-mixed-base-product','2ˣ·3ˣ⁻¹=4 ise x kaçtır?',s.log(12)/s.log(6),'2**x*3**(x-1)-4',
         ['3 ile çarpınca 2ˣ·3ˣ=12, yani 6ˣ=12 olur.','x=log₆12.']),
        ('exponent-quotient-of-bases','3²ˣ/2ˣ=7 ise x kaçtır?',s.log(7)/s.log(s.Rational(9,2)),'3**(2*x)/2**x-7',
         ['Sol taraf (9/2)ˣ’tir.','x=log₍₉/₂₎7.']),
        ('exponent-quadratic-substitution','4ˣ−2ˣ=6 ise x kaçtır?',s.log(3)/s.log(2),'4**x-2**x-6',
         ['u=2ˣ>0 için u²−u−6=(u−3)(u+2)=0.','u=−2 kabul edilmez; 2ˣ=3 ⇒ x=log₂3.']),
        ('exponent-positive-square-root','x>0 ve 2^(x²)=7 ise x kaçtır?',s.sqrt(s.log(7)/s.log(2)),'2**(x**2)-7',
         ['2 tabanında logaritma alınır: x²=log₂7.','Pozitiflik koşulu x=√(log₂7) verir.']),
        ('exponent-opposed-linear-slopes','2ˣ⁺¹=3²⁻ˣ ise x kaçtır?',s.log(s.Rational(9,2))/s.log(6),'2**(x+1)-3**(2-x)',
         ['Her iki taraf 3ˣ/2 ile çarpılınca 6ˣ=9/2 elde edilir.','x=log₆(9/2).']),
    ]
    for slug,prompt,answer,expr,steps in rows:
        conditions=[{'left':'x','op':'gt','right':'0'}] if 'positive-square-root' in slug else []
        q.raw_solve(key,slug,prompt,answer,expr,steps,variable='x',conditions=conditions,difficulty='hard' if any(t in slug for t in ('mixed','quadratic','square','opposed')) else 'medium',**kw)
    q.solve_objective(key,'exponent-eliminate-unknown','2²ˣ⁻¹=3 ise 4ˣ kaçtır?',6,'2**(2*x-1)-3','4**x',
                      ['İki taraf 2 ile çarpılır: 2²ˣ=6.','2²ˣ=4ˣ olduğundan istenen değer 6.'],**kw)
    q.calc(key,'exponent-two-measurement-combination','3ᵃ=5 ve 3ᵇ=7 ise 3²ᵃ⁻ᵇ kaçtır?',s.Rational(25,7),
           '3**(2*log(5)/log(3)-log(7)/log(3))',
           ['Üs kuralları 3²ᵃ⁻ᵇ=(3ᵃ)²/(3ᵇ) verir.','5²/7=25/7.'],**kw)
    q.finite(key,'exponent-first-integer-growth','n pozitif tam sayıdır. (3/2)ⁿ>10 koşulunu sağlayan en küçük n kaçtır?',6,
             {'n':[1,20]},'Rational(3,2)**n>10',{'kind':'min','expression':'n'},
             ['(3/2)⁵=243/32<10, (3/2)⁶=729/64>10.','Taban 1’den büyük olduğu için dizi artar; ilk uygun n=6.'],difficulty='hard',**kw)


def coupled_logarithmic_systems(q):
    key='coupled_logarithmic_systems';kw={'course':'logarithms','topic':'Logaritma','subtopic':'Birbirine bağlı logaritmik denklemler ve taban değiştirme'}
    rows=[
        ('logs-linear-exponent-coupling','a,b gerçek sayıdır. log₂(2ᵃ)=b+1 ve log₃(9ᵇ)=a+2 ise a+b kaçtır?',7,
         ['log(2**a,2)-b-1','log(9**b,3)-a-2'],'a+b',[],
         ['Logaritmalar a ve 2b’ye eşittir; a=b+1, 2b=a+2.','Yerine koyma b=3,a=4 verir; toplam 7.']),
        ('logs-sum-difference-coordinates','a>0,b>0 ve log₂a+log₂b=3, log₂a−log₂b=1 ise a+b kaçtır?',6,
         ['log(a,2)+log(b,2)-3','log(a,2)-log(b,2)-1'],'a+b',['a','b'],
         ['u=log₂a,v=log₂b seçilirse u+v=3,u−v=1.','u=2,v=1 ⇒ a=4,b=2; toplam 6.']),
        ('logs-product-with-ratio','a>0,b>0, log₂a+log₂b=4 ve a/b=4 ise a−b kaçtır?',6,
         ['log(a,2)+log(b,2)-4','a-4*b'],'a-b',['a','b'],
         ['Logaritma toplamından ab=16; oran koşulundan a=4b.','4b²=16 ve b>0 ⇒ b=2,a=8; fark 6.']),
        ('logs-two-bases-one-argument','a>0 ve log₃a=b, log₉a=2b−3 ise ab kaçtır?',18,
         ['log(a,3)-b','log(a,9)-2*b+3'],'a*b',['a'],
         ['Taban değiştirme log₉a=(log₃a)/2=b/2 verir.','b/2=2b−3 ⇒ b=2; a=9 ve ab=18.']),
        ('logs-power-link-and-sum','a>0,b>0, log₂a=log₄b ve a+b=6 ise b−a kaçtır?',2,
         ['log(a,2)-log(b,4)','a+b-6'],'b-a',['a','b'],
         ['log₄b=(log₂b)/2 olduğundan 2log₂a=log₂b ⇒ b=a².','a²+a=6; a>0 koşuluyla a=2,b=4; fark 2.']),
        ('logs-unknown-base-chain','a>0,a≠1,b>0,b≠1 ve logₐ16=2, log_b a=1/2 ise a+b kaçtır?',20,
         ['log(16,a)-2','log(a,b)-Rational(1,2)'],'a+b',['a','a-1','b','b-1'],
         ['a²=16 ve a>0 ⇒ a=4.','b^(1/2)=a=4 ⇒ b=16; toplam 20.']),
        ('logs-cascaded-bases','a>0,a≠1,b>0,b≠1, logₐb=2 ve log_b81=2 ise ab kaçtır?',27,
         ['log(b,a)-2','log(81,b)-2'],'a*b',['a','a-1','b','b-1'],
         ['b²=81 ve b>0 ⇒ b=9.','a²=b=9 ve a>0 ⇒ a=3; çarpım 27.']),
        ('logs-shifted-argument-to-variable-base','a>1,b>0, log₂(a−1)=2 ve logₐb=3 ise b kaçtır?',125,
         ['log(a-1,2)-2','log(b,a)-3'],'b',['a','a-1','b'],
         ['a−1=4 ⇒ a=5.','log₅b=3 ⇒ b=5³=125.']),
        ('logs-reciprocal-base-values','a>0,a≠1,b>0 ve logₐb=−1, log₂a−log₂b=4 ise a+b kaçtır?',s.Rational(17,4),
         ['log(b,a)+1','log(a,2)-log(b,2)-4'],'a+b',['a','a-1','b'],
         ['İlk eşitlik b=1/a verir; ikinci eşitlik 2log₂a=4 olur.','a=4,b=1/4; toplam 17/4.']),
        ('logs-translated-argument','a>0, log₂a=b ve log₂(8a)=2b ise a−b kaçtır?',5,
         ['log(a,2)-b','log(8*a,2)-2*b'],'a-b',['a'],
         ['log₂(8a)=3+log₂a=3+b.','3+b=2b ⇒ b=3,a=8; fark 5.']),
    ]
    for slug,prompt,answer,equations,target,nonzero,steps in rows:
        q.coupled(key,slug,prompt,answer,equations,target,steps,nonzero=nonzero,difficulty='hard' if any(t in slug for t in ('unknown','cascad','reciprocal','power-link')) else 'medium',**kw)


FAMILIES=(trigonometric_limits,one_sided_limits,first_derivative_parameter,polynomial_operator_identities,
          fundamental_calculus_relations,exact_differentials,explicit_sequence_terms,nested_geometric_sequences,
          exponential_inverse_operations,coupled_logarithmic_systems)


def save_checkpoint(author,output,completed):
    counts=Counter(q['parentQuestionId'] for q in author.questions)
    report={'schemaVersion':1,'generator':VERSION,'questions':author.questions,
            'summary':{'total':len(author.questions),'byExam':dict(Counter(q['examType'] for q in author.questions)),
                       'parents':len(counts),'byParent':dict(counts),'byTopic':dict(Counter(q['topic'] for q in author.questions))},
            'completedFamilies':completed,'pendingFamilies':[f.__name__ for f in FAMILIES if f.__name__ not in completed],
            'ledger':[{'sourceQuestionId':parent,'skill':skill,'count':counts.get(parent,0),
                       'generatedIds':[q['id'] for q in author.questions if q['parentQuestionId']==parent]}
                      for skill,parent in PARENTS.items()],
            'independentVerificationRequired':True}
    output.parent.mkdir(parents=True,exist_ok=True)
    temporary=output.with_name(output.name+'.tmp')
    temporary.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    temporary.replace(output)
    return report


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source-evidence',type=Path,default=ROOT/'data/source-read-evidence.json')
    parser.add_argument('--output',type=Path,default=ROOT/'work/ayt-source-additions-second.json')
    parser.add_argument('--max-families',type=int,default=len(FAMILIES),choices=range(1,len(FAMILIES)+1))
    args=parser.parse_args()
    payload=json.loads(args.source_evidence.read_text())
    evidence=payload if isinstance(payload,list) else payload['evidence']
    author=Author(evidence);completed=[]
    for family in FAMILIES[:args.max_families]:
        before=len(author.questions)
        family(author)
        assert len(author.questions)-before==10,(family.__name__,len(author.questions)-before)
        assert len({q['id'] for q in author.questions})==len(author.questions)
        assert len({q['prompt'] for q in author.questions})==len(author.questions)
        completed.append(family.__name__)
        report=save_checkpoint(author,args.output,completed)
        print(json.dumps({'checkpoint':family.__name__,'questions':len(author.questions)},ensure_ascii=False),flush=True)
    print(json.dumps(report['summary'],ensure_ascii=False))


if __name__=='__main__':
    main()
