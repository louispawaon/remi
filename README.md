# Remi

A local-first media card maker built with SvelteKit. Product requirements live in
[PRODUCT.md](PRODUCT.md); the full specification and phased plan live in
[docs/superpowers/](docs/superpowers/README.md).

Requires Node 24 (`.nvmrc`).

## Setup

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm exec playwright install chromium
```

`TMDB_READ_ACCESS_TOKEN` is the only provider credential; AniList’s public API needs none. It is optional. Without it, movie and TV search stays disabled with a
setup explanation; the rest of the app works. Credentials are declared in `src/env.ts` and
read only by server code from `$app/env/private`; that module cannot be imported into client
code, so an accidental leak fails the build instead of shipping.

## Commands

| Command                 | Purpose                                                 |
| ----------------------- | ------------------------------------------------------- |
| `pnpm dev`              | Development server on `localhost`                       |
| `pnpm dev:lan`          | Development server exposed on the LAN for phone testing |
| `pnpm build`            | Production build via the Node adapter                   |
| `pnpm build:cloudflare` | Production build via the Cloudflare adapter             |
| `pnpm release`          | Build for Cloudflare and deploy the Worker              |
| `pnpm start`            | Run the built Node server (`PORT`, default 3000)        |
| `pnpm preview`          | Vite preview of the compiled app, not the Node server   |
| `pnpm check`            | Svelte + TypeScript checks                              |
| `pnpm lint`             | Prettier check and ESLint                               |
| `pnpm format`           | Write Prettier formatting                               |
| `pnpm test:unit`        | Vitest, once                                            |
| `pnpm test:unit:watch`  | Vitest in watch mode                                    |
| `pnpm test:e2e`         | Playwright browser tests (built server)                 |
| `pnpm test`             | Unit and browser tests                                  |

## Render harness

`pnpm dev`, then open `/dev/render` or `/dev/library`. They exercise the deterministic
fixture across grids, formats, and resolutions, plus local cards, revisions, thumbnails, and
project import. Both are unavailable in a production build unless `ENABLE_DEV_HARNESS=1` is
set, which the automated tests use.

## Phone testing

`pnpm dev:lan` prints a network URL. Open it on a phone on the same network. LAN HTTP is
not a secure context, so clipboard, share-sheet, and service-worker APIs are unavailable
there; use the app's download/open-image fallbacks when testing over plain HTTP.

## Saving and backups

Cards autosave to IndexedDB in the browser. Browser storage can be cleared or evicted, so
exported `.remi` project files are the durable backup.
