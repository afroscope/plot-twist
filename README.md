# PLOT TWIST

**Escape your algorithm without losing your taste.** Search for favourite artists, films and books, choose an adventure level, and revise a three-category discovery journey with feedback.

## Current state — 26 October 2026

The Qloo backend and live-mode interface are implemented. **Live Qloo access and the end-to-end browser experience are not yet verified.** No event credential was found in the original project or current process. The development session permits builds but blocks outbound network calls and listening sockets, so the three HTTP integration tests and browser walkthrough cannot run there. Provider tests use explicit contract fixtures, not live recordings.

The private repository is `afroscope/plot-twist`. The working copy for this update is:

`/Users/afroscope/.codex/.chatgpt-projects/g-p-67d62ec56378819194cbdd85f7d8e1e3/plot-twist`

The original 22 October copy in Documents/Codex remains unchanged. No public deployment or hackathon submission has been made.

## Run and configure

Use Node 22.19+ (24 recommended):

```sh
npm ci
npm run setup:qloo
npm run dev
```

The setup command accepts a key in a hidden terminal prompt and writes it to `.env`, which Git ignores. Do not paste keys into chat, source, screenshots or browser forms. Existing environment variables take precedence over `.env`. The event origin is fixed to `https://hackathon.api.qloo.com`; an event key will not be sent to any other host. No model key is required for this discovery loop.

Open **http://127.0.0.1:4173**. Search for a favourite, check the returned name/category/details, and select the correct result. Choose 1–5 favourites and an adventure level, then **Find my plot twist**. **Keep this** retains a result and includes it in subsequent Qloo signals. **Try another** excludes that result. **Revise my journey** requests an updated selection. Feedback is in page memory (maximum 30 choices); reloading resets it. Catalogue references expire after 30 minutes and require reselection.

**Try the demo** explicitly switches to the original hand-written catalogue. Missing credentials, failed queries or empty Qloo results never fall back to demo data.

## What adventure level means

Qloo supplies an affinity-ranked pool of up to 12 entities per category. PLOT TWIST selects from a three-item window starting at rank 1 (gentle), 4 (curious) or 8 (wild), clamped for shorter lists. Revisions rotate within the available window. This is a transparent product heuristic, **not a validated novelty measure**. Live coverage and perceived recommendation quality still need testing. Kept results remain fixed; rejected items are excluded both upstream and locally.

Connection text states which seeds were supplied to Qloo. It does not invent a psychological explanation or present an affinity as a probability about an individual. Descriptions come from returned catalogue metadata; abstract artwork is original CSS. This implementation uses Qloo directly over HTTPS, rather than the optional CLI/MCP harness. It is not yet an LLM-driven autonomous agent.

## API and failure behaviour

- `GET /api/health`: reports configuration only; `configured-unverified` is not a successful authentication check.
- `GET /api/search?q=...&medium=Music|Film|Book`: server-only Qloo lookup; 2–120 characters, at most 12 matches. Omit medium for all three categories.
- `POST /api/journeys`: `mode` (`qloo` or `demo`, default demo), 1–5 distinct `favouriteIds`, `adventure` (`gentle`, `curious`, `wild`), `revision` (0–100), optional `feedback` mapping IDs to `love`/`skip`.
- Qloo statuses: `ok`, `partial` (missing category), `degraded` (failed category with usable results), `empty`, `needs_input` (expired/unrecognised IDs). Total failures use explicit HTTP errors, including authentication, quota and malformed upstream responses.
- Credentials remain server-side. Requests have an 8-second deadline, no automatic retries, no redirect following, a conservative local budget of 30 uncached calls/minute, and a bounded five-minute memory cache. This local ceiling does not claim to match the event quota.
- The server binds only to loopback. Authentication and production abuse controls must be designed before external hosting.

## Verify

```sh
npm run lint
npm run typecheck
npm run test:qloo
npm test
npm run build
npm start
```

`npm run check` runs lint, all tests and the production build. GitHub Actions runs this on push. The API tests need permission to bind an ephemeral loopback port. Qloo provider tests require neither a live credential nor a socket.

**Pending live acceptance check:** configure the event key, search and confirm at least two different taste profiles, generate each journey, compare adventure levels, keep one result and reject another, verify the revision, check unavailable/missing matches, and inspect the interface on desktop and mobile. Never call fixture tests live verification.

## Sources reviewed

- [Qloo hackathon kit](https://github.com/qloo/qloo-hackathon-kit)
- [Entity search](https://github.com/qloo/docs-public/blob/main/reference/get-search.md)
- [Recommendation insights and example response](https://github.com/qloo/docs-public/blob/main/reference/basic-insights-use-case.md)
- [Insights parameters](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md)
- [Event access and limits](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/API_ACCESS.md)
- [Safe use](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/SAFE_USE.md)

Event starter email dated 22 October specifies the hackathon origin and permits custom tooling. Actual event quota and expiry must be checked with the issued credential. Repository remains private and unlicensed; publishing and submission are separate steps.
