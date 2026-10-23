let locks = 0;
let restore: (() => void) | undefined;

/** Overlapping overlays share one lock, even when they close out of order. */
export function lockPageScroll() {
  if (locks === 0) {
    const root = document.documentElement, body = document.body;
    const properties = [[root, "overflow"], [root, "scrollbar-gutter"],
      [body, "overflow"], [body, "padding-inline-end"]] as const;
    const saved = properties.map(([element, property]) => ({ element, property,
      value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }));
    const gutter = Math.max(0, window.innerWidth - root.getBoundingClientRect().width);
    const padding = parseFloat(getComputedStyle(body).paddingInlineEnd) || 0;
    body.style.paddingInlineEnd = `${padding + gutter}px`;
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    // Fixed overlays use the full viewport; reserve the page's original width.
    root.style.scrollbarGutter = "auto";
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
