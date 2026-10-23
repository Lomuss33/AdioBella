# Scrolling and focus audit

Audited on 24 October 2026. Scope: the shared React UI, including the table,
history, setup, guide, declaration details, confirmations and language menu.
No game rules or transport behavior were changed by this audit.

## Interaction contract

- On the table, wheel and swipe gestures scroll the document, including over
  history content, headers and scrollbar tracks.
- Each history feed moves through its wide drag handle. The focused handle also
  supports arrows, Page Up/Down and Home/End. Modified browser shortcuts remain
  native. The feed content is not an extra, nonfunctional keyboard stop.
- Full-screen and floating popups lock the background. Their reading area uses
  native scrolling, while actions remain reachable. Inline trump and declaration
  choices stay in the document's normal focus and scrolling flow.
- A language menu fits the available viewport, flips when needed and can scroll
  if the available height cannot show all four choices.
- Native pinch zoom is preserved. Viewport fitting responds to keyboard-sized
  viewport changes without refitting the interface during pinch zoom.

## Findings and repairs

| Reproduced problem | Repair |
| --- | --- |
| Closing overlapping popups out of order could unlock the page while another popup remained open, then leave scrolling locked after the final close. | A shared, reference-counted root/body lock restores the original styles only after its final release. Gutter compensation is applied once. |
| The guide opened with focus still on the setup behind it. | Focus starts on the guide heading. Overlays isolate the app background, expose modal semantics and contain their tab sequence. Inline choices remain nonmodal. |
| Clicking popup triggers in WebKit did not reliably establish the return-focus target. | Triggers explicitly focus without scrolling before opening. Closing a popup restores its trigger without moving the page. |
| Declaration details focused their footer before the shared hook could capture the trigger. | Removed competing footer autofocus; the reading region receives initial focus and the shared lifecycle restores the trigger. Portaled details also isolate the app background. |
| History could jump from one result to another when a narrow view became wide. | Resize observation restores the same history entry and progress through a partially visible entry. Incoming events, language changes and collapsed/reopened history preserve the reading position. |
| Revealing the history's Latest control could change the header height during a drag. | Its space stays reserved; inactive controls are hidden and disabled. The scrollbar does not move when the control appears. |
| A language dropup near the top edge opened mostly outside the viewport. | Placement measures available space, flips sides and constrains height and horizontal position. Resize/scroll updates are coalesced into animation frames. |
| Feed content intercepted navigation keys and middle-button gestures even though it was not an independently navigable control. | Removed the redundant tab stop and cancellation handlers. Keyboard operation belongs to the scrollbar; page navigation remains native elsewhere. |

## Validation

Browser checks used the actual components in isolated React fixtures, alongside
live setup and guide flows. The app is unmounted before synthetic history and
popup fixtures, preventing game timers from interfering with the checks.

| Check | Coverage |
| --- | --- |
| Page wheel routing and independent history dragging | Chromium, Firefox and Playwright WebKit; 320×740, 430×900, 844×390, 1280×900, 1440×700 and 1920×1080. Both feeds, headers, tracks and handles. |
| Touch gestures | Chromium touch emulation at 390×844: content/header/track swipes scroll the document; dragging either handle scrolls only that feed. |
| Setup and guide keyboard access | 320×420, 844×390 and 1280×900. Focus remains visible above setup's floating actions; guide content supports wheel and Page Down; Tab stays inside the overlay and Escape restores its trigger. |
| Popup lifecycle | Nested popups closing out of order retain the lock, focused overlay and page position. Original overflow, padding and gutter values return after the final close. |
| History continuity | Narrow/wide resizing, incoming events, language changes, disclosure collapse/reopen and direct scrollbar keyboard navigation. |
| Language menu boundaries | Anchors near the top, bottom and horizontal viewport edges; constrained height and flipping. |
| Unit regression checks | Shared locks, overlay/portal focus and background isolation, inline choices, simulated keyboard viewport changes, preserved pinch zoom, history anchoring and scrollbar keyboard/pointer behavior. |

Run the required frontend checks from the repository root:

```powershell
npm --prefix webclient test
npm --prefix webclient run build
git diff --check
```

The browser matrix uses installed Windows engines. Playwright WebKit is not a
physical iPhone or a certification of Safari behavior. Real iOS/Android keyboard,
browser-toolbar and rubber-band behavior, and assistive-technology announcements,
still need device and screen-reader checks. Viewport/zoom lifecycle cases are
additionally covered by unit tests.

## Standards used

Overlay focus entry, return, tab containment and background isolation follow the
[WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
Custom history handles expose the controlled region, value and orientation and
provide keyboard operation, as described by the
[WAI-ARIA scrollbar role](https://www.w3.org/TR/wai-aria-1.2/#scrollbar).

History uses hidden overflow for programmatic/handle scrolling and allows scroll
chaining to the document. Popup boundaries contain chaining using CSS, rather
than global wheel/touch cancellation. These choices follow the browser behavior
documented for [overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow)
and [overscroll behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overscroll-behavior).
Keyboard viewport fitting and pinch zoom use the distinction between layout and
visual viewports described by the
[VisualViewport API](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).

## Implementation owners

- [Shared popup lifecycle](../webclient/src/lib/usePopupDialog.ts) and
  [page scroll locks](../webclient/src/lib/pageScrollLock.ts).
- [History continuity](../webclient/src/components/TerminalLog.tsx),
  [drag handles](../webclient/src/components/HistoryScrollbar.tsx) and
  [history styles](../webclient/src/styles/terminal.css).
- [Anchored menu placement](../webclient/src/lib/useMenuPosition.ts) and
  [language selector](../webclient/src/components/LanguageSelect.tsx).
