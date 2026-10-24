/**
 * Chapter 2: #trends — When does it happen?
 * Exports: monthly(el, { data, lazy }), weekly(el, { data, lazy })
 * Files used: monthly_by_cat.json, dow_by_cat.json, flags_monthly.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { CATEGORIES } from "../util.js";

/**
 * Screen 1: Monthly multi-line chart by category with interactive toggle legend
 */
export async function monthly(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  // Support both pre-loaded data object and lazy fetcher
  const rawData = data?.monthly_by_cat || (await lazy?.("monthly_by_cat")) || [];
  const parseTime = d3.timeParse("%Y-%m");

  const formatted = rawData.map(d => ({
    ...d,
    count: Number(d.count || 0),
    date: parseTime(d.month)
  })).filter(d => d.date != null);

  const categories = Array.from(new Set(formatted.map(d => d.category))).sort();
  let activeCategories = new Set(categories);

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("gap", "var(--s-3)");

  // Header
  const header = wrapper.append("div");
  header.append("p").attr("class", "label").text("02 · WHEN");
  header.append("h2").text("Monthly Crime Trends by Category");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Monthly incident counts across LAPD crime categories (Apr 2024 – Sep 2026). Click buttons to toggle.");

  // Category Toggle Legend
  const legend = wrapper.append("div")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("gap", "var(--s-1)");

  categories.forEach((cat) => {
    legend.append("button")
      .attr("aria-pressed", "true")
      .text(cat)
      .on("click", function () {
        if (activeCategories.has(cat)) {
          if (activeCategories.size > 1) activeCategories.delete(cat);
        } else {
          activeCategories.add(cat);
        }
        d3.select(this).attr("aria-pressed", activeCategories.has(cat) ? "true" : "false");
        updateChart();
      });
  });

  // Chart Box
  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("position", "relative")
    .style("width", "100%");

  const bbox = chartBox.node()?.getBoundingClientRect() || {};
  const width = bbox.width || 1000;
  const height = bbox.height || 360;
  const margin = { top: 15, right: 30, bottom: 30, left: 50 };

  const svg = chartBox.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const innerW = Math.max(100, width - margin.left - margin.right);
  const innerH = Math.max(100, height - margin.top - margin.bottom);

  const xExtent = d3.extent(formatted, d => d.date);
  const xScale = d3.scaleTime()
    .domain(xExtent[0] ? xExtent : [new Date(2024, 3, 1), new Date(2026, 8, 1)])
    .range([0, innerW]);

  const yScale = d3.scaleLinear().range([innerH, 0]);

  const xAxisG = g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`);

  const yAxisG = g.append("g")
    .attr("class", "axis");

  // Sep 2026 shading for partial data
  const sepStart = parseTime("2026-08");
  if (sepStart && xScale(sepStart) < innerW) {
    const xPos = xScale(sepStart);
    g.append("rect")
      .attr("x", xPos)
      .attr("y", 0)
      .attr("width", innerW - xPos)
      .attr("height", innerH)
      .attr("fill", "var(--surface)")
      .attr("opacity", 0.6);

    g.append("text")
      .attr("x", innerW - 5)
      .attr("y", 15)
      .attr("text-anchor", "end")
      .attr("fill", "var(--bone-60)")
      .text("Sep 2026 (Partial Data)");
  }

  const lineGen = d3.line()
    .x(d => xScale(d.date))
    .y(d => yScale(d.count))
    .curve(d3.curveMonotoneX);

  function updateChart() {
    const filtered = formatted.filter(d => activeCategories.has(d.category));
    const grouped = d3.groups(filtered, d => d.category);

    const maxCount = d3.max(filtered, d => d.count) || 1000;
    yScale.domain([0, maxCount * 1.05]);

    xAxisG.call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.timeFormat("%b %Y")));
    yAxisG.call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format("~s")));

    const lines = g.selectAll(".category-line")
      .data(grouped, d => d[0]);

    lines.exit().remove();

    lines.enter()
      .append("path")
      .attr("class", "category-line")
      .attr("fill", "none")
      .attr("stroke", d => d[0] === "FRAUD/IDENTITY" ? "var(--signal)" : "var(--bone-60)")
      .attr("stroke-width", d => d[0] === "FRAUD/IDENTITY" ? 2 : 1.2)
      .attr("opacity", d => d[0] === "FRAUD/IDENTITY" ? 1 : 0.6)
      .merge(lines)
      .transition()
      .duration(250)
      .attr("d", d => lineGen(d[1]));
  }

  updateChart();

  // Footer Caveat
  wrapper.append("div")
    .attr("class", "footer")
    .html('<div class="caveat">Sep 2026 is at ~92% of recent monthly medians due to late reporting. <a href="#about">About data window →</a></div>');
}

/**
 * Screen 2: Day-of-week small multiples & Tactical flag selector
 */
export async function weekly(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const dowData = data?.dow_by_cat || (await lazy?.("dow_by_cat")) || [];
  const flagsData = data?.flags_monthly || (await lazy?.("flags_monthly")) || [];

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayAbbr = ["M", "T", "W", "T", "F", "S", "S"];

  // Global Tooltip
  let tooltip = d3.select("body").select("#tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("id", "tooltip")
      .attr("class", "tooltip")
      .style("opacity", 0);
  }

  const wrapper = container.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1fr")
    .style("gap", "var(--s-4)")
    .style("width", "100%")
    .style("height", "100%");

  // Left Panel: Day-of-Week Small Multiples
  const leftCol = wrapper.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("min-height", "0");

  leftCol.append("p").attr("class", "label").text("02 · WHEN");
  leftCol.append("h2").text("Day-of-Week Distribution");
  leftCol.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .style("margin-bottom", "var(--s-2)")
    .text("Share of each category's incidents by weekday. The 8 largest categories, in severity order.");

  // ~8 panels fit one screen without scrolling (DESIGN.md: few series per chart).
  const totals = d3.rollup(dowData, v => d3.sum(v, d => Number(d.count || 0)), d => d.category);
  const top8 = new Set([...totals].sort((a, b) => b[1] - a[1]).slice(0, 8).map(d => d[0]));
  const categories = CATEGORIES.filter(c => top8.has(c));

  const dowGrid = leftCol.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(4, 1fr)")
    .style("grid-template-rows", "repeat(2, 1fr)")
    .style("gap", "var(--s-2)")
    .style("flex", "1")
    .style("min-height", "0");

  categories.forEach(cat => {
    const catRows = dowData.filter(d => d.category === cat);
    const total = d3.sum(catRows, d => Number(d.count || 0)) || 1;

    const card = dowGrid.append("div")
      .style("background", "var(--surface)")
      .style("padding", "var(--s-2)")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("min-height", "0");

    card.append("div")
      .attr("class", "label")
      .style("margin-bottom", "var(--s-1)")
      .text(cat);

    const plot = card.append("div").style("flex", "1").style("min-height", "0");
    const { width: cardW = 110, height: cardH = 60 } = plot.node().getBoundingClientRect();
    const labelH = 22;
    const cardSvg = plot.append("svg")
      .attr("width", cardW)
      .attr("height", cardH);

    const xScale = d3.scaleBand().domain(d3.range(7)).range([0, cardW]).padding(0.2);
    const maxShare = d3.max(catRows, d => Number(d.count || 0) / total) || 0.2;
    const barH = Math.max(10, cardH - labelH);
    const yScale = d3.scaleLinear().domain([0, maxShare]).range([barH, 0]);

    cardSvg.selectAll("rect")
      .data(catRows)
      .enter()
      .append("rect")
      .attr("x", d => xScale(d.dow))
      .attr("y", d => yScale(Number(d.count || 0) / total))
      .attr("width", xScale.bandwidth())
      .attr("height", d => Math.max(0, barH - yScale(Number(d.count || 0) / total)))
      .attr("fill", "var(--bone)")
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "var(--signal)");
        const sharePct = ((Number(d.count || 0) / total) * 100).toFixed(1);
        tooltip
          .html(`<strong>${cat} (${dayNames[d.dow]})</strong><br/>Count: ${Number(d.count).toLocaleString()}<br/>Share: ${sharePct}%`)
          .style("opacity", 1);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill", "var(--bone)");
        tooltip.style("opacity", 0);
      });

    cardSvg.selectAll(".day-label")
      .data(d3.range(7))
      .enter()
      .append("text")
      .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
      .attr("y", cardH - 4)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--bone-60)")
      .text(d => dayAbbr[d]);
  });

  // Right Panel: Tactical Flag Indicators
  const rightCol = wrapper.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("min-height", "0");

  rightCol.append("p").attr("class", "label").text("TACTICAL FLAGS");
  rightCol.append("h2").text("Special Flag Monthly Trends");
  rightCol.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .style("margin-bottom", "var(--s-2)")
    .text("Tactical flag counts over time (DV, gang, transit, hate, shots fired).");

  const flags = Array.from(new Set(flagsData.map(d => d.flag))).sort();
  let selectedFlag = flags[0] || "dv";

  const selectorRow = rightCol.append("div")
    .style("margin-bottom", "var(--s-3)")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "var(--s-2)");

  selectorRow.append("span")
    .attr("class", "label")
    .text("Select Flag:");

  const flagSelect = selectorRow.append("select")
    .style("background", "var(--surface)")
    .style("color", "var(--bone)")
    .style("border", "var(--rule)")
    .style("font-family", "var(--font-mono)")
    .style("font-size", "var(--fs-label)")
    .style("padding", "var(--s-1) var(--s-2)");

  flags.forEach(f => {
    flagSelect.append("option")
      .attr("value", f)
      .text(f.toUpperCase().replace("_", " "));
  });

  const flagBox = rightCol.append("div")
    .style("flex", "1")
    .style("position", "relative")
    .style("min-height", "0");

  const parseTime = d3.timeParse("%Y-%m");
  const formattedFlags = flagsData.map(d => ({
    ...d,
    count: Number(d.count || 0),
    date: parseTime(d.month)
  })).filter(d => d.date != null);

  function drawFlagChart() {
    flagBox.html("");
    const bbox = flagBox.node()?.getBoundingClientRect() || {};
    const w = bbox.width || 400;
    const h = bbox.height || 300;
    const margin = { top: 15, right: 20, bottom: 30, left: 50 };

    const svg = flagBox.append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${w} ${h}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const innerW = Math.max(50, w - margin.left - margin.right);
    const innerH = Math.max(50, h - margin.top - margin.bottom);

    const filtered = formattedFlags.filter(d => d.flag === selectedFlag);

    const xExtent = d3.extent(formattedFlags, d => d.date);
    const xScale = d3.scaleTime()
      .domain(xExtent[0] ? xExtent : [new Date(2024, 3, 1), new Date(2026, 8, 1)])
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([0, (d3.max(filtered, d => d.count) || 100) * 1.05])
      .range([innerH, 0]);

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat("%b %Y")));

    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format("~s")));

    const line = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.count))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(filtered)
      .attr("fill", "none")
      .attr("stroke", "var(--signal)")
      .attr("stroke-width", 1.8)
      .attr("d", line);
  }

  flagSelect.on("change", function () {
    selectedFlag = this.value;
    drawFlagChart();
  });

  drawFlagChart();
}