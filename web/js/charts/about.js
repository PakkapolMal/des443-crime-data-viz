/**
 * Chapter 9: #about — Data Overview, Methodology & Caveats
 * Exports: about, caveats, methodology (with router aliases: overview, limitations, pipeline, default)
 * Data sources: kpi.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/**
 * Screen 1: Dataset Overview & Interactive Schema Architecture
 */
export async function about(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const kpi = data?.kpi || (await lazy?.("kpi")) || {};

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("overflow", "hidden")
    .style("gap", "var(--s-2)");

  // Header Section
  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "flex-end");

  const titleGroup = header.append("div");
  titleGroup.append("p").attr("class", "label").text("09 · ABOUT");
  titleGroup.append("h2").text("LAPD NIBRS Crime Data Visualization Project");
  titleGroup.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Incident-level exploration of crime volume, spatial density, victim demographics, and clearance dynamics across Los Angeles.");

  // Hero KPI Grid
  const kpiGrid = wrapper.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(4, 1fr)")
    .style("gap", "var(--s-2)");

  const cards = [
    { 
      label: "TOTAL INCIDENT REPORTS", 
      val: kpi.incidents ? d3.format(",")(kpi.incidents) : "435,318", 
      sub: "Unique CaseNo records", 
      isDate: false
    },
    { 
      label: "TOTAL OFFENSES COUNTED", 
      val: kpi.offenses ? d3.format(",")(kpi.offenses) : "484,949", 
      sub: "~1.11 offenses per incident", 
      isDate: false
    },
    { 
      label: "VICTIMS RECORDED", 
      val: kpi.victims ? d3.format(",")(kpi.victims) : "444,150", 
      sub: "Individual, business & public", 
      isDate: false
    },
    { 
      label: "ANALYSIS WINDOW", 
      val: `${kpi.window_start || "2024-04"} → ${kpi.window_end || "2026-09"}`, 
      sub: "30-month operational window", 
      isDate: true
    }
  ];

  cards.forEach(c => {
    const card = kpiGrid.append("div")
      .style("background", "var(--surface)")
      .style("padding", "var(--s-2) var(--s-3)");

    card.append("div")
      .attr("class", "label")
      .text(c.label);

    card.append("div")
      .style("font-size", c.isDate ? "1.15rem" : "var(--fs-h2)")
      .style("font-weight", "700")
      .style("font-family", "var(--font-mono)")
      .style("color", "var(--bone)")
      .style("margin", c.isDate ? "8px 0 6px 0" : "4px 0 2px 0")
      .style("white-space", "nowrap")
      .text(c.val);

    card.append("div")
      .attr("class", "caption")
      .text(c.sub);
  });

  // Main Architecture Section
  const mainPanel = wrapper.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "1.2fr 1fr")
    .style("gap", "var(--s-2)");

  // Relational Architecture Panel
  const specCard = mainPanel.append("div")
    .style("background", "var(--surface)")
    .style("padding", "var(--s-3)")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "var(--s-2)");

  specCard.append("div").html(`
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--s-1);">
      <p class="label" style="color:var(--bone); font-weight:700;">RELATIONAL NIBRS DATA ARCHITECTURE</p>
      <span class="label" style="border:var(--rule); padding:2px 6px;">JOIN KEY: CaseNo</span>
    </div>
    <p class="caption" style="line-height:1.5;">
      Under NIBRS, a single incident (identified by <code style="color:var(--bone); background:var(--bg); padding:2px 4px;">CaseNo</code>) links separate offense records and victim entities. This solves legacy UCR limitations where multi-offense events were compressed into a single top charge.
    </p>
  `);

  // Schema Diagram Box with Vector SVG Connector
  const diagBox = specCard.append("div")
    .style("background", "var(--bg)")
    .style("border", "var(--rule)")
    .style("padding", "var(--s-2) var(--s-3)")
    .style("display", "grid")
    .style("grid-template-columns", "1fr auto 1fr")
    .style("align-items", "center")
    .style("gap", "var(--s-2)")
    .style("font-family", "var(--font-mono)");

  diagBox.append("div").html(`
    <div class="label" style="color:var(--bone);">OFFENSES TABLE</div>
    <div style="font-size:var(--fs-label); font-weight:700; color:var(--bone); margin-top:2px;">~499k Rows</div>
    <div class="caption" style="margin-top:2px;">Grain: <code style="color:var(--bone);">UniqueNIBRNo</code></div>
    <div class="caption" style="margin-top:4px;">NIBR Statute, Severity, Premise, Weapon Code, Coordinates</div>
  `);

  // Center SVG Bidirectional Connector
  diagBox.append("div").html(`
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:0 var(--s-1);">
      <span class="label" style="color:var(--bone); font-weight:700;">1 : N</span>
      <svg width="56" height="12" viewBox="0 0 56 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 6H50" stroke="var(--bone-60)" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M1 6L7 1M1 6L7 11" stroke="var(--bone-60)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M55 6L49 1M55 6L49 11" stroke="var(--bone-60)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="label">CaseNo</span>
    </div>
  `);

  diagBox.append("div").html(`
    <div class="label" style="color:var(--bone);">VICTIMS TABLE</div>
    <div style="font-size:var(--fs-label); font-weight:700; color:var(--bone); margin-top:2px;">~457k Rows</div>
    <div class="caption" style="margin-top:2px;">Grain: <code style="color:var(--bone);">UniqueVictimNo</code></div>
    <div class="caption" style="margin-top:4px;">Victim Type, Age Group, Sex, Descent, Offense List</div>
  `);

  // Source Endpoints Panel
  const endpointCard = mainPanel.append("div")
    .style("background", "var(--surface)")
    .style("padding", "var(--s-3)")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "var(--s-2)");

  endpointCard.append("p")
    .attr("class", "label")
    .style("color", "var(--bone)")
    .style("font-weight", "700")
    .text("PRIMARY OPEN DATA SOURCES");

  const offSrc = endpointCard.append("div")
    .style("background", "var(--bg)")
    .style("border", "var(--rule)")
    .style("padding", "var(--s-2)");

  offSrc.html(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
      <strong style="font-size:var(--fs-small); color:var(--bone); font-family:var(--font-mono);">NIBRS Crime Offenses</strong>
      <a href="https://data.lacity.org/d/k7nn-b2ep" target="_blank" class="label" style="color:var(--bone-60); text-decoration:none; border:var(--rule); padding:2px 6px;">k7nn-b2ep ↗</a>
    </div>
    <p class="caption" style="margin:0; line-height:1.4;">
      Published by LAPD on LA Open Data. Updated continuously with incident details, weapon classifications, and geocoded locations.
    </p>
  `);

  const vicSrc = endpointCard.append("div")
    .style("background", "var(--bg)")
    .style("border", "var(--rule)")
    .style("padding", "var(--s-2)");

  vicSrc.html(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
      <strong style="font-size:var(--fs-small); color:var(--bone); font-family:var(--font-mono);">NIBRS Victim Demographics</strong>
      <a href="https://data.lacity.org/d/gqf2-vm2j" target="_blank" class="label" style="color:var(--bone-60); text-decoration:none; border:var(--rule); padding:2px 6px;">gqf2-vm2j ↗</a>
    </div>
    <p class="caption" style="margin:0; line-height:1.4;">
      Captures victim entity classifications (Individuals, Commercial Businesses, Society) and demography.
    </p>
  `);
}

/**
 * Screen 2: Mandatory Dashboard Caveats & Limitations
 */
export async function caveats(el) {
  const container = d3.select(el);
  container.html("");

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("overflow-y", "auto")
    .style("gap", "var(--s-2)");

  const header = wrapper.append("div");
  header.append("p").attr("class", "label").text("09 · ABOUT");
  header.append("h2").text("Dashboard Limitations & Analytical Caveats");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Essential guidelines for accurate data interpretation and public policy application.");

  const grid = wrapper.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fit, minmax(320px, 1fr))")
    .style("gap", "var(--s-2)");

  const items = [
    {
      title: "Non-Comparability with Legacy Data",
      desc: "NIBRS counts every individual offense rather than applying the legacy UCR Hierarchy Rule. Figures in this dashboard cannot be directly compared with pre-2024 LAPD reports.",
      tag: "CRITICAL",
      tagColor: "var(--signal)"
    },
    {
      title: "Analysis Window & Reporting Lag",
      desc: "Analysis spans April 2024 through September 2026. September 2026 figures may reflect minor undercounting due to pending incident report ingestion.",
      tag: "TEMPORAL",
      tagColor: "var(--bone)"
    },
    {
      title: "180-Day Case Clearance Cohort",
      desc: "Case clearance and prosecution funnel figures include only cases at least 180 days old to allow investigative maturity.",
      tag: "CLEARANCE",
      tagColor: "var(--bone)"
    },
    {
      title: "Exclusion of Time-of-Day Analysis",
      desc: "Time of occurrence (Time OCC) contains heavy default entry spikes at 0000 (midnight) and 1200 (noon). Hour-of-day heatmaps are deliberately excluded to prevent bias.",
      tag: "DATA QUALITY",
      tagColor: "var(--bone-60)"
    },
    {
      title: "Victim Descent vs. Population Rates",
      desc: "Victim descent distributions represent raw counts of reported crime victims. They are not population-adjusted rates and imply no suspect demographics.",
      tag: "DEMOGRAPHICS",
      tagColor: "var(--hairline)"
    }
  ];

  items.forEach(item => {
    const box = grid.append("div")
      .style("background", "var(--surface)")
      .style("border", "var(--rule)")
      .style("padding", "var(--s-3)")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("gap", "var(--s-1)");

    const row = box.append("div")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "center");

    row.append("strong")
      .style("color", "var(--bone)")
      .style("font-size", "var(--fs-small)")
      .style("font-family", "var(--font-mono)")
      .text(item.title);

    row.append("span")
      .attr("class", "label")
      .style("color", item.tagColor)
      .style("border", "var(--rule)")
      .style("padding", "2px 6px")
      .text(item.tag);

    box.append("p")
      .attr("class", "caption")
      .style("line-height", "1.4")
      .text(item.desc);
  });
}

/**
 * Screen 3: Pipeline Architecture & Processing Rules
 */
export async function methodology(el) {
  const container = d3.select(el);
  container.html("");

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("overflow-y", "auto")
    .style("gap", "var(--s-2)");

  const header = wrapper.append("div");
  header.append("p").attr("class", "label").text("09 · ABOUT");
  header.append("h2").text("Data Processing & Pipeline Methodology");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Automated data cleaning, deduplication, and primary offense selection rules.");

  const list = wrapper.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "var(--s-2)");

  const steps = [
    {
      num: "01",
      title: "Case Number Validation & Invalid Filtering",
      desc: "Invalid CaseNo values lacking digits (e.g., RFC CITATION) are flagged caseno_valid = False and excluded from incident and victim counts."
    },
    {
      num: "02",
      title: "Primary Offense Severity Ranking",
      desc: "Multi-offense incidents are assigned a primary offense using severity rank: Homicide > Sex Offense > Robbery > Aggravated Assault > Burglary > Larceny. Ties break on lowest UniqueNIBRNo."
    },
    {
      num: "03",
      title: "Weapon Code Parsing & Hierarchy Resolution",
      desc: "Multi-value weapon string codes are split on Weapon Used Cd rather than description. Each incident takes the highest-severity weapon class present (Firearm > Knife > Other > Bodily Force)."
    },
    {
      num: "04",
      title: "Geospatial Grid Aggregation",
      desc: "Coordinates are grouped into 0.01° (~1 km) grid cells for spatial density analysis. Zero or null coordinates are safely dropped from spatial views."
    }
  ];

  steps.forEach(s => {
    const card = list.append("div")
      .style("background", "var(--surface)")
      .style("border", "var(--rule)")
      .style("padding", "var(--s-2) var(--s-3)")
      .style("display", "grid")
      .style("grid-template-columns", "50px 1fr")
      .style("align-items", "center")
      .style("gap", "var(--s-2)");

    card.append("div")
      .style("font-size", "var(--fs-h2)")
      .style("font-weight", "700")
      .style("font-family", "var(--font-mono)")
      .style("color", "var(--signal)")
      .text(s.num);

    const textGroup = card.append("div");
    textGroup.append("div")
      .style("font-size", "var(--fs-small)")
      .style("font-weight", "700")
      .style("color", "var(--bone)")
      .style("font-family", "var(--font-mono)")
      .text(s.title);

    textGroup.append("div")
      .attr("class", "caption")
      .style("margin-top", "2px")
      .style("line-height", "1.4")
      .text(s.desc);
  });
}

// Router Export Aliases
export {
  about as overview,
  caveats as limitations,
  methodology as pipeline,
  about as default
};