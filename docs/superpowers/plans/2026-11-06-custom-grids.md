# Custom grids: independent columns and rows

## Goal

Replace the square `gridSize` with independent `gridColumns` and `gridRows`, each
1–7. Existing square cards keep working. Card documents move to schema version 2;
version 1 archives and old IndexedDB records are upgraded on read.

## Global constraints

- Default remains 5×5.
- Free space is available only when both axes are odd and at least 3.
- Keep the 0.72–1.15 cell aspect clamp; extreme shapes center with margins.
- No new dependencies.
- TDD for every behavior: write the test, watch it fail for the expected reason,
  then implement.
- Keep the unit suite green at every task boundary.
- Run `pnpm check`, `pnpm lint`, `pnpm test:unit`, and the targeted e2e files
  before closing each task that touches them.

## Interfaces

- `CardDocument` gains `gridColumns: GridDimension` and `gridRows: GridDimension`;
  `gridSize` and `GridSize` are removed.
- `computeLayout` input and `CardLayout` carry `gridColumns` / `gridRows`.
- `createFixtureDocument` options carry `gridColumns` / `gridRows`.
- `resizeGrid(document, columns, rows)` replaces `resizeGrid(document, gridSize)`.
- `CardSummary` carries `gridColumns` / `gridRows`.
- `HarnessApi` and `HarnessMatrixEntry` carry both dimensions.

---

## Task 1: Core model, layout, archive, and persistence

### Files

- `src/lib/card/types.ts`
- `src/lib/card/document.ts`
- `src/lib/card/fixture.ts`
- `src/lib/card/migrate.ts` (new)
- `src/lib/card/layout.ts`
- `src/lib/card/png.ts`
- `src/lib/card/archive.ts`
- `src/lib/library/types.ts`
- `src/lib/library/store.ts`
- Unit tests for the above.

### Steps

1. Update the unit tests to the new API before implementation:
   - `layout.test.ts`: loop all 49 column/row shapes for dimensions, cell count,
     no overlap, ratio bounds, centering, and 2x scaling. Assert free space only
     when both axes are odd and at least 3.
   - `document.test.ts`: default 5×5; free-space guard for 1×1, 4×5, and 3×3;
     rectangular resize preserves order and overflow.
   - `archive.test.ts`: rectangular round-trip; a version 1 manifest with
     `gridSize` upgrades; slot-count mismatch reports `columns×rows`; schema 3 is
     rejected.
   - `store.test.ts`: a legacy record and summary normalize on read.
   - `render.test.ts` and `shuffle.test.ts`: new fixture and document fields.
   - Add a fixture test proving a 1×1 grid does not drop items through a negative
     slice length.
2. Run `pnpm test:unit`; confirm it fails because the new fields and functions do
   not exist yet.
3. Implement:
   - `types.ts`: `CARD_SCHEMA_VERSION = 2`, `GRID_MIN = 1`, `GRID_MAX = 7`,
     `GridDimension`, new `CardDocument` fields.
   - `document.ts`: shared `centreCellIndex(columns, rows)`; updated
     `isFreeSpaceCell`, `resizeGrid`, `setFreeSpace`, `createDefaultDocument`.
   - `fixture.ts`: new options, slot count, and safe placement for tiny grids.
   - `migrate.ts`: `upgradeDocument` converting `gridSize` to columns/rows and
     setting schema 2.
   - `layout.ts`: independent axis math and free-cell guard.
   - `png.ts`: pass both dimensions.
   - `archive.ts`: version 2 schema, version 1 upgrade before validation, slot
     count `columns * rows`.
   - `library/types.ts` and `library/store.ts`: new summary fields, upgrade old
     records and summaries on read.
4. Run `pnpm test:unit`; confirm all tests pass.
5. Commit: `feat(grid): support independent columns and rows`.

### Expected

`pnpm test:unit` passes with the new rectangular cases and the existing 195
tests still green.

---

## Task 2: Editor UI, labels, and harness

### Files

- `src/lib/editor/ArrangePanel.svelte`
- `src/lib/editor/editor-state.svelte.ts`
- `src/lib/editor/SlotMap.svelte`
- `src/lib/editor/ExportSlip.svelte`
- `src/routes/+page.svelte`
- `src/lib/dev/harness-api.ts`
- `src/routes/dev/render/+page.svelte`
- `src/routes/dev/design/+page.svelte`
- `src/routes/ui.e2e.ts`
- `src/routes/dev/render/render.e2e.ts`

### Steps

1. Update `ui.e2e.ts` first: replace preset grid clicks with stepper clicks; set
   3 columns × 5 rows, assert 15 sheet-map rows, and keep the 8-item assertion.
   Add a rectangular render case to `render.e2e.ts`.
2. Run the targeted e2e files; confirm they fail on the missing controls.
3. Implement:
   - `ArrangePanel.svelte`: Columns and Rows steppers, clamped 1–7, stable
     accessible names (`More columns`, `Fewer rows`, etc.). Disable free space
     unless both axes are odd and at least 3, with a short hint.
   - `editor-state.svelte.ts`: `setGrid(columns, rows)` and shared
     `centreCellIndex` in `addItem`.
   - Labels in `SlotMap`, `ExportSlip`, and the home page use `columns×rows`.
   - Dev harness and dev pages carry both dimensions; the render matrix keeps the
     24 square cases and adds rectangular entries.
4. Run `pnpm check`, `pnpm lint`, and the targeted e2e files.
5. Commit: `feat(editor): add column and row grid controls`.

### Expected

The editor sets a 3×5 grid, the sheet map shows 15 rows, items survive the
change, and rectangular exports render at exact dimensions.

---

## Task 3: Docs and full verification

### Files

- `PRODUCT.md`
- `DESIGN.md`

### Steps

1. Update the product and design docs: 1–7 columns × 1–7 rows, independent axes,
   free-space rule, and reflow behavior.
2. Run `pnpm test:unit`, `pnpm check`, `pnpm lint`, and `pnpm test:e2e`.
3. Commit: `docs: document custom grid ranges`.

### Expected

All four commands pass.

---

## Verification

- `pnpm test:unit`
- `pnpm check`
- `pnpm lint`
- `pnpm test:e2e`
- Manual: export 7×7 and 7×3 at 1x and 2x, and confirm old local cards still open.
