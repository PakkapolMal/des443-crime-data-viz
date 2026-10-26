/**
 * LA Crime under NIBRS — Router, Intersection Observer & Single-Screen Wheel Lock
 */

import { startRain } from "./rain.js";

const loadedModules = new Map();
const rawCache = new Map();

/**
 * Lazy data fetcher pointing to processed NIBRS JSON
 */
export async function lazy(key) {
  if (rawCache.has(key)) return rawCache.get(key);
  try {
    const res = await fetch(`data/processed/nibrs/${key}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    rawCache.set(key, json);
    return json;
  } catch (err) {
    console.warn(`Failed lazy fetch for '${key}':`, err);
    return [];
  }
}

async function loadScreen(chapterId, screenName, element) {
  if (screenName === "title") return startRain(element); // Text is static markup in index.html; rain is a canvas behind it

  try {
    if (!loadedModules.has(chapterId)) {
      const mod = await import(`./charts/${chapterId}.js`);
      loadedModules.set(chapterId, mod);
    }
    const module = loadedModules.get(chapterId);
    const renderFn = module[screenName] || module.default;

    if (typeof renderFn === "function") {
      await document.fonts.ready; // charts measure text (label fitting); fallback-font metrics are wrong
      await renderFn(element, { lazy });
    }
  } catch (err) {
    console.error(`Error loading screen ${chapterId}/${screenName}:`, err);
    element.innerHTML = `<p class="caption signal">Error loading visual: ${chapterId}/${screenName}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const screens = Array.from(document.querySelectorAll(".screen"));

  // 0. Chapter rail: one numbered link per section, so new chapters appear automatically.
  const rail = document.getElementById("rail");
  const sections = Array.from(document.querySelectorAll("section[id]"));
  rail.style.setProperty("--n", sections.length);
  rail.querySelector(".rail-list").innerHTML = sections.map((s, i) =>
    `<li><a href="#${s.id}" aria-label="Chapter ${i + 1}: ${s.dataset.title}" data-name="${s.dataset.title}">${i + 1}</a></li>`).join("");
  const railLinks = new Map(sections.map(s => [s.id, rail.querySelector(`a[href="#${s.id}"]`)]));

  // Hash targets: sections are display:contents (no box), so scroll to the screen instead.
  // "#chapter" -> its first screen; "#screen" -> a screen with that data-screen.
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  function goTo(hash, behavior = reduceMotion.matches ? "instant" : "smooth") {
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    const screen = el?.matches(".screen") ? el : el?.querySelector(".screen") ||
      document.querySelector(`.screen[data-screen="${CSS.escape(id)}"]`);
    screen?.scrollIntoView({ behavior });
  }
  window.addEventListener("hashchange", () => goTo(location.hash));
  // Same hash clicked again fires no hashchange (e.g. chapter 3 again after scrolling away).
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]');
    if (a && a.hash === location.hash) { e.preventDefault(); goTo(a.hash); }
  });
  if (location.hash) {
    history.scrollRestoration = "manual"; // otherwise a reload restores the old position after this jump
    goTo(location.hash, "instant");
  }

  // 1. Intersection Observer for Dynamic Rendering & Current Rail Chapter
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const section = entry.target.closest("section");
        const chapterId = section ? section.id : "home";
        const screenName = entry.target.dataset.screen || "kpi";

        railLinks.forEach((a, id) => id === chapterId ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"));

        if (!entry.target.dataset.rendered) {
          entry.target.dataset.rendered = "true";
          loadScreen(chapterId, screenName, entry.target);
        }
      }
    });
  }, { threshold: 0.3 });

  screens.forEach(s => observer.observe(s));

  // 2. Wheel Scroll Lock (Ensures 1 mouse wheel notch = exactly 1 page transition)
  let isThrottled = false;

  window.addEventListener("wheel", (e) => {
    // If scrolling inside an internal scroll box (e.g. data table or category grid), allow native internal scroll
    if (e.target.closest("table, .data-table, [style*='overflow-y: auto']")) {
      const scrollBox = e.target.closest("[style*='overflow-y: auto']");
      if (scrollBox) {
        const atTop = scrollBox.scrollTop === 0 && e.deltaY < 0;
        const atBottom = Math.abs(scrollBox.scrollHeight - scrollBox.scrollTop - scrollBox.clientHeight) < 2 && e.deltaY > 0;
        if (!atTop && !atBottom) return; // Keep wheel scroll native inside scrollable panel
      }
    }

    if (isThrottled) {
      e.preventDefault();
      return;
    }

    const direction = e.deltaY > 0 ? 1 : -1;
    if (Math.abs(e.deltaY) < 15) return; // Ignore slight trackpad jitter

    const currentScroll = window.scrollY || window.pageYOffset;
    const vh = window.innerHeight;
    const currentIndex = Math.round(currentScroll / vh);
    const targetIndex = currentIndex + direction;

    if (targetIndex >= 0 && targetIndex < screens.length) {
      e.preventDefault();
      isThrottled = true;

      screens[targetIndex].scrollIntoView({ behavior: "smooth" });

      setTimeout(() => {
        isThrottled = false;
      }, 650); // Throttle lock duration matching transition speed
    }
  }, { passive: false });
});