import { useEffect, useRef } from "react";
import { lockPageScroll as acquirePageScrollLock } from "./pageScrollLock";

interface PopupFocus { dialog: HTMLDialogElement; previous: HTMLElement | null; }
const overlays: PopupFocus[] = [];
let restoreBackground = () => {};

function isolateTopOverlay() {
  restoreBackground();
  const dialog = overlays.at(-1)?.dialog;
  const app = dialog?.closest(".app-shell") ?? document.querySelector(".app-shell");
  const saved: { element: HTMLElement; inert: boolean }[] = [];
  if (dialog && app) {
    if (!app.contains(dialog) && app instanceof HTMLElement) {
      // Declaration details are portaled beside the app under document.body.
      saved.push({ element: app, inert: Boolean(app.inert) });
      app.inert = true;
    }
    let branch: Element = dialog;
    while (app.contains(dialog) && branch !== app && branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          saved.push({ element: sibling, inert: Boolean(sibling.inert) });
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
  }
  // Only app content is inert. Preview annotation controls stay interactive.
  restoreBackground = () => saved.forEach(({ element, inert }) => { element.inert = inert; });
}

/** Shared dialog behavior; inline table controls keep the page and viewport intact. */
export function usePopupDialog(visible: boolean, {
  modal = false, fitToViewport = true, lockPageScroll = true
}: { modal?: boolean; fitToViewport?: boolean; lockPageScroll?: boolean } = {}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!visible || !dialog) return;
    const focus: PopupFocus = { dialog, previous: document.activeElement instanceof HTMLElement ? document.activeElement : null };
    const overlay = modal || lockPageScroll;
    if (overlay) overlays.push(focus);
    const viewport = window.visualViewport;
    const containTab = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !modal) {
        event.preventDefault();
        const cancelEvent = new Event("cancel", { cancelable: true });
        if (dialog.dispatchEvent(cancelEvent)) dialog.close();
        return;
      }
      // Inline table choices remain part of the page's normal tab sequence.
      if (event.key !== "Tab" || !overlay || overlays.at(-1) !== focus) return;
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
    const unlock = lockPageScroll ? acquirePageScrollLock() : undefined;
    // Native modal dialogs enter the browser's top layer and make the rest of
    // the document inert, which prevents preview annotation overlays from
    // selecting popup controls. Keep popups in the document layer instead.
    if (modal) dialog.showModal();
    else dialog.setAttribute("open", "");
    if (overlay) isolateTopOverlay();
    dialog.addEventListener("keydown", containTab);
    fitViewport();
    if (overlay && !dialog.contains(document.activeElement)) {
      const initial = dialog.querySelector<HTMLElement>("[data-popup-initial-focus]")
        ?? dialog.querySelector<HTMLElement>('.popup-content[tabindex]')
        ?? dialog.querySelector<HTMLElement>('button:not(:disabled), [tabindex="0"]');
      initial?.focus({ preventScroll: true });
    }
    if (fitToViewport) {
      viewport?.addEventListener("resize", fitViewport);
      viewport?.addEventListener("scroll", fitViewport);
    }
    return () => {
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
      dialog.removeEventListener("keydown", containTab);
      const ownedFocus = dialog.contains(document.activeElement) || document.activeElement === document.body;
      const wasTop = overlays.at(-1) === focus;
      // Keep a nested popup's return target valid if its parent closes first.
      for (const other of overlays) {
        if (other !== focus && other.previous && dialog.contains(other.previous)) other.previous = focus.previous;
      }
      const index = overlays.indexOf(focus);
      if (index >= 0) overlays.splice(index, 1);
      if (overlay) isolateTopOverlay();
      dialog.close();
      dialog.style.removeProperty("height");
      dialog.style.removeProperty("top");
      unlock?.();
      if (ownedFocus && (!overlay || wasTop) && focus.previous?.isConnected) focus.previous.focus({ preventScroll: true });
    };
  }, [visible, modal, fitToViewport, lockPageScroll]);
  return dialogRef;
}
