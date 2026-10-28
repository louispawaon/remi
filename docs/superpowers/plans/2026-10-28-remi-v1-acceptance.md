# Remi v1 acceptance checklist

Date: 2026-10-28. Status: not run; Phase 0 foundation complete.

This checklist defines acceptance, not completed verification. Leave an item unchecked until its required evidence exists. Record the tested commit, environment, and evidence when executing it.

References: [specification](../specs/2026-10-28-remi-v1-design.md), [implementation plan](2026-10-28-remi-v1.md), and [planning index](../README.md).

## Evidence record

- Tested commit: not recorded.
- Test date: not recorded.
- Runtime and dependency versions: not recorded.
- Desktop browser versions: not recorded.
- iPhone model, iOS version, and Safari version: not recorded.
- Android model, OS version, and Chrome version: not recorded.
- Commands, test results, generated-file checks, and screenshot locations: not recorded.
- Pending or waived checks and their impact: not recorded.

## Installation and application health

- [ ] A fresh checkout installs using npm ci and the documented setup steps.
- [ ] Development mode works locally.
- [ ] The built Node server works locally, including environment-variable loading.
- [ ] The documented LAN workflow permits testing from phones on the same network.
- [ ] Type checking passes.
- [ ] Linting passes.
- [ ] Unit tests pass.
- [ ] Browser tests pass.
- [ ] The production build passes.
- [ ] Missing TMDB credentials do not crash or block the rest of the application.

## Editing and layout

- [ ] 3×3, 4×4, and 5×5 grids work in all four formats.
- [ ] Switching formats preserves item identities, positions, free space, and saved crops.
- [ ] Shrinking and expanding a grid preserves overflow items.
- [ ] Enabling a free space preserves a displaced item.
- [ ] Blank cells and text-only items render intentionally.
- [ ] Long Latin, Japanese, Chinese, and Korean titles cannot overlap neighboring cells.
- [ ] Full titles remain accessible in the HTML editor when image captions are truncated.
- [ ] Reordering, replacement, and crop adjustments work without drag gestures.
- [ ] Shuffle preserves the selected items and free-space behavior.
- [ ] Preview and export show the same arrangement and crop.
- [ ] Preview zoom does not modify document layout or export dimensions.

## Saving and restoration

- [ ] Saved cards survive refresh.
- [ ] Duplicating a card creates an independently editable copy.
- [ ] Deleting one card does not alter another card.
- [ ] Saved appears only after the IndexedDB transaction completes.
- [ ] Save failures never display Saved and retain dirty work in memory.
- [ ] Project export remains available after a storage failure.
- [ ] Conflicting tabs cannot silently overwrite newer work.
- [ ] Grid changes and free-space changes do not discard selected artwork.
- [ ] Import creates a new card without overwriting an existing one.
- [ ] Invalid or oversized imports leave the existing library untouched.
- [ ] A project restores in a separate browser with provider requests blocked.
- [ ] Restoration preserves uploads, unplaced artwork, titles, styles, arrangement, and every format's crops.
- [ ] The restored project remains editable and can produce a new PNG without provider access.

## PNG export matrix

Run all 24 combinations: 3 grid sizes × 4 formats × 2 resolutions. For each listed case, decode the actual PNG and verify dimensions, expected artwork/text, crop, and composition parity with the preview.

### 3×3

- [ ] 4:5 standard — 1080 × 1350.
- [ ] 4:5 2× — 2160 × 2700.
- [ ] 3:4 standard — 1080 × 1440.
- [ ] 3:4 2× — 2160 × 2880.
- [ ] 9:16 standard — 1080 × 1920.
- [ ] 9:16 2× — 2160 × 3840.
- [ ] 1:1 standard — 1080 × 1080.
- [ ] 1:1 2× — 2160 × 2160.

### 4×4

- [ ] 4:5 standard — 1080 × 1350.
- [ ] 4:5 2× — 2160 × 2700.
- [ ] 3:4 standard — 1080 × 1440.
- [ ] 3:4 2× — 2160 × 2880.
- [ ] 9:16 standard — 1080 × 1920.
- [ ] 9:16 2× — 2160 × 3840.
- [ ] 1:1 standard — 1080 × 1080.
- [ ] 1:1 2× — 2160 × 2160.

### 5×5

- [ ] 4:5 standard — 1080 × 1350.
- [ ] 4:5 2× — 2160 × 2700.
- [ ] 3:4 standard — 1080 × 1440.
- [ ] 3:4 2× — 2160 × 2880.
- [ ] 9:16 standard — 1080 × 1920.
- [ ] 9:16 2× — 2160 × 3840.
- [ ] 1:1 standard — 1080 × 1080.
- [ ] 1:1 2× — 2160 × 2160.

## Export correctness and resilience

- [ ] The 2× export preserves the standard export's composition.
- [ ] Export dimensions are independent of viewport and device pixel ratio.
- [ ] Generated files contain the expected artwork, text, and transparency.
- [ ] Fonts and images finish loading before file actions become available.
- [ ] Missing referenced assets fail visibly rather than producing a successful blank-poster export.
- [ ] The exported document is the frozen snapshot, without mixed revisions during asynchronous rendering.
- [ ] Unplaced items are visibly identified as excluded from the PNG.
- [ ] Repeated exports do not accumulate obsolete object URLs or decoded artwork.
- [ ] Share cancellation leaves the prepared export usable.
- [ ] Downloaded PNGs can be reopened and decoded; verification is not limited to clicking a button.
- [ ] Prepared project files can be reopened and imported through actual file-selection flows.

## Provider and trust-boundary checks

- [ ] All six categories can populate the same card.
- [ ] AniList country mappings and supported year/genre/format/status filters behave as specified.
- [ ] TMDB title-search and Browse filter capabilities are distinct and accurate.
- [ ] Pagination exposes more results without pretending page-local filtering covers the full catalog.
- [ ] Stale requests cannot replace newer search results.
- [ ] Rate limits, unavailable credentials, provider outages, and failed artwork retrieval have actionable states.
- [ ] The image interface rejects arbitrary hosts/URLs, disallowed paths, redirects, invalid content, and oversized responses.
- [ ] Upload limits are checked before a card mutation is committed.
- [ ] Unsupported schema versions, malformed manifests, missing assets, and corrupt archives fail safely.
- [ ] Duplicate entries, unsafe archive paths, excessive entry counts, and compressed/expanded size violations fail safely.
- [ ] Archive limits are enforced during unpacking, not only after complete decompression.
- [ ] No API token appears in PNGs, project archives, client bundles, or application logs.
- [ ] Required provider attribution appears in Credits.

## Mobile and accessibility

- [ ] Automated coverage includes Chromium, Firefox, and WebKit.
- [ ] Layout checks cover 320, 390, 768, and 1440 px widths.
- [ ] No page-level horizontal overflow occurs at the required widths.
- [ ] Primary controls remain reachable with the software keyboard open.
- [ ] Touch controls target at least 44 × 44 px.
- [ ] Keyboard focus, accessible labels, and dialog focus behavior work correctly.
- [ ] Contrast, reduced motion, and 200% zoom are verified.
- [ ] LAN HTTP supports the documented saving fallback.
- [ ] Native sharing is verified in a secure context.
- [ ] A real iPhone Safari session completes create → search → upload → arrange → crop → export PNG → reopen PNG → export project → import project.
- [ ] A real Android Chrome session completes create → search → upload → arrange → crop → export PNG → reopen PNG → export project → import project.
- [ ] Physical-device results are recorded separately from browser emulation.

## Impeccable design acceptance

- [ ] The implementation follows the approved direction and desktop/mobile comps.
- [ ] Desktop and mobile use consistent controls, hierarchy, and interaction feedback.
- [ ] Empty, loading, error, saving, and exporting states receive the same design attention as populated states.
- [ ] Bounded desktop/mobile inspection and correction passes are complete.
- [ ] The independent finish review is complete.
- [ ] Material findings are resolved or explicitly recorded before acceptance.
- [ ] The shipped design system is documented after the final corrections.

## Documentation and final status

- [ ] Setup, token configuration, LAN testing, backup, limits, and troubleshooting are documented.
- [ ] Documentation distinguishes local autosaving from durable project-file backups.
- [ ] Low-resolution source artwork and unsupported upload formats are explained accurately.
- [ ] Public hosting remains deferred and is not represented as delivered.
- [ ] Any unavailable hardware checks remain explicitly pending; full mobile acceptance is not claimed without them.
- [ ] Final evidence is attached to this checklist, including the tested commit and remaining limitations.
