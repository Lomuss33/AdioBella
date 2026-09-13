import { useId, useRef, useState } from "react";
import { t, tr } from "../i18n";
import { usePopupDialog } from "../lib/usePopupDialog";
import type { VisualSettings } from "../lib/preferences";
import type { GameSettingsDrafts, PlayerNameDrafts, TeamNameDrafts } from "../types";
import AppearanceSettings from "./AppearanceSettings";

const chapters = ['welcome', 'rules', 'play', 'ai', 'customize'] as const;
type Chapter = typeof chapters[number];
interface GuideProps {
  onClose: () => void; activeMatch: boolean; saved: boolean;
  visual: VisualSettings; onVisualChange: (patch: Partial<VisualSettings>) => void;
  game: GameSettingsDrafts; onGameChange: (patch: Partial<GameSettingsDrafts>) => void;
  players: PlayerNameDrafts; teams: TeamNameDrafts;
  onPlayerChange: (seat: keyof PlayerNameDrafts, name: string) => void;
  onTeamChange: (team: keyof TeamNameDrafts, name: string) => void;
}
export default function GuideBook(props: GuideProps) {
  const [chapter, setChapter] = useState<Chapter>('welcome');
  const dialogRef = usePopupDialog(true);
  const pageRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const paragraphs = {
    welcome: ['book.intro', 'book.saving'], rules: ['book.rulesIntro', 'book.deal', 'book.tricks', 'book.ranks', 'book.melds'],
    play: ['book.controls', 'book.exit'], ai: ['book.aiIntro', 'book.aiLevels'], customize: []
  } as const;
  return <dialog ref={dialogRef} className="belot-dialog guide-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); props.onClose(); }}>
    <div className="popup-card guide-book">
      <header className="guide-heading"><div><span className="popup-eyebrow">BELOT</span><h2 id={id}>{t('book.title')}</h2></div>
        <button type="button" className="table-square-button" onClick={props.onClose} aria-label={t('book.close')}>×</button>
      </header>
      <nav className="guide-chapters" aria-label={t('book.open')}>
        {chapters.map(value => <button type="button" key={value} aria-current={chapter === value ? 'page' : undefined} onClick={() => { setChapter(value); pageRef.current?.scrollTo(0, 0); }}>{t(`book.${value}`)}</button>)}
      </nav>
      <div ref={pageRef} className="popup-content guide-page" tabIndex={0} role="region" aria-label={t(`book.${chapter}`)}>
        <h3>{t(`book.${chapter}`)}</h3>
        {paragraphs[chapter].map(key => <p key={key}>{t(key)}</p>)}
        {chapter === 'customize' && <>
          <p className="guide-save-status" role="status">{t(props.saved ? 'book.saved' : 'book.unsaved')}</p>
          <AppearanceSettings visual={props.visual} onChange={props.onVisualChange} />
          <div className="guide-settings-grid">
            <label><span>{t('table color')}</span><select value={props.game.tableTheme} onChange={event => props.onGameChange({ tableTheme: event.target.value as GameSettingsDrafts['tableTheme'] })}>
              {([['GREEN','green'],['DARK_BLUE','dark blue'],['CHERRY_RED','cherry red'],['WOODY_BROWN','woody brown'],['FINE_BLACK','fine black']] as const).map(([value,label]) => <option key={value} value={value}>{tr(label)}</option>)}
            </select></label>
          </div>
          {props.activeMatch && <p className="guide-next-match">{t('book.nextMatch')}</p>}
          <div className="guide-settings-grid">
            <label><span>{t('difficulty')}</span><select value={props.game.difficulty} onChange={event => props.onGameChange({ difficulty: event.target.value as GameSettingsDrafts['difficulty'] })}>{(['EASY','NORMAL','HARD'] as const).map(value => <option key={value} value={value}>{tr(value.toLowerCase())}</option>)}</select></label>
            <label><span>{t('match length')}</span><select value={props.game.matchTargetWins} onChange={event => props.onGameChange({ matchTargetWins: Number(event.target.value) as GameSettingsDrafts['matchTargetWins'] })}>{[1,3,5].map(value => <option key={value} value={value}>{t('firstTo', { count: value })}</option>)}</select></label>
            <label><span>{t('game length')}</span><select value={props.game.gameLength} onChange={event => props.onGameChange({ gameLength: event.target.value as GameSettingsDrafts['gameLength'] })}><option value="SHORT">{t('short 501')}</option><option value="LONG">{t('long 1001')}</option></select></label>
            {([['yourTeam','your team'],['enemyTeam','enemy team']] as const).map(([key,label]) => <label key={key}><span>{t(label)}</span><input maxLength={30} value={props.teams[key]} onChange={event => props.onTeamChange(key,event.target.value)} /></label>)}
            {([['SOUTH','you'],['NORTH','teammate'],['WEST','west'],['EAST','east']] as const).map(([key,label]) => <label key={key}><span>{t(label)}</span><input maxLength={24} value={props.players[key]} onChange={event => props.onPlayerChange(key,event.target.value)} /></label>)}
          </div>
        </>}
      </div>
      <footer className="popup-footer action-controls"><button type="button" className="action-button action-button-primary" onClick={props.onClose}>{t('Back to table')}</button></footer>
    </div>
  </dialog>;
}
