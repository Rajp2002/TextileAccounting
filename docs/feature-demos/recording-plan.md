# Plan-page feature demonstrations

Capture source: the production UI at https://textile-accounting.vercel.app on 2 October 2026, using the supplied Base demo account. Capture starts after authentication. New business records use the `Demo` prefix; no production readings or payments are entered for existing workers.

Each video is a recording of real UI actions, with a visible pointer, reading pauses, and short chapter descriptions. The recordings have no audio. Preparation and investigation are excluded from the finished clips.

| Feature | Demonstration |
| --- | --- |
| Cost Estimator | Name the fabric; enter warp/weft construction, denier, beam ends, picks, finished width, yarn rates, GST, waste, crimp, weaving, overhead, margin and quantity; inspect live production cost, break-even, selling price and profit; change rate and margin; inspect updated cost; show Detailed calculation breakdown. |
| Saved Qualities | Save recipe and first costing together; find it in the library; inspect/edit rates; reopen the reusable recipe and verify restored inputs. |
| Rate Book | Locate the demo yarns created from the saved quality; inspect usage; change a current rate; review rate history and confirm the linked quality receives the new rate while saved costing snapshots retain their figures. |
| Saved Costings | Find the sample costing; inspect its original breakdown; reuse it to save another version; compare versions; generate and download an internal cost sheet; show customer quotation options without sending anything. |
| Production | Activate the demo quality; satisfy yarn-stock prerequisites; allocate a demo machine and operator; enter day-shift metres in the daily sheet; save and review recorded production and its totals. |
| Payroll | Review the demo operator's production earnings; record an advance and deduction; inspect net pay and settlement review; record a payment; inspect the saved worker/machine breakdown and download payroll CSV/PDF. No money is transferred by this workflow. |

Plan integration: each existing feature chip selects that feature's poster and recording. A clear play control opens a responsive video dialog with native playback, seeking and fullscreen, plus caption/text guidance. Videos load only when requested, and closing the dialog stops playback. Free, Lite and Base retain their existing feature access lists.

## Recorded example and account changes

- `Demo - Signature Polyester`: reusable quality and two saved costing versions. The estimator demonstrates production cost changing from ₹32.08/m to ₹33.23/m after input changes. Costing v2 has ₹16/m weaving cost and a 20% margin.
- `Demo Polyester Warp 75D` and `Demo Polyester Weft 150D`: yarn rate entries, linked-quality rates, and 200 kg of opening stock per yarn. The Rate Book demonstration updates the weft rate to ₹140/kg while the previous costing stays unchanged.
- `Demo Loom 01` and `Demo Operator 01`: a Rapier loom and piece-rate day operator assigned to the activated demo quality.
- 2 October day shift: 240 m on the demo loom, ₹3,840 earnings. Other machines are left pending in the saved shift; their output is not entered.
- Demo operator payroll: ₹400 advance plus ₹50 deduction, ₹450 recovered, ₹3,390 recorded as paid by cash. The record is bookkeeping only; no money is sent. Other workers remain unpaid.

These clearly named demo records remain in the supplied account so the recordings can be traced to their source.

## Media and maintenance

The six MP4 files, JPEG posters, optional English WebVTT captions, text walkthroughs and chapter metadata live in `public/videos/features/`. Each MP4 is H.264/yuv420p, 24 fps, 1440 × 960, has no audio, and has its metadata at the start for streaming and seeking. A 60 px chapter strip is added above the original 1440 × 900 recording. The application uses native video controls and serves assets from its own origin.

The reviewed assembly manifests are in `docs/feature-demos/manifests/`. To rebuild after recording a replacement take at the referenced local path:

```sh
python scripts/media/assemble-feature-demos.py docs/feature-demos/manifests/estimator.json
```

The script requires FFmpeg/ffprobe with libx264 and the DejaVu Sans font. Raw takes and browser sessions are private, ignored workspace artifacts under `scratch/feature-demos/`; they are not required to deploy the finished assets. Do not include login screens, credentials, browser storage or session files in replacement media.

Posters load with the cards; MP4 requests begin only after opening a preview. Public captions and transcripts bypass authentication middleware so they also work on the onboarding plan chooser. Shared dialog behavior provides focus trapping, Escape/backdrop closing and focus restoration. Closing unmounts the video. A failed media request exposes direct-video and transcript links. Surrounding controls are localized in English, Gujarati and Hindi; recordings and captions are English.
