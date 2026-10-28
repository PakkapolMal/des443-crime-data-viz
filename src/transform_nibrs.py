"""LAPD NIBRS offenses + victims -> offense/incident/victim grains -> D3-ready JSON. See docs/CONTEXT_NIBRS.md."""
import argparse
import json
import logging
import re
from pathlib import Path

import pandas as pd

log = logging.getLogger("transform_nibrs")

WINDOW_START, WINDOW_END = "2024-04", "2026-09"
CLEARANCE_DAYS = 180
UNMAPPED_MAX = 0.005
GRID_STEP = 0.01  # ~1 km; 0.005 put geo_grid.json at 2.7 MB
SEED = 42
SIZE_LIMIT = {"geo_sample.json": 3e6}  # every other file: 2 MB

OFF_COLS = ["CaseNo", "UniqueNIBRNo", "Date Rptd", "Date OCC", "AREA", "AREA NAME",
            "TotalOffenseCount", "Group", "NIBR Code", "NIBR Description", "Crime Against",
            "Premise Desc", "Weapon Used Cd", "Weapon Desc", "Status Desc", "TotalVictimCount",
            "Victim Shot", "Domestic Violence Crime", "Hate Crime", "Gang-related Crime",
            "Transit-related Crime", "Homeless-Victim Crime", "Homeless-Suspect Crime",
            "Homeless-Arrestee Crime", "LOCATION", "LAT", "LON"]
VIC_COLS = ["CaseNo", "UniqueVictimNo", "Date Rptd", "Date OCC", "AREA", "AREA NAME",
            "VictimOfsList", "Vict Age", "Vict Sex", "Vict Descent", "Victim Type",
            "Victim Shot", "Status Desc"]
# IDs and codes keep leading zeros; dates are high-cardinality (real times in offenses), so str too
STR_COLS = {"CaseNo", "UniqueNIBRNo", "UniqueVictimNo", "Date Rptd", "Date OCC", "AREA", "NIBR Code",
            "Weapon Used Cd", "TotalOffenseCount", "TotalVictimCount", "Vict Age", "LOCATION"}
NUM_COLS = {"LAT", "LON"}
DATE_FORMATS = ["ISO8601", "%m/%d/%Y %I:%M:%S %p", "%Y %b %d %I:%M:%S %p"]

NIBR_DESC_RE = (r"^(?P<statute>.+?) - (?P<code_type>[A-Z]{1,5}) - (?P<severity>[A-Z]) - "
                r"(?P<label>.+?)\s*-\s*(?P<code_parsed>[0-9]{2}[0-9A-Z])\s*$")
VIC_CODE_RE = r" - ([0-9]{2}[0-9A-Z])(?=\s*(?:,|$))"  # trailing code of each listed offense
SEVERITY = {"F": "Felony", "M": "Misdemeanor"}  # anything else -> Other

NIBR_CATEGORY = {
    "09A": "Homicide", "09B": "Homicide", "09C": "Other",
    "100": "Kidnapping",
    "11A": "Sexual Offense", "11B": "Sexual Offense", "11C": "Sexual Offense", "11D": "Sexual Offense",
    "36A": "Sexual Offense", "36B": "Sexual Offense",
    "64A": "Human Trafficking", "64B": "Human Trafficking",
    "13A": "Serious Assault",
    "13B": "Minor Assault", "13C": "Minor Assault",
    "120": "Robbery",
    "220": "Burglary",
    **{f"23{c}": "Theft" for c in "ABCDEFGH"},
    "240": "Car Theft",
    "250": "Fraud", "270": "Fraud",
    **{f"26{c}": "Fraud" for c in "ABCDEFGH"},
    "200": "Vandalism", "290": "Vandalism",
    "210": "Other", "280": "Other", "510": "Other",
    "35A": "Drugs", "35B": "Drugs",
    "520": "Weapons",
    "370": "Other", "720": "Other",
    **{f"39{c}": "Other" for c in "ABCD"},
    **{f"40{c}": "Other" for c in "ABC"},
    **{f"90{c}": "Violations" for c in "ABCDEFGHIJZ"},
}
# Statute 10851(A) VC (take vehicle without owner's consent) is car theft, but LAPD codes it
# 240/26A/270/280/90Z/23G. Override the category by statute; nibr_code keeps LAPD's code.
CAR_THEFT_STATUTE = "10851(A) - VC"
CAR_THEFT_VIC_RE = r"(10851\(A\) - VC - [^,]*?) - [0-9]{2}[0-9A-Z](?=\s*(?:,|$))"
FBI_VIOLENT_CODES = {"09A", "09B", "11A", "11B", "11C", "11D", "120", "13A"}
CATEGORY_RANK = [
    "Homicide", "Sexual Offense", "Human Trafficking", "Kidnapping", "Robbery",
    "Serious Assault", "Burglary", "Car Theft", "Vandalism",
    "Theft", "Fraud", "Minor Assault",
    "Weapons", "Drugs", "Other", "Violations", "Unmapped",
]
RANK = {c: i + 1 for i, c in enumerate(CATEGORY_RANK)}

CRIME_AGAINST = {"Person": "Person", "Property": "Property", "Society": "Society"}  # else Unspecified
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
PROSECUTION_STAGE = {
    "Cleared by Arrest - DA Filed": "Filed", "Cleared by Arrest - CA Filed": "Filed",
    "Cleared by Arrest - CA Hearing": "Filed",
    "Cleared Other - DA Reject": "Rejected", "Cleared Other - CA Reject": "Rejected",
}

WEAPON_RULES = [  # first match wins, on the lowercased description
    ("Other",        r"\bbb\b|pellet|air gun|toy|replica|simulat|fake|imitation"),
    ("Firearm",      r"handgun|rifle|shotgun|firearm|revolver|pistol|semi-auto|automatic|machine gun|assault weapon"),
    ("Knife",        r"knife|blade|cutting|stabbing|dagger|machete|razor|sword|ice pick|scissors"),
    ("Bodily Force", r"bodily force"),
    ("Unknown",      r"^unknown$"),
]
WEAPON_SEVERITY = ["Firearm", "Knife", "Other", "Bodily Force", "Unknown", "None"]

FLAG_COLS = {
    "Victim Shot": "victim_shot", "Domestic Violence Crime": "dv",
    "Hate Crime": "hate", "Gang-related Crime": "gang", "Transit-related Crime": "transit",
    "Homeless-Victim Crime": "homeless_victim", "Homeless-Suspect Crime": "homeless_suspect",
    "Homeless-Arrestee Crime": "homeless_arrestee",
}
FLAGS = list(FLAG_COLS.values())

VICTIM_TYPES = {"Person", "Business", "Financial Institution", "Government", "Health Facility",
                "Law Enforcement Officer", "Other", "Religious Organization",
                "Society (Public)", "Unknown"}
VICT_SEX = {"M": "Male", "F": "Female", "TFBM": "Transgender", "TMBF": "Transgender",
            "U": "Unknown", "N": "Unknown"}
DESCENT_LETTER = {
    "A": "Asian", "B": "Black", "C": "Asian", "D": "Asian", "F": "Asian", "G": "Pacific Islander",
    "H": "Hispanic/Latin", "I": "American Indian/Alaskan Native", "J": "Asian", "K": "Asian",
    "L": "Asian", "O": "Other", "P": "Pacific Islander", "S": "Pacific Islander",
    "U": "Pacific Islander", "V": "Asian", "W": "White", "X": "Unknown", "Z": "Asian",
}
DESCENT_NAME = {
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
# Source has no victims under 18 (min Vict Age = 18); 18-24 is the standard first adult bracket.
AGE_BINS = [17, 24, 29, 34, 39, 44, 49, 54, 59, 64, 69, 74, 79, 84, 99]
AGE_LABELS = ["18-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65-69", "70-74", "75-79", "80-84", "85+"]


# ---------- helpers ----------
def to_label(s, fill):
    """Category/str -> plain str with NaN filled (pandas 2.x and 3.x)."""
    return s.astype(object).where(s.notna(), fill).astype(str)


def on_uniques(s, f):
    """Run f (Series -> Series/DataFrame, same length) on the unique non-null values of s, broadcast back."""
    u = pd.Series(s.dropna().unique()).astype(str)
    r = f(u)
    r.index = u
    out = r.reindex(to_label(s, "\x00").to_numpy())  # nulls hit no key -> NaN
    out.index = s.index
    return out


def parse_dates(s):
    def f(u):
        out = pd.Series(pd.NaT, index=u.index, dtype="datetime64[ns]")
        for fmt in DATE_FORMATS:
            miss = out.isna()
            if not miss.any():
                break
            out[miss] = pd.to_datetime(u[miss], format=fmt, errors="coerce")
        if out.isna().any():
            raise SystemExit(f"Unhandled date format in {s.name}: {u[out.isna()].head(3).tolist()}")
        return out.dt.normalize()
    return on_uniques(s, f)


def norm_descent(v):
    m = re.match(r"^([A-Z]) - (.+)$", v.strip())
    v = m.group(2) if m else v.strip()
    if len(v) == 1:
        return DESCENT_LETTER.get(v.upper(), "Unmapped")
    return DESCENT_NAME.get(v.lower(), "Unmapped")


def classify_weapon(desc):
    d = desc.lower()
    return next((name for name, pat in WEAPON_RULES if re.search(pat, d)), "Other")


def check_unmapped(mapped, raw, what):
    bad = mapped == "Unmapped"
    log.info("unmapped %-20s %6d of %d (%.3f%%) %s", what, bad.sum(), len(mapped), 100 * bad.mean(),
             to_label(raw[bad], "<null>").value_counts().head(10).to_dict())
    if bad.mean() > UNMAPPED_MAX:
        raise SystemExit(f"{what}: {bad.mean():.2%} unmapped (> {UNMAPPED_MAX:.1%}). Review the mapping.")


def _filter(df, mask, table, reason):
    out = df[mask]
    log.info("filter %-9s %-38s kept %7d  dropped %6d", table, reason, len(out), len(df) - len(out))
    return out


def _count(df, keys, name="count"):
    return df.groupby(keys, observed=True).size().reset_index(name=name)


# ---------- pipeline ----------
def load(path, cols):
    df = pd.read_csv(path, usecols=cols, dtype={
        c: str if c in STR_COLS else "float64" if c in NUM_COLS else "category" for c in cols})
    log.info("loaded %s: %d rows, %.0f MB", Path(path).name, len(df), df.memory_usage(deep=True).sum() / 1e6)
    return df


def prep(df):
    """Shared Step 2 columns, before any filter."""
    df["CaseNo"] = df["CaseNo"].str.strip()
    df["caseno_valid"] = df["CaseNo"].str.contains(r"\d", regex=True, na=False)
    df["area"] = to_label(df["AREA NAME"], "Unknown").str.strip()
    df["area_cd"] = pd.to_numeric(df["AREA"], errors="coerce").astype("Int8")
    df["date_occ"] = parse_dates(df["Date OCC"])
    df["date_rptd"] = parse_dates(df["Date Rptd"])
    df["month"] = df["date_occ"].dt.strftime("%Y-%m")
    df["dow"] = df["date_occ"].dt.dayofweek.astype("Int8")
    df["day1_flag"] = df["date_occ"].dt.day == 1
    df["report_lag_days"] = (df["date_rptd"] - df["date_occ"]).dt.days
    return df


def clean(df, table):
    log.info("%s invalid CaseNo: %d rows %s", table, (~df["caseno_valid"]).sum(),
             df.loc[~df["caseno_valid"], "CaseNo"].value_counts().to_dict())
    df = _filter(df, df["caseno_valid"], table, "invalid CaseNo (no digit)")
    df = _filter(df, df["month"].between(WINDOW_START, WINDOW_END), table,
                 f"Date OCC outside {WINDOW_START}..{WINDOW_END}")
    lag = df["report_lag_days"]
    df = _filter(df, lag.isna() | (lag >= 0), table, "reported before occurred (lag < 0)")
    log.info("%s rows with null Date Rptd (kept, no lag): %d", table, lag.isna().sum())
    return df.copy()


def offense_grain(off):
    p = on_uniques(off["NIBR Description"], lambda u: u.str.extract(NIBR_DESC_RE))
    fail = p["statute"].isna()
    log.info("NIBR Description parse failures: %d rows; top 10: %s", fail.sum(),
             off.loc[fail, "NIBR Description"].astype(str).value_counts().head(10).to_dict())

    off["nibr_code"] = off["NIBR Code"].str.strip().fillna(p["code_parsed"])
    off["label"] = p["label"].str.strip().fillna(to_label(off["NIBR Description"], "Unknown").str.strip())
    off["severity"] = p["severity"].map(SEVERITY).fillna("Other")
    off["category"] = off["nibr_code"].map(NIBR_CATEGORY).fillna("Unmapped")
    car = to_label(off["NIBR Description"], "").str.startswith(CAR_THEFT_STATUTE)
    log.info("statute %s -> Car Theft: %d rows; from %s", CAR_THEFT_STATUTE, car.sum(),
             off.loc[car, "category"].value_counts().to_dict())
    off.loc[car, "category"] = "Car Theft"
    check_unmapped(off["category"], off["NIBR Description"], "NIBR code")
    off["rank"] = off["category"].map(RANK).astype("int8")
    off["is_violent_fbi"] = off["nibr_code"].isin(FBI_VIOLENT_CODES)
    off["crime_against"] = to_label(off["Crime Against"], "").map(CRIME_AGAINST).fillna("Unspecified")
    off["status"] = to_label(off["Status Desc"], "Unknown")
    off["outcome"] = off["status"].map(STATUS_OUTCOME).fillna("Unknown")
    off["premise"] = to_label(off["Premise Desc"], "Unknown")
    for raw, name in FLAG_COLS.items():
        off[name] = to_label(off[raw], "").str.strip().str.lower().eq("yes")

    g = off.groupby("CaseNo")
    total = pd.to_numeric(g["TotalOffenseCount"].first(), errors="coerce")
    log.info("offense rows per CaseNo != TotalOffenseCount: %.2f%% of cases", 100 * (g.size() != total).mean())
    return off


def weapon_class_by_case(off):
    """Most dangerous weapon class per CaseNo. Splits on Weapon Used Cd, never on the description."""
    codes = off["Weapon Used Cd"].str.strip()
    single = off[codes.notna() & ~codes.str.contains(",", na=False)].assign(code=codes)
    code_desc = (single.groupby(["code", "Weapon Desc"], observed=True).size()
                 .sort_values().groupby(level=0).tail(1)
                 .reset_index(level="Weapon Desc")["Weapon Desc"].astype(str))
    code_class = code_desc.map(classify_weapon)
    log.info("weapon code -> modal description -> class:\n%s",
             pd.DataFrame({"desc": code_desc, "class": code_class}).sort_index().to_string())

    ex = off[["CaseNo"]].assign(code=codes.str.split(r",\s*")).explode("code")
    cls = ex["code"].map(code_class)
    orphan = ex["code"].notna() & cls.isna()
    if orphan.any():
        log.info("weapon codes never seen alone (-> Other): %s", ex.loc[orphan, "code"].value_counts().to_dict())
    cls = cls.where(ex["code"].notna(), "None").fillna("Other")
    sev = cls.map({c: i for i, c in enumerate(WEAPON_SEVERITY)})
    return sev.groupby(ex["CaseNo"]).min().map(dict(enumerate(WEAPON_SEVERITY)))


def incident_grain(off, snapshot):
    o = off.sort_values(["CaseNo", "rank", "UniqueNIBRNo"])
    g = o.groupby("CaseNo")
    case_fields = ["date_occ", "month", "dow", "day1_flag", "area", "area_cd",
                   "LOCATION", "LAT", "LON", "report_lag_days"]
    inc = (o.drop_duplicates("CaseNo").set_index("CaseNo")
            [["category", "is_violent_fbi", "crime_against", "outcome", "status", "premise", "severity"]]
            .join(g[case_fields].first())                      # first non-null per column
            .join(g[FLAGS].any())
            .join(g.size().rename("offense_count"))
            .join(weapon_class_by_case(o).rename("weapon_class")))
    inc["weapon_class"] = inc["weapon_class"].fillna("None")
    inc["clearance_cohort"] = inc["date_occ"] <= snapshot - pd.Timedelta(days=CLEARANCE_DAYS)
    log.info("incidents %d; cases with >1 distinct Status Desc: %.2f%%; clearance cohort %d (occ <= %s)",
             len(inc), 100 * (g["status"].nunique() > 1).mean(), inc["clearance_cohort"].sum(),
             (snapshot - pd.Timedelta(days=CLEARANCE_DAYS)).date())
    return inc.reset_index()


def victim_grain(vic):
    def worst_category(u):
        codes = u.str.replace(CAR_THEFT_VIC_RE, r"\1 - 240", regex=True).str.extractall(VIC_CODE_RE)[0]
        best = codes.map(NIBR_CATEGORY).fillna("Unmapped").map(RANK).groupby(level=0).min()
        return best.reindex(u.index).fillna(RANK["Unmapped"]).astype(int).map(dict(enumerate(CATEGORY_RANK, 1)))

    vic["category"] = on_uniques(vic["VictimOfsList"], worst_category).fillna("Unmapped")
    check_unmapped(vic["category"], vic["VictimOfsList"], "VictimOfsList code")

    def norm_type(u):
        t = u.str.strip().str.replace(r"^[A-Z] - ", "", regex=True).replace({"Individual": "Person"})
        return t.where(t.isin(VICTIM_TYPES), "Unmapped")
    vic["victim_type"] = on_uniques(vic["Victim Type"], norm_type).fillna("Unmapped")
    check_unmapped(vic["victim_type"], vic["Victim Type"], "victim type")

    vic["vict_sex"] = to_label(vic["Vict Sex"], "").map(VICT_SEX).fillna("Unknown")
    vic["descent_group"] = on_uniques(vic["Vict Descent"], lambda u: u.map(norm_descent)).fillna("Unknown")
    check_unmapped(vic["descent_group"], vic["Vict Descent"], "descent")

    age = pd.to_numeric(vic["Vict Age"], errors="coerce")
    if (minors := int(age.between(1, 17).sum())):
        log.warning("victim ages 1-17 found (%d rows): source now has minors, add a 0-17 bin", minors)
    vic["age_group"] = pd.cut(age.where(age.between(1, 99)), bins=AGE_BINS, labels=AGE_LABELS)
    vic["is_individual"] = vic["victim_type"].isin({"Person", "Law Enforcement Officer"})
    vic["outcome"] = to_label(vic["Status Desc"], "Unknown").map(STATUS_OUTCOME).fillna("Unknown")
    return vic


def drop_not_a_crime(inc, off, vic):
    nac = inc.loc[inc["outcome"] == "Not a Crime", "CaseNo"]
    inc = _filter(inc, inc["outcome"] != "Not a Crime", "incidents", "Not a Crime (primary offense status)")
    off = _filter(off, ~off["CaseNo"].isin(nac), "offenses", "Not a Crime (case)")
    vic = _filter(vic, vic["outcome"] != "Not a Crime", "victims", "Not a Crime (victim status)")
    return inc, off, vic, len(nac)


def log_completeness(inc):
    m = inc.groupby("month").size()
    prior = m.loc[:WINDOW_END].iloc[-7:-1].median()
    ratio = m.get(WINDOW_END, 0) / prior
    log.info("%s completeness: %d incidents vs prior-6 median %.0f = %.1f%%%s", WINDOW_END,
             m.get(WINDOW_END, 0), prior, 100 * ratio, "  ** FLAG: below 90% **" if ratio < 0.9 else "")


def aggregate(off, inc, vic, snapshot, invalid_rows, nac_incidents):
    inc = inc.assign(is_arrest=inc["outcome"] == "Cleared by Arrest", is_firearm=inc["weapon_class"] == "Firearm")
    coh = inc[inc["clearance_cohort"]]
    geo = inc[inc["LAT"].notna() & inc["LON"].notna() & (inc["LAT"] != 0) & (inc["LON"] != 0)]
    ind = vic[vic["is_individual"]]
    r4 = lambda x: round(float(x), 4)  # noqa: E731
    out = {}

    out["kpi"] = {
        "incidents": len(inc), "offenses": len(off), "victims": len(vic),
        "offenses_per_incident": round(len(off) / len(inc), 3),
        "violent_share_fbi": r4(inc["is_violent_fbi"].mean()),
        "clearance_arrest_rate": r4(coh["is_arrest"].mean()),
        "felony_share": r4((off["severity"] == "Felony").mean()),
        "weapon_share": r4((inc["weapon_class"] != "None").mean()),
        "firearm_share": r4(inc["is_firearm"].mean()),
        "dv_share": r4(inc["dv"].mean()),
        "invalid_caseno_rows": invalid_rows,
        "not_a_crime_incidents": nac_incidents,
        "window_start": WINDOW_START, "window_end": WINDOW_END,
        "snapshot_date": str(snapshot.date()),
    }
    out["monthly_by_cat"] = _count(inc, ["month", "category"])
    out["dow_by_cat"] = _count(inc[~inc["day1_flag"]], ["category", "dow"])

    area = (inc.groupby("area")
               .agg(area_cd=("area_cd", "first"), total=("area", "size"),
                    violent_share_fbi=("is_violent_fbi", "mean"), dv_share=("dv", "mean"),
                    gang_share=("gang", "mean"), transit_share=("transit", "mean"),
                    firearm_share=("is_firearm", "mean"))
               .join(coh.groupby("area")["is_arrest"].mean().rename("clearance_arrest_rate"))
               .join(geo.groupby("area")[["LAT", "LON"]].median().rename(columns=str.lower)))
    out["area_summary"] = (area.round(4).sort_values("total", ascending=False).reset_index()
                           [["area", "area_cd", "total", "violent_share_fbi", "clearance_arrest_rate",
                             "dv_share", "gang_share", "transit_share", "firearm_share", "lat", "lon"]])
    out["area_by_cat"] = _count(inc, ["area", "category"])

    lc = off.groupby(["category", "label"]).size().sort_index().sort_values(ascending=False, kind="stable")  # ties -> label A-Z
    top8 = lc.groupby(level=0).head(8).index
    keep = pd.MultiIndex.from_frame(off[["category", "label"]]).isin(top8)
    out["offense_hierarchy"] = _count(off.assign(label=off["label"].where(keep, "Other")),
                                      ["crime_against", "category", "label"])

    pairs = off[["CaseNo", "category"]].drop_duplicates()
    m = pairs.merge(pairs, on="CaseNo")
    m = m[m["category_x"] < m["category_y"]]
    out["offense_cooccurrence"] = (_count(m, ["category_x", "category_y"])
                                   .rename(columns={"category_x": "source", "category_y": "target"}))

    oc = inc["offense_count"].clip(upper=5).astype(str).replace("5", "5+")
    out["offense_count_dist"] = _count(inc.assign(offense_count=oc), "offense_count", "incidents")
    out["top_offenses"] = (off.groupby(["label", "nibr_code", "severity"]).size()
                              .nlargest(15).reset_index(name="count"))

    out["victim_type"] = _count(vic, "victim_type").sort_values("count", ascending=False)
    out["victim_age_sex"] = _count(ind, ["age_group", "vict_sex"])
    out["victim_descent_by_cat"] = _count(ind, ["descent_group", "category"])

    out["weapon_class"] = _count(inc, ["category", "weapon_class"])
    out["outcome_by_cat"] = _count(coh, ["category", "outcome"])
    stage = coh["status"].map(PROSECUTION_STAGE)
    out["outcome_funnel"] = pd.DataFrame({
        "stage": ["Reported", "Cleared", "Cleared by Arrest", "Filed", "Rejected"],
        "count": [len(coh), coh["outcome"].isin({"Cleared by Arrest", "Cleared Other"}).sum(),
                  coh["is_arrest"].sum(), (stage == "Filed").sum(), (stage == "Rejected").sum()],
    })

    fa = inc.groupby("area")[FLAGS].sum().melt(ignore_index=False, var_name="flag", value_name="count").reset_index()
    fa["share"] = (fa["count"] / fa["area"].map(inc["area"].value_counts())).round(4)
    out["flags_by_area"] = fa
    out["flags_monthly"] = (inc.groupby("month")[FLAGS].sum()
                               .melt(ignore_index=False, var_name="flag", value_name="count").reset_index())

    out["report_lag_by_cat"] = (off.dropna(subset=["report_lag_days"])
                                   .groupby("category")["report_lag_days"]
                                   .describe(percentiles=[.25, .5, .75, .9])
                                   .rename(columns={"25%": "q1", "50%": "median", "75%": "q3", "90%": "p90"})
                                   [["q1", "median", "q3", "p90", "mean", "count"]]
                                   .round(1).astype({"count": int}).reset_index())

    loc = inc.assign(location=inc["LOCATION"].str.replace(r"\s+", " ", regex=True).str.strip())
    lc = _count(loc.dropna(subset=["location"]), ["location", "area", "category"])
    top_cat = (lc.sort_values("count", ascending=False).drop_duplicates(["location", "area"])
                 .set_index(["location", "area"])["category"].rename("top_category"))
    out["top_locations"] = (lc.groupby(["location", "area"])["count"].sum().nlargest(25)
                              .to_frame().join(top_cat).reset_index())

    g = geo.assign(glat=(geo["LAT"] / GRID_STEP).round() * GRID_STEP,
                   glon=(geo["LON"] / GRID_STEP).round() * GRID_STEP)
    out["geo_grid"] = _count(g, ["glat", "glon", "category"]).round({"glat": 4, "glon": 4})
    out["geo_sample"] = (geo.sample(n=min(20_000, len(geo)), random_state=SEED)
                            [["LAT", "LON", "category", "area", "month"]]
                            .rename(columns={"LAT": "lat", "LON": "lon"}).round({"lat": 4, "lon": 4}))
    log.info("geo: %d incidents with coordinates, %d dropped (null/zero)", len(geo), len(inc) - len(geo))
    return out


def export(out, outdir):
    outdir.mkdir(parents=True, exist_ok=True)
    for name, obj in out.items():
        p = outdir / f"{name}.json"
        if isinstance(obj, pd.DataFrame):
            obj.to_json(p, orient="records")
        else:
            p.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
        size, limit = p.stat().st_size, SIZE_LIMIT.get(p.name, 2e6)
        log.info("%-28s %8.1f KB%s", p.name, size / 1024, "  ** OVER SIZE TARGET **" if size > limit else "")


def main():
    root = Path(__file__).resolve().parents[1]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--offenses", type=Path, default=root / "data/raw/nibrs_offenses.csv")
    ap.add_argument("--victims", type=Path, default=root / "data/raw/nibrs_victims.csv")
    ap.add_argument("--output", type=Path, default=root / "data/processed/nibrs")
    a = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    off, vic = prep(load(a.offenses, OFF_COLS)), prep(load(a.victims, VIC_COLS))
    snapshot = max(off["date_rptd"].max(), vic["date_rptd"].max())
    invalid_rows = int((~off["caseno_valid"]).sum())
    log.info("snapshot date (max Date Rptd): %s", snapshot.date())

    off = offense_grain(clean(off, "offenses"))
    vic = victim_grain(clean(vic, "victims"))
    inc = incident_grain(off, snapshot)
    inc, off, vic, nac = drop_not_a_crime(inc, off, vic)
    log_completeness(inc)
    export(aggregate(off, inc, vic, snapshot, invalid_rows, nac), a.output)


if __name__ == "__main__":
    main()
