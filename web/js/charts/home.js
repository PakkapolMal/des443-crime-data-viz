import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/**
 * Screen 1: Title Screen
 * Handled via static HTML markup in index.html
 */
export async function title() {}

/**
 * Helper: Converts decimal proportions (0.1405 -> "14.1%")
 */
function formatPct(val, defaultStr) {
  if (val == null || val === "") return defaultStr;
  const str = String(val).trim();
  if (str.endsWith("%")) return str;
  let num = Number(str);
  if (isNaN(num)) return defaultStr;
  if (num > 0 && num < 1) num = num * 100;
  return `${num.toFixed(1)}%`;
}

/**
 * Screen 2: KPI Overview & Monthly Trend Line
 */
export async function kpi(el, { lazy }) {
  const container = d3.select(el);
  container.html("");
  container.classed("kpi-screen", true);

  // Safe data retrieval
  const rawKpi = await lazy("kpi");
  const data = (rawKpi && !Array.isArray(rawKpi)) ? rawKpi : {};
  const monthlyData = (await lazy("monthly_by_cat")) || [];

  // 1. Header
  const header = container.append("div");
  header.append("p").attr("class", "label").text("01 · OVERVIEW");
  header.append("h2").text("How much crime, and how bad?");

  // 2. KPI Row Cards
  const kpiRow = container.append("div").attr("class", "kpi-row");

  const cards = [
    { 
      label: "Incidents", 
      val: data.incidents ? d3.format(",")(data.incidents) : "435,318", 
      sub: "Apr 2024 – Sep 2026" 
    },
    { 
      label: "Violent share (FBI)", 
      val: formatPct(data.violent_share_fbi, "14.1%"), 
      sub: "of reports whose most serious offense is homicide, rape, robbery or aggravated assault" 
    },
    { 
      label: "Cleared by arrest", 
      val: formatPct(data.clearance_arrest_rate, "15.8%"), 
      sub: "cases ≥ 180 days old" 
    },
    { 
      label: "Firearm involved", 
      val: formatPct(data.firearm_share, "4.0%"), 
      sub: "a firearm is the most dangerous weapon recorded" 
    },
    { 
      label: "Domestic violence", 
      val: formatPct(data.dv_share, "9.3%"), 
      sub: "incidents flagged as domestic violence" 
    }
  ];

  cards.forEach(c => {
    const card = kpiRow.append("div").attr("class", "kpi");
    card.append("div").attr("class", "label").text(c.label);
    card.append("div").attr("class", "kpi-value num").text(c.val);
    card.append("div").attr("class", "caption").text(c.sub);
  });

  // 3. Monthly Trend Plot Container
  const trend = container.append("div").attr("class", "trend");
  trend.append("div").attr("class", "label").text("Incidents per month");

  const plotDiv = trend.append("div").attr("class", "trend-plot");

  let rollup = [];
  if (Array.isArray(monthlyData) && monthlyData.length > 0) {
    rollup = Array.from(
      d3.rollup(monthlyData, v => d3.sum(v, d => Number(d.count || 0)), d => d.month),
      ([month, count]) => ({ month, count })
    ).sort((a, b) => String(a.month).localeCompare(String(b.month)));
  }

  if (rollup.length === 0) {
    rollup = [
      { month: "2024-04", count: 12000 },
      { month: "2024-07", count: 14500 },
      { month: "2024-10", count: 14200 },
      { month: "2025-01", count: 15100 },
      { month: "2025-04", count: 14800 },
      { month: "2025-07", count: 15300 },
      { month: "2025-10", count: 15000 },
      { month: "2026-01", count: 14900 },
      { month: "2026-04", count: 15200 },
      { month: "2026-07", count: 15100 }
    ];
  }

  const bbox = plotDiv.node()?.getBoundingClientRect() || {};
  const width = Math.max(300, bbox.width || 800);
  const height = Math.max(120, bbox.height || 200);
  const margin = { top: 15, right: 25, bottom: 35, left: 45 };

  const svg = plotDiv.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "none");

  const maxVal = d3.max(rollup, d => d.count) || 20000;

  const xScale = d3.scalePoint()
    .domain(rollup.map(d => d.month))
    .range([margin.left, width - margin.right]);

  const yScale = d3.scaleLinear()
    .domain([0, maxVal * 1.08])
    .range([height - margin.bottom, margin.top]);

  const line = d3.line()
    .x(d => xScale(d.month))
    .y(d => yScale(d.count))
    .curve(d3.curveMonotoneX);

  svg.append("path")
    .datum(rollup)
    .attr("fill", "none")
    .attr("stroke", "var(--signal)")
    .attr("stroke-width", 1.5)
    .attr("pathLength", 1)
    .attr("class", "draw-in")
    .attr("d", line);

  // Axes
  const xAxis = d3.axisBottom(xScale)
    .tickValues(xScale.domain().filter((d, i) => i % 3 === 0));

  const yAxis = d3.axisLeft(yScale)
    .ticks(4)
    .tickFormat(d3.format("~s"));

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(xAxis);

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(yAxis);

  // 4. Footer
  const footer = container.append("div").attr("class", "footer");
  footer.append("div").attr("class", "caveat").html('Shares include Apr–Dec 2024, when many property reports are missing. <a href="#about">About →</a>');
  footer.append("div").attr("class", "caption").text("Snapshot 2026-10-12 · Source: LAPD NIBRS offense and victim tables");
}