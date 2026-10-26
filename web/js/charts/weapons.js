/**
 * Chapter 6: #weapons — Weapon & Force Types
 * Exports: weapons, weaponClass, byCategory, summary (with router aliases)
 * Data sources: weapon_class.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/**
 * Screen 1: Weapon Class Frequency Breakdown across all Crimes
 */
export async function weapons(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.weapon_class || (await lazy?.("weapon_class")) || [];

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

  // Header
  const header = wrapper.append("div");
  header.append("h2").text("Weapon & Force Distribution Across Reported Crimes");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Aggregated incident frequency across NIBRS weapon and force classes.");

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

  // Aggregate data
  const aggregatedMap = d3.rollup(
    rawData,
    v => d3.sum(v, d => Number(d.count || 0)),
    d => String(d.weapon_class || d.weapon_category || d.weapon || "None")
  );

  const aggregatedData = Array.from(aggregatedMap, ([weaponClass, count]) => ({ weaponClass, count }))
    .sort((a, b) => b.count - a.count);

  const totalWeapons = d3.sum(aggregatedData, d => d.count) || 1;

  function updateBanner(d) {
    if (!d) {
      statsBanner.html(`
        <span class="label">WEAPON INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover over any bar to inspect overall weapon class breakdown.</span>
      `);
    } else {
      const share = ((d.count / totalWeapons) * 100).toFixed(1);
      statsBanner.html(`
        <div>
          <span class="label">WEAPON CLASS:</span>
          <strong style="color:var(--bone); margin-left:4px;">${d.weaponClass.toUpperCase()}</strong>
        </div>
        <div>
          <span class="label">INCIDENTS:</span>
          <strong class="num" style="margin-left:4px; color:var(--bone);">${d3.format(",")(d.count)}</strong>
          <span class="label" style="margin-left:12px;">SHARE:</span>
          <strong class="num signal" style="margin-left:4px;">${share}%</strong>
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

  const bbox = chartBox.node()?.getBoundingClientRect() || {};
  const width = bbox.width || 800;
  const rowHeight = 32;
  const margin = { top: 20, right: 110, bottom: 30, left: 160 };
  const height = Math.max(bbox.height || 360, aggregatedData.length * rowHeight + margin.top + margin.bottom);

  const svg = chartBox.append("svg")
    .attr("width", "100%")
    .attr("height", height);

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
    .attr("fill", "var(--bone)")
    .style("font-size", "var(--fs-small)")
    .style("font-family", "var(--font-mono)");

  // X Axis
  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("~s")));

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
    .attr("fill", "var(--bone)")
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "var(--signal)");
      updateBanner(d);

      const share = ((d.count / totalWeapons) * 100).toFixed(1);
      tooltip.html(`
        <strong style="color:var(--bone);">${d.weaponClass}</strong><br/>
        Incident Count: <strong>${d3.format(",")(d.count)}</strong><br/>
        Share of Total: <strong style="color:var(--signal);">${share}%</strong>
      `).style("opacity", 1);
    })
    .on("mousemove", event => {
      tooltip
        .style("left", (event.clientX + 14) + "px")
        .style("top", (event.clientY - 28) + "px");
    })
    .on("mouseout", function (event, d) {
      d3.select(this).attr("fill", "var(--bone)");
      updateBanner(null);
      tooltip.style("opacity", 0);
    });

  // Value Labels
  bars.append("text")
    .attr("y", d => yScale(d.weaponClass) + yScale.bandwidth() / 2 + 3)
    .attr("x", d => xScale(d.count) + 8)
    .attr("fill", "var(--bone-60)")
    .style("font-size", "var(--fs-label)")
    .style("font-family", "var(--font-mono)")
    .text(d => `${d3.format(",")(d.count)} (${((d.count / totalWeapons) * 100).toFixed(1)}%)`);
}

/**
 * Screen 2: Weapon Type by Specific Crime Category
 */
export async function byCategory(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.weapon_class || (await lazy?.("weapon_class")) || [];

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

  const categories = Array.from(new Set(rawData.map(d => d.category))).filter(Boolean).sort();
  let selectedCat = categories.includes("Aggravated Assault") ? "Aggravated Assault" : (categories[0] || "All");

  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "flex-end");

  const titleGroup = header.append("div");
  titleGroup.append("h2").text("Weapon Involvement by Crime Category");
  titleGroup.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Filter weapon mix for specific NIBRS offense categories.");

  const selectGroup = header.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "var(--s-1)");

  selectGroup.append("span").attr("class", "label").text("Crime Category:");

  const catSelect = selectGroup.append("select")
    .style("background", "var(--surface)")
    .style("color", "var(--bone)")
    .style("border", "var(--rule)")
    .style("font-family", "var(--font-mono)")
    .style("font-size", "var(--fs-label)")
    .style("padding", "var(--s-1) var(--s-2)");

  categories.forEach(c => {
    catSelect.append("option")
      .attr("value", c)
      .property("selected", c === selectedCat)
      .text(c);
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

  function updateBanner(d) {
    if (!d) {
      statsBanner.html(`
        <span class="label">CATEGORY INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover over any bar to inspect weapon class mix for ${selectedCat}.</span>
      `);
    } else {
      statsBanner.html(`
        <div>
          <span class="label">CATEGORY:</span>
          <strong style="color:var(--bone); margin-left:4px;">${selectedCat.toUpperCase()}</strong>
          <span style="color:var(--bone-60); margin-left:12px;">Weapon: ${d.weaponClass}</span>
        </div>
        <div>
          <span class="label">INCIDENTS:</span>
          <strong class="num" style="margin-left:4px; color:var(--bone);">${d3.format(",")(d.count)}</strong>
          <span class="label" style="margin-left:12px;">CATEGORY SHARE:</span>
          <strong class="num signal" style="margin-left:4px;">${d.share.toFixed(1)}%</strong>
        </div>
      `);
    }
  }

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("position", "relative");

  function render() {
    chartBox.html("");
    updateBanner(null);

    const filtered = rawData.filter(d => d.category === selectedCat);
    const catTotal = d3.sum(filtered, d => Number(d.count || 0)) || 1;

    const chartData = filtered.map(d => ({
      weaponClass: String(d.weapon_class || d.weapon_category || d.weapon || "None"),
      count: Number(d.count || 0),
      share: (Number(d.count || 0) / catTotal) * 100
    })).sort((a, b) => b.count - a.count);

    const bbox = chartBox.node()?.getBoundingClientRect() || {};
    const width = bbox.width || 800;
    const height = bbox.height || 360;
    const margin = { top: 20, right: 100, bottom: 30, left: 160 };

    const svg = chartBox.append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`);

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
      .attr("fill", "var(--bone)")
      .style("font-size", "var(--fs-small)")
      .style("font-family", "var(--font-mono)");

    // X Axis
    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("~s")));

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
      .attr("fill", d => d.weaponClass === "Firearm" ? "var(--signal)" : "var(--bone)")
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "var(--signal)");
        updateBanner(d);

        tooltip.html(`
          <strong style="color:var(--bone);">${selectedCat}</strong><br/>
          Weapon Class: <strong>${d.weaponClass}</strong><br/>
          Incidents: <strong>${d3.format(",")(d.count)}</strong><br/>
          Category Share: <strong style="color:var(--signal);">${d.share.toFixed(1)}%</strong>
        `).style("opacity", 1);
      })
      .on("mousemove", event => {
        tooltip
          .style("left", (event.clientX + 14) + "px")
          .style("top", (event.clientY - 28) + "px");
      })
      .on("mouseout", function (event, d) {
        d3.select(this).attr("fill", d.weaponClass === "Firearm" ? "var(--signal)" : "var(--bone)");
        updateBanner(null);
        tooltip.style("opacity", 0);
      });

    bars.append("text")
      .attr("y", d => yScale(d.weaponClass) + yScale.bandwidth() / 2 + 3)
      .attr("x", d => xScale(d.count) + 8)
      .attr("fill", "var(--bone-60)")
      .style("font-size", "var(--fs-label)")
      .style("font-family", "var(--font-mono)")
      .text(d => `${d3.format(",")(d.count)} (${d.share.toFixed(1)}%)`);
  }

  catSelect.on("change", function () {
    selectedCat = this.value;
    render();
  });

  render();
}

/**
 * Screen 3: High-Level Macro Summary (Donut & KPI Cards)
 */
export async function summary(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.weapon_class || (await lazy?.("weapon_class")) || [];

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("gap", "var(--s-2)");

  const header = wrapper.append("div");
  header.append("h2").text("Weapon & Force Class High-Level Overview");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
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
    .style("min-height", "0")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1.2fr")
    .style("gap", "var(--s-3)");

  const kpiBox = contentBox.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "var(--s-1)")
    .style("justify-content", "center")
    .style("overflow-y", "auto");

  const colorPalette = [
    "var(--signal)",
    "var(--bone)",
    "var(--bone-60)",
    "var(--bone-35)",
    "var(--hairline)",
    "var(--surface)"
  ];

  pieData.forEach((d, i) => {
    const share = ((d.count / totalCount) * 100).toFixed(1);
    const card = kpiBox.append("div")
      .style("background", "var(--surface)")
      .style("border", "var(--rule)")
      .style("padding", "var(--s-2) var(--s-3)");

    card.html(`
      <div class="label" style="color: ${colorPalette[i % colorPalette.length]};">${d.label.toUpperCase()}</div>
      <div style="font-size: var(--fs-h2); font-weight: 700; color: var(--bone); font-family: var(--font-mono); margin-top:2px;">
        ${d3.format(",")(d.count)} <span style="font-size:var(--fs-small); font-weight:normal; color:var(--bone-60);">(${share}%)</span>
      </div>
    `);
  });

  const donutBox = contentBox.append("div")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("display", "flex")
    .style("align-items", "center")
    .style("justify-content", "center")
    .style("position", "relative");

  const bbox = donutBox.node()?.getBoundingClientRect() || {};
  const size = Math.min(bbox.width || 320, bbox.height || 320) - 40;
  const radius = Math.max(50, size / 2);

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
    .attr("fill", (d, i) => colorPalette[i % colorPalette.length])
    .attr("stroke", "var(--bg)")
    .attr("stroke-width", 2)
    .style("cursor", "pointer");

  svg.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "-0.2em")
    .attr("fill", "var(--bone)")
    .style("font-size", "var(--fs-h2)")
    .style("font-family", "var(--font-mono)")
    .style("font-weight", "700")
    .text(d3.format("~s")(totalCount));

  svg.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "1.2em")
    .attr("fill", "var(--bone-60)")
    .style("font-size", "var(--fs-label)")
    .style("font-family", "var(--font-mono)")
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