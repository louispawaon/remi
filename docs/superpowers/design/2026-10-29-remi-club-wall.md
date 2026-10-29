# Remi — Direction: Club Wall

Status: direction chosen 2026-10-29 (user chose Club Wall from the three
explorations). This replaces the 2026-10-28 "Catalog" direction.

The working evidence (comps, screenshots, temporary covers) lived in a local
`design-pivot/` folder and is intentionally not tracked.

## Brief

- **What:** Remi is a local-first media card maker. Search anime, manga,
  manhwa, manhua, movies and TV; arrange the covers in a grid; export a PNG or
  an editable `.remi` project. Desktop and phone, no accounts.
- **Core action:** add a cover and hang it on the wall.
- **Feel:** loud, graphic, collectible. Chosen by the user from three explored
  worlds: Sticker club, Dark print room, Club Wall.
- **What exists:** working SvelteKit app, IndexedDB library, Canvas renderer,
  provider search. No brand assets beyond the wordmark. Current direction is
  newsprint + ink + one spot red + mono caps.
- **Needed:** new visual direction, comps, and a full implementation in the real
  app. Fonts may be bundled; the app stays offline-first.
- **Brief authorship:** feel, scope and font permission came from the user; the
  rest is self-authored from `PRODUCT.md` and the working app.

## Current app

The before screenshots were part of a local working folder and are not tracked.

It hits the skill's named overcorrection almost exactly: pale paper, near-black
ink, one red, mono 9–10px caps, hairline rules, zero radius, no shadows, no
imagery in the chrome. Specific defects:

- The page has no hero. The library title is hidden; the plate is 540px with a
  15px title above it. The eye lands on a 9px mono catalogue code.
- Type is flat: 9, 10, 11, 12, 13, 15px, mostly one weight. No display moment.
- Every action is an underlined mono cap, including four per library card.
- The card preview is a dark slab with a 1px border and no presence; selection
  is a 2px red inset line and a 9px red code.
- Mobile export bar covers the tool panel mid-page; the plate is above the
  tools, so the first screen is a preview with no visible action.
- The library cards are identical boxes; there is no featured sheet, no sense
  of a collection.
- Empty, loading and error states are centred grey text.

## Exploration — three directions

All three render the same core editor screen with 24 real AniList covers, a 5×5
grid, central free space and two unplaced items. The exploration was rendered
locally and is not tracked.

|               | **1. Sticker Club**                                                                   | **2. Print Room**                                                      | **3. Club Wall** (chosen)                                                          |
| ------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Concept       | "Remi is a sticker club: a sheet of die-cut media stickers you fill, peel and trade." | "Remi is a print room: each card is a proof lit on an ink-black wall." | "Remi is a club wall: one saturated field with a poster for every thing you love." |
| Source family | play / objects                                                                        | objects / materials                                                    | place / media                                                                      |
| Ground        | light (`#F4EAD8`)                                                                     | dark (`#151210`)                                                       | colour field (`#1D2BD6`)                                                           |
| Type          | Bricolage + Instrument Sans                                                           | New York + SF Pro                                                      | Archivo Expanded                                                                   |
| Richness      | die-cut sticker shape language + covers                                               | photographic covers + warm light                                       | saturated field + full-bleed covers                                                |
| Accent        | tomato `#F04E2F`                                                                      | vermilion `#E8502E`                                                    | butter `#F6EBC0` on cobalt                                                         |
| Scan          | no FAILs                                                                              | clean                                                                  | clean                                                                              |

**Chosen: Club Wall (user's call).** It is the one screen nobody would mistake
for a media dashboard or a card maker template. The cobalt is the room; the
poster is the object; the butter type is the label. It makes the covers the
hero at full scale and gives the app a point of view from across the room.

- **Sticker Club lost** as a pivot: charming and legible, but it is a warmer,
  rounder version of the same friendly-card-maker idea. It does not change the
  room, only the furniture.
- **Print Room lost** because it is the current Catalog direction with a better
  serif and the lights off. It repeats the editorial-dark rut.

## Category defaults refused

Media apps default to near-black or navy, violet or electric-lime accents,
glass cards, a floating tab bar and a dashboard of "recent" tiles. Card makers
default to a white canvas, a settings column and a preview on the right.

We refuse all of it. No violet, no lime, no glass, no dark dashboard, no
floating "+". Also refused: the skill's own newsprint overcorrection (the
current app) and the wellness cream + serif + terracotta default. This is a
**colour field**: ultramarine is the room, butter is the ink, black is the
poster mount. There is no neutral ground and no white card.

## Tokens

### Default (the wall)

| Role        | Value     | Use                                             |
| ----------- | --------- | ----------------------------------------------- |
| ground      | `#1B29CE` | The room. Whole page, panels, editor.           |
| ground-deep | `#141FA8` | A pressed panel, the area behind the sheet map. |
| ink         | `#F6EBC0` | Every label, title, rule and glyph (butter).    |
| ink-2       | `#C9C4A1` | Secondary text; still 4.5:1 on cobalt.          |
| ink-3       | `#979AC8` | Placeholders, disabled, empty slots.            |
| rule        | `#5D64C9` | 1px rules, chip outlines (ink at 34%).          |
| action      | `#F6EBC0` | Primary action, active tab, selected slot tab.  |
| on-action   | `#1B29CE` | Text on butter.                                 |
| card        | `#0C0C0F` | Poster mount and exported card ground.          |
| card-ink    | `#F6EBC0` | Exported card title and captions.               |
| print       | `#F6EBC0` | The export slip (paper) and its type.           |
| print-ink   | `#1B29CE` | Type inside the export slip.                    |
| danger      | `#FFB4A2` | Save failure, delete confirmation only.         |

Butter is both ink and action; that is allowed in a colour field. The accent is
the ground itself. Butter covers roughly 8% of a screen as solid fill (primary
button, active tab, selected number); the rest is type and 1px rules. Danger is
the only second hue and only for a real failure.

There are **no soft shadows**. Depth is a hard black offset: `6px 6px 0
#0C0C0F` on the poster mount, `3px 3px 0 #0C0C0F` on the primary action. Flat
everywhere else.

### Dark (`prefers-color-scheme: dark`, the late set)

| Role        | Value     |
| ----------- | --------- |
| ground      | `#0B1268` |
| ground-deep | `#080D4E` |
| ink         | `#EFE4B6` |
| ink-2       | `#BDB890` |
| ink-3       | `#7C80B4` |
| rule        | `#3A419E` |
| action      | `#EFE4B6` |
| on-action   | `#0B1268` |
| card        | `#050507` |
| danger      | `#FFA892` |

The hue survives; the lights go down. Not an inversion.

## Type

One family, self-hosted in `static/fonts/`: **Archivo** variable (wght 100–900,
wdth 62–125, OFL, downloaded from Google Fonts; no network at runtime).

- Display and screen titles: width **125%** (Expanded), weight **850**,
  uppercase, tracking **−0.035em**, leading 0.92. This is the poster voice.
- Card titles and section headings: width 112%, weight 800, uppercase at 18–22.
- UI and body: width **100%**, weight 500; buttons 700.
- Metadata, slot codes, counts: 11–13px, weight 600, tracking 0.08–0.14em,
  uppercase. `font-variant-numeric: tabular-nums`.
- **No mono.** Slot numbers are Archivo figures on a butter tag.

Scale: **44 / 34 / 28 / 22 / 18 / 15 / 13 / 11**. Seven steps, not eight.
Display tracking −0.035em; small caps +0.12em.

## Space, radius, depth

- Margins: 16 mobile, 32 desktop. Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 56.
- Radius: **0 for the poster and the wall**; **capsule** for every control
  (tabs, buttons, chips, inputs). Two radii, committed. No 12px in between.
- Poster mount: 1.5px butter/20% rule, hard black offset 6px. The sheet map and
  tool rail are flat on the wall, separated by 1px rules.
- The export slip is butter paper with cobalt type, 0 radius, hard black offset
  8px. It is the only light surface in the app.

## Richness and art direction

The covers are the imagery: provider artwork or uploads, unaltered, full-bleed
inside the black mount. No filter, no grade, no frame beyond the black mount.
The cobalt field supplies the colour; the covers supply the variety. The only
drawn asset is the app icon and the empty-state wall (flat, two colours).

## Signature — "the hang"

Trigger: adding a result, placing a poster, or dropping into a cell.
Storyboard:

1. 0ms — the new cover is already in the slot, but the poster mount is offset
   10px and the slot number tag is absent.
2. 70ms — the mount snaps to 4px, the whole sheet is pressed 1.5% toward the
   wall, and a butter wash at 10% flashes behind the grid for 90ms.
3. 160ms — the offset settles to 6px, the butter slot tag stamps in at 120%
   and drops to 100%.
4. 240ms — rest. Haptic: light impact at 70ms (`navigator.vibrate(8)`; iOS
   Safari ignores it).
   Reduced motion: no press, no wash; the tag appears instantly with the new
   cover. No information is lost.

## Content (written before layout)

**Library** — heading "Library"; count "05 sheets · 5 edited today"; New sheet.
Most recent: "Comfort watch, ranked" · 5×5 · 4:5 · 26 items · 2 waiting. Then
"Sunday shorts" · 4×4 · 4:5; "Manga shelf" · 5×5 · 3:4; "Winter, so far" · 4×4
· 9:16; "Films that wrecked me" · 3×3 · 1:1. The library thumbnail is the sheet
with its title band omitted; the label under the poster carries the name.
Actions: Open, Rename, Duplicate, Delete.
Empty: "No sheets yet." / "Make the first sheet" / "Or import a .remi project".

**Editor** — title "Comfort watch, ranked"; saved; Export in the header. Meta:
"26 items · 2 unplaced". Selected slot 06 "A Silent Voice". Grid 5, free space
on, shuffle placed. Tray: "Blue Period", "Chainsaw Man" — "Excluded from PNG".
Tabs: Preview, Add, Arrange, Style. On a phone the open tool keeps a compact
200px preview (120 on Add), the tab row is one segmented capsule, and Export is
a header pill rather than a bar over the content.

**Add** — category Anime; search "frieren"; results: Frieren: Beyond Journey's
End (2023, TV), Delicious in Dungeon (2024, TV), Mob Psycho 100 (2016, TV),
Vinland Saga (2019, TV). One result can show "Added Frieren: Beyond Journey's
End". Upload: "Upload image".

**Export** — "Comfort watch, ranked"; 4:5 · 5×5; Standard 1080 × 1350; 2×
2160 × 2700; "02 unplaced items excluded from this PNG."; Save PNG; Share; Open
image; Editable project / Export .remi.

**Errors:** "TMDB isn't answering. Movies and TV are paused. Your sheet,
uploads and exports still work." No exclamation marks.

## Implementation notes

- `src/app.css` is the single token and component source; no per-page colour
  literals except artwork.
- The Canvas renderer uses Archivo (loaded via `document.fonts.ready`) so the
  export matches the preview. Default exported card: black `#0C0C0F`, butter
  `#F6EBC0`, 5×5, 4:5, titles on.
- Existing cards keep their saved appearance; new cards get the Club Wall
  default. Turning titles off removes the heading band, so the grid grows into
  the space instead of leaving a black gap.
- Library thumbnails render with the title band omitted; the label under the
  poster is the sheet's name.
- Motion is CSS only: `@keyframes hang` and `@keyframes stamp`, honoured under
  `prefers-reduced-motion`.
- Keep all existing behaviours, test ids and copy that names a consequence.
- The 2026-10-29 design sheet and shipped screenshots were local working
  artifacts; they are intentionally not tracked.
