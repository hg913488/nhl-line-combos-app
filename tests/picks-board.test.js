import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyMatchups,matchingScorers,pickReason} from '../src/picks-board.js';
test('daily board groups saved sides without reconstructing past choices',()=>{
 const picks=[{game_id:1,date:'2026-10-08',start_time_utc:'2026-10-08T20:00Z',venue:'away',offense:'VAN',defense:'TOR',watch:'D'},{game_id:1,date:'2026-10-08',start_time_utc:'2026-10-08T20:00Z',venue:'home',offense:'TOR',defense:'VAN',watch:'C'},{game_id:2,date:'2026-10-09'}];
 const groups=dailyMatchups(picks,'2026-10-08');assert.equal(groups.length,1);assert.equal(groups[0].away,'VAN');assert.equal(groups[0].home,'TOR');assert.equal(groups[0].picks[0].watch,'D');assert.equal(dailyMatchups(picks,'2026-10-01').length,0);
});
test('scorer enrichment only matches selected team and verified position',()=>{
 const pick={offense:'VAN',watch:'D',season:20262027};const game={goals:[{team:'VAN',scorerId:1,scorer:'A',scorerPosition:'D'},{team:'VAN',scorerId:1,scorer:'A',scorerPosition:'D'},{team:'TOR',scorerId:2,scorerPosition:'D'},{team:'VAN',scorerId:3,scorerPosition:'C'}]};
 const result=matchingScorers(pick,game);assert.equal(result.length,1);assert.equal(result[0].goals,2);assert.equal(matchingScorers(pick,null).length,0);
});
test('below-average legacy picks do not claim elevated scoring allowed',()=>{
 assert.match(pickReason({watch:'D',defense:'TOR',index:{D:.8}}),/Below-average/);
 assert.match(pickReason({watch:'D',defense:'TOR',index:{D:1.5}}),/50% more/);
});
