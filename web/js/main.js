/**
 * LA Crime under NIBRS — Router, Intersection Observer & Single-Screen Wheel Lock
 */

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
  if (screenName === "title") return; // Rendered directly via index.html static markup

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
  const indicator = document.getElementById("chapter-indicator");
  const screens = Array.from(document.querySelectorAll(".screen"));

  // 1. Intersection Observer for Dynamic Rendering & Navigation Indicator
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const section = entry.target.closest("section");
        const chapterId = section ? section.id : "home";
        const chapterTitle = section ? (section.dataset.title || chapterId) : "Overview";
        const screenName = entry.target.dataset.screen || "kpi";

        if (indicator) {
          indicator.textContent = `${chapterTitle.toUpperCase()} • ${screenName.toUpperCase()}`;
        }

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