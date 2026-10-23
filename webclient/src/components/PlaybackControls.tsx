import { t } from "../i18n";
import { usePlayback } from "./PlaybackContext";

export default function PlaybackControls() {
  const { settings, onChange } = usePlayback();
  const fast = settings.speed === "fast";

  return (
    <div className="table-playback-controls" role="group" aria-label={t("playback.controls")}>
      <button type="button" className="table-square-button playback-toggle"
        aria-label={t("playback.skipAnimations")} aria-pressed={settings.skipAnimations}
        title={t(settings.skipAnimations ? "playback.animationsSkipped" : "playback.animationsOn")}
        onClick={() => onChange({ skipAnimations: !settings.skipAnimations })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="m10 8 5 4-5 4Z" />
          {settings.skipAnimations ? <path d="m3 21 18-18" /> : null}
        </svg>
      </button>
      <button type="button" className="table-square-button playback-toggle playback-speed"
        aria-label={t("playback.fastSpeed")} aria-pressed={fast}
        title={t(fast ? "playback.speedFast" : "playback.speedNormal")}
        onClick={() => onChange({ speed: fast ? "normal" : "fast" })}>
        <span aria-hidden="true">{fast ? "2×" : "1×"}</span>
      </button>
    </div>
  );
}
