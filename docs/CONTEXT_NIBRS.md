# CONTEXT_NIBRS — LAPD NIBRS Offenses + Victims → D3.js Dashboard

This is separate from `CONTEXT.md`, which covers the 2020 to Feb 2024 legacy dataset. NIBRS counts aren't comparable with the legacy counts, so the two never share a chart, file or trend line.

## Sources
| Table | Landing page | Local file | Row = | Rows (Oct 2026 snapshot) |
|---|---|---|---|---|
| Offenses | https://data.lacity.org/d/k7nn-b2ep | `data/raw/nibrs_offenses.csv` | one offense (`UniqueNIBRNo` = CaseNo + NIBR Code + seq) | ~499k |
| Victims | https://data.lacity.org/d/gqf2-vm2j | `data/raw/nibrs_victims.csv` | one victim (`UniqueVictimNo` = CaseNo + seq) | ~457k |

- **Join key:** `CaseNo` (one incident).
- **Data dictionaries:** `https://data.lacity.org/api/views/<id>/columns.json`

### Columns used
```python
OFF_COLS = ["CaseNo", "UniqueNIBRNo", "Date Rptd", "Date OCC", "AREA", "AREA NAME",
            "TotalOffenseCount", "Group", "NIBR Code", "NIBR Description", "Crime Against",
            "Premise Desc", "Weapon Used Cd", "Weapon Desc", "Status Desc", "TotalVictimCount",
            "Victim Shot", "Domestic Violence Crime", "Hate Crime", "Gang-related Crime",
            "Transit-related Crime", "Homeless-Victim Crime", "Homeless-Suspect Crime",
            "Homeless-Arrestee Crime", "LOCATION", "LAT", "LON"]

VIC_COLS = ["CaseNo", "UniqueVictimNo", "Date Rptd", "Date OCC", "AREA", "AREA NAME",
            "VictimOfsList", "Vict Age", "Vict Sex", "Vict Descent", "Victim Type",
            "Victim Shot", "Status Desc"]
```
`Time OCC` is deliberately excluded (see Decisions).

---

## Decisions (fixed)
| Decision | Rule |
|---|---|
| Analysis window | `Date OCC` month from **2024-04** to **2026-09**, inclusive, for all outputs. The reasons are in `CLAUDE.md`. |
| Invalid case numbers | A `CaseNo` that contains **no digit** (for example `RFC CITATION`) is flagged `caseno_valid = False` and excluded from the incident and victim grains. Log the count and list the distinct invalid values. |
| No time-of-day analysis | `Time OCC` has unexplained spikes at `0000` and `1200`, so true times can't be told apart from default entries. No hour heatmap, no hour field in any output. |
| Grain per chart | **Incident** for volume, place, trend and outcome. **Offense** for offense-type composition. **Victim** for demographics. |
| No fan-out | Never join offenses to victims and then count. Victims get their crime type from their own `VictimOfsList`. |

---

## Step plan

### Step 1 — Load and inspect (report before transforming)
- Load each file with `usecols`, `dtype=str` for every ID and code column, and `category` for low-cardinality text.
- Print the raw date string formats (the first 5 distinct values from each date column) and the `VictimOfsList` delimiter (show 10 rows whose value contains more than one ` - ` code ending).
- **Stop and report** if a date format isn't one of those handled in Step 2, or if the multi-offense delimiter in `VictimOfsList` is unclear.

### Step 2 — Shared cleaning (both tables)
```python
DATE_FORMATS = ["ISO8601", "%m/%d/%Y %I:%M:%S %p", "%Y %b %d %I:%M:%S %p"]
# Try each format in order on the rows still unparsed; normalize to date only.

df["CaseNo"]     = df["CaseNo"].str.strip()
df["caseno_valid"] = df["CaseNo"].str.contains(r"\d", regex=True, na=False)
df["area"]       = df["AREA NAME"].str.strip()          # offenses pad names with spaces
df["area_cd"]    = pd.to_numeric(df["AREA"], errors="coerce").astype("Int8")  # "01" vs "1"
df["date_occ"], df["date_rptd"]                          # parsed, normalized
df["month"]      = df["date_occ"].dt.to_period("M").astype(str)
df["dow"]        = df["date_occ"].dt.dayofweek          # 0 = Mon
df["day1_flag"]  = df["date_occ"].dt.day == 1           # 1st-of-month default suspicion
df["report_lag_days"] = (df["date_rptd"] - df["date_occ"]).dt.days   # NaN if Date Rptd null
```
Filters, in order, logging the rows dropped by each:
1. `caseno_valid`
2. `month` between `2024-04` and `2026-09`
3. `report_lag_days >= 0` or NaN (keep rows where `Date Rptd` is null, but exclude them from the lag output)

### Step 3 — Offense grain (`offense_df`)
Parse `NIBR Description`, for example `"487(D)(1) - PC - F - Grand Theft Auto - GTA  - 240"`:
```python
NIBR_DESC_RE = r"^(?P<statute>.+?) - (?P<code_type>[A-Z]{1,5}) - (?P<severity>[A-Z]) - (?P<label>.+?)\s*-\s*(?P<code_parsed>[0-9]{2}[0-9A-Z])\s*$"
# severity: F = felony, M = misdemeanor; anything else -> "Other"
# nibr_code = "NIBR Code" column, falling back to code_parsed when null
# Log the parse-failure count and the top 10 unparsed values
```
Then map `nibr_code` to `category`, `is_violent_fbi`, `group` and `rank` (dicts below). Normalize `crime_against`. Map `outcome` from `Status Desc`.

Validation: the number of rows per `CaseNo` should equal `TotalOffenseCount`. Report the mismatch rate; don't fail on it.

### Step 4 — Incident grain (`incident_df`, one row per valid `CaseNo`)
- **Primary offense:** the row with the lowest `rank` (most serious). Ties go to the lowest `UniqueNIBRNo`. It supplies `category`, `is_violent_fbi`, `crime_against`, `outcome`, `premise`.
- **Case-level fields** (first non-null value): `date_occ`, `month`, `dow`, `day1_flag`, `area`, `area_cd`, `LOCATION`, `LAT`, `LON`, `report_lag_days`.
- **Flags:** `any()` across the case's rows for each `FLAG_COLS` column, after mapping Yes to True.
- **`offense_count`:** the number of rows. **`categories`:** the sorted unique set of categories, used for co-occurrence.
- **`weapon_class`:** the most dangerous class across all weapon codes in the case (see the weapon section).
- **`clearance_cohort`:** `date_occ <= snapshot_date - 180 days`, where `snapshot_date = max(date_rptd)`.

### Step 5 — Victim grain (`victim_df`)
- Keep rows with a valid `CaseNo` that fall inside the window.
- Get crime codes from `VictimOfsList` by extracting every trailing NIBR code (` - XXX` at the end of each listed offense). Keep the most serious code by `rank`, then map it to `category`.
- Normalize `victim_type`, `vict_sex`, `descent_group` and `age_group` (dicts below).
- `is_individual = victim_type in {"Person", "Law Enforcement Officer"}`. All demographic outputs use individuals only.

### Step 6 — Aggregate and export
Export to `data/processed/nibrs/`. See the output contract below.

### Step 7 — Validate
Run `src/validate_nibrs.py`. The checks are listed in `CLAUDE.md` under the NIBRS section.

---

## Mapping dicts

### NIBR code → category
```python
NIBR_CATEGORY = {
    # Person
    "09A": "Homicide", "09B": "Homicide", "09C": "Other",   # 09C justifiable: not a crime
    "100": "Kidnapping",
    "11A": "Sexual Offense", "11B": "Sexual Offense", "11C": "Sexual Offense", "11D": "Sexual Offense",
    "36A": "Sexual Offense", "36B": "Sexual Offense",
    "64A": "Human Trafficking", "64B": "Human Trafficking",
    "13A": "Serious Assault",
    "13B": "Minor Assault", "13C": "Minor Assault",
    # Property
    "120": "Robbery",
    "220": "Burglary",
    **{f"23{c}": "Theft" for c in "ABCDEFGH"},
    "240": "Car Theft",
    "250": "Fraud", "270": "Fraud",
    **{f"26{c}": "Fraud" for c in "ABCDEFGH"},
    "200": "Vandalism", "290": "Vandalism",
    "210": "Other", "280": "Other", "510": "Other",
    # Society
    "35A": "Drugs", "35B": "Drugs",
    "520": "Weapons",
    "370": "Other", "720": "Other",
    **{f"39{c}": "Other" for c in "ABCD"},
    **{f"40{c}": "Other" for c in "ABC"},
    # Group B
    **{f"90{c}": "Violations" for c in "ABCDEFGHIJZ"},
}
# Unmapped code -> "Unmapped" (log it; it must not be silently absorbed)

FBI_VIOLENT_CODES = {"09A", "09B", "11A", "11B", "11C", "11D", "120", "13A"}

CATEGORY_RANK = [            # 1 = most serious; used to pick the primary offense
    "Homicide", "Sexual Offense", "Human Trafficking", "Kidnapping", "Robbery",
    "Serious Assault", "Burglary", "Car Theft", "Vandalism",
    "Theft", "Fraud", "Minor Assault",
    "Weapons", "Drugs", "Other", "Violations", "Unmapped",
]
# rank = CATEGORY_RANK.index(category) + 1
```

### Crime Against
```python
CRIME_AGAINST = {"Person": "Person", "Property": "Property", "Society": "Society"}
# "Person, Property, Society" and null -> "Unspecified"
```

### Status → outcome
```python
STATUS_OUTCOME = {
    "Open": "Open", "Investigation Continued": "Open",
    "City Attorney Review": "Under Review", "District Attorney Review": "Under Review",
    "Cleared by Arrest": "Cleared by Arrest",
    "Cleared by Arrest - DA Filed": "Cleared by Arrest",
    "Cleared by Arrest - CA Filed": "Cleared by Arrest",
    "Cleared by Arrest - CA Hearing": "Cleared by Arrest",
    "Cleared Other": "Cleared Other",
    "Cleared Other - Exceptional": "Cleared Other",
    "Cleared Other - DA Reject": "Cleared Other",
    "Cleared Other - CA Reject": "Cleared Other",
    "Unfounded": "Not a Crime", "Non-Crime/Other": "Not a Crime",
}
# null -> "Unknown". "Not a Crime" rows are excluded from all crime counts (log the count).

PROSECUTION_STAGE = {        # used by the funnel only
    "Cleared by Arrest - DA Filed": "Filed", "Cleared by Arrest - CA Filed": "Filed",
    "Cleared by Arrest - CA Hearing": "Filed",
    "Cleared Other - DA Reject": "Rejected", "Cleared Other - CA Reject": "Rejected",
}
```

### Weapon → weapon_class
`Weapon Desc` itself contains commas (for example "Firearm (unknown whether handgun, rifle, or shotgun)"), so **split on `Weapon Used Cd`, not on the description.**
```python
# 1. Build CODE_TO_DESC from rows whose Weapon Used Cd has no comma. A code carries several
#    descriptions (06 = Kitchen Knife, Screwdriver, Axe, ...), so map each code to its most frequent one.
# 2. Split multi-value codes on r",\s*" and map each code through CODE_TO_DESC
# 3. Classify each description:
WEAPON_RULES = [  # first match wins; test against the lowercased description
    ("Other",        r"\bbb\b|pellet|air gun|toy|replica|simulat|fake|imitation"),   # before Firearm; \b keeps "stabbing" out
    ("Firearm",      r"handgun|rifle|shotgun|firearm|revolver|pistol|semi-auto|automatic|machine gun|assault weapon"),
    ("Knife",        r"knife|blade|cutting|stabbing|dagger|machete|razor|sword|ice pick|scissors"),
    ("Bodily Force", r"bodily force"),
    ("Unknown",      r"^unknown$"),
]
# no match -> "Other"; null code -> "None"
WEAPON_SEVERITY = ["Firearm", "Knife", "Other", "Bodily Force", "Unknown", "None"]  # incident takes the first present
```

### Flags
```python
FLAG_COLS = {
    "Victim Shot": "victim_shot", "Domestic Violence Crime": "dv",
    "Hate Crime": "hate", "Gang-related Crime": "gang", "Transit-related Crime": "transit",
    "Homeless-Victim Crime": "homeless_victim", "Homeless-Suspect Crime": "homeless_suspect",
    "Homeless-Arrestee Crime": "homeless_arrestee",
}
# Value -> True if str.strip().lower() == "yes", else False
```

### Victim type
```python
def norm_victim_type(v):
    v = str(v).strip()
    v = re.sub(r"^[A-Z] - ", "", v)          # "I - Person" -> "Person", "B - Business" -> "Business"
    return {"Individual": "Person"}.get(v, v)
VICTIM_TYPES = {"Person", "Business", "Financial Institution", "Government", "Health Facility",
                "Law Enforcement Officer", "Other", "Religious Organization",
                "Society (Public)", "Unknown"}
# Anything outside VICTIM_TYPES after normalizing -> "Unmapped" (log it)
```

### Victim sex
```python
VICT_SEX = {"M": "Male", "F": "Female", "TFBM": "Transgender", "TMBF": "Transgender",
            "U": "Unknown", "N": "Unknown"}
# null or other -> "Unknown"
```

### Victim descent → descent_group
Values arrive in three styles: full names ("White/Caucasian"), single letters ("W") and prefixed ("H - Hispanic").
```python
DESCENT_LETTER = {  # legacy LAPD letter codes
    "A": "Asian", "B": "Black", "C": "Asian", "D": "Asian", "F": "Asian", "G": "Pacific Islander",
    "H": "Hispanic/Latin", "I": "American Indian/Alaskan Native", "J": "Asian", "K": "Asian",
    "L": "Asian", "O": "Other", "P": "Pacific Islander", "S": "Pacific Islander",
    "U": "Pacific Islander", "V": "Asian", "W": "White", "X": "Unknown", "Z": "Asian",
}
DESCENT_NAME = {    # keys are lowercased
    "hispanic": "Hispanic/Latin", "hispanic/latin/mexican": "Hispanic/Latin", "latino": "Hispanic/Latin",
    "white": "White", "white/caucasian": "White", "caucasian": "White",
    "black": "Black", "black/african american": "Black", "african american": "Black",
    "asian": "Asian", "other asian": "Asian", "chinese": "Asian", "korean": "Asian",
    "japanese": "Asian", "filipino": "Asian", "vietnamese": "Asian", "cambodian": "Asian",
    "laotian": "Asian", "asian indian": "Asian",
    "pacific islander": "Pacific Islander", "hawaiian": "Pacific Islander",
    "samoan": "Pacific Islander", "guamanian": "Pacific Islander",
    "american indian": "American Indian/Alaskan Native",
    "american indian/alaskan native": "American Indian/Alaskan Native",
    "middle eastern/arab": "Middle Eastern/Arab",
    "other": "Other", "unknown": "Unknown",
}
def norm_descent(v):
    if pd.isna(v): return "Unknown"
    v = str(v).strip()
    m = re.match(r"^([A-Z]) - (.+)$", v)
    if m: v = m.group(2)
    if len(v) == 1: return DESCENT_LETTER.get(v.upper(), "Unmapped")
    return DESCENT_NAME.get(v.lower(), "Unmapped")
# Log every value that maps to "Unmapped" with its count
```

### Victim age
```python
age = pd.to_numeric(df["Vict Age"], errors="coerce")
age = age.where(age.between(1, 99))
# No victims under 18 in the source (min age 18), so no 0-17 bin.
AGE_BINS   = [17, 24, 29, 34, 39, 44, 49, 54, 59, 64, 69, 74, 79, 84, 99]
AGE_LABELS = ["18-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65-69", "70-74", "75-79", "80-84", "85+"]
```

---

## Output contract → `data/processed/nibrs/`
All files are JSON arrays of records with compact separators, except `kpi.json`, which is an object. Keys are snake_case and are a contract with the D3 code.

| File | Grain | Keys | Chart |
|---|---|---|---|
| `kpi.json` | all | incidents, offenses, victims, offenses_per_incident, violent_share_fbi, clearance_arrest_rate, felony_share, weapon_share, firearm_share, dv_share, invalid_caseno_rows, not_a_crime_incidents, window_start, window_end, snapshot_date | KPI cards |
| `monthly_by_cat.json` | incident | month, category, count | Stacked area / multi-line |
| `dow_by_cat.json` | incident (`day1_flag == False`) | category, dow, count | Small-multiple bars |
| `area_summary.json` | incident | area, area_cd, total, violent_share_fbi, clearance_arrest_rate, dv_share, gang_share, transit_share, firearm_share, lat, lon | Bars; volume vs. clearance scatter |
| `area_by_cat.json` | incident | area, category, count | Matrix heatmap |
| `offense_hierarchy.json` | offense | crime_against, category, label, count (top 8 labels per category, the rest go to "Other") | Sunburst (D3 builds the hierarchy) |
| `offense_cooccurrence.json` | incident with ≥2 categories | source, target, count (unordered pairs, source < target) | Chord diagram |
| `offense_count_dist.json` | incident | offense_count (capped as "5+"), incidents | Bar |
| `top_offenses.json` | offense | label, nibr_code, severity, count (top 15) | Horizontal bars |
| `victim_type.json` | victim | victim_type, count | Bar / donut |
| `victim_age_sex.json` | victim (individuals) | age_group, vict_sex, count | Population pyramid |
| `victim_descent_by_cat.json` | victim (individuals) | descent_group, category, count | Stacked bars (counts, not rates) |
| `weapon_class.json` | incident | category, weapon_class, count | Stacked bars |
| `outcome_by_cat.json` | incident (cohort) | category, outcome, count | 100% stacked bars |
| `outcome_funnel.json` | incident (cohort) | stage, count. Stages: reported → cleared (arrest or other) → cleared by arrest → filed; plus rejected | Funnel |
| `flags_by_area.json` | incident | area, flag, count, share | Small multiples |
| `flags_monthly.json` | incident | month, flag, count | Multi-line |
| `report_lag_by_cat.json` | offense | category, q1, median, q3, p90, mean, count | Box plot from stats |
| `top_locations.json` | incident | location, area, count, top_category (top 25) | Table |
| `geo_grid.json` | incident | glat, glon, category, count (0.01° ≈ 1 km cells) | Density map |
| `geo_sample.json` | incident | lat, lon, category, area, month (20k rows, seed 42) | Dot map with tooltips |

Rules shared by all outputs: exclude "Not a Crime" incidents; drop zero or null coordinates from geo outputs only; use cohort-only rows for clearance and funnel outputs.

---

## Dashboard caveats (show these on screen)
- NIBRS counts offenses individually, so these figures aren't comparable with the 2020 to Feb 2024 dataset.
- The window is Apr 2024 to Sep 2026. September 2026 may still be slightly undercounted because of late reports.
- Clearance figures cover only cases at least 180 days old as of the snapshot date. Newer cases haven't had time to clear.
- Time of day isn't shown because the source contains default time entries that can't be told apart from real times.
- Victim descent counts are not population rates and say nothing about offenders.
- Homeless suspect and arrestee flags describe the people involved. They don't explain causes.

## Insight hypotheses (verify after cleaning)
- About a fifth of offense rows come from multi-offense incidents. Which categories co-occur (chord diagram)?
- Most cases stay "Open" or "Investigation Continued". Where does the arrest → filed funnel narrow?
- DV share varies by area more than total volume does.
- Hundred-block hotspots are highly concentrated (for example, 600 S Alvarado St).
- Businesses are a large victim type (about 62k victim rows), which the legacy dataset hid behind age = 0.
