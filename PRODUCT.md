# Remi — product requirements

Remi is a media card maker: search anime, manga, manhwa, manhua, movies, TV, games,
songs, and albums, arrange them into a customizable grid, and export the result as a PNG
or a complete editable project. It runs locally, works on phones on the same network, and
needs no accounts.

The binding specification is [docs/superpowers/specs/2026-10-28-remi-v1-design.md](docs/superpowers/specs/2026-10-28-remi-v1-design.md).
This file is the short brief for implementation work; if they disagree, the specification wins.

## Included

- Eight categories mixed within one card, with paginated search, provider filters, and
  title-language preference. Music is one category covering songs and albums; Games is
  one category covering every platform.
- A local library: create, rename, duplicate, reopen, delete, autosave.
- Guided editing: titles, colors, three curated fonts, image replacement, crop position,
  reorder, shuffle.
- 3×3, 4×4, and 5×5 grids; optional central free space on odd grids.
- 4:5, 3:4, 9:16, and 1:1 formats; standard and 2× PNG export.
- Editable `.remi` ZIP projects containing all artwork, including uploads and unplaced items.
- Full mobile workflows on iPhone Safari and Android Chrome.

## Excluded

Gameplay, progress tracking, accounts, cloud sync, public card links, list imports,
freeform design, extra templates, offline installation, JPEG/PDF/SVG export,
bulk-library export, public hosting.

## Defaults

New cards: 5×5, 4:5, titles visible, English-preferred titles, central free space on.
One template, three curated fonts, custom raster uploads only.

## Limits

- Uploads: PNG/JPEG/WebP, 10 MiB and 24 megapixels; stored at max 1600 px long edge.
- Stored artwork: 8 MiB per asset, 40 MiB per card, 100 items per card.
- Project archives: 64 MiB compressed and expanded, 102 entries, 1 MiB manifest.
- Output: 1080 px wide, or 2160 px at 2×.

## Fixed constraints

- One Canvas renderer for preview and PNG; export dimensions independent of viewport.
- Everything editable without dragging or hovering.
- Credentials stay server-side; uploaded artwork and saved cards stay on the device.
- Never silently discard overflow items, overwrite cards, or claim a failed save/export succeeded.
