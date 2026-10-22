# PLOT TWIST

**Escape your algorithm without losing your taste.** A private application scaffold for a proposed Qloo hackathon entry: start with favourites, choose an adventure level, explore a short journey across music, film and books, then revise it with feedback.

## Current status

This is a working **demo interface**, not a live AI recommendation engine. The app uses a small, hand-written catalogue and deterministic editorial matching. Every journey is labelled as demo data. No Qloo credential, harness, model provider or live Qloo request has been configured or verified. Names and connections use local IDs, not Qloo entity IDs. Artwork is original abstract CSS, not official cover art.

The repository is intended to remain private. No hosting service, paid service, public deployment or hackathon submission is configured. An open-source licence has not been selected (`UNLICENSED` in package metadata).

## Run locally

Use Node.js **22.19 or later** (Node 24 recommended; `.nvmrc` selects 24) and npm. From this folder:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4173**. The development command starts Express and Vite together. Nothing is required in `.env`; the demo needs no credentials. The server binds only to loopback. If the port is busy, use `PORT=4174 npm run dev`.

1. Choose 1–5 favourites, or use **Try a sample taste**.
2. Select an adventure level, then **Find my plot twist**.
3. Choose **Keep this** or **Try another** on a stop.
4. Use **Revise my journey**. Loved stops are kept and skipped stops are excluded. If a category is exhausted, reset the demo feedback.
5. Use **Edit my taste** to change favourites or adventure level.

Search covers only the visible demo catalogue. Choices and feedback live in page memory and reset on reload. The app has no accounts, analytics, database, history, streaming or external content links.

## Verify and build

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm run check` runs lint, tests and build together. Tests cover the API contract, invalid and oversized requests, feedback behaviour, empty results, explicit Qloo unavailability and sanitised errors. `npm start` serves the built browser app and API on loopback; build first. Stop the dev server before starting the built app on the same port. The generated `dist/` and `dist-server/` folders are ignored.

## Structure

```text
src/                    React interface and responsive CSS
shared/catalog.ts       Demo favourites and adventure levels
shared/contracts.ts     Shared request schema and response types
server/app.ts           Validated HTTP API, error boundary
server/index.ts         Local development / built-app entry point
server/providers/       Server-only demo provider and disabled Qloo adapter
tests/                  Behaviour and API tests (Node test runner)
public/                 Local favicon
```

React and TypeScript keep the small interactive flow straightforward; Vite builds the browser assets. Express provides a persistent Node process without coupling the application to a serverless host. Browser code calls only the local `/api/journeys` boundary.

## API boundary

- `GET /api/health`: explicit demo mode and Qloo-not-configured status.
- `POST /api/journeys`: accepts `favouriteIds` (1–5 known demo IDs), `adventure` (`gentle`, `curious`, `wild`), optional `revision` (0–100), and optional `feedback` (demo ID to `love` or `skip`). Returns `source: "demo"`, `status`, title, summary and three stops, or an explicit empty result.
- Bad input returns 400; oversized JSON returns 413; unknown API paths return 404. An unavailable provider returns 503; unexpected errors return a generic 500. No request-body or upstream-error logging.

The `RecommendationProvider` interface is a server-only seam. The Qloo stub always rejects and is not wired to the running app. A live implementation must expand the response types and UI for live provenance and Qloo's full status model; do not relabel demo results or silently fall back to fixtures.

## Next: a real Qloo integration

Reviewed against the [official Qloo hackathon kit](https://github.com/qloo/qloo-hackathon-kit) on 22 October 2026. The [MCP starter](https://github.com/qloo/qloo-hackathon-kit/blob/main/starter/mcp-client/README.md) requires a Node **22.19+ VM or container** capable of spawning the local `qloo mcp` process. Browser execution and unsupported serverless MCP hosting are unsuitable. The scaffold leaves hosting unchosen.

Before enabling live discovery:

1. Obtain approved event access and verify its limits, then configure the credential **only on the backend** outside version control. `.env.example` lists names with empty values; the app does not load or use those credentials today. Never use a `VITE_` prefix for secrets.
2. Verify the supported harness version and readiness. Resolve and confirm Qloo entity/tag IDs for chosen favourites before depending on them.
3. Implement the server provider with bounded timeouts, quotas and retry behaviour. Handle `ok`, `empty`, `needs_input`, `partial`, `degraded` and `error` distinctly. Never infer identity or sensitive traits from taste.
4. Distinguish Qloo evidence from the product's editorial interpretation. Add genuine source information and avoid individual match probabilities.
5. Choose an approved model/agent design, if needed, and add integration tests before claiming live AI behaviour.
6. Review authentication, abuse/rate controls, origin policy, monitoring and deployment security before any network exposure. This local scaffold has no production access controls.

See [API access and limits](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/API_ACCESS.md) and [safe use](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/SAFE_USE.md). No live requests have been made in this project.

## Secrets and publishing

`.gitignore` excludes local environment files (except the blank example), credentials, dependencies, builds and logs. Do not put keys in source, browser bundles, prompts, screenshots or logs. Do not commit a filled `.env.example`. Do not make this repository public or deploy it without separate approval. Licence selection remains pending.
