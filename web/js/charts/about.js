/**
 * Chapter 9: #about — Data Overview, Methodology & Caveats
 * Exports: about, caveats, methodology (with router aliases)
 * Data sources: kpi.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/**
 * Screen 1: Dataset Overview & Interactive Schema Architecture
 */
export async function about(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const kpi = data?.kpi || await lazy("kpi") || {};

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box")
    .style("overflow-y", "auto")
    .style("gap", "1.25rem");

  // Header Section
  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "flex-end");

  const titleGroup = header.append("div");
  titleGroup.append("h2")
    .style("margin", "0 0 0.25rem 0")
    .style("font-size", "1.5rem")
    .style("font-weight", "700")
    .style("letter-spacing", "-0.02em")
    .style("color", "var(--text)")
    .text("LAPD NIBRS Crime Data Visualization Project");

  titleGroup.append("p")
    .style("margin", "0")
    .style("font-size", "0.85rem")
    .style("color", "var(--muted)")
    .text("Incident-level exploration of crime volume, spatial density, victim demographics, and clearance dynamics across Los Angeles.");

  const statusBadge = header.append("div")
    .style("background", "rgba(16, 185, 129, 0.12)")
    .style("border", "1px solid rgba(16, 185, 129, 0.3)")
    .style("color", "#10b981")
    .style("padding", "0.35rem 0.75rem")
    .style("border-radius", "20px")
    .style("font-size", "0.75rem")
    .style("font-weight", "600")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "0.4rem");

  statusBadge.append("span")
    .style("width", "7px")
    .style("height", "7px")
    .style("border-radius", "50%")
    .style("background", "#10b981");
  statusBadge.append("span").text("NIBRS Compliant");

  // Hero KPI Grid
  const kpiGrid = wrapper.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(4, 1fr)")
    .style("gap", "1rem");

  const cards = [
    { 
      label: "TOTAL INCIDENT REPORTS", 
      val: kpi.incidents ? d3.format(",")(kpi.incidents) : "435,318", 
      sub: "Unique CaseNo records", 
      color: "#38bdf8" 
    },
    { 
      label: "TOTAL OFFENSES COUNTED", 
      val: kpi.offenses ? d3.format(",")(kpi.offenses) : "484,949", 
      sub: "~1.11 offenses per incident", 
      color: "#fbbf24" 
    },
    { 
      label: "VICTIMS RECORDED", 
      val: kpi.victims ? d3.format(",")(kpi.victims) : "444,150", 
      sub: "Individual, business & public", 
      color: "#f43f5e" 
    },
    { 
      label: "ANALYSIS WINDOW", 
      val: `${kpi.window_start || "2024-04"} to ${kpi.window_end || "2026-09"}`, 
      sub: "30-month operational window", 
      color: "#10b981" 
    }
  ];

  cards.forEach(c => {
    const card = kpiGrid.append("div")
      .style("background", "var(--bg-card, #1e293b)")
      .style("border", "1px solid var(--border, #334155)")
      .style("border-top", `3px solid ${c.color}`)
      .style("padding", "1rem 1.1rem")
      .style("border-radius", "8px")
      .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)");

    card.append("div")
      .style("font-size", "0.68rem")
      .style("font-weight", "700")
      .style("letter-spacing", "0.05em")
      .style("color", "var(--muted)")
      .text(c.label);

    card.append("div")
      .style("font-size", "1.5rem")
      .style("font-weight", "800")
      .style("color", "var(--text)")
      .style("margin", "0.3rem 0 0.15rem 0")
      .text(c.val);

    card.append("div")
      .style("font-size", "0.72rem")
      .style("color", c.color)
      .style("font-weight", "500")
      .text(c.sub);
  });

  // Main Info Section
  const mainPanel = wrapper.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "1.2fr 1fr")
    .style("gap", "1rem");

  // Relational Architecture Panel
  const specCard = mainPanel.append("div")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1.25rem")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "1rem");

  specCard.append("div").html(`
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem;">
      <h3 style="margin:0; font-size:1.05rem; font-weight:700; color:var(--text);">Relational NIBRS Data Architecture</h3>
      <span style="font-size:0.72rem; font-weight:600; color:var(--accent,#38bdf8); background:rgba(56,189,248,0.12); padding:0.2rem 0.5rem; border-radius:4px;">Join Key: CaseNo</span>
    </div>
    <p style="margin:0; font-size:0.82rem; color:var(--muted); line-height:1.5;">
      Under NIBRS, a single incident (identified by <code style="color:#38bdf8; background:rgba(0,0,0,0.3); padding:2px 5px; border-radius:3px;">CaseNo</code>) links separate offense records and victim entities. This solves legacy UCR limitations where multi-offense events were compressed into a single top charge.
    </p>
  `);

  const diagBox = specCard.append("div")
    .style("background", "rgba(7, 11, 20, 0.6)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "6px")
    .style("padding", "1rem")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 50px 1fr")
    .style("align-items", "center")
    .style("gap", "0.5rem");

  diagBox.append("div").html(`
    <div style="font-size:0.72rem; font-weight:700; color:#38bdf8; margin-bottom:0.3rem;">OFFENSES TABLE</div>
    <div style="font-size:0.85rem; font-weight:700; color:var(--text);">~499k Rows</div>
    <div style="font-size:0.72rem; color:var(--muted); margin-top:0.2rem;">Grain: <code style="color:#e2e8f0;">UniqueNIBRNo</code></div>
    <div style="font-size:0.7rem; color:#94a3b8; margin-top:0.4rem; line-height:1.3;">NIBR Statute, Severity, Premise, Weapon Code, Coordinates</div>
  `);

  diagBox.append("div")
    .style("text-align", "center")
    .style("font-size", "1.2rem")
    .style("color", "var(--accent,#38bdf8)")
    .style("font-weight", "bold")
    .text("⟷");

  diagBox.append("div").html(`
    <div style="font-size:0.72rem; font-weight:700; color:#f43f5e; margin-bottom:0.3rem;">VICTIMS TABLE</div>
    <div style="font-size:0.85rem; font-weight:700; color:var(--text);">~457k Rows</div>
    <div style="font-size:0.72rem; color:var(--muted); margin-top:0.2rem;">Grain: <code style="color:#e2e8f0;">UniqueVictimNo</code></div>
    <div style="font-size:0.7rem; color:#94a3b8; margin-top:0.4rem; line-height:1.3;">Victim Type, Age Group, Sex, Descent, Offense List</div>
  `);

  // Source Endpoints Panel
  const endpointCard = mainPanel.append("div")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1.25rem")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "0.85rem");

  endpointCard.append("h3")
    .style("margin", "0")
    .style("font-size", "1.05rem")
    .style("font-weight", "700")
    .style("color", "var(--text)")
    .text("Primary Open Data Sources");

  const offSrc = endpointCard.append("div")
    .style("background", "rgba(15, 23, 42, 0.6)")
    .style("border", "1px solid var(--border, #334155)")
    .style("padding", "0.85rem")
    .style("border-radius", "6px");

  offSrc.html(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
      <strong style="font-size:0.85rem; color:var(--text);">NIBRS Crime Offenses</strong>
      <a href="https://data.lacity.org/d/k7nn-b2ep" target="_blank" style="font-size:0.72rem; color:#38bdf8; text-decoration:none; font-weight:600; background:rgba(56,189,248,0.1); padding:0.15rem 0.4rem; border-radius:4px;">k7nn-b2ep ↗</a>
    </div>
    <div style="font-size:0.78rem; color:var(--muted); line-height:1.4;">
      Published by LAPD on LA Open Data. Updated continuously with incident details, weapon classifications, and geocoded locations.
    </div>
  `);

  const vicSrc = endpointCard.append("div")
    .style("background", "rgba(15, 23, 42, 0.6)")
    .style("border", "1px solid var(--border, #334155)")
    .style("padding", "0.85rem")
    .style("border-radius", "6px");

  vicSrc.html(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
      <strong style="font-size:0.85rem; color:var(--text);">NIBRS Victim Demographics</strong>
      <a href="https://data.lacity.org/d/gqf2-vm2j" target="_blank" style="font-size:0.72rem; color:#f43f5e; text-decoration:none; font-weight:600; background:rgba(244,63,94,0.1); padding:0.15rem 0.4rem; border-radius:4px;">gqf2-vm2j ↗</a>
    </div>
    <div style="font-size:0.78rem; color:var(--muted); line-height:1.4;">
      Captures victim entity classifications (Individuals, Commercial Businesses, Society) and demography.
    </div>
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
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box")
    .style("overflow-y", "auto");

  const header = wrapper.append("div").style("margin-bottom", "1rem");
  header.append("h2")
    .style("margin", "0 0 0.25rem 0")
    .style("font-size", "1.4rem")
    .style("font-weight", "700")
    .style("color", "var(--text)")
    .text("Dashboard Limitations & Analytical Caveats");

  header.append("p")
    .style("margin", "0")
    .style("font-size", "0.82rem")
    .style("color", "var(--muted)")
    .text("Essential guidelines for accurate data interpretation and public policy application.");

  const grid = wrapper.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fit, minmax(320px, 1fr))")
    .style("gap", "1rem");

  const items = [
    {
      title: "Non-Comparability with Legacy Data",
      desc: "NIBRS counts every individual offense rather than applying the legacy UCR Hierarchy Rule. Figures in this dashboard cannot be directly compared with pre-2024 LAPD reports.",
      tag: "CRITICAL",
      color: "#f43f5e"
    },
    {
      title: "Analysis Window & Reporting Lag",
      desc: "Analysis spans April 2024 through September 2026. September 2026 figures may reflect minor undercounting due to pending incident report ingestion.",
      tag: "TEMPORAL",
      color: "#fbbf24"
    },
    {
      title: "180-Day Case Clearance Cohort",
      desc: "Case clearance and prosecution funnel figures include only cases at least 180 days old to allow investigative maturity.",
      tag: "CLEARANCE",
      color: "#10b981"
    },
    {
      title: "Exclusion of Time-of-Day Analysis",
      desc: "Time of occurrence (Time OCC) contains heavy default entry spikes at 0000 (midnight) and 1200 (noon). Hour-of-day heatmaps are deliberately excluded to prevent bias.",
      tag: "DATA QUALITY",
      color: "#38bdf8"
    },
    {
      title: "Victim Descent vs. Population Rates",
      desc: "Victim descent distributions represent raw counts of reported crime victims. They are not population-adjusted rates and imply no suspect demographics.",
      tag: "DEMOGRAPHICS",
      color: "#a855f7"
    }
  ];

  items.forEach(item => {
    const box = grid.append("div")
      .style("background", "var(--bg-card, #1e293b)")
      .style("border", "1px solid var(--border, #334155)")
      .style("padding", "1rem")
      .style("border-radius", "8px")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("gap", "0.5rem");

    const row = box.append("div").style("display", "flex").style("justify-content", "space-between").style("align-items", "center");
    row.append("strong").style("color", "var(--text)").style("font-size", "0.9rem").text(item.title);
    row.append("span")
      .style("background", `${item.color}20`)
      .style("color", item.color)
      .style("border", `1px solid ${item.color}40`)
      .style("padding", "0.15rem 0.45rem")
      .style("border-radius", "4px")
      .style("font-size", "0.65rem")
      .style("font-weight", "700")
      .text(item.tag);

    box.append("p")
      .style("margin", "0")
      .style("font-size", "0.8rem")
      .style("color", "var(--muted)")
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
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box")
    .style("overflow-y", "auto");

  const header = wrapper.append("div").style("margin-bottom", "1rem");
  header.append("h2")
    .style("margin", "0 0 0.25rem 0")
    .style("font-size", "1.4rem")
    .style("font-weight", "700")
    .style("color", "var(--text)")
    .text("Data Processing & Pipeline Methodology");

  header.append("p")
    .style("margin", "0")
    .style("font-size", "0.82rem")
    .style("color", "var(--muted)")
    .text("Automated data cleaning, deduplication, and primary offense selection rules.");

  const list = wrapper.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "0.85rem");

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
      .style("background", "var(--bg-card, #1e293b)")
      .style("border", "1px solid var(--border, #334155)")
      .style("padding", "1rem 1.25rem")
      .style("border-radius", "8px")
      .style("display", "grid")
      .style("grid-template-columns", "45px 1fr")
      .style("align-items", "center")
      .style("gap", "1rem");

    card.append("div")
      .style("font-size", "1.2rem")
      .style("font-weight", "800")
      .style("color", "var(--accent, #38bdf8)")
      .text(s.num);

    const textGroup = card.append("div");
    textGroup.append("div").style("font-size", "0.9rem").style("font-weight", "700").style("color", "var(--text)").text(s.title);
    textGroup.append("div").style("font-size", "0.8rem").style("color", "var(--muted)").style("margin-top", "0.2rem").style("line-height", "1.4").text(s.desc);
  });
}

// Router Export Aliases
export {
  about as overview,
  caveats as limitations,
  methodology as pipeline,
  about as default
};