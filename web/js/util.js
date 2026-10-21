// Shared helpers for every chapter module.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

export const fmtInt = d3.format(",");
export const fmtPct = d3.format(".1%");

// Severity order from CONTEXT_NIBRS.md (CATEGORY_RANK). Same color for a category on every page.
export const CATEGORIES = [
  "Homicide", "Sex Offense", "Human Trafficking", "Kidnapping", "Robbery",
  "Aggravated Assault", "Burglary", "Motor Vehicle Theft", "Vandalism/Arson",
  "Larceny/Theft", "Fraud/Identity", "Simple Assault/Intimidation",
  "Weapon Law", "Drugs", "Other Group A", "Group B", "Unmapped",
];
// ponytail: placeholder palette (Tableau10 + Dark2 = 18 colors); swap during the styling pass
export const categoryColor = d3.scaleOrdinal(CATEGORIES, d3.schemeTableau10.concat(d3.schemeDark2));

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
