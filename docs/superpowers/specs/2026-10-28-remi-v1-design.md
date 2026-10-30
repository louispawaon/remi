# Remi v1 product and architecture specification

Date: 2026-10-28. Status: agreed plan; not implemented.

See the [planning index](../README.md), [implementation plan](../plans/2026-10-28-remi-v1.md), and [acceptance checklist](../plans/2026-10-28-remi-v1-acceptance.md).

## Intent and scope

Build a mobile-capable media card maker using SvelteKit. Users search for media, arrange and customize cards, save multiple cards locally, and export finished images and complete editable projects.

The delivery target is local desktop operation and phone access on the same network. The eventual audience is public without accounts; hosting is deferred.

### Included

- Anime, manga, manhwa, manhua, movies, TV, games, and music (songs and albums), mixed
  within one card.
- Paginated search, supported filters, and title-language preferences.
- Local card creation, renaming, duplication, reopening, deletion, and autosave.
- Guided editing: titles, colors, curated fonts, image replacement, crop positioning, reordering, and shuffling.
- 3×3, 4×4, and 5×5 grids; optional central free space on odd grids.
- 4:5, 3:4, 9:16, and 1:1 output formats.
- Standard and 2× PNG export.
- Editable project files containing settings and all selected artwork, including uploads and unplaced items.
- Full mobile workflows on iPhone Safari and Android Chrome.

### Excluded

Gameplay, progress tracking, accounts, cloud synchronization, public card links, list imports, freeform design tools, additional templates, offline application installation, JPEG/PDF/SVG exports, bulk-library exports, and public hosting.

## Architecture and stack

Use the compatible baselines verified during planning, locking resolved versions during initialization:

- SvelteKit 3.1, Svelte 5, TypeScript 6, Vite 8, and Node 24.
- SvelteKit's Node adapter for the locally built application.
- Bits UI for accessible dialogs, tabs, menus, and other complex controls.
- idb for IndexedDB access.
- fflate for ZIP project files.
- Valibot for imported files and API-input validation.
- Vitest, Playwright, and axe for focused automated verification.

Use Svelte's built-in reactivity, scoped CSS, and CSS custom properties. Use native controls where they suit simple inputs. Do not add a separate state framework, backend database, canvas editor framework, or DOM screenshot library.

Follow SvelteKit 3's Vite-based configuration and current project structure rather than older SvelteKit examples. The existing Node 24 environment is compatible with this baseline.

### Application boundaries

- **Library:** locally saved cards and project import.
- **Editor:** preview, media selection, arrangement, styling, and export.
- **Credits/help:** provider attribution, local-storage behavior, and backup instructions.
- **Browser:** owns documents, uploaded artwork, saving, rendering, and file generation.
- **SvelteKit server:** handles provider requests and approved image retrieval.

TMDB credentials stay in server-only environment variables. Uploaded files and saved cards stay on the user's device.

### Approaches considered

- **Selected: shared browser Canvas renderer.** Preview and PNG use the same drawing and layout implementation, giving explicit dimensions and consistent composition. Text layout must be handled deliberately.
- **Alternative: HTML/CSS preview with image capture.** Easier CSS styling, with more browser-specific differences to verify between preview and exported image.
- **Selected: complete portable archives.** Larger files, but restoring a card does not depend on original image URLs.
- **Alternative: embedded uploads with linked provider posters.** Smaller files, but restoring posters depends on provider availability.
- **Selected for local delivery: Node adapter.** Cloudflare, Vercel, and other hosting choices are deferred rather than assumed.

## Document and storage contracts

- **CardDocument, schema version 1:** identity, title, grid size, active format, appearance, items, slot assignments, and crop settings.
- **CardItem:** stable identity, source identity, title alternatives, title override, artwork reference, and per-format crop position.
- **CardRecord:** the document plus its artwork Blobs, saved atomically in IndexedDB.
- **CardLayout:** calculated heading, footer, grid, cell, and caption bounds shared by preview and export.

Store each complete card record together. Avoid global artwork reference counting in v1.

### Editing invariants

- Changing format never changes item positions or capacity.
- Changing grid size reflows items in their existing order.
- Items that no longer fit remain in a visible unplaced-items tray.
- Removing an item leaves an empty slot.
- Enabling a free space preserves any displaced item in the unplaced tray.
- Duplicating a card creates an independently editable copy.
- Importing a project creates a new card and never overwrites an existing card.
- A second tab cannot silently overwrite a newer saved revision.

Show Saving, Saved, and save failures accurately. Saved means the IndexedDB transaction completed. Failed saves retain the working document in memory and leave project export available.

## Media integration

### Server interfaces

- **GET /api/media/search:** validated category, search/browse mode, supported filters, and page; returns normalized results and the next page.
- **GET /api/media/options:** available filters for the selected category.
- **GET /api/media/image:** artwork retrieval from approved provider CDN paths.

The image interface accepts provider identifiers and validated paths, not arbitrary URLs. Enforce upstream timeouts, response-size limits, raster-image validation, and redirect restrictions.

### Provider behavior

- AniList supplies anime and manga-origin categories. One unfiltered manga query covers manga, manhwa, and manhua; country filters hid matches.
- TMDB supplies movies and TV. Do not promise perfect cross-provider classification or deduplication.
- Deezer supplies music. One search covers songs and albums, needs no credential, and supports no year or genre filter.
- TheGamesDB supplies games across platforms. It needs a server-side public API key and supports no year or genre filter.
- AniList supports combinations of title, year, genre, format, and status where applicable.
- TMDB title search supports title and year.
- Search is title-first; supported filters are applied by the provider, never to the current result page.

Debounce search, cancel stale requests, cache bounded results briefly, and respect upstream rate-limit responses. Distinguish unavailable credentials, provider outages, and retryable limits.

Missing TMDB or TheGamesDB credentials disable movie/TV or game discovery with a setup explanation; the rest of the editor remains usable. Music needs no credential. Include the required TMDB, TheGamesDB, and Deezer attribution in Credits.

## Artwork handling

Fetch and store selected provider artwork when an item is added. Persist image bytes rather than temporary object URLs.

### Initial limits

- Accept PNG, JPEG, and WebP uploads, up to 10 MiB and 24 megapixels.
- Normalize stored artwork to a maximum 1600 px long edge, preserving proportions, orientation, and transparency.
- Maximum stored asset: 8 MiB.
- Maximum card artwork total: 40 MiB.
- Maximum selected and unplaced items per card: 100.

Reject unsupported or oversized files before committing the change and show an actionable error.

Use intentional text-only tiles when a provider has no poster. A referenced image that fails to load is an error, not an acceptable blank export.

## Layout and rendering

Use one Canvas drawing implementation for preview and PNG generation. Keep editing controls and the complete item list in accessible HTML.

### Output dimensions

- 4:5: 1080 × 1350; 2×: 2160 × 2700.
- 3:4: 1080 × 1440; 2×: 2160 × 2880.
- 9:16: 1080 × 1920; 2×: 2160 × 3840.
- 1:1: 1080 × 1080; 2×: 2160 × 2160.

The 2× option doubles both dimensions without changing the composition.

### Initial geometry, at standard resolution

- Horizontal margins: 48 px; cell gaps: 12 px.
- Heading reserve: 112 px; footer reserve: 32 px.
- Ordinary vertical margins: 48 px.
- Story vertical reserves: 160 px above and 240 px below. These are design reserves, not a guarantee against every platform overlay.
- Cell width/height ratio: bounded between 0.72 and 1.15.
- Fit and center the complete grid inside the remaining area.

The planning geometry probe passed all 12 grid/format combinations. Real artwork and typography remain subject to visual acceptance.

### Rendering invariants

- Crop artwork to fill cells without stretching it.
- Save crop positions separately for each format.
- Bound captions to two lines with visible ellipsis.
- Expose complete titles in the HTML editor.
- Load selected fonts before text measurement or rendering.
- Preserve blank cells deliberately.
- Preview zoom changes viewing scale only.
- Export dimensions never depend on viewport size or device pixel ratio.

## UX and Impeccable design contract

Apply Impeccable in Operate mode. Function leads the design, with coherent typography, hierarchy, controls, and feedback rather than a plain or generic tool.

### Fixed interaction structure

- Desktop: toolbar, tool panel, and a large persistent preview.
- Tool sections: Add, Arrange, and Style.
- Mobile: Preview, Add, Arrange, and Style navigation, with Export consistently reachable.
- Keep the library separate from the editor.
- All editing operations must work without dragging or hovering.

The visual brief is an artwork-led media workspace with restrained controls, clear hierarchy, deliberate typography, and recognizable selection and save states.

Complete the Impeccable direction and desktop/mobile comp selection before production UI work. Evaluate populated 5×5 cards and long titles, not only sparse ideal states. The selected direction must cover the library, desktop editor, mobile editor, export flow, and important loading/error states.

Preserve accessible labels and keyboard focus, touch targets of at least 44 × 44 px, mobile keyboard usability, safe areas, reduced motion, and 200% zoom. Avoid page-level horizontal overflow.

## Export contracts

### PNG workflow

1. Freeze the current document into an export snapshot.
2. Load its fonts and artwork.
3. Render the exact selected dimensions.
4. Prepare the PNG Blob.
5. Present Save and supported Share actions.

Use a separate user action for sharing the prepared file to preserve mobile activation requirements. Provide download and open-image fallbacks. Canceling the share sheet is not an error.

An export must not claim success with missing images. Identify unplaced items visibly as excluded from the PNG.

### Editable project workflow

Use a .remi ZIP containing a versioned JSON manifest and all artwork required by placed and unplaced items. Include titles, arrangement, appearance, source metadata, and per-format crops.

Exclude credentials, temporary URLs, and machine-specific paths.

Validate the complete project before saving it. Reject unsupported schema versions, missing artwork, duplicate or unsafe archive paths, malformed data, and decompression-limit violations.

Initial archive limits:

- 64 MiB compressed and expanded.
- 102 entries.
- 1 MiB manifest.

Enforce limits while unpacking. A restored project must remain editable and exportable without contacting either media provider.

## Defaults and limitations

New cards start at 5×5, 4:5, with titles visible, English-preferred titles, and central free space enabled. Offer three curated font choices and one template. Support custom uploads rather than arbitrary external image URLs. Export one editable card per project file.

Browser storage can be cleared or evicted; portable project files are the durable backup. Low-resolution artwork does not gain detail at 2×. Physical-device checks remain necessary for mobile acceptance. Live TMDB checks require a user-provided server-side token.

## Research references

- [Original anime-bingo source inspected at af60e36](https://github.com/walfie/anime-bingo/tree/af60e362f0b8e40aa8381ae6b653208d2d6d33f3/src)
- [SvelteKit 3 migration guidance](https://svelte.dev/docs/kit/migrating-to-sveltekit-3)
- [Svelte CLI project creation](https://svelte.dev/docs/cli/sv-create)
- [SvelteKit Node adapter](https://svelte.dev/docs/kit/adapter-node)
- [Bits UI](https://www.bits-ui.com/docs/introduction)
- [idb](https://github.com/jakearchibald/idb)
- [fflate](https://github.com/101arrowz/fflate)
- [AniList rate limiting](https://github.com/AniList/docs/blob/master/docs/guide/rate-limiting.md)
- [TMDB requirements and attribution](https://developer.themoviedb.org/docs/faq)
- [TMDB movie search](https://developer.themoviedb.org/reference/search-movie)
- [TMDB movie discovery](https://developer.themoviedb.org/reference/discover-movie)
- [TMDB TV discovery](https://developer.themoviedb.org/reference/discover-tv)
- [Canvas image files](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)
- [Web Share behavior](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API)
