export function configureLearningShell({ collapseSelector = "#mainContent details[open]" } = {}) {
  const shell = document.querySelector("#vocabShell");
  const shade = document.querySelector("#drawerShade");
  const sidebar = document.querySelector("#vocabSidebar");
  const workspace = document.querySelector("#mainContent");
  const openButton = document.querySelector("#openVocabDrawer");
  const closeButton = document.querySelector("#closeVocabDrawer");
  const collapseButton = document.querySelector("#collapseAllStudy");
  const sidebarButton = document.querySelector("#vocabSidebarCollapse");
  const sidebarLabel = document.querySelector("#vocabSidebarCollapseLabel");

  const isNarrow = () => matchMedia("(max-width: 900px)").matches;
  let returnFocus = null;
  const focusable = () => [...(sidebar?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])]
    .filter((element) => !element.hidden && element.getClientRects().length > 0);
  const setDrawer = (open, { restoreFocus = true } = {}) => {
    const shouldOpen = Boolean(open && isNarrow());
    if (shouldOpen) returnFocus = document.activeElement;
    shell?.classList.toggle("drawer-open", shouldOpen);
    if (shade) shade.hidden = !shouldOpen;
    document.body.style.overflow = shouldOpen ? "hidden" : "";
    openButton?.setAttribute("aria-expanded", String(shouldOpen));
    if (sidebar) {
      sidebar.inert = isNarrow() && !shouldOpen;
      if (sidebar.inert) sidebar.setAttribute("aria-hidden", "true");
      else sidebar.removeAttribute("aria-hidden");
    }
    if (workspace) workspace.inert = shouldOpen;
    if (shouldOpen) requestAnimationFrame(() => (closeButton ?? focusable()[0])?.focus());
    else if (restoreFocus && returnFocus instanceof HTMLElement && returnFocus.isConnected) requestAnimationFrame(() => returnFocus.focus());
  };
  setDrawer(false, { restoreFocus: false });
  openButton?.addEventListener("click", () => setDrawer(true));
  closeButton?.addEventListener("click", () => setDrawer(false));
  shade?.addEventListener("click", () => setDrawer(false));
  collapseButton?.addEventListener("click", () => {
    for (const details of document.querySelectorAll(collapseSelector)) details.open = false;
    setDrawer(false);
  });
  sidebarButton?.addEventListener("click", () => {
    const collapsed = !shell.classList.contains("sidebar-collapsed");
    shell.classList.toggle("sidebar-collapsed", collapsed);
    sidebarButton.setAttribute("aria-expanded", String(!collapsed));
    if (sidebarLabel) sidebarLabel.textContent = collapsed ? "展开功能栏" : "收起功能栏";
    try { localStorage.setItem("kaoyan.vocabulary.sidebarCollapsed", String(collapsed)); } catch {}
  });
  let collapsed = false;
  try { collapsed = localStorage.getItem("kaoyan.vocabulary.sidebarCollapsed") === "true"; } catch {}
  shell?.classList.toggle("sidebar-collapsed", collapsed);
  sidebarButton?.setAttribute("aria-expanded", String(!collapsed));
  if (sidebarLabel) sidebarLabel.textContent = collapsed ? "展开功能栏" : "收起功能栏";
  for (const control of document.querySelectorAll("[data-scroll-top]")) {
    control.addEventListener("dblclick", (event) => {
      event.preventDefault();
      scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  addEventListener("resize", () => {
    if (!isNarrow()) setDrawer(false, { restoreFocus: false });
  }, { passive: true });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape") setDrawer(false);
    if (event.key !== "Tab" || !shell?.classList.contains("drawer-open")) return;
    const controls = focusable();
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

export async function configureLearningServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  try {
    const registration = await navigator.serviceWorker.register(new URL("../../sw.js", import.meta.url), { scope: new URL("../../", import.meta.url).pathname });
    const banner = document.querySelector("#updateBanner");
    const showUpdate = () => { if (banner) banner.hidden = false; };
    if (registration.waiting) showUpdate();
    registration.addEventListener("updatefound", () => registration.installing?.addEventListener("statechange", () => {
      if (registration.installing?.state === "installed" && navigator.serviceWorker.controller) showUpdate();
    }));
    document.querySelector("#applyUpdate")?.addEventListener("click", () => registration.waiting?.postMessage({ type: "SKIP_WAITING" }));
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloading) { reloading = true; location.reload(); }
    });
  } catch {
    // 本地预览或不支持 Service Worker 时不阻塞学习。
  }
}
