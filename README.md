# PLOT TWIST

**Escape your algorithm without losing your taste.** Select favourite artists, films and books, choose an adventure level, and let a discovery agent build a three-category journey using Qloo. No chat prompt is required.

## Current state — 26 October 2026

The agent implementation is on `feature/discovery-agent`. Automated tests verify the bounded tool loop with scripted model responses, API routing, Qloo validation, exclusions, feedback and failures. **Real-model access and recommendation quality remain unverified until an OpenAI API key is configured and live acceptance checks pass.** The existing direct Qloo flow has been verified locally across all three categories. Public deployment and final Devpost submission remain pending.

## Run and configure

Use Node 22.19+ (24 recommended):

```sh
npm ci
npm run setup:qloo
npm run setup:agent
npm run diagnose:agent
npm run dev
```

Skip `setup:qloo` if the Qloo key is already saved. Both setup commands use hidden terminal input and write only to ignored `.env`. During the agent prompt, **Ctrl+U clears the whole hidden line**; paste the key and press Enter. Use `npm run setup:agent -- --replace` to correct an existing model key. Keys remain on the backend. Exported environment variables override `.env`; restart the server after changes.

Get an OpenAI API key from https://platform.openai.com/api-keys. API usage requires available billing/credits; a ChatGPT subscription is separate. The model defaults to `gpt-6-luna`; `OPENAI_MODEL` can select another model supporting Chat Completions function calling with `reasoning_effort=none`. Qloo uses `https://hackathon.api.qloo.com`. The model uses `https://api.openai.com/v1/chat/completions` with `store:false` and no redirects.

Open **http://127.0.0.1:4173** and reload after restarting. A missing model connection is shown explicitly; **Qloo discovery** remains available separately. Agent errors never silently become ranked or demo journeys.

## Build a journey

1. Search, check the title/category/details, and select **1–5 favourites** under **I love this**.
2. Optionally select up to 10 **Not for me** examples and 15 **Already know it** items. An entity belongs to one group at a time. Both groups are excluded; only dislikes express negative taste.
3. Choose an adventure level. **Give more context** optionally adds up to 1,000 characters of preferences; select specific exclusions by title. Context is sent to OpenAI, not Qloo.
4. Select **Find my plot twist**. The model chooses Qloo category queries, signal subsets and ranking windows, inspects candidates, and may request alternatives or use a returned discovery as a bridge. It then selects one verified stop per available category.
5. **Keep this** retains that exact stop and adds it as a positive signal. **Already know it** excludes without implying dislike. **Not for me** adds a negative example. **More adventurous** excludes the current item and requires a changed retrieval strategy for that category. **Revise my journey** uses accumulated feedback. **Start fresh without feedback** resets feedback, preserving the starting brief.

The backend enforces candidate IDs, exact exclusions, kept stops, one stop per category, query budgets and deadlines independently of the model. Qloo retrieval evidence is generated from actual query signals. **The agent’s take** is separately labelled editorial interpretation; neither it nor adventure level is a measured novelty score or individual match probability. The model may still make poor interpretations—evaluate before claiming improved recommendation quality.

Feedback stays in page memory, up to 30 choices; reloading resets it. Qloo references expire after 30 minutes or server restart and require reselection. Descriptions come from Qloo metadata; abstract artwork is original CSS.

## Other modes

**Qloo discovery** is the comparison baseline: three fixed category queries, selecting from a three-item ranking window starting at rank 1/4/8 for gentle/curious/wild, clamped for short lists. Revisions rotate within that window. It uses no language model. **Try the demo** uses a hand-written catalogue, with no live API calls. These modes are labelled separately from agent discovery.

## API and limits

- `GET /api/health`: configuration only; `configured-unverified` does not verify authentication, billing or model availability.
- `GET /api/search?q=...&medium=Music|Film|Book`: Qloo lookup, 2–120 characters, at most 12 matches.
- `POST /api/journeys`: mode `agent`/`qloo`/`demo` (default demo for API compatibility), `favouriteIds`, `adventure`, `revision`, optional `dislikedIds`, `knownIds`, `context`, and `feedback` mapping IDs to `love`/`known`/`dislike`/`farther`/legacy `skip`. Groups must not overlap.
- Journey statuses: `ok`, `partial`, `degraded`, `empty`, `needs_input`. Authentication, quota, malformed results and exhausted budgets have explicit HTTP errors. The agent can repair invalid tool choices within its budget; upstream HTTP failures have no automatic retries.
- Per agent run: at most **6 model turns, 6 Qloo queries, 2,000 completion tokens per turn, 100,000 characters of conversation, and 75 seconds total**. Qloo requests time out after 8 seconds; model calls after 20. Disconnecting/cancelling stops further work. At most 2 simultaneous runs and 20 starts per hour per server process.
- Qloo has a bounded five-minute cache, 30-minute entity registry, and shared limit of 30 uncached calls/minute. Public API traffic is capped at 120 requests/minute per instance. Production adds a Content Security Policy and rejects browser API requests marked cross-site.
- All limits are process-local, reset on restart, and are shared across visitors. They are preview safeguards, **not a persistent spending cap or distributed abuse defence**. Keep one instance; configure provider billing controls and review usage before public launch. Avoid personal details in context.

## Verify and compare

```sh
npm run check
npm run diagnose:qloo
npm run diagnose:agent
```

`check` runs lint, all tests and the production build. Tests use fixtures and need no credentials; HTTP tests bind an ephemeral loopback port. Diagnostics use real saved credentials and may consume API allowance. They report only categories, status, counts and timing/error codes—not keys, headers, raw upstream bodies, context or internal reasoning. `diagnose:agent` verifies one live journey, not overall quality.

See [agent architecture and evaluation](docs/AGENT.md), [deployment](docs/DEPLOYMENT.md), and [Devpost preparation](docs/DEVPOST.md). **How this journey was built** is deferred. Internal factual event callbacks support diagnostics; no chain-of-thought is recorded or displayed.

## Licence and sources

Source and original artwork are [MIT](LICENSE). Dependencies retain their own licences. Qloo's API, catalogue data, names and trademarks remain subject to their terms.

- [Qloo hackathon kit](https://github.com/qloo/qloo-hackathon-kit)
- [Insights parameters](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md)
- [Event rules](https://qloo.devpost.com/rules)
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)

The event starter email permits custom tooling. This implementation calls Qloo directly through bounded model tools. Publishing and submitting are separate actions; judging eligibility or acceptance is not guaranteed.
