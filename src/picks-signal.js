// Team-level matchup signal: which skater position a defense has allowed the most goals to,
// relative to the league average for that position (1.00 = average). Mirrors
// rank_positions() in scraper/picks_log.py — keep the two in sync (parity test in tests/).

export const POSITIONS = ['C', 'LW', 'RW', 'D'];

/**
 * @param {Record<string, number>} teamL10 goals allowed by position over the team's last 10 games
 * @param {Record<string, number> | null | undefined} leagueAvg league mean of the same figure per team
 * @returns {{ position: string, value: number, index: number | null }[]} strongest signal first
 */
export function rankPositions(teamL10 = {}, leagueAvg = null) {
  // Without league averages (older data files) fall back to raw goals allowed.
  const indexed = leagueAvg != null && typeof leagueAvg === 'object';
  return POSITIONS
    .map((position, order) => {
      const value = Number(teamL10?.[position]) || 0;
      const average = Number(leagueAvg?.[position]) || 0;
      return { position, value, index: indexed ? (average > 0 ? value / average : 0) : null, order };
    })
    .sort((a, b) => ((b.index ?? b.value) - (a.index ?? a.value)) || a.order - b.order)
    .map(({ position, value, index }) => ({ position, value, index }));
}

export const formatIndex = index => (index == null ? '—' : `${index.toFixed(2)}×`);
