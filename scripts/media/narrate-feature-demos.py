#!/usr/bin/env python3
"""Render frame-reviewed narration windows without retiming the recorded picture.

See docs/feature-demos/voiceovers/README.md for setup and model attribution.
All intermediate/model files stay in ignored scratch/. No hosted TTS is used.
"""
import argparse
import hashlib
import json
import re
import subprocess
import textwrap
from pathlib import Path

import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / 'docs/feature-demos/voiceovers'
ASSETS = ROOT / 'public/videos/features'
WORK = ROOT / 'scratch/feature-demos/narration'
MODEL_HASHES = {
    'kokoro-v1.0.onnx': 'beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a',
    'voices-v1.0.bin': 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d',
}


def run(*args):
    return subprocess.check_output([str(a) for a in args], text=True)


def stamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}.{ms % 1000:03}'


def video_info(path):
    info = json.loads(run('ffprobe', '-v', 'error', '-show_streams', '-of', 'json', path))
    return next(s for s in info['streams'] if s['codec_type'] == 'video')


def video_hash(path):
    return run('ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-c', 'copy',
               '-f', 'hash', '-hash', 'sha256', '-').strip()


def phrases(text):
    # Synthesize each caption phrase separately so captions follow measured audio,
    # including natural sentence/clause pauses, rather than estimated word counts.
    result = []
    for sentence in re.split(r'(?<=[.!?])\s+', text):
        if len(sentence) > 95 and ', ' in sentence:
            result.extend(re.split(r'(?<=,)\s+', sentence))
        else:
            result.append(sentence)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--feature', action='append', help='Render only this feature; repeat as needed')
    args = parser.parse_args()
    data = json.loads((DOCS / 'cues.json').read_text())
    for name, expected in MODEL_HASHES.items():
        path = WORK / 'models' / name
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f'Model checksum mismatch: {path}')
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 4
    opts.inter_op_num_threads = 1
    session = ort.InferenceSession(str(WORK / 'models/kokoro-v1.0.onnx'),
                                   sess_options=opts, providers=['CPUExecutionProvider'])
    engine = Kokoro.from_session(session, str(WORK / 'models/voices-v1.0.bin'))
    cache = WORK / 'clips'
    cache.mkdir(exist_ok=True)
    report_path = DOCS / 'render-report.json'
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    voice = data['voice']

    def speech(text, speed):
        key = hashlib.sha256(json.dumps([voice, text, speed], sort_keys=True).encode()).hexdigest()
        path = cache / f'{key}.wav'
        if path.exists():
            samples, sr = sf.read(path, dtype='float32')
        else:
            samples, sr = engine.create(text, voice=voice['name'], speed=speed,
                                         lang=voice['language'])
            sf.write(path, samples, sr, subtype='FLOAT')
        if sr != 24000:
            raise ValueError(f'Unexpected sample rate: {sr}')
        return samples

    for script in data['scripts']:
        feature = script['feature']
        if args.feature and feature not in args.feature:
            continue
        source = ASSETS / f'{feature}.mp4'
        info = video_info(source)
        duration = float(info['duration'])
        if abs(duration - script['duration']) > 1 / 24:
            raise ValueError(f'{feature}: picture duration no longer matches reviewed cues')
        sr = 24000
        track = np.zeros(round(duration * sr), dtype=np.float32)
        rendered, captions = [], []
        last_end = 0
        for cue in script['cues']:
            start, deadline = cue['start_seconds'], cue['end_seconds']
            if not last_end <= start < deadline <= duration:
                raise ValueError(f'Invalid/overlapping cue window: {cue["id"]}')
            if any(start < boundary < deadline for boundary in script['chapters']):
                raise ValueError(f'Cue crosses a chapter cut: {cue["id"]}')
            last_end = deadline
            parts = phrases(cue['narration'])
            speed = voice['speed']
            for attempt in range(3):
                clips = [speech(part, speed) for part in parts]
                pauses = [round(sr * (0.12 if part.endswith(',') else 0.24)) for part in parts[:-1]]
                length = sum(map(len, clips)) + sum(pauses)
                available = (deadline - start - 0.12) * sr
                if length <= available:
                    break
                speed = round(speed * length / available + 0.015, 3)
                if speed > 1.08:
                    raise ValueError(f'{cue["id"]}: shorten narration; needs {length/sr:.2f}s in {deadline-start:.2f}s')
            else:
                raise ValueError(f'Cannot fit {cue["id"]}')
            position = round(start * sr)
            for i, (part, clip) in enumerate(zip(parts, clips)):
                # Avoid abrupt sample discontinuities at clip edges.
                clip = clip.copy()
                fade = min(round(sr * 0.006), len(clip) // 2)
                clip[:fade] *= np.linspace(0, 1, fade)
                clip[-fade:] *= np.linspace(1, 0, fade)
                track[position:position + len(clip)] = clip
                captions.append({'start': position / sr, 'end': (position + len(clip)) / sr, 'text': part})
                position += len(clip)
                if i < len(pauses):
                    position += pauses[i]
            row = {**cue, 'speech_end_seconds': round(position / sr, 3),
                   'speech_duration_seconds': round(length / sr, 3), 'speed': speed}
            rendered.append(row)
            print(f'{cue["id"]}: {length/sr:.2f}s / {deadline-start:.2f}s at {speed}', flush=True)
        wav = WORK / f'{feature}-narration.wav'
        sf.write(wav, track, sr, subtype='PCM_24')
        output = WORK / f'{feature}.mp4'
        # AAC padding is bounded to the original picture duration; video packets
        # are copied byte for byte, so narration cannot alter the recorded actions.
        run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-i', wav,
            '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k',
            '-ar', '48000', '-ac', '1', '-af', 'loudnorm=I=-18:TP=-2:LRA=7',
            '-metadata:s:a:0', 'language=eng', '-t', duration, '-movflags', '+faststart', output)
        before_hash = video_hash(source)
        if before_hash != video_hash(output) or info['nb_frames'] != video_info(output)['nb_frames']:
            raise ValueError(f'{feature}: recorded picture changed')
        run('ffmpeg', '-v', 'error', '-xerror', '-i', output, '-f', 'null', '-')
        output.replace(source)
        vtt = ['WEBVTT', '']
        for i, caption in enumerate(captions, 1):
            vtt += [str(i), f'{stamp(caption["start"])} --> {stamp(caption["end"])}',
                    '\n'.join(textwrap.wrap(caption['text'], width=48)), '']
        (ASSETS / f'{feature}.vtt').write_text('\n'.join(vtt))
        transcript = [script['title'], 'Recorded in Weavly Base with demonstration data. English narration generated locally with Kokoro.', '']
        for cue in rendered:
            transcript += [f'{stamp(cue["start_seconds"])} – {stamp(cue["speech_end_seconds"])}', cue['narration'], '']
        (ASSETS / f'{feature}.txt').write_text('\n'.join(transcript))
        meta_path = ASSETS / f'{feature}.json'
        meta = json.loads(meta_path.read_text())
        meta['bytes'] = source.stat().st_size
        meta['narration'] = {'engine': voice['engine'], 'voice': voice['name'], 'language': 'en',
                             'audio_codec': 'aac', 'sample_rate': 48000, 'channels': 1,
                             'cue_count': len(rendered), 'caption_count': len(captions)}
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
        report[feature] = {'duration_seconds': duration, 'video_frames': int(info['nb_frames']),
                           'video_packet_sha256': before_hash.split('=')[-1],
                           'bytes': source.stat().st_size, 'cues': rendered}
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    lines = ['# Feature demo narration scripts', '',
             'These are the final spoken scripts. Placement windows were reviewed against the recorded frames; speech end times are measured from the generated audio. Gaps are intentional viewing time. Caption phrases use their actual synthesized durations.', '',
             'Voice: Kokoro `af_heart`, English. Rebuild instructions and attribution: [README](README.md). Machine-readable input: [cues.json](cues.json). Measured output: [render-report.json](render-report.json).', '']
    for script in data['scripts']:
        feature = script['feature']
        if feature not in report:
            continue
        lines += [f'## {script["title"]}', '', '| Speech start–end | On-screen action | Narration |', '| --- | --- | --- |']
        for cue in report[feature]['cues']:
            lines.append(f'| {stamp(cue["start_seconds"])}–{stamp(cue["speech_end_seconds"])} | {cue["visual_anchor"]} | {cue["narration"]} |')
        lines.append('')
    (DOCS / 'voiceover-scripts.md').write_text('\n'.join(lines))


if __name__ == '__main__':
    main()
