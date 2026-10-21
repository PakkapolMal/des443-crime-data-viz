# CONTEXT — LA Crime Data Transformation for a D3.js Dashboard

## Goal
Clean the LAPD crime dataset (about 1M rows) with Python/pandas on a local PC, then export small pre-aggregated JSON files. A D3.js dashboard loads those files with `d3.json()`. The browser never sees the raw 1M rows.

## Source
- **Dataset:** LAPD *Crime Data from 2020 to 2024* — https://data.lacity.org/Public-Safety/Crime-Data-from-2020-to-2024/2nrs-mtv8/about_data
- **Local file:** `data/raw/crime_dataset.csv` (28 columns; one row per crime report)
- **Reference implementation:** `la_crime_transform.py`, a Colab version tested on a 10-row sample. Port its logic and drop the Colab-specific parts (`/content/` paths, `google.colab.files`).

## Columns used
```python
cols = ["DR_NO", "Date Rptd", "DATE OCC", "TIME OCC", "AREA NAME",
        "Crm Cd Desc", "Vict Age", "Vict Sex", "Vict Descent",
        "Premis Desc", "Weapon Desc", "Status Desc", "LAT", "LON"]
```
`DR_NO` is the unique report ID and is used only for de-duplication. `Part 1-2` (LAPD severity: 1 = serious, 2 = less serious) is optional. If it gets added, keep it alongside the regex categories as a cross-check.

## Known data issues (must handle)
| # | Issue | Handling |
|---|---|---|
| 1 | **NIBRS cut-over.** LAPD switched records systems on **2024-03-07**. After that date this dataset gets few or no new records, so 2024 looks like a crime collapse when it isn't one. | Time-series outputs stop at `TREND_END = "2024-02"`. Non-trend outputs use the full data, and `kpi.json` states the cut-off. |
| 2 | **Date format.** This export uses `2021 Apr 11 12:00:00 AM`. The API CSV uses `04/11/2021 12:00:00 AM`. The time portion is always midnight and carries no information. | Parse with `%Y %b %d %I:%M:%S %p` and fall back to `%m/%d/%Y %I:%M:%S %p`. Normalize to date only. |
| 3 | **`TIME OCC` is an HHMM integer.** `845` means 08:45. Expect default-entry spikes at `1200` and `1`. | `hour = t // 100`, `minute = t % 100`. Report the spike sizes in the validation log. |
| 4 | **`Vict Age` ≤ 0** means there is no person victim (a business, a vehicle, the state). | Set a `has_person_victim` flag and treat age as NaN for those rows. Victim charts use person-victim rows only. |
| 5 | **A null `Weapon Desc`** means no weapon was recorded. It isn't missing data. | Fill with `"No weapon recorded"`. Do not drop these rows. |
| 6 | **Missing coordinates** are stored as `(0, 0)`. | Exclude them from geo outputs only. |
| 7 | **About 140 crime descriptions.** Too many to chart. | Map them to about 10 categories with ordered regex rules (see below). Log what falls into `Other`. |
| 8 | **Data quality.** Records are transcribed from paper reports, so there are typos and impossible dates. | Keep only rows with `DATE OCC` between 2020-01-01 and 2024-12-31 and `report_lag_days >= 0`. Log how many rows each filter drops. |
| 9 | **pandas 3.x.** `category.astype(str)` keeps NaN instead of turning it into the string `"nan"`. | Use a `to_label(s, fill)` helper: `s.astype(object).where(s.notna(), fill).astype(str)`. |

## Code mappings
**Vict Sex:** M → Male, F → Female, X / H / - / null → Unknown

**Vict Descent:** H Hispanic/Latin, W White, B Black, A Other Asian, C Chinese, D Cambodian, F Filipino, G Guamanian, I American Indian/Alaskan Native, J Japanese, K Korean, L Laotian, O Other, P Pacific Islander, S Samoan, U Hawaiian, V Vietnamese, Z Asian Indian, X Unknown.
`descent_group` collapses these to: Hispanic/Latin, White, Black, Asian, Pacific Islander, American Indian/Alaskan Native, Other, Unknown.

**Status Desc → outcome:** Adult Arrest / Juv Arrest → `Arrest`; Adult Other / Juv Other → `Cleared (no arrest)`; Invest Cont → `Open`; UNK → `Unknown`.

**Crime category.** The rules are ordered and the first match wins:
1. Homicide — `HOMICIDE|MANSLAUGHTER`
2. Sexual Offense — `RAPE|SEX|SODOMY|ORAL COPULATION|LEWD|INDECENT|PIMPING|PANDERING|HUMAN TRAFFICKING`
3. Robbery — `ROBBERY`
4. Assault — `ASSAULT|BATTERY|SHOTS FIRED|BRANDISH|CRIMINAL THREATS|KIDNAPPING|INTIMATE PARTNER`
5. Burglary — `BURGLARY`
6. Vehicle Theft — `VEHICLE - STOLEN|VEHICLE, STOLEN|STOLEN VEHICLE`
7. Fraud/Identity — `IDENTITY|FRAUD|FORGERY|COUNTERFEIT|EMBEZZLEMENT|BUNCO|DOCUMENT WORTHLESS|CREDIT CARD`
8. Theft — `THEFT|STOLEN|SHOPLIFTING|PICKPOCKET|PURSE SNATCHING|TILL TAP`
9. Vandalism/Arson — `VANDALISM|ARSON`
10. Crimes vs Child — `CHILD|CHLD`
11. Otherwise → Other

`is_violent` = Homicide, Sexual Offense, Robbery, or Assault.

## Derived fields
`date_occ`, `date_rptd`, `hour`, `minute`, `dow` (0 = Mon), `year`, `month` (`YYYY-MM`), `report_lag_days`, `has_person_victim`, `age_group` (0-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+), `vict_sex`, `vict_descent`, `descent_group`, `weapon`, `weapon_used`, `premise`, `area`, `crime`, `crime_cat`, `is_violent`, `outcome`, `is_arrest`.

## Output plan → `data/processed/lapd/`
All JSON files are arrays of records, except `kpi` and `fact_dicts`, which are objects. Use compact separators.

| File | Shape (keys) | Chart |
|---|---|---|
| `kpi.json` | total_incidents, date_min, date_max, violent_share, arrest_rate, weapon_share, median_report_lag_days, trend_end | KPI cards |
| `monthly_by_cat.json` | month, crime_cat, count (≤ TREND_END) | Stacked area / multi-line |
| `heatmap_dow_hour.json` | crime_cat (incl. `All`), dow, hour, count | 7×24 heatmap with category dropdown |
| `area_summary.json` | area, total, violent_share, arrest_rate, weapon_share, lat, lon | Sorted bars; volume vs. arrest-rate scatter |
| `area_by_cat.json` | area, crime_cat, count | Matrix heatmap / stacked bars |
| `top_crimes.json` | crime, count (top 15) | Horizontal bars |
| `victim_age_sex.json` | age_group, vict_sex, count (person victims only) | Population pyramid |
| `victim_descent_by_cat.json` | descent_group, crime_cat, count | Stacked bars (counts, not rates) |
| `premise_top.json` | premise, is_violent, count (top 15 premises) | Grouped bars |
| `weapons_top.json` | weapon, count (violent crimes with a weapon, top 12) | Horizontal bars |
| `outcome_by_cat.json` | crime_cat, outcome, count | 100% stacked bars |
| `report_lag_by_cat.json` | crime_cat, q1, median, q3, p90, mean, count | Box plot from precomputed stats |
| `geo_grid.json` | glat, glon, crime_cat, count (0.005° ≈ 500 m cells) | Density / grid map |
| `geo_sample.json` | LAT, LON, crime_cat, area, hour, year (20k rows, seed 42) | Dot map with tooltips |
| `fact_slim.csv.gz` + `fact_dicts.json` | Integer-encoded fact table plus code dictionaries | Optional: crossfilter.js |

Size target: each JSON file under 2 MB, except `geo_sample.json`, which can go up to about 2–3 MB.

## Interpretation caveats (for the dashboard text)
- Trends end in Feb 2024 because of the NIBRS transition.
- Recent months undercount crimes that tend to be reported late, such as fraud and identity theft (see the report-lag output).
- Victim descent counts show who was victimized. They are not population rates and say nothing about offenders.
- An "Arrest" status isn't the same as a conviction. "Open" means the case was still under investigation at the time of export.

## Insight hypotheses to verify
- Reporting lag: in the 10-row sample, identity theft was reported more than 4 years after it occurred.
- Arrest rate varies by crime category.
- Violent and property crimes peak at different hours and on different days.
- An area's crime mix (violent share) differs from its ranking by raw volume.
