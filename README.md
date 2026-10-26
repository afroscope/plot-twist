# PLOT TWIST

**Escape your algorithm without losing your taste.** Search for favourite artists, films and books, choose an adventure level, and revise a three-category discovery journey with feedback.

## Current state — 26 October 2026

Live Qloo search and all three recommendation categories have been verified in the local browser. A Fela Kuti starting point returned Femi Kuti, Leviathan and Gravity’s Rainbow. Keeping a film and skipping a book was also verified: the film remained and a new book appeared. A malformed optional music tag no longer discards the music category. Automated provider tests use fixtures, not live recordings.

Public deployment is being prepared with the included Render Blueprint. A deployed URL and Devpost submission will be recorded here after verification. This is a working discovery prototype; an explicit agent integration remains a submission requirement to complete.

## Run and configure

Use Node 22.19+ (24 recommended):

```sh
npm ci
npm run setup:qloo
npm run dev
```

The setup command accepts a key in a hidden terminal prompt and writes it to `.env`, which Git ignores. Keep keys out of chat, source, screenshots and public app forms. Configure the hosted key only in the hosting provider's private environment-variable settings. Existing environment variables take precedence over `.env`. Qloo requests use the fixed origin `https://hackathon.api.qloo.com`. No model key is required for this discovery loop.

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
- Local development binds to loopback. Public hosting explicitly sets `HOST=0.0.0.0` and uses `npm start`; production refuses to start without a Qloo key. Production adds a Content Security Policy, rejects browser requests marked cross-site, and caps API traffic at 120 requests per minute per instance, in addition to the provider's 30 uncached Qloo calls per minute. These shared limits protect the beta's quota; they are not per-visitor guarantees or a distributed abuse-protection system.

## Publish and keep updating

See [deployment instructions](docs/DEPLOYMENT.md) for the Render setup, secret entry, update workflow, rollback, and the judging freeze. See [submission preparation](docs/DEVPOST.md) for the remaining eligibility and submission work.

Source code and original bundled artwork are licensed under [MIT](LICENSE). Third-party dependencies retain their own licences. The licence does not grant rights to Qloo's API, catalogue data, names or trademarks; API use remains subject to Qloo's terms.

## Verify

For a missing recommendation category, run `npm run diagnose:qloo` locally. It uses the saved key and the real adapter to search for an exact Fela Kuti match, then requests the three categories (at most four calls, no retries). It prints only HTTP status, category, elapsed time, validation field paths/codes, and timeout/network classifications. It never prints the key, request headers, raw response bodies, or raw exceptions. The normal server does not enable this diagnostic output.

```sh
npm run lint
npm run typecheck
npm run test:qloo
npm test
npm run build
npm start
```

`npm run check` runs lint, all tests and the production build. GitHub Actions runs this on push. The API tests need permission to bind an ephemeral loopback port. Qloo provider tests require neither a live credential nor a socket.

**Remaining acceptance checks:** verify the public deployment anonymously, test another taste profile, compare adventure levels, test unavailable/missing matches, and inspect desktop/mobile layouts. Repeat keep/skip feedback on the hosted build. Never call fixture tests live verification.

## Sources reviewed

- [Qloo hackathon kit](https://github.com/qloo/qloo-hackathon-kit)
- [Entity search](https://github.com/qloo/docs-public/blob/main/reference/get-search.md)
- [Recommendation insights and example response](https://github.com/qloo/docs-public/blob/main/reference/basic-insights-use-case.md)
- [Insights parameters](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md)
- [Event access and limits](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/API_ACCESS.md)
- [Safe use](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/SAFE_USE.md)

Event starter email dated 22 October specifies the hackathon origin and permits custom tooling. Actual event quota and expiry must be checked with the issued credential. Publishing the app and submitting it to the event are separate steps.
