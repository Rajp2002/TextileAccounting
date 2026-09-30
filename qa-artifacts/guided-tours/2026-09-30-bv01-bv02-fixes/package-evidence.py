#!/usr/bin/env python3
"""Copies the BV-01/BV-02 fix evidence out of the git-ignored scratch results into evidence/ and writes manifest.json.

All JSON records, command logs and classification files are copied. Screenshots are curated (the complete set stays in
scratch/tour-fix-review-results/, which is git-ignored); every screenshot that is not copied is listed in the manifest
with its size and SHA-256 so the omission is auditable. Nothing is edited, renamed inside a record, or re-classified.

    python3 qa-artifacts/guided-tours/2026-09-30-bv01-bv02-fixes/package-evidence.py
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
OUT = os.path.join(BUNDLE, 'evidence')
CONTACTS = os.path.join(ROOT, 'scratch/contacts')

RUNS = {
    'invalid-environment-unstyled': ['BV-01-2026-09-29T23-27-21-410Z', 'BV-01-2026-09-29T23-31-02-749Z'],
    'baseline-prefix-bv01': ['BV-01-2026-09-29T23-35-16-455Z'],
    'baseline-prefix-bv02': ['BV-02-2026-09-29T23-37-55-203Z'],
    'postfix-bv01': ['BV-01-2026-09-29T23-51-11-905Z'],
    'postfix-bv02': ['BV-02-2026-09-29T23-57-17-929Z'],
    'final-archived': ['final-archived-2026-09-30T01-14-22-125Z'],
    'extras': ['extras-explore-2026-09-30T00-06-38-668Z'],
    'detailed-localized': ['detailed-localized-2026-09-30T00-44-06-602Z'],
    'control-768-without-fix': ['prefix-768-control-2026-09-30T00-42-03-410Z'],
    'transitions-v1-strict-actual-target': ['transitions-2026-09-30T00-46-47-306Z'],
    'transitions-v1b-either-axis-clip': ['final-transitions-2026-09-30T01-39-51-207Z'],
}
V2 = sorted(glob.glob(os.path.join(RES, 'final-transitions-v2-*')))
if V2:
    RUNS['transitions-v2-final'] = [os.path.basename(V2[-1])]

# Screenshots worth keeping in git, chosen per evidence group by file-name suffix inside each job folder.
KEEP_IMAGES = {
    'invalid-environment-unstyled': lambda job, name: name == '00-page.png' and job.startswith('gt05-0'),
    'baseline-prefix-bv01': lambda job, name: name == '09.png',
    'baseline-prefix-bv02': lambda job, name: name == '01.png' and any(k in job for k in ('gt15-0-en-1024', 'gt15-1-hi-1280', 'gt15-0-hi-1280', 'gt15-1-en-1024')),
    'postfix-bv01': lambda job, name: name in ('08.png', '09.png', '10.png') and job.startswith('gt05-0') or (name == '09.png'),
    'postfix-bv02': lambda job, name: name == '01.png',
    'final-archived': lambda job, name: (job.startswith('gt05') and name in ('09.png',) and ('gu-390' in job or 'en-1440' in job or 'hi-1280' in job or 'en-1024' in job))
    or (job.startswith('gt15') and name == '01.png'),
    'extras': lambda job, name: (name == '09.png' and job.startswith('x05-') and any(k in job for k in ('base-gu-360', 'base-gu-375', 'base-gu-430', 'base-en-390', 'base-hi-390', 'free-gu-360', 'free-en-390')))
    or (name == '01.png' and job.startswith('x15-') and any(k in job for k in ('1366', '1920', '1024x600', '768x1024', 'gu-1024', 'hi-1024', 'gu-360', 'en-390'))),
    'detailed-localized': lambda job, name: name == '99-after.png',
    'control-768-without-fix': lambda job, name: name == '10.png',
    'transitions-v1-strict-actual-target': lambda job, name: False,
    'transitions-v1b-either-axis-clip': lambda job, name: False,
    'transitions-v2-final': lambda job, name: any(k in name for k in ('est-save-back-2000ms', 'ma-purpose-back-2000ms', 'est-save-next-again-2000ms')) and any(
        k in job for k in ('base-gu-390', 'free-gu-390', 'base-gu-360', 'base-en-844x390', 'pop-en-1024x768', 'pop-hi-1280', 'pop-gu-390')),
}
NETWORK_FOR = {'baseline-prefix-bv01', 'baseline-prefix-bv02', 'postfix-bv01', 'postfix-bv02', 'final-archived', 'control-768-without-fix'}
CONTACT_SHEETS = ['final-gt05-0-gu-390x844', 'final-gt05-2-gu-390x844', 'final-gt05-0-en-1024x768', 'final-gt15-0-en-1024x768', 'final-gt15-0-hi-1280x800', 'final-gt15-night-focus-hi-1280x800']

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
for group, folder in [('baseline-prefix-bv01', RUNS['baseline-prefix-bv01'][0]), ('baseline-prefix-bv02', RUNS['baseline-prefix-bv02'][0]),
                      ('postfix-bv01', RUNS['postfix-bv01'][0]), ('postfix-bv02', RUNS['postfix-bv02'][0]), ('final-archived', RUNS['final-archived'][0]),
                      ('extras', RUNS['extras'][0]), ('detailed-localized', RUNS['detailed-localized'][0]), ('control-768-without-fix', RUNS['control-768-without-fix'][0])]:
    dest = os.path.join(OUT, 'classification', group + '.json')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    subprocess.run([node, os.path.join(BUNDLE, 'classify.mjs'), os.path.join(RES, folder), '--json', dest], capture_output=True, text=True)
    if os.path.exists(dest):
        manifest['files'].append({'path': os.path.relpath(dest, BUNDLE), 'bytes': os.path.getsize(dest), 'sha256': sha256(dest), 'kind': 'classification'})

manifest['note'] = ('Complete originals, including every omitted screenshot listed under omittedImages, remain in the git-ignored '
                    'scratch/tour-fix-review-results/. Absolute paths inside copied records refer to the original checkout; resolve their suffix '
                    'after scratch/tour-fix-review-results/ against this evidence/ directory.')
with open(os.path.join(BUNDLE, 'manifest.json'), 'w') as handle:
    json.dump(manifest, handle, indent=1)
total = sum(f['bytes'] for f in manifest['files'])
print(f"{len(manifest['files'])} files copied ({total / 1e6:.1f} MB); {len(manifest['omittedImages'])} screenshots listed as omitted")
