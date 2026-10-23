/**
 * Chapter 7: #victims — Victim Demographics & Types
 * Exports: pyramid, type, descent (with router aliases)
 * Data sources: victim_age_sex.json, victim_type.json, victim_descent_by_cat.json
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
 * Screen 1: Back-to-Back Victim Population Pyramid (Age & Sex)
 */
export async function pyramid(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.victim_age_sex || await lazy("victim_age_sex");
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
    .text("Victim Demographics Population Pyramid");

  header.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Back-to-back victim age group distribution for Male vs Female individual victims.");

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1rem")
    .style("position", "relative");

  const ageBins = ["0-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
  
  // Aggregate counts per age group for Male and Female
  const maleData = new Map();
  const femaleData = new Map();

  rawData.forEach(d => {
    const age = String(d.age_group || d.age || "");
    const sex = String(d.vict_sex || d.sex || d.gender || "");
    const count = Number(d.count || 0);

    if (sex === "Male" || sex === "M") maleData.set(age, (maleData.get(age) || 0) + count);
    if (sex === "Female" || sex === "F") femaleData.set(age, (femaleData.get(age) || 0) + count);
  });

  const width = chartBox.node().clientWidth || 800;
  const height = chartBox.node().clientHeight || 360;
  const margin = { top: 35, right: 40, bottom: 35, left: 40 };

  const svg = chartBox.append("svg").attr("width", width).attr("height", height);

  const centerPadding = 45;
  const halfWidth = (width - margin.left - margin.right - centerPadding * 2) / 2;

  const maxVal = d3.max(ageBins, a => Math.max(maleData.get(a) || 0, femaleData.get(a) || 0)) || 100;

  const yScale = d3.scaleBand()
    .domain(ageBins)
    .range([height - margin.bottom, margin.top])
    .padding(0.25);

  const xLeftScale = d3.scaleLinear()
    .domain([0, maxVal * 1.1])
    .range([margin.left + halfWidth, margin.left]);

  const xRightScale = d3.scaleLinear()
    .domain([0, maxVal * 1.1])
    .range([width - margin.right - halfWidth, width - margin.right]);

  // Headers
  svg.append("text")
    .attr("x", margin.left + halfWidth / 2)
    .attr("y", margin.top - 12)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--accent, #38bdf8)")
    .style("font-size", "0.85rem")
    .style("font-weight", "700")
    .text("MALE VICTIMS");

  svg.append("text")
    .attr("x", width - margin.right - halfWidth / 2)
    .attr("y", margin.top - 12)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--accent-rose, #f43f5e)")
    .style("font-size", "0.85rem")
    .style("font-weight", "700")
    .text("FEMALE VICTIMS");

  // Center Age Group Labels
  svg.selectAll(".age-center-label")
    .data(ageBins)
    .enter()
    .append("text")
    .attr("x", width / 2)
    .attr("y", d => yScale(d) + yScale.bandwidth() / 2 + 4)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--text)")
    .style("font-size", "0.78rem")
    .style("font-weight", "600")
    .text(d => d);

  // Male Bars (Extending Left)
  svg.selectAll(".male-bar")
    .data(ageBins)
    .enter()
    .append("rect")
    .attr("class", "male-bar")
    .attr("y", d => yScale(d))
    .attr("x", d => xLeftScale(maleData.get(d) || 0))
    .attr("height", yScale.bandwidth())
    .attr("width", d => Math.max(0, (margin.left + halfWidth) - xLeftScale(maleData.get(d) || 0)))
    .attr("fill", "var(--accent, #38bdf8)")
    .attr("rx", 3)
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      tooltip.html(`<strong>Male Victims (${d})</strong><br/>Count: <strong>${d3.format(",")(maleData.get(d) || 0)}</strong>`).style("opacity", 1);
    })
    .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
    .on("mouseout", () => tooltip.style("opacity", 0));

  // Female Bars (Extending Right)
  svg.selectAll(".female-bar")
    .data(ageBins)
    .enter()
    .append("rect")
    .attr("class", "female-bar")
    .attr("y", d => yScale(d))
    .attr("x", width - margin.right - halfWidth)
    .attr("height", yScale.bandwidth())
    .attr("width", d => Math.max(0, xRightScale(femaleData.get(d) || 0) - (width - margin.right - halfWidth)))
    .attr("fill", "var(--accent-rose, #f43f5e)")
    .attr("rx", 3)
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      tooltip.html(`<strong>Female Victims (${d})</strong><br/>Count: <strong>${d3.format(",")(femaleData.get(d) || 0)}</strong>`).style("opacity", 1);
    })
    .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
    .on("mouseout", () => tooltip.style("opacity", 0));
}

/**
 * Screen 2: Victim Entity Type Breakdown
 */
export async function type(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.victim_type || await lazy("victim_type");
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
    .text("Victim Classification Mix");

  header.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("NIBRS victim entity types (Person vs Commercial Business vs Society/Public).");

  const totalVictims = d3.sum(rawData, d => Number(d.count || 0)) || 1;

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1rem")
    .style("position", "relative");

  const width = chartBox.node().clientWidth || 800;
  const height = chartBox.node().clientHeight || 360;
  const margin = { top: 20, right: 90, bottom: 30, left: 180 };

  const svg = chartBox.append("svg").attr("width", width).attr("height", height);

  const sortedData = rawData.slice().sort((a, b) => Number(b.count || 0) - Number(a.count || 0));

  const yScale = d3.scaleBand()
    .domain(sortedData.map(d => String(d.victim_type || d.type || "Unknown")))
    .range([margin.top, height - margin.bottom])
    .padding(0.28);

  const maxVal = d3.max(sortedData, d => Number(d.count || 0)) || 100;
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
  const bars = svg.selectAll(".type-bar")
    .data(sortedData)
    .enter()
    .append("g");

  bars.append("rect")
    .attr("class", "type-bar")
    .attr("y", d => yScale(String(d.victim_type || d.type || "Unknown")))
    .attr("x", margin.left)
    .attr("height", yScale.bandwidth())
    .attr("width", d => Math.max(0, xScale(Number(d.count || 0)) - margin.left))
    .attr("fill", (d, i) => i === 0 ? "var(--accent, #38bdf8)" : "var(--accent-amber, #fbbf24)")
    .attr("rx", 4)
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      const cnt = Number(d.count || 0);
      const share = ((cnt / totalVictims) * 100).toFixed(1);
      tooltip.html(`
        <strong>${d.victim_type || d.type}</strong><br/>
        Victim Count: <strong>${d3.format(",")(cnt)}</strong><br/>
        Share: <strong>${share}%</strong>
      `).style("opacity", 1);
    })
    .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
    .on("mouseout", () => tooltip.style("opacity", 0));

  bars.append("text")
    .attr("y", d => yScale(String(d.victim_type || d.type || "Unknown")) + yScale.bandwidth() / 2 + 3)
    .attr("x", d => xScale(Number(d.count || 0)) + 8)
    .attr("fill", "var(--muted)")
    .style("font-size", "0.75rem")
    .text(d => {
      const cnt = Number(d.count || 0);
      return `${d3.format(",")(cnt)} (${((cnt / totalVictims) * 100).toFixed(1)}%)`;
    });
}

/**
 * Screen 3: Victim Descent / Ethnic Group Breakdown with Caveat Note
 */
export async function descent(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.victim_descent_by_cat || await lazy("victim_descent_by_cat");
  const tooltip = getTooltip();

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box");

  const categories = ["All Categories", ...Array.from(new Set(rawData.map(d => d.category))).filter(Boolean).sort()];
  let selectedCat = "All Categories";

  // Header Controls
  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "center")
    .style("margin-bottom", "0.5rem");

  const titleGroup = header.append("div");
  titleGroup.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.4rem")
    .style("color", "var(--text)")
    .text("Victim Descent / Ethnic Group Distribution");

  titleGroup.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Descent breakdown across reported individual victims.");

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
    .style("position", "relative")
    .style("overflow-y", "auto");

  // Caveat Banner at bottom
  wrapper.append("div")
    .style("margin-top", "0.5rem")
    .style("font-size", "0.72rem")
    .style("color", "var(--muted)")
    .style("font-style", "italic")
    .text("Note: Victim descent counts represent reported crime victims; they are not population rates and say nothing about offender demographics.");

  function render() {
    chartBox.html("");

    let filtered = rawData;
    if (selectedCat !== "All Categories") {
      filtered = rawData.filter(d => d.category === selectedCat);
    }

    const aggregatedMap = d3.rollup(
      filtered,
      v => d3.sum(v, d => Number(d.count || 0)),
      d => String(d.descent_group || d.descent_desc || d.descent || "Unknown")
    );

    const chartData = Array.from(aggregatedMap, ([descent, count]) => ({ descent, count }))
      .sort((a, b) => b.count - a.count);

    const totalCount = d3.sum(chartData, d => d.count) || 1;

    const width = chartBox.node().clientWidth || 800;
    const rowHeight = 24;
    const margin = { top: 15, right: 80, bottom: 25, left: 180 };
    const height = Math.max(chartBox.node().clientHeight || 300, chartData.length * rowHeight + margin.top + margin.bottom);

    const svg = chartBox.append("svg").attr("width", width).attr("height", height);

    const yScale = d3.scaleBand()
      .domain(chartData.map(d => d.descent))
      .range([margin.top, height - margin.bottom])
      .padding(0.22);

    const maxVal = d3.max(chartData, d => d.count) || 100;
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
      .style("font-size", "0.78rem");

    // X Axis
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("~s")))
      .call(g => g.select(".domain").attr("stroke", "var(--border)"))
      .selectAll("text")
      .attr("fill", "var(--muted)")
      .style("font-size", "0.75rem");

    // Bars
    const bars = svg.selectAll(".descent-bar")
      .data(chartData)
      .enter()
      .append("g");

    bars.append("rect")
      .attr("class", "descent-bar")
      .attr("y", d => yScale(d.descent))
      .attr("x", margin.left)
      .attr("height", yScale.bandwidth())
      .attr("width", d => Math.max(0, xScale(d.count) - margin.left))
      .attr("fill", "var(--accent, #38bdf8)")
      .attr("rx", 3)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        const share = ((d.count / totalCount) * 100).toFixed(1);
        tooltip.html(`
          <strong>${d.descent}</strong><br/>
          Victim Count: <strong>${d3.format(",")(d.count)}</strong><br/>
          Share: <strong>${share}%</strong>
        `).style("opacity", 1);
      })
      .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
      .on("mouseout", () => tooltip.style("opacity", 0));

    // Labels
    bars.append("text")
      .attr("y", d => yScale(d.descent) + yScale.bandwidth() / 2 + 3)
      .attr("x", d => xScale(d.count) + 8)
      .attr("fill", "var(--muted)")
      .style("font-size", "0.72rem")
      .text(d => `${d3.format(",")(d.count)} (${((d.count / totalCount) * 100).toFixed(1)}%)`);
  }

  catSelect.on("change", function () { selectedCat = this.value; render(); });
  render();
}

// Router Export Aliases
export {
  pyramid as ageSex,
  pyramid as demographics,
  type as victimType,
  type as typeMix,
  descent as descentByCat,
  pyramid as default
};