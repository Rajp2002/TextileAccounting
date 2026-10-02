# Feature demo narration

The six plan previews offer English Kokoro narration, Hindi IndicF5 narration and Gujarati Indic Parler-TTS narration, synchronized to the same recordings. The language selector remembers a viewer's choice; otherwise it follows the app language. Switching preserves the playback position, pause state, volume, speed and captions. The screen recording remains in English, with this stated below localized previews.

The finished MP4s, captions and transcripts are committed; deploying or watching them does not require Python, model downloads, a Hugging Face account, or a runtime speech service. No paid speech API or background music is used. IndicF5 uses the stock reference recording distributed by AI4Bharat.

`cues.json` is the editable source: every cue has an absolute start, a hard end deadline, its visible action, and spoken text. The windows were checked against the final footage, including loading delays and chapter cuts. `render-report.json` records the measured speech duration/end, speed and original video packet hash. `voiceover-scripts.md` is generated from those measurements.

## Rebuild

### English

Requires Python 3.12 and FFmpeg/ffprobe. Run from the repository root:

```sh
python -m venv scratch/feature-demos/voice-env
scratch/feature-demos/voice-env/bin/pip install -r scripts/media/requirements-narration.txt
mkdir -p scratch/feature-demos/narration/models
curl -fL https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx -o scratch/feature-demos/narration/models/kokoro-v1.0.onnx
curl -fL https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin -o scratch/feature-demos/narration/models/voices-v1.0.bin
scratch/feature-demos/voice-env/bin/python scripts/media/narrate-feature-demos.py
```

Use `--feature estimator` to regenerate one feature. The script verifies the model checksums before loading them. Models, synthesis caches and WAV intermediates stay in ignored `scratch/`; they are not shipped to browsers.

Each caption phrase is synthesized separately and placed at its measured audio time. Short pauses separate sentences and clauses. Speech starts at the reviewed cue time; unused time remains silent for viewing. A cue that will not fit at a natural speed fails instead of clipping words or shifting later cues. Shorten its text or choose a newly reviewed window before rerunning.

The full audio track is normalized to −18 LUFS with a −2 dB true-peak target, encoded as mono AAC at 48 kHz/96 kbps, and muxed into the MP4. The original H.264 packets and frame count must remain identical. The script checks every finished file with FFmpeg, writes speech captions/transcripts and updates the media metadata. Regeneration replaces any existing audio rather than layering voices.

For replacement footage, first use `assemble-feature-demos.py` to assemble the silent picture. Recheck every affected cue against that picture, then run the narration script. Recheck playback and bump the asset version in `lib/feature-demos.ts` whenever published media changes.

### Hindi and Gujarati

The editable scripts are `cues.hi.json` and `cues.gu.json`. They use the reviewed English action windows, with concise translations and spoken numbers. Each language has its own `render-report`, readable `voiceover-scripts`, MP4s, speech captions and transcripts. Localized video streams must hash identically to the English source. English assets are not overwritten.

Create separate generation environments because IndicF5 and Indic Parler require different Transformers versions. CPU generation is free, but can take several hours. For Hindi:

```sh
python -m venv scratch/feature-demos/indic-env
scratch/feature-demos/indic-env/bin/pip install torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu
scratch/feature-demos/indic-env/bin/pip install -r scripts/media/requirements-indic-narration.txt
```

Accept access to [AI4Bharat/IndicF5](https://huggingface.co/ai4bharat/IndicF5), then configure a read token using `HF_TOKEN` or `HF_TOKEN_PATH` outside the repository. Download the pinned model and source into ignored scratch space:

```sh
scratch/feature-demos/indic-env/bin/python - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download('ai4bharat/IndicF5', revision='ba85abedf18dc479a447eaa0eccbd76ab78a47d5',
                  local_dir='scratch/feature-demos/narration/models/IndicF5')
PY
scratch/feature-demos/indic-env/bin/python scripts/media/narrate-localized-feature-demos.py --language hi
```

The Hindi renderer checks the model/vocabulary checksums and uses 32 inference steps with four CPU threads. Use `--threads 2` when sharing a small CPU workspace with another renderer. Successful cues are cached individually, so interrupted runs resume. `--feature estimator` selects one feature. `--generate-only` builds the cache, and `--assemble-only` needs only cached WAVs, NumPy, SoundFile and FFmpeg.

Alternatively, `--backend space` uses the [official free IndicF5 Space](https://huggingface.co/spaces/ai4bharat/IndicF5). This sends only the demonstration script and stock reference to Hugging Face. ZeroGPU quota is limited: the renderer stops on quota failures, and the local backend can resume from the same cache. It does not purchase compute or retry around quota limits. The per-cue render report records which backend generated the audio.

For Gujarati, accept access to [Indic Parler-TTS](https://huggingface.co/ai4bharat/indic-parler-tts) using the same Hugging Face account, then install and download the pinned model:

```sh
python -m venv scratch/feature-demos/parler-env
scratch/feature-demos/parler-env/bin/pip install torch==2.8.0 torchaudio==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cpu
scratch/feature-demos/parler-env/bin/pip install -r scripts/media/requirements-parler-narration.txt
scratch/feature-demos/parler-env/bin/pip install --no-deps 'git+https://github.com/huggingface/parler-tts.git@d108732cd57788ec86bc857d99a6cabd66663d68'
scratch/feature-demos/parler-env/bin/python - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download('ai4bharat/indic-parler-tts', revision='7b527af5ee8ed1f9a28d80b19703ed9bb8ba10ca',
                  local_dir='scratch/feature-demos/narration/models/indic-parler-tts')
PY
scratch/feature-demos/parler-env/bin/python scripts/media/narrate-localized-feature-demos.py --backend parler --language gu --batch-size 8
```

Gujarati uses the recommended native speaker `Neha` with a fixed clear, calm narration description. The renderer groups similar-length scripts for efficient generation, crops each result to its own returned audio length, removes only quiet edges with a safety margin, and resamples to the common 24 kHz intermediate format. The caption/audio timing is measured after these steps. Batch membership and generation settings are recorded with each cue.

Localized captions cover each complete spoken cue, using measured start/end times. At most an 8% tempo adjustment is allowed to fit a cue; longer text fails for rewriting instead of being clipped or shifting later narration. Output uses the same loudness targets and AAC format as English. Review generated speech against the intended text before publication; automatic transcription helps identify omissions and repeated phrases but is not a substitute for a native speaker's pronunciation review.

When using Whisper to audit Gujarati, check short overlapping audio sections. The tested decoder capped a single result at 224 tokens, which can truncate a Gujarati transcript even when the spoken ending is present. Do not mistake a capped transcript for a truncated recording.

## Attribution

- [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), by hexgrad: Apache-2.0 model; voice `af_heart`, English. The [voice documentation](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) describes the supplied voices.
- [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx): MIT-licensed inference wrapper and ONNX release files.
- [eSpeak NG](https://github.com/espeak-ng/espeak-ng): GPL-3.0 phonemizer used locally by the toolchain; neither its binary nor the speech model is bundled in the website.
- [AI4Bharat IndicF5](https://huggingface.co/ai4bharat/IndicF5): MIT-licensed multilingual speech model, with the supplied `MAR_F_WIKI_00001.wav` neutral female reference and its supplied transcript. Model revision: `ba85abedf18dc479a447eaa0eccbd76ab78a47d5`.
- [Vocos](https://huggingface.co/charactr/vocos-mel-24khz): MIT-licensed vocoder used by IndicF5. [Gradio Client](https://github.com/gradio-app/gradio), Apache-2.0, is used only for optional generation through the official Space.
- [AI4Bharat Indic Parler-TTS](https://huggingface.co/ai4bharat/indic-parler-tts): Apache-2.0 model, Gujarati speaker `Neha`, model revision `7b527af5ee8ed1f9a28d80b19703ed9bb8ba10ca`. The [Parler-TTS inference library](https://github.com/huggingface/parler-tts) is Apache-2.0; its supplied audio decoder uses Descript Audio Codec, MIT.

Model checksums are pinned in the generation scripts. These licenses describe the generation tools/models; the published website assets are the recorded picture and generated speech. No user voice recording or account credentials are included in the assets.
