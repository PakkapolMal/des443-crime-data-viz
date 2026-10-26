/**
 * Chapter 4: #compare — Area & Category Comparison
 * Exports: scatter, mix, rankings (and aliases divCompare, categoryMix, divisionRankings)
 * Data sources: area_summary.json, area_by_cat.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/**
 * Screen 1: 2D Division Benchmark Scatter Plot
 * X-axis: Total Incident Volume
 * Y-axis: Selected Category Share (%)
 */
export async function scatter(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawSummary = data?.area_summary || (await lazy?.("area_summary")) || [];
  const rawByCat = data?.area_by_cat || (await lazy?.("area_by_cat")) || [];

  const areaSummary = Array.isArray(rawSummary) ? rawSummary : [];
  const areaByCat = Array.isArray(rawByCat) ? rawByCat : [];

  const categories = Array.from(new Set(areaByCat.map(d => d.category))).sort();
  let selectedCategory = categories.includes("Larceny/Theft") ? "Larceny/Theft" : (categories[0] || "Larceny/Theft");

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
    .style("gap", "var(--s-3)");

  // Header Controls
  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "flex-end");

  const titleGroup = header.append("div");
  titleGroup.append("h2").text("Division Volume vs Category Concentration Scatter");
  titleGroup.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Plotting total incident volume against relative category proportion across all 21 LAPD divisions.");

  const selectGroup = header.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "var(--s-1)");

  selectGroup.append("span").attr("class", "label").text("Y-Axis Category:");

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
      .property("selected", c === selectedCategory)
      .text(c);
  });

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("position", "relative")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)");

  function render() {
    chartBox.html("");

    const scatterData = areaSummary.map(s => {
      const match = areaByCat.find(d => d.area === s.area && d.category === selectedCategory);
      const catCount = match ? Number(match.count || 0) : 0;
      const total = Number(s.total || 1);
      return {
        area: s.area,
        totalVolume: total,
        catCount: catCount,
        catShare: total ? (catCount / total) * 100 : 0
      };
    });

    const bbox = chartBox.node()?.getBoundingClientRect() || {};
    const width = bbox.width || 800;
    const height = bbox.height || 360;
    const margin = { top: 25, right: 35, bottom: 45, left: 65 };

    const svg = chartBox.append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`);

    const xExtent = d3.extent(scatterData, d => d.totalVolume);
    const yMax = d3.max(scatterData, d => d.catShare) || 10;

    const xScale = d3.scaleLinear()
      .domain([0, (xExtent[1] || 30000) * 1.08])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([0, yMax * 1.15])
      .range([height - margin.bottom, margin.top]);

    const avgX = d3.mean(scatterData, d => d.totalVolume) || 0;
    const avgY = d3.mean(scatterData, d => d.catShare) || 0;

    // Quadrant Average Baseline Lines
    svg.append("line")
      .attr("x1", xScale(avgX)).attr("x2", xScale(avgX))
      .attr("y1", margin.top).attr("y2", height - margin.bottom)
      .attr("stroke", "var(--hairline)")
      .attr("stroke-dasharray", "4,4");

    svg.append("line")
      .attr("x1", margin.left).attr("x2", width - margin.right)
      .attr("y1", yScale(avgY)).attr("y2", yScale(avgY))
      .attr("stroke", "var(--hairline)")
      .attr("stroke-dasharray", "4,4");

    // X Axis
    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("~s")));

    svg.append("text")
      .attr("x", (width + margin.left) / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .attr("class", "label")
      .text("Total Division Incident Volume");

    // Y Axis
    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => `${d.toFixed(0)}%`));

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2))
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("class", "label")
      .text(`% Share of ${selectedCategory}`);

    // Scatter Points & Labels
    const points = svg.selectAll(".scatter-pt")
      .data(scatterData)
      .enter()
      .append("g");

    points.append("circle")
      .attr("cx", d => xScale(d.totalVolume))
      .attr("cy", d => yScale(d.catShare))
      .attr("r", 6)
      .attr("fill", "var(--bone)")
      .attr("stroke", "var(--bg)")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("r", 9).attr("fill", "var(--signal)");
        tooltip.html(`
          <strong style="color:var(--bone);">${d.area} Division</strong><br/>
          Total Volume: <strong>${d3.format(",")(d.totalVolume)}</strong><br/>
          ${selectedCategory}: <strong>${d3.format(",")(d.catCount)}</strong><br/>
          Category Share: <strong style="color:var(--signal);">${d.catShare.toFixed(1)}%</strong>
        `).style("opacity", 1);
      })
      .on("mousemove", event => {
        tooltip
          .style("left", (event.clientX + 14) + "px")
          .style("top", (event.clientY - 28) + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("r", 6).attr("fill", "var(--bone)");
        tooltip.style("opacity", 0);
      });

    // Division Labels
    points.append("text")
      .attr("x", d => xScale(d.totalVolume) + 8)
      .attr("y", d => yScale(d.catShare) + 3)
      .attr("fill", "var(--bone-60)")
      .style("font-size", "var(--fs-label)")
      .style("font-family", "var(--font-mono)")
      .style("pointer-events", "none")
      .style("paint-order", "stroke fill")
      .style("stroke", "var(--bg)")
      .style("stroke-width", "2px")
      .text(d => d.area);
  }

  catSelect.on("change", function () {
    selectedCategory = this.value;
    render();
  });

  render();
}

/**
 * Screen 2: Category Mix Differential vs Citywide Baseline
 */
export async function mix(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawSummary = data?.area_summary || (await lazy?.("area_summary")) || [];
  const rawByCat = data?.area_by_cat || (await lazy?.("area_by_cat")) || [];

  const areaSummary = Array.isArray(rawSummary) ? rawSummary : [];
  const areaByCat = Array.isArray(rawByCat) ? rawByCat : [];

  const divisions = areaSummary.map(d => d.area).sort();
  let selectedArea = divisions.includes("Central") ? "Central" : (divisions[0] || "Central");

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
    .style("gap", "var(--s-3)");

  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "flex-end");

  const titleGroup = header.append("div");
  titleGroup.append("h2").text("Category Mix Differential vs Citywide Baseline");
  titleGroup.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Diverging percentage-point difference (% share in division − citywide baseline % share).");

  const selectGroup = header.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "var(--s-1)");

  selectGroup.append("span").attr("class", "label").text("Select Division:");

  const areaSelect = selectGroup.append("select")
    .style("background", "var(--surface)")
    .style("color", "var(--bone)")
    .style("border", "var(--rule)")
    .style("font-family", "var(--font-mono)")
    .style("font-size", "var(--fs-label)")
    .style("padding", "var(--s-1) var(--s-2)");

  divisions.forEach(d => {
    areaSelect.append("option")
      .attr("value", d)
      .property("selected", d === selectedArea)
      .text(d);
  });

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("position", "relative")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)");

  const totalCitywide = d3.sum(areaSummary, d => Number(d.total || 0)) || 1;
  const citywideCatTotals = d3.rollup(areaByCat, v => d3.sum(v, d => Number(d.count || 0)), d => d.category);

  function render() {
    chartBox.html("");
    const divSummary = areaSummary.find(d => d.area === selectedArea) || { total: 1 };
    const divCatData = areaByCat.filter(d => d.area === selectedArea);

    const categories = Array.from(citywideCatTotals.keys()).sort();
    const diffData = categories.map(cat => {
      const cityCnt = citywideCatTotals.get(cat) || 0;
      const cityShare = (cityCnt / totalCitywide) * 100;

      const divCnt = divCatData.find(d => d.category === cat)?.count || 0;
      const divShare = (Number(divCnt) / Number(divSummary.total || 1)) * 100;

      return {
        category: cat,
        cityShare,
        divShare,
        diff: divShare - cityShare,
        divCnt: Number(divCnt)
      };
    }).sort((a, b) => b.diff - a.diff);

    const bbox = chartBox.node()?.getBoundingClientRect() || {};
    const width = bbox.width || 800;
    const height = bbox.height || 360;
    const margin = { top: 20, right: 40, bottom: 40, left: 180 };

    const svg = chartBox.append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`);

    const yScale = d3.scaleBand()
      .domain(diffData.map(d => d.category))
      .range([margin.top, height - margin.bottom])
      .padding(0.25);

    const maxDiff = Math.max(5, d3.max(diffData, d => Math.abs(d.diff)) || 10);
    const xScale = d3.scaleLinear()
      .domain([-maxDiff * 1.1, maxDiff * 1.1])
      .range([margin.left, width - margin.right]);

    svg.append("line")
      .attr("x1", xScale(0)).attr("x2", xScale(0))
      .attr("y1", margin.top).attr("y2", height - margin.bottom)
      .attr("stroke", "var(--hairline)")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4");

    svg.append("g")
      .attr("transform", `translate(${margin.left - 8}, 0)`)
      .call(d3.axisLeft(yScale).tickSize(0))
      .call(g => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", "var(--bone)")
      .style("font-size", "var(--fs-small)");

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(7).tickFormat(d => `${d > 0 ? '+' : ''}${d.toFixed(1)}%`));

    svg.selectAll(".diff-bar")
      .data(diffData)
      .enter()
      .append("rect")
      .attr("class", "diff-bar")
      .attr("y", d => yScale(d.category))
      .attr("height", yScale.bandwidth())
      .attr("x", d => d.diff >= 0 ? xScale(0) : xScale(d.diff))
      .attr("width", d => Math.abs(xScale(d.diff) - xScale(0)))
      .attr("fill", d => d.diff >= 0 ? "var(--signal)" : "var(--bone-60)")
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        tooltip.html(`
          <strong style="color:var(--bone);">${selectedArea} Division</strong><br/>
          ${d.category}<br/>
          Division Share: <strong>${d.divShare.toFixed(1)}%</strong> (${d3.format(",")(d.divCnt)} incidents)<br/>
          Citywide Average: <strong>${d.cityShare.toFixed(1)}%</strong><br/>
          Difference: <strong style="color:${d.diff >= 0 ? 'var(--signal)' : 'var(--bone-60)'};">${d.diff >= 0 ? '+' : ''}${d.diff.toFixed(2)}% pts</strong>
        `).style("opacity", 1);
      })
      .on("mousemove", event => {
        tooltip
          .style("left", (event.clientX + 14) + "px")
          .style("top", (event.clientY - 28) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  }

  areaSelect.on("change", function () {
    selectedArea = this.value;
    render();
  });

  render();
}

/**
 * Screen 3: Multi-Division Category Ranking Benchmark
 */
export async function rankings(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawSummary = data?.area_summary || (await lazy?.("area_summary")) || [];
  const rawByCat = data?.area_by_cat || (await lazy?.("area_by_cat")) || [];

  const areaSummary = Array.isArray(rawSummary) ? rawSummary : [];
  const areaByCat = Array.isArray(rawByCat) ? rawByCat : [];

  const categories = Array.from(new Set(areaByCat.map(d => d.category))).sort();
  let selectedCategory = categories.includes("Motor Vehicle Theft") ? "Motor Vehicle Theft" : (categories[0] || "Motor Vehicle Theft");

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
    .style("gap", "var(--s-3)");

  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "flex-end");

  const titleGroup = header.append("div");
  titleGroup.append("h2").text("Division Category Benchmark Rankings");
  titleGroup.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Rank all 21 LAPD divisions by volume for a specific crime category.");

  const selectGroup = header.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "var(--s-1)");

  selectGroup.append("span").attr("class", "label").text("Category:");

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
      .property("selected", c === selectedCategory)
      .text(c);
  });

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("position", "relative")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("overflow-y", "auto");

  function render() {
    chartBox.html("");

    const rankedData = areaSummary.map(s => {
      const match = areaByCat.find(d => d.area === s.area && d.category === selectedCategory);
      const count = match ? Number(match.count || 0) : 0;
      const total = Number(s.total || 1);
      return {
        area: s.area,
        count: count,
        total: total,
        share: total ? (count / total) * 100 : 0
      };
    }).sort((a, b) => b.count - a.count);

    const bbox = chartBox.node()?.getBoundingClientRect() || {};
    const width = bbox.width - 20 || 800;
    const rowHeight = 20;
    const margin = { top: 10, right: 60, bottom: 20, left: 120 };
    const height = Math.max(bbox.height || 360, rankedData.length * rowHeight + margin.top + margin.bottom);

    const svg = chartBox.append("svg").attr("width", width).attr("height", height);

    const yScale = d3.scaleBand()
      .domain(rankedData.map(d => d.area))
      .range([margin.top, height - margin.bottom])
      .padding(0.2);

    const maxCount = d3.max(rankedData, d => d.count) || 100;
    const xScale = d3.scaleLinear()
      .domain([0, maxCount * 1.1])
      .range([margin.left, width - margin.right]);

    svg.append("g")
      .attr("transform", `translate(${margin.left - 6}, 0)`)
      .call(d3.axisLeft(yScale).tickSize(0))
      .call(g => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", "var(--bone)")
      .style("font-size", "var(--fs-small)");

    const bars = svg.selectAll(".rank-bar")
      .data(rankedData)
      .enter()
      .append("g");

    bars.append("rect")
      .attr("class", "rank-bar")
      .attr("y", d => yScale(d.area))
      .attr("x", margin.left)
      .attr("height", yScale.bandwidth())
      .attr("width", d => Math.max(0, xScale(d.count) - margin.left))
      .attr("fill", (d, i) => i === 0 ? "var(--signal)" : "var(--bone)")
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        tooltip.html(`
          <strong style="color:var(--bone);">${d.area} Division</strong><br/>
          ${selectedCategory}: <strong>${d3.format(",")(d.count)}</strong><br/>
          Share of Division Total: <strong>${d.share.toFixed(1)}%</strong>
        `).style("opacity", 1);
      })
      .on("mousemove", event => {
        tooltip
          .style("left", (event.clientX + 14) + "px")
          .style("top", (event.clientY - 28) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    bars.append("text")
      .attr("y", d => yScale(d.area) + yScale.bandwidth() / 2 + 3)
      .attr("x", d => xScale(d.count) + 6)
      .attr("fill", "var(--bone-60)")
      .style("font-size", "var(--fs-label)")
      .text(d => d3.format(",")(d.count));
  }

  catSelect.on("change", function () {
    selectedCategory = this.value;
    render();
  });

  render();
}

// Compatibility exports
export { scatter as divCompare, mix as categoryMix, rankings as divisionRankings };