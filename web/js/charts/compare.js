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

  const areaSummary = data?.area_summary || await lazy("area_summary");
  const areaByCat = data?.area_by_cat || await lazy("area_by_cat");

  const categories = Array.from(new Set(areaByCat.map(d => d.category))).sort();
  let selectedCategory = categories.includes("Larceny/Theft") ? "Larceny/Theft" : categories[0];

  let tooltip = d3.select("body").select(".chart-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("background", "var(--bg-card, #0f172a)")
      .style("border", "1px solid var(--accent, #38bdf8)")
      .style("color", "var(--text, #f8fafc)")
      .style("padding", "0.41rem 0.65rem")
      .style("border-radius", "6px")
      .style("font-size", "0.75rem")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", "1000")
      .style("box-shadow", "0 10px 25px -5px rgba(0,0,0,0.6)");
  }

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box");

  // Header Controls
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
    .text("Division Volume vs Category Concentration Scatter");

  titleGroup.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Plotting total incident volume against relative category proportion across all 21 LAPD divisions.");

  const selectGroup = header.append("div");
  selectGroup.append("label")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .style("margin-right", "0.5rem")
    .text("Y-Axis Category:");

  const catSelect = selectGroup.append("select")
    .style("background", "var(--bg-card, #1e293b)")
    .style("color", "var(--text)")
    .style("border", "1px solid var(--border, #334155)")
    .style("padding", "0.3rem 0.6rem")
    .style("border-radius", "4px")
    .style("font-size", "0.85rem")
    .style("font-weight", "600");

  categories.forEach(c => catSelect.append("option").attr("value", c).property("selected", c === selectedCategory).text(c));

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1rem")
    .style("position", "relative")
    .style("overflow", "hidden");

  function render() {
    chartBox.html("");

    const scatterData = areaSummary.map(s => {
      const match = areaByCat.find(d => d.area === s.area && d.category === selectedCategory);
      const catCount = match ? match.count : 0;
      return {
        area: s.area,
        totalVolume: s.total,
        catCount: catCount,
        catShare: s.total ? (catCount / s.total) * 100 : 0
      };
    });

    const width = chartBox.node().clientWidth || 800;
    const height = chartBox.node().clientHeight || 360;
    const margin = { top: 25, right: 35, bottom: 45, left: 65 };

    const svg = chartBox.append("svg").attr("width", width).attr("height", height);

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
      .attr("stroke", "rgba(255,255,255,0.12)")
      .attr("stroke-dasharray", "4,4");

    svg.append("line")
      .attr("x1", margin.left).attr("x2", width - margin.right)
      .attr("y1", yScale(avgY)).attr("y2", yScale(avgY))
      .attr("stroke", "rgba(255,255,255,0.12)")
      .attr("stroke-dasharray", "4,4");

    // Grid lines
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(6).tickSize(-height + margin.top + margin.bottom).tickFormat(""))
      .attr("stroke-opacity", 0.08);

    svg.append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickSize(-width + margin.left + margin.right).tickFormat(""))
      .attr("stroke-opacity", 0.08);

    // X Axis
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("~s")))
      .call(g => g.select(".domain").attr("stroke", "var(--border)"))
      .selectAll("text")
      .attr("fill", "var(--muted)")
      .style("font-size", "0.75rem");

    svg.append("text")
      .attr("x", (width + margin.left) / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--muted)")
      .style("font-size", "0.75rem")
      .text("Total Division Incident Volume");

    // Y Axis
    svg.append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => `${d.toFixed(0)}%`))
      .call(g => g.select(".domain").attr("stroke", "var(--border)"))
      .selectAll("text")
      .attr("fill", "var(--muted)")
      .style("font-size", "0.75rem");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2))
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--muted)")
      .style("font-size", "0.75rem")
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
      .attr("fill", "var(--accent, #38bdf8)")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("r", 9).attr("fill", "var(--accent-amber, #fbbf24)");
        tooltip.html(`
          <strong>${d.area} Division</strong><br/>
          Total Volume: <strong>${d3.format(",")(d.totalVolume)}</strong><br/>
          ${selectedCategory}: <strong>${d3.format(",")(d.catCount)}</strong><br/>
          Category Share: <strong>${d.catShare.toFixed(1)}%</strong>
        `).style("opacity", 1);
      })
      .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
      .on("mouseout", function () {
        d3.select(this).attr("r", 6).attr("fill", "var(--accent, #38bdf8)");
        tooltip.style("opacity", 0);
      });

    // Division Labels
    points.append("text")
      .attr("x", d => xScale(d.totalVolume) + 8)
      .attr("y", d => yScale(d.catShare) + 3)
      .attr("fill", "var(--text)")
      .style("font-size", "0.68rem")
      .style("font-weight", "600")
      .style("pointer-events", "none")
      .style("paint-order", "stroke fill")
      .style("stroke", "#0f172a")
      .style("stroke-width", "2px")
      .text(d => d.area);
  }

  catSelect.on("change", function () { selectedCategory = this.value; render(); });
  render();
}

/**
 * Screen 2: Category Mix Differential vs Citywide Baseline
 */
export async function mix(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const areaSummary = data?.area_summary || await lazy("area_summary");
  const areaByCat = data?.area_by_cat || await lazy("area_by_cat");

  const divisions = areaSummary.map(d => d.area).sort();
  let selectedArea = divisions.includes("Central") ? "Central" : divisions[0];

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
      .style("z-index", "1000");
  }

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
    .style("margin-bottom", "0.75rem");

  const titleGroup = header.append("div");
  titleGroup.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.4rem")
    .style("color", "var(--text)")
    .text("Category Mix Differential vs Citywide Baseline");

  titleGroup.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Diverging percentage-point difference (% share in division − citywide baseline % share).");

  const selectGroup = header.append("div");
  selectGroup.append("label")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .style("margin-right", "0.5rem")
    .text("Select Division:");

  const areaSelect = selectGroup.append("select")
    .style("background", "var(--bg-card, #1e293b)")
    .style("color", "var(--text)")
    .style("border", "1px solid var(--border, #334155)")
    .style("padding", "0.3rem 0.6rem")
    .style("border-radius", "4px")
    .style("font-size", "0.85rem")
    .style("font-weight", "600");

  divisions.forEach(d => areaSelect.append("option").attr("value", d).property("selected", d === selectedArea).text(d));

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1rem")
    .style("position", "relative");

  const totalCitywide = d3.sum(areaSummary, d => d.total) || 1;
  const citywideCatTotals = d3.rollup(areaByCat, v => d3.sum(v, d => d.count), d => d.category);

  function render() {
    chartBox.html("");
    const divSummary = areaSummary.find(d => d.area === selectedArea) || { total: 1 };
    const divCatData = areaByCat.filter(d => d.area === selectedArea);

    const categories = Array.from(citywideCatTotals.keys()).sort();
    const diffData = categories.map(cat => {
      const cityCnt = citywideCatTotals.get(cat) || 0;
      const cityShare = (cityCnt / totalCitywide) * 100;

      const divCnt = divCatData.find(d => d.category === cat)?.count || 0;
      const divShare = (divCnt / divSummary.total) * 100;

      return {
        category: cat,
        cityShare,
        divShare,
        diff: divShare - cityShare,
        divCnt
      };
    }).sort((a, b) => b.diff - a.diff);

    const width = chartBox.node().clientWidth || 800;
    const height = chartBox.node().clientHeight || 360;
    const margin = { top: 20, right: 40, bottom: 40, left: 180 };

    const svg = chartBox.append("svg").attr("width", width).attr("height", height);

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
      .attr("stroke", "var(--border, #334155)")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,4");

    svg.append("g")
      .attr("transform", `translate(${margin.left - 8}, 0)`)
      .call(d3.axisLeft(yScale).tickSize(0))
      .call(g => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", "var(--text)")
      .style("font-size", "0.78rem");

    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(7).tickFormat(d => `${d > 0 ? '+' : ''}${d.toFixed(1)}%`))
      .call(g => g.select(".domain").attr("stroke", "var(--border)"))
      .selectAll("text")
      .attr("fill", "var(--muted)")
      .style("font-size", "0.75rem");

    svg.selectAll(".diff-bar")
      .data(diffData)
      .enter()
      .append("rect")
      .attr("class", "diff-bar")
      .attr("y", d => yScale(d.category))
      .attr("height", yScale.bandwidth())
      .attr("x", d => d.diff >= 0 ? xScale(0) : xScale(d.diff))
      .attr("width", d => Math.abs(xScale(d.diff) - xScale(0)))
      .attr("fill", d => d.diff >= 0 ? "var(--accent, #38bdf8)" : "var(--accent-rose, #f43f5e)")
      .attr("rx", 2)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        tooltip.html(`
          <strong>${selectedArea} Division</strong><br/>
          ${d.category}<br/>
          Division Share: <strong>${d.divShare.toFixed(1)}%</strong> (${d3.format(",")(d.divCnt)} incidents)<br/>
          Citywide Average: <strong>${d.cityShare.toFixed(1)}%</strong><br/>
          Difference: <strong style="color:${d.diff >= 0 ? '#38bdf8' : '#f43f5e'};">${d.diff >= 0 ? '+' : ''}${d.diff.toFixed(2)}% pts</strong>
        `).style("opacity", 1);
      })
      .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
      .on("mouseout", () => tooltip.style("opacity", 0));
  }

  areaSelect.on("change", function () { selectedArea = this.value; render(); });
  render();
}

/**
 * Screen 3: Multi-Division Category Ranking Benchmark
 */
export async function rankings(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const areaSummary = data?.area_summary || await lazy("area_summary");
  const areaByCat = data?.area_by_cat || await lazy("area_by_cat");

  const categories = Array.from(new Set(areaByCat.map(d => d.category))).sort();
  let selectedCategory = categories.includes("Motor Vehicle Theft") ? "Motor Vehicle Theft" : categories[0];

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
      .style("z-index", "1000");
  }

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
    .style("margin-bottom", "0.75rem");

  const titleGroup = header.append("div");
  titleGroup.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.4rem")
    .style("color", "var(--text)")
    .text("Division Category Benchmark Rankings");

  titleGroup.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Rank all 21 LAPD divisions by volume for a specific crime category.");

  const selectGroup = header.append("div");
  selectGroup.append("label")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .style("margin-right", "0.5rem")
    .text("Category:");

  const catSelect = selectGroup.append("select")
    .style("background", "var(--bg-card, #1e293b)")
    .style("color", "var(--text)")
    .style("border", "1px solid var(--border, #334155)")
    .style("padding", "0.3rem 0.6rem")
    .style("border-radius", "4px")
    .style("font-size", "0.85rem")
    .style("font-weight", "600");

  categories.forEach(c => catSelect.append("option").attr("value", c).property("selected", c === selectedCategory).text(c));

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1rem")
    .style("overflow-y", "auto");

  function render() {
    chartBox.html("");

    const rankedData = areaSummary.map(s => {
      const match = areaByCat.find(d => d.area === s.area && d.category === selectedCategory);
      const count = match ? match.count : 0;
      return {
        area: s.area,
        count: count,
        total: s.total,
        share: s.total ? (count / s.total) * 100 : 0
      };
    }).sort((a, b) => b.count - a.count);

    const width = chartBox.node().clientWidth || 800;
    const rowHeight = 20;
    const margin = { top: 10, right: 60, bottom: 20, left: 120 };
    const height = rankedData.length * rowHeight + margin.top + margin.bottom;

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
      .attr("fill", "var(--text)")
      .style("font-size", "0.75rem");

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
      .attr("fill", (d, i) => i === 0 ? "var(--accent-amber, #fbbf24)" : "var(--accent, #38bdf8)")
      .attr("rx", 3)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        tooltip.html(`
          <strong>${d.area} Division</strong><br/>
          ${selectedCategory}: <strong>${d3.format(",")(d.count)}</strong><br/>
          Share of Division Total: <strong>${d.share.toFixed(1)}%</strong>
        `).style("opacity", 1);
      })
      .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
      .on("mouseout", () => tooltip.style("opacity", 0));

    bars.append("text")
      .attr("y", d => yScale(d.area) + yScale.bandwidth() / 2 + 3)
      .attr("x", d => xScale(d.count) + 6)
      .attr("fill", "var(--muted)")
      .style("font-size", "0.7rem")
      .text(d => d3.format(",")(d.count));
  }

  catSelect.on("change", function () { selectedCategory = this.value; render(); });
  render();
}

// Aliases to guarantee compatibility with any router export name
export { scatter as divCompare, mix as categoryMix, rankings as divisionRankings };