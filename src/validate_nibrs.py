"""Validate data/processed/nibrs/ against the raw NIBRS files and the output contract in CONTEXT_NIBRS.md.

Raw-data checks (filter drops, invalid CaseNo, parse failures, TotalOffenseCount mismatch, unmapped
counts, Sep 2026 completeness) are logged by re-running the transform's stages. Output checks are
asserted; the exit code is 1 if any fail.
"""
import argparse
import json
import logging
import sys
from pathlib import Path

import transform_nibrs as t

log = logging.getLogger("validate_nibrs")

CONTRACT = {
    "kpi.json": {"incidents", "offenses", "victims", "offenses_per_incident", "violent_share_fbi",
                 "clearance_arrest_rate", "felony_share", "weapon_share", "firearm_share", "dv_share",
                 "invalid_caseno_rows", "not_a_crime_incidents", "window_start", "window_end", "snapshot_date"},
    "monthly_by_cat.json": {"month", "category", "count"},
    "dow_by_cat.json": {"category", "dow", "count"},
    "area_summary.json": {"area", "area_cd", "total", "violent_share_fbi", "clearance_arrest_rate", "dv_share",
                          "gang_share", "transit_share", "firearm_share", "lat", "lon"},
    "area_by_cat.json": {"area", "category", "count"},
    "offense_hierarchy.json": {"crime_against", "category", "label", "count"},
    "offense_cooccurrence.json": {"source", "target", "count"},
    "offense_count_dist.json": {"offense_count", "incidents"},
    "top_offenses.json": {"label", "nibr_code", "severity", "count"},
    "victim_type.json": {"victim_type", "count"},
    "victim_age_sex.json": {"age_group", "vict_sex", "count"},
    "victim_descent_by_cat.json": {"descent_group", "category", "count"},
    "weapon_class.json": {"category", "weapon_class", "count"},
    "outcome_by_cat.json": {"category", "outcome", "count"},
    "outcome_funnel.json": {"stage", "count"},
    "flags_by_area.json": {"area", "flag", "count", "share"},
    "flags_monthly.json": {"month", "flag", "count"},
    "report_lag_by_cat.json": {"category", "q1", "median", "q3", "p90", "mean", "count"},
    "top_locations.json": {"location", "area", "count", "top_category"},
    "geo_grid.json": {"glat", "glon", "category", "count"},
    "geo_sample.json": {"lat", "lon", "category", "area", "month"},
}


def check_files(outdir, fail):
    data = {}
    for name, keys in CONTRACT.items():
        p = outdir / name
        if not p.exists():
            fail(f"{name}: missing")
            continue
        size, limit = p.stat().st_size, t.SIZE_LIMIT.get(name, 2e6)
        if size > limit:
            fail(f"{name}: {size / 1e6:.2f} MB > {limit / 1e6:.0f} MB")
        obj = json.loads(p.read_text(encoding="utf-8"))
        records = [obj] if isinstance(obj, dict) else obj
        if not records:
            fail(f"{name}: empty")
        bad = [r for r in records if set(r) != keys]
        if bad:
            fail(f"{name}: {len(bad)} records with wrong keys, e.g. {sorted(bad[0])} vs {sorted(keys)}")
        if any("hour" in k for r in records for k in r):
            fail(f"{name}: contains an hour field (time of day is excluded)")
        data[name] = obj
        log.info("file %-28s %8.1f KB  %6d records", name, size / 1024, len(records))
    return data


def main():
    root = Path(__file__).resolve().parents[1]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--offenses", type=Path, default=root / "data/raw/nibrs_offenses.csv")
    ap.add_argument("--victims", type=Path, default=root / "data/raw/nibrs_victims.csv")
    ap.add_argument("--output", type=Path, default=root / "data/processed/nibrs")
    a = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    errors = []
    def fail(msg):
        errors.append(msg)
        log.error("FAIL %s", msg)

    log.info("=== raw-data checks (re-running transform stages) ===")
    off, vic = t.prep(t.load(a.offenses, t.OFF_COLS)), t.prep(t.load(a.victims, t.VIC_COLS))
    snapshot = max(off["date_rptd"].max(), vic["date_rptd"].max())
    invalid_rows = int((~off["caseno_valid"]).sum())
    off = t.offense_grain(t.clean(off, "offenses"))
    vic = t.victim_grain(t.clean(vic, "victims"))
    inc = t.incident_grain(off, snapshot)
    inc, off, vic, nac = t.drop_not_a_crime(inc, off, vic)
    t.log_completeness(inc)

    log.info("=== output contract ===")
    d = check_files(a.output, fail)
    if len(d) < len(CONTRACT):
        sys.exit(1)

    total = lambda f, key="count": sum(r[key] for r in d[f])  # noqa: E731
    cohort = int(inc["clearance_cohort"].sum())
    geo = inc[inc["LAT"].notna() & inc["LON"].notna() & (inc["LAT"] != 0) & (inc["LON"] != 0)]
    known_age = int((vic["is_individual"] & vic["age_group"].notna()).sum())
    kpi = d["kpi.json"]
    sums = [
        ("monthly_by_cat == incidents in window", total("monthly_by_cat.json"), len(inc)),
        ("victim_age_sex == individuals with known age", total("victim_age_sex.json"), known_age),
        ("area_by_cat == incidents", total("area_by_cat.json"), len(inc)),
        ("weapon_class == incidents", total("weapon_class.json"), len(inc)),
        ("offense_count_dist == incidents", total("offense_count_dist.json", "incidents"), len(inc)),
        ("offense_hierarchy == offenses", total("offense_hierarchy.json"), len(off)),
        ("victim_type == victims", total("victim_type.json"), len(vic)),
        ("victim_descent_by_cat == individuals", total("victim_descent_by_cat.json"), int(vic["is_individual"].sum())),
        ("outcome_by_cat == clearance cohort", total("outcome_by_cat.json"), cohort),
        ("outcome_funnel Reported == cohort", d["outcome_funnel.json"][0]["count"], cohort),
        ("geo_grid == incidents with coords", total("geo_grid.json"), len(geo)),
        ("area_summary total == incidents", total("area_summary.json", "total"), len(inc)),
        ("kpi incidents", kpi["incidents"], len(inc)),
        ("kpi offenses", kpi["offenses"], len(off)),
        ("kpi victims", kpi["victims"], len(vic)),
        ("kpi invalid_caseno_rows", kpi["invalid_caseno_rows"], invalid_rows),
        ("kpi not_a_crime_incidents", kpi["not_a_crime_incidents"], nac),
    ]
    for label, got, want in sums:
        if got != want:
            fail(f"sum {label}: {got} != {want}")
        else:
            log.info("ok   sum %-46s %d", label, got)
    if (kpi["window_start"], kpi["window_end"]) != (t.WINDOW_START, t.WINDOW_END):
        fail(f"kpi window {kpi['window_start']}..{kpi['window_end']} != {t.WINDOW_START}..{t.WINDOW_END}")
    months = {r["month"] for r in d["monthly_by_cat.json"]}
    if min(months) < t.WINDOW_START or max(months) > t.WINDOW_END:
        fail(f"monthly_by_cat spans {min(months)}..{max(months)}, outside the window")
    if len(d["geo_sample.json"]) != min(20_000, len(geo)):
        fail(f"geo_sample has {len(d['geo_sample.json'])} rows")

    log.info("=== %s: %d failure(s) ===", "FAILED" if errors else "PASSED", len(errors))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
