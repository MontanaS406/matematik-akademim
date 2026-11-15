#!/usr/bin/env python3
"""One hundred distinct AYT exercises from ten actually read source questions.

The source bodies, five choices, figures and publisher keys were read privately.
Only identity/read evidence and independently authored mathematics are public.
Generation is deterministic; an independent checker decides usability.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path

import sympy as s
from source_derived_generator import Author as BaseAuthor, options

ROOT = Path(__file__).resolve().parents[2]
VERSION = 'read-ayt-ten-structural-variants-v1'
PARENTS = {
    'continuous_radicals': 'ORIG-1fda1064551b-P001-Q01',
    'exponential_limits': 'ORIG-1fda1064551b-P001-Q02',
    'derivative_definition': 'ORIG-d7f29d828181-P001-Q01',
    'second_derivative_parameter': 'ORIG-d7f29d828181-P001-Q03',
    'initial_antiderivative': 'ORIG-214b2c524989-P001-Q02',
    'termwise_integration': 'ORIG-214b2c524989-P001-Q03',
    'sequence_domains': 'ORIG-53bc4bf33464-P001-Q02',
    'telescopic_cancellation': 'ORIG-53bc4bf33464-P001-Q04',
    'logarithm_domains': 'ORIG-8acb0d08e272-P001-Q01',
    'logarithm_power_equations': 'ORIG-8acb0d08e272-P001-Q03',
}
x, h, a, k = s.symbols('x h a k', real=True)


class Author(BaseAuthor):
    def __init__(self, evidence):
        by_id = {row['sourceQuestionId']: row for row in evidence}
        chosen = []
        for skill, identifier in PARENTS.items():
            parent = by_id.get(identifier)
            if not parent or parent.get('readStatus') != 'read' or parent.get('answerStatus') != 'verified':
                raise ValueError('Actually read and independently approved original required: ' + identifier)
            chosen.append({**parent, 'generationSkills': [skill]})
        super().__init__(chosen)

    def emit(self, skill, slug, prompt, answer, steps, spec, structure=None, **kw):
        if slug in {
            'radical-polynomial-composition', 'exp-geometric-factor',
            'difference-quartic-point', 'curvature-cubic-offset',
            'initial-sine-half-period', 'antiderivative-reversed-bounds',
            'sequence-nonpositive-shift', 'telescope-interior-range',
            'log-domain-common-two-logs', 'log-equation-cubic-base',
        }:
            kw['difficulty'] = 'easy'
        super().emit(skill, 'ayt-add-' + slug, prompt, answer, steps, spec, exam='AYT', **kw)
        question = self.questions[-1]
        question['id'] = question['id'].replace('AI-SOURCE-', 'AI-AYT-READ-', 1)
        question['options'], question['answer']['value'] = options(answer, question['id'])
        question['familyId'] = 'read-ayt-' + skill
        question['variationStructure'] = structure or slug
        parent = self.parents[skill]
        question['provenance']['sourceSha256'] = parent['sha256']
        question['provenance']['printedPage'] = parent.get('printedPage')
        question['provenance']['authoringVersion'] = VERSION

    def limit(self, skill, slug, prompt, answer, expression, steps, point=0, variable='x', direction='+-', **kw):
        symbol = s.Symbol(variable, real=True)
        raw = s.sympify(expression, locals={variable: symbol}, rational=True)
        actual = s.limit(raw, symbol, s.sympify(point), dir=direction)
        assert s.simplify(actual - s.sympify(answer)) == 0, (slug, actual, answer)
        self.emit(skill, slug, prompt, answer, steps,
                  {'kind': 'exact_math', 'operation': 'limit', 'expression': expression,
                   'variable': variable, 'point': str(point), 'direction': direction}, **kw)

    def raw_solve(self, skill, slug, prompt, answer, expression, steps, variable='a', conditions=None, **kw):
        # Preserve the raw derivative/integral/log equation for the independent
        # interpreter. Do not replace a question's condition with a-answer=0.
        symbol = s.Symbol(variable, real=True)
        raw = s.sympify(expression, locals={'x': x, 'h': h, 'a': a, 'k': k}, rational=True)
        reduced = s.expand_log(raw.doit())
        roots = s.solveset(reduced, symbol, domain=s.S.Reals)
        assert isinstance(roots, s.FiniteSet), (slug, roots)
        kept = []
        for root in roots:
            keep = True
            for condition in conditions or []:
                left = s.sympify(condition['left'], locals={variable:symbol}).subs(symbol,root)
                right = s.sympify(condition['right'])
                keep &= bool({'gt':lambda:left>right, 'ge':lambda:left>=right,
                              'ne':lambda:left!=right, 'lt':lambda:left<right,
                              'le':lambda:left<=right, 'eq':lambda:left==right}[condition['op']]())
            if keep:
                kept.append(root)
        assert len(kept) == 1 and s.simplify(kept[0] - s.sympify(answer)) == 0, (slug, kept, answer)
        self.emit(skill, slug, prompt, answer, steps,
                  {'kind':'exact_math', 'operation':'solve_parameter', 'expression':expression,
                   'variable':variable, 'conditions':conditions or []}, **kw)

    def integral(self, skill, slug, prompt, answer, expression, lower, upper, steps, offset=0, **kw):
        raw = s.sympify(expression, locals={'x':x}, rational=True)
        actual = s.integrate(raw, (x,s.sympify(lower),s.sympify(upper))) + s.sympify(offset)
        assert s.simplify(actual-s.sympify(answer)) == 0, (slug,actual,answer)
        self.emit(skill,slug,prompt,answer,steps,
                  {'kind':'exact_math','operation':'integral','expression':expression,
                   'variable':'x','lower':str(lower),'upper':str(upper),'offset':str(offset)}, **kw)


def continuous_radicals(b):
    key='continuous_radicals'; kw={'course':'limits','topic':'Limit ve Süreklilik','subtopic':'Köklü ifadelerde süreklilik ve tek yanlı limit'}
    rows=[
        ('radical-polynomial-composition', 'lim(x→1) √(2x²+3x+4) kaçtır?',3,'sqrt(2*x**2+3*x+4)',1,
         ['Kök içi 1’de 9’dur; 1’in yakınında pozitiftir.','Süreklilikten limit √9=3 olur.']),
        ('radical-quotient-nonzero', 'lim(x→4) √(x+5)/(√(2x+1)+1) kaçtır?',s.Rational(3,4),'sqrt(x+5)/(sqrt(2*x+1)+1)',4,
         ['Pay 3’e, payda 4’e yaklaşır; paydanın limiti sıfır değildir.','Bölümün limiti 3/4’tür.']),
        ('radical-product-approach', 'lim(x→2) [√(x²+5)·√(4x+1)] kaçtır?',9,'sqrt(x**2+5)*sqrt(4*x+1)',2,
         ['Her iki kök de 2’nin yakınında tanımlıdır ve 3’e yaklaşır.','Çarpımın limiti 3·3=9.']),
        ('radical-nested-response', 'Bir ölçümün çıktısı R(x)=√(5+√(x²+5)) olarak tanımlıdır. x, 2’ye yaklaşırken çıktı hangi değere yaklaşır?',2*s.sqrt(2),'sqrt(5+sqrt(x**2+5))',2,
         ['İç kök √9=3’e yaklaşır.','Dış kök √(5+3)=√8=2√2’ye yaklaşır.']),
        ('radical-balanced-sensor', 'lim(x→3) [√(x+6)−√(2x+3)]/[√(x+6)+√(2x+3)] kaçtır?',0,'(sqrt(x+6)-sqrt(2*x+3))/(sqrt(x+6)+sqrt(2*x+3))',3,
         ['İki kök de 3’e gider; pay 0’a, payda 6’ya gider.','Paydanın limiti sıfır olmadığı için sonuç 0’dır.']),
        ('radical-cubic-output', 'lim(x→3) (√(x²+7)−1)³ kaçtır?',27,'(sqrt(x**2+7)-1)**3',3,
         ['İçteki kök √16=4’e yaklaşır.','Küp alma süreklidir: (4−1)³=27.']),
        ('radical-inverse-scale', 'lim(x→4) 1/[√(x+5)−1] kaçtır?',s.Rational(1,2),'1/(sqrt(x+5)-1)',4,
         ['Payda √9−1=2’ye yaklaşır ve sıfır değildir.','Tersin limiti 1/2 olur.']),
        ('radical-rational-inside', 'lim(x→1) √[(x²+3)/(x+3)] kaçtır?',1,'sqrt((x**2+3)/(x+3))',1,
         ['Kök içindeki rasyonel ifade 4/4=1’e gider.','Kök çevresinde süreklilik uygulanır ve √1=1 bulunur.']),
    ]
    for slug,prompt,answer,expr,point,steps in rows:
        b.limit(key,slug,prompt,answer,expr,steps,point=point,**kw)
    b.raw_solve(key,'radical-limit-location','a≥−5 ve lim(x→a) √(x+5)=4 olduğuna göre a kaçtır?',11,
                'sqrt(a+5)-4',['Kök fonksiyonu tanımlı olduğu noktada süreklidir: √(a+5)=4.','İki tarafın karesi a+5=16 verir; a=11 koşulu sağlar.'],
                conditions=[{'left':'a','op':'ge','right':'-5'}],difficulty='medium',**kw)
    b.limit(key,'radical-right-sign','lim(x→2⁺) √[(x−2)²]/(x−2) kaçtır?',1,'sqrt((x-2)**2)/(x-2)',
            ['√[(x−2)²]=|x−2|.','Sağdan yaklaşırken x−2>0 olur; bölüm özdeş olarak 1’dir.'],point=2,direction='+',difficulty='hard',**kw)


def exponential_limits(b):
    key='exponential_limits';kw={'course':'limits','topic':'Limit ve Süreklilik','subtopic':'Üstel ifadelerde belirsizlik ve sadeleştirme'}
    rows=[
        ('exp-geometric-factor','lim(x→0) (3²ˣ−1)/(3ˣ−1) kaçtır?',2,'(3**(2*x)-1)/(3**x-1)',0,
         ['t=3ˣ için t→1; (t²−1)/(t−1)=t+1.','Sadeleştirilen ifadenin limiti 2’dir.']),
        ('exp-reciprocal-change','lim(x→0) (2ˣ−1)/(2⁻ˣ−1) kaçtır?',-1,'(2**x-1)/(2**(-x)-1)',0,
         ['t=2ˣ yazılırsa payda 1/t−1=(1−t)/t olur.','Bölüm −t’ye eşittir; t→1 için −1.']),
        ('exp-square-normalization','lim(x→0) (5ˣ−1)²/(5²ˣ−2·5ˣ+1) kaçtır?',1,'(5**x-1)**2/(5**(2*x)-2*5**x+1)',0,
         ['Payda (5ˣ−1)²’dir.','0 dışındaki yakın noktalarda bölüm 1 olduğundan limit 1.']),
        ('exp-rational-factor-pair','lim(x→0) (3²ˣ−1)/(3²ˣ+3ˣ−2) kaçtır?',s.Rational(2,3),'(3**(2*x)-1)/(3**(2*x)+3**x-2)',0,
         ['t=3ˣ ile pay (t−1)(t+1), payda (t−1)(t+2) olur.','Ortak çarpan sadeleşir; t→1 için (t+1)/(t+2)→2/3.']),
        ('exp-rate-at-zero','lim(x→0) (4ˣ−1)/x kaçtır? (ln doğal logaritmadır.)',s.log(4),'(4**x-1)/x',0,
         ['İfade 4ˣ fonksiyonunun 0’daki türev tanımıdır.','Türev 4ˣ·ln4 olduğundan değer ln4.']),
        ('exp-radical-conjugate','lim(x→0) [√(1+3ˣ)−√2]/(3ˣ−1) kaçtır?',s.sqrt(2)/4,'(sqrt(1+3**x)-sqrt(2))/(3**x-1)',0,
         ['Pay ve paydayı kökün eşleniğiyle çarpınca 1/[√(1+3ˣ)+√2] elde edilir.','Limit 1/(2√2)=√2/4 olur.']),
        ('exp-product-cancellation','lim(x→0) [(2ˣ−1)(8ˣ+1)]/(4ˣ−1) kaçtır?',1,'((2**x-1)*(8**x+1))/(4**x-1)',0,
         ['t=2ˣ için ifade (t−1)(t³+1)/[(t−1)(t+1)] olur.','(t³+1)/(t+1) için t=1 konur: 2/2=1.']),
        ('exp-rate-away-zero','lim(x→3) (2ˣ−8)/(x−3) kaçtır? (ln doğal logaritmadır.)',8*s.log(2),'(2**x-8)/(x-3)',3,
         ['Pay 2ˣ−2³ biçimindedir; limit 2ˣ fonksiyonunun 3’teki türevidir.','2³·ln2=8ln2.']),
        ('exp-trigonometric-input','lim(x→0) (2^(sinx)−1)/(2ˣ−1) kaçtır? Açılar radyandır.',1,'(2**sin(x)-1)/(2**x-1)',0,
         ['u=sinx denir. İfade [(2ᵘ−1)/u]·[x/(2ˣ−1)]·[sinx/x] biçiminde ayrılır.',
          'Üç çarpanın limitleri ln2, 1/ln2 ve 1’dir; çarpımları 1 olur.']),
        ('exp-continuous-extension','x≠0 için g(x)=(2ˣ−1)/(4ˣ−1), x=0 için g(0)=c tanımlanıyor. g’nin 0’da sürekli olması için c kaç olmalıdır?',s.Rational(1,2),'(2**x-1)/(4**x-1)',0,
         ['4ˣ−1=(2ˣ−1)(2ˣ+1) olduğundan x≠0 için g(x)=1/(2ˣ+1).','0’daki limit 1/2’dir; süreklilik için c=1/2 gerekir.']),
    ]
    for slug,prompt,answer,expr,point,steps in rows:
        b.limit(key,slug,prompt,answer,expr,steps,point=point,difficulty='hard' if 'rate' in slug else 'medium',**kw)


def derivative_definition(b):
    key='derivative_definition';kw={'course':'derivative','topic':'Türev','subtopic':'Fark oranı, değişim hızı ve zincir kuralı'}
    rows=[
        ('difference-quartic-point','f(x)=x⁴−2x² için lim(h→0)[f(1+h)−f(1)]/h kaçtır?',0,'((1+h)**4-2*(1+h)**2-(1-2))/h',
         ['Fark oranı f′(1)’dir.','f′(x)=4x³−4x olduğundan f′(1)=0.']),
        ('difference-symmetric-denominator','f(x)=x³−x için lim(h→0)[f(2+h)−f(2−h)]/h kaçtır?',22,'(((2+h)**3-(2+h))-((2-h)**3-(2-h)))/h',
         ['Pay iki taraftan simetrik farktır; payda 2h yerine h olduğundan sonuç 2f′(2).','f′(2)=3·4−1=11; sonuç 22.']),
        ('difference-scaled-input','f(x)=x²+3x için lim(h→0)[f(1+3h)−f(1)]/h kaçtır?',15,'((1+3*h)**2+3*(1+3*h)-4)/h',
         ['3h artışını standart fark oranına dönüştürmek dışarıya 3 çarpanı getirir.','3f′(1)=3·(2+3)=15.']),
        ('difference-root-response','lim(h→0) [√(9+h)−3]/h kaçtır?',s.Rational(1,6),'(sqrt(9+h)-3)/h',
         ['Kökün eşleniğiyle çarpılınca 1/[√(9+h)+3] kalır.','h→0 için değer 1/6.']),
        ('difference-sine-small-angle','lim(h→0) sin(4h)/h kaçtır? Açılar radyandır.',4,'sin(4*h)/h',
         ['sin(4h)/h=4·sin(4h)/(4h).','Temel trigonometrik limit 1 olduğundan sonuç 4.']),
        ('difference-reciprocal-response','Bir cihazın tepki fonksiyonu f(x)=1/x’tir. x=2’deki anlık değişim hızı lim(h→0)[1/(2+h)−1/2]/h kaçtır?',s.Rational(-1,4),'(1/(2+h)-Rational(1,2))/h',
         ['Paydaki kesirler birleştirilince −h/[2(2+h)] olur.','h sadeleşir; −1/[2(2+h)]→−1/4.']),
        ('difference-composite-input','f(x)=x² ve g(x)=x²+1 için lim(h→0)[f(g(1+h))−f(g(1))]/h kaçtır?',8,'(((1+h)**2+1)**2-4)/h',
         ['Limit (f∘g)′(1)’dir.','f′(g(1))·g′(1)=2·2·2=8.']),
        ('difference-inverse-orientation','f(x)=x³+2x için lim(h→0)[f(1)−f(1−h)]/h kaçtır?',5,'(3-((1-h)**3+2*(1-h)))/h',
         ['Artış −h seçilirse pay ve paydanın iki eksi işareti birbirini götürür.','f′(1)=3+2=5.']),
        ('difference-position-rate','Bir hareketlinin konumu s(t)=t³−6t²+10t metredir. t=2 anındaki lim(h→0)[s(2+h)−s(2)]/h ile tanımlı hızı kaç m/s’dir?',-2,'(((2+h)**3-6*(2+h)**2+10*(2+h))-4)/h',
         ['Anlık hız s′(2)’dir; s′(t)=3t²−12t+10.','3·4−24+10=−2 m/s.']),
    ]
    for slug,prompt,answer,expr,steps in rows:
        b.limit(key,slug,prompt,answer,expr,steps,variable='h',difficulty='hard' if 'composite' in slug else 'medium',**kw)
    b.raw_solve(key,'difference-location-from-slope','f(x)=x²−4x ve a>2 için lim(h→0)[f(a+h)−f(a)]/h=10 ise a kaçtır?',7,
                'Subs(Derivative(x**2-4*x,x),x,a)-10',
                ['Limit f′(a)=2a−4’tür.','2a−4=10 denklemi a=7 verir; a>2 sağlanır.'],
                conditions=[{'left':'a','op':'gt','right':'2'}],**kw)


def second_derivative_parameter(b):
    key='second_derivative_parameter';kw={'course':'derivative','topic':'Türev','subtopic':'İkinci türev koşullarından parametre'}
    rows=[
        ('curvature-quartic-coefficient','f(x)=ax⁴+2x²+1 ve f″(1)=28 ise a kaçtır?',2,'Subs(Derivative(a*x**4+2*x**2+1,x,2),x,1)-28',
         ['f″(x)=12ax²+4.','12a+4=28 ⇒ a=2.']),
        ('curvature-cubic-offset','f(x)=x³+ax²−5x ve f″(−1)=4 ise a kaçtır?',5,'Subs(Derivative(x**3+a*x**2-5*x,x,2),x,-1)-4',
         ['f″(x)=6x+2a.','−6+2a=4 ⇒ a=5.']),
        ('curvature-slope-function','Bir eğrinin eğim fonksiyonu f′(x)=ax³−4x’tir. f″(2)=20 ise a kaçtır?',2,'Subs(Derivative(a*x**3-4*x,x),x,2)-20',
         ['Eğim fonksiyonunun türevi f″(x)=3ax²−4.','12a−4=20 ⇒ a=2.']),
        ('curvature-sum-two-points','f(x)=x⁴+ax² için f″(1)+f″(2)=84 olduğuna göre a kaçtır?',6,
         'Subs(Derivative(x**4+a*x**2,x,2),x,1)+Subs(Derivative(x**4+a*x**2,x,2),x,2)-84',
         ['f″(x)=12x²+2a.','(12+2a)+(48+2a)=84 ⇒ 4a=24 ⇒ a=6.']),
        ('curvature-zero-location','f(x)=x³−ax²+2 için f″(4)=0 ise a kaçtır?',12,'Subs(Derivative(x**3-a*x**2+2,x,2),x,4)',
         ['f″(x)=6x−2a.','24−2a=0 ⇒ a=12.']),
        ('curvature-product-rule','f(x)=(x+a)(x²−1) ve f″(1)=10 ise a kaçtır?',2,'Subs(Derivative((x+a)*(x**2-1),x,2),x,1)-10',
         ['Çarpım açılırsa f(x)=x³+ax²−x−a olur.','f″(1)=6+2a=10 ⇒ a=2.']),
        ('curvature-reciprocal','x>0 için f(x)=a/x ve f″(2)=3 ise a kaçtır?',12,'Subs(Derivative(a/x,x,2),x,2)-3',
         ['f′(x)=−a/x², f″(x)=2a/x³.','2’de a/4=3 olduğundan a=12.']),
        ('curvature-composition-positive-parameter','a>0, f(x)=(ax+1)³ ve f″(0)=24 ise a kaçtır?',2,'Subs(Derivative((a*x+1)**3,x,2),x,0)-24',
         ['Zincir kuralıyla f″(x)=6a²(ax+1).','6a²=24 ⇒ a²=4. a>0 olduğundan a=2.']),
        ('curvature-trigonometric-term','f(x)=a·sinx+x² ve f″(π/2)=−3 ise a kaçtır? Açılar radyandır.',5,'Subs(Derivative(a*sin(x)+x**2,x,2),x,pi/2)+3',
         ['f″(x)=−a·sinx+2.','π/2’de −a+2=−3 ⇒ a=5.']),
        ('curvature-difference-cancels-offset','f(x)=ax⁴+7x²−x için f″(2)−f″(1)=72 ise a kaçtır?',2,
         'Subs(Derivative(a*x**4+7*x**2-x,x,2),x,2)-Subs(Derivative(a*x**4+7*x**2-x,x,2),x,1)-72',
         ['f″(x)=12ax²+14; fark alınırken 14’ler yok olur.','48a−12a=72 ⇒ a=2.']),
    ]
    for slug,prompt,answer,expr,steps in rows:
        conditions=[{'left':'a','op':'gt','right':'0'}] if 'positive-parameter' in slug else []
        b.raw_solve(key,slug,prompt,answer,expr,steps,conditions=conditions,difficulty='hard' if any(t in slug for t in ('composition','difference','sum')) else 'medium',**kw)


def initial_antiderivative(b):
    key='initial_antiderivative';kw={'course':'integral','topic':'İntegral','subtopic':'Başlangıç değeri ve birikimli değişim'}
    b.integral(key,'initial-position-from-velocity','Bir hareketlinin hızı v(t)=(t+1)(t−2)² ve s(0)=3’tür. s(3) kaçtır?',s.Rational(33,4),'(x+1)*(x-2)**2',0,3,
               ['Hız açılırsa t³−3t²+4 olur. Konum değişimi [t⁴/4−t³+4t]₀³=21/4.','Başlangıç konumu eklenir: 3+21/4=33/4.'],offset=3,**kw)
    b.integral(key,'initial-backward-value','f′(x)=2x/(1+x²) ve f(1)=5 ise f(0) kaçtır? (ln doğal logaritmadır.)',5-s.log(2),'2*x/(1+x**2)',1,0,
               ['Antitürev ln(1+x²)’dir.','f(0)−f(1)=ln1−ln2=−ln2; f(0)=5−ln2.'],offset=5,**kw)
    b.integral(key,'initial-nonzero-start','x>−2 için f′(x)=(x−1)√(x+2) ve f(2)=3’tür. f(7) kaçtır?',s.Rational(247,5),'(x-1)*sqrt(x+2)',2,7,
               ['u=x+2 seçilirse integrand u^(3/2)−3u^(1/2) olur.','Bir antitürev (2/5)u^(5/2)−2u^(3/2)’dir.','u=4 ve u=9 değerleri arasında değişim 232/5; başlangıca eklenince 247/5.'],offset=3,difficulty='hard',**kw)
    b.integral(key,'initial-absolute-rate','f′(x)=|x²−1| ve f(−2)=1 ise f(2) kaçtır?',5,'Abs(x**2-1)',-2,2,
               ['İntegrand çift olduğundan değişim 2[∫₀¹(1−x²)dx+∫₁²(x²−1)dx] olur.','İki integral 2/3 ve 4/3; toplam değişim 4’tür.','f(2)=1+4=5.'],offset=1,difficulty='hard',**kw)
    b.integral(key,'initial-logarithmic-change','x>0 için f′(x)=ln(x)/x ve f(1)=2’dir. f(e²) kaçtır?',4,'log(x)/x',1,s.E**2,
               ['u=lnx seçilirse değişim ∫₀²u du=2 olur.','f(e²)=2+2=4.'],offset=2,difficulty='hard',**kw)
    b.integral(key,'initial-reverse-trigonometric','f′(x)=sin(2x)+2cosx ve f(π/2)=4 ise f(0) kaçtır? Açılar radyandır.',1,'sin(2*x)+2*cos(x)',s.pi/2,0,
               ['Antitürev −cos(2x)/2+2sinx’tir.','0’daki değer −1/2, π/2’deki değer 5/2’dir; geriye doğru değişim −3.','f(0)=4−3=1.'],offset=4,**kw)
    b.integral(key,'initial-sine-half-period','f′(x)=sinx·cosx ve f(−π/2)=8 ise f(π/2) kaçtır? Açılar radyandır.',8,'sin(x)*cos(x)',-s.pi/2,s.pi/2,
               ['sinx tek, cosx çift olduğundan çarpımları tek fonksiyondur.','Simetrik sınırlar arasındaki değişim 0’dır; başlangıç değeri 8 kalır.'],offset=8,**kw)
    b.identity(key,'initial-two-endpoint-sum','f′(x)=2x ve f(1)+f(3)=20 ise f(2) kaçtır?',9,
               ['(1+a)+(9+a)-20'],'4+a',
               ['f(x)=x²+C olur.','(1+C)+(9+C)=20 ⇒ C=5.','f(2)=4+5=9.'],variables=['a'],**kw)
    b.emit(key,'initial-unknown-rate-coefficient','f′(x)=ax+1, f(0)=2 ve f(2)=10 ise f(1) kaçtır?',s.Rational(9,2),
           ['f(x)=ax²/2+x+2.','2a+2+2=10 ⇒ a=3.','f(1)=3/2+1+2=9/2.'],
           {'type':'rational_identity','variables':['a'],'equations':['2*a+2+2-10'],'expression':'a/2+1+2','nonzero':[],
            'supportingChecks':[{'operation':'integral','expression':'3*x+1','lower':'0','upper':'2','expectedValue':'8'},
                                {'operation':'integral','expression':'3*x+1','lower':'0','upper':'1','offset':'2','expectedValue':'9/2'}]},difficulty='hard',**kw)
    b.integral(key,'initial-reservoir-level','Bir tankın düzeyi L(t) için L′(t)=6t(1−t), L(0)=1/2’dir. L(1/2) kaçtır?',1,'6*x*(1-x)',0,s.Rational(1,2),
               ['Düzey değişimi [3t²−2t³]₀^(1/2)=3/4−1/4=1/2.','Başlangıç düzeyi 1/2 eklenince 1 olur.'],offset=s.Rational(1,2),**kw)


def termwise_integration(b):
    key='termwise_integration';kw={'course':'integral','topic':'İntegral','subtopic':'Antitürev, sabitin yok olması ve terim terim integral'}
    b.integral(key,'antiderivative-square-expansion','F′(x)=(2x−1)² ise F(2)−F(0) kaçtır?',s.Rational(14,3),'(2*x-1)**2',0,2,
               ['Kareyi açınca 4x²−4x+1 elde edilir.','[4x³/3−2x²+x]₀²=32/3−8+2=14/3.'],**kw)
    b.integral(key,'antiderivative-symmetric-even','∫₋₁¹(x²+1)³dx kaçtır?',s.Rational(192,35),'(x**2+1)**3',-1,1,
               ['Küp açılımı x⁶+3x⁴+3x²+1’dir; tüm terimler çifttir.','Simetrik integral 2(1/7+3/5+1+1)=192/35 olur.'],difficulty='hard',**kw)
    b.integral(key,'antiderivative-odd-parts-cancel','∫₋₁¹(x⁵+3x²−2x)dx kaçtır?',2,'x**5+3*x**2-2*x',-1,1,
               ['Tek kuvvetli x⁵ ve −2x terimleri simetrik aralıkta 0 verir.','3∫₋₁¹x²dx=[x³]₋₁¹=2.'],**kw)
    b.raw_solve(key,'antiderivative-parameter-area','∫₀¹(ax²+2x)dx=3 ise a kaçtır?',6,'Integral(a*x**2+2*x,(x,0,1))-3',
                ['İntegral a/3+1’dir.','a/3+1=3 ⇒ a=6.'],**kw)
    b.calc(key,'antiderivative-weighted-increments','F′(x)=x² ise 2[F(2)−F(1)]−[F(1)−F(0)] kaçtır?',s.Rational(13,3),
           '2*Integral(x**2,(x,1,2))-Integral(x**2,(x,0,1))',
           ['Antitürev x³/3+C’dir; farklarda C yok olur.','İki fark 7/3 ve 1/3’tür; 2·7/3−1/3=13/3.'],difficulty='hard',**kw)
    b.integral(key,'antiderivative-average-rate','[0,2] aralığında f(x)=3x²+1 fonksiyonunun ortalama değeri (1/2)∫₀²f(x)dx olarak veriliyor. Bu değer kaçtır?',5,'(3*x**2+1)/2',0,2,
               ['Toplam integral [x³+x]₀²=10’dur.','Aralık uzunluğu 2 olduğundan ortalama 10/2=5.'],**kw)
    b.integral(key,'antiderivative-product-unfold','∫₀¹x(x+2)(x−2)dx kaçtır?',s.Rational(-7,4),'x*(x+2)*(x-2)',0,1,
               ['İntegrand x³−4x biçiminde açılır.','[x⁴/4−2x²]₀¹=1/4−2=−7/4.'],**kw)
    b.integral(key,'antiderivative-linear-substitution','∫₀¹3(3x+1)²dx kaçtır?',21,'3*(3*x+1)**2',0,1,
               ['u=3x+1 ile du=3dx, sınırlar 1 ve 4 olur.','[u³/3]₁⁴=(64−1)/3=21.'],**kw)
    b.integral(key,'antiderivative-reversed-bounds','F′(x)=4x³−2x için F(−1)−F(2) kaçtır?',-12,'4*x**3-2*x',2,-1,
               ['F(x)=x⁴−x²+C olduğundan sabit farkta yok olur.','F(−1)−F(2)=0−12=−12.'],**kw)
    b.emit(key,'antiderivative-coefficient-from-primitive','F′(x)=6x²+4x−5 ve F(x)=ax³+bx²+cx+d olduğuna göre a+b+c kaçtır?',-1,
           ['Türev katsayıları 3a=6, 2b=4 ve c=−5 verir.','a=2, b=2 ve c=−5; toplam −1.'],
           {'type':'rational_identity','variables':['a','b','c'],'equations':['3*a-6','2*b-4','c+5'],'expression':'a+b+c','nonzero':[],
            'supportingChecks':[{'operation':'derivative','expression':'2*x**3+2*x**2-5*x','point':'2','expectedValue':'27'}]},**kw)


def sequence_domains(b):
    key='sequence_domains';kw={'course':'sequences','topic':'Diziler','subtopic':'Her indiste tanımlılık ve yasak parametreler'}
    rows=[
        ('sequence-square-poles','m∈{1,2,…,30} için aₖ=1/(k²−m), k=1,2,… biçiminde tanımlanıyor. Tüm terimleri reel ve tanımlı yapan kaç m vardır?',25,{'m':[1,30]},'m not in (1,4,9,16,25)',
         ['Payda yalnız m pozitif tam kare olduğunda bir indiste 0 olur.','1–30 arasında 1,4,9,16,25 yasaktır; 30−5=25.']),
        ('sequence-finite-window','m∈{1,…,12}. Yalnız k=1,2,3,4,5 indisleri için aₖ=1/(2k−m) hesaplanacak. Beş terimin hepsini tanımlı yapan kaç m vardır?',7,{'m':[1,12]},'2*1!=m and 2*2!=m and 2*3!=m and 2*4!=m and 2*5!=m',
         ['Yalnız incelenen beş indisteki paydalar sıfır olmamalı.','2,4,6,8,10 yasak; 12−5=7.']),
        ('sequence-nonpositive-shift','m∈{−3,−2,…,3} için aₖ=1/(k−m), k=1,2,… bir reel sayı dizisi olacaktır. Kaç m uygundur?',4,{'m':[-3,3]},'m<=0',
         ['Pozitif tam sayı m seçilirse k=m terimi tanımsız olur.','m=−3,−2,−1,0 için hiçbir pozitif indiste payda sıfır olmaz; 4 seçim.']),
        ('sequence-radical-all-indices','m, −4≤m≤4 aralığında bir tam sayıdır. aₖ=√(k−m), k=1,2,… dizisinin tüm terimleri reel olsun. Kaç m seçilebilir?',6,{'m':[-4,4]},'1-m>=0',
         ['En küçük kök içi k=1’deki 1−m’dir.','m≤1 olmalı; −4,−3,−2,−1,0,1 olmak üzere 6 değer.']),
        ('sequence-log-argument','m∈{−3,−2,…,6} için aₖ=log₂(k+m), k=1,2,… dizisi tanımlı olsun. Kaç m vardır?',7,{'m':[-3,6]},'1+m>0',
         ['En küçük logaritma argümanı 1+m’dir ve pozitif olmalı.','Tam sayı m≥0 gerekir; 0’dan 6’ya 7 değer.']),
        ('sequence-symmetric-factors','m, −4≤m≤4 aralığında tam sayıdır. aₖ=1/[(k−m)(k+m)], k=1,2,… dizisini bütün indislerde tanımlı yapan kaç m vardır?',1,{'m':[-4,4]},'m==0',
         ['Sıfırdan farklı m için k=|m| seçilince çarpanlardan biri sıfır olur.','m=0 için payda k²>0; yalnız 1 değer uygundur.']),
        ('sequence-factored-linear-root','m∈{−5,…,5} ve aₖ=1/(k²−mk), k=1,2,… için kaç m bütün terimleri tanımlı yapar?',6,{'m':[-5,5]},'m<=0',
         ['Payda k(k−m)’dir; k pozitif olduğundan ilk çarpan sıfır olmaz.','m pozitifse k=m yasaktır; m≤0 olan −5,…,0 ise uygundur: 6 değer.']),
        ('sequence-first-four-square-window','m∈{1,…,20} ve aₖ=1/(k²−m) veriliyor. Yalnız ilk dört terimin tanımlı olması istenirse kaç m mümkündür?',16,{'m':[1,20]},'1**2!=m and 2**2!=m and 3**2!=m and 4**2!=m',
         ['İlk dört terim için 1,4,9,16 değerleri yasaklanır.','Daha sonraki indisler bu soruda dikkate alınmaz; 20−4=16.']),
        ('sequence-two-pole-families','m∈{1,…,25}. aₖ=1/[(k−m/2)(k−m/3)], k=1,2,… dizisinin tüm terimlerini tanımlı yapan kaç m vardır?',9,{'m':[1,25]},'m%2!=0 and m%3!=0',
         ['Pozitif tam sayı indiste sıfır payda olması m’nin 2’ye veya 3’e bölünmesine eşdeğerdir.','Yasak değerlerin sayısı 12+8−4=16’dır; 25−16=9 uygun değer kalır.']),
        ('sequence-factorial-poles','m∈{1,…,30} ve aₖ=1/(k!−m), k=1,2,… olsun. Tüm terimleri tanımlı yapan kaç m vardır?',26,{'m':[1,30]},'factorial(1)!=m and factorial(2)!=m and factorial(3)!=m and factorial(4)!=m',
         ['30’u aşmayan pozitif indisli faktöriyeller 1,2,6,24’tür. 5!=120 ve sonraki faktöriyeller aralık dışındadır.','Dört yasak parametre çıkarılır: 30−4=26.']),
    ]
    for slug,prompt,answer,variables,predicate,steps in rows:
        b.finite(key,slug,prompt,answer,variables,predicate,{'kind':'count'},steps,difficulty='hard' if any(t in slug for t in ('factors','factorial','residue')) else 'medium',**kw)


def telescopic_cancellation(b):
    key='telescopic_cancellation';kw={'course':'sequences','topic':'Diziler','subtopic':'Teleskopik toplam, çarpım ve sınır terimleri'}
    rows=[
        ('telescope-interior-range','aₖ=(2k+1)/[k²(k+1)²] için a₁+a₂+…+a₅ kaçtır?',s.Rational(35,36),'(2*x+1)/(x**2*(x+1)**2)',1,5,
         ['Pay (k+1)²−k²’ye eşit olduğundan aₖ=1/k²−1/(k+1)².','Ara terimler silinir; 1−1/36=35/36.']),
        ('telescope-two-step-gap','∑ₖ₌₁⁵ 1/[k(k+2)] kaçtır?',s.Rational(25,42),'1/(x*(x+2))',1,5,
         ['1/[k(k+2)]=(1/2)(1/k−1/(k+2)).','Toplam (1/2)(1+1/2−1/6−1/7)=25/42.']),
        ('telescope-arithmetic-grid','∑ₖ₌₁⁴ 3/[(3k−2)(3k+1)] kaçtır?',s.Rational(12,13),'3/((3*x-2)*(3*x+1))',1,4,
         ['Terim 1/(3k−2)−1/(3k+1) olarak ayrılır.','1−1/13=12/13 kalır.']),
        ('telescope-odd-denominators','∑ₖ₌₁⁵ [1/(2k−1)−1/(2k+1)] kaçtır?',s.Rational(10,11),'1/(2*x-1)-1/(2*x+1)',1,5,
         ['Komşu tek paydalı terimler birbirini götürür.','İlk 1 ve son −1/11 kalır; 10/11.']),
        ('telescope-ratio-differences','∑ₖ₌₁⁶ [k/(k+1)−(k−1)/k] kaçtır?',s.Rational(6,7),'x/(x+1)-(x-1)/x',1,6,
         ['İkinci kesir bir önceki indisin ilk kesridir.','Toplam 6/7−0/1=6/7.']),
        ('telescope-second-difference','∑ₖ₌₁⁴ [1/k−2/(k+1)+1/(k+2)] kaçtır?',s.Rational(7,15),'1/x-2/(x+1)+1/(x+2)',1,4,
         ['İç terimler ikişer iptal olur; sınırda 1−1/2−1/5+1/6 kalır.','Ortak payda 30 ile 30/30−15/30−6/30+5/30=7/15.']),
        ('telescope-root-conjugates','∑ₖ₌₁⁸ 1/(√k+√(k+1)) kaçtır?',2,'1/(sqrt(x)+sqrt(x+1))',1,8,
         ['Eşlenikle 1/(√k+√(k+1))=√(k+1)−√k.','Toplam √9−√1=2.']),
        ('telescope-triple-factors','∑ₖ₌₁⁵ 1/[k(k+1)(k+2)] kaçtır?',s.Rational(5,21),'1/(x*(x+1)*(x+2))',1,5,
         ['Terim (1/2)[1/(k(k+1))−1/((k+1)(k+2))] olur.','Toplam (1/2)(1/2−1/42)=5/21.']),
    ]
    for slug,prompt,answer,expr,start,end,steps in rows:
        actual=sum((s.sympify(expr,locals={'x':x}).subs(x,i) for i in range(start,end+1)),s.Integer(0))
        assert s.simplify(actual-answer)==0,(slug,actual,answer)
        b.emit(key,slug,prompt,answer,steps,{'kind':'exact_math','operation':'sequence_sum','expression':expr,'start':start,'end':end},difficulty='hard' if any(t in slug for t in ('triple','second','root')) else 'medium',**kw)
    b.calc(key,'telescope-product-cancellation','∏ₖ₌₁⁵ k/(k+1) çarpımı kaçtır?',s.Rational(1,6),
           'Product(x/(x+1),(x,1,5))',['Çarpım (1/2)(2/3)(3/4)(4/5)(5/6) biçimindedir.','Ortak çarpanlar sadeleşir ve 1/6 kalır.'],**kw)
    b.emit(key,'telescope-number-of-terms','n pozitif tam sayıdır. ∑ₖ₌₁ⁿ 1/[k(k+1)]=7/8 ise n kaçtır?',7,
           ['Teleskopik toplam 1−1/(n+1)’dir.','1−1/(n+1)=7/8 ⇒ n+1=8 ⇒ n=7.'],
           {'type':'finite_search','variables':{'n':[1,50]},'predicate':'1-1/(n+1)==Rational(7,8)','objective':{'kind':'unique','expression':'n'},
            'supportingChecks':[{'operation':'sequence_sum','expression':'1/(x*(x+1))','start':1,'end':7,'expectedValue':'7/8'}]},**kw)


def logarithm_domains(b):
    key='logarithm_domains';kw={'course':'logarithms','topic':'Logaritma','subtopic':'Taban ve argüman koşullarıyla tanımlılık'}
    rows=[
        ('log-domain-opposed-linear','0≤x≤10 aralığındaki tam sayılardan kaçı log₍ₓ₋₁₎(8−x) ifadesini tanımlı yapar?',5,{'x':[0,10]},'x-1>0 and x-1!=1 and 8-x>0',
         ['Taban x−1>0 ve x≠2; argüman 8−x>0 olmalı.','1<x<8 ve x≠2 koşulunda 3,4,5,6,7 uygundur; 5 sayı.']),
        ('log-domain-decreasing-base','−5≤x≤5 aralığındaki tam sayılardan kaçı log₍₂₋ₓ₎(x+3) ifadesini tanımlı yapar?',3,{'x':[-5,5]},'2-x>0 and 2-x!=1 and x+3>0',
         ['Taban koşulları x<2 ve x≠1; argüman x>−3 verir.','−2,−1,0 uygun olan 3 tam sayıdır.']),
        ('log-domain-quadratic-base','−5≤x≤6 aralığındaki tam sayılardan kaçı log₍ₓ²₋₄₎(x−1) ifadesini tanımlı yapar?',4,{'x':[-5,6]},'x**2-4>0 and x**2-4!=1 and x-1>0',
         ['x−1>0 ve x²−4>0 birlikte x>2 gerektirir.','x²−4=1 eşitliğinin tam sayı çözümü yoktur; 3,4,5,6 olmak üzere 4 değer.']),
        ('log-domain-product-argument','−2≤x≤6 aralığındaki tam sayılardan kaçı log₍ₓ₊₁₎[(x−2)(x−4)] ifadesini tanımlı yapar?',3,{'x':[-2,6]},'x+1>0 and x+1!=1 and (x-2)*(x-4)>0',
         ['Taban x>−1 ve x≠0 verir. Argüman x<2 veya x>4 iken pozitiftir.','Birleşik koşulda 1,5,6 uygundur; 3 değer.']),
        ('log-domain-reciprocal-base','−3≤x≤8 aralığındaki tam sayılardan kaçı log₍₁/(ₓ₋₂)₎(x+1) ifadesini tanımlı yapar?',5,{'x':[-3,8]},'x!=2 and 1/(x-2)>0 and 1/(x-2)!=1 and x+1>0',
         ['Tabanın pozitif olması x>2’yi; 1 olmaması x≠3’ü gerektirir.','Argüman bu koşullarda pozitiftir; 4,5,6,7,8 olmak üzere 5 değer.']),
        ('log-domain-nested-argument','0≤x≤7 aralığındaki tam sayılardan kaçı log₍ₓ₋₂₎[log₂(x−1)] ifadesini tanımlı yapar?',4,{'x':[0,7]},'x-2>0 and x-2!=1 and x-1>1',
         ['İç logaritmanın dış logaritmaya argüman olabilmesi için log₂(x−1)>0, yani x>2 gerekir.','Dış taban da x>2 ve x≠3 ister; 4,5,6,7 uygundur.']),
        ('log-domain-common-two-logs','1≤x≤7 aralığındaki tam sayılardan kaçı log₂(x−1)+log₃(7−x) ifadesini tanımlı yapar?',5,{'x':[1,7]},'x-1>0 and 7-x>0',
         ['Her iki argüman da pozitif olmalıdır: 1<x<7.','2,3,4,5,6 olmak üzere 5 tam sayı vardır.']),
        ('log-domain-square-argument','−6≤x≤6 aralığındaki tam sayılardan kaçı log₍ₓ₋₁₎(x²−9) ifadesini tanımlı yapar?',3,{'x':[-6,6]},'x-1>0 and x-1!=1 and x**2-9>0',
         ['x>1, x≠2 ve |x|>3 birlikte x>3 verir.','4,5,6 olmak üzere 3 tam sayı uygundur.']),
        ('log-domain-small-base-power','a∈{1,2,…,8}. logₐ16 ifadesi tanımlı ve 1’den büyük olacaksa kaç a mümkündür?',7,{'a':[1,8]},'a>0 and a!=1 and a<16',
         ['a=1 taban olamaz; geriye a=2,…,8 kalır.','Bu tabanlar 1’den büyük ve 16’dan küçük olduğundan logₐ16>1’dir; 7 değer.']),
        ('log-domain-additional-pole','1≤x≤8 aralığındaki tam sayılardan kaçı logₓ(x−2)+1/(x−4) ifadesini tanımlı yapar?',5,{'x':[1,8]},'x>0 and x!=1 and x-2>0 and x!=4',
         ['Logaritma koşulları x>2 verir; rasyonel terim ayrıca x≠4 ister.','3,5,6,7,8 olmak üzere 5 değer uygundur.']),
    ]
    for slug,prompt,answer,variables,predicate,steps in rows:
        b.finite(key,slug,prompt,answer,variables,predicate,{'kind':'count'},steps,difficulty='hard' if any(t in slug for t in ('nested','product','reciprocal')) else 'medium',**kw)


def logarithm_power_equations(b):
    key='logarithm_power_equations';kw={'course':'logarithms','topic':'Logaritma','subtopic':'Üstel ifadeleri logaritma ile denklemleştirme'}
    rows=[
        ('log-equation-cubic-base','log₂(8ˣ⁻¹)=6 ise x kaçtır?',3,'log(8**(x-1),2)-6',
         ['8=2³ olduğundan sol taraf 3(x−1)’dir.','3x−3=6 ⇒ x=3.']),
        ('log-equation-power-quotient','log₃(9ˣ/27)=x+1 ise x kaçtır?',4,'log(9**x/27,3)-(x+1)',
         ['9ˣ/27=3^(2x−3), dolayısıyla logaritma 2x−3’tür.','2x−3=x+1 ⇒ x=4.']),
        ('log-equation-logarithmic-exponent','x>0 ve log₂(4^(log₂x))=6 ise x kaçtır?',8,'log(4**log(x,2),2)-6',
         ['4=2² olduğundan dış logaritma 2log₂x’e eşittir.','2log₂x=6 ⇒ log₂x=3 ⇒ x=8; x>0 sağlanır.']),
        ('log-equation-two-distinct-bases','log₄(2ˣ⁺¹)+log₂(8ˣ)=9 ise x kaçtır?',s.Rational(17,7),'log(2**(x+1),4)+log(8**x,2)-9',
         ['İlk logaritma (x+1)/2, ikincisi 3x’tir.','(x+1)/2+3x=9 ⇒ 7x+1=18 ⇒ x=17/7.']),
        ('log-equation-decreasing-base','log₍₁/₂₎(4ˣ)=6 ise x kaçtır?',-3,'log(4**x,Rational(1,2))-6',
         ['4ˣ=(1/2)^(−2x) olduğundan logaritma −2x’tir.','−2x=6 ⇒ x=−3.']),
        ('log-equation-quadratic-exponent','x>0 ve log₂(2^(x²−1))=8 ise x kaçtır?',3,'log(2**(x**2-1),2)-8',
         ['Logaritma x²−1’e eşittir; x²=9 elde edilir.','x>0 koşulu yalnız x=3’ü bırakır.']),
        ('log-equation-powers-on-both-sides','log₅(25ˣ)=log₅(125ˣ⁻¹)+1 ise x kaçtır?',2,'log(25**x,5)-log(125**(x-1),5)-1',
         ['Sol taraf 2x, sağ taraf 3(x−1)+1=3x−2.','2x=3x−2 ⇒ x=2.']),
        ('log-equation-subtracted-base-conversion','log₃(3²ˣ⁺¹)−log₉(3ˣ⁻²)=7 ise x kaçtır?',s.Rational(10,3),'log(3**(2*x+1),3)-log(3**(x-2),9)-7',
         ['Logaritmalar 2x+1 ve (x−2)/2’dir.','2x+1−(x−2)/2=7 ⇒ 3x/2+2=7 ⇒ x=10/3.']),
        ('log-equation-exponential-sum','log₂(2ˣ⁺¹+2ˣ)=log₂24 ise x kaçtır?',3,'log(2**(x+1)+2**x,2)-log(24,2)',
         ['Aynı tabanlı logaritma bire birdir; 2ˣ⁺¹+2ˣ=24.','3·2ˣ=24 ⇒ 2ˣ=8 ⇒ x=3.']),
        ('log-equation-inverse-composition','x>1 ve 2^(log₂(x−1))=7 ise x kaçtır?',8,'2**log(x-1,2)-7',
         ['x>1 koşulunda x−1 pozitiftir; 2^(log₂(x−1))=x−1.','x−1=7 ⇒ x=8; tanım koşulu sağlanır.']),
    ]
    for slug,prompt,answer,expr,steps in rows:
        conditions=([{'left':'x','op':'gt','right':'0'}] if any(t in slug for t in ('quadratic','logarithmic-exponent')) else
                    [{'left':'x','op':'gt','right':'1'}] if 'inverse-composition' in slug else [])
        b.raw_solve(key,slug,prompt,answer,expr,steps,variable='x',conditions=conditions,
                    difficulty='hard' if any(t in slug for t in ('two-distinct','sum','quadratic','conversion')) else 'medium',**kw)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source-evidence',type=Path,default=ROOT/'work/ayt-additions-evidence.json')
    parser.add_argument('--output',type=Path,default=ROOT/'work/ayt-source-additions.json')
    args=parser.parse_args()
    payload=json.loads(args.source_evidence.read_text())
    evidence=payload if isinstance(payload,list) else payload['evidence']
    author=Author(evidence)
    for family in (continuous_radicals,exponential_limits,derivative_definition,second_derivative_parameter,
                   initial_antiderivative,termwise_integration,sequence_domains,telescopic_cancellation,
                   logarithm_domains,logarithm_power_equations):
        before=len(author.questions);family(author)
        assert len(author.questions)-before==10,(family.__name__,len(author.questions)-before)
    assert len(author.questions)==100 and len({q['id'] for q in author.questions})==100
    assert len({q['prompt'] for q in author.questions})==100
    report={'schemaVersion':1,'generator':VERSION,'questions':author.questions,
            'summary':{'total':len(author.questions),'byExam':dict(Counter(q['examType'] for q in author.questions)),
                       'parents':len(PARENTS),'byParent':dict(Counter(q['parentQuestionId'] for q in author.questions)),
                       'byTopic':dict(Counter(q['topic'] for q in author.questions))},
            'ledger':[{'sourceQuestionId':parent,'skill':skill,'count':10,
                       'generatedIds':[q['id'] for q in author.questions if q['parentQuestionId']==parent]}
                      for skill,parent in PARENTS.items()],
            'independentVerificationRequired':True}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report['summary'],ensure_ascii=False))


if __name__=='__main__':
    main()
