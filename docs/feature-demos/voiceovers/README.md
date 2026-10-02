# Locally generated feature narration

The six plan previews contain English Kokoro narration, synchronized to the existing recordings. No paid speech API, voice clone, background music, or runtime speech service is used. The finished MP4s, captions and transcripts are committed; deploying the app does not require Python or model downloads.

`cues.json` is the editable source: every cue has an absolute start, a hard end deadline, its visible action, and spoken text. The windows were checked against the final footage, including loading delays and chapter cuts. `render-report.json` records the measured speech duration/end, speed and original video packet hash. `voiceover-scripts.md` is generated from those measurements.

## Rebuild

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

## Attribution

- [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), by hexgrad: Apache-2.0 model; voice `af_heart`, English. The [voice documentation](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) describes the supplied voices.
- [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx): MIT-licensed inference wrapper and ONNX release files.
- [eSpeak NG](https://github.com/espeak-ng/espeak-ng): GPL-3.0 phonemizer used locally by the toolchain; neither its binary nor the speech model is bundled in the website.

Model checksums are pinned in the generation script. These licenses describe the local generation tools/model; the published website assets are the recorded picture and generated speech.
