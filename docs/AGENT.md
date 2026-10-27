# Selection-led discovery agent

## Decisions delegated to the model

The selection UI creates a structured brief: confirmed entity IDs with catalogue metadata, likes, dislikes, familiarity, adventure level, optional context and session feedback. The model chooses `explore` arguments and receives actual results before its next decision. It can choose signal subsets, category-specific searches, offsets 0/12/24, and previously retrieved candidates as cultural bridges. It can revise a weak/empty category while retaining other discoveries. `finish_journey` names verified IDs and supplies short editorial interpretation.

This is one bounded agent using two functions. The older ranked provider remains a comparison mode; it is never used as a hidden fallback. A chatbox, extra agents, or a mandatory re-search of already resolved titles would not improve this design.

## Boundaries enforced in code

- Qloo is the only source of candidate IDs, titles, descriptions and category metadata. Final IDs must appear in this run's retrieval pool or the user's kept items.
- Every unkept category must be attempted; every category with candidates must have one final stop. Failed or empty categories can produce a clearly labelled partial result.
- Favourite, disliked, familiar and rejected IDs are excluded from discovery pools. Kept items are retained separately. Unknown/expired references require reselection before model calls.
- Negative and familiar examples remain separate in the model brief. Neither can become a positive tool signal. No genre-wide negative inference is supplied by the app.
- "Farther" requires a deeper ranking window, changed positive signal subset, or a retrieved bridge. This is an enforced strategy change, not proof that the user will perceive greater novelty. Repeated requests do not promise monotonically increasing novelty.
- Hard limits: six turns, six upstream queries, two simultaneous runs, twenty starts/hour/process, 75 seconds/run, 20 seconds/model call, 8 seconds/Qloo call. Input history and completion size are bounded. User cancellation aborts remaining work; it cannot undo already billed requests.
- The model cannot choose endpoints, arbitrary tools, credentials or filesystem operations. Titles, descriptions and context are treated as untrusted data. Tool arguments and final selections are independently validated; model instructions are not the sole protection.
- Explanations have two parts: a server-generated statement of the actual Qloo signals and a labelled model interpretation. No invented Qloo scores, exact novelty distances, personal profiling or evidence-free claims of superiority.
- State is temporary and process-local. Public launch still needs provider billing controls, quota monitoring and the deployment checks. `store:false` is a model API setting, not a claim of zero provider retention.

## What automated tests establish

Scripted-model tests verify that tool results reach the next model turn, conditional queries and bridges work, IDs and keeps are enforced, feedback semantics are preserved, budgets terminate runs, cancellation releases resources, and errors do not leak credentials or upstream text. Adapter tests verify the actual HTTP request shape with an injected transport. Existing Qloo and HTTP tests remain in the full suite.

These tests establish orchestration correctness. They **do not** measure a real model's decisions, interpretation accuracy, or user satisfaction. `npm run diagnose:agent` supplies the first live connectivity check after private setup.

## Live acceptance before launch

1. Configure the model key privately, run `diagnose:agent`, restart the server and reload. Verify Agent discovery returns Music, Film and Book and says `method: agent` in the API response.
2. Select two favourites across categories. Add one familiar item and one disliked item. Verify neither appears, and explanations accurately identify their Qloo signals.
3. Keep the book and mark music More adventurous. Verify the book ID stays fixed, the music ID changes, and no excluded IDs return. Repeat with Already know it and Not for me.
4. Give a small contextual preference, then inspect whether the agent's choices and interpretation address it without unsupported factual claims. Try deliberately conflicting context; hard exclusions/keeps must still hold.
5. Exercise gentle/curious/wild, sparse matches, a category outage, cancellation, missing/wrong credentials and the shared rate limit. No agent error may silently become a demo or baseline result.
6. Check keyboard navigation, mobile/desktop layout, optional context, mode switching and anonymous hosted access. Confirm keys are absent from browser bundles, git, responses and screenshots.

## Quality comparison, not a marketing claim

Use 8–12 taste briefs spanning single-medium and mixed-medium favourites, familiar exclusions, dislikes, sparse metadata and conflicting tastes. Run each brief through Agent discovery and the fixed Qloo discovery baseline. Keep the initial favourites and adventure level the same. Rotate which result is shown first and hide mode labels during rating where practical.

Record relevance, useful surprise and explanation trust on a 1–5 scale; record whether the person would try a stop. Separately record exclusion/keep violations, returned categories, failed journeys, total latency and number of Qloo/model calls. Treat unsupported factual statements as errors, not stylistic preferences. Repeat the keep-book/change-music task and record whether the requested change succeeded.

Success gates: zero invented IDs or exclusion/keep violations; consistent usable three-category results when Qloo supplies candidates; no unsupported explanation claims in the reviewed sample; demonstrable benefit on surprise/context/feedback without an unacceptable latency or failure increase. Report the actual sample size and disagreements. If the agent does not improve the experience, adjust its prompt/strategy and repeat. An LLM-only comparator can be added later, but it must not be presented as a verified Qloo result.

## Journey explanation view

The compact, native expandable view displays the brief submitted for that edition, category searches in request order, their actual taste signals and ranking windows, success/failure, usable candidate counts, and the source search for each final pick. Kept discoveries are marked separately and are not counted as newly retrieved candidates. The total counts distinct candidate IDs; per-search counts may overlap. Invalid or duplicate tool requests that never executed are not presented as searches.

The user’s own optional context is displayed only in their journey response. No system instructions, raw tool bodies, credentials, hidden reasoning or fabricated search steps are exposed. Nothing is added to a persistent profile or logged by this view. The separate diagnostic callback continues to expose only category/count events.

On 27 October 2026, a live production-build browser check starting from William Onyeabor returned three picks after a failed initial music query and a follow-up retrieval using a discovered book. The explanation matched all six actual searches, the failure/recovery, 54 unique candidates and the source query of each final pick. This validates that run, not a general claim of better recommendation quality.
