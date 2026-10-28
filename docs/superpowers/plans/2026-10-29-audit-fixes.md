# Audit fixes implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve the nine verified audit findings without new dependencies or a format change.

Status: complete; committed on top of `ea45e99`.

**Architecture:** Keep the existing editor, saver, archive codec, and provider adapters. Validate proposed records before mutation; serialize saves; cancel navigation synchronously until the save or discard decision completes.

**Tech Stack:** SvelteKit, Svelte, TypeScript, Vitest, Playwright, fflate, Valibot, IndexedDB.

**Spec:** ../specs/2026-10-28-remi-v1-design.md and the nine findings approved in this conversation.

## Global constraints

- Preserve existing cards and schema version 1.
- Keep 100 items, 8 MiB per asset, 40 MiB per card, 24 megapixels, and 1 MiB manifest limits.
- No new dependencies, publishing, or unrelated redesign.
- Implement in the current clean workspace; leave changes uncommitted for review.

## Review focus

- New edits arriving during a save must be drained before navigation.
- Failed saves must not trigger automatic retry loops or discard work.
- Removing an item during image decoding must not replace another item.
- Forged ZIP sizes must fail before expensive parsing or copying.
- Rejected large text edits must leave the working card exportable.

## 1. Autosave and navigation

Files: src/lib/library/autosave.ts, autosave.test.ts, src/routes/editor/[id]/+page.svelte, src/routes/ui.e2e.ts.

- [x] Add failing tests for concurrent flushes, draining edits during writes, and failed-save navigation.
- [x] Serialize waiting flushes and drain newer edits; stop on failures.
- [x] Cancel navigation synchronously, save before resuming, confirm discard on failure, and dispose only afterward.
- [x] Verify focused unit and browser tests, including browser Back.

## 2. Archive and artwork trust boundaries

Files: src/lib/card/archive.ts, archive.test.ts, verify.ts, verify.test.ts, src/lib/library/store.ts.

- [x] Add failing tests for oversized export manifests and forged stored-entry sizes.
- [x] Share manifest construction and enforce its encoded byte limit for saves and exports.
- [x] Reject inconsistent uncompressed entry sizes before extraction and verify actual extracted sizes.
- [x] Add a failing test for an oversized image header; reuse sniffDimensions before decode.
- [x] Run archive, artwork, and store tests.

## 3. Editor mutation safety

Files: src/lib/editor/editor-state.svelte.ts, editor-state.test.ts, StylePanel.svelte, src/routes/editor/[id]/+page.svelte, src/routes/ui.e2e.ts.

- [x] Add failing tests for item/artwork limits, rejected large text edits, and selection changes during replacement.
- [x] Validate proposed records before committing, show rejected text edits inline, and restore accepted input values.
- [x] Replace artwork by the item ID captured before decoding; ignore removed items.
- [x] Run editor unit tests and browser regressions.

## 4. Provider filters

Files: src/lib/server/media/anilist.ts, anilist.test.ts, src/lib/editor/AddPanel.svelte, src/routes/ui.e2e.ts.

- [x] Add failing tests for manga publication year and TMDB Search/Browse transitions.
- [x] Filter manga categories by publication start date and read the publication year.
- [x] Hide and omit Browse-only TMDB filters during title Search; clear them on mode changes.
- [x] Run adapter and browser regressions.

## 5. Final verification

- [x] Run type checking, lint, all unit tests, production build, and Chromium browser tests.
- [x] Recheck the live manga year case if provider access is available.
- [x] Review the final diff independently and address material findings.
- [x] Report remaining physical-device and Firefox/WebKit environment limits.

## Verification record — 2026-10-29

- Changes are committed on top of base `ea45e99ffb417680f69921ed70058aa635490bde`.
- Node 24.22.1, pnpm 12.4.2; no dependency or schema changes.
- Type checking: zero errors or warnings. Prettier and ESLint pass.
- Unit suite: 151 passing tests across 20 files. Focused new tests were observed failing before each fix.
- Production build and full Chromium suite: 38 passing tests, including six browser regressions.
- Live AniList regression: manga search for One Piece with year 1997 returns One Piece with publication year 1997.
- Independent final review added regressions for JPEG metadata beyond the initial header sample and unsupported headers rejected before decoding. Caption whitespace already held on the base commit; it is covered by a regression guard rather than a code change.
- Back-button regression holds a real IndexedDB write open, edits again, and verifies the latest text after the library actually mounts.
- Review follow-up: valid JPEGs with fill bytes now sniff correctly while recognized-but-unknown headers fall through to decoding; over-limit cards accept shrinking edits so they can be repaired; provider title arrays are copied out of Svelte state before persistence (fixing a DataCloneError on save).
- Physical-device/native-sharing checks remain pending. Earlier Firefox profile launch and WebKit standalone IndexedDB Blob-storage failures remain environment limits; full cross-browser acceptance is not claimed.
