# Remi v1 planning documents

Agreed on 2026-10-28. Status: Phases 0–6 (foundation, rendering, design, library, media discovery, editor, export resilience) complete; Phase 7 not started.

These documents preserve the plan agreed in the conversation. They describe intended behavior, not implemented capabilities or completed acceptance checks.

## Read in this order

1. [Product and architecture specification](specs/2026-10-28-remi-v1-design.md) — scope, stack, interfaces, data, rendering, mobile behavior, and exports.
2. [Implementation plan](plans/2026-10-28-remi-v1.md) — initialization through delivery, with independently testable phases and exit gates.
3. [Design direction](design/2026-10-29-remi-club-wall.md) — locked Club Wall world, tokens, content, and the three-direction exploration. The earlier [Catalog direction](design/2026-10-28-remi-direction.md) is superseded.
4. [Acceptance checklist](plans/2026-10-28-remi-v1-acceptance.md) — evidence required before calling v1 accepted.
5. [Audit fixes](plans/2026-10-29-audit-fixes.md) — nine verified findings, review follow-ups, and their verification record.

The specification owns product behavior and architectural decisions. The implementation plan owns sequencing. [DESIGN.md](../../../DESIGN.md) owns the visual system. The acceptance checklist owns verification. Update the affected documents together when a decision changes.

## Product intent

Remi is an anime-bingo-inspired media card maker. Function comes before aesthetics, while Impeccable provides a coherent, crafted interface rather than a plain or generic tool.

The eventual audience is public, without accounts. The current delivery target is a locally runnable SvelteKit application, including phone access on the same network. Public hosting is explicitly deferred.

## Confirmed decisions

- Svelte/SvelteKit with modern, purpose-specific libraries.
- A card maker with guided customization; no gameplay or progress tracking.
- Anime, manga, manhwa, manhua, movies, and TV, mixed within a card.
- Paginated search, provider-supported filters, and title-language preferences.
- A local library with creation, renaming, duplication, reopening, deletion, and autosaving.
- 3×3, 4×4, and 5×5 grids. Format changes preserve rows, columns, item positions, and free space.
- 4:5 portrait, 3:4 portrait, 9:16 story, and 1:1 square outputs.
- One shared Canvas renderer for preview and image generation.
- PNG files at 1080 px wide and 2160 px wide.
- Editable per-card project archives containing all selected artwork, including uploads and unplaced items.
- A preview-focused desktop workspace and mobile tool panels.
- Complete create–edit–export acceptance on both iPhone Safari and Android Chrome.

## Planner defaults

These implementation defaults were chosen within the agreed scope; they were not separate feature requests:

- New cards start at 5×5 and 4:5, with titles visible, English-preferred titles, and central free space enabled.
- Offer three curated font choices and one guided card template.
- Support custom raster uploads rather than arbitrary external image URLs.
- Export one editable card per project file.
- Use the stack versions, layout bounds, and file limits recorded in the specification.

## Explicitly deferred

Hosting, cloud storage, authentication, synchronization, public card links, list imports, gameplay, additional templates, freeform editing, offline application installation, JPEG/PDF/SVG exports, and bulk-library exports.

## Known risks and prerequisites

- Browser storage can be cleared or evicted. Portable project files are the durable backup.
- Small source artwork cannot gain detail from a 2× export.
- Live TMDB acceptance requires a user-provided token, kept server-side.
- Phone file-saving behavior requires physical-device validation. Emulation alone cannot close that acceptance gate.
- Native file sharing requires a secure context; LAN HTTP must support the documented saving fallback.
- Geometry checks passed all 12 grid/format combinations during planning. Artwork quality, typography, generated files, and real-device behavior remain unverified.

Phase 0 (project initialization) was completed on 2026-10-28. No deployment was performed.
