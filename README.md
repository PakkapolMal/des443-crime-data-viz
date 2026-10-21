# LAPD Crime Dashboard — Data Pipeline

A local Python pipeline that turns the LAPD **NIBRS** crime tables (Apr 2024 – Sep 2026) into small, pre-aggregated JSON files. A D3.js dashboard loads them with `d3.json()`, so the browser never sees the raw ~950k rows.

> The older 2020 – Feb 2024 pipeline is archived (see [Legacy pipeline](#legacy-pipeline)). NIBRS counts each offense separately, so the two datasets are **never** compared in one chart.

## Project structure

```
data/
  raw/                         # inputs, read-only, gitignored
    nibrs_offenses.csv         #   one row per offense   (~499k)
    nibrs_victims.csv          #   one row per victim    (~457k)
    crime_dataset.csv          #   legacy 2020-2024 file
  processed/
    nibrs/                     # current outputs (21 JSON files)  <- dashboard reads these
    lapd/                      # legacy outputs (frozen)
docs/
  CONTEXT_NIBRS.md             # NIBRS spec: step plan, mappings, output contract
  CONTEXT.md                   # legacy spec
  la_crime_transform.py        # legacy Colab reference
src/
  transform_nibrs.py           # NIBRS pipeline
  validate_nibrs.py            # NIBRS checks (exit 1 on failure)
  transform.py                 # legacy pipeline
CLAUDE.md                      # working rules for the pipelines
requirements.txt
```

## Running

```bash
pip install -r requirements.txt
python src/transform_nibrs.py      # writes data/processed/nibrs/ (~20 s)
python src/validate_nibrs.py       # re-derives totals from raw data and checks every output
```

`transform_nibrs.py` accepts `--offenses`, `--victims` and `--output`. All of them default to the paths above.

## How the NIBRS data is shaped

| Concept | Rule |
|---|---|
| **Window** | `Date OCC` month from **2024-04** to **2026-09**. March 2024 is only partly covered because the system launched on 2024-03-07, and October 2026 is still incomplete. |
| **Grains** | **Incident** (one per `CaseNo`) for volume, place, trend and outcome. **Offense** for offense-type mix. **Victim** for demographics. Each file uses exactly one grain. |
| **Primary offense** | Each incident takes its category, outcome and premise from its most serious offense. Seriousness comes from `CATEGORY_RANK`. |
| **No fan-out** | Offenses are never joined to victims. Victims get their crime type from their own `VictimOfsList`. |
| **Excluded** | Invalid `CaseNo` values (1 row) and "Not a Crime" outcomes (1,688 incidents) are dropped. Null or zero coordinates are dropped from the geo files only. |
| **Clearance cohort** | Outcome and funnel files use only cases at least 180 days old as of the snapshot date (2026-10-12). |
| **No time of day** | `Time OCC` has default-entry spikes, so no file contains an hour field. |

Current volumes: **435,318 incidents · 484,949 offenses · 444,150 victims**.

## Outputs → suggested visuals

All files are in `data/processed/nibrs/`. Each one is a compact JSON array of records, except `kpi.json`, which is a single object. **The keys are a contract with the D3 code. Don't rename them.**

### Overview

| File | Keys | Suggested visual | Notes |
|---|---|---|---|
| `kpi.json` | incidents, offenses, victims, offenses_per_incident, violent_share_fbi, clearance_arrest_rate, felony_share, weapon_share, firearm_share, dv_share, invalid_caseno_rows, not_a_crime_incidents, window_start, window_end, snapshot_date | **KPI card row**: 4–6 cards (incidents, violent share, arrest clearance, firearm share, DV share) | Put `window_start`–`window_end` and `snapshot_date` in the header. `clearance_arrest_rate` covers the cohort only, so label it that way. |

### Trend and time

| File | Keys | Suggested visual | Notes |
|---|---|---|---|
| `monthly_by_cat.json` | month, category, count | **Multi-line chart** (small multiples work well too), or a stacked area chart for total volume | Use `d3.timeParse("%Y-%m")`. Lines read better than stacked areas for comparing categories. Shade Sep 2026 as "may be undercounted". |
| `dow_by_cat.json` | category, dow, count | **Small-multiple bar charts**, one panel per category, 7 bars each (0 = Mon) | Rows whose date was the 1st of the month are excluded, because that date is often a default entry. Normalize each panel to its own share so shapes can be compared. |
| `flags_monthly.json` | month, flag, count | **Multi-line chart** with a flag selector | The flags have very different sizes (hate ≪ DV), so use independent y-scales or small multiples. |

### Place

| File | Keys | Suggested visual | Notes |
|---|---|---|---|
| `area_summary.json` | area, area_cd, total, violent_share_fbi, clearance_arrest_rate, dv_share, gang_share, transit_share, firearm_share, lat, lon | **Sorted horizontal bars** (`total`) + **scatter** (`total` vs `clearance_arrest_rate`, or vs `violent_share_fbi`) | `lat`/`lon` are the median coordinates per area, useful as label anchors on a map. A scatter shows that volume rank and crime mix differ. |
| `area_by_cat.json` | area, category, count | **Matrix heatmap** (area × category) | Color by each area's row share (count ÷ area total) rather than raw count, or the largest areas dominate the colors. |
| `flags_by_area.json` | area, flag, count, share | **Small multiples** (one bar chart per flag, sorted by `share`) or a dot plot | Use `share` to compare areas. Tests the hypothesis that DV share varies more by area than total volume does. |
| `top_locations.json` | location, area, count, top_category | **Table** or a ranked bar list with a `top_category` color chip | Hundred-block addresses, top 25. 600 S Alvarado St is #1 with 1,129 incidents. |
| `geo_grid.json` | glat, glon, category, count | **Grid / density map**: square cells colored by count, with a category filter | 0.01° cells (~1 km). Sum across categories for "All". Use a sequential log or quantile color scale, because the counts are heavily skewed. |
| `geo_sample.json` | lat, lon, category, area, month | **Dot map** with tooltips (category, area, month) | A random 20k-incident sample (seed 42). Show the pattern, not counts. Use a low opacity of about 0.3. |

### Offense composition (offense grain)

| File | Keys | Suggested visual | Notes |
|---|---|---|---|
| `offense_hierarchy.json` | crime_against, category, label, count | **Sunburst** or zoomable icicle, built with `d3.rollup` / `d3.hierarchy` (crime_against → category → label) | Top 8 labels per category. The rest are grouped as "Other". |
| `offense_cooccurrence.json` | source, target, count | **Chord diagram** (`d3.chord`) or an adjacency matrix | Unordered category pairs within multi-offense incidents. Burglary + Vandalism is the strongest pair. |
| `offense_count_dist.json` | offense_count, incidents | **Bar chart** (1, 2, 3, 4, 5+) | `offense_count` is a string, so use a band scale. About 90% of incidents have a single offense. |
| `top_offenses.json` | label, nibr_code, severity, count | **Horizontal bar chart** colored by `severity` (Felony / Misdemeanor / Other) | Top 15 offense labels. |
| `report_lag_by_cat.json` | category, q1, median, q3, p90, mean, count | **Box plot from precomputed stats** (whisker to `p90`, tick at `mean`) | Use a log or sqrt x-axis, because lags range from 0 days to years. Excludes rows where `Date Rptd` is null. |

### Weapons and outcomes (incident grain)

| File | Keys | Suggested visual | Notes |
|---|---|---|---|
| `weapon_class.json` | category, weapon_class, count | **100% stacked bars** per category | Order the classes by severity: Firearm, Knife, Other, Bodily Force, Unknown, None. Consider hiding "None" or toggling it off. |
| `outcome_by_cat.json` | category, outcome, count | **100% stacked bars** per category | Clearance cohort only. Sort categories by their Cleared by Arrest share. |
| `outcome_funnel.json` | stage, count | **Funnel** or a descending bar chart: Reported → Cleared → Cleared by Arrest → Filed, with Rejected shown separately | "Rejected" is a branch, not a step in the funnel. Show it to the side. |

### Victims (victim grain)

| File | Keys | Suggested visual | Notes |
|---|---|---|---|
| `victim_type.json` | victim_type, count | **Bar chart** (or donut chart if you limit it to the top 4 and group the rest as "Other") | Includes all victims. Businesses are about 61k, which the legacy data hid behind age = 0. |
| `victim_age_sex.json` | age_group, vict_sex, count | **Population pyramid** (Male left, Female right) | Individuals with a known age only. Transgender and Unknown are too small for the pyramid, so put them in a note or a side bar. |
| `victim_descent_by_cat.json` | descent_group, category, count | **Stacked or grouped bars** (descent × category) | Show **counts, not rates**. Add a caption saying these are not population rates and say nothing about offenders. |

## Dashboard caveats (show these on screen)

- NIBRS counts offenses individually, so these figures are **not comparable** with the 2020 – Feb 2024 dataset.
- The window runs from Apr 2024 to Sep 2026. Sep 2026 is at 92% of recent months and may still be slightly undercounted.
- Clearance figures cover only cases at least 180 days old as of 2026-10-12.
- Time of day isn't shown, because the source contains default time entries that can't be told apart from real times.
- Victim descent counts aren't population rates and say nothing about offenders.
- The homeless suspect and arrestee flags describe the people involved. They don't explain causes.

## Legacy pipeline

The 2020 – Feb 2024 pipeline (`src/transform.py`, outputs in `data/processed/lapd/`) is frozen. Its snapshot lives on branch **`LAPD/archived`**. The spec is in `docs/CONTEXT.md`.
