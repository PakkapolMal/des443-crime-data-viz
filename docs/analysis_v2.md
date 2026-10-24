# Dashboard review v2: page-by-page feedback

Branch `pkp-redesign`. Baseline commit `aaab31f` (the DESIGN.md polish pass). The source is the owner's walkthrough of every screen on 2026-10-24.
No code has changed for this review yet. Each item gives the screen, what it does now, the feedback restated as a requirement, and the proposed change. A status tag sits on each item:

- **Ready**: clear enough to build.
- **Decide**: an open decision for the owner (options are listed at the end).
- **Clarify**: the feedback needs one more answer before work starts.
- **Deferred**: the owner parked it.
- **Approved**: keep as is.

## Screen map

| # | Chapter / screen | Module | Status |
|---|---|---|---|
| 0 | Home / title | `index.html` | Deferred |
| 1 | Home / KPI | `home.js` `kpi` | Done (build 1) |
| 2 | When / monthly | `trends.js` `monthly` | Done (build 1) |
| 3 | When / weekly + flags | `trends.js` `weekly` | Done (build 1) |
| 4 | Where / density map | `places.js` `map` | Approved |
| 5 | Where / division bars + heatmap | `places.js` `areas` | Done (build 1) |
| 6 | Where / top locations table | `places.js` `locations` | Done (build 1) |
| 7 | Area profiles / scatter | `compare.js` `scatter` | Done (build 1, via the tooltip fix) |
| 8 | What / offense treemap | `offenses.js` `hierarchy` | Done (P1: red = violent crime) |
| 9 | What / co-occurrence matrix | `offenses.js` `cooccurrence` | Done (build 1) |
| 10 | How dangerous / weapon classes | `weapons.js` `weapons` | Done (build 1) |
| 11 | Who / age-sex pyramid | `victims.js` `pyramid` | Done (P1: --sex-m / --sex-f) |
| 12 | Who / victim descent | `victims.js` `descent` | Approved |
| 13 | What happens next / funnel | `outcomes.js` `funnel` | Done (build 1: Sankey) |
| 14 | What happens next / reporting lag | `outcomes.js` `lag` | Done (build 1) |
| 15 | About | `about.js` `about` | Deferred |

## Round 2 decisions (2026-10-24)

| Item | Decision | Detail |
|---|---|---|
| 1 KPI | Tell the story in sentences. Layout: KPIs stacked vertically in a left column; right side is the monthly plot only, with larger axis labels. | Copy in *Round 2 detail* below. |
| 2 Monthly | First load shows **Larceny/Theft vs Weapon Law**. | The other 15 stay as toggles. |
| 3 Day-of-week | Replace the small multiples with **one grouped day-of-week bar chart** of **raw counts**. 17 category checkboxes sit in the chart's top-right, and up to **3** can be ticked at once. Each day shows one bar per ticked category. First load ticks **Larceny/Theft and Simple Assault/Intimidation**. With 3 ticked, the other boxes lock (disabled) until one is unticked. | On a shared count axis, a small category next to a large one looks nearly flat. That's accepted; exact counts go in the tooltip. Colours: bone, bone-60 and bone-35 until P1 lands. Bone-35 is fine as a fill but never for text, so the bars carry direct labels or a legend in bone. |
| 8 Treemap colours | **Pending.** The owner is considering adding colours to the palette. | Blocks on the palette decision (P1). |
| 11 Pyramid | **Pending**, same reason. | Blocks on P1. |
| 13 Outcomes | **Sankey diagram.** | Flow and data check in *Round 2 detail*. |
| New | Category wording: "Weapon Law" can mislead, and "Group B" means nothing to a lay audience. | Logged in `TASK.md`; see *Round 2 detail*. |

### P1: palette expansion (applied 2026-10-24)
- **Tokens:** `--series-1..3` and `--sex-f/m` are in `tokens.css`, and the rules are in DESIGN.md → *Categorical hues*.
- **Treemap:** the top level is two blocks, "Violent crime" (red, `VIOLENT_CATEGORIES` in `util.js`) and "Other crime" (neutral). Each block's header carries its share ("VIOLENT · 13.0%", "OTHER CRIME · 87.0% OF OFFENSES"), so there is no legend row.
- **Pyramid:** male bars are `--sex-m` and female bars `--sex-f`, with labels and totals in the matching hue.
- **Known gaps:**
  - The treemap's 13.0% counts *offenses*. The KPI's 14.1% counts *incidents*. The four categories give 14.13% at the incident grain, so the definitions agree and the gap is the counting unit. Decided: keep 14.1%, and name the unit on both screens (KPI: "of reports"; treemap caption: "shares here are of offenses, not reports").
  - Text on the new hues is `--bg` (decision 1A), because bone and white both fail contrast.

Original framing:
- **Blocks:**
  - Item 3 needs 3 series colours.
  - Item 8 needs a colour meaning.
  - Item 11 needs male/female colours.
- **Decide it once:** all three use the same new tokens, so one decision covers them.
- **It is a DESIGN.md change, not a page tweak:**
  - "No other hues" becomes a short categorical set with named tokens in `tokens.css`.
  - Each colour needs a contrast check on `--bg` and a projector rehearsal.
  - The red-as-signal rule stays. A categorical colour must not be red, or it competes with the highlight.
- **Until P1 lands:** item 3 can ship with bone, bone-60 and bone-35, with direct labels or a legend in bone, and swap to the new tokens later.

## Build 1 (2026-10-24): what was built, and where it differs from the plan
- **Tooltip bug:** fixed once at the shared element. `#tooltip` loses its `hidden` attribute, and CSS starts it at `opacity: 0`, which the charts already toggle. `util.tooltip` uses opacity too.
- **1 KPI:** five stacked number + sentence items on the left (only the first number is red), with the monthly line on the right. Axis labels are at `--fs-small`, and the plot is drawn at its measured size, so text is no longer stretched. The hard-coded fallback numbers and the fake fallback trend were removed; a missing value shows "–".
- **2 Monthly:** first load shows Larceny/Theft vs Weapon Law, with direct labels at the line ends. **Differs from the plan:** the cap is **3** lines, not 6–8, using `--series-1..3`. DESIGN.md (P1) allows series hues for at most 3 viewer-picked series, and this matches the weekly chart. A category keeps its colour until it is switched off.
- **3 Weekly:** grouped raw-count bars with 17 checkboxes (the list doubles as the legend). Larceny/Theft + Simple Assault/Intimidation are ticked on first load, and the boxes lock at 3. Flag-trend ticks are quarterly or half-yearly (whichever fits), in the form `Apr '24`, with no collisions at 1280 or 1920.
- **5 Areas:** bars are half the row height. An 8-step ramp key under the heatmap reads "Low … High (N% of the division's incidents)".
- **6 Locations:** 1px hairlines under the header and between rows (shared `.data-table` CSS).
- **9 Co-occurrence:** pairs are mirrored and the diagonal is `--bg`. The tooltip text is no longer red.
- **10 Weapons:** all bars start bone; red on hover only.
- **13 Sankey:** `d3-sankey@0.12.3` (jsDelivr). Three columns, using the flow in *Round 2 detail*. The red story path is Reported → Cleared by arrest → Filed. Labels give the count and % of reported, and the tooltip on each link adds % of its source. The old rejection banner, and its wrong denominator, are gone.
- **14 Lag:** the three cards are removed, and the chart takes the full width. Whiskers now run to p90 (as in TASK.md), and the axis runs to the longest p90 (178 days) with gridlines. The tooltip shows median, Q1–Q3, p90, mean and incident count. A one-line key explains box, line and whisker. The label column fits the longest name, so "Simple Assault/Intimidation" no longer overflows at 1920.
- **Checks:** at 1280×720 and 1920×1080, no inner scroll, no text outside the content box, min font 11px / 16px, no console errors.

## Round 2 detail

### Item 1: KPI sentences (draft copy)
Each KPI becomes a large number followed by a sentence that reads on from it. Values come from `kpi.json`.
| Number | Sentence |
|---|---|
| **435,318** | incidents were reported to LAPD between Apr 2024 and Sep 2026. |
| **14.1%** | of them were violent: homicide, rape, robbery or aggravated assault. |
| **15.8%** | of cases at least 180 days old were cleared by an arrest. |
| **4.0%** | involved a firearm. |
| **9.3%** | were flagged as domestic violence. |
- **Layout:**
  - A left column of the five, stacked, with hairlines between them. Only the first number is red (TASK.md rule).
  - The monthly plot fills the right, with axis labels at `--fs-small` or larger.
- **Optional plain-number variant:** "1 in 7 incidents were violent", "about 1 in 6 old cases ended in an arrest". Easier to grasp aloud, but less exact. The owner picks.

### Item 13: Sankey flow (checked against `CONTEXT_NIBRS.md` `PROSECUTION_STAGE`)
"Filed" comes only from *Cleared by Arrest* (DA/CA filed, CA hearing). "Rejected" comes only from *Cleared Other* (DA/CA reject). So the flow is a clean tree:
```
Reported 344,331 ─┬─ Not cleared        252,308
                  ├─ Cleared by arrest   54,448 ─┬─ Filed                15,251
                  │                              └─ No filing recorded   39,197
                  └─ Cleared other       37,575 ─┬─ Rejected by DA/CA     9,877
                                                 └─ Other clearance      27,698
```
- **Library:** needs `d3-sankey` (separate from d3). Load a pinned version from jsDelivr like d3, and add it to the "save local copies" task.
- **Bug in the current screen:** its banner divides Rejected by Cleared by Arrest ("% of cleared arrests rejected"). Rejected cases sit under Cleared Other, so that denominator is wrong. The Sankey replaces the banner, so the bug goes with it.
- **Colour:** links in bone at low opacity. One red path is the story: Reported → Cleared by arrest → Filed.

### Category wording (logged in TASK.md)
| Category | Why it confuses | Candidate display label |
|---|---|---|
| Weapon Law | Reads as "a weapon was used". It actually means weapon-law violations (illegal possession, carrying). | "Weapon possession / weapon law violations" |
| Group B | NIBRS jargon: offenses recorded only when an arrest is made (e.g. DUI, trespass, disorderly conduct, liquor law). | "Arrest-only offenses (DUI, trespass…)" |
| Other Group A | Same jargon. | "Other offenses" |
| Unmapped | Internal pipeline term. | Hide, or "Unclassified" |
- **Rename on screen only:** the JSON category values stay as they are, because CLAUDE.md says not to rename keys or values the D3 code depends on.
- **Implementation:** add a `CATEGORY_LABEL` map next to `CATEGORIES` in `util.js`, so every chart picks up the same wording.

## Round 2 questions
All answered 2026-10-24 (item 3: grouped, counts, Larceny/Theft + Simple Assault/Intimidation, max 3 with lock). None are open.

## Cross-cutting bug found while reviewing

**No tooltip appears anywhere.** `index.html` ships `<div id="tooltip" class="tooltip" hidden>`. Every chart module selects that element and sets only `opacity`, so the `hidden` attribute keeps it invisible. The one helper that toggles `hidden` (`util.js` `tooltip.show/hide`) isn't used by any chart. Items 7 and 14 depend on tooltips, so fix this once (in `util.js` or the shared tooltip element) before them, not per chart.

## Items

### 0. Title screen (Deferred)
- **Now:** the label, title, lede and scroll cue sit bottom-left, and the right half is empty.
- **Feedback:** it is too empty. Content for the right side comes later.
- **Action:** none for now.

### 1. KPI overview (Clarify)
- **Now:**
  - 5 KPI cards: Incidents, Violent share (FBI), Cleared by arrest, Firearm involved, Domestic violence.
  - An "Incidents per month" line underneath.
- **Feedback:** it passes the minimum standard, but some numbers feel redundant.
- **Open:** which numbers are redundant (see question Q1)? Possible readings:
  - (a) KPIs that later chapters repeat in full (clearance → #outcomes, firearm → #weapons, DV → flags on #trends);
  - (b) the sub-captions under each value restating the number;
  - (c) the same totals appearing again on About.

### 2. Monthly trend (Ready, one input needed)
- **Now:** all 17 categories draw at once in dim grey (1.2px, 60% opacity). The code means to highlight Fraud/Identity in red, but it compares against `"FRAUD/IDENTITY"` while the data says `"Fraud/Identity"`, so nothing is ever highlighted. Nothing labels the lines, so you can't tell which is which.
- **Feedback:**
  - Show only 1–2 lines on first load; viewers turn on more with the toggles.
  - Make each line identifiable.
- **Proposed:**
  - Initial state: 1–2 categories active. Q2 asks which ones.
  - Direct label at the right end of every visible line (category name plus last value), following DESIGN.md "direct labels at line ends".
  - The highlighted line is red and 2px; other active lines are bone and 1px. A pressed toggle shows its state with `aria-pressed` and an underline, not colour alone.
  - Cap active lines at about 6–8. Further toggles beyond that are refused with a short note, or the oldest one is switched off.

### 3. Day-of-week small multiples + flag trend (Decide)
- **Now:** the 8 highest-volume categories (Larceny/Theft through Fraud/Identity, by total incidents), in severity order on a 4×2 grid. I picked 8 because DESIGN.md asks for about 6–8 series, and 8 panels fit the half-screen without scrolling.
- **Feedback:**
  - The 8-of-17 criterion isn't clear.
  - The x-axis labels collide on the right-hand flag trend plot.
- **Problem with the current cut:** volume ranking drops Robbery (17k), Sex Offense, Homicide, Kidnapping and Human Trafficking, the most severe categories. That probably isn't what the audience expects.
- **Options:** see decision D1.
- **Flag plot fix (Ready):**
  - Fewer ticks, short format (`Apr '24`), or quarterly ticks.
  - Check for no collisions at 1280×720.

### 4. Geographic density map (Approved)
- No change.

### 5. Divisions: total bars + category heatmap (Ready)
- **Now:** 21 division bars on the left. On the right, a division × category heatmap on the DESIGN ramp, with no colour key.
- **Feedback:**
  - The heatmap is okay, but it needs a colour legend under the plot (low → high).
  - The bar list is too dense vertically and needs more space between rows.
- **Proposed:**
  - A ramp legend under the heatmap: a continuous strip from `--ramp-0` to `--ramp-3`, end labels "Low" and "High share of division", and actual min/max % values.
  - Bars: keep one row per division, but cut bar thickness to about 50% of the row so there's a visible gap. Row pitch stays fitted to the screen (21 rows must fit without scrolling).
  - If it is still too dense, decide whether to show the top 15 plus "Other". That would change what the screen shows, so ask first.

### 6. Top locations table (Ready)
- **Feedback:** add table border lines.
- **Proposed:**
  - A 1px `--hairline` rule under the header and between rows. No vertical rules, no outer box.
  - DESIGN.md allows hairlines only, so nothing heavier.

### 7. Area profile scatter (Ready, after the tooltip fix)
- **Feedback:** add a tooltip.
- **Note:** the hover tooltip already exists in `compare.js` (division, total volume, category count, category share). It never shows because of the cross-cutting tooltip bug. Fixing that bug delivers this item, so check the content once it is visible.

### 8. Offense treemap colours (Decide)
- **Now:**
  - Grouping: top 8 categories plus "N other categories", top 4 offenses each plus a roll-up (approved).
  - Colour: only the largest category (Larceny/Theft) is red; everything else is neutral grey.
- **Feedback:**
  - The grouping is liked.
  - The colours are misleading or carry no meaning.
- **Options:** see decision D2.

### 9. Offense co-occurrence matrix (Ready)
- **Now:** the data holds each pair once (115 pairs, one direction only, no diagonal), so the matrix fills one triangle and the mirror cells are empty.
- **Feedback:**
  - The matrix should be colour-symmetric.
  - The diagonal can be black.
- **Proposed:**
  - Mirror every pair so (A,B) and (B,A) share one colour.
  - Diagonal cells draw in `--bg` (black, no mark).
  - Keep the log-domain ramp.
  - Hover the pair from either side and the tooltip shows the same value.

### 10. Weapon classes (Ready)
- **Now:** the Firearm bar is red from the start.
- **Feedback:** all good, but Firearm should start white.
- **Proposed:**
  - All bars start bone. Red only on hover.
  - With nothing pre-highlighted, this screen has no red at rest (allowed).

### 11. Age-sex pyramid (Decide)
- **Now:**
  - Male bars are bone and female bars are bone-60.
  - Small "MALE VICTIMS / FEMALE VICTIMS" headers sit over each half, with age labels in the centre column.
- **Feedback:** nothing makes the male/female split intuitive. Blue/pink is an open decision.
- **Options:** see decision D3.

### 12. Victim descent (Approved)
- No change.

### 13. Outcome funnel (Decide, full rework)
- **Now:** a 4-stage flat funnel: Reported 344k → Cleared 92k → Cleared by Arrest 54k → Filed 15k. A separate banner shows Rejected (9.9k).
- **Feedback:** it says nothing. Mark the whole screen for revision.
- **Available data:**
  - `outcome_funnel.json`: the 5 stage totals.
  - `outcome_by_cat.json`: outcome × category, clearance cohort only.
  - `outcomes.js` also contains an unused `outcomes()` screen (outcome mix by category with a legend) that index.html never shows.
- **Options:** see decision D4.

### 14. Reporting lag (Ready)
- **Now:** a lag chart on the left (q1/median/q3 per category). Three insight cards sit on the right (Longest delay, Immediate reporting, Property crime lag). The x-axis stops short of the plot's right edge.
- **Feedback:**
  - The median cards are redundant; put the median and other details in the tooltip.
  - Extend the x-axis into the empty space on the right.
- **Proposed:**
  - Delete the three cards. The chart takes the full width.
  - The tooltip shows category, median, q1–q3 and n.
  - The x-axis range runs to the plot's right edge.
  - The Fraud/Identity highlight (median 9 days, the only category above 7) stays the single red mark.
- **Depends on:** the cross-cutting tooltip fix.

### 15. About (Deferred)
- Owner's call: don't review until all other pages are done.

## Open decisions

### D1: Which categories appear on the day-of-week screen (item 3)
| Option | What the audience sees | Trade-off |
|---|---|---|
| **A. One heatmap: 17 categories × 7 days** (recommended) | Every category in severity order, each row coloured by its own weekday share (DESIGN ramp) | All categories, one colour key, no selection logic to explain. You lose the bar-shape reading of the small multiples. |
| B. All 17 small multiples, 6×3 grid | Every category as a tiny bar chart | No selection, but panels get small at 1280×720. |
| C. Severity-based 8 | Homicide → Larceny (the more serious half) | Easy to explain ("the 8 most serious"), but drops high-volume Simple Assault and Group B. |
| D. Volume-based 8 (current) | The 8 largest categories | Easy to explain ("the 8 most common"), but drops Homicide, Robbery and Sex Offense. |

### D2: What treemap colour encodes (item 8)
| Option | Encoding | Notes |
|---|---|---|
| **A. Crime against: Person / Property / Society** (recommended) | 3 bone steps (100/60/35), with a small legend | `crime_against` is already in `offense_hierarchy.json`. It is a real NIBRS dimension and adds information the tile sizes don't. It fits DESIGN.md, which allows no categorical hues but does allow bone steps. |
| B. One story category in red, all else neutral | Red on the category the talk is about | Only works if the narration names that category. Today it is just "the largest", which the tile size already shows. |
| C. All neutral, no colour meaning | Size and labels only | Most honest, but flat on a projector. |
| D. Severity ramp | Ramp by severity rank | Ramps read as "more/less". Severity is ordinal, so it's defensible, but it competes with size. |

### D3: Male / female separation on the pyramid (item 11)
| Option | Encoding | Notes |
|---|---|---|
| A. Blue / pink | Two hues | **Conflicts with DESIGN.md** ("No other hues") and plays on gender stereotypes. If chosen, add both colours to DESIGN.md and `tokens.css` as an explicit exception, check the contrast of both on `--bg`, and check how each reads on a projector. |
| **B. Stronger structure, no new hue** (recommended) | Large direct labels "MALE ←" / "→ FEMALE" at the `--fs-h3` scale above each half. A visible centre spine with the age column. Male bone, female `--ramp-1` dark red with bone value labels (or the reverse). Totals per side. | Stays inside the palette. The separation comes from position and labels, which is what DESIGN.md prescribes for categories. |
| C. Two side-by-side bar charts sharing the age axis | Same data, not mirrored | Easiest to compare shapes, but loses the "pyramid" reading. |

### D4: What the outcomes screen should answer (item 13)
Pick the question first; the chart follows from it.
| Option | Question | Chart | Data |
|---|---|---|---|
| **A. "Which crimes get solved?"** (recommended) | Clearance by category | One horizontal bar per category: % cleared by arrest, % cleared other, % open. One red bar for the lowest or highest. | `outcome_by_cat.json` |
| B. "Of 100 reports, how many reach a filed case?" | Attrition | A 100-square unit chart: 100 reports, of which ~27 cleared, ~16 by arrest, ~4 filed. Concrete for a lay audience. | `outcome_funnel.json` |
| C. Both on one screen | Overview + breakdown | B as the headline on the left, A on the right | both |

## Questions for the owner
- **Q1 (item 1):** which KPI numbers are redundant: the ones later chapters repeat, the sub-captions, or something else?
- **Q2 (item 2):** which 1–2 lines show on first load? Suggestion: Larceny/Theft (largest volume) plus one story line, such as the category with the largest change over the window.
- **D1–D4** above.

## Build order once decisions land
1. Tooltip bug (unblocks 7 and 14, and every hover).
2. Ready items: 2 (after Q2), 5, 6, 9, 10, 14, and the item 3 flag axis.
3. Decided items: 3 (D1), 8 (D2), 11 (D3), 13 (D4).
4. Item 1 after Q1.
5. Tester re-review, then 0 and 15.
