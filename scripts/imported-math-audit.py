#!/usr/bin/env python3
"""Independently re-solve supported imported AI exercises from their prompt.

The answer key, stored computedValue and solution are comparison targets only;
solve_prompt receives only ID and prompt, except two option-set questions where
candidate options are the explicit mathematical objects being quantified over.
Unsupported/ambiguous content stays in review. This is not human editorial
approval or a claim that an exercise came from an actual exam.
"""
import argparse
import ast
import copy
import hashlib
import itertools
import json
import math
import re
from collections import Counter
from pathlib import Path
from fractions import Fraction
from functools import lru_cache
import sympy as s

SYMBOLS = dict(zip('xyzabmnuh', s.symbols('x y z a b m n u h', real=True)))
x,y,z,a,b,m,n,u,h = [SYMBOLS[c] for c in 'xyzabmnuh']

class Review(Exception):
    pass


def normalize(t):
    return t.replace('−','-').replace('–','-').replace('×','*').replace('·','*').replace('÷','/').replace('²','**2').replace('³','**3').replace('⁴','**4').replace('^','**')


def expression(text):
    """Tiny AST arithmetic evaluator: no eval, attributes, imports or names from input."""
    text = normalize(text).strip()
    text = re.sub(r'√(\d+)', r'S(\1)', text)
    text = re.sub(r'(?<=[0-9a-z)])(?=[a-z(])', '*', text)
    text = re.sub(r'(?<=[a-z)])(?=\d)', '*', text)
    if not re.fullmatch(r'[0-9xyzabmnuhS+*/().\s-]+', text):
        raise Review('unsupported_expression_syntax')
    tree = ast.parse(text, mode='eval')
    def rec(node):
        if isinstance(node, ast.Expression): return rec(node.body)
        if isinstance(node, ast.Constant) and type(node.value) is int: return s.Integer(node.value)
        if isinstance(node, ast.Name) and node.id in SYMBOLS: return SYMBOLS[node.id]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            val=rec(node.operand); return val if isinstance(node.op, ast.UAdd) else -val
        if isinstance(node, ast.BinOp):
            left,right=rec(node.left),rec(node.right)
            if isinstance(node.op,ast.Add): return left+right
            if isinstance(node.op,ast.Sub): return left-right
            if isinstance(node.op,ast.Mult): return left*right
            if isinstance(node.op,ast.Div):
                if right == 0: raise Review('zero_denominator')
                return left/right
            if isinstance(node.op,ast.Pow):
                if right.is_Integer is not True or abs(right)>10000: raise Review('unsupported_power')
                return left**right
        if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='S' and len(node.args)==1 and not node.keywords:
            return s.sqrt(rec(node.args[0]))
        raise Review('unsupported_expression_ast')
    return s.simplify(rec(tree))


def match(pattern, text):
    found=re.search(pattern, text)
    if not found: raise Review('prompt_does_not_match_supported_template')
    return found.groups()


def ints(text):
    return list(map(int,re.findall(r'-?\d+',normalize(text))))


def one(values):
    values=list(dict.fromkeys(values))
    if len(values)!=1: raise Review('prompt_has_no_unique_mathematical_result')
    return values[0]


def digit_number(word, substitutions):
    return int(''.join(str(substitutions.get(c,c)) for c in word))


def solve_prompt(qid,p,options):
    """Return independently derived value and method description, or Review."""
    # Routing is metadata only. Every mathematical operand is parsed from p.
    fam=re.sub(r'-\d+$','',qid)
    nn=normalize(p)
    v=ints(p)
    method='exact_symbolic_recalculation'
    if fam=='AI-TYT01':
        result=expression(p.split(' işleminin')[0])
    elif fam=='AI-TYT02':
        val,expr=match(r'x = (-?\d+) için (.+) çarpımının',p)
        result=expression(expr).subs(x,int(val))
    elif fam=='AI-TYT03':
        expr,=match(r'sayılardır\. (.+) ifadesi açıldığında',p)
        result=s.expand(expression(expr)).coeff(a,1).coeff(b,1)
    elif fam=='AI-TYT04':
        e1,e2,e3,target=match(r'B = (.+?), B sayısından C = (.+?), C sayısından D = (.+?) elde ediliyor\. D = (-?\d+)',p)
        # A/B/C are normalized locally to a single symbolic variable.
        f1=expression(e1.replace('A','x')); f2=expression(e2.replace('B','x')); f3=expression(e3.replace('C','x'))
        result=one(s.solve(s.Eq(f3.subs(x,f2.subs(x,f1)),int(target)),x))
    elif fam=='AI-TYT05':
        expr,scale=match(r'olmak üzere, (.+?) ifadesinde x, y ve z değerlerinin her biri (\d+) katına',p)
        ex=expression(expr); k=int(scale)
        result=s.simplify(ex.subs({x:k*x,y:k*y,z:k*z},simultaneous=True)/ex)
    elif fam=='AI-TYT06':
        value,lo,hi=match(r'(-?\d+) sayısı (-?\d+) ile (-?\d+) arasındaki \(uçlar dahil\)',p)
        val,lo,hi=map(int,(value,lo,hi)); result=sum(val//k for k in range(lo,hi+1) if k and val%k==0);method='finite_integer_divisor_enumeration'
    elif fam=='AI-TYT07':
        initial,down,up,hours_down,hours_up=match(r'başlangıçta (-?\d+)°C.+saatte (\d+)°C azalıyor.+saatte (\d+)°C artıyor\. (\d+) saat çalışıp (\d+) saat',p)
        initial,down,up,hours_down,hours_up=map(int,(initial,down,up,hours_down,hours_up))
        result=initial-down*hours_down+up*hours_up
    elif fam=='AI-TYT08':
        digits,neg_digits=map(int,match(r'Rakamları farklı (\d+) basamaklı en küçük doğal sayı ile (\d+) basamaklı en küçük negatif',p))
        if not 2<=digits<=10:raise Review('unsupported_digit_count')
        smallest=int('10'+''.join(map(str,range(2,digits))))
        result=smallest-(-(10**neg_digits-1))
        method='construct_minimum_distinct_digits_and_negative_bound'
    elif fam=='AI-TYT09':
        left,total,right=match(r'sayılar için (.+?) = (\d+) veriliyor\. Buna göre (.+?) toplamı',p)
        words1=left.split(' + '); words2=right.split(' + ')
        if not all(re.fullmatch('[0-9AB]{3}',w) for w in words1+words2):raise Review('unsupported_digit_expression')
        values=[]
        for A,B in itertools.product(range(10),repeat=2):
            subst={'A':A,'B':B}
            if any(str(subst.get(w[0],w[0]))=='0' for w in words1+words2):continue
            if sum(digit_number(w,subst) for w in words1)==int(total):values.append(sum(digit_number(w,subst) for w in words2))
        result=one(values);method='all_digit_assignments_enumerated'
    elif fam=='AI-TYT10':
        da,db,dc=map(int,match(r'A = K \+ \((-?\d+)\), B = L \+ \((-?\d+)\), C = M \+ \((-?\d+)\)',p))
        if not any(1<=K+da<=9 and 0<=L+db<=9 and 0<=M+dc<=9 for K in range(1,10) for L in range(10) for M in range(10)):raise Review('inconsistent_digit_conditions')
        result=100*da+10*db+dc
    elif fam=='AI-TYT11':
        total,diff=map(int,match(r'A\+B=(\d+) ve B−C=(-?\d+)',p))
        result=sum(100*A+10*B+C for A in range(1,10) for B in range(10) for C in range(10) if A+B==total and B-C==diff);method='all_three_digit_numbers_enumerated'
    elif fam=='AI-TYT12':
        end,start,total=map(int,match(r'sağına (\d) yazıldığında A, soluna (\d) yazıldığında B sayısı elde ediliyor\. A\+B=(\d+)',p))
        candidates=[k for k in range(100,1000) if (10*k+end)+(start*1000+k)==total]
        result=sum(map(int,str(one(candidates))));method='all_three_digit_numbers_enumerated'
    elif fam=='AI-TYT13':
        total,digits=map(int,match(r'Rakamları toplamı (\d+) olan (\d+) basamaklı',p))
        # Greedy construct both extremal digit strings, with remaining-capacity check.
        def extremal(reverse):
            rem=total; out=[]
            for i in range(digits):
                candidates=range(9,-1,-1) if reverse else range(10)
                valid=[d for d in candidates if (i>0 or d>0) and 0<=rem-d<=9*(digits-i-1)]
                if not valid:raise Review('inconsistent_digit_sum')
                out.append(valid[0]);rem-=valid[0]
            return out
        position=match(r'(birler|onlar|yüzler|binler|on binler|yüz binler) basamağındaki',p)[0]
        index={'birler':-1,'onlar':-2,'yüzler':-3,'binler':-4,'on binler':-5,'yüz binler':-6}[position]
        result=extremal(False)[index]+extremal(True)[index];method='extremal_digit_strings_with_capacity_constraints'
    elif fam=='AI-TYT14':
        sums={100*A+10*B+C+100*B+10*C+A+100*C+10*A+B for A,B,C in itertools.permutations(range(1,10),3)}
        result=one([expression(o['text']) for o in options if expression(o['text']) not in sums]);method='all_distinct_nonzero_digit_triples_enumerated'
    elif fam in ('AI-TYT15','AI-TYT22'):
        total=int(match(r'A\+B\s*=\s*(\d+)',p)[0]) if fam=='AI-TYT22' else int(match(r'AB\+BA=(\d+)',p)[0])
        diff=int(match(r'AB\s*−\s*BA\s*=\s*(-?\d+)',p)[0])
        result=one([10*A+B for A in range(1,10) for B in range(1,10) if (A+B if fam=='AI-TYT22' else 11*(A+B))==total and 9*(A-B)==diff]);method='all_nonzero_leading_digit_pairs_enumerated'
    elif fam=='AI-TYT16':
        rows=int(match(r'tablosu (\d+) farklı satır',p)[0]); result=one([i for i in range(30) if 2**i==rows])
    elif fam=='AI-TYT17':
        rows,offset=map(int,match(r'tablosunda (\d+) satır vardır\. \(n−(\d+)\)',p))
        terms=one([i for i in range(30) if 2**i==rows])-offset
        if terms<0:raise Review('negative_proposition_count')
        result=2**terms
    elif fam=='AI-TYT18':
        colors,total=match(r'kareler (.+?) renkleriyle sırayla.+toplamı (\d+) cm',p)
        colors=colors.replace(' renkleriyle','').split(', '); total=int(total)
        side=one([k for k in range(1,100000) if 2*k*(k+1)==total])
        result=f'{colors[(side-1)%len(colors)]}, {side} cm';method='exact_triangular_perimeter_and_period_index'
    elif fam=='AI-TYT19':
        product_parity,expr=match(r'x·y (tek|çift) olduğu biliniyor\. (.+?) ifadesinin',p)
        outcomes={int(expression(expr).subs({x:X,y:Y,z:Z}))%2 for X,Y,Z in itertools.product(range(2),repeat=3) if (X+Y)%2==0 and (Y-Z)%2==1 and (X*Y)%2==(1 if product_parity=='tek' else 0)}
        result='kesinlikle tek' if outcomes=={1} else 'kesinlikle çift' if outcomes=={0} else 'tek veya çift olabilir';method='all_eight_parity_assignments_enumerated'
    elif fam=='AI-TYT20':
        expr,=match(r'olmak üzere, (.+?) ifadesi',p)
        result=s.simplify(expression(expr).subs(z,-x-y))
        if result.free_symbols:raise Review('nonconstant_rational_expression')
    elif fam=='AI-TYT21':
        prod=int(match(r'çarpımı (\d+)',p)[0]); tuples=[digits for digits in itertools.combinations_with_replacement(range(1,10),5) if math.prod(digits)==prod]
        if not tuples:raise Review('inconsistent_digit_product')
        common=set.intersection(*(set(digits) for digits in tuples))
        result=one([expression(o['text']) for o in options if expression(o['text']) in common]);method='all_nonzero_digit_multisets_enumerated'
    elif fam=='AI-AYT01':
        expr,=match(r'^(.+?) açılımında',p); poly=s.Poly(s.expand(expression(expr)),x,y); result=len(poly.terms());method='symbolic_expansion_count_nonzero_monomials'
    elif fam=='AI-AYT02':
        expr,=match(r'^(.+?) açılımındaki',p); result=s.expand(expression(expr)).subs({x:1,y:1})
    elif fam=='AI-AYT03':
        expr,monomial=match(r'^(.+?) açılımında (.+?) teriminin',p); powers=expression(monomial).as_powers_dict(); result=s.Poly(s.expand(expression(expr)),x,y).coeff_monomial(x**powers.get(x,0)*y**powers.get(y,0))
    elif fam=='AI-AYT04':
        expr,=match(r'^(.+?) ifadesinin',p); result=s.expand(expression(expr)).subs({x:0,y:0})
    elif fam=='AI-AYT05':
        exp=int(match(r'\(x\+y\)\^(\d+)',p)[0]);
        if exp%2:raise Review('no_unique_middle_term')
        result=s.expand((x+y)**exp).coeff(x,exp//2).coeff(y,exp//2)
    elif fam=='AI-AYT06':
        row,pos=map(int,match(r'sayıldığında (\d+)\. satırdaki soldan (\d+)\.',p)); result=math.comb(row-1,pos-1)
    elif fam=='AI-AYT07':
        expr,=match(r'^(.+?) açılımındaki',p); result=sum(abs(k) for k in s.Poly(expression(expr),x).all_coeffs())
    elif fam=='AI-AYT08':
        expr,=match(r'P\(x\)=(.+?) polinomunda',p);poly=s.Poly(expression(expr),x)
        if poly.coeff_monomial(x**3)==0:raise Review('zero_coefficient_denominator')
        result=poly.coeff_monomial(x)/poly.coeff_monomial(x**3)
    elif fam=='AI-AYT09':
        expr,point=match(r'f\(x\)=(.+?)\. lim\[h→0\] \(f\((-?\d+)\+h\)',p); ex=expression(expr); point=int(point);result=s.limit((ex.subs(x,point+h)-ex.subs(x,point))/h,h,0);method='symbolic_difference_quotient_limit'
    elif fam=='AI-AYT10':
        expr,point,target=match(r'f\(x\)=(.+?) ve f’\((-?\d+)\)=(-?\d+)',p);result=one(s.solve(s.Eq(s.diff(expression(expr),x).subs(x,int(point)),int(target)),a))
    elif fam=='AI-AYT11':
        expr,point,target=match(r'f\(x\)=(.+?) için f’’\((-?\d+)\)=(-?\d+)',p);result=one(s.solve(s.Eq(s.diff(expression(expr),x,2).subs(x,int(point)),int(target)),a))
    elif fam=='AI-AYT12':
        expr,point=match(r'f\(x\)=(.+?) ise f’\((-?\d+)\)',p);result=s.diff(expression(expr),x).subs(x,int(point))
    elif fam=='AI-AYT13':
        expr,initial,point=match(r'f’\(x\)=(.+?) ve f\(0\)=(-?\d+)\. f\((-?\d+)\)',p);result=int(initial)+s.integrate(expression(expr),(x,0,int(point)))
    elif fam=='AI-AYT14':
        lo,hi,expr=match(r'∫\[(-?\d+)→(-?\d+)\] \((.+)\) dx',p);result=s.integrate(expression(expr),(x,int(lo),int(hi)))
    elif fam=='AI-AYT15':
        point,expr=match(r'lim\[x→(-?\d+)\] (.+?) limitinin',p);result=s.limit(expression(expr),x,int(point))
    elif fam=='AI-AYT16':result=int(match(r'^(-?\d+)°',p)[0])%360
    elif fam=='AI-AYT17':
        factor=int(match(r'x=(\d+)y',p)[0]);result=-factor/s.sqrt(factor**2+1)
    elif fam.startswith('V3-TYT-'):
        k=int(fam.rsplit('-',1)[1]);method='exact_prompt_formula_and_domain_checks'
        if k==1:
            i,j=map(int,match(r'Baştan (\d+)\. çift sayı, baştan (\d+)\. tek',p));result=2*i-(2*j-1)
        elif k==2:
            N=int(match(r"1'den (\d+)'ye",p)[0]);result=sum(len(str(i)) for i in range(1,N+1));method='explicit_decimal_sequence_count'
        elif k==3:
            total=int(match(r'toplam (\d+) rakam',p)[0]);result=one([i for i in range(100,1000) if 9+180+3*(i-99)==total])
        elif k==4:
            A,B,C=map(int,match(r'(\d+)x \+ (\d+)y = (\d+)',p));result=sum(1 for i in range(C//A+1) if (C-A*i)%B==0)
        elif k==5:result=s.Rational(int(match(r'toplamı (\d+)',p)[0]),2)
        elif k==6:
            mid,count=map(int,match(r'terimi (\d+) olan (\d+) ardışık çift',p));
            if mid%2 or count%2==0:raise Review('inconsistent_middle_even_sequence')
            result=mid*count
        elif k==7:
            diff=int(match(r'farkı (\d+)',p)[0]); bigger=s.Rational(diff+4,4)
            if bigger.is_Integer is not True or bigger<3 or bigger%2!=1:raise Review('inconsistent_consecutive_odd_squares')
            result=bigger
        elif k==8:
            first,step,count=map(int,match(r'terimi (\d+), ortak farkı (\d+) olan aritmetik dizinin ilk (\d+)',p));result=sum(first+i*step for i in range(count))
        elif k==9:result=3*int(match(r'dizilen (\d+) kare',p)[0])+1
        elif k==10:
            mod,rem,A,B,mod2=map(int,match(r'N sayısının (\d+) ile bölümünden kalan (\d+).+ (\d+)N \+ (\d+) sayısının (\d+) ile',p))
            if mod!=mod2 or not 0<=rem<mod:raise Review('invalid_modular_conditions')
            result=(A*rem+B)%mod
        elif k==11:
            A,B,C=map(int,match(r'^(\d+), (\d+) ve (\d+) sayıları',p));result=math.gcd(A-B,B-C)
        elif k==12:
            A,B,C=map(int,match(r'sırasıyla (\d+), (\d+) ve (\d+) saniyede',p));result=math.lcm(A,B,C)
        elif k==13:
            lo,hi=map(int,match(r'(-?\d+) < x < (-?\d+)',p));result=len(range(lo+1,hi))
        elif k==14:
            center,radius=map(int,match(r'\|x − \((-?\d+)\)\| = (\d+)',p));result=sum([center-radius,center+radius])
        elif k==15:
            base,left,right=map(int,match(r'(\d+)\^(\d+) × \d+\^x = \d+\^(\d+)',p))
            bases=re.findall(r'(\d+)\^',p)
            if len(set(bases))!=1 or base<=1:raise Review('unsupported_exponent_bases')
            result=right-left
        elif k==16:
            A,B=map(int,match(r'√(\d+) \+ √(\d+)',p));result=s.sqrt(A)+s.sqrt(B)
        elif k==17:
            A,B,rooms,beds=map(int,match(r'odalar (\d+) veya (\d+) kişiliktir\. Toplam (\d+) odada (\d+) kişilik',p));result=one([j for j in range(rooms+1) if A*(rooms-j)+B*j==beds])
        elif k==18:
            count,wins,draws,winpoints,drawpoints=map(int,match(r'(\d+) maçta (\d+) galibiyet ve (\d+) beraberlik.+Galibiyet (\d+), beraberlik (\d+) puan',p))
            if wins+draws>count:raise Review('inconsistent_match_count')
            result=wins*winpoints+draws*drawpoints
        elif k==19:
            count,capacity=map(int,match(r'manav (\d+) portakalı (\d+)',p));result=count//capacity
        elif k==20:
            avg,ages=match(r'ortalaması (\d+)\. Dört kişinin yaşları (.+?)\. Beşinci',p);result=5*int(avg)-sum(ints(ages))
            if result<0:raise Review('negative_age')
        elif k==21:
            ratio,age,years=map(int,match(r'yaşının (\d+) katıdır\. Çocuk bugün (\d+) yaşında olduğuna göre, (\d+) yıl',p));result=ratio*age+years
        elif k==22:
            distance,v1,v2=map(int,match(r'Aralarında (\d+) km.+sırasıyla (\d+) ve (\d+) km/sa',p));result=s.Rational(distance,v1+v2)
        elif k==23:
            t1,t2=map(int,match(r'sırasıyla (\d+) ve (\d+) günde',p));result=1/(s.Rational(1,t1)+s.Rational(1,t2))
        elif k==24:
            price,inc,dec=map(int,match(r'fiyatı (\d+) TL.+önce %(\d+) zam.+üzerinden %(\d+) indirim',p));result=s.Rational(price*(100+inc)*(100-dec),10000)
        elif k==25:
            l1,p1,l2,p2=map(int,match(r'(\d+) litre %(\d+) tuz.+ile (\d+) litre %(\d+) tuz',p));result=s.Rational(l1*p1+l2*p2,l1+l2)
        elif k==26:
            A,B,both=map(int,match(r'A etkinliğine (\d+), B etkinliğine (\d+).+katılan (\d+) öğrenci',p))
            if both>min(A,B):raise Review('invalid_set_intersection')
            result=A+B-both
        elif k==27:
            expr,point=match(r'f\(x\)=(.+?) fonksiyonu için f\((-?\d+)\)',p);result=expression(expr).subs(x,int(point))
        elif k==28:
            red,blue=map(int,match(r'(\d+) kırmızı ve (\d+) mavi',p));result=s.Rational(red*(red-1),(red+blue)*(red+blue-1))
        elif k==29:
            count,size=map(int,match(r'(\d+) öğrenciden (\d+) kişilik',p));result=math.comb(count,size)
        elif k==30:
            count,avg,new=map(int,match(r'(\d+) sayının aritmetik ortalaması (\d+).+gruba (\d+) sayısı',p));result=s.Rational(count*avg+new,count+1)
        elif k==31:
            A,B=map(int,match(r'(\d+)x=(\d+)y',p));g=math.gcd(A,B);result=(A+B)//g
        elif k==32:
            N,index=map(int,match(r'1,2,3,\.\.\.,(\d+) sayıları.+Soldan (\d+)\.',p));seq=''.join(map(str,range(1,N+1)))
            if not 1<=index<=len(seq):raise Review('index_out_of_bounds')
            result=int(seq[index-1])
        elif k==33:
            top,count=map(int,match(r'1,2,\.\.\.,(\d+) tam sayı.+oyunda (\d+) atış',p));result=count*(top-1)+1
        elif k==34:
            lo,hi=map(int,match(r'(\d+) ≤ x ≤ (\d+)',p));result=sum(k%2 for k in range(lo,hi+1))
        elif k==35:
            girls,boys,left,initial,brothers=map(int,match(r'birine (\d+), erkek kardeşlerinin her birine (\d+).+ve (\d+) bilyesi kalıyor\. Başta (\d+) bilyesi olduğu ve erkek kardeş sayısı (\d+)',p));result=s.Rational(initial-left-boys*brothers,girls)
            if result.is_Integer is not True or result<0:raise Review('invalid_sibling_count')
        elif k==36:
            N=int(match(r'F\((\d+)\) toplamı',p)[0]);result=sum((i+1)//2 for i in range(1,N+1))
        elif k==37:
            values=ints(match(r'deniyor\. (.+?) sayılarından',p)[0]);result=sum(math.isqrt(value)**2==value and math.isqrt(8*value+1)**2==8*value+1 for value in values)
        elif k==38:
            raise Review('ambiguous_range_endpoints_1_ile_N_arasinda')
        elif k==39:
            red,blue,green,target=map(int,match(r'(\d+) kırmızı, (\d+) mavi ve (\d+) yeşil.+en az (\d+) bilyenin',p))
            if target>max(red,blue,green):raise Review('impossible_pigeonhole_target')
            result=sum(min(target-1,c) for c in (red,blue,green))+1
        elif k==40:
            N=int(match(r'(\d+)!',p)[0]);result=0
            while N:N//=5;result+=N
        elif k==41:
            A,B,mod=map(int,match(r'(\d+) ve (\d+) sayılarının toplamının (\d+)',p));result=(A+B)%mod
        elif k==42:
            expr,point=match(r'^(.+?) sayısı, m=(\d+)',p);value=expression(expr).subs(m,int(point))
            if value.is_Integer is not True or value<=0:raise Review('invalid_positive_product')
            result=sum(int(value)%i==0 for i in range(1,math.isqrt(int(value))+1))
        elif k==43:
            count,size=map(int,match(r'(\d+) farklı kitap.+Bunların (\d+) tanesi',p));result=math.perm(count,size)
        elif k==44:
            price,profit=map(int,match(r'fiyatı (\d+) TL.+%(\d+) kâr',p));result=s.Rational(price*(100+profit),100)
        elif k==45:
            volume,part,whole=map(int,match(r'depoda (\d+) litre.+Bunun (\d+)/(\d+)',p));result=volume*(1-s.Rational(part,whole))
        else:raise Review('unsupported_prompt_family')
    elif fam.startswith('V3-AYT-'):
        k=int(fam.rsplit('-',1)[1]);method='exact_symbolic_recalculation_and_domain_checks'
        if k in (46,47,48):
            expr,=match(r'^(.+?)\s*=\s*0',p);pol=s.Poly(expression(expr),x);A,B,C=pol.all_coeffs()
            result=-B/A if k in (46,47) else C/A
        elif k==49:
            expr,=match(r'^(.+?)\s*=\s*0',p);roots=s.solve(expression(expr),x);result=sum(rt**2 for rt in roots)
        elif k==50:
            expr,=match(r'^(.+?)\s*=\s*0',p);result=one(s.solve(s.discriminant(expression(expr),x),m))
        elif k in (51,52,79):
            expr,=match(r'y=(.+?) parabol',p);pol=s.Poly(expression(expr),x);A,B,C=pol.all_coeffs();vertex=-B/(2*A);result=pol.as_expr().subs(x,vertex) if k==52 else vertex
        elif k==53:
            expr,X,Y=match(r'y=(.+?) parabolü \((-?\d+),(-?\d+)\)',p);result=one(s.solve(s.Eq(expression(expr).subs(x,int(X)),int(Y)),m))
        elif k==54:
            expr,=match(r'y=(.+?) parabol',p);pol=s.Poly(expression(expr),x)
            if s.discriminant(pol.as_expr(),x)<=0:raise Review('not_two_distinct_real_intercepts')
            result=-pol.nth(1)/pol.nth(2)
        elif k==55:
            lo,hi=map(int,match(r'x\^\(m−(\d+)\) \+ x\^\((\d+)−m\)',p));result=sum(1 for val in range(lo,hi+1) if val-lo>=0 and hi-val>=0)
        elif k in (56,57):
            expr,point=match(r'P\(x\)=(.+?) polinomunun x−\((-?\d+)\)',p);result=s.rem(expression(expr),x-int(point),domain=s.QQ)
        elif k==58:
            expr,power=match(r'^(.+?) açılımında x\^(\d+)',p);result=s.Poly(s.expand(expression(expr)),x).coeff_monomial(x**int(power))
        elif k==59:
            expr,power=match(r'^(.+?) açılımında x\^(\d+)',p);result=s.Poly(s.expand(expression(expr)),x).coeff_monomial(x**int(power))
        elif k==60:
            first,second,power=match(r'^\((.+?)−(.+?)\)\^(\d+) açılımında sondan üçüncü',p);power=int(power)
            # Conventional binomial ordering follows descending exponent of the first term.
            coef=math.comb(power,power-2)*expression(first)**2*(-expression(second))**(power-2)
            result=s.Poly(s.expand(coef),x,y).coeffs()[0]
        elif k==61:
            A,B=map(int,match(r'A açısı (\d+)°, B açısı (\d+)°',p));result=180-A-B
            if result<=0:raise Review('invalid_triangle_angles')
        elif k==62:
            theta1,theta2=map(int,match(r'4·sin²\((\d+)°\)·cos²\((\d+)°\)',p))
            if theta1!=theta2:raise Review('different_trigonometric_angles')
            result=s.simplify(4*s.sin(s.pi*theta1/180)**2*s.cos(s.pi*theta2/180)**2)
        elif k==63:
            base_shift,arg_shift=map(int,match(r'log_\(x−\((-?\d+)\)\)\(x−\((-?\d+)\)\)',p));result=one([val for val in range(min(base_shift,arg_shift)-2,max(base_shift,arg_shift)+5) if val>base_shift and val-base_shift!=1 and val>arg_shift][:1])
        elif k==64:
            base,shift,power=map(int,match(r'log_(\d+)\(x−(\d+)\)=(\d+)',p))
            if base<=0 or base==1:raise Review('invalid_log_base')
            result=base**power+shift
        elif k==65:
            base,total=map(int,match(r'(\d+)\^x = (\d+)',p));result=one([val for val in range(-20,100) if s.Integer(base)**val==total])
        elif k==66:
            expr,i,j=match(r'terimi aₙ=(.+?) olan dizide a_(\d+)\+a_(\d+)',p);ex=expression(expr);result=ex.subs(n,int(i))+ex.subs(n,int(j))
        elif k==67:
            first,ratio,count=map(int,match(r'terimi (\d+), ortak çarpanı (\d+) olan geometrik dizinin ilk (\d+)',p));result=sum(first*ratio**i for i in range(count))
        elif k==68:
            N,N1=map(int,match(r'\.\.\.\+1/\((\d+)·(\d+)\)',p))
            if N1!=N+1:raise Review('invalid_telescoping_endpoint')
            result=sum(s.Rational(1,i*(i+1)) for i in range(1,N+1))
        elif k==69:
            point,expr=match(r'lim\(x→(-?\d+)\) \[(.+?)\]',p);result=s.limit(expression(expr),x,int(point))
        elif k==70:
            point,expr=match(r'lim\(x→(-?\d+)\) (.+?) değeri',p);result=s.limit(expression(expr),x,int(point))
        elif k==71:
            expr,point=match(r'f\(x\)=(.+?) fonksiyonunun x=(-?\d+)',p);result=s.diff(expression(expr),x).subs(x,int(point))
        elif k==72:
            expr,=match(r'y=(.+?) eğrisine',p);ex=expression(expr);roots=s.solve(ex-x*s.diff(ex,x),x);real_roots=[rt for rt in roots if rt.is_real];result=one([s.simplify(ex.subs(x,rt)) for rt in real_roots])
        elif k==73:
            expr,point,target=match(r"f\(x\)=(.+?) için f''\((-?\d+)\)=(-?\d+)",p);result=one(s.solve(s.Eq(s.diff(expression(expr),x,2).subs(x,int(point)),int(target)),m))
        elif k==74:
            lo,hi,expr=match(r'∫\[(-?\d+)→(-?\d+)\] \((.+?)\) dx',p);result=s.integrate(expression(expr),(x,int(lo),int(hi)))
        elif k==75:
            expr,initial,point=match(r"f'\(x\)=(.+?) ve f\(0\)=(-?\d+) ise f\((-?\d+)\)",p);result=int(initial)+s.integrate(expression(expr),(x,0,int(point)))
        elif k==76:
            lo,upper,integrand,point=match(r"F\(x\)=∫\[(-?\d+)→(.+?)\] \((.+?)\)du.+F'\((-?\d+)\)",p);ex=s.integrate(expression(integrand),(u,int(lo),expression(upper)));result=s.diff(ex,x).subs(x,int(point))
        elif k==77:
            power=int(match(r'i\^(\d+) karmaşık',p)[0]);result=s.re(s.I**power)
        elif k==78:
            first,step,index=map(int,match(r'terimi (-?\d+), ortak farkı (-?\d+) olan aritmetik dizinin (\d+)\.',p));result=first+(index-1)*step
        elif k==80:
            arg,=match(r'log_x\((.+?)\)=2',p);ex=expression(arg);roots=s.solve(ex-x**2,x);result=one([rt for rt in roots if rt.is_real and rt>0 and rt!=1 and ex.subs(x,rt)>0])
        elif k==81:
            expr,point=match(r"f\(x\)=(.+?) fonksiyonu için f''\((-?\d+)\)",p);result=s.diff(expression(expr),x,2).subs(x,int(point))
        else:raise Review('unsupported_prompt_family')
    else:raise Review('unsupported_prompt_family')
    if not isinstance(result,str):
        result=s.simplify(result)
        if result.free_symbols or result.has(s.oo,-s.oo,s.zoo,s.nan):raise Review('nonfinite_or_symbolic_result')
    return result,method



def rational_eval(text, values=None):
    """A second arithmetic engine using Python Fraction instead of Sympy."""
    values=values or {}
    text=normalize(text).strip()
    text=re.sub(r'(?<=[0-9a-z)])(?=[a-z(])','*',text)
    text=re.sub(r'(?<=[a-z)])(?=\d)','*',text)
    if not re.fullmatch(r'[0-9xyzabmnuh+*/().\s-]+',text):raise Review('unsupported_fraction_expression')
    def run(t):
        if isinstance(t,ast.Expression):return run(t.body)
        if isinstance(t,ast.Constant) and type(t.value) is int:return Fraction(t.value)
        if isinstance(t,ast.Name) and t.id in values:return Fraction(values[t.id])
        if isinstance(t,ast.UnaryOp):
            if isinstance(t.op,ast.USub):return -run(t.operand)
            if isinstance(t.op,ast.UAdd):return run(t.operand)
        if isinstance(t,ast.BinOp):
            A,B=run(t.left),run(t.right)
            if isinstance(t.op,ast.Add):return A+B
            if isinstance(t.op,ast.Sub):return A-B
            if isinstance(t.op,ast.Mult):return A*B
            if isinstance(t.op,ast.Div):return A/B
            if isinstance(t.op,ast.Pow) and B.denominator==1:return A**int(B)
        raise Review('unsupported_fraction_ast')
    out=run(ast.parse(text,mode='eval'));return s.Rational(out.numerator,out.denominator)


def coeff_derivative(expr, point, order=1):
    """Differentiate polynomial coefficients via falling factorial, no diff()."""
    total=0
    for (power,),coefficient in s.Poly(expr,x).terms():
        if power>=order:total+=coefficient*math.prod(range(power-order+1,power+1))*s.Integer(point)**(power-order)
    return s.simplify(total)


def coeff_integral(expr,lo,hi):
    """Power-rule endpoint sum, independent of integrate()."""
    return s.simplify(sum(coefficient*s.Rational(1,power+1)*(s.Integer(hi)**(power+1)-s.Integer(lo)**(power+1)) for (power,),coefficient in s.Poly(expr,x).terms()))


def binomial_parts(text):
    base,power=match(r'^\((.+)\)\^(\d+)$',text)
    return expression(base),int(power)


def alternative_solve(qid,p,options):
    """A distinct algorithm verifies each supported mathematical result."""
    fam=re.sub(r'-\d+$','',qid)
    method='independent_exact_arithmetic_or_domain_construction'
    if fam=='AI-TYT01':return rational_eval(p.split(' işleminin')[0]),'independent_fraction_AST_arithmetic'
    if fam=='AI-TYT02':
        point,expr=match(r'x = (-?\d+) için (.+) çarpımının',p)
        return rational_eval(expr,{'x':int(point)}),'independent_fraction_AST_substitution'
    if fam=='AI-TYT03':
        expr,=match(r'sayılardır\. (.+) ifadesi açıldığında',p);ex=expression(expr)
        return s.diff(ex,a,b).subs({a:0,b:0}),'mixed_partial_extracts_ab_coefficient'
    if fam=='AI-TYT04':
        e1,e2,e3,target=match(r'B = (.+?), B sayısından C = (.+?), C sayından D = (.+?) elde ediliyor\. D = (-?\d+)',p) if 'C sayından' in p else match(r'B = (.+?), B sayısından C = (.+?), C sayısından D = (.+?) elde ediliyor\. D = (-?\d+)',p)
        out=s.Rational(target)
        for expr in (e3,e2,e1):
            ex=expression(expr.replace('A','x').replace('B','x').replace('C','x'));pol=s.Poly(ex,x);out=(out-pol.nth(0))/pol.nth(1)
        return out,'inverse_affine_steps_from_D_back_to_A'
    if fam=='AI-TYT05':
        expr,scale=match(r'olmak üzere, (.+?) ifadesinde x, y ve z değerlerinin her biri (\d+) katına',p);ex=expression(expr);powers=ex.as_powers_dict()
        return s.Integer(scale)**int(sum(powers.get(var,0) for var in (x,y,z))),'homogeneous_total_degree_scaling'
    if fam=='AI-TYT06':
        value,lo,hi=map(int,match(r'(-?\d+) sayısı (-?\d+) ile (-?\d+) arasındaki \(uçlar dahil\)',p));ds=s.divisors(abs(value));return sum(value//d for d in [*ds,*[-j for j in ds]] if lo<=d<=hi),'factorization_enumerates_positive_and_negative_divisors'
    if fam=='AI-TYT07':
        initial,down,up,hd,hu=map(int,match(r'başlangıçta (-?\d+)°C.+saatte (\d+)°C azalıyor.+saatte (\d+)°C artıyor\. (\d+) saat çalışıp (\d+) saat',p));temps=[initial]
        for step in [-down]*hd+[up]*hu:temps.append(temps[-1]+step)
        return temps[-1],'hour_by_hour_temperature_simulation'
    if fam=='AI-TYT08':
        digits,nd=map(int,match(r'Rakamları farklı (\d+) basamaklı en küçük doğal sayı ile (\d+) basamaklı en küçük negatif',p));chosen=[]
        for i in range(digits):chosen.append(next(d for d in range(10) if d not in chosen and (i or d)))
        return int(''.join(map(str,chosen)))+(10**nd-1),'lexicographic_unused_digit_construction'
    if fam=='AI-TYT09':
        left,total,right=match(r'sayılar için (.+?) = (\d+) veriliyor\. Buna göre (.+?) toplamı',p)
        def pol_sum(text):
            return sum(sum((10**i)*(int(c) if c.isdigit() else a if c=='A' else b) for i,c in enumerate(word[::-1])) for word in text.split(' + '))
        difference=s.simplify(pol_sum(right)-pol_sum(left))
        if difference.free_symbols:raise Review('alternative_digit_difference_not_constant')
        return int(total)+difference,'place_value_cancellation_between_two_sums'
    if fam=='AI-TYT10':
        da,db,dc=map(int,match(r'A = K \+ \((-?\d+)\), B = L \+ \((-?\d+)\), C = M \+ \((-?\d+)\)',p));values=[]
        for K,L,M in itertools.product(range(1,10),range(10),range(10)):
            A,B,C=K+da,L+db,M+dc
            if 1<=A<=9 and 0<=B<=9 and 0<=C<=9:values.append((100*A+10*B+C)-(100*K+10*L+M))
        return one(values),'enumerate_every_valid_digit_assignment'
    if fam=='AI-TYT11':
        total,diff=map(int,match(r'A\+B=(\d+) ve B−C=(-?\d+)',p));return sum(100*(total-B)+10*B+(B-diff) for B in range(10) if 1<=total-B<=9 and 0<=B-diff<=9),'eliminate_A_and_C_using_digit_equations'
    if fam=='AI-TYT12':
        end,start,total=map(int,match(r'sağına (\d) yazıldığında A, soluna (\d) yazıldığında B sayısı elde ediliyor\. A\+B=(\d+)',p));val=s.Rational(total-start*1000-end,11)
        if val.is_Integer is not True or not 100<=val<=999:raise Review('alternative_invalid_three_digit_number')
        return sum(map(int,str(val))),'place_value_linear_equation_for_original_number'
    if fam=='AI-TYT13':
        total,digits=map(int,match(r'Rakamları toplamı (\d+) olan (\d+) basamaklı',p));position=match(r'(birler|onlar|yüzler|binler|on binler|yüz binler) basamağındaki',p)[0];power={'birler':0,'onlar':1,'yüzler':2,'binler':3,'on binler':4,'yüz binler':5}[position]
        @lru_cache(None)
        def extrema(remaining,digit_sum,leading):
            if not remaining:return (0,0) if digit_sum==0 else None
            candidates=[]
            for digit in range(1 if leading else 0,10):
                sub=extrema(remaining-1,digit_sum-digit,False) if digit_sum>=digit else None
                if sub:candidates.extend([digit*10**(remaining-1)+sub[0],digit*10**(remaining-1)+sub[1]])
            return (min(candidates),max(candidates)) if candidates else None
        low,high=extrema(digits,total,True);return (low//10**power)%10+(high//10**power)%10,'dynamic_programming_minimum_and_maximum_digit_sum_numbers'
    if fam=='AI-TYT14':
        sums={111*sum(t) for t in itertools.combinations(range(1,10),3)};return one([expression(o['text']) for o in options if expression(o['text']) not in sums]),'cyclic_place_value_sum_111_times_digit_sum'
    if fam in ('AI-TYT15','AI-TYT22'):
        total=int(match(r'A\+B\s*=\s*(\d+)',p)[0]) if fam=='AI-TYT22' else s.Rational(int(match(r'AB\+BA=(\d+)',p)[0]),11);diff=s.Rational(int(match(r'AB\s*−\s*BA\s*=\s*(-?\d+)',p)[0]),9);A=(total+diff)/2;B=(total-diff)/2
        return 10*A+B,'linear_system_digit_sum_and_digit_difference'
    if fam=='AI-TYT16':
        rows=int(match(r'tablosu (\d+) farklı satır',p)[0]);return rows.bit_length()-1,'binary_logarithm_of_truth_table_row_count'
    if fam=='AI-TYT17':
        rows,offset=map(int,match(r'tablosunda (\d+) satır vardır\. \(n−(\d+)\)',p));return s.Rational(rows,2**offset),'truth_table_rows_divided_by_removed_binary_choices'
    if fam=='AI-TYT18':
        colors,total=match(r'kareler (.+?) renkleriyle sırayla.+toplamı (\d+) cm',p);colors=colors.split(', ');side=(math.isqrt(1+2*int(total))-1)//2
        return f'{colors[(side-1)%len(colors)]}, {side} cm','quadratic_inverse_and_modular_color_index'
    if fam=='AI-TYT19':
        parity,expr=match(r'x·y (tek|çift) olduğu biliniyor\. (.+?) ifadesinin',p);Y=1 if parity=='tek' else 0;result=int(expression(expr).subs({x:Y,y:Y,z:1-Y}))%2
        return 'kesinlikle tek' if result else 'kesinlikle çift','parity_constraints_eliminate_x_y_z'
    if fam=='AI-TYT20':
        expr,=match(r'olmak üzere, (.+?) ifadesi',p);terms=re.findall(r'([+-]?\d+)[xyz]/\([xyz]\+[xyz]\)',expr.replace(' ',''))
        if len(terms)!=3:raise Review('alternative_unrecognized_rational_terms')
        return -sum(map(int,terms)),'each_denominator_is_negative_of_remaining_variable'
    if fam=='AI-TYT21':
        prod=int(match(r'çarpımı (\d+)',p)[0])
        @lru_cache(None)
        def can_make(target,slots,excluded):
            if not slots:return target==1
            return any(target%d==0 and can_make(target//d,slots-1,excluded) for d in range(1,10) if d!=excluded)
        return one([expression(o['text']) for o in options if not can_make(prod,5,int(expression(o['text'])))]),'divisor_dynamic_programming_excluding_each_candidate_digit'
    if fam.startswith('AI-AYT'):
        k=int(fam[6:]);method='independent_closed_form_or_coefficient_method'
        if k==1:
            ex,=match(r'^(.+?) açılımında',p);base,power=binomial_parts(ex);terms=s.Add.make_args(base)
            if len(terms)!=2 or any(t==0 for t in terms):raise Review('alternative_nonbinomial')
            return int(power)+1,'distinct_binomial_exponent_pairs'
        if k==2:
            ex,=match(r'^(.+?) açılımındaki',p);base,power=binomial_parts(ex);return sum(term.subs({x:1,y:1}) for term in s.Add.make_args(base))**power,'binomial_theorem_sum_of_coefficients_at_one'
        if k==3:
            ex,mono=match(r'^(.+?) açılımında (.+?) teriminin',p);base,power=binomial_parts(ex);A=s.expand(base).coeff(x);B=s.expand(base).coeff(y);py=expression(mono).as_powers_dict()[y]
            return math.comb(int(power),int(py))*A**(power-py)*B**py,'binomial_selection_formula'
        if k==4:
            ex,=match(r'^(.+?) ifadesinin',p);base,power=binomial_parts(ex);return base.subs({x:0,y:0})**power,'constant_term_requires_selecting_only_constant_factor'
        if k==5:
            power=int(match(r'\(x\+y\)\^(\d+)',p)[0]);return math.comb(power,power//2),'central_binomial_coefficient_factorial_ratio'
        if k==6:
            row,pos=map(int,match(r'sayıldığında (\d+)\. satırdaki soldan (\d+)\.',p));values=[1]
            for _ in range(row-1):values=[1]+[values[i]+values[i+1] for i in range(len(values)-1)]+[1]
            return values[pos-1],'Pascal_neighbor_sum_recurrence'
        if k==7:
            ex,=match(r'^(.+?) açılımındaki',p);base,power=binomial_parts(ex);constant=base.subs(x,0);return (1+abs(constant))**power,'absolute_binomial_coefficient_sum_theorem'
        if k==8:
            base,power=map(int,match(r'P\(x\)=\(x−(\d+)\)\^(\d+)',p));return s.Rational(math.comb(power,1)*(-base)**(power-1),math.comb(power,3)*(-base)**(power-3)),'explicit_binomial_coefficient_ratio'
        if k==9:
            ex,point=match(r'f\(x\)=(.+?)\. lim\[h→0\] \(f\((-?\d+)\+h\)',p);return coeff_derivative(expression(ex),int(point)),'polynomial_power_rule_instead_of_limit'
        if k==10:
            ex,point,target=match(r'f\(x\)=(.+?) ve f’\((-?\d+)\)=(-?\d+)',p);result=coeff_derivative(expression(ex),int(point));return one(s.solve(s.Eq(result,int(target)),a)),'expanded_coefficient_derivative_and_linear_equation'
        if k==11:
            ex,point,target=match(r'f\(x\)=(.+?) için f’’\((-?\d+)\)=(-?\d+)',p);return one(s.solve(s.Eq(coeff_derivative(expression(ex),int(point),2),int(target)),a)),'falling_factorial_second_derivative_coefficients'
        if k==12:
            ex,point=match(r'f\(x\)=(.+?) ise f’\((-?\d+)\)',p);return coeff_derivative(expression(ex),int(point)),'falling_factorial_first_derivative_coefficients'
        if k==13:
            ex,initial,point=match(r'f’\(x\)=(.+?) ve f\(0\)=(-?\d+)\. f\((-?\d+)\)',p);return int(initial)+coeff_integral(expression(ex),0,int(point)),'coefficient_power_rule_plus_initial_value'
        if k==14:
            lo,hi,ex=match(r'∫\[(-?\d+)→(-?\d+)\] \((.+)\) dx',p);return coeff_integral(expression(ex),int(lo),int(hi)),'polynomial_power_rule_endpoint_sum'
        if k==15:
            point,ex=match(r'lim\[x→(-?\d+)\] (.+?) limitinin',p);return rational_eval(ex,{'x':int(point)}),'exact_fraction_substitution_at_continuity_point'
        if k==16:
            angle=int(match(r'^(-?\d+)°',p)[0]);return angle-360*math.floor(angle/360),'subtract_integer_full_turns'
        if k==17:
            factor=int(match(r'x=(\d+)y',p)[0]);roots=s.solve([x*x+y*y-1,x-factor*y],(x,y));return one([X for X,Y in roots if X<0 and Y<0]),'solve_unit_circle_and_line_with_third_quadrant_filter'
    if fam.startswith('V3-TYT-'):
        k=int(fam.rsplit('-',1)[1])
        if k==1:
            i,j=map(int,match(r'Baştan (\d+)\. çift sayı, baştan (\d+)\. tek',p));return list(range(2,2*i+1,2))[-1]-list(range(1,2*j,2))[-1],'explicit_even_and_odd_sequences'
        if k==2:
            N=int(match(r"1'den (\d+)'ye",p)[0]);return sum(max(0,min(N,10**length-1)-10**(length-1)+1)*length for length in range(1,len(str(N))+1)),'decimal_digit_blocks_counted_by_length'
        if k==3:
            total=int(match(r'toplam (\d+) rakam',p)[0]);used=0;N=0
            while used<total:N+=1;used+=len(str(N))
            if used!=total:raise Review('alternative_invalid_numbering_total')
            return N,'page_number_digit_count_simulation'
        if k==4:
            A,B,C=map(int,match(r'(\d+)x \+ (\d+)y = (\d+)',p));return sum(A*X+B*Y==C for X in range(C//A+1) for Y in range(C//B+1)),'two_dimensional_nonnegative_lattice_enumeration'
        if k==5:
            total=int(match(r'toplamı (\d+)',p)[0]);E,C,F=s.symbols('E C F');return s.solve([E-C-F,E+C+F-total],(E,C))[E],'symbolic_subtraction_and_total_system'
        if k==6:
            mid,count=map(int,match(r'terimi (\d+) olan (\d+) ardışık çift',p));return sum(mid+2*i for i in range(-(count//2),count//2+1)),'construct_and_sum_consecutive_even_sequence'
        if k==7:
            diff=int(match(r'farkı (\d+)',p)[0]);return one([large for large in range(3,diff+3,2) if large*large-(large-2)**2==diff]),'enumerate_consecutive_odd_square_differences'
        if k==8:
            first,step,count=map(int,match(r'terimi (\d+), ortak farkı (\d+) olan aritmetik dizinin ilk (\d+)',p));return s.Rational(count*(2*first+(count-1)*step),2),'arithmetic_sum_first_last_pairing_formula'
        if k==9:
            N=int(match(r'dizilen (\d+) kare',p)[0]);edges=set()
            for cell in range(N):edges.update([('h',cell,0),('h',cell,1),('v',cell,0),('v',cell+1,0)])
            return len(edges),'geometric_grid_edge_set_union'
        if k==10:
            mod,rem,A,B,mod2=map(int,match(r'N sayısının (\d+) ile bölümünden kalan (\d+).+ (\d+)N \+ (\d+) sayısının (\d+) ile',p));return one([(A*(mod*t+rem)+B)%mod2 for t in range(10)]),'substitute_ten_distinct_members_of_residue_class'
        if k==11:
            A,B,C=map(int,match(r'^(\d+), (\d+) ve (\d+) sayıları',p));return max(d for d in range(1,max(A,B,C)+1) if A%d==B%d==C%d),'enumerate_all_divisors_producing_equal_remainders'
        if k==12:
            A,B,C=map(int,match(r'sırasıyla (\d+), (\d+) ve (\d+) saniyede',p));return next(i for i in range(max(A,B,C),A*B*C+1,max(A,B,C)) if i%A==i%B==i%C==0),'scan_candidate_common_flash_times'
        if k==13:
            lo,hi=map(int,match(r'(-?\d+) < x < (-?\d+)',p));return max(0,hi-lo-1),'open_integer_interval_endpoint_formula'
        if k==14:
            center,radius=map(int,match(r'\|x − \((-?\d+)\)\| = (\d+)',p));return sum(s.solve(s.Abs(x-center)-radius,x)),'solve_absolute_value_equation_symbolically'
        if k==15:
            base,left,right=map(int,match(r'(\d+)\^(\d+) × \d+\^x = \d+\^(\d+)',p));return one([val for val in range(-30,31) if s.Integer(base)**left*s.Integer(base)**val==s.Integer(base)**right]),'exact_exponent_equality_integer_search'
        if k==16:
            A,B=map(int,match(r'√(\d+) \+ √(\d+)',p));ra,rb=math.isqrt(A),math.isqrt(B)
            if ra*ra!=A or rb*rb!=B:raise Review('alternative_non_square_radical')
            return ra+rb,'integer_square_root_checks'
        if k==17:
            A,B,rooms,beds=map(int,match(r'odalar (\d+) veya (\d+) kişiliktir\. Toplam (\d+) odada (\d+) kişilik',p));return s.Rational(beds-A*rooms,B-A),'baseline_beds_and_extra_capacity_equation'
        if k==18:
            count,wins,draws,wp,dp=map(int,match(r'(\d+) maçta (\d+) galibiyet ve (\d+) beraberlik.+Galibiyet (\d+), beraberlik (\d+) puan',p));return sum([wp]*wins+[dp]*draws+[0]*(count-wins-draws)),'construct_every_match_point_award'
        if k==19:
            count,cap=map(int,match(r'manav (\d+) portakalı (\d+)',p));packages=0
            while count>=cap:count-=cap;packages+=1
            return packages,'repeated_package_capacity_subtraction'
        if k==20:
            avg,ages=match(r'ortalaması (\d+)\. Dört kişinin yaşları (.+?)\. Beşinci',p);return one(s.solve(s.Eq((sum(ints(ages))+x)/5,int(avg)),x)),'symbolic_mean_equation_for_missing_age'
        if k==21:
            ratio,age,years=map(int,match(r'yaşının (\d+) katıdır\. Çocuk bugün (\d+) yaşında olduğuna göre, (\d+) yıl',p));return (age+years)+(ratio-1)*age,'constant_father_child_age_gap'
        if k==22:
            distance,v1,v2=map(int,match(r'Aralarında (\d+) km.+sırasıyla (\d+) ve (\d+) km/sa',p));return one(s.solve(s.Eq(v1*x,distance-v2*x),x)),'equate_two_position_functions'
        if k==23:
            t1,t2=map(int,match(r'sırasıyla (\d+) ve (\d+) günde',p));return one(s.solve(s.Eq(x/t1+x/t2,1),x)),'sum_fractional_work_and_solve_linear_equation'
        if k==24:
            price,inc,dec=map(int,match(r'fiyatı (\d+) TL.+önce %(\d+) zam.+üzerinden %(\d+) indirim',p));after=Fraction(price)+Fraction(price*inc,100);return s.Rational((after-after*Fraction(dec,100))),'separate_Fraction_price_increase_and_discount_amounts'
        if k==25:
            l1,p1,l2,p2=map(int,match(r'(\d+) litre %(\d+) tuz.+ile (\d+) litre %(\d+) tuz',p));return one(s.solve(s.Eq((l1+l2)*x/100,s.Rational(l1*p1+l2*p2,100)),x)),'salt_amount_conservation_equation'
        if k==26:
            A,B,both=map(int,match(r'A etkinliğine (\d+), B etkinliğine (\d+).+katılan (\d+) öğrenci',p));return (A-both)+(B-both)+both,'disjoint_Venn_regions_sum'
        if k==27:
            ex,point=match(r'f\(x\)=(.+?) fonksiyonu için f\((-?\d+)\)',p);return rational_eval(ex,{'x':int(point)}),'independent_fraction_function_substitution'
        if k==28:
            red,blue=map(int,match(r'(\d+) kırmızı ve (\d+) mavi',p));return s.Rational(math.comb(red,2),math.comb(red+blue,2)),'unordered_pair_combination_probability'
        if k==29:
            count,size=map(int,match(r'(\d+) öğrenciden (\d+) kişilik',p));return len(list(itertools.combinations(range(count),size))),'enumerate_all_unordered_committees'
        if k==30:
            count,avg,new=map(int,match(r'(\d+) sayının aritmetik ortalaması (\d+).+gruba (\d+) sayısı',p));return avg+s.Rational(new-avg,count+1),'mean_shift_from_new_observation'
        if k==31:
            A,B=map(int,match(r'(\d+)x=(\d+)y',p));return next(X+Y for X,Y in itertools.product(range(1,max(A,B)+1),repeat=2) if A*X==B*Y),'search_positive_integer_ratio_solutions'
        if k==32:
            N,index=map(int,match(r'1,2,3,\.\.\.,(\d+) sayıları.+Soldan (\d+)\.',p));candidate=1
            while index>len(str(candidate)):index-=len(str(candidate));candidate+=1
            return int(str(candidate)[index-1]),'subtract_number_digit_blocks_to_target_position'
        if k==33:
            top,count=map(int,match(r'1,2,\.\.\.,(\d+) tam sayı.+oyunda (\d+) atış',p));totals={0}
            for _ in range(count):totals={old+value for old in totals for value in range(1,top+1)}
            return len(totals),'reachable_total_scores_dynamic_programming'
        if k==34:
            lo,hi=map(int,match(r'(\d+) ≤ x ≤ (\d+)',p));return (hi+1)//2-lo//2,'odd_prefix_count_difference'
        if k==35:
            girls,boys,left,initial,brothers=map(int,match(r'birine (\d+), erkek kardeşlerinin her birine (\d+).+ve (\d+) bilyesi kalıyor\. Başta (\d+) bilyesi olduğu ve erkek kardeş sayısı (\d+)',p));return one([g for g in range(initial//girls+1) if g*girls+brothers*boys+left==initial]),'enumerate_nonnegative_sister_count_by_total_marbles'
        if k==36:
            N=int(match(r'F\((\d+)\) toplamı',p)[0]);pairs=N//2;return pairs*(pairs+1)+(pairs+1 if N%2 else 0),'paired_ceiling_values_closed_sum'
        if k==37:
            values=ints(match(r'deniyor\. (.+?) sayılarından',p)[0]);triangles={k*(k+1)//2 for k in range(math.isqrt(2*max(values))+2)};return sum(value in triangles and value in {k*k for k in range(math.isqrt(max(values))+1)} for value in values),'construct_square_and_triangular_number_sets'
        if k==38:raise Review('ambiguous_range_endpoints_1_ile_N_arasinda')
        if k==39:
            red_count,blue_count,green_count,target=map(int,match(r'(\d+) kırmızı, (\d+) mavi ve (\d+) yeşil.+en az (\d+) bilyenin',p));largest=max(R+B+G for R in range(min(red_count,target-1)+1) for B in range(min(blue_count,target-1)+1) for G in range(min(green_count,target-1)+1));return largest+1,'enumerate_every_draw_without_target_color_count'
        if k==40:
            N=int(match(r'(\d+)!',p)[0]);value=math.factorial(N);zeros=0
            while value%10==0:value//=10;zeros+=1
            return zeros,'direct_factorial_trailing_decimal_zero_division'
        if k==41:
            A,B,mod=map(int,match(r'(\d+) ve (\d+) sayılarının toplamının (\d+)',p));return (A%mod+B%mod)%mod,'reduce_each_addend_before_modular_addition'
        if k==42:
            ex,point=match(r'^(.+?) sayısı, m=(\d+)',p);val=int(rational_eval(ex,{'m':int(point)}));divisor_count=math.prod(power+1 for power in s.factorint(val).values());return (divisor_count+1)//2,'prime_factorization_divisor_pair_count'
        if k==43:
            count,size=map(int,match(r'(\d+) farklı kitap.+Bunların (\d+) tanesi',p));return len(list(itertools.permutations(range(count),size))),'enumerate_all_ordered_book_selections'
        if k==44:
            price,profit=map(int,match(r'fiyatı (\d+) TL.+%(\d+) kâr',p));return price+s.Rational(price*profit,100),'purchase_price_plus_separate_profit_amount'
        if k==45:
            volume,part,whole=map(int,match(r'depoda (\d+) litre.+Bunun (\d+)/(\d+)',p));return s.Rational(volume,whole)*(whole-part),'equal_fractional_portions_remaining'
    if fam.startswith('V3-AYT-'):
        k=int(fam.rsplit('-',1)[1])
        if k in (46,47,48,49,50):
            ex,=match(r'^(.+?)\s*=\s*0',p);ex=expression(ex)
            if k==50:
                A=s.Poly(ex,x).nth(2);B=s.Poly(ex,x).nth(1);critical=-B/(2*A);return one(s.solve(s.Eq(ex.subs(x,critical),0),m)),'double_root_is_zero_at_parabola_vertex'
            roots=s.solve(ex,x)
            if k in (46,47):return sum(roots),'quadratic_formula_roots_summed'
            if k==48:return math.prod(roots),'quadratic_formula_roots_multiplied'
            # Secondary uses Vieta instead of explicit root square sum.
            pol=s.Poly(ex,x);return (pol.nth(1)/pol.nth(2))**2-2*pol.nth(0)/pol.nth(2),'Vieta_square_sum_identity'
        if k in (51,52,79):
            ex,=match(r'y=(.+?) parabol',p);ex=expression(ex);stationary=one(s.solve(s.diff(ex,x),x));return ex.subs(x,stationary) if k==52 else stationary,'solve_zero_slope_at_parabola_vertex'
        if k==53:
            ex,X,Y=match(r'y=(.+?) parabolü \((-?\d+),(-?\d+)\)',p);ex=expression(ex);point=int(X);base=ex.subs({x:point,m:0});slope=s.diff(ex,m).subs(x,point);return (int(Y)-base)/slope,'isolate_parameter_from_point_residual'
        if k==54:
            ex,=match(r'y=(.+?) parabol',p);return sum(s.solve(expression(ex),x)),'explicit_x_intercepts_summed'
        if k==55:
            lo,hi=map(int,match(r'x\^\(m−(\d+)\) \+ x\^\((\d+)−m\)',p));return max(0,hi-lo+1),'integer_interval_from_nonnegative_exponent_inequalities'
        if k in (56,57):
            ex,point=match(r'P\(x\)=(.+?) polinomunun x−\((-?\d+)\)',p);return rational_eval(ex,{'x':int(point)}),'remainder_theorem_Fraction_evaluation'
        if k==58:
            ex,power=match(r'^(.+?) açılımında x\^(\d+)',p);base,N=binomial_parts(ex);A=s.Poly(base,x).nth(1);B=base.subs(x,0);K=int(power);return math.comb(int(N),K)*A**K*B**(N-K),'binomial_coefficient_formula_for_selected_x_power'
        if k==59:
            ex,power=match(r'^(.+?) açılımında x\^(\d+)',p);base,N=binomial_parts(ex);A=s.Poly(base,x).nth(2);B=s.Poly(base,x).nth(1);N=int(N);target=int(power);K=2*N-target;return math.comb(N,K)*A**(N-K)*B**K,'solve_binomial_exponent_equation_before_coefficient'
        if k==60:
            ex,=match(r'^(.+?) açılımında',p);poly=s.Poly(s.expand(expression(ex)),x,y);terms=sorted(poly.terms(),key=lambda term:term[0][0],reverse=True);return terms[-3][1],'symbolic_expansion_ordered_by_first_term_power'
        if k==61:
            A,B=map(int,match(r'A açısı (\d+)°, B açısı (\d+)°',p));return one(s.solve(s.Eq(A+B+x,180),x)),'triangle_angle_sum_linear_equation'
        if k==62:
            theta1,theta2=map(int,match(r'4·sin²\((\d+)°\)·cos²\((\d+)°\)',p));return s.simplify(s.sin(s.pi*(2*theta1)/180)**2),'double_angle_sine_identity'
        if k==63:
            base,arg=map(int,match(r'log_\(x−\((-?\d+)\)\)\(x−\((-?\d+)\)\)',p));candidate=max(base,arg)+1
            while candidate-base==1:candidate+=1
            return candidate,'intersect_logarithm_domain_inequalities_and_remove_unit_base'
        if k==64:
            base,shift,power=map(int,match(r'log_(\d+)\(x−(\d+)\)=(\d+)',p));return one([expression(o['text']) for o in options if expression(o['text'])-shift>0 and s.log(expression(o['text'])-shift,base)==power]),'test_logarithmic_equation_for_each_option'
        if k==65:
            base,total=map(int,match(r'(\d+)\^x = (\d+)',p));return s.simplify(s.log(total)/s.log(base)),'logarithmic_inverse_of_exponential_equation'
        if k==66:
            ex,I,J=match(r'terimi aₙ=(.+?) olan dizide a_(\d+)\+a_(\d+)',p);return rational_eval(ex,{'n':int(I)})+rational_eval(ex,{'n':int(J)}),'independent_Fraction_sequence_term_evaluation'
        if k==67:
            first,ratio,count=map(int,match(r'terimi (\d+), ortak çarpanı (\d+) olan geometrik dizinin ilk (\d+)',p));return s.Rational(first*(ratio**count-1),ratio-1) if ratio!=1 else first*count,'geometric_series_closed_form'
        if k==68:
            N,N1=map(int,match(r'\.\.\.\+1/\((\d+)·(\d+)\)',p));return 1-s.Rational(1,N1),'telescoping_partial_fraction_cancellation'
        if k==69:
            point,ex=match(r'lim\(x→(-?\d+)\) \[(.+?)\]',p);return rational_eval(ex,{'x':int(point)}),'polynomial_continuity_Fraction_substitution'
        if k==70:
            point,ex=match(r'lim\(x→(-?\d+)\) (.+?) değeri',p);num,den=s.fraction(expression(ex));factor=s.cancel(num/den);return factor.subs(x,int(point)),'factor_cancel_removable_singularity_then_substitute'
        if k==71:
            ex,point=match(r'f\(x\)=(.+?) fonksiyonunun x=(-?\d+)',p);return coeff_derivative(expression(ex),int(point)),'coefficient_power_rule_tangent_slope'
        if k==72:
            ex,=match(r'y=(.+?) eğrisine',p);ex=expression(ex);C=ex.subs(x,0)
            # y=x^3+C, origin tangent requires 3x^3=x^3+C -> y=3C/2.
            if s.simplify(ex-(x**3+C))!=0:raise Review('alternative_unrecognized_cubic_tangent')
            return s.Rational(3,2)*C,'eliminate_tangent_point_using_origin_intercept_condition'
        if k==73:
            ex,point,target=match(r"f\(x\)=(.+?) için f''\((-?\d+)\)=(-?\d+)",p);return one(s.solve(s.Eq(coeff_derivative(expression(ex),int(point),2),int(target)),m)),'coefficient_second_derivative_parameter_equation'
        if k==74:
            lo,hi,ex=match(r'∫\[(-?\d+)→(-?\d+)\] \((.+?)\) dx',p);return coeff_integral(expression(ex),int(lo),int(hi)),'polynomial_power_rule_endpoint_difference'
        if k==75:
            ex,initial,point=match(r"f'\(x\)=(.+?) ve f\(0\)=(-?\d+) ise f\((-?\d+)\)",p);return int(initial)+coeff_integral(expression(ex),0,int(point)),'coefficient_antiderivative_plus_initial_value'
        if k==76:
            lo,upper,integrand,point=match(r"F\(x\)=∫\[(-?\d+)→(.+?)\] \((.+?)\)du.+F'\((-?\d+)\)",p);upper=expression(upper);point=int(point);return expression(integrand).subs(u,upper).subs(x,point)*coeff_derivative(upper,point),'fundamental_theorem_of_calculus_and_chain_rule'
        if k==77:
            power=int(match(r'i\^(\d+) karmaşık',p)[0]);return [1,0,-1,0][power%4],'four_cycle_of_imaginary_unit_powers'
        if k==78:
            first,step,index=map(int,match(r'terimi (-?\d+), ortak farkı (-?\d+) olan aritmetik dizinin (\d+)\.',p));values=[first]
            for _ in range(index-1):values.append(values[-1]+step)
            return values[-1],'arithmetic_sequence_recurrence_simulation'
        if k==80:
            arg,=match(r'log_x\((.+?)\)=2',p);ex=expression(arg);return one([expression(o['text']) for o in options if expression(o['text'])>0 and expression(o['text'])!=1 and ex.subs(x,expression(o['text']))>0 and ex.subs(x,expression(o['text']))==expression(o['text'])**2]),'option_domain_filter_and_logarithm_exponentiation_check'
        if k==81:
            ex,point=match(r"f\(x\)=(.+?) fonksiyonu için f''\((-?\d+)\)",p);return coeff_derivative(expression(ex),int(point),2),'falling_factorial_second_derivative_coefficients'
    raise Review('no_independent_second_method_available')


def difficulty_for(q):
    """Transparent curricular/step-count suggestion, never an empirical rating."""
    fam=re.sub(r'-\d+$','',q['id'])
    medium={'AI-TYT03','AI-TYT04','AI-TYT05','AI-TYT06','AI-TYT08','AI-TYT09','AI-TYT10','AI-TYT11','AI-TYT12','AI-TYT13','AI-TYT14','AI-TYT18','AI-TYT19','AI-TYT20','AI-TYT21','AI-AYT03','AI-AYT07','AI-AYT08','AI-AYT10','AI-AYT11','AI-AYT13','AI-AYT14','AI-AYT17'}
    if fam.startswith('V3-TYT-') and int(fam.rsplit('-',1)[1]) in {4,7,11,17,23,24,25,28,31,32,35,36,37,38,39,40,42}:medium.add(fam)
    if fam.startswith('V3-AYT-') and int(fam.rsplit('-',1)[1]) in {49,50,53,55,59,60,63,70,72,73,74,75,76,80}:medium.add(fam)
    if fam in medium:return 'medium','Birden çok bağıntıyı kurma, koşul eleme veya birkaç matematiksel adımı birleştirme gerekiyor; bu bir müfredat önerisidir, öğrenci verisiyle ölçülmüş zorluk değildir.'
    return 'easy','Bilinen tek bir tanım, temel işlem veya doğrudan formül uygulanıyor; bu bir müfredat önerisidir, öğrenci verisiyle ölçülmüş zorluk değildir.'


def equal_value(a,b):
    if isinstance(a,s.Basic) and isinstance(b,(s.Basic,int)):
        return s.simplify(a-b)==0
    if isinstance(a,str):
        if a.strip()==str(b).strip():return True
        try:return s.simplify(expression(a)-expression(str(b)))==0
        except Exception:return False
    try:return s.simplify(a-expression(str(b)))==0
    except Exception:return False


def skeleton(prompt):
    # Preserve words/operators/exponents: this flags numeric stem clones rather
    # than equating logically different exercises or silently deleting records.
    text=normalize(prompt).casefold()
    text=re.sub(r'\d+(?:\.\d+)?','#',text)
    text=re.sub(r'\s+',' ',text).strip()
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def audit(records):
    groups=Counter(skeleton(q['prompt']) for q in records)
    out=[]
    for q in records:
        skel=skeleton(q['prompt'])
        report={'id':q['id'],'status':'review','mathPassed':False,'computedValue':None,'verifiedAnswerLetter':None,'methods':[],'reasons':[],'nearDuplicateGroup':f'stem-{skel}' if groups[skel]>1 else None,'difficultySuggestion':None,'difficultyReason':None}
        report['difficultySuggestion'],report['difficultyReason']=difficulty_for(q)
        try:
            result,method=solve_prompt(q['id'],q['prompt'],q['options'])
            report['computedValue']=str(result)
            alternate,alternate_method=alternative_solve(q['id'],q['prompt'],q['options'])
            if not equal_value(result,alternate):
                report['reasons'].append('independent_mathematical_methods_disagree')
            report['methods']=[method,alternate_method,'exact_answer_option_equivalence_check','archive_key_comparison_after_independent_solution']
            options=q['options']
            if len(options)!=5 or {o['id'] for o in options}!=set('ABCDE'):report['reasons'].append('invalid_five_option_structure')
            matches=[o['id'] for o in options if equal_value(result,o['text'])]
            if len(matches)!=1:report['reasons'].append('no_unique_correct_option')
            else:
                report['verifiedAnswerLetter']=matches[0]
                if matches[0]!=q['answer']['value']:report['reasons'].append('archive_answer_letter_mismatch')
            if not equal_value(result,q['answer']['computedValue']):report['reasons'].append('archive_computed_value_mismatch')
            # Equivalent distractors can mislead even when they are both wrong.
            for i,j in itertools.combinations(range(len(options)),2):
                if equal_value(options[i]['text'],options[j]['text']):
                    report['reasons'].append('semantically_duplicate_options');break
            report['mathPassed']=not report['reasons']
            if 'exam_boundary_review' in q.get('reviewFlags',[]):report['reasons'].append('exam_boundary_review')
            if q['id'].startswith('V3-AYT-061-'):report['reasons'].append('AYT_topic_classification_review_triangle_angle_sum')
            report['status']='verified' if not report['reasons'] else 'review'
        except Review as err:report['reasons'].append(str(err))
        except Exception as err:report['reasons'].append(f'verifier_error:{type(err).__name__}:{err}')
        # Editorial flags are preserved even if prompt parsing/math later fails.
        if 'exam_boundary_review' in q.get('reviewFlags',[]) and 'exam_boundary_review' not in report['reasons']:
            report['reasons'].append('exam_boundary_review')
        out.append(report)
    return {'schemaVersion':1,'verifier':'prompt-independent-exact-math-v2','sympyVersion':s.__version__,'recordCount':len(records),'summary':{'mathPassed':sum(r['mathPassed'] for r in out),'verified':sum(r['status']=='verified' for r in out),'review':sum(r['status']=='review' for r in out),'nearDuplicateStemGroups':sum(k>1 for k in groups.values()),'nearDuplicateStemRecords':sum(v for v in groups.values() if v>1),'reasonCounts':dict(Counter(reason for r in out for reason in r['reasons']))},'records':out}



def self_check(records):
    """Mutation checks prove we do not merely bless the supplied answer key."""
    base=next(q for q in records if q['id']=='AI-TYT01-01')
    def check(q):return audit([q])['records'][0]
    clean=check(base)
    assert clean['mathPassed'] and clean['status']=='verified'
    bad=copy.deepcopy(base);bad['answer']['value']='A'
    assert 'archive_answer_letter_mismatch' in check(bad)['reasons']
    bad=copy.deepcopy(base);bad['answer']['computedValue']='-999'
    assert 'archive_computed_value_mismatch' in check(bad)['reasons']
    bad=copy.deepcopy(base);bad['prompt']=bad['prompt'].replace('-70','-140')
    assert not check(bad)['mathPassed'], 'Prompt change must invalidate stale key'
    bad=copy.deepcopy(base);bad['options'][0]['text']='-128/2'
    assert 'no_unique_correct_option' in check(bad)['reasons']
    assert 'semantically_duplicate_options' in check(bad)['reasons']
    bad=copy.deepcopy(base);bad['prompt']='Bu yeni soru desteklenmiyor.'
    assert not check(bad)['mathPassed'] and check(bad)['status']=='review'
    bad=copy.deepcopy(base);bad['reviewFlags']=['exam_boundary_review']
    marked=check(bad);assert marked['mathPassed'] and marked['status']=='review'
    ambiguous=next(q for q in records if q['id']=='V3-TYT-038-01')
    assert not check(ambiguous)['mathPassed'] and 'ambiguous_range_endpoints_1_ile_N_arasinda' in check(ambiguous)['reasons']
    assert expression('-7/√50')==expression('−7/√50')
    try:expression("__import__('os').system('true')")
    except Exception:pass
    else:raise AssertionError('Unsafe expression unexpectedly accepted')
    return 10

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',default='work/archive-input/ai_questions_review_queue.json')
    parser.add_argument('--output',default='work/import-audit.json')
    parser.add_argument('--self-test',action='store_true',help='Run mutation and safe-parser checks before writing the audit')
    args=parser.parse_args()
    input_bytes=Path(args.input).read_bytes()
    data=json.loads(input_bytes)
    if not isinstance(data,list):raise SystemExit('Expected an array of archive records')
    if args.self_test:print(f'Self-checks passed: {self_check(data)}')
    result=audit(data)
    # Bind this independent result to the exact bytes that were inspected and
    # the verifier implementation. Matching IDs alone cannot approve an edited
    # question or key under an old audit.
    result['inputSha256']=hashlib.sha256(input_bytes).hexdigest()
    result['validatorSha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result['summary'],ensure_ascii=False,indent=2))

if __name__=='__main__':main()
