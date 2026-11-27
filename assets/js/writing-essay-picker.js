let pickerCount = 0;

export function createEssayPicker(select, label) {
  const root = document.createElement("div");
  root.className = "essay-picker";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = select.className;
  trigger.dataset.essayPickerTrigger = "";
  const menu = document.createElement("div");
  menu.id = `essay-picker-${++pickerCount}`;
  menu.className = "essay-picker-options";
  trigger.setAttribute("aria-controls", menu.id);
  select.hidden = true;
  root.append(select, trigger, menu);
  let openEvents;

  function close() {
    openEvents?.abort();
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function sync() {
    close();
    const title = select.selectedOptions[0]?.textContent;
    trigger.textContent = title || label;
    trigger.setAttribute("aria-label", title ? `${label}：${title}` : label);
    trigger.disabled = select.disabled || !select.options.length;
  }

  function open() {
    menu.replaceChildren();
    for (const option of select.options) {
      if (option.disabled || option.parentElement.disabled) continue;
      const group = option.closest("optgroup");
      if (group && option === group.firstElementChild) {
        const heading = document.createElement("p");
        heading.className = "essay-picker-group";
        heading.textContent = group.label;
        menu.append(heading);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "essay-picker-option";
      button.textContent = option.textContent;
      if (option.selected) button.setAttribute("aria-current", "true");
      button.addEventListener("click", () => {
        if (!option.selected) {
          select.selectedIndex = option.index;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        sync();
        trigger.focus({ preventScroll: true });
      });
      menu.append(button);
    }
    const bounds = trigger.getBoundingClientRect();
    const below = window.innerHeight - bounds.bottom;
    const above = bounds.top - (document.querySelector(".chapter-browser")?.getBoundingClientRect().bottom ?? 0);
    const openAbove = below < 220 && above > below;
    root.classList.toggle("essay-picker-up", openAbove);
    menu.style.setProperty("--picker-space", `${Math.max(88, (openAbove ? above : below) - 12)}px`);
    menu.hidden = false;
    menu.scrollTop = 0;
    const current = menu.querySelector('[aria-current="true"]');
    if (current && current.offsetTop + current.offsetHeight > menu.clientHeight) {
      menu.scrollTop = current.offsetTop;
    }
    trigger.setAttribute("aria-expanded", "true");
    openEvents = new AbortController();
    document.addEventListener("click", (event) => {
      if (!root.contains(event.target)) close();
    }, { signal: openEvents.signal });
  }

  trigger.addEventListener("click", () => {
    if (menu.hidden) open();
    else close();
  });
  root.addEventListener("focusout", (event) => {
    if (event.relatedTarget && !root.contains(event.relatedTarget)) close();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || menu.hidden) return;
    event.preventDefault();
    close();
    trigger.focus({ preventScroll: true });
  });
  sync();
  return { root, trigger, sync };
}
