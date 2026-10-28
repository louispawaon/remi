# Remi design system — Catalog

Status: direction and comps approved 2026-10-28; production library and editor implemented; physical-device acceptance pending.

The surface is **Operate**: a person opens Remi to make one card quickly, on a laptop at a desk or
a phone in hand. The visual world is a convention catalog sheet: numbered artwork cells you circle,
catalog codes in the margin, and one spot colour reserved for selection. The card is the page.

Comps: [library](comps/desktop-library.png) · [desktop editor](comps/desktop-editor.png) ·
[mobile editor](comps/mobile-editor.png) · [export](comps/desktop-export.png) ·
[states](comps/desktop-states.png) · [mobile library](comps/mobile-library.png) ·
[mobile export](comps/mobile-export.png).

## Direction contract

- **THESIS.** The card is a convention catalog sheet — numbered artwork cells you circle — not a
  dashboard with a preview bolted on.
- **OWN-WORLD.** Newsprint, ink, and one spot red used only for selection, slot codes, and the save
  dot. Hairline rules, registration marks, mono catalog codes, untinted artwork.
- **STORY.** Find work, circle it, give it a slot; save and export read as sheet status.
- **FIRST VIEWPORT.** Card as the main plate, slot codes in the margin, Add/Arrange/Style index at
  left, Export stamped at the foot.
- **FORM.** Catalog — the roll's winning challenger, seed `7fa436db`.

## Palette

| Role        | Value           | Use                                                            |
| ----------- | --------------- | -------------------------------------------------------------- |
| Paper       | `#F1EEE4`       | Ground for every surface.                                      |
| Ink         | `#171512`       | Type, rules, primary fills. Never pure black.                  |
| Spot        | `#C23B22`       | Selection ring, slot code, save dot, destructive warning only. |
| Rule        | `#C9C2B2`       | 1px dividers; never decorative fills.                          |
| Muted       | `#6E675A`       | Metadata, hints, inactive tabs.                                |
| Panel       | `#EAE4D6`       | Active tab, skeletons, empty thumbnails.                       |
| Card ground | artwork-defined | Card tiles come from the renderer, not CSS.                    |

Spot red never becomes a background, a gradient, or an illustration colour. If it appears four times
on a screen, one of them is decoration and must go.

## Type

One grotesque across display, UI, and captions; mono for catalog codes, slot numbers, metadata, and
button labels.

- UI face: `"Helvetica Neue", Helvetica, Arial, sans-serif` — system-installed, offline-safe for a
  local-first app. Deliberately not a webfont; revisit only if a bundled face ships.
- Mono: `ui-monospace, "SF Mono", Menlo, monospace`.
- Scale: display 38–44px / -0.03em; screen title 15px / -0.01em; card title 56px at 1080 wide;
  body 12–13px; mono labels 9–11px / 0.12–0.24em uppercase.
- Numerals in slot maps and dimensions are tabular.

## Space and furniture

- 1px rules divide every region; no shadows, no rounded cards, no elevation.
- Registration marks (10px corner brackets) sit outside the plate corners.
- Page gutters 24px desktop, 16px mobile; section rhythm 16/24/40.
- Slot codes are two-digit tabular figures; the selected code turns spot red.
- Dotted newsprint grain is a 4px radial texture at ≤4% opacity; it must never reduce text contrast.

## Composition

### Desktop

Toolbar across the top: wordmark and sheet code left, card title centre-left, save state and Export
right. Below: 300px index column (Add, Arrange, Style), the plate centred at up to 540px wide, and a
220px sheet map listing every slot code and item. A tray footer carries unplaced items and the
"excluded from PNG" note.

### Mobile

Header (wordmark, title, save), plate at 300px, four tabs (Preview, Add, Arrange, Style), the active
panel below, and a pinned Export bar. Preview is always visible; Export is always one tap away.
Nothing requires dragging or hovering.

## Production surface

Routes: `/` library, `/editor/[id]` editor, `/credits`. Library and editor are client-rendered because
all data lives in IndexedDB.

- **Desktop editor:** sticky toolbar (wordmark/back, editable title, save state, Export), tool panel
  with Add/Arrange/Style tabs, centred plate with Fit/100% zoom, sheet map, unplaced tray footer.
- **Mobile editor:** same toolbar, plate at frame width, four tabs (Preview, Add, Arrange, Style), the
  active panel below, and a pinned Export bar. The sheet map and tray are desktop-only; Arrange carries
  the slot list and tray on mobile.
- **Add:** six category chips, visibly separate Search and Browse modes, year input, provider filters,
  title-language choice, paginated results, Add per result, and an upload path. Filter changes are
  provider-side; the panel never presents page-local filtering as catalog-wide.
- **Arrange:** grid chips, free-space switch, shuffle, selected-item Move / To tray / Remove, the full
  slot list, and the unplaced tray.
- **Style:** title visibility, four formats, three faces, background/ink presets plus native colour
  inputs, caption override, per-format crop sliders, image replacement, and removal.
- **Export:** native modal with standard/2× choice, prepared dimensions and size, unplaced-item
  warning, Save PNG, Share, Open image, and `.remi` project export.
- **Library:** thumbnails, open, inline rename, duplicate, two-step delete, New card, project import,
  empty/loading/error states. Mobile library becomes the comp's horizontal thumbnail row.
- **Saving:** status dot and text for saved/saving/unsaved/error/conflict; error and conflict banners
  offer retry, project export, and reload, and leaving with unsaved failures requires confirmation.
  Edits flush on visibility loss, page hide, and SPA navigation. Item removal is two-step.

Tool sections use tabs rather than the comp's stacked headings to make room for real search and
crop controls; the visual grammar, palette, typography, and plate composition are unchanged. The
export slip uses the native `<dialog>` element for focus trapping and Escape handling.

## Components

- **Stamp** — filled ink rectangle, mono caps, no radius. The commit action (Export, New card, Save
  PNG, Retry).
- **Ghost** — 1px ink outline, transparent. Secondary actions (Import project, Share, Enter token).
- **Text action** — underlined mono caps. Tertiary actions (Open, Rename, Duplicate, Cancel).
- **Chip / segment** — 1px rule, mono 9px; active is ink-filled. Grid, format, category.
- **Switch** — 30×16 outlined track with a square knob; no pill shapes.
- **Row** — label left, control right, 30px minimum height.
- **Slot map** — mono code + truncated title per row; selected row's code is spot red.
- **Tray** — unplaced items with 22×30 thumbnails and the exclusion note.
- **Export slip** — paper panel with mono header, two choice rows (Standard / 2×), red exclusion
  warning, Save and Share; Share stays a separate gesture. Desktop also offers Cancel.
- **State panel** — mono label, one plain-language title, one sentence of consequence, actions.

## Interaction rules

- Selecting a slot code and then a cell is the primary placement mechanism; the same move is
  available through list rows and keyboard.
- Every control repaints the plate immediately; there is no Apply step.
- The selected cell is ringed in spot red with its code attached inside the cell.
- Saving shows an ink dot while writing and the spot dot only when the IndexedDB transaction lands.
- Failed saves say what happened and keep Export project available.
- Unplaced items stay visible and are explicitly excluded from PNG output.
- Format changes never move items; grid changes reflow in order; overflow stays in the tray.

## States

Empty library, searching (skeleton rows), provider unavailable (with a credential path), saving,
save failed, export ready. All six are comped; error copy names the consequence and the way out.

## Responsive and accessibility

- Breakpoint at 900px; below it the desktop grid becomes the mobile shell, not a squeezed desktop.
- Touch targets are 44px on mobile for actions, chips, segments, switches, swatches, ranges, slot
  rows, and export choices; the mobile Export bar is 56px.
- Focus is a 2px spot outline offset 2px; never removed.
- Safe-area insets respected on the pinned bar; software keyboard must not cover the active field.
- No page-level horizontal overflow at 320, 390, 768, or 1440px.
- Reduced motion: no transforms; state changes are instant.
- Imported red on paper meets contrast for text; spot is never used for small text below 12px except
  codes on ink or paper at ≥4.5:1.

## Voice

Plain, specific, short. "02 unplaced items excluded from this PNG." "TMDB isn't answering. Movies and
TV are paused. Your card, uploads, and exports still work." No exclamation marks, no fandom slang, no
dashboard verbs.

## Assets and provenance

Every comp uses the Phase 1 fixture: synthetic gradient artwork generated in-browser, labelled as
synthetic. No third-party posters, logos, or stock images ship in these comps. Production imagery
comes from AniList/TMDB or user uploads; each shipped raster keeps its generation or source record.

## Open decisions

- Final UI face if a bundled grotesque is ever justified; today system Helvetica Neue wins on
  offline reliability.
- Grain strength at production scale (must be validated against text contrast).
- The sheet map is permanently visible on desktop and hidden on mobile; a drawer for 900–1200px is
  still open.
- Motion: one orchestrated transition for slot selection and export ready; nothing else.
- Provider artwork replacement currently goes through Remove + Add; an in-place provider picker is
  not built.

The Impeccable detector ran in degraded regex mode on the comp route: one warning, "overused font"
for Helvetica Neue, accepted for offline system availability and documented above. The detector did
not evaluate contrast or custom properties.
