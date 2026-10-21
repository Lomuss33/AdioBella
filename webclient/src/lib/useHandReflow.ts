import { useLayoutEffect, useRef } from "react";
import { getCenteredHandPositions, getHandColumns, getHandRemoval, HAND_CAPACITY, HAND_LAYOUT_APPLIED, HAND_LAYOUT_REQUEST } from "./handLayout";

const REFLOW_DURATION_MS = 260;
const CENTERING_DELAY_MS = 55;

interface PreviousHand {
  keys: string[];
  columns: number;
  width: number;
  height: number;
  rowSizes: number[];
}

export function useHandReflow(playerId: string | undefined, cardKeys: readonly string[]) {
  const rowRef = useRef<HTMLDivElement>(null);
  const previousRef = useRef<PreviousHand | null>(null);
  const animationsRef = useRef(new Map<string, Animation>());
  const synchronizeRef = useRef<(animate: boolean) => void>(() => {});
  const cardOrder = cardKeys.join("\0");

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) {
      previousRef.current = null;
      synchronizeRef.current = () => {};
      return;
    }

    const synchronize = (animate: boolean) => {
      const spaces = [...row.querySelectorAll<HTMLElement>(".hand-slot-empty")];
      const nodes = [...row.querySelectorAll<HTMLElement>(".hand-card-slot")];
      const keys = nodes.map(node => node.dataset.cardKey!);
      const previous = previousRef.current;
      // Capture before collapsing a row, including any interrupted movement.
      const before = animate ? new Map(nodes.filter(node => previous?.keys.includes(node.dataset.cardKey!))
        .map(node => [node.dataset.cardKey!, node.getBoundingClientRect()])) : new Map<string, DOMRect>();
      if (animate) row.dispatchEvent(new Event(HAND_LAYOUT_REQUEST));
      const style = getComputedStyle(row);
      const columns = getHandColumns(nodes.length, Number(style.getPropertyValue("--hand-columns")) || HAND_CAPACITY);
      row.style.setProperty("--hand-grid-columns", String(columns));
      const rows = Math.max(1, Math.ceil(nodes.length / columns));
      spaces.forEach((space, index) => {
        const display = index < rows * columns ? "" : "none";
        if (space.style.display !== display) space.style.display = display;
      });
      const first = spaces[0]?.getBoundingClientRect();
      if (!first?.width || !first.height) return;

      const bounds = row.getBoundingClientRect();
      const columnPitch = columns > 1
        ? spaces[1].getBoundingClientRect().left - first.left
        : first.width + (parseFloat(style.columnGap) || 0);
      const rowPitch = rows > 1 && spaces[columns]
        ? spaces[columns].getBoundingClientRect().top - first.top
        : first.height + (parseFloat(style.rowGap) || 0);
      const removal = previous ? getHandRemoval(previous.keys, keys, previous.rowSizes) : null;
      const restoringCard = previous && getHandRemoval(keys, previous.keys) !== null;
      const sameSize = previous?.columns === columns
        && Math.abs(previous.width - first.width) < .5 && Math.abs(previous.height - first.height) < .5;
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const shouldAnimate = animate && (removal !== null || restoringCard) && !reducedMotion;

      let rowStart = 0;
      const preferredRows = previous?.columns === columns ? previous.rowSizes.map(size => {
        const remaining = size - (removal && removal.index >= rowStart && removal.index < rowStart + size ? 1 : 0);
        rowStart += size;
        return remaining;
      }) : [];
      const positions = getCenteredHandPositions(nodes.length, columns, preferredRows);
      const targets = positions.map(position => ({
        left: first.left - bounds.left - row.clientLeft + position.column * columnPitch,
        top: first.top - bounds.top - row.clientTop + position.row * rowPitch
      }));
      // The grid's height change triggers ResizeObserver; preserve an active reflow
      // when its card sizes and local destinations have already been synchronized.
      if (!animate && sameSize && previous.keys.join("\0") === keys.join("\0") && nodes.every((node, index) =>
        Math.abs(parseFloat(node.style.left) - targets[index].left) < .5
        && Math.abs(parseFloat(node.style.top) - targets[index].top) < .5)) {
        if (reducedMotion) {
          animationsRef.current.forEach(animation => animation.cancel());
          animationsRef.current.clear();
        }
        return;
      }
      animationsRef.current.forEach(animation => animation.cancel());
      animationsRef.current.clear();
      nodes.forEach((node, index) => {
        node.style.width = `${first.width}px`;
        node.style.left = `${targets[index].left}px`;
        node.style.top = `${targets[index].top}px`;
        node.style.visibility = "visible";
      });

      if (shouldAnimate && previous) {
        // Measure after the batch of position writes, avoiding a layout per card.
        const after = nodes.map(node => node.getBoundingClientRect());
        nodes.forEach((node, index) => {
          const key = keys[index];
          const old = before.get(key);
          if (!old || typeof node.animate !== "function") return;
          const dx = old.left - after[index].left;
          const dy = old.top - after[index].top;
          const scaleX = old.width / after[index].width;
          const scaleY = old.height / after[index].height;
          if (Math.abs(dx) < .5 && Math.abs(dy) < .5 && Math.abs(scaleX - 1) < .005 && Math.abs(scaleY - 1) < .005) return;

          const oldIndex = previous.keys.indexOf(key);
          const followsCentering = removal && (
            (removal.side === "left" && oldIndex > removal.index)
            || (removal.side === "right" && oldIndex < removal.index)
          );
          const delay = followsCentering ? CENTERING_DELAY_MS : 0;
          const animation = node.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`, transformOrigin: "top left" },
            { transform: "translate(0, 0) scale(1)", transformOrigin: "top left" }
          ], {
            duration: REFLOW_DURATION_MS - delay,
            delay,
            easing: "cubic-bezier(.22, .75, .25, 1)",
            fill: "backwards"
          });
          animationsRef.current.set(key, animation);
          animation.onfinish = () => {
            if (animationsRef.current.get(key) === animation) animationsRef.current.delete(key);
          };
        });
      }
      const rowSizes = [...new Set(positions.map(position => position.row))]
        .map(row => positions.filter(position => position.row === row).length);
      previousRef.current = { keys, columns, width: first.width, height: first.height, rowSizes };
    };

    synchronizeRef.current = synchronize;
    synchronize(true);
  }, [playerId, cardOrder]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => synchronizeRef.current(false));
    };
    const applyLayout = () => synchronizeRef.current(false);
    // The parent sizes the grid after this child's layout effect. Apply its final
    // geometry synchronously rather than showing cards at the fallback size.
    row.addEventListener(HAND_LAYOUT_APPLIED, applyLayout);
    // Absolute card positions cannot resize the grid, so sync before the next paint.
    const observer = new ResizeObserver(applyLayout);
    observer.observe(row);
    if (row.firstElementChild) observer.observe(row.firstElementChild);
    window.addEventListener("resize", resize);
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    motion?.addEventListener("change", resize);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      row.removeEventListener(HAND_LAYOUT_APPLIED, applyLayout);
      window.removeEventListener("resize", resize);
      motion?.removeEventListener("change", resize);
      animationsRef.current.forEach(animation => animation.cancel());
      animationsRef.current.clear();
      previousRef.current = null;
    };
  }, [playerId]);

  return rowRef;
}
