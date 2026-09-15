# Between the Lines

> Daily NHL line combinations, injuries, and player stats — updated automatically throughout the day.

**[nhl-between-the-lines-app.vercel.app](https://nhl-between-the-lines-app.vercel.app)**

---

## What it does

Six views, zero fuss:

| Tab | What you get |
|-----|-------------|
| **All Teams** | Every NHL team's forward lines, defense pairs, and PP units side by side |
| **Today** | Teams playing tonight with their current lines |
| **Stats** | Goals against by position — sortable, filterable by conference/division |
| **Injuries** | League-wide injury report at a glance |
| **Player Stats** | Search any player → last 5 games, season totals, recent form |
| **Compare** | Pick two or more teams and compare their lineups head to head |

Click any player name to pull up a stat modal with their last 5 games from the NHL API.

Dark/light mode. Fully responsive.

---

## How data stays fresh

Python scrapers in this repository run on a GitHub Actions schedule and commit refreshed JSON directly to `data/`. Those data commits trigger a Vercel redeploy without requiring a cross-repository access token.

```
GitHub Actions (5x/day)
  └── scrape_lines.py        → data/lines.json
  └── scrape_goalies.py      → data/goalies.json
  └── scrape_goals_against.py → data/goals_against_by_position.json
```

The lineup and goals-against workflows share one publishing queue so simultaneous runs cannot race when committing data.

Live player stats (gamelog, season totals) are fetched client-side from the NHL API at click time and cached in `sessionStorage`.

---

## Stack

- **React 18** + **Vite 5** — no UI framework, all styles inline
- **Vercel** — hosting + serverless API routes (`/api/gamelog`, `/api/standings`)
- **NHL API** + **Daily Faceoff** — data sources
- **Space Grotesk** / **Space Mono** — typography

---

## Local dev

```bash
npm install
npm run dev       # → http://localhost:5173
npm run build
npm run preview
```

---

## Data sources

Line combinations via [Daily Faceoff](https://www.dailyfaceoff.com). Live stats via [NHL.com](https://www.nhl.com).

---

*Built by [Himank Goel](https://goelstudio.ca)*
