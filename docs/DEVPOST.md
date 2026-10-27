# Devpost preparation — not yet submitted

## Requirements still to complete

- Deploy and verify an externally hosted, functional demo with anonymous access.
- Make https://github.com/afroscope/plot-twist public; ensure its MIT licence is detected.
- The selection-led discovery agent is implemented and locally live-tested with Qloo and OpenAI. Complete the remaining hosted acceptance and recommendation-quality comparison checks in [AGENT.md](AGENT.md) before describing it as live-verified.
- Add the verified live URL, repository URL, description, testing instructions and screenshots to the existing Devpost entry.
- Submit before 30 October 2026 at 11:45 p.m. EDT / 31 October at 03:45 Ghana time. Confirm the entry's submitted state.
- Keep the submitted version and free access available through the judging period. Demo videos are optional; the functional public app is required.

## Description draft reflecting the current app

**PLOT TWIST — Follow your taste. Leave room for surprise.**

PLOT TWIST helps curious listeners, viewers and readers find their next cultural discovery. Start with artists, films or books you already love, choose how far you want to wander, and receive a journey across music, film and literature.

The selection-led agent implementation turns favourites, dislikes, familiar items and optional context into a discovery brief. It chooses Qloo searches, inspects the returned candidates, and can change signals, explore another ranking window or follow a retrieved discovery into another category. The backend only permits verified Qloo candidates and enforces exclusions and kept discoveries. The expandable journey explanation records the submitted brief, actual searches, candidate counts and the retrieval source of each final pick. Local live-model validation has passed; public deployment validation is pending.

Adventure level guides an editorial discovery strategy, not a Qloo novelty score or a prediction about an individual's identity. Keep a book while asking the agent to take the music further. Familiarity and dislike remain separate feedback. Explanations distinguish Qloo retrieval evidence from the agent's interpretation. Feedback stays within the page session; API keys remain on the backend.

## Testing instructions draft

1. Open the public demo URL (insert only after deployment is verified).
2. Leave **Agent discovery** selected. Search for **Fela Kuti**, then select the artist match under **I love this**. If model configuration is unavailable, this is not an agent-ready deployment.
3. Choose **The scenic route** and select **Find my plot twist**.
4. Review the music, film and book suggestions. Results may change as Qloo's catalogue and ranking change.
5. Select **Keep this** for the book and **More adventurous** for music, then **Revise my journey**. The book remains and music is excluded and searched with a changed strategy. Repeat with **Already know it** and **Not for me**; neither should return in the revised journey.
6. Use **Edit my taste** to try another starting point. The separately labelled demo mode is a fixed example catalogue, not evidence of live Qloo output.

Verify these steps with the real model and on the public deployment before final submission. Never include a credential in descriptions, screenshots or the repository. Do not claim improved recommendation quality from scripted tests alone.

Official requirements: https://qloo.devpost.com/ and https://qloo.devpost.com/rules
