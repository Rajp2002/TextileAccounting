# Feature demo verification — 2 October 2026

## Narrated assets

| Preview | Duration | Size |
| --- | ---: | ---: |
| Cost Estimator | 1:59 | 3.36 MB |
| Saved Costings | 2:15 | 4.14 MB |
| Saved Qualities | 0:52 | 2.01 MB |
| Rate Book | 1:24 | 2.48 MB |
| Production | 3:45 | 5.33 MB |
| Payroll | 2:22 | 3.19 MB |

- All six MP4s decode end to end with FFmpeg `-xerror`. H.264/yuv420p picture remains 1440 × 960 at 24 fps. Video packet hashes and frame counts match the original videos on `eb54fc68` exactly.
- Each video contains one English mono AAC track at 48 kHz. Audio duration matches picture within one frame. Measured loudness is −18.17 to −18.38 LUFS; encoded true peaks range from −1.73 to −1.92 dBTP, without clipping.
- All 67 Kokoro `af_heart` cues fit their reviewed windows at the same 0.92 synthesis speed. There is no narration across chapter cuts or past the picture end. Unused time stays silent for reading and watching input actions.
- Placement windows were reviewed against 159 sampled video frames plus selected result frames. The estimator's first result, quotation export, worker earnings and payroll recovery cues were adjusted to their actual display times.
- Captions use measured synthesized phrase timings and match the spoken script. A local Whisper `base.en` transcription check recovered the intended wording and key figures from all six WAV tracks; this was an automated intelligibility check, not a human listening review. Its inferred timestamps are not used for placement.
- The editable scripts, measured render report, model checksums, tool versions and rebuild instructions are committed under `docs/feature-demos/voiceovers/` and `scripts/media/`.

The payroll picture retains the earlier edit that removes an idle wait in a low-contrast confirmation dialog. The visible worker card and saved receipt show the payment figures.

## Browser checks

The real plan components were rendered in a temporary Vite harness using the application's styles and localization provider. Server writes were disabled; Next.js routing/image adapters were stubbed. This harness checks plan integration; all demonstration footage was recorded separately against the actual production application.

- All six feature selectors launch the matching narrated recording with `muted=false`, active playback, decoded audio bytes and nonzero Web Audio samples. Pause, seek and resume work without media errors.
- English WebVTT loads for every video (105 caption phrases total). Captions remain optional through native controls. All six transcript links return HTTP 200.
- Escape unmounts each video and returns focus to its launcher, stopping playback.
- Videos remain user initiated: no video element or MP4 request before a preview opens. Versioned media/caption/transcript URLs avoid reusing old silent assets.
- At 390 × 844, the production dialog fits within the viewport, plays inline with sound enabled, and has no horizontal overflow.
- The help text discloses English narration in English, Gujarati and Hindi.

Earlier silent-preview integration checks also covered media failure fallback, shared-dialog focus trapping, localized controls, and actual Next.js HTTP 200 captions/transcripts and HTTP 206 MP4 byte-range serving. The existing middleware, dialog and fallback behavior are unchanged by narration.

## Application checks

- `npx tsc --noEmit --pretty false`: passed.
- ESLint on changed application files with `--max-warnings=0`: passed.
- `npm run build`: passed, including the full Vitest prebuild (2,079 passed, 1 skipped), production compilation, TypeScript and all 53 static pages.
- `git diff --check`: passed.

The plan chooser's authenticated server data and checkout actions were not exercised locally because this workspace has no application environment secrets. Billing/access logic is unchanged; browser checks used representative Base-account props.
