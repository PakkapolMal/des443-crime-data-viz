# LAPD Crime Dashboard

An interactive data visualization project exploring crime patterns in Los Angeles using the Los Angeles Police Department (LAPD) crime datasets.

The project uses a local Python data-processing pipeline to transform LAPD **National Incident-Based Reporting System (NIBRS)** data (April 2024 – September 2026) into compact, pre-aggregated JSON files. These outputs are designed to power an interactive, scroll-based dashboard built with **D3.js v7** and hosted on **GitHub Pages**.

Instead of loading approximately 950,000 raw records directly into the browser, the dashboard retrieves optimized JSON datasets, allowing visualizations to remain lightweight and efficient.

> **Important:** The historical 2020 – February 2024 dataset uses a different reporting methodology from NIBRS. These datasets are maintained separately and must not be directly compared in the same visualization.

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

The project is designed to explore different dimensions of crime in Los Angeles through interactive data visualizations.

The current NIBRS dataset covers April 2024 through September 2026 and contains three primary data grains:

| Data Grain | Description | Analytical Purpose |
|---|---|---|
| Incident | One record per unique `CaseNo` | Crime volume, geographical distribution, trends, and outcomes |
| Offense | One record per individual offense | Offense categories, crime composition, and offense combinations |
| Victim | One record per victim | Victim demographics and victim-related characteristics |

The dashboard is organized into nine chapters:

1. **Home** – Overall crime statistics and key performance indicators.
2. **Trends** – Monthly crime patterns and temporal analysis.
3. **Places** – Geographical distribution and comparisons across LAPD areas.
4. **Compare** – Comparative exploration of crime characteristics.
5. **Offenses** – Offense composition, severity, and co-occurrence.
6. **Weapons** – Weapon classifications across crime categories.
7. **Victims** – Victim demographics and characteristics.
8. **Outcomes** – Crime clearance and case outcome analysis.
9. **About** – Project background, methodology, and data limitations.

Each chapter contains one to three full-screen sections. Users navigate through the dashboard by scrolling vertically.

The dashboard implementation and remaining development tasks are documented in [TASK.md](TASK.md).

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Data Processing | Python 3.11 | Data cleaning, transformation, and aggregation |
| Data Manipulation | Pandas, NumPy | Efficient processing of large datasets |
| Data Storage | JSON | Pre-aggregated datasets for visualization |
| Visualization | D3.js v7 | Interactive charts and data visualizations |
| Frontend | HTML5, CSS3, JavaScript | Dashboard structure and interactions |
| Page Navigation | CSS Scroll Snap | Full-screen vertical scrolling |
| Routing | HTML Hash Anchors | Navigation between dashboard chapters |
| Hosting | GitHub Pages | Static dashboard deployment |

### Frontend Architecture

The dashboard follows a lightweight, framework-free architecture:

- **D3.js v7:** Loaded through a CDN using ES modules.
- **CSS Scroll Snap:** Uses `scroll-snap-type: y mandatory` with full-screen sections.
- **Hash-based Navigation:** Each chapter has its own URL anchor, such as `#home` and `#trends`.
- **IntersectionObserver:** Synchronizes the URL hash with the currently visible chapter.
- **Local State Management:** Each chapter manages its own DOM and JavaScript state.
- **Data Loading:** Uses `d3.json()` to retrieve processed datasets.

No frontend framework, jQuery, or fullPage.js is required.

---

## Dashboard Structure

The dashboard is designed as a single-page scrolling experience.

| Chapter | URL Anchor | Main Focus |
|---|---|---|
| Home | `#home` | Overall crime statistics |
| Trends | `#trends` | Monthly and temporal patterns |
| Places | `#places` | Geographical crime distribution |
| Compare | `#compare` | Comparative crime analysis |
| Offenses | `#offenses` | Offense categories and combinations |
| Weapons | `#weapons` | Weapon classifications |
| Victims | `#victims` | Victim demographics |
| Outcomes | `#outcomes` | Clearance and case outcomes |
| About | `#about` | Methodology and project information |

Each chapter is composed of one to three snapping screens, allowing users to explore the data progressively.

---

## Project Structure

```text
LAPD-Crime-Dashboard/
│
├── index.html
│
├── web/
│   ├── css/
│   │   └── style.css
│   │
│   └── js/
│       ├── main.js
│       └── charts/
│           └── <chapter>.js
│
├── data/
│   ├── raw/
│   │   ├── nibrs_offenses.csv
│   │   ├── nibrs_victims.csv
│   │   └── crime_dataset.csv
│   │
│   └── processed/
│       ├── nibrs/
│       └── lapd/
│
├── docs/
│   ├── CONTEXT_NIBRS.md
│   ├── CONTEXT.md
│   └── la_crime_transform.py
│
├── src/
│   ├── transform_nibrs.py
│   ├── validate_nibrs.py
│   └── transform.py
│
├── CLAUDE.md
├── TASK.md
├── requirements.txt
└── README.md
```

### Important Directories

| Directory | Description |
|---|---|
| `data/raw/` | Original datasets used by the processing pipeline. |
| `data/processed/nibrs/` | Current NIBRS JSON outputs consumed by the dashboard. |
| `data/processed/lapd/` | Archived outputs from the legacy pipeline. |
| `src/` | Python scripts for data transformation and validation. |
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

Clone the repository and install the required Python packages.

```bash
git clone <repository-url>
cd LAPD-Crime-Dashboard

pip install -r requirements.txt
```

### 3. Generate Processed Datasets

Run the NIBRS transformation pipeline:

```bash
python src/transform_nibrs.py
```

This generates the processed JSON datasets in:

```text
data/processed/nibrs/
```

The script accepts the following optional arguments:

- `--offenses`: Path to the NIBRS offenses CSV.
- `--victims`: Path to the NIBRS victims CSV.
- `--output`: Output directory for processed JSON files.

All arguments default to the project's standard directory structure.

### 4. Validate Processed Data

Run the validation script:

```bash
python src/validate_nibrs.py
```

The validation pipeline re-derives totals from the raw datasets and checks the generated outputs.

The script exits with status code `1` if validation fails.

### 5. Run the Dashboard Locally

The dashboard must be served over HTTP because D3.js cannot load local JSON files through the `file://` protocol.

Start the local development server:

```bash
python serve.py
```

Then open:

```text
http://localhost:8001/#home
```

The development server uses `Cache-Control: no-store` to prevent the browser from mixing outdated JavaScript or CSS files with updated modules.

---

## Data Processing Pipeline

The NIBRS processing pipeline transforms the original LAPD datasets into structured JSON files optimized for visualization.

### Data Processing Rules

| Component | Processing Rule |
|---|---|
| Date Range | April 2024 – September 2026, based on `Date OCC`. |
| Incident Grain | One record per unique `CaseNo`. |
| Offense Grain | One record per individual offense. |
| Victim Grain | One record per victim. |
| Primary Offense | Each incident inherits its category, outcome, and premise from its most serious offense, determined using `CATEGORY_RANK`. |
| Victim Classification | Victims receive their crime classification through their own `VictimOfsList`. |
| Excluded Records | Invalid `CaseNo` values and incidents with a "Not a Crime" outcome are excluded. |
| Geographic Data | Records with null or zero coordinates are excluded from geographical outputs only. |
| Clearance Cohort | Outcome-related datasets include only cases at least 180 days old as of the snapshot date. |
| Time Analysis | Hourly analysis is excluded because `Time OCC` contains default-entry spikes. |

### Important Processing Decisions

**1. Separate Data Grains**

Incident, offense, and victim records are aggregated independently to avoid double-counting.

**2. Primary Offense Classification**

When an incident contains multiple offenses, its primary category, outcome, and premise are determined by its most serious offense.

**3. Avoiding Data Fan-out**

Offense records are never directly joined to victim records. Victim crime classifications are derived from `VictimOfsList` to preserve the correct victim-level relationships.

**4. Clearance Analysis**

Clearance statistics use a restricted cohort consisting of cases at least 180 days old as of October 12, 2026. This helps avoid interpreting recently reported cases as unresolved cases before sufficient time has passed.

---

## Dataset Overview

### Current Dataset: NIBRS (April 2024 – September 2026)

<details>
<summary><strong>Dataset Statistics</strong></summary>

| Metric | Records |
|---|---:|
| Total Incidents | 435,318 |
| Total Offenses | 484,949 |
| Total Victims | 444,150 |

</details>

The dataset includes approximately 950,000 records across the offense and victim tables.

### Dataset Coverage

| Period | Status |
|---|---|
| March 2024 | Partially covered; NIBRS launched on March 7, 2024. |
| April 2024 – August 2026 | Included in the analysis. |
| September 2026 | Included, but potentially undercounted. |
| October 2026 | Excluded because the month is incomplete. |

The current snapshot date is **October 12, 2026**.

---

## Processed Data Outputs

All processed datasets are stored in:

```text
data/processed/nibrs/
```

Each output is a compact JSON array, except `kpi.json`, which is a single JSON object.

**Important:** The JSON keys form the data contract between the Python pipeline and the D3.js frontend. Do not rename them without updating the corresponding visualization modules.

### 1. Overview

| File | Main Fields | Suggested Visualization |
|---|---|---|
| `kpi.json` | incidents, offenses, victims, offenses_per_incident, violent_share_fbi, clearance_arrest_rate, felony_share, weapon_share, firearm_share, dv_share | KPI cards |

### 2. Trends and Time Analysis

| File | Main Fields | Suggested Visualization |
|---|---|---|
| `monthly_by_cat.json` | month, category, count | Multi-line chart |
| `dow_by_cat.json` | category, dow, count | Small-multiple bar charts |
| `flags_monthly.json` | month, flag, count | Multi-line chart with flag selector |

### 3. Geographical Analysis

| File | Main Fields | Suggested Visualization |
|---|---|---|
| `area_summary.json` | area, area_cd, total, violent_share_fbi, clearance_arrest_rate, dv_share, gang_share, transit_share, firearm_share, lat, lon | Ranked bar chart and scatter plot |
| `area_by_cat.json` | area, category, count | Matrix heatmap |
| `flags_by_area.json` | area, flag, count, share | Small-multiple charts or dot plot |
| `top_locations.json` | location, area, count, top_category | Ranked table or bar chart |
| `geo_grid.json` | glat, glon, category, count | Geographic density map |
| `geo_sample.json` | lat, lon, category, area, month | Geographic dot map |

### 4. Offense Composition

| File | Main Fields | Suggested Visualization |
|---|---|---|
| `offense_hierarchy.json` | crime_against, category, label, count | Sunburst or zoomable icicle |
| `offense_cooccurrence.json` | source, target, count | Chord diagram or adjacency matrix |
| `offense_count_dist.json` | offense_count, incidents | Bar chart |
| `top_offenses.json` | label, nibr_code, severity, count | Ranked horizontal bar chart |
| `report_lag_by_cat.json` | category, q1, median, q3, p90, mean, count | Box plot using precomputed statistics |

### 5. Weapons and Outcomes

| File | Main Fields | Suggested Visualization |
|---|---|---|
| `weapon_class.json` | category, weapon_class, count | 100% stacked bar chart |
| `outcome_by_cat.json` | category, outcome, count | 100% stacked bar chart |
| `outcome_funnel.json` | stage, count | Funnel chart or descending bar chart |

### 6. Victim Analysis

| File | Main Fields | Suggested Visualization |
|---|---|---|
| `victim_type.json` | victim_type, count | Bar chart or donut chart |
| `victim_age_sex.json` | age_group, vict_sex, count | Population pyramid |
| `victim_descent_by_cat.json` | descent_group, category, count | Grouped or stacked bar chart |

### Visualization Considerations

- Monthly trends should use `d3.timeParse("%Y-%m")`.
- September 2026 should be visually identified as potentially undercounted.
- Day-of-week analysis excludes records occurring on the first day of a month due to potential default date entries.
- Geographical density maps should use logarithmic or quantile color scales because incident counts are heavily skewed.
- Victim descent visualizations must show counts rather than population rates.
- Clearance-related visualizations must clearly identify the restricted 180-day cohort.

---

## Data Limitations and Considerations

The following limitations should be communicated to dashboard users to avoid misleading interpretations.

### 1. Different Reporting Methodologies

NIBRS counts each offense individually. Therefore, the current dataset is not directly comparable with the historical 2020 – February 2024 dataset.

### 2. Incomplete Reporting Period

September 2026 is approximately 92% of recent monthly reporting levels and may still be slightly undercounted.

### 3. Clearance Cohort

Clearance statistics only include cases at least 180 days old as of October 12, 2026.

### 4. Time-of-Day Reliability

Hourly crime analysis is excluded because the source contains default time entries that cannot reliably be distinguished from actual occurrence times.

### 5. Victim Demographics

Victim descent counts represent recorded victim counts, not population-adjusted crime rates. They also do not describe offender demographics.

### 6. Homelessness-Related Flags

Homeless suspect and arrestee flags describe the people involved in recorded incidents. They should not be interpreted as explanations or causes of crime.

---

## Legacy Pipeline

The original LAPD dataset covering **2020 – February 2024** is maintained as a separate, frozen pipeline.

| Component | Location |
|---|---|
| Transformation Script | `src/transform.py` |
| Processed Outputs | `data/processed/lapd/` |
| Documentation | `docs/CONTEXT.md` |
| Archived Branch | `LAPD/archived` |

The legacy pipeline is preserved for historical reference and is not combined with the current NIBRS analysis.

---

## Project Documentation

Additional technical documentation is available in the repository:

| File | Description |
|---|---|
| [TASK.md](TASK.md) | Dashboard development checklist and remaining implementation tasks. |
| [docs/CONTEXT_NIBRS.md](docs/CONTEXT_NIBRS.md) | NIBRS processing specifications, mappings, implementation steps, and output contract. |
| [docs/CONTEXT.md](docs/CONTEXT.md) | Documentation for the historical LAPD processing pipeline. |
| [CLAUDE.md](CLAUDE.md) | Development guidelines and working rules for the data pipelines. |
| [requirements.txt](requirements.txt) | Python dependencies. |

---

**Project:** LAPD Crime Dashboard  
**Data Source:** Los Angeles Police Department (LAPD)  
**Current Dataset:** NIBRS, April 2024 – September 2026  
**Data Snapshot:** October 12, 2026  
**Visualization Library:** D3.js v7  
**Deployment:** GitHub Pages
