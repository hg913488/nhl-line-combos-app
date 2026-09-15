import { load } from 'cheerio';

const NEWS_URL = 'https://www.nhl.com/news/';

export function parseNewsHtml(html) {
  const $ = load(html);
  const seen = new Set();
  const stories = [];

  $('a.nhl-c-card-wrap.-story').each((_, element) => {
    const card = $(element);
    const href = card.attr('href')?.trim();
    const title = card.find('.fa-text__title').first().text().trim();
    if (!href || !title) return;

    const url = new URL(href, NEWS_URL);
    if (url.hostname !== 'www.nhl.com' || !url.pathname.startsWith('/news/')) return;
    if (seen.has(url.href)) return;

    const image = card.find('img').first().attr('src')?.trim() || null;
    seen.add(url.href);
    stories.push({
      title,
      summary: card.find('.fa-text__body').first().text().replace(/\s+/g, ' ').trim() || null,
      publishedAt: card.find('time').first().attr('datetime') || null,
      image: image?.startsWith('https://media.d3.nhle.com/') ? image : null,
      url: url.href,
    });
  });

  return stories.slice(0, 18);
}

export default async function handler(_req, res) {
  try {
    const response = await fetch(NEWS_URL, {
      headers: { 'User-Agent': 'BetweenTheLines/1.0 (+https://www.nhl.com)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return res.status(502).json({ error: 'NHL News is temporarily unavailable' });

    const stories = parseNewsHtml(await response.text());
    if (!stories.length) throw new Error('No stories found');

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({ stories, source: 'NHL.com' });
  } catch {
    return res.status(502).json({ error: 'Could not load NHL News. Please try again.' });
  }
}
