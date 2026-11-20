import { useEffect, useRef, useState } from "react";
import { t, useLanguage } from "../i18n";
import { CardStyleProvider } from "./CardStyleContext";
import { usePreparedCardStyle } from "../lib/cardArtwork";
import { useSavedAppearance } from "../lib/useSavedAppearance";
import type { MessageKey } from "../i18n/catalog";
import { eventDescription } from "../i18n/presentation";
import { loadPlayerProfile } from "../lib/playerProfile";
import { hasRoomServer, invitation, rememberRoom, roomGateway, roomIdFromInput, RoomError, savedRoomAccess,
  type RoomAccess, type RoomCommand, type RoomView, type SavedRoomAccess } from "../lib/roomGateway";
import SetupOptions from "./SetupOptions";
import type { MatchRules } from "../types";
import RoomGameTable from "./RoomGameTable";
import SavedGameList from "./SavedGameList";
import SettingsButton, { DisplaySettingsFields, DisplaySettingsProvider } from "./SettingsButton";
import { displayPreferences, type DisplayPreferences } from "../lib/preferences";
import "../styles/rooms.css";

const DEFAULT_ROOM_RULES: MatchRules = { gameLength: "SHORT", matchTargetWins: 1, difficulty: "NORMAL" };

function errorKey(error: unknown): MessageKey {
  if (!(error instanceof RoomError)) return "rooms.network";
  const messages: Record<number, MessageKey> = { 401: "rooms.expired", 403: "rooms.denied", 404: "rooms.missing", 409: "rooms.conflict", 503: "rooms.unavailable" };
  return messages[error.status] ?? "rooms.error";
}

export default function RoomHub({ onBack }: { onBack: () => void }) {
  useLanguage();
  const initialId = roomIdFromInput(window.location.href);
  const [saved, setSaved] = useState(savedRoomAccess);
  const [access, setAccess] = useState<SavedRoomAccess | null>(() => savedRoomAccess().find(item => item.roomId === initialId) ?? null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const { preferences, updateRoomDisplay } = useSavedAppearance(room?.displayDefaults ?? undefined, access?.roomId);
  const preparedCardStyle = usePreparedCardStyle(preferences.visual.cardStyle);
  const [defaultPatch, setDefaultPatch] = useState<Partial<DisplayPreferences>>({});
  const displayDefaults = { ...displayPreferences(preferences), ...defaultPatch };
  const personalDisplayControls = access ? { value: displayPreferences(preferences), onChange: updateRoomDisplay } : null;
  const [name, setName] = useState(() => loadPlayerProfile().name || savedRoomAccess()[0]?.name || "");
  const [invite, setInvite] = useState(initialId ?? "");
  const [seat, setSeat] = useState("north");
  const [joinMode, setJoinMode] = useState(() => Boolean(initialId));
  const [busy, setBusy] = useState(false);
  const commandLock = useRef(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [retry, setRetry] = useState<RoomCommand | null>(null);
  const [copied, setCopied] = useState(false);
  const [rules, setRules] = useState(DEFAULT_ROOM_RULES);
  const ruleControls = { value: rules, onChange: (patch: Partial<MatchRules>) => setRules(current => ({ ...current, ...patch })) };
  const score = room?.snapshot.score;

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

  useEffect(() => {
    if (!score) return;
    setRules({
      gameLength: score.gameTargetPoints === 501 ? "SHORT" : "LONG",
      matchTargetWins: score.matchTargetWins === 5 ? 5 : score.matchTargetWins === 3 ? 3 : 1,
      difficulty: score.difficulty
    });
  }, [room?.roomId, score?.gameTargetPoints, score?.matchTargetWins, score?.difficulty]);

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
    try { enter(join ? await roomGateway.join(id!, name.trim(), seat) : await roomGateway.create(name.trim(), displayDefaults, rules)); }
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
  const locked = busy || retry !== null;
  const lobby = room?.snapshot.phase === "READY_TO_START";
  const invitationUrl = room ? invitation(room.roomId) : "";

  function backToRoomList() {
    setAccess(null); setRoom(null); setRetry(null); setError(null);
    setJoinMode(false); setInvite(""); setCopied(false); setStorageWarning(false);
    setRules(DEFAULT_ROOM_RULES); setDefaultPatch({});
    history.replaceState(null, "", "#rooms");
  }

  if (access && room && !lobby) {
    return <DisplaySettingsProvider value={personalDisplayControls}><CardStyleProvider value={preparedCardStyle}><RoomGameTable
      room={room}
      preferences={preferences}
      onDisplayChange={updateRoomDisplay}
      busy={busy}
      locked={locked}
      errorMessage={error ? t(error) : null}
      retry={retry}
      onAct={patch => { void act(patch); }}
      onRefresh={() => { void refresh(); }}
      onRoomList={backToRoomList}
      onRetry={() => { if (retry) void act({ action: retry.action }, retry); }}
    /></CardStyleProvider></DisplaySettingsProvider>;
  }

  return <DisplaySettingsProvider value={personalDisplayControls}><main className="rooms-page">
    <header className="rooms-header">
      <button type="button" onClick={access ? backToRoomList : onBack} disabled={busy}>← {t(access ? "rooms.list" : "home.back")}</button>
      <h1>{t(room ? "rooms.lobby" : "rooms.title")}</h1>
      <SettingsButton />
    </header>
    {!hasRoomServer && <p className="rooms-notice" role="status">{t("rooms.noServer")}</p>}
    {storageWarning && <p className="rooms-notice" role="status">{t("rooms.storage")}</p>}
    {error && <div className="rooms-notice" role="alert"><p>{t(error)}</p>
      {access && <button type="button" disabled={busy} onClick={() => void refresh()}>{t("rooms.refresh")}</button>}
    </div>}
    {retry && <button className="rooms-primary" disabled={busy} onClick={() => void act({ action: retry.action }, retry)}>{t("rooms.retry")}</button>}

    {!access ? <>
      <form className="rooms-entry-panel" aria-busy={busy} onSubmit={event => { event.preventDefault(); void connect(joinMode); }}>
        <label className="rooms-field">{t("rooms.name")}
          <input autoComplete="nickname" required maxLength={24} value={name} onChange={event => setName(event.target.value)} /></label>
        {!joinMode ? <div className="rooms-entry-grid">
          <button type="submit" className="rooms-choice-card rooms-choice-create" aria-label={t("rooms.create")} disabled={busy || !hasRoomServer}>
            <span className="rooms-choice-icon" aria-hidden="true">+</span>
            <span><strong>{t("rooms.create")}</strong><small>{t("rooms.shareWithFriends")}</small></span>
          </button>
          <button type="button" className="rooms-choice-card" aria-label={t("rooms.join")} disabled={!hasRoomServer || busy} onClick={() => { setJoinMode(true); setError(null); }}>
            <span className="rooms-choice-icon" aria-hidden="true">→</span>
            <span><strong>{t("rooms.join")}</strong><small>{t("rooms.invite")}</small></span>
          </button>
        </div> : <div className="rooms-join-form">
          <h2>{t("rooms.join")}</h2>
          <label className="rooms-field">{t("rooms.invite")}<input autoFocus autoCapitalize="none" spellCheck={false} required value={invite} onChange={event => setInvite(event.target.value)} /></label>
          <label className="rooms-field">{t("rooms.seat")}<select value={seat} onChange={event => setSeat(event.target.value)}>
            {(["north", "west", "east"] as const).map(value => <option key={value} value={value}>{t(`rooms.${value}`)}</option>)}</select></label>
          <div className="rooms-join-actions">
            <button type="button" className="rooms-back-link" disabled={busy} onClick={() => { setJoinMode(false); setError(null); }}>← {t("rooms.chooseAction")}</button>
            <button className="rooms-primary" disabled={busy || !hasRoomServer} type="submit">{t("rooms.join")}</button>
          </div>
        </div>}
        {!joinMode && <details className="rooms-defaults"><summary>{t("rooms.creationSettings")}</summary>
          <DisplaySettingsFields rules={ruleControls} value={displayDefaults} onChange={patch => setDefaultPatch(current => ({ ...current, ...patch }))} />
        </details>}
      </form>
      {saved.length > 0 && <section className="rooms-saved-menu" aria-labelledby="saved-rooms-title"><h2 id="saved-rooms-title">{t("rooms.mine")}</h2>
        <SavedGameList items={saved.map(item => ({ ...item, id: item.roomId }))} render={item => <>
          <span>{item.name} · {item.roomId.slice(0, 8)}</span>
          <button disabled={!hasRoomServer || busy} onClick={() => open(item)}>{t("rooms.open")}</button>
        </>} />
      </section>}
    </> : !room ? !error && <section className="rooms-panel"><p role="status">{t("rooms.connecting")}</p></section> : <>
      <section className="rooms-lobby-panel" aria-labelledby="room-players-title">
        <h2 id="room-players-title">{t("rooms.players")}</h2>
        <ul className="rooms-seats">{room.snapshot.players.map(player => <li key={player.id} className="rooms-seat">
          <strong>{player.name}{player.id === room.yourSeat ? ` · ${t("rooms.you")}` : ""}</strong>
          <small>{player.human ? player.team : t("rooms.bot")}</small>
        </li>)}</ul>
        <p>{t("rooms.bots")}</p>
        <label className="rooms-field" htmlFor="room-invite-link">{t("rooms.link")}</label>
        <div className="rooms-invite">
          <input id="room-invite-link" readOnly value={invitationUrl} onFocus={event => event.target.select()} />
          {navigator.clipboard && <button type="button" onClick={() => {
            void navigator.clipboard.writeText(invitationUrl).then(() => setCopied(true)).catch(() => {
              setCopied(false);
              const input = document.getElementById("room-invite-link") as HTMLInputElement | null;
              input?.focus();
              input?.select();
            });
          }}>{t(copied ? "rooms.copied" : "rooms.copy")}</button>}
        </div>
        {room.host && <details className="rooms-settings"><summary>{t("rooms.settings")}</summary>
          <form className="rooms-settings-fields" onSubmit={event => {
            event.preventDefault();
            void act({ action: "SETTINGS", ...rules });
          }}>
            <fieldset className="rooms-rules-fields" aria-label={t("rooms.settings")} disabled={locked}>
              <SetupOptions rules={ruleControls} />
            </fieldset>
            <button type="submit" disabled={locked}>{t("rooms.apply")}</button>
          </form>
        </details>}
        <div className="rooms-lobby-action">
          {pending?.type === "START_MATCH" ? <button className="rooms-primary" type="button" disabled={locked}
            onClick={() => void act({ action: "START" })}>{t("rooms.start")}</button>
            : <p role="status">{t("rooms.waitForHost")}</p>}
        </div>
      </section>
      {room.events.length > 0 && <details className="rooms-history"><summary>{t("rooms.history")}</summary>
        <ol className="rooms-log">{room.events.slice(-12).map(event => <li key={event.sequence}>{eventDescription(event)}</li>)}</ol>
      </details>}
    </>}
  </main></DisplaySettingsProvider>;
}

function requestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return crypto.randomUUID();
  // getRandomValues also works on trusted LAN HTTP origins without randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
