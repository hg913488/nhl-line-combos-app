# CLAUDE.md — Between the Lines (nhl-line-combos-app)

## What It Is

"Between the Lines — Hockey, in context." Free NHL site: tonight's games with line moves + starting goalies, line combinations, line-move feed, injuries, player stats, matchups, picks. Strategy: grow free daily users → later paid picks analysis → hockey-news Instagram.

Live: <https://www.betweenthelineshockey.com> (Vercel project name is still `nhl-line-combos-app`).

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

| File                                                                      | What                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.jsx`                                                             | Most views + root App (\~1,650 lines). Views are functions in one file.                                                                                                |
| `src/routes.js`                                                           | URL ↔ view state (pure, unit tested in `tests/routes.test.js`)                                                                                                         |
| `src/styles.css`                                                          | Most styling; `makeCss()` in App.jsx holds palette-dependent CSS                                                                                                       |
| `src/PlayerDetails.jsx`                                                   | Player modal (gamelog, momentum, EDGE)                                                                                                                                 |
| `src/useSchedule.js` / `src/data-client.js`                               | Schedule hook (60s refresh) / cached `getJSON`                                                                                                                         |
| `api/*.js`                                                                | schedule, standings, roster, gamelog, news (cheerio), player-search, player-momentum, player-edge, playoff-\*                                                          |
| `scraper/scrape_lines.py` → `data/lines.json`                             | Daily Faceoff lines/PP + ESPN injuries                                                                                                                                 |
| `scraper/lineup_history.py` → `data/lineup_changes.json`                  | Line Moves feed (diff of consecutive snapshots, newest first)                                                                                                          |
| `scraper/scrape_goalies.py` → `data/goalies.json`                         | DF starting goalies (empty in preseason)                                                                                                                               |
| `scraper/scrape_goals_against.py` → `data/goals_against_by_position.json` | GA by position; drives Picks                                                                                                                                           |
| `scraper/picks_log.py` → `data/picks_log.json`                            | Locked pick signals + graded results (track record)                                                                                                                    |
| `vercel.json`                                                             | SPA rewrite (all non-`/api/` paths → index.html)                                                                                                                       |
| `src/GameView.jsx` + `src/RinkShotMap.jsx` + `src/game.css`               | Live game center; polls `/api/game` every 20s while a game is live                                                                                                     |
| `api/game.js`                                                             | Trimmed gamecenter feed (play-by-play + right-rail): score, clock, shots with rink coordinates, goals, team stats                                                      |
| `src/picks-signal.js`                                                     | `rankPositions()` — league-relative matchup signal; mirrored by `rank_positions()` in `scraper/picks_log.py` (parity fixture: `tests/fixtures/picks_index_cases.json`) |
| `src/page-meta.js`                                                        | Single source of page titles/descriptions/share images; used by the client and by `middleware.js`                                                                      |
| `middleware.js`                                                           | Vercel Routing Middleware: injects per-route `<head>` metadata into the SPA shell. Fails open — any error serves the untouched page                                    |
| `api/og.js` + `lib/og/`                                                   | Share cards (1200×630 PNG) and Instagram cards (1080×1350 JPEG) via Satori + resvg                                                                                     |
| `scripts/instagram-post.mjs`                                              | Daily carousel post; dry-run unless `IG_PUBLISH=true`                                                                                                                  |
| `scraper/build_prop_sheet.py` → `data/prop_sheet.json`                    | Player sheet: role, PP unit, last-10 form, opponent index, opposing goalie, flags                                                                                      |

## Routing

`/` Tonight · `/teams` · `/teams/:slug` · `/compare?teams=a,b` · `/news` · `/reporters` · `/line-moves` · `/injuries` · `/players` · `/matchups` · `/playoffs` · `/picks`. Unknown paths → `/`. App holds one `view` state; an effect pushes history (replace for same-section changes like compare toggles) and sets `document.title`; `popstate` re-parses. `<Analytics route path>` sends page views per route.

## UI Copy Casing

- Uppercase UI chrome through CSS `text-transform`, not typed all-caps in source: navigation, tabs, dropdown values, buttons, labels/eyebrows, tags/badges, and table headers. Use Syne or Space Mono at 8-10px with tracking.
- Sentence case stays for page and section headings, body copy, notes, player names, and team names inside content.
- Jersey-style lineup tiles are the one player-name exception: uppercase is part of the uniform treatment, while surrounding lineup headings still follow the standard hierarchy.
- When touching existing UI, apply this rule to the changed surface and call out nearby mismatches instead of rewriting the whole site in the same pass.







## Instagram carousels

Rules learned the hard way building the daily and recap sets. Templates live in
`lib/og/ig-cards.js` (daily) and `lib/og/recap-cards.js` (recap); tokens in `lib/og/theme.js`.

**House look**

- **Ice white is the default.** `applyTheme` picks light unless `theme=dark`/`IG_THEME=dark`.
  Scheduled posts alternate by Eastern day (even epoch day light, odd dark), set in `instagram.yml`; a manual run's theme box overrides it.
  Hockey is played on white, headshots carry better on it, and it stands out in a feed of dark accounts.
- **Never flat near-black on the pale ground.** Ink is `#1E2A38`, display type a step lighter at `#2C3D4E`.
  Large type at full ink weight reads as a black slab sitting *on* the gradient instead of belonging to it.
- **Team colour is the accent** — hero surname, watch figures, bar fills. One colour per card, from `TEAM_COLORS`.
- **Real photography over lists.** Headshots (`playerHeadshots`) and crests beat another column of names.
- **Every card is slide-aware:** `slideMarker(index, total)` puts an "02 of 04" pill on each,
  so a slide saved or reposted alone still says where it sat. **No dot row** — Instagram draws its own
  dots under the carousel, and a second set on the artwork reads as duplicated app chrome.
- **Don't set small Space Mono labels below 18px** at 1080 wide — the bold `W` closes up and reads as `M`.

**Satori constraints** (it lays out, it does not draw)

- Flexbox only. No filters, no `space-evenly` (use `space-around`), no CSS `color-mix`.
- Any div with more than one child needs `display: flex` — the `h()` factory adds it, so build through `h`/`row`/`col`.
- Images need explicit `width` and `height`. Never pass `fontWeight: undefined` or an empty text node.
- **Colours must be hex wherever an alpha suffix is appended** (`` `${wash(colour)}1F` ``). `lift()`/`wash()`
  in `ig-cards.js` return clamped hex for exactly this reason — returning `rgb()` renders the band solid black.
- **NHL logos ship on a 3:2 canvas** (viewBox 960×640). Use `logoImg()`, which reads the real ratio; a square box skews the crest.
- **Draw rules, don't type glyphs.** The recap score separator is a `div` (46×10 dash), not a dash character — the
  display face's dash sits badly against the huge numerals. `marginTop` drops it onto the digits' optical centre,
  which is below the line box's centre.
- **Satori does not clip — it overflows silently.** A fixed-width row whose children don't fit spills over them and
  past the card edge with no error. Any row with a fixed width is a budget: on the recap final card the 968px inner
  width is two 176-tall crests (264 wide each) + the 410 score row + two 16 gaps. Change one number and re-check
  the others.
- Primitives (rink, lines) are SVG data URIs — see `lib/og/rink.js`, which has a `plain: true` mode for faint backdrops.

**Checking a card before you ship it**

`npm run dev` mounts `/api/og` at :5173, so render and *look* rather than deploying blind:

```bash
curl -s -o out.png "http://localhost:5173/api/og?type=ig&recap=<gameId>&card=final&index=1&total=4"
```

- **Measure, don't eyeball.** Scan for ink with PIL to find element centres. Complaints about "spacing" have twice
  turned out to be a whole block off the card's centre axis rather than uneven gaps.
- **A label column with no counterweight pushes a grid off-centre.** The recap period table needs a matching gutter
  on the right, or the numbers centre 48px right of the score and result line above them.
- **After any width change, check the outer 8px columns for ink** — that is how crests running off the card get caught.
- **`index` is 1-based when posting**; `/api/og` subtracts one. Rendering with `index=0` shows "00 of 04" — that is a
  bad test parameter, not a bug.
- **Back a data complaint with the data.** Goal marks that look misplaced are usually right: `api/game.js` already
  normalises for teams switching ends, and goals really do cluster in the crease. Check `/api/game?id=` first.

**Publishing**

- JPEG only, max 10 children, and each image must be a **public URL** — cards are fetched from the live site,
  so **the Vercel deploy must be Ready before posting**, or containers fail on a stale route.
- Flow is container per slide → poll `status_code` → carousel container → `media_publish`.
- Every slide gets `alt_text`.
- **Idempotency keys by kind:** dailies by `date`, recaps by `game_id`; each log entry in `data/instagram_log.json`
  carries a `kind`. They must never share a key — a daily would otherwise block that same night's recap.
  `IG_FORCE=true` reposts.
- Test a card with `curl` against `/api/og?type=ig&...&format=jpg` before dispatching the workflow.
- **Republish the review artifact whenever the cards change** — it is the user's review surface, not a local Preview
  window. Both themes of both sets, with slide notes and the caption. Pass the existing URL so the link stays stable.

## Gotchas

- **Module-level mutable state is intentional:** `P` (palette) and `triggerPlayerLookup` are assigned during render. Don't convert to React state.
- **Palette:** `DARK_PALETTE`/`LIGHT_PALETTE` in App.jsx, exposed as CSS vars (`--bg`, `--dove`, `--accent`, …) on `.app-shell`.
- **Breakpoint:** mobile is `max-width: 767px` (JS `isMobile` is `< 768`). Later rules in styles.css can override earlier media rules — prefix with `.app-shell` when a mobile override doesn't apply.
- **IIHF view** (`IIHFView`) is no longer routed; its data still imports.
- **Schedule CSV** (`src/schedule.csv`) is legacy; live schedule comes from `/api/schedule`.
- **Cron timing:** GitHub delays `schedule` runs at the top of the hour — keep cron minutes off `:00`.
- **Bot data commits** land on `main` several times a day — pull before pushing.
- **Picks signal must stay in sync** across `src/picks-signal.js` and `scraper/picks_log.py`; both run against `tests/fixtures/picks_index_cases.json`.
- **NHL stats API caps pages at 100 rows.** Use `limit=-1`. Paging by a larger page size silently skips rows (this was live for months and undercounted goals by \~75%).
- **Lineup data reflects real roster moves.** Before "fixing" a surprising name, check `api-web.nhle.com/v1/roster/{TEAM}/{season}` — several 2026 offseason moves look like bugs but are not.
- **Share-card data files** are read at runtime in `lib/og/card-data.js` through literal `new URL(...)` paths so Vercel's file tracing bundles them. A computed path would ship an empty card.
- **vite.config.js mounts both handler styles:** classic `(req, res)` handlers and web-standard `export default { fetch }` (used by `api/og.js`).
- **Instagram publishing** uses the Instagram Login route (`IG_GRAPH_HOST=graph.instagram.com`); Facebook Login for Business demands advanced access to `public_profile`, which needs App Review. `IG_USER_ID` is the app-scoped id from `GET /me`, not the dashboard id — using the dashboard id fails only at `media_publish` ("Media ID is not available"). The token is an Instagram tester token and expires ~60 days after issue.
- **Data licensing:** DF and NHL.com data are fine for the free tier with attribution; get licensing/legal review before putting them behind a paywall.

## Screenshots

Workspace `screenshot.mjs` uses Puppeteer; its bundled Chrome may be missing — pass `executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`.
