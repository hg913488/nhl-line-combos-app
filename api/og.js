// Share-card renderer.
//   /api/og?type=page&card=team&team=edmonton-oilers   -> 1200x630 PNG
//   /api/og?type=ig&card=slate&format=jpg              -> 1080x1350 baseline JPEG
// Satori lays the card out and resvg rasterises it (see lib/og/render.js).
import { PAGE, PORTRAIT } from '../lib/og/theme.js';
import { renderCard } from '../lib/og/render.js';
import { pageCard } from '../lib/og/page-cards.js';
import { igCard } from '../lib/og/ig-cards.js';

export const config = { runtime: 'nodejs', maxDuration: 30 };

const CACHE = {
  page: 'public, s-maxage=86400, stale-while-revalidate=604800',
  ig: 'public, s-maxage=600, stale-while-revalidate=1800',
};

async function handle(request) {
  const params = new URL(request.url).searchParams;
  const type = params.get('type') === 'ig' ? 'ig' : 'page';
  const format = params.get('format') === 'jpg' ? 'jpg' : 'png';
  const size = type === 'ig' ? PORTRAIT : PAGE;
  const element = type === 'ig' ? await igCard(params) : await pageCard(params);
  const { body, contentType } = await renderCard(element, { ...size, format });

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': CACHE[type],
      'content-length': String(body.length),
    },
  });
}

export default {
  async fetch(request) {
    try {
      return await handle(request);
    } catch (error) {
      console.error('og render failed', error);
      return new Response('Could not render the share card.', {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
  },
};
