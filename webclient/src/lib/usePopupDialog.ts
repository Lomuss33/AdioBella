import { useEffect, useRef } from "react";

/** Shared dialog behavior; inline table controls keep the page and viewport intact. */
export function usePopupDialog(visible: boolean, {
  modal = false, fitToViewport = true, lockPageScroll = true
}: { modal?: boolean; fitToViewport?: boolean; lockPageScroll?: boolean } = {}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!visible || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingInlineEnd;
    const previousGutter = document.documentElement.style.scrollbarGutter;
    const viewport = window.visualViewport;
    const containTab = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !modal) {
        event.preventDefault();
        const cancelEvent = new Event("cancel", { cancelable: true });
        if (dialog.dispatchEvent(cancelEvent)) dialog.close();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
        .filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !controls.includes(current as HTMLElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault(); first.focus();
      }
    };
    const fitViewport = () => {
      // Preserve native pinch zoom; only follow keyboard/browser chrome resizing.
      if (fitToViewport && viewport && viewport.scale === 1) {
        dialog.style.height = `${viewport.height}px`;
        dialog.style.top = `${viewport.offsetTop}px`;
      }
    };
    if (lockPageScroll) {
      // A reserved root gutter also clips fixed overlays. Release it while
      // locked, retaining that space in the page so the table cannot jump.
      const gutter = Math.max(0, window.innerWidth - document.documentElement.getBoundingClientRect().width);
      const padding = parseFloat(getComputedStyle(document.body).paddingInlineEnd) || 0;
      document.body.style.paddingInlineEnd = `${padding + gutter}px`;
      document.body.style.overflow = "hidden";
      document.documentElement.style.scrollbarGutter = "auto";
    }
    // Native modal dialogs enter the browser's top layer and make the rest of
    // the document inert, which prevents preview annotation overlays from
    // selecting popup controls. Keep popups in the document layer instead.
    if (modal) dialog.showModal();
    else dialog.setAttribute("open", "");
    dialog.addEventListener("keydown", containTab);
    fitViewport();
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport);
    return () => {
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
      dialog.removeEventListener("keydown", containTab);
      dialog.close();
      dialog.style.removeProperty("height");
      dialog.style.removeProperty("top");
      if (lockPageScroll) {
        document.body.style.overflow = previousOverflow;
        document.body.style.paddingInlineEnd = previousPadding;
        document.documentElement.style.scrollbarGutter = previousGutter;
      }
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [visible, modal, fitToViewport, lockPageScroll]);
  return dialogRef;
}
