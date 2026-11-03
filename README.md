# LAPD Crime Dashboard

An interactive data visualization project exploring crime patterns in Los Angeles using the Los Angeles Police Department (LAPD) crime datasets.

The project uses a local Python data-processing pipeline to transform LAPD **National Incident-Based Reporting System (NIBRS)** data (April 2024 – September 2026) into compact, pre-aggregated JSON files. These outputs power an interactive, scroll-based dashboard built with **D3.js v7** and hosted on **GitHub Pages**.

Instead of loading approximately 950,000 raw rows (the offense and victim tables) into the browser, the dashboard fetches small pre-aggregated JSON files on demand, so the visualizations stay lightweight and fast.

> **Important:** The historical 2020 – February 2024 dataset uses a different reporting methodology from NIBRS. It is maintained separately and must not be directly compared with the NIBRS data in the same visualization.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Technology Stack](#technology-stack)
- [Dashboard Structure](#dashboard-structure)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Data Processing Pipeline](#data-processing-pipeline)
- [Dataset Overview](#dataset-overview)
- [Processed Data Outputs](#processed-data-outputs)
- [Data Limitations and Considerations](#data-limitations-and-considerations)
- [Legacy Pipeline](#legacy-pipeline)
- [Project Documentation](#project-documentation)

---

## Project Overview

The current NIBRS dataset covers April 2024 through September 2026 and contains three data grains:

| Data Grain | Description | Analytical Purpose |
|---|---|---|
| Incident | One record per unique `CaseNo` | Crime volume, geographical distribution, trends, and outcomes |
| Offense | One record per individual offense | Offense categories, crime composition, and offense combinations |
| Victim | One record per victim | Victim demographics and victim-related characteristics |

The dashboard is a single scrolling page with nine chapters and 17 full-screen frames (one to three per chapter). Users move between frames by scrolling or by using the numbered chapter rail on the left edge.

The dashboard design rules are in [DESIGN.md](DESIGN.md), and the development checklist is in [TASK.md](TASK.md).

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Data Processing | Python 3.11 | Data cleaning, transformation, and aggregation |
| Data Manipulation | pandas, NumPy | Efficient processing of large datasets |
| Data Storage | JSON / GeoJSON | Pre-aggregated datasets and map boundaries |
| Visualization | D3.js v7.9.0, d3-sankey 0.12.3 | Interactive charts (both loaded from the jsDelivr CDN as ES modules) |
| Frontend | HTML5, CSS3, JavaScript (ES modules) | Dashboard structure and interactions |
| Typography | Instrument Serif, JetBrains Mono (Google Fonts) | Headings and body/numbers |
| Page Navigation | CSS Scroll Snap plus a wheel handler | One wheel notch moves exactly one frame |
| Routing | HTML hash anchors | Linking to chapters (`#home`, `#trends`, …) |
| Title screen | WebGL (`web/js/rain.js`) | Ambient rain effect on the title screen only |
| Hosting | GitHub Pages | Static dashboard deployment |

### Frontend Architecture

The dashboard follows a lightweight, framework-free architecture:

- **D3.js v7:** Loaded from a CDN using ES modules.
- **CSS Scroll Snap:** Uses `scroll-snap-type: y mandatory` with 100vh screens. A wheel handler in `main.js` limits each wheel notch to one frame transition (650 ms throttle) and lets scrollable tables scroll natively.
- **Hash Navigation:** Each chapter has its own anchor such as `#home` or `#trends`. On load and on `hashchange`, the page scrolls to the matching chapter or screen. Scrolling does **not** rewrite the URL hash; the IntersectionObserver only marks the current chapter in the rail (`aria-current`).
- **Render on view:** An IntersectionObserver (threshold 0.3) dynamically imports a chapter module (`web/js/charts/<chapter>.js`) the first time one of its screens becomes visible, and calls the export named by the screen's `data-screen` attribute.
- **Data Loading:** Each chart fetches its JSON on demand through a shared `lazy()` helper in `main.js` (`fetch` plus an in-memory cache). `d3.json()` is not used.
- **Local State:** Each chapter manages its own DOM and JavaScript state. Nothing is written to the URL or shared across chapters.
- **Layout target:** 16:9 desktop only, sized with `vw`/`vh` units. Below 1024px wide, only a "Best viewed on a desktop (16:9)" notice is shown.
- **Styling:** Colors, type, and spacing are CSS variables in `web/css/tokens.css`; the rules for using them are in `DESIGN.md`.

No frontend framework, jQuery, or fullPage.js is used.

---

## Dashboard Structure

| # | Chapter | Anchor | Screens (as built) |
|---|---|---|---|
| 1 | Overview | `#home` | Title screen with rain effect; KPI sentences next to an incidents-per-month line |
| 2 | Trends | `#trends` | Monthly multi-line chart by category (pick up to 3); day-of-week grouped bars (pick up to 3 categories) beside a monthly line chart for one selected flag |
| 3 | Places | `#places` | Density map (1 km grid or sample dots, category filter, +/− zoom); division bars (click to isolate) beside a division × category heatmap; top-25 incident locations table |
| 4 | Division profiles | `#compare` | Scatter of division volume vs. a chosen category's share, across all 21 divisions |
| 5 | Offenses | `#offenses` | Offense classification treemap; category co-occurrence matrix |
| 6 | Weapons | `#weapons` | Horizontal bars of incidents by weapon/force class |
| 7 | Victims | `#victims` | Back-to-back age/sex population pyramid; victim descent bars with a category filter |
| 8 | Outcomes | `#outcomes` | Report-to-outcome Sankey diagram; reporting-lag box plot by category |
| 9 | About the data | `#about` | Dataset and schema overview; methodology and caveats side by side |

Each chart module may export more screens than `index.html` mounts. The following are written but **not currently mounted**, so users cannot see them: `compare.mix` (diverging bars vs. citywide baseline), `compare.rankings`, `offenses.distribution` (offenses per incident), `weapons.byCategory` and `weapons.summary` (donut), `victims.type`, and `outcomes.outcomes` (100% stacked bars by category). To show one, add a `<div class="screen" data-screen="<export name>">` to the chapter's `<section>` in `index.html`.

---

## Project Structure

```text
LAPD-Crime-Dashboard/
│
├── index.html
├── serve.py                      # local dev server (no-store cache headers)
│
├── web/
│   ├── assets/                   # logo.svg, stone.jpg (title screen)
│   ├── css/
│   │   ├── tokens.css            # design tokens (colors, type, spacing)
│   │   └── style.css             # layout, scroll snap, components
│   └── js/
│       ├── main.js               # router, lazy loading, wheel lock, chapter rail
│       ├── util.js               # shared helpers (color ramp, legend, formatting)
│       ├── rain.js               # WebGL title-screen effect
│       └── charts/
│           └── <chapter>.js      # home, trends, places, compare, offenses,
│                                 # weapons, victims, outcomes, about
│
├── data/
│   ├── raw/                      # read-only inputs, gitignored
│   │   ├── nibrs_offenses.csv
│   │   ├── nibrs_victims.csv
│   │   ├── crime_dataset.csv     # legacy file
│   │   └── geo/                  # boundary source files for build_boundaries.py
│   │
│   └── processed/
│       ├── nibrs/                # 22 files: 21 from transform_nibrs.py + boundaries.json
│       └── lapd/                 # archived legacy outputs
│
├── docs/
│   ├── CONTEXT_NIBRS.md
│   ├── CONTEXT.md
│   ├── analysis_v2.md
│   └── la_crime_transform.py
│
├── src/
│   ├── transform_nibrs.py
│   ├── validate_nibrs.py
│   ├── build_boundaries.py       # simplifies map boundaries into boundaries.json
│   └── transform.py              # legacy pipeline
│
├── CLAUDE.md
├── DESIGN.md
├── TASK.md
├── requirements.txt
└── README.md
```

### Important Directories

| Directory | Description |
|---|---|
| `data/raw/` | Original datasets used by the processing pipeline. |
| `data/processed/nibrs/` | Current JSON outputs consumed by the dashboard. |
| `data/processed/lapd/` | Archived outputs from the legacy pipeline. |
| `src/` | Python scripts for data transformation, validation, and map boundaries. |
| `web/` | Frontend stylesheets, JavaScript, and visualization modules. |
| `docs/` | Data specifications and technical documentation. |

**Data management:** Raw datasets are read-only inputs and are excluded from Git through `.gitignore`. Only the processed data in `data/processed/` is published to GitHub Pages.

---

## Getting Started

### 1. Requirements

- Python 3.11
- pip
- A modern web browser
- Git

### 2. Install Dependencies

```bash
git clone <repository-url>
cd LAPD-Crime-Dashboard

pip install -r requirements.txt
```

`requirements.txt` lists `pandas>=2.0` and `numpy`.

### 3. Generate Processed Datasets

```bash
python src/transform_nibrs.py
```

This writes 21 JSON files to `data/processed/nibrs/`. The script accepts these optional arguments:

- `--offenses`: Path to the NIBRS offenses CSV.
- `--victims`: Path to the NIBRS victims CSV.
- `--output`: Output directory for processed JSON files.

All arguments default to the project's standard directory structure. Each output file has a size limit (2 MB, or 3 MB for `geo_sample.json`).

`boundaries.json` is built separately by `src/build_boundaries.py` from boundary files in `data/raw/geo/`; it is already committed and does not need to be regenerated to run the pipeline.

### 4. Validate Processed Data

```bash
python src/validate_nibrs.py
```

The validation script re-derives totals from the raw datasets and checks the generated outputs. It exits with status code `1` if any check fails.

### 5. Run the Dashboard Locally

The dashboard must be served over HTTP because the browser cannot fetch local JSON files through the `file://` protocol.

```bash
python serve.py          # optional port argument, default 8001
```

Then open:

```text
http://localhost:8001/#home
```

`serve.py` sends `Cache-Control: no-store` so the browser never mixes outdated JavaScript or CSS with updated modules. GitHub Pages is unaffected.

---

## Data Processing Pipeline

### Data Processing Rules

| Component | Processing Rule |
|---|---|
| Date Range | April 2024 – September 2026, based on `Date OCC`. |
| Incident Grain | One record per unique `CaseNo`. |
| Offense Grain | One record per individual offense. |
| Victim Grain | One record per victim. |
| Primary Offense | Each incident takes its category, outcome, and premise from its most serious offense, ranked by `CATEGORY_RANK`. Offense-level files still count every offense. |
| Victim Classification | Victims receive their crime classification through their own `VictimOfsList`. |
| Excluded Records | Invalid `CaseNo` values (1 row) and incidents with a "Not a Crime" outcome (1,688 incidents) are excluded. |
| Geographic Data | Records with null or zero coordinates are excluded from geographical outputs only. |
| Clearance Cohort | Outcome-related datasets include only incidents that occurred at least 180 days before the snapshot date. |
| Snapshot Date | Set by the pipeline to the latest `Date Rptd` in the data: October 12, 2026. |
| Time Analysis | Hourly analysis is excluded because `Time OCC` contains default-entry spikes. |

### Important Processing Decisions

**1. Separate Data Grains.** Incident, offense, and victim records are aggregated independently to avoid double-counting.

**2. Primary Offense Classification.** When an incident contains multiple offenses, its category, outcome, and premise come from its most serious offense. Offense-level outputs (hierarchy, co-occurrence, offense counts) keep all offenses.

**3. Avoiding Data Fan-out.** Offense records are never joined to victim records.

**4. Clearance Analysis.** The restricted cohort helps avoid reading recently reported cases as unresolved before enough time has passed. The funnel covers 344,331 of the 435,318 incidents.

---

## Dataset Overview

### Current Dataset: NIBRS (April 2024 – September 2026)

| Metric | Records (after exclusions) |
|---|---:|
| Total Incidents | 435,318 |
| Total Offenses | 484,949 |
| Total Victims | 444,150 |

The raw offense and victim tables together hold roughly 950,000 rows; the counts above are what remains after the exclusions listed in the processing rules, and incidents are derived from the offense table.

### Dataset Coverage

| Period | Status |
|---|---|
| March 2024 | Partially covered; NIBRS launched on March 7, 2024. Not shown. |
| April 2024 – August 2026 | Included in the analysis. |
| September 2026 | Included, but about 92% of recent monthly levels and shaded as partial data. |
| October 2026 | Excluded because the month is incomplete. |

The data snapshot date is **October 12, 2026**.

---

## Processed Data Outputs

All processed datasets are in `data/processed/nibrs/`. Each is a compact JSON array, except `kpi.json` (a single object) and `boundaries.json` (a GeoJSON FeatureCollection).

**Important:** The JSON keys are the contract between the Python pipeline and the D3.js modules. Do not rename them without updating the matching chart module.

The "Built visual" column describes what the dashboard currently mounts. "Not mounted" means a chart module for it exists in the code but is not on any screen.

### 1. Overview

| File | Main Fields | Built visual |
|---|---|---|
| `kpi.json` | incidents, offenses, victims, offenses_per_incident, violent_share_fbi, clearance_arrest_rate, felony_share, weapon_share, firearm_share, dv_share, invalid_caseno_rows, not_a_crime_incidents, window_start, window_end, snapshot_date | KPI sentences on `#home` (incidents, violent share, arrest clearance, firearm share, DV share); schema overview on `#about` |

### 2. Trends and Time Analysis

| File | Main Fields | Built visual |
|---|---|---|
| `monthly_by_cat.json` | month, category, count | Multi-line chart with toggle legend (max 3 categories); total-incidents line on `#home` |
| `dow_by_cat.json` | category, dow, count | One grouped bar chart by weekday, legend picks up to 3 categories |
| `flags_monthly.json` | month, flag, count | Line chart with a flag dropdown |

### 3. Geographical Analysis

| File | Main Fields | Built visual |
|---|---|---|
| `area_summary.json` | area, area_cd, total, violent_share_fbi, clearance_arrest_rate, dv_share, gang_share, transit_share, firearm_share, lat, lon | Sorted horizontal bars of division totals; x-axis of the `#compare` scatter |
| `area_by_cat.json` | area, category, count | Division × category heatmap; y-axis of the `#compare` scatter |
| `flags_by_area.json` | area, flag, count, share | Not used by the dashboard |
| `top_locations.json` | location, area, count, top_category | Top-25 table |
| `geo_grid.json` | glat, glon, category, count | Density map of 0.01° (~1 km) cells, colored in log classes |
| `geo_sample.json` | lat, lon, category, area, month | Dot-map toggle (random 20,000-incident sample, seed 42) |
| `boundaries.json` | GeoJSON features: city, land, california, division_lines | Map outlines and division lines under the density map |

### 4. Offense Composition

| File | Main Fields | Built visual |
|---|---|---|
| `offense_hierarchy.json` | crime_against, category, label, count | Treemap |
| `offense_cooccurrence.json` | source, target, count | Adjacency matrix |
| `offense_count_dist.json` | offense_count, incidents | Not mounted (bar chart exists in `offenses.js`) |
| `top_offenses.json` | label, nibr_code, severity, count | Not used by the dashboard |
| `report_lag_by_cat.json` | category, q1, median, q3, p90, mean, count | Box plot from precomputed stats (box = Q1–Q3, line = median, whisker = 90th percentile); `mean` is not drawn |

### 5. Weapons and Outcomes

| File | Main Fields | Built visual |
|---|---|---|
| `weapon_class.json` | category, weapon_class, count | Horizontal bars of weapon class totals across all crimes. Per-category bars and a donut exist in `weapons.js` but are not mounted. |
| `outcome_by_cat.json` | category, outcome, count | Not mounted (100% stacked bars exist in `outcomes.js`) |
| `outcome_funnel.json` | stage, count | Sankey diagram: Reported → cleared by arrest / cleared other / not cleared → filed / rejected |

### 6. Victim Analysis

| File | Main Fields | Built visual |
|---|---|---|
| `victim_type.json` | victim_type, count | Not mounted (bar chart exists in `victims.js`) |
| `victim_age_sex.json` | age_group, vict_sex, count | Population pyramid (male vs. female) |
| `victim_descent_by_cat.json` | descent_group, category, count | Horizontal bars with a category dropdown |

### Visualization Considerations

- Monthly trends parse months with `d3.timeParse("%Y-%m")`.
- September 2026 is shaded and labeled "Partial Data" on the monthly chart.
- Day-of-week analysis excludes incidents that occurred on the first day of a month, because that date is often a default entry.
- Map cells use log classes (one color step per order of magnitude), fixed across category filters, because counts are heavily skewed. Zero counts draw no mark.
- Victim descent charts show counts, not population rates.
- Clearance-related charts state the 180-day cohort in a caption.
- The mouse wheel never zooms a chart; the map uses drag to pan and +/− buttons to zoom.

---

## Data Limitations and Considerations

### 1. Different Reporting Methodologies
NIBRS counts each offense individually. The current dataset is therefore not directly comparable with the historical 2020 – February 2024 dataset.

### 2. Incomplete Reporting Period
September 2026 is approximately 92% of recent monthly levels and may still be slightly undercounted.

### 3. Clearance Cohort
Clearance statistics only include incidents at least 180 days old as of October 12, 2026.

### 4. Time-of-Day Reliability
Hourly analysis is excluded because the source contains default time entries (midnight and noon spikes).

### 5. Victim Demographics
Victim descent counts are recorded victim counts, not population-adjusted rates, and do not describe offender demographics. The age/sex pyramid covers individual victims with a known age; victims under 18 are not in the source data.

### 6. Homelessness-Related Flags
Homeless suspect, arrestee, and victim flags describe the people involved in recorded incidents. They should not be read as explanations or causes of crime.

---

## Legacy Pipeline

The original LAPD dataset covering **2020 – February 2024** is maintained as a separate, frozen pipeline.

| Component | Location |
|---|---|
| Transformation Script | `src/transform.py` |
| Processed Outputs | `data/processed/lapd/` |
| Documentation | `docs/CONTEXT.md` |
| Archived Branch | `LAPD/archived` |

The legacy pipeline is preserved for historical reference and is not combined with the NIBRS analysis.

---

## Project Documentation

| File | Description |
|---|---|
| [DESIGN.md](DESIGN.md) | Visual design system: colors, type, chart rules, accessibility. |
| [TASK.md](TASK.md) | Dashboard development checklist. |
| [docs/CONTEXT_NIBRS.md](docs/CONTEXT_NIBRS.md) | NIBRS processing specifications, mappings, and output contract. |
| [docs/CONTEXT.md](docs/CONTEXT.md) | Documentation for the historical LAPD pipeline. |
| [docs/analysis_v2.md](docs/analysis_v2.md) | Page-by-page dashboard review feedback (v2). |
| [CLAUDE.md](CLAUDE.md) | Development guidelines and working rules for the data pipelines. |
| [requirements.txt](requirements.txt) | Python dependencies. |

---

**Project:** LAPD Crime Dashboard  
**Data Source:** Los Angeles Police Department (LAPD)  
**Current Dataset:** NIBRS, April 2024 – September 2026  
**Data Snapshot:** October 12, 2026  
**Visualization Library:** D3.js v7  
**Deployment:** GitHub Pages
