/**
 * Chapter 8: #outcomes — Case Outcomes & Reporting Lag
 * Exports: outcomes, funnel, lag (with router aliases: outcomeByCat, clearanceFunnel, reportLag, default)
 * Data sources: outcome_by_cat.json, outcome_funnel.json, report_lag_by_cat.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

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
  titleGroup.append("p").attr("class", "label").text("08 · OUTCOMES");
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
  header.append("p").attr("class", "label").text("08 · OUTCOMES");
  header.append("h2").text("Case Clearance & Prosecution Funnel");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Progressive case attrition from initial report through investigation, arrest, and DA/CA filing.");

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

  const funnelData = Array.isArray(rawData) ? rawData : [];
  const mainStages = funnelData.filter(d => d.stage !== "Rejected");
  const rejectedStage = funnelData.find(d => d.stage === "Rejected");
  const baseCount = mainStages[0]?.count || 1;

  function updateBanner(d, pctOfTotal, stepRetention) {
    if (!d) {
      statsBanner.html(`
        <span class="label">FUNNEL INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover over any stage to inspect case retention and conversion rates.</span>
      `);
    } else {
      statsBanner.html(`
        <div>
          <span class="label">FUNNEL STAGE:</span>
          <strong style="color:var(--bone); margin-left:4px;">${d.stage.toUpperCase()}</strong>
        </div>
        <div>
          <span class="label">INCIDENTS:</span>
          <strong class="num" style="margin-left:4px; color:var(--bone);">${d3.format(",")(d.count)}</strong>
          <span class="label" style="margin-left:12px;">TOTAL SHARE:</span>
          <strong class="num signal" style="margin-left:4px;">${pctOfTotal}%</strong>
          ${stepRetention ? `<span class="label" style="margin-left:12px;">RETENTION:</span> <strong class="num" style="margin-left:4px; color:var(--bone);">${stepRetention}%</strong>` : ''}
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
    .style("padding", "var(--s-3)")
    .style("position", "relative")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("justify-content", "center")
    .style("overflow", "hidden");

  const bbox = chartBox.node()?.getBoundingClientRect() || {};
  const width = bbox.width || 800;
  const height = bbox.height || 360;

  const margin = { left: 190, right: 280, top: 30, bottom: 20 };
  const maxBarWidth = Math.max(100, width - margin.left - margin.right);

  const xScale = d3.scaleLinear().domain([0, baseCount]).range([0, maxBarWidth]);
  // "Filed" is the punchline, so it is the one red stage (DESIGN.md: red is a signal).
  const stageColors = ["var(--bone)", "var(--bone-60)", "var(--bone-35)", "var(--signal)"];

  const svg = chartBox.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const rowGap = (height - margin.top - margin.bottom) / mainStages.length;

  // Render Flat 2D Funnel Stages
  mainStages.forEach((d, i) => {
    const yPos = margin.top + i * rowGap;
    const barW = Math.max(12, xScale(d.count));
    const pctOfTotal = ((d.count / baseCount) * 100).toFixed(1);

    const prevCount = i > 0 ? mainStages[i - 1].count : null;
    const stepRetention = prevCount ? ((d.count / prevCount) * 100).toFixed(1) : null;

    // Stage Title
    svg.append("text")
      .attr("x", margin.left - 16)
      .attr("y", yPos + 20)
      .attr("text-anchor", "end")
      .attr("fill", "var(--bone)")
      .style("font-size", "var(--fs-small)")
      .style("font-family", "var(--font-mono)")
      .style("font-weight", "700")
      .text(d.stage.toUpperCase());

    // Stage Bar
    svg.append("rect")
      .attr("x", margin.left)
      .attr("y", yPos)
      .attr("width", barW)
      .attr("height", 30)
      .attr("fill", stageColors[i % stageColors.length])
      .attr("rx", 2)
      .style("cursor", "pointer")
      .on("mouseover", function() {
        updateBanner(d, pctOfTotal, stepRetention);
        tooltip.html(`
          <strong style="color:var(--bone);">${d.stage} Stage</strong><br/>
          Incidents: <strong>${d3.format(",")(d.count)}</strong><br/>
          Share of Total: <strong style="color:var(--signal);">${pctOfTotal}%</strong>
          ${stepRetention ? `<br/>Step Retention: <strong>${stepRetention}%</strong>` : ''}
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

    // Step Retention Dashed Vertical Connector
    if (i < mainStages.length - 1) {
      svg.append("line")
        .attr("x1", margin.left + 16)
        .attr("x2", margin.left + 16)
        .attr("y1", yPos + 30)
        .attr("y2", yPos + rowGap)
        .attr("stroke", "var(--hairline)")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "3,3");
    }

    // Callout Text Label
    const labelGroup = svg.append("text")
      .attr("x", margin.left + barW + 14)
      .attr("y", yPos + 20)
      .style("font-family", "var(--font-mono)")
      .style("font-size", "var(--fs-label)");

    labelGroup.append("tspan")
      .attr("fill", "var(--bone)")
      .style("font-weight", "700")
      .text(d3.format(",")(d.count));

    labelGroup.append("tspan")
      .attr("fill", "var(--bone-60)")
      .text(` (${pctOfTotal}%)`);

    if (stepRetention) {
      labelGroup.append("tspan")
        .attr("fill", "var(--bone-60)")
        .style("font-weight", "600")
        .text(`  •  ${stepRetention}% retention`);
    }
  });

  if (rejectedStage) {
    const arrestStage = mainStages.find(s => s.stage === "Cleared by Arrest") || mainStages[2];
    const rejPct = arrestStage ? ((rejectedStage.count / arrestStage.count) * 100).toFixed(1) : "18.1";

    const alertBox = wrapper.append("div")
      .style("background", "var(--surface)")
      .style("padding", "var(--s-2) var(--s-3)")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "center")
      .style("font-family", "var(--font-mono)");

    alertBox.html(`
      <div style="display:flex; align-items:center; gap:var(--s-1);">
        <span class="label">PROSECUTORIAL REJECTIONS (DA / CA)</span>
      </div>
      <div style="font-size:var(--fs-label); color:var(--bone); font-weight:600;">
        ${d3.format(",")(rejectedStage.count)} cases <span style="font-size:var(--fs-small); color:var(--bone-60); font-weight:normal;">(${rejPct}% of cleared arrests rejected)</span>
      </div>
    `);
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
  header.append("p").attr("class", "label").text("08 · OUTCOMES");
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

  // Main 2-Column Grid Layout
  const gridBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 280px")
    .style("gap", "var(--s-2)")
    .style("overflow", "hidden");

  const chartBox = gridBox.append("div")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("padding", "var(--s-2)")
    .style("position", "relative")
    .style("overflow", "hidden");

  const summaryBox = gridBox.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "var(--s-2)")
    .style("justify-content", "center");

  const lagData = (Array.isArray(rawData) ? rawData : []).slice().sort((a, b) => Number(b.median || 0) - Number(a.median || 0));

  const bbox = chartBox.node()?.getBoundingClientRect() || {};
  const width = bbox.width || 540;
  const height = bbox.height || 340;

  /**
   * Layout Horizontal Geometry:
   * 0px  -> 175px: Category Text (Right-Aligned at 175px)
   * 175px -> 185px: Gutter Gap (10px)
   * 185px -> 235px: Badge Box Pill (50px wide)
   * 235px -> 260px: Separation Gutter (25px)
   * 260px -> width: Plot Canvas Area
   */
  const margin = { top: 20, right: 25, bottom: 35, left: 260 };

  const svg = chartBox.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const yScale = d3.scaleBand()
    .domain(lagData.map(d => d.category))
    .range([margin.top, height - margin.bottom])
    .padding(0.24);

  const maxVal = d3.max(lagData, d => Number(d.p90 || d.q3 || 10)) || 50;

  // Square Root Scale expands the 0-5 day region
  const xScale = d3.scaleSqrt()
    .domain([0, Math.max(50, maxVal)])
    .range([margin.left, width - margin.right]);

  // X Axis Ticks
  const xAxis = d3.axisBottom(xScale)
    .tickValues([0, 1, 2, 5, 10, 20, 30, 50])
    .tickFormat(d => `${d}d`);

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(xAxis);

  // Box Plot Rows
  lagData.forEach(d => {
    const yCenter = yScale(d.category) + yScale.bandwidth() / 2;
    const q1Val = Number(d.q1 || 0);
    const medVal = Number(d.median || 0);
    const q3Val = Number(d.q3 || 0);

    const q1X = xScale(q1Val);
    const medX = xScale(medVal);
    const q3X = xScale(q3Val);

    let barColor = "var(--bone)";
    if (medVal >= 1 && medVal <= 7) barColor = "var(--bone-60)";
    else if (medVal > 7) barColor = "var(--signal)";

    // Category Text Label (Right aligned at x = 175px)
    svg.append("text")
      .attr("x", 175)
      .attr("y", yCenter + 3)
      .attr("text-anchor", "end")
      .attr("fill", "var(--bone)")
      .style("font-size", "var(--fs-small)")
      .style("font-family", "var(--font-mono)")
      .text(d.category);

    // Median Badge Column (Strict bounds: x = 185px to x = 235px)
    const badgeG = svg.append("g")
      .attr("transform", `translate(185, ${yScale(d.category) + 1})`);

    badgeG.append("rect")
      .attr("width", 50)
      .attr("height", yScale.bandwidth() - 2)
      .attr("fill", "var(--surface)")
      .attr("stroke", barColor)
      .attr("stroke-width", 1)
      .attr("rx", 2);

    badgeG.append("text")
      .attr("x", 25)
      .attr("y", (yScale.bandwidth() - 2) / 2 + 3)
      .attr("text-anchor", "middle")
      .attr("fill", barColor)
      .style("font-size", "var(--fs-label)")
      .style("font-family", "var(--font-mono)")
      .style("font-weight", "700")
      .text(`${medVal}d med`);

    // Whisker Line
    svg.append("line")
      .attr("x1", q1X).attr("x2", q3X)
      .attr("y1", yCenter).attr("y2", yCenter)
      .attr("stroke", "var(--bone-60)")
      .attr("stroke-width", 1.5);

    // IQR Box
    const boxWidth = Math.max(4, q3X - q1X);
    svg.append("rect")
      .attr("x", q1X)
      .attr("y", yScale(d.category))
      .attr("width", boxWidth)
      .attr("height", yScale.bandwidth())
      .attr("fill", barColor)
      .attr("fill-opacity", 0.75)
      .attr("rx", 2)
      .style("cursor", "pointer")
      .on("mouseover", function() {
        updateBanner(d);
        tooltip.html(`
          <strong style="color:var(--bone);">${d.category}</strong><br/>
          Median Lag: <strong style="color:var(--signal);">${medVal} days</strong><br/>
          Q1 - Q3 IQR: <strong>${q1Val} - ${q3Val} days</strong><br/>
          90th Percentile: <strong>${Number(d.p90 || 0)} days</strong><br/>
          Mean Lag: <strong>${Number(d.mean || 0).toFixed(1)} days</strong>
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

    // Solid White/Bone Median Line
    svg.append("line")
      .attr("x1", medX).attr("x2", medX)
      .attr("y1", yScale(d.category))
      .attr("y2", yScale(d.category) + yScale.bandwidth())
      .attr("stroke", "var(--bg)")
      .attr("stroke-width", 2);
  });

  // Render Right Side Insight Cards
  const maxDelayItem = lagData[0] || { category: "Fraud/Identity", median: 9 };
  const sameDayItems = lagData.filter(d => Number(d.median || 0) === 0);

  summaryBox.html(`
    <div style="background:var(--surface); padding:var(--s-2) var(--s-3);">
      <div class="label">LONGEST DELAY</div>
      <div style="font-size:var(--fs-label); font-weight:700; color:var(--bone); font-family:var(--font-mono); margin-top:2px;">${maxDelayItem.category}</div>
      <div class="caption" style="margin-top:4px;">Median <strong>${maxDelayItem.median} days</strong> reporting lag due to delayed bank/statement discovery.</div>
    </div>

    <div style="background:var(--surface); padding:var(--s-2) var(--s-3);">
      <div class="label">IMMEDIATE REPORTING</div>
      <div style="font-size:var(--fs-label); font-weight:700; color:var(--bone); font-family:var(--font-mono); margin-top:2px;">${sameDayItems.length} Crime Categories</div>
      <div class="caption" style="margin-top:4px;">Violent & emergency crimes (Assault, Homicide, Robbery) have a median <strong>0-day lag</strong>.</div>
    </div>

    <div style="background:var(--surface); padding:var(--s-2) var(--s-3);">
      <div class="label">PROPERTY CRIME LAG</div>
      <div style="font-size:var(--fs-label); font-weight:700; color:var(--bone); font-family:var(--font-mono); margin-top:2px;">1 – 2 Days Median</div>
      <div class="caption" style="margin-top:4px;">Vehicle thefts & burglaries reflect delayed discovery when owners return to property.</div>
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