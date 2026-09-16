import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import gamelog from './api/gamelog.js'
import standings from './api/standings.js'
import roster from './api/roster.js'
import playoffSchedule from './api/playoff-schedule.js'
import playoffBracket from './api/playoff-bracket.js'
import schedule from './api/schedule.js'
import news from './api/news.js'
import playerSearch from './api/player-search.js'
import playerMomentum from './api/player-momentum.js'
import playerEdge from './api/player-edge.js'

// Run the same public-data handlers locally that Vercel serves in production.
function localApi() {
  const routes = { '/api/gamelog': gamelog, '/api/standings': standings, '/api/roster': roster,
    '/api/playoff-schedule': playoffSchedule, '/api/playoff-bracket': playoffBracket, '/api/schedule': schedule, '/api/news': news,
    '/api/player-search': playerSearch, '/api/player-momentum': playerMomentum, '/api/player-edge': playerEdge };
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const handler = routes[url.pathname];
        if (!handler) return next();
        req.query = Object.fromEntries(url.searchParams);
        res.status = code => { res.statusCode = code; return res; };
        res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
        try { await handler(req, res); }
        catch { if (!res.writableEnded) res.status(500).json({ error: 'API request failed' }); }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  css: { postcss: { plugins: [] } },
})
