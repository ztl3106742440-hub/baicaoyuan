const levels = [75, 80, 85, 90, 100, 110, 120, 130, 140];
const storageKey = "baicaoyuan.pageZoom";
const root = document.documentElement;

export function isCompactPage() {
  return getComputedStyle(document.body).getPropertyValue("--compact-page").trim() === "1";
}

export function watchCompactPage(onChange) {
  let wasCompact = isCompactPage();
  function update() {
    const compact = isCompactPage();
    if (wasCompact === compact) return;
    wasCompact = compact;
    onChange();
  }
  addEventListener("resize", update, { passive: true });
  addEventListener("pagezoomchange", update);
}

function readingTop(header) {
  return Math.max(header.getBoundingClientRect().bottom,
    document.querySelector(".chapter-browser")?.getBoundingClientRect().bottom ?? 0);
}

function storedZoom() {
  try {
    const saved = Number(localStorage.getItem(storageKey));
    if (levels.includes(saved)) return saved;
    if (localStorage.getItem("kaoyan.writing.largeType") === "true") return 110;
  } catch {}
  return 100;
}

function readingAnchor(header) {
  if (scrollY <= 1) return null;
  const content = document.querySelector(".writing-reader, .app-view:not([hidden])");
  if (!content) return null;
  const area = content.getBoundingClientRect();
  const top = readingTop(header);
  const y = Math.min(innerHeight / 2, top + 24);
  const x = area.left + Math.min(60, area.width / 2);
  const element = document.elementsFromPoint(x, y)
    .map((node) => node.closest("p, h2, h3, h4, li, summary, article"))
    .find((node) => content.contains(node));
  return element ? {
    element,
    gap: element.getBoundingClientRect().top - top,
  } : null;
}

export function configurePageZoom(closeDrawer) {
  const select = document.querySelector("[data-page-zoom]");
  if (!select || !CSS.supports("zoom", "1.1")) return;
  const header = document.querySelector(".app-bar, .vocab-topbar");
  const sidebar = select.closest("aside");
  let preferred = storedZoom();
  let applied = 100;
  select.replaceChildren(...levels.map((level) => new Option(`${level}%`, String(level))));

  function apply({ preservePosition = false } = {}) {
    // Keep at least 320 CSS pixels for the compact layout when the viewport is narrow.
    const availableWidth = root.clientWidth;
    const allowed = levels.filter((level) => availableWidth >= 320 * level / 100);
    const maximum = allowed.at(-1) ?? levels[0];
    const next = Math.min(preferred, maximum);
    for (const option of select.options) option.disabled = Number(option.value) > maximum;
    select.value = String(next);
    select.title = `整页缩放：${next}%`;
    if (next === applied) return;

    const previous = applied;
    const y = scrollY;
    const anchor = preservePosition ? readingAnchor(header) : null;
    applied = next;
    root.style.setProperty("--page-zoom", String(next / 100));
    root.toggleAttribute("data-zoom-out", next < 100);
    dispatchEvent(new Event("pagezoomchange"));
    if (preservePosition) {
      const top = anchor
        ? anchor.element.getBoundingClientRect().top + scrollY - readingTop(header) - anchor.gap
        : y * next / previous;
      scrollTo({ top: Math.max(0, top), behavior: "instant" });
    }
  }

  apply();
  select.closest(".page-zoom-setting").hidden = false;
  select.addEventListener("change", () => {
    preferred = Number(select.value);
    try { localStorage.setItem(storageKey, String(preferred)); } catch {}
    if (sidebar.closest(".drawer-open")) closeDrawer();
    apply({ preservePosition: true });
    const focusTarget = isCompactPage() ? document.querySelector("#openDrawer, #openVocabDrawer") : select;
    focusTarget?.focus({ preventScroll: true });
  });
  addEventListener("resize", () => apply({ preservePosition: true }), { passive: true });
  addEventListener("storage", (event) => {
    if (event.key !== storageKey) return;
    preferred = storedZoom();
    apply({ preservePosition: true });
  });
}
