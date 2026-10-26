# PLOT TWIST deployment

The app uses one Node service to serve the built React frontend and the private Qloo backend. GitHub Pages alone cannot run the backend. The same repository supports local editing and public deployment; publishing does not freeze future development.

## Initial Render setup

1. Sign in at https://dashboard.render.com using GitHub. Review Render's account permissions and terms. When installing repository access, select only `afroscope/plot-twist`.
2. Choose **New → Blueprint**, select that repository and the `main` branch, and load `render.yaml`.
3. The Blueprint defines a Node 24 service in Frankfurt, a free instance, `npm ci --include=dev && npm run check` as the build command, `npm start` as the start command, and `/api/health` as the health check. It sets the public bind address and production mode. Render supplies PORT.
4. Enter the hackathon key into the private `QLOO_API_KEY` field and the model key into `OPENAI_API_KEY`. `OPENAI_MODEL` defaults to `gpt-6-luna`. Do not put credentials in GitHub, VITE_ variables, build files or browser code. Verify the agent locally before merging the agent branch to `main`. A running server without the model key can still serve the explicitly labelled Qloo baseline, but is not an agent-ready submission.
5. Review the plan and deploy. Record the actual assigned HTTPS URL after Render reports success; a guessed service slug is not proof of deployment.
6. Open that URL without signing in. Choose Agent discovery, search, select a favourite and generate all three categories. Keep a book, mark music More adventurous, and revise. Repeat with known/disliked exclusions. Follow the acceptance checks in [AGENT.md](AGENT.md). Inspect desktop/mobile layouts and blocked assets. Verify that `/.env` never returns the environment file.

Free instances sleep after 15 minutes of inactivity and can take about a minute to wake. This is suitable for the first public beta, but an always-on paid compute instance is recommended for judging. Review the current cost before upgrading; no paid plan has been authorized by this repository configuration. If upgrading through the dashboard, also update the Blueprint plan to match before the next Blueprint sync.

## Routine updates

1. Make UI or code edits locally or on a feature branch. Preview using `npm run dev`.
2. Run `npm run check` in an environment that permits the HTTP tests to bind a local port.
3. Commit and push/merge to `main` in GitHub Desktop. GitHub Actions runs checks.
4. Render is configured to deploy **after CI checks pass**, preserving the same public URL. This requires the connected GitHub app; public-repository-URL imports alone do not enable automatic deployments.
5. Check the successful deployment, then smoke-test the live URL. For a regression, revert the faulty commit and push the revert. Render's dashboard rollback is also available, subject to the plan's retention limits.

The app currently uses process-local caches and an entity registry. Keep one instance; multiple instances need shared state. Sleeping, restarting or deploying resets catalogue references and may require visitors to reselect favourites. Feedback is temporary in the visitor's page and is not saved as an account/profile. Rate limits are shared across visitors.

Agent preview limits are 2 simultaneous runs and 20 starts/hour/process, with at most 6 model turns and 6 Qloo queries/run. These limits reset on restart and are not a durable spending cap. Configure provider billing controls and monitor usage before making the demo public. Test the expected judging traffic against the shared allowance before launch; do not silently remove the limits.

## Judging version

The event deadline is 30 October 2026 at 11:45 p.m. EDT (31 October at 03:45 UTC/Ghana). Official judging runs 2–5 November 2026, ending 5 November at 11:45 p.m. ET (6 November at 04:45 UTC/Ghana, after the US daylight-saving change).

Before the deadline, submit the demo and public repository URLs on Devpost and check that the entry is actually submitted. A saved portfolio draft is not a submitted hackathon entry.

At the deadline, tag the tested commit and stop automatically changing the submitted deployment. Set Render auto-deploy to Off and keep its Blueprint setting consistent, or bind the judging service to a frozen branch. Continue new work on a separate development branch/preview. Preserve the submitted version and free access through judging; the rules prohibit changes to submissions after the deadline except permitted organizer corrections. A portfolio can still be updated separately.

## Sources

- https://qloo.devpost.com/
- https://qloo.devpost.com/rules
- https://render.com/docs/blueprint-spec
- https://render.com/docs/deploys
- https://render.com/docs/free
