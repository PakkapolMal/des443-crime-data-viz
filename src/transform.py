"""LA crime CSV -> cleaned frame -> small D3-ready JSON files. See CONTEXT.md."""
import argparse
import json
import logging
import re
from pathlib import Path

import numpy as np
import pandas as pd

log = logging.getLogger("transform")

COLS = ["DR_NO", "Date Rptd", "DATE OCC", "TIME OCC", "AREA NAME",
        "Crm Cd Desc", "Vict Age", "Vict Sex", "Vict Descent",
        "Premis Desc", "Weapon Desc", "Status Desc", "LAT", "LON"]
CAT_COLS = ["Date Rptd", "DATE OCC", "AREA NAME", "Crm Cd Desc", "Vict Sex",
            "Vict Descent", "Premis Desc", "Weapon Desc", "Status Desc"]

SEX_MAP = {"M": "Male", "F": "Female"}  # X / H / - / null -> Unknown
DESCENT_MAP = {
    "H": "Hispanic/Latin", "W": "White", "B": "Black", "A": "Other Asian",
    "C": "Chinese", "D": "Cambodian", "F": "Filipino", "G": "Guamanian",
    "I": "American Indian/Alaskan Native", "J": "Japanese", "K": "Korean",
    "L": "Laotian", "O": "Other", "P": "Pacific Islander", "S": "Samoan",
    "U": "Hawaiian", "V": "Vietnamese", "Z": "Asian Indian", "X": "Unknown",
}
DESCENT_GROUP = {d: "Asian" for d in ["Other Asian", "Chinese", "Cambodian", "Filipino",
                                       "Japanese", "Korean", "Laotian", "Vietnamese", "Asian Indian"]}
DESCENT_GROUP |= {d: "Pacific Islander" for d in ["Guamanian", "Samoan", "Hawaiian", "Pacific Islander"]}
STATUS_MAP = {"Adult Arrest": "Arrest", "Juv Arrest": "Arrest",
              "Adult Other": "Cleared (no arrest)", "Juv Other": "Cleared (no arrest)",
              "Invest Cont": "Open", "UNK": "Unknown"}
RULES = [  # ordered, first match wins
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
VIOLENT = {"Homicide", "Sexual Offense", "Robbery", "Assault"}
NO_WEAPON = "No weapon recorded"
AGE_BINS = [0, 17, 24, 34, 44, 54, 64, np.inf]
AGE_LABELS = ["0-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
GRID_STEP = 0.005  # ~500 m
SEED = 42


def to_label(s, fill):
    """Category/str -> plain str with NaN filled (pandas 2.x and 3.x)."""
    return s.astype(object).where(s.notna(), fill).astype(str)


def parse_dates(s):
    """Parse a categorical date column on its unique values only; date part only."""
    cats = pd.Series(s.cat.categories)
    out = pd.to_datetime(cats, format="%Y %b %d %I:%M:%S %p", errors="coerce")
    miss = out.isna()
    if miss.any():
        out[miss] = pd.to_datetime(cats[miss], format="%m/%d/%Y %I:%M:%S %p", errors="coerce")
    if out.isna().any():
        raise ValueError(f"Unparseable dates, e.g. {cats[out.isna()].head(3).tolist()}")
    codes = s.cat.codes.to_numpy()
    vals = out.dt.normalize().to_numpy()[codes]
    vals[codes == -1] = np.datetime64("NaT")
    return pd.Series(vals, index=s.index)


def load(path):
    df = pd.read_csv(path, usecols=COLS,
                     dtype={c: "category" for c in CAT_COLS} | {"TIME OCC": "Int16"})
    log.info("loaded %d rows, %.0f MB", len(df), df.memory_usage(deep=True).sum() / 1e6)
    return df


def _filter(df, mask, name):
    out = df[mask]
    log.info("filter %-28s kept %8d  dropped %7d", name, len(out), len(df) - len(out))
    return out


def clean(df):
    df = _filter(df, ~df["DR_NO"].duplicated(), "dedupe DR_NO")
    df = df.assign(date_occ=parse_dates(df["DATE OCC"]), date_rptd=parse_dates(df["Date Rptd"]))
    df = _filter(df, df["date_occ"].between("2020-01-01", "2024-12-31"), "date_occ in 2020..2024")
    lag = (df["date_rptd"] - df["date_occ"]).dt.days
    df = _filter(df.assign(report_lag_days=lag), lag >= 0, "report_lag_days >= 0")
    return df.copy()


def derive(df):
    t = df["TIME OCC"].fillna(0).astype(int)
    df["hour"] = (t // 100).clip(0, 23).astype("int8")
    df["minute"] = (t % 100).clip(0, 59).astype("int8")
    df["dow"] = df["date_occ"].dt.dayofweek.astype("int8")
    df["year"] = df["date_occ"].dt.year.astype("int16")
    df["month"] = df["date_occ"].dt.strftime("%Y-%m")

    age = pd.to_numeric(df["Vict Age"], errors="coerce")
    df["has_person_victim"] = age > 0
    df["Vict Age"] = age.where(df["has_person_victim"])
    df["age_group"] = pd.cut(df["Vict Age"], bins=AGE_BINS, labels=AGE_LABELS)

    df["vict_sex"] = to_label(df["Vict Sex"], "").map(SEX_MAP).fillna("Unknown")
    df["vict_descent"] = to_label(df["Vict Descent"], "").map(DESCENT_MAP).fillna("Unknown")
    df["descent_group"] = df["vict_descent"].map(DESCENT_GROUP).fillna(df["vict_descent"])

    df["weapon"] = to_label(df["Weapon Desc"], NO_WEAPON)
    df["weapon_used"] = df["weapon"] != NO_WEAPON
    df["outcome"] = to_label(df["Status Desc"], "").map(STATUS_MAP).fillna("Unknown")
    df["is_arrest"] = df["outcome"] == "Arrest"
    df["premise"] = to_label(df["Premis Desc"], "Unknown")
    df["area"] = to_label(df["AREA NAME"], "Unknown")
    df["crime"] = to_label(df["Crm Cd Desc"], "Unknown")

    lookup = {d: next((n for n, p in RULES if re.search(p, d)), "Other") for d in df["crime"].unique()}
    df["crime_cat"] = df["crime"].map(lookup)
    df["is_violent"] = df["crime_cat"].isin(VIOLENT)
    return df


def log_quality(df, trend_end):
    log.info("top 'Other' descriptions:\n%s",
             df.loc[df["crime_cat"] == "Other", "crime"].value_counts().head(25).to_string())
    tc = df["TIME OCC"].value_counts()
    log.info("TIME OCC spikes: 1200=%d, 1=%d (median count per value %d)",
             tc.get(1200, 0), tc.get(1, 0), tc.median())
    log.info("zero-coordinate rows: %d", ((df["LAT"] == 0) | (df["LON"] == 0)).sum())
    log.info("monthly totals around cut-over:\n%s",
             df.groupby("month").size().loc["2023-10":].to_string())
    log.info("rows after TREND_END %s: %d", trend_end, (df["month"] > trend_end).sum())


def _count(df, keys, **kw):
    return df.groupby(keys, **kw).size().reset_index(name="count")


def _top(s, n, name):
    return s.value_counts().head(n).rename_axis(name).reset_index(name="count")


def aggregate(df, trend_end):
    out = {}
    out["kpi"] = {
        "total_incidents": int(len(df)),
        "date_min": str(df["date_occ"].min().date()),
        "date_max": str(df["date_occ"].max().date()),
        "violent_share": round(float(df["is_violent"].mean()), 4),
        "arrest_rate": round(float(df["is_arrest"].mean()), 4),
        "weapon_share": round(float(df["weapon_used"].mean()), 4),
        "median_report_lag_days": float(df["report_lag_days"].median()),
        "trend_end": trend_end,
    }
    out["monthly_by_cat"] = _count(df[df["month"] <= trend_end], ["month", "crime_cat"])
    out["heatmap_dow_hour"] = pd.concat([
        _count(df, ["dow", "hour"]).assign(crime_cat="All"),
        _count(df, ["crime_cat", "dow", "hour"]),
    ])[["crime_cat", "dow", "hour", "count"]]

    geo = df[(df["LAT"] != 0) & (df["LON"] != 0)]
    centroid = geo.groupby("area")[["LAT", "LON"]].median().rename(columns=str.lower)
    out["area_summary"] = (df.groupby("area")
                             .agg(total=("area", "size"), violent_share=("is_violent", "mean"),
                                  arrest_rate=("is_arrest", "mean"), weapon_share=("weapon_used", "mean"))
                             .join(centroid).round(4).sort_values("total", ascending=False).reset_index())
    out["area_by_cat"] = _count(df, ["area", "crime_cat"])
    out["top_crimes"] = _top(df["crime"], 15, "crime")

    pv = df[df["has_person_victim"]]
    out["victim_age_sex"] = _count(pv, ["age_group", "vict_sex"], observed=True)
    out["victim_age_sex"]["age_group"] = out["victim_age_sex"]["age_group"].astype(str)
    out["victim_descent_by_cat"] = _count(pv, ["descent_group", "crime_cat"])

    top_prem = df["premise"].value_counts().head(15).index
    out["premise_top"] = _count(df[df["premise"].isin(top_prem)], ["premise", "is_violent"])
    out["weapons_top"] = _top(df.loc[df["is_violent"] & df["weapon_used"], "weapon"], 12, "weapon")
    out["outcome_by_cat"] = _count(df, ["crime_cat", "outcome"])

    out["report_lag_by_cat"] = (df.groupby("crime_cat")["report_lag_days"]
                                  .describe(percentiles=[.25, .5, .75, .9])
                                  .rename(columns={"25%": "q1", "50%": "median", "75%": "q3", "90%": "p90"})
                                  [["q1", "median", "q3", "p90", "mean", "count"]]
                                  .round(1).astype({"count": int}).reset_index())

    g = geo.assign(glat=(geo["LAT"] / GRID_STEP).round() * GRID_STEP,
                   glon=(geo["LON"] / GRID_STEP).round() * GRID_STEP)
    out["geo_grid"] = _count(g, ["glat", "glon", "crime_cat"]).round({"glat": 4, "glon": 4})
    out["geo_sample"] = (geo.sample(n=min(20_000, len(geo)), random_state=SEED)
                            [["LAT", "LON", "crime_cat", "area", "hour", "year"]]
                            .round({"LAT": 4, "LON": 4}))
    return out


def export(out, df, outdir):
    outdir.mkdir(parents=True, exist_ok=True)

    def dump(obj, name):
        if isinstance(obj, pd.DataFrame):
            obj = obj.to_dict(orient="records")
        p = outdir / f"{name}.json"
        p.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
        log.info("%-24s %8.1f KB", p.name, p.stat().st_size / 1024)

    for name, obj in out.items():
        dump(obj, name)

    fact = df[["area", "crime_cat", "month", "hour", "dow", "vict_sex", "age_group",
               "outcome", "is_violent", "weapon_used"]].copy()
    dicts = {}
    for c in ["area", "crime_cat", "month", "vict_sex", "age_group", "outcome"]:
        codes, uniques = pd.factorize(to_label(fact[c], "None"), sort=True)
        fact[c] = codes.astype("int16")
        dicts[c] = uniques.tolist()
    fact[["is_violent", "weapon_used"]] = fact[["is_violent", "weapon_used"]].astype("int8")
    p = outdir / "fact_slim.csv.gz"
    fact.to_csv(p, index=False, compression={"method": "gzip", "mtime": 0})
    log.info("%-24s %8.1f KB", p.name, p.stat().st_size / 1024)
    dump(dicts, "fact_dicts")


def main():
    root = Path(__file__).resolve().parents[1]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", type=Path, default=root / "data/raw/crime_dataset.csv")
    ap.add_argument("--output", type=Path, default=root / "data/processed/lapd")
    ap.add_argument("--trend-end", default="2024-02")
    a = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    df = derive(clean(load(a.input)))
    log_quality(df, a.trend_end)
    export(aggregate(df, a.trend_end), df, a.output)


if __name__ == "__main__":
    main()
