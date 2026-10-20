# Plan: maximize cards within the visible table

Status: the bottom status area is now one integrated table rail containing game identity, difficulty, targets, a trump emblem, and controls. The live current-move instruction sits directly beneath the Game history title, above the feeds. The remaining card-sizing optimization below is a proposal.

## Objective

Make hand cards and played cards as large as the available width and height allow, with no vertical collisions between cards, seats, scores, player information, controls, or viewport edges. Account for hover, selection, and animations. Preserve each deck's proportions and all game information.

Start with the two annotated header areas. Reclaimed header space belongs to the cards.

## Evidence and limits

The supplied annotation measures the match strip at about 47 CSS px and each team score panel at about 100 CSS px. The team panels share one row, so their heights are not added together.

The original inspection identified these restrictions:

- The match summary previously forced multiple rows below 420px/260px and added padding on taller screens. The footer relocation removes those rules and lets content wrap naturally.
- Team panels still use `grid-template-rows: 1fr auto`, 7px vertical padding, a 6px margin above `.data-list`, and stat tiles with `min-height: 44px`, stacked text, and 5px vertical padding. The relocation removes the short-desktop two-row span and its 28px bottom margin.
- `TableLayout.tsx` measures the trick guide to cap hand cards at 95% of table-card width, while hand height controls remaining trick height. The hand's column width also caps table cards. This forms a sizing feedback loop.
- `styles/table.css` adds fixed card caps, a 32px minimum trick width, a 560px minimum arena height, and several overlapping reserves for the trick and its points badge.
- Correction to the initial audit: `book.css` declares the named `table-arena` container. Retain that existing container and check the cascade across stylesheets; its declaration was missed in the first inspection.
- Cards have different height factors: Italian 2, German 1.56, four-color 1.392, heritage 1.4. Some table calculations currently fall back to 1.42 for heritage.

Initial preview attempts timed out. Preview inspection became available during implementation. The compact rail now places trump information on the upper left, game/difficulty/targets on the lower left, and two rows of controls on the right. The live move instruction has moved into Game history. At the annotated 600px viewport the rail is 61px high, reduced from about 90px. Checks covered 320px to 1920px widths in English, German, and Croatian; longer content can wrap naturally. The later card-sizing targets below still need implementation and verification.

## 1. Compact the annotated panels first

### Match strip

- Implemented placement: `ScoreBar` owns one continuous rail. Trump occupies the upper-left row; game, difficulty, and targets share the lower-left row. Controls remain in two rows on the right. The current instruction appears beneath the Game history title. The game title is a borderless text trigger for meld details. Landscape gives the rail the full table width. Keep match details out of the header and avoid adding nested field surfaces.
- Narrow tables below 420px of container width use a shallower arrangement: trump beside four controls in one row, with game/difficulty/targets using the full row below. This measures about 52px high instead of 61px for the checked English, German, and Croatian settings, with the same text and button sizes. Longer content can wrap naturally.
- Make the default summary one horizontal, wrapping-at-group-boundaries line: difficulty/game, target wins, target points, and the existing details affordance.
- Use concise localized wording. Retain the full description in the accessible label and keep the existing meld-details interaction.
- Remove unconditional stacking at 420px and 260px and the extra padding/9px gap on tall screens. Add a second line only when actual content cannot fit readably.
- Use content-sized height and small vertical padding. Do not stretch the match strip to match taller score panels.
- The implemented match summary is one inline text row, about 16px tall when it fits. Preserve its content-sized height; do not add a separate field or minimum-height strip around it.

### Team score panels

- Use content-sized rows with `align-content: start`; remove the flexible `1fr` heading track and vertical stretching that creates blank space.
- Set panel bottom padding to **0** and `.data-list` bottom margin to **0**. The last stat tile ends at the panel's bottom border, with no spacer row, minimum-height filler, or outside bottom margin.
- Remove the compact-desktop two-row span and 28px bottom margin if they leave unused space below the stats. Position the north seat in its own measured lane.
- Reduce heading-to-stats spacing to one explicit 2–3px gap; remove the additional 6px top margin.
- Replace 44px-minimum stat tiles with content-sized tiles. Prefer label/value inline when space permits; use a tight two-line tile when required. Scores remain legible and fully visible.
- Keep team names and captions compact, allowing necessary wrapping or an accessible way to reveal a full truncated name.
- Initial visual target: approximately 44–68 CSS px depending on width, wording, and team names. Never enforce the range by hiding text.

Verify this step independently before changing the card-sizing algorithm.

## 2. Establish one vertical budget

Use the actual table-stage width and visible viewport height, including safe-area insets. Prefer the dynamic viewport height with a stable fallback; update on viewport resize and orientation change.

For a stacked layout:

`available card height = visible table height − arena insets/borders − measured compact header − seat lane − player/status/control content − explicit gaps`

Measure fixed content, not containers whose height includes the cards being solved. Reserve only the space actually needed. Use CSS Grid for the structural lanes and `minmax(0, …)` where shrinkage is allowed.

The played-card footprint must include the four seat positions, selection/winner effects, and its own points-badge lane. Reserve the points lane even when the badge is hidden so each trick does not resize the cards. Remove negative badge offsets and account for each inset exactly once.

The hand footprint includes all rows, row gaps, selected-card lift/scale, and its player-information lane. Existing selection is `translateY(-8%) scale(1.05)` and cannot be ignored when checking clearance.

Remove the blanket 560px arena minimum from normal viewport-fit layouts. Define a deliberate compact fallback for genuinely unusable dimensions or enlarged text; allow scrolling there instead of clipping or forcing cards through other content.

## 3. Solve hand and table sizes together

Replace the guide-to-hand-to-guide loop with one deterministic calculation, ideally a pure `computeCardLayout` helper plus a small measurement hook.

Inputs: available stage bounds, fixed-content measurements, deck aspect ratio, explicit gaps, card effects, and candidate layout topology.

For each candidate, find the largest shared card scale that satisfies all width and height constraints. Start with the existing visual relationship of hand width = 0.95 × table-card width. The scale must fit the complete hand and four-card trick envelope together.

For a stacked arrangement, the core constraint is:

`hand envelope(scale) + trick envelope(scale) + required gap <= available card height`

Hand width also obeys `columns × card width + column gaps <= available hand width`. The trick must fit between the seat lanes and inside its allocated height. In a side-by-side arrangement each region must fit its own height independently.

After maximizing the shared scale, allow either card group to use remaining room if its growth does not shrink the other group or violate a clearance. A width-limited hand should not unnecessarily cap larger table cards. This makes the optimization explicit: maximize the smaller group first, then use safe remaining space.

- Derive trick offsets and both card dimensions from the same geometry and exact deck ratio.
- Replace arbitrary 52px/96px/120px caps with available-space limits for normal layouts.
- Never force the 32px minimum through a smaller available area; switch to the compact fallback first.
- Keep eight stable hand slots and a four-card trick envelope throughout the deal, including empty slots and an empty trick. Avoid card growth on every play.
- Observe stable layout inputs; batch resize updates in one animation frame. Recalculate after fonts, language, deck, and fixed-content changes. Round conservatively and avoid writing unchanged sizes.
- Choose a layout at resize/orientation/content changes, with a small tie threshold to prevent repeated topology switching.

## 4. Choose layouts by available space

### Phone portrait

Place the two team-score panels at the top, followed by one compact row of three opponent/partner seats, then the trick and hand. Keep match details with trump/current move in the footer.

Evaluate both 8×1 and 4×2 hand arrangements. A tall phone often benefits from 4×2; a short phone may get a better combined result from 8×1. Select the arrangement with the larger feasible shared scale rather than assuming the two-row hand is always better.

Keep status and controls compact, readable, and inside their own lane. Their touch targets must not extend over cards or neighboring controls.

### Desktop and tablet

Use opponents / north seat / your team in a shallow header when width permits. Keep west/east seats beside the trick. Use one eight-card hand row and a compact footer containing match details, trump, current move, and controls.

Base thresholds on actual table-stage width, including width lost to the history sidebar, and available height. Use a valid named ancestor for container queries. Short laptops should compact non-card content before shrinking cards; large screens should allow cards to grow beyond today's caps.

### Phone landscape and very short wide views

Compare the stacked arrangement with the trick on the left and a 4×2 hand on the right. Keep status/controls in a full-width footer below both regions and solve the regions together. Do not trigger this solely from orientation if the stacked candidate yields larger cards.

## 5. Consolidate ownership of layout rules

- `TableLayout.tsx`: stable measurements and one sizing update path; remove the current circular observer logic.
- New sizing helper/hook: candidate evaluation, precise deck ratios, constraints, fallback selection.
- `PlayerHand.tsx`: preserve stable slot order and expose the chosen column count without changing gameplay behavior.
- `MatchDataCard.tsx` / `GameDataCard.tsx`: compact markup only where needed; preserve semantics and localized content.
- `styles/table.css`: structural rows, card geometry, and explicit clearances.
- `styles/table-panels.css`: content-sized header and seat styling.
- Consolidate active arena overrides from `app.css`; repair stale named queries instead of adding another conflicting override block.

## 6. Validation and completion criteria

Test representative viewports: 320×568, 360×640, 390×844, 430×932; landscape 667×375 and 844×390; tablets 768×1024 and 1024×768; desktops 1280×720, 1366×768, 1440×900, and 1920×1080. Sweep around topology/container boundaries and resize the table with history visible.

Cover every card style, supported languages, long names, large scores, eight/one/zero cards, empty/full tricks, selection and hover, deal/entry/highlight/collection phases, visible points, errors, orientation changes, mobile browser-chrome height changes, and enlarged text. Modal overlays are intentional; test their own usable bounds separately.

Meaningful automated checks:

1. Pure sizing tests verify that every chosen candidate fits, taller decks consume the correct height, and increasing the winning shared scale by 1px violates at least one real constraint.
2. Browser geometry checks use transformed card bounds, not just layout boxes. A vertical intersection is a collision only where horizontal bounds intersect too; side seats can share a vertical range with the trick.
3. Check card faces/effects against seats, header, points badge, hand metadata, controls, and viewport edges, including representative animation frames. Any overlap within the existing four-card trick composition is intentional; surrounding UI must remain clear.
4. Confirm zero added space under each `.data-list` apart from its enclosing border, and no page scrolling across normal supported viewports.
5. Record actual before/after header heights and hand/table card dimensions. Check visual readability and interaction, not just numerical fit.

Run the frontend build and relevant tests after implementation. A plan-only change requires no application build or test run.

Implementation order: annotated panel compaction → stable height budget → joint sizing → responsive candidate selection → geometry/visual verification.
