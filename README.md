# Between the Lines

> Daily NHL line combinations, injuries, and player stats — updated automatically throughout the day.

**[nhl-between-the-lines-app.vercel.app](https://nhl-between-the-lines-app.vercel.app)**

---

## What it does

| Page | URL | What you get |
|------|-----|-------------|
| **Tonight** | `/` | Every game today: goalie duel, the day's line moves, the matchup signal, live score |
| **Game center** | `/games/2026020001` | Live score and clock, shot map on a rink, goal timeline, team stats |
| **Teams** | `/teams`, `/teams/edmonton-oilers` | Quick scan of all 32 lineups, or one team in full |
| **Compare** | `/compare?teams=edmonton-oilers,vancouver-canucks` | Up to 10 lineups side by side |
| **News** | `/news`, `/reporters` | NHL.com stories and a curated reporters feed |
| **Line Moves** | `/line-moves` | Promotions, demotions, PP changes and scratches between refreshes |
| **Injuries** | `/injuries` | League-wide injury report |
| **Stats** | `/players`, `/matchups`, `/playoffs` | Player search with game logs, momentum and NHL EDGE; goals against by position; playoff bracket |
| **Picks** | `/picks` | Matchup signals plus a player sheet: role, PP unit, last-10 form, opponent softness, opposing goalie |

Every page has its own URL and its own share preview, so any view can be linked, bookmarked or posted. Click any player for game-by-game stats.

Dark/light mode. Fully responsive.

---

## The matchup signal

For each defense, goals allowed to each skater position over its **last 10 games** are divided by the league average for that position. An index of 1.00 is average; 1.25 means that defense gives up 25% more goals to that position than a typical team. Ranking by index rather than raw goals stops centers — who score most everywhere — from always winning.

Every signal is written to `data/picks_log.json` before puck drop and graded after the game, building a public track record.

---

## How data stays fresh

Python scrapers in this repository run on a GitHub Actions schedule and commit refreshed JSON to `data/`. Those commits trigger a Vercel redeploy.

```
Update NHL Line Combos (6x/day, timed for morning skates and warmups)
  └── scrape_lines.py           → data/lines.json
  └── lineup_history.py         → data/lineup_changes.json      (Line Moves)
  └── scrape_goalies.py         → data/goalies.json
  └── scrape_playoff_bracket.py → data/playoff_bracket.json
  └── picks_log.py log|grade    → data/picks_log.json           (track record)
  └── build_prop_sheet.py       → data/prop_sheet.json          (player sheet)

Update Goals Against by Position (daily, early morning ET)
  └── scrape_goals_against.py   → data/goals_against_by_position.json

Post Instagram Cards (daily afternoon ET, dry-run until secrets are set)
  └── scripts/instagram-post.mjs → /api/og cards → Instagram carousel
```

Cron minutes sit off the top of the hour, where GitHub delays scheduled runs. Both data workflows share one publishing queue so simultaneous runs cannot race.

Live scores, schedule, player stats and game-center data are fetched through `api/` at view time and cached.

---

## Stack

- **React 18** + **Vite 7** — no UI framework, no router library (URL handling lives in `src/routes.js`)
- **Vercel** — hosting, serverless functions in `api/`, Routing Middleware for per-page share metadata, Web Analytics
- **Satori + resvg** — share cards and Instagram cards rendered on demand at `/api/og`
- **NHL API** + **Daily Faceoff** + **ESPN** — data sources
- **Syne** / **Space Grotesk** / **Space Mono** — typography

---

## Local dev

```bash
npm install
npm run dev       # → http://localhost:5173
npm run build
npm run preview
npm test                                              # JavaScript tests
python3 -m unittest discover -s tests -p 'test_*.py'  # scraper tests
```

---

## Instagram automation

`scripts/instagram-post.mjs` builds a carousel from `/api/og` cards and posts it through the Instagram Graph API.

```bash
node scripts/instagram-post.mjs                 # dry run: saves cards to ig-cards/, prints the caption
IG_PUBLISH=true node scripts/instagram-post.mjs # publishes
```

Publishing needs a professional Instagram account and these repository secrets: `IG_USER_ID`, `IG_ACCESS_TOKEN`. Set the `IG_PUBLISH` repository variable to `true` to enable the daily schedule; `SITE_ORIGIN` overrides the site URL used for card links.

---

## Data sources

Line combinations via [Daily Faceoff](https://www.dailyfaceoff.com). Live stats via [NHL.com](https://www.nhl.com).

---

*Built by [Himank Goel](https://goelstudio.ca)*
