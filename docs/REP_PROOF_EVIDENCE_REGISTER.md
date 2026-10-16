# RepProof — Evidence Register & Research Traceability (Phase 2 + Critical Addendum)

Source audited: "Science-Based Lifting Community – Beliefs, Trends & Debates (1)" (owner-supplied, ~26.5k chars, 9 sections). Audit date: 2026-10-09.

## 1. Source-quality findings (read first)

1. **Citations cannot be resolved.** Every citation is an opaque marker such as `【59†L53-L61】` with no title, URL or DOI, and the file's source list is empty. No claim in the report can be traced to a paper from the report alone. Where RepProof already makes a matching claim, the app's **own** PubMed/DOI-checked reference (`src/engine/references.ts`) is named instead and labelled *"app reference, not from the report"*.
2. **The report self-labels much of its content** as "[Your inference]", "No source given" or "community knowledge". Those items are treated as OPINION/ANECDOTE.
3. **Suspect creator attributions — do not reuse in-app or in store copy without checking:**
   - "Stefi Cohen (Squat University)": Squat University is generally associated with Dr. Aaron Horschig, not Stefi Cohen.
   - "Jacob Oestreicher … Founder of 3DMJ": not confirmed.
   - "Layne Norton … Left 3DMJ in 2024": not confirmed; we found nothing that places him at 3DMJ.
   - "SFR … from coach Charles Staley": the term is usually associated with Renaissance Periodization; not confirmed.
   - "Jordan Feigenbaum … Strongman and MD": "strongman" not confirmed.
   - "James Krieger … Stresses low-fat diets for cutting": not confirmed and inconsistent with his public work as we know it.
   - "Menno Henselmans … PhD in philosophy": not confirmed.
   - "calorie staggering ('reverse dieting')": these are different concepts; the report conflates them.
   - "Ethier et al. (BuiltWithScience) $40K MRI study": no study reference given; the app's stretch topic relies on Kassiano 2023 and Wolf 2026 instead.

   None of these were verified against outside sources in this audit; each is "RESEARCH OR VALIDATION REQUIRED" if anyone wants to use it.
4. **RepProof currently names no creators as authorities** (grep of `src/` for these names finds only study authors in `references.ts`). That stays the recommendation.

## 2. Evidence type definitions

- **DIRECT EVIDENCE**: a peer-reviewed trial or meta-analysis supports the claim (named via the app's verified references).
- **PRINCIPLE-BASED**: follows from established physiology or training principles, but no single study tests the exact claim.
- **REPPROOF RULE**: a product decision RepProof makes (founder rule or design choice) and labels as such.
- **OPINION / ANECDOTE**: community sentiment, creator opinion or review quotes. Not used to drive app behaviour.
- **UNVERIFIABLE**: the report gives no resolvable source and the claim has not been checked.

## 3. Claim-to-feature register (claims RepProof acts on)

| Claim | Type | App reference (not from report) | Where in app |
|---|---|---|---|
| Weekly hard sets drive hypertrophy (dose-response, diminishing returns) | DIRECT | Schoenfeld, Ogborn & Krieger 2017 | `insights.ts` productive range; "Weekly volume" topic |
| Productive ranges 6–12 / 8–16 / 10–20 sets by experience | REPPROOF RULE | — | `insights.ts:12` |
| Wide rep ranges build muscle near failure | DIRECT | Schoenfeld et al. 2017 (low vs high load) | `plan.ts` `repRange`; "Load and rep ranges" |
| Failure not required; small benefit in trained lifters | DIRECT | Grgic et al. 2022 | `effortTargets`; "Training to failure" |
| RIR estimates are imperfect, better near failure | DIRECT | Halperin 2022; Refalo 2024 | "Reps in reserve" topic |
| RIR-based autoregulation works | DIRECT | Graham & Cleather 2021 | `progression.ts` `suggest` |
| Progress by reps or load | DIRECT | Plotkin 2022 | `progression.ts` |
| Frequency doesn't matter when volume is equal | DIRECT | Schoenfeld 2019; Saric 2019; Lasevicius 2019 | `recommendSplit` |
| Longer rests are fine or better | DIRECT | Singer 2024; Schoenfeld 2016; Grgic 2017 | RestPanel defaults; "Rest" topic |
| Deloads: no fixed schedule | DIRECT (limited) | Coleman 2024 | deload offer |
| Subjective check-ins track training response | DIRECT | Saw 2016; Greig 2020 | readiness check-in |
| Lengthened partials ≈ full ROM | DIRECT | Wolf 2025; Gschneidner 2025; Kassiano 2023 | "Range of motion" topic |
| Stretch-biased superiority not established | DIRECT (mixed) | Wolf 2026; Kassiano 2023 | same topic |
| Protein ~1.6 g/kg plateau | DIRECT | Morton 2018 | `nutrition.ts` protein target |
| Best surplus size unknown | DIRECT | Slater 2019 | "Surplus and deficit" |
| Creatine and caffeine have strong evidence | DIRECT | Delpino 2022; Grgic 2020 | "Supplements" |
| SFR is a framework, not a measured quantity | REPPROOF RULE | — | "Stimulus-to-fatigue ratio" |
| Recomp at maintenance | REPPROOF RULE | — | `nutrition.ts:50` |
| 1–3 working sets + warm-up per exercise | REPPROOF RULE | — | `plan.ts` `MAX_SETS = 3` |

## 4. Coverage checklist (every section of the report)

| § | Section | Items | Mapped | Note |
|---|---|---|---|---|
| 1 | Influential creators | 13 | 13 | profiles are not product inputs; suspect attributions flagged |
| 2a | Consensus | 5 | 5 | |
| 2b | Debates | 8 | 8 | |
| 3 | Historical timeline | 4 | 4 | |
| 4 | Current trends | 5 | 5 | |
| 5 | Jargon glossary | 7 | 7 | |
| 6 | Pain points | 6 | 6 | |
| 7 | Popular apps | 5 | 5 | |
| 8 | App opportunity ideas | 10 | 10 | |
| 9 | Coverage gaps | 4 | 4 | |
| | **Total** | **67** | **67** | |

**Counting method.** One item = one bullet, numbered idea or named glossary term in the report. Creator bullets count once each, even when they contain several claims; the claims are covered by the consensus and debate items. Section intros, the source footers and the closing source line are not items. Under this method, **coverage (items with a recorded disposition) = 67/67 = 100%**. Coverage means *every item was reviewed and given a disposition*, **not** that the app implements the report. Implementation coverage is in §6.

## 5. Traceability matrix

Classification codes (exact meanings from the brief):
- **IMPL**: ALREADY IMPLEMENTED AND VERIFIED.
- **IMPROVE**: ALREADY PRESENT BUT NEEDS IMPROVEMENT.
- **PROPOSED**: PROPOSED FEATURE — AWAITING MY APPROVAL.
- **EDU**: EDUCATIONAL CONTENT OPPORTUNITY.
- **RESEARCH**: RESEARCH OR VALIDATION REQUIRED.
- **NOT-REL**: NOT RELEVANT — WITH REASON.
- **DEFER**: DEFERRED — WITH REASON.

Other columns:
- **Cit.** is the report's citation marker; "—" means none, "self" means the report labels the item as inference or unsourced.
- **Conf.** is confidence that the claim is true (H/M/L).
- **Rel.** is relevance to RepProof (H/M/L).
- Backlog IDs refer to `REP_PROOF_FEATURE_BACKLOG.md`.

| ID | § | Claim (short) | Cit. | Evidence type | Conf. | Rel. | Existing feature | Proposed improvement | Class | Approval? | Exclusion reason |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CR-01 | 1 | Keenan Malloy: 1–3 RIR, tracked.gg app | self | OPINION | L | L | — | — | NOT-REL | No | Creator profile; report labels it inference |
| CR-02 | 1 | T-Nutrition Fitness: medium-high volume | 【56】 | UNVERIFIABLE | L | L | — | — | NOT-REL | No | Report says identity unverifiable |
| CR-03 | 1 | Oestreicher: 3DMJ founder, "calorie staggering = reverse dieting", 6–18 sets | 【54】【59】 | UNVERIFIABLE | L | L | — | — | RESEARCH | No | Founder claim unconfirmed; concepts conflated |
| CR-04 | 1 | YoTalks: green-screen quick tips | self | OPINION | L | L | — | — | NOT-REL | No | Content-format observation, not a claim |
| CR-05 | 1 | Israetel: 20–30 sets, 5–30 reps, pump/soreness proxies | 【54】【59】【99】 | OPINION | M | M | "Pump and soreness" topic treats them as weak proxies | — | NOT-REL | No | Claims covered by C-01, C-02, D-05 |
| CR-06 | 1 | Nuckols: 10–20 sets, RPE/RIR | self | OPINION | M | L | — | — | NOT-REL | No | Report: "detailed sources not found" |
| CR-07 | 1 | Helms: 9–18 sets, 0–3 RIR, Pyramid | — | OPINION | M | L | — | — | NOT-REL | No | Covered by C-01, C-04 |
| CR-08 | 1 | Henselmans: 5–15 / 15–25+ sets, "PhD in philosophy" | — | UNVERIFIABLE | L | L | — | — | RESEARCH | No | Credential unconfirmed |
| CR-09 | 1 | Krieger: low-fat for cutting | — | UNVERIFIABLE | L | L | — | — | RESEARCH | No | Attribution suspect |
| CR-10 | 1 | Schoenfeld: 2017 10+ sets meta | 【59】 | DIRECT | H | H | Cited (Schoenfeld 2017) | — | IMPL | No | — |
| CR-11 | 1 | Feigenbaum: "strongman", low-rep barbell | — | UNVERIFIABLE | L | L | — | — | RESEARCH | No | Attribution suspect |
| CR-12 | 1 | Norton: reverse dieting, "left 3DMJ 2024" | — | UNVERIFIABLE | L | L | — | — | RESEARCH | No | Affiliation claim suspect |
| CR-13 | 1 | Stefi Cohen as "Squat University" | — | UNVERIFIABLE | L | L | — | — | RESEARCH | No | Likely misattribution |
| C-01 | 2a | Weekly hard sets are the main hypertrophy driver; ~10–20 sets | 【59】【54】 | DIRECT | H | H | Productive range + volume screen + topic | — | IMPL | No | — |
| C-02 | 2a | 6–30 reps build muscle near failure | 【59】【54】 | DIRECT | H | H | `repRange`, topic | — | IMPL | No | — |
| C-03 | 2a | Progressive overload is paramount | — | DIRECT | H | H | `suggest` | — | IMPL | No | — |
| C-04 | 2a | 1–3 RIR usually enough | 【59】 | DIRECT | H | H | Effort styles | — | IMPL | No | — |
| C-05 | 2a | Protein 1.6–2.2 g/kg, surplus to gain, creatine | — | DIRECT | H | H | Protein 1.6 g/kg; phases; Supplements topic | Optional range display (1.6–2.2) | IMPROVE | Yes (backlog H-03) | — |
| D-01 | 2b | "Junk volume": diminishing returns past a ceiling | 【59】【70】 | PRINCIPLE | M | H | Volume "consider holding steady" above range | Short "junk volume" explainer | EDU | Yes (backlog I-02) | — |
| D-02 | 2b | Failure vs 1–3 RIR | 【59】 | DIRECT | H | H | Effort styles + topic | — | IMPL | No | — |
| D-03 | 2b | Stretch-mediated hypertrophy not proven superior | 【67】 | DIRECT (mixed) | M | M | ROM topic | — | IMPL | No | — |
| D-04 | 2b | Lengthened partials ≈ full ROM | 【45】 | DIRECT | M | M | ROM topic (Wolf 2025, Gschneidner 2025) | — | IMPL | No | — |
| D-05 | 2b | MRV caps vary; base volume on progress | 【59】 | PRINCIPLE | M | H | Topic + stall-aware `volumeStatus` | — | IMPL | No | — |
| D-06 | 2b | RIR accuracy is debated; calibration methods | — | DIRECT (Halperin, Refalo) | M | H | RIR topic; beginners exempt from RIR step-ups | Calibration aid | PROPOSED | Yes (backlog E-02) | — |
| D-07 | 2b | Lean bulk ~500 kcal; moderate deficits | 【59】 | PRINCIPLE | M | H | Gain ~+10%, cut ~−20%, Surplus topic | Rate-of-change check vs weight trend | IMPROVE | Yes (backlog H-02) | — |
| D-08 | 2b | Creatine endorsed; most supplements weak | — | DIRECT | H | M | Supplements topic | Creatine dosing note (loading optional) | EDU | Yes (backlog I-02) | — |
| T-01 | 3 | 2015–17 bro-science to evidence era | 【59】 | OPINION | M | L | — | — | NOT-REL | No | Historical narrative |
| T-02 | 3 | 2018–20 high volume, RIR adoption | 【59】 | OPINION | M | L | — | — | NOT-REL | No | Historical narrative |
| T-03 | 3 | 2021–23 nuance, social media boom | 【59】 | OPINION | L | L | — | — | NOT-REL | No | Contains unsourced claims ("Volume Manifesto") |
| T-04 | 3 | 2024–26 creator-funded studies, simplicity | 【67】【45】 | OPINION | M | M | "New and viral studies" topic | — | IMPL | No | — |
| TR-01 | 4 | Short-form, green-screen content | self | OPINION | M | M | Science-of-the-day card on Home | — | IMPL | No | — |
| TR-02 | 4 | PPL / upper-lower trending | self | OPINION | M | H | `SPLIT_NAMES` includes both | — | IMPL | No | — |
| TR-03 | 4 | Mind-muscle, TUT, peak contraction, SFR buzz | self | OPINION | L | M | SFR topic only | MMC + TUT explainers | EDU | Yes (backlog I-02) | — |
| TR-04 | 4 | AI coaching, VBT wearables early hype | self | OPINION | L | L | — | — | DEFER | — | Cost, accuracy and health-claim risk; backlog K-02, L-03 |
| TR-05 | 4 | Flexible dieting; gut health, micronutrient timing | self | OPINION | L | M | Macro tracking | — | NOT-REL | No | Gut/micronutrient timing outside scope and weakly supported |
| G-01 | 5 | RIR definition | 【59】 | DIRECT | H | H | RIR topic + in-workout RIR buttons | — | IMPL | No | — |
| G-02 | 5 | RPE 1–10 ≈ 10 − RIR | — | PRINCIPLE | M | M | None | RPE shown alongside RIR in glossary | EDU | Yes (backlog I-01) | — |
| G-03 | 5 | MEV/MAV/MRV | self | REPPROOF RULE (model) | M | H | Weekly volume topic (`science.ts:47,89`) | Glossary entry | IMPROVE | Yes (backlog I-01) | — |
| G-04 | 5 | SFR (attributed to Staley) | — | UNVERIFIABLE attribution | L | M | SFR topic (no attribution) | — | IMPL | No | Attribution intentionally not reused |
| G-05 | 5 | Autoregulation | — | DIRECT | H | H | Check-in, `adjustForDay`, deload offer | — | IMPL | No | — |
| G-06 | 5 | Recomp | — | REPPROOF RULE | M | H | Recomp phase (migration 5) | — | IMPL | No | — |
| G-07 | 5 | #Greenscreen | — | OPINION | — | L | — | — | NOT-REL | No | Social media jargon, not product-relevant |
| P-01 | 6 | Apps log but don't build programs | 【99】 | OPINION (review) | M | H | `buildProgram` | — | IMPL | No | — |
| P-02 | 6 | Want auto volume count, rest timer, RIR input | 【99】 | OPINION (review) | M | H | All three exist | Background rest-timer notification | IMPROVE | Yes (backlog B-05) | — |
| P-03 | 6 | Unsure when to add volume vs deload | self | OPINION | M | H | Volume status + deload offer + program advice | — | IMPL | No | — |
| P-04 | 6 | Want form feedback / video | self | OPINION | M | H | Text cues; video placeholder | Remove placeholder now; video library later | IMPROVE | Yes (backlog G-01, G-02) | — |
| P-05 | 6 | Nutrition and training in two apps | self | OPINION | M | H | Fuel tab in same app | — | IMPL | No | — |
| P-06 | 6 | Want community / Q&A | self | OPINION | L | M | Learn library, feedback form | — | DEFER | — | UGC moderation and Play UGC policy duties; backlog K-01 |
| A-01 | 7 | RP app: no program builder, no timer, web-only, pump/soreness controversy | 【99】 | OPINION (review) | M | M | Builder, timer, native app | — | NOT-REL | No | Competitor note; differentiators already covered |
| A-02 | 7 | Hevy/Strong: bugs resetting sets, no RPE/RIR | self | OPINION | L | M | Crash-safe draft, RIR logging | — | IMPL | No | — |
| A-03 | 7 | MFP: inaccurate user foods | 【91】 | OPINION | M | M | Source badges, curated common foods | — | IMPL | No | — |
| A-04 | 7 | Fitbod: odd exercise picks | self | OPINION | L | M | Swaps keep pattern + muscle | — | IMPL | No | — |
| A-05 | 7 | VBT hardware costly | self | OPINION | M | L | — | — | NOT-REL | No | Hardware out of scope |
| O-01 | 8 | Volume tracker + alerts vs targets | 【59】 | DIRECT basis | H | H | Volume screen + status labels | — | IMPL | No | — |
| O-02 | 8 | RIR-based progression | 【59】 | DIRECT | H | H | `suggest` spare/overshoot logic | — | IMPL | No | — |
| O-03 | 8 | Smart program builder | 【99】 | PRINCIPLE | M | H | `buildProgram`, splits, weak/strong muscles | — | IMPL | No | — |
| O-04 | 8 | Form library + AI form analysis | self | OPINION | L | M | Cues only | backlog G-02 (library), G-03 (AI) | DEFER | Yes | AI form analysis: accuracy unvalidated, video privacy, health-claim risk |
| O-05 | 8 | Recovery/fatigue manager (soreness, sleep, mood) | 【59】 | DIRECT (Saw 2016, Greig 2020) | M | H | Global check-in | Per-muscle soreness | RESEARCH | Yes (backlog F-02) | Per-muscle soreness → volume change lacks direct evidence |
| O-06 | 8 | Nutrition-training integration | self | PRINCIPLE | M | M | Same app; protein from bodyweight | Training-day protein nudge | PROPOSED | Yes (backlog H-04) | — |
| O-07 | 8 | Bar velocity from phone mic | self | UNVERIFIABLE | L | L | — | — | DEFER | — | Phone-mic velocity accuracy unvalidated (backlog L-03) |
| O-08 | 8 | Community / AI Q&A bot | self | OPINION | L | M | — | — | DEFER | — | Moderation, hallucination and health-advice risk (backlog K-01, K-02) |
| O-09 | 8 | Analytics dashboard, moving averages | self | PRINCIPLE | M | M | Progress charts, PRs | Weekly-sets and avg-RIR trends | PROPOSED | Yes (backlog J-02) | — |
| O-10 | 8 | AR form-check overlay | self | OPINION | L | L | — | — | DEFER | — | Tech constraints, accuracy; report ranks it lowest |
| CG-01 | 9 | Private Discord/paid groups not covered | — | — | — | L | — | — | NOT-REL | No | Limitation of the report, not a claim |
| CG-02 | 9 | TikTok without transcripts not covered | — | — | — | L | — | — | NOT-REL | No | Limitation |
| CG-03 | 9 | Regional communities not covered | — | — | — | L | — | — | NOT-REL | No | Limitation |
| CG-04 | 9 | Paywalled material not covered | — | — | — | L | — | — | NOT-REL | No | Limitation |

## 6. Disposition totals (67 items, counted by script from the matrix)

| Class | Count | IDs |
|---|---|---|
| IMPL | 25 | A-02 A-03 A-04 C-01 C-02 C-03 C-04 CR-10 D-02 D-03 D-04 D-05 G-01 G-04 G-05 G-06 O-01 O-02 O-03 P-01 P-03 P-05 T-04 TR-01 TR-02 |
| IMPROVE | 5 | C-05 D-07 G-03 P-02 P-04 |
| PROPOSED | 3 | D-06 O-06 O-09 |
| EDU | 4 | D-01 D-08 G-02 TR-03 |
| RESEARCH | 7 | CR-03 CR-08 CR-09 CR-11 CR-12 CR-13 O-05 (plus the report-wide unresolvable citations, §1) |
| NOT-REL | 17 | A-01 A-05 CG-01–04 CR-01 CR-02 CR-04–07 G-07 T-01–03 TR-05 |
| DEFER | 6 | O-04 O-07 O-08 O-10 P-06 TR-04 |
| **Total** | **67** | |

**Implementation coverage of actionable items.** Actionable = all items minus NOT-REL and RESEARCH, so 67 − 17 − 7 = **43**.
- Implemented and verified (IMPL): **25/43 = 58%**.
- Present but needs improvement: 5/43 = 12%.
- Awaiting owner decision (PROPOSED, EDU, DEFER): 13/43 = 30%.

RepProof does **not** incorporate the entire report and should not be described that way.

## 7. Changes from the 2026-10-09 sprint

Only changes that exist in code and passed a test or inspection are listed.

| Item | Claim | Source | Implementation | Evidence | Limitation | Old class | New class |
|---|---|---|---|---|---|---|---|
| G-02 | RPE ≈ 10 − RIR | Zourdos et al. 2016, JSCR 30(1):267-275, PMID 26049792, DOI 10.1519/JSC.0000000000001049 (checked on PubMed 2026-10-09) | `src/engine/effort.ts` (RPE input converted to RIR, half steps rounded toward failure); "RPE and effort scales" topic; glossary; Account › Effort scale; migration 6 `logged_sets.rpe` | `features.test.ts` (conversion, parsing); DB tests (RPE saves, half-step and range checks; mutation caught) | Same estimate as RIR, so no added accuracy; the RPE range is not device-verified | EDU | IMPL |
| G-03 | MEV/MAV/MRV are models, not biology | RepProof rule | Glossary entry labelled "RepProof rule", linked to the "Weekly volume" topic | `features.test.ts` (every glossary topic exists; no creator names) | Wording only | IMPROVE | IMPL |
| D-01 | "Junk volume" is debated | Principle | Glossary entry with principle label; still listed in Debates | Same test | No per-person estimate | EDU | IMPL |
| P-02 | Rest-timer alert when backgrounded | Pain point (opinion) | `src/lib/notify.ts`: opt-in local notification at rest end; web falls back to the on-screen timer | tsc and lint; release build compiled with expo-notifications | **Not verified on a device**, so the class stays IMPROVE until a phone test | IMPROVE | IMPROVE |
| O-09 | Consistency/trend dashboard | Principle | Progress › 8-week consistency card (`adherence()` in `src/lib/stats.ts`); a saved workout opens from history | `features.test.ts` (adherence weeks, current-week rule, cap at 100%) | No moving-average RIR trend | PROPOSED | IMPROVE |
| P-04 | No misleading exercise media | Pain point | "Movement video coming soon" placeholder removed; written steps marked as such; safety note added | Code inspection (`grep` finds no "coming soon") | No video content yet | IMPROVE | IMPROVE |

**Built, then deferred the same day (not in the app):** the community (P-06, O-08 partial), the camera technique check (O-04) and bar-speed estimates (O-07). The code and tests are kept in `docs/deferred/`. Two PubMed-verified references that only supported the bar-speed tool, Balsalobre-Fernández 2017 and 2023, were removed from `references.ts` with it. `monitoring_review` (Helms et al. 2020, PMID 33312273) stays, cited by the RPE explanation.

**Updated totals (67 items):** IMPL 28 · IMPROVE 5 · PROPOSED 2 · EDU 2 · RESEARCH 7 · NOT-REL 17 · DEFER 6.

**Implementation coverage of actionable items:** 28/43 = **65%** (was 58%).
