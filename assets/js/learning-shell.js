export function configureLearningShell({ collapseSelector = "#mainContent details[open]" } = {}) {
  const shell = document.querySelector("#vocabShell");
  const shade = document.querySelector("#drawerShade");
  const openButton = document.querySelector("#openVocabDrawer");
  const collapseButton = document.querySelector("#collapseAllStudy");
  const sidebarButton = document.querySelector("#vocabSidebarCollapse");
  const sidebarLabel = document.querySelector("#vocabSidebarCollapseLabel");

  const setDrawer = (open) => {
    shell?.classList.toggle("drawer-open", open);
    if (shade) shade.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
    openButton?.setAttribute("aria-expanded", String(open));
  };
  openButton?.addEventListener("click", () => setDrawer(true));
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
  addEventListener("keydown", (event) => { if (event.key === "Escape") setDrawer(false); });
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
