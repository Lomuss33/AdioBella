import type { PendingAction, PlayerNameDrafts, TeamNameDrafts } from "../types";
import SuitChoiceButton from "./SuitChoiceButton";

interface ActionPanelProps {
  pendingAction?: PendingAction;
  errorMessage: string | null;
  playerNames: PlayerNameDrafts;
  teamNames: TeamNameDrafts;
  difficulty: string;
  onPlayerNameChange: (seat: keyof PlayerNameDrafts, value: string) => void;
  onTeamNameChange: (team: keyof TeamNameDrafts, value: string) => void;
  onDifficultyChange: (value: string) => void;
  onStart: () => void;
  onChooseTrump: (choice: string) => void;
}

function ActionPanel({
  pendingAction,
  errorMessage,
  playerNames,
  teamNames,
  difficulty,
  onPlayerNameChange,
  onTeamNameChange,
  onDifficultyChange,
  onStart,
  onChooseTrump
}: ActionPanelProps) {
  const isPopupVisible = pendingAction?.type === "START_MATCH" || pendingAction?.type === "CHOOSE_TRUMP";

  if (!isPopupVisible) {
    return null;
  }

  return (
    <div className={`action-overlay ${pendingAction?.type === "START_MATCH" ? "action-overlay-start" : "action-overlay-trump"}`}>
      <div className="action-bar action-popup" role="dialog" aria-modal="true" aria-label="Game action">
        <div>
          <span className="panel-caption">Prompt</span>
          <p>{pendingAction?.prompt || "Waiting for the session to load."}</p>
          {errorMessage ? <p className="error-line">{errorMessage}</p> : null}
        </div>
        {pendingAction?.type === "START_MATCH" ? (
          <>
            <div className="difficulty-row" role="group" aria-label="Difficulty">
              {(["EASY", "NORMAL", "HARD"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`difficulty-button ${difficulty === mode ? "selected" : ""}`}
                  onClick={() => onDifficultyChange(mode)}
                >
                  {mode.toLowerCase()}
                </button>
              ))}
            </div>
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
          </>
        ) : null}
        <div className={`action-controls ${pendingAction?.type === "CHOOSE_TRUMP" ? "trump-controls" : ""}`}>
          {pendingAction?.type === "START_MATCH" ? (
            <button type="button" className="action-button" onClick={onStart}>
              Start Match
            </button>
          ) : null}
          {pendingAction?.type === "CHOOSE_TRUMP"
            ? pendingAction.legalTrumpChoices.map((choice) =>
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

export default ActionPanel;
