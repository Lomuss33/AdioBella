import { forwardRef, type ComponentPropsWithoutRef, type HTMLAttributes } from "react";
import type { TeamSide } from "../lib/teamSide";

type PopupLayout = "panel" | "table" | "page";

/** Shared markup contract for viewport panels, inline table choices and pages.
 * Lifecycle/focus remain in usePopupDialog; content-specific fitting stays local.
 */
export const PopupDialog = forwardRef<HTMLDialogElement, ComponentPropsWithoutRef<"dialog"> & {
  layout: PopupLayout;
}>(function PopupDialog({ layout, className = "", ...props }, ref) {
  return (
    <dialog {...props} ref={ref} className={`belot-dialog game-popup ${className}`.trim()}
      data-popup-layout={layout} aria-modal={props["aria-modal"] ?? layout !== "table"} />
  );
});

export function PopupCard({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`popup-card ${className}`.trim()} />;
}

export const PopupContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function PopupContent({ className = "", ...props }, ref) {
    return <div {...props} ref={ref} className={`popup-content ${className}`.trim()} />;
  }
);

export function PopupActions({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <footer {...props} className={`popup-footer action-controls ${className}`.trim()} />;
}

/** One restrained surface for team evidence and result sections. */
export function PopupSection({ as: Element = "section", team, className = "", ...props }: HTMLAttributes<HTMLElement> & {
  as?: "section" | "div";
  team?: TeamSide;
}) {
  return <Element {...props} data-team={team} className={`popup-section ${className}`.trim()} />;
}
