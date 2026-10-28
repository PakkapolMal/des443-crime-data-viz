// Shared helpers for every chapter module.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

export const fmtInt = d3.format(",");
export const fmtPct = d3.format(".1%");

// Severity order from CONTEXT_NIBRS.md (CATEGORY_RANK). Fixed order on every page; no hue per category (DESIGN.md).
export const CATEGORIES = [
  "Homicide", "Sexual Offense", "Human Trafficking", "Kidnapping", "Robbery",
  "Serious Assault", "Burglary", "Car Theft", "Vandalism",
  "Theft", "Fraud", "Minor Assault",
  "Weapons", "Drugs", "Other", "Violations", "Unmapped",
];

// FBI violent crime, as categories. kpi.violent_share_fbi uses FBI_VIOLENT_CODES (09A/B, 11A-D, 120, 13A)
// on the primary offense; every one of those codes maps to these four categories.
// ponytail: Sexual Offense also holds 36A/36B (incest, statutory), which the KPI excludes; files without
// nibr_code can't split it. Add nibr_code to the export if the gap matters.
export const VIOLENT_CATEGORIES = new Set(["Homicide", "Sexual Offense", "Robbery", "Serious Assault"]);

// Colours come from tokens.css so CSS stays the single source.
const css = getComputedStyle(document.documentElement);
const token = (name) => css.getPropertyValue(name).trim();
export const color = {
  bone: token("--bone"), context: token("--context"), hairline: token("--hairline"),
  signal: token("--signal"), signalFill: token("--signal-fill"),
};
// Sequential ramp over a 0..1 value; zero / no data draws no mark (DESIGN.md).
const RAMP = ["--ramp-0", "--ramp-1", "--ramp-2", "--ramp-3", "--ramp-4"].map(token);
export const ramp = d3.scaleLinear([0, 0.25, 0.5, 0.75, 1], RAMP).clamp(true);

// Skewed counts (density map, co-occurrence): one ramp step per order of magnitude, fixed across
// filters so a colour always means the same count range. countKey feeds legend().
export const countColor = d3.scaleThreshold([10, 100, 1000, 10000], RAMP);
export const countKey = ["1–9", "10–99", "100–999", "1k–9.9k", "10k+"].map((label, i) => ({ color: RAMP[i], label }));

// Colour key: a title, then one swatch per item with its value beside it. items: [{ color, label }].
export function legend(parent, title, items) {
  const key = parent.append("div").attr("class", "legend");
  key.append("span").attr("class", "legend-title").text(title);
  items.forEach(({ color, label }) => {
    const item = key.append("span").attr("class", "legend-item");
    item.append("i").style("background", color);
    item.append("span").attr("class", "num").text(label);
  });
  return key;
}

// One shared tooltip element: tooltip.show(html, event) on hover, tooltip.hide() on leave.
const tip = document.getElementById("tooltip");
export const tooltip = {
  show(html, event) {
    tip.innerHTML = html;
    tip.style.opacity = 1;
    tip.style.left = `${event.clientX + 12}px`;
    tip.style.top = `${event.clientY + 12}px`;
  },
  hide() { tip.style.opacity = 0; },
};

// Skeleton stand-in until a screen's real chart is built.
export function placeholder(el, label, ...datasets) {
  const counts = datasets.map((d) => (Array.isArray(d) ? `${d.length} records` : "object"));
  el.textContent = `[${label}] ${counts.join(" · ")}`;
}
