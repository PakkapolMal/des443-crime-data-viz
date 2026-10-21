// Page foundation: data loading, hash sync, render-on-view.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const DATA_DIR = "data/processed/nibrs/";
const EAGER = [
  "kpi", "monthly_by_cat", "dow_by_cat", "area_summary", "area_by_cat",
  "offense_hierarchy", "offense_cooccurrence", "offense_count_dist", "top_offenses",
  "victim_type", "victim_age_sex", "victim_descent_by_cat", "weapon_class",
  "outcome_by_cat", "outcome_funnel", "flags_by_area", "flags_monthly",
  "report_lag_by_cat", "top_locations",
];
const LAZY = ["geo_grid", "geo_sample"];  // ~2.9 MB, fetched as #places approaches

// --- data ---
const dataReady = Promise.all(EAGER.map((f) => d3.json(`${DATA_DIR}${f}.json`)))
  .then((all) => Object.fromEntries(EAGER.map((f, i) => [f, all[i]])));

const lazyCache = new Map();
function lazy(name) {  // cached promise; screens call `await ctx.lazy("geo_grid")`
  if (!lazyCache.has(name)) lazyCache.set(name, d3.json(`${DATA_DIR}${name}.json`));
  return lazyCache.get(name);
}

// --- hash sync + chapter indicator ---
const indicator = document.getElementById("chapter-indicator");
const chapters = document.querySelectorAll("body > section[id]");
// A chapter is "current" when it crosses the middle line of the viewport.
const chapterObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const id = e.target.id;
    if (location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
    indicator.textContent = e.target.dataset.title;
  }
}, { rootMargin: "-50% 0px -50% 0px" });
chapters.forEach((c) => chapterObserver.observe(c));

// Prefetch the geo files one screen before #places.
new IntersectionObserver((entries, obs) => {
  if (entries.some((e) => e.isIntersecting)) {
    LAZY.forEach(lazy);
    obs.disconnect();
  }
}, { rootMargin: "100% 0px" }).observe(document.getElementById("places"));

// --- render on first view ---
// Screen <div data-screen="x"> in <section id="c"> -> export `x` of charts/c.js, called once.
const modules = new Map();
function chapterModule(id) {
  if (!modules.has(id)) modules.set(id, import(`./charts/${id}.js`));
  return modules.get(id);
}

async function render(screen) {
  const chapter = screen.closest("section").id;
  const name = screen.dataset.screen;
  try {
    const [mod, data] = await Promise.all([chapterModule(chapter), dataReady]);
    if (typeof mod[name] !== "function") throw new Error(`charts/${chapter}.js has no export "${name}"`);
    await mod[name](screen, { data, lazy });
  } catch (err) {
    console.error(`render ${chapter}/${name}:`, err);
    screen.textContent = `Failed to render ${chapter}/${name}: ${err.message}`;
  }
}

const screenObserver = new IntersectionObserver((entries, obs) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    obs.unobserve(e.target);
    render(e.target);
  }
}, { threshold: 0.25 });
document.querySelectorAll(".screen").forEach((s) => screenObserver.observe(s));

dataReady.catch((err) => console.error("data load failed:", err));
