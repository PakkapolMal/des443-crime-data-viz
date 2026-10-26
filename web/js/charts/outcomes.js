/**
 * Chapter 8: #outcomes — Case Outcomes & Reporting Lag
 * Exports: outcomes, funnel, lag (with router aliases: outcomeByCat, clearanceFunnel, reportLag, default)
 * Data sources: outcome_by_cat.json, outcome_funnel.json, report_lag_by_cat.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { sankey, sankeyLeft, sankeyLinkHorizontal } from "https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/+esm";
import { legend } from "../util.js";

/**
 * Screen 1: Outcome Breakdown by Category (100% Stacked Bar)
 */
export async function outcomes(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.outcome_by_cat || (await lazy?.("outcome_by_cat")) || [];

  // Global Tooltip
  let tooltip = d3.select("body").select("#tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("id", "tooltip")
      .attr("class", "tooltip")
      .style("opacity", 0);
  }

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("gap", "var(--s-2)");

  // Header & Legend
  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "flex-end");

  const titleGroup = header.append("div");
  titleGroup.append("h2").text("Case Outcomes by Crime Category");
  titleGroup.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Case clearance distribution across 180-day mature incident cohorts.");

  const legend = header.append("div")
    .style("display", "flex")
    .style("gap", "var(--s-2)")
    .style("align-items", "center");

  const outcomeColors = {
    "Cleared by Arrest": "var(--signal)",
    "Cleared Other": "var(--bone)",
    "Under Review": "var(--bone-60)",
    "Open": "var(--hairline)"
  };

  Object.entries(outcomeColors).forEach(([label, color]) => {
    const item = legend.append("div").style("display", "flex").style("align-items", "center").style("gap", "4px");
    item.append("span")
      .style("width", "10px")
      .style("height", "10px")
      .style("background", color);
    item.append("span")
      .attr("class", "label")
      .style("color", "var(--bone)")
      .text(label);
  });

  // Inspector Banner
  const statsBanner = wrapper.append("div")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("padding", "var(--s-2) var(--s-3)")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "center")
    .style("font-family", "var(--font-mono)")
    .style("font-size", "var(--fs-small)");

  function updateBanner(d, out, pct) {
    if (!d) {
      statsBanner.html(`
        <span class="label">OUTCOME INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover over any status segment to inspect clearance volume and share.</span>
      `);
    } else {
      statsBanner.html(`
        <div>
          <span class="label">CATEGORY:</span>
          <strong style="color:var(--bone); margin-left:4px;">${d.category.toUpperCase()}</strong>
          <span style="color:var(--bone-60); margin-left:12px;">Status: ${out}</span>
        </div>
        <div>
          <span class="label">INCIDENTS:</span>
          <strong class="num" style="margin-left:4px; color:var(--bone);">${d3.format(",")(d[out] || 0)}</strong>
          <span class="label" style="margin-left:12px;">CLEARANCE SHARE:</span>
          <strong class="num signal" style="margin-left:4px;">${pct.toFixed(1)}%</strong>
        </div>
      `);
    }
  }
  updateBanner(null);

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("position", "relative")
    .style("overflow", "hidden");

  wrapper.append("p")
    .attr("class", "caption")
    .style("font-style", "italic")
    .text("Note: Clearance figures cover cases at least 180 days old as of snapshot date to allow investigation maturity.");

  const categories = Array.from(new Set(rawData.map(d => d.category))).filter(Boolean).sort();
  const outcomeTypes = ["Cleared by Arrest", "Cleared Other", "Under Review", "Open"];

  const stackedData = categories.map(cat => {
    const catRows = rawData.filter(d => d.category === cat);
    const total = d3.sum(catRows, d => Number(d.count || 0)) || 1;
    const item = { category: cat, total };
    
    outcomeTypes.forEach(out => {
      const match = catRows.find(d => (d.outcome || d.status) === out);
      const cnt = match ? Number(match.count || 0) : 0;
      item[out] = cnt;
      item[`${out}_pct`] = (cnt / total) * 100;
    });

    return item;
  }).sort((a, b) => (b["Cleared by Arrest_pct"] + b["Cleared Other_pct"]) - (a["Cleared by Arrest_pct"] + a["Cleared Other_pct"]));

  const bbox = chartBox.node()?.getBoundingClientRect() || {};
  const width = bbox.width || 800;
  const height = bbox.height || 340;
  const margin = { top: 20, right: 30, bottom: 30, left: 210 };

  const svg = chartBox.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const yScale = d3.scaleBand()
    .domain(stackedData.map(d => d.category))
    .range([margin.top, height - margin.bottom])
    .padding(0.25);

  const xScale = d3.scaleLinear()
    .domain([0, 100])
    .range([margin.left, width - margin.right]);

  svg.append("g")
    .attr("transform", `translate(${margin.left - 8}, 0)`)
    .call(d3.axisLeft(yScale).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text")
    .attr("fill", "var(--bone)")
    .style("font-size", "var(--fs-small)")
    .style("font-family", "var(--font-mono)");

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => `${d}%`));

  stackedData.forEach(d => {
    let currentX = margin.left;
    const yPos = yScale(d.category);
    const bHeight = yScale.bandwidth();

    outcomeTypes.forEach(out => {
      const pct = d[`${out}_pct`] || 0;
      const barWidth = Math.max(0, (pct / 100) * (width - margin.left - margin.right));

      if (barWidth > 0) {
        svg.append("rect")
          .attr("x", currentX)
          .attr("y", yPos)
          .attr("width", barWidth)
          .attr("height", bHeight)
          .attr("fill", outcomeColors[out] || "var(--hairline)")
          .attr("rx", 1)
          .style("cursor", "pointer")
          .on("mouseover", () => {
            updateBanner(d, out, pct);
            tooltip.html(`
              <strong style="color:var(--bone);">${d.category}</strong><br/>
              Status: <strong>${out}</strong><br/>
              Count: <strong>${d3.format(",")(d[out] || 0)}</strong><br/>
              Share: <strong style="color:var(--signal);">${pct.toFixed(1)}%</strong>
            `).style("opacity", 1);
          })
          .on("mousemove", event => {
            tooltip
              .style("left", (event.clientX + 14) + "px")
              .style("top", (event.clientY - 28) + "px");
          })
          .on("mouseout", () => {
            updateBanner(null);
            tooltip.style("opacity", 0);
          });

        currentX += barWidth;
      }
    });
  });
}

/**
 * Screen 2: Case Clearance & Prosecution Funnel (Flat 2D Layout)
 */
export async function funnel(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.outcome_funnel || (await lazy?.("outcome_funnel")) || [];
  const stage = Object.fromEntries((Array.isArray(rawData) ? rawData : []).map(d => [d.stage, Number(d.count || 0)]));

  let tooltip = d3.select("body").select("#tooltip");

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("gap", "var(--s-2)");

  const header = wrapper.append("div");
  header.append("h2").text("What happens after a report");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Where reported cases end up. Clearance cohort: cases at least 180 days old at the snapshot. \"Not cleared\" means no arrest or other clearance recorded yet; some cases may still be under investigation.");

  // The 5 stage totals form a tree (CONTEXT_NIBRS.md PROSECUTION_STAGE): Filed is a subset of
  // Cleared by Arrest, Rejected a subset of Cleared Other. The remainders are derived here.
  const reported = stage["Reported"] || 0;
  const arrest = stage["Cleared by Arrest"] || 0;
  const other = (stage["Cleared"] || 0) - arrest;
  const filed = stage["Filed"] || 0;
  const rejected = stage["Rejected"] || 0;
  const flows = [
    ["Reported", "Cleared by arrest", arrest],
    ["Reported", "Cleared other", other],
    ["Reported", "Not cleared", reported - (stage["Cleared"] || 0)],
    ["Cleared by arrest", "Filed", filed],
    ["Cleared by arrest", "No filing recorded", arrest - filed],
    ["Cleared other", "Rejected by DA/CA", rejected],
    ["Cleared other", "Other clearance", other - rejected],
  ];
  if (!reported || flows.some(f => f[2] < 0)) {
    wrapper.append("p").attr("class", "caption").text("Outcome data is missing or inconsistent; see #about.");
    return;
  }

  // Two emphases, everything else dimmed: "Not cleared" is the red signal (its band is ~3/4 of the
  // chart, so the band uses the darker fill at partial opacity and full red sits on the node and number);
  // "Filed" is full-strength bone. No new hue (DESIGN.md: one hue = one meaning).
  const SIGNAL = "Not cleared", BRIGHT = "Filed";
  const linkStroke = l => l.target.name === SIGNAL ? "var(--signal-fill)" : "var(--bone)";
  const linkOpacity = l => l.target.name === SIGNAL ? 0.55 : l.target.name === BRIGHT ? 0.9 : 0.15;
  const nodeFill = d => d.name === SIGNAL ? "var(--signal)"
    : (d.name === BRIGHT || d.depth === 0) ? "var(--bone)" : "var(--bone-60)";

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("position", "relative");

  const { width = 900, height = 420 } = chartBox.node().getBoundingClientRect();
  const k = Math.max(1, window.innerWidth / 1280);
  const fsLabel = Math.max(11, window.innerWidth * 0.00833);
  const names = ["Reported", "Cleared by arrest", "Cleared other", "Not cleared",
    "Filed", "No filing recorded", "Rejected by DA/CA", "Other clearance"];
  const pctOf = (v, base) => `${(v / base * 100).toFixed(1)}%`;
  const nodeValue = n => n === "Reported" ? reported : d3.sum(flows.filter(f => f[1] === n), f => f[2]);
  const numbers = n => `  ${d3.format(",")(nodeValue(n))} · ${pctOf(nodeValue(n), reported)}`;
  // Margins fit the longest label on each side (mono ≈ 0.62em/char at --fs-label, bold name a little wider).
  const textW = n => (n.length * 1.05 + numbers(n).length) * fsLabel * 0.62 + 10;
  const margin = { top: 10, right: d3.max(names.slice(1), textW), bottom: 10, left: textW("Reported") };
  const graph = sankey()
    .nodeId(d => d.name)
    .nodeWidth(14 * k)
    .nodePadding(22 * k)
    .nodeSort(null) // keep the input order so the story path sits on top
    .nodeAlign(sankeyLeft) // "Not cleared" stays beside the other first outcomes, not pushed to the end
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])({
      nodes: names.map(name => ({ name })),
      links: flows.map(([source, target, value]) => ({ source, target, value })),
    });

  const svg = chartBox.append("svg")
    .attr("width", width)
    .attr("height", height);

  const tip = (event, html) => tooltip.html(html).style("opacity", 1)
    .style("left", (event.clientX + 14) + "px").style("top", (event.clientY - 28) + "px");
  const hide = () => tooltip.style("opacity", 0);

  svg.append("g")
    .attr("fill", "none")
    .selectAll("path")
    .data(graph.links)
    .join("path")
    .attr("d", sankeyLinkHorizontal())
    .attr("stroke", linkStroke)
    .attr("stroke-opacity", linkOpacity)
    .attr("stroke-width", l => Math.max(1, l.width))
    .style("cursor", "pointer")
    .on("mouseover mousemove", (event, l) => tip(event, `
      <strong>${l.source.name} → ${l.target.name}</strong><br/>
      <strong>${d3.format(",")(l.value)}</strong> cases<br/>
      ${pctOf(l.value, l.source.value)} of ${l.source.name.toLowerCase()} · ${pctOf(l.value, reported)} of reported`))
    .on("mouseout", hide);

  const node = svg.append("g")
    .selectAll("g")
    .data(graph.nodes)
    .join("g");

  node.append("rect")
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("width", d => d.x1 - d.x0)
    .attr("height", d => Math.max(1, d.y1 - d.y0))
    .attr("fill", nodeFill)
    .on("mouseover mousemove", (event, d) => tip(event, `
      <strong>${d.name}</strong><br/>
      <strong>${d3.format(",")(d.value)}</strong> cases · ${pctOf(d.value, reported)} of reported`))
    .on("mouseout", hide);

  // Direct labels: the first column to the left of its node, the others to the right.
  node.append("text")
    .attr("x", d => d.depth === 0 ? d.x0 - 8 : d.x1 + 8)
    .attr("y", d => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.depth === 0 ? "end" : "start")
    .attr("fill", "var(--bone)")
    .style("paint-order", "stroke")
    .style("stroke", "var(--bg)")
    .style("stroke-width", "3px")
    .style("pointer-events", "none")
    .call(t => t.append("tspan").style("font-weight", "700").text(d => d.name))
    .call(t => t.append("tspan").attr("class", "num").attr("fill", d => d.name === BRIGHT ? "var(--bone)" : "var(--bone-60)")
      .text(d => numbers(d.name)));

  // Key statistic under the "Not cleared" label: red text only at large bold size (DESIGN.md accessibility).
  const nc = graph.nodes.find(d => d.name === SIGNAL);
  if (nc) {
    svg.append("text")
      .attr("x", nc.x1 + 8)
      .attr("y", (nc.y0 + nc.y1) / 2 + fsLabel * 1.2)
      .attr("dy", "0.9em")
      .attr("class", "num")
      .attr("fill", "var(--signal)")
      .style("font-size", "var(--fs-h3)")
      .style("font-weight", "700")
      .text(`${pctOf(nc.value, reported)} not cleared`);
  }
}

/**
 * Screen 3: Reporting Lag Days by Category (Non-Colliding Badge & Label Layout)
 */
export async function lag(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.report_lag_by_cat || (await lazy?.("report_lag_by_cat")) || [];

  // Global Tooltip
  let tooltip = d3.select("body").select("#tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("id", "tooltip")
      .attr("class", "tooltip")
      .style("opacity", 0);
  }

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("gap", "var(--s-2)");

  const header = wrapper.append("div");
  header.append("h2").text("Reporting Lag Days by Crime Category");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Days elapsed between offense occurrence date and formal police report date.");

  // Inspector Banner
  const statsBanner = wrapper.append("div")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("padding", "var(--s-2) var(--s-3)")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "center")
    .style("font-family", "var(--font-mono)")
    .style("font-size", "var(--fs-small)");

  function updateBanner(d) {
    if (!d) {
      statsBanner.html(`
        <span class="label">LAG INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover over any category boxplot to inspect median reporting lag and IQR.</span>
      `);
    } else {
      statsBanner.html(`
        <div>
          <span class="label">CATEGORY:</span>
          <strong style="color:var(--bone); margin-left:4px;">${d.category.toUpperCase()}</strong>
        </div>
        <div>
          <span class="label">MEDIAN LAG:</span>
          <strong class="num signal" style="margin-left:4px;">${d.median} DAYS</strong>
          <span class="label" style="margin-left:12px;">Q1 - Q3 IQR:</span>
          <strong class="num" style="margin-left:4px; color:var(--bone);">${d.q1} - ${d.q3} DAYS</strong>
        </div>
      `);
    }
  }
  updateBanner(null);

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("background", "var(--surface)")
    .style("padding", "var(--s-2)")
    .style("position", "relative")
    .style("overflow", "hidden");

  // Box colour = median lag band (same thresholds as barColor below). Added before measuring the box.
  legend(wrapper, "Median lag", [
    { color: "var(--bone)", label: "0 days" },
    { color: "var(--bone-60)", label: "1–7 days" },
    { color: "var(--signal)", label: "Over 7 days" },
  ]);

  const lagData = (Array.isArray(rawData) ? rawData : []).slice().sort((a, b) => Number(b.median || 0) - Number(a.median || 0));

  const bbox = chartBox.node()?.getBoundingClientRect() || {};
  const width = bbox.width || 540;
  const height = bbox.height || 340;

  // Label column fits the longest category at --fs-small (mono ≈ 0.62em/char), then a median badge.
  const fsSmall = Math.max(12, window.innerWidth * 0.009);
  const labelW = (d3.max(lagData, d => d.category.length) || 20) * fsSmall * 0.62;
  const badgeW = fsSmall * 4.5;
  const gutter = fsSmall;
  const margin = { top: 10, right: 30, bottom: 35, left: labelW + badgeW + gutter * 2 };

  const svg = chartBox.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const yScale = d3.scaleBand()
    .domain(lagData.map(d => d.category))
    .range([margin.top, height - margin.bottom])
    .padding(0.24);

  // Domain runs to the longest 90th percentile so the whiskers use the full plot width.
  const maxVal = d3.max(lagData, d => Number(d.p90 || d.q3 || 0)) || 50;
  const xScale = d3.scaleSqrt() // sqrt spreads out the 0-5 day region where most medians sit
    .domain([0, maxVal])
    .range([margin.left, width - margin.right]);

  const ticks = [0, 1, 2, 5, 10, 20, 50, 100, 200, 365].filter(t => t <= maxVal);
  svg.append("g")
    .attr("class", "axis grid")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).tickValues(ticks).tickFormat(d => `${d}d`).tickSize(-(height - margin.top - margin.bottom)))
    .call(g => g.select(".domain").remove());

  const showTip = (event, d) => {
    updateBanner(d);
    tooltip.html(`
      <strong style="color:var(--bone);">${d.category}</strong><br/>
      Median lag: <strong>${Number(d.median || 0)} days</strong><br/>
      Middle half (Q1–Q3): <strong>${Number(d.q1 || 0)}–${Number(d.q3 || 0)} days</strong><br/>
      90th percentile: <strong>${Number(d.p90 || 0)} days</strong><br/>
      Mean: <strong>${Number(d.mean || 0).toFixed(1)} days</strong><br/>
      Incidents: <strong>${d3.format(",")(Number(d.count || 0))}</strong>
    `).style("opacity", 1)
      .style("left", (event.clientX + 14) + "px")
      .style("top", (event.clientY - 28) + "px");
  };
  const hideTip = () => { updateBanner(null); tooltip.style("opacity", 0); };

  lagData.forEach(d => {
    const y0 = yScale(d.category);
    const yCenter = y0 + yScale.bandwidth() / 2;
    const q1X = xScale(Number(d.q1 || 0));
    const medVal = Number(d.median || 0);
    const medX = xScale(medVal);
    const q3X = xScale(Number(d.q3 || 0));
    const p90X = xScale(Number(d.p90 || d.q3 || 0));

    // Only the long-lag outlier (median > 7 days, Fraud/Identity) is red.
    let barColor = "var(--bone)";
    if (medVal >= 1 && medVal <= 7) barColor = "var(--bone-60)";
    else if (medVal > 7) barColor = "var(--signal)";

    const row = svg.append("g")
      .style("cursor", "pointer")
      .on("mouseover", event => showTip(event, d))
      .on("mousemove", event => showTip(event, d))
      .on("mouseout", hideTip);

    // Hit area across the whole row so the tooltip works on thin boxes too.
    row.append("rect")
      .attr("x", 0).attr("y", y0)
      .attr("width", width).attr("height", yScale.bandwidth())
      .attr("fill", "transparent");

    row.append("text")
      .attr("x", labelW)
      .attr("y", yCenter)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("fill", "var(--bone)")
      .style("font-size", "var(--fs-small)")
      .text(d.category);

    row.append("text")
      .attr("x", labelW + gutter + badgeW / 2)
      .attr("y", yCenter)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("class", "num")
      .attr("fill", medVal > 7 ? "var(--bone)" : "var(--bone-60)")
      .style("font-weight", "700")
      .text(`${medVal}d`);

    // Whisker to the 90th percentile.
    row.append("line")
      .attr("x1", q1X).attr("x2", p90X)
      .attr("y1", yCenter).attr("y2", yCenter)
      .attr("stroke", "var(--bone-60)")
      .attr("stroke-width", 1);
    row.append("line")
      .attr("x1", p90X).attr("x2", p90X)
      .attr("y1", yCenter - yScale.bandwidth() / 4).attr("y2", yCenter + yScale.bandwidth() / 4)
      .attr("stroke", "var(--bone-60)");

    // Q1-Q3 box, median line in --bg.
    row.append("rect")
      .attr("x", q1X)
      .attr("y", y0)
      .attr("width", Math.max(4, q3X - q1X))
      .attr("height", yScale.bandwidth())
      .attr("fill", barColor);
    row.append("line")
      .attr("x1", medX).attr("x2", medX)
      .attr("y1", y0).attr("y2", y0 + yScale.bandwidth())
      .attr("stroke", "var(--bg)")
      .attr("stroke-width", 2);
  });

  wrapper.append("p")
    .attr("class", "caveat")
    .text("Box = middle half of cases (Q1–Q3), dark line = median, whisker = 90th percentile. Bold number = median days.");
}

// Router Export Aliases
export {
  outcomes as outcomeByCat,
  outcomes as category,
  outcomes as byCategory,
  funnel as clearanceFunnel,
  lag as reportLag,
  lag as boxPlot,
  outcomes as default
};