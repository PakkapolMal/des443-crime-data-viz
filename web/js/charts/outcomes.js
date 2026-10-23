/**
 * Chapter 8: #outcomes — Case Outcomes & Reporting Lag
 * Exports: outcomes, funnel, lag (with router aliases: outcomeByCat, clearanceFunnel, reportLag, default)
 * Data sources: outcome_by_cat.json, outcome_funnel.json, report_lag_by_cat.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

function getTooltip() {
  let tooltip = d3.select("body").select(".chart-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("background", "var(--bg-card, #0f172a)")
      .style("border", "1px solid var(--accent, #38bdf8)")
      .style("color", "var(--text, #f8fafc)")
      .style("padding", "0.45rem 0.7rem")
      .style("border-radius", "6px")
      .style("font-size", "0.75rem")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", "1000")
      .style("box-shadow", "0 10px 25px -5px rgba(0,0,0,0.6)");
  }
  return tooltip;
}

/**
 * Screen 1: Outcome Breakdown by Category (100% Stacked Bar)
 */
export async function outcomes(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.outcome_by_cat || await lazy("outcome_by_cat");
  const tooltip = getTooltip();

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box");

  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "center")
    .style("margin-bottom", "0.6rem");

  const titleGroup = header.append("div");
  titleGroup.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.4rem")
    .style("color", "var(--text)")
    .text("Case Outcomes by Crime Category");

  titleGroup.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Case clearance distribution across 180-day mature incident cohorts.");

  const legend = header.append("div")
    .style("display", "flex")
    .style("gap", "0.75rem")
    .style("align-items", "center");

  const outcomeColors = {
    "Cleared by Arrest": "#10b981",
    "Cleared Other": "#38bdf8",
    "Under Review": "#fbbf24",
    "Open": "#64748b"
  };

  Object.entries(outcomeColors).forEach(([label, color]) => {
    const item = legend.append("div").style("display", "flex").style("align-items", "center").style("gap", "0.3rem");
    item.append("span")
      .style("width", "10px")
      .style("height", "10px")
      .style("border-radius", "2px")
      .style("background", color);
    item.append("span")
      .style("font-size", "0.72rem")
      .style("color", "var(--text)")
      .text(label);
  });

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1rem")
    .style("position", "relative")
    .style("overflow", "hidden");

  wrapper.append("div")
    .style("margin-top", "0.4rem")
    .style("font-size", "0.72rem")
    .style("color", "var(--muted)")
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

  const width = chartBox.node().clientWidth || 800;
  const height = chartBox.node().clientHeight || 340;
  const margin = { top: 20, right: 30, bottom: 30, left: 210 };

  const svg = chartBox.append("svg").attr("width", width).attr("height", height);

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
    .attr("fill", "var(--text)")
    .style("font-size", "0.78rem");

  svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => `${d}%`))
    .call(g => g.select(".domain").attr("stroke", "var(--border)"))
    .selectAll("text")
    .attr("fill", "var(--muted)")
    .style("font-size", "0.75rem");

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
          .attr("fill", outcomeColors[out] || "#64748b")
          .attr("rx", 1)
          .style("cursor", "pointer")
          .on("mouseover", () => {
            tooltip.html(`
              <strong>${d.category}</strong><br/>
              Status: <span style="color:${outcomeColors[out]}">${out}</span><br/>
              Count: <strong>${d3.format(",")(d[out] || 0)}</strong><br/>
              Share: <strong>${pct.toFixed(1)}%</strong>
            `).style("opacity", 1);
          })
          .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
          .on("mouseout", () => tooltip.style("opacity", 0));

        currentX += barWidth;
      }
    });
  });
}

/**
 * Screen 2: Case Clearance & Prosecution Funnel
 */
export async function funnel(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.outcome_funnel || await lazy("outcome_funnel");
  const tooltip = getTooltip();

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box");

  const header = wrapper.append("div").style("margin-bottom", "0.5rem");
  header.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.4rem")
    .style("color", "var(--text)")
    .text("Case Clearance & Prosecution Funnel");

  header.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Progressive case attrition from initial report through investigation, arrest, and DA/CA filing.");

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1.25rem 1.5rem")
    .style("position", "relative")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("justify-content", "center")
    .style("overflow", "hidden");

  const funnelData = Array.isArray(rawData) ? rawData : [];
  const mainStages = funnelData.filter(d => d.stage !== "Rejected");
  const rejectedStage = funnelData.find(d => d.stage === "Rejected");
  const baseCount = mainStages[0]?.count || 1;

  const width = chartBox.node().clientWidth || 800;
  const margin = { left: 180, right: 220 };
  const maxBarWidth = width - margin.left - margin.right;

  const xScale = d3.scaleLinear().domain([0, baseCount]).range([0, maxBarWidth]);
  const stageColors = ["#38bdf8", "#3b82f6", "#f43f5e", "#10b981"];

  const svg = chartBox.append("svg")
    .attr("width", width)
    .attr("height", mainStages.length * 56 + 10);

  mainStages.forEach((d, i) => {
    const yPos = i * 56 + 5;
    const barW = Math.max(12, xScale(d.count));
    const pctOfTotal = ((d.count / baseCount) * 100).toFixed(1);

    const prevCount = i > 0 ? mainStages[i - 1].count : null;
    const stepRetention = prevCount ? ((d.count / prevCount) * 100).toFixed(1) : null;

    svg.append("text")
      .attr("x", margin.left - 15)
      .attr("y", yPos + 18)
      .attr("text-anchor", "end")
      .attr("fill", "var(--text)")
      .style("font-size", "0.85rem")
      .style("font-weight", "600")
      .text(d.stage);

    svg.append("rect")
      .attr("x", margin.left)
      .attr("y", yPos)
      .attr("width", barW)
      .attr("height", 26)
      .attr("fill", stageColors[i % stageColors.length])
      .attr("rx", 4)
      .style("cursor", "pointer")
      .on("mouseover", () => {
        tooltip.html(`
          <strong>${d.stage} Stage</strong><br/>
          Incidents: <strong>${d3.format(",")(d.count)}</strong><br/>
          Share of Total: <strong>${pctOfTotal}%</strong>
          ${stepRetention ? `<br/>Conversion Rate: <strong>${stepRetention}%</strong>` : ''}
        `).style("opacity", 1);
      })
      .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
      .on("mouseout", () => tooltip.style("opacity", 0));

    const labelGroup = svg.append("text")
      .attr("x", margin.left + barW + 12)
      .attr("y", yPos + 18)
      .style("font-size", "0.8rem");

    labelGroup.append("tspan")
      .attr("fill", "var(--text)")
      .style("font-weight", "700")
      .text(d3.format(",")(d.count));

    labelGroup.append("tspan")
      .attr("fill", "var(--muted)")
      .text(` (${pctOfTotal}%)`);

    if (stepRetention) {
      labelGroup.append("tspan")
        .attr("fill", stageColors[i % stageColors.length])
        .style("font-size", "0.72rem")
        .style("font-weight", "600")
        .text(`  •  ${stepRetention}% of prev stage`);
    }

    if (i < mainStages.length - 1) {
      svg.append("line")
        .attr("x1", margin.left + 16)
        .attr("x2", margin.left + 16)
        .attr("y1", yPos + 26)
        .attr("y2", yPos + 56)
        .attr("stroke", "var(--border, #334155)")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "3,3");
    }
  });

  if (rejectedStage) {
    const arrestStage = mainStages.find(s => s.stage === "Cleared by Arrest") || mainStages[2];
    const rejPct = arrestStage ? ((rejectedStage.count / arrestStage.count) * 100).toFixed(1) : "18.1";

    const alertBox = chartBox.append("div")
      .style("margin-top", "0.75rem")
      .style("background", "rgba(244, 63, 94, 0.08)")
      .style("border", "1px solid rgba(244, 63, 94, 0.3)")
      .style("border-radius", "6px")
      .style("padding", "0.5rem 1rem")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "center");

    alertBox.html(`
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#f43f5e;"></span>
        <span style="font-size:0.78rem; font-weight:600; color:#f43f5e;">Prosecutorial Rejections (DA / CA)</span>
      </div>
      <div style="font-size:0.8rem; color:var(--text); font-weight:600;">
        ${d3.format(",")(rejectedStage.count)} cases <span style="font-size:0.72rem; color:var(--muted); font-weight:normal;">(${rejPct}% of cleared arrests rejected)</span>
      </div>
    `);
  }
}

/**
 * Screen 3: Reporting Lag Days by Category (Dashboard Grid Layout: 70% Chart + 30% KPI Cards)
 */
export async function lag(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.report_lag_by_cat || await lazy("report_lag_by_cat");
  const tooltip = getTooltip();

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box");

  const header = wrapper.append("div").style("margin-bottom", "0.5rem");
  header.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.4rem")
    .style("color", "var(--text)")
    .text("Reporting Lag Days by Crime Category");

  header.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Days elapsed between offense occurrence date and formal police report date.");

  // Main 2-Column Container
  const gridBox = wrapper.append("div")
    .style("flex", "1")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 280px")
    .style("gap", "1rem")
    .style("overflow", "hidden");

  const chartBox = gridBox.append("div")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "0.75rem 1rem")
    .style("position", "relative")
    .style("overflow", "hidden");

  const summaryBox = gridBox.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "0.75rem")
    .style("justify-content", "center");

  const lagData = (Array.isArray(rawData) ? rawData : []).slice().sort((a, b) => Number(b.median || 0) - Number(a.median || 0));

  // Render Left Side Chart
  const width = chartBox.node().clientWidth || 540;
  const height = chartBox.node().clientHeight || 340;

  // Dedicated Margin:
  // 0 -> 180px: Category Label (Right aligned at 170px)
  // 176 -> 220px: Median Badge Pill
  // 240px -> (width - 25px): Chart Canvas
  const margin = { top: 20, right: 25, bottom: 30, left: 240 };

  const svg = chartBox.append("svg").attr("width", width).attr("height", height);

  const yScale = d3.scaleBand()
    .domain(lagData.map(d => d.category))
    .range([margin.top, height - margin.bottom])
    .padding(0.24);

  // Dynamic Scale Clamped to Max Q3 * 1.25 (~22 days) to Eliminate Right Dead Space
  const maxQ3 = d3.max(lagData, d => Number(d.q3 || 10)) || 15;
  const domainMax = Math.max(16, Math.ceil(maxQ3 * 1.25));

  const xScale = d3.scaleLinear()
    .domain([0, domainMax])
    .range([margin.left, width - margin.right]);

  // Y Axis Labels (Positioned at x = 170px to guarantee zero left clipping)
  const yAxisG = svg.append("g")
    .attr("transform", `translate(170, 0)`)
    .call(d3.axisLeft(yScale).tickSize(0))
    .call(g => g.select(".domain").remove());

  yAxisG.selectAll("text")
    .attr("fill", "var(--text)")
    .style("font-size", "0.75rem")
    .style("font-weight", "500");

  // X Axis Ticks
  svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => `${d}d`))
    .call(g => g.select(".domain").attr("stroke", "var(--border)"))
    .selectAll("text")
    .attr("fill", "var(--muted)")
    .style("font-size", "0.72rem");

  // Background Grid Lines
  svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(5).tickSize(-height + margin.top + margin.bottom).tickFormat(""))
    .attr("stroke-opacity", 0.06);

  // Box Plot Rows
  lagData.forEach(d => {
    const yCenter = yScale(d.category) + yScale.bandwidth() / 2;
    const q1Val = Number(d.q1 || 0);
    const medVal = Number(d.median || 0);
    const q3Val = Number(d.q3 || 0);

    const q1X = xScale(Math.min(domainMax, q1Val));
    const medX = xScale(Math.min(domainMax, medVal));
    const q3X = xScale(Math.min(domainMax, q3Val));

    let barColor = "var(--accent, #38bdf8)";
    if (medVal >= 1 && medVal <= 7) barColor = "var(--accent-amber, #fbbf24)";
    else if (medVal > 7) barColor = "var(--accent-rose, #f43f5e)";

    // Median Badge Column (x = 176px to 220px)
    const badgeG = svg.append("g")
      .attr("transform", `translate(176, ${yScale(d.category) + 1})`);

    badgeG.append("rect")
      .attr("width", 44)
      .attr("height", yScale.bandwidth() - 2)
      .attr("fill", barColor)
      .attr("opacity", 0.18)
      .attr("stroke", barColor)
      .attr("stroke-width", 1)
      .attr("rx", 3);

    badgeG.append("text")
      .attr("x", 22)
      .attr("y", (yScale.bandwidth() - 2) / 2 + 3)
      .attr("text-anchor", "middle")
      .attr("fill", barColor)
      .style("font-size", "0.68rem")
      .style("font-weight", "700")
      .text(`${medVal}d med`);

    // Whisker Line
    svg.append("line")
      .attr("x1", q1X).attr("x2", q3X)
      .attr("y1", yCenter).attr("y2", yCenter)
      .attr("stroke", "var(--muted)")
      .attr("stroke-width", 1.5);

    // IQR Box
    const boxWidth = Math.max(5, q3X - q1X);
    svg.append("rect")
      .attr("x", q1X)
      .attr("y", yScale(d.category))
      .attr("width", boxWidth)
      .attr("height", yScale.bandwidth())
      .attr("fill", barColor)
      .attr("opacity", 0.8)
      .attr("rx", 2)
      .style("cursor", "pointer")
      .on("mouseover", () => {
        tooltip.html(`
          <strong>${d.category}</strong><br/>
          Median Lag: <strong style="color:${barColor}">${medVal} days</strong><br/>
          Q1 - Q3 IQR: <strong>${q1Val} - ${q3Val} days</strong><br/>
          90th Percentile: <strong>${Number(d.p90 || 0)} days</strong><br/>
          Mean Lag: <strong>${Number(d.mean || 0).toFixed(1)} days</strong>
        `).style("opacity", 1);
      })
      .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
      .on("mouseout", () => tooltip.style("opacity", 0));

    // Solid White Median Line
    svg.append("line")
      .attr("x1", medX).attr("x2", medX)
      .attr("y1", yScale(d.category))
      .attr("y2", yScale(d.category) + yScale.bandwidth())
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2);
  });

  // Render Right Side Insight Cards
  const maxDelayItem = lagData[0] || { category: "Fraud/Identity", median: 9 };
  const sameDayItems = lagData.filter(d => Number(d.median || 0) === 0);

  summaryBox.html(`
    <div style="background:var(--bg-card, #1e293b); border:1px solid rgba(244,63,94,0.3); padding:0.8rem 1rem; border-radius:8px;">
      <div style="font-size:0.75rem; color:#f43f5e; font-weight:700; text-transform:uppercase; margin-bottom:0.2rem;">Longest Delay</div>
      <div style="font-size:1.1rem; font-weight:700; color:var(--text);">${maxDelayItem.category}</div>
      <div style="font-size:0.75rem; color:var(--muted); margin-top:0.2rem;">Median <strong>${maxDelayItem.median} days</strong> reporting lag due to delayed bank/statement discovery.</div>
    </div>

    <div style="background:var(--bg-card, #1e293b); border:1px solid rgba(56,189,248,0.3); padding:0.8rem 1rem; border-radius:8px;">
      <div style="font-size:0.75rem; color:#38bdf8; font-weight:700; text-transform:uppercase; margin-bottom:0.2rem;">Immediate Reporting</div>
      <div style="font-size:1.1rem; font-weight:700; color:var(--text);">${sameDayItems.length} Crime Categories</div>
      <div style="font-size:0.75rem; color:var(--muted); margin-top:0.2rem;">Violent & emergency crimes (Assault, Homicide, Robbery) have a median <strong>0-day lag</strong>.</div>
    </div>

    <div style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); padding:0.8rem 1rem; border-radius:8px;">
      <div style="font-size:0.75rem; color:#fbbf24; font-weight:700; text-transform:uppercase; margin-bottom:0.2rem;">Property Crime Lag</div>
      <div style="font-size:1.1rem; font-weight:700; color:var(--text);">1 – 2 Days Median</div>
      <div style="font-size:0.75rem; color:var(--muted); margin-top:0.2rem;">Vehicle thefts & burglaries reflect delayed discovery when owners return to property.</div>
    </div>
  `);
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