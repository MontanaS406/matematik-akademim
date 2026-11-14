#!/usr/bin/env python3
"""Reproducible offline AI authoring/audit/build with hash-based resume.

This pipeline never contacts a model, uploads documents, writes Supabase, merges
branches or deploys the site. All authored structures are versioned local code.
"""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / 'work/ai-pipeline-state.json'

def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify static outputs without rewriting them')
    parser.add_argument('--force', action='store_true', help='Recompute audits even if input hashes match')
    args = parser.parse_args()
    (ROOT / 'work').mkdir(exist_ok=True)
    try:
        state = json.loads(STATE.read_text())
    except (FileNotFoundError, ValueError):
        state = {}
    archive = 'data/ai/archive-input.json'
    stages = [
        ('import-audit', ['scripts/imported-math-audit.py', archive], ['work/import-audit.json'],
         ['scripts/imported-math-audit.py', '--input', archive, '--output', 'work/import-audit.json', '--self-test']),
        ('author-TYT', ['scripts/generation/tyt_generator.py', 'scripts/generation/tyt_counting.py', archive], ['work/generated-tyt.json'],
         ['scripts/generation/tyt_generator.py', '--input', archive, '--output', 'work/generated-tyt.json']),
        ('author-AYT', ['scripts/generation/ayt_generator.py', archive], ['work/generated-ayt.json'],
         ['scripts/generation/ayt_generator.py', '--input', archive, '--output', 'work/generated-ayt.json']),
        ('generated-audit', ['scripts/verify-generated-bank.py', 'work/generated-tyt.json', 'work/generated-ayt.json'], ['work/generated-qa.json'],
         ['scripts/verify-generated-bank.py', '--input', 'work/generated-tyt.json', '--input', 'work/generated-ayt.json', '--output', 'work/generated-qa.json']),
        ('author-original-to-ai', ['scripts/generation/source_derived_generator.py', 'data/source-generation-evidence-v1.json'], ['work/issue11-generated-source-ai.json'],
         ['scripts/generation/source_derived_generator.py', '--source-evidence', 'data/source-generation-evidence-v1.json', '--output', 'work/issue11-generated-source-ai.json']),
        ('audit-original-to-ai', ['scripts/verify-generated-bank.py', 'work/issue11-generated-source-ai.json'], ['work/issue11-source-ai-qa.json'],
         ['scripts/verify-generated-bank.py', '--input', 'work/issue11-generated-source-ai.json', '--output', 'work/issue11-source-ai-qa.json']),
        ('author-source-expansion', ['scripts/generation/source_derived_expansion.py', 'scripts/generation/source_derived_generator.py', 'data/source-read-evidence.json'], ['work/nov14-source-expansion.json'],
         ['scripts/generation/source_derived_expansion.py', '--output', 'work/nov14-source-expansion.json']),
        ('author-verified-source-expansion', ['scripts/generation/verified_source_expansion.py', 'scripts/generation/source_derived_generator.py', 'data/source-read-evidence.json'], ['work/nov14-verified-source-expansion.json'],
         ['scripts/generation/verified_source_expansion.py', '--output', 'work/nov14-verified-source-expansion.json']),
        ('combine-source-expansion', ['scripts/combine_ai_batches.py', 'work/nov14-source-expansion.json', 'work/nov14-verified-source-expansion.json'], ['work/issue11-expanded-source-ai.json'],
         ['scripts/combine_ai_batches.py', '--input', 'work/nov14-source-expansion.json', '--input', 'work/nov14-verified-source-expansion.json', '--output', 'work/issue11-expanded-source-ai.json']),
        ('audit-source-expansion', ['scripts/verify-generated-bank.py', 'work/issue11-expanded-source-ai.json'], ['work/nov14-source-expansion-qa.json'],
         ['scripts/verify-generated-bank.py', '--input', 'work/issue11-expanded-source-ai.json', '--output', 'work/nov14-source-expansion-qa.json']),
    ]
    for label, inputs, outputs, command in stages:
        fingerprint = {path: sha(path) for path in inputs}
        previous = state.get(label, {})
        fresh = (not args.force and previous.get('inputs') == fingerprint
                 and all((ROOT / path).exists() and previous.get('outputs', {}).get(path) == sha(path) for path in outputs))
        if fresh:
            print(f'{label}: completed batch reused (matching input/output hashes)', flush=True)
            continue
        print(f'{label}: running', flush=True)
        subprocess.run([sys.executable, *command], cwd=ROOT, check=True)
        state[label] = {'inputs': fingerprint, 'outputs': {path: sha(path) for path in outputs}}
        temp = STATE.with_suffix('.tmp')
        temp.write_text(json.dumps(state, sort_keys=True, indent=2) + '\n')
        temp.replace(STATE)
    subprocess.run([sys.executable, 'scripts/verify-generated-bank.py', '--self-test'], cwd=ROOT, check=True)
    subprocess.run([sys.executable, 'scripts/build-ai-bank.py', '--self-test'], cwd=ROOT, check=True)
    subprocess.run([sys.executable, 'scripts/ingest_private_source_pdfs.py', '--self-test'], cwd=ROOT, check=True)
    subprocess.run([sys.executable, 'scripts/build_source_catalog.py', *(['--check'] if args.check else [])], cwd=ROOT, check=True)
    subprocess.run([sys.executable, 'scripts/build-ai-bank.py', *(['--check'] if args.check else [])], cwd=ROOT, check=True)

if __name__ == '__main__':
    main()
