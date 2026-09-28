import { InfoButton } from "./TableUtilities";
import { AccentColorPicker, CardStylePicker, TableColorPicker } from "./AppearanceSettings";
import type { VisualSettings } from "../lib/preferences";
import { meldDescription, errorDescription } from "../i18n/presentation";
import { t, tr, countText } from "../i18n";
import LanguageSelect from "./LanguageSelect";
import { useEffect, useRef, type ReactNode } from "react";
import type {
  CardView,
  GameCompleteSummary,
  GameSettingsDrafts,
  MatchCompleteSummary,
  MeldSetView,
  MeldWinnerView,
  PendingAction,
  PlayerNameDrafts,
  TeamNameDrafts
} from "../types";
import PlayingCard from "./PlayingCard";
import SuitChoiceButton from "./SuitChoiceButton";
import { usePopupDialog } from "../lib/usePopupDialog";

interface ActionPanelProps {
  pendingAction?: PendingAction;
  errorMessage: string | null;
  playerNames: PlayerNameDrafts;
  teamNames: TeamNameDrafts;
  gameSettings: GameSettingsDrafts;
  gameCompleteSummary: GameCompleteSummary | null;
  matchCompleteSummary: MatchCompleteSummary | null;
  onPlayerNameChange: (seat: keyof PlayerNameDrafts, value: string) => void;
  onTeamNameChange: (team: keyof TeamNameDrafts, value: string) => void;
  onGameSettingsChange: (patch: Partial<GameSettingsDrafts>) => void;
  onStart: () => void;
  onStartRematch: () => void;
  onOpenSettingsMenu: () => void;
  onChooseTrump: (choice: string) => void;
  onReportMelds: (declare: boolean) => void;
  onAcknowledgeMelds: () => void;
  pendingBelaChoiceCard: CardView | null;
  onPlayWithBela: () => void;
  onPlayWithoutBela: () => void;
  onOpenBook?: () => void;
  visual?: VisualSettings;
  onVisualChange?: (patch: Partial<VisualSettings>) => void;
}

function ActionPanel({
  pendingAction,
  errorMessage,
  playerNames,
  teamNames,
  gameSettings,
  gameCompleteSummary,
  matchCompleteSummary,
  onPlayerNameChange,
  onTeamNameChange,
  onGameSettingsChange,
  onStart,
  onStartRematch,
  onOpenSettingsMenu,
  onChooseTrump,
  onReportMelds,
  onAcknowledgeMelds,
  pendingBelaChoiceCard,
  onPlayWithBela,
  onPlayWithoutBela,
  onOpenBook, visual, onVisualChange
}: ActionPanelProps) {
  const isStart = pendingAction?.type === "START_MATCH";
  const isNextGame = pendingAction?.type === "START_NEXT_GAME";
  const isTrumpChoice = pendingAction?.type === "CHOOSE_TRUMP";
  const canSkipTrump = isTrumpChoice && Boolean(pendingAction?.legalTrumpChoices.includes("SKIP"));
  const isReportMelds = pendingAction?.type === "REPORT_MELDS";
  const isAcknowledgeMelds = pendingAction?.type === "ACKNOWLEDGE_MELDS";
  const isBelaChoice = pendingBelaChoiceCard !== null;
  const isMatchComplete = matchCompleteSummary !== null;
  const isPopupVisible = isStart || isNextGame || isTrumpChoice || isReportMelds || isAcknowledgeMelds || isBelaChoice || isMatchComplete;
  const dialogRef = usePopupDialog(isPopupVisible);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPopupVisible) return;
    contentRef.current?.scrollTo?.(0, 0);
    contentRef.current?.focus({ preventScroll: true });
  }, [isPopupVisible, pendingAction?.type, isBelaChoice, isMatchComplete]);

  if (!isPopupVisible) {
    return null;
  }

  const title = isStart
    ? "Adio Bella"
    : isMatchComplete
      ? t("Match complete")
    : isNextGame
      ? t("Game complete")
      : isTrumpChoice
        ? t("Choose the trump suit")
        : isReportMelds || isAcknowledgeMelds
          ? t("Melds")
          : t("Bela");
  const subtitle = isStart
    ? null
    : isMatchComplete
      ? matchCompleteSubtitle(matchCompleteSummary)
    : isNextGame
      ? gameCompleteWinnerMessage(gameCompleteSummary)
      : isTrumpChoice
        ? (pendingAction?.legalTrumpChoices.includes("SKIP") ? t("Choose the trump suit or skip.") : t("Choose the trump suit."))
        : isReportMelds
          ? t("Declare your melds or keep them hidden.")
          : isAcknowledgeMelds
            ? t("Review the winning melds before the first trick.")
            : t("Call Bela with this card or play it quietly.");

  return (
    <dialog
      ref={dialogRef}
      className={`belot-dialog ${isStart ? "belot-dialog-setup" : ""} ${isTrumpChoice ? "belot-dialog-trump" : ""} ${canSkipTrump ? "belot-dialog-trump-can-skip" : ""}`}
      aria-label={isStart ? t("Start the match") : title}
      aria-modal={false}
      onCancel={(event) => event.preventDefault()}
    >
      <div className="popup-card">
            <div ref={contentRef} tabIndex={-1} className="popup-content">
              <div className={`action-popup-header ${isStart ? "action-popup-header-start" : ""}`}>
                <div className="start-heading-row">
                  <div className="start-heading-copy">
                    <h2 className="action-popup-title">{title}</h2>
                    {subtitle ? <p className="action-popup-subtitle">{subtitle}</p> : null}
                  </div>
                  {isStart && <div className="setup-toolbar"><LanguageSelect />{onOpenBook && <InfoButton onClick={onOpenBook} />}</div>}
                </div>
                {errorMessage ? <p className="error-line" role="alert">{errorDescription(errorMessage)}</p> : null}
              </div>
              {isStart ? (
                <div className="action-popup-body">

                  <div className="team-settings-grid">
                    <TeamSettingsRow
                      side="your"
                      heading={t("Us")}
                      teamLabel={t("your team")}
                      teamValue={teamNames.yourTeam}
                      onTeamChange={(value) => onTeamNameChange("yourTeam", value)}
                      firstPlayerLabel={t("you")}
                      firstPlayerValue={playerNames.SOUTH}
                      onFirstPlayerChange={(value) => onPlayerNameChange("SOUTH", value)}
                      secondPlayerLabel={t("teammate")}
                      secondPlayerValue={playerNames.NORTH}
                      onSecondPlayerChange={(value) => onPlayerNameChange("NORTH", value)}
                    />
                    <TeamSettingsRow
                      side="opponent"
                      heading={t("Them")}
                      teamLabel={t("enemy team")}
                      teamValue={teamNames.enemyTeam}
                      onTeamChange={(value) => onTeamNameChange("enemyTeam", value)}
                      firstPlayerLabel={t("west")}
                      firstPlayerValue={playerNames.WEST}
                      onFirstPlayerChange={(value) => onPlayerNameChange("WEST", value)}
                      secondPlayerLabel={t("east")}
                      secondPlayerValue={playerNames.EAST}
                      onSecondPlayerChange={(value) => onPlayerNameChange("EAST", value)}
                    />
                  </div>

                  <div className="setup-options-grid">
                    <div className="setup-options-row">
                      <SettingGroup label="mode">
                        <CompactChoices ariaLabel={t("mode")} values={["EASY", "NORMAL", "HARD"] as const} value={gameSettings.difficulty} label={value => tr(value.toLowerCase())} onChange={value => onGameSettingsChange({ difficulty: value })} />
                      </SettingGroup>
                      <SettingGroup label="match length" boxed>
                        <div className="match-length-choices" role="group" aria-label={t("match length")}>
                          {([1, 3, 5] as const).map(value => <button key={value} type="button" aria-label={t("firstTo", { count: value })} aria-pressed={gameSettings.matchTargetWins === value} onClick={() => onGameSettingsChange({ matchTargetWins: value })}>{value}</button>)}
                        </div>
                      </SettingGroup>
                    </div>
                    <div className="setup-options-row">
                      <SettingGroup label="game length" boxed>
                        <CompactChoices ariaLabel={t("game length")} values={["SHORT", "LONG"] as const} value={gameSettings.gameLength} label={value => value === "SHORT" ? "501" : "1001"} describe={value => tr(value === "SHORT" ? "short 501" : "long 1001")} onChange={value => onGameSettingsChange({ gameLength: value })} />
                      </SettingGroup>
                      {visual && onVisualChange ? <CardStylePicker value={visual.cardStyle} onChange={cardStyle => onVisualChange({ cardStyle })} /> : null}
                    </div>
                    {visual && onVisualChange ? <div className="setup-options-row">
                      <AccentColorPicker value={visual.accent} onChange={accent => onVisualChange({ accent })} />
                      <TableColorPicker value={gameSettings.tableTheme} onChange={tableTheme => onGameSettingsChange({ tableTheme })} />
                    </div> : null}
                  </div>
                </div>
              ) : null}
              {isReportMelds ? (
                <div className="action-popup-body meld-popup-body">
                  <MeldSetSection meldSet={pendingAction?.availableMelds?.[0] ?? null} />
                </div>
              ) : null}
              {isAcknowledgeMelds ? (
                <div className="action-popup-body meld-popup-body">
                  <MeldWinnerSection meldWinner={pendingAction?.meldWinner ?? null} />
                </div>
              ) : null}
              {isBelaChoice ? (
                <div className="action-popup-body meld-popup-body bela-popup-body">
                  <div className="meld-card-row meld-card-row-single">
                    <PlayingCard card={pendingBelaChoiceCard} disabled />
                  </div>
                </div>
              ) : null}
              {isNextGame ? (
                <div className="between-games-summary">
                  {gameCompleteSummary ? <GameCompleteSummaryPanel summary={gameCompleteSummary} /> : null}
                </div>
              ) : null}
              {isMatchComplete ? (
                <div className="between-games-summary">
                  <div className="between-games-chip">{t("match result")}</div>
                  {matchCompleteSummary ? <MatchCompleteSummaryPanel summary={matchCompleteSummary} /> : null}
                </div>
              ) : null}
            </div>
            <div className={`popup-footer action-controls ${isTrumpChoice ? "trump-controls" : ""}`}>
              {isStart ? (
                <button type="button" className="action-button action-button-primary" onClick={onStart}>{t("Start the match")}<span aria-hidden="true">→</span>
                </button>
              ) : null}
              {isMatchComplete ? (
                <>
                  <button type="button" className="action-button" onClick={onOpenSettingsMenu}>{t("Settings")}</button>
                  <button type="button" className="action-button action-button-primary" onClick={onStartRematch}>{t("Revenge")}</button>
                </>
              ) : null}
              {isNextGame ? (
                <button type="button" className="action-button action-button-primary" onClick={onStart}>{t("Deal the next game")}</button>
              ) : null}
              {isReportMelds ? (
                <>
                  <button type="button" className="action-button" onClick={() => onReportMelds(false)}>{t("Pass")}</button>
                  <button type="button" className="action-button action-button-primary" onClick={() => onReportMelds(true)}>{t("Declare melds")}</button>
                </>
              ) : null}
              {isAcknowledgeMelds ? (
                <button type="button" className="action-button action-button-primary" onClick={onAcknowledgeMelds}>{t("Continue")}</button>
              ) : null}
              {isBelaChoice ? (
                <>
                  <button type="button" className="action-button" onClick={onPlayWithoutBela}>{t("Play only")}</button>
                  <button type="button" className="action-button action-button-primary" onClick={onPlayWithBela}>{t("Play + Bela")}</button>
                </>
              ) : null}
              {isTrumpChoice
                ? [...(pendingAction?.legalTrumpChoices ?? [])].sort((a, b) => (a === "SKIP" ? 1 : 0) - (b === "SKIP" ? 1 : 0)).map((choice) =>
                    choice === "SKIP" ? (
                      <button
                        key={choice}
                        type="button"
                        className="suit-choice-button suit-choice-skip"
                        onClick={() => onChooseTrump(choice)}
                        aria-label={t("skip")}
                      >
                        <svg className="suit-choice-skip-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                          <path d="m5 5 14 7-14 7V5Z" fill="currentColor" />
                          <path d="M20 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span className="suit-choice-label">{t("skip")}</span>
                      </button>
                    ) : (
                      <SuitChoiceButton key={choice} choice={choice} onChoose={onChooseTrump} />
                    )
                  )
                : null}
            </div>
      </div>
    </dialog>
  );
}

function gameCompleteWinnerMessage(summary: GameCompleteSummary | null) {
  if (!summary) {
    return t("The game is over.");
  }

  return t(summary.byForfeit ? "wonGameForfeit" : "wonGame", { name: summary.winnerName });
}

function matchCompleteSubtitle(summary: MatchCompleteSummary | null) {
  if (!summary) {
    return t("The match is over. Set the next table when you are ready.");
  }

  return t("wonMatch", { name: summary.winnerName, wins: summary.winnerMatchWins, losses: summary.loserMatchWins });
}

function GameCompleteSummaryPanel({ summary }: { summary: GameCompleteSummary }) {
  return (
    <div className="game-complete-grid">
      <section className="game-complete-box" aria-label={t("Match and game settings")}>
        <div className="game-complete-box-title">{t("Settings")}</div>
        <div className="game-complete-box-row">
          <span>{t("Match length")}</span>
          <strong>
            {t("firstTo", { count: summary.matchTargetWins })}
          </strong>
        </div>
        <div className="game-complete-box-row">
          <span>{t("Game length")}</span>
          <strong>{countText("points", summary.nextGameTargetPoints)}</strong>
        </div>
      </section>
      <section className="game-complete-box" aria-label={t("Current standings")}>
        <div className="game-complete-box-title">{t("Standings")}</div>
        <div className="game-complete-score-rows">
          <div className="game-complete-score-row game-complete-score-row-winner">
            <span>{summary.winnerName}</span>
            <strong>
              {t("scoreSummary", { wins: summary.winnerMatchWins, points: summary.winnerGamePoints })}
            </strong>
          </div>
          <div className="game-complete-score-row">
            <span>{summary.loserName}</span>
            <strong>
              {t("scoreSummary", { wins: summary.loserMatchWins, points: summary.loserGamePoints })}
            </strong>
          </div>
        </div>
      </section>
    </div>
  );
}

function MatchCompleteSummaryPanel({ summary }: { summary: MatchCompleteSummary }) {
  return (
    <div className="between-games-result-grid">
      <div className="between-games-outcome">
        <p className="between-games-outcome-line">
          <strong>{t("matchWinner", { name: summary.winnerName })}</strong>
        </p>
      </div>
      <div className="match-complete-grid" aria-label={t("Final match score")}>
        <div className="match-complete-team match-complete-team-winner">{summary.winnerName}</div>
        <div className="match-complete-team">{summary.loserName}</div>
        <div className="match-complete-score match-complete-score-winner">{summary.winnerMatchWins}</div>
        <div className="match-complete-score">{summary.loserMatchWins}</div>
      </div>
      <div className="between-games-matchline">
        {t("finalGame", { win: summary.finalGameWinnerPoints, loss: summary.finalGameLoserPoints })}
        {summary.finalGameByForfeit ? ` / ${t("byForfeit")}` : ""}
      </div>
      <div className="between-games-matchline">
        {t("firstTo", { count: summary.matchTargetWins })}
      </div>
    </div>
  );
}

function MeldSetSection({ meldSet }: { meldSet: MeldSetView | null }) {
  if (!meldSet) {
    return <p className="panel-caption">{t("No melds available.")}</p>;
  }

  return (
    <div className="meld-popup-stack meld-popup-player-block">
      <div className="meld-detail-row">
        <span className="panel-caption">{t("player")}</span>
        <span className="meld-detail-separator" aria-hidden="true">
          {" : "}
        </span>
        <strong>{meldSet.playerName}</strong>
        <span className="meld-detail-separator" aria-hidden="true">
          {" : "}
        </span>
        <strong>{meldSet.totalPoints}</strong>
      </div>
      {meldSet.melds.map((meld) => (
        <div key={`${meld.kind}-${meld.label}-${meld.points}`} className="meld-combination-block">
          <div className="meld-detail-row">
            <span className="panel-caption">{t("meld")}</span>
            <span className="meld-detail-separator" aria-hidden="true">
              {" : "}
            </span>
            <strong>{meldDescription(meld)}</strong>
          </div>
          <div className="meld-card-row">
            {meld.cards.map((card) => (
              <PlayingCard key={`${card.label}-${card.suit}-${card.rank}`} card={card} disabled />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MeldWinnerSection({ meldWinner }: { meldWinner: MeldWinnerView | null }) {
  if (!meldWinner) {
    return <p className="panel-caption">{t("No melds this game.")}</p>;
  }

  return (
    <div className="meld-popup-stack">
      <div className="meld-detail-row">
        <span className="panel-caption">{t("team")}</span>
        <span className="meld-detail-separator" aria-hidden="true">
          {" : "}
        </span>
        <strong>{meldWinner.teamName}</strong>
      </div>
      {meldWinner.players.map((meldSet) => (
        <MeldSetSection key={`${meldSet.playerId}-${meldSet.totalPoints}`} meldSet={meldSet} />
      ))}
    </div>
  );
}


interface TeamSettingsRowProps {
  side: "your" | "opponent";
  heading: string;
  teamLabel: string;
  teamValue: string;
  onTeamChange: (value: string) => void;
  firstPlayerLabel: string;
  firstPlayerValue: string;
  onFirstPlayerChange: (value: string) => void;
  secondPlayerLabel: string;
  secondPlayerValue: string;
  onSecondPlayerChange: (value: string) => void;
}

function TeamSettingsRow({
  side,
  heading,
  teamLabel,
  teamValue,
  onTeamChange,
  firstPlayerLabel,
  firstPlayerValue,
  onFirstPlayerChange,
  secondPlayerLabel,
  secondPlayerValue,
  onSecondPlayerChange
}: TeamSettingsRowProps) {
  return (
    <section className="team-settings-row" data-team={side}>
      <div className="team-settings-label">
        <span className="panel-caption">{t("team")}</span>
        <strong>{heading}</strong>
      </div>
      <label className="name-setting-field team-name-field">
        <span className="panel-caption">{teamLabel}</span>
        <input type="text" value={teamValue} maxLength={30} onChange={(event) => onTeamChange(event.target.value)} />
      </label>
      <label className="name-setting-field player-name-field">
        <span className="panel-caption">{firstPlayerLabel}</span>
        <input type="text" value={firstPlayerValue} maxLength={24} onChange={(event) => onFirstPlayerChange(event.target.value)} />
      </label>
      <label className="name-setting-field player-name-field">
        <span className="panel-caption">{secondPlayerLabel}</span>
        <input type="text" value={secondPlayerValue} maxLength={24} onChange={(event) => onSecondPlayerChange(event.target.value)} />
      </label>
    </section>
  );
}

function SettingGroup({
  label,
  children,
  boxed = false,
  className = ""
}: {
  label: string;
  children: ReactNode;
  boxed?: boolean;
  className?: string;
}) {
  return (
    <section data-setting={label} className={`setting-group ${boxed ? "setting-group-boxed" : ""} ${className}`.trim()}>
      <span className="panel-caption">{tr(label)}</span>
      <div className="setting-pill-row">{children}</div>
    </section>
  );
}

function ChoiceStepper<T extends string | number>({
  ariaLabel,
  values,
  value,
  label,
  onChange
}: {
  ariaLabel: string;
  values: readonly T[];
  value: T;
  label: (value: T) => string;
  onChange: (value: T) => void;
}) {
  const index = values.indexOf(value);
  const previous = values[(index - 1 + values.length) % values.length];
  const next = values[(index + 1) % values.length];
  return <div className="choice-stepper" role="group" aria-label={ariaLabel}>
    <button type="button" aria-label={`${ariaLabel} previous`} onClick={() => onChange(previous)}><span aria-hidden="true">‹</span></button>
    <output aria-live="polite">{label(value)}</output>
    <button type="button" aria-label={`${ariaLabel} next`} onClick={() => onChange(next)}><span aria-hidden="true">›</span></button>
  </div>;
}

function CompactChoices<T extends string>({ ariaLabel, values, value, label, describe, onChange }: {
  ariaLabel: string;
  values: readonly T[];
  value: T;
  label: (value: T) => string;
  describe?: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return <div className="setup-segment-control" role="group" aria-label={ariaLabel}>
    {values.map(option => <button key={option} type="button" title={describe?.(option) ?? label(option)} aria-label={describe?.(option) ?? label(option)} aria-pressed={value === option} onClick={() => onChange(option)}>{label(option)}</button>)}
  </div>;
}

export default ActionPanel;
