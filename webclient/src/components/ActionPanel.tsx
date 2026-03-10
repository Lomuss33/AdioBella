import type { ReactNode } from "react";
import type { GameSettingsDrafts, PendingAction, PlayerNameDrafts, TeamNameDrafts } from "../types";
import SuitChoiceButton from "./SuitChoiceButton";

interface ActionPanelProps {
  pendingAction?: PendingAction;
  errorMessage: string | null;
  playerNames: PlayerNameDrafts;
  teamNames: TeamNameDrafts;
  gameSettings: GameSettingsDrafts;
  gameWinMessage: string | null;
  onPlayerNameChange: (seat: keyof PlayerNameDrafts, value: string) => void;
  onTeamNameChange: (team: keyof TeamNameDrafts, value: string) => void;
  onGameSettingsChange: (patch: Partial<GameSettingsDrafts>) => void;
  onStart: () => void;
  onChooseTrump: (choice: string) => void;
}

function ActionPanel({
  pendingAction,
  errorMessage,
  playerNames,
  teamNames,
  gameSettings,
  gameWinMessage,
  onPlayerNameChange,
  onTeamNameChange,
  onGameSettingsChange,
  onStart,
  onChooseTrump
}: ActionPanelProps) {
  const isStart = pendingAction?.type === "START_MATCH";
  const isNextGame = pendingAction?.type === "START_NEXT_GAME";
  const isTrumpChoice = pendingAction?.type === "CHOOSE_TRUMP";
  const isPopupVisible = isStart || isNextGame || isTrumpChoice;

  if (!isPopupVisible) {
    return null;
  }

  const title = isStart ? "Start the match" : isNextGame ? "Game complete" : "Choose the trump suit";
  const subtitle = isStart
    ? "Set the table, the pace, and the people before the first deal."
    : isNextGame
      ? gameWinMessage ?? "That game is done. Take a breath and deal the next one."
      : pendingAction?.prompt || "Choose the trump suit or skip.";

  return (
    <div
      className={`action-overlay ${
        isTrumpChoice ? "action-overlay-trump" : isNextGame ? "action-overlay-next-game" : "action-overlay-start"
      }`}
    >
      <div className={`action-bar action-popup ${isStart ? "action-popup-start" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="action-popup-header">
          <h2 className="action-popup-title">{title}</h2>
          <p className="action-popup-subtitle">{subtitle}</p>
          {errorMessage ? <p className="error-line">{errorMessage}</p> : null}
        </div>
        {isStart ? (
          <div className="action-popup-body">
            <div className="name-settings-grid">
              <label className="name-setting-field">
                <span className="panel-caption">your team</span>
                <input
                  type="text"
                  value={teamNames.yourTeam}
                  maxLength={30}
                  onChange={(event) => onTeamNameChange("yourTeam", event.target.value)}
                />
              </label>
              <label className="name-setting-field">
                <span className="panel-caption">enemy team</span>
                <input
                  type="text"
                  value={teamNames.enemyTeam}
                  maxLength={30}
                  onChange={(event) => onTeamNameChange("enemyTeam", event.target.value)}
                />
              </label>
              {(["SOUTH", "WEST", "NORTH", "EAST"] as const).map((seat) => (
                <label key={seat} className="name-setting-field">
                  <span className="panel-caption">{seat.toLowerCase()}</span>
                  <input
                    type="text"
                    value={playerNames[seat]}
                    maxLength={24}
                    onChange={(event) => onPlayerNameChange(seat, event.target.value)}
                  />
                </label>
              ))}
            </div>

            <div className="settings-stack">
              <SettingGroup label="difficulty">
                {(["EASY", "NORMAL", "HARD"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`setting-pill ${gameSettings.difficulty === mode ? "selected" : ""}`}
                    onClick={() => onGameSettingsChange({ difficulty: mode })}
                  >
                    {mode.toLowerCase()}
                  </button>
                ))}
              </SettingGroup>

              <SettingGroup label="match length">
                {([1, 3, 5] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`setting-pill ${gameSettings.matchTargetWins === value ? "selected" : ""}`}
                    onClick={() => onGameSettingsChange({ matchTargetWins: value })}
                  >
                    first to {value}
                  </button>
                ))}
              </SettingGroup>

              <SettingGroup label="game length">
                {([
                  { value: "SHORT", label: "short 501" },
                  { value: "LONG", label: "long 1001" }
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`setting-pill ${gameSettings.gameLength === option.value ? "selected" : ""}`}
                    onClick={() => onGameSettingsChange({ gameLength: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </SettingGroup>

              <SettingGroup label="table color">
                {([
                  { value: "GREEN", label: "green" },
                  { value: "DARK_BLUE", label: "dark blue" },
                  { value: "CHERRY_RED", label: "cherry red" },
                  { value: "WOODY_BROWN", label: "woody brown" },
                  { value: "FINE_BLACK", label: "fine black" }
                ] as const).map((theme) => (
                  <button
                    key={theme.value}
                    type="button"
                    className={`setting-pill setting-pill-theme ${gameSettings.tableTheme === theme.value ? "selected" : ""}`}
                    onClick={() => onGameSettingsChange({ tableTheme: theme.value })}
                  >
                    {theme.label}
                  </button>
                ))}
              </SettingGroup>
            </div>
          </div>
        ) : null}
        {isNextGame ? (
          <div className="between-games-summary">
            <div className="between-games-chip">next stop</div>
            <p>
              First to {gameSettings.matchTargetWins} game{gameSettings.matchTargetWins === 1 ? "" : "s"} wins the match.
            </p>
            <p>The next game plays to {gameSettings.gameLength === "SHORT" ? 501 : 1001} points.</p>
          </div>
        ) : null}
        <div className={`action-controls ${isTrumpChoice ? "trump-controls" : ""}`}>
          {isStart || isNextGame ? (
            <button type="button" className="action-button action-button-primary" onClick={onStart}>
              {isStart ? "Start the match" : "Deal the next game"}
            </button>
          ) : null}
          {isTrumpChoice
            ? (pendingAction?.legalTrumpChoices ?? []).map((choice) =>
                choice === "SKIP" ? (
                  <button
                    key={choice}
                    type="button"
                    className="suit-choice-button suit-choice-skip"
                    onClick={() => onChooseTrump(choice)}
                    aria-label="skip"
                  >
                    <div className="suit-choice-visual suit-choice-skip-visual" aria-hidden="true">
                      pass
                    </div>
                    <span className="suit-choice-label">skip</span>
                  </button>
                ) : (
                  <SuitChoiceButton key={choice} choice={choice} onChoose={onChooseTrump} />
                )
              )
            : null}
        </div>
      </div>
    </div>
  );
}

function SettingGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="setting-group">
      <span className="panel-caption">{label}</span>
      <div className="setting-pill-row">{children}</div>
    </section>
  );
}

export default ActionPanel;
