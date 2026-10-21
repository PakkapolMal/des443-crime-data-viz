# ============================================================
# LA Crime 2020-2024 -> cleaned frame -> D3-ready JSON files
# Run each "# %%" block as a separate Colab cell.
# ============================================================

# %% 1. Load (only needed columns, compact dtypes)
import pandas as pd
import numpy as np
import json, os

PATH = "/content/Crime_Data_from_2020_to_2024.csv"   # change to your file
OUT  = "/content/d3_data"
os.makedirs(OUT, exist_ok=True)

cols = ["DR_NO", "Date Rptd", "DATE OCC", "TIME OCC", "AREA NAME",
        "Crm Cd Desc", "Vict Age", "Vict Sex", "Vict Descent",
        "Premis Desc", "Weapon Desc", "Status Desc", "LAT", "LON"]
# DR_NO added: needed for de-duplication. Drop it after step 2 if you want.

cat_cols = ["AREA NAME", "Crm Cd Desc", "Vict Sex", "Vict Descent",
            "Premis Desc", "Weapon Desc", "Status Desc"]

df = pd.read_csv(PATH, usecols=cols,
                 dtype={c: "category" for c in cat_cols} | {"TIME OCC": "Int16"})
print(df.shape)
print(df.memory_usage(deep=True).sum() / 1e6, "MB")


# %% 2. Dedupe + parse dates/times
df = df.drop_duplicates(subset="DR_NO")

def parse_dates(s: pd.Series) -> pd.Series:
    """Handles both export formats: '2021 Apr 11 12:00:00 AM' and '04/11/2021 12:00:00 AM'."""
    out = pd.to_datetime(s, format="%Y %b %d %I:%M:%S %p", errors="coerce")
    miss = out.isna() & s.notna()
    if miss.any():
        out[miss] = pd.to_datetime(s[miss], format="%m/%d/%Y %I:%M:%S %p", errors="coerce")
    return out.dt.normalize()          # the 12:00 AM part is meaningless

df["date_occ"]  = parse_dates(df["DATE OCC"])
df["date_rptd"] = parse_dates(df["Date Rptd"])

# TIME OCC is an int in HHMM (845 -> 08:45)
t = df["TIME OCC"].fillna(0).astype(int)
df["hour"]   = (t // 100).clip(0, 23).astype("int8")
df["minute"] = (t % 100).clip(0, 59).astype("int8")
df["dt_occ"] = df["date_occ"] + pd.to_timedelta(df["hour"], "h") + pd.to_timedelta(df["minute"], "m")

df["year"]      = df["date_occ"].dt.year.astype("Int16")
df["month"]     = df["date_occ"].dt.to_period("M").astype(str)       # '2022-07'
df["dow"]       = df["date_occ"].dt.dayofweek.astype("int8")         # 0=Mon
df["report_lag_days"] = (df["date_rptd"] - df["date_occ"]).dt.days

# Sanity: occurrence must be in range and not after report date
df = df[(df["date_occ"] >= "2020-01-01") & (df["date_occ"] <= "2024-12-31")]
df = df[df["report_lag_days"] >= 0]


# %% 3. Clean categorical fields
# Victim age: <=0 means no individual victim (business, vehicle, the state)
df["Vict Age"] = pd.to_numeric(df["Vict Age"], errors="coerce")
df["has_person_victim"] = df["Vict Age"].between(1, 100)
df.loc[~df["has_person_victim"], "Vict Age"] = np.nan
df["age_group"] = pd.cut(df["Vict Age"], bins=[0, 17, 24, 34, 44, 54, 64, 100],
                         labels=["0-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"])

sex_map = {"M": "Male", "F": "Female", "X": "Unknown"}
df["vict_sex"] = df["Vict Sex"].astype(str).map(sex_map).fillna("Unknown")

descent_map = {
    "H": "Hispanic/Latin", "W": "White", "B": "Black", "A": "Other Asian",
    "C": "Chinese", "D": "Cambodian", "F": "Filipino", "G": "Guamanian",
    "I": "American Indian/Alaskan Native", "J": "Japanese", "K": "Korean",
    "L": "Laotian", "O": "Other", "P": "Pacific Islander", "S": "Samoan",
    "U": "Hawaiian", "V": "Vietnamese", "Z": "Asian Indian", "X": "Unknown",
}
df["vict_descent"] = df["Vict Descent"].astype(str).map(descent_map).fillna("Unknown")
# Collapse small Asian sub-groups for readable charts (keep raw column for detail)
asian = {"Other Asian", "Chinese", "Cambodian", "Filipino", "Japanese", "Korean",
         "Laotian", "Vietnamese", "Asian Indian"}
df["descent_group"] = np.where(df["vict_descent"].isin(asian), "Asian", df["vict_descent"])
df.loc[df["descent_group"].isin({"Guamanian", "Samoan", "Hawaiian", "Pacific Islander"}),
       "descent_group"] = "Pacific Islander"

def to_label(s, fill):
    """Category/str -> plain str with NaN filled (works on pandas 2.x and 3.x)."""
    return s.astype("object").where(s.notna(), fill).astype(str)

# Weapon: NaN = no weapon recorded, not "missing data"
df["weapon"] = to_label(df["Weapon Desc"], "No weapon recorded")
df["weapon_used"] = df["weapon"] != "No weapon recorded"

# Status -> outcome
status_map = {"Adult Arrest": "Arrest", "Juv Arrest": "Arrest",
              "Adult Other": "Cleared (no arrest)", "Juv Other": "Cleared (no arrest)",
              "Invest Cont": "Open", "UNK": "Unknown"}
df["outcome"] = df["Status Desc"].astype(str).map(status_map).fillna("Unknown")
df["is_arrest"] = df["outcome"] == "Arrest"

df["premise"] = to_label(df["Premis Desc"], "Unknown")
df["area"] = to_label(df["AREA NAME"], "Unknown")
df["crime"] = to_label(df["Crm Cd Desc"], "Unknown")


# %% 4. Crime category (≈140 descriptions -> ~10 groups). ORDER MATTERS.
rules = [
    ("Homicide",        r"HOMICIDE|MANSLAUGHTER"),
    ("Sexual Offense",  r"RAPE|SEX|SODOMY|ORAL COPULATION|LEWD|INDECENT|PIMPING|PANDERING|HUMAN TRAFFICKING"),
    ("Robbery",         r"ROBBERY"),
    ("Assault",         r"ASSAULT|BATTERY|SHOTS FIRED|BRANDISH|CRIMINAL THREATS|KIDNAPPING|INTIMATE PARTNER"),
    ("Burglary",        r"BURGLARY"),
    ("Vehicle Theft",   r"VEHICLE - STOLEN|VEHICLE, STOLEN|STOLEN VEHICLE"),
    ("Fraud/Identity",  r"IDENTITY|FRAUD|FORGERY|COUNTERFEIT|EMBEZZLEMENT|BUNCO|DOCUMENT WORTHLESS|CREDIT CARD"),
    ("Theft",           r"THEFT|STOLEN|SHOPLIFTING|PICKPOCKET|PURSE SNATCHING|TILL TAP"),
    ("Vandalism/Arson", r"VANDALISM|ARSON"),
    ("Crimes vs Child", r"CHILD|CHLD"),
]
import re
cat_lookup = {d: next((name for name, pat in rules if re.search(pat, d)), "Other")
              for d in df["crime"].unique()}
df["crime_cat"] = df["crime"].map(cat_lookup)
df["is_violent"] = df["crime_cat"].isin({"Homicide", "Sexual Offense", "Robbery", "Assault"})

# Review what landed in "Other" and move anything important into a rule
print(df.loc[df["crime_cat"] == "Other", "crime"].value_counts().head(25))


# %% 5. Data-quality checks you should LOOK at before charting
# (a) NIBRS cut-over: LAPD switched systems on 2024-03-07 -> this dataset thins out after it
monthly_total = df.groupby("month").size()
print(monthly_total.tail(15))

# (b) Time rounding artifacts: 12:00 and 00:01 are default entries
print(df["TIME OCC"].value_counts().head(5))

# (c) Missing coordinates are stored as 0,0
print("zero coords:", ((df["LAT"] == 0) | (df["LON"] == 0)).sum())

# Analysis window for TREND charts (everything else can use full data, but label it)
TREND_END = "2024-02"
trend = df[df["month"] <= TREND_END]


# %% 6. Export helpers
def dump(obj, name):
    path = f"{OUT}/{name}.json"
    if isinstance(obj, pd.DataFrame):
        obj = obj.to_dict(orient="records")
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"), default=str)
    print(f"{name}: {os.path.getsize(path)/1024:.1f} KB")

TOP_CATS = df["crime_cat"].value_counts().index.tolist()


# %% 7. Aggregations -> one file per chart
# 7.1 KPI cards
kpi = {
    "total_incidents": int(len(df)),
    "date_min": str(df["date_occ"].min().date()),
    "date_max": str(df["date_occ"].max().date()),
    "violent_share": round(df["is_violent"].mean(), 4),
    "arrest_rate": round(df["is_arrest"].mean(), 4),
    "weapon_share": round(df["weapon_used"].mean(), 4),
    "median_report_lag_days": float(df["report_lag_days"].median()),
    "trend_end": TREND_END,
}
dump(kpi, "kpi")

# 7.2 Monthly trend by category (line / stacked area)
dump(trend.groupby(["month", "crime_cat"]).size().reset_index(name="count"), "monthly_by_cat")

# 7.3 Hour x weekday heatmap (overall + per category for a dropdown)
heat = df.groupby(["crime_cat", "dow", "hour"]).size().reset_index(name="count")
heat_all = df.groupby(["dow", "hour"]).size().reset_index(name="count").assign(crime_cat="All")
dump(pd.concat([heat_all, heat]), "heatmap_dow_hour")

# 7.4 Area summary (bar chart / small multiples / scatter)
area = (df.groupby("area")
          .agg(total=("DR_NO", "size"),
               violent_share=("is_violent", "mean"),
               arrest_rate=("is_arrest", "mean"),
               weapon_share=("weapon_used", "mean"),
               lat=("LAT", lambda s: s[s != 0].median()),
               lon=("LON", lambda s: s[s != 0].median()))
          .reset_index().round(4).sort_values("total", ascending=False))
dump(area, "area_summary")

# 7.5 Area x category matrix (heatmap or stacked bar)
dump(df.groupby(["area", "crime_cat"]).size().reset_index(name="count"), "area_by_cat")

# 7.6 Top 15 crime descriptions
dump(df["crime"].value_counts().head(15).rename_axis("crime").reset_index(name="count"), "top_crimes")

# 7.7 Victim profile: age group x sex (population pyramid), person-victim crimes only
pv = df[df["has_person_victim"]]
dump(pv.groupby(["age_group", "vict_sex"], observed=True).size().reset_index(name="count"), "victim_age_sex")
dump(pv.groupby(["descent_group", "crime_cat"]).size().reset_index(name="count"), "victim_descent_by_cat")

# 7.8 Premises (top 15) split violent / non-violent
top_prem = df["premise"].value_counts().head(15).index
dump(df[df["premise"].isin(top_prem)]
       .groupby(["premise", "is_violent"]).size().reset_index(name="count"), "premise_top")

# 7.9 Weapons (violent crimes only; top 12)
vw = df[df["is_violent"] & df["weapon_used"]]
dump(vw["weapon"].value_counts().head(12).rename_axis("weapon").reset_index(name="count"), "weapons_top")

# 7.10 Outcome by category (100% stacked bar)
dump(df.groupby(["crime_cat", "outcome"]).size().reset_index(name="count"), "outcome_by_cat")

# 7.11 Reporting lag by category (box plot stats, not raw rows)
lag = (df.groupby("crime_cat")["report_lag_days"]
         .describe(percentiles=[.25, .5, .75, .9])
         .reset_index()[["crime_cat", "25%", "50%", "75%", "90%", "mean", "count"]]
         .rename(columns={"25%": "q1", "50%": "median", "75%": "q3", "90%": "p90"}))
dump(lag.round(1), "report_lag_by_cat")


# %% 8. Geo: pre-binned grid (fast) + small point sample (dot map / tooltips)
geo = df[(df["LAT"] != 0) & (df["LON"] != 0)].copy()
STEP = 0.005                                         # ~500 m cells
geo["glat"] = (geo["LAT"] / STEP).round() * STEP
geo["glon"] = (geo["LON"] / STEP).round() * STEP
grid = (geo.groupby(["glat", "glon", "crime_cat"]).size()
           .reset_index(name="count").round({"glat": 4, "glon": 4}))
dump(grid, "geo_grid")

sample = geo.sample(n=min(20_000, len(geo)), random_state=42)[
    ["LAT", "LON", "crime_cat", "area", "hour", "year"]]
dump(sample.round({"LAT": 4, "LON": 4}), "geo_sample")


# %% 9. OPTIONAL: slim fact table for client-side cross-filtering (crossfilter.js)
# Integer-encode categoricals; ship dictionaries separately. Expect ~15-25 MB CSV.
fact = df[["area", "crime_cat", "month", "hour", "dow", "vict_sex", "age_group",
           "outcome", "is_violent", "weapon_used"]].copy()
dicts = {}
for c in ["area", "crime_cat", "month", "vict_sex", "age_group", "outcome"]:
    codes, uniques = pd.factorize(fact[c].astype(str))
    fact[c] = codes.astype("int16")
    dicts[c] = uniques.tolist()
fact[["is_violent", "weapon_used"]] = fact[["is_violent", "weapon_used"]].astype("int8")
fact.to_csv(f"{OUT}/fact_slim.csv.gz", index=False, compression="gzip")
dump(dicts, "fact_dicts")


# %% 10. Download everything
import shutil
shutil.make_archive("/content/d3_data", "zip", OUT)
try:
    from google.colab import files
    files.download("/content/d3_data.zip")
except ImportError:
    print("Not in Colab; zip saved at /content/d3_data.zip")
