/**
 * Chapter 2: #trends — When does it happen?
 * Exports: monthly(el, { data, lazy }), weekly(el, { data, lazy })
 * Files used: monthly_by_cat.json, dow_by_cat.json, flags_monthly.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { CATEGORIES } from "../util.js";

// Animate updates only: the first draw (and every draw under prefers-reduced-motion) sets the final
// state at once, so a chart never depends on a transition finishing to be visible.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const animate = (sel, first) => (first || reduceMotion) ? sel : sel.transition().duration(250);

// Up to MAX_SERIES categories can be on at once (DESIGN.md: series hues, max 3 per chart). A category
// keeps its slot, and so its colour, until it is switched off.
const MAX_SERIES = 3;
function seriesSlots(initial) {
  const slot = new Map(initial.slice(0, MAX_SERIES).map((c, i) => [c, i]));
  return {
    has: c => slot.has(c),
    full: () => slot.size >= MAX_SERIES,
    color: c => `var(--series-${slot.get(c) + 1})`,
    toggle(c) {
      if (slot.has(c)) { if (slot.size > 1) slot.delete(c); return; }
      if (slot.size >= MAX_SERIES) return;
      const free = d3.range(MAX_SERIES).find(i => ![...slot.values()].includes(i));
      slot.set(c, free);
    },
  };
}

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

  const present = new Set(formatted.map(d => d.category));
  const categories = CATEGORIES.filter(c => present.has(c));
  const slots = seriesSlots(["Theft", "Weapons"].filter(c => present.has(c)));

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("gap", "var(--s-3)");

  // Header
  const header = wrapper.append("div");
  header.append("h2").text("Monthly Crime Trends by Category");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text(`Monthly incident counts, Apr 2024 – Sep 2026. Pick up to ${MAX_SERIES} categories to compare.`);

  // Category toggles: a pressed toggle shows its series colour as a swatch (not colour alone: aria-pressed + bone border).
  const legend = wrapper.append("div")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("gap", "var(--s-1)");

  const buttons = legend.selectAll("button")
    .data(categories)
    .join("button")
    .style("display", "inline-flex")
    .style("align-items", "center")
    .style("gap", "var(--s-1)")
    .on("click", (event, cat) => { slots.toggle(cat); updateChart(); });
  buttons.append("span").attr("class", "swatch")
    .style("width", "0.8em").style("height", "0.8em");
  buttons.append("span").text(d => d);

  // Chart Box
  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("position", "relative")
    .style("width", "100%");

  const bbox = chartBox.node()?.getBoundingClientRect() || {};
  const width = bbox.width || 1000;
  const height = bbox.height || 360;
  // Right margin holds the direct labels at line ends (longest category name at --fs-label).
  const fsLabel = Math.max(11, window.innerWidth * 0.00833);
  const labelW = (d3.max(categories, c => c.length) || 20) * fsLabel * 0.62 + 12;
  const margin = { top: 15, right: labelW, bottom: 30, left: 50 };

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
      .style("fill", "var(--bone-60)")
      .text("Sep 2026 (Partial Data)");
  }

  const lineGen = d3.line()
    .x(d => xScale(d.date))
    .y(d => yScale(d.count))
    .curve(d3.curveMonotoneX);

  const linesG = g.append("g");
  const labelsG = g.append("g");

  function updateChart() {
    buttons
      .attr("aria-pressed", c => slots.has(c) ? "true" : "false")
      .property("disabled", c => !slots.has(c) && slots.full())
      .select(".swatch").style("background", c => slots.has(c) ? slots.color(c) : "none")
      .style("border", c => slots.has(c) ? "none" : "var(--rule)");

    const grouped = d3.groups(formatted.filter(d => slots.has(d.category)), d => d.category);
    const maxCount = d3.max(grouped, ([, rows]) => d3.max(rows, d => d.count)) || 1000;
    yScale.domain([0, maxCount * 1.05]);

    xAxisG.call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.timeFormat("%b %Y")));
    animate(yAxisG, firstDraw).call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format("~s")));

    linesG.selectAll(".category-line")
      .data(grouped, d => d[0])
      .join("path")
      .attr("class", "category-line")
      .attr("fill", "none")
      .attr("stroke", d => slots.color(d[0]))
      .attr("stroke-width", 2)
      .call(sel => animate(sel, firstDraw).attr("d", d => lineGen(d[1])));

    // Direct labels at line ends (name + last value), nudged apart so they never overlap.
    const ends = grouped.map(([cat, rows]) => {
      const last = rows[rows.length - 1];
      return { cat, value: last.count, y: yScale(last.count) };
    }).sort((p, q) => p.y - q.y);
    const gap = fsLabel * 1.3;
    ends.forEach((e, i) => { if (i > 0) e.y = Math.max(e.y, ends[i - 1].y + gap); });

    labelsG.selectAll("text")
      .data(ends, d => d.cat)
      .join("text")
      .attr("x", innerW + 8)
      .attr("dy", "0.35em")
      .style("fill", d => slots.color(d.cat))
      .style("font-weight", "700")
      .text(d => `${d.cat} ${d3.format(",")(d.value)}`)
      .call(sel => animate(sel, firstDraw).attr("y", d => d.y));
    firstDraw = false;
  }

  let firstDraw = true;
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
    .style("grid-template-columns", "1.4fr 1fr")
    .style("gap", "var(--s-4)")
    .style("width", "100%")
    .style("height", "100%");

  // Left Panel: one grouped day-of-week bar chart; legend entries pick up to MAX_SERIES categories.
  const leftCol = wrapper.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("min-height", "0");

  leftCol.append("h2").text("Day-of-Week Distribution");
  leftCol.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .style("margin-bottom", "var(--s-2)")
    .text(`Incidents by weekday. Click legend entries to compare up to ${MAX_SERIES} categories.`);

  const present = new Set(dowData.map(d => d.category));
  const categories = CATEGORIES.filter(c => present.has(c));
  const slots = seriesSlots(["Theft", "Minor Assault"].filter(c => present.has(c)));
  const countOf = new Map(dowData.map(d => [`${d.category}|${d.dow}`, Number(d.count || 0)]));

  const body = leftCol.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("display", "grid")
    .style("grid-template-columns", "1fr auto")
    .style("gap", "var(--s-2)");

  const plot = body.append("div").style("min-height", "0").style("position", "relative");

  // Legend (top-right) doubles as the filter: click an entry to toggle it; picked entries show their series colour.
  const picker = body.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "2px");
  const rows = picker.selectAll("button")
    .data(categories)
    .join("button")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "var(--s-1)")
    .style("border", "none")
    .style("padding", "2px 0")
    .style("text-align", "left")
    .on("click", (event, cat) => { slots.toggle(cat); drawDow(); });
  rows.append("span").attr("class", "swatch").style("width", "0.8em").style("height", "0.8em");
  rows.append("span").text(d => d);

  const { width: pw = 400, height: ph = 300 } = plot.node().getBoundingClientRect();
  const dowMargin = { top: 10, right: 10, bottom: 30, left: 50 };
  const dowSvg = plot.append("svg").attr("width", pw).attr("height", ph);
  const dowG = dowSvg.append("g").attr("transform", `translate(${dowMargin.left},${dowMargin.top})`);
  const dowW = Math.max(50, pw - dowMargin.left - dowMargin.right);
  const dowH = Math.max(50, ph - dowMargin.top - dowMargin.bottom);
  const x0 = d3.scaleBand().domain(d3.range(7)).range([0, dowW]).paddingInner(0.2);
  const yDow = d3.scaleLinear().range([dowH, 0]);
  dowG.append("g").attr("class", "axis").attr("transform", `translate(0,${dowH})`)
    .call(d3.axisBottom(x0).tickFormat(i => dayNames[i]).tickSizeOuter(0));
  const yAxisDow = dowG.append("g").attr("class", "axis");
  const barsG = dowG.append("g");

  function drawDow() {
    rows
      .attr("aria-pressed", c => slots.has(c) ? "true" : "false")
      .property("disabled", c => !slots.has(c) && slots.full());
    rows.select(".swatch")
      .style("background", c => slots.has(c) ? slots.color(c) : "none")
      .style("border", c => slots.has(c) ? "none" : "var(--rule)");

    // Raw counts on one shared axis (owner's decision); exact numbers are in the tooltip.
    const picked = categories.filter(c => slots.has(c));
    const x1 = d3.scaleBand().domain(picked).range([0, x0.bandwidth()]).padding(0.08);
    const cells = d3.range(7).flatMap(dow => picked.map(cat => ({ dow, cat, count: countOf.get(`${cat}|${dow}`) || 0 })));
    yDow.domain([0, (d3.max(cells, d => d.count) || 100) * 1.05]);
    animate(yAxisDow, firstDow).call(d3.axisLeft(yDow).ticks(5).tickFormat(d3.format("~s")));

    barsG.selectAll("rect")
      .data(cells, d => `${d.cat}|${d.dow}`)
      .join("rect")
      .attr("fill", d => slots.color(d.cat))
      .style("cursor", "pointer")
      .on("mouseover mousemove", (event, d) => {
        const total = d3.sum(d3.range(7), i => countOf.get(`${d.cat}|${i}`) || 0) || 1;
        tooltip
          .html(`<strong>${d.cat}</strong><br/>${dayNames[d.dow]}: <strong>${d3.format(",")(d.count)}</strong> incidents<br/>${(d.count / total * 100).toFixed(1)}% of this category's week`)
          .style("opacity", 1)
          .style("left", (event.clientX + 12) + "px")
          .style("top", (event.clientY - 28) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0))
      .call(sel => animate(sel, firstDow)
        .attr("x", d => x0(d.dow) + x1(d.cat))
        .attr("width", x1.bandwidth())
        .attr("y", d => yDow(d.count))
        .attr("height", d => dowH - yDow(d.count)));
    firstDow = false;
  }
  let firstDow = true;
  drawDow();

  // Right Panel: Tactical Flag Indicators
  const rightCol = wrapper.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("min-height", "0");

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
      // Quarterly ticks in a short format, thinned to what fits (each label ≈ 7 chars at --fs-label).
      .call(d3.axisBottom(xScale)
        .ticks(d3.timeMonth.every(innerW / (Math.max(11, window.innerWidth * 0.00833) * 0.62 * 7 + 24) >= 10 ? 3 : 6))
        .tickFormat(d3.timeFormat("%b '%y")));

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