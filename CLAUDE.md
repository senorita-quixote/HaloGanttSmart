# GanttSmart (Halo fork)

Lizzie's fork of [sideq-io/ganttsmart](https://github.com/sideq-io/ganttsmart), a Gantt chart for Linear.
React 19 + TypeScript + Vite 8 + Tailwind 4. Supabase for auth/DB, Netlify for hosting (upstream).

## Remotes and branches

- `origin` = https://github.com/senorita-quixote/HaloGanttSmart (our fork, public)
- `upstream` = https://github.com/sideq-io/ganttsmart (original project, AGPL-3.0)
- `main`: mirrors `upstream/main`. Never commit to it.
- `feat/<name>`: one branch per change, always branched from `main` (not `halo`), so each can become an upstream PR on its own.
- `halo`: `main` + all our `feat/*` branches merged in. This is what we run day to day (and will deploy later).
- Halo-only files (like this `CLAUDE.md`) live on `halo` only. Never put them on a `feat/*` branch.

### Workflow for a new change

```bash
git checkout main && git pull --ff-only upstream main
git checkout -b feat/<name>
# ...make the change, commit...
git push -u origin feat/<name>
git checkout halo && git merge feat/<name> && git push
```

### Pulling upstream fixes

```bash
git fetch upstream
git checkout main && git merge --ff-only upstream/main && git push origin main
git checkout halo && git merge main && git push
```

## Running locally ("local mode")

- `npm run dev` → http://localhost:5173 (redirects straight to `/app`).
- Local mode is on when `VITE_LINEAR_API_KEY` is set in `.env` (gitignored, never commit it) and the app runs under the dev server. It skips Supabase sign-in and calls Linear directly with that personal API key. Production builds ignore the key.
- Implemented in `src/lib/localMode.ts` (on `feat/local-mode`). `src/lib/supabase.ts` uses a placeholder client in local mode.
- Hidden in local mode because they need Supabase: Share links, account menu, Plan vs Actual toggle. Planning-history logging (`usePlanningHistory`) no-ops because there's no Supabase session.

## Things to know before changing code

- **Linear writes are real.** Dragging bars, cycling status, editing milestones and dependencies change the real Linear workspace. Test on throwaway issues.
- All Linear GraphQL calls live in `src/api/linear.ts` (`gql()` helper). The key is sent as-is in `Authorization`.
- Due dates use Linear's `dueDate` field. Linear issues have no start date, so the start date is a `start: DD-MM-YY` line in the issue description (`parseStartDate` / `updateIssueStartDate`). Don't break that format.
- Main data hook: `src/hooks/useLinearData.ts` (polls every 30s, optimistic updates, undo). Chart UI: `src/components/GanttChart.tsx`, `GanttRow.tsx`. Header/toolbar: `Header.tsx` (`Toolbar.tsx` is unused).
- UI preferences (theme, selected project, row order, zoom, time scale) are in `localStorage`, not Supabase.

## Checks and conventions

- Before committing: `npm run lint` and `npx tsc -b`. `npm run build` for a full check. There is no test suite.
- Upstream is not Prettier-clean. Don't run Prettier on whole files; it creates huge unrelated diffs. Match the surrounding style.
- Don't run `npm audit fix` / `npm audit fix --force`. It rewrites `package.json`/`package-lock.json` and broke the install once. Use `npm ci` to reinstall.
- Keep `feat/*` changes small and focused, following upstream's CONTRIBUTING.md (small PRs, lint + typecheck passing, screenshots for UI changes). For Halo-specific behavior that upstream might not want, put it behind an env flag (like `VITE_AUTH_MODE` / `VITE_LINEAR_API_KEY`).
- `.claude/launch.json` comes from upstream and has a Windows Node path; leave it alone.

## Roadmap for this fork

1. **Done:** local mode, just Lizzie, on localhost.
2. Free Supabase project (run `supabase/migrations/*.sql`) for Plan vs Actual. Baselines are recorded from first view onward, not backfilled.
3. Netlify site off `halo` + deploy the `share-roadmap` edge function for share links.
4. Linear OAuth app so teammates sign in with their own Linear accounts.
