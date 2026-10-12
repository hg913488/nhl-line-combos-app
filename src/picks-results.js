export const PICK_POSITIONS = ['C', 'LW', 'RW', 'D'];
export function pickStatus(pick) {
  if (pick.status === 'void') return 'void';
  if (pick.status === 'review') return 'review';
  if (pick.status !== 'graded') return 'pending';
  if (!PICK_POSITIONS.includes(pick.watch)) return 'review';
  const result = pick.result;
  if (!result || result.score_reconciled !== true || typeof result.hit !== 'boolean') return 'review';
  const goals = result.goals_by_position;
  if (!goals || !PICK_POSITIONS.every(pos => Number.isInteger(goals[pos]) && goals[pos] >= 0)
    || result.hit !== (goals[pick.watch] > 0)) return 'review';
  return result.hit ? 'hit' : 'miss';
}
export function pickPerformance(picks) {
  const settled = picks.filter(p => ['hit', 'miss'].includes(pickStatus(p)));
  const hits = settled.filter(p => pickStatus(p) === 'hit').length;
  const rate = values => values.length ? values.filter(p => pickStatus(p) === 'hit').length / values.length : null;
  return { settled: settled.length, hits, hitRate: rate(settled),
    randomRate: settled.length ? settled.reduce((sum, p) => sum + PICK_POSITIONS.filter(pos => p.result.goals_by_position[pos] > 0).length / 4, 0) / settled.length : null,
    centerRate: settled.length ? settled.filter(p => p.result.goals_by_position.C > 0).length / settled.length : null,
    byPosition: PICK_POSITIONS.map(position => { const rows = settled.filter(p => p.watch === position); return { position, settled: rows.length, hits: rows.filter(p => pickStatus(p) === 'hit').length, hitRate: rate(rows), baseline: settled.length ? settled.filter(p => p.result.goals_by_position[position] > 0).length / settled.length : null }; }),
    pending: picks.filter(p => pickStatus(p) === 'pending').length,
    review: picks.filter(p => pickStatus(p) === 'review').length,
    void: picks.filter(p => pickStatus(p) === 'void').length };
}
export const formatPickRate = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
