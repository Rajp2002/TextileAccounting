#!/usr/bin/env python3
"""Generate cached IndicF5/Indic Parler cues and mux localized demo narration.

Requires a Hugging Face read token (HF_TOKEN or HF_TOKEN_PATH) for generation.
Assembly uses cached WAVs and never needs credentials. See the voiceover README.
"""
import argparse
import hashlib
import json
import math
import shutil
import subprocess
import sys
import textwrap
import time
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / 'docs/feature-demos/voiceovers'
ASSETS = ROOT / 'public/videos/features'
WORK = ROOT / 'scratch/feature-demos/narration'
SPACE = 'ai4bharat/IndicF5'
REFERENCE_TEXT = 'दिगंतराव्दारे अंतराळ कक्षेतला कचरा चिन्हित करण्यासाठी प्रयत्न केले जात आहे.'
REFERENCE = 'MAR_F_WIKI_00001.wav'
REFERENCE_SHA256 = '281ae552ef2b4732c87c7ad3dd014acd5a95f3f40d26536719ab394ca937c78a'
REFERENCE_URL = f'https://raw.githubusercontent.com/AI4Bharat/IndicF5/13f7c4d627cc10111aea8fe9c0039462cacacdc7/prompts/{REFERENCE}'
MODEL_REVISION = 'ba85abedf18dc479a447eaa0eccbd76ab78a47d5'
VOICE = {'engine': 'AI4Bharat IndicF5', 'reference': REFERENCE,
         'model_revision': MODEL_REVISION, 'generation': 'Official AI4Bharat Hugging Face Space'}
PARLER_VOICE = {
    'engine': 'AI4Bharat Indic Parler-TTS', 'speaker': 'Neha',
    'model_revision': '7b527af5ee8ed1f9a28d80b19703ed9bb8ba10ca',
    'description': 'Neha speaks at a moderate pace in a clear, calm, slightly expressive voice. '
                   'The recording is very high quality, with very clear audio, no background noise and a close-sounding voice.',
}
LANGUAGES = {'hi': ('Hindi', 'हिन्दी', 'hin'), 'gu': ('Gujarati', 'ગુજરાતી', 'guj')}


def run(*args):
    return subprocess.check_output([str(a) for a in args], text=True)


def stamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}.{ms % 1000:03}'


def clip_path(language, cue):
    voice = PARLER_VOICE if language == 'gu' else VOICE
    key = hashlib.sha256(json.dumps([voice, language, cue['narration']], sort_keys=True).encode()).hexdigest()
    return WORK / 'indic-clips' / f'{language}-{cue["id"]}-{key[:20]}.wav'


def video_info(path):
    streams = json.loads(run('ffprobe', '-v', 'error', '-show_streams', '-of', 'json', path))['streams']
    return next(s for s in streams if s['codec_type'] == 'video')


def video_hash(path):
    return run('ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-c', 'copy',
               '-f', 'hash', '-hash', 'sha256', '-').strip().split('=')[-1]


def reference_path():
    path = WORK / 'models/IndicF5/prompts' / REFERENCE
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        urllib.request.urlretrieve(REFERENCE_URL, path)
    if hashlib.sha256(path.read_bytes()).hexdigest() != REFERENCE_SHA256:
        raise ValueError('Stock reference checksum mismatch')
    return path


def generate(scripts):
    from gradio_client import Client, handle_file
    from huggingface_hub import get_token

    token = get_token()
    if not token:
        raise ValueError('Configure HF_TOKEN or HF_TOKEN_PATH outside the repository before generation.')
    reference = reference_path()
    client = None
    for language, script in scripts:
        for cue in script['cues']:
            target = clip_path(language, cue)
            if target.exists():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            if client is None:
                client = Client(SPACE, hf_token=token, verbose=False)
            # One request at a time. Stop on quota/server failures; a subsequent run
            # resumes from the cache without repeating successful requests.
            result = client.predict(text=cue['narration'], ref_audio=handle_file(str(reference)),
                                    ref_text=REFERENCE_TEXT, api_name='/synthesize_speech')
            samples, sr = sf.read(result, dtype='float32')
            if sr != 24000 or samples.ndim != 1 or len(samples) < sr / 4 or not np.isfinite(samples).all():
                raise ValueError(f'Invalid generated audio: {language}/{cue["id"]}')
            shutil.copyfile(result, target)
            target.with_suffix('.json').write_text(json.dumps({'backend': 'Official AI4Bharat Hugging Face Space'}))
            available = cue['end_seconds'] - cue['start_seconds'] - 0.12
            print(f'{language}/{cue["id"]}: {len(samples)/sr:.2f}s / {available:.2f}s available', flush=True)


def generate_local(scripts, steps=32, threads=4):
    import torch
    from safetensors.torch import load_file

    repo = WORK / 'models/IndicF5'
    for name, expected in {
        'model.safetensors': 'ba7f3671180fb7784e24bd1dafc96e729a38ce02e7f6d3877cdef32525a1865c',
        'checkpoints/vocab.txt': 'd3a5ff6aac12ea4fb50628a66a97b20c1e83b9e5ca356e5afae17b511cda96df',
    }.items():
        if hashlib.sha256((repo / name).read_bytes()).hexdigest() != expected:
            raise ValueError(f'Model checksum mismatch: {name}')
    sys.path.insert(0, str(repo))
    from f5_tts.model import CFM, DiT
    from f5_tts.model.utils import get_tokenizer
    from f5_tts.infer.utils_infer import load_vocoder, infer_process, preprocess_ref_audio_text

    torch.set_num_threads(threads)
    torch.set_num_interop_threads(1)
    vocab, size = get_tokenizer(str(repo / 'checkpoints/vocab.txt'), 'custom')
    model = CFM(transformer=DiT(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512,
                                conv_layers=4, text_num_embeds=size, mel_dim=100),
                mel_spec_kwargs=dict(n_fft=1024, hop_length=256, win_length=1024, n_mel_channels=100,
                                     target_sample_rate=24000, mel_spec_type='vocos'), vocab_char_map=vocab)
    state = load_file(str(repo / 'model.safetensors'))
    model.load_state_dict({k.removeprefix('ema_model._orig_mod.'): v for k, v in state.items()
                           if k.startswith('ema_model._orig_mod.')})
    del state
    model.eval()
    vocoder = load_vocoder(device='cpu')
    reference, reference_text = preprocess_ref_audio_text(str(reference_path()), REFERENCE_TEXT)
    print(f'Local IndicF5 loaded; {steps} inference steps, stock Marathi reference', flush=True)
    for language, script in scripts:
        for cue in script['cues']:
            target = clip_path(language, cue)
            if target.exists():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            started = time.monotonic()
            torch.manual_seed(42)
            with torch.autocast(device_type='cpu', dtype=torch.bfloat16):
                samples, sr, _ = infer_process(reference, reference_text, cue['narration'], model, vocoder,
                                               nfe_step=steps, speed=1.0, device='cpu')
            if sr != 24000 or not np.isfinite(samples).all():
                raise ValueError(f'Invalid generated audio: {language}/{cue["id"]}')
            sf.write(target, samples, sr)
            target.with_suffix('.json').write_text(json.dumps({'backend': 'Local CPU', 'seed': 42, 'steps': steps}))
            available = cue['end_seconds'] - cue['start_seconds'] - 0.12
            print(f'{language}/{cue["id"]}: {len(samples)/sr:.2f}s / {available:.2f}s available; '
                  f'{time.monotonic()-started:.1f}s generation', flush=True)


def save_parler_clip(samples, sr, cue, metadata):
    # Remove only quiet edges, retaining a margin around the spoken utterance.
    # Interior pauses and all voiced samples remain intact.
    frame = max(1, round(sr * 0.01))
    padded = np.pad(samples, (0, (-len(samples)) % frame))
    rms = np.sqrt(np.mean(padded.reshape(-1, frame) ** 2, axis=1))
    voiced = np.flatnonzero(rms > 10 ** (-50 / 20))
    if not len(voiced) or not np.isfinite(samples).all():
        raise ValueError(f'Invalid generated audio: gu/{cue["id"]}')
    start = max(0, voiced[0] * frame - round(sr * 0.1))
    end = min(len(samples), (voiced[-1] + 1) * frame + round(sr * 0.18))
    target = clip_path('gu', cue)
    target.parent.mkdir(parents=True, exist_ok=True)
    intermediate = WORK / f'parler-{cue["id"]}-raw.wav'
    sf.write(intermediate, samples[start:end], sr, subtype='PCM_24')
    temporary = target.with_suffix('.partial.wav')
    run('ffmpeg', '-v', 'error', '-y', '-i', intermediate, '-ar', '24000', '-ac', '1', temporary)
    temporary.replace(target)
    target.with_suffix('.json').write_text(json.dumps({**metadata,
        'untrimmed_duration_seconds': len(samples) / sr,
        'trim_start_seconds': start / sr, 'trim_end_seconds': (len(samples) - end) / sr}))
    return sf.info(target).duration


def generate_parler(scripts, batch_size):
    import torch
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer

    repo = WORK / 'models/indic-parler-tts'
    expected = 'c68daecb60f80c8f1faf0a6d2e6ddd6de8e224fb19750f3e9a33bca43c552c90'
    if hashlib.sha256((repo / 'model.safetensors').read_bytes()).hexdigest() != expected:
        raise ValueError('Indic Parler model checksum mismatch')
    pending = [cue for _, script in scripts for cue in script['cues'] if not clip_path('gu', cue).exists()]
    if not pending:
        return
    # Similar-length batches share decoder work without imposing a shared audio
    # duration. Each item is cropped to its own EOS length returned by the model.
    pending.sort(key=lambda cue: len(cue['narration'].encode('utf-8')))
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    model = ParlerTTSForConditionalGeneration.from_pretrained(str(repo), torch_dtype=torch.bfloat16).eval()
    tokenizer = AutoTokenizer.from_pretrained(str(repo), padding_side='left')
    description_tokenizer = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path, padding_side='left')
    print(f'Local Indic Parler loaded; Gujarati Neha, batch size {batch_size}', flush=True)
    for offset in range(0, len(pending), batch_size):
        batch = pending[offset:offset + batch_size]
        description = description_tokenizer([PARLER_VOICE['description']] * len(batch), padding=True, return_tensors='pt')
        prompt = tokenizer([cue['narration'] for cue in batch], padding=True, return_tensors='pt')
        torch.manual_seed(42)
        started = time.monotonic()
        with torch.inference_mode():
            output = model.generate(input_ids=description.input_ids, attention_mask=description.attention_mask,
                                    prompt_input_ids=prompt.input_ids, prompt_attention_mask=prompt.attention_mask,
                                    max_new_tokens=1800, return_dict_in_generate=True)
        sr = model.config.sampling_rate
        ids = [cue['id'] for cue in batch]
        for index, cue in enumerate(batch):
            length = int(output.audios_length[index])
            samples = output.sequences[index, :length].float().cpu().numpy().squeeze()
            if len(samples) / sr > 20:
                raise ValueError(f'Possible generation limit/repetition: gu/{cue["id"]}')
            duration = save_parler_clip(samples, sr, cue, {'backend': 'Local CPU', 'seed': 42,
                'batch': ids, 'precision': 'bfloat16'})
            available = cue['end_seconds'] - cue['start_seconds'] - 0.12
            print(f'gu/{cue["id"]}: {duration:.2f}s / {available:.2f}s available', flush=True)
        print(f'Batch completed in {time.monotonic()-started:.1f}s: {ids}', flush=True)


def assemble(language, script):
    voice = PARLER_VOICE if language == 'gu' else VOICE
    feature = script['feature']
    source = ASSETS / f'{feature}.mp4'
    info = video_info(source)
    duration = float(info['duration'])
    if abs(duration - script['duration']) > 1 / 24:
        raise ValueError(f'{feature}: picture duration no longer matches reviewed cues')
    sr = 24000
    track = np.zeros(round(duration * sr), dtype=np.float32)
    rendered = []
    last_end = 0
    for cue in script['cues']:
        start, deadline = cue['start_seconds'], cue['end_seconds']
        if not last_end <= start < deadline <= duration:
            raise ValueError(f'Invalid/overlapping cue window: {cue["id"]}')
        if any(start < boundary < deadline for boundary in script['chapters']):
            raise ValueError(f'Cue crosses a chapter cut: {cue["id"]}')
        last_end = deadline
        path = clip_path(language, cue)
        samples, actual_sr = sf.read(path, dtype='float32')
        if actual_sr != sr or samples.ndim != 1:
            raise ValueError(f'Unexpected audio format: {path}')
        original_duration = len(samples) / sr
        available = deadline - start - 0.12
        speed = max(1.0, math.ceil(original_duration / available * 1000) / 1000)
        if speed > 1.08:
            raise ValueError(f'{language}/{cue["id"]}: shorten narration; needs {original_duration:.2f}s in {available:.2f}s')
        if speed > 1:
            adjusted = WORK / f'{language}-{cue["id"]}-fitted.wav'
            # atempo works in audio windows, so its actual output can be a few
            # milliseconds longer than duration / speed. Measure each result
            # and stay within the same 8% limit instead of clipping its ending.
            while True:
                run('ffmpeg', '-v', 'error', '-y', '-i', path, '-af', f'atempo={speed}', adjusted)
                samples, _ = sf.read(adjusted, dtype='float32')
                if len(samples) / sr <= available or speed >= 1.08:
                    break
                speed = min(1.08, round(speed + 0.002, 3))
        if len(samples) / sr > available:
            raise ValueError(f'Cue exceeds its window after fitting: {cue["id"]}')
        fade = min(round(sr * 0.006), len(samples) // 2)
        samples[:fade] *= np.linspace(0, 1, fade)
        samples[-fade:] *= np.linspace(1, 0, fade)
        position = round(start * sr)
        track[position:position + len(samples)] = samples
        rendered.append({**cue, 'speech_end_seconds': round((position + len(samples)) / sr, 3),
                         'speech_duration_seconds': round(len(samples) / sr, 3),
                         'original_speech_duration_seconds': round(original_duration, 3), 'tempo': speed,
                         'source_audio_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                         'generation': json.loads(path.with_suffix('.json').read_text()) if path.with_suffix('.json').exists()
                         else {'backend': 'Official AI4Bharat Hugging Face Space'}})
    wav = WORK / f'{feature}.{language}-narration.wav'
    sf.write(wav, track, sr, subtype='PCM_24')
    output = WORK / f'{feature}.{language}.mp4'
    run('ffmpeg', '-v', 'error', '-y', '-i', source, '-i', wav,
        '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k',
        '-ar', '48000', '-ac', '1', '-af', 'loudnorm=I=-18:TP=-2:LRA=7',
        '-metadata:s:a:0', f'language={LANGUAGES[language][2]}',
        '-t', duration, '-movflags', '+faststart', output)
    before_hash = video_hash(source)
    if before_hash != video_hash(output) or info['nb_frames'] != video_info(output)['nb_frames']:
        raise ValueError(f'{feature}: recorded picture changed')
    run('ffmpeg', '-v', 'error', '-xerror', '-i', output, '-f', 'null', '-')
    destination = ASSETS / output.name
    output.replace(destination)
    vtt = ['WEBVTT', '']
    transcript = [script['title'], LANGUAGES[language][1], '']
    for i, cue in enumerate(rendered, 1):
        times = f'{stamp(cue["start_seconds"])} --> {stamp(cue["speech_end_seconds"])}'
        # Each caption is the complete spoken cue, timed from its measured audio.
        vtt += [str(i), times, '\n'.join(textwrap.wrap(cue['narration'], width=56)), '']
        transcript += [times, cue['narration'], '']
    (ASSETS / f'{feature}.{language}.vtt').write_text('\n'.join(vtt))
    (ASSETS / f'{feature}.{language}.txt').write_text('\n'.join(transcript))
    meta = json.loads((ASSETS / f'{feature}.json').read_text())
    meta['bytes'] = destination.stat().st_size
    meta['narration'] = {**voice, 'language': language, 'audio_codec': 'aac', 'sample_rate': 48000,
                         'channels': 1, 'cue_count': len(rendered), 'caption_count': len(rendered)}
    meta['narration']['generation'] = sorted({cue['generation']['backend'] for cue in rendered})
    (ASSETS / f'{feature}.{language}.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
    print(f'Assembled {destination.name}: {len(rendered)} cues; video unchanged', flush=True)
    return {'duration_seconds': duration, 'video_frames': int(info['nb_frames']),
            'video_packet_sha256': before_hash, 'bytes': destination.stat().st_size, 'cues': rendered}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--language', choices=list(LANGUAGES), action='append')
    parser.add_argument('--feature', action='append')
    parser.add_argument('--backend', choices=['local', 'space', 'parler'], default='local')
    parser.add_argument('--batch-size', type=int, choices=[1, 2, 4, 8], default=4)
    parser.add_argument('--threads', type=int, choices=[1, 2, 4], default=4)
    parser.add_argument('--steps', type=int, choices=[16, 32], default=32,
                        help='Local inference steps; cached cues are retained regardless of this setting')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--generate-only', action='store_true')
    mode.add_argument('--assemble-only', action='store_true')
    args = parser.parse_args()
    scripts = []
    languages = args.language or (LANGUAGES if args.assemble_only else ['gu'] if args.backend == 'parler' else ['hi'])
    if not args.assemble_only and any((language == 'gu') != (args.backend == 'parler') for language in languages):
        raise ValueError('Use --backend parler for Gujarati, or --backend local/space for Hindi.')
    for language in languages:
        data = json.loads((DOCS / f'cues.{language}.json').read_text())
        scripts.extend((language, script) for script in data['scripts']
                       if not args.feature or script['feature'] in args.feature)
    feature_order = list(dict.fromkeys(script['feature'] for _, script in scripts))
    scripts.sort(key=lambda item: feature_order.index(item[1]['feature']))
    if not args.assemble_only:
        if args.backend == 'local':
            generate_local(scripts, args.steps, args.threads)
        elif args.backend == 'parler':
            generate_parler(scripts, args.batch_size)
        else:
            generate(scripts)
    if args.generate_only:
        return
    reports = {}
    for language, script in scripts:
        path = DOCS / f'render-report.{language}.json'
        if language not in reports:
            reports[language] = json.loads(path.read_text()) if path.exists() else {}
        reports[language][script['feature']] = assemble(language, script)
        path.write_text(json.dumps(reports[language], ensure_ascii=False, indent=2) + '\n')
    for language, report in reports.items():
        voice = PARLER_VOICE if language == 'gu' else VOICE
        lines = [f'# {LANGUAGES[language][0]} feature demo narration', '',
                 f'{voice["engine"]}. Times are measured from the generated audio. Gaps provide viewing time; the original recording is unchanged.', '',
                 '[Generation and attribution](README.md)', '']
        for feature, result in report.items():
            lines += [f'## {feature}', '', '| Speech start–end | On-screen action | Narration |', '| --- | --- | --- |']
            for cue in result['cues']:
                lines.append(f'| {stamp(cue["start_seconds"])}–{stamp(cue["speech_end_seconds"])} | {cue["visual_anchor"]} | {cue["narration"]} |')
            lines.append('')
        (DOCS / f'voiceover-scripts.{language}.md').write_text('\n'.join(lines))


if __name__ == '__main__':
    main()
