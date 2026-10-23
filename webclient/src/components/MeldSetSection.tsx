import type { CSSProperties, ReactNode } from "react";
import { countText, t } from "../i18n";
import { meldDescription } from "../i18n/presentation";
import { getMeldCardRows } from "../lib/meldReviewLayout";
import { teamSide } from "../lib/teamSide";
import type { MeldSetView } from "../types";
import PlayingCard from "./PlayingCard";
import MeldSummary from "./MeldSummary";
import { PopupSection } from "./GamePopup";

/** The same declaration evidence in the live review and the table's history. */
export default function MeldSetSection({ meldSet, yourTeam, showTeam = false, emptyContent, children }: {
  meldSet: MeldSetView;
  yourTeam?: string;
  showTeam?: boolean;
  emptyContent?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <PopupSection className="meld-popup-stack meld-popup-player-block" team={teamSide(meldSet.teamName, yourTeam)} data-meld-count={meldSet.melds.length} aria-label={meldSet.playerName}>
      {showTeam ? (
        <div className="meld-team-summary">
          <div className="meld-team-identity">
            <span>{t("team")}</span>
            <strong>{meldSet.teamName}</strong>
          </div>
        </div>
      ) : null}
      <MeldSummary className="meld-player-summary" kind="player" caption={t("player")}
        name={meldSet.playerName} points={meldSet.totalPoints} />
      <div className="meld-combination-list">
        <span className="meld-combination-list-label">{t("Combinations")}</span>
        {meldSet.melds.length > 0 ? meldSet.melds.map((meld, index) => (
          <section key={`${meld.kind}-${index}`} className="meld-combination-block" aria-label={`${meldDescription(meld)}, ${countText("points", meld.points)}`}>
            <div className="meld-combination-heading">
              <div className="meld-combination-name">
                <strong>{meldDescription(meld)}</strong>
              </div>
              <span className="meld-combination-points">+{countText("points", meld.points)}</span>
            </div>
            <div className="meld-card-row" data-card-count={meld.cards.length}>
              {getMeldCardRows(meld.cards).map((cards, row) => (
                <div key={row} className="meld-card-line" style={{ "--meld-card-count": cards.length } as CSSProperties}>
                  {cards.map(card => <PlayingCard key={`${card.label}-${card.suit}-${card.rank}`} card={card} disabled />)}
                </div>
              ))}
            </div>
          </section>
        )) : emptyContent ?? <p className="meld-details-note">{t("No melds available.")}</p>}
        {children}
      </div>
    </PopupSection>
  );
}
