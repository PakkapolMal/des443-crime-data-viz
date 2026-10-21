// #home - see TASK.md. One export per screen: (el, { data, lazy }) => void.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { fmtInt, fmtPct, tooltip } from "../util.js";

export function title() {}  // static markup in index.html

const fmtMonth = d3.utcFormat("%b %Y");
const parseMonth = d3.utcParse("%Y-%m");

export function kpi(el, { data }) {
  const k = data.kpi;
  // Red budget on this screen: 1 (the incidents count). Everything else is bone.
  const cards = [
    ["Incidents", fmtInt(k.incidents), `${fmtMonth(parseMonth(k.window_start))} – ${fmtMonth(parseMonth(k.window_end))}`, true],
    ["Violent share (FBI)", fmtPct(k.violent_share_fbi), "most serious offense is homicide, rape, robbery or aggravated assault"],
    ["Cleared by arrest", fmtPct(k.clearance_arrest_rate), "cases ≥ 180 days old"],
    ["Firearm involved", fmtPct(k.firearm_share), "a firearm is the most dangerous weapon recorded"],
    ["Domestic violence", fmtPct(k.dv_share), "incidents flagged as domestic violence"],
  ];

  el.innerHTML = `
    <header><p class="label">01 · Overview</p><h3>How much crime, and how bad?</h3></header>
    <div class="kpi-row">${cards.map(([label, value, def, red]) => `
      <div class="kpi">
        <p class="label">${label}</p>
        <p class="kpi-value num${red ? " signal" : ""}">${value}</p>
        <p class="caption">${def}</p>
      </div>`).join("")}
    </div>
    <p class="caveat">Shares include Apr–Dec 2024, when many property reports are missing. <a href="#about">About →</a></p>
    <div class="trend">
      <p class="label">Incidents per month</p>
      <div class="trend-plot"></div>
    </div>
    <p class="footer caption"><span>Snapshot ${k.snapshot_date}</span><span>Source: LAPD NIBRS offense and victim tables</span></p>`;

  // Monthly total = sum over categories (monthly_by_cat sums to kpi.incidents; validate_nibrs.py checks it).
  const months = d3.rollups(data.monthly_by_cat, (v) => d3.sum(v, (d) => d.count), (d) => d.month)
    .map(([m, count]) => ({ date: parseMonth(m), count }))
    .sort((a, b) => a.date - b.date);
  lineChart(el.querySelector(".trend-plot"), months);
}

function lineChart(box, rows) {
  // Draw at the box's size; the viewBox keeps the drawing scaled if the window changes later.
  const { width, height } = box.getBoundingClientRect();
  const fs = parseFloat(getComputedStyle(box).fontSize);  // follows --fs-body, so margins scale too
  const m = { top: fs, right: fs * 6, bottom: fs * 2, left: fs * 4 };

  const x = d3.scaleUtc(d3.extent(rows, (d) => d.date), [m.left, width - m.right]);
  const y = d3.scaleLinear([0, d3.max(rows, (d) => d.count)], [height - m.bottom, m.top]).nice();

  const svg = d3.select(box).append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", "100%").attr("height", "100%")
    .attr("role", "img")
    .attr("aria-label", `Incidents per month, ${fmtMonth(rows[0].date)} to ${fmtMonth(rows.at(-1).date)}`);

  svg.append("g").attr("class", "grid")
    .selectAll("line").data(y.ticks(4)).join("line")
    .attr("x1", m.left).attr("x2", width - m.right).attr("y1", y).attr("y2", y);

  svg.append("g").attr("class", "axis")
    .attr("transform", `translate(${m.left},0)`)
    .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("~s")).tickSize(0).tickPadding(fs * 0.75))
    .call((g) => g.select(".domain").remove());

  svg.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${height - m.bottom})`)
    .call(d3.axisBottom(x).ticks(d3.utcMonth.every(3)).tickFormat(d3.utcFormat("%b %Y")).tickSizeOuter(0).tickPadding(fs * 0.5));

  svg.append("path")
    .datum(rows)
    .attr("class", "draw-in")
    .attr("pathLength", 1)
    .attr("fill", "none")
    .attr("stroke", "var(--bone)")
    .attr("stroke-width", 1.5)
    .attr("d", d3.line((d) => x(d.date), (d) => y(d.count)));

  // Direct label at the line end, instead of a legend.
  const last = rows.at(-1);
  svg.append("text")
    .attr("x", x(last.date) + fs * 0.5).attr("y", y(last.count)).attr("dy", "0.35em")
    .text(fmtInt(last.count));

  // Hover: nearest month.
  const dot = svg.append("circle").attr("r", 3).attr("fill", "var(--bone)").attr("visibility", "hidden");
  svg.append("rect")
    .attr("x", m.left).attr("y", m.top).attr("width", width - m.left - m.right).attr("height", height - m.top - m.bottom)
    .attr("fill", "transparent")
    .on("pointermove", (event) => {
      const i = d3.bisectCenter(rows.map((d) => d.date), x.invert(d3.pointer(event)[0]));
      const d = rows[i];
      dot.attr("cx", x(d.date)).attr("cy", y(d.count)).attr("visibility", "visible");
      tooltip.show(`${fmtMonth(d.date)}<br><span class="num">${fmtInt(d.count)}</span> incidents`, event);
    })
    .on("pointerleave", () => { dot.attr("visibility", "hidden"); tooltip.hide(); });
}
