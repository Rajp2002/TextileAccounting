#!/usr/bin/env python3
"""ROUND 2 (owner-requested follow-up): copies the tablet-column and Assignments columns-grid evidence into evidence-round2/ and writes manifest-round2.json.
Round-1 evidence/ and manifest.json are not touched.

All JSON records, command logs and classification files are copied. Screenshots are curated (the complete set stays in
scratch/tour-fix-review-results/, which is git-ignored); every screenshot that is not copied is listed in the manifest
with its size and SHA-256 so the omission is auditable. Nothing is edited, renamed inside a record, or re-classified.

    python3 qa-artifacts/guided-tours/2026-09-30-bv01-bv02-fixes/package-evidence-round2.py
"""
import glob
import hashlib
import json
import os
import shutil
import subprocess
import sys

BUNDLE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BUNDLE, '../../..'))
RES = os.path.join(ROOT, 'scratch/tour-fix-review-results')
OUT = os.path.join(BUNDLE, 'evidence-round2')
CONTACTS = os.path.join(ROOT, 'scratch/contacts')

def latest(prefix):
    found = sorted(glob.glob(os.path.join(RES, prefix + '-2*')))
    return [os.path.basename(found[-1])] if found else []


RUNS = {
    'baseline-gt05-768-runner': latest('round2-baseline-768'),
    'baseline-gt05-768-settled-probe': latest('round2-baseline-tr768'),
    'first-try-gt15-columns-grid': latest('round2-gt15-try'),
    'first-try-gt05-tablet-column': latest('round2-gt05-try'),
    'explore-r2': latest('round2-explore'),
    'probe-768x600': latest('round2-tr768x600'),
    'final-archived': latest('round2-final-archived'),
    'final-extras': latest('round2-final-extras'),
    'final-transitions': latest('round2-final-transitions'),
    'stability-1': latest('round2-stability-1'),
    'stability-2': latest('round2-stability-2'),
    'stability-3': latest('round2-stability-3'),
    # 768x600 before the 16px sheet shift: 4 of 5 repeats failed at est-handoff (792 px2, outline mid-flight at the 900 ms sample).
    **{f'before-shift-768x600-repeat-{i}': latest(f'round2-repeat768x600-{i}') for i in range(1, 6)},
    # After the shift (sheet at left 420 / right 20): 768x600 and the whole 768-1023 band re-verified.
    **{f'after-shift-768x600-repeat-{i}': latest(f'round2b-768x600-{i}') for i in range(1, 9)},
    'after-shift-tablet-cases': latest('round2b-tablet-cases'),
    'after-shift-tablet-transitions': latest('round2b-tablet-transitions'),
    **{f'after-shift-stability-{i}': latest(f'round2b-stability-{i}') for i in range(1, 4)},
}
# Screenshots worth keeping in git, chosen per evidence group by file-name suffix inside each job folder.
KEEP_IMAGES = {
    # Failing baseline: the two tall cards and the step-10 frame at 768x1024, English only.
    'baseline-gt05-768-runner': lambda job, name: job.startswith('x05-base-en') and name in ('02.png', '03.png'),
    'baseline-gt05-768-settled-probe': lambda job, name: False,
    'first-try-gt15-columns-grid': lambda job, name: name == '01.png' and 'en-1024' in job,
    'first-try-gt05-tablet-column': lambda job, name: name == '09.png' and 'en-768' in job,
    'explore-r2': lambda job, name: False,
    'probe-768x600': lambda job, name: False,
    'final-archived': lambda job, name: (job.startswith('gt15') and name == '01.png' and any(k in job for k in ('0-en-1024', '1-hi-1280', 'night-focus-hi-1280', '0-gu-390'))) or (job.startswith('gt05-0-gu-390') and name == '09.png'),
    'final-extras': lambda job, name: name == '01.png' and job in ('x15-pop-en-1366x768', 'x15-pop-en-1024x600', 'x15-pop-gu-1024x768', 'x15-empty-hi-1024x768', 'r2-x15-pop-en-1024x1366', 'r2-x15-pop-hi-1440x900'),
    'final-transitions': lambda job, name: 'ma-purpose-back-2000ms' in name and job in ('tr15-pop-en-1024x768', 'tr15-pop-hi-1280x800'),
    'stability-1': lambda job, name: False,
    'stability-2': lambda job, name: False,
    'stability-3': lambda job, name: False,
    **{f'before-shift-768x600-repeat-{i}': (lambda job, name, i=i: name == '10.png' and i == 1) for i in range(1, 6)},
    **{f'after-shift-768x600-repeat-{i}': (lambda job, name: False) for i in range(1, 9)},
    'after-shift-tablet-cases': lambda job, name: (name in ('02.png', '09.png') and job in ('x05-base-en-768x1024', 'x05-base-gu-768x1024')) or (name == '09.png' and job in ('r2-x05-base-en-768x600', 'r2-x05-base-en-1023x768')),
    'after-shift-tablet-transitions': lambda job, name: 'est-handoff-back-2000ms' in name and job in ('tr05-base-en-768x1024', 'tr05-base-en-768x600'),
    **{f'after-shift-stability-{i}': (lambda job, name: False) for i in range(1, 4)},
}
NETWORK_FOR = {'final-archived', 'baseline-gt05-768-runner', 'after-shift-tablet-cases'}
CONTACT_SHEETS = ['round2-x05-base-en-768x1024', 'round2-x05-base-gu-768x1024', 'round2-x05-base-en-768x600']

manifest = {'files': [], 'omittedImages': []}


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def add(kind, source, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copy2(source, dest)
    manifest['files'].append({'path': os.path.relpath(dest, BUNDLE), 'bytes': os.path.getsize(dest), 'sha256': sha256(dest), 'kind': kind})


def omit(source):
    manifest['omittedImages'].append({'source': os.path.relpath(source, RES), 'bytes': os.path.getsize(source), 'sha256': sha256(source)})


if os.path.isdir(OUT):
    raise SystemExit('evidence/ already exists; remove it first if you intend to regenerate the bundle.')
os.makedirs(OUT)
for group, folders in RUNS.items():
    for folder in folders:
        base = os.path.join(RES, folder)
        if not os.path.isdir(base):
            print('missing', base, file=sys.stderr)
            continue
        results = os.path.join(base, 'results.json')
        if os.path.exists(results):
            add('results', results, os.path.join(OUT, group, folder, 'results.json'))
        for job in sorted(d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))):
            job_dir = os.path.join(base, job)
            for name in ('command.log',) + (('network.json',) if group in NETWORK_FOR else ()):
                if os.path.exists(os.path.join(job_dir, name)):
                    add(name.split('.')[0], os.path.join(job_dir, name), os.path.join(OUT, group, folder, job, name))
            for source in sorted(glob.glob(os.path.join(job_dir, '**', '*'), recursive=True)):
                if os.path.isdir(source):
                    continue
                rel = os.path.relpath(source, job_dir)
                if rel in ('command.log', 'network.json'):
                    continue
                name = os.path.basename(source)
                if name == 'record.json':
                    add('record', source, os.path.join(OUT, group, folder, job, rel))
                elif name.endswith('.png'):
                    if KEEP_IMAGES[group](job, name):
                        add('screenshot', source, os.path.join(OUT, group, folder, job, rel))
                    else:
                        omit(source)

# Contact sheets, converted to JPEG to keep the bundle small (they are for human inspection only).
try:
    from PIL import Image
    for sheet in CONTACT_SHEETS:
        source = os.path.join(CONTACTS, sheet + '.png')
        if os.path.exists(source):
            dest = os.path.join(OUT, 'contact-sheets', sheet + '.jpg')
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            Image.open(source).convert('RGB').save(dest, quality=80)
            manifest['files'].append({'path': os.path.relpath(dest, BUNDLE), 'bytes': os.path.getsize(dest), 'sha256': sha256(dest), 'kind': 'contact-sheet'})
except ImportError:
    print('Pillow missing; contact sheets skipped', file=sys.stderr)

# Machine-readable classification of every run group that used the run-matrix / first-helper result format.
node = shutil.which('node')
for group in ('baseline-gt05-768-runner', 'first-try-gt15-columns-grid', 'first-try-gt05-tablet-column', 'explore-r2', 'final-archived', 'final-extras', 'stability-1', 'stability-2', 'stability-3', *[f'before-shift-768x600-repeat-{i}' for i in range(1, 6)], *[f'after-shift-768x600-repeat-{i}' for i in range(1, 9)], 'after-shift-tablet-cases', *[f'after-shift-stability-{i}' for i in range(1, 4)]):
    if not RUNS.get(group):
        continue
    folder = RUNS[group][0]
    dest = os.path.join(OUT, 'classification', group + '.json')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    subprocess.run([node, os.path.join(BUNDLE, 'classify.mjs'), os.path.join(RES, folder), '--json', dest], capture_output=True, text=True)
    if os.path.exists(dest):
        manifest['files'].append({'path': os.path.relpath(dest, BUNDLE), 'bytes': os.path.getsize(dest), 'sha256': sha256(dest), 'kind': 'classification'})

manifest['note'] = ('Complete originals, including every omitted screenshot listed under omittedImages, remain in the git-ignored '
                    'scratch/tour-fix-review-results/. Absolute paths inside copied records refer to the original checkout; resolve their suffix '
                    'after scratch/tour-fix-review-results/ against this evidence/ directory.')
with open(os.path.join(BUNDLE, 'manifest-round2.json'), 'w') as handle:
    json.dump(manifest, handle, indent=1)
total = sum(f['bytes'] for f in manifest['files'])
print(f"{len(manifest['files'])} files copied ({total / 1e6:.1f} MB); {len(manifest['omittedImages'])} screenshots listed as omitted")
