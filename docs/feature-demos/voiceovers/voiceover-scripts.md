# Timed voiceover scripts for Weavly feature demonstrations

Use this document with the six **final edited MP4s** linked below. These are scripts and an audio production brief; no voice audio has been generated or mixed yet.

## Give this instruction to the voice model

> Create a friendly, clear product walkthrough in English, with a natural Indian English pronunciation. Use the same voice and tone across all six videos. Aim for about 140 spoken words per minute; a natural range of 135–150 is acceptable. Do not sound like an advertisement.
>
> Read only the words in the **Narration — read verbatim** column. Do not read headings, cue numbers, timecodes, visual notes or production instructions. Numbers are already written as spoken words. Do not add an introduction, an outro, filler words, extra claims or music.
>
> Generate each numbered cue as a separate audio clip. Use its start time as the placement target and its end time as a hard deadline. Finish the sentence naturally and leave the remaining space silent; do not slow every short sentence down to fill its whole window. Every gap between windows is intentional silence.
>
> Place every clip on the full video timeline. Do not concatenate spoken clips without their timed silence. Never let a cue spill across a chapter cut. Keep the picture at its original speed and duration.
>
> Use the supplied video to check the visual anchor for each cue. Instructions such as “Choose” or “Enter” may lead the click slightly. Claims about a displayed result must wait until that result is visible. The numerical-result cues are Estimator 06, Production 18 and Payroll 07. If a visual anchor requires a later start, keep the cue inside its chapter, shorten or regenerate the speech as needed, and report the revised placement. Do not claim final synchronization from a word-count estimate alone.
>
> Deliver clean individual WAV clips plus one full-length WAV per feature, including all silence. Use 48 kHz audio, the same loudness across videos, no clipping and no background effects. Return an audio-duration report listing the actual spoken duration of every cue and flag any cue that misses its deadline.

## Timing and pronunciation

All timecodes are **HH:MM:SS.mmm from the first frame of that individual video**, at normal playback speed. End times are deadlines, not a request to keep talking for the whole window.

- “Live Cost”: live as in “live update.”
- “Weavly”: “weave-lee.”
- “Warp” and “weft”: the lengthwise and crosswise yarns. Use the normal textile terms.
- “Denier”: “DEN-ee-er.” “Rapier”: “RAY-pee-er.”
- G S T, C S V and P D F: say the individual letters.
- “Zero One” refers to the displayed `01` in the demo loom and operator names.
- Use “rupees per metre” and “rupees per kilogram,” not the printed symbols.
- Keep the narration in English. The existing video UI is English.

## Locked source videos

These timings are for the assets at commit `2e63015232debea1b217aedaf77490f7b91970f0`. If a video is re-edited, recalibrate the cues against that edit. In particular, Payroll uses the **2:21.708 final cut**, with an idle section removed from its payment confirmation; do not use the earlier 2:31.750 cut.

| Feature | Final video | Timeline length |
| --- | --- | --- |
| Cost Estimator | [estimator.mp4](https://github.com/Rajp2002/TextileAccounting/blob/2e63015232debea1b217aedaf77490f7b91970f0/public/videos/features/estimator.mp4?raw=true) | 00:01:58.750 |
| Saved Qualities | [qualities.mp4](https://github.com/Rajp2002/TextileAccounting/blob/2e63015232debea1b217aedaf77490f7b91970f0/public/videos/features/qualities.mp4?raw=true) | 00:00:51.958 |
| Rate Book | [rates.mp4](https://github.com/Rajp2002/TextileAccounting/blob/2e63015232debea1b217aedaf77490f7b91970f0/public/videos/features/rates.mp4?raw=true) | 00:01:24.208 |
| Saved Costings | [costings.mp4](https://github.com/Rajp2002/TextileAccounting/blob/2e63015232debea1b217aedaf77490f7b91970f0/public/videos/features/costings.mp4?raw=true) | 00:02:14.750 |
| Production | [production.mp4](https://github.com/Rajp2002/TextileAccounting/blob/2e63015232debea1b217aedaf77490f7b91970f0/public/videos/features/production.mp4?raw=true) | 00:03:45.417 |
| Payroll | [payroll.mp4](https://github.com/Rajp2002/TextileAccounting/blob/2e63015232debea1b217aedaf77490f7b91970f0/public/videos/features/payroll.mp4?raw=true) | 00:02:21.708 |

## Editing method that prevents drift

1. Render a single test cue first and calibrate the voice to a comfortable pace. Then render each cue separately with consistent voice settings.
2. Trim unintended leading or trailing silence from the speech clips, without cutting breaths or word endings.
3. Place each cue at its absolute start time. Pad the rest of its slot and all gaps with silence. A shorter clip never pulls later cues forward.
4. If a clip is too long, regenerate it within the 135–150 words-per-minute range. If that is still too long, shorten the wording while preserving the on-screen meaning. Do not clip words, stretch the video, or push the next cue later.
5. Watch the full video with the generated track. Check visual anchors, chapter transitions, numerical results and the payroll confirmation cut. Keep at least a little breathing room before each cut.
6. Export a full-length narration track matching the source video to within one video frame (about 42 ms at 24 fps). No audio tail should continue after the picture ends.
7. When adding audio to the website videos, update the current “no audio” help text and provide captions that match the actual narration. The existing chapter-description captions are not a verbatim voiceover transcript. Keep user-initiated playback and native audio controls; no autoplay with sound before the user requests a demo.

## Verification status

The exact chapter cuts and durations come from the final encoded media metadata. The cue content follows the recorded workflows reviewed when those videos were created. Every cue is within its video and its chapter, with no overlaps. All 66 cues fit their windows at 140 words per minute with at least half a second of additional room, based on spoken-word counts.

Within-chapter cue placements are proposed editing targets; they have not had a fresh frame-by-frame timing pass because the recording workspace went offline. This document therefore includes an explicit visual-anchor check for the voice/editing model. **Final audible synchronization is not yet verified:** it must be checked against the actual generated audio and picture before publication. The files and chapter cuts have not been changed for this script.


## Cost Estimator

Source: [estimator.mp4](https://github.com/Rajp2002/TextileAccounting/blob/2e63015232debea1b217aedaf77490f7b91970f0/public/videos/features/estimator.mp4?raw=true). Final duration: **00:01:58.750**.

Chapter starts: 00:00:00.000, 00:01:02.208, 00:01:34.750.

| Cue | Voice window | On-screen anchor — do not read | Narration — read verbatim |
| --- | --- | --- | --- |
| 01 | 00:00:00.500 → 00:00:13.700 | Name and construction inputs | Start a new fabric costing. Name the fabric, enter its warp and weft construction, and include the crimp and waste allowances. |
| 02 | 00:00:14.200 → 00:00:25.000 | Warp yarn inputs | Add the warp yarn's denier, beam ends, rate and G S T. These inputs determine warp consumption and cost. |
| 03 | 00:00:25.500 → 00:00:37.400 | Weft yarn inputs | Enter the weft denier, picks per inch, fabric width, yarn rate and G S T. |
| 04 | 00:00:37.900 → 00:00:49.600 | Cost and pricing inputs | Review the weaving cost and overhead. Then enter your target margin and order quantity. |
| 05 | 00:00:50.100 → 00:00:54.200 | Open Live cost | Now check Live Cost to review your estimate. |
| 06 | 00:00:54.700 → 00:01:01.400 | Live cost: ₹32.08/m is visible | The production cost is thirty two rupees and eight paisa per metre. |
| 07 | 00:01:02.700 → 00:01:12.800 | Pricing assumptions and return to inputs | Review the pricing assumptions, then return to the inputs to explore a different costing scenario. |
| 08 | 00:01:13.300 → 00:01:26.300 | Change weft rate to ₹128/kg and margin to 15% | Increase the weft rate to one hundred and twenty eight rupees per kilogram, and set the margin to fifteen percent. |
| 09 | 00:01:26.800 → 00:01:34.100 | Reopen Live cost with changed inputs | Check Live Cost again to see the updated production cost and selling price. |
| 10 | 00:01:35.200 → 00:01:45.400 | Switch to Detailed; yarn calculations | Switch to Detailed to inspect the yarn calculations, including consumption, crimp and waste. |
| 11 | 00:01:45.900 → 00:01:57.500 | Detailed production-cost breakdown | Scroll down to review the production cost breakdown. Quick and Detailed use the same calculations, with different levels of detail. |

Leave all time outside these windows silent. Save individual clips as `estimator-01.wav`, `estimator-02.wav`, and so on. Assemble the final track as `estimator-narration.wav`.

## Saved Qualities

Source: [qualities.mp4](https://github.com/Rajp2002/TextileAccounting/blob/2e63015232debea1b217aedaf77490f7b91970f0/public/videos/features/qualities.mp4?raw=true). Final duration: **00:00:51.958**.

Chapter starts: 00:00:00.000, 00:00:14.958, 00:00:39.958.

| Cue | Voice window | On-screen anchor — do not read | Narration — read verbatim |
| --- | --- | --- | --- |
| 01 | 00:00:00.500 → 00:00:06.200 | Save Quality & Create Costing | Save the quality and create its first costing together. |
| 02 | 00:00:06.700 → 00:00:14.200 | Save confirmation and assumptions | Review the assumptions, then save a reusable recipe and a fixed costing snapshot. |
| 03 | 00:00:15.400 → 00:00:24.700 | Search saved-quality library; open rate editor | Find the fabric in Saved Qualities. Open its rate editor to review the current yarn prices. |
| 04 | 00:00:25.200 → 00:00:38.900 | Warp rate ₹125 → ₹130/kg; Save Rates & Apply | Change the warp rate to one hundred and thirty rupees per kilogram. Review the cost impact, then save and apply. |
| 05 | 00:00:40.400 → 00:00:50.900 | Select saved quality and restore inputs | Select the saved fabric again to restore its construction and costing inputs, without entering everything from scratch. |

Leave all time outside these windows silent. Save individual clips as `qualities-01.wav`, `qualities-02.wav`, and so on. Assemble the final track as `qualities-narration.wav`.

## Rate Book

Source: [rates.mp4](https://github.com/Rajp2002/TextileAccounting/blob/2e63015232debea1b217aedaf77490f7b91970f0/public/videos/features/rates.mp4?raw=true). Final duration: **00:01:24.208**.

Chapter starts: 00:00:00.000, 00:00:36.750, 00:01:05.333.

| Cue | Voice window | On-screen anchor — do not read | Narration — read verbatim |
| --- | --- | --- | --- |
| 01 | 00:00:00.500 → 00:00:10.500 | Find demo yarns; inspect linked quality | Find the demo yarns in Rate Book, and check which saved quality uses them. |
| 02 | 00:00:11.000 → 00:00:24.400 | Edit weft price and source note | Update the weft rate to one hundred and forty rupees per kilogram. Add a supplier note so you can identify the source. |
| 03 | 00:00:24.900 → 00:00:35.800 | Save rate; open Activity history | Save the new rate, then open Activity to review the recorded change and its history. |
| 04 | 00:00:37.200 → 00:00:49.500 | Reopen saved quality and inspect its updated weft rate | Reopen the linked saved quality. Its weft rate reflects the Rate Book update, ready for your next estimate. |
| 05 | 00:00:50.000 → 00:01:04.400 | Apply quality, inspect inputs, open Live cost | Apply the quality and check its yarn inputs. Open Live Cost to review the recalculated production cost and selling price. |
| 06 | 00:01:05.800 → 00:01:13.000 | Find and open the earlier saved costing | Now open an earlier saved costing to compare it with the updated estimate. |
| 07 | 00:01:13.500 → 00:01:23.200 | Original snapshot values remain unchanged | The earlier costing keeps its original figures. Changing Rate Book does not rewrite saved costing snapshots. |

Leave all time outside these windows silent. Save individual clips as `rates-01.wav`, `rates-02.wav`, and so on. Assemble the final track as `rates-narration.wav`.

## Saved Costings

Source: [costings.mp4](https://github.com/Rajp2002/TextileAccounting/blob/2e63015232debea1b217aedaf77490f7b91970f0/public/videos/features/costings.mp4?raw=true). Final duration: **00:02:14.750**.

Chapter starts: 00:00:00.000, 00:00:18.875, 00:00:42.042, 00:00:52.875, 00:01:15.000, 00:01:31.708.

| Cue | Voice window | On-screen anchor — do not read | Narration — read verbatim |
| --- | --- | --- | --- |
| 01 | 00:00:00.500 → 00:00:08.700 | Search for demo fabric and open its costing | Search for the fabric and open its saved costing to inspect the original figures. |
| 02 | 00:00:09.200 → 00:00:17.900 | Saved breakdown: cost, price, margin, quantity | This snapshot preserves the original inputs and results, so you can refer back to them. |
| 03 | 00:00:19.300 → 00:00:28.500 | Use snapshot; change weaving rate to ₹16/m | Choose Use to restore the inputs. Change the weaving rate to sixteen rupees per metre. |
| 04 | 00:00:29.000 → 00:00:41.100 | Set margin to 20%; open Live cost | Set the target margin to twenty percent, then open Live Cost to review the updated result. |
| 05 | 00:00:42.500 → 00:00:51.900 | Save New Version; v2 confirmation | Choose Save New Version. Version two preserves your changes while version one keeps its original figures. |
| 06 | 00:00:53.300 → 00:01:01.500 | Enable Compare and open version history | Enable Compare, then open the fabric's version history to choose the estimates. |
| 07 | 00:01:02.000 → 00:01:13.900 | Select v1 and v2 | Select versions one and two. You can now compare how the changed assumptions affect the same fabric. |
| 08 | 00:01:15.500 → 00:01:30.700 | Compare Costings: component and price differences | Open Compare Costings. Review the differences in production cost, selling price, margin and profit to understand the effect of your changes. |
| 09 | 00:01:32.200 → 00:01:45.400 | Internal cost-sheet export; business name and notes | For an internal record, enter your business name and notes, then download the detailed cost sheet. |
| 10 | 00:01:45.900 → 00:01:58.400 | Switch to Customer Quotation; buyer and terms | Switch to Customer Quotation. Add the buyer's name and your quotation terms, including delivery details. |
| 11 | 00:01:58.900 → 00:02:13.500 | Download customer quotation | Download the customer version. It includes the quotation details while keeping your internal costs and margins private. |

Leave all time outside these windows silent. Save individual clips as `costings-01.wav`, `costings-02.wav`, and so on. Assemble the final track as `costings-narration.wav`.

## Production

Source: [production.mp4](https://github.com/Rajp2002/TextileAccounting/blob/2e63015232debea1b217aedaf77490f7b91970f0/public/videos/features/production.mp4?raw=true). Final duration: **00:03:45.417**.

Chapter starts: 00:00:00.000, 00:00:26.333, 00:00:55.500, 00:01:57.500, 00:02:22.292, 00:02:49.750, 00:03:21.833.

| Cue | Voice window | On-screen anchor — do not read | Narration — read verbatim |
| --- | --- | --- | --- |
| 01 | 00:00:00.500 → 00:00:12.300 | Add machine: name and type | Start by adding a production machine. Name it Demo Loom Zero One, and select Rapier as the machine type. |
| 02 | 00:00:17.000 → 00:00:25.100 | Save machine | Add the machine. Your new loom is ready for assignment. |
| 03 | 00:00:26.800 → 00:00:38.800 | Add worker: Demo Operator 01, piece rate | Next, add Demo Operator Zero One. Select piece rate for this worker's pay type. |
| 04 | 00:00:39.300 → 00:00:54.100 | Role, approved operator, day availability, save | Set the role, keep the worker approved as a loom operator, and choose day availability. Then save the worker. |
| 05 | 00:00:56.000 → 00:01:06.500 | Activate Quality; choose saved costing v2 | Activate a quality for production, and choose version two of the saved demo fabric. |
| 06 | 00:01:07.000 → 00:01:17.300 | Yarn-stock prerequisite | Before production can start, check the required yarn stock. This fabric needs both warp and weft. |
| 07 | 00:01:17.800 → 00:01:31.500 | Add warp stock: 200 kg and note | Add two hundred kilograms of warp yarn, with a short stock note, then save. |
| 08 | 00:01:32.000 → 00:01:47.200 | Add weft stock: 200 kg and note | Repeat for the weft yarn. Add two hundred kilograms and a reference note, then save the stock. |
| 09 | 00:01:48.000 → 00:01:56.500 | Activate quality after stock is available | With both yarn stocks available, activate the quality for production. |
| 10 | 00:01:58.000 → 00:02:09.400 | Assign Looms; select Demo Loom 01 | Open Assign Looms for the active quality. Select Demo Loom Zero One and confirm the assignment. |
| 11 | 00:02:09.900 → 00:02:21.200 | Machine board; search for demo loom | The machine board connects your fabric to its loom. Search for the demo loom to find it quickly. |
| 12 | 00:02:22.800 → 00:02:34.500 | Manage Workers; Day Shift | Open Manage Workers on the demo loom, and select Day Shift. |
| 13 | 00:02:35.000 → 00:02:48.600 | Search and assign Demo Operator 01; Done | Find Demo Operator Zero One, assign the worker, and finish setup. The loom now has a quality and a day operator. |
| 14 | 00:02:50.200 → 00:03:00.400 | Daily sheet; enter 240 m | Open the daily sheet for the correct date and shift. Enter two hundred and forty metres for the demo loom. |
| 15 | 00:03:00.900 → 00:03:09.300 | Worker Review; return to sheet | Open Worker Review to check output and earnings, then return to the sheet. |
| 16 | 00:03:09.800 → 00:03:20.800 | Save shift and confirm incomplete shift | Save the shift. Other machines remain pending, so only the demo loom has recorded output in this example. |
| 17 | 00:03:22.300 → 00:03:32.000 | Saved production audit receipt | Open the saved receipt to review the production record, including the loom, quality, operator and metres. |
| 18 | 00:03:32.500 → 00:03:44.600 | Worker Review: 240 m × ₹16/m = ₹3,840 | Two hundred and forty metres at sixteen rupees per metre gives earnings of three thousand eight hundred and forty rupees. |

Leave all time outside these windows silent. Save individual clips as `production-01.wav`, `production-02.wav`, and so on. Assemble the final track as `production-narration.wav`.

## Payroll

Source: [payroll.mp4](https://github.com/Rajp2002/TextileAccounting/blob/2e63015232debea1b217aedaf77490f7b91970f0/public/videos/features/payroll.mp4?raw=true). Final duration: **00:02:21.708**.

Chapter starts: 00:00:00.000, 00:00:32.833, 00:01:08.458, 00:01:34.083.

| Cue | Voice window | On-screen anchor — do not read | Narration — read verbatim |
| --- | --- | --- | --- |
| 01 | 00:00:00.500 → 00:00:09.300 | Find Demo Operator 01; production earnings card | Find Demo Operator Zero One to review the earnings generated from saved production. |
| 02 | 00:00:09.800 → 00:00:22.300 | Add advance: ₹400 and description | Add an advance of four hundred rupees, with a short description, and save it. |
| 03 | 00:00:22.800 → 00:00:31.900 | Recovery ₹400; net pay recalculates | The advance appears under Recovery, and the worker's net pay updates automatically. |
| 04 | 00:00:33.300 → 00:00:46.400 | Add deduction; choose Other category | You can also record a deduction. Select Other as the reason for this demonstration. |
| 05 | 00:00:47.000 → 00:00:52.000 | Deduction amount ₹50 | Enter fifty rupees. |
| 06 | 00:00:52.500 → 00:00:59.300 | Deduction note and save | Add a short note, then record the deduction. |
| 07 | 00:01:00.000 → 00:01:07.700 | Recovery ₹450; net pay ₹3,390 | Net pay is now three thousand three hundred and ninety rupees, after both recoveries. |
| 08 | 00:01:08.900 → 00:01:19.400 | How pay is calculated | Open How Pay Is Calculated for a summary of piece rate earnings, salaries and advance recovery. |
| 09 | 00:01:19.900 → 00:01:24.900 | Mark paid and confirm | Choose Mark Paid, then confirm the payment. |
| 10 | 00:01:26.400 → 00:01:33.200 | Paid state; cash payment is a record only | This records a cash payment. It does not send money. |
| 11 | 00:01:34.600 → 00:01:43.800 | Payroll records; period and worker search | Open Payroll Records and find the demo worker for the pay period. |
| 12 | 00:01:44.300 → 00:01:55.700 | Expand worker payment and loom breakdown | Expand the payment to see which loom, costing, rate and production quantity generated those earnings. |
| 13 | 00:01:56.200 → 00:02:08.700 | Switch to Machines view | Switch to the Machines view to summarize production and worker cost by loom. |
| 14 | 00:02:09.200 → 00:02:20.600 | Export CSV and PDF | Download the C S V for spreadsheet analysis, or the P D F for a shareable payroll report. |

Leave all time outside these windows silent. Save individual clips as `payroll-01.wav`, `payroll-02.wav`, and so on. Assemble the final track as `payroll-narration.wav`.

## Cue budget reference

“Estimated speech” uses 140 words per minute and is a planning estimate, not measured audio. The remaining window accommodates sentence pauses and silence; do not fill it with extra narration.

| Feature | Cue | Spoken words | Window | Estimated speech | Remaining window |
| --- | ---: | ---: | ---: | ---: | ---: |
| estimator | 01 | 21 | 13.20 s | 9.00 s | 4.20 s |
| estimator | 02 | 19 | 10.80 s | 8.14 s | 2.66 s |
| estimator | 03 | 15 | 11.90 s | 6.43 s | 5.47 s |
| estimator | 04 | 14 | 11.70 s | 6.00 s | 5.70 s |
| estimator | 05 | 8 | 4.10 s | 3.43 s | 0.67 s |
| estimator | 06 | 12 | 6.70 s | 5.14 s | 1.56 s |
| estimator | 07 | 15 | 10.10 s | 6.43 s | 3.67 s |
| estimator | 08 | 20 | 13.00 s | 8.57 s | 4.43 s |
| estimator | 09 | 13 | 7.30 s | 5.57 s | 1.73 s |
| estimator | 10 | 13 | 10.20 s | 5.57 s | 4.63 s |
| estimator | 11 | 20 | 11.60 s | 8.57 s | 3.03 s |
| qualities | 01 | 9 | 5.70 s | 3.86 s | 1.84 s |
| qualities | 02 | 13 | 7.50 s | 5.57 s | 1.93 s |
| qualities | 03 | 16 | 9.30 s | 6.86 s | 2.44 s |
| qualities | 04 | 20 | 13.70 s | 8.57 s | 5.13 s |
| qualities | 05 | 17 | 10.50 s | 7.29 s | 3.21 s |
| rates | 01 | 14 | 10.00 s | 6.00 s | 4.00 s |
| rates | 02 | 22 | 13.40 s | 9.43 s | 3.97 s |
| rates | 03 | 15 | 10.90 s | 6.43 s | 4.47 s |
| rates | 04 | 18 | 12.30 s | 7.71 s | 4.59 s |
| rates | 05 | 20 | 14.40 s | 8.57 s | 5.83 s |
| rates | 06 | 13 | 7.20 s | 5.57 s | 1.63 s |
| rates | 07 | 16 | 9.70 s | 6.86 s | 2.84 s |
| costings | 01 | 14 | 8.20 s | 6.00 s | 2.20 s |
| costings | 02 | 15 | 8.70 s | 6.43 s | 2.27 s |
| costings | 03 | 15 | 9.20 s | 6.43 s | 2.77 s |
| costings | 04 | 16 | 12.10 s | 6.86 s | 5.24 s |
| costings | 05 | 16 | 9.40 s | 6.86 s | 2.54 s |
| costings | 06 | 12 | 8.20 s | 5.14 s | 3.06 s |
| costings | 07 | 17 | 11.90 s | 7.29 s | 4.61 s |
| costings | 08 | 21 | 15.20 s | 9.00 s | 6.20 s |
| costings | 09 | 16 | 13.20 s | 6.86 s | 6.34 s |
| costings | 10 | 15 | 12.50 s | 6.43 s | 6.07 s |
| costings | 11 | 17 | 14.60 s | 7.29 s | 7.31 s |
| production | 01 | 19 | 11.80 s | 8.14 s | 3.66 s |
| production | 02 | 10 | 8.10 s | 4.29 s | 3.81 s |
| production | 03 | 14 | 12.00 s | 6.00 s | 6.00 s |
| production | 04 | 19 | 14.80 s | 8.14 s | 6.66 s |
| production | 05 | 14 | 10.50 s | 6.00 s | 4.50 s |
| production | 06 | 16 | 10.30 s | 6.86 s | 3.44 s |
| production | 07 | 14 | 13.70 s | 6.00 s | 7.70 s |
| production | 08 | 17 | 15.20 s | 7.29 s | 7.91 s |
| production | 09 | 10 | 8.50 s | 4.29 s | 4.21 s |
| production | 10 | 16 | 11.40 s | 6.86 s | 4.54 s |
| production | 11 | 18 | 11.30 s | 7.71 s | 3.59 s |
| production | 12 | 11 | 11.70 s | 4.71 s | 6.99 s |
| production | 13 | 21 | 13.60 s | 9.00 s | 4.60 s |
| production | 14 | 20 | 10.20 s | 8.57 s | 1.63 s |
| production | 15 | 13 | 8.40 s | 5.57 s | 2.83 s |
| production | 16 | 18 | 11.00 s | 7.71 s | 3.29 s |
| production | 17 | 16 | 9.70 s | 6.86 s | 2.84 s |
| production | 18 | 20 | 12.10 s | 8.57 s | 3.53 s |
| payroll | 01 | 13 | 8.80 s | 5.57 s | 3.23 s |
| payroll | 02 | 14 | 12.50 s | 6.00 s | 6.50 s |
| payroll | 03 | 12 | 9.10 s | 5.14 s | 3.96 s |
| payroll | 04 | 14 | 13.10 s | 6.00 s | 7.10 s |
| payroll | 05 | 3 | 5.00 s | 1.29 s | 3.71 s |
| payroll | 06 | 8 | 6.80 s | 3.43 s | 3.37 s |
| payroll | 07 | 14 | 7.70 s | 6.00 s | 1.70 s |
| payroll | 08 | 16 | 10.50 s | 6.86 s | 3.64 s |
| payroll | 09 | 7 | 5.00 s | 3.00 s | 2.00 s |
| payroll | 10 | 10 | 6.80 s | 4.29 s | 2.51 s |
| payroll | 11 | 12 | 9.20 s | 5.14 s | 4.06 s |
| payroll | 12 | 15 | 11.40 s | 6.43 s | 4.97 s |
| payroll | 13 | 13 | 12.50 s | 5.57 s | 6.93 s |
| payroll | 14 | 18 | 11.40 s | 7.71 s | 3.69 s |
