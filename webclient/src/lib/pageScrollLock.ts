let locks = 0;
let restore: (() => void) | undefined;

/** Overlapping overlays share one lock, even when they close out of order. */
export function lockPageScroll() {
  if (locks === 0) {
    const root = document.documentElement, body = document.body;
    const properties = [[root, "overflow"], [root, "scrollbar-gutter"], [body, "overflow"]] as const;
    const saved = properties.map(([element, property]) => ({ element, property,
      value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }));
    // Keep the original viewport gutter when hiding a classic scrollbar.
    // Body padding would change the available width of the table and dialogs.
    if (root.clientWidth > 0 && root.clientWidth < window.innerWidth &&
        !getComputedStyle(root).scrollbarGutter.includes("stable")) {
      root.style.scrollbarGutter = "stable";
    }
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    restore = () => saved.forEach(({ element, property, value, priority }) => {
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    });
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) { restore?.(); restore = undefined; }
  };
}
