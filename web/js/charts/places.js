/**
 * Chapter 3: #places — Where does it happen?
 * Exports: map(el, { lazy }), areas(el, { data }), locations(el, { data })
 * Files used: geo_grid.json, geo_sample.json, area_summary.json, area_by_cat.json, top_locations.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

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
 * Screen 1: Spatial Density Map with Dynamic Counter-Scaled Zoom Labels
 */
export async function map(el, { lazy }) {
  const container = d3.select(el);
  container.html("");

  const [gridData, sampleData] = await Promise.all([
    lazy("geo_grid"),
    lazy("geo_sample")
  ]);

  let currentMode = "grid";
  let showLabels = true;
  let currentZoomScale = 1;
  const categories = ["All", ...Array.from(new Set(gridData.map(d => d.category))).sort()];
  let selectedCategory = "All";

  // Tooltip
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
    .style("align-items", "flex-end")
    .style("margin-bottom", "0.75rem");

  const titleGroup = header.append("div");
  titleGroup.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.4rem")
    .style("color", "var(--text)")
    .text("Spatial Crime Density Map");

  titleGroup.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Geographic density contour map. Zoom in to reveal micro division labels.");

  const controls = header.append("div")
    .style("display", "flex")
    .style("gap", "0.75rem")
    .style("align-items", "center");

  // Category Selector
  const catGroup = controls.append("div");
  catGroup.append("label")
    .style("font-size", "0.75rem")
    .style("color", "var(--muted)")
    .style("margin-right", "0.35rem")
    .text("Category:");

  const catSelect = catGroup.append("select")
    .style("background", "var(--bg-card, #1e293b)")
    .style("color", "var(--text)")
    .style("border", "1px solid var(--border, #334155)")
    .style("padding", "0.25rem 0.5rem")
    .style("border-radius", "4px")
    .style("font-size", "0.8rem");

  categories.forEach(cat => catSelect.append("option").attr("value", cat).text(cat));

  // Toggle Mode
  const toggleGroup = controls.append("div")
    .style("display", "flex")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "4px")
    .style("overflow", "hidden");

  const btnGrid = toggleGroup.append("button")
    .style("background", "var(--accent, #38bdf8)")
    .style("color", "#0f172a")
    .style("border", "none")
    .style("padding", "0.25rem 0.6rem")
    .style("font-size", "0.8rem")
    .style("font-weight", "600")
    .style("cursor", "pointer")
    .text("Smooth Heatmap");

  const btnSample = toggleGroup.append("button")
    .style("background", "var(--bg-card, #1e293b)")
    .style("color", "var(--text)")
    .style("border", "none")
    .style("padding", "0.25rem 0.6rem")
    .style("font-size", "0.8rem")
    .style("cursor", "pointer")
    .text("Sample Dots");

  // Toggle Overlay Labels
  const btnLabels = controls.append("button")
    .style("background", "rgba(56, 189, 248, 0.15)")
    .style("border", "1px solid var(--accent, #38bdf8)")
    .style("color", "var(--accent, #38bdf8)")
    .style("padding", "0.25rem 0.6rem")
    .style("border-radius", "4px")
    .style("font-size", "0.8rem")
    .style("cursor", "pointer")
    .text("Labels: ON");

  // Zoom Buttons
  const zoomGroup = controls.append("div").style("display", "flex").style("gap", "0.2rem");
  const btnZoomIn = zoomGroup.append("button")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("color", "var(--text)")
    .style("padding", "0.2rem 0.5rem")
    .style("border-radius", "4px")
    .style("cursor", "pointer")
    .text("+");

  const btnZoomOut = zoomGroup.append("button")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("color", "var(--text)")
    .style("padding", "0.2rem 0.5rem")
    .style("border-radius", "4px")
    .style("cursor", "pointer")
    .text("-");

  // Stage Setup
  const stage = wrapper.append("div")
    .style("flex", "1")
    .style("width", "100%")
    .style("position", "relative")
    .style("background", "#070b14")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px")
    .style("overflow", "hidden");

  const width = stage.node().clientWidth || 1000;
  const height = stage.node().clientHeight || 480;

  const svg = stage.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const defs = svg.append("defs");
  const blurFilter = defs.append("filter")
    .attr("id", "heatmap-glow")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%");

  blurFilter.append("feGaussianBlur")
    .attr("stdDeviation", "3.5")
    .attr("result", "blur");

  const mapGroup = svg.append("g");
  const labelGroup = svg.append("g");

  // Geographic Scale Setup
  const allLons = gridData.map(d => d.glon);
  const allLats = gridData.map(d => d.glat);
  const lonExtent = d3.extent(allLons);
  const latExtent = d3.extent(allLats);

  const midLat = (latExtent[0] + latExtent[1]) / 2;
  const cosLat = Math.cos(midLat * Math.PI / 180);

  const lonRange = lonExtent[1] - lonExtent[0];
  const latRange = latExtent[1] - latExtent[0];

  const padding = 40;
  const availW = width - padding * 2;
  const availH = height - padding * 2;

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

  btnZoomIn.on("click", () => svg.transition().duration(300).call(zoom.scaleBy, 1.4));
  btnZoomOut.on("click", () => svg.transition().duration(300).call(zoom.scaleBy, 0.7));

  function drawLandmarkLabels() {
    labelGroup.html("");
    if (!showLabels) return;

    const isZoomedIn = currentZoomScale > 3.0;
    const itemsToDraw = isZoomedIn
      ? Object.values(DIVISION_CENTROIDS)
      : REGIONAL_ANCHORS;

    // Counter-scale font size: smaller when zoomed in (6.5px screen size) than zoomed out (9.5px screen size)
    const baseFontSizePx = isZoomedIn ? 6.5 : 9.5;
    const effectiveFontSize = baseFontSizePx / currentZoomScale;
    const dotRadius = (isZoomedIn ? 1.8 : 2.6) / currentZoomScale;
    const strokeWidth = (isZoomedIn ? 0.9 : 1.4) / currentZoomScale;
    const haloWidth = (isZoomedIn ? 1.4 : 2.0) / currentZoomScale;

    itemsToDraw.forEach(info => {
      const x = xScale(info.lon);
      const y = yScale(info.lat);

      const g = labelGroup.append("g")
        .attr("transform", `translate(${x}, ${y})`)
        .style("pointer-events", "none");

      // Pin Dot
      g.append("circle")
        .attr("r", dotRadius)
        .attr("fill", "#ffffff")
        .attr("stroke", "var(--accent, #38bdf8)")
        .attr("stroke-width", strokeWidth);

      // Label Text with SVG Counter-Scaling
      g.append("text")
        .attr("x", (info.dx || 5) / currentZoomScale)
        .attr("y", (info.dy || 3) / currentZoomScale)
        .attr("text-anchor", info.anchor || "start")
        .attr("fill", "#f8fafc")
        .attr("font-size", `${effectiveFontSize}px`)
        .attr("font-weight", "600")
        .style("font-family", "sans-serif")
        .style("paint-order", "stroke fill")
        .style("stroke", "#030712")
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
        coordMap.set(key, (coordMap.get(key) || 0) + d.count);
      });

      const aggregated = Array.from(coordMap.entries()).map(([key, count]) => {
        const [glat, glon] = key.split(",").map(Number);
        return { glat, glon, count };
      });

      const maxVal = d3.max(aggregated, d => d.count) || 100;
      const colorScale = d3.scaleSequentialLog()
        .domain([1, maxVal])
        .interpolator(d3.interpolateInferno);

      const cellW = Math.abs(xScale(-118.25) - xScale(-118.26)) * 1.35;
      const cellH = Math.abs(yScale(34.05) - yScale(34.06)) * 1.35;

      // Glow layer
      mapGroup.append("g")
        .attr("filter", "url(#heatmap-glow)")
        .selectAll("rect.glow")
        .data(aggregated)
        .enter()
        .append("rect")
        .attr("class", "glow")
        .attr("x", d => xScale(d.glon) - cellW * 0.2)
        .attr("y", d => yScale(d.glat) - cellH * 0.2)
        .attr("width", cellW * 1.4)
        .attr("height", cellH * 1.4)
        .attr("fill", d => colorScale(d.count))
        .attr("opacity", 0.85)
        .attr("rx", cellW * 0.5);

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
        .attr("opacity", 0.6)
        .attr("rx", 1)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
          d3.select(this).attr("opacity", 1).attr("stroke", "#ffffff").attr("stroke-width", 1);
          const loc = getNearestDivision(d.glat, d.glon);
          tooltip
            .html(`<strong>Near ${loc.label} Division</strong><br/><em>~${loc.miles} mi from ${loc.area} centroid</em><br/><br/>Incidents: <strong>${d3.format(",")(d.count)}</strong>`)
            .style("opacity", 1);
        })
        .on("mousemove", function (event) {
          tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
          d3.select(this).attr("opacity", 0.6).attr("stroke", "none");
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
        .attr("fill", "var(--accent, #38bdf8)")
        .attr("opacity", 0.35)
        .on("mouseover", function (event, d) {
          const loc = DIVISION_CENTROIDS[d.area]?.label || d.area;
          tooltip
            .html(`<strong>${loc} Division</strong><br/>Category: ${d.category}<br/>Month: ${d.month}`)
            .style("opacity", 1);
        })
        .on("mousemove", function (event) {
          tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px");
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
    btnGrid.style("background", "var(--accent, #38bdf8)").style("color", "#0f172a").style("font-weight", "600");
    btnSample.style("background", "var(--bg-card, #1e293b)").style("color", "var(--text)").style("font-weight", "normal");
    renderMap();
  });

  btnSample.on("click", () => {
    currentMode = "sample";
    btnSample.style("background", "var(--accent, #38bdf8)").style("color", "#0f172a").style("font-weight", "600");
    btnGrid.style("background", "var(--bg-card, #1e293b)").style("color", "var(--text)").style("font-weight", "normal");
    renderMap();
  });

  btnLabels.on("click", () => {
    showLabels = !showLabels;
    btnLabels
      .style("background", showLabels ? "rgba(56, 189, 248, 0.15)" : "var(--bg-card, #1e293b)")
      .style("color", showLabels ? "var(--accent, #38bdf8)" : "var(--muted)")
      .text(showLabels ? "Labels: ON" : "Labels: OFF");
    drawLandmarkLabels();
  });

  renderMap();
}

/**
 * Screen 2: Area Summary Bars & Area × Category Heatmap
 */
export function areas(el, { data }) {
  const container = d3.select(el);
  container.html("");

  const summary = (data.area_summary || []).slice().sort((a, b) => b.total - a.total);
  const areaByCat = data.area_by_cat || [];

  let selectedArea = null;

  let tooltip = d3.select("body").select(".chart-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("background", "var(--bg-card, #0f172a)")
      .style("border", "1px solid var(--accent, #38bdf8)")
      .style("color", "var(--text, #f8fafc)")
      .style("padding", "0.4rem 0.6rem")
      .style("border-radius", "4px")
      .style("font-size", "0.75rem")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", "1000");
  }

  const wrapper = container.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1.6fr")
    .style("gap", "1.5rem")
    .style("width", "100%")
    .style("height", "100%")
    .style("padding", "1.25rem 1.75rem")
    .style("box-sizing", "border-box");

  // Left Column: Area Total Bars
  const leftCol = wrapper.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("min-height", "0");

  leftCol.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.25rem")
    .style("color", "var(--text)")
    .text("Total Incidents by LAPD Division");

  leftCol.append("p")
    .style("margin", "0 0 0.5rem 0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Sorted by total volume. Click a bar to isolate that division's row.");

  const barsBox = leftCol.append("div")
    .style("flex", "1")
    .style("overflow-y", "auto")
    .style("position", "relative");

  const categories = Array.from(new Set(areaByCat.map(d => d.category))).sort();
  const areaTotalsMap = new Map(summary.map(d => [d.area, d.total]));

  const barSvg = barsBox.append("svg")
    .attr("width", "100%")
    .attr("height", summary.length * 21 + 10);

  const maxTotal = summary[0]?.total || 30000;
  const barXScale = d3.scaleLinear().domain([0, maxTotal]).range([0, 160]);

  const barRows = barSvg.selectAll(".area-bar-row")
    .data(summary)
    .enter()
    .append("g")
    .attr("class", "area-bar-row")
    .attr("transform", (d, i) => `translate(0, ${i * 21})`)
    .style("cursor", "pointer")
    .on("click", function (event, d) {
      selectedArea = selectedArea === d.area ? null : d.area;
      updateHighlights();
    });

  barRows.append("text")
    .attr("x", 100)
    .attr("y", 14)
    .attr("text-anchor", "end")
    .attr("fill", "var(--text)")
    .style("font-size", "0.75rem")
    .text(d => d.area);

  barRows.append("rect")
    .attr("class", "area-bar")
    .attr("x", 110)
    .attr("y", 2)
    .attr("width", d => barXScale(d.total))
    .attr("height", 15)
    .attr("fill", "var(--accent, #38bdf8)")
    .attr("rx", 3);

  barRows.append("text")
    .attr("x", d => 116 + barXScale(d.total))
    .attr("y", 13)
    .attr("fill", "var(--muted)")
    .style("font-size", "0.7rem")
    .text(d => d3.format(",")(d.total));

  // Right Column: Area × Category Row Share Heatmap
  const rightCol = wrapper.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("min-height", "0");

  rightCol.append("h2")
    .style("margin", "0 0 0.2rem 0")
    .style("font-size", "1.25rem")
    .style("color", "var(--text)")
    .text("Area × Category Row Share Heatmap");

  rightCol.append("p")
    .style("margin", "0 0 0.5rem 0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Normalized by area total (count ÷ area total) to reflect proportional mix.");

  const heatmapBox = rightCol.append("div")
    .style("flex", "1")
    .style("overflow", "auto")
    .style("position", "relative");

  const hmMargin = { top: 105, right: 20, bottom: 20, left: 105 };
  const cellWidth = 34;
  const hmWidth = categories.length * cellWidth + hmMargin.left + hmMargin.right;
  const hmHeight = summary.length * 21 + hmMargin.top + hmMargin.bottom;

  const hmSvg = heatmapBox.append("svg")
    .attr("width", hmWidth)
    .attr("height", hmHeight);

  const hmG = hmSvg.append("g").attr("transform", `translate(${hmMargin.left},${hmMargin.top})`);

  const xScale = d3.scaleBand().domain(categories).range([0, categories.length * cellWidth]).padding(0.08);
  const yScale = d3.scaleBand().domain(summary.map(d => d.area)).range([0, summary.length * 21]).padding(0.08);

  hmG.append("g")
    .selectAll(".cat-label")
    .data(categories)
    .enter()
    .append("text")
    .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
    .attr("y", -10)
    .attr("text-anchor", "start")
    .attr("transform", d => `rotate(-45, ${xScale(d) + xScale.bandwidth() / 2}, -10)`)
    .attr("fill", "var(--text)")
    .style("font-size", "0.72rem")
    .text(d => d);

  hmG.append("g")
    .selectAll(".area-label")
    .data(summary.map(d => d.area))
    .enter()
    .append("text")
    .attr("x", -8)
    .attr("y", d => yScale(d) + yScale.bandwidth() / 2 + 3)
    .attr("text-anchor", "end")
    .attr("fill", "var(--muted)")
    .style("font-size", "0.75rem")
    .text(d => d);

  const heatmapData = [];
  summary.forEach(s => {
    const areaTot = s.total || 1;
    categories.forEach(cat => {
      const match = areaByCat.find(d => d.area === s.area && d.category === cat);
      const count = match ? match.count : 0;
      heatmapData.push({
        area: s.area,
        category: cat,
        count: count,
        share: count / areaTot
      });
    });
  });

  const maxShare = d3.max(heatmapData, d => d.share) || 0.3;
  const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, maxShare]);

  const rects = hmG.selectAll(".hm-rect")
    .data(heatmapData)
    .enter()
    .append("rect")
    .attr("class", "hm-rect")
    .attr("x", d => xScale(d.category))
    .attr("y", d => yScale(d.area))
    .attr("width", xScale.bandwidth())
    .attr("height", yScale.bandwidth())
    .attr("fill", d => d.count === 0 ? "rgba(255,255,255,0.02)" : colorScale(d.share))
    .attr("rx", 2)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      tooltip
        .html(`<strong>${d.area} Division</strong><br/>Category: ${d.category}<br/>Count: ${d.count.toLocaleString()}<br/>Row Share: ${(d.share * 100).toFixed(1)}%`)
        .style("opacity", 1);
    })
    .on("mousemove", function (event) {
      tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function () {
      tooltip.style("opacity", 0);
    });

  function updateHighlights() {
    barRows.selectAll(".area-bar")
      .attr("fill", d => (selectedArea === null || selectedArea === d.area) ? "var(--accent, #38bdf8)" : "var(--border, #334155)");

    rects.style("opacity", d => (selectedArea === null || selectedArea === d.area) ? 1 : 0.2);
  }
}

/**
 * Screen 3: Top-25 Incident Locations Table
 */
export function locations(el, { data }) {
  const container = d3.select(el);
  container.html("");

  const locs = (data.top_locations || []).slice(0, 25);

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
    .text("Top-25 High-Frequency Address Locations");

  header.append("p")
    .style("margin", "0")
    .style("font-size", "0.8rem")
    .style("color", "var(--muted)")
    .text("Hundred-block addresses with highest incident concentration across Los Angeles.");

  const tableBox = wrapper.append("div")
    .style("flex", "1")
    .style("overflow-y", "auto")
    .style("background", "var(--bg-card, #1e293b)")
    .style("border", "1px solid var(--border, #334155)")
    .style("border-radius", "8px");

  const table = tableBox.append("table")
    .style("width", "100%")
    .style("border-collapse", "collapse")
    .style("font-size", "0.85rem")
    .style("text-align", "left");

  const thead = table.append("thead");
  const tr = thead.append("tr")
    .style("border-bottom", "1px solid var(--border, #334155)");

  ["Rank", "Location Address", "LAPD Division", "Top Category", "Incidents"].forEach((text) => {
    tr.append("th")
      .style("padding", "0.7rem 1rem")
      .style("color", "var(--muted)")
      .style("font-weight", "600")
      .style("position", "sticky")
      .style("top", "0")
      .style("background", "#0f172a")
      .text(text);
  });

  const tbody = table.append("tbody");

  locs.forEach((d, i) => {
    const row = tbody.append("tr")
      .style("border-bottom", "1px solid var(--border, #334155)")
      .style("transition", "background 0.15s ease");

    row.on("mouseover", function () {
      d3.select(this).style("background", "rgba(255,255,255,0.04)");
    }).on("mouseout", function () {
      d3.select(this).style("background", "transparent");
    });

    row.append("td")
      .style("padding", "0.55rem 1rem")
      .style("color", "var(--muted)")
      .text(i + 1);

    row.append("td")
      .style("padding", "0.55rem 1rem")
      .style("font-weight", "600")
      .style("color", "var(--text)")
      .text(d.location);

    row.append("td")
      .style("padding", "0.55rem 1rem")
      .style("color", "var(--text)")
      .text(d.area);

    const catCell = row.append("td").style("padding", "0.55rem 1rem");
    catCell.append("span")
      .style("background", "rgba(56, 189, 248, 0.12)")
      .style("color", "var(--accent, #38bdf8)")
      .style("border", "1px solid rgba(56, 189, 248, 0.3)")
      .style("padding", "0.2rem 0.5rem")
      .style("border-radius", "4px")
      .style("font-size", "0.75rem")
      .text(d.top_category);

    row.append("td")
      .style("padding", "0.55rem 1rem")
      .style("font-weight", "700")
      .style("color", "var(--accent-amber, #fbbf24)")
      .text(d3.format(",")(d.count));
  });
}