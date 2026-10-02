#!/usr/bin/env python3
"""Encode reviewed browser takes and publish small, seekable plan-page videos.

Usage: python scripts/media/assemble-feature-demos.py path/to/manifest.json
Manifest keys: feature, title, poster_seconds, clips[{file, title, description}].
Clips may have a duration limit or segments [{start, end}] to remove idle pauses.
No login state or credentials belong in this manifest or in the published media.
"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[2]
OUTPUT = REPO / 'public/videos/features'

def run(args):
    return subprocess.run(args, check=True, text=True, capture_output=True).stdout

def duration(path):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(path)]))

def timestamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d}.{ms % 1000:03d}'

def assemble(manifest):
    feature = manifest['feature']
    if feature not in {'estimator', 'qualities', 'rates', 'costings', 'production', 'payroll'}:
        raise ValueError('Unknown feature')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    captions, chapters = ['WEBVTT\n'], []
    transcript = [manifest['title'], 'Recorded in Weavly Base with demonstration data. No audio.\n']
    elapsed = 0
    with tempfile.TemporaryDirectory(prefix='weavly-demo-') as tmp:
        temp = Path(tmp)
        files = []
        for index, clip in enumerate(manifest['clips']):
            source = REPO / clip['file']
            title_path = temp / f'title-{index}.txt'
            title_path.write_text(f"{manifest['title']}  |  {index + 1}. {clip['title']}")
            encoded = temp / f'{index:02d}.mp4'
            # Add an unobtrusive chapter strip above the unmodified viewport.
            vf = (f"fps=24,pad=iw:ih+60:0:60:color=0x111b32,"
                  f"drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:"
                  f"textfile={title_path}:fontcolor=white:fontsize=22:x=24:y=18")
            filters = ['-vf', vf]
            if 'segments' in clip:
                segments = clip['segments']
                trims = []
                for n, segment in enumerate(segments):
                    start, end = float(segment['start']), float(segment['end'])
                    if not 0 <= start < end <= duration(source) + 0.01:
                        raise ValueError('Invalid clip segment')
                    trims.append(f'[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[s{n}]')
                joined = ''.join(f'[s{n}]' for n in range(len(segments)))
                filters = ['-filter_complex', ';'.join(trims) + f';{joined}concat=n={len(segments)}:v=1:a=0,{vf}[video]', '-map', '[video]']
            run(['ffmpeg', '-y', '-v', 'error', '-i', str(source), *(['-t', str(clip['duration'])] if 'duration' in clip else []), *filters,
                 '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                 '-pix_fmt', 'yuv420p', '-threads', '2', str(encoded)])
            length = duration(encoded)
            files.append(encoded)
            captions.append(f"{index+1}\n{timestamp(elapsed)} --> {timestamp(elapsed + length)}\n{clip['description']}\n")
            chapters.append({'start': round(elapsed, 3), 'title': clip['title'], 'description': clip['description']})
            transcript.append(f"{timestamp(elapsed)} — {clip['title']}\n{clip['description']}\n")
            elapsed += length
        concat = temp / 'concat.txt'
        concat.write_text(''.join(f"file '{p}'\n" for p in files))
        output = OUTPUT / f'{feature}.mp4'
        run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(concat),
             '-c', 'copy', '-movflags', '+faststart', str(output)])
        run(['ffmpeg', '-y', '-v', 'error', '-ss', str(manifest.get('poster_seconds', 2)),
             '-i', str(output), '-frames:v', '1', '-q:v', '3', str(OUTPUT / f'{feature}.jpg')])
    (OUTPUT / f'{feature}.vtt').write_text('\n'.join(captions))
    (OUTPUT / f'{feature}.txt').write_text('\n'.join(transcript))
    result = {'feature': feature, 'duration': round(duration(output), 3), 'bytes': output.stat().st_size, 'chapters': chapters}
    (OUTPUT / f'{feature}.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))

if __name__ == '__main__':
    assemble(json.loads(Path(sys.argv[1]).read_text()))
