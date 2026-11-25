# Oneup plan — characters and actors

- **Stage:** `plan`
- **Updated:** 2026-11-25
- **Decision owner(s):** founder

## Outcome

While adding to a collection, the user can switch the Add panel from titles to **Characters** or **People** and get portrait tiles from the same media Remi already supports: anime, manga (manhwa/manhua), movies, TV, games, and music. No new media types, no scraping, and no card-format change.

## Sources

- `src/lib/card/types.ts` — `CATEGORIES` and `ADD_CATEGORIES`; defines "media present in Remi".
- `src/lib/media/types.ts` — `MediaSearchRequest`, `MediaResult`, `MediaOptions`, `MediaProvider`.
- `src/lib/server/media/adapter.ts` — the adapter contract every provider implements.
- `src/lib/server/media/service.ts` — category → provider routing, 45 s cache, in-flight coalescing.
- `src/lib/server/media/validate.ts` — request picklists, including provider allow-list for images.
- `src/lib/editor/AddPanel.svelte` — scope of the Add UI, artwork fetch, text-only fallback.
- **Decision (request, 2026-11-25):** only characters/actors from media Remi already supports; do not add new media types.
- **Verified (2026-11-25):** AniList returns characters and staff with portraits and a source work. IGDB returns characters with mug shots. Podcast Index exposes only a free-text feed `author`/`ownerName`, no person records.
- **Decision D1 (2026-11-25, founder):** app-wide supported media, not limited to the current collection.

## Scope and dependencies

### Coverage matrix

| Remi category           | Characters                                                   | People / actors                                          | Source                            | Status                           |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------- | --------------------------------- | -------------------------------- |
| anime                   | ✅ name, portrait, source work                               | ✅ staff with portraits                                  | AniList (existing, no credential) | ready                            |
| manga / manhwa / manhua | ✅ same                                                      | ✅ staff (authors, artists, voice actors of adaptations) | AniList (existing)                | ready                            |
| movie                   | ❌ no global character endpoint; role names exist in credits | ✅ TMDB `/search/person`                                 | TMDB (existing token)             | people ready; characters need D2 |
| tv                      | ❌ same                                                      | ✅ TMDB `/search/person`                                 | TMDB (existing token)             | people ready; characters need D2 |
| game                    | ✅ IGDB `/characters` with mug shots                         | ❌ no reliable voice-cast data                           | IGDB (existing credentials)       | ready                            |
| music                   | n/a                                                          | ✅ Deezer `/search/artist` (solo singer or band)         | Deezer (existing, no credential)  | ready                            |
| podcast                 | n/a                                                          | ❌ only free-text `author`; no person records            | Podcast Index (existing)          | out of scope                     |

### Explicitly out of scope

- Books, comics outside manga, theatre, sports, and any media not in `CATEGORIES`.
- Fandom/Wikidata scraping for characters IGDB does not carry (anime-style and gacha game casts).
- Game voice actors — no clean provider.
- Podcast hosts — Podcast Index has no structured person data.
- Character artwork for live-action roles — TMDB has no character images.

### Design decisions carried into the slices

- Add `scope: 'title' | 'character' | 'person'` to `MediaSearchRequest`, defaulting to `title` so existing requests keep working. Include it in the service cache key.
- Extend `MediaOptions` with `scopes: MediaOption[]`; adapters advertise what they support and the Add panel renders the selector only when more than one scope exists.
- Keep `CardItem` unchanged. A character/actor tile stores `category` as its medium, `titles.preferred` as the character/person name, and `sourceId` as `provider:character:<id>` or `provider:person:<id>`. `sourceId` is only validated as a string, so exports stay compatible.
- Reuse `format` as the context line (source work for characters, known-for or occupation for people), so no renderer change is needed.
- Every new result goes through the existing artwork proxy and text-only fallback. Provider images must remain on their existing allow-listed hosts.

### Open decisions

| ID  | Decision                                                                                                                  | Owner   | Resolution (2026-11-25)                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| D1  | App-wide supported media, or only media already in the user's current collection?                                         | founder | **App-wide.** Settled by the founder.                                          |
| D2  | Live-action characters: actor portrait labelled with the role (recommended), text-only tile, or omit movie/TV characters? | founder | **Actor portrait labelled with the role**, reached by browsing a title's cast. |
| D3  | Music people: artists only (recommended), or also band members and song performers (adds MusicBrainz or TheAudioDB)       | founder | **Artists only.** No new provider.                                             |
| D4  | AniList people: show all staff with an occupation label (recommended), or only voice actors?                              | founder | **All staff with an occupation label.**                                        |

## Slices

Each slice is independently reviewable and leaves the app working.

### S1 — Scope plumbing + AniList characters

- **Status:** `ready for founder review`
- **Outcome:** In **Anime** or **Manga**, switching the new scope selector to **Characters** and searching returns AniList characters; adding one creates a portrait tile.
- **Sources:** `docs/oneup/characters-actors-plan.md`; AniList GraphQL (verified 2026-11-25); `src/lib/server/media/anilist.ts`.
- **Permitted changes:** `src/lib/media/types.ts`, `src/lib/server/media/validate.ts`, `service.ts`, `adapter.ts`, `anilist.ts`, `src/lib/media/client.ts`, `src/lib/editor/AddPanel.svelte`, their tests.
- **Dependencies:** none beyond D1.
- **Decisive facts:** AniList character search returns `name.full`, `image.large`, and a popularity-sorted source work — confirmed live. Character image hosts are already allow-listed (`s4.anilist.co`, `/file/anilistcdn/`).
- **Acceptance:**
  - `scope` defaults to `title`; an unknown scope is a 400.
  - Cache separates title and character searches.
  - Character results carry name, portrait, source work, and a `provider:character:<id>` source id.
  - Adding a character produces a normal tile and survives export/import.
- **Verification:** adapter unit tests; `validate.test.ts`; one browser test that adds an AniList character; manual live search for `zoro`.
- **Evidence:** record in this file under Completion evidence; commit range plus test output.

### S2 — AniList people / voice actors

- **Status:** `ready for founder review`
- **Outcome:** A **People** scope in Anime/Manga returns AniList staff with portraits and an occupation label.
- **Sources:** AniList `Page.staff` (verified live); D4.
- **Permitted changes:** `anilist.ts`, options in its adapter, Add panel scope labels, tests.
- **Dependencies:** S1 scope plumbing; D4 for filtering or labelling.
- **Decisive facts:** `staff(search:)` matches staff names, not roles, and returns illustrators as well as voice actors; `primaryOccupations` is available but inconsistent.
- **Acceptance:** People results carry name, portrait, native name, and occupation; adding works; no title-scope behavior changes.
- **Verification:** adapter tests; live search for a known voice actor; one browser add test.
- **Evidence:** as S1.

### S3 — IGDB game characters

- **Status:** `ready for founder review`
- **Outcome:** A **Characters** scope in Game returns IGDB characters with mug shots and their game.
- **Sources:** IGDB `/characters` (verified live: Kratos, Link, Cloud, Geralt have art; Genshin/League absent); `src/lib/server/media/igdb.ts`; existing `images.igdb.com` allow-list.
- **Permitted changes:** `igdb.ts`, its tests, Add panel labels, attribution copy if needed.
- **Dependencies:** S1.
- **Decisive facts:** `search` matches character names only; many index entries are junk or have no mug shot.
- **Acceptance:** only characters with a mug shot are returned; each carries name, game context, and cover; adding works; no-art results fall back to text-only tiles if shown.
- **Verification:** mocked adapter tests; live probe for `kratos` and `zelda`; one browser add test.
- **Evidence:** as S1.

### S4 — TMDB people (movie / TV actors)

- **Status:** `ready for founder review`
- **Outcome:** A **People** scope in Movie/TV searches actors by name, showing portrait and known-for title.
- **Sources:** TMDB `/search/person`; existing token and `image.tmdb.org` path validation.
- **Permitted changes:** `tmdb.ts`, its tests, Add panel labels.
- **Dependencies:** S1.
- **Acceptance:** person results carry name, portrait, known-for context, `provider:person:<id>`; adding works; title search unchanged.
- **Verification:** adapter tests; live search for a known actor; one browser add test.
- **Evidence:** as S1.

### S5 — Deezer artists

- **Status:** `ready for founder review`
- **Outcome:** A **People** scope in Music searches artists and adds their portrait.
- **Sources:** Deezer `/search/artist`; existing `cdn-images.dzcdn.net` allow-list currently permits `/images/cover/` only — a path update is required for `/images/artist/`.
- **Permitted changes:** `deezer.ts`, `image.ts` allow-list, tests, Add panel labels.
- **Dependencies:** S1; image allow-list change.
- **Acceptance:** artist results carry name and portrait; adding works; `/images/cover/` path still works for albums.
- **Verification:** adapter and image allow-list tests; live search for an artist; one browser add test.
- **Evidence:** as S1.

### S6 — Live-action characters (conditional)

- **Status:** `ready for founder review`
- **Outcome:** From a movie/TV title, browse its cast and add a character with the actor's portrait labelled with the role.
- **Sources:** TMDB `/movie/{id}/credits`, `/tv/{id}/aggregate_credits`; D2.
- **Permitted changes:** TMDB adapter, a cast sub-panel or result mode, tests.
- **Dependencies:** S1, S4, D2.
- **Acceptance:** casting list shows actor, role, and portrait; adding stores the role as the preferred title; no character image is claimed where none exists.
- **Verification:** adapter tests; one browser flow from a mocked title to a cast tile.
- **Evidence:** as S1.

### Out

- Podcast people — no structured data in Podcast Index (verified).
- Fandom/Wikidata character scraping.
- Game voice cast.

## Coverage check

S1 plus S2–S5 cover characters for anime/manga and games, and people for anime/manga, movies, TV, games (people excluded by IGDB limits), and music. S6 adds live-action characters if D2 approves using actor portraits. Podcasts and unsupported media are intentionally absent, satisfying "media only present in Remi".

## Completion evidence

- **Status:** `ready for founder review`
- **Result:** commit `3dff2cb` on `main` (`feat: search characters and people alongside titles`).
- **Checks run:**
  - 2026-11-25 `pnpm check` → 0 errors, 0 warnings.
  - 2026-11-25 `pnpm lint` → Prettier and ESLint clean.
  - 2026-11-25 `pnpm test:unit` → 29 files, 228 tests passed.
  - 2026-11-25 `CI=1 pnpm exec playwright test --grep-invert "saves a pending edit before following browser Back"` → 51 passed.
  - 2026-11-25 live probes on an env-backed build (port 3141):
    - `anime/character zoro` → 23 results; `Zoro Roronoa · ONE PIECE · 1999`; portrait proxied as PNG.
    - `anime/person kazuya nakai` → `Kazuya Nakai · Voice Actor`; portrait proxied as JPEG.
    - `game/character kratos` → `Kratos · God of War: Ascension`; portrait proxied as JPEG.
    - `movie/person tom hanks` → `Tom Hanks · Forrest Gump`; portrait proxied as WebP.
    - `music/person frank ocean` → `Frank Ocean · Artist`; portrait proxied as JPEG.
    - `cast movie 13` → 24 roles, first two `Forrest Gump / Tom Hanks` and `Jenny Curran / Robin Wright`.
  - Old-sheet compatibility: `CardItem` is unchanged and character/people ids are stored as plain `sourceId` strings.
- **Review:** self-review — no fresh reviewer dispatched; not independent assurance. Verdict `ready for founder review`. Diff re-read against the slice acceptance criteria.
- **Gaps:**
  - Browser tests cover the shared scope UI (AniList characters) and the cast flow (TMDB); the IGDB, Deezer, TMDB-person, and AniList-people mappings are covered by adapter unit tests rather than separate browser tests.
  - IGDB character totals are `null` and paging is page-length based, because art filtering makes `X-Count` misleading.
  - IGDB character coverage remains console/PC; gacha/mobile casts and game voice actors are absent at the source.
  - Live-action character tiles use the actor's portrait labelled with the role, per D2; no character art is claimed.
  - Cast browsing returns at most 24 roles per title.
  - AniList staff search matches names and includes non-voice staff, per D4.
  - Deezer returns artists (bands or solo singers), not individual band members, per D3.
- **Remaining approvals:** founder check of the scope switch and the cast flow.
- **Next action:** `pnpm dev` → Add → **Anime** → **Characters** → `zoro`; then **Movie** → search a title → **Cast** — owner: founder.
