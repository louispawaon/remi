# Remi

A local-first media card maker built with SvelteKit. Product requirements live in
[PRODUCT.md](PRODUCT.md); the full specification and phased plan live in
[docs/superpowers/](docs/superpowers/README.md).

Requires Node 24 (`.nvmrc`).

## Setup

```sh
npm ci
cp .env.example .env
npx playwright install chromium
```

`TMDB_READ_ACCESS_TOKEN` is optional. Without it, movie and TV search stays disabled with a
setup explanation; the rest of the app works. Credentials are declared in `src/env.ts` and
read only by server code from `$app/env/private`; that module cannot be imported into client
code, so an accidental leak fails the build instead of shipping.

## Commands

| Command                   | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `npm run dev`             | Development server on `localhost`                       |
| `npm run dev:lan`         | Development server exposed on the LAN for phone testing |
| `npm run build`           | Production build via the Node adapter                   |
| `npm run start`           | Run the built Node server (`PORT`, default 3000)        |
| `npm run preview`         | Vite preview of the compiled app, not the Node server   |
| `npm run check`           | Svelte + TypeScript checks                              |
| `npm run lint`            | Prettier check and ESLint                               |
| `npm run format`          | Write Prettier formatting                               |
| `npm run test:unit`       | Vitest, once                                            |
| `npm run test:unit:watch` | Vitest in watch mode                                    |
| `npm run test:e2e`        | Playwright browser tests (built server)                 |
| `npm test`                | Unit and browser tests                                  |

## Phone testing

`npm run dev:lan` prints a network URL. Open it on a phone on the same network. LAN HTTP is
not a secure context, so clipboard, share-sheet, and service-worker APIs are unavailable
there; use the app's download/open-image fallbacks when testing over plain HTTP.

## Saving and backups

Cards autosave to IndexedDB in the browser. Browser storage can be cleared or evicted, so
exported `.remi` project files are the durable backup.
