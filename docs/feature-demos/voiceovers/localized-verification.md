# Hindi and Gujarati feature demo verification — 3 October 2026

The six previews offer Hindi IndicF5 narration and Gujarati Indic Parler-TTS narration with native speaker Neha, alongside the existing English Kokoro recordings. [Rebuild instructions and attribution](README.md) document the pinned models and local toolchain.

| Feature | Duration | Hindi MP4 | Gujarati MP4 |
| --- | ---: | ---: | ---: |
| estimator | 1:59 | 3.29 MB | 3.69 MB |
| qualities | 0:52 | 1.99 MB | 2.15 MB |
| rates | 1:24 | 2.46 MB | 2.69 MB |
| costings | 2:15 | 4.16 MB | 4.51 MB |
| production | 3:45 | 5.25 MB | 5.90 MB |
| payroll | 2:22 | 3.13 MB | 3.49 MB |

## Media and speech checks

- All 12 localized MP4s decode end to end. Their H.264 packet hashes and frame counts match the English source recordings. The picture remains 1440 × 960 at 24 fps.
- All 134 localized speech cues fit the reviewed visible-action windows and stay within chapter boundaries. Measured speech ends determine the captions. The largest tempo adjustment is 7.7%; longer text was shortened before rendering. Unused time remains available for watching.
- Each localized video contains one mono AAC track at 48 kHz. Audio and picture durations match within one frame. Measured encoded loudness ranges from -18.46 to -17.28 LUFS, with true peaks from -1.99 to -1.75 dBTP and no clipping.
- Each language has 67 complete-cue captions plus matching transcripts and measured scripts. The render reports record speech timings, generation settings, source WAV checksums and picture hashes.
- Local Whisper large-v3-turbo transcription checks covered every generated cue and key rates, percentages, production quantities and payment figures. Gujarati was checked in overlapping short sections to avoid decoder token limits. These are automated intelligibility checks; no native-speaker pronunciation review was performed.

## Browser checks

- All 18 feature/language combinations play with decoded audio and video frames, load captions in the selected language and return matching transcripts without media errors.
- English/Hindi/Gujarati selection remembers the explicit preference and otherwise follows the app language. Invalid stored values fall back to the app language. Native option labels survive the localization provider.
- Switching preserves position, pause/play state, mute, volume, playback speed and captions. Rapid changes before replacement metadata loads preserve the previous position.
- Escape stops the video and returns focus to its launcher after the closing animation. The production preview fits at 390 × 844 with native Gujarati captions and no horizontal overflow.
- Checks used the real plan components, current app styles and localization provider in a temporary Vite harness. Server writes were disabled and Next.js routing/image adapters were stubbed. Demonstration footage comes from the actual production app.

## Application checks

- Full repository lint passed with zero warnings.
- Production build, TypeScript and the full Vitest prebuild passed.
- The asset contract tests validate all 18 videos, captions, transcripts and language/count metadata.
- The plan chooser’s authenticated server data and checkout actions were not exercised locally; no billing or access logic changed.
