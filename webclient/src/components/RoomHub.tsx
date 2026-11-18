import { useEffect, useRef, useState } from "react";
import { t, tr, useLanguage } from "../i18n";
import { CardStyleProvider } from "./CardStyleContext";
import { usePreparedCardStyle } from "../lib/cardArtwork";
import { useSavedAppearance } from "../lib/useSavedAppearance";
import type { MessageKey } from "../i18n/catalog";
import { eventDescription } from "../i18n/presentation";
import { loadPlayerProfile } from "../lib/playerProfile";
import { hasRoomServer, invitation, rememberRoom, roomGateway, roomIdFromInput, RoomError, savedRoomAccess,
  type RoomAccess, type RoomCommand, type RoomView, type SavedRoomAccess } from "../lib/roomGateway";
import type { GameLength, MatchTargetWins, TrumpChoice } from "../types";
import RoomGameTable from "./RoomGameTable";
import PlayingCard from "./PlayingCard";
import LanguageSelect from "./LanguageSelect";
import "../styles/rooms.css";

function errorKey(error: unknown): MessageKey {
  if (!(error instanceof RoomError)) return "rooms.network";
  const messages: Record<number, MessageKey> = { 401: "rooms.expired", 403: "rooms.denied", 404: "rooms.missing", 409: "rooms.conflict", 503: "rooms.unavailable" };
  return messages[error.status] ?? "rooms.error";
}

export default function RoomHub({ onBack }: { onBack: () => void }) {
  useLanguage();
  const preferences = useSavedAppearance();
  const preparedCardStyle = usePreparedCardStyle(preferences.visual.cardStyle);
  const initialId = roomIdFromInput(window.location.href);
  const [saved, setSaved] = useState(savedRoomAccess);
  const [access, setAccess] = useState<SavedRoomAccess | null>(() => savedRoomAccess().find(item => item.roomId === initialId) ?? null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [name, setName] = useState(() => loadPlayerProfile().name || savedRoomAccess()[0]?.name || "");
  const [invite, setInvite] = useState(initialId ?? "");
  const [seat, setSeat] = useState("north");
  const [joinMode, setJoinMode] = useState(() => Boolean(initialId));
  const [busy, setBusy] = useState(false);
  const commandLock = useRef(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [retry, setRetry] = useState<RoomCommand | null>(null);
  const [belaIndex, setBelaIndex] = useState<number | null>(null);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [length, setLength] = useState<GameLength>("SHORT");
  const [wins, setWins] = useState<MatchTargetWins>(1);

  function accept(next: RoomView) {
    setRoom(current => current?.roomId === next.roomId && current.revision > next.revision ? current : next);
  }

  // Poll only a visible room, with at most one read in flight. No per-game server thread.
  useEffect(() => {
    if (!access || !hasRoomServer) return;
    let stopped = false, inFlight = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const refresh = async () => {
      if (stopped || inFlight) return;
      if (!document.hidden) {
        inFlight = true;
        try {
          const next = await roomGateway.read(access, controller.signal);
          if (!stopped) { accept(next); setError(current => current === "rooms.network" ? null : current); }
        } catch (reason) {
          if (!stopped) setError(errorKey(reason));
        } finally { inFlight = false; }
      }
      if (!stopped) { clearTimeout(timer); timer = setTimeout(() => void refresh(), 2000); }
    };
    const onVisible = () => { if (!document.hidden) void refresh(); };
    void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearTimeout(timer); controller.abort(); document.removeEventListener("visibilitychange", onVisible); };
  }, [access]);

  useEffect(() => { setBelaIndex(null); setConfirmForfeit(false); }, [room?.revision]);
  useEffect(() => {
    if (!room) return;
    setLength(room.snapshot.score.gameTargetPoints === 501 ? "SHORT" : "LONG");
    setWins(room.snapshot.score.matchTargetWins === 5 ? 5 : room.snapshot.score.matchTargetWins === 3 ? 3 : 1);
  }, [room?.roomId, room?.revision]);

  function enter(next: RoomAccess) {
    const stored = rememberRoom(next);
    setStorageWarning(!stored);
    setSaved(savedRoomAccess());
    setRoom(next.room);
    setAccess({ roomId: next.room.roomId, token: next.token, name });
    setRetry(null);
    history.replaceState(null, "", `#room=${next.room.roomId}`);
  }

  async function connect(join: boolean) {
    if (commandLock.current || !name.trim() || !hasRoomServer) return;
    const id = roomIdFromInput(invite);
    if (join && !id) { setError("rooms.invalidInvite"); return; }
    const existing = join ? saved.find(item => item.roomId === id) : undefined;
    if (existing) { open(existing); return; }
    commandLock.current = true; setBusy(true); setError(null);
    try { enter(join ? await roomGateway.join(id!, name.trim(), seat) : await roomGateway.create(name.trim())); }
    catch (reason) { setError(errorKey(reason)); }
    finally { commandLock.current = false; setBusy(false); }
  }

  function open(next: SavedRoomAccess) {
    setRoom(null); setAccess(next); setRetry(null); setError(null);
    history.replaceState(null, "", `#room=${next.roomId}`);
  }

  async function act(patch: Omit<RoomCommand, "requestId" | "revision">, repeated?: RoomCommand) {
    if (!access || !room || commandLock.current || (retry && !repeated)) return;
    commandLock.current = true; setBusy(true); setError(null);
    const command: RoomCommand = repeated ?? { ...patch, revision: room.revision, requestId: requestId() };
    try { accept(await roomGateway.act(access, command)); setRetry(null); }
    catch (reason) {
      setError(errorKey(reason));
      if (!(reason instanceof RoomError)) setRetry(command); // Retry the same ID after an ambiguous network failure.
      else setRetry(null);
      try { accept(await roomGateway.read(access)); } catch { /* Keep the last confirmed table. */ }
    } finally { commandLock.current = false; setBusy(false); }
  }

  async function refresh() {
    if (!access || commandLock.current) return;
    commandLock.current = true; setBusy(true); setError(null);
    try { accept(await roomGateway.read(access)); } catch (reason) { setError(errorKey(reason)); }
    finally { commandLock.current = false; setBusy(false); }
  }

  const pending = room?.snapshot.pendingAction;
  const me = room?.snapshot.players.find(player => player.id === room.yourSeat);
  const actor = room?.snapshot.players.find(player => player.id === pending?.actingPlayerId);
  const locked = busy || retry !== null;
  const lobby = room?.snapshot.phase === "READY_TO_START";
  const invitationUrl = room ? invitation(room.roomId) : "";

  function backToRoomList() {
    setAccess(null); setRoom(null); setRetry(null); setError(null); history.replaceState(null, "", "#rooms");
  }

  if (access && room && !lobby) {
    return <CardStyleProvider value={preparedCardStyle}><RoomGameTable
      room={room}
      preferences={preferences}
      busy={busy}
      locked={locked}
      errorMessage={error ? t(error) : null}
      retry={retry}
      onAct={patch => { void act(patch); }}
      onRefresh={() => { void refresh(); }}
      onRoomList={backToRoomList}
      onRetry={() => { if (retry) void act({ action: retry.action }, retry); }}
    /></CardStyleProvider>;
  }

  return <CardStyleProvider value={preparedCardStyle}><main className={`rooms-page ${!access ? "rooms-page-entry" : !room ? "rooms-page-connecting" : lobby ? "rooms-page-lobby" : ""}`}>
    <header className="rooms-header">
      <button type="button" onClick={onBack} disabled={busy}>← {t("home.back")}</button>
      <LanguageSelect />
    </header>
    <div className="rooms-heading"><span className="rooms-eyebrow">BELOT · MULTIPLAYER</span>
      <h1>{t("rooms.title")}</h1><p>{t("rooms.intro")}</p></div>
    {!hasRoomServer && <p className="rooms-notice" role="status">{t("rooms.noServer")}</p>}
    {storageWarning && <p className="rooms-notice" role="status">{t("rooms.storage")}</p>}
    {error && <div className="rooms-notice" role="alert"><p>{t(error)}</p>
      {access && <button type="button" disabled={busy} onClick={() => void refresh()}>{t("rooms.refresh")}</button>}
    </div>}
    {retry && <button className="rooms-primary" disabled={busy} onClick={() => void act({ action: retry.action }, retry)}>{t("rooms.retry")}</button>}

    {!access ? <>
      <section className="rooms-entry-panel">
        <label className="rooms-field rooms-name-field">{t("rooms.name")}
          <input autoComplete="nickname" maxLength={24} value={name} onChange={event => setName(event.target.value)} /></label>
        {!joinMode ? <div className="rooms-entry-grid">
          <button type="button" className="rooms-choice-card rooms-choice-create" disabled={busy || !name.trim() || !hasRoomServer} onClick={() => void connect(false)}>
            <span className="rooms-choice-icon" aria-hidden="true">♧</span><span className="rooms-choice-arrow" aria-hidden="true">↗</span>
            <strong>{t("rooms.create")}</strong><small>{t("rooms.bots")}</small>
          </button>
          <button type="button" className="rooms-choice-card" disabled={!hasRoomServer || busy} onClick={() => setJoinMode(true)}>
            <span className="rooms-choice-icon" aria-hidden="true">↗</span><span className="rooms-choice-arrow" aria-hidden="true">↗</span>
            <strong>{t("rooms.join")}</strong><small>{t("rooms.invite")}</small>
          </button>
        </div> : <form className="rooms-join-form" onSubmit={event => { event.preventDefault(); void connect(true); }}>
          <h2>{t("rooms.join")}</h2>
          <label className="rooms-field">{t("rooms.invite")}<input required value={invite} onChange={event => setInvite(event.target.value)} /></label>
          <label className="rooms-field">{t("rooms.seat")}<select value={seat} onChange={event => setSeat(event.target.value)}>
            {(["north", "west", "east"] as const).map(value => <option key={value} value={value}>{t(`rooms.${value}`)}</option>)}</select></label>
          <div className="rooms-join-actions">
            <button type="button" className="rooms-back-link" onClick={() => { setJoinMode(false); setError(null); }}>← {t("rooms.chooseAction")}</button>
            <button className="rooms-primary" disabled={busy || !name.trim() || !hasRoomServer} type="submit">{t("rooms.join")}</button>
          </div>
        </form>}
      </section>
      {saved.length > 0 && <details className="rooms-saved-menu"><summary>{t("rooms.mine")} <span>{saved.length}</span></summary>
        <ul className="rooms-saved-list">{saved.map(item => <li key={item.roomId}>
          <span>{item.name} · {item.roomId.slice(0, 8)}</span>
          <button disabled={!hasRoomServer || busy} onClick={() => open(item)}>{t("rooms.open")}</button>
        </li>)}</ul>
      </details>}
    </> : !room ? <section className="rooms-panel"><p role="status">{t("rooms.connecting")}</p>
      <button type="button" onClick={() => { setAccess(null); setError(null); }}>{t("rooms.list")}</button></section> : <>
      <nav className="rooms-room-nav"><button type="button" disabled={busy} onClick={backToRoomList}>{t("rooms.list")}</button><button type="button" onClick={() => void refresh()} disabled={busy}>{t("rooms.refresh")}</button>
        <span>{room.roomId.slice(0, 8)}</span></nav>
      {lobby && <section className="rooms-lobby-panel">
        <div className="rooms-lobby-heading"><div><span className="rooms-eyebrow">BELOT · MULTIPLAYER</span>
          <h2>{t("rooms.lobby")}</h2></div><span className="rooms-room-code">{room.roomId.slice(0, 8)}</span></div>
        <p>{t("rooms.bots")}</p>
        <div className="rooms-lobby-tools">
          <details className="rooms-inline-menu"><summary>{t("rooms.link")}</summary><div className="rooms-menu-content">
            <input aria-label={t("rooms.link")} readOnly value={invitationUrl} onFocus={event => event.target.select()} />
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(invitationUrl).then(() => setCopied(true)).catch(() => setCopied(false)); }}>
              {t(copied ? "rooms.copied" : "rooms.copy")}</button>
          </div></details>
          {room.host && <details className="rooms-inline-menu"><summary>{t("rooms.settings")}</summary><div className="rooms-menu-content rooms-settings">
          <label>{t("rooms.points")} <select value={length} disabled={locked} onChange={event => setLength(event.target.value as GameLength)}>
            <option value="SHORT">501</option><option value="LONG">1001</option></select></label>
          <label>{t("rooms.wins")} <select value={wins} disabled={locked} onChange={event => setWins(Number(event.target.value) as MatchTargetWins)}>
            {[1, 3, 5].map(value => <option key={value}>{value}</option>)}</select></label>
          <button disabled={locked} onClick={() => void act({ action: "SETTINGS", gameLength: length, matchTargetWins: wins })}>{t("rooms.apply")}</button>
          </div></details>}
        </div>
      </section>}
      <section className="rooms-table" aria-label={t("rooms.seat")}>
        <div className="rooms-seats">{room.snapshot.players.map(player => <div key={player.id}
          data-team={player.team === me?.team ? "your" : "opponent"}
          className={`rooms-seat rooms-seat-${player.seat.toLowerCase()} ${pending?.actingPlayerId === player.id ? "rooms-seat-active" : ""}`}>
          <span>{player.name}{player.id === room.yourSeat ? ` · ${t("rooms.you")}` : ""}</span>
          <small>{player.team} · {player.human ? player.seat : t("rooms.bot")} · {player.handSize}</small>
        </div>)}</div>
        <div className="rooms-score"><span>{room.snapshot.score.teamOneName}: <strong>{room.snapshot.score.teamOneGamePoints}</strong> ({room.snapshot.score.teamOneMatchScore})</span>
          <span>{room.snapshot.score.teamTwoName}: <strong>{room.snapshot.score.teamTwoGamePoints}</strong> ({room.snapshot.score.teamTwoMatchScore})</span>
          <small>{room.snapshot.score.gameTargetPoints} · {room.snapshot.score.matchTargetWins}</small>
          {room.snapshot.trumpSuit && <span>{tr(room.snapshot.trumpSuit.toLowerCase())}</span>}</div>
        <div className="rooms-trick">{room.snapshot.trick.cards.map(play => <div key={play.playerId}>
          <PlayingCard card={play.card} ownerName={play.playerName} /><small>{play.playerName}</small></div>)}</div>
        <div className="rooms-actions" aria-live="polite">
          {room.snapshot.matchComplete ? <h2>{t("rooms.finished")}</h2> : pending?.type === "NONE" ? <p>{t("rooms.wait", { name: actor?.name ?? "…" })}</p> : <>
            {!lobby && <p className="rooms-turn">{t("rooms.turn")}</p>}
            {(pending?.type === "START_MATCH" || pending?.type === "START_NEXT_GAME") && <button className="rooms-primary" disabled={locked}
              onClick={() => void act({ action: "START" })}>{t(lobby ? "rooms.start" : "rooms.next")}</button>}
            {pending?.type === "CHOOSE_TRUMP" && <div className="rooms-buttons">{pending.legalTrumpChoices.map(choice =>
              <button key={choice} disabled={locked} onClick={() => void act({ action: "TRUMP", choice: choice as TrumpChoice })}>
                {choice === "SKIP" ? t("rooms.pass") : tr(choice.toLowerCase())}</button>)}</div>}
            {pending?.type === "REPORT_MELDS" && <><p>{t("rooms.melds")} {pending.availableMelds.map(meld => meld.totalPoints).join(" + ")}</p>
              <button disabled={locked} onClick={() => void act({ action: "MELDS", declare: true })}>{t("rooms.declare")}</button>
              <button disabled={locked} onClick={() => void act({ action: "MELDS", declare: false })}>{t("rooms.pass")}</button></>}
            {pending?.type === "ACKNOWLEDGE_MELDS" && <><p>{pending.meldWinner?.teamName}</p>
              <button disabled={locked} onClick={() => void act({ action: "ACK" })}>{t("rooms.ack")}</button></>}
          </>}
        </div>
        <section className="rooms-hand" aria-label={t("rooms.hand")}>{me?.hand.map((card, index) => <PlayingCard key={`${card.rank}-${card.suit}-${index}`}
          card={card} disabled={locked || !card.playable} legalChoice={card.playable} onClick={() => {
            if (pending?.belaEligibleCardIndices.includes(index)) setBelaIndex(index);
            else void act({ action: "CARD", handIndex: index, callBela: false });
          }} />)}</section>
        {belaIndex !== null && <div className="rooms-confirm" role="alertdialog" aria-label={t("rooms.bela")}>
          <p>{t("rooms.bela")}</p>
          <button disabled={locked} onClick={() => void act({ action: "CARD", handIndex: belaIndex, callBela: true })}>{t("rooms.withBela")}</button>
          <button disabled={locked} onClick={() => void act({ action: "CARD", handIndex: belaIndex, callBela: false })}>{t("rooms.withoutBela")}</button>
          <button disabled={locked} onClick={() => setBelaIndex(null)}>{t("rooms.cancel")}</button></div>}
      </section>
      {!lobby && !room.snapshot.matchComplete && <div className="rooms-panel">
        {confirmForfeit ? <div role="alertdialog" aria-label={t("rooms.confirm")}><p>{t("rooms.confirm")}</p>
          <button disabled={locked} onClick={() => void act({ action: "FORFEIT" })}>{t("rooms.forfeit")}</button>
          <button disabled={locked} onClick={() => setConfirmForfeit(false)}>{t("rooms.cancel")}</button></div>
          : <button disabled={locked} onClick={() => setConfirmForfeit(true)}>{t("rooms.forfeit")}</button>}
      </div>}
      <details className="rooms-history"><summary>{t("rooms.history")}</summary><ol className="rooms-log">{room.events.slice(-12).map(event =>
        <li key={event.sequence}>{eventDescription(event)}</li>)}</ol></details>
    </>}
  </main></CardStyleProvider>;
}

function requestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return crypto.randomUUID();
  // getRandomValues also works on trusted LAN HTTP origins without randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
