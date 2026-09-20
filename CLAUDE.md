# CLAUDE.md — Between the Lines (nhl-line-combos-app)

## What It Is

"Between the Lines — Hockey, in context." Free NHL site: tonight's games with line moves + starting goalies, line combinations, line-move feed, injuries, player stats, matchups, picks. Strategy: grow free daily users → later paid picks analysis → hockey-news Instagram.

Live: https://nhl-between-the-lines-app.vercel.app (Vercel project name is still `nhl-line-combos-app`).

## Stack

- React 18 + Vite 7, `lucide-react` icons, `@vercel/analytics`. No router library — see Routing.
- Vercel: auto-deploys every push to `main` (including bot data commits). `/api/*.js` are serverless proxies to the NHL API; `vite.config.js` mounts the same handlers in dev.
- Python scrapers in `scraper/`, run by GitHub Actions in this repo (the old `hg913488/nhl-line-combos` repo's workflows are disabled).

## Commands

```bash
npm install
npm run dev      # → http://localhost:5173 (local /api works)
npm run build
npm test         # node --test tests/*.test.js
python3 -m unittest discover -s tests -p 'test_*.py'
```

Deploy: push to `main`. CI (`.github/workflows/ci.yml`) builds and runs both test suites.

## Key Files

| File | What |
|------|------|
| `src/App.jsx` | Most views + root App (~1,650 lines). Views are functions in one file. |
| `src/routes.js` | URL ↔ view state (pure, unit tested in `tests/routes.test.js`) |
| `src/styles.css` | Most styling; `makeCss()` in App.jsx holds palette-dependent CSS |
| `src/PlayerDetails.jsx` | Player modal (gamelog, momentum, EDGE) |
| `src/useSchedule.js` / `src/data-client.js` | Schedule hook (60s refresh) / cached `getJSON` |
| `api/*.js` | schedule, standings, roster, gamelog, news (cheerio), player-search, player-momentum, player-edge, playoff-* |
| `scraper/scrape_lines.py` → `data/lines.json` | Daily Faceoff lines/PP + ESPN injuries |
| `scraper/lineup_history.py` → `data/lineup_changes.json` | Line Moves feed (diff of consecutive snapshots, newest first) |
| `scraper/scrape_goalies.py` → `data/goalies.json` | DF starting goalies (empty in preseason) |
| `scraper/scrape_goals_against.py` → `data/goals_against_by_position.json` | GA by position; drives Picks |
| `scraper/picks_log.py` → `data/picks_log.json` | Locked pick signals + graded results (track record) |
| `vercel.json` | SPA rewrite (all non-`/api/` paths → index.html) |
| `src/GameView.jsx` + `src/RinkShotMap.jsx` + `src/game.css` | Live game center; polls `/api/game` every 20s while a game is live |
| `api/game.js` | Trimmed gamecenter feed (play-by-play + right-rail): score, clock, shots with rink coordinates, goals, team stats |
| `src/picks-signal.js` | `rankPositions()` — league-relative matchup signal; mirrored by `rank_positions()` in `scraper/picks_log.py` (parity fixture: `tests/fixtures/picks_index_cases.json`) |
| `src/page-meta.js` | Single source of page titles/descriptions/share images; used by the client and by `middleware.js` |
| `middleware.js` | Vercel Routing Middleware: injects per-route `<head>` metadata into the SPA shell. Fails open — any error serves the untouched page |
| `api/og.js` + `lib/og/` | Share cards (1200×630 PNG) and Instagram cards (1080×1350 JPEG) via Satori + resvg |
| `scripts/instagram-post.mjs` | Daily carousel post; dry-run unless `IG_PUBLISH=true` |
| `scraper/build_prop_sheet.py` → `data/prop_sheet.json` | Player sheet: role, PP unit, last-10 form, opponent index, opposing goalie, flags |

## Routing

`/` Tonight · `/teams` · `/teams/:slug` · `/compare?teams=a,b` · `/games/:id` · `/news` · `/reporters` · `/line-moves` · `/injuries` · `/players` · `/matchups` · `/playoffs` · `/picks`. Unknown paths → `/`. App holds one `view` state; an effect pushes history (replace for same-section changes like compare toggles) and sets `document.title` (from `src/page-meta.js`); `popstate` re-parses. `<Analytics route path>` sends page views per route.

## Gotchas

- **Module-level mutable state is intentional:** `P` (palette) and `triggerPlayerLookup` are assigned during render. Don't convert to React state.
- **Palette:** `DARK_PALETTE`/`LIGHT_PALETTE` in App.jsx, exposed as CSS vars (`--bg`, `--dove`, `--accent`, …) on `.app-shell`.
- **Breakpoint:** mobile is `max-width: 767px` (JS `isMobile` is `< 768`). Later rules in styles.css can override earlier media rules — prefix with `.app-shell` when a mobile override doesn't apply.
- **IIHF view** (`IIHFView`) is no longer routed; its data still imports.
- **Schedule CSV** (`src/schedule.csv`) is legacy; live schedule comes from `/api/schedule`.
- **Cron timing:** GitHub delays `schedule` runs at the top of the hour — keep cron minutes off `:00`.
- **Bot data commits** land on `main` several times a day — pull before pushing.
- **Picks signal must stay in sync** across `src/picks-signal.js` and `scraper/picks_log.py`; both run against `tests/fixtures/picks_index_cases.json`.
- **NHL stats API caps pages at 100 rows.** Use `limit=-1`. Paging by a larger page size silently skips rows (this was live for months and undercounted goals by ~75%).
- **Lineup data reflects real roster moves.** Before "fixing" a surprising name, check `api-web.nhle.com/v1/roster/{TEAM}/{season}` — several 2026 offseason moves look like bugs but are not.
- **Share-card data files** are read at runtime in `lib/og/card-data.js` through literal `new URL(...)` paths so Vercel's file tracing bundles them. A computed path would ship an empty card.
- **`vite.config.js` mounts both handler styles:** classic `(req, res)` handlers and web-standard `export default { fetch }` (used by `api/og.js`).
- **Data licensing:** DF and NHL.com data are fine for the free tier with attribution; get licensing/legal review before putting them behind a paywall.

## Screenshots

Workspace `screenshot.mjs` uses Puppeteer; its bundled Chrome may be missing — pass `executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`.
