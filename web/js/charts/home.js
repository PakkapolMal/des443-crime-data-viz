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

  // 2. KPIs as sentences, stacked on the left: the number, then the sentence that reads on from it.
  const body = container.append("div").attr("class", "kpi-body");
  const list = body.append("div").attr("class", "kpi-list");
  const month = d3.timeFormat("%b %Y"), parseMonth = d3.timeParse("%Y-%m");
  const span = (data.window_start && data.window_end)
    ? `${month(parseMonth(data.window_start))} and ${month(parseMonth(data.window_end))}` : "the analysis window";

  const kpis = [
    { val: data.incidents != null ? d3.format(",")(data.incidents) : "–", lead: true,
      text: `incidents were reported to LAPD between ${span}.` },
    { val: formatPct(data.violent_share_fbi, "–"),
      text: "of those reports were violent: homicide, rape, robbery or aggravated assault." },
    { val: formatPct(data.clearance_arrest_rate, "–"),
      text: "of cases at least 180 days old were cleared by an arrest." },
    { val: formatPct(data.firearm_share, "–"),
      text: "of reports involved a firearm." },
    { val: formatPct(data.dv_share, "–"),
      text: "of reports were flagged as domestic violence." },
  ];

  kpis.forEach(c => {
    const item = list.append("div").attr("class", "kpi");
    item.append("div").attr("class", "kpi-value num").classed("signal", !!c.lead).text(c.val);
    item.append("p").attr("class", "kpi-text").text(c.text);
  });

  // Footer goes in before the plot is measured, so the plot gets its final height.
  const footer = container.append("div").attr("class", "footer");
  footer.append("div").attr("class", "caveat").html('Shares include Apr–Dec 2024, when many property reports are missing. <a href="#about">About →</a>');
  footer.append("div").attr("class", "caption").text(`Snapshot ${data.snapshot_date || "–"} · Source: LAPD NIBRS offense and victim tables`);

  // 3. Monthly trend on the right, drawn at its measured pixel size (no stretched text).
  const trend = body.append("div").attr("class", "trend");
  trend.append("div").attr("class", "label").text("Incidents per month");
  const plotDiv = trend.append("div").attr("class", "trend-plot");

  const rollup = Array.from(
    d3.rollup(Array.isArray(monthlyData) ? monthlyData : [], v => d3.sum(v, d => Number(d.count || 0)), d => d.month),
    ([month, count]) => ({ month, count })
  ).sort((a, b) => String(a.month).localeCompare(String(b.month)));

  const bbox = plotDiv.node()?.getBoundingClientRect() || {};
  const width = Math.max(300, bbox.width || 800);
  const height = Math.max(120, bbox.height || 200);
  const fsSmall = Math.max(12, window.innerWidth * 0.009);
  const margin = { top: 15, right: 25, bottom: fsSmall * 2.5, left: fsSmall * 3.5 };

  const svg = plotDiv.append("svg")
    .attr("width", width)
    .attr("height", height);

  const maxVal = d3.max(rollup, d => d.count) || 1;

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
    .attr("stroke-width", 2)
    .attr("pathLength", 1)
    .attr("class", "draw-in")
    .attr("d", line);

  // Axes: labels at --fs-small, quarterly month ticks.
  const xAxis = d3.axisBottom(xScale)
    .tickValues(xScale.domain().filter((d, i) => i % 3 === 0))
    .tickFormat(m => month(parseMonth(m)));

  const yAxis = d3.axisLeft(yScale)
    .ticks(4)
    .tickFormat(d3.format("~s"));

  svg.append("g")
    .attr("class", "axis axis-lg")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(xAxis);

  svg.append("g")
    .attr("class", "axis axis-lg")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(yAxis);

}
