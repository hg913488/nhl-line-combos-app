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
import game from './api/game.js'
import og from './api/og.js'

// Run the same public-data handlers locally that Vercel serves in production.
function localApi() {
  const routes = { '/api/gamelog': gamelog, '/api/standings': standings, '/api/roster': roster,
    '/api/playoff-schedule': playoffSchedule, '/api/playoff-bracket': playoffBracket, '/api/schedule': schedule, '/api/news': news,
    '/api/player-search': playerSearch, '/api/player-momentum': playerMomentum, '/api/player-edge': playerEdge, '/api/game': game, '/api/og': og };
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const handler = routes[url.pathname];
        if (!handler) return next();
        // Web-standard handlers (export default { fetch }) such as /api/og.
        if (typeof handler.fetch === 'function') {
          const response = await handler.fetch(new Request(`http://localhost${req.url}`, { method: req.method }));
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
          return;
        }
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
