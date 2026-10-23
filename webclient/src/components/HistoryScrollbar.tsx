import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { useLanguage } from "../i18n";

interface HistoryScrollbarProps {
  paneRef: RefObject<HTMLDivElement>;
  controls: string;
  label: string;
  revision: readonly unknown[];
  onPositionChange: () => void;
}

function measure(pane: HTMLDivElement, track: HTMLDivElement) {
  const maximum = Math.max(0, pane.scrollHeight - pane.clientHeight);
  const height = track.clientHeight;
  const thumb = maximum > 0 ? Math.min(height, Math.max(40, height * pane.clientHeight / pane.scrollHeight)) : height;
  const scrollTop = Math.max(0, Math.min(maximum, pane.scrollTop));
  const top = maximum > 0 ? scrollTop / maximum * (height - thumb) : 0;
  return { maximum, thumb, top, value: maximum > 0 ? Math.round(scrollTop / maximum * 100) : 0 };
}

export default function HistoryScrollbar({ paneRef, controls, label, revision, onPositionChange }: HistoryScrollbarProps) {
  const { locale } = useLanguage();
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; grab: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ maximum: 0, thumb: 0, top: 0, value: 0 });
  const sync = useCallback(() => {
    const pane = paneRef.current, track = trackRef.current;
    if (!pane || !track) return;
    const next = measure(pane, track);
    setPosition(previous => previous.maximum === next.maximum && previous.thumb === next.thumb
      && previous.top === next.top && previous.value === next.value ? previous : next);
  }, [paneRef]);

  useLayoutEffect(sync, [sync, revision, locale]);
  useLayoutEffect(() => {
    const pane = paneRef.current, track = trackRef.current;
    if (!pane || !track) return;
    pane.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(pane);
    observer.observe(track);
    sync();
    return () => {
      pane.removeEventListener("scroll", sync);
      observer.disconnect();
      drag.current = null;
    };
  }, [paneRef, sync]);

  const moveTo = (top: number) => {
    if (!paneRef.current) return;
    paneRef.current.scrollTop = top;
    onPositionChange();
    sync();
  };
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current || event.button !== 0 || !event.isPrimary || position.maximum <= 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const bounds = event.currentTarget.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, grab: (event.clientY - bounds.top) / bounds.height };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current, track = trackRef.current, pane = paneRef.current;
    if (!active || active.pointerId !== event.pointerId || !track || !pane) return;
    event.preventDefault();
    const current = measure(pane, track), travel = track.clientHeight - current.thumb;
    if (travel <= 0) return;
    const top = event.clientY - track.getBoundingClientRect().top - track.clientTop - active.grab * current.thumb;
    moveTo(Math.max(0, Math.min(travel, top)) / travel * current.maximum);
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  // Direct keyboard operation belongs to the scrollbar, never the feed content.
  const operateScrollbar = (event: KeyboardEvent<HTMLDivElement>) => {
    const pane = paneRef.current;
    if (!pane || position.maximum <= 0 || event.ctrlKey || event.metaKey || event.altKey) return;
    const destinations: Record<string, number> = {
      ArrowUp: pane.scrollTop - 40, ArrowDown: pane.scrollTop + 40,
      PageUp: pane.scrollTop - pane.clientHeight, PageDown: pane.scrollTop + pane.clientHeight,
      Home: 0, End: position.maximum
    };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    moveTo(Math.max(0, Math.min(position.maximum, destinations[event.key])));
  };

  return (
    <div ref={trackRef} className="terminal-scroll-track" data-overflow={position.maximum > 0}>
      <div className={`terminal-scroll-thumb${dragging ? " is-dragging" : ""}`}
        role="scrollbar" aria-controls={controls} aria-label={label} aria-orientation="vertical"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={position.value} aria-disabled={position.maximum <= 0}
        tabIndex={position.maximum > 0 ? 0 : -1}
        style={{ height: `${position.thumb}px`, transform: `translateY(${position.top}px)` }}
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
        onLostPointerCapture={() => { drag.current = null; setDragging(false); }} onKeyDown={operateScrollbar}>
        <span className="terminal-scroll-grip" aria-hidden="true" />
      </div>
    </div>
  );
}
