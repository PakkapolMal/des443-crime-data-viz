# TASK — NIBRS Dashboard Pages

Build the scrollytelling dashboard on top of `data/processed/nibrs/`. See `README.md` for the stack and layout, and `docs/CONTEXT_NIBRS.md` for the data contract.

Status: **0 (shared foundation) and 1 (`#home`) are done.** Chapters 2–9 are still to do.

## Rules for every page
- **Navigation:** vertical scroll only. Each screen is a 100vh `<section>` with CSS `scroll-snap-align: start`. No prev/next buttons and no fullPage.js.
- **URLs:** one hash per chapter (`#trends`), not per screen. Use plain ids, not `#/`, and no query strings.
- **State:** filters and drill-downs live in that chapter's DOM and JS only. Nothing is written to the URL or shared across chapters.
- **Scroll is for paging:** no chart may zoom on the mouse wheel. Use click or +/- controls instead.
- **Render on view:** draw a chart the first time its screen enters the viewport (IntersectionObserver). Entry animations are welcome.
- **Data:** use `d3.json("data/processed/nibrs/<file>.json")` with relative paths. Never rename keys.
- **Caveats:** each chart that needs a caveat shows it in a one-line note that links to `#about`.
- **Layout:** 16:9 desktop only (projector). Each screen fits one viewport with no scrolling inside it. Check at 1280×720 and 1920×1080. Below 1024px wide, show only a "Best viewed on a desktop" notice.
- **Look:** follow `DESIGN.md` and use the variables in `web/css/tokens.css`. No raw hex in page code.

## 0. Shared foundation (done)
- [x] `index.html` with all chapters and screens as empty containers
- [x] `web/css/style.css`: scroll-snap container, 100vh screens, base styles from `tokens.css`. No categorical hue palette: categories keep one fixed order and are told apart by position, direct labels and bone opacity steps (see `DESIGN.md`)
- [x] `web/js/main.js`:
  - eager-loads the small JSON files and lazy-loads `geo_grid` and `geo_sample`
  - keeps the hash in sync with the visible chapter (`history.replaceState`)
  - scrolls to the hash on load
  - runs each screen's render function on first view
- [x] Shared tooltip and number formatting helpers (`d3.format(",")`, percentages)
- [x] Passive chapter indicator showing the current chapter name. It is not clickable.

## 1. `#home` — How much crime, and how bad? (done)
| Screen | Content | Files |
|---|---|---|
| 1 | Title: "LA Crime under NIBRS, Apr 2024 – Sep 2026", with a scroll cue | — |
| 2 | KPI cards: incidents, violent share (FBI), clearance by arrest*, firearm share, DV share. Small monthly total trend line underneath. | `kpi`, `monthly_by_cat` |

\* Label it "cases ≥ 180 days old". Show `snapshot_date` in the footer. Under the KPI row, one caveat line: "Shares include Apr–Dec 2024, when many property reports are missing. About →". Only the incidents count is red.

## 2. `#trends` — When does it happen?
| Screen | Content | Files |
|---|---|---|
| 1 | Monthly multi-line chart by category, with a category toggle legend. | `monthly_by_cat` |
| 2 | Day-of-week small multiples, one per category, each scaled to its own share. Flag lines with a flag selector. | `dow_by_cat`, `flags_monthly` |

Note on screen 2: rows dated the 1st of the month are excluded, because that date is often a default entry.

## 3. `#places` — Where does it happen?
| Screen | Content | Files |
|---|---|---|
| 1 | Grid density map (0.01° cells) with a category dropdown ("All" sums the categories), a log or quantile color scale and +/- zoom. Toggle to a dot map built from the 20k sample. | `geo_grid`, `geo_sample` (lazy) |
| 2 | Area bars sorted by total. Area × category heatmap colored by row share. Clicking a bar highlights its heatmap row. | `area_summary`, `area_by_cat` |
| 3 | Top-25 locations table with a `top_category` label | `top_locations` |

Open question: there's no basemap yet. Decide between plain cells over an LA area outline (needs a GeoJSON file) and a tile basemap.

## 4. `#compare` — Do areas differ in kind, not just amount?
| Screen | Content | Files |
|---|---|---|
| 1 | Scatter: `total` vs. a y-metric selector (`clearance_arrest_rate`, `violent_share_fbi`), with labeled points. Beside it, flag-share small multiples by area (DV, gang, transit…), with a flag selector. | `area_summary`, `flags_by_area` |

## 5. `#offenses` — What kinds of crime?
| Screen | Content | Files |
|---|---|---|
| 1 | Sunburst (crime_against → category → label), built with `d3.rollup` + `d3.hierarchy`, click to zoom. Top-15 offenses as bars, with `severity` shown as bone opacity steps. | `offense_hierarchy`, `top_offenses` |
| 2 | Chord diagram of category co-occurrence; hovering a category isolates its ribbons. Offense count bars (1, 2, 3, 4, 5+) on a band scale. | `offense_cooccurrence`, `offense_count_dist` |

## 6. `#weapons` — How dangerous?
| Screen | Content | Files |
|---|---|---|
| 1 | 100% stacked bars of weapon class by category, ordered Firearm → Knife → Other → Bodily Force → Unknown → None, with a "hide None" toggle. KPI callouts for `firearm_share` and `weapon_share`. | `weapon_class`, `kpi` |

## 7. `#victims` — Who is harmed?
| Screen | Content | Files |
|---|---|---|
| 1 | Population pyramid (Male left, Female right). Transgender and Unknown go in a side note. Victim type bars. | `victim_age_sex`, `victim_type` |
| 2 | Victim descent × category as stacked or grouped bars, with a caption: "counts, not population rates; says nothing about offenders" | `victim_descent_by_cat` |

## 8. `#outcomes` — What happens after a report?
| Screen | Content | Files |
|---|---|---|
| 1 | Funnel: Reported → Cleared → Cleared by Arrest → Filed, with Rejected as a side branch. Outcome by category as 100% bars sorted by arrest share. Both use the clearance cohort only. | `outcome_funnel`, `outcome_by_cat` |
| 2 | Reporting lag box plot from precomputed stats (whisker to p90, mean tick) on a log or sqrt axis | `report_lag_by_cat` |

## 9. `#about` — Can I trust this?
| Screen | Content | Files |
|---|---|---|
| 1 | Window and snapshot date; why the data starts at the NIBRS switch; the 2024 data gap (in Apr 2024, 11 of 21 areas have only 19–49 incidents; in Jan 2025 all areas jump together, mostly property crime: larceny ×2.3, motor vehicle theft ×1.9, fraud ×1.7) and how it raises the KPI shares; Sep 2026 may be undercounted by late reports (about 92% of the prior six-month median). Charts carry no note for these, so `#about` is the only place that explains them; the 180-day clearance cohort; why there's no time of day; exclusions with counts (`invalid_caseno_rows`, `not_a_crime_incidents`); the descent and homeless-flag caveats; data sources and links | `kpi` |

## Done when
- [ ] All chapters render from the committed JSON with no console errors
- [ ] Hash deep links (`…/#outcomes`) land on the right chapter, and the hash updates while scrolling
- [ ] Scrolling over the map or sunburst never gets trapped
- [ ] Works on GitHub Pages (relative paths only)
- [ ] `python src/validate_nibrs.py` still passes, because the data is unchanged

## Open: category wording (review v2, 2026-10-24)
- [x] Recheck every category name a lay audience sees. Done 2026-10-28: the categories themselves were renamed in the pipeline (not display-only), so the JSON values changed: Sexual Offense, Serious Assault, Minor Assault, Car Theft, Vandalism, Theft, Fraud, Weapons, Other (was Other Group A), Violations (was Group B). Homicide, Human Trafficking, Kidnapping, Robbery, Burglary, Drugs and Unmapped are unchanged. Statute 10851(A) VC (take vehicle without owner's consent) now maps to Car Theft whatever NIBRS code LAPD gave it.

## After all pages are done
- [ ] Save local copies of D3, d3-sankey and both fonts (Instrument Serif, JetBrains Mono) in the repo and load them from there, so the page works without classroom Wi-Fi. Until then they load from jsDelivr and Google Fonts.
