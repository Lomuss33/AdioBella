# Casino color and material plan

[Documentation index](README.md) · [UI and UX plan](ui-ux-plan.md)

Status: implemented in source. Shared tokens now drive deep felt themes, smoked-glass panels and dialogs, neutral settings, restrained brass actions, warm paper cards, and muted terminal/results. The compact layouts and gameplay remain unchanged. This supersedes the earlier colorful palette. No tests, builds, or browser checks were run; visual appearance and contrast remain unverified under the user's no-testing instruction.

## Intended result

A quiet, realistic casino table: deep felt beneath warm ivory cards, smoked glass controls, and restrained antique brass details. Cards and the current decision should attract attention first. Scores remain easy to read; history and secondary controls recede.

Preserve the compact spacing, viewport-fit table, responsive card sizing, popup behavior, and gameplay. This is a color and material change, not another layout redesign.

## What needs fixing

- `app.css` defines theme backgrounds and older component colors, while `table.css` and `popups.css` introduce separate palettes. These layers need a shared source of truth.
- Team panels have large teal and rose fills; settings add sapphire, purple, pink, amber, and mint. Ordinary controls look as prominent as important actions.
- Colored gradients, bright selected pills, card outlines, and winner glows compound the visual noise.
- Existing translucent surfaces are inconsistent. Some read as solid colored boxes; others add decoration without a clear material role.

## Palette

These are starting values, not measured contrast results. Transparency must be judged against its composited background, not its raw color.

| Role | Proposed value | Use |
| --- | --- | --- |
| Room | `#080C0B` | Page background and deepest shadows |
| Felt center | `#183E32` | Default playing surface |
| Felt edge | `#0B211B` | Subtle table depth |
| Smoked glass | `rgb(14 20 18 / 82%)` | Scores, seats, terminal, secondary controls |
| Dialog glass | `rgb(14 20 18 / 94%)` | Popup surface; higher opacity for reading |
| Solid fallback | `#111A16` | Surfaces without backdrop filtering |
| Glass edge | `rgb(240 232 213 / 12%)` | Fine surface boundary where needed |
| Main text | `#EEE8DB` | Warm ivory labels and values |
| Secondary text | `#B2B9AF` | Supporting copy |
| Antique gold | `#B99A60` | Primary action, selection, small trim |
| Focus | `#E4C98E` | Clearly visible keyboard focus |
| Your team | `#9AAFA1` | Small sage marker and team label |
| Opponents | `#B7A0A0` | Small muted wine marker and team label |
| Success | `#A4BCA8` | Confirmed outcomes with explicit text |
| Warning | `#D0B078` | Warnings with an icon or label |
| Danger | `#D29C94` | Errors and destructive action labels |
| Card paper | `#FFF9EF` to `#EEE5D6` | Opaque warm card faces |
| Red / black suits | `#992D35` / `#19201D` | Traditional suit ink |

Most visible area should be dark felt and neutral glass. Color belongs in small indicators, readable labels, and the primary action rather than entire panel backgrounds. Separate sections with spacing, alignment, and subtle luminance changes.

## Material rules

1. Felt stays matte and opaque, with one broad, low-contrast lighting gradient. Optional fine texture must be barely visible and use CSS or an existing asset; no new decorative image is required.
2. Glass belongs to interface surfaces above the felt. Use translucent dark fill, a faint top highlight, and a soft shadow. Avoid a separate frame around every row or nested group.
3. Use modest backdrop blur only where a large surface benefits from it. Do not stack blur on a popup, its fields, and its buttons. The overlay dims the scene; the popup provides the glass treatment.
4. Give unsupported blur and reduced-transparency preferences a more opaque fallback. Text itself stays opaque. Mobile surfaces can use higher opacity and less blur.
5. Gold reads as brushed brass: restrained warmth, minimal gradient, no neon halo, glitter, or thick metallic frames.
6. Cards remain solid paper with crisp suit ink and a small physical shadow. They must not inherit glass transparency or team tint.

## Changes by area

| Area | Planned treatment |
| --- | --- |
| Page and table | Dark room, deep felt, subtle edge depth. Remove colored page glows and competing decorative gradients. Keep the central trick recognizably part of the same table. |
| Scores and match information | Shared neutral glass. Ivory numbers; team identity through a small marker and explicit label. Remove full teal/rose backgrounds and purple meld button. |
| Players and active turn | Quiet glass seats. Active player gets a fine gold edge and existing turn label. Keep team identity distinct from turn state. Dealer and trump badges use neutral surfaces and legible symbols. |
| Hand and trick cards | Warm opaque paper; deep red and near-black ink. Replace mint legal-card halos with a restrained warm edge. Selected cards also use existing position/shape cues. Avoid excessive dimming that obscures ranks on unavailable cards. |
| Setup | One smoked-glass dialog. Names and all setting groups share neutral input/button styling. Selected choices get a gold edge plus a check or pressed treatment; difficulty no longer has three unrelated colors. |
| Theme choices | Color appears in a small felt swatch only. Every theme button uses the same neutral control surface. |
| Trump, meld, and Bela prompts | Shared popup material and action hierarchy. Keep traditional suit colors and symbols. Remove suit-specific bright tiles and purple section fills. |
| Results | Neutral score breakdown, restrained gold winner marker, explicit winner labels. No large pink/green result blocks or persistent winner glow. |
| Quit and forfeit | Neutral cancel button; muted red label/edge for destructive action. Keep consequences and confirmation wording clear. |
| Terminal | Darker, quieter glass; readable ivory/muted text. Team markers match the table; gold identifies a winning result, with words distinguishing game and match outcomes. Remove multicolor event decoration. |
| Loading, empty, error, disabled | Consistent neutral baseline. Use semantic color only for meaningful status, always paired with text or an icon. |
| Browser chrome | Keep `App.tsx` theme-color values aligned with the page background for each theme. |

## Theme family

Retain existing saved theme IDs and settings. Themes change the room and felt, while controls, text, glass, card faces, and action semantics stay consistent.

| Existing theme | Felt center / edge | Character |
| --- | --- | --- |
| `GREEN` | `#183E32` / `#0B211B` | Classic bottle green, default |
| `DARK_BLUE` | `#1B2E40` / `#0C1823` | Deep midnight blue |
| `CHERRY_RED` | `#40232B` / `#210F16` | Burgundy, without bright cherry pink |
| `WOODY_BROWN` | `#3C3024` / `#201911` | Dark walnut tones, without orange glow |
| `FINE_BLACK` | `#252927` / `#111513` | Charcoal with visible surface depth |

## Implementation order

1. **Create shared tokens.** Add `webclient/src/styles/tokens.css`, imported before component styles. Own colors, material opacity, highlights, shadows, and theme variants here. Define tokens at the root so dialogs portaled to `document.body` inherit them too.
2. **Unify the foundation.** Replace theme and page colors in `app.css`; align browser chrome in `App.tsx`. Remove superseded color declarations in touched rules instead of appending another competing override block. Preserve layout properties.
3. **Recolor table and terminal.** Update `table.css` and relevant legacy rules to neutral glass, small team markers, and consistent turn/result semantics. Keep existing sizes and placement.
4. **Recolor every popup.** Update `popups.css` across setup, decisions, meld details, results, and confirmations. Remove per-setting and per-difficulty palettes. Use one shared primary, secondary, danger, selected, disabled, and focus treatment.
5. **Finish cards and edge states.** Update `playing-cards.css`, harmonize card backs, legal/selected/winning states, empty placeholders, errors, and any remaining inline colors. Limit component changes to visual state cues where necessary.
6. **Update documentation.** Mark this plan implemented only when the color pass is complete; update the current palette description in `ui-ux-plan.md`. Record validation as not performed under the standing no-testing instruction.

## Completion criteria

- All five themes, all popups, the table, cards, and terminal use the same material and semantic system.
- Primary actions are the strongest interface accent; cards remain the brightest physical objects.
- Team identity, active turn, selection, errors, and winners remain understandable without color alone.
- No arbitrary purple, cyan, mint, or pink section backgrounds remain; small theme swatches and traditional red suits are intentional exceptions to the neutral controls.
- No new spacing, card-size, scroll, focus, or game-rule behavior changes are introduced by this pass.
- Intended readability targets are 4.5:1 for normal text and 3:1 for large text and meaningful control boundaries; these must not be claimed as verified without later contrast review on composited surfaces.
- Browser/device appearance and accessibility validation remain explicitly unverified while the no-testing instruction applies.
