import { useEffect, type RefObject } from "react";
import { fitMeldReview } from "./meldReviewLayout";

/** Fit actual declarations, including translated names and the selected deck. */
export function useMeldReviewLayout(dialogRef: RefObject<HTMLDialogElement>, enabled: boolean, contentKey: unknown) {
  useEffect(() => {
    const dialog = dialogRef.current;
    const card = dialog?.querySelector<HTMLElement>(".popup-card");
    const content = dialog?.querySelector<HTMLElement>(".popup-content");
    const header = dialog?.querySelector<HTMLElement>(".action-popup-header");
    const footer = dialog?.querySelector<HTMLElement>(".popup-footer");
    const body = dialog?.querySelector<HTMLElement>(".meld-popup-body");
    if (!enabled || !dialog || !card || !content || !header || !footer) return;
    let lastSize = "";
    const fit = () => {
      if (!dialog.open || !content.clientWidth || !dialog.clientHeight) return;
      const size = [dialog.clientWidth, dialog.clientHeight, content.clientWidth, header.offsetHeight, footer.offsetHeight,
        getComputedStyle(card).getPropertyValue("--meld-card-ratio"), body?.textContent].join(":");
      if (size === lastSize) return;
      lastSize = size;
      // Keep one content column: the longest card row owns the popup width.
      const best = fitMeldReview(["stacked"], (layout, density, width) => {
        dialog.dataset.meldLayout = layout;
        dialog.dataset.meldDensity = density;
        card.style.setProperty("--meld-card-width", `${width}px`);
        const faces = [...content.querySelectorAll<HTMLElement>(".meld-card-row .playing-card-shell")];
        // A long sequence can be width-limited; score its real size, not the requested cap.
        return {
          cardWidth: faces.length ? Math.min(...faces.map(face => face.getBoundingClientRect().width)) : width,
          overflow: Math.max(0, content.scrollHeight - content.clientHeight, content.scrollWidth - content.clientWidth)
        };
      });
      if (best) {
        dialog.dataset.meldLayout = best.layout;
        dialog.dataset.meldDensity = best.density;
        card.style.setProperty("--meld-card-width", `${best.width}px`);
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    [dialog, content, header, footer].forEach(element => observer.observe(element));
    if (body) observer.observe(body);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
      delete dialog.dataset.meldLayout;
      delete dialog.dataset.meldDensity;
      card.style.removeProperty("--meld-card-width");
    };
  }, [dialogRef, enabled, contentKey]);
}
