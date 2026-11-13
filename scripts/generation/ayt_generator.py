"""Resumable AYT authoring from accessible AI parents, never unseen originals.

Only controlled symbolic expressions authored in this module are parsed. Uploaded
question prose is never evaluated. Construction formulas and the verification
operation are deliberately separate; a second QA program can replay every spec.
"""
from __future__ import annotations
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
import sympy as s

VERSION = 'ayt-structural-v1'
x,y,z,a,n,k,t,u = s.symbols('x y z a n k t u', real=True)
LOCALS={str(v):v for v in (x,y,z,a,n,k,t,u)}
LOCALS.update({'I':s.I,'pi':s.pi,'sqrt':s.sqrt,'sin':s.sin,'cos':s.cos,'tan':s.tan,'log':s.log,'Abs':s.Abs,'binomial':s.binomial,'factorial':s.factorial,'floor':s.floor})

def exact(v): return s.sympify(v,locals=LOCALS)
def st(v): return s.sstr(s.simplify(v))
def show(v): return s.sstr(v).replace('**','^')
def pack(v):
    if isinstance(v,s.Basic):return s.sstr(v)
    if isinstance(v,dict):return {k:pack(w) for k,w in v.items()}
    if isinstance(v,(list,tuple)):return [pack(w) for w in v]
    return v

def satisfies(value,variable,conditions):
    for c in conditions:
        l=exact(c['left']).subs(variable,value);r=exact(c['right']).subs(variable,value)
        if not {'eq':lambda:l==r,'ne':lambda:l!=r,'gt':lambda:l>r,'ge':lambda:l>=r,'lt':lambda:l<r,'le':lambda:l<=r}[c['op']]():return False
    return True

def recompute(spec):
    op=spec['operation'];e=exact(spec.get('expression','0'));v=LOCALS.get(spec.get('variable','x'),x)
    if op=='evaluate':return s.simplify(e.subs({LOCALS[key]:exact(value) for key,value in spec.get('substitutions',{}).items()}).doit())
    if op=='coefficient':
        p=s.Poly(s.expand(e),*[LOCALS[q] for q in spec['variables']]);return p.coeff_monomial(s.prod(LOCALS[q]**b for q,b in spec['powers'].items()))
    if op=='term_count':return len(s.Poly(s.expand(e),*[LOCALS[q] for q in spec['variables']]).terms())
    if op=='polynomial_abs_coeff_sum':return sum(abs(c) for c in s.Poly(s.expand(e),v).all_coeffs())
    if op=='derivative':return s.simplify(s.diff(e,v,spec.get('order',1)).subs(v,exact(spec['point'])))
    if op=='integral':return s.simplify(s.integrate(e,(v,exact(spec['lower']),exact(spec['upper'])))+exact(spec.get('offset',0)))
    if op=='quadratic_vertex':
        aa,bb,cc=s.Poly(e,v).all_coeffs();point=-bb/(2*aa)
        return point if spec['coordinate']=='x' else s.simplify(e.subs(v,point))
    if op=='limit':return s.limit(e,v,exact(spec['point']),dir=spec.get('direction','+'))
    if op=='sequence_sum':return s.summation(e,(v,spec['start'],spec['end']))
    if op=='integer_count':
        values=[s.Integer(i) for i in range(spec['lower'],spec['upper']+1) if satisfies(s.Integer(i),v,spec['conditions'])]
        return {'count':lambda:s.Integer(len(values)),'sum':lambda:sum(values,s.Integer(0)),'minimum':lambda:min(values),'maximum':lambda:max(values),'sum_squares':lambda:sum(q*q for q in values)}[spec.get('statistic','count')]()
    if op=='solve_parameter':
        roots=s.solve(e,v);roots=[r for r in roots if r.is_real is not False and satisfies(r,v,spec.get('conditions',[]))]
        if spec.get('statistic','unique')=='count':return s.Integer(len(roots))
        if spec.get('statistic')=='sum':return sum(roots,s.Integer(0))
        if len(roots)!=1:raise AssertionError(('not unique',spec,roots))
        return roots[0]
    if op=='root_stat':
        roots=s.polys.polytools.all_roots(s.Poly(e,v));q=spec['statistic']
        if q=='sum':return s.simplify(sum(roots))
        if q=='product':return s.simplify(s.prod(roots))
        if q=='power_sum':return s.simplify(sum(r**spec['power'] for r in roots))
        if q=='reciprocal_sum':return s.simplify(sum(1/r for r in roots))
        if q=='shifted_product':return s.simplify(s.prod(r+exact(spec['shift']) for r in roots))
        if q=='difference_squared':return s.simplify((roots[0]-roots[1])**2)
        if q=='ratio_sum':return s.simplify(roots[0]/roots[1]+roots[1]/roots[0])
        if q=='shifted_power_sum':return s.simplify(sum((exact(spec.get('scale',1))*r+exact(spec['shift']))**spec['power'] for r in roots))
        raise AssertionError(q)
    if op=='complex_component':
        q=s.expand_complex(e)
        return {'real':s.re(q),'imag':s.im(q),'abs_squared':s.simplify(q*s.conjugate(q))}[spec['component']]
    raise AssertionError(op)

def detailed_steps(spec):
    """Expose actual intermediate values; do not present generic advice as a solution."""
    op=spec['operation'];e=exact(spec.get('expression','0'));v=LOCALS.get(spec.get('variable','x'),x)
    if op=='derivative':
        d=s.diff(e,v,spec.get('order',1))
        return [f"{spec.get('order',1)}. türev: {show(d)}.",f"{v}={show(exact(spec['point']))} yerine yazılır."]
    if op=='integral':
        F=s.integrate(e,v);lo=exact(spec['lower']);hi=exact(spec['upper'])
        if F.has(s.Piecewise):return [f"İşaret değişim noktaları ayrılarak sınır farkı {st(s.integrate(e,(v,lo,hi)))} bulunur.",f"Başlangıç katkısı {spec.get('offset',0)} eklenir."]
        return [f"Bir ilkel fonksiyon F({v})={show(F)} olur.",f"F({show(hi)})−F({show(lo)})={st(F.subs(v,hi))}−({st(F.subs(v,lo))}).",f"Başlangıç katkısı {spec.get('offset',0)} eklenir."]
    if op=='quadratic_vertex':
        aa,bb,cc=s.Poly(e,v).all_coeffs();h=-bb/(2*aa)
        return [f"a={aa}, b={bb} için h=−b/(2a)={st(h)}.",f"Tepe ordinatı f(h)={st(e.subs(v,h))} olur."]
    if op=='root_stat':
        roots=s.polys.polytools.all_roots(s.Poly(e,v))
        return ['Kökler '+', '.join(st(r) for r in roots)+' olarak bulunur.','İstenen simetrik ifadeye bu değerler yerleştirilir.']
    if op=='solve_parameter':
        roots=s.solve(e,v);accepted=[r for r in roots if r.is_real is not False and satisfies(r,v,spec.get('conditions',[]))]
        return [f"Verilen koşul {show(e)}=0 denklemine indirgenir.",'Tanım ve işaret koşullarından sonra kabul edilen değerler: '+', '.join(st(r) for r in accepted)+'.']
    if op=='integer_count':
        values=[i for i in range(spec['lower'],spec['upper']+1) if satisfies(s.Integer(i),v,spec['conditions'])]
        return ['Bütün koşulları sağlayan tam sayılar: '+', '.join(map(str,values))+'.']
    if op=='sequence_sum':
        values=[s.simplify(e.subs(v,i)) for i in range(spec['start'],spec['end']+1)]
        return ['Toplanacak terimler: '+', '.join(st(r) for r in values)+'.']
    if op=='complex_component':
        result=s.expand_complex(e)
        return [f"İfade a+bi biçiminde {st(result)} olur.",f"a={st(s.re(result))}, b={st(s.im(result))} olarak okunur."]
    if op=='limit':
        return [f"İfade sadeleştirilince {show(s.cancel(e))} elde edilir; sınır noktası ve yönü uygulanır."]
    if op=='coefficient':
        term=s.prod(LOCALS[q]**r for q,r in spec['powers'].items())
        return [f"Aranan monom {show(term)}; açılımda bu monomun katsayısı ayrılır."]
    if op=='term_count':
        return [f"Benzer terimler birleştirilince {len(s.Poly(s.expand(e),*[LOCALS[q] for q in spec['variables']]).terms())} farklı monom kalır."]
    if op=='polynomial_abs_coeff_sum':
        return ['Son polinomun katsayıları: '+', '.join(st(c) for c in s.Poly(s.expand(e),v).all_coeffs())+'.']
    return []

def option_set(value,identifier):
    value=s.simplify(value);alts=[]
    # Numerical distractors remain exact and are checked by equivalence, not text.
    for delta in [-2,-1,1,2,3,4,5,6]:
        candidate=s.simplify(value+delta)
        if s.simplify(candidate-value)!=0 and all(s.simplify(candidate-q)!=0 for q in alts):alts.append(candidate)
        if len(alts)==4:break
    position=int(hashlib.sha256(identifier.encode()).hexdigest()[:8],16)%5
    alts.insert(position,value)
    assert all(s.simplify(alts[i]-alts[j])!=0 for i in range(5) for j in range(i))
    return [{'id':chr(65+i),'text':st(q)} for i,q in enumerate(alts)],chr(65+position)

class Batch:
    def __init__(self,records):
        self.records=records;self.groups=defaultdict(list);self.questions=[]
        for q in records:self.groups[q['provenance']['parentQuestionId']].append(q)
    def emit(self,parent,slug,prompt,value,spec,steps,difficulty='medium',reason=None):
        p=self.groups[parent][0];identifier=f'AI-NEW-AYT-{p["id"].replace("AI-","").replace("V3-","")}-{slug.upper()}'
        spec=pack({'kind':'exact_math',**spec})
        calculated=s.simplify(recompute(spec));value=s.simplify(value)
        assert s.simplify(value-calculated)==0,(identifier,value,calculated,spec)
        anchors=spec.pop('promptAnchors',None)
        if anchors is None:
            anchors=[show(exact(spec['expression']))] if spec.get('expression') not in (None,'0') else []
        spec['promptAnchors']=list(dict.fromkeys(anchors));assert all(q in prompt for q in spec['promptAnchors'])
        options,letter=option_set(value,identifier)
        for support in spec.get('supportingChecks',[]):
            assert s.simplify(recompute(support)-exact(support['expectedValue']))==0
        steps=[*steps,*detailed_steps(spec),f'Sonuç {st(value)} olur.']
        self.questions.append({'id':identifier,'examType':'AYT','courseId':p['courseId'],'topic':p['topic'],'subtopic':slug,
          'difficulty':difficulty,'difficultyReason':reason or {'easy':'Tek temel bağıntının doğru uygulanması gerekir.','medium':'İki bağıntıyı birlikte kullanma veya koşulu ters yönde çözme gerekir.','hard':'Tanım koşullarını, dönüşümü ve çok aşamalı hesabı birlikte değerlendirmek gerekir.'}[difficulty],
          'prompt':prompt,'options':options,'answer':{'value':letter,'computedValue':st(value),'solution':'\n'.join(steps)},'solutionSteps':steps,
          'origin':'AI_URETIMI','pool':'generated','parentQuestionId':p['id'],'familyId':parent,'templateId':slug,'parameters':{key:v for key,v in spec.items() if key not in ['promptAnchors','kind']},
          'verificationSpec':spec,'verification':{'status':'automated_verified','mathPassed':True,'validator':VERSION,'methods':['Yazarlıkta kapalı matematiksel bağıntı','Bağımsız tam sembolik işlem: '+spec['operation']],
           'checks':{'independentResultMatches':True,'fiveOptions':True,'uniqueEquivalentOptions':True,'singleCorrectOption':True,'promptAnchorsPresent':True},'scope':'exact_result_options_and_explicit_constraints','editorialStatus':'pending'},'publicationStatus':'ready_for_review'})
    def dump(self,path):
        ledger=[]
        for parent,records in self.groups.items():
            generated=[q['id'] for q in self.questions if q['familyId']==parent]
            for q in records:ledger.append({'sourceQuestionId':q['id'],'archiveParentReference':parent,'canonicalAccessibleParentId':records[0]['id'],'status':'covered_by_canonical_skill_batch' if generated else 'review_pending_exam_boundary','reason':'Accessible AI prompt inspected; numeric near-duplicates share one canonical authoring batch. Original referenced PDF was not accessed.' if generated else 'Triangle angle sum belongs to TYT; not republished as AYT.','generatedQuestionIds':generated})
        summary={'version':VERSION,'inputAccessibleAI':len(self.records),'canonicalParentClusters':len(self.groups),'coveredParentClusters':sum(bool([q for q in self.questions if q['familyId']==p]) for p in self.groups),'generated':len(self.questions),'mathematicallyChecked':len(self.questions),'examBoundaryPending':10,'originalPDFsAccessed':0,'byCourse':dict(Counter(q['courseId'] for q in self.questions)),'byDifficulty':dict(Counter(q['difficulty'] for q in self.questions))}
        Path(path).write_text(json.dumps({'questions':self.questions,'ledger':ledger,'summary':summary},ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(summary,ensure_ascii=False))

def binomial_batches(b):
    def add(parent,slug,expr,value,operation='coefficient',powers=None,variables=None,text='',steps=None,diff='medium'):
        spec={'operation':operation,'expression':expr}
        if operation in ('coefficient','term_count'):spec.update(variables=variables or ['x','y'])
        if operation=='coefficient':spec['powers']=powers
        if operation=='polynomial_abs_coeff_sum':spec['variable']='x'
        b.emit(parent,slug,f'{show(expr)} açılımında {text}',value,spec,steps or ['Binomda genel terim C(n,j)·A^(n−j)·B^j biçimindedir.','İstenen üs veya toplama koşulu bu genel terime uygulanır.'],diff)
    p='AYT01-S394-Q01'
    cases=[((2*x**2+3*y**3)**6,7,['x','y'],'farklı sıfırdan farklı terim sayısı kaçtır?'),
      ((x**3+2*x)**7,8,['x'],'farklı terim sayısı kaçtır?'),((x+y+1)**5,21,['x','y'],'farklı terim sayısı kaçtır?'),
      ((x+y+z)**4,15,['x','y','z'],'farklı terim sayısı kaçtır?'),((x**2+x*y+y**2)**5,11,['x','y'],'farklı terim sayısı kaçtır?'),
      ((x+y)**6*(x-y)**6,7,['x','y'],'benzer terimler toplandıktan sonra kaç terim kalır?'),
      ((x+y)**3*(x+2*y)**4,8,['x','y'],'benzer terimler toplandıktan sonra kaç terim kalır?'),
      ((1+x)**8+(1-x)**8,5,['x'],'benzer terimler toplandığında kaç terim kalır?'),
      ((1+x)**9-(1-x)**9,5,['x'],'benzer terimler toplandığında kaç terim kalır?'),
      (x**3*(1+x**2)**6,7,['x'],'farklı terim sayısı kaçtır?'),((1+x)**4*(1+x**5),10,['x'],'farklı terim sayısı kaçtır?'),
      ((x**2+y**2)**3*(x+y),8,['x','y'],'farklı terim sayısı kaçtır?'),((1+x+x**2)**4,9,['x'],'farklı terim sayısı kaçtır?')]
    for j,(e,v,vs,text) in enumerate(cases):add(p,f'binom-term-support-{j+1:02}',e,v,'term_count',variables=vs,text=text,steps=['Açılımda oluşabilecek üsler belirlenir; eşit üslü terimler birleştirilir.','İşaret nedeniyle yok olan terimler ve aynı monomlar sayılmaz.'],diff='easy' if j<2 else 'medium')
    p='AYT02-S394-Q02'
    # Distinct substitutions, parity filters and variable-weighted sums.
    for j in range(13):
        nn=5+j%4;aa=2+j%3;bb=1+j%2;e=(aa*x+(-1 if j%2 else 1)*bb*y)**nn
        if j==0:target=e;sub={'x':1,'y':1};v=(aa+bb)**nn;txt='tüm katsayıların toplamı kaçtır?'
        elif j==1:target=e;sub={'x':1,'y':-1};v=(aa+bb)**nn;txt='x değişkeni 1 ve y değişkeni −1 iken açılımın değeri kaçtır?'
        elif j==2:target=(e+e.subs(x,-x))/2;sub={'x':1,'y':1};v=((aa+bb)**nn+(-aa+bb)**nn)/s.Integer(2);txt='x üssü çift olan terimlerin katsayıları toplamı kaçtır?'
        elif j==3:target=(e-e.subs(x,-x))/2;sub={'x':1,'y':1};v=((aa-bb)**nn-(-aa-bb)**nn)/s.Integer(2);txt='x üssü tek olan terimlerin katsayıları toplamı kaçtır?'
        elif j==4:e=(aa*x+bb*y)**nn;target=x*s.diff(e,x);sub={'x':1,'y':1};v=nn*aa*(aa+bb)**(nn-1);txt='her katsayı bağlı olduğu x üssüyle çarpılıp toplandığında kaç bulunur?'
        elif j==5:e=(aa*x+bb*y)**nn;target=x**2*s.diff(e,x,2);sub={'x':1,'y':1};v=nn*(nn-1)*aa**2*(aa+bb)**(nn-2);txt='x^r·y^s katsayısı r(r−1) ile çarpılıp tüm terimler üzerinde toplandığında kaç bulunur?'
        elif j==6:e=(aa*x+bb*y)**nn;target=x*y*s.diff(e,x,y);sub={'x':1,'y':1};v=nn*(nn-1)*aa*bb*(aa+bb)**(nn-2);txt='x^r·y^s katsayısı r·s ile çarpılıp toplandığında kaç bulunur?'
        elif j==7:e=(x**2+aa*y+bb)**nn;target=e;sub={'x':-1,'y':1};v=(1+aa+bb)**nn;txt='x=−1 ve y=1 için değeri kaçtır?'
        elif j==8:e=(aa*x+bb*y)**nn;target=e;sub={'x':2,'y':1};v=(2*aa+bb)**nn;txt='x^r·y^s katsayısı 2^r ile çarpılıp toplandığında kaç bulunur?'
        elif j==9:e=(aa*x-bb*y)**nn;target=e;sub={'x':0,'y':1};v=(-bb)**nn;txt='x içermeyen terimlerin katsayıları toplamı kaçtır?'
        elif j==10:e=(aa*x+bb*y+z)**nn;target=e;sub={'x':1,'y':1,'z':-1};v=(aa+bb-1)**nn;txt='x=y=1 ve z=−1 için değeri kaçtır?'
        elif j==11:e=(aa*x+bb*y)**nn;target=x*s.diff(e,x)+y*s.diff(e,y);sub={'x':1,'y':1};v=nn*(aa+bb)**nn;txt='her katsayı toplam dereceyle çarpılıp toplandığında kaç bulunur?'
        else:e=(x+1)**6*(x-1)**3;target=e;sub={'x':-1};v=0;txt='katsayılar işaret değiştirerek, sabit terim pozitif kabul edilip toplandığında kaç bulunur?'
        if j==0:
            steps=['Bütün değişkenler 1 yapılınca her monom 1 olur; geriye katsayıların toplamı kalır.',
              f'P(1,1)=({aa}+{bb})^{nn}={aa+bb}^{nn}={st(v)}.']
        elif j==1:
            steps=['İstenen değer için x=1 ve y=−1 doğrudan P içinde yerine yazılır.',
              f'P(1,−1)=({aa}·1−{bb}·(−1))^{nn}=({aa}+{bb})^{nn}={st(v)}.']
        elif j==2:
            steps=['y=1 yapılır. x yerine −x yazılması çift kuvvetlerin işaretini korur, tek kuvvetlerin işaretini değiştirir.',
              'Bu yüzden x üssü çift olan katsayıların toplamı [P(1,1)+P(−1,1)]/2 olur.',
              f'[({aa}+{bb})^{nn}+(−{aa}+{bb})^{nn}]/2=[{st(e.subs({x:1,y:1}))}+({st(e.subs({x:-1,y:1}))})]/2={st(v)}.']
        elif j==3:
            steps=['y=1 yapılır. P(1,1)−P(−1,1) farkında çift x kuvvetleri yok olur, tek kuvvetler iki katına çıkar.',
              'İstenen toplam [P(1,1)−P(−1,1)]/2 olur.',
              f'[({aa}−{bb})^{nn}−(−{aa}−{bb})^{nn}]/2=[{st(e.subs({x:1,y:1}))}−({st(e.subs({x:-1,y:1}))})]/2={st(v)}.']
        elif j==4:
            steps=['c·x^r·y^s terimine x·∂/∂x uygulanınca r·c·x^r·y^s elde edilir.',
              f'Bu nedenle aranan ağırlıklı toplam (x·Pₓ)(1,1) olur; Pₓ={nn}·{aa}·({aa}x+{bb}y)^{nn-1}.',
              f'(x·Pₓ)(1,1)={nn}·{aa}·({aa}+{bb})^{nn-1}={st(v)}.']
        elif j==5:
            steps=['c·x^r·y^s teriminin x değişkenine göre ikinci türevi r(r−1)·c·x^(r−2)·y^s olur.',
              'x² ile çarpıp x=y=1 yazılınca istenen r(r−1) ağırlıklı katsayı toplamı elde edilir: (x²·Pₓₓ)(1,1).',
              f'Pₓₓ={nn}·{nn-1}·{aa}²·({aa}x+{bb}y)^{nn-2}; dolayısıyla toplam {nn}·{nn-1}·{aa}²·{aa+bb}^{nn-2}={st(v)}.']
        elif j==6:
            steps=['c·x^r·y^s terimine önce x, sonra y türevi uygulanınca r·s·c·x^(r−1)·y^(s−1) elde edilir.',
              'x·y ile çarpıp x=y=1 yazmak bütün r·s ağırlıklı katsayıları toplar: (x·y·Pₓᵧ)(1,1).',
              f'Pₓᵧ={nn}·{nn-1}·{aa}·{bb}·({aa}x+{bb}y)^{nn-2}; toplam {nn}·{nn-1}·{aa}·{bb}·{aa+bb}^{nn-2}={st(v)}.']
        elif j==7:
            steps=['Önce x=−1 için x²=(−1)²=1 bulunur; sonra y=1 yerine yazılır.',
              f'P(−1,1)=(1+{aa}·1+{bb})^{nn}={1+aa+bb}^{nn}={st(v)}.']
        elif j==8:
            steps=['Bir c·x^r·y^s teriminde x=2 ve y=1 yazılınca c·2^r elde edilir.',
              'Dolayısıyla istenen ağırlıklı katsayı toplamı P(2,1) değeridir.',
              f'P(2,1)=({aa}·2+{bb})^{nn}={2*aa+bb}^{nn}={st(v)}.']
        elif j==9:
            steps=['x=0 yazılınca x içeren bütün terimler sıfırlanır; yalnızca x içermeyenler kalır.',
              'Kalan y kuvvetlerinin katsayılarını toplamak için y=1 yazılır.',
              f'P(0,1)=({aa}·0−{bb}·1)^{nn}=(−{bb})^{nn}={st(v)}.']
        elif j==10:
            steps=['Üç değişkenin verilen değerleri aynı anda yerine konur: x=1, y=1, z=−1.',
              f'P(1,1,−1)=({aa}·1+{bb}·1−1)^{nn}=({aa}+{bb}−1)^{nn}={st(v)}.']
        elif j==11:
            steps=[f'P, toplam derecesi {nn} olan homojen bir polinomdur; her monomda r+s={nn} olur.',
              f'Her katsayı aynı {nn} sayısıyla çarpıldığından istenen toplam {nn}·P(1,1) olur; eşdeğer olarak (x·Pₓ+y·Pᵧ)(1,1) kullanılabilir.',
              f'{nn}·P(1,1)={nn}·({aa}+{bb})^{nn}={nn}·{aa+bb}^{nn}={st(v)}.']
        else:
            steps=['P(x)=c₀+c₁x+c₂x²+… yazılırsa P(−1)=c₀−c₁+c₂−… olur.',
              'Bu polinomun sabit terimi c₀=−1 olduğundan, sabit terimi pozitif başlatan işaret seçimi −P(−1) ile elde edilir.',
              'P(−1)=(−1+1)^6·(−1−1)^3=0·(−8)=0; dolayısıyla −P(−1)=0.']
        b.emit(p,f'coefficient-sum-transform-{j+1:02}',f'P={show(e)} açılımında {txt}',v,{'operation':'evaluate','expression':target,'substitutions':sub,'promptAnchors':[show(e)]},steps, 'easy' if j<2 else 'hard' if j in [5,6,11] else 'medium')
    p='AYT03-S394-Q03'
    for j in range(13):
        nn=5+j%4;r=1+j%4;aa=2+j%2;bb=(-1 if j%3==0 else 1)*(1+j%3)
        if j<4:e=(aa*x+bb*y)**nn;powers={'x':nn-r,'y':r};v=s.binomial(nn,r)*aa**(nn-r)*bb**r
        elif j<7:e=(aa*x**2+bb*y**3)**nn;powers={'x':2*(nn-r),'y':3*r};v=s.binomial(nn,r)*aa**(nn-r)*bb**r
        elif j==7:e=(x+y+z)**6;powers={'x':2,'y':1,'z':3};v=s.factorial(6)/(s.factorial(2)*s.factorial(1)*s.factorial(3))
        elif j==8:e=(2*x+y+1)**5;powers={'x':2,'y':2};v=s.factorial(5)/4*4
        elif j==9:e=(x+y)**4*(x-y)**3;powers={'x':5,'y':2};v=sum(s.binomial(4,r)*s.binomial(3,2-r)*(-1)**(2-r) for r in range(3))
        elif j==10:e=(1+x+x**2)**4;powers={'x':3};v=16
        elif j==11:e=(x**2+2*x+1)**5;powers={'x':7};v=s.binomial(10,7)
        else:e=(2*x**3-y**2)**6;powers={'x':7,'y':6};v=0
        variables=['x','y','z'] if e.has(z) else ['x','y'] if e.has(y) else ['x'];term='·'.join(f'{q}^{v}' for q,v in powers.items())
        add(p,f'binom-exponent-target-{j+1:02}',e,v,powers=powers,variables=variables,text=f'{term} monomunun katsayısı kaçtır?',diff='easy' if j==0 else 'medium' if j<7 else 'hard')
    p='AYT04-S394-Q05'
    # Constant terms are extracted after cancellation of negative exponents by a prefactor.
    cases=[((x+y-3)**5,{'x':0,'y':0},-243),((2*x+3*y+1)**6,{'x':0,'y':0},1),
      ((x-2)**4*(y+3)**3,{'x':0,'y':0},432),((x+y)**4+(x-y+2)**4,{'x':0,'y':0},16),
      ((x**2+2*x-1)**5,{'x':0},-1),((x-1)**4*(x+1)**4,{'x':0},1),
      (x**2*(x+1)**5,{'x':0},0),((2*x-y+3)**4,{'x':0,'y':0},81),
      ((x*y+2*x+3*y-2)**3,{'x':0,'y':0},-8),((x+1)**6-(x-1)**6,{'x':0},0),
      ((x**2-y**3+2)**7,{'x':0,'y':0},128),((x+y-1)**2*(x-y+2)**3,{'x':0,'y':0},8),
      ((2*x+1)**3*(3*y-2)**4,{'x':0,'y':0},16)]
    for j,(e,powers,v) in enumerate(cases):add(p,f'constant-structure-{j+1:02}',e,v,powers=powers,variables=list(powers),text='sabit terim kaçtır?',steps=['Sabit terim için bütün değişkenler 0 yapılır.','Çarpım varsa her çarpanın sabit terimi çarpılır; toplam/fark varsa sonuçlar birleştirilir.'],diff='easy' if j<3 else 'medium')
    p='AYT05-S394-Q06'
    for j in range(13):
        nn=4+2*(j%4);r=nn//2;aa=1+j%3;bb=(-1 if j%2 else 1)*(1+(j//3)%2)
        if j<4:e=(aa*x+bb*y)**nn;power={'x':r,'y':r};v=s.binomial(nn,r)*aa**r*bb**r;txt='x üsleri azalan sıradayken ortanca terimin katsayısı kaçtır?'
        elif j<7:e=(aa*x**2+bb*y**3)**nn;power={'x':2*r,'y':3*r};v=s.binomial(nn,r)*aa**r*bb**r;txt='ilk terimdeki x üssü azalan sırayla yazılan açılımın ortanca teriminin katsayısı kaçtır?'
        elif j==7:e=(x+y)**7;power={'x':4,'y':3};v=35;txt='x üssüne göre azalan sıradaki iki ortanca terimden ilkinin katsayısı kaçtır?'
        elif j==8:e=(2*x-y)**7;power={'x':3,'y':4};v=280;txt='x üssüne göre azalan sıradaki iki ortanca terimden ikincisinin katsayısı kaçtır?'
        elif j==9:e=(x+2*y)**8;power={'x':4,'y':4};v=1120;txt='ortanca terimde x=y=1 yazıldığında elde edilen sayı kaçtır?'
        elif j==10:e=(x**3+y)**6;power={'x':9,'y':3};v=20;txt='x üssü 9 olan ortanca terimin katsayısı kaçtır?'
        elif j==11:e=(3*x-y**2)**4;power={'x':2,'y':4};v=54;txt='ortanca terimin katsayısı kaçtır?'
        else:e=(x**2-2*y**3)**10;power={'x':10,'y':15};v=-8064;txt='ortanca terimin katsayısı kaçtır?'
        add(p,f'central-term-role-{j+1:02}',e,v,powers=power,text=txt,steps=['n çiftse ortanca terim j=n/2 seçimine karşılık gelir; n tekse iki ortanca terim vardır.','Genel terimde uygun j yerine konur; üsler ve katsayı ayrı hesaplanır.'])
    p='AYT06-S395-Q09'
    for j in range(13):
        if j==0:expr=s.binomial(10,4);text='İlk satırı yalnız 1 olan Pascal üçgeninin 11. satırında soldan 5. sayı kaçtır?';v=210
        elif j==1:expr=sum(s.binomial(8,q) for q in range(9));text='Pascal üçgeninin (ilk satır 1) 9. satırındaki sayıların toplamı kaçtır?';v=256
        elif j==2:expr=s.binomial(9,3)+s.binomial(9,4);text='Pascal üçgenindeki C(9,3)+C(9,4) toplamı kaçtır?';v=210
        elif j==3:expr=sum(s.binomial(10,q) for q in range(0,11,2));text='C(10,0)+C(10,2)+...+C(10,10) kaçtır?';v=512
        elif j==4:expr=sum((-1)**q*s.binomial(7,q) for q in range(8));text='C(7,0)−C(7,1)+...−C(7,7) kaçtır?';v=0
        elif j==5:expr=sum(s.binomial(6,q)**2 for q in range(7));text='C(6,0)^2+C(6,1)^2+...+C(6,6)^2 kaçtır?';v=924
        elif j==6:expr=sum(q*s.binomial(7,q) for q in range(8));text='C(7,k) sayıları k=0,...,7 için k ile çarpılıp toplandığında kaç bulunur?';v=448
        elif j==7:expr=sum(s.binomial(q,3) for q in range(3,9));text='C(3,3)+C(4,3)+...+C(8,3) kaçtır?';v=126
        elif j==8:expr=s.binomial(12,4)/s.binomial(12,3);text='Pascal üçgeninde aynı satırdaki C(12,4)/C(12,3) oranı kaçtır?';v=s.Rational(9,4)
        elif j==9:expr=s.binomial(9,3)-s.binomial(8,2);text='C(9,3)−C(8,2) kaçtır?';v=56
        elif j==10:expr=sum(s.binomial(5,q)*2**q for q in range(6));text='C(5,0)+2·C(5,1)+...+2^5·C(5,5) kaçtır?';v=243
        elif j==11:expr=sum(q*(q-1)*s.binomial(6,q) for q in range(7));text='k=0,...,6 için k(k−1)·C(6,k) toplamı kaçtır?';v=480
        else:expr=sum(s.binomial(4,q)*s.binomial(5,5-q) for q in range(5));text='C(4,0)C(5,5)+C(4,1)C(5,4)+...+C(4,4)C(5,1) kaçtır?';v=126
        # Preserve an unevaluated identity anchor, rather than a precomputed scalar.
        spec={'operation':'evaluate','expression':['binomial(10,4)', 'binomial(8,0)+binomial(8,1)+binomial(8,2)+binomial(8,3)+binomial(8,4)+binomial(8,5)+binomial(8,6)+binomial(8,7)+binomial(8,8)', 'binomial(9,3)+binomial(9,4)', 'binomial(10,0)+binomial(10,2)+binomial(10,4)+binomial(10,6)+binomial(10,8)+binomial(10,10)', 'binomial(7,0)-binomial(7,1)+binomial(7,2)-binomial(7,3)+binomial(7,4)-binomial(7,5)+binomial(7,6)-binomial(7,7)', 'binomial(6,0)**2+binomial(6,1)**2+binomial(6,2)**2+binomial(6,3)**2+binomial(6,4)**2+binomial(6,5)**2+binomial(6,6)**2', '0*binomial(7,0)+1*binomial(7,1)+2*binomial(7,2)+3*binomial(7,3)+4*binomial(7,4)+5*binomial(7,5)+6*binomial(7,6)+7*binomial(7,7)', 'binomial(3,3)+binomial(4,3)+binomial(5,3)+binomial(6,3)+binomial(7,3)+binomial(8,3)', 'binomial(12,4)/binomial(12,3)', 'binomial(9,3)-binomial(8,2)', 'binomial(5,0)*2**0+binomial(5,1)*2**1+binomial(5,2)*2**2+binomial(5,3)*2**3+binomial(5,4)*2**4+binomial(5,5)*2**5', '0*(0-1)*binomial(6,0)+1*(1-1)*binomial(6,1)+2*(2-1)*binomial(6,2)+3*(3-1)*binomial(6,3)+4*(4-1)*binomial(6,4)+5*(5-1)*binomial(6,5)+6*(6-1)*binomial(6,6)', 'binomial(4,0)*binomial(5,5)+binomial(4,1)*binomial(5,4)+binomial(4,2)*binomial(5,3)+binomial(4,3)*binomial(5,2)+binomial(4,4)*binomial(5,1)'][j],'promptAnchors':[text]}
        b.emit(p,f'pascal-identity-{j+1:02}',text,v,spec,['Pascal bağıntısı C(n,r)+C(n,r+1)=C(n+1,r+1) ve binom açılımı kullanılır.','Toplam türüne göre satır toplamı, simetri veya çarpım katsayısı bağıntısı uygulanır.'],'easy' if j<3 else 'hard' if j in [5,11,12] else 'medium')
    p='AYT07-S395-Q13'
    cases=[((x-2)**5,243),((2*x-3)**4,625),((x+2)**3*(x-1)**3,None),((x**2-3*x+2)**4,None),((x-1)**6+(x+1)**6,64),((x-1)**5-(x+1)**5,32),((2*x**2-3)**5,3125),((x**3-2*x)**4,81),((3*x-1)**6,4096),((x**2-1)**8,256),((2*x+1)**3*(x-2)**2,None),((x**2-x+1)**5,None),((x-3)**4-(x+3)**4,None)]
    for j,(e,v) in enumerate(cases):
        # Construction by manual convolution of integer coefficient arrays is separate from Poly verification.
        def conv(a,b):
            out=[0]*(len(a)+len(b)-1)
            for i,q in enumerate(a):
                for k,r in enumerate(b):out[i+k]+=q*r
            return out
        if j==2:cs=[1];
        if v is None:
            factors={2:[([2,1],3),([-1,1],3)],3:[([2,-3,1],4)],10:[([1,2],3),([-2,1],2)],11:[([1,-1,1],5)]}
            if j in factors:
                cs=[1]
                for f,power in factors[j]:
                    for _ in range(power):cs=conv(cs,f)
                v=sum(abs(q) for q in cs)
            else:v=2*(4*27+4*3)
        add(p,f'absolute-coefficient-structure-{j+1:02}',e,v,'polynomial_abs_coeff_sum',text='tüm katsayıların mutlak değerleri toplamı kaçtır?',steps=['Önce çarpımlar açılıp aynı kuvvetli terimler birleştirilir.','Son polinomun her katsayısının mutlak değeri alınarak toplanır; birleşmeden önce mutlak değer alınmaz.'],diff='hard' if j in [2,3,10,11,12] else 'medium')
    # Three coefficient-focused parents get different query structures and exponents.
    for group,parent in enumerate(['AYT08-S396-Q04','F-P217-Q01','F-P217-Q02','F-P217-Q03']):
        for j in range(13):
            nn=5+(j+group)%5;aa=1+group;bb=(-1 if (j+group)%2 else 1)*(1+j%3)
            if group==0:
                e=(x-bb)**nn;r=1+j%3;q=r+1+(j%2);num=s.binomial(nn,r)*(-bb)**(nn-r);den=s.binomial(nn,q)*(-bb)**(nn-q)
                # Numeric target ratio is represented as two coefficient extractions through derivatives at zero.
                target=s.Subs(s.Derivative(e,x,r),x,0)/s.factorial(r)/(s.Subs(s.Derivative(e,x,q),x,0)/s.factorial(q))
                b.emit(parent,f'coefficient-ratio-{j+1:02}',f'P(x)={show(e)} polinomunda x^{r} katsayısının x^{q} katsayısına oranı kaçtır?',num/den,{'operation':'evaluate','expression':target,'promptAnchors':[show(e)]},['x^r katsayısı C(n,r)·(−b)^(n−r) biçimindedir.','İki katsayı ayrı bulunup bölünür; işaret korunur.'],'medium' if j<8 else 'hard');continue
            if group==1:
                if j<5:e=(aa*x+bb)**nn;r=1+j%4;power=r;v=s.binomial(nn,r)*aa**r*bb**(nn-r)
                elif j<9:e=x**2*(aa*x+bb)**nn;r=2+j%4;power=r;v=s.binomial(nn,r-2)*aa**(r-2)*bb**(nn-r+2)
                else:e=(x+1)**nn*(x-1)**2;power=3+j%3;v=s.binomial(nn,power)-2*s.binomial(nn,power-1)+s.binomial(nn,power-2)
                add(parent,f'univariate-coefficient-{j+1:02}',e,v,powers={'x':power},variables=['x'],text=f'x^{power} teriminin katsayısı kaçtır?',diff='medium' if j<9 else 'hard')
            elif group==2:
                r=j%5;left=2+(j//5);right=1;e=(aa*x**left+bb*x**right)**nn;power=left*(nn-r)+right*r;v=s.binomial(nn,r)*aa**(nn-r)*bb**r
                add(parent,f'colliding-power-target-{j+1:02}',e,v,powers={'x':power},variables=['x'],text=f'x^{power} teriminin katsayısı kaçtır?',steps=['İkinci terim j kez seçilirse toplam üs p(n−j)+qj olur.','İstenen üsten j bulunur; sonra C(n,j)·a^(n−j)·b^j hesaplanır.'],diff='medium' if j<8 else 'hard')
            else:
                r=(2 if j%2==0 else 3);index=r+1;from_end=j%3==0;chosen=nn-r if from_end else r;e=(aa*x**(1+j%3)+bb*y**(1+(j+1)%3))**nn
                v=s.binomial(nn,chosen)*aa**(nn-chosen)*bb**chosen;power={'x':(1+j%3)*(nn-chosen),'y':(1+(j+1)%3)*chosen}
                add(parent,f'ordered-binomial-term-{j+1:02}',e,v,powers=power,text=f'x üssü azalan sıralamada {"sondan" if from_end else "baştan"} {index}. terimin katsayısı kaçtır?',steps=['İlk terim j=0 seçimine karşılık gelir.','Baştan r. terim için j=r−1; sondan r. terim için j=n−r+1 kullanılır.'])

def quadratic_batches(b):
    parents=['T-P352-Q01','F-P177-Q01','F-P177-Q02','F-P178-Q05']
    # Four related source skills are expanded by different inverse/forward roles.
    for g,p in enumerate(parents):
        r=2+g;q=-(4+g);aa=1+g;poly=aa*(x-r)*(x-q);S=r+q;P=r*q
        requests=[('sum',{},S,'kökleri α ve β ise α+β kaçtır?','Vieta bağıntısıyla α+β=−b/a.'),
          ('product',{},P,'kökleri α ve β ise α·β kaçtır?','Vieta bağıntısıyla αβ=c/a.'),
          ('power_sum',{'power':2},r*r+q*q,'α²+β² kaçtır?','α²+β²=(α+β)²−2αβ.'),
          ('power_sum',{'power':3},r**3+q**3,'α³+β³ kaçtır?','α³+β³=(α+β)³−3αβ(α+β).'),
          ('reciprocal_sum',{},s.Rational(S,P),'1/α+1/β kaçtır?','Kökler sıfır olmadığı için 1/α+1/β=(α+β)/(αβ).'),
          ('difference_squared',{},(r-q)**2,'(α−β)² kaçtır?','(α−β)²=(α+β)²−4αβ.'),
          ('ratio_sum',{},s.Rational(r,q)+s.Rational(q,r),'α/β+β/α kaçtır?','Ortak payda αβ alınır; pay α²+β² olur.'),
          ('shifted_product',{'shift':2+g},(r+2+g)*(q+2+g),f'(α+{2+g})(β+{2+g}) kaçtır?','(α+c)(β+c)=αβ+c(α+β)+c².'),
          ('shifted_power_sum',{'scale':2,'shift':1,'power':2},(2*r+1)**2+(2*q+1)**2,'(2α+1)²+(2β+1)² kaçtır?','Kareler açılır; kökler toplamı ve kareler toplamı kullanılır.'),
          ('power_sum',{'power':-2},s.Rational(1,r*r)+s.Rational(1,q*q),'1/α²+1/β² kaçtır?','Pay α²+β², payda (αβ)² olacak şekilde birleştirilir.'),
          ('power_sum',{'power':4},r**4+q**4,'α⁴+β⁴ kaçtır?','α⁴+β⁴=(α²+β²)²−2(αβ)².'),
          ('shifted_power_sum',{'scale':1,'shift':-1,'power':3},(r-1)**3+(q-1)**3,'(α−1)³+(β−1)³ kaçtır?','Küpler açılıp ilk üç kuvvet toplamı kullanılır.'),
          ('shifted_power_sum',{'scale':1,'shift':1,'power':-1},s.Rational(1,r+1)+s.Rational(1,q+1),'1/(α+1)+1/(β+1) kaçtır?','Pay α+β+2, payda αβ+α+β+1 olur; paydanın sıfır olmadığı kontrol edilir.')]
        for j,(stat,fields,val,txt,step) in enumerate(requests):
            e=s.expand(poly)
            # Each source cluster changes a substantive mathematical role, not merely coefficients.
            if g==1 and j in [0,1,2,3,4]:
                if j==0:e=x**2+a*x+P;eq=-a-S;value=-S;text=f'P(x)={show(e)} denkleminin kökleri toplamı {S} ise a kaçtır?'
                elif j==1:e=x**2-S*x+a;eq=a-P;value=P;text=f'{show(e)}=0 denkleminin kökleri çarpımı {P} ise a kaçtır?'
                elif j==2:e=x**2+a*x+P;eq=a*a-2*P-(r*r+q*q);value=-S;text=f'{show(e)}=0 denkleminin kökleri α,β ve α²+β²={r*r+q*q}; a>0 ise a kaçtır?'
                elif j==3:e=x**2-S*x+a;eq=S**3-3*a*S-(r**3+q**3);value=P;text=f'{show(e)}=0 denkleminin köklerinin küpleri toplamı {r**3+q**3} ise a kaçtır?'
                else:e=x*x-a*S*x+P;eq=s.Rational(S,P)*a-s.Rational(S,P);value=1;text=f'{show(e)}=0 denkleminin sıfır olmayan kökleri için 1/α+1/β={s.Rational(S,P)} olsun. a kaçtır?'
                conditions=[{'left':'a','op':'gt','right':'0'}] if j==2 else []
                b.emit(p,f'vieta-inverse-{j+1:02}',text,value,{'operation':'solve_parameter','expression':eq,'variable':'a','conditions':conditions,'promptAnchors':[show(e)]},['Kökler toplamı S=−b/a ve çarpımı P=c/a olarak yazılır.','Verilen simetrik bağıntı katsayılara çevrilerek parametre çözülür.'],'hard' if j==2 else 'medium');continue
            if g==2 and j in [0,1,2,3]:
                c=2+j
                newexpr=s.expand(aa*(x-c*r)*(x-c*q)) if j%2==0 else s.expand(aa*(x-r-c)*(x-q-c))
                if j==0:stat='product';val=c*c*P;txt=f'{show(e)}=0 kökleri α,β. Kökleri {c}α ve {c}β olan monik denklemin sabit terimi kaçtır?'
                elif j==1:stat='sum';val=S+2*c;txt=f'{show(e)}=0 kökleri α,β. Kökleri α+{c} ve β+{c} olan denklemin kökleri toplamı kaçtır?'
                elif j==2:stat='sum';val=c*S;txt=f'{show(e)}=0 kökleri α,β. Kökleri {c}α ve {c}β olan monik denklemin x katsayısının negatifi kaçtır?'
                else:stat='product';val=P+c*S+c*c;txt=f'{show(e)}=0 kökleri α,β. Kökleri α+{c} ve β+{c} olan monik denklemin sabit terimi kaçtır?'
                b.emit(p,f'vieta-root-transform-{j+1:02}',txt,val,{'operation':'root_stat','expression':newexpr,'variable':'x','statistic':stat,'promptAnchors':[show(e)]},['Kökler ölçeklenirse toplam ölçekle, çarpım ölçeğin karesiyle değişir.','Köklere c eklenirse yeni toplam S+2c ve yeni çarpım P+cS+c² olur.']);continue
            if g==3 and j in [0,1,2]:
                if j==0:stat='power_sum';fields={'power':2};val=r*r+q*q;txt='Birinci ve ikinci kökün kareleri toplamı kaçtır?'
                elif j==1:stat='power_sum';fields={'power':-2};val=s.Rational(1,r*r)+s.Rational(1,q*q);txt='Köklerin karelerinin çarpmaya göre terslerinin toplamı kaçtır?'
                else:stat='shifted_power_sum';fields={'shift':-2,'scale':3,'power':2};val=(3*r-2)**2+(3*q-2)**2;txt='(3α−2)²+(3β−2)² kaçtır?'
            b.emit(p,f'vieta-symmetric-{g}-{j+1:02}',f'{show(e)}=0 denkleminin kökleri α ve β olmak üzere {txt}',val,{'operation':'root_stat','expression':e,'variable':'x','statistic':stat,**fields},[step,'Kökler toplamı ve çarpımı denklem katsayılarından alınır.'],'easy' if j<2 else 'medium' if j<9 else 'hard')
    p='F-P181-Q02'
    cases=[(3*x*x-30*x+a,900-12*a,75,'sabit terimi a olan bu denklemin çift katlı gerçek kökü olması için a kaçtır?',[]),
      (x*x-2*a*x+49,4*a*a-196,7,'çift katlı gerçek köklü ve a>0 ise a kaçtır?',[{'left':'a','op':'gt','right':'0'}]),
      ((a+1)*x*x+12*x+9,144-36*(a+1),3,'ikinci dereceden denklem çift katlı köklü ise a kaçtır?',[{'left':'a+1','op':'ne','right':'0'}]),
      (x*x+a*x+16,a*a-64,-8,'çift katlı köklü ve a<0 ise a kaçtır?',[{'left':'a','op':'lt','right':'0'}]),
      (2*(x-3)**2+4*a-20,4*a-20,5,'x eksenine teğet olması için a kaçtır?',[]),
      (x*x-6*x+10-a,36-4*(10-a),1,'y=0 doğrusu ile tek ortak noktası olması için a kaçtır?',[]),
      (4*x*x+(2*a-4)*x+9,(2*a-4)**2-144,8,'çift katlı köklü ve a>2 ise a kaçtır?',[{'left':'a','op':'gt','right':'2'}]),
      (a*x*x+8*x+4,64-16*a,4,'çift katlı köklü ikinci dereceden denklem olması için a kaçtır?',[{'left':'a','op':'ne','right':'0'}]),
      (x*x-10*x+a*a,100-4*a*a,5,'çift katlı köklü ve a>0 ise a kaçtır?',[{'left':'a','op':'gt','right':'0'}]),
      (3*x*x-12*x+a+2,144-12*(a+2),10,'gerçek çözüm kümesi tek elemanlı ise a kaçtır?',[]),
      ((x-2)**2+a*x, (a-4)**2-16,8,'çift katlı köklü ve a≠0 ise a kaçtır?',[{'left':'a','op':'ne','right':'0'}]),
      (x*x+(a+3)*x+25,(a+3)**2-100,7,'çift katlı köklü ve kökü negatif ise a kaçtır?',[{'left':'a+3','op':'gt','right':'0'}]),
      (9*x*x-6*a*x+16,36*a*a-576,4,'çift katlı köklü ve a>0 ise a kaçtır?',[{'left':'a','op':'gt','right':'0'}])]
    for j,(poly,eq,val,text,conditions) in enumerate(cases):b.emit(p,f'double-root-constraint-{j+1:02}',f'{show(poly)}=0 denklemi {text}',val,{'operation':'solve_parameter','expression':eq,'variable':'a','conditions':conditions,'promptAnchors':[show(poly)]},['İkinci dereceden denklemde tek gerçek kök için Δ=b²−4ac=0 olmalıdır.','Parametre denklemi çözülür ve a için verilen işaret/derece koşulu uygulanır.'],'easy' if j==0 else 'medium' if j<6 else 'hard')

def parabola_batches(b):
    p='F-P189-Q04'
    cases=[(2*(x-3)**2+5,3,'tepe noktasının apsisi'),(-3*(x+2)**2+7,-2,'simetri ekseni x=h olduğuna göre h'),
      ((x-1)*(x-7),4,'x eksenini kestiği iki noktanın orta noktasının apsisi'),(3*x*x+18*x-1,-3,'en küçük değeri aldığı x'),
      (-2*x*x+20*x+3,5,'en büyük değeri aldığı x'),((x-2)**2+3,2,'f(h−1)=f(h+1) eşitliğini sağlayan tek h'),
      (4*x*x-8*x+6,1,'tam kareye tamamlama sonucunda y=4(x−h)²+k biçimindeki h'),
      ((x+5)**2-8,-5,'simetri ekseninin x eksenini kestiği noktanın apsisi'),(2*(x-4)**2-3,4,'birbirinden farklı aynı ordinatlı iki noktanın apsisleri toplamının yarısı'),
      (-x*x-12*x+4,-6,'yatay teğetin değdiği noktanın apsisi'),(3*(x+1)**2+2,-1,'değer kümesinin alt sınırına karşılık gelen x'),
      (5*x*x-35*x+1,s.Rational(7,2),'tepe noktasının apsisi'),(-4*x*x+12*x+9,s.Rational(3,2),'maksimum yüksekliğe ulaşılan x')]
    for j,(e,v,text) in enumerate(cases):b.emit(p,f'parabola-axis-role-{j+1:02}',f'y={show(e)} parabolünde {text} kaçtır?',v,{'operation':'quadratic_vertex','expression':e,'variable':'x','coordinate':'x'},['Simetri ekseni ve tepe apsisi h=−b/(2a) ile bulunur.','Aynı ordinatlı simetrik noktaların orta apsisi de h olur.'],'easy' if j<2 else 'medium')
    p='F-P193-Q02'
    cases=[(2*(x-3)**2-7,-7,'en küçük değer'),(-3*(x+2)**2+11,11,'en büyük değer'),(x*x-8*x+13,-3,'tepe noktasının ordinatı'),
      (-2*x*x+12*x-5,13,'değer kümesinin üst sınırı'),(3*x*x+6*x+10,7,'değer kümesinin alt sınırı'),
      ((x+1)**2+4,4,'x eksenine en yakın noktasının ordinatı'),(-(x-4)**2-3,-3,'x eksenine en yakın noktasının ordinatı'),
      (4*x*x-20*x+29,4,'tam kare biçimindeki y=4(x−h)²+k ifadesinde k'),(x*x+3*x+5,s.Rational(11,4),'tepe noktasının ordinatı'),
      (-3*x*x+9*x+2,s.Rational(35,4),'fonksiyonun alabileceği en büyük değer'),(2*(x-5)**2+6,6,'grafiğe alttan teğet yatay doğrunun y sabiti'),
      (-2*(x+3)**2+8,8,'grafiğe üstten teğet yatay doğrunun y sabiti'),(5*x*x-10*x+9,4,'gerçek x için y≥k sağlayan en büyük k')]
    for j,(e,v,text) in enumerate(cases):b.emit(p,f'parabola-extreme-role-{j+1:02}',f'y={show(e)} için {text} kaçtır?',v,{'operation':'quadratic_vertex','expression':e,'variable':'x','coordinate':'y'},['h=−b/(2a) hesaplanır.','Tepe ordinatı f(h) bulunur; a>0 ise minimum, a<0 ise maksimumdur.'],'easy' if j<2 else 'medium')
    p='F-P189-Q02'
    for j in range(13):
        aa=1+j%3;h=1+j%4;m=2+j%5
        if j==0:e=x*x+(a-2)*x-4;point=2;out=6;eq=e.subs(x,point)-out;val=5;text=f'y={show(e)} parabolü (2,6) noktasından geçiyor. a kaçtır?'
        elif j==1:e=a*x*x+3*x-2;point=-2;out=8;eq=e.subs(x,point)-out;val=4;text=f'y={show(e)} grafiği (−2,8) noktasından geçiyor. a kaçtır?'
        elif j==2:e=2*x*x-a*x+5;eq=e.subs(x,1)-e.subs(x,4);val=10;text=f'y={show(e)} parabolünde f(1)=f(4) ise a kaçtır?'
        elif j==3:e=x*x+(a-1)*x+3;eq=a-1+2*4;val=-7;text=f'y={show(e)} parabolünün simetri ekseni x=4 ise a kaçtır?'
        elif j==4:e=(x-3)**2+a;eq=e.subs(x,0)-14;val=5;text=f'y={show(e)} parabolünün y eksenini kestiği noktanın ordinatı 14 ise a kaçtır?'
        elif j==5:e=a*(x-2)**2+1;eq=e.subs(x,4)-13;val=3;text=f'y={show(e)} parabolü (4,13) noktasından geçiyor. a kaçtır?'
        elif j==6:e=x*x-6*x+a;eq=e.subs(x,3)+2;val=7;text=f'y={show(e)} parabolünün en küçük değeri −2 ise a kaçtır?'
        elif j==7:e=-2*(x+1)**2+a;eq=a-9;val=9;text=f'y={show(e)} parabolünün değer kümesi (−∞,9] ise a kaçtır?'
        elif j==8:e=x*x+a*x+4;eq=e.subs(x,2)-e.subs(x,-4);val=2;text=f'y={show(e)} grafiğinin x=2 ve x=−4 noktalarındaki ordinatları eşit. a kaçtır?'
        elif j==9:e=(a+1)*x*x-8*x+3;eq=-(-8)-2*(a+1)*2;val=1;text=f'y={show(e)} parabolünün tepe apsisi 2 ise a kaçtır?'
        elif j==10:e=x*x-4*x+a;eq=e.subs(x,5)-2*e.subs(x,0);val=5;text=f'y={show(e)} için f(5)=2f(0) ise a kaçtır?'
        elif j==11:e=a*(x-1)*(x+3);eq=e.subs(x,0)+12;val=4;text=f'y={show(e)} parabolünün y ekseni kesimi −12 ise a kaçtır?'
        else:e=2*x*x+a*x+1;eq=(e.subs(x,3)-e.subs(x,1))/2-13;val=5;text=f'y={show(e)} grafiğinde x=1 ile x=3 arasındaki kesen eğimi 13 ise a kaçtır?'
        b.emit(p,f'parabola-parameter-direction-{j+1:02}',text,val,{'operation':'solve_parameter','expression':eq,'variable':'a','promptAnchors':[show(e)]},['Noktadan geçme koşulunda koordinatlar fonksiyona yazılır; eşit ordinat koşulunda f(u)=f(v) kurulur.','Eksen veya tepe koşulu verilmişse h=−b/(2a), k=f(h) bağıntıları uygulanarak parametre çözülür.'],'easy' if j<2 else 'medium' if j<9 else 'hard')
    p='F-P189-Q03'
    for j in range(13):
        r=1+j%3;q=5+j%4;e=(1+j%2)*(x-r)*(x-q);S=r+q;P=r*q
        stat,fields,val,text=[('sum',{},S,'x ekseni kesimlerinin apsisleri toplamı'),('product',{},P,'x ekseni kesimlerinin apsisleri çarpımı'),
          ('difference_squared',{},(r-q)**2,'x eksenindeki kesim noktaları arasındaki uzaklığın karesi'),('power_sum',{'power':2},r*r+q*q,'x ekseni kesimlerinin apsislerinin kareleri toplamı'),
          ('reciprocal_sum',{},s.Rational(S,P),'kesim apsislerinin çarpmaya göre tersleri toplamı'),('shifted_product',{'shift':-1},(r-1)*(q-1),'kesim apsislerinden 1 çıkarıldığında oluşan sayıların çarpımı'),
          ('ratio_sum',{},s.Rational(r,q)+s.Rational(q,r),'kesim apsislerinin birbirine oranlarının toplamı'),('power_sum',{'power':3},r**3+q**3,'kesim apsislerinin küpleri toplamı'),
          ('shifted_power_sum',{'scale':2,'shift':0,'power':2},4*(r*r+q*q),'kesim apsislerinin iki katlarının kareleri toplamı'),('shifted_product',{'shift':2},(r+2)*(q+2),'iki kesim apsisine de 2 eklenerek elde edilen sayıların çarpımı'),
          ('power_sum',{'power':-2},s.Rational(1,r*r)+s.Rational(1,q*q),'kesim apsislerinin karelerinin tersleri toplamı'),('shifted_power_sum',{'scale':1,'shift':-2,'power':2},(r-2)**2+(q-2)**2,'iki kesim noktasının (2,0) noktasına uzaklıklarının kareleri toplamı'),
          ('power_sum',{'power':4},r**4+q**4,'kesim apsislerinin dördüncü kuvvetleri toplamı')][j]
        e=s.expand(e);b.emit(p,f'parabola-intercept-query-{j+1:02}',f'y={show(e)} parabolünün {text} kaçtır?',val,{'operation':'root_stat','expression':e,'variable':'x','statistic':stat,**fields},['x ekseni üzerindeki noktalarda y=0 olduğundan kesim apsisleri denklemin kökleridir.','Vieta toplam/çarpım bağıntıları uygun simetrik ifadeye uygulanır.'],'easy' if j<2 else 'medium' if j<9 else 'hard')
    p='F-P193-Q04'
    cases=[(x*x-6*x+2,3,'Simetri ekseni x=k ise k'),(-2*x*x-16*x+5,-4,'Simetri ekseninin apsisi'),((x-2)*(x-8),5,'İki x ekseni kesiminin orta apsisi'),
      (3*(x+2)**2-1,-2,'Ordinatları eşit, farklı iki noktanın apsisleri toplamının yarısı'),(2*x*x+10*x-3,s.Rational(-5,2),'Tam kare biçimindeki yatay öteleme sabiti h'),
      ((x+4)**2+7,-4,'Grafiğin y eksenine göre yansımasının simetri ekseninin apsisinin negatifi'),(-x*x+14*x+8,7,'Maksimum noktayı içeren düşey doğrunun apsisi'),
      (4*(x-1)**2-9,1,'f(k−3)=f(k+3) sağlayan tek k'),(3*x*x-21*x+1,s.Rational(7,2),'Aynı yükseklikteki noktaların apsis ortalaması'),
      ((x+3)**2-5,-3,'Grafik 2 birim sağa ötelenince yeni eksen x=k+2 ise eski k'),(2*x*x-2*x+6,s.Rational(1,2),'Tepe noktasının x koordinatı'),
      (-5*(x+1)**2+2,-1,'Grafiğin yatay teğetinin değme noktasının apsisi'),(6*x*x-18*x+4,s.Rational(3,2),'Simetri ekseni x=k için 2k ifadesinin yarısı')]
    for j,(e,v,text) in enumerate(cases):b.emit(p,f'parabola-symmetry-context-{j+1:02}',f'y={show(e)} parabolü veriliyor. {text} kaçtır?',v,{'operation':'quadratic_vertex','expression':e,'variable':'x','coordinate':'x'},['Simetri ekseni h=−b/(2a) düşey doğrusudur.','Eşit ordinatlı iki noktanın apsis ortalaması h olur; öteleme varsa eksen aynı yönde ötelenir.'],'easy' if j<2 else 'medium')

def polynomial_batches(b):
    p='F-P205-Q02'
    cases=[([a-2,10-a],'count',9,'a kaç farklı tam sayı değeri alabilir?'),([2*a-5,12-a],'minimum',3,'a değerinin alabileceği en küçük tam sayı kaçtır?'),
      ([a+2,7-a],'maximum',7,'a değerinin alabileceği en büyük tam sayı kaçtır?'),([a-1,5-a],'sum',15,'uygun bütün a tam sayılarının toplamı kaçtır?'),
      ([a-2,5-a],'sum_squares',54,'uygun bütün a tam sayılarının kareleri toplamı kaçtır?'),([3*a-8,17-2*a],'count',6,'a kaç farklı tam sayı değeri alabilir?'),
      ([a-4,15-a,2*a-10],'count',11,'üç üssün de polinom koşulunu sağlaması için kaç farklı a tam sayısı vardır?'),
      ([a-1,9-a],'count',7,'polinomun sabit terimi bulunmaması şartıyla a kaç tam sayı değeri alabilir?'),
      ([a-2,10-a],'count',5,'polinomun derecesi en çok 6 ise a kaç tam sayı değeri alabilir?'),
      ([2*a-3,13-2*a],'sum',20,'uygun a tam sayılarının toplamı kaçtır?'),([a-3,8-a],'maximum',8,'polinomun tanımlı olduğu en büyük a tam sayısı kaçtır?'),
      ([a+1,6-a,2*a],'minimum',0,'polinom olmasını sağlayan en küçük a tam sayısı kaçtır?'),([a-2,11-a],'count',2,'polinomun derecesi tam 7 ise kaç farklı a tam sayısı vardır?')]
    for j,(exps,stat,value,txt) in enumerate(cases):
        terms=[f'x^({show(e)})' for e in exps];anchor=' + '.join(terms)+' + x';conditions=[{'left':e,'op':'ge','right':0} for e in exps]
        if j==7:conditions=[{'left':e,'op':'gt','right':0} for e in exps]
        if j==8:conditions += [{'left':e,'op':'le','right':6} for e in exps]
        if j==12:
            # Two endpoint possibilities are enumerated by the equality of the maximum exponent.
            conditions += [{'left':s.Abs(exps[0]-7)*s.Abs(exps[1]-7),'op':'eq','right':0},{'left':exps[0],'op':'le','right':7},{'left':exps[1],'op':'le','right':7}]
        b.emit(p,f'polynomial-exponent-role-{j+1:02}',f'a bir tam sayı ve P(x)={anchor} olsun. P bir polinom olduğuna göre {txt}',value,{'operation':'integer_count','variable':'a','lower':-30,'upper':40,'conditions':conditions,'statistic':stat,'promptAnchors':[anchor]},['Bir polinomda bütün değişken üsleri negatif olmayan tam sayıdır.','a tam sayı olduğundan her üs için doğrusal eşitsizlik kurulur; ek derece veya sabit terim koşulu da uygulanır.','Uygun sonlu tam sayı kümesi üzerinde istenen sayma veya toplam işlemi yapılır.'],'easy' if j==0 else 'medium' if j<8 else 'hard')
    p='F-P205-Q04';P=2*x**3-3*x*x+4*x-5
    cases=[(P,2,7,'P(x) polinomunun x−2 ile bölümünden kalan'),(P,-1,-14,'P(x) polinomunun x+1 ile bölümünden kalan'),
      (P,s.Rational(1,2),s.Rational(-7,2),'P(x) polinomunun 2x−1 ile bölümünden kalan'),(P.subs(x,x*x),2,91,'P(x²) polinomunun x−2 ile bölümünden kalan'),
      (P.subs(x,x+1),2,34,'P(x+1) polinomunun x−2 ile bölümünden kalan'),(P.subs(x,2*x-1),2,34,'P(2x−1) polinomunun x−2 ile bölümünden kalan'),
      (P+P.subs(x,-x),2,-34,'P(x)+P(−x) polinomunun x−2 ile bölümünden kalan'),(P-P.subs(x,-x),1,12,'P(x)−P(−x) polinomunun x−1 ile bölümünden kalan'),
      (P*(x*x+1),2,35,'(x²+1)P(x) polinomunun x−2 ile bölümünden kalan'),(P*P,1,4,'[P(x)]² polinomunun x−1 ile bölümünden kalan'),
      (P.subs(x,P),0,-350,'P(P(x)) polinomunun x ile bölümünden kalan'),(P.subs(x,x+2)+P.subs(x,x-1),1,29,'P(x+2)+P(x−1) polinomunun x−1 ile bölümünden kalan'),
      (3*P-2*P.subs(x,x+1),0,-11,'3P(x)−2P(x+1) polinomunun x ile bölümünden kalan')]
    for j,(e,point,value,text) in enumerate(cases):b.emit(p,f'remainder-composition-{j+1:02}',f'P(x)={show(P)} veriliyor. {text} kaçtır?',value,{'operation':'evaluate','expression':e,'substitutions':{'x':point},'promptAnchors':[show(P)]},['Bölen αx−β ise kalan teoremi için x=β/α alınır.','Dönüşüm, çarpım veya bileşke varsa bu değer önce iç ifadeye yerleştirilir.'],'easy' if j<2 else 'medium' if j<9 else 'hard')
    p='F-P209-Q02'
    for j in range(13):
        if j==0:e=x**3+2*x*x-3*x+a;point=2;remainder=8;val=-2;txt='x−2 ile bölümünden kalan 8'
        elif j==1:e=a*x*x-2*x+1;point=-1;remainder=7;val=4;txt='x+1 ile bölümünden kalan 7'
        elif j==2:e=2*x**3+a*x*x+3;point=1;remainder=9;val=4;txt='x−1 ile bölümünden kalan 9'
        elif j==3:e=x**3+3*x+a;point=-2;remainder=0;val=14;txt='x+2 ile tam bölünüyor'
        elif j==4:e=(a-1)*x**3+2*x+5;point=1;remainder=10;val=4;txt='x−1 ile bölümünden kalan 10'
        elif j==5:e=x*x+a*x+3;point=s.Rational(1,2);remainder=s.Rational(19,4);val=3;txt='2x−1 ile bölümünden kalan 19/4'
        elif j==6:e=a*(x-1)+x*x;point=3;remainder=19;val=5;txt='x−3 ile bölümünden kalan 19'
        elif j==7:e=x**3+a*x*x-a;point=2;remainder=20;val=4;txt='x−2 ile bölümünden kalan 20'
        elif j==8:e=(x+a)*(x-2)+3;point=-1;remainder=-6;val=4;txt='x+1 ile bölümünden kalan −6'
        elif j==9:e=x**4+a*x*x+2;point=-2;remainder=30;val=3;txt='x+2 ile bölümünden kalan 30'
        elif j==10:e=x**3+(a+2)*x+1;point=2;remainder=23;val=5;txt='x−2 ile bölümünden kalan 23'
        elif j==11:e=a*x**3-2*a*x+4;point=-1;remainder=10;val=6;txt='x+1 ile bölümünden kalan 10'
        else:e=(x*x+1)*(a*x-2);point=1;remainder=8;val=6;txt='x−1 ile bölümünden kalan 8'
        equation=e.subs(x,point)-remainder
        b.emit(p,f'inverse-remainder-constraint-{j+1:02}',f'P(x)={show(e)} polinomu için {txt}. a kaçtır?',val,{'operation':'solve_parameter','expression':equation,'variable':'a','promptAnchors':[show(e)]},['Kalan teoremine göre P(r), x−r ile bölümden kalandır.','Verilen kalanla P(r) eşitlenir ve a çözülür.'],'easy' if j<3 else 'medium')

def trigonometry_batches(b):
    p='AYT16-S229-Q01'
    # Exact floor is retained as syntax; no reduced answer expression is stored.
    cases=[('1255 - 360*floor(1255/360)',175,'1255° açısının [0°,360°) aralığındaki esas ölçüsü kaç derecedir?'),
      ('-1110 - 360*floor(-1110/360)',330,'−1110° açısının [0°,360°) aralığındaki esas ölçüsü kaç derecedir?'),
      ('17*pi/3 - 2*pi*floor((17*pi/3)/(2*pi))',5*s.pi/3,'17π/3 radyan açının [0,2π) aralığındaki esas ölçüsü kaç radyandır?'),
      ('-23*pi/4 - 2*pi*floor((-23*pi/4)/(2*pi))',s.pi/4,'−23π/4 radyan açının [0,2π) aralığındaki esas ölçüsü kaç radyandır?'),
      ('sin(750*pi/180)',s.Rational(1,2),'sin(750°) kaçtır?'),('cos(-780*pi/180)',s.Rational(1,2),'cos(−780°) kaçtır?'),
      ('tan(945*pi/180)',1,'tan(945°) kaçtır?'),('sin(13*pi/6)',s.Rational(1,2),'sin(13π/6) kaçtır?'),
      ('cos(11*pi/3)',s.Rational(1,2),'cos(11π/3) kaçtır?'),('tan(-7*pi/4)',1,'tan(−7π/4) kaçtır?'),
      ('360*floor(2030/360)',1800,'2030° açıyı esas ölçüsüne indirgerken çıkarılan pozitif tam tur toplamı kaç derecedir?'),
      ('3*pi/4*180/pi',135,'3π/4 radyan kaç derecedir?'),('225*pi/180',5*s.pi/4,'225° kaç radyandır?')]
    LOCALS['floor']=s.floor
    for j,(expr,value,text) in enumerate(cases):b.emit(p,f'angle-period-role-{j+1:02}',text,value,{'operation':'evaluate','expression':expr,'promptAnchors':[text]},['Derece ölçüsünde tam tur 360°, radyanda 2π’dir.','Sinüs/kosinüs 2π, tanjant π periyotludur; esas açı ve bölge işareti uygulanır.'],'easy' if j<2 else 'medium')
    p='AYT17-S229-Q03'
    cases=[('(-3)/sqrt(3**2+4**2)',s.Rational(-3,5),'Birim çemberin III. bölgesindeki K(x,y) noktasında 4x=3y ise x kaçtır?'),
      ('4/sqrt(3**2+4**2)',s.Rational(4,5),'Birim çemberin II. bölgesinde x/y=−3/4 ise y kaçtır?'),
      ('-sqrt(1-(5/13)**2)',s.Rational(-12,13),'Birim çemberde IV. bölgedeki noktanın x koordinatı 5/13 ise y koordinatı kaçtır?'),
      ('sqrt(1-(-8/17)**2)',s.Rational(15,17),'Birim çemberde II. bölgede x=−8/17 ise y koordinatı kaçtır?'),
      ('(-4/5)/(3/5)',s.Rational(-4,3),'Birim çemberde K=(3/5,−4/5) ise K açısının tanjantı kaçtır?'),
      ('(3/5)**2-(-4/5)**2',s.Rational(-7,25),'Birim çemberde cosθ=3/5 ve sinθ=−4/5 ise cos(2θ) kaçtır?'),
      ('2*(-5/13)*(12/13)',s.Rational(-120,169),'Birim çemberde cosθ=−5/13 ve sinθ=12/13 ise sin(2θ) kaçtır?'),
      ('(-3/5)+(4/5)',s.Rational(1,5),'Birim çemberin II. bölgesinde cosθ=−3/5 ise sinθ+cosθ kaçtır?'),
      ('(-5/13)-(-12/13)',s.Rational(7,13),'Birim çemberin III. bölgesinde cosθ=−5/13 ise cosθ−sinθ kaçtır?'),
      ('1/(7/25)',s.Rational(25,7),'Birim çemberin I. bölgesinde sinθ=24/25 ise 1/cosθ kaçtır?'),
      ('((-8/17)/(15/17))**2',s.Rational(64,225),'Birim çemberin IV. bölgesinde cosθ=15/17 ise tan²θ kaçtır?'),
      ('2*(5/13)**2-1',s.Rational(-119,169),'Birim çemberde cosθ=5/13 olduğunda cos(2θ) kaçtır?'),
      ('(12/13)**2/(1+(5/13))',s.Rational(8,13),'Birim çemberde cosθ=5/13 ise sin²θ/(1+cosθ) kaçtır?')]
    for j,(expr,value,text) in enumerate(cases):b.emit(p,f'unit-circle-relation-{j+1:02}',text,value,{'operation':'evaluate','expression':expr,'promptAnchors':[text]},['Birim çemberde x²+y²=1, x=cosθ ve y=sinθ bağıntıları kullanılır.','Bölgeye göre koordinat işareti seçilir; istenen oran veya çift açı özdeşliği uygulanır.'],'easy' if j<3 else 'medium' if j<9 else 'hard')
    p='F-P245-Q04'
    cases=[('4*sin(15*pi/180)**2*cos(15*pi/180)**2',s.Rational(1,4),'4sin²15°·cos²15°'),
      ('(sin(75*pi/180)**2-cos(75*pi/180)**2)**2',s.Rational(3,4),'(sin²75°−cos²75°)²'),
      ('sin(20*pi/180)**2+cos(20*pi/180)**2',1,'sin²20°+cos²20°'),
      ('(sin(15*pi/180)+cos(15*pi/180))**2',s.Rational(3,2),'(sin15°+cos15°)²'),
      ('(sin(75*pi/180)-cos(75*pi/180))**2',s.Rational(1,2),'(sin75°−cos75°)²'),
      ('sin(105*pi/180)*cos(15*pi/180)-cos(105*pi/180)*sin(15*pi/180)',1,'sin105°·cos15°−cos105°·sin15°'),
      ('cos(75*pi/180)*cos(15*pi/180)+sin(75*pi/180)*sin(15*pi/180)',s.Rational(1,2),'cos75°·cos15°+sin75°·sin15°'),
      ('(tan(15*pi/180)+tan(30*pi/180))/(1-tan(15*pi/180)*tan(30*pi/180))',1,'(tan15°+tan30°)/(1−tan15°·tan30°)'),
      ('sin(30*pi/180)/(2*cos(15*pi/180))',s.sin(s.pi/12),'sin30°/(2cos15°)'),
      ('cos(15*pi/180)**4-sin(15*pi/180)**4',s.sqrt(3)/2,'cos⁴15°−sin⁴15°'),
      ('8*sin(15*pi/180)**2*cos(15*pi/180)**2-1',s.Rational(-1,2),'8sin²15°·cos²15°−1'),
      ('sin(75*pi/180)*sin(15*pi/180)',s.Rational(1,4),'sin75°·sin15°'),
      ('(1-cos(60*pi/180))/(1+cos(60*pi/180))',s.Rational(1,3),'(1−cos60°)/(1+cos60°)')]
    for j,(expr,value,display) in enumerate(cases):b.emit(p,f'trig-identity-transform-{j+1:02}',f'{display} ifadesinin tam değeri kaçtır?',value,{'operation':'evaluate','expression':expr,'promptAnchors':[display]},['Temel özdeşlikler ve sin(2θ)=2sinθcosθ bağıntısı incelenir.','Toplam-fark, çift açı veya karelerin farkı özdeşliğiyle özel açılara indirgenir.'],'easy' if j==2 else 'medium' if j<9 else 'hard')

def complex_batch(b):
    p='F-P185-Q03'
    cases=[('I**73','real',0,'i^73 sayısının gerçel kısmı'),('I**126','imag',0,'i^126 sayısının sanal kısmı'),
      ('I**39+I**40','real',1,'i^39+i^40 sayısının gerçel kısmı'),('I**101-I**99','imag',2,'i^101−i^99 sayısının sanal kısmı'),
      ('(2+3*I)*(1-2*I)','real',8,'(2+3i)(1−2i) sayısının gerçel kısmı'),('(3-2*I)/(1+I)','imag',s.Rational(-5,2),'(3−2i)/(1+i) sayısının sanal kısmı'),
      ('(1+I)**4','real',-4,'(1+i)^4 sayısının gerçel kısmı'),('(2-I)**2','imag',-4,'(2−i)^2 sayısının sanal kısmı'),
      ('(3+4*I)','abs_squared',25,'3+4i sayısının modülünün karesi'),('(1-I)**6','imag',8,'(1−i)^6 sayısının sanal kısmı'),
      ('(2+I)*(2-I)','real',5,'(2+i)(2−i) sayısının gerçel kısmı'),('(I**10+I**11+I**12+I**13)','abs_squared',0,'i^10+i^11+i^12+i^13 sayısının modülünün karesi'),
      ('(1+2*I)/(2-I)','real',0,'(1+2i)/(2−i) sayısının gerçel kısmı')]
    for j,(expr,component,value,display) in enumerate(cases):b.emit(p,f'complex-power-role-{j+1:02}',f'i²=−1 olmak üzere {display} kaçtır?',value,{'operation':'complex_component','expression':expr,'component':component,'promptAnchors':[display]},['i kuvvetleri 1,i,−1,−i döngüsünde tekrarlanır.','Çarpım veya bölüm varsa eşlenik ve i²=−1 kullanılarak a+bi biçimi elde edilir.','Gerçel kısım a, sanal kısım b ve modülün karesi a²+b²’dir.'],'easy' if j<2 else 'medium' if j<9 else 'hard')

def logarithm_batches(b):
    p='F-P249-Q01'
    # Domain predicates explicitly include base>0, base!=1, argument>0.
    cases=[('log_(x−3)(x−9)',x-3,x-9,0,20,'minimum',10),
      ('log_(x−2)(12−x)',x-2,12-x,0,15,'count',8),
      ('log_(x+1)(6−x)',x+1,6-x,-3,10,'sum',15),
      ('log_(10−x)(x−1)',10-x,x-1,0,12,'maximum',8),
      ('log_(x²−1)(8−x)',x*x-1,8-x,0,10,'count',6),
      ('log_(x−4)((x−6)(x−10))',x-4,(x-6)*(x-10),0,15,'count',5),
      ('log_2((x−1)/(x−5))',s.Integer(2),(x-1)/(x-5),0,10,'count',6),
      ('log_(2x−1)(x+2)',2*x-1,x+2,-5,8,'sum',35),
      ('log_(x+3)(x²−9)',x+3,x*x-9,-8,8,'minimum',4),
      ('log_(7−x)(x+1)',7-x,x+1,-4,10,'sum_squares',55),
      ('log_(x²+1)(5−x)',x*x+1,5-x,-3,6,'count',7),
      ('log_(3−x)(x²−4)',3-x,x*x-4,-5,5,'count',3),
      ('log_(x−1)(x−4)',x-1,x-4,0,12,'sum',68)]
    for j,(display,base,arg,lo,hi,stat,val) in enumerate(cases):
        conditions=[]
        if j==6:conditions.append({'left':x-5,'op':'ne','right':0})
        conditions += [{'left':base,'op':'gt','right':0},{'left':base,'op':'ne','right':1},{'left':arg,'op':'gt','right':0}]
        request={'count':'kaç farklı x değeri vardır','sum':'uygun x değerlerinin toplamı kaçtır','minimum':'en küçük uygun x kaçtır','maximum':'en büyük uygun x kaçtır','sum_squares':'uygun x değerlerinin kareleri toplamı kaçtır'}[stat]
        b.emit(p,f'log-domain-direction-{j+1:02}',f'x bir tam sayı ve {lo}≤x≤{hi}. f(x)={display} tanımlı olduğunda {request}?',val,{'operation':'integer_count','variable':'x','lower':lo,'upper':hi,'conditions':conditions,'statistic':stat,'promptAnchors':[display]},['Gerçek logaritmada taban pozitif ve 1’den farklı, iç ifade ise pozitiftir.','Payda varsa sıfır olamaz; koşullar verilen tam sayı aralığında birlikte uygulanır.','Kalan tam sayılar üzerinde istenen sayma, toplam veya uç değer alınır.'],'easy' if j==0 else 'medium' if j<5 else 'hard')
    p='F-P249-Q03'
    cases=[('log_3(x−2)=4',x-2-3**4,83,[x-2]),('log_2(3x+1)=4',3*x+1-16,5,[3*x+1]),
      ('log_(1/2)(x+3)=−3',x+3-8,5,[x+3]),('log_5(x²)=2 ve x<0',x*x-25,-5,[x*x]),
      ('log_2(x)+log_2(x−2)=3',x*(x-2)-8,4,[x,x-2]),
      ('log_3(x+6)−log_3(x)=1',(x+6)-3*x,3,[x,x+6]),
      ('log_2(log_3(x))=2',x-3**4,81,[x]),
      ('2log_3(x)=4',x-9,9,[x]),
      ('log_4(x−1)+log_4(x+1)=2',(x-1)*(x+1)-16,s.sqrt(17),[x-1,x+1]),
      ('log_2((x+1)/(x−1))=2',(x+1)-4*(x-1),s.Rational(5,3),[(x+1)/(x-1)]),
      ('log_3(x−1)=log_9(16)',x-1-4,5,[x-1]),
      ('log_2(x)+log_2(4)=5',4*x-32,8,[x]),
      ('log_5(2x−3)=log_5(x+7)',(2*x-3)-(x+7),10,[2*x-3,x+7])]
    for j,(display,eq,val,args) in enumerate(cases):
        conditions=[{'left':arg,'op':'gt','right':0} for arg in args]
        if j==3:conditions += [{'left':x,'op':'lt','right':0}]
        if j==9:conditions.insert(0,{'left':x-1,'op':'ne','right':0})
        b.emit(p,f'log-equation-transform-{j+1:02}',f'Gerçek sayılarda {display} koşulunu sağlayan x kaçtır?',val,{'operation':'solve_parameter','expression':eq,'variable':'x','conditions':conditions,'promptAnchors':[display]},['Logaritmanın içinin pozitif olması koşulu önce yazılır.','Taban değiştirme, toplam-fark veya üs kuralıyla eşitlik cebirsel denkleme çevrilir.','Cebirsel adaylardan logaritma tanım koşulunu sağlamayanlar elenir.'],'easy' if j<3 else 'medium' if j<8 else 'hard')
    p='F-P249-Q02'
    cases=[('2^(x+1)=32',x+1-5,4),('3^(2x−1)=27',2*x-1-3,2),('4^x=2^10',2*x-10,5),
      ('9^(x−1)=27',2*(x-1)-3,s.Rational(5,2)),('25^x=5^(3x−2)',2*x-(3*x-2),2),
      ('2^x+2^(x+1)=48',2**x+2**(x+1)-48,4),('3^(x+1)−3^x=54',3**(x+1)-3**x-54,3),
      ('4^x−5·2^x+4=0 ve x>0',4**x-5*2**x+4,2),('2^(2x)=8^(x−1)',2*x-3*(x-1),3),
      ('(1/3)^(x−2)=9',-(x-2)-2,0),('16^x=8^(x+1)',4*x-3*(x+1),3),
      ('2^(x−1)·4^(x+1)=128',(x-1)+2*(x+1)-7,2),('25^(x−1)=125^(2−x)',2*(x-1)-3*(2-x),s.Rational(8,5))]
    for j,(display,eq,val) in enumerate(cases):
        # Pure exponential equations are solved from their explicitly shown equal-base exponents.
        conditions=[{'left':x,'op':'gt','right':0}] if j==7 else []
        b.emit(p,f'exponential-reasoning-{j+1:02}',f'{display} olduğuna göre x kaçtır?',val,{'operation':'solve_parameter','expression':eq,'variable':'x','conditions':conditions,'promptAnchors':[display]},['Mümkün olduğunda bütün tabanlar aynı pozitif tabana çevrilir.','Ortak üslü terimler varsa ortak çarpan alınır veya u=b^x değişkeni kullanılır.','Üslerin eşitliği çözülür ve varsa x koşulu uygulanır.'],'easy' if j<4 else 'medium' if j<10 else 'hard')
    p='F-P257-Q02'
    cases=[('log_x(8x−7)=2',x*x-8*x+7,7,x,8*x-7,[]),
      ('log_(x−1)(7x−13)=2',(x-1)**2-(7*x-13),7,x-1,7*x-13,[]),
      ('log_(x+1)(5x+1)=2',(x+1)**2-(5*x+1),3,x+1,5*x+1,[]),
      ('log_x(3x+4)=2',x*x-3*x-4,4,x,3*x+4,[]),
      ('log_(x−2)(3x−2)=2',(x-2)**2-(3*x-2),6,x-2,3*x-2,[]),
      ('log_x(9)=2',x*x-9,3,x,s.Integer(9),[]),
      ('log_(2x−1)(9)=2',(2*x-1)**2-9,2,2*x-1,s.Integer(9),[]),
      ('log_x(1/8)=−3',x**3-8,2,x,s.Rational(1,8),[]),
      ('log_(x+2)(16)=2',(x+2)**2-16,2,x+2,s.Integer(16),[]),
      ('log_x(27)=3',x**3-27,3,x,s.Integer(27),[]),
      ('log_(x−1)(x+5)=2',(x-1)**2-(x+5),4,x-1,x+5,[]),
      ('log_(3−x)(4)=2',(3-x)**2-4,1,3-x,s.Integer(4),[]),
      ('log_(x+1)(2x+4)=2',(x+1)**2-(2*x+4),s.sqrt(3),x+1,2*x+4,[])]
    for j,(display,eq,val,base,arg,extra) in enumerate(cases):
        conditions=[{'left':base,'op':'gt','right':0},{'left':base,'op':'ne','right':1},{'left':arg,'op':'gt','right':0},*extra]
        b.emit(p,f'variable-log-base-{j+1:02}',f'Gerçek logaritma tanım koşullarıyla {display} denkleminin x çözümü kaçtır?',val,{'operation':'solve_parameter','expression':eq,'variable':'x','conditions':conditions,'promptAnchors':[display]},['Önce taban>0, taban≠1 ve iç ifade>0 koşulları yazılır.','log_b(A)=r eşitliği A=b^r biçimine çevrilir.','Cebirsel kökler arasında yalnız bütün tanım koşullarını sağlayan seçilir.'],'medium' if j<6 else 'hard')

def sequence_batches(b):
    p='F-P261-Q01'
    cases=[(n*n+2*n+3,1,5,0,100,'aₙ=n²+2n+3 dizisinin ilk 5 teriminin toplamı'),
      ((2*n)**2+3*(2*n)-1,1,4,0,176,'aₙ=n²+3n−1 dizisinde a₂+a₄+a₆+a₈'),
      ((2*n-1)**2+1,1,4,0,88,'aₙ=n²+1 dizisinde a₁+a₃+a₅+a₇'),
      (3*n*n-2*n+1,3,6,0,226,'aₙ=3n²−2n+1 dizisinde a₃+a₄+a₅+a₆'),
      ((-1)**n*n,1,8,0,4,'aₙ=(−1)ⁿ·n dizisinin ilk 8 teriminin toplamı'),
      (n*(n+1),1,6,0,112,'aₙ=n(n+1) dizisinin ilk 6 teriminin toplamı'),
      ((n+1)**2-n*n,1,10,0,120,'aₙ=n² dizisinde (a₂−a₁)+(a₃−a₂)+...+(a₁₁−a₁₀)'),
      (n**3,1,4,0,100,'aₙ=n³ dizisinin ilk dört teriminin toplamı'),
      (1/(n*(n+1)),1,7,0,s.Rational(7,8),'aₙ=1/[n(n+1)] dizisinin ilk 7 teriminin toplamı'),
      (2*n+(-1)**n,1,6,0,42,'aₙ=2n+(−1)ⁿ dizisinin ilk 6 teriminin toplamı'),
      (n*n-(n-1)**2,2,8,0,63,'aₙ=n²−(n−1)² dizisinde a₂+...+a₈'),
      (s.binomial(n,2),2,7,0,56,'aₙ=C(n,2) dizisinde a₂+a₃+...+a₇'),
      (3*n*n-2*n,1,5,0,135,'aₙ=3n²−2n dizisinin ilk 5 teriminin toplamı')]
    for j,(e,lo,hi,offset,val,text) in enumerate(cases):b.emit(p,f'general-sequence-query-{j+1:02}',f'{text} kaçtır?',val,{'operation':'sequence_sum','expression':e,'variable':'n','start':lo,'end':hi,'promptAnchors':[text]},['İstenen indeksler genel terime yazılır; çift/tek indeks isteniyorsa n yerine 2k veya 2k−1 alınır.','Gerektiğinde Σn=N(N+1)/2 ve Σn²=N(N+1)(2N+1)/6 bağıntıları uygulanır.'],'easy' if j==0 else 'medium' if j<8 else 'hard')
    p='F-P261-Q03'
    cases=[(3*2**(n-1),1,6,189,'İlk terimi 3 ve ortak çarpanı 2 olan geometrik dizinin ilk 6 teriminin toplamı'),
      (2*(-2)**(n-1),1,5,22,'İlk terimi 2, ortak çarpanı −2 olan geometrik dizinin ilk 5 teriminin toplamı'),
      (16*s.Rational(1,2)**(n-1),1,5,31,'İlk terimi 16, ortak çarpanı 1/2 olan geometrik dizinin ilk 5 teriminin toplamı'),
      (2*3**(n-1),3,6,720,'a₁=2, r=3 olan geometrik dizide a₃+a₄+a₅+a₆'),
      (3*2**(2*n-2),1,4,255,'a₁=3, r=2 olan geometrik dizide a₁+a₃+a₅+a₇'),
      (2*3**(2*n-1),1,3,546,'a₁=2, r=3 olan geometrik dizide a₂+a₄+a₆'),
      (s.Rational(1,2**0)*2**(1-n),1,4,s.Rational(15,8),'a₁=1 ve r=2 olan geometrik dizinin ilk dört teriminin çarpmaya göre terslerinin toplamı'),
      ((2*3**(n-1))**2,1,4,3280,'a₁=2,r=3 olan geometrik dizide ilk 4 terimin kareleri toplamı'),
      (5*2**(n-1)-5*2**(n-2),2,6,155,'a₁=5,r=2 olan geometrik dizide (a₂−a₁)+...+(a₆−a₅)'),
      ((-1)**(n-1)*2**(n-1),1,6,-21,'a₁=1,r=2 olan geometrik dizide a₁−a₂+a₃−a₄+a₅−a₆'),
      (4**(n-1),1,4,85,'a₁=1,r=4 olan dizinin ilk 4 teriminin toplamı'),
      (3**(n-1)+2**(n-1),1,5,152,'aₙ=3^(n−1)+2^(n−1) dizisinin ilk 5 teriminin toplamı'),
      (n*2**(n-1),1,5,129,'aₙ=2^(n−1) olan dizide a₁+2a₂+3a₃+4a₄+5a₅')]
    for j,(e,lo,hi,val,text) in enumerate(cases):b.emit(p,f'geometric-structure-{j+1:02}',f'{text} kaçtır?',val,{'operation':'sequence_sum','expression':e,'variable':'n','start':lo,'end':hi,'promptAnchors':[text]},['Geometrik dizinin n. terimi a₁·r^(n−1) biçimindedir.','İndeksler dönüştürülerek uygun ortak çarpan bulunur; r≠1 için sonlu toplam a₁(r^N−1)/(r−1) uygulanır.','Ağırlıklı toplam varsa komşu toplamların farkı alınır.'],'easy' if j<3 else 'medium' if j<9 else 'hard')
    p='F-P261-Q04'
    cases=[(1/(n*(n+1)),1,12,s.Rational(12,13),'1/(1·2)+1/(2·3)+...+1/(12·13)'),
      (1/(n*(n+1)),4,10,s.Rational(7,44),'1/(4·5)+1/(5·6)+...+1/(10·11)'),
      (1/(n*(n+2)),1,6,s.Rational(69,112),'1/(1·3)+1/(2·4)+...+1/(6·8)'),
      (2/(n*(n+2)),1,8,s.Rational(58,45),'2/(1·3)+2/(2·4)+...+2/(8·10)'),
      (1/((2*n-1)*(2*n+1)),1,7,s.Rational(7,15),'1/(1·3)+1/(3·5)+...+1/(13·15)'),
      (1/((n+2)*(n+3)),1,5,s.Rational(5,24),'1/(3·4)+1/(4·5)+...+1/(7·8)'),
      (3/(n*(n+3)),1,5,s.Rational(235,168),'3/(1·4)+3/(2·5)+...+3/(5·8)'),
      (1/n**2-1/(n+1)**2,1,9,s.Rational(99,100),'(1−1/2²)+(1/2²−1/3²)+...+(1/9²−1/10²)'),
      (n/(n+1)-(n+1)/(n+2),1,6,s.Rational(-3,8),'(1/2−2/3)+(2/3−3/4)+...+(6/7−7/8)'),
      (1/(n+1)-1/(n+3),1,5,s.Rational(95,168),'(1/2−1/4)+(1/3−1/5)+...+(1/6−1/8)'),
      (n/(n+1),1,4,s.Rational(163,60),'1/2+2/3+3/4+4/5'),
      (1/(n*(n+1)*(n+2)),1,6,s.Rational(27,112),'1/(1·2·3)+1/(2·3·4)+...+1/(6·7·8)'),
      (1/(3*n-2)-1/(3*n+1),1,5,s.Rational(15,16),'(1−1/4)+(1/4−1/7)+...+(1/13−1/16)')]
    for j,(e,lo,hi,val,display) in enumerate(cases):b.emit(p,f'telescoping-structure-{j+1:02}',f'{display} toplamı kaçtır?',val,{'operation':'sequence_sum','expression':e,'variable':'n','start':lo,'end':hi,'promptAnchors':[display]},['Kesirler komşu terimlerin farkı biçimine ayrılır: 1/[k(k+d)]=(1/k−1/(k+d))/d.','Toplamda ortak ara terimler sadeleşir; yalnız sınır terimleri kalır.','Gerektiğinde 1/[k(k+1)(k+2)] ifadesi iki ardışık çarpımlı kesrin farkına dönüştürülür.'],'easy' if j==0 else 'medium' if j<7 else 'hard')
    p='F-P265-Q01'
    cases=[(5+3*(n-1),10,10,32,'İlk terimi 5, ortak farkı 3 olan aritmetik dizinin 10. terimi'),
      (2+4*(n-1),1,12,288,'a₁=2,d=4 olan aritmetik dizinin ilk 12 teriminin toplamı'),
      (7+2*(n-1),5,9,95,'a₁=7,d=2 olan aritmetik dizide a₅+a₆+a₇+a₈+a₉'),
      (3+5*(2*n-2),1,5,115,'a₁=3,d=5 olan aritmetik dizide a₁+a₃+a₅+a₇+a₉'),
      (1+3*(2*n-1),1,4,52,'a₁=1,d=3 olan aritmetik dizide a₂+a₄+a₆+a₈'),
      ((-1)**(n-1)*(4+2*(n-1)),1,10,-10,'a₁=4,d=2 olan aritmetik dizide a₁−a₂+a₃−...−a₁₀'),
      ((2*n+1)**2,1,5,285,'aₙ=2n+1 aritmetik dizisinin ilk beş teriminin kareleri toplamı'),
      (20-3*(n-1),1,8,76,'a₁=20,d=−3 olan aritmetik dizinin ilk 8 teriminin toplamı'),
      (5+2*(n-1),4,4,11,'Bir aritmetik dizide a₂=7 ve a₆=15 ise a₄'),
      (3+4*(n-1),1,7,105,'Bir aritmetik dizide a₁=3 ve a₇=27 ise ilk yedi terimin toplamı'),
      ((n+1)-(n),1,15,15,'aₙ=n olan dizide (a₂−a₁)+...+(a₁₆−a₁₅)'),
      (n*(2*n-1),1,5,95,'aₙ=2n−1 dizisinde a₁+2a₂+3a₃+4a₄+5a₅'),
      (2*n-1,6,10,75,'İlk 10 pozitif tek sayının son beşinin toplamı')]
    for j,(e,lo,hi,val,text) in enumerate(cases):b.emit(p,f'arithmetic-structure-{j+1:02}',f'{text} kaçtır?',val,{'operation':'sequence_sum','expression':e,'variable':'n','start':lo,'end':hi,'promptAnchors':[text]},['Aritmetik dizide aₙ=a₁+(n−1)d yazılır.','Ardışık terim toplamında S=N·(ilk+son)/2; seçilmiş indekslerde ise yeni ortak fark kullanılır.','Kare veya ağırlık varsa genel terim açılarak temel sonlu toplam bağıntıları uygulanır.'],'easy' if j<2 else 'medium' if j<9 else 'hard')

def calculus_batches(b):
    p='AYT09-S281-Q01'
    cases=[(x**3+2*x-1,2,14),(x**4-3*x*x,1,-2),(3*x*x+5*x+1,-1,-1),
      (1/x,2,s.Rational(-1,4)),(s.sqrt(x),4,s.Rational(1,4)),((x-2)**3,3,3),
      ((x*x+1)*(x+2),1,8),((x+1)/(x+2),0,s.Rational(1,4)),
      (s.sin(x),0,1),(s.cos(x),s.pi/2,-1),(s.log(x),1,1),
      (x**5+1,0,0),((2*x+1)**4,0,8)]
    for j,(e,point,val) in enumerate(cases):b.emit(p,f'derivative-definition-form-{j+1:02}',f'f(x)={show(e)} için lim[h→0] [f({show(point)}+h)−f({show(point)})]/h kaçtır?',val,{'operation':'derivative','expression':e,'variable':'x','order':1,'point':point},['Verilen limit f′(a) tanımıdır.','Fonksiyon uygun türev kuralıyla türetilip a noktasında değerlendirilir.'],'easy' if j<3 else 'medium' if j<9 else 'hard')
    p='AYT10-S281-Q02'
    cases=[((x*x+a)*(2*x+3),0,12,2*a-12,6,1),((a*x+1)*(x*x+2),0,8,2*a-8,4,1),
      ((x+a)**2,1,10,2*(1+a)-10,4,1),((a*x*x+3)*(x-1),1,7,a+3-7,4,1),
      ((x*x+1)/(x+a),0,-s.Rational(1,4),-1/a**2+s.Rational(1,4),2,1),
      (a*x**3+2*x,1,17,3*a+2-17,5,1),(x**3+a*x*x,2,24,12+4*a-24,3,1),
      ((2*x+1)**3+a*x,0,11,6+a-11,5,1),((x+a)*(x-a),2,4,2*x,0,1),
      (a*s.sin(x)+x,0,6,a+1-6,5,1),(a*s.log(x)+x*x,1,7,a+2-7,5,1),
      ((x*x+a)*(x*x+1),1,16,2*(1+1)+2*(1+a)-16,5,1),
      ((a*x+2)/(x+1),0,4,a-2-4,6,1)]
    for j,(e,point,out,eq,val,order) in enumerate(cases):
        if j==8:
            # Product x²−a² loses parameter in f′; use initial-value data rather than a false unique derivative.
            e=(x+a)*(x+1);point=1;out=8;eq=2+1+a-8;val=5
        conditions=[{'left':a,'op':'gt','right':0}] if j==4 else []
        b.emit(p,f'derivative-parameter-role-{j+1:02}',f'f(x)={show(e)} ve f′({show(point)})={show(out)} olduğuna göre a kaçtır?'+(' a>0.' if j==4 else ''),val,{'operation':'solve_parameter','expression':eq,'variable':'a','conditions':conditions,'promptAnchors':[show(e)]},['Fonksiyon çarpım, bölüm veya bileşik fonksiyon kuralıyla türetilir.','Verilen noktadaki türev değeri eşitlenerek a denklemi çözülür.'],'easy' if j<2 else 'medium' if j<9 else 'hard')
    p='AYT11-S281-Q03'
    cases=[(x**3-a*x*x+4*x,2,6,12-2*a-6,3,2),
      (2*x**3+a*x*x-1,-1,-4,-12+2*a+4,4,2),
      (a*x**4+x*x,1,38,12*a+2-38,3,2),
      ((x+a)**3,0,24,6*a-24,4,2),
      (a*x**3+2*x*x,0,18,6*a-18,3,3),
      (x**4-a*x**3,2,30,48-12*a-30,s.Rational(3,2),2),
      ((a*x+1)**2,0,32,2*a*a-32,4,2),
      (x**5+a*x*x,1,26,20+2*a-26,3,2),
      (a*s.cos(x)+x*x,0,-3,-a+2+3,5,2),
      (a/x,1,10,2*a-10,5,2),
      (a*s.log(x),1,-7,-a+7,7,2),
      ((x*x+a)*(x*x+1),0,14,2*(a+1)-14,6,2),
      (a*x**4+3*x*x,1,48,24*a-48,2,3)]
    for j,(e,point,out,eq,val,order) in enumerate(cases):
        conditions=[{'left':a,'op':'gt','right':0}] if j==6 else []
        symbol='f′′' if order==2 else 'f′′′'
        b.emit(p,f'higher-derivative-parameter-{j+1:02}',f'f(x)={show(e)} ve {symbol}({show(point)})={show(out)} ise a kaçtır?'+(' a>0.' if j==6 else ''),val,{'operation':'solve_parameter','expression':eq,'variable':'a','conditions':conditions,'promptAnchors':[show(e)]},[f'Fonksiyon {order} kez türetilir.','Nokta yerine yazılıp verilen yüksek mertebeden türev değeriyle eşitlenir.','Parametre adaylarına varsa işaret koşulu uygulanır.'],'easy' if j<2 else 'medium' if j<9 else 'hard')
    p='AYT12-S305-Q01'
    cases=[(3*x**3-2*x*x+4,2,28,1),(x**5-2*x**3+x,1,0,1),((x-1)**4,3,32,1),
      ((x*x+1)**3,1,24,1),(x**2*(x+1)**2,1,12,1),(x**4-3*x*x+1,2,42,2),
      (2*x**5-x**3,1,114,3),((2*x-1)**3,2,54,1),(x**3+2*x*x,0,4,2),
      (x**6,1,720,6),(x**4+x**3,0,6,3),((x*x+1)*(x*x-1),1,4,1),
      ((x**3-1)/(x-1),2,5,1)]
    for j,(e,point,val,order) in enumerate(cases):b.emit(p,f'polynomial-derivative-structure-{j+1:02}',f'f(x)={show(e)} için {order}. türevin x={show(point)} noktasındaki değeri kaçtır?',val,{'operation':'derivative','expression':e,'variable':'x','order':order,'point':point},['Toplamda terim terim türev alınır; çarpım veya zincir varsa ilgili kural uygulanır.',f'{order}. mertebeye ulaşınca x={show(point)} yazılır.'],'easy' if j<2 else 'medium' if j<9 else 'hard')
    p='F-P285-Q01'
    cases=[(-2*x*x+7*x+1,2,-1),(x**3-6*x,1,-3),((x+1)**3,0,3),
      ((2*x-1)/(x+2),1,s.Rational(5,9)),(s.sqrt(2*x+1),4,s.Rational(1,3)),
      (x*s.sin(x),s.pi/2,1),(s.sin(2*x),s.pi/6,1),
      (s.log(x*x+1),1,1),(x/(x*x+1),0,1),
      ((x*x+1)**2,2,40),(s.cos(x*x),0,0),(1/(x-1)**2,3,s.Rational(-1,4)),
      (x**2*s.log(x),1,1)]
    for j,(e,point,val) in enumerate(cases):b.emit(p,f'tangent-slope-structure-{j+1:02}',f'y={show(e)} eğrisine x={show(point)} noktasında çizilen teğetin eğimi kaçtır?',val,{'operation':'derivative','expression':e,'variable':'x','order':1,'point':point},['Teğet eğimi m=f′(a) olduğundan önce türev bulunur.','Bölüm, çarpım veya zincir kuralı uygulanarak a noktası yerine yazılır.'],'easy' if j<3 else 'medium' if j<9 else 'hard')
    p='F-P293-Q01'
    # Tangency from an external point is encoded by f(t)−Y=(t−X)f′(t).
    cases=[(x**3+16,0,0,2,'x'),(x**3+54,0,0,3,'y'),(2*x**3+32,0,0,2,'slope'),
      (x*x+9,0,0,3,'x'),(2*x*x+8,0,0,2,'y'),(x**3+2*x+16,0,0,2,'slope'),
      ((x-1)**3+16,1,0,3,'x'),((x+2)**3+54,-2,0,1,'y'),
      (x**3+20,0,4,2,'y'),(2*x**3+40,0,8,2,'slope'),
      (x*x+4*x+9,0,0,3,'y'),((x-2)**2+4,2,0,4,'slope'),
      (3*x**3+48,0,0,2,'y')]
    for j,(f,X,Y,point,query) in enumerate(cases):
        # Build tangent condition without solving by the same CAS used for verification.
        eq=s.expand(f-(x-X)*s.diff(f,x)-Y)
        conditions=[{'left':x,'op':'gt','right':X}] if s.degree(eq,x)==2 else []
        if query=='x':value=point;spec={'operation':'solve_parameter','expression':eq,'variable':'x','conditions':conditions};request='teğet noktasının apsisi'
        elif query=='y':value=f.subs(x,point);spec={'operation':'evaluate','expression':s.Subs(f,x,point)};request='teğet noktasının ordinatı'
        else:value=s.diff(f,x).subs(x,point);spec={'operation':'derivative','expression':f,'variable':'x','order':1,'point':point};request='bu teğetin eğimi'
        spec['promptAnchors']=[show(f)]
        spec['supportingChecks']=[{'operation':'solve_parameter','expression':s.sstr(eq),'variable':'x','conditions':pack(conditions),'expectedValue':str(point)}]
        b.emit(p,f'external-tangent-role-{j+1:02}',f'y={show(f)} eğrisine çizilen bir teğet ({X},{Y}) noktasından geçiyor. '+(f'Teğet noktasının apsisi {X} değerinden büyüktür. ' if conditions else '')+f'{request} kaçtır?',value,spec,['Teğet noktasının apsisi t ise teğet denklemi y−f(t)=f′(t)(x−t) olur.','Verilen dış nokta yazılarak f(t)−Y=(t−X)f′(t) eşitliği çözülür.','Koşula uygun t ile istenen koordinat veya eğim hesaplanır.'],'medium' if j<5 else 'hard')
    p='F-P289-Q03'
    cases=[(2*x**3-a*x*x+5*x+1,2,12,24-2*a-12,6,2),
      (x**4-a*x*x,1,4,12-2*a-4,4,2),((x-a)**3,2,-12,6*(2-a)+12,4,2),
      (a*x**3+3*x*x,-1,-18,-6*a+6+18,4,2),
      (x**5-a*x**3,1,14,20-6*a-14,1,2),
      ((a*x+1)*(x*x+2),1,20,6*a+2-20,3,2),
      (a*x**4-x*x,0,72,24*a-72,3,4),
      (a*s.sin(x),s.pi/2,-6,-a+6,6,2),
      (x*x+a*s.cos(x),0,-5,2-a+5,7,2),
      (a/(x+1),0,8,2*a-8,4,2),
      (a*x**3-2*x*x,2,32,12*a-4-32,3,2),
      ((x*x+a)**2,1,20,12+4*a-20,2,2),
      (x**6+a*x**3,0,30,6*a-30,5,3)]
    for j,(f,point,out,eq,val,order) in enumerate(cases):b.emit(p,f'derivative-constraint-direction-{j+1:02}',f'f(x)={show(f)} fonksiyonunun {order}. türevinin x={show(point)} noktasındaki değeri {out}. a kaçtır?',val,{'operation':'solve_parameter','expression':eq,'variable':'a','promptAnchors':[show(f)]},[f'Fonksiyon {order} kez türetilir.','Belirtilen noktadaki değere eşitlenerek tek bilinmeyenli parametre denklemi çözülür.'],'easy' if j<2 else 'medium' if j<8 else 'hard')
    p='F-P309-Q03'
    cases=[(4*x**3-7*x*x-10*x+7,2,34),(x**4+2*x,1,12),((x+1)**4,0,12),
      ((2*x-1)**3,1,24),((x*x+1)**2,2,52),(1/x,2,s.Rational(1,4)),
      (s.sqrt(x),4,s.Rational(-1,32)),(s.sin(x),s.pi/2,-1),(s.cos(2*x),0,-4),
      (s.log(x),2,s.Rational(-1,4)),(x*s.log(x),1,1),
      ((x+1)/(x+2),0,s.Rational(-1,4)),(x*x*s.sin(x),0,0)]
    for j,(e,point,val) in enumerate(cases):b.emit(p,f'second-derivative-shape-{j+1:02}',f'f(x)={show(e)} için f′′({show(point)}) kaçtır?',val,{'operation':'derivative','expression':e,'variable':'x','order':2,'point':point},['Önce f′(x), ardından f′′(x) bulunur.','İkinci türevde verilen x değeri yerine yazılır; zincir kuralı çarpanları korunur.'],'easy' if j<2 else 'medium' if j<8 else 'hard')

def integral_limit_batches(b):
    p='AYT13-S305-Q02'
    cases=[(3*x*x+2*x-1,0,2,4,14),(4*x**3,1,2,3,18),(2*x+5,-1,2,4,22),
      (6*x*x-4*x,0,-1,1,-3),((2*x+1)**2,0,1,2,s.Rational(19,3)),
      (1/x,1,4,0,s.log(4)),(s.cos(x),0,s.pi/2,2,3),
      (2*x/(x*x+1),0,1,3,3+s.log(2)),(1/(x+1)**2,0,1,5,s.Rational(11,2)),
      (x**3-x,1,3,2,18),((x-1)**3,1,3,-2,2),
      (x*s.sqrt(x),0,4,1,s.Rational(69,5)),(s.sin(2*x),0,s.pi/2,3,4)]
    for j,(e,lo,hi,initial,value) in enumerate(cases):b.emit(p,f'antiderivative-initial-role-{j+1:02}',f'f′(x)={show(e)}, f({show(lo)})={show(initial)} ise f({show(hi)}) kaçtır?',value,{'operation':'integral','expression':e,'variable':'x','lower':lo,'upper':hi,'offset':initial},['Temel teoreme göre f(b)−f(a)=∫[a→b]f′(x)dx.','İlkel fonksiyonun iki sınırdaki farkı bulunur; verilen f(a) eklenir.'],'easy' if j<3 else 'medium' if j<9 else 'hard')
    p='AYT14-S305-Q03'
    cases=[(3*x*x-2*x+1,0,2,6),(2*x**3+3*x*x,-1,2,s.Rational(33,2)),
      ((2*x+1)**3,0,1,10),(x/(x*x+1),0,1,s.log(2)/2),
      (s.sin(x),0,s.pi,2),(s.cos(2*x),0,s.pi/4,s.Rational(1,2)),
      (1/x,1,s.Integer(3),s.log(3)),(s.Abs(x),-2,3,s.Rational(13,2)),
      (x**3-2*x,-2,2,0),(x*x+1,-1,1,s.Rational(8,3)),
      (s.sqrt(x),0,9,18),(1/(x+1)**2,0,3,s.Rational(3,4)),
      ((x-1)*(x+1),1,2,s.Rational(4,3))]
    for j,(e,lo,hi,value) in enumerate(cases):b.emit(p,f'definite-integral-structure-{j+1:02}',f'∫[{show(lo)}→{show(hi)}] ({show(e)}) dx kaçtır?',value,{'operation':'integral','expression':e,'variable':'x','lower':lo,'upper':hi},['İntegrandın ilkel fonksiyonu bulunur; bileşik ifadede uygun değişken dönüşümü seçilir.','F(üst sınır)−F(alt sınır) hesaplanır; mutlak değerde işaret değişim noktası aralığı böler.'],'easy' if j<2 else 'medium' if j<8 else 'hard')
    p='F-P309-Q01'
    cases=[(4*x-3,-1,3,4),(2*x+1,3,-1,-12),(3*x,0,4,24),
      ((x-2)**2,0,4,s.Rational(16,3)),(x*(x+1),-1,2,s.Rational(9,2)),
      (2*x+4,-2,0,4),(s.Abs(2*x-2),0,3,5),
      (5-2*x,0,s.Rational(5,2),s.Rational(25,4)),(x**2-x,-1,1,s.Rational(2,3)),
      (3*x*x+2,0,2,12),((x+1)**2-(x-1)**2,0,3,18),
      (2*x/(x*x+4),0,2,s.log(2)),(1/(2*x+1),0,1,s.log(3)/2)]
    for j,(e,lo,hi,value) in enumerate(cases):b.emit(p,f'area-integral-direction-{j+1:02}',f'∫[{show(lo)}→{show(hi)}] ({show(e)}) dx belirli integralinin değeri kaçtır?',value,{'operation':'integral','expression':e,'variable':'x','lower':lo,'upper':hi},['Doğrusal ifadelerde ilkel fonksiyon ax²/2+bx olur; diğerlerinde kuvvet veya değişken dönüşümü kuralı kullanılır.','Sınırlar ters ise integralin işareti değişir.','Üst sınır değeri eksi alt sınır değeri alınır.'],'easy' if j<3 else 'medium' if j<10 else 'hard')
    p='F-P309-Q04'
    cases=[(6*x*x+4*x-1,0,2,-3,19),(2*x+1,2,5,7,31),
      (3*x*x,1,-1,5,3),(x*x-1,-2,2,0,s.Rational(4,3)),
      (4*(x-1)**3,1,3,2,18),(2/(x+1),0,1,1,1+2*s.log(2)),
      (s.cos(2*x),0,s.pi/4,4,s.Rational(9,2)),(x*x+2*x+1,-1,2,-2,7),
      (2*x/(x*x+1),1,0,3,3-s.log(2)),(s.sqrt(x),1,4,2,s.Rational(20,3)),
      (1/(x*x),1,2,-1,s.Rational(-1,2)),(x**3+2*x,0,2,4,12),
      (s.sin(x),s.pi/2,s.pi,1,2)]
    for j,(e,lo,hi,initial,value) in enumerate(cases):b.emit(p,f'recover-function-direction-{j+1:02}',f'f′(x)={show(e)} ve f({show(lo)})={show(initial)}. f({show(hi)}) kaçtır?',value,{'operation':'integral','expression':e,'variable':'x','lower':lo,'upper':hi,'offset':initial},['f(b)=f(a)+∫[a→b]f′(x)dx bağıntısı uygulanır.','Alt sınır üst sınırdan büyükse integral yönü korunur; başlangıç değeri en son eklenir.'],'easy' if j<2 else 'medium' if j<9 else 'hard')
    p='F-P317-Q03'
    cases=[(u+1,1,x*x,2,20,1),(u*u,0,x**3,1,3,1),
      (2*u-1,x,x*x,2,25,1),(u+2,1,2*x+1,0,6,1),
      (u**2+1,0,x*x,-1,-4,1),(u,0,s.sin(x),s.pi/4,s.Rational(1,2),1),
      (1/u,1,x*x,2,1,1),(s.cos(u),0,2*x,0,2,1),
      (u-3,x*x,x**3,1,-2,1),(u+1,0,x*x,1,8,2),
      (u*u,1,x+1,0,2,2),(2*u+1,0,x*x,0,2,2),
      (s.sqrt(u),0,x*x,2,8,1)]
    for j,(integrand,lo,hi,point,value,order) in enumerate(cases):
        F=s.Integral(integrand,(u,lo,hi));display=f'F(x)=∫[{show(lo)}→{show(hi)}] ({show(integrand)}) du'
        b.emit(p,f'fundamental-theorem-chain-{j+1:02}',f'{display} ise F'+('′' if order==1 else '′′')+f'({show(point)}) kaçtır?',value,{'operation':'derivative','expression':F,'variable':'x','order':order,'point':point,'promptAnchors':[display]},['Değişken üst sınır g(x) için türev f(g(x))·g′(x) olur.','Alt sınır da değişkense onun katkısı çıkarılır; ikinci türev isteniyorsa bir kez daha türetilir.','Verilen noktadaki değer hesaplanır.'],'medium' if j<5 else 'hard')
    p='AYT15-S269-Q01'
    cases=[((2*x*x-3*x+1)/(x+2),1,0),((x**3+1)/(2*x-1),2,3),
      ((x*x+4)/(x*x+1),0,4),((3*x-1)/(x*x+2),-1,s.Rational(-4,3)),
      (s.sqrt(x+5)/(x+1),4,s.Rational(3,5)),((x*x+1)/(x**3+2),1,s.Rational(2,3)),
      ((x-3)/(s.sqrt(x+1)+1),3,0),((2*x+1)**3/(x*x+2),0,s.Rational(1,2)),
      ((1/x+1)/(x+1),2,s.Rational(1,2)),(s.sin(x)/(x+1),s.pi/2,2/(s.pi+2)),
      (s.log(x+1)/(x+2),0,0),((x*x-1)/(x+1),1,0),
      ((s.sqrt(x)+1)/(x+3),1,s.Rational(1,2))]
    for j,(e,point,value) in enumerate(cases):b.emit(p,f'continuous-rational-limit-{j+1:02}',f'lim[x→{show(point)}] ({show(e)}) kaçtır?',value,{'operation':'limit','expression':e,'variable':'x','point':point},['Payda sınır noktasında sıfır değilse sürekli ifadelerde doğrudan yerine koyulur.','Karekök, logaritma ve trigonometrik ifadenin tanım koşulu kontrol edilir.'],'easy' if j<4 else 'medium' if j<10 else 'hard')
    p='F-P273-Q03'
    cases=[(3*x*x-5*x+1,2,3),(x**4-2*x*x+3,-1,2),((x-1)**5,1,0),
      (s.sqrt(x*x+9),0,3),(s.Abs(x-2),2,0),((x*x+1)**3,-1,8),
      (s.sin(2*x),s.pi/4,1),(s.cos(x*x),0,1),(s.log(x+1),0,0),
      (x**3*(x-2),2,0),((x*x-1)**2,0,1),
      ((2*x-3)**4,1,1),(s.sqrt(2*x+1)+x,-s.Rational(1,2),-s.Rational(1,2))]
    for j,(e,point,value) in enumerate(cases):b.emit(p,f'continuous-expression-limit-{j+1:02}',f'lim[x→{show(point)}'+(' sağdan' if j==12 else '')+f'] ({show(e)}) kaçtır?',value,{'operation':'limit','expression':e,'variable':'x','point':point},['Polinomlar her gerçek noktada; kök ve logaritmalar tanım kümesinde süreklidir.','Sınır noktası ifadeye doğrudan yerleştirilir.'],'easy' if j<3 else 'medium')
    p='F-P269-Q02'
    cases=[((x*x-9)/(x-3),3,6),((x**3-8)/(x-2),2,12),
      ((x*x-1)/(x*x-x),1,2),((s.sqrt(x+3)-2)/(x-1),1,s.Rational(1,4)),
      ((s.sqrt(1+2*x)-1)/x,0,1),(s.sin(3*x)/x,0,3),
      ((1-s.cos(x))/x**2,0,s.Rational(1,2)),((x**4-16)/(x*x-4),2,8),
      ((s.log(1+x))/x,0,1),((x**3+1)/(x+1),-1,3),
      ((x-1)/(s.sqrt(x)-1),1,2),((s.sin(2*x))/(s.sin(5*x)),0,s.Rational(2,5)),
      ((s.Abs(x))/x,0,1)]
    for j,(e,point,value) in enumerate(cases):
        direction='+';suffix=' sağdan' if j==12 else ''
        steps=(['x, 0’a sağdan yaklaşırken x>0 olur; bu nedenle |x|=x yazılır.',
          'Bu aralıkta |x|/x=x/x=1 olur; 0 noktasında ifadenin tanımlı olması gerekmez.',
          '0’ın sağındaki bütün değerlerde ifade 1 olduğundan sağdan limit 1’dir.'] if j==12 else
          ['0/0 durumu varsa çarpanlara ayırma veya eşlenikle çarpma uygulanır.','Trigonometrik ve logaritmik özel limitler gerekirse standart limite dönüştürülür.','Sadeleştirilmiş ifadenin sınır değeri alınır; sağdan sınırda işaret buna göre seçilir.'])
        b.emit(p,f'indeterminate-limit-structure-{j+1:02}',f'lim[x→{show(point)}{suffix}] ({show(e)}) kaçtır?',value,{'operation':'limit','expression':e,'variable':'x','point':point,'direction':direction},steps,'easy' if j<3 else 'medium' if j<9 else 'hard')

def main():
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',default='work/archive-input/ai_questions_ayt.json')
    parser.add_argument('--output',default='work/generated-ayt.json')
    args=parser.parse_args()
    raw=json.loads(Path(args.input).read_text())
    if isinstance(raw,dict):raw=raw.get('questions',raw.get('records',[]))
    records=[q for q in raw if q.get('examType')=='AYT']
    b=Batch(records)
    for generate in [binomial_batches,quadratic_batches,parabola_batches,polynomial_batches,trigonometry_batches,complex_batch,logarithm_batches,sequence_batches,calculus_batches,integral_limit_batches]:
        generate(b)
        print(f'{generate.__name__}: {len(b.questions)}',flush=True)
    assert len({q['id'] for q in b.questions})==len(b.questions)
    b.dump(args.output)

if __name__=='__main__':main()
