import { useEffect, useState } from "react";
import { t, tr, useLanguage } from "../i18n";
import type { MessageKey } from "../i18n/catalog";
import { deleteSoloGame, listSoloGames, migrateSoloGame, renameSoloGame, type SoloGameSummary } from "../lib/soloGames";
import { useSavedAppearance } from "../lib/useSavedAppearance";
import SettingsButton from "./SettingsButton";
import SavedGameList from "./SavedGameList";
import "../styles/rooms.css";
import "../styles/solo-lobby.css";

const statusKeys: Record<SoloGameSummary["action"], MessageKey> = {
  NONE: "solo.active", START_MATCH: "Start the match", START_NEXT_GAME: "rooms.next",
  CHOOSE_TRUMP: "solo.trump", REPORT_MELDS: "rooms.melds", ACKNOWLEDGE_MELDS: "rooms.ack",
  PLAY_CARD: "rooms.turn"
};

function gameTitle(game: SoloGameSummary) {
  if (game.name) return game.name;
  const date = new Date(game.createdAt);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month} ${game.score.gameTargetPoints}`;
}

export default function SoloLobby({ onHome, onNew, onOpen }: {
  onHome: () => void; onNew: () => void; onOpen: (id: string) => void;
}) {
  const { locale } = useLanguage();
  useSavedAppearance();
  const [games, setGames] = useState(listSoloGames);
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    migrateSoloGame();
    const refresh = () => setGames(listSoloGames());
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  function finish(success: boolean) {
    if (!success) { setError("solo.manageFailed"); return; }
    setError(null);
    setEdit(null);
    setDeleting(null);
    setGames(listSoloGames());
  }

  const active = games.filter(game => !game.matchComplete);
  const completed = games.filter(game => game.matchComplete);
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  function resumeShortcut(game: SoloGameSummary | undefined, label: MessageKey, symbol: string) {
    return <button type="button" className="solo-shortcut-resume" aria-label={t(label)} disabled={!game}
      onClick={() => { if (game) onOpen(game.id); }}>
      <span className="solo-shortcut-icon" aria-hidden="true">{symbol}</span>
      <strong>{t(label)}</strong>
      {game && <small>{gameTitle(game)}</small>}
    </button>;
  }

  function renderGame(game: SoloGameSummary) {
    if (edit?.id === game.id) return <form className="solo-game-edit" onSubmit={event => { event.preventDefault(); finish(renameSoloGame(game.id, edit.name)); }}>
      <label className="rooms-field">{t("solo.gameName")}<input autoFocus value={edit.name} maxLength={40} onChange={event => setEdit({ id: game.id, name: event.target.value })} /></label>
      <button type="submit" className="rooms-primary">{t("solo.saveName")}</button>
      <button type="button" onClick={() => setEdit(null)}>{t("rooms.cancel")}</button>
    </form>;
    const mostRecent = game.id === active[0]?.id;
    return <div className={mostRecent ? "solo-game-row solo-game-recent" : "solo-game-row"}>
      <div className="solo-game-info">
        <div className="solo-game-heading">
          <strong>{gameTitle(game)}</strong>
          <span className="solo-game-status">{t(game.matchComplete ? "rooms.finished" : statusKeys[game.action] ?? "solo.active")}</span>
        </div>
        <div className="solo-game-score">
          <small><b>{game.score.teamOneGamePoints}–{game.score.teamTwoGamePoints}</b> {t("solo.points")}</small>
          <small><b>{game.score.teamOneMatchScore}–{game.score.teamTwoMatchScore}</b> {t("solo.gamesWon")}</small>
        </div>
        <div className="solo-game-meta">
          <small className="solo-game-difficulty">{tr(game.score.difficulty.toLowerCase())}</small>
          <small><time dateTime={new Date(game.updatedAt).toISOString()}>{dates.format(game.updatedAt)}</time></small>
        </div>
      </div>
      <div className="solo-game-actions">
        {deleting === game.id ? <>
          <span>{t("solo.deletePrompt")}</span>
          <button type="button" onClick={() => finish(deleteSoloGame(game.id))}>{t("solo.delete")}</button>
          <button type="button" onClick={() => setDeleting(null)}>{t("rooms.cancel")}</button>
        </> : <>
          <button type="button" onClick={() => setDeleting(game.id)}>{t("solo.delete")}</button>
          <button type="button" onClick={() => { setDeleting(null); setEdit({ id: game.id, name: game.name }); }}>{t("solo.rename")}</button>
          <button type="button" className="rooms-primary" onClick={() => onOpen(game.id)}>{t(game.matchComplete ? "solo.view" : "rooms.open")}</button>
        </>}
      </div>
    </div>;
  }

  return <main className="rooms-page solo-lobby">
    <header className="rooms-header">
      <button type="button" onClick={onHome}>← {t("home.back")}</button>
      <h1>{t("solo.title")}</h1>
      <SettingsButton />
    </header>
    <section className="solo-lobby-content" aria-label={t("solo.overview")}>
      <dl className="solo-lobby-stats">
        <div><dt>{t("solo.active")}</dt><dd>{active.length}</dd></div>
        <div><dt>{t("solo.completed")}</dt><dd>{completed.length}</dd></div>
        <div><dt>{t("solo.gamesWon")}</dt><dd>{games.reduce((total, game) => total + game.score.teamOneMatchScore, 0)}</dd></div>
      </dl>
      <div className="solo-lobby-games" tabIndex={0} role="group" aria-label={t("solo.title")}>
        {error && <p className="rooms-notice" role="alert">{t(error)}</p>}
        {games.length === 0 && <p className="solo-lobby-empty">{t("solo.empty")}</p>}
        {active.length > 0 && <section className="rooms-saved-menu">
          <h2>{t("solo.active")}</h2>
          <SavedGameList items={active} render={renderGame} />
        </section>}
        {completed.length > 0 && <details className="rooms-saved-menu">
          <summary>{t("solo.completed")} ({completed.length})</summary>
          <SavedGameList items={completed} render={renderGame} />
        </details>}
      </div>
      <div className="solo-lobby-shortcuts">
        {resumeShortcut(active[0], "solo.continueLast", "♠")}
        <button type="button" className="rooms-primary solo-shortcut-new" onClick={onNew}>
          <span className="solo-shortcut-icon" aria-hidden="true">+</span>
          <strong>{t("solo.new")}</strong>
        </button>
        {resumeShortcut(active[1], "solo.continueRecent", "♣")}
      </div>
    </section>
  </main>;
}
