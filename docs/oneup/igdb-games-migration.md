# Oneup handoff — IGDB game search migration

- **Stage:** `verify`
- **Updated:** 2026-11-25, branch `feat/igdb-games`, commit `40834bc`
- **Decision owner(s):** repo owner (founder)

## Outcome

Game search returns IGDB titles with IGDB covers, release years, platforms, and genres instead of TheGamesDB results. Everything else in the Add flow behaves exactly as before, and the app needs only `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` for games.

## Sources

- `docs/superpowers/specs/2026-10-28-remi-v1-design.md` — provider behavior now names IGDB and its credential requirement; updated in this change.
- `README.md`, `src/env.ts`, `.env.example` — credential names and server-only rule; updated in this change.
- `src/lib/server/media/adapter.ts` — the `MediaAdapter` contract both old and new game adapters implement.
- IGDB API (`api.igdb.com/v4`) and Twitch OAuth (`id.twitch.tv/oauth2/token`) — live-verified with the owner's credentials.
- **Decision (request, 2026-11-25):** migrate games entirely from TheGamesDB to IGDB, contained to current functionality; character/actor search explicitly excluded from this slice.
- **Session-local:** `/Users/migspaws/Developer/personal/remi-v1` — branch `feat/igdb-games`.

## Scope and dependencies

- **Permitted changes:** the game media provider, its env vars, image allow-list, tests, and provider attribution copy.
- **Prerequisites:** `IGDB_CLIENT_ID` + `IGDB_CLIENT_SECRET` in `.env`; confirmed working (token exchange returned 200).
- **Affected domains or areas:** media search/options API, image proxy, Add panel (no UI change), credits/privacy/terms.
- **Decisive facts:**
  - IGDB credentials exchange for a token — supplied by: repo owner; received when: values were saved to `.env`; needed by: every game search; confirmed by: live token exchange and search.
  - IGDB returns `X-Count` on `search` — confirmed by: live query (`zelda` → 387), so `total` is a real number.
  - IGDB covers live at `images.igdb.com/igdb/image/upload/t_cover_big/<id>.jpg` — confirmed by: live proxy fetch returning JPEG bytes.
- **Out of scope:** IGDB character/actor search; game voice actors; changing game filters; removing unrelated uncommitted edits.
- **Unresolved decisions:** none for this slice.
- **Independent work that may continue:** character-search design from the earlier conversation (separate slice).

## Acceptance and verification

| ID  | Scenario or requirement              | Expected result                                                | Check or evidence                                                   | Status |
| --- | ------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| A1  | Search the game category for a title | IGDB titles with year, platform summary, and IGDB cover        | `igdb.test.ts` "exchanges credentials once…"; live `zelda` search   | passed |
| A2  | Request page 2                       | IGDB `offset` used; `total` and `hasNextPage` from `X-Count`   | `igdb.test.ts` offset assertion; live page 1/2                      | passed |
| A3  | Add a game with a cover              | Cover proxies from `images.igdb.com` only at the approved path | `image.test.ts` allow-list cases; live proxy 200 JPEG               | passed |
| A4  | Credentials missing or wrong         | Setup message, not a blank screen or leaked key                | `igdb.test.ts` missing/rejected credential cases; `service.test.ts` | passed |
| A5  | Provider attribution                 | Credits/privacy/terms name IGDB, not TheGamesDB                | credits browser test; repo grep                                     | passed |
| A6  | Token reuse and expiry               | One token exchange per service lifetime; one refresh on 401    | `igdb.test.ts` cache and refresh cases                              | passed |

## Completion evidence

- **Status:** `ready for founder review`
- **Result:** branch `feat/igdb-games`, commit `40834bc` (`feat: replace TheGamesDB with IGDB game search`).
- **Checks run:**
  - 2026-11-25 `pnpm check` → 0 errors, 0 warnings.
  - 2026-11-25 `pnpm lint` → Prettier clean, ESLint clean.
  - 2026-11-25 `pnpm test:unit` → 29 files, 218 tests passed.
  - 2026-11-25 `CI=1 pnpm exec playwright test --grep-invert "saves a pending edit before following browser Back"` → 49 passed.
  - 2026-11-25 live build on port 3131 with real credentials:
    - `options?category=game` → 200 `{"provider":"igdb",...}`
    - `search?category=game&query=zelda&page=1` → 24 results, `total: 387`, `hasNextPage: true`
    - page 2 → 23 results (not 24; unexplained, see gaps)
    - cover proxy → 200 `image/jpeg`, 27,340 bytes, JPEG magic bytes
  - `grep -rn "thegamesdb|TheGamesDB|THEGAMESDB" src README.md docs .env.example` → no references.
- **Review:** self-review — no fresh reviewer dispatched; this is not independent assurance. Verdict `ready for founder review`. Re-read the full diff, `igdb.ts`, and the changed call sites against A1–A6. Findings: none blocking. Confirmed old saved cards are safe because `sourceId` is validated only as a nullable string in `src/lib/card/archive.ts`, and artwork is stored locally.
- **Reviewed scope:** A1–A6, commit `40834bc`.
- **Gaps:**
  - Page 2 returned 23 results against 387 total; IGDB may drop a row near a page boundary. Pagination still advances and no duplicates were observed.
  - Platform summary shows the first two names plus a count (`+4`); IGDB does not order platforms by release, so the two shown are arbitrary.
  - IGDB `search` surfaces DLC/editions and loose matches; no relevance filter was added to keep scope to a parity swap.
  - The old `THEGAMESDB_API_KEY` remains in the local `.env`; it is now unused and safe to delete.
- **Remaining approvals:** founder acceptance of the live game search.
- **Next action:** run `pnpm dev`, add a card, choose **Game**, search `zelda` or `sonic`, and confirm IGDB covers and platform text — owner: founder.
