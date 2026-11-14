#!/usr/bin/env python3
"""Combine completed offline authoring batches without modifying their records."""
import argparse
import hashlib
import json
from pathlib import Path

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input',action='append',required=True)
    p.add_argument('--output',required=True)
    a=p.parse_args();questions=[];ledger=[];bindings=[]
    for file in a.input:
        raw=Path(file).read_bytes();b=json.loads(raw)
        questions.extend(b['questions']);ledger.extend(b.get('ledger',[]))
        bindings.append({'fileName':Path(file).name,'sha256':hashlib.sha256(raw).hexdigest()})
    if len({q['id'] for q in questions})!=len(questions):raise ValueError('Overlapping authored IDs')
    output={'schemaVersion':1,'version':'source-expansion-combined-v1','inputs':bindings,'questions':questions,'ledger':ledger}
    Path(a.output).write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    print('Combined completed question batches:',len(questions))
