#!/usr/bin/env python3
"""Independent exact-result audit for locally authored AI questions.

This verifier does not execute generator modules or accept their claimed values.
Only a small AST allowlist is interpreted. Mathematical checking is separate from
an editorial review of Turkish wording, difficulty and pedagogy. Unsupported or
ambiguous specifications remain pending. No PDF or original publisher source is
claimed to have been inspected by this audit.
"""
from __future__ import annotations
import argparse
import copy
import signal
import ast
from collections import Counter, defaultdict
from fractions import Fraction
from itertools import combinations, permutations, product
import hashlib
import json
import math
from pathlib import Path
import re
import unicodedata
import sympy as S

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'independent-generated-math-v1'
class Pending(ValueError): pass

FUNCTIONS = {name: getattr(S, name) for name in (
    'Rational', 'Integer', 'sqrt', 'log', 'exp', 'sin', 'cos', 'tan', 'cot',
    'Abs', 'factorial', 'binomial', 'Min', 'Max', 'conjugate', 're', 'im',
    'floor', 'ceiling', 'sign', 'Derivative', 'Subs', 'Integral', 'Sum', 'Product', 'Piecewise', 'Eq', 'Ne', 'And', 'Or', 'Mod')}
FUNCTIONS.update({'abs': S.Abs, 'min': S.Min, 'max': S.Max, 'gcd': S.gcd,
                  'lcm': S.lcm, 'comb': S.binomial, 'isqrt':lambda v:S.Integer(math.isqrt(int(v)))})
CONSTANTS = {'I':S.I, 'pi':S.pi, 'E':S.E, 'oo':S.oo, 'True':True, 'False':False}
BINOPS = {ast.Add: lambda a,b:a+b, ast.Sub:lambda a,b:a-b,
          ast.Mult:lambda a,b:a*b, ast.Div:lambda a,b:a/b,
          ast.FloorDiv:lambda a,b:S.floor(a/b), ast.Mod:lambda a,b:a%b,
          ast.Pow:lambda a,b:a**b}
COMPARISONS = {ast.Eq:lambda a,b:S.Eq(a,b), ast.NotEq:lambda a,b:S.Ne(a,b),
               ast.Lt:lambda a,b:a<b, ast.LtE:lambda a,b:a<=b,
               ast.Gt:lambda a,b:a>b, ast.GtE:lambda a,b:a>=b,
               ast.In:lambda a,b:a in b, ast.NotIn:lambda a,b:a not in b}

def clean_math(value):
    value = str(value).strip().replace('−','-').replace('–','-').replace('×','*').replace('·','*').replace('÷','/').replace('^','**')
    return value

def exact_expression(expression, variables=None):
    """Interpret arithmetic AST without eval/exec, preserving rational decimals."""
    expression = clean_math(expression)
    if len(expression)>4000: raise Pending('expression_too_long')
    env = dict(variables or {})
    tree = ast.parse(expression, mode='eval')
    if sum(1 for _ in ast.walk(tree))>800: raise Pending('expression_too_complex')
    def go(node):
        if isinstance(node, ast.Expression): return go(node.body)
        if isinstance(node, ast.Constant):
            if isinstance(node.value, bool): return node.value
            if isinstance(node.value, int): return S.Integer(node.value)
            if isinstance(node.value, float): return S.Rational(str(node.value))
            if isinstance(node.value, str) and re.fullmatch(r'-?\d+(?:/\d+|\.\d+)?',node.value): return node.value
            raise Pending('unsupported_literal')
        if isinstance(node, ast.Name):
            if node.id in env:return env[node.id]
            if node.id in CONSTANTS:return CONSTANTS[node.id]
            if re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_]{0,20}',node.id):return S.Symbol(node.id, real=True)
            raise Pending('unsupported_symbol')
        if isinstance(node, (ast.List,ast.Tuple)):return tuple(go(n) for n in node.elts)
        if isinstance(node, ast.UnaryOp):
            if isinstance(node.op, ast.USub):return -go(node.operand)
            if isinstance(node.op, ast.UAdd):return go(node.operand)
            if isinstance(node.op, ast.Not):return not bool(go(node.operand))
        if isinstance(node, ast.BinOp) and type(node.op) in BINOPS:
            a,b=go(node.left),go(node.right)
            # Python predicates may count satisfied conditions, e.g.
            # (r>0)+(b>0). SymPy's BooleanAtom deliberately disallows addition;
            # convert only arithmetic operands, leaving logical conditions intact.
            if isinstance(a,(bool,S.logic.boolalg.BooleanAtom)):a=S.Integer(int(bool(a)))
            if isinstance(b,(bool,S.logic.boolalg.BooleanAtom)):b=S.Integer(int(bool(b)))
            if isinstance(node.op,ast.Pow) and b.is_number and abs(b)>1000:raise Pending('exponent_limit')
            return BINOPS[type(node.op)](a,b)
        if isinstance(node, ast.BoolOp):
            # Match the predicate's stated short-circuit semantics. A domain
            # guard such as d!=0 must prevent evaluating n%d for d=0.
            if isinstance(node.op,ast.And):
                for value in node.values:
                    if not bool(go(value)):return False
                return True
            for value in node.values:
                if bool(go(value)):return True
            return False
        if isinstance(node, ast.Compare):
            previous=go(node.left);results=[]
            for op,right in zip(node.ops,node.comparators):
                if type(op) not in COMPARISONS:raise Pending('unsupported_comparison')
                current=go(right);results.append(COMPARISONS[type(op)](previous,current));previous=current
            return S.And(*results)
        if isinstance(node, ast.Call) and isinstance(node.func,ast.Name) and node.func.id in FUNCTIONS and not node.keywords:
            return FUNCTIONS[node.func.id](*(go(arg) for arg in node.args))
        raise Pending('unsupported_expression_ast:'+type(node).__name__)
    return go(tree)

def equivalent(a,b):
    try:
        result=S.simplify(a-b)
        return result==0 or result.equals(0) is True
    except (TypeError,AttributeError):return a==b

def scalar(value):
    result=S.simplify(value)
    if getattr(result,'free_symbols',set()):raise Pending('result_has_free_symbols')
    if result in (S.oo,-S.oo,S.zoo,S.nan) or result.has(S.zoo,S.nan):raise Pending('nonfinite_result')
    return result

def finite_search(spec):
    names=list(spec['variables']);domains=[]
    for name in names:
        low,high=spec['variables'][name]
        if not isinstance(low,int) or not isinstance(high,int) or high<low:raise Pending('invalid_finite_domain')
        domains.append(range(low,high+1))
    if math.prod(map(len,domains))>500000:raise Pending('finite_domain_too_large')
    objective=spec['objective']
    if isinstance(objective,str):objective={'kind':'unique','expression':objective}
    vals=[]
    for point in product(*domains):
        env=dict(zip(names,map(S.Integer,point)))
        if bool(exact_expression(spec['predicate'],env)):
            vals.append(exact_expression(objective.get('expression','1'),env))
    kind=objective['kind']
    if kind=='count':return S.Integer(len(vals))
    if not vals:raise Pending('empty_solution_domain')
    if kind=='sum':return sum(vals,S.Integer(0))
    if kind=='min':return min(vals)
    if kind=='max':return max(vals)
    if kind=='unique' and len(set(vals))==1:return vals[0]
    raise Pending('nonunique_solution')

def exact_math(spec):
    operation=spec['operation'];x=S.Symbol(spec.get('variable','x'),real=True)
    expr=exact_expression(spec.get('expression','0'))
    subs={S.Symbol(k,real=True):exact_expression(v) for k,v in spec.get('substitutions',{}).items()}
    def conditions(value):
        for condition in spec.get('conditions',[]):
            lhs=exact_expression(condition['left']).subs(x,value)
            rhs=exact_expression(condition['right']).subs(x,value)
            op=condition['op']
            rule={'eq':lambda:equivalent(lhs,rhs),'ne':lambda:not equivalent(lhs,rhs),'gt':lambda:lhs>rhs,'ge':lambda:lhs>=rhs,'lt':lambda:lhs<rhs,'le':lambda:lhs<=rhs}
            if op not in rule or not bool(rule[op]()):return False
        return True
    if operation=='evaluate':
        node=ast.parse(clean_math(spec.get('expression','0')),mode='eval').body
        if not subs and (literal_numeric_ast(node) or isinstance(node,ast.Name)):
            raise Pending('literal_result_only_not_independently_verifiable')
        return expr.subs(subs).doit()
    if operation=='coefficient':
        variables=[S.Symbol(v,real=True) for v in spec.get('variables',[str(x)])]
        powers=spec.get('powers',{str(x):int(spec.get('power',spec.get('degree',0)))})
        result=S.expand(expr)
        # Taylor coefficients at zero use repeated differentiation rather than
        # the author's polynomial coefficient lookup.
        for variable in variables:
            exponent=int(powers.get(str(variable),0))
            result=S.diff(result,variable,exponent).subs(variable,0)/math.factorial(exponent)
        return result
    if operation=='term_count':
        variables=[S.Symbol(v,real=True) for v in spec.get('variables',[str(x)])]
        return S.Integer(len(S.Poly(S.expand(expr),*variables).monoms()))
    if operation=='polynomial_abs_coeff_sum':return sum(map(S.Abs,S.Poly(S.expand(expr),x).all_coeffs()))
    if operation=='quadratic_vertex':
        if S.Poly(expr,x).degree()!=2:raise Pending('vertex_requires_quadratic')
        critical=S.solveset(S.diff(expr,x),x,domain=S.S.Reals)
        if not isinstance(critical,S.FiniteSet) or len(critical)!=1:raise Pending('vertex_not_unique')
        root=next(iter(critical))
        if spec.get('coordinate')=='x':return root
        if spec.get('coordinate')=='y':return expr.subs(x,root)
        raise Pending('unsupported_vertex_coordinate')
    if operation=='limit':return S.limit(expr,x,exact_expression(spec.get('point','0')),dir=spec.get('direction','+'))
    if operation=='derivative':
        derivative=S.diff(expr,x,int(spec.get('order',1)))
        if 'point' in spec:return derivative.subs(x,exact_expression(spec['point'])).subs(subs)
        return derivative.subs(subs)
    if operation=='integral':
        if 'lower' not in spec or 'upper' not in spec:raise Pending('indefinite_integral_needs_constant_policy')
        lower=exact_expression(spec['lower']);upper=exact_expression(spec['upper'])
        if lower.is_real is not True or upper.is_real is not True or lower.is_finite is not True or upper.is_finite is not True:
            raise Pending('integral_requires_finite_real_bounds')
        direction=1 if upper>=lower else -1;lo=min(lower,upper);hi=max(lower,upper)
        interval=S.Interval(lo,hi)
        # Endpoint substitution into an antiderivative must not silently turn
        # a pole-crossing improper integral into a finite principal value.
        domain=S.calculus.util.continuous_domain(expr,x,interval)
        if domain!=interval:raise Pending('integral_not_continuous_on_closed_interval')
        absolute_atoms=list(expr.atoms(S.Abs))
        if absolute_atoms:
            breakpoints={lo,hi}
            for atom in absolute_atoms:
                if not atom.args[0].is_polynomial(x):raise Pending('abs_integral_requires_polynomial_argument')
                roots=S.solveset(atom.args[0],x,domain=S.S.Reals)
                if not isinstance(roots,S.FiniteSet):raise Pending('abs_integral_unresolved_sign_changes')
                breakpoints.update(root for root in roots if lo<root<hi)
            points=sorted(breakpoints);total=S.Integer(0)
            for a,b in zip(points,points[1:]):
                midpoint=(a+b)/2;replacements={}
                for atom in absolute_atoms:
                    sign=S.sign(atom.args[0].subs(x,midpoint))
                    if sign not in (-1,1):raise Pending('abs_integral_ambiguous_interval_sign')
                    replacements[atom]=sign*atom.args[0]
                branch=expr.xreplace(replacements);anti=S.integrate(branch,x)
                if not equivalent(S.diff(anti,x),branch):raise Pending('abs_interval_antiderivative_failed')
                total+=anti.subs(x,b)-anti.subs(x,a)
            return (direction*total+exact_expression(spec.get('offset',0))).subs(subs)
        antiderivative=S.integrate(expr,x)
        if not equivalent(S.diff(antiderivative,x),expr):raise Pending('antiderivative_substitution_failed')
        return (antiderivative.subs(x,exact_expression(spec['upper']))-antiderivative.subs(x,exact_expression(spec['lower']))+exact_expression(spec.get('offset',0))).subs(subs)
    if operation=='sequence_sum':
        lo=int(spec.get('start',spec.get('lower',1)));hi=int(spec.get('end',spec.get('upper',0)))
        if hi-lo>10000:raise Pending('sum_domain_too_large')
        return sum((expr.subs(x,i) for i in range(lo,hi+1)),S.Integer(0)).subs(subs)
    if operation in ('log_equation','solve_parameter'):
        target=exact_expression(spec.get('target','0'))
        roots=S.solveset(S.Eq(expr,target),x,domain=S.S.Reals)
        if not isinstance(roots,S.FiniteSet):raise Pending('nonfinite_or_unresolved_roots')
        roots=[r for r in roots if conditions(r) and equivalent(expr.subs(x,r),target)]
        if 'lower' in spec:roots=[r for r in roots if r>=exact_expression(spec['lower'])]
        if 'upper' in spec:roots=[r for r in roots if r<=exact_expression(spec['upper'])]
        stat=spec.get('statistic','unique')
        if stat=='sum':return sum(roots,S.Integer(0))
        if stat=='count':return S.Integer(len(roots))
        if not roots:raise Pending('empty_roots')
        if stat=='max':return max(roots)
        if stat=='min':return min(roots)
        if stat=='unique' and len(roots)==1:
            return exact_expression(spec.get('objective',str(x)),{str(x):roots[0]})
        raise Pending('ambiguous_root_statistic')
    if operation=='root_stat':
        poly=S.Poly(expr,x);degree=poly.degree();coefficients=poly.all_coeffs();lead=coefficients[0]
        normalized=[S.simplify(c/lead) for c in coefficients]
        # Newton identities independently evaluate symmetric root statistics;
        # no constructed root list or author answer is read.
        power_sums={0:S.Integer(degree)}
        def ps(power):
            if power<0:
                if normalized[-1]==0:raise Pending('zero_root_negative_power')
                reverse=S.Poly.from_list(list(reversed(coefficients)),x).as_expr()
                return exact_math({'operation':'root_stat','expression':str(reverse),'variable':str(x),'statistic':'power_sum','power':-power})
            for k in range(1,power+1):
                if k in power_sums:continue
                if k<=degree:
                    value=-sum(normalized[i]*power_sums[k-i] for i in range(1,k))-k*normalized[k]
                else:value=-sum(normalized[i]*power_sums[k-i] for i in range(1,degree+1))
                power_sums[k]=S.simplify(value)
            return power_sums[power]
        product_value=(-1)**degree*normalized[-1]
        stat=spec['statistic']
        if stat=='sum':return ps(1)
        if stat=='product':return product_value
        if stat=='power_sum':return ps(int(spec['power']))
        if stat=='reciprocal_sum':
            if normalized[-1]==0:raise Pending('zero_root_reciprocal')
            return -normalized[-2]/normalized[-1]
        if stat=='shifted_product':return (-1)**degree*poly.eval(-exact_expression(spec['shift']))/lead
        if stat=='difference_squared':
            if degree!=2:raise Pending('difference_squared_requires_quadratic')
            return ps(1)**2-4*product_value
        if stat=='ratio_sum':
            if degree!=2 or product_value==0:raise Pending('ratio_sum_nonzero_quadratic_required')
            return ps(2)/product_value
        if stat=='shifted_power_sum':
            power=int(spec['power']);scale=exact_expression(spec.get('scale',1));shift=exact_expression(spec['shift'])
            if power<0:
                if scale==0:
                    if shift==0:raise Pending('zero_shifted_root_negative_power')
                    return degree*shift**power
                transformed=S.expand(scale**degree*expr.subs(x,(x-shift)/scale))
                return exact_math({'operation':'root_stat','expression':str(transformed),'variable':str(x),'statistic':'power_sum','power':power})
            return sum(S.binomial(power,k)*scale**k*shift**(power-k)*ps(k) for k in range(power+1))
        raise Pending('unsupported_root_stat:'+stat)
    if operation=='integer_count':
        lo=int(spec['lower']);hi=int(spec['upper'])
        if hi-lo>100000:raise Pending('integer_domain_too_large')
        predicate=spec.get('predicate')
        if not predicate and not spec.get('conditions'):raise Pending('integer_count_requires_predicate')
        candidates=[S.Integer(i) for i in range(lo,hi+1) if (bool(exact_expression(predicate,{str(x):S.Integer(i)})) if predicate else conditions(S.Integer(i)))]
        statistic=spec.get('statistic','count')
        if statistic=='count':return S.Integer(len(candidates))
        if statistic=='sum':return sum(candidates,S.Integer(0))
        if statistic=='sum_squares':return sum((v*v for v in candidates),S.Integer(0))
        if not candidates:raise Pending('empty_integer_candidate_set')
        if statistic=='minimum':return min(candidates)
        if statistic=='maximum':return max(candidates)
        raise Pending('unsupported_integer_statistic:'+statistic)
    if operation=='complex_component':
        expr=S.expand_complex(expr.subs(subs))
        component=spec.get('component','real')
        if component=='real':return S.re(expr)
        if component=='imag':return S.im(expr)
        if component=='abs':return S.Abs(expr)
        if component=='abs_squared':return S.re(expr)**2+S.im(expr)**2
        raise Pending('unsupported_complex_component')
    raise Pending('unsupported_exact_math_operation:'+operation)


def counting(spec):
    family=spec.get('family');p=spec.get('parameters',{})
    # Count labelled finite outcomes, instead of copying the author's formulas.
    if family=='probability':
        event=p['event']
        if event=='sum_multiple_three':
            outcomes=list(product(range(1,p['faces']+1),repeat=p['dice']))
            return S.Rational(sum(sum(t)%3==0 for t in outcomes),len(outcomes))
        if event=='transfer_then_red':
            ar,ab=p['bagA'];br,bb=p['bagB'];good=total=0
            for colour in ['R']*ar+['B']*ab:
                for result in ['R']*br+['B']*bb+[colour]:total+=1;good+=result=='R'
            return S.Rational(good,total)
        r=p.get('red',p.get('girls',0));b=p.get('blue',p.get('boys',0));g=p.get('green',0)
        objects=['R']*r+['B']*b+['G']*g;k=p.get('draw',p.get('team',0))
        outcomes=product(range(len(objects)),repeat=k) if p.get('replace',False) else permutations(range(len(objects)),k)
        good=total=0
        for indices in outcomes:
            t=[objects[i] for i in indices]
            condition=True
            if event=='second_red_given_first_blue':condition=t[0]=='B';success=t[1]=='R'
            elif event=='all_red_given_some_red':condition='R'in t;success=all(v=='R' for v in t)
            elif event=='all_girls_given_at_least_two':condition=t.count('R')>=2;success=t.count('R')==k
            elif event=='all_red':success=all(v=='R' for v in t)
            elif event=='mixed':success=len(set(t))>1
            elif event=='exactly_two_red':success=t.count('R')==2
            elif event=='at_least_one_red':success='R'in t
            elif event=='second_red':success=t[1]=='R'
            elif event=='at_least_two_girls':success=t.count('R')>=2
            elif event=='same_color':success=len(set(t))==1
            elif event=='one_each':success=len(set(t))==3
            elif event=='no_blue':success='B'not in t
            else:raise Pending('unknown_probability_event:'+event)
            if condition:total+=1;good+=bool(success)
        if not total:raise Pending('zero_conditional_sample_space')
        return S.Rational(good,total)
    if family=='combinations':
        if p.get('shortestOnly'):
            return S.Integer(sum(t.count('R')==p['right'] for t in product('RU',repeat=p['right']+p['up'])))
        if p.get('roles')=='one_captain_unordered_helpers':
            return S.Integer(sum(1 for captain in range(p['n']) for _ in combinations([i for i in range(p['n']) if i!=captain],p['assistants'])))
        n=p.get('n',p.get('positions',p.get('girls',p.get('engineers',0))+p.get('boys',p.get('designers',0))))
        k=p.get('k',p.get('choose',p.get('team',p.get('groupSize',0))))
        values=p.get('values',list(range(1,n+1)))
        if 'values'in p:n=len(values)
        count=0
        for t in combinations(range(n),k):
            if 'mandatory'in p and not all(i in t for i in p['mandatory']):continue
            if 'excluded'in p and any(i in t for i in p['excluded']):continue
            if 'girlsRequired'in p and sum(i<p['girls'] for i in t)!=p['girlsRequired']:continue
            if p.get('equalGroups') and sum(i<p['girls'] for i in t)*2!=k:continue
            if 'atLeastOne'in p and not any(i in t for i in p['atLeastOne']):continue
            if 'notTogether'in p and all(i in t for i in p['notTogether']):continue
            if 'togetherOrNeither'in p and len([i for i in p['togetherOrNeither'] if i in t]) not in (0,len(p['togetherOrNeither'])):continue
            if p.get('nonAdjacent') and any(b-a==1 for a,b in zip(t,t[1:])):continue
            if p.get('sumParity')=='even' and sum(values[i] for i in t)%2:continue
            if 'minEngineers'in p and sum(i<p['engineers'] for i in t)<p['minEngineers']:continue
            if 'maximum'in p and max(values[i] for i in t)!=p['maximum']:continue
            if p.get('unlabelledGroups')==2 and 0 not in t:continue
            count+=1
        return S.Integer(count)
    if family=='permutations':
        if 'target'in p:
            return S.Integer(sorted(permutations(p['digits'])).index(tuple(p['target']))+1)
        if 'letters'in p:return S.Integer(len(set(permutations(p['letters']))))
        if 'digits'in p:
            seqs=product(p['digits'],repeat=p['length']) if p.get('repeat') else permutations(p['digits'],p['length'])
            count=0
            for t in seqs:
                if 'leadingZero'in p and not p['leadingZero'] and t[0]==0:continue
                if 'divisibleBy'in p:
                    if t[0]==0 or sum(int(d)*10**i for i,d in enumerate(t[::-1]))%p['divisibleBy']:continue
                count+=1
            return S.Integer(count)
        n=p.get('n',p.get('books',p.get('people',p.get('contestants',p.get('girls',0)+p.get('boys',0)))))
        k=p.get('positions',p.get('top',n));count=0
        if n>9:raise Pending('permutation_domain_too_large')
        seqs=((0,)+t for t in permutations(range(1,n))) if p.get('rotationEquivalent') else permutations(range(n),k)
        for t in seqs:
            def distance(pair):return abs(t.index(pair[0])-t.index(pair[1]))
            if 'adjacent'in p and distance(p['adjacent'])!=1:continue
            if 'notAdjacent'in p:
                d=distance(p['notAdjacent'])
                if d==1 or (p.get('rotationEquivalent') and d==n-1):continue
            if 'leftOf'in p and t.index(p['leftOf'][0])>=t.index(p['leftOf'][1]):continue
            if 'betweenPair'in p and distance(p['betweenPair'])!=p['betweenCount']+1:continue
            if p.get('alternating') and any((a<p['girls'])==(b<p['girls']) for a,b in zip(t,t[1:])):continue
            if 'mandatory'in p and p['mandatory']not in t:continue
            count+=1
        return S.Integer(count)
    if family=='factorial':
        def trailing(n):
            if not n:raise Pending('zero_not_finite_trailing_count')
            k=0
            while n%10==0:n//=10;k+=1
            return k
        def valuation(n,prime):
            if prime<2 or not S.isprime(prime):raise Pending('valuation_prime_required')
            k=0
            while n%prime==0:n//=prime;k+=1
            return k
        if 'minTrailingZeros'in p:
            lo,hi=p['searchRange'];matches=[n for n in range(lo,hi+1) if trailing(math.factorial(n))>=p['minTrailingZeros']]
            if not matches:raise Pending('no_minimum_in_search_range')
            return S.Integer(min(matches))
        if 'exactZeros'in p:
            lo,hi=p['nRange'];return S.Integer(sum(trailing(math.factorial(n))==p['exactZeros'] for n in range(lo,hi+1)))
        if 'fromFactorial'in p:return S.Integer(trailing(math.factorial(p['toFactorial']))-trailing(math.factorial(p['fromFactorial'])))
        if 'stripTrailingZerosOfFactorial'in p:
            number=math.factorial(p['stripTrailingZerosOfFactorial']);number//=10**trailing(number)
        elif 'binomial'in p:number=math.comb(*p['binomial'])
        elif 'productRange'in p:number=math.prod(range(p['productRange'][0],p['productRange'][1]+1))
        else:
            number=Fraction(1)
            for n,power in p.get('factorials',[]):number*=Fraction(math.factorial(n))**power
            for f in p.get('extraFactors',[]):number*=f
            if number.denominator!=1:raise Pending('factorial_expression_not_integer')
            number=number.numerator
        return S.Integer(valuation(number,p['prime']) if 'prime'in p else trailing(number))
    raise Pending('unsupported_counting_family:'+str(family))


def literal_numeric_ast(node):
    if isinstance(node,ast.Constant):return isinstance(node.value,(int,float,str))
    if isinstance(node,ast.UnaryOp):return isinstance(node.op,(ast.USub,ast.UAdd)) and literal_numeric_ast(node.operand)
    return isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id in ('Integer','Rational','Float') and all(literal_numeric_ast(arg) for arg in node.args)


def rational_identity(spec):
    variables=[S.Symbol(name,real=True) for name in spec['variables']]
    equations=[exact_expression(expression) for expression in spec['equations']]
    target=exact_expression(spec['expression'])
    branches=S.solve(equations,variables,dict=True)
    if not branches:raise Pending('no_symbolic_identity_branches')
    values=[]
    mode=spec.get('mode','constant')
    for branch in branches:
        domain=[exact_expression(expression).subs(branch) for expression in spec.get('nonzero',[])]
        if any(equivalent(value,0) for value in domain):continue
        replacement=target.subs(branch,simultaneous=True)
        if mode=='defined_indicator':
            numerator,denominator=S.fraction(target)
            d=S.simplify(denominator.subs(branch,simultaneous=True))
            if equivalent(d,0):value=S.Integer(0)
            elif not d.free_symbols:value=S.Integer(1)
            else:raise Pending('identity_definedness_depends_on_free_parameters')
        else:
            value=S.simplify(replacement)
            if value.has(S.nan,S.zoo,S.oo,-S.oo):raise Pending('undefined_identity_branch')
            if value.free_symbols:raise Pending('identity_not_proven_constant')
        values.append(value)
    if not values:raise Pending('no_admissible_identity_branches')
    if not all(equivalent(value,values[0]) for value in values):raise Pending('identity_multiple_results')
    return values[0]


def check_prompt(q,spec):
    prompt=q.get('prompt','')
    anchors=spec.get('promptAnchors') or [spec.get('promptAnchor')]
    if not anchors or not all(isinstance(anchor,str) and anchor and anchor in prompt for anchor in anchors):raise Pending('missing_literal_prompt_anchor')
    for token in spec.get('promptTokens',[]):
        if str(token) not in prompt:raise Pending('prompt_token_missing:'+str(token))
    if q.get('examType') not in ('TYT','AYT'):raise Pending('exam_type_not_tyt_ayt')
    if q.get('difficulty') not in ('easy','medium','hard') or not q.get('difficultyReason'):raise Pending('difficulty_unclassified')
    if q['examType']=='TYT' and any(word in q.get('topic','').lower() for word in ('türev','integral','logaritma','karmaşık')):raise Pending('tyt_ayt_boundary_review')
    if q.get('origin')!='AI_URETIMI' or q.get('pool')!='generated':raise Pending('wrong_origin_or_pool')
    if not q.get('parentQuestionId'):raise Pending('accessible_parent_id_missing')
    if spec.get('operation')=='coefficient' and spec.get('powers') is not None:
        powers={str(k):int(v) for k,v in spec['powers'].items()}
        if 'sabit terim' in prompt and any(powers.values()):raise Pending('coefficient_target_mismatch_constant')
        direct=re.search(r'açılımında\s+([a-z](?:\^\d+)?(?:[·*][a-z](?:\^\d+)?)*)\s+(?:monomunun|teriminin)',prompt)
        if direct:
            requested={}
            for variable,exponent in re.findall(r'([a-z])(?:\^(\d+))?',direct.group(1)):
                requested[variable]=int(exponent or 1)
            if any(powers.get(v,0)!=requested.get(v,0) for v in set(powers)|set(requested)):
                raise Pending('coefficient_target_mismatch_prompt')
        ordered=re.search(r'(baştan|sondan) (\d+)\. terimin',prompt)
        if ordered or 'ortanca terim' in prompt:
            variables=[S.Symbol(v,real=True) for v in spec.get('variables',['x'])]
            terms=S.Poly(S.expand(exact_expression(spec['expression'])),*variables).monoms()
            if ordered:
                rank=int(ordered.group(2));index=rank-1 if ordered.group(1)=='baştan' else len(terms)-rank
            elif 'iki ortanca'in prompt:index=len(terms)//2-(1 if 'ilkinin'in prompt else 0)
            else:
                if len(terms)%2==0:raise Pending('ambiguous_middle_term')
                index=len(terms)//2
            if not 0<=index<len(terms):raise Pending('ordered_term_rank_outside_expansion')
            if tuple(powers.get(str(v),0) for v in variables)!=terms[index]:raise Pending('coefficient_target_mismatch_order')
    family=q.get('familyId',q.get('subtopic',''))
    identifier=q.get('id','')
    if family=='factor-pairs' and identifier.endswith(('-05','-06')) and 'pozitif tam sayı' not in prompt:
        raise Pending('missing_positive_integer_domain_in_prompt')
    if family=='score-problems' and identifier.endswith('-08') and not re.search(r'beraberlik\s+1',prompt):
        raise Pending('missing_draw_score_in_prompt')
    if spec.get('operation')=='solve_parameter' and '1/α+1/β=' in prompt:
        parameter=S.Symbol(spec.get('variable','a'),real=True)
        target_match=re.search(r'1/α\+1/β=([^\s]+)',prompt)
        original=None
        for anchor in anchors:
            try:
                candidate=exact_expression(anchor);poly=S.Poly(candidate,S.Symbol('x',real=True))
                if poly.degree()==2 and parameter in candidate.free_symbols:original=poly;break
            except Exception:continue
        if original is not None and target_match:
            coefficients=original.all_coeffs()
            expected=exact_expression(target_match.group(1).rstrip('.,'))
            actual=-coefficients[1]/coefficients[2]
            equation=S.simplify(actual-expected)
            if parameter not in equation.free_symbols:
                raise Pending('no_unique_parameter_from_reciprocal_root_sum_prompt')
            actual_solutions=S.solveset(equation,parameter,domain=S.S.Reals)
            declared_solutions=S.solveset(exact_expression(spec['expression']),parameter,domain=S.S.Reals)
            if actual_solutions!=declared_solutions:raise Pending('reciprocal_root_sum_premise_spec_mismatch')
    return True

def direct_prompt_result(prompt):
    # For a plain arithmetic question, parse the displayed source operation as
    # an additional independent input, rather than only checking author metadata.
    match=re.match(r'^(.+?)\s+işleminin sonucu',prompt)
    if not match:return None
    expression=match.group(1).strip().replace('[','(').replace(']',')').replace('{','(').replace('}',')')
    superscripts={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-'}
    expression=re.sub('[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+',lambda m:'**('+''.join(superscripts[c] for c in m.group())+')',expression)
    if re.search('[A-Za-zÇĞİÖŞÜçğıöşü]',expression):return None
    try:return scalar(exact_expression(expression))
    except Exception:return None


def audit(q):
    result={'id':q.get('id'),'examType':q.get('examType'),'courseId':q.get('courseId'),'subtopic':q.get('subtopic'),'mathPassed':False,'status':'pending_review','computedValue':None,'verifiedAnswerLetter':None,'methods':[],'reasons':[]}
    try:
        spec=q.get('verificationSpec')
        if not isinstance(spec,dict):raise Pending('missing_verification_spec')
        check_prompt(q,spec)
        kind=spec.get('type',spec.get('kind'))
        if kind=='exact_expression':
            node=ast.parse(clean_math(spec['expression']),mode='eval').body
            if literal_numeric_ast(node) or isinstance(node,ast.Name):
                raise Pending('literal_result_only_not_independently_verifiable')
            value=exact_expression(spec['expression']);method='allowlisted_exact_symbolic_arithmetic'
        elif kind=='finite_search':value=finite_search(spec);method='independent_finite_assignment_enumeration'
        elif kind=='exact_math':value=exact_math(spec);method='independent_sympy_'+spec['operation']
        elif kind=='counting':value=counting(spec);method='labelled_finite_enumeration_or_exact_integer_construction'
        elif kind=='rational_identity':value=rational_identity(spec);method='independent_symbolic_constraint_branches_and_substitution'
        elif kind=='statistics':
            values=sorted(exact_expression(item) for item in spec['values'])
            if not values:raise Pending('empty_statistics_data')
            if spec['operation']=='median':
                middle=len(values)//2;value=values[middle] if len(values)%2 else (values[middle-1]+values[middle])/2
            elif spec['operation']=='mode':
                frequencies={item:values.count(item) for item in set(values)};highest=max(frequencies.values());modes=[item for item,count in frequencies.items() if count==highest]
                if len(modes)!=1:raise Pending('statistics_multiple_modes')
                value=modes[0]
            else:raise Pending('unsupported_statistics_operation')
            method='independent_exact_order_statistics_or_frequency_count'
        elif kind=='finite_image':
            domain=[exact_expression(item) for item in spec['domain']]
            if not domain or len(domain)>500:raise Pending('invalid_finite_image_domain')
            image=set()
            for item in domain:
                env={'x':item}
                if not bool(exact_expression(spec.get('predicate','True'),env)):continue
                image.add(scalar(exact_expression(spec['expression'],env)))
            if not image:raise Pending('empty_finite_image')
            operation=spec['operation']
            if operation=='count':value=S.Integer(len(image))
            elif operation=='sum':value=sum(image,S.Integer(0))
            elif operation=='range':value=max(image)-min(image)
            elif operation=='maximum':value=max(image)
            elif operation=='product_nonzero':value=S.prod(item for item in image if item!=0)
            else:raise Pending('unsupported_finite_image_operation')
            method='independent_enumeration_and_deduplicated_image_set'
        elif kind=='data_summary':
            values=sorted(scalar(exact_expression(item)) for item in spec['values'])
            if not values or len(values)>10000:raise Pending('invalid_summary_data')
            n=len(values);middle=n//2
            mean=sum(values)/n
            median=values[middle] if n%2 else (values[middle-1]+values[middle])/2
            frequencies=Counter(values);top=max(frequencies.values())
            modes=[v for v,c in frequencies.items() if c==top]
            env={'mean':mean,'median':median,'count':S.Integer(n),
                 'spread':max(values)-min(values),'total':sum(values)}
            if len(modes)==1:env['mode']=modes[0]
            variance=sum((v-mean)**2 for v in values)/n
            env['population_variance']=variance
            if n>1:env['sample_variance']=variance*n/(n-1)
            if spec.get('operation')=='order':
                i=spec['oneBasedIndex']
                if not isinstance(i,int) or not 1<=i<=n:raise Pending('invalid_order_index')
                value=values[i-1]
            else:
                value=exact_expression(spec['objective'],env)
                if value.free_symbols:raise Pending('ambiguous_or_unknown_summary_statistic')
            method='independent_raw_data_sort_frequency_and_centered_moments'
        else:raise Pending('unsupported_spec_type:'+str(kind))
        supporting=spec.get('supportingChecks',[])
        if len(supporting)>8:raise Pending('too_many_supporting_checks')
        for premise in supporting:
            independent=scalar(exact_math(premise))
            if not equivalent(independent,exact_expression(premise['expectedValue'])):raise Pending('supporting_premise_mismatch')
        if supporting:result['methods'].append('independent_supporting_constraint_recalculation')
        value=scalar(value);result['computedValue']=str(value);result['methods'].append(method)
        prompt_value=direct_prompt_result(q.get('prompt',''))
        if prompt_value is not None:
            if not equivalent(prompt_value,value):raise Pending('spec_prompt_arithmetic_mismatch')
            result['methods'].append('displayed_arithmetic_independently_parsed')
        options=q.get('options',[])
        if len(options)!=5 or [o.get('id') for o in options]!=list('ABCDE'):raise Pending('not_five_ordered_options')
        parsed=[scalar(exact_expression(o['text'])) for o in options]
        for i in range(5):
            for j in range(i):
                if equivalent(parsed[i],parsed[j]):raise Pending('equivalent_duplicate_options')
        matches=[o['id'] for o,n in zip(options,parsed) if equivalent(value,n)]
        if len(matches)!=1:raise Pending('correct_option_count:'+str(len(matches)))
        result['verifiedAnswerLetter']=matches[0]
        if q.get('answer',{}).get('value')!=matches[0]:raise Pending('answer_key_mismatch')
        claimed=q.get('answer',{}).get('computedValue')
        if claimed is not None and not equivalent(value,exact_expression(claimed)):raise Pending('claimed_value_mismatch')
        if not q.get('solutionSteps') or not q.get('answer',{}).get('solution'):raise Pending('solution_missing')
        result['mathPassed']=True;result['status']='automated_verified'
        event=spec.get('parameters',q.get('parameters',{})).get('event')
        if q.get('examType')=='TYT' and event in ('second_red_given_first_blue','all_red_given_some_red','all_girls_given_at_least_two'):
            result['status']='pending_review';result['reasons'].append('exam_boundary_review_conditional_probability')
        result['methods']+=['five_options_exact_equivalence','claimed_key_compared_with_independent_result','literal_prompt_anchor_check']
    except Exception as error:
        reason=str(error) if isinstance(error,Pending) else ('missing_spec_field:'+str(error.args[0]) if isinstance(error,KeyError) else type(error).__name__+':'+str(error))
        result['reasons'].append(reason)
    result['editorialStatus']='pending'
    return result


def normalize_prompt(prompt,remove_numbers=False):
    text=unicodedata.normalize('NFKC',prompt).casefold()
    text=re.sub(r'\s+',' ',text).strip()
    if remove_numbers:text=re.sub(r'\d+(?:[.,/]\d+)?','#',text)
    return text

def duplicates(questions,results):
    exact=defaultdict(list);near=defaultdict(list);by_id={r['id']:r for r in results}
    for q in questions:
        exact[normalize_prompt(q['prompt'])].append(q['id'])
        near[normalize_prompt(q['prompt'],True)].append(q['id'])
    groups=[];rejected={}
    for kind,table in [('exact',exact),('numeric_template',near)]:
        for signature,ids in table.items():
            if len(ids)>1:
                eligible=[identifier for identifier in ids if by_id[identifier]['status']=='automated_verified']
                kept=(eligible or ids)[0]
                group_id=kind+'-'+hashlib.sha256(signature.encode()).hexdigest()[:16]
                others=[identifier for identifier in ids if identifier!=kept]
                groups.append({'kind':kind,'groupId':group_id,'keptId':kept,'duplicateIds':others,'confidence':'same_normalized_stem' if kind=='exact' else 'same_words_numeric_literals_removed'})
                for identifier in ids:by_id[identifier]['nearDuplicateGroup']=group_id
                for identifier in others:rejected.setdefault(identifier,{'kind':kind,'duplicateOf':kept})
    return groups,rejected


def self_test():
    base={'id':'TEST-EXACT','examType':'TYT','origin':'AI_URETIMI','pool':'generated','parentQuestionId':'TEST-PARENT',
          'topic':'Dört İşlem','difficulty':'easy','difficultyReason':'İşlem sırası.',
          'prompt':'3+4 işleminin sonucu kaçtır?',
          'options':[{'id':letter,'text':str(value)} for letter,value in zip('ABCDE',[5,6,7,8,9])],
          'answer':{'value':'C','computedValue':'7','solution':'3+4=7.'},'solutionSteps':['3+4=7.'],
          'verificationSpec':{'type':'exact_expression','expression':'3+4','promptAnchor':'3+4'}}
    assert audit(base)['status']=='automated_verified'
    tests=[]
    q=copy.deepcopy(base);q['answer']['value']='A';tests.append((q,'answer_key_mismatch'))
    q=copy.deepcopy(base);q['options'][0]['text']='14/2';tests.append((q,'equivalent_duplicate_options'))
    q=copy.deepcopy(base);q['verificationSpec']['type']='invented';tests.append((q,'unsupported_spec_type'))
    q=copy.deepcopy(base);q['verificationSpec']['promptAnchor']='4+8';tests.append((q,'missing_literal_prompt_anchor'))
    q=copy.deepcopy(base);q['verificationSpec']['expression']='7';tests.append((q,'literal_result_only'))
    q=copy.deepcopy(base);q['answer']['computedValue']='8';tests.append((q,'claimed_value_mismatch'))
    q=copy.deepcopy(base);q['verificationSpec']['expression']='3+5';q['answer'].update(value='D',computedValue='8');tests.append((q,'spec_prompt_arithmetic_mismatch'))
    q=copy.deepcopy(base);q['verificationSpec']['expression']='__import__("os").system("true")';tests.append((q,'unsupported_expression_ast'))
    q=copy.deepcopy(base);q['prompt']='(x+1)^3 açılımında x^2 teriminin katsayısı kaçtır?';q['verificationSpec']={'kind':'exact_math','operation':'coefficient','expression':'(x+1)**3','variables':['x'],'powers':{'x':1},'promptAnchors':['(x+1)^3']};tests.append((q,'coefficient_target_mismatch_prompt'))
    q=copy.deepcopy(base);q.update(id='TEST-factor-pairs-05',familyId='factor-pairs',prompt='a≤b ve ab=48 için a+b’nin en küçük değeri kaçtır?');q['verificationSpec']={'type':'finite_search','promptAnchor':q['prompt']};tests.append((q,'missing_positive_integer_domain_in_prompt'))
    q=copy.deepcopy(base);q.update(id='TEST-score-problems-08',familyId='score-problems',prompt='Bir takımın 6 galibiyetinden biri beraberlik sayılsaydı puanı kaç azalırdı?');q['verificationSpec']={'type':'exact_expression','expression':'3-1','promptAnchor':q['prompt']};tests.append((q,'missing_draw_score_in_prompt'))
    q=copy.deepcopy(base);q.update(examType='AYT',prompt='a*x^2 + 2*x - 15=0 denkleminin sıfır olmayan kökleri için 1/α+1/β=2/15 olsun. a kaçtır?');q['verificationSpec']={'kind':'exact_math','operation':'solve_parameter','expression':'2/15-2*a/15','variable':'a','promptAnchors':['a*x^2 + 2*x - 15']};tests.append((q,'no_unique_parameter_from_reciprocal_root_sum_prompt'))
    for question,expected in tests:
        row=audit(question)
        assert row['status']=='pending_review' and not row['mathPassed'],(expected,row)
        assert any(expected in reason for reason in row['reasons']),(expected,row)
    assert exact_expression('Rational(8,3)+1/3')==3
    assert exact_expression('d!=0 and 12%d==0',{'d':S.Integer(0)}) is False
    assert exact_expression('d==0 or 12%d==0',{'d':S.Integer(0)}) is True
    assert exact_expression('(r>0)+(b>0)+(g>0)',{'r':S.Integer(1),'b':S.Integer(0),'g':S.Integer(2)})==2
    # Raw data recomputation must disagree with a stale key; image sets must
    # collapse repeated output values rather than count input occurrences.
    for spec,value in [
        ({'type':'finite_image','domain':[-2,-1,1,2],'expression':'x**2','operation':'sum'},5),
        ({'type':'data_summary','values':[2,4,6],'objective':'sqrt(sample_variance)'},2),
        ({'type':'data_summary','values':[1,1,2,2,3],'objective':'median'},2)]:
        q=copy.deepcopy(base);q['verificationSpec']={**spec,'promptAnchor':q['prompt']}
        q['prompt']='TEST ONLY raw data';q['verificationSpec']['promptAnchor']=q['prompt']
        q['options']=[{'id':letter,'text':str(v)} for letter,v in zip('ABCDE',[value-2,value-1,value,value+1,value+2])]
        q['answer'].update(computedValue=str(value));assert audit(q)['mathPassed'],audit(q)
        q['answer']['value']='A';assert not audit(q)['mathPassed']
    assert finite_search({'variables':{'x':[1,10]},'predicate':'x*x==49','objective':{'kind':'unique','expression':'x'}})==7
    assert finite_search({'variables':{'d':[-8,8]},'predicate':'d!=0 and -36%d==0','objective':{'kind':'sum','expression':'-36//d'}})==0
    assert finite_search({'variables':{'r':[0,5],'m':[0,4],'y':[0,3]},'predicate':'(r>0)+(m>0)+(y>0)<2','objective':{'kind':'max','expression':'r+m+y+1'}})==6
    assert exact_math({'operation':'integral','expression':'Abs(x)','lower':-2,'upper':3})==S.Rational(13,2)
    assert exact_math({'operation':'integral','expression':'Abs(2*x-2)','lower':0,'upper':3})==5
    assert exact_math({'operation':'integral','expression':'Abs(x)','lower':3,'upper':-2})==-S.Rational(13,2)
    for unsupported in ('1/x','Abs(1/x)'):
        try:exact_math({'operation':'integral','expression':unsupported,'lower':-1,'upper':1})
        except Pending as error:assert 'continuous' in str(error)
        else:raise AssertionError('A pole-crossing improper integral must not get a finite score')
    assert exact_math({'operation':'coefficient','expression':'(x+2*y)**3','variables':['x','y'],'powers':{'x':2,'y':1}})==6
    for power in range(1,8):assert exact_math({'operation':'root_stat','expression':'x**2-7*x+12','statistic':'power_sum','power':power})==3**power+4**power
    assert exact_math({'operation':'root_stat','expression':'x**2-7*x+12','statistic':'shifted_power_sum','power':4,'shift':'2','scale':'3'})==11**4+14**4
    assert counting({'family':'probability','parameters':{'red':5,'blue':4,'draw':2,'event':'all_red'}})==S.Rational(5,18)
    assert counting({'family':'permutations','parameters':{'n':6,'adjacent':[0,1]}})==240
    assert exact_math({'operation':'root_stat','expression':'x**2-7*x+12','statistic':'power_sum','power':-2})==S.Rational(25,144)
    assert rational_identity({'variables':['x','y','z'],'equations':['x+y+z'],'expression':'x/(y+z)+y/(x+z)+z/(x+y)','nonzero':['x*y*z']})==-3
    assert rational_identity({'variables':['x','y'],'equations':['x+y'],'expression':'(x**3+y**3)/(x**2*y+x*y**2)','nonzero':['x*y'],'mode':'defined_indicator'})==0
    probability=copy.deepcopy(base)
    probability['id']='TEST-EXAM-BOUNDARY';probability['prompt']='5 kırmızı 4 mavi; ilk mavi bilindiğine göre ikinci kırmızı olasılığı?'
    probability['verificationSpec']={'type':'counting','family':'probability','parameters':{'red':5,'blue':4,'draw':2,'event':'second_red_given_first_blue'},'promptAnchor':'5 kırmızı 4 mavi'}
    probability['options']=[{'id':letter,'text':value} for letter,value in zip('ABCDE',['1/8','2/8','5/8','6/8','7/8'])]
    probability['answer']={'value':'C','computedValue':'5/8','solution':'İlk mavi ayrılınca 8 topun5i kırmızıdır.'}
    boundary=audit(probability)
    assert boundary['mathPassed'] and boundary['status']=='pending_review' and 'exam_boundary_review_conditional_probability'in boundary['reasons']
    # The first mathematically eligible representative survives a numeric group.
    q=copy.deepcopy(base);q['id']='TEST-BAD';q['answer']['value']='A'
    q2=copy.deepcopy(base);q2['id']='TEST-GOOD'
    rows=[audit(q),audit(q2)];groups,rejected=duplicates([q,q2],rows)
    assert rejected['TEST-BAD']['duplicateOf']=='TEST-GOOD'
    print('Independent generated-bank QA self-test: 12 adversarial fixtures, guarded predicates and exact integral identities passed.')


def semantic_similarity_groups(questions,results):
    """Heuristic review leads, not proof that different contexts are duplicates."""
    buckets=defaultdict(list);by_id={row['id']:row for row in results};questions_by_id={q['id']:q for q in questions}
    for q in questions:
        spec=q.get('verificationSpec',{});operation=spec.get('operation')
        if operation not in ('root_stat','quadratic_vertex','derivative','integral','coefficient','term_count'):continue
        try:
            tree=ast.parse(clean_math(spec.get('expression','0')),mode='eval')
            # Preserve powers (different polynomial degree / requested term),
            # but suppress plain numeric coefficients for a semantic review lead.
            class Coefficients(ast.NodeTransformer):
                def visit_BinOp(self,node):
                    if isinstance(node.op,ast.Pow):
                        node.left=self.visit(node.left)
                        return node
                    return self.generic_visit(node)
                def visit_Constant(self,node):
                    return ast.copy_location(ast.Name(id='NUM',ctx=ast.Load()),node)
            shape=ast.dump(Coefficients().visit(tree),include_attributes=False)
            task={key:spec.get(key) for key in ('operation','statistic','power','order','coordinate','variables','powers')}
            key=json.dumps(task,sort_keys=True)+'|'+shape
            buckets[key].append(q['id'])
        except Exception:continue
    groups=[]
    for key,identifiers in buckets.items():
        if len(identifiers)<2:continue
        group_id='semantic-review-'+hashlib.sha256(key.encode()).hexdigest()[:16]
        groups.append({'groupId':group_id,'ids':identifiers,'action':'editorial_review','examplePrompts':[questions_by_id[identifier]['prompt'] for identifier in identifiers[:3]],'reason':'Same declared mathematical task and coefficient-neutral expression structure; distinct contexts may still teach a different representation.'})
        for identifier in identifiers:by_id[identifier]['semanticSimilarityGroup']=group_id
    return groups


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--input',action='append',type=Path)
    parser.add_argument('--self-test',action='store_true')
    parser.add_argument('--output',type=Path,default=ROOT/'work/generated-qa.json')
    args=parser.parse_args()
    if args.self_test:
        self_test();return
    paths=args.input or [ROOT/'work/generated-tyt.json',ROOT/'work/generated-ayt.json']
    questions=[];inputs=[]
    for path in paths:
        if not path.exists():continue
        raw=path.read_bytes();payload=json.loads(raw);questions.extend(payload if isinstance(payload,list) else payload.get('questions',[]))
        inputs.append({'path':str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),'sha256':hashlib.sha256(raw).hexdigest()})
    if not questions:raise SystemExit('No generated question inputs exist yet')
    results=[]
    def on_timeout(_signal,_frame):raise Pending('independent_verification_timeout')
    signal.signal(signal.SIGALRM,on_timeout)
    for q in questions:
        signal.alarm(20)
        try:results.append(audit(q))
        finally:signal.alarm(0)
    groups,rejected=duplicates(questions,results)
    semantic_groups=semantic_similarity_groups(questions,results)
    for row in results:
        if row['id'] in rejected:
            row['mathPassedBeforeDuplicateCheck']=row['mathPassed'];row['status']='duplicate_rejected';row['duplicateOf']=rejected[row['id']]['duplicateOf'];row['reasons'].append(rejected[row['id']]['kind']+'_duplicate')
    by_exam={}
    for exam_type in ('TYT','AYT'):
        subset=[r for r in results if r['examType']==exam_type]
        by_exam[exam_type]={'total':len(subset),'mathPassed':sum(r['mathPassed'] for r in subset),'verifiedUsable':sum(r['status']=='automated_verified' for r in subset),'pending':sum(r['status']=='pending_review' for r in subset),'duplicateRejected':sum(r['status']=='duplicate_rejected' for r in subset)}
    report={'schemaVersion':1,'validator':VERSION,'validatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sympyVersion':S.__version__,'inputs':inputs,
            'scope':'Independent exact result, 5-option/key matching, declared domain and literal prompt anchor; editorial review remains pending.',
            'limitations':['No publisher PDF inspected','Difficulty and complete natural-language intent need editorial review','Near-duplicate check covers exact/numeric-normalized stems; semantic paraphrases require editorial review','Only explicitly supported typed specifications pass'],
            'summary':{'total':len(results),'mathPassed':sum(r['mathPassed'] for r in results),'verifiedUsable':sum(r['status']=='automated_verified' for r in results),'pending':sum(r['status']=='pending_review' for r in results),'duplicateRejected':sum(r['status']=='duplicate_rejected' for r in results),'semanticSimilarityGroups':len(semantic_groups),'semanticSimilarityRecords':sum('semanticSimilarityGroup'in r for r in results),'byExam':by_exam},
            'records':results,'duplicateGroups':groups,'semanticSimilarityGroups':semantic_groups}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report['summary'],ensure_ascii=False))
    reasons=defaultdict(int)
    for row in results:
        for reason in row['reasons']:reasons[reason]+=1
    print(json.dumps(dict(sorted(reasons.items(),key=lambda p:-p[1])[:20]),ensure_ascii=False))

if __name__=='__main__':main()
