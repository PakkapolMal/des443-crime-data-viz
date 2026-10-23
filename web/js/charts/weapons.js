/**
 * Chapter 6: #weapons — Weapon & Force Types
 * Exports: weapons, weaponClass, byCategory, summary (with router aliases)
 * Data sources: weapon_class.json
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
      .style("padding", "0.4rem 0.65rem")
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
 * Screen 1: Weapon Class Frequency Breakdown across all Crimes
 */
export async function weapons(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.weapon_class || await lazy("weapon_class");
  const tooltip = getTooltip();

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box");

  const header = wrapper.append("div").style("margin-bottom", "0.75rem");
  header.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.4rem")
    .style("color", "var(--text)")
    .text("Weapon & Force Distribution Across Reported Crimes");

  header.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Aggregated incident frequency across NIBRS weapon and force classes.");

  // Aggregate by weapon_class (Firearm, Knife, Bodily Force, Other, Unknown, None)
  const aggregatedMap = d3.rollup(
    rawData,
    v => d3.sum(v, d => Number(d.count || 0)),
    d => String(d.weapon_class || d.weapon_category || d.weapon || "None")
  );

  const aggregatedData = Array.from(aggregatedMap, ([weaponClass, count]) => ({ weaponClass, count }))
    .sort((a, b) => b.count - a.count);

  const totalWeapons = d3.sum(aggregatedData, d => d.count) || 1;

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1rem")
    .style("position", "relative")
    .style("overflow-y", "auto");

  const width = chartBox.node().clientWidth || 800;
  const rowHeight = 32;
  const margin = { top: 20, right: 90, bottom: 30, left: 160 };
  const height = Math.max(chartBox.node().clientHeight || 360, aggregatedData.length * rowHeight + margin.top + margin.bottom);

  const svg = chartBox.append("svg").attr("width", width).attr("height", height);

  const yScale = d3.scaleBand()
    .domain(aggregatedData.map(d => d.weaponClass))
    .range([margin.top, height - margin.bottom])
    .padding(0.25);

  const maxVal = d3.max(aggregatedData, d => d.count) || 1000;
  const xScale = d3.scaleLinear()
    .domain([0, maxVal * 1.1])
    .range([margin.left, width - margin.right]);

  // Y Axis
  svg.append("g")
    .attr("transform", `translate(${margin.left - 8}, 0)`)
    .call(d3.axisLeft(yScale).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text")
    .attr("fill", "var(--text)")
    .style("font-size", "0.82rem")
    .style("font-weight", "600");

  // X Axis
  svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("~s")))
    .call(g => g.select(".domain").attr("stroke", "var(--border)"))
    .selectAll("text")
    .attr("fill", "var(--muted)")
    .style("font-size", "0.75rem");

  // Bars
  const bars = svg.selectAll(".weapon-bar")
    .data(aggregatedData)
    .enter()
    .append("g");

  bars.append("rect")
    .attr("class", "weapon-bar")
    .attr("y", d => yScale(d.weaponClass))
    .attr("x", margin.left)
    .attr("height", yScale.bandwidth())
    .attr("width", d => Math.max(0, xScale(d.count) - margin.left))
    .attr("fill", d => d.weaponClass === "Firearm" ? "var(--accent-rose, #f43f5e)" : "var(--accent, #38bdf8)")
    .attr("rx", 4)
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      const share = ((d.count / totalWeapons) * 100).toFixed(1);
      tooltip.html(`
        <strong>${d.weaponClass}</strong><br/>
        Incident Count: <strong>${d3.format(",")(d.count)}</strong><br/>
        Share of Total: <strong>${share}%</strong>
      `).style("opacity", 1);
    })
    .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
    .on("mouseout", () => tooltip.style("opacity", 0));

  // Value Labels
  bars.append("text")
    .attr("y", d => yScale(d.weaponClass) + yScale.bandwidth() / 2 + 3)
    .attr("x", d => xScale(d.count) + 8)
    .attr("fill", "var(--muted)")
    .style("font-size", "0.75rem")
    .text(d => `${d3.format(",")(d.count)} (${((d.count / totalWeapons) * 100).toFixed(1)}%)`);
}

/**
 * Screen 2: Weapon Type by Specific Crime Category
 */
export async function byCategory(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.weapon_class || await lazy("weapon_class");
  const tooltip = getTooltip();

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box");

  const categories = Array.from(new Set(rawData.map(d => d.category))).filter(Boolean).sort();
  let selectedCat = categories.includes("Aggravated Assault") ? "Aggravated Assault" : (categories[0] || "All");

  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "center")
    .style("margin-bottom", "0.75rem");

  const titleGroup = header.append("div");
  titleGroup.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.4rem")
    .style("color", "var(--text)")
    .text("Weapon Involvement by Crime Category");

  titleGroup.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Filter weapon mix for specific NIBRS offense categories.");

  const selectGroup = header.append("div");
  selectGroup.append("label")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .style("margin-right", "0.5rem")
    .text("Crime Category:");

  const catSelect = selectGroup.append("select")
    .style("background", "var(--bg-card, #1e293b)")
    .style("color", "var(--text)")
    .style("border", "1px solid var(--border, #334155)")
    .style("padding", "0.3rem 0.6rem")
    .style("border-radius", "4px")
    .style("font-size", "0.85rem")
    .style("font-weight", "600");

  categories.forEach(c => catSelect.append("option").attr("value", c).property("selected", c === selectedCat).text(c));

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1rem")
    .style("position", "relative");

  function render() {
    chartBox.html("");

    const filtered = rawData.filter(d => d.category === selectedCat);
    const catTotal = d3.sum(filtered, d => Number(d.count || 0)) || 1;

    const chartData = filtered.map(d => ({
      weaponClass: String(d.weapon_class || d.weapon_category || d.weapon || "None"),
      count: Number(d.count || 0),
      share: (Number(d.count || 0) / catTotal) * 100
    })).sort((a, b) => b.count - a.count);

    const width = chartBox.node().clientWidth || 800;
    const height = chartBox.node().clientHeight || 360;
    const margin = { top: 20, right: 80, bottom: 30, left: 160 };

    const svg = chartBox.append("svg").attr("width", width).attr("height", height);

    const yScale = d3.scaleBand()
      .domain(chartData.map(d => d.weaponClass))
      .range([margin.top, height - margin.bottom])
      .padding(0.25);

    const maxVal = d3.max(chartData, d => d.count) || 10;
    const xScale = d3.scaleLinear()
      .domain([0, maxVal * 1.1])
      .range([margin.left, width - margin.right]);

    // Y Axis
    svg.append("g")
      .attr("transform", `translate(${margin.left - 8}, 0)`)
      .call(d3.axisLeft(yScale).tickSize(0))
      .call(g => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", "var(--text)")
      .style("font-size", "0.8rem");

    // X Axis
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("~s")))
      .call(g => g.select(".domain").attr("stroke", "var(--border)"))
      .selectAll("text")
      .attr("fill", "var(--muted)")
      .style("font-size", "0.75rem");

    // Bars
    const bars = svg.selectAll(".cat-bar")
      .data(chartData)
      .enter()
      .append("g");

    bars.append("rect")
      .attr("class", "cat-bar")
      .attr("y", d => yScale(d.weaponClass))
      .attr("x", margin.left)
      .attr("height", yScale.bandwidth())
      .attr("width", d => Math.max(0, xScale(d.count) - margin.left))
      .attr("fill", d => d.weaponClass === "Firearm" ? "var(--accent-rose, #f43f5e)" : "var(--accent, #38bdf8)")
      .attr("rx", 3)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        tooltip.html(`
          <strong>${selectedCat}</strong><br/>
          Weapon Class: ${d.weaponClass}<br/>
          Incidents: <strong>${d3.format(",")(d.count)}</strong><br/>
          Share of Category: <strong>${d.share.toFixed(1)}%</strong>
        `).style("opacity", 1);
      })
      .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
      .on("mouseout", () => tooltip.style("opacity", 0));

    bars.append("text")
      .attr("y", d => yScale(d.weaponClass) + yScale.bandwidth() / 2 + 3)
      .attr("x", d => xScale(d.count) + 8)
      .attr("fill", "var(--muted)")
      .style("font-size", "0.72rem")
      .text(d => `${d3.format(",")(d.count)} (${d.share.toFixed(1)}%)`);
  }

  catSelect.on("change", function () { selectedCat = this.value; render(); });
  render();
}

/**
 * Screen 3: High-Level Macro Summary
 */
export async function summary(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.weapon_class || await lazy("weapon_class");

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box");

  const header = wrapper.append("div").style("margin-bottom", "0.75rem");
  header.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.4rem")
    .style("color", "var(--text)")
    .text("Weapon & Force Class High-Level Overview");

  header.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Proportional share of weapons and force classes across all incidents.");

  const aggregatedMap = d3.rollup(
    rawData,
    v => d3.sum(v, d => Number(d.count || 0)),
    d => String(d.weapon_class || d.weapon_category || d.weapon || "None")
  );

  const pieData = Array.from(aggregatedMap, ([label, count]) => ({ label, count })).filter(d => d.count > 0);
  const totalCount = d3.sum(pieData, d => d.count) || 1;

  const contentBox = wrapper.append("div")
    .style("flex", "1")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1.2fr")
    .style("gap", "1.5rem");

  const kpiBox = contentBox.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "0.6rem")
    .style("justify-content", "center");

  const colors = ["#f43f5e", "#fbbf24", "#38bdf8", "#10b981", "#a855f7", "#64748b"];

  pieData.forEach((d, i) => {
    const share = ((d.count / totalCount) * 100).toFixed(1);
    const card = kpiBox.append("div")
      .style("background", "var(--bg-card, #1e293b)")
      .style("border", `1px solid ${colors[i % colors.length]}`)
      .style("padding", "0.6rem 0.9rem")
      .style("border-radius", "8px");

    card.html(`
      <div style="font-size: 0.75rem; color: ${colors[i % colors.length]}; font-weight: 600;">${d.label}</div>
      <div style="font-size: 1.2rem; font-weight: 700; color: var(--text);">${d3.format(",")(d.count)} <span style="font-size:0.8rem; font-weight:normal; color:var(--muted);">(${share}%)</span></div>
    `);
  });

  const donutBox = contentBox.append("div")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("display", "flex")
    .style("align-items", "center")
    .style("justify-content", "center");

  const size = Math.min(donutBox.node().clientWidth || 320, donutBox.node().clientHeight || 320) - 40;
  const radius = size / 2;

  const svg = donutBox.append("svg")
    .attr("width", size)
    .attr("height", size)
    .append("g")
    .attr("transform", `translate(${size / 2},${size / 2})`);

  const pie = d3.pie().value(d => d.count).sort(null);
  const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius * 0.9);

  const arcs = svg.selectAll(".arc")
    .data(pie(pieData))
    .enter()
    .append("g");

  arcs.append("path")
    .attr("d", arc)
    .attr("fill", (d, i) => colors[i % colors.length])
    .attr("stroke", "#0f172a")
    .attr("stroke-width", 2);

  svg.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "-0.2em")
    .attr("fill", "var(--text)")
    .style("font-size", "1.2rem")
    .style("font-weight", "700")
    .text(d3.format("~s")(totalCount));

  svg.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "1.2em")
    .attr("fill", "var(--muted)")
    .style("font-size", "0.75rem")
    .text("Total Incidents");
}

// Router Export Aliases
export { 
  weapons as weaponClass, 
  weapons as byClass, 
  weapons as classFn, 
  byCategory as category,
  weapons as default 
};