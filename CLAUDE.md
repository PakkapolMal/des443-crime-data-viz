# CLAUDE.md

Read `CONTEXT.md` first. It covers the dataset quirks, the mappings and the output contract.

## Task
Build a local Python pipeline that turns `data/raw/crime_dataset.csv` into the JSON files listed in `CONTEXT.md` → *Output plan*, written to `data/processed/`. A separate D3.js dashboard consumes those files.

## Layout (assumed, create if missing)
```
data/raw/crime_dataset.csv     # input, read-only
data/processed/                # outputs
src/transform.py               # pipeline (port of la_crime_transform.py)
src/validate.py                # sanity checks on outputs
requirements.txt               # pandas, numpy
```

## Rules
- **Never modify or overwrite `data/raw/`.**
- Load with `usecols` and `category` dtypes. Never load all 28 columns.
- Don't print or dump raw rows beyond `head()`. The file is large, and summaries are enough.
- Follow the cleaning rules and mappings in `CONTEXT.md` exactly. If the real data contradicts them (a different date format, unexpected codes), stop and report the conflict instead of guessing.
- Time-series outputs must stop at `TREND_END = "2024-02"` (NIBRS cut-over).
- Use vectorized pandas only, no row-wise `apply` over 1M rows. Regex category mapping runs on unique descriptions, then `.map()`.
- Handle NaN safely on pandas 2.x and 3.x (`to_label` helper).
- Output JSON is records-oriented, compact, with snake_case keys exactly as specified. Don't rename keys, because the D3 code depends on them.
- Use fixed random seeds (`random_state=42`).
- Structure the script as functions: `load → clean → derive → aggregate → export`, plus a `main()` with CLI args `--input`, `--output`, `--trend-end`.

## Validation (run after every change)
- Log the row count after each filter step and how many rows each step dropped.
- Log the top 25 descriptions that fall into `crime_cat == "Other"`.
- Log the `TIME OCC` spikes (1200, 1) and the number of zero-coordinate rows.
- Assert that every output file exists, is non-empty and stays within the size target, and that counts in each per-chart file add up to the total for its filter scope.

## Working style
- Propose the plan or any design change before large edits. Keep changes small and explain the why.
- When done, summarize: files produced, sizes, row counts dropped per filter, and any data surprises found.

---

# NIBRS pipeline (separate from the legacy pipeline above)

For any NIBRS task, read `CONTEXT_NIBRS.md` first. It holds the step plan, the mapping dicts and the output contract. The legacy rules above don't apply to NIBRS unless repeated here.

## Layout
```
data/raw/nibrs_offenses.csv     # input, read-only
data/raw/nibrs_victims.csv      # input, read-only
data/processed/nibrs/           # outputs
src/transform_nibrs.py          # load -> clean -> offense/incident/victim grains -> aggregate -> export
src/validate_nibrs.py
```
Never import from or write into the legacy pipeline's files, and never mix legacy and NIBRS data in one output.

## Analysis window: 2024-04 to 2026-09 (inclusive, by `Date OCC` month)
Reasons:
- **Start 2024-04.** LAPD's NIBRS records system went live on 2024-03-07, so March 2024 is a partial month. The dataset also contains older occurrence dates, going back to an obviously invalid 1800-01-06. These are cases entered into the new system later and would distort trends.
- **End 2026-09.** The snapshot's latest report date is around 2026-10-12, so October 2026 is incomplete. September 2026 is the last full month, but late reports may still undercount it slightly. Log Sep 2026's total against the median of the prior six months and flag it if it's below 90%. Don't move the window yourself; report it.
- `WINDOW_START` and `WINDOW_END` are constants at the top of the script and are written to `kpi.json`.

## Rules
- **Invalid `CaseNo` = contains no digit** (`~str.contains(r"\d")`). Flag these rows, exclude them from the incident and victim grains, and log the count and the distinct values.
- **No time-of-day analysis.** Don't load `Time OCC` and don't output hour fields or an hour heatmap. The 0000 and 1200 spikes can't be told apart from real times.
- **Grains are fixed:** incident for volume, place, trend and outcome; offense for offense-type composition; victim for demographics. Each output uses exactly one grain.
- **No fan-out.** Never join offenses to victims on `CaseNo` and then count. Victim crime type comes from `VictimOfsList`.
- Incident flags are aggregated with `any()` per `CaseNo`, never summed across offense rows.
- Exclude "Not a Crime" outcomes (Unfounded, Non-Crime/Other) from every crime count.
- Clearance and funnel outputs use only the clearance cohort: cases at least 180 days old as of the snapshot date.
- Split weapons on `Weapon Used Cd`, never on `Weapon Desc`, because the descriptions contain commas.
- Any value that maps to "Unmapped" (NIBR code, descent, victim type) must be logged with its counts. If more than 0.5% of rows are unmapped, stop and report instead of guessing a mapping.
- Read every ID and code column as `str`, so leading zeros survive (`"01"`, `"09A"`).

## Validation (`src/validate_nibrs.py`)
- Row counts after each filter, with the reason for each drop.
- Distinct invalid `CaseNo` values and their count.
- `NIBR Description` parse failures (count plus the top 10).
- Offense rows per `CaseNo` vs. `TotalOffenseCount` (report the mismatch rate).
- Unmapped counts per mapping.
- Sep 2026 completeness check (see above).
- Every file in the output contract exists, uses the specified keys, and is under 2 MB (`geo_sample.json` under 3 MB).
- Sum checks: `monthly_by_cat` totals equal incidents in the window; `victim_age_sex` totals equal individual victims with a known age.

## Working style
Same as the legacy pipeline: propose the plan before large edits, and when done, summarize the files, sizes, drops per filter and any data surprises.
