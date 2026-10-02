# Feature demo verification — 2 October 2026

## Assets

| Preview | Duration | Approximate size |
| --- | ---: | ---: |
| Cost Estimator | 1:59 | 2.5 MB |
| Saved Costings | 2:15 | 3.2 MB |
| Saved Qualities | 0:52 | 1.6 MB |
| Rate Book | 1:24 | 1.9 MB |
| Production | 3:45 | 3.9 MB |
| Payroll | 2:22 | 2.3 MB |

All six final videos were decoded end to end with FFmpeg (`-xerror`), checked with ffprobe, and visually reviewed using contact sheets and selected full-resolution frames. They use H.264/yuv420p at 1440 × 960 and 24 fps, with no audio. Chapter captions and transcripts are generated from the reviewed manifests. The payroll recording trims an idle pause in the production application's confirmation dialog, whose text currently has low contrast; the worker card and final receipt show the payment figures.

## Browser checks

The real plan components were rendered in a temporary Vite harness using the application's styles and localization provider. Server writes were disabled; Next.js routing/image adapters were stubbed. This harness was only for checking the plan integration. All demonstration footage was recorded separately against the actual production application.

- Desktop: all six feature selectors open their corresponding recording; each plays, pauses and seeks successfully, with decoded frames and no media error.
- Captions: English WebVTT cues load for every video. They are available through native video controls and do not cover the recording by default. Text walkthrough links return HTTP 200.
- Closing: Escape unmounts the video and returns focus to the launcher. The shared dialog traps keyboard focus and supplies its accessible title and description.
- Mobile: at 390 × 844 the production dialog fits within the viewport, video plays inline, and the document has no horizontal overflow.
- Failure handling: an intentionally blocked video request exposes the direct-video link and written walkthrough.
- Loading: no video elements or MP4 requests occur before a preview is opened.
- Localization: Gujarati and Hindi launchers, dialog headings, close controls and transcript links render correctly. The recording language is explicitly disclosed as English.
- Actual Next.js production server: unauthenticated captions/transcripts return HTTP 200, an MP4 byte-range request returns HTTP 206, and browser playback reaches readyState 4. This confirms the static-asset middleware exemption and seek support.

## Application checks

- `npx tsc --noEmit --pretty false`: passed.
- ESLint on changed application files with `--max-warnings=0`: passed.
- `npm run build --ignore-scripts`: passed, including Next.js production compilation, TypeScript and all 53 static pages. Tests were run separately.
- Full Vitest suite: 2,078 passed, 1 skipped, with one middleware source-format assertion initially failing. After preserving the expected matcher prefix, all 9 tests in `release-runtime-config.test.ts` passed. No unresolved test failures remain.
- Targeted standalone-plan/billing checks: 34 passed.
- `git diff --check`: passed.

The plan chooser's authenticated server data and checkout actions were not exercised locally because the workspace has no application environment secrets. Existing billing/access logic is unchanged; the browser harness used representative Base-account props.
