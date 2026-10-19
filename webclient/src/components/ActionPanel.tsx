import { defaultNames } from "../i18n/defaultNames";
import { InfoButton } from "./TableUtilities";
import { AccentColorPicker, CardStylePicker, TableColorPicker } from "./AppearanceSettings";
import type { VisualSettings } from "../lib/preferences";
import { meldDescription, errorDescription } from "../i18n/presentation";
import { t, tr, countText, getLocale, number } from "../i18n";
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
  TeamNameDrafts,
  TrumpChoice
} from "../types";
import PlayingCard from "./PlayingCard";
import SuitChoiceButton from "./SuitChoiceButton";
import { usePopupDialog } from "../lib/usePopupDialog";
import { capitalizeInsertedNameWords } from "../lib/nameCapitalization";
import { teamSide } from "../lib/teamSide";

interface ActionPanelProps {
  pendingAction?: PendingAction;
  errorMessage: string | null;
  playerNames: PlayerNameDrafts;
  teamNames: TeamNameDrafts;
  yourTeamName?: string;
  gameSettings: GameSettingsDrafts;
  gameCompleteSummary: GameCompleteSummary | null;
  matchCompleteSummary: MatchCompleteSummary | null;
  onPlayerNameChange: (seat: keyof PlayerNameDrafts, value: string) => void;
  onTeamNameChange: (team: keyof TeamNameDrafts, value: string) => void;
  onGameSettingsChange: (patch: Partial<GameSettingsDrafts>) => void;
  onStart: () => void;
  onStartWithGuide?: () => void;
  onStartRematch: () => void;
  onOpenSettingsMenu: () => void;
  onChooseTrump: (choice: TrumpChoice) => void;
  onReportMelds: (declare: boolean) => void;
  onAcknowledgeMelds: () => void;
  pendingBelaChoiceCard: CardView | null;
  onPlayWithBela: () => void;
  onPlayWithoutBela: () => void;
  onOpenBook?: () => void;
  visual?: VisualSettings;
  onVisualChange?: (patch: Partial<VisualSettings>) => void;
}

const TRUMP_CHOICE_ORDER: Record<TrumpChoice, number> = {
  HEARTS: 0,
  SPADES: 1,
  DIAMONDS: 2,
  CLUBS: 3,
  SKIP: 4
};

function ActionPanel({
  pendingAction,
  errorMessage,
  playerNames,
  teamNames,
  yourTeamName,
  gameSettings,
  gameCompleteSummary,
  matchCompleteSummary,
  onPlayerNameChange,
  onTeamNameChange,
  onGameSettingsChange,
  onStart,
  onStartWithGuide,
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
  const humanTeam = yourTeamName ?? (teamNames.yourTeam.trim() || defaultNames[getLocale()].teams.yourTeam);
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
          ? isReportMelds ? t("Your melds") : t("Winning melds")
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
          ? null
          : isAcknowledgeMelds
            ? null
            : t("Call Bela with this card or play it quietly.");

  return (
    <dialog
      ref={dialogRef}
      className={`belot-dialog ${isStart ? "belot-dialog-setup" : ""} ${isMatchComplete ? "belot-dialog-match-result" : ""} ${isTrumpChoice ? "belot-dialog-trump" : ""} ${isReportMelds || isAcknowledgeMelds ? "belot-dialog-meld-action" : ""} ${canSkipTrump ? "belot-dialog-trump-can-skip" : ""}`}
      aria-label={isStart ? t("Start the match") : title}
      aria-modal={false}
      onCancel={(event) => event.preventDefault()}
    >
      <div className="popup-card">
            <div ref={contentRef} tabIndex={-1} className="popup-content">
              <div className={`action-popup-header ${isStart ? "action-popup-header-start" : ""}`}>
                {isMatchComplete ? <div className="match-result-emblem" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm4 10v5m-4 3h8m-7-3h6v3H9v-3Z" />
                    <path d="M8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4" />
                  </svg>
                </div> : null}
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
                      teamPlaceholder={defaultNames[getLocale()].teams.yourTeam}
                      onTeamChange={(value) => onTeamNameChange("yourTeam", value)}
                      firstPlayerLabel={t("you")}
                      firstPlayerValue={playerNames.SOUTH}
                      firstPlayerPlaceholder={defaultNames[getLocale()].players.SOUTH}
                      onFirstPlayerChange={(value) => onPlayerNameChange("SOUTH", value)}
                      secondPlayerLabel={t("teammate")}
                      secondPlayerValue={playerNames.NORTH}
                      secondPlayerPlaceholder={defaultNames[getLocale()].players.NORTH}
                      onSecondPlayerChange={(value) => onPlayerNameChange("NORTH", value)}
                    />
                    <TeamSettingsRow
                      side="opponent"
                      heading={t("Them")}
                      teamLabel={t("enemy team")}
                      teamValue={teamNames.enemyTeam}
                      teamPlaceholder={defaultNames[getLocale()].teams.enemyTeam}
                      onTeamChange={(value) => onTeamNameChange("enemyTeam", value)}
                      firstPlayerLabel={t("west")}
                      firstPlayerValue={playerNames.WEST}
                      firstPlayerPlaceholder={defaultNames[getLocale()].players.WEST}
                      onFirstPlayerChange={(value) => onPlayerNameChange("WEST", value)}
                      secondPlayerLabel={t("east")}
                      secondPlayerValue={playerNames.EAST}
                      secondPlayerPlaceholder={defaultNames[getLocale()].players.EAST}
                      onSecondPlayerChange={(value) => onPlayerNameChange("EAST", value)}
                    />
                  </div>

                  <div className="setup-options-grid">
                    <div className="setup-options-row">
                      <SettingGroup label="game length" boxed>
                        <CompactChoices numeric ariaLabel={t("game length")} values={["SHORT", "LONG"] as const} value={gameSettings.gameLength} label={value => value === "SHORT" ? "501" : "1001"} describe={value => tr(value === "SHORT" ? "short 501" : "long 1001")} onChange={value => onGameSettingsChange({ gameLength: value })} />
                      </SettingGroup>
                      <SettingGroup label="match length" boxed>
                        <div className="match-length-choices" role="group" aria-label={t("match length")}>
                          {([1, 3, 5] as const).map(value => <button key={value} type="button" data-choice={value} aria-label={t("firstTo", { count: value })} aria-pressed={gameSettings.matchTargetWins === value} onClick={() => onGameSettingsChange({ matchTargetWins: value })}>{value}</button>)}
                        </div>
                      </SettingGroup>
                    </div>
                    <div className="setup-options-row">
                      <SettingGroup label="mode">
                        <CompactChoices ariaLabel={t("mode")} values={["EASY", "NORMAL", "HARD"] as const} value={gameSettings.difficulty} label={value => tr(value.toLowerCase())} onChange={value => onGameSettingsChange({ difficulty: value })} />
                      </SettingGroup>
                      {visual && onVisualChange ? <CardStylePicker value={visual.cardStyle} onChange={cardStyle => onVisualChange({ cardStyle })} /> : null}
                    </div>
                    {visual && onVisualChange ? <div className="setup-options-row setup-colors-row">
                      <AccentColorPicker value={visual.accent} onChange={accent => onVisualChange({ accent })} />
                      <TableColorPicker value={gameSettings.tableTheme} onChange={tableTheme => onGameSettingsChange({ tableTheme })} />
                    </div> : null}
                  </div>
                </div>
              ) : null}
              {isReportMelds ? (
                <div className="action-popup-body meld-popup-body">
                  <MeldSetSection meldSet={pendingAction?.availableMelds?.[0] ?? null} yourTeam={humanTeam} showTeam />
                </div>
              ) : null}
              {isAcknowledgeMelds ? (
                <div className="action-popup-body meld-popup-body">
                  <MeldWinnerSection meldWinner={pendingAction?.meldWinner ?? null} yourTeam={humanTeam} />
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
                  {gameCompleteSummary ? <GameCompleteSummaryPanel summary={gameCompleteSummary} yourTeam={humanTeam} /> : null}
                </div>
              ) : null}
              {isMatchComplete ? (
                <MatchCompleteSummaryPanel summary={matchCompleteSummary} yourTeam={humanTeam} />
              ) : null}
            </div>
            <div className={`popup-footer action-controls ${isTrumpChoice ? "trump-controls" : ""}`}>
              {isStart ? (
                <>
                {onStartWithGuide ? <button type="button" className="action-button setup-guide-button" onClick={onStartWithGuide}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v15M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1Z" /></svg>
                  {t("How to play")}
                </button> : null}
                <button type="button" className="action-button action-button-primary" onClick={onStart}>{t("Start the match")}<span aria-hidden="true">→</span>
                </button>
                </>
              ) : null}
              {isMatchComplete ? (
                <>
                  <button type="button" className="action-button" onClick={onOpenSettingsMenu}>{t("Settings")}</button>
                  <button type="button" className="action-button action-button-primary" onClick={onStartRematch}>{t("Rematch")}</button>
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
                ? [...(pendingAction?.legalTrumpChoices ?? [])].sort((a, b) => TRUMP_CHOICE_ORDER[a] - TRUMP_CHOICE_ORDER[b]).map((choice) =>
                    choice === "SKIP" ? (
                      <button
                        key={choice}
                        type="button"
                        className="suit-choice-button suit-choice-skip"
                        onClick={() => onChooseTrump(choice)}
                        aria-label={t("skip")}
                      >
                        <svg className="suit-choice-skip-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                          <path d="M12.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 12h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function GameCompleteSummaryPanel({ summary, yourTeam }: { summary: GameCompleteSummary; yourTeam: string }) {
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
          <div className="game-complete-score-row game-complete-score-row-winner" data-team={teamSide(summary.winnerName, yourTeam)}>
            <span>{summary.winnerName}</span>
            <strong>
              {t("scoreSummary", { wins: summary.winnerMatchWins, points: summary.winnerGamePoints })}
            </strong>
          </div>
          <div className="game-complete-score-row" data-team={teamSide(summary.loserName, yourTeam)}>
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

function MatchCompleteSummaryPanel({ summary, yourTeam }: { summary: MatchCompleteSummary; yourTeam: string }) {
  return (
    <div className="match-result-summary">
      <div className="match-result-scoreboard" role="group" aria-label={t("Final match score")}>
        <div className="match-result-team match-result-team-winner" data-team={teamSide(summary.winnerName, yourTeam)} role="group" aria-label={summary.winnerName}>
          <span className="match-result-place">{t("Match winner")}</span>
          <h3 className="match-result-name">{summary.winnerName}</h3>
          <strong className="match-result-score">{number(summary.winnerMatchWins)}</strong>
          <span className="match-result-unit">{t("Games won")}</span>
        </div>
        <div className="match-result-team" data-team={teamSide(summary.loserName, yourTeam)} role="group" aria-label={summary.loserName}>
          <span className="match-result-place">{t("Runner-up")}</span>
          <h3 className="match-result-name">{summary.loserName}</h3>
          <strong className="match-result-score">{number(summary.loserMatchWins)}</strong>
          <span className="match-result-unit">{t("Games won")}</span>
        </div>
      </div>
      <dl className="match-result-details">
        <div>
          <dt>{t("Final game")}</dt>
          <dd>
            <span>{number(summary.finalGameWinnerPoints)}–{number(summary.finalGameLoserPoints)}</span>
            {summary.finalGameByForfeit ? <span className="match-result-forfeit">{t("byForfeit")}</span> : null}
          </dd>
        </div>
        <div>
          <dt>{t("Target wins")}</dt>
          <dd>{number(summary.matchTargetWins)}</dd>
        </div>
      </dl>
    </div>
  );
}

function MeldSetSection({ meldSet, yourTeam, showTeam = false }: { meldSet: MeldSetView | null; yourTeam: string; showTeam?: boolean }) {
  if (!meldSet) {
    return <p className="panel-caption">{t("No melds available.")}</p>;
  }

  return (
    <section className="meld-popup-stack meld-popup-player-block" data-team={teamSide(meldSet.teamName, yourTeam)} aria-label={meldSet.playerName}>
      {showTeam ? (
        <div className="meld-team-summary">
          <div className="meld-team-identity">
            <span>{t("team")}</span>
            <strong>{meldSet.teamName}</strong>
          </div>
        </div>
      ) : null}
      <div className="meld-player-summary">
        <div className="meld-player-identity">
          <span>{t("player")}</span>
          <strong>{meldSet.playerName}</strong>
        </div>
        <div className="meld-player-total" aria-label={countText("points", meldSet.totalPoints)}>
          <strong>{number(meldSet.totalPoints)}</strong>
          <span>{t("points")}</span>
        </div>
      </div>
      <div className="meld-combination-list">
        <span className="meld-combination-list-label">{t("Combinations")}</span>
        {meldSet.melds.length > 0 ? meldSet.melds.map((meld) => (
          <section key={`${meld.kind}-${meld.label}-${meld.points}`} className="meld-combination-block">
            <div className="meld-combination-heading">
              <div className="meld-combination-name">
                <strong>{meldDescription(meld)}</strong>
              </div>
              <span className="meld-combination-points">+{countText("points", meld.points)}</span>
            </div>
            <div className="meld-card-row">
              {meld.cards.map((card) => (
                <PlayingCard key={`${card.label}-${card.suit}-${card.rank}`} card={card} disabled />
              ))}
            </div>
          </section>
        )) : (
          <p className="meld-details-note">{t("No melds available.")}</p>
        )}
      </div>
    </section>
  );
}

function MeldWinnerSection({ meldWinner, yourTeam }: { meldWinner: MeldWinnerView | null; yourTeam: string }) {
  if (!meldWinner) {
    return <p className="panel-caption">{t("No melds this game.")}</p>;
  }
  const combinedPoints = meldWinner.players.reduce((total, player) => total + player.totalPoints, 0);

  return (
    <div className="meld-popup-stack meld-winner-stack">
      <div className="meld-winner-team-summary" data-team={teamSide(meldWinner.teamName, yourTeam)}>
        <div className="meld-team-identity">
          <span>{t("Winning team")}</span>
          <strong>{meldWinner.teamName}</strong>
        </div>
        <div className="meld-player-total" aria-label={countText("points", combinedPoints)}>
          <strong>{number(combinedPoints)}</strong>
          <span>{t("points")}</span>
        </div>
      </div>
      {meldWinner.players.map((meldSet) => (
        <MeldSetSection key={`${meldSet.playerId}-${meldSet.totalPoints}`} meldSet={meldSet} yourTeam={yourTeam} />
      ))}
    </div>
  );
}


interface TeamSettingsRowProps {
  side: "your" | "opponent";
  heading: string;
  teamLabel: string;
  teamValue: string;
  teamPlaceholder: string;
  onTeamChange: (value: string) => void;
  firstPlayerLabel: string;
  firstPlayerValue: string;
  firstPlayerPlaceholder: string;
  onFirstPlayerChange: (value: string) => void;
  secondPlayerLabel: string;
  secondPlayerValue: string;
  secondPlayerPlaceholder: string;
  onSecondPlayerChange: (value: string) => void;
}

function TeamSettingsRow({
  side,
  heading,
  teamLabel,
  teamValue,
  teamPlaceholder,
  onTeamChange,
  firstPlayerLabel,
  firstPlayerValue,
  firstPlayerPlaceholder,
  onFirstPlayerChange,
  secondPlayerLabel,
  secondPlayerValue,
  secondPlayerPlaceholder,
  onSecondPlayerChange
}: TeamSettingsRowProps) {
  return (
    <section className="team-settings-row" data-team={side}>
      <div className="team-settings-label">
        <span className="panel-caption">{t("team")}</span>
        <svg className="team-seat-pair" viewBox="0 0 28 28" role="img" aria-label={t(side === "your" ? "team.yourSeats" : "team.opponentSeats")}>
          <title>{t(side === "your" ? "team.yourSeats" : "team.opponentSeats")}</title>
          <rect className="team-seat-table" x="7" y="7" width="14" height="14" rx="4" />
          <path className="team-seat-link" d={side === "your" ? "M14 5v18" : "M5 14h18"} />
          <rect className={side === "your" ? "team-seat-active" : "team-seat-other"} x="10" y="1" width="8" height="4" rx="1.5" />
          <rect className={side === "your" ? "team-seat-active" : "team-seat-other"} x="10" y="23" width="8" height="4" rx="1.5" />
          <rect className={side === "opponent" ? "team-seat-active" : "team-seat-other"} x="1" y="10" width="4" height="8" rx="1.5" />
          <rect className={side === "opponent" ? "team-seat-active" : "team-seat-other"} x="23" y="10" width="4" height="8" rx="1.5" />
        </svg>
        <strong>{heading}</strong>
      </div>
      <label className="name-setting-field team-name-field">
        <span className="panel-caption">{teamLabel}</span>
        <input type="text" value={teamValue} placeholder={teamPlaceholder} maxLength={30} autoCapitalize="words" onChange={(event) => updateNameInput(event.currentTarget, onTeamChange, teamValue, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={(event) => updateNameInput(event.currentTarget, onTeamChange, teamValue)} />
      </label>
      <label className="name-setting-field player-name-field">
        <span className="panel-caption">{firstPlayerLabel}</span>
        <input type="text" value={firstPlayerValue} placeholder={firstPlayerPlaceholder} maxLength={24} autoCapitalize="words" onChange={(event) => updateNameInput(event.currentTarget, onFirstPlayerChange, firstPlayerValue, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={(event) => updateNameInput(event.currentTarget, onFirstPlayerChange, firstPlayerValue)} />
      </label>
      <label className="name-setting-field player-name-field">
        <span className="panel-caption">{secondPlayerLabel}</span>
        <input type="text" value={secondPlayerValue} placeholder={secondPlayerPlaceholder} maxLength={24} autoCapitalize="words" onChange={(event) => updateNameInput(event.currentTarget, onSecondPlayerChange, secondPlayerValue, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={(event) => updateNameInput(event.currentTarget, onSecondPlayerChange, secondPlayerValue)} />
      </label>
    </section>
  );
}

const composingNames = new WeakMap<HTMLInputElement, string>();
function updateNameInput(input: HTMLInputElement, onChange: (value: string) => void, previous: string, composing = false) {
  const raw = input.value;
  if (composing) {
    if (!composingNames.has(input)) composingNames.set(input, previous);
    onChange(raw);
    return;
  }
  const before = composingNames.get(input) ?? previous;
  composingNames.delete(input);
  const normalize = (value: string) => capitalizeInsertedNameWords(before, value, getLocale());
  const value = normalize(raw).slice(0, input.maxLength);
  if (value !== raw) {
    // Preserve the caret during edits and pastes, including Unicode expansions.
    const start = normalize(raw.slice(0, input.selectionStart ?? raw.length)).length;
    const end = normalize(raw.slice(0, input.selectionEnd ?? raw.length)).length;
    const direction = input.selectionDirection;
    input.value = value;
    input.setSelectionRange(Math.min(start, value.length), Math.min(end, value.length), direction ?? undefined);
  }
  onChange(value);
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
  numeric?: boolean;
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

function CompactChoices<T extends string>({ ariaLabel, values, value, label, describe, onChange, numeric = false }: {
  ariaLabel: string;
  numeric?: boolean;
  values: readonly T[];
  value: T;
  label: (value: T) => string;
  describe?: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return <div className={`setup-segment-control${numeric ? " setup-segment-numeric" : ""}`} role="group" aria-label={ariaLabel}>
    {values.map(option => <button key={option} type="button" data-choice={option} title={describe?.(option) ?? label(option)} aria-label={describe?.(option) ?? label(option)} aria-pressed={value === option} onClick={() => onChange(option)}>{label(option)}</button>)}
  </div>;
}

export default ActionPanel;
