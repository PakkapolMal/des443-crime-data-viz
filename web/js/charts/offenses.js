/**
 * Chapter 5: #offenses — Offense Dynamics & Hierarchy
 * Exports: hierarchy, cooccurrence, distribution
 * Data sources: offense_hierarchy.json, offense_cooccurrence.json, offense_count_dist.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/**
 * Screen 1: Offense Hierarchy Treemap
 */
export async function hierarchy(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawHierarchy = data?.offense_hierarchy || await lazy("offense_hierarchy");

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

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box");

  // Header & Controls
  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "flex-end")
    .style("margin-bottom", "0.75rem");

  const titleGroup = header.append("div");
  titleGroup.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.4rem")
    .style("color", "var(--text)")
    .text("NIBRS Offense Classification Hierarchy");

  titleGroup.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Nested proportions of top crime categories and specific offense classifications.");

  const legendBox = header.append("div")
    .style("display", "flex")
    .style("gap", "0.75rem")
    .style("flex-wrap", "wrap")
    .style("align-items", "center");

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("background", "#070b14")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("position", "relative")
    .style("overflow", "hidden");

  const width = chartBox.node().clientWidth || 850;
  const height = chartBox.node().clientHeight || 420;

  // Helper to safely extract node label string
  const getNodeName = (d) => {
    if (!d) return "Unknown";
    return String(d.name || d.offense || d.category || d.label || "Offense");
  };

  const rootChildren = Array.isArray(rawHierarchy) 
    ? rawHierarchy 
    : (rawHierarchy?.children || []);

  const rootData = { name: "All Crimes", children: rootChildren };

  const root = d3.hierarchy(rootData)
    .sum(d => Number(d.value || d.count || d.size || 0))
    .sort((a, b) => b.value - a.value);

  const totalValue = root.value || 1;

  d3.treemap()
    .size([width, height])
    .paddingOuter(3)
    .paddingTop(2)
    .paddingInner(2)(root);

  // Distinct Unique Category Names for Color Scale & Legend
  const rawCatNames = root.children ? root.children.map(d => getNodeName(d.data)) : [];
  const categoryNames = Array.from(new Set(rawCatNames));

  const colorScale = d3.scaleOrdinal()
    .domain(categoryNames)
    .range(["#0284c7", "#d97706", "#e11d48", "#059669", "#7c3aed", "#ea580c", "#0891b2", "#db2777", "#6d28d9"]);

  // Render Unique Category Legend
  categoryNames.slice(0, 6).forEach(cat => {
    const item = legendBox.append("div").style("display", "flex").style("align-items", "center").style("gap", "0.35rem");
    item.append("span")
      .style("width", "10px")
      .style("height", "10px")
      .style("border-radius", "2px")
      .style("background", colorScale(cat));
    item.append("span")
      .style("font-size", "0.72rem")
      .style("color", "var(--text)")
      .style("font-weight", "500")
      .text(cat);
  });

  const svg = chartBox.append("svg").attr("width", width).attr("height", height);
  const defs = svg.append("defs");

  // Category Cluster Outlines
  if (root.children) {
    const parents = svg.selectAll("g.parent")
      .data(root.children)
      .enter()
      .append("g")
      .attr("class", "parent");

    parents.append("rect")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("width", d => Math.max(0, d.x1 - d.x0))
      .attr("height", d => Math.max(0, d.y1 - d.y0))
      .attr("fill", "none")
      .attr("stroke", d => colorScale(getNodeName(d.data)))
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.5);
  }

  // Leaf Nodes with Clip Paths
  const leaves = svg.selectAll("g.leaf")
    .data(root.leaves())
    .enter()
    .append("g")
    .attr("class", "leaf")
    .attr("transform", d => `translate(${d.x0},${d.y0})`);

  leaves.each(function (d, i) {
    const boxW = Math.max(0, d.x1 - d.x0);
    const boxH = Math.max(0, d.y1 - d.y0);
    const clipId = `leaf-clip-${i}`;

    // Define clipPath for each cell to prevent text overflow
    defs.append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", boxW)
      .attr("height", boxH);

    d3.select(this).attr("clip-path", `url(#${clipId})`);
  });

  leaves.append("rect")
    .attr("width", d => Math.max(0, d.x1 - d.x0))
    .attr("height", d => Math.max(0, d.y1 - d.y0))
    .attr("fill", d => {
      const topCategoryNode = d.ancestors().find(a => a.depth === 1);
      const topCategory = topCategoryNode ? getNodeName(topCategoryNode.data) : getNodeName(d.data);
      return colorScale(topCategory);
    })
    .attr("opacity", 0.85)
    .attr("rx", 2)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("stroke", "#ffffff").attr("stroke-width", 1.5);
      const topCategoryNode = d.ancestors().find(a => a.depth === 1);
      const topCategory = topCategoryNode ? getNodeName(topCategoryNode.data) : "N/A";
      const share = ((d.value / totalValue) * 100).toFixed(1);
      tooltip.html(`
        <strong>${getNodeName(d.data)}</strong><br/>
        Category: <em>${topCategory}</em><br/>
        Volume: <strong>${d3.format(",")(d.value)}</strong><br/>
        Share of Total: <strong>${share}%</strong>
      `).style("opacity", 1);
    })
    .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.85).attr("stroke", "none");
      tooltip.style("opacity", 0);
    });

  // Multi-line Clean Text Labels inside Cells
  leaves.each(function (d) {
    const boxW = d.x1 - d.x0;
    const boxH = d.y1 - d.y0;

    // Only render text if box is large enough to be readable
    if (boxW >= 42 && boxH >= 22) {
      const name = getNodeName(d.data);
      const share = ((d.value / totalValue) * 100).toFixed(1);

      const text = d3.select(this).append("text")
        .attr("x", 5)
        .attr("y", 13)
        .attr("fill", "#ffffff")
        .style("font-family", "system-ui, -apple-system, sans-serif")
        .style("font-size", boxW < 65 ? "0.6rem" : "0.68rem")
        .style("font-weight", "600")
        .style("pointer-events", "none")
        .style("text-shadow", "0 1px 3px rgba(0,0,0,0.9)");

      // Line 1: Offense Name
      text.append("tspan")
        .attr("x", 5)
        .text(name);

      // Line 2: Count & Percentage Share
      if (boxH >= 36) {
        text.append("tspan")
          .attr("x", 5)
          .attr("dy", "1.15em")
          .attr("fill", "#e2e8f0")
          .style("font-size", "0.58rem")
          .style("font-weight", "500")
          .text(`${d3.format("~s")(d.value)} (${share}%)`);
      }
    }
  });
}

/**
 * Screen 2: Offense Co-occurrence Matrix
 */
export async function cooccurrence(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.offense_cooccurrence || await lazy("offense_cooccurrence");

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

  const header = wrapper.append("div").style("margin-bottom", "0.75rem");
  header.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.4rem")
    .style("color", "var(--text)")
    .text("Offense Category Co-occurrence Matrix");

  header.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Frequency of crime categories reported together in a single incident.");

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1rem")
    .style("position", "relative")
    .style("overflow", "auto");

  const items = Array.from(new Set([
    ...rawData.map(d => String(d.source || d.cat1 || "")),
    ...rawData.map(d => String(d.target || d.cat2 || ""))
  ])).filter(Boolean).sort();

  const width = Math.max(chartBox.node().clientWidth || 800, items.length * 36 + 180);
  const height = items.length * 32 + 180;
  const margin = { top: 120, right: 30, bottom: 30, left: 140 };

  const svg = chartBox.append("svg").attr("width", width).attr("height", height);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleBand().domain(items).range([0, items.length * 32]).padding(0.08);
  const yScale = d3.scaleBand().domain(items).range([0, items.length * 32]).padding(0.08);

  const maxVal = d3.max(rawData, d => Number(d.value || d.count || 0)) || 100;
  const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, maxVal]);

  // X Axis
  g.append("g")
    .selectAll(".x-label")
    .data(items)
    .enter()
    .append("text")
    .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
    .attr("y", -10)
    .attr("text-anchor", "start")
    .attr("transform", d => `rotate(-45, ${xScale(d) + xScale.bandwidth() / 2}, -10)`)
    .attr("fill", "var(--text)")
    .style("font-size", "0.72rem")
    .text(d => d);

  // Y Axis
  g.append("g")
    .selectAll(".y-label")
    .data(items)
    .enter()
    .append("text")
    .attr("x", -8)
    .attr("y", d => yScale(d) + yScale.bandwidth() / 2 + 3)
    .attr("text-anchor", "end")
    .attr("fill", "var(--text)")
    .style("font-size", "0.75rem")
    .text(d => d);

  // Matrix Rectangles
  g.selectAll(".cell")
    .data(rawData)
    .enter()
    .append("rect")
    .attr("class", "cell")
    .attr("x", d => xScale(String(d.target || d.cat2 || "")))
    .attr("y", d => yScale(String(d.source || d.cat1 || "")))
    .attr("width", xScale.bandwidth())
    .attr("height", yScale.bandwidth())
    .attr("fill", d => colorScale(Number(d.value || d.count || 0)))
    .attr("rx", 2)
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      tooltip.html(`
        <strong>Co-occurrence Pair</strong><br/>
        ${d.source || d.cat1} + ${d.target || d.cat2}<br/>
        Count: <strong>${d3.format(",")(d.value || d.count)}</strong>
      `).style("opacity", 1);
    })
    .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
    .on("mouseout", () => tooltip.style("opacity", 0));
}

/**
 * Screen 3: Multi-Offense Distribution Per Incident
 */
export async function distribution(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.offense_count_dist || await lazy("offense_count_dist");

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
      .style("opacity", 0);
  }

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
    .text("Offenses Per Incident Report");

  header.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Distribution of single vs multiple offense counts per incident.");

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("padding", "1rem")
    .style("position", "relative");

  const width = chartBox.node().clientWidth || 800;
  const height = chartBox.node().clientHeight || 360;
  const margin = { top: 25, right: 30, bottom: 45, left: 60 };

  const svg = chartBox.append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleBand()
    .domain(rawData.map(d => `${d.offense_count} Offense${d.offense_count > 1 ? 's' : ''}`))
    .range([margin.left, width - margin.right])
    .padding(0.35);

  const maxVal = d3.max(rawData, d => Number(d.count || 0)) || 1000;
  const yScale = d3.scaleLinear()
    .domain([0, maxVal * 1.1])
    .range([height - margin.bottom, margin.top]);

  // X Axis
  svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale))
    .call(g => g.select(".domain").attr("stroke", "var(--border)"))
    .selectAll("text")
    .attr("fill", "var(--text)")
    .style("font-size", "0.8rem");

  // Y Axis
  svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format("~s")))
    .call(g => g.select(".domain").attr("stroke", "var(--border)"))
    .selectAll("text")
    .attr("fill", "var(--muted)")
    .style("font-size", "0.75rem");

  // Bars
  svg.selectAll(".dist-bar")
    .data(rawData)
    .enter()
    .append("rect")
    .attr("class", "dist-bar")
    .attr("x", d => xScale(`${d.offense_count} Offense${d.offense_count > 1 ? 's' : ''}`))
    .attr("y", d => yScale(Number(d.count || 0)))
    .attr("width", xScale.bandwidth())
    .attr("height", d => Math.max(0, height - margin.bottom - yScale(Number(d.count || 0))))
    .attr("fill", "var(--accent, #38bdf8)")
    .attr("rx", 4)
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      tooltip.html(`
        <strong>${d.offense_count} Offense(s)</strong><br/>
        Incident Count: <strong>${d3.format(",")(d.count)}</strong>
      `).style("opacity", 1);
    })
    .on("mousemove", event => tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px"))
    .on("mouseout", () => tooltip.style("opacity", 0));
}