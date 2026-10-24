/**
 * Chapter 3: #places — Where does it happen?
 * Exports: map(el, { data, lazy }), areas(el, { data, lazy }), locations(el, { data, lazy })
 * Files used: geo_grid.json, geo_sample.json, area_summary.json, area_by_cat.json, top_locations.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { CATEGORIES, ramp } from "../util.js";

// Regional Anchors (Zoomed Out view)
const REGIONAL_ANCHORS = [
  { lat: 34.2200, lon: -118.5000, label: "SF Valley", dx: -6, dy: -4, anchor: "end" },
  { lat: 34.1000, lon: -118.3300, label: "Hollywood", dx: 6, dy: -4, anchor: "start" },
  { lat: 34.0450, lon: -118.2450, label: "DTLA", dx: 6, dy: 3, anchor: "start" },
  { lat: 34.0300, lon: -118.4400, label: "Westside", dx: -6, dy: 3, anchor: "end" },
  { lat: 33.9400, lon: -118.2700, label: "South LA", dx: 6, dy: 8, anchor: "start" },
  { lat: 33.7727, lon: -118.2838, label: "Harbor", dx: 6, dy: 3, anchor: "start" }
];

// 21 LAPD Divisions (Zoomed In view)
const DIVISION_CENTROIDS = {
  "Central": { lat: 34.0469, lon: -118.2500, label: "Central", dx: 6, dy: -2, anchor: "start" },
  "Hollywood": { lat: 34.0991, lon: -118.3278, label: "Hollywood", dx: 0, dy: -6, anchor: "middle" },
  "Van Nuys": { lat: 34.1813, lon: -118.4484, label: "Van Nuys", dx: 6, dy: 3, anchor: "start" },
  "Pacific": { lat: 33.9826, lon: -118.4206, label: "Pacific", dx: -6, dy: 3, anchor: "end" },
  "Harbor": { lat: 33.7727, lon: -118.2838, label: "Harbor", dx: 6, dy: 3, anchor: "start" },
  "Devonshire": { lat: 34.2496, lon: -118.5345, label: "Devonshire", dx: -6, dy: -4, anchor: "end" },
  "West LA": { lat: 34.0512, lon: -118.4381, label: "West LA", dx: -6, dy: -2, anchor: "end" },
  "77th Street": { lat: 33.9772, lon: -118.2966, label: "77th St", dx: -6, dy: 3, anchor: "end" },
  "Topanga": { lat: 34.1933, lon: -118.6003, label: "Topanga", dx: -6, dy: -2, anchor: "end" },
  "Rampart": { lat: 34.0628, lon: -118.2744, label: "Rampart", dx: -6, dy: -5, anchor: "end" },
  "Northeast": { lat: 34.1057, lon: -118.2478, label: "Northeast", dx: 6, dy: -4, anchor: "start" },
  "Mission": { lat: 34.2551, lon: -118.4515, label: "Mission", dx: 6, dy: -4, anchor: "start" },
  "N Hollywood": { lat: 34.1715, lon: -118.3828, label: "N Hollywood", dx: 6, dy: 3, anchor: "start" },
  "Foothill": { lat: 34.2476, lon: -118.3823, label: "Foothill", dx: 6, dy: -4, anchor: "start" },
  "Olympic": { lat: 34.0594, lon: -118.3006, label: "Olympic", dx: -6, dy: 3, anchor: "end" },
  "Wilshire": { lat: 34.0613, lon: -118.3509, label: "Wilshire", dx: -6, dy: -4, anchor: "end" },
  "West Valley": { lat: 34.1869, lon: -118.5177, label: "W Valley", dx: -6, dy: 3, anchor: "end" },
  "Southeast": { lat: 33.9395, lon: -118.2671, label: "Southeast", dx: 6, dy: 8, anchor: "start" },
  "Newton": { lat: 34.0089, lon: -118.2601, label: "Newton", dx: 6, dy: 6, anchor: "start" },
  "Southwest": { lat: 34.0196, lon: -118.3151, label: "Southwest", dx: -6, dy: 6, anchor: "end" },
  "Hollenbeck": { lat: 34.0548, lon: -118.2046, label: "Hollenbeck", dx: 6, dy: 3, anchor: "start" }
};

function getNearestDivision(lat, lon) {
  let minDistance = Infinity;
  let nearestArea = "Los Angeles";
  let nearestLabel = "LA";

  for (const [area, info] of Object.entries(DIVISION_CENTROIDS)) {
    const dLat = (lat - info.lat) * 69.0;
    const dLon = (lon - info.lon) * 57.0;
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < minDistance) {
      minDistance = dist;
      nearestArea = area;
      nearestLabel = info.label;
    }
  }

  return { area: nearestArea, label: nearestLabel, miles: minDistance.toFixed(1) };
}

/**
 * Screen 1: Spatial Density Map
 */
export async function map(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const gridData = data?.geo_grid || (await lazy?.("geo_grid")) || [];
  const sampleData = data?.geo_sample || (await lazy?.("geo_sample")) || [];

  let currentMode = "grid";
  let showLabels = true;
  let currentZoomScale = 1;
  const categories = ["All", ...Array.from(new Set(gridData.map(d => d.category))).sort()];
  let selectedCategory = "All";

  // Fixed Tooltip
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

  // Header Controls
  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "flex-end");

  const titleGroup = header.append("div");
  titleGroup.append("p").attr("class", "label").text("03 · WHERE");
  titleGroup.append("h2").text("Spatial Crime Density Map");
  titleGroup.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Geographic density contour map. Zoom in or hover grid cells to reveal area details.");

  const controls = header.append("div")
    .style("display", "flex")
    .style("gap", "var(--s-2)")
    .style("align-items", "center");

  // Category Selector
  const catGroup = controls.append("div").style("display", "flex").style("align-items", "center").style("gap", "var(--s-1)");
  catGroup.append("span").attr("class", "label").text("Category:");

  const catSelect = catGroup.append("select")
    .style("background", "var(--surface)")
    .style("color", "var(--bone)")
    .style("border", "var(--rule)")
    .style("font-family", "var(--font-mono)")
    .style("font-size", "var(--fs-label)")
    .style("padding", "var(--s-1) var(--s-2)");

  categories.forEach(cat => catSelect.append("option").attr("value", cat).text(cat));

  // Toggle Buttons
  const toggleGroup = controls.append("div").style("display", "flex").style("gap", "var(--s-1)");
  const btnGrid = toggleGroup.append("button").attr("aria-pressed", "true").text("Smooth Heatmap");
  const btnSample = toggleGroup.append("button").attr("aria-pressed", "false").text("Sample Dots");

  // Labels Toggle
  const btnLabels = controls.append("button").attr("aria-pressed", "true").text("Labels: ON");

  // Zoom Controls
  const zoomGroup = controls.append("div").style("display", "flex").style("gap", "var(--s-1)");
  const btnZoomIn = zoomGroup.append("button").text("+");
  const btnZoomOut = zoomGroup.append("button").text("-");

  // Dynamic Statistics Banner
  const statsBanner = wrapper.append("div")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("padding", "var(--s-2) var(--s-3)")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "center")
    .style("font-family", "var(--font-mono)")
    .style("font-size", "var(--fs-small)");

  function updateStatsBanner(areaName, dist, count) {
    if (!areaName) {
      statsBanner.html(`
        <span class="label">AREA INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover or click any cell on the map to inspect density statistics.</span>
      `);
    } else {
      statsBanner.html(`
        <div>
          <span class="label">DIVISION:</span>
          <strong style="color:var(--bone); margin-left:4px;">${areaName}</strong>
          <span style="color:var(--bone-60); margin-left:8px;">(~${dist} mi from centroid)</span>
        </div>
        <div>
          <span class="label">INCIDENT COUNT:</span>
          <strong class="num signal" style="margin-left:6px; font-size:var(--fs-body);">${d3.format(",")(count)}</strong>
        </div>
      `);
    }
  }
  updateStatsBanner(null, null, null);

  // Stage
  const stage = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("position", "relative")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("overflow", "hidden");

  const bbox = stage.node()?.getBoundingClientRect() || {};
  const width = bbox.width || 1000;
  const height = bbox.height || 480;

  const svg = stage.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const mapGroup = svg.append("g");
  const labelGroup = svg.append("g");

  // Geographic Scale Setup
  const allLons = gridData.map(d => Number(d.glon || 0)).filter(Boolean);
  const allLats = gridData.map(d => Number(d.glat || 0)).filter(Boolean);
  const lonExtent = d3.extent(allLons)[0] ? d3.extent(allLons) : [-118.65, -118.15];
  const latExtent = d3.extent(allLats)[0] ? d3.extent(allLats) : [33.70, 34.35];

  const midLat = (latExtent[0] + latExtent[1]) / 2;
  const cosLat = Math.cos(midLat * Math.PI / 180);

  const lonRange = lonExtent[1] - lonExtent[0];
  const latRange = latExtent[1] - latExtent[0];

  const padding = 40;
  const availW = Math.max(100, width - padding * 2);
  const availH = Math.max(100, height - padding * 2);

  const scaleX = availW / lonRange;
  const scaleY = availH / latRange;
  const scale = Math.min(scaleX, scaleY * cosLat);

  const mapW = lonRange * scale;
  const mapH = (latRange * scale) / cosLat;

  const offsetX = (width - mapW) / 2;
  const offsetY = (height - mapH) / 2;

  const xScale = d3.scaleLinear().domain(lonExtent).range([offsetX, offsetX + mapW]);
  const yScale = d3.scaleLinear().domain(latExtent).range([offsetY + mapH, offsetY]);

  // Zoom Handler
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
      mapGroup.attr("transform", event.transform);
      labelGroup.attr("transform", event.transform);
      currentZoomScale = event.transform.k;
      drawLandmarkLabels();
    });

  svg.call(zoom);

  btnZoomIn.on("click", () => svg.transition().duration(250).call(zoom.scaleBy, 1.4));
  btnZoomOut.on("click", () => svg.transition().duration(250).call(zoom.scaleBy, 0.7));

  function drawLandmarkLabels() {
    labelGroup.html("");
    if (!showLabels) return;

    const isZoomedIn = currentZoomScale > 3.0;
    const itemsToDraw = isZoomedIn
      ? Object.values(DIVISION_CENTROIDS)
      : REGIONAL_ANCHORS;

    // Place labels at the --fs-label size (16px at 1920, 11px floor); a little smaller once zoomed in.
    const labelPx = Math.max(11, window.innerWidth * 0.00833);
    const baseFontSizePx = isZoomedIn ? labelPx * 0.8 : labelPx;
    const effectiveFontSize = baseFontSizePx / currentZoomScale;
    const dotRadius = (isZoomedIn ? 1.8 : 2.5) / currentZoomScale;
    const strokeWidth = (isZoomedIn ? 0.8 : 1.2) / currentZoomScale;
    const haloWidth = (isZoomedIn ? 1.5 : 2.2) / currentZoomScale;

    itemsToDraw.forEach(info => {
      const x = xScale(info.lon);
      const y = yScale(info.lat);

      const g = labelGroup.append("g")
        .attr("transform", `translate(${x}, ${y})`)
        .style("pointer-events", "none");

      g.append("circle")
        .attr("r", dotRadius)
        .attr("fill", "var(--bone)")
        .attr("stroke", "var(--bg)")
        .attr("stroke-width", strokeWidth);

      g.append("text")
        .attr("x", (info.dx || 5) / currentZoomScale)
        .attr("y", (info.dy || 3) / currentZoomScale)
        .attr("text-anchor", info.anchor || "start")
        .attr("fill", "var(--bone)")
        .attr("font-size", `${effectiveFontSize}px`)
        .attr("font-weight", "600")
        .style("font-family", "var(--font-mono)")
        .style("paint-order", "stroke fill")
        .style("stroke", "var(--bg)")
        .style("stroke-width", `${haloWidth}px`)
        .style("stroke-linejoin", "round")
        .text(info.label);
    });
  }

  function renderMap() {
    mapGroup.html("");

    if (currentMode === "grid") {
      let filtered = gridData;
      if (selectedCategory !== "ALL" && selectedCategory !== "All") {
        filtered = gridData.filter(d => d.category === selectedCategory);
      }

      const coordMap = new Map();
      filtered.forEach(d => {
        const key = `${d.glat},${d.glon}`;
        coordMap.set(key, (coordMap.get(key) || 0) + Number(d.count || 0));
      });

      const aggregated = Array.from(coordMap.entries()).map(([key, count]) => {
        const [glat, glon] = key.split(",").map(Number);
        return { glat, glon, count };
      });

      const maxVal = d3.max(aggregated, d => d.count) || 100;
      // DESIGN.md ramp on a log domain (skewed counts); every drawn cell has count >= 1.
      const logMax = Math.log(Math.max(2, maxVal));
      const colorScale = (v) => ramp(Math.log(Math.max(1, v)) / logMax);

      const cellW = Math.abs(xScale(-118.25) - xScale(-118.26)) * 1.35;
      const cellH = Math.abs(yScale(34.05) - yScale(34.06)) * 1.35;

      // Interactive cells
      mapGroup.append("g")
        .selectAll("rect.cell")
        .data(aggregated)
        .enter()
        .append("rect")
        .attr("class", "cell")
        .attr("x", d => xScale(d.glon))
        .attr("y", d => yScale(d.glat))
        .attr("width", cellW)
        .attr("height", cellH)
        .attr("fill", d => colorScale(d.count))
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
          d3.select(this).attr("stroke", "var(--bone)").attr("stroke-width", 1);
          const loc = getNearestDivision(d.glat, d.glon);
          updateStatsBanner(loc.area, loc.miles, d.count);
          
          tooltip
            .html(`<strong>Near ${loc.label} Division</strong><br/><em>~${loc.miles} mi from ${loc.area} centroid</em><br/><br/>Incidents: <strong>${d3.format(",")(d.count)}</strong>`)
            .style("opacity", 1);
        })
        .on("mousemove", function (event) {
          tooltip.style("left", (event.clientX + 14) + "px").style("top", (event.clientY - 28) + "px");
        })
        .on("mouseout", function () {
          d3.select(this).attr("stroke", "none");
          tooltip.style("opacity", 0);
        });

    } else {
      // Dot Sample Map
      let filtered = sampleData;
      if (selectedCategory !== "ALL" && selectedCategory !== "All") {
        filtered = sampleData.filter(d => d.category === selectedCategory);
      }

      mapGroup.selectAll("circle")
        .data(filtered)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.lon))
        .attr("cy", d => yScale(d.lat))
        .attr("r", 1.8)
        .attr("fill", "var(--signal)")
        .attr("opacity", 0.5)
        .on("mouseover", function (event, d) {
          const loc = DIVISION_CENTROIDS[d.area]?.label || d.area;
          updateStatsBanner(loc, "0.0", 1);
          tooltip
            .html(`<strong>${loc} Division</strong><br/>Category: ${d.category}<br/>Month: ${d.month}`)
            .style("opacity", 1);
        })
        .on("mousemove", function (event) {
          tooltip.style("left", (event.clientX + 14) + "px").style("top", (event.clientY - 28) + "px");
        })
        .on("mouseout", function () {
          tooltip.style("opacity", 0);
        });
    }

    drawLandmarkLabels();
  }

  catSelect.on("change", function () {
    selectedCategory = this.value;
    renderMap();
  });

  btnGrid.on("click", () => {
    currentMode = "grid";
    btnGrid.attr("aria-pressed", "true");
    btnSample.attr("aria-pressed", "false");
    renderMap();
  });

  btnSample.on("click", () => {
    currentMode = "sample";
    btnSample.attr("aria-pressed", "true");
    btnGrid.attr("aria-pressed", "false");
    renderMap();
  });

  btnLabels.on("click", () => {
    showLabels = !showLabels;
    btnLabels.attr("aria-pressed", showLabels ? "true" : "false").text(showLabels ? "Labels: ON" : "Labels: OFF");
    drawLandmarkLabels();
  });

  renderMap();
}

/**
 * Screen 2: Area Summary Bars & Category Mix Heatmap
 */
export async function areas(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawSummary = data?.area_summary || (await lazy?.("area_summary")) || [];
  const summary = rawSummary.slice().sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
  const areaByCat = data?.area_by_cat || (await lazy?.("area_by_cat")) || [];

  let selectedArea = null;

  let tooltip = d3.select("body").select("#tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("id", "tooltip")
      .attr("class", "tooltip")
      .style("opacity", 0);
  }

  const wrapper = container.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1.6fr")
    .style("gap", "var(--s-4)")
    .style("width", "100%")
    .style("height", "100%");

  // Left Column: Area Total Bars
  const leftCol = wrapper.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("min-height", "0");

  leftCol.append("p").attr("class", "label").text("03 · WHERE");
  leftCol.append("h2").text("Total Incidents by LAPD Division");
  leftCol.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .style("margin-bottom", "var(--s-2)")
    .text("Sorted by total volume. Click a bar to isolate that division's row.");

  const barsBox = leftCol.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("overflow", "hidden")
    .style("position", "relative");

  // Fixed severity order (DESIGN.md), only categories present in the data.
  const present = new Set(areaByCat.map(d => d.category));
  const categories = CATEGORIES.filter(c => present.has(c));

  // Size rows and margins to the box so every division fits one screen at any 16:9 size.
  const k = Math.max(1, window.innerWidth / 1280);
  const barsBoxRect = barsBox.node().getBoundingClientRect();
  const hmMargin = { top: 105 * k, right: 20, bottom: 10, left: 105 * k };
  const bannerAllowance = 44 * k;
  const rowH = Math.max(14, Math.floor((barsBoxRect.height - hmMargin.top - hmMargin.bottom - bannerAllowance) / summary.length));
  const barMax = Math.max(80, barsBoxRect.width - 105 * k - 70 * k);

  const barSvg = barsBox.append("svg")
    .attr("width", "100%")
    .attr("height", summary.length * rowH + 10);

  const maxTotal = summary[0]?.total || 30000;
  const barXScale = d3.scaleLinear().domain([0, maxTotal]).range([0, barMax]);

  const barRows = barSvg.selectAll(".area-bar-row")
    .data(summary)
    .enter()
    .append("g")
    .attr("class", "area-bar-row")
    .attr("transform", (d, i) => `translate(0, ${i * rowH})`)
    .style("cursor", "pointer")
    .on("click", function (event, d) {
      selectedArea = selectedArea === d.area ? null : d.area;
      updateHighlights();
    });

  barRows.append("text")
    .attr("x", 95 * k)
    .attr("y", rowH * 0.72)
    .attr("text-anchor", "end")
    .attr("fill", "var(--bone)")
    .style("font-size", "var(--fs-small)")
    .text(d => d.area);

  barRows.append("rect")
    .attr("class", "area-bar")
    .attr("x", 105 * k)
    .attr("y", rowH * 0.1)
    .attr("width", d => Math.max(0, barXScale(Number(d.total || 0))))
    .attr("height", rowH * 0.75)
    .attr("fill", "var(--bone)");

  barRows.append("text")
    .attr("x", d => 112 * k + barXScale(Number(d.total || 0)))
    .attr("y", rowH * 0.68)
    .attr("fill", "var(--bone-60)")
    .style("font-size", "var(--fs-label)")
    .text(d => d3.format(",")(Number(d.total || 0)));

  // Right Column: Area × Category Row Share Heatmap
  const rightCol = wrapper.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("min-height", "0");

  rightCol.append("p").attr("class", "label").text("CATEGORY MIX");
  rightCol.append("h2").text("Area × Category Row Share Heatmap");

  // Live Statistics Strip for Heatmap
  const categoryStatsBanner = rightCol.append("div")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("padding", "var(--s-1) var(--s-2)")
    .style("margin-top", "var(--s-1)")
    .style("margin-bottom", "var(--s-2)")
    .style("font-family", "var(--font-mono)")
    .style("font-size", "var(--fs-small)");

  function updateHeatmapStats(area, category, count, share) {
    if (!area) {
      categoryStatsBanner.html(`
        <span class="label">STATISTICS INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover over any heatmap cell to view proportional stats.</span>
      `);
    } else {
      categoryStatsBanner.html(`
        <span class="label">${area.toUpperCase()}</span> • <strong style="color:var(--bone);">${category}</strong>: 
        <strong class="signal num" style="margin-left:4px;">${d3.format(",")(count)}</strong> cases 
        <span style="color:var(--bone-60);">(${share}% of division total)</span>
      `);
    }
  }
  updateHeatmapStats(null);

  const heatmapBox = rightCol.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("overflow", "hidden")
    .style("position", "relative");

  const hmBoxW = heatmapBox.node().getBoundingClientRect().width;
  const cellWidth = Math.max(20, (hmBoxW - hmMargin.left - hmMargin.right - 60 * k) / categories.length);
  const hmWidth = categories.length * cellWidth + hmMargin.left + hmMargin.right;
  const hmHeight = summary.length * rowH + hmMargin.top + hmMargin.bottom;

  const hmSvg = heatmapBox.append("svg")
    .attr("width", hmWidth)
    .attr("height", hmHeight);

  const hmG = hmSvg.append("g").attr("transform", `translate(${hmMargin.left},${hmMargin.top})`);

  const xScale = d3.scaleBand().domain(categories).range([0, categories.length * cellWidth]).padding(0.08);
  const yScale = d3.scaleBand().domain(summary.map(d => d.area)).range([0, summary.length * rowH]).padding(0.08);

  hmG.append("g")
    .selectAll(".cat-label")
    .data(categories)
    .enter()
    .append("text")
    .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
    .attr("y", -8)
    .attr("text-anchor", "start")
    .attr("transform", d => `rotate(-45, ${xScale(d) + xScale.bandwidth() / 2}, -8)`)
    .attr("fill", "var(--bone)")
    .style("font-size", "var(--fs-label)")
    .text(d => d);

  hmG.append("g")
    .selectAll(".area-label")
    .data(summary.map(d => d.area))
    .enter()
    .append("text")
    .attr("x", -8)
    .attr("y", d => yScale(d) + yScale.bandwidth() / 2 + 3)
    .attr("text-anchor", "end")
    .attr("fill", "var(--bone-60)")
    .style("font-size", "var(--fs-small)")
    .text(d => d);

  const heatmapData = [];
  summary.forEach(s => {
    const areaTot = Number(s.total || 1);
    categories.forEach(cat => {
      const match = areaByCat.find(d => d.area === s.area && d.category === cat);
      const count = match ? Number(match.count || 0) : 0;
      heatmapData.push({
        area: s.area,
        category: cat,
        count: count,
        share: count / areaTot
      });
    });
  });

  const maxShare = d3.max(heatmapData, d => d.share) || 0.3;
  const colorScale = (v) => ramp(v / maxShare);

  const rects = hmG.selectAll(".hm-rect")
    .data(heatmapData)
    .enter()
    .append("rect")
    .attr("class", "hm-rect")
    .attr("x", d => xScale(d.category))
    .attr("y", d => yScale(d.area))
    .attr("width", xScale.bandwidth())
    .attr("height", yScale.bandwidth())
    .attr("fill", d => d.count === 0 ? "var(--surface)" : colorScale(d.share))
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      const sharePct = (d.share * 100).toFixed(1);
      updateHeatmapStats(d.area, d.category, d.count, sharePct);
      
      tooltip
        .html(`<strong>${d.area} Division</strong><br/>Category: ${d.category}<br/>Incidents: <strong>${d.count.toLocaleString()}</strong><br/>Row Share: <strong>${sharePct}%</strong>`)
        .style("opacity", 1);
    })
    .on("mousemove", function (event) {
      tooltip.style("left", (event.clientX + 14) + "px").style("top", (event.clientY - 28) + "px");
    })
    .on("mouseout", function () {
      updateHeatmapStats(null);
      tooltip.style("opacity", 0);
    });

  function updateHighlights() {
    barRows.selectAll(".area-bar")
      .attr("fill", d => (selectedArea === null || selectedArea === d.area) ? "var(--bone)" : "var(--surface)");

    rects.style("opacity", d => (selectedArea === null || selectedArea === d.area) ? 1 : 0.2);
  }
}

/**
 * Screen 3: Top-25 Incident Locations Table
 */
export async function locations(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawLocs = data?.top_locations || (await lazy?.("top_locations")) || [];
  const locs = rawLocs.slice(0, 12); // 12 rows fit one 16:9 screen without an inner scroll

  const wrapper = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
    .style("gap", "var(--s-3)");

  const header = wrapper.append("div");
  header.append("p").attr("class", "label").text("03 · WHERE");
  header.append("h2").text("The 12 busiest addresses");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Hundred-block addresses with highest incident concentration across Los Angeles.");

  const tableBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("overflow", "hidden")
    .style("border-top", "var(--rule)");

  const table = tableBox.append("table")
    .attr("class", "data-table")
    .style("width", "100%")
    .style("table-layout", "fixed");

  const thead = table.append("thead");
  const tr = thead.append("tr");

  const colSpecs = [
    { text: "Rank", width: "8%", align: "left" },
    { text: "Location Address", width: "38%", align: "left" },
    { text: "LAPD Division", width: "22%", align: "left" },
    { text: "Top Category", width: "18%", align: "left" },
    { text: "Incidents", width: "14%", align: "right" }
  ];

  colSpecs.forEach(col => {
    tr.append("th")
      .style("width", col.width)
      .style("text-align", col.align)
      .style("padding", "var(--s-2) var(--s-3)")
      .text(col.text);
  });

  const tbody = table.append("tbody");

  locs.forEach((d, i) => {
    const row = tbody.append("tr");

    row.append("td")
      .style("padding", "var(--s-2) var(--s-3)")
      .style("color", "var(--bone-60)")
      .text(`#${i + 1}`);

    row.append("td")
      .style("padding", "var(--s-2) var(--s-3)")
      .style("font-weight", "700")
      .style("color", "var(--bone)")
      .text(d.location || d.address || "Unknown");

    row.append("td")
      .style("padding", "var(--s-2) var(--s-3)")
      .style("color", "var(--bone)")
      .text(d.area || "N/A");

    row.append("td")
      .style("padding", "var(--s-2) var(--s-3)")
      .style("color", "var(--bone-60)")
      .text(d.top_category || "Group B");

    row.append("td")
      .attr("class", "num")
      .style("padding", "var(--s-2) var(--s-3)")
      .style("text-align", "right")
      .style("font-weight", "700")
      .text(d3.format(",")(Number(d.count || 0)));
  });
}