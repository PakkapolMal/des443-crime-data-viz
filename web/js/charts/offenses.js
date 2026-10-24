/**
 * Chapter 5: #offenses — Offense Dynamics & Hierarchy
 * Exports: hierarchy, cooccurrence, distribution
 * Data sources: offense_hierarchy.json, offense_cooccurrence.json, offense_count_dist.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/**
 * Screen 1: NIBRS Offense Classification Hierarchy Treemap
 */
export async function hierarchy(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawHierarchy = data?.offense_hierarchy || (await lazy?.("offense_hierarchy")) || [];

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
  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "flex-end");

  const titleGroup = header.append("div");
  titleGroup.append("p").attr("class", "label").text("05 · OFFENSES");
  titleGroup.append("h2").text("NIBRS Offense Classification Hierarchy");
  titleGroup.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Nested proportions of top crime categories and specific offense classifications.");

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
        <span class="label">OFFENSE INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover over any cell in the treemap to inspect offense volume and share.</span>
      `);
    } else {
      const topCategoryNode = d.ancestors().find(a => a.depth === 1);
      const topCategory = topCategoryNode ? (topCategoryNode.data.name || topCategoryNode.data.category || "General") : "General";
      const name = d.data.name || d.data.offense || d.data.label || "Offense";
      const share = ((d.value / (root.value || 1)) * 100).toFixed(1);

      statsBanner.html(`
        <div>
          <span class="label">OFFENSE:</span>
          <strong style="color:var(--bone); margin-left:4px;">${name.toUpperCase()}</strong>
          <span style="color:var(--bone-60); margin-left:12px;">Category: ${topCategory}</span>
        </div>
        <div>
          <span class="label">VOLUME:</span>
          <strong class="num" style="margin-left:4px; color:var(--bone);">${d3.format(",")(d.value)}</strong>
          <span class="label" style="margin-left:12px;">SHARE:</span>
          <strong class="num signal" style="margin-left:4px;">${share}%</strong>
        </div>
      `);
    }
  }

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("position", "relative")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("overflow", "hidden");

  const bbox = chartBox.node()?.getBoundingClientRect() || {};
  const width = bbox.width || 850;
  const height = bbox.height || 420;

  const getNodeName = (d) => String(d?.name || d?.offense || d?.category || d?.label || "Offense");

  const rootChildren = Array.isArray(rawHierarchy) ? rawHierarchy : (rawHierarchy?.children || []);
  const rootData = { name: "All Crimes", children: rootChildren };

  const root = d3.hierarchy(rootData)
    .sum(d => Number(d.value || d.count || d.size || 0))
    .sort((a, b) => b.value - a.value);

  const totalValue = root.value || 1;
  updateBanner(null);

  // Check if dataset has multi-level parent groups
  const hasCategoryGroups = root.children && root.children.some(d => d.children && d.children.length > 0);

  const treemapLayout = d3.treemap()
    .size([width, height])
    .paddingOuter(3)
    .paddingInner(2)
    .round(true);

  if (hasCategoryGroups) {
    treemapLayout.paddingTop(d => (d.depth === 1 && d.children) ? 22 : 2);
  } else {
    treemapLayout.paddingTop(2);
  }

  treemapLayout(root);

  const rawCatNames = root.children ? root.children.map(d => getNodeName(d.data)) : [];
  const categoryNames = Array.from(new Set(rawCatNames));

  const palette = [
    "#38bdf8", "#f43f5e", "#fbbf24", "#34d399", "#a78bfa", 
    "#fb923c", "#2dd4bf", "#f472b6", "#818cf8", "#a3e635"
  ];

  const colorScale = d3.scaleOrdinal()
    .domain(categoryNames)
    .range(palette);

  const svg = chartBox.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const defs = svg.append("defs");

  // Render Parent Headers ONLY for nodes that are true multi-child containers
  const parentNodes = root.descendants().filter(d => d.depth === 1 && d.children && d.children.length > 0);

  if (parentNodes.length > 0) {
    const parents = svg.selectAll("g.parent")
      .data(parentNodes)
      .enter()
      .append("g")
      .attr("class", "parent");

    // Container border
    parents.append("rect")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("width", d => Math.max(0, d.x1 - d.x0))
      .attr("height", d => Math.max(0, d.y1 - d.y0))
      .attr("fill", "var(--bg)")
      .attr("fill-opacity", 0.4)
      .attr("stroke", d => colorScale(getNodeName(d.data)))
      .attr("stroke-width", 1)
      .attr("rx", 2);

    // Dedicated Header Bar
    parents.append("rect")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("width", d => Math.max(0, d.x1 - d.x0))
      .attr("height", 20)
      .attr("fill", "var(--surface)")
      .attr("fill-opacity", 0.95);

    // Header Clip-Path
    parents.each(function (d, i) {
      const headerW = Math.max(0, d.x1 - d.x0);
      const clipId = `parent-clip-${i}`;
      defs.append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", d.x0)
        .attr("y", d.y0)
        .attr("width", headerW)
        .attr("height", 20);

      d3.select(this).attr("clip-path", `url(#${clipId})`);
    });

    // Parent Header Title
    parents.append("text")
      .attr("x", d => d.x0 + 6)
      .attr("y", d => d.y0 + 14)
      .attr("fill", d => colorScale(getNodeName(d.data)))
      .style("font-family", "var(--font-mono)")
      .style("font-size", "10px")
      .style("font-weight", "700")
      .style("letter-spacing", "0.05em")
      .style("pointer-events", "none")
      .text(d => getNodeName(d.data).toUpperCase());
  }

  // Render Leaf Nodes
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

    defs.append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", boxW)
      .attr("height", boxH)
      .attr("rx", 2);

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
    .attr("fill-opacity", 0.35)
    .attr("stroke", d => {
      const topCategoryNode = d.ancestors().find(a => a.depth === 1);
      const topCategory = topCategoryNode ? getNodeName(topCategoryNode.data) : getNodeName(d.data);
      return colorScale(topCategory);
    })
    .attr("stroke-width", 1)
    .attr("rx", 2)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this)
        .attr("fill-opacity", 0.85)
        .attr("stroke", "var(--bone)")
        .attr("stroke-width", 1.5);
      
      updateBanner(d);

      const topCategoryNode = d.ancestors().find(a => a.depth === 1);
      const topCategory = topCategoryNode ? getNodeName(topCategoryNode.data) : "N/A";
      const share = ((d.value / totalValue) * 100).toFixed(1);

      tooltip.html(`
        <strong style="color:var(--bone);">${getNodeName(d.data)}</strong><br/>
        Category: <em>${topCategory}</em><br/>
        Volume: <strong>${d3.format(",")(d.value)}</strong><br/>
        Share of Total: <strong style="color:var(--signal);">${share}%</strong>
      `).style("opacity", 1);
    })
    .on("mousemove", event => {
      tooltip
        .style("left", (event.clientX + 14) + "px")
        .style("top", (event.clientY - 28) + "px");
    })
    .on("mouseout", function () {
      d3.select(this)
        .attr("fill-opacity", 0.35)
        .attr("stroke", d => {
          const topCategoryNode = d.ancestors().find(a => a.depth === 1);
          const topCategory = topCategoryNode ? getNodeName(topCategoryNode.data) : getNodeName(d.data);
          return colorScale(topCategory);
        })
        .attr("stroke-width", 1);

      updateBanner(null);
      tooltip.style("opacity", 0);
    });

  // Clean Single-Layer Text Labels inside Leaf Tiles
  leaves.each(function (d) {
    const boxW = d.x1 - d.x0;
    const boxH = d.y1 - d.y0;

    if (boxW >= 32 && boxH >= 16) {
      const leafName = getNodeName(d.data);
      const share = ((d.value / totalValue) * 100).toFixed(1);
      const formattedVal = d3.format("~s")(d.value);

      const text = d3.select(this).append("text")
        .attr("x", 5)
        .attr("y", 13)
        .attr("fill", "var(--bone)")
        .style("font-family", "var(--font-mono)")
        .style("font-size", boxW < 60 ? "8px" : "9.5px")
        .style("font-weight", "600")
        .style("pointer-events", "none");

      // Line 1: Offense Name
      text.append("tspan")
        .attr("x", 5)
        .text(leafName);

      // Line 2: Volume & Share
      if (boxH >= 28) {
        text.append("tspan")
          .attr("x", 5)
          .attr("dy", "1.15em")
          .attr("fill", "var(--bone-60)")
          .style("font-size", "8px")
          .style("font-weight", "500")
          .text(`${formattedVal} (${share}%)`);
      }
    }
  });
}

/**
 * Screen 2: Responsive Offense Co-occurrence Matrix
 */
export async function cooccurrence(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.offense_cooccurrence || (await lazy?.("offense_cooccurrence")) || [];

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
  header.append("p").attr("class", "label").text("05 · OFFENSES");
  header.append("h2").text("Offense Category Co-occurrence Matrix");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Frequency of crime categories reported together within a single incident report.");

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
        <span class="label">PAIR INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover over any matrix cell to inspect co-occurrence pairing frequency.</span>
      `);
    } else {
      const src = d.source || d.cat1 || "Category A";
      const tgt = d.target || d.cat2 || "Category B";
      const val = Number(d.value || d.count || 0);

      statsBanner.html(`
        <div>
          <span class="label">CO-OCCURRENCE PAIR:</span>
          <strong style="color:var(--bone); margin-left:4px;">${src} + ${tgt}</strong>
        </div>
        <div>
          <span class="label">SHARED INCIDENTS:</span>
          <strong class="num signal" style="margin-left:4px;">${d3.format(",")(val)}</strong>
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

  const items = Array.from(new Set([
    ...rawData.map(d => String(d.source || d.cat1 || "")),
    ...rawData.map(d => String(d.target || d.cat2 || ""))
  ])).filter(Boolean).sort();

  const bbox = chartBox.node()?.getBoundingClientRect() || {};
  const width = bbox.width || 900;
  const height = bbox.height || 450;
  
  const margin = { top: 120, right: 30, bottom: 20, left: 165 };

  const innerW = Math.max(100, width - margin.left - margin.right);
  const innerH = Math.max(100, height - margin.top - margin.bottom);

  const svg = chartBox.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleBand().domain(items).range([0, innerW]).padding(0.08);
  const yScale = d3.scaleBand().domain(items).range([0, innerH]).padding(0.08);

  const maxVal = d3.max(rawData, d => Number(d.value || d.count || 0)) || 100;
  const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, maxVal]);

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
    .attr("fill", "var(--bone)")
    .style("font-size", "var(--fs-label)")
    .style("font-family", "var(--font-mono)")
    .text(d => d);

  // Y Axis
  g.append("g")
    .selectAll(".y-label")
    .data(items)
    .enter()
    .append("text")
    .attr("x", -10)
    .attr("y", d => yScale(d) + yScale.bandwidth() / 2 + 3)
    .attr("text-anchor", "end")
    .attr("fill", "var(--bone-60)")
    .style("font-size", "var(--fs-small)")
    .style("font-family", "var(--font-mono)")
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
    .attr("fill", d => Number(d.value || d.count || 0) === 0 ? "var(--surface)" : colorScale(Number(d.value || d.count || 0)))
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      updateBanner(d);
      tooltip.html(`
        <strong style="color:var(--bone);">Co-occurrence Pair</strong><br/>
        ${d.source || d.cat1} + ${d.target || d.cat2}<br/>
        Incidents: <strong style="color:var(--signal);">${d3.format(",")(Number(d.value || d.count || 0))}</strong>
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
}

/**
 * Screen 3: Offense Count Distribution Per Incident
 */
export async function distribution(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.offense_count_dist || (await lazy?.("offense_count_dist")) || [];

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
  header.append("p").attr("class", "label").text("05 · OFFENSES");
  header.append("h2").text("Offenses Per Incident Report");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Distribution of single vs multiple offense counts recorded per incident.");

  const statsBanner = wrapper.append("div")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("padding", "var(--s-2) var(--s-3)")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "center")
    .style("font-family", "var(--font-mono)")
    .style("font-size", "var(--fs-small)");

  const totalIncidents = d3.sum(rawData, d => Number(d.count || 0)) || 1;

  function updateBanner(d) {
    if (!d) {
      statsBanner.html(`
        <span class="label">DISTRIBUTION INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover over any bar to inspect offense count shares.</span>
      `);
    } else {
      const cnt = Number(d.offense_count || 1);
      const val = Number(d.count || 0);
      const share = ((val / totalIncidents) * 100).toFixed(1);

      statsBanner.html(`
        <div>
          <span class="label">OFFENSE COUNT:</span>
          <strong style="color:var(--bone); margin-left:4px;">${cnt} Offense${cnt > 1 ? 's' : ''}</strong>
        </div>
        <div>
          <span class="label">INCIDENTS:</span>
          <strong class="num" style="margin-left:4px; color:var(--bone);">${d3.format(",")(val)}</strong>
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
    .style("position", "relative");

  const bbox = chartBox.node()?.getBoundingClientRect() || {};
  const width = bbox.width || 800;
  const height = bbox.height || 360;
  const margin = { top: 25, right: 30, bottom: 45, left: 65 };

  const svg = chartBox.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const xScale = d3.scaleBand()
    .domain(rawData.map(d => `${d.offense_count} Offense${d.offense_count > 1 ? 's' : ''}`))
    .range([margin.left, width - margin.right])
    .padding(0.35);

  const maxVal = d3.max(rawData, d => Number(d.count || 0)) || 1000;
  const yScale = d3.scaleLinear()
    .domain([0, maxVal * 1.1])
    .range([height - margin.bottom, margin.top]);

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale));

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format("~s")));

  svg.selectAll(".dist-bar")
    .data(rawData)
    .enter()
    .append("rect")
    .attr("class", "dist-bar")
    .attr("x", d => xScale(`${d.offense_count} Offense${d.offense_count > 1 ? 's' : ''}`))
    .attr("y", d => yScale(Number(d.count || 0)))
    .attr("width", xScale.bandwidth())
    .attr("height", d => Math.max(0, height - margin.bottom - yScale(Number(d.count || 0))))
    .attr("fill", "var(--bone)")
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "var(--signal)");
      updateBanner(d);

      const val = Number(d.count || 0);
      const share = ((val / totalIncidents) * 100).toFixed(1);

      tooltip.html(`
        <strong style="color:var(--bone);">${d.offense_count} Offense(s) Per Incident</strong><br/>
        Incident Count: <strong>${d3.format(",")(val)}</strong><br/>
        Share of Total: <strong style="color:var(--signal);">${share}%</strong>
      `).style("opacity", 1);
    })
    .on("mousemove", event => {
      tooltip
        .style("left", (event.clientX + 14) + "px")
        .style("top", (event.clientY - 28) + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", "var(--bone)");
      updateBanner(null);
      tooltip.style("opacity", 0);
    });
}