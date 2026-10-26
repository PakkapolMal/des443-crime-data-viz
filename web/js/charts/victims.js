/**
 * Chapter 7: #victims — Victim Demographics & Types
 * Exports: pyramid, type, descent (with router aliases)
 * Data sources: victim_age_sex.json, victim_type.json, victim_descent_by_cat.json
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/**
 * Screen 1: Back-to-Back Victim Population Pyramid (Age & Sex)
 */
export async function pyramid(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.victim_age_sex || (await lazy?.("victim_age_sex")) || [];

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
  header.append("h2").text("Victim Demographics Population Pyramid");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Back-to-back victim age group distribution for Male vs Female individual victims.");

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

  // Bins come from the data (pipeline AGE_LABELS); labels sort correctly by their leading number.
  const ageBins = [...new Set(rawData.map(d => String(d.age_group)))].sort((a, b) => parseInt(a) - parseInt(b));

  const maleData = new Map();
  const femaleData = new Map();

  rawData.forEach(d => {
    const age = String(d.age_group || d.age || "");
    const sex = String(d.vict_sex || d.sex || d.gender || "");
    const count = Number(d.count || 0);

    if (sex === "Male" || sex === "M") maleData.set(age, (maleData.get(age) || 0) + count);
    if (sex === "Female" || sex === "F") femaleData.set(age, (femaleData.get(age) || 0) + count);
  });

  const totalMale = d3.sum(Array.from(maleData.values())) || 1;
  const totalFemale = d3.sum(Array.from(femaleData.values())) || 1;

  function updateBanner(d, sex) {
    if (!d) {
      statsBanner.html(`
        <span class="label">DEMOGRAPHIC INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover over any age bracket to inspect gender-specific victim counts.</span>
      `);
    } else {
      const cnt = sex === "Male" ? (maleData.get(d) || 0) : (femaleData.get(d) || 0);
      const total = sex === "Male" ? totalMale : totalFemale;
      const share = ((cnt / total) * 100).toFixed(1);

      statsBanner.html(`
        <div>
          <span class="label">AGE GROUP:</span>
          <strong style="color:var(--bone); margin-left:4px;">${d} YEAR OLDS</strong>
          <span style="color:var(--bone-60); margin-left:12px;">Sex: ${sex.toUpperCase()}</span>
        </div>
        <div>
          <span class="label">VICTIM COUNT:</span>
          <strong class="num" style="margin-left:4px; color:var(--bone);">${d3.format(",")(cnt)}</strong>
          <span class="label" style="margin-left:12px;">SEX SHARE:</span>
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

  // Appended before measuring so chartBox's flex height already excludes it. Bold: --signal text needs it for contrast.
  wrapper.append("p")
    .attr("class", "caption")
    .style("color", "var(--signal)")
    .style("font-weight", "700")
    .text("Victims under 18 are not in the source data.");

  const bbox = chartBox.node()?.getBoundingClientRect() || {};
  const width = bbox.width || 800;
  const height = bbox.height || 360;
  const margin = { top: 45, right: 40, bottom: 35, left: 40 };

  const svg = chartBox.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

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

  // Direct side labels in the matching hue, with totals (DESIGN.md: hue always paired with a label).
  const sideLabel = (x, name, hue, total) => {
    const t = svg.append("text")
      .attr("x", x)
      .attr("y", margin.top - 12)
      .attr("text-anchor", "middle")
      .style("font-size", "var(--fs-body)")
      .style("font-weight", "700")
      .style("letter-spacing", "var(--tracking-label)");
    t.append("tspan").attr("fill", hue).text(name);
    t.append("tspan").attr("fill", "var(--bone)").attr("class", "num").style("font-weight", "400")
      .text(`  ${d3.format(",")(total)} victims`);
  };
  sideLabel(margin.left + halfWidth / 2, "MALE", "var(--sex-m)", d3.sum(maleData.values()));
  sideLabel(width - margin.right - halfWidth / 2, "FEMALE", "var(--sex-f)", d3.sum(femaleData.values()));

  // Center Age Group Labels
  svg.selectAll(".age-center-label")
    .data(ageBins)
    .enter()
    .append("text")
    .attr("x", width / 2)
    .attr("y", d => yScale(d) + yScale.bandwidth() / 2 + 4)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--bone)")
    .style("font-size", "var(--fs-small)")
    .style("font-family", "var(--font-mono)")
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
    .attr("fill", "var(--sex-m)")
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("stroke", "var(--bone)").attr("stroke-width", 2);
      updateBanner(d, "Male");

      const cnt = maleData.get(d) || 0;
      const share = ((cnt / totalMale) * 100).toFixed(1);

      tooltip.html(`
        <strong style="color:var(--bone);">Male Victims (${d} yrs)</strong><br/>
        Victim Count: <strong>${d3.format(",")(cnt)}</strong><br/>
        Share of Male Victims: <strong style="color:var(--signal);">${share}%</strong>
      `).style("opacity", 1);
    })
    .on("mousemove", event => {
      tooltip
        .style("left", (event.clientX + 14) + "px")
        .style("top", (event.clientY - 28) + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke", null);
      updateBanner(null);
      tooltip.style("opacity", 0);
    });

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
    .attr("fill", "var(--sex-f)")
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("stroke", "var(--bone)").attr("stroke-width", 2);
      updateBanner(d, "Female");

      const cnt = femaleData.get(d) || 0;
      const share = ((cnt / totalFemale) * 100).toFixed(1);

      tooltip.html(`
        <strong style="color:var(--bone);">Female Victims (${d} yrs)</strong><br/>
        Victim Count: <strong>${d3.format(",")(cnt)}</strong><br/>
        Share of Female Victims: <strong style="color:var(--signal);">${share}%</strong>
      `).style("opacity", 1);
    })
    .on("mousemove", event => {
      tooltip
        .style("left", (event.clientX + 14) + "px")
        .style("top", (event.clientY - 28) + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke", null);
      updateBanner(null);
      tooltip.style("opacity", 0);
    });
}

/**
 * Screen 2: Victim Entity Type Breakdown
 */
export async function type(el, { data, lazy }) {
  const container = d3.select(el);
  container.html("");

  const rawData = data?.victim_type || (await lazy?.("victim_type")) || [];

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
  header.append("h2").text("Victim Classification Mix");
  header.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("NIBRS victim entity types (Person vs Commercial Business vs Society/Public).");

  const totalVictims = d3.sum(rawData, d => Number(d.count || 0)) || 1;

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
        <span class="label">CLASSIFICATION INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover over any bar to inspect victim entity classifications.</span>
      `);
    } else {
      const typeName = d.victim_type || d.type || "Unknown";
      const cnt = Number(d.count || 0);
      const share = ((cnt / totalVictims) * 100).toFixed(1);

      statsBanner.html(`
        <div>
          <span class="label">ENTITY TYPE:</span>
          <strong style="color:var(--bone); margin-left:4px;">${typeName.toUpperCase()}</strong>
        </div>
        <div>
          <span class="label">VICTIM COUNT:</span>
          <strong class="num" style="margin-left:4px; color:var(--bone);">${d3.format(",")(cnt)}</strong>
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
  const margin = { top: 20, right: 100, bottom: 30, left: 180 };

  const svg = chartBox.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

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
    .attr("fill", "var(--bone)")
    .style("font-size", "var(--fs-small)")
    .style("font-family", "var(--font-mono)");

  // X Axis
  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("~s")));

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
    .attr("fill", (d, i) => i === 0 ? "var(--signal)" : "var(--bone)")
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "var(--signal)");
      updateBanner(d);

      const cnt = Number(d.count || 0);
      const share = ((cnt / totalVictims) * 100).toFixed(1);

      tooltip.html(`
        <strong style="color:var(--bone);">${d.victim_type || d.type}</strong><br/>
        Victim Count: <strong>${d3.format(",")(cnt)}</strong><br/>
        Share of Total: <strong style="color:var(--signal);">${share}%</strong>
      `).style("opacity", 1);
    })
    .on("mousemove", event => {
      tooltip
        .style("left", (event.clientX + 14) + "px")
        .style("top", (event.clientY - 28) + "px");
    })
    .on("mouseout", function (event, d) {
      const idx = sortedData.indexOf(d);
      d3.select(this).attr("fill", idx === 0 ? "var(--signal)" : "var(--bone)");
      updateBanner(null);
      tooltip.style("opacity", 0);
    });

  bars.append("text")
    .attr("y", d => yScale(String(d.victim_type || d.type || "Unknown")) + yScale.bandwidth() / 2 + 3)
    .attr("x", d => xScale(Number(d.count || 0)) + 8)
    .attr("fill", "var(--bone-60)")
    .style("font-size", "var(--fs-label)")
    .style("font-family", "var(--font-mono)")
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

  const rawData = data?.victim_descent_by_cat || (await lazy?.("victim_descent_by_cat")) || [];

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

  const categories = ["All Categories", ...Array.from(new Set(rawData.map(d => d.category))).filter(Boolean).sort()];
  let selectedCat = "All Categories";

  // Header Controls
  const header = wrapper.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "flex-end");

  const titleGroup = header.append("div");
  titleGroup.append("h2").text("Victim Descent / Ethnic Group Distribution");
  titleGroup.append("p")
    .attr("class", "caption")
    .style("margin-top", "var(--s-1)")
    .text("Descent breakdown across reported individual victims.");

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

  function updateBanner(d, totalCount) {
    if (!d) {
      statsBanner.html(`
        <span class="label">DESCENT INSPECTOR:</span>
        <span style="color:var(--bone-60);">Hover over any bar to inspect victim descent group shares for ${selectedCat}.</span>
      `);
    } else {
      const share = ((d.count / totalCount) * 100).toFixed(1);
      statsBanner.html(`
        <div>
          <span class="label">DESCENT GROUP:</span>
          <strong style="color:var(--bone); margin-left:4px;">${d.descent.toUpperCase()}</strong>
        </div>
        <div>
          <span class="label">VICTIM COUNT:</span>
          <strong class="num" style="margin-left:4px; color:var(--bone);">${d3.format(",")(d.count)}</strong>
          <span class="label" style="margin-left:12px;">DESCENT SHARE:</span>
          <strong class="num signal" style="margin-left:4px;">${share}%</strong>
        </div>
      `);
    }
  }

  const chartBox = wrapper.append("div")
    .style("flex", "1")
    .style("min-height", "0")
    .style("background", "var(--surface)")
    .style("border", "var(--rule)")
    .style("position", "relative")
    .style("overflow", "hidden");

  // Caveat Banner at bottom
  wrapper.append("p")
    .attr("class", "caption")
    .style("font-style", "italic")
    .text("Note: Victim descent counts represent reported crime victims; they are not population rates and say nothing about offender demographics.");

  function render() {
    chartBox.html("");
    updateBanner(null, 1);

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

    const bbox = chartBox.node()?.getBoundingClientRect() || {};
    const width = bbox.width || 800;
    const rowHeight = 24;
    // Left margin fits the longest group name ("American Indian/Alaskan Native") at --fs-small.
    const k = Math.max(1, window.innerWidth / 1280);
    const margin = { top: 15, right: 130 * k, bottom: 25, left: 230 * k };
    const height = Math.max(bbox.height || 300, chartData.length * rowHeight + margin.top + margin.bottom);

    const svg = chartBox.append("svg")
      .attr("width", "100%")
      .attr("height", height);

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
      .attr("fill", "var(--bone)")
      .style("font-size", "var(--fs-small)")
      .style("font-family", "var(--font-mono)");

    // X Axis
    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("~s")));

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
      .attr("fill", "var(--bone)")
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "var(--signal)");
        updateBanner(d, totalCount);

        const share = ((d.count / totalCount) * 100).toFixed(1);
        tooltip.html(`
          <strong style="color:var(--bone);">${d.descent}</strong><br/>
          Victim Count: <strong>${d3.format(",")(d.count)}</strong><br/>
          Descent Share: <strong style="color:var(--signal);">${share}%</strong>
        `).style("opacity", 1);
      })
      .on("mousemove", event => {
        tooltip
          .style("left", (event.clientX + 14) + "px")
          .style("top", (event.clientY - 28) + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill", "var(--bone)");
        updateBanner(null, totalCount);
        tooltip.style("opacity", 0);
      });

    // Labels
    bars.append("text")
      .attr("y", d => yScale(d.descent) + yScale.bandwidth() / 2 + 3)
      .attr("x", d => xScale(d.count) + 8)
      .attr("fill", "var(--bone-60)")
      .style("font-size", "var(--fs-label)")
      .style("font-family", "var(--font-mono)")
      .text(d => `${d3.format(",")(d.count)} (${((d.count / totalCount) * 100).toFixed(1)}%)`);
  }

  catSelect.on("change", function () {
    selectedCat = this.value;
    render();
  });

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