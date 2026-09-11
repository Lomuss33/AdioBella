import { useEffect, useRef } from "react";

/** Native top-layer modal, with its height following the mobile keyboard viewport. */
export function usePopupDialog(visible: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!visible || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const viewport = window.visualViewport;
    const containTab = (event: KeyboardEvent) => {
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
      if (viewport && viewport.scale === 1) {
        dialog.style.height = `${viewport.height}px`;
        dialog.style.top = `${viewport.offsetTop}px`;
      }
    };
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.addEventListener("keydown", containTab);
    fitViewport();
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport);
    return () => {
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
      dialog.removeEventListener("keydown", containTab);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [visible]);
  return dialogRef;
}
