import { useId, useRef, useState } from "react";
import { t } from "../i18n";
import { usePopupDialog } from "../lib/usePopupDialog";
import { PopupDialog, PopupCard, PopupContent, PopupActions } from "./GamePopup";

const chapters = ['welcome', 'rules', 'play', 'ai'] as const;
type Chapter = typeof chapters[number];
interface GuideProps { onClose: () => void; initialChapter?: Chapter }
export default function GuideBook(props: GuideProps) {
  const [chapter, setChapter] = useState<Chapter>(props.initialChapter ?? 'welcome');
  const dialogRef = usePopupDialog(true);
  const pageRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const paragraphs = {
    welcome: ['book.intro', 'book.saving'], rules: ['book.rulesIntro', 'book.deal', 'book.tricks', 'book.ranks', 'book.melds'],
    play: ['book.controls', 'book.exit'], ai: ['book.aiIntro', 'book.aiLevels']
  } as const;
  return <PopupDialog ref={dialogRef} layout="page" className="guide-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); props.onClose(); }}>
    <PopupCard className="guide-book">
      <header className="guide-heading"><div><h2 id={id}>{t('book.title')}</h2></div>
        <button type="button" className="table-square-button" onClick={props.onClose} aria-label={t('book.close')}>×</button>
      </header>
      <nav className="guide-chapters" aria-label={t('book.open')}>
        {chapters.map(value => <button type="button" key={value} aria-current={chapter === value ? 'page' : undefined} onClick={() => { setChapter(value); pageRef.current?.scrollTo(0, 0); }}>{t(`book.${value}`)}</button>)}
      </nav>
      <PopupContent ref={pageRef} className="guide-page" tabIndex={0} role="region" aria-label={t(`book.${chapter}`)}>
        <h3>{t(`book.${chapter}`)}</h3>
        {paragraphs[chapter].map(key => <p key={key}>{t(key)}</p>)}
      </PopupContent>
      <PopupActions><button type="button" className="action-button action-button-primary" onClick={props.onClose}>{t('Back to table')}</button></PopupActions>
    </PopupCard>
  </PopupDialog>;
}
