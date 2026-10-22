/**
 * Chapter 2: #trends — When does it happen?
 * Exports: monthly(el, { data }), weekly(el, { data })
 * Files used: monthly_by_cat.json, dow_by_cat.json, flags_monthly.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/**
 * Screen 1: Monthly multi-line chart by category with interactive toggle legend
 */
export function monthly(el, { data }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data.monthly_by_cat || [];
  const parseTime = d3.timeParse("%Y-%m");

  const formatted = rawData.map(d => ({
    ...d,
    date: parseTime(d.month)
  }));

  const categories = Array.from(new Set(formatted.map(d => d.category))).sort();
  let activeCategories = new Set(categories);

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.5rem 2rem")
    .style("box-sizing", "border-box");

  // Title & Subtitle
  const header = wrapper.append("div").style("margin-bottom", "0.75rem");
  header.append("h2")
    .style("margin", "0 0 0.25rem 0")
    .style("font-size", "1.5rem")
    .style("color", "var(--text)")
    .text("Monthly Crime Trends by Category");

  header.append("p")
    .style("margin", "0")
    .style("font-size", "0.85rem")
    .style("color", "var(--muted)")
    .text("Monthly incident counts across LAPD crime categories (Apr 2024 – Sep 2026). Click buttons to toggle.");

  // Category Toggle Legend
  const legend = wrapper.append("div")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("gap", "0.4rem")
    .style("margin-bottom", "0.75rem");

  categories.forEach((cat) => {
    legend.append("button")
      .attr("class", "cat-toggle")
      .style("background", "var(--bg-card, #1e293b)")
      .style("border", "1px solid var(--border, #334155)")
      .style("color", "var(--text)")
      .style("padding", "0.2rem 0.5rem")
      .style("border-radius", "4px")
      .style("font-size", "0.75rem")
      .style("cursor", "pointer")
      .style("transition", "all 0.2s ease")
      .text(cat)
      .on("click", function () {
        if (activeCategories.has(cat)) {
          if (activeCategories.size > 1) activeCategories.delete(cat);
        } else {
          activeCategories.add(cat);
        }
        d3.select(this)
          .style("opacity", activeCategories.has(cat) ? "1" : "0.35")
          .style("border-color", activeCategories.has(cat) ? "var(--accent, #38bdf8)" : "var(--border, #334155)");
        updateChart();
      });
  });

  // Chart Box
  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("width", "100%")
    .style("position", "relative")
    .style("min-height", "0");

  const width = chartBox.node().clientWidth || 1000;
  const height = chartBox.node().clientHeight || 400;
  const margin = { top: 20, right: 30, bottom: 35, left: 55 };

  const svg = chartBox.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xScale = d3.scaleTime()
    .domain(d3.extent(formatted, d => d.date))
    .range([0, innerW]);

  const yScale = d3.scaleLinear().range([innerH, 0]);

  const xAxisG = g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .attr("color", "var(--muted)");

  const yAxisG = g.append("g")
    .attr("color", "var(--muted)");

  // Sep 2026 shading for partial data
  const sepStart = parseTime("2026-08");
  if (sepStart) {
    const xPos = xScale(sepStart);
    g.append("rect")
      .attr("x", xPos)
      .attr("y", 0)
      .attr("width", innerW - xPos)
      .attr("height", innerH)
      .attr("fill", "var(--muted)")
      .attr("opacity", 0.08);

    g.append("text")
      .attr("x", innerW - 5)
      .attr("y", 15)
      .attr("text-anchor", "end")
      .attr("fill", "var(--muted)")
      .attr("font-size", "0.7rem")
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

    xAxisG.call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.timeFormat("%b %Y")));
    yAxisG.call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format("~s")));

    const lines = g.selectAll(".category-line")
      .data(grouped, d => d[0]);

    lines.exit().remove();

    lines.enter()
      .append("path")
      .attr("class", "category-line")
      .attr("fill", "none")
      .attr("stroke", "var(--accent, #38bdf8)")
      .attr("stroke-width", 2)
      .attr("opacity", 0.85)
      .merge(lines)
      .transition()
      .duration(300)
      .attr("d", d => lineGen(d[1]));
  }

  updateChart();

  // Footer Caveat
  wrapper.append("div")
    .style("margin-top", "0.5rem")
    .style("font-size", "0.75rem")
    .style("color", "var(--muted)")
    .html('Sep 2026 is at ~92% of recent monthly medians due to late reporting. <a href="#about" style="color:var(--accent, #38bdf8)">About data window &rarr;</a>');
}

/**
 * Screen 2: Day-of-week small multiples & Tactical flag selector
 */
export function weekly(el, { data }) {
  const container = d3.select(el);
  container.html("");

  const dowData = data.dow_by_cat || [];
  const flagsData = data.flags_monthly || [];

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayAbbr = ["M", "T", "W", "T", "F", "S", "S"];

  // Tooltip element
  let tooltip = d3.select("body").select(".chart-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("background", "var(--bg-card, #1e293b)")
      .style("border", "1px solid var(--accent, #38bdf8)")
      .style("color", "var(--text, #f8fafc)")
      .style("padding", "0.4rem 0.6rem")
      .style("border-radius", "4px")
      .style("font-size", "0.75rem")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", "1000");
  }

  const wrapper = container.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1fr")
    .style("gap", "1.5rem")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.5rem 2rem")
    .style("box-sizing", "border-box");

  // Left Panel: Day-of-Week Small Multiples
  const leftCol = wrapper.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("min-height", "0");

  leftCol.append("h2")
    .style("margin", "0 0 0.25rem 0")
    .style("font-size", "1.25rem")
    .style("color", "var(--text)")
    .text("Day-of-Week Distribution");

  leftCol.append("p")
    .style("margin", "0 0 0.75rem 0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Scaled to category share (0 = Mon, 1st-of-month default entries excluded).");

  const dowGrid = leftCol.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fill, minmax(130px, 1fr))")
    .style("gap", "0.6rem")
    .style("overflow-y", "auto")
    .style("flex", "1");

  const categories = Array.from(new Set(dowData.map(d => d.category))).sort();

  categories.forEach(cat => {
    const catRows = dowData.filter(d => d.category === cat);
    const total = d3.sum(catRows, d => d.count) || 1;

    const card = dowGrid.append("div")
      .style("background", "var(--bg-card, #1e293b)")
      .style("border", "1px solid var(--border, #334155)")
      .style("border-radius", "6px")
      .style("padding", "0.5rem");

    card.append("div")
      .style("font-size", "0.75rem")
      .style("font-weight", "600")
      .style("color", "var(--text)")
      .style("margin-bottom", "0.25rem")
      .style("white-space", "nowrap")
      .style("overflow", "hidden")
      .style("text-overflow", "ellipsis")
      .text(cat);

    const cardSvg = card.append("svg")
      .attr("width", "100%")
      .attr("height", 68);

    const cardW = 120;
    const xScale = d3.scaleBand().domain(d3.range(7)).range([0, cardW]).padding(0.15);
    const maxShare = d3.max(catRows, d => d.count / total) || 0.2;
    const yScale = d3.scaleLinear().domain([0, maxShare]).range([45, 0]);

    // Draw Bars with Hover Interactivity
    cardSvg.selectAll("rect")
      .data(catRows)
      .enter()
      .append("rect")
      .attr("x", d => xScale(d.dow))
      .attr("y", d => yScale(d.count / total))
      .attr("width", xScale.bandwidth())
      .attr("height", d => 45 - yScale(d.count / total))
      .attr("fill", "var(--accent, #38bdf8)")
      .attr("rx", 2)
      .style("cursor", "pointer")
      .style("transition", "fill 0.15s ease")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "var(--accent-amber, #fbbf24)");
        const sharePct = ((d.count / total) * 100).toFixed(1);
        tooltip
          .html(`<strong>${cat} (${dayNames[d.dow]})</strong><br/>Count: ${d.count.toLocaleString()}<br/>Share: ${sharePct}%`)
          .style("opacity", 1);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill", "var(--accent, #38bdf8)");
        tooltip.style("opacity", 0);
      });

    // Day Labels (M T W T F S S)
    cardSvg.selectAll(".day-label")
      .data(d3.range(7))
      .enter()
      .append("text")
      .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
      .attr("y", 60)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--muted, #94a3b8)")
      .style("font-size", "0.65rem")
      .text(d => dayAbbr[d]);
  });

  // Right Panel: Tactical Flag Indicators
  const rightCol = wrapper.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("min-height", "0");

  rightCol.append("h2")
    .style("margin", "0 0 0.25rem 0")
    .style("font-size", "1.25rem")
    .style("color", "var(--text)")
    .text("Special Flag Monthly Trends");

  rightCol.append("p")
    .style("margin", "0 0 0.75rem 0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Tactical flag counts over time (DV, gang, transit, hate, shots fired).");

  const flags = Array.from(new Set(flagsData.map(d => d.flag))).sort();
  let selectedFlag = flags[0] || "dv";

  const selectorRow = rightCol.append("div")
    .style("margin-bottom", "0.75rem");

  selectorRow.append("label")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .style("margin-right", "0.5rem")
    .text("Select Flag:");

  const flagSelect = selectorRow.append("select")
    .style("background", "var(--bg-card, #1e293b)")
    .style("color", "var(--text)")
    .style("border", "1px solid var(--border, #334155)")
    .style("padding", "0.25rem 0.5rem")
    .style("border-radius", "4px")
    .style("font-size", "0.8rem");

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
  const formattedFlags = flagsData.map(d => ({ ...d, date: parseTime(d.month) }));

  function drawFlagChart() {
    flagBox.html("");
    const w = flagBox.node().clientWidth || 400;
    const h = flagBox.node().clientHeight || 300;
    const margin = { top: 20, right: 20, bottom: 35, left: 50 };

    const svg = flagBox.append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${w} ${h}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    const filtered = formattedFlags.filter(d => d.flag === selectedFlag);

    const xScale = d3.scaleTime().domain(d3.extent(formattedFlags, d => d.date)).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, (d3.max(filtered, d => d.count) || 100) * 1.05]).range([innerH, 0]);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat("%b %Y")))
      .attr("color", "var(--muted)");

    g.append("g")
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format("~s")))
      .attr("color", "var(--muted)");

    const line = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.count))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(filtered)
      .attr("fill", "none")
      .attr("stroke", "var(--accent-red, #f87171)")
      .attr("stroke-width", 2)
      .attr("d", line);
  }

  flagSelect.on("change", function () {
    selectedFlag = this.value;
    drawFlagChart();
  });

  drawFlagChart();
}