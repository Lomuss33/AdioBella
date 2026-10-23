import { useLayoutEffect, type RefObject } from "react";

/** Keep the anchored menu inside the visible viewport and flip when necessary. */
export function useMenuPosition(open: boolean, above: boolean, anchorRef: RefObject<HTMLElement>, menuRef: RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const anchor = anchorRef.current, menu = menuRef.current;
    if (!open || !anchor || !menu || !menu.offsetParent) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const fit = () => {
      // Let native pinch zoom enlarge and pan the interface without refitting it.
      if (viewport && viewport.scale !== 1) return;
      const edge = 8, gap = 6;
      const top = viewport?.offsetTop ?? 0, left = viewport?.offsetLeft ?? 0;
      const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
      const bounds = anchor.getBoundingClientRect();
      const parent = menu.offsetParent!.getBoundingClientRect();
      menu.style.maxWidth = `${Math.max(0, width - edge * 2)}px`;
      const naturalHeight = menu.scrollHeight + menu.offsetHeight - menu.clientHeight;
      const before = Math.max(0, bounds.top - top - edge - gap);
      const after = Math.max(0, top + height - bounds.bottom - edge - gap);
      const placeAbove = above ? before >= Math.min(naturalHeight, after) : after < Math.min(naturalHeight, before);
      const available = placeAbove ? before : after;
      const menuHeight = Math.min(naturalHeight, available);
      const preferredLeft = above ? bounds.right - menu.offsetWidth : bounds.left;
      const x = Math.max(left + edge, Math.min(preferredLeft, left + width - edge - menu.offsetWidth));
      const y = placeAbove ? bounds.top - gap - menuHeight : bounds.bottom + gap;
      menu.style.maxHeight = `${available}px`;
      menu.style.left = `${x - parent.left}px`;
      menu.style.top = `${y - parent.top}px`;
      menu.style.right = "auto";
      menu.style.bottom = "auto";
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; fit(); });
    };
    fit();
    const observer = new ResizeObserver(schedule);
    observer.observe(anchor);
    observer.observe(menu);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
    };
  }, [open, above, anchorRef, menuRef]);
}
