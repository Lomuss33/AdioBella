import { t, number, getLocale } from "../i18n";
import { useLayoutEffect, useRef } from "react";
import type { GameSnapshot } from "../types";

function GameDataCard({ snapshot }: { snapshot: GameSnapshot | null }) {
  const score = snapshot?.score;
  const cardRef = useRef<HTMLElement>(null);
  const versusRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const versus = versusRef.current;
    const arena = card?.closest<HTMLElement>(".table-arena");
    const headings = card?.querySelectorAll<HTMLElement>(".game-data-team-heading");
    if (!card || !versus || !arena || !headings || headings.length !== 2) return;
    const names = [...headings].map(heading => heading.querySelector<HTMLElement>("strong")!);
    const alignVersus = () => {
      const parent = versus.offsetParent as HTMLElement | null;
      if (!parent || !headings[0].offsetWidth) return;
      const left = headings[0].getBoundingClientRect();
      const right = headings[1].getBoundingClientRect();
      const leftName = names[0].getBoundingClientRect();
      const rightName = names[1].getBoundingClientRect();
      const origin = parent.getBoundingClientRect();
      const table = arena.getBoundingClientRect();
      const scaleX = origin.width / parent.offsetWidth || 1;
      const scaleY = origin.height / parent.offsetHeight || 1;
      versus.style.left = `${((left.right + right.left) / 2 - origin.left) / scaleX - parent.clientLeft}px`;
      // Wide layouts put the north seat in this same header row, below the badge.
      const tableScale = table.height / arena.offsetHeight || 1;
      const inset = (Math.max(leftName.bottom, rightName.bottom) - table.top) / tableScale + 5;
      arena.style.setProperty("--score-heading-bottom", `${inset}px`);
      const alignedLeft = names[0].getBoundingClientRect();
      const alignedRight = names[1].getBoundingClientRect();
      const midpointY = (alignedLeft.top + alignedLeft.bottom + alignedRight.top + alignedRight.bottom) / 4;
      versus.style.top = `${(midpointY - origin.top) / scaleY - parent.clientTop}px`;
    };
    alignVersus();
    const observer = new ResizeObserver(alignVersus);
    [arena, ...headings, ...names].forEach(element => observer.observe(element));
    window.addEventListener("resize", alignVersus);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", alignVersus);
      arena.style.removeProperty("--score-heading-bottom");
    };
  }, [score?.teamOneName, score?.teamTwoName, getLocale()]);

  return (
    <section ref={cardRef} className="game-data-card">
      <div className="game-data-grid">
        <section className="game-data-section" data-team="opponent">
          <div className="game-data-team-heading">
            <span className="panel-caption">{t("opponents")}</span>
            <strong title={score?.teamTwoName ?? t("Them")}>{score?.teamTwoName ?? t("Them")}</strong>
          </div>
          <div className="data-list">
            <div className="data-row" data-stat="melds">
              <span className="data-label">{t("Melds")}</span>
              <span className="data-value">{number(score?.teamTwoMeldPoints ?? 0)}</span>
            </div>
            <div className="data-row" data-stat="points">
              <span className="data-label">{t("Points")}</span>
              <span className="data-value">{number(score?.teamTwoGamePoints ?? 0)}</span>
            </div>
            <div className="data-row" data-stat="wins">
              <span className="data-label">{t("Wins")}</span>
              <span className="data-value">{number(score?.teamTwoMatchScore ?? 0)}</span>
            </div>
          </div>
        </section>
        <span ref={versusRef} className="game-data-versus" aria-hidden="true">vs</span>
        <section className="game-data-section" data-team="your">
          <div className="game-data-team-heading">
            <strong title={score?.teamOneName ?? t("Us")}>{score?.teamOneName ?? t("Us")}</strong>
            <span className="panel-caption">{t("your team")}</span>
          </div>
          <div className="data-list">
            <div className="data-row" data-stat="wins">
              <span className="data-label">{t("Wins")}</span>
              <span className="data-value">{number(score?.teamOneMatchScore ?? 0)}</span>
            </div>
            <div className="data-row" data-stat="points">
              <span className="data-label">{t("Points")}</span>
              <span className="data-value">{number(score?.teamOneGamePoints ?? 0)}</span>
            </div>
            <div className="data-row" data-stat="melds">
              <span className="data-label">{t("Melds")}</span>
              <span className="data-value">{number(score?.teamOneMeldPoints ?? 0)}</span>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

export default GameDataCard;
