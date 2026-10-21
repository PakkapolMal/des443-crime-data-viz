// Shared helpers for every chapter module.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

export const fmtInt = d3.format(",");
export const fmtPct = d3.format(".1%");

// Severity order from CONTEXT_NIBRS.md (CATEGORY_RANK). Fixed order on every page; no hue per category (DESIGN.md).
export const CATEGORIES = [
  "Homicide", "Sex Offense", "Human Trafficking", "Kidnapping", "Robbery",
  "Aggravated Assault", "Burglary", "Motor Vehicle Theft", "Vandalism/Arson",
  "Larceny/Theft", "Fraud/Identity", "Simple Assault/Intimidation",
  "Weapon Law", "Drugs", "Other Group A", "Group B", "Unmapped",
];

// Colours come from tokens.css so CSS stays the single source.
const css = getComputedStyle(document.documentElement);
const token = (name) => css.getPropertyValue(name).trim();
export const color = {
  bone: token("--bone"), context: token("--context"), hairline: token("--hairline"),
  signal: token("--signal"), signalFill: token("--signal-fill"),
};
// Sequential ramp over a 0..1 value; zero / no data draws no mark (DESIGN.md).
export const ramp = d3.scaleLinear([0, 1 / 3, 2 / 3, 1], ["--ramp-0", "--ramp-1", "--ramp-2", "--ramp-3"].map(token))
  .clamp(true);

// One shared tooltip element: tooltip.show(html, event) on hover, tooltip.hide() on leave.
const tip = document.getElementById("tooltip");
export const tooltip = {
  show(html, event) {
    tip.innerHTML = html;
    tip.hidden = false;
    tip.style.left = `${event.clientX + 12}px`;
    tip.style.top = `${event.clientY + 12}px`;
  },
  hide() { tip.hidden = true; },
};

// Skeleton stand-in until a screen's real chart is built.
export function placeholder(el, label, ...datasets) {
  const counts = datasets.map((d) => (Array.isArray(d) ? `${d.length} records` : "object"));
  el.textContent = `[${label}] ${counts.join(" · ")}`;
}
