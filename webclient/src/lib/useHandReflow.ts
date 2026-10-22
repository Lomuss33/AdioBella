import { useLayoutEffect, useRef } from "react";
import { getCenteredHandPositions, getHandColumns, getRemovedHandIndices, getHandRowOffsets, HAND_CAPACITY, HAND_LAYOUT_APPLIED, HAND_LAYOUT_REQUEST, type HandLayoutChange } from "./handLayout";
import { getHandReflowDelays, getHandReflowDuration } from "./handMotion";

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
  const rollbackRef = useRef<PreviousHand | null>(null);
  const animationsRef = useRef(new Map<string, Animation>());
  const synchronizeRef = useRef<(animate: boolean) => void>(() => {});
  const cardOrder = cardKeys.join("\0");

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) {
      previousRef.current = null;
      rollbackRef.current = null;
      synchronizeRef.current = () => {};
      return;
    }

    const synchronize = (animate: boolean) => {
      const spaces = [...row.querySelectorAll<HTMLElement>(".hand-slot-empty")];
      const nodes = [...row.querySelectorAll<HTMLElement>(".hand-card-slot")];
      const keys = nodes.map(node => node.dataset.cardKey!);
      const previous = previousRef.current;
      const keyOrder = keys.join("\0");
      const removed = previous ? getRemovedHandIndices(previous.keys, keys) : null;
      const restored = previous ? getRemovedHandIndices(keys, previous.keys) : null;
      const rollback = rollbackRef.current;
      const matchesRollback = rollback?.keys.join("\0") === keyOrder;
      // A larger addition is a new deal unless it restores the saved hand.
      const restoringCards = restored && (restored.length === 1 || matchesRollback);
      const activeAnimations = [...animationsRef.current.values()]
        .filter(animation => animation.playState === "running" || animation.playState === "paused");
      const continuing = !animate && activeAnimations.length > 0;
      const remainingTime = Math.max(0, ...activeAnimations.map(animation =>
        Number(animation.effect?.getComputedTiming().endTime ?? 0) - Number(animation.currentTime ?? 0)));
      // Capture before collapsing a row, including any interrupted movement.
      const before = animate || continuing ? new Map(nodes.filter(node => previous?.keys.includes(node.dataset.cardKey!))
        .map(node => [node.dataset.cardKey!, node.getBoundingClientRect()])) : new Map<string, DOMRect>();
      if (animate) row.dispatchEvent(new CustomEvent<HandLayoutChange>(HAND_LAYOUT_REQUEST, {
        detail: removed ? "remove" : restoringCards && matchesRollback ? "restore" : "reset"
      }));
      const style = getComputedStyle(row);
      const columns = getHandColumns(nodes.length, Number(style.getPropertyValue("--hand-columns")) || HAND_CAPACITY);
      row.style.setProperty("--hand-grid-columns", String(columns));
      const rows = Math.max(1, Math.ceil(nodes.length / columns));
      row.dataset.handRows = String(rows);
      spaces.forEach((space, index) => {
        const display = index < Math.max(1, nodes.length) ? "" : "none";
        if (space.style.display !== display) space.style.display = display;
        // Measure the grid before mirroring the visible card positions below.
        space.style.removeProperty("transform");
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
      const sameSize = previous?.columns === columns
        && Math.abs(previous.width - first.width) < .02 && Math.abs(previous.height - first.height) < .02;
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const shouldAnimate = (animate && (removed !== null || restoringCards) || continuing) && !reducedMotion;

      let rowStart = 0;
      const preferredRows = restoringCards && matchesRollback && rollback?.columns === columns ? rollback.rowSizes
        : previous?.columns === columns ? previous.rowSizes.map(size => {
          const remaining = size - (removed?.filter(index => index >= rowStart && index < rowStart + size).length ?? 0);
          rowStart += size;
          return remaining;
        }) : [];
      const positions = getCenteredHandPositions(nodes.length, columns, preferredRows);
      const rowSizes = [...new Set(positions.map(position => position.row))]
        .map(row => positions.filter(position => position.row === row).length);
      const availableWidth = bounds.width - row.clientLeft * 2
        - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      const offsets = getHandRowOffsets(rowSizes, first.width, columnPitch, availableWidth);
      const targets = positions.map(position => ({
        left: first.left - bounds.left - row.clientLeft + position.column * columnPitch + (offsets[position.row] || 0),
        top: first.top - bounds.top - row.clientTop + position.row * rowPitch
      }));
      const slotBounds = spaces.slice(0, nodes.length).map(space => space.getBoundingClientRect());
      slotBounds.forEach((slot, index) => {
        const dx = bounds.left + row.clientLeft + targets[index].left - slot.left;
        const dy = bounds.top + row.clientTop + targets[index].top - slot.top;
        spaces[index].style.transform = `translate(${dx}px, ${dy}px)`;
      });
      // The grid's height change triggers ResizeObserver; preserve an active reflow
      // when its card sizes and local destinations have already been synchronized.
      if (!animate && sameSize && previous.keys.join("\0") === keyOrder && nodes.every((node, index) =>
        Math.abs(parseFloat(node.style.left) - targets[index].left) < .02
        && Math.abs(parseFloat(node.style.top) - targets[index].top) < .02)) {
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
        node.style.height = `${first.height}px`;
        node.style.left = `${targets[index].left}px`;
        node.style.top = `${targets[index].top}px`;
        node.style.visibility = "visible";
      });

      if (shouldAnimate && previous) {
        // Measure after the batch of position writes, avoiding a layout per card.
        const after = nodes.map(node => node.getBoundingClientRect());
        const travel = Math.max(0, ...after.map((rect, index) => {
          const old = before.get(keys[index]);
          return old ? Math.hypot(old.left - rect.left, old.top - rect.top)
            + Math.abs(old.width - rect.width) + Math.abs(old.height - rect.height) : 0;
        }));
        const duration = continuing ? Math.max(80, Math.min(320, remainingTime))
          : getHandReflowDuration(travel, Math.hypot(first.width, first.height));
        const delays = continuing ? keys.map(() => 0) : getHandReflowDelays(previous.keys, keys, previous.rowSizes, rowSizes);
        nodes.forEach((node, index) => {
          const key = keys[index];
          const old = before.get(key);
          if (!old || typeof node.animate !== "function") return;
          const dx = old.left - after[index].left;
          const dy = old.top - after[index].top;
          const scaleX = old.width / after[index].width;
          const scaleY = old.height / after[index].height;
          if (Math.abs(dx) < .5 && Math.abs(dy) < .5 && Math.abs(scaleX - 1) < .005 && Math.abs(scaleY - 1) < .005) return;

          const delay = delays[index];
          const animation = node.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`, transformOrigin: "top left" },
            { transform: "translate(0, 0) scale(1)", transformOrigin: "top left" }
          ], {
            duration: duration - delay,
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
      // Retain the exact row split until a rejected play can be restored.
      if (animate && removed) rollbackRef.current = previous;
      else if (animate && previous?.keys.join("\0") !== keyOrder) rollbackRef.current = null;
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
      rollbackRef.current = null;
    };
  }, [playerId]);

  return rowRef;
}
