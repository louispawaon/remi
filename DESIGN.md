# Remi design system — Club Wall

Status: direction chosen and implemented 2026-10-29. Physical-device acceptance
pending. The full direction, exploration and content live in
[docs/superpowers/design/2026-10-29-remi-club-wall.md](docs/superpowers/design/2026-10-29-remi-club-wall.md);

The surface is **Operate**: a person opens Remi to hang one card quickly, on a
laptop at a desk or a phone in hand. The visual world is a **club wall**: one
saturated ultramarine room, black-mounted posters, butter type, and a hard
offset instead of a soft shadow. The poster is the object; the cobalt is the
room.

## Direction contract

- **THESIS.** Remi is a club wall: one saturated field with a poster for every
  thing you love, not a dashboard with a preview bolted on.
- **OWN-WORLD.** Ultramarine `#1B29CE`, butter ink `#F6EBC0`, black poster
  mounts `#0C0C0F`, Archivo Expanded caps, hard offsets, capsule controls.
- **STORY.** Find a cover, hang it, take the wall with you as one image.
- **FIRST VIEWPORT.** The poster wall owns the screen. The sheet map and tools
  are quiet rails; Export is a butter pill in the header on a phone.
- **FORM.** Club Wall, chosen by the user from the 2026-10-29 three-direction
  exploration (Sticker Club, Print Room, Club Wall).

## Palette

| Role        | Light     | Dark      | Use                                                    |
| ----------- | --------- | --------- | ------------------------------------------------------ |
| Ground      | `#1B29CE` | `#0B1268` | The room: page, panels, editor.                        |
| Ground deep | `#141FA8` | `#080D4E` | Filled selects, segmented tab track, pressed panels.   |
| Ink         | `#F6EBC0` | `#EFE4B6` | Every label, title, rule and glyph.                    |
| Ink 2       | `#C9C4A1` | `#BDB890` | Secondary text; measured ≥ 4.5:1 on the ground.        |
| Ink 3       | `#BDB89C` | `#8F93C4` | Placeholders, empty slot names, disabled.              |
| Rule        | `#5D64C9` | `#3A419E` | 1px dividers and inactive control outlines.            |
| Action      | `#F6EBC0` | `#EFE4B6` | The one primary action, active tab, selected slot tag. |
| On action   | `#1B29CE` | `#0B1268` | Type on butter.                                        |
| Card        | `#0C0C0F` | `#050507` | Poster mount and exported card ground.                 |
| Danger      | `#FFB4A2` | `#FFA892` | Save failure and delete confirmation only.             |

Butter is both ink and action; that is the colour-field rule. The accent is the
ground itself. Danger is the only second hue and only for a real failure.

Dark mode keeps the hue and deepens it. It is not an inversion: the mount gets
slightly deeper, the butter dims a step, and the ground stays cobalt.

## Type

One family, self-hosted in `static/fonts/`: **Archivo** (variable wght 100–900,
wdth 62–125) plus a static **Archivo Expanded** 800 cut. OFL; no network at
runtime.

- Display and screen titles: Expanded 800, uppercase, tracking −0.035em,
  leading 0.92. The poster voice.
- Card titles and headings: Expanded 800 at 18–40px.
- UI and body: Archivo 500–700 at 100% width.
- Metadata and slot codes: 11–13px, 600, tracking 0.08–0.14em, uppercase,
  tabular figures.
- No mono anywhere. Slot numbers are Archivo figures in a butter pill.

Scale: **44 / 34 / 28 / 22 / 18 / 15 / 13 / 11**. Seven steps. Display tracking
−0.035em; small labels +0.12em.

## Space, radius, depth

- Margins: 16 mobile, 32 desktop. Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 56.
- Radius: **0** for the poster and the wall; **capsule** for every control
  (tabs, buttons, chips, inputs, selects). Two radii only.
- Depth is a hard black offset: `6px 6px 0` on a poster mount, `3px 3px 0` on a
  primary action, `2px 2px 0` on a quiet sticker. No soft content shadows.
- The export slip is butter paper with cobalt type, square on desktop and
  28px-top-rounded on a phone with a grabber. It is the only light surface.
- Poster mounts use a 1.5px butter-at-22% edge; the black offset is the lip.

## Composition

### Desktop

Sticky header: wordmark, editable title, save state, Export. Workspace:
320px tool rail, the poster plate centred at up to 560px, 240px sheet map.
Footer: unplaced tray with Place pills and the exclusion note. The library is a
4-up wall of fixed 360px matted tiles (3 at 1200px, 2 at 900px, 1 on a phone),
each with its title, meta and action row. No card is enlarged; every title and
action row shares a baseline.

### Mobile

Header: wordmark, title, and a header Export pill. A populated card opens on
Arrange with a 200px live preview, one segmented tab capsule, then the control
rail. The Add tool compacts the preview to 120px so the search and two results
are visible. The full plate lives on the Preview tab. Nothing floats over the
content; the page scrolls.

## Components

- **Stamp** — butter capsule, cobalt caps, hard black offset. Primary action:
  Export, New sheet, Save PNG, Make the first sheet.
- **Ghost** — 1.5px butter outline, transparent. Secondary: Import project,
  Share, Upload, Export .remi.
- **Text action** — underlined butter label. Tertiary: Open, Rename, Duplicate,
  Delete, Cancel, Open image.
- **Chip / segment** — capsule, 1.5px rule; active is butter-filled cobalt.
- **Switch** — 46×26 capsule; on is butter-filled with a cobalt knob.
- **Field** — label above or left; filled `ground-deep` pill with a butter
  chevron for selects; search has a magnifier and a native clear ✕.
- **Poster mount** — black sheet, 1.5px butter/22 edge, 6px hard black offset.
- **Slot tag** — butter pill with a two-digit cobalt code; selected cell only.
- **Sheet map** — quiet 12px slot rows; selected code is a butter pill.
- **Tray** — unplaced items as capsule chips with a butter Place tag.
- **Export slip** — butter paper, cobalt type, rounded top on mobile, grabber;
  two choice rows, red-free warning bar, Save/Share, Open image row, project row.
- **State panel** — a plain-language title, one sentence, one butter action.

## Interaction rules

- Selecting a slot then a cell is the primary placement path; the same move is
  available through the sheet map, the mobile slot list and keyboard.
- Every control repaints the plate immediately; no Apply step.
- The selected cell gets a 2px butter inset ring and a butter slot tag.
- Saving shows a filled dot while writing and a butter dot when the
  IndexedDB transaction lands; errors turn the dot danger.
- Failed saves keep Export project available and name the consequence.
- Unplaced items stay visible and are explicitly excluded from PNG output.
- Format changes never move items; grid changes reflow in order; overflow stays
  in the tray.
- The signature is **the hang**: a new placement compresses the mount
  (10px → 4px → 6px), presses the sheet 1.5%, flashes a 10% butter wash and
  stamps the slot tag in 240ms, with a light haptic where the platform allows.
  Reduced motion keeps the tag only.

## States

Empty library, loading, searching (skeleton rows), provider unavailable (with
the credentials path), saving, save failed, conflict, export preparing, export
error, export ready. Every state is cobalt, butter and plain language.

## Responsive and accessibility

- Breakpoint 900px; below it the shell is mobile, not a squeezed desktop.
- Touch targets 44px (the header Export pill is 44px; mobile text actions 44px).
- Focus is a 2px butter outline offset 3px; never removed.
- Safe-area insets respected; the mobile header and export sheet clear the home
  indicator.
- No page-level horizontal overflow at 320, 390, 768, 1440 or 1920px.
- Reduced motion: no press, no wash; the tag appears.
- Butter on cobalt is ~8:1; ink-2 ~5.3:1; ink-3 ~4.7:1. Danger is used for
  failures, not decoration.
- Library thumbnails omit the title band; the label below carries the name.

## Voice

Plain, specific, short. "02 unplaced items excluded from this PNG." "TMDB isn't
answering. Movies and TV are paused. Your sheet, uploads and exports still
work." No exclamation marks, no fandom slang, no dashboard verbs.

## Assets and provenance

Fonts are OFL, self-hosted. Production imagery comes from AniList/TMDB or user
uploads. The comps used 26 AniList covers locally for judging the design; the working
folder is not tracked and the covers are not shipped in the app. Every shipped raster keeps
its source record.

## Open decisions

- Haptics: `navigator.vibrate` works on Android; iOS Safari ignores it.
- The mobile library is a 1-up poster feed; a 2-up with a `⋯` management menu is
  a possible follow-up if the scroll becomes the bigger cost.
- A bundled serif is still not shipped; the Style "Serif" face uses Georgia.
