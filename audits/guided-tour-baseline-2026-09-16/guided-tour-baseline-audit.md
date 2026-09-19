# Guided Tour Baseline Audit

**Base owner baseline · 16 September 2026.** All eleven registered tour IDs were experienced through the production UI before implementation diagnosis. This report covers the accessible Base variants; alternate Free/Lite/Full variants are inventoried, not claimed as user-tested. Frozen UX scores were not raised after reading source.

## 1. Executive Summary

Eleven tours were discovered and completed through the authenticated production UI, covering **264 steps**. The source registry confirms eleven tour IDs. The first ten were tested in **Base pilot testing**; after session recovery, Dispatch was tested in the configured owner account, **Ashok textile pvt**, whose Billing page confirmed Base. The configured BASE credential opened Lite, so it was not used for remaining factory tours. The supplied fallback account was not needed.

The tours vary substantially. Fabric Stock and Production teach coherent operating models; Dispatch adds a particularly clear issue → receipt → settlement example; Yarn Stock explains its unusual ownership-based balance clearly. The estimator, Rate Book and register tours spend too much time on controls before explaining the workflow. The most consequential observed gaps are misleading estimator actions, stale assignment setup directions, unexplained worker-rate readiness and a payroll recovery example that conflicts with the rule displayed in the live UI.

Collectively, the completed tours communicate a costing → production → worker earnings/stock → dispatch and settlement lifecycle. They do not yet create consistent functional independence: names change between sections, setup dependencies are not consistently actionable, and some examples do not match the real page. No tour receives an overall Excellent rating.

**Method and limits.** Tours were manually started and advanced sequentially through the actual application; no credit was withheld for opt-in launch. Comprehension scores were recorded immediately after completion, before retention checks and before source inspection. Ordinary page text encountered during tours is identified separately where material. The public landing page was seen before login; its marketing claims are not credited to the tours. Scores are qualitative judgments from one owner persona across two Base workspaces, not a user-study sample. “Overall” below is the unweighted mean of the twelve frozen scores, not an independent confidence rating. UI scores reflect limited observed execution, not a full responsive certification.

**Safety and current state.** No costing, rate, worker, machine, assignment, stock movement, payment or production shift was saved by the auditor. A 12 m local production draft was entered for retention testing; its discard confirmation initially stalled browser automation. On recovery, the original tab showed all three rows blank, 0 m total, Not yet submitted, and disabled Save/Discard controls: draft removal is verified. Tour completion/preferences and the estimator’s local UI state may have changed. No implementation, copy, selectors or onboarding logic were modified, and no commit was made.

## 2. Tour Inventory

| Section | Route | Tour Steps | Tour Completed | Overall Score / 4 | Major Issue |
|---|---|---:|---|---:|---|
| Cost Estimator | `/owner/estimator` | 43 | Yes, English | 2.33 | The final action guidance describes draft/accepted quotations, market runs and party orders, while the live Base action area offers costing saves. |
| Saved Costings | `/owner/quotes` | 16 | Yes, English | 2.75 | The last step says a demo costing is available and can be deleted, but no identifiable demo appears after completion. |
| Yarn Rate Book | `/owner/rates` | 10 | Yes, English | 2.33 | The tour concentrates on filters and editing mechanics, leaving recipe matching and update consequences implicit. |
| Production | `/owner/production` | 30 | Yes, English | 3.17 | The tour requires operators and looms but does not explicitly route an empty factory through their registers and assignment board. |
| Machine Assignments | `/owner/assignments` | 23 | Yes, English | 2.83 | Steps 8 and 21 direct users to Production → Jobs and Machine jobs, while the live page uses Overview & Looms, Activate Quality and Assign Looms. |
| Machines | `/owner/machines?register=base` | 15 | Yes, English | 2.50 | The ending sends users to assignments for missing setup without explaining the Production prerequisite. |
| Workers | `/owner/workers` | 21 | Yes, English | 2.50 | Step 6 explains Rate setup and says the editor has no per-metre field, without telling users where the applicable wage comes from. |
| Payroll | `/owner/payroll` | 27 | Yes, English | 2.67 | Recovery example shows ₹1,000 pending, ₹2,000 gross and ₹500 recovery without a rule; live UI states a 50%-of-gross cap. |
| Fabric Stock | `/owner/stock` | 20 | Yes, English | 3.50 | Opening excludes fabric committed to historical pending dispatches but gives no way to identify those commitments. |
| Yarn Stock | `/owner/stock/yarn` | 26 | Yes, English | 3.33 | The tour asks for a verified total including yarn already inside undispatched fabric without illustrating that count. |
| Dispatch | `/owner/dispatches` | 33 | Yes, English | 3.25 | Desktop target highlight is displaced and preview dialog clipped; otherwise strong transaction teaching. |

Launch: each page offered **Take a tour · Tour: [section]**. Machine Assignments used **Tour: Machine Assignments** in its page guide. Replay controls remained available after completion. The estimator had 43 numbered steps; other tours used isolated or illustrative samples where indicated.

| Additional inventory | Finding |
|---|---|
| Settings — `/owner/settings` | No tour launcher. Inline guidance covers personal/factory scope, costing defaults and payroll cycle. A targeted payroll-cycle setup explanation is useful; a tour of every setting is unnecessary. |
| Plan & Billing — `/owner/billing` | No tour launcher. Current plan, renewal and history are self-explanatory enough; absence alone is not a defect. |
| Earlier dispatch records — `/owner/dispatches/legacy` | Link is visible, but selected workspace returns a factory-feature gate. No accessible additional tour. |
| Machine Assignments | Registry ID is `configuration`; this is the already-audited assignments tour, not a twelfth tour. |
| Alternate plan variants | Saved Costings: Free 9 steps, paid 15 plus conditional production/quotation steps; Base observed 16. Payroll: Base 27, Full 21. Estimator and Rate Book counts depend on rendered targets. Alternate variants were source-inspected only and have no UX score. |
| Other onboarding | Setup wizards are workflows, not additional registered opt-in section tours. No claim that this audit tests initial account provisioning. |

All observed tours completed through Finish. There were no observed P0 failures. Targeting defects and interrupted retention attempts are distinguished below. Counts refer to this run, not a universal count for dynamic tours. English was primary; Gujarati/Hindi Dispatch samples and a 390×844 mobile sample were inspected. Desktop default was 1280×720.

## 3. Section-by-Section Analysis

### Cost Estimator

**Route / completion:** `/owner/estimator`; 43/43 steps completed.

**Purpose I understood:** Build a fabric cost per metre from yarn, weaving, factory overhead and commercial inputs; review suggested price, margin and break-even.

**Value I understood:** Judge an enquiry’s price and reuse a fabric recipe instead of re-entering construction.

**Primary workflow I understood / what I now understand:** Enter or load a quality, review inputs, open the floating live estimate, then save. The precise save decision remains unclear.

**What I would do next:** Choose a saved quality or enter the fabric’s required inputs, then inspect the live estimate.

**What remains unclear / what I still do NOT understand:** The difference between Save Costing, Save Quality & Create Costing, and updating a quality; when a new version is created; what a draft/accepted quotation, market run or party order means.

**Incorrect assumptions created:** Step 41 led me to expect draft/accepted quotations and production/order creation directly from the live estimate. The actual Base controls did not provide those choices.

**What I had to discover myself:** The actual save buttons and their versioning explanation; More costing actions offered Export Cost Sheet and New Quality / Reset. Loading a recipe displayed Quality changed · Update Quality without an explanation from the tour.

**Practical workflow test:** Loaded existing QA recipe RB-PLAIN-75D-120CM. The live result showed ₹24.00/m production cost and ₹36.92/m suggested price at 35% margin. Successfully found the result and export menu. Did not save or update the recipe.

#### Scores

| Dimension | Score / 4 | Reason |
|---|---:|---|
| Purpose clarity | 3 | Purpose emerges through fields and metrics rather than an opening explanation. |
| Business value | 3 | Pricing outcome is understandable, but saved-record value arrives late. |
| Workflow comprehension | 2 | I can calculate, but cannot confidently choose the correct save action. |
| Feature comprehension | 3 | Strong explanations of blank/zero waste, units and consumption methods. |
| Prerequisites | 3 | Manual estimation does not appear to require another section; inputs are explained. |
| Cross-section relationships | 1 | Promised downstream actions do not match this Base UI. |
| Next action | 2 | The ending suggests selecting a recipe but omits the full review/save sequence. |
| Copy clarity | 3 | Mostly concise; action terminology is misleading. |
| Sequencing | 2 | Mode and fields precede purpose; saving is late and reuse is last. |
| Cognitive efficiency | 1 | 43 steps include repeated warp/weft definitions and overhead explanations. |
| Tooltip/UI execution | 3 | Stable sampled tooltips were readable; the tour leaves Detailed selected. |
| Post-tour confidence | 2 | I can estimate, but hesitate over saving and moving into production. |

#### Step-Level Findings

The chronological step ledger and immediate comprehension notes are preserved in [pass1-notes.md](/tmp/weavly-tour-audit-20260916/pass1-notes.md). It identifies the notable steps and repeated groups for this tour; all numbered steps were read. Visual inspection was sampled rather than performed for every step. The issues below identify the steps or clusters with the greatest teaching impact. The linked ledger also preserves A–J comprehension, input/output/state distinctions and retention observations.

#### Issues

**P1 — Cost Estimator 1.** The final action guidance describes draft/accepted quotations, market runs and party orders, while the live Base action area offers costing saves.

**Why it causes confusion / missing understanding:** The owner cannot map the taught action to the page or predict its result.

**Recommended fix:** Replace step 41 with Base-specific save choices, what each preserves, and the actual route from a saved costing to production.

**P2 — Cost Estimator 2.** The tour spends many steps defining yarn fields twice and repeats overhead and saved-quality guidance.

**Why it causes confusion / missing understanding:** The user must retain 43 steps before understanding the result and next action.

**Recommended fix:** Lead with the estimate/review/save loop; combine shared yarn rules, overhead explanation and the two saved-quality steps. Offer detailed field help separately.

**P2 — Cost Estimator 3.** The tour changes Quick to Detailed and ends there without explaining that transition.

**Why it causes confusion / missing understanding:** A beginner starts in one layout and is left in another.

**Recommended fix:** Explain the temporary mode change and restore the initial mode, or explicitly offer a mode choice at completion.

### Saved Costings

**Route / completion:** `/owner/quotes`; 16/16 steps completed.

**Purpose I understood:** Keep historical costing snapshots grouped by quality, inspect their original assumptions, reuse them and compare versions.

**Value I understood:** Explain why a price changed and retain the numbers behind a quotation or production decision.

**Primary workflow I understood / what I now understand:** Find a quality, choose a version, inspect its breakdown; reuse, duplicate, export or compare two saved versions.

**What I would do next:** Open a quality and its version breakdown. The promised demo is not identifiable on the restored page.

**What remains unclear / what I still do NOT understand:** What “where shown” conditions depend on; what “saved contracts” and “canonical comparison” mean; where the promised demo costing is.

**Incorrect assumptions created:** I expected an obvious sample costing to remain after finishing. The same five pre-existing QA qualities were restored, with no identifiable tour demo.

**What I had to discover myself:** The production link is called Activate for Production, rather than the tour’s Start Production. The real export dialog does provide internal and customer modes.

**Practical workflow test:** Opened a quality with three versions, selected v3, reviewed the historical ₹32.35/m breakdown and opened the internal document preview. Did not generate or share a document. Comparison was taught but not independently exercised.

#### Scores

| Dimension | Score / 4 | Reason |
|---|---:|---|
| Purpose clarity | 3 | Historical record purpose is clear. |
| Business value | 3 | Version comparison has a concrete pricing benefit. |
| Workflow comprehension | 3 | A coherent find/open/review/reuse sequence is taught. |
| Feature comprehension | 3 | Versioning, archiving and document privacy are useful. |
| Prerequisites | 3 | Explains saving a calculation first and needing two versions to compare. |
| Cross-section relationships | 3 | Connects estimator, saved records and production. |
| Next action | 2 | The final demo instruction is not actionable in the restored list. |
| Copy clarity | 2 | Conditional wording and implementation terms weaken otherwise clear copy. |
| Sequencing | 3 | Mostly follows actual review and reuse tasks. |
| Cognitive efficiency | 2 | Some repeated breakdown/comparison steps and long multi-action paragraphs. |
| Tooltip/UI execution | 3 | The sampled final tooltip is readable; completion restores the list. |
| Post-tour confidence | 3 | Basic review and export feel usable; demo and conditional actions remain uncertain. |

#### Step-Level Findings

The chronological step ledger and immediate comprehension notes are preserved in [pass1-notes.md](/tmp/weavly-tour-audit-20260916/pass1-notes.md). It identifies the notable steps and repeated groups for this tour; all numbered steps were read. Visual inspection was sampled rather than performed for every step. The issues below identify the steps or clusters with the greatest teaching impact. The linked ledger also preserves A–J comprehension, input/output/state distinctions and retention observations.

#### Issues

**P2 — Saved Costings 1.** The last step says a demo costing is available and can be deleted, but no identifiable demo appears after completion.

**Why it causes confusion / missing understanding:** The suggested first independent exercise leads to a search for a missing record.

**Recommended fix:** Show that instruction only when a clearly named demo exists; otherwise direct the user to an existing quality or New Costing.

**P2 — Saved Costings 2.** Copy includes “canonical comparison,” “saved contracts,” and repeated “where shown.”

**Why it causes confusion / missing understanding:** The owner must interpret implementation vocabulary and uncertain feature availability.

**Recommended fix:** Use “this older costing lacks enough saved detail to compare” and render only the actions available to the current account.

### Yarn Rate Book

**Route / completion:** `/owner/rates`; 10/10 steps completed.

**Purpose I understood:** Maintain current yarn prices, review due rates and see changes from the previously recorded price.

**Value I understood:** Keep future estimates closer to current supplier prices.

**Primary workflow I understood / what I now understand:** Find a yarn, edit its rupee-per-kilogram price and optional source note; add a yarn when it is not listed.

**What I would do next:** Add the required yarn or open Edit rate for an existing one.

**What remains unclear / what I still do NOT understand:** How yarns link to qualities; how defaults are configured; what effective date versus review date means; exactly which future estimates change after saving.

**Incorrect assumptions created:** “Market trend” could suggest an external market feed, although the later price-trend step clarifies that the comparison is with the previously recorded price. I did not retain a confirmed belief that prices update automatically.

**What I had to discover myself:** The highlighted editor and page text explain that future estimates change while past snapshots remain unchanged. That relationship deserves explicit tour treatment.

**Practical workflow test:** After finishing, attempted the Polyester Warp 75D Edit rate control by accessibility and visible coordinate. Neither opened an editor in that session; navigation still worked. On a later fresh visit in the restored Base owner workspace, another existing yarn’s editor opened successfully and was cancelled. The original failure remains unconfirmed and is not attributed to tour code.

#### Scores

| Dimension | Score / 4 | Reason |
|---|---:|---|
| Purpose clarity | 3 | The rate-list purpose is understandable. |
| Business value | 2 | Maintaining trustworthy future estimates is mostly implicit. |
| Workflow comprehension | 2 | Basic edit path is taught, but linking and date semantics are not. |
| Feature comprehension | 3 | Useful price delta and review filter explanations. |
| Prerequisites | 2 | Recipe matching and default setup are not explained. |
| Cross-section relationships | 2 | Historical preservation appears in underlying UI rather than the main teaching sequence. |
| Next action | 2 | Ends on rename restrictions instead of an explicit update/review task. |
| Copy clarity | 3 | Mostly clear; “review cadences” and “formula integrity” are unnecessary jargon. |
| Sequencing | 2 | Search and filters precede adding and understanding a rate. |
| Cognitive efficiency | 2 | Several control descriptions could be combined. |
| Tooltip/UI execution | 3 | Final editor/tooltip were readable; completion’s transient panel disappeared. |
| Post-tour confidence | 2 | I know where to start, but cannot predict all propagation effects. |

#### Step-Level Findings

The chronological step ledger and immediate comprehension notes are preserved in [pass1-notes.md](/tmp/weavly-tour-audit-20260916/pass1-notes.md). It identifies the notable steps and repeated groups for this tour; all numbered steps were read. Visual inspection was sampled rather than performed for every step. The issues below identify the steps or clusters with the greatest teaching impact. The linked ledger also preserves A–J comprehension, input/output/state distinctions and retention observations.

#### Issues

**P2 — Yarn Rate Book 1.** The tour concentrates on filters and editing mechanics, leaving recipe matching and update consequences implicit.

**Why it causes confusion / missing understanding:** A price update affects reused estimates, so the user needs to know the scope of the change.

**Recommended fix:** Introduce one linked-quality example and state which future estimates update and which saved snapshots do not.

**P2 — Yarn Rate Book 2.** The final editor step lists dates/review intervals without distinguishing them or explaining defaults setup.

**Why it causes confusion / missing understanding:** An owner can enter a price but may set the wrong timing or expect automatic default behavior.

**Recommended fix:** Explain effective date and review date beside those controls and either show default configuration or remove the ungrounded default claim.

### Production

**Route / completion:** `/owner/production`; 30/30 steps completed.

**Purpose I understood:** Activate a saved quality, allocate looms and operators, and record output for a date and shift.

**Value I understood:** Turn production readings into traceable worker earnings and preserve reasons for corrections.

**Primary workflow I understood / what I now understand:** Saved costing/version → active quality and weaver wage → looms/operators → shift metres → review worker totals → save; later inspect or correct eligible logs.

**What I would do next:** For configured looms, open Daily Sheet and check date and shift. Otherwise activate a quality and complete loom/operator setup.

**What remains unclear / what I still do NOT understand:** Where to create missing workers and machines; the exact operator-assignment interaction; where to settle the resulting earnings; stock effects; handling a newer costing version.

**Incorrect assumptions created:** No demonstrated incorrect core assumption. “Running” was correctly taught as assigned quality, not live machine telemetry.

**What I had to discover myself:** The live sheet explicitly says to use shift output rather than cumulative meter readings. The tour’s “output” wording helps, but this operational distinction is clearer on the real form.

**Practical workflow test:** Entered an unsaved 12 m reading for NAVQA-0911 Loom reviewed on 16 September, day shift. The sheet showed 1/3 accounted, 2 pending and ₹96 worker pay at ₹8/m. No shift was submitted. Discard draft opened a browser confirmation that automation could not resolve; the original tab later recovered with blank rows, 0m, Not yet submitted and disabled Save/Discard. Removal of the test draft is verified.

#### Scores

| Dimension | Score / 4 | Reason |
|---|---:|---|
| Purpose clarity | 4 | Opens with the full production lifecycle. |
| Business value | 3 | Connects readings to earnings and correction accountability. |
| Workflow comprehension | 3 | Core sequence is clear; operator setup is not walked through. |
| Feature comprehension | 3 | Strong blank/zero, draft/submitted and paid-entry distinctions. |
| Prerequisites | 2 | Missing workers/machines are not given clear creation destinations. |
| Cross-section relationships | 3 | Costing and earnings are connected; stock and payroll destinations are not. |
| Next action | 4 | Ends with a useful ordered recap. |
| Copy clarity | 4 | Concrete short explanations and a numerical wage example. |
| Sequencing | 3 | Maintenance interrupts the path before first daily entry. |
| Cognitive efficiency | 3 | 30 steps contain useful detail, with a few merge opportunities. |
| Tooltip/UI execution | 3 | Sample earnings highlight is clear; all steps completed. |
| Post-tour confidence | 3 | Basic entry is usable; initial setup and downstream handoff need help. |

#### Step-Level Findings

The chronological step ledger and immediate comprehension notes are preserved in [pass1-notes.md](/tmp/weavly-tour-audit-20260916/pass1-notes.md). It identifies the notable steps and repeated groups for this tour; all numbered steps were read. Visual inspection was sampled rather than performed for every step. The issues below identify the steps or clusters with the greatest teaching impact. The linked ledger also preserves A–J comprehension, input/output/state distinctions and retention observations.

#### Issues

**P2 — Production 1.** The tour requires operators and looms but does not explicitly route an empty factory through their registers and assignment board.

**Why it causes confusion / missing understanding:** A populated sample hides the new-owner setup gap.

**Recommended fix:** Add a short prerequisite map before activation: Workers, Machines, active quality/loom allocation, then Machine Assignments.

**P2 — Production 2.** Saving is connected to earnings but not to Fabric Stock or the Payroll destination.

**Why it causes confusion / missing understanding:** The owner understands local results without the full operational consequence.

**Recommended fix:** At the save step, explain fabric-stock addition and direct the owner to Payroll for settlement; retain the yarn-stock exception for Yarn Stock guidance.

**P3 — Production 3.** Switching/deactivation and separate blank/zero or lock/reason steps lengthen first-use learning.

**Why it causes confusion / missing understanding:** The first core workflow takes longer to reach.

**Recommended fix:** Move maintenance into a replayable follow-up and merge paired state explanations.

### Machine Assignments

**Route / completion:** `/owner/assignments`; 23/23 steps completed.

**Purpose I understood:** Connect piece-rate workers to machines separately for day and night shifts.

**Value I understood:** Ensure daily machine output is attributed to the correct worker while preserving saved production and pay history.

**Primary workflow I understood / what I now understand:** Prepare worker, machine and active production job; choose shift and worker; use Assign or drag to a machine. Selection saves immediately; replacement prompts and Undo support correction.

**What I would do next:** Check prerequisites, then assign the worker for each applicable shift.

**What remains unclear / what I still do NOT understand:** The tour’s Production → Jobs and Machine jobs directions do not match the Production page’s visible terminology.

**Incorrect assumptions created:** I would look for a Jobs tab or Machine jobs control that was not present in the Production page I experienced.

**What I had to discover myself:** The actual production setup controls are Overview & Looms, Activate Quality and Assign Looms.

**Practical workflow test:** Opened Assign for the NAVQA piece-rate worker. Its current machine was disabled, and other machines named their existing worker. Immediate-save behavior matched the tour. Closed without choosing or changing an assignment.

#### Scores

| Dimension | Score / 4 | Reason |
|---|---:|---|
| Purpose clarity | 4 | Purpose and shift-specific links are explicit. |
| Business value | 3 | Connection to Daily production is clear. |
| Workflow comprehension | 3 | Assignment, replacement and unlinking are taught. |
| Feature comprehension | 3 | Cardinality and immediate-save behavior are strong. |
| Prerequisites | 2 | Correct prerequisite concept, but stale navigation names. |
| Cross-section relationships | 3 | Workers/Machines/Production relationships are explained. |
| Next action | 3 | Recap is usable except for stale destination language. |
| Copy clarity | 3 | Mostly clear; long condition-heavy paragraphs recur. |
| Sequencing | 2 | Repeated picker states delay setup guidance. |
| Cognitive efficiency | 2 | 23 steps repeat current/replacement/no-job/Undo concepts. |
| Tooltip/UI execution | 3 | Readable tour; the final small highlighted region conveys little. |
| Post-tour confidence | 3 | Can use the picker; initial job setup directions cause hesitation. |

#### Step-Level Findings

The chronological step ledger and immediate comprehension notes are preserved in [pass1-notes.md](/tmp/weavly-tour-audit-20260916/pass1-notes.md). It identifies the notable steps and repeated groups for this tour; all numbered steps were read. Visual inspection was sampled rather than performed for every step. The issues below identify the steps or clusters with the greatest teaching impact. The linked ledger also preserves A–J comprehension, input/output/state distinctions and retention observations.

#### Issues

**P1 — Machine Assignments 1.** Steps 8 and 21 direct users to Production → Jobs and Machine jobs, while the live page uses Overview & Looms, Activate Quality and Assign Looms.

**Why it causes confusion / missing understanding:** The required prerequisite cannot be followed literally.

**Recommended fix:** Update the directions and target the current activation/allocation controls; validate the route from an unconfigured machine.

**P2 — Machine Assignments 2.** Picker summary and following individual steps repeat Current, replacement, missing job and Undo.

**Why it causes confusion / missing understanding:** The same constraints consume several steps without new understanding.

**Recommended fix:** Use one annotated picker example and one replacement/Undo example; move setup links before assignment.

### Machines

**Route / completion:** `/owner/machines?register=base`; 15/15 steps completed.

**Purpose I understood:** Register looms and review whether they have worker and costing assignments.

**Value I understood:** Keep identifiable machine records and spot incomplete setup.

**Primary workflow I understood / what I now understand:** Add a machine with type and optional name/label; edit details or availability; follow View assignment to continue setup.

**What I would do next:** Add a loom, then finish its production and worker setup.

**What remains unclear / what I still do NOT understand:** How and where to attach the production quality before assigning a worker; which shift the readiness badge represents; what “daily context” means.

**Incorrect assumptions created:** No demonstrated incorrect assumption, but “Active” readiness and the separate availability setting are easy to conflate across pages.

**What I had to discover myself:** The actual Add machine form defaults type to Other and allows both name and label to remain blank, as taught.

**Practical workflow test:** Opened Add machine and identified the expected optional name, type and label controls. Cancelled without adding a record.

#### Scores

| Dimension | Score / 4 | Reason |
|---|---:|---|
| Purpose clarity | 3 | Register purpose is clear from the page and tour. |
| Business value | 2 | Factory outcome is mostly limited to readiness. |
| Workflow comprehension | 3 | Creation and editing are understandable. |
| Feature comprehension | 3 | Label precedence and readiness/availability distinction are useful. |
| Prerequisites | 2 | Does not teach production activation before worker assignment. |
| Cross-section relationships | 2 | Links to assignments but leaves Production implicit. |
| Next action | 3 | A practical add/review/continue ending. |
| Copy clarity | 3 | “Daily context” is vague. |
| Sequencing | 2 | Search/readiness repetitions precede creating the first loom. |
| Cognitive efficiency | 2 | 15 steps are heavy for the small register workflow. |
| Tooltip/UI execution | 2 | Final highlight was a clipped horizontal strip, separate from the readable tooltip. |
| Post-tour confidence | 3 | Register use is straightforward; full readiness setup is not. |

#### Step-Level Findings

The chronological step ledger and immediate comprehension notes are preserved in [pass1-notes.md](/tmp/weavly-tour-audit-20260916/pass1-notes.md). It identifies the notable steps and repeated groups for this tour; all numbered steps were read. Visual inspection was sampled rather than performed for every step. The issues below identify the steps or clusters with the greatest teaching impact. The linked ledger also preserves A–J comprehension, input/output/state distinctions and retention observations.

#### Issues

**P2 — Machines 1.** The ending sends users to assignments for missing setup without explaining the Production prerequisite.

**Why it causes confusion / missing understanding:** An owner may reach a disabled machine picker and not know how to proceed.

**Recommended fix:** Explain the two setup links: activate/allocate a quality in Production, then choose a worker in Machine Assignments.

**P2 — Machines 2.** Readiness is repeated in filter, badge, worker, costing and incomplete-example steps.

**Why it causes confusion / missing understanding:** A simple register receives disproportionate attention.

**Recommended fix:** Combine these into one configured/unconfigured comparison and retain the separate availability distinction.

**P3 — Machines 3.** The final target appears as a clipped strip near the top of the page.

**Why it causes confusion / missing understanding:** Highlighting contributes little context despite readable copy.

**Recommended fix:** Target the actual add/setup action or use a deliberately unanchored closing recap.

### Workers

**Route / completion:** `/owner/workers`; 21/21 steps completed.

**Purpose I understood:** Register the workforce, choose piece-rate or fixed salary, and manage availability and salary dates.

**Value I understood:** Prepare workers for assignment and establish dated salary information used by Payroll.

**Primary workflow I understood / what I now understand:** Add a named worker, choose the immutable pay type, set shift availability or salary/joining details, then use assignments or Payroll. Existing salaries can change from a future effective date.

**What I would do next:** Add the correct worker type, then complete the appropriate assignment or payroll setup.

**What remains unclear / what I still do NOT understand:** Where to configure a piece-rate worker’s Rate setup; whether “Not configured” blocks pay; why the NAVQA worker earned correctly in the Production test despite that label.

**Incorrect assumptions created:** The card invites an assumption that the worker is not ready to earn until a separate worker rate is configured, but the tour does not resolve that interpretation.

**What I had to discover myself:** The real piece-rate Add worker form has only name, pay type and shift availability. There is no rate field, as the tour says, but no remedy is supplied.

**Practical workflow test:** Opened Add worker, identified pay type and shift controls, and cancelled. Followed the salary worker’s Payroll link successfully. No worker or salary record was changed.

#### Scores

| Dimension | Score / 4 | Reason |
|---|---:|---|
| Purpose clarity | 3 | Workforce-register purpose is understandable. |
| Business value | 3 | Salary and assignment benefits are taught. |
| Workflow comprehension | 2 | Salary setup is strong; piece-rate readiness is incomplete. |
| Feature comprehension | 3 | Immutable pay type and date restrictions are useful. |
| Prerequisites | 2 | Rate readiness has no actionable configuration destination. |
| Cross-section relationships | 2 | Assignment/Payroll links are present but wage-source connection is missing. |
| Next action | 3 | Clear add/setup/continue recap. |
| Copy clarity | 3 | Mostly clear, with a misleading unresolved rate-status concept. |
| Sequencing | 2 | Three filter steps precede the workforce model. |
| Cognitive efficiency | 2 | Name/search/card explanations could be shortened. |
| Tooltip/UI execution | 3 | All steps completed; visual coverage was sampled, not exhaustive. |
| Post-tour confidence | 2 | Can add staff, but would seek help on piece-rate readiness. |

#### Step-Level Findings

The chronological step ledger and immediate comprehension notes are preserved in [pass1-notes.md](/tmp/weavly-tour-audit-20260916/pass1-notes.md). It identifies the notable steps and repeated groups for this tour; all numbered steps were read. Visual inspection was sampled rather than performed for every step. The issues below identify the steps or clusters with the greatest teaching impact. The linked ledger also preserves A–J comprehension, input/output/state distinctions and retention observations.

#### Issues

**P1 — Workers 1.** Step 6 explains Rate setup and says the editor has no per-metre field, without telling users where the applicable wage comes from.

**Why it causes confusion / missing understanding:** The owner cannot fix the apparent readiness problem or predict whether production will earn pay.

**Recommended fix:** Explain the Base wage source in Production and either align the readiness badge with that model or explicitly distinguish any legacy worker rate.

**P2 — Workers 2.** Search/filter/card steps precede pay-type choice and the purpose of setup.

**Why it causes confusion / missing understanding:** Attention is spent on obvious controls before important irreversible choices.

**Recommended fix:** Open with workforce → assignments/payroll, then the pay-type decision; combine filters into one optional step.

### Payroll

**Route / completion:** `/owner/payroll`; 27/27 steps completed.

**Purpose I understood:** Review production-based and salary earnings, recover advances/deductions, record payment and complete a payroll period.

**Value I understood:** Know what is owed, retain payment evidence and trace the calculation behind worker pay.

**Primary workflow I understood / what I now understand:** Choose period, resolve readiness, inspect gross/recovery/net, open settlement, record actual payment details, then complete the period when obligations are resolved.

**What I would do next:** Review the selected period and worker calculations before recording any payment.

**What remains unclear / what I still do NOT understand:** The recovery formula; treatment of zero-earning obligations; the relationship between month-end display and current-day salary accrual; detailed advance versus deduction recovery rules.

**Incorrect assumptions created:** The example could lead me to expect ₹500 recovery from ₹2,000 gross with ₹1,000 outstanding, although the live rule shown on the page implies ₹1,000 recovery.

**What I had to discover myself:** The live page states recovery is the lower of outstanding advance balance and 50% of gross. Settlement shows Resolve for zero-earning workers. The tour never explains that resolution path.

**Practical workflow test:** Opened Settle Payroll and expanded the salary calculation: ₹10,000 × 6/30 days = ₹2,000. Located individual payment and disabled Complete Payroll controls. Did not mark paid, add advances/deductions, complete or reverse payroll.

#### Scores

| Dimension | Score / 4 | Reason |
|---|---:|---|
| Purpose clarity | 3 | Purpose is understandable but not stated in a concise opening. |
| Business value | 3 | Earnings and payment accountability are connected. |
| Workflow comprehension | 3 | Review/payment/completion sequence is coherent. |
| Feature comprehension | 3 | Payment record versus money transfer is explained well. |
| Prerequisites | 2 | Readiness issues and no-earnings completion lack remedies. |
| Cross-section relationships | 3 | Production and salary sources are identified. |
| Next action | 3 | Ends with review-before-payment guidance. |
| Copy clarity | 3 | Most copy is clear; recovery example is misleading. |
| Sequencing | 3 | Generally task ordered, though filters precede earnings. |
| Cognitive efficiency | 2 | 27 steps include separate mode/date/note steps and repeated review instructions. |
| Tooltip/UI execution | 2 | Final highlight covers a narrow card strip; tooltip remains readable. |
| Post-tour confidence | 2 | Would hesitate to settle until recovery and zero-earnings handling are explained. |

#### Step-Level Findings

The chronological step ledger and immediate comprehension notes are preserved in [pass1-notes.md](/tmp/weavly-tour-audit-20260916/pass1-notes.md). It identifies the notable steps and repeated groups for this tour; all numbered steps were read. Visual inspection was sampled rather than performed for every step. The issues below identify the steps or clusters with the greatest teaching impact. The linked ledger also preserves A–J comprehension, input/output/state distinctions and retention observations.

#### Issues

**P1 — Payroll 1.** Recovery example shows ₹1,000 pending, ₹2,000 gross and ₹500 recovery without a rule; live UI states a 50%-of-gross cap.

**Why it causes confusion / missing understanding:** The example does not teach the displayed product rule and creates a wrong payout expectation.

**Recommended fix:** Use a numerically consistent example, state the rule, and show carried balance; separately explain deduction treatment if different.

**P2 — Payroll 2.** Complete Payroll requires resolved obligations, but zero-earning workers show an unexplained Resolve action in practice.

**Why it causes confusion / missing understanding:** A user can reach the end of the taught sequence and still be unable to complete the period.

**Recommended fix:** Include a no-earnings example and the actual resolution path, including what that action records.

**P3 — Payroll 3.** Payment mode, payment date and note each have their own step.

**Why it causes confusion / missing understanding:** These small related inputs add avoidable length.

**Recommended fix:** Combine them into one payment-record example while preserving the record-versus-transfer distinction.

### Fabric Stock

**Route / completion:** `/owner/stock`; 20/20 steps completed.

**Purpose I understood:** Track available fabric metres by quality through opening stock, production, dispatches and corrections.

**Value I understood:** Know available fabric and explain differences between physical counts and recorded balances.

**Primary workflow I understood / what I now understand:** Record verified pre-start stock once, let saved production/dispatch movements update balances, correct to a verified total when needed, and trace history.

**What I would do next:** Check the tracking start and verify pre-existing physical stock before entering opening stock.

**What remains unclear / what I still do NOT understand:** How to identify fabric committed to historical pending dispatches when calculating an opening count; at this immediate post-tour point, exact dispatch deduction timing awaited the later Dispatch tour (which subsequently explained confirmation).

**Incorrect assumptions created:** No demonstrated incorrect assumption; additive opening versus absolute correction is clearly distinguished.

**What I had to discover myself:** The live opening form locks the quality when opened from a card and requests the pre-start amount plus a reason.

**Practical workflow test:** Opened a quality’s Opening stock form, identified its fixed quality, additive pre-start metres and reason. Closed without saving. Actual movement posting was not exercised.

#### Scores

| Dimension | Score / 4 | Reason |
|---|---:|---|
| Purpose clarity | 4 | Opens with the inventory model. |
| Business value | 3 | Availability and traceability have clear business value. |
| Workflow comprehension | 4 | Opening/correction/history workflow is usable. |
| Feature comprehension | 3 | Numeric examples explain addition versus total replacement. |
| Prerequisites | 3 | Cutover and historical exclusions are addressed. |
| Cross-section relationships | 4 | Production and dispatch effects are explicit. |
| Next action | 4 | A concrete first-count and review ending. |
| Copy clarity | 4 | Plain, precise language with useful units. |
| Sequencing | 3 | Logical sequence with a few repeated opening steps. |
| Cognitive efficiency | 3 | Some reason/save/pagination steps could be merged. |
| Tooltip/UI execution | 3 | All steps completed; comprehensive screenshot coverage was not performed. |
| Post-tour confidence | 4 | Would confidently inspect balances and prepare a verified opening entry. |

#### Step-Level Findings

The chronological step ledger and immediate comprehension notes are preserved in [pass1-notes.md](/tmp/weavly-tour-audit-20260916/pass1-notes.md). It identifies the notable steps and repeated groups for this tour; all numbered steps were read. Visual inspection was sampled rather than performed for every step. The issues below identify the steps or clusters with the greatest teaching impact. The linked ledger also preserves A–J comprehension, input/output/state distinctions and retention observations.

#### Issues

**P2 — Fabric Stock 1.** Opening excludes fabric committed to historical pending dispatches but gives no way to identify those commitments.

**Why it causes confusion / missing understanding:** The owner can understand the rule and still enter the wrong starting balance.

**Recommended fix:** Point to the exact pending-dispatch view and provide a short count example that excludes already committed fabric.

**P3 — Fabric Stock 2.** Opening reminder/start, separate reason/save, and history pagination each consume steps.

**Why it causes confusion / missing understanding:** These add length after the central model is already clear.

**Recommended fix:** Merge them into opening and history examples without removing the cutover or absolute-correction distinctions.

### Yarn Stock

**Route / completion:** `/owner/stock/yarn`; 26/26 steps completed.

**Purpose I understood:** Track owned yarn kilograms, including yarn inside undispatched fabric; confirmed dispatch deducts linked costing weights.

**Value I understood:** Reconcile yarn ownership and trace dispatch deductions using a fixed saved formula.

**Primary workflow I understood / what I now understand:** Record opening yarn and receipts, link each fabric to a compatible costing, review deductions, correct verified totals and inspect dated balances.

**What I would do next:** Prepare the required opening weights and compatible costing links before the next dispatch.

**What remains unclear / what I still do NOT understand:** How to verify yarn embodied in fabric during a physical count; the exact meaning of incompatible weights; what happens when one yarn balance is missing.

**Incorrect assumptions created:** No demonstrated incorrect core assumption. The tour explicitly corrects the ordinary expectation that production consumes this balance.

**What I had to discover myself:** No additional workflow understanding gained after the tour; opening Link costing stalled the browser before its form could be inspected.

**Practical workflow test:** Tour completed all 26 steps. Attempt to open a real Link costing form timed out and the browser then disappeared. No link or stock value was saved. Post-pass recovery check in the second Base workspace opened Link costing for D.246: no compatible costing was available, Save was disabled, and the form directed the user to save a fresh costing first. It was closed unchanged. This verifies form access and a recovery message, not successful linking or unaided retention; the frozen score remains unchanged.

#### Scores

| Dimension | Score / 4 | Reason |
|---|---:|---|
| Purpose clarity | 4 | The nonstandard inventory definition is stated first. |
| Business value | 3 | Owned-stock audit value is understandable. |
| Workflow comprehension | 3 | Core entry/link/audit loop is taught. |
| Feature comprehension | 3 | Opening/receipt/correction and historical views are distinguished. |
| Prerequisites | 3 | First-entry tracking and dispatch prerequisites are explained. |
| Cross-section relationships | 4 | Costing, undispatched fabric and dispatch deductions connect well. |
| Next action | 4 | Clear opening/receipt/link/review recap. |
| Copy clarity | 4 | Generally precise and concrete. |
| Sequencing | 3 | Logical sequence from tracking to links and audit. |
| Cognitive efficiency | 3 | 26 steps are substantial but cover real differences. |
| Tooltip/UI execution | 3 | All steps readable through accessibility; this tour did not receive a full visual/mobile sweep. |
| Post-tour confidence | 3 | Conceptually usable, but physical-count method and retention are unresolved. |

#### Step-Level Findings

The chronological step ledger and immediate comprehension notes are preserved in [pass1-notes.md](/tmp/weavly-tour-audit-20260916/pass1-notes.md). It identifies the notable steps and repeated groups for this tour; all numbered steps were read. Visual inspection was sampled rather than performed for every step. The issues below identify the steps or clusters with the greatest teaching impact. The linked ledger also preserves A–J comprehension, input/output/state distinctions and retention observations.

#### Issues

**P2 — Yarn Stock 1.** The tour asks for a verified total including yarn already inside undispatched fabric without illustrating that count.

**Why it causes confusion / missing understanding:** An owner counting only loose yarn could make a materially wrong correction.

**Recommended fix:** Show a concrete loose-yarn plus undispatched-fabric calculation and identify which saved formula to use for the latter.

**P2 — Yarn Stock 2.** “Compatible yarn weights” leads only to “save a fresh costing.”

**Why it causes confusion / missing understanding:** The user lacks enough information to repair a rejected link confidently.

**Recommended fix:** Show the live incompatibility message and the minimum costing information needed for a valid link.

### Dispatch

**Route / completion:** `/owner/dispatches`; 33/33 English steps completed.

**Purpose I understood:** Manage an independent fabric dispatch, customer receipt and money due.

**Value I understood:** Keep goods leaving the factory, customer acknowledgement and settlement consistent while preserving their separate statuses.

**Primary workflow I understood / what I now understand:** Pick one stock quality, enter selling rate, sender/customer/delivery details, date and lot/metre lines. Save and review a numbered draft without moving stock. Confirm once goods leave; this fixes document details and deducts fabric and linked yarn. Record receipt, accept or dispute a difference, then record received payments and charges/credits. Receipt shortages do not return stock. Payment recording does not charge the customer.

**What I would do next:** Open New dispatch, select available quality and prepare a draft before issue.

**Inputs, outputs, states and prerequisites:** Positive price and lot metres, unique lot identifiers, required parties and addresses; optional terms, due date and references. Tax references do not calculate charges. Yarn tracking requires linked costing weights and balances. Draft/issued, receipt/dispute, payment/credit and archive are separate. Financial entry reversal differs from dispatch reversal; the latter requires all fabric physically present and no later activity.

**What remains unclear:** Exact destination for linking costing before issue; which financial entries qualify for reversal; how to handle an actual physical return after later activity. These exceptions need contextual help rather than expansion of the basic tour.

**Incorrect assumptions created:** No incorrect business interpretation from the copy. The step-7 highlight visually implied the quality field was where selling rate was entered.

**What I had to discover myself:** The actual draft exposes required marks and two qualities with zero available metres. The legacy destination is gated in this workspace.

**Practical workflow test:** Opened New dispatch without replay. Recognised quality/rate/addresses/lot fields and the save boundary. Closed without changing or saving anything. No issue, receipt, payment, refund or reversal was submitted; end-to-end financial retention remains untested.

#### Scores

| Dimension | Score / 4 | Reason |
|---|---:|---|
| Purpose clarity | 4 | Clear scope: challan, receipt and payment. |
| Business value | 4 | Connects goods sent, acknowledged metres and amount due. |
| Workflow comprehension | 4 | A complete draft-to-settlement sequence with consistent numbers. |
| Feature comprehension | 3 | Core features clear; many rare exceptions in one pass. |
| Prerequisites | 3 | Stock, linked costing and yarn balances named; exact setup destination omitted. |
| Cross-section relationships | 4 | Fabric, yarn, production and financial effects distinguished. |
| Next action | 4 | Prepare/review a draft then confirm only when goods leave. |
| Copy clarity | 4 | Plain instructions and useful numerical examples. |
| Sequencing | 3 | Core sequence sound; search/status precede first draft. |
| Cognitive efficiency | 2 | 33 steps mix basic workflow with keyboard and correction detail. |
| Tooltip/UI execution | 1 | Stable desktop highlight misses selling rate; sample form clipped left. |
| Post-tour confidence | 3 | Can begin a draft; issued and correction workflows not practised live. |

#### Step-Level Findings

- 1–4: useful separation of delivery, receipt and payment; search/load-more can move after the basic loop.
- 5–10: draft has no stock effect; one quality/multiple lots; selling price differs from cost/wage; optional due date and reference-only GST are clear.
- 11–15: lot requirements and 100 m × ₹40 = ₹4,000 teach the result. Keyboard navigation and a separate print-safety step interrupt the central sequence.
- 16–18: issue locks details and deducts stock; 10 kg/100 m illustrates the linked yarn calculation. Name the Yarn Stock setup destination here.
- 19–23: strongest sequence: 100 sent, 98 acknowledged, 2 m discrepancy, ₹3,920 accepted value, ₹2,000 paid, ₹1,920 remaining. A shortage never silently replenishes stock.
- 24–28: distinguishes recorded payment, signed adjustments, due-date changes and credit refunds.
- 29–32: audit and two reversal types are useful but dense first-use maintenance material; legacy route is not usable in this workspace.
- 33: ends with the full practical loop, rather than congratulations alone.

#### Issues

**P1 — Displaced desktop targets and clipped preview.** Step 7 highlights above/left of the selling-rate field; the sample dialog begins off the viewport. Repeated screenshots and rendered DOM measurements confirm the mismatch. A user cannot reliably associate instructions with the control. Correct the scaled coordinate space and dialog translation, then verify every preview-based tour at scaled desktop widths. Keep this a shared UI fix, not a copy rewrite.

**P2 — Prerequisite destination omitted.** Step 17 requires links and yarn balances but does not name the route. Say “In Yarn Stock, link this fabric quality to the costing version and record the required yarn balances, then return here.”

**P2 — Basic and exception workflows overload one tour.** Thirty-three steps include keyboard navigation, financial reversal, dispatch reversal and legacy navigation. Keep draft → issue → receipt → balance in the first tour; move detailed corrections to a replayable contextual walkthrough. Preserve the no-stock-return distinction in the main flow.

## 4. Cross-Product Findings

**Product mental model and value.** The completed tours establish that Weavly can retain a fabric’s costing assumptions, use a version for production, associate output with workers, calculate pay and maintain stock records. This is more than isolated feature awareness. The weaker tours nevertheless leave the owner stitching together missing connections.

**Section relationships and navigation.** Saved Costings explains historic snapshots; Production explains wage snapshots; Stock explains movement effects. These make a useful chain. But estimator “quotation/market run/party order,” assignment “Jobs/Machine jobs,” production “active quality,” and machine “costing” are not consistently reconciled. The user should not need to infer that differently named controls represent the next part of one process.

**Prerequisites.** Dependencies are strongest in the stock tours and Machine Assignments conceptually. They are weaker at the initial factory setup boundary: Workers and Machines direct the user to assignments, while assignment eligibility depends on production setup. Worker-rate readiness introduces another unresolved dependency.

**Terminology and states.** Production explicitly distinguishes assigned Running from physical activity, Machines distinguishes Active readiness from availability, and Stock distinguishes additions from corrected totals. These are valuable explanations of Weavly-specific meaning. The number of meanings attached to active/available/assigned still creates cross-page effort. “Canonical comparison,” “saved contracts,” “daily context” and “review cadences” add unnecessary software language.

**Consistency, duplication and load.** Sample isolation and replay support are strong. First steps vary between workflow-first teaching and search/filter descriptions. The eleven completed tours total 264 steps. Repeating names, filters, field definitions, sample-safety statements and separate save/review instructions creates substantial attention cost. More steps are not the default remedy.

**Missing guidance.** Core gaps are the Base save model, authoritative piece-rate wage source, exact prerequisite routes, recovery calculation, zero-earning payroll resolution, and a practical count including yarn in fabric. Dispatch closes the receipt/payment loop, but does not resolve the setup gaps in earlier tours. Settings explains defaults inline; there is no shared guided setup-to-operation map.

**Visual execution.** Sampled estimator and Rate Book tooltips were readable. Some register/payroll closing highlights appeared as clipped horizontal strips or very small targets away from the closing tooltip. These observations need targeted replay and responsive diagnosis. A screenshot captured immediately during an estimator transition showed the prior step; it was rechecked after settling and is not reported as a stable defect.

**Technical versus automation findings.** The Rate Book editor failed to open twice after its original tour. On a fresh visit in the restored Base owner account, Edit rate opened correctly and was cancelled without saving. The original account-specific failure is not established as an application defect. Browser handling of a native production-discard confirmation failed, then later ordinary calls stalled and the browser disappeared. On recovery the original draft was visibly cleared. These are recorded as test limitations, not proven application defects.

#### Pass 2 — Implementation diagnosis (kept separate from UX scores)

The local checkout was inspected only after all eleven first-pass tours and final persona answers were frozen. Its matching copy and layout mechanisms explain observed behavior; a deployed commit hash was not independently verified. Source-only variants and potential shared effects are not represented as separately user-tested findings.

| Observed issue | Source explanation | Concrete remediation |
|---|---|---|
| Estimator step 41 promises unavailable quotation/order actions | [Shared action copy](</Users/rajpatel/Projects/textile Saas/lib/i18n/cost-estimate-tutorial.ts:182>) contains the exact sentence. [Step collection](</Users/rajpatel/Projects/textile Saas/components/estimator/CostEstimateTutorial.tsx:204>) always adds the live-action step; its copy is not a Base-specific action description. | Select guidance by actual available actions; explain quality recipe versus saved costing snapshot, then name the real production handoff. |
| Estimator length and Quick→Detailed state change | [DOM-derived sequence](</Users/rajpatel/Projects/textile Saas/components/estimator/CostEstimateTutorial.tsx:186>) walks visible section fields, repeating warp/weft and adding modal substeps. [Preparation callback](</Users/rajpatel/Projects/textile Saas/app/(dashboard)/owner/estimator/EstimatorClient.tsx:3762>) selects Detailed. | Curate a learning sequence rather than one step per rendered field; retain only changed weft semantics and restore the prior mode after exit. |
| Assignments directs the user to Jobs/Machine jobs | [Prerequisite copy](</Users/rajpatel/Projects/textile Saas/lib/i18n/configuration-tutorial.ts:38>) embeds those stale labels; [Assignments route](</Users/rajpatel/Projects/textile Saas/app/(dashboard)/owner/assignments/page.tsx:15>) uses the Base production operations view. | Use the actual Overview & Looms → Activate Quality → Assign Looms controls and the return path. |
| Worker rate readiness conflicts with usable production wage | [Readiness computation](</Users/rajpatel/Projects/textile Saas/lib/worker-operational.ts:43>) tests worker.rate_per_meter, while [Worker card](</Users/rajpatel/Projects/textile Saas/components/workers/WorkerCard.tsx:102>) displays that generic result. [Tour copy](</Users/rajpatel/Projects/textile Saas/lib/i18n/workers-tutorial.ts:22>) acknowledges no editor rate field but gives no authoritative alternative. | Make readiness consistent with the Base wage model; explain the active-quality weaver wage and saved production rate, not an unrepairable worker-rate flag. |
| Payroll recovery sample disagrees with Base calculation | [Hard-coded example](</Users/rajpatel/Projects/textile Saas/lib/payroll-tour.ts:29>) sets gross 2000, debt 1000, recovery 500. [Base payroll](</Users/rajpatel/Projects/textile Saas/lib/base-production-core.ts:503>) calls the recovery function with a 50% cap; [Recovery calculation](</Users/rajpatel/Projects/textile Saas/lib/finance.ts:135>) takes min(debt, cap), which gives 1000 for this sample. | Use gross2000/debt1000/recovery1000/net1000/carry0, or change debt to illustrate a real cap and explain the same calculation. Keep this as product-rule diagnosis, not legal advice. |
| Saved Costings ending promises an absent demo | [Unconditional ending](</Users/rajpatel/Projects/textile Saas/lib/i18n/saved-costings-tutorial.ts:29>) promises a sample. [Actual condition](</Users/rajpatel/Projects/textile Saas/app/(dashboard)/owner/quotes/QuotesClient.tsx:949>) limits persistent display to an empty, non-dismissed workspace (or an active tour). | Condition the ending: point to an existing costing when populated; only promise the demo when it is visible. |
| Rate Book purpose/relationships get skipped in favour of controls | [Visible-target filtering](</Users/rajpatel/Projects/textile Saas/components/rates/RateBookTutorial.tsx:189>) removes steps without mounted targets; [Copy definitions](</Users/rajpatel/Projects/textile Saas/lib/i18n/rate-book-tutorial.ts:25>) alone do not prove that purpose/immutability guidance reaches the user. | Make the opening purpose and update-consequence explanation unconditional; explain matching from the actual linked-quality action. Do not credit unseen strings. |
| Dispatch desktop highlight misses its target | [Desktop root scale](</Users/rajpatel/Projects/textile Saas/app/globals.css:553>) applies zoom0.80 at1280px. [Measurement](</Users/rajpatel/Projects/textile Saas/components/tours/DispatchTutorial.tsx:109>) reads getBoundingClientRect then [Overlay](</Users/rajpatel/Projects/textile Saas/components/tours/DispatchTutorial.tsx:132>) writes those values into the scaled coordinate space. Rendered rate target x−21.10/y301.02 becomes highlight x−20.08/y237.61: a second scale is applied. | Use a consistent unscaled portal coordinate space or correctly convert both positions and dimensions; verify all zoom breakpoints. |
| Dispatch sample form is clipped left | [Preview override](</Users/rajpatel/Projects/textile Saas/app/globals.css:1498>) supplies a new left position and translate, but [Dialog utilities](</Users/rajpatel/Projects/textile Saas/components/ui/dialog.tsx:70>) also apply translate-x−50%. Rendered style retained translate−50%−50%, left208px, resulting in x−38.40 and width409.59. | Override translation decisively in the appropriate CSS layer or remove conflicting utilities for preview dialogs; verify visible bounds after animation settles. |

The desktop preview selectors are shared by Workers, Machines, Stock, Dispatch, Production, Payroll and Configuration. Their controllers repeat the same measurement/portal pattern. This makes the reproduced Dispatch defect a shared implementation risk; it does **not** establish that every target in every tour failed. Earlier small/clipped closing highlights are consistent with this mechanism but retain their original limited-evidence classification.

**Architecture, conditions and completion.** [The registry](</Users/rajpatel/Projects/textile Saas/lib/tours/tour-registry.ts:1>) declares eleven owner tour IDs. Estimator and Saved Costings allow Free/Lite/Base/Premium; Rate Book allows Lite/Base/Premium; factory tours allow Base/Premium. Routes and workspace conditions determine actual exposure. [Saved Costings sequence](</Users/rajpatel/Projects/textile Saas/lib/saved-costings-tour.ts:4>) varies by plan and production/quotation capabilities; [Payroll sequence](</Users/rajpatel/Projects/textile Saas/lib/payroll-tour.ts:1>) has Base and Full variants. Stock uses two explicit step arrays in [stock-tour.ts](</Users/rajpatel/Projects/textile Saas/lib/stock-tour.ts:1>). Estimator and Rate Book derive some steps from visible DOM, so an empty/populated state can affect coverage.

[Shared invitation UI](</Users/rajpatel/Projects/textile Saas/components/tours/TourInvitation.tsx:29>) and [visit-scoped invitation state](</Users/rajpatel/Projects/textile Saas/hooks/use-tour-invitation.ts:42>) separate the invitation from replay. Manual launch is intentional and receives no penalty. First impression, start, dismiss and completion use [user-scoped local fallback plus server events](</Users/rajpatel/Projects/textile Saas/lib/tours/tour-preferences.ts:1>). Most newer controllers mark completion only on Finish, close on Skip/Escape, block background interaction and restore focus/scroll. Estimator/Rate Book also retain legacy dismissal/retry paths. A quiet replay button indicates prior exposure, not necessarily completed learning. We verified Dispatch Finish, return and replay; no server persistence inspection was needed.

[Preview wrappers](</Users/rajpatel/Projects/textile Saas/components/dispatches/DispatchGuidedTour.tsx:9>) keep live pages mounted but hidden while separate display-only examples render. Stock, production and payroll follow similar isolation. This supports safe walkthroughs, but duplicated examples can drift from real rules—as payroll demonstrates. Source safety is not evidence that a user retained the workflow.

**Localization.** All ten `*-tutorial.ts` modules were inspected, including both Stock copy groups. A temporary read-only key comparison found no missing or empty Gujarati/Hindi leaf corresponding to English, and no wholly identical English string containing four-letter Latin words. Typed step maps and existing per-tour tests add key/target coverage. This is structural parity, not proof of translation quality or runtime coverage. Gujarati/Hindi Dispatch step1, progress and controls rendered in the selected language; Hindi at390×844 was readable with reachable controls. Language and viewport were restored. Saved Costings translations retain English action labels such as Use/Open, Print and Generate PDF; these should match the actual translated UI consistently. Payroll’s misleading numbers and some stale terminology are translated too, so mere key parity does not repair comprehension. No broad missing-translation defect was demonstrated; no full linguistic or all-steps mobile audit is claimed.

**Responsive implementation.** [Mobile selection](</Users/rajpatel/Projects/textile Saas/hooks/use-mobile-tour.ts:14>) uses width≤767px or short coarse-pointer screens and [measured mobile positioning](</Users/rajpatel/Projects/textile Saas/lib/mobile-tour-positioning.ts:1>) reserves a reading area. [Mobile panel styling](</Users/rajpatel/Projects/textile Saas/app/globals.css:1322>) separates scrolling descriptions from controls. The sampled Hindi mobile step worked; desktop zoom remains the verified defect.

**Validation.** Existing tests passed: **13 files /128 tests**, covering invitation i18n/lifecycle/preferences, no auto-start, Dispatch, Payroll, Configuration, Production, Stock, Workers, Machines, Saved Costings and mobile positioning. Tests exercise sequence/copy/targets/preferences and pure geometry, not the complete deployed scaled layout. No tests were added and no application code was changed. A passing suite does not countermand frozen UX findings.

## 5. Top Problems Across All Tours

| Rank | Severity | Pattern | Observed scope |
|---:|---|---|---|
| 1 | P1 | Taught actions or prerequisite labels diverge from the live Base workflow | Estimator; Machine Assignments |
| 2 | P1 | A core pay concept is missing or numerically misleading | Workers rate readiness; Payroll recovery example |
| 3 | P2 | Prerequisite or downstream relationship is named without an actionable path | Production, Workers, Machines, Rate Book |
| 4 | P2 | Controls precede purpose and first task | Estimator, Saved Costings, Rate Book, Machines, Workers |
| 5 | P2/P3 | Repeated explanations increase the length of otherwise useful tours | Estimator, Assignments, Machines, Workers, Payroll, stock tours |
| 6 | P2 | Closing guidance assumes unavailable context or omits the next decision | Saved Costings demo; estimator save choices; Rate Book ending |
| 3a | P1 | Desktop scale and preview positioning detach guidance from controls | Reproduced in Dispatch; shared implementation affects other preview tours and requires verification |
| 7 | P3 | Closing highlights provide little visual context | Sampled Machines, Assignments and Payroll endings |

No P0 is assigned. Specific misleading steps are serious, but the completed tours are not wholly broken and generally teach substantial correct behavior.

## 6. Recommended Tour Design Principles

1. **Start with the factory decision.** Estimator should open with calculate → review → save; registers should explain how their records become usable in production or payroll before search controls.
2. **Use the exact Base labels on the next screen.** Teach Activate Quality and Assign Looms where those are the real controls; avoid generic Jobs instructions that cannot be followed.
3. **Name the record and what it preserves.** Distinguish a reusable quality, costing snapshot, active production quality, saved shift and paid record at the moment the user creates or selects one.
4. **Teach the authoritative rate.** Connect the quality’s weaver wage, machine output and saved earnings; do not leave a worker-level readiness badge unexplained.
5. **Use small, correct numbers.** Retain the strong fabric-stock delta and production-wage examples. Make the payroll recovery example obey the real rule.
6. **Show setup failures with a route out.** An unconfigured machine or incompatible yarn costing needs the exact next screen and minimum repair, not just a warning.
7. **Explain unusual stock semantics before data entry.** Keep yarn-in-undispatched-fabric and opening-versus-correction distinctions prominent; add one practical count example.
8. **Teach once, then reuse the concept.** Combine shared warp/weft rules, filter controls and repeated Current/Undo explanations; preserve only section-specific differences.
9. **End at a real first action.** Restore the user’s state and point to a visible, available action. Promise a demo only when an identifiable demo is actually present.
10. **Separate the basic loop from maintenance.** Corrections, audit exports and advanced comparison can be replayable follow-ups where that shortens first-use learning without hiding material consequences.

## 7. Recommended Remediation Plan

**These are recommendations only. No changes have been implemented. Prioritization incorporates the completed Base UI pass and subsequent source diagnosis.**

### Phase A — Critical comprehension fixes

- Replace estimator action copy with the actual Base save/version and production handoff workflow.
- Correct Machine Assignments’ production prerequisite directions.
- Resolve Workers’ piece-rate readiness explanation and authoritative wage source.
- Correct Payroll’s recovery example and explain zero-earning obligation resolution.
- Fix the reproduced shared desktop coordinate/preview translation defect before polishing tooltip placement.

### Phase B — Product/value communication

- Add the missing production-to-stock/payroll handoffs and register-to-production setup route.
- Explain Rate Book matching, dates and future-versus-historical consequences explicitly.
- Add practical opening-count examples for legacy dispatch commitments and yarn embodied in fabric.

### Phase C — Tour optimization

- Reorder search-first tours around purpose and the first meaningful task.
- Merge repeated yarn fields, machine readiness, picker states, overhead and payment-detail steps.
- Replace conditional catch-all language and internal terminology with entitlement-specific guidance.
- Make endings correspond to a real visible action and actual sample availability.

### Phase D — Polish

- Recheck clipped/weak closing targets at desktop and mobile sizes.
- Verify initial UI state restoration, completion persistence and replay.
- Diagnose the Rate Book post-tour interaction separately from browser-tool failures.
- Audit English/Gujarati/Hindi key parity, dynamic sample text and long translated tooltip layouts after the UI pass.

## 8. Final New-User Comprehension Test

**These answers preserve the user mental model frozen after all eleven UI tours, before source diagnosis.**

**After completing these tours, what would I believe Weavly does?** It helps me calculate fabric cost, retain historical estimates, prepare qualities and looms for production, record shift output, calculate worker obligations track fabric and yarn balances, prepare delivery challans, record customer acknowledgement and track settlement.

**What would I believe are its most important capabilities?** Reusable costing recipes and versions, transparent per-metre economics, machine/worker production entry, dated salary and production pay, settlement records, and traceable stock movements.

**How would I believe the major sections connect?** Yarn rates inform future costing inputs; saved costing versions can become active production qualities; looms and workers must be configured and connected by shift; saved output creates earnings and fabric stock. Payroll records the payment of obligations. Yarn Stock uses a separate linked costing formula and deducts on confirmed dispatch, including yarn previously embodied in fabric.

**Which sections would I feel confident using immediately?** Reviewing saved costings and export previews; basic machine registration; adding workers when the pay type is known; production entry on already configured looms; inspecting fabric stock and preparing an opening entry.

**Which sections would I still hesitate to use?** Estimator save/version choices, piece-rate rate readiness, initial machine/job setup using the stale directions, payroll recovery and final completion, and a yarn physical correction that includes embodied yarn. I can prepare a Dispatch draft independently; I would still consult guidance for reversals, disputed differences and refunds.

**What important value would I still fail to understand?** The authoritative relationship among the several rate/readiness labels, the initial setup order, and how to choose between a reusable recipe update and a historical costing save. Dispatch teaches selling rate, quantity, receipt and money clearly, but does not reconcile the estimator’s unavailable order actions. I can see many valuable parts, but would still seek help at those boundaries.

