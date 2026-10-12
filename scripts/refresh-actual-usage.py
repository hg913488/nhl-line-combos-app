from pathlib import Path
import sqlite3,json,gzip,sys,argparse
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from scraper.analyze_linemates import analyze
parser=argparse.ArgumentParser(description='Build all-strengths actual usage from a local captured NHL archive; never infer 5v5.')
parser.add_argument('--archive',type=Path,required=True)
parser.add_argument('--output',type=Path,default=ROOT/'data/actual_usage.json')
args=parser.parse_args()
archive=args.archive
db=sqlite3.connect('file:'+str(archive/'hockey.sqlite')+'?mode=ro&immutable=1',uri=True)
rows=db.execute("select source,path,captured_at from snapshots where source like '%shiftcharts%' order by captured_at desc limit 500").fetchall()
teams={};seen=set()
for url,path,capture in rows:
 gid=int(url.split('gameId=')[1].split('&')[0])
 if gid in seen:continue
 seen.add(gid)
 boxrow=db.execute("select path,captured_at,source from snapshots where source=? order by captured_at desc limit 1",(f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore',)).fetchone()
 if not boxrow:continue
 box=json.loads(gzip.decompress((archive/boxrow[0]).read_bytes()))
 if box.get('gameState') not in ['OFF','FINAL']:continue
 shifts=json.loads(gzip.decompress((archive/path).read_bytes()))
 result=analyze(shifts,boxscore=box)
 players={}
 for side in ['awayTeam','homeTeam']:
  abbr=box[side]['abbrev']
  for group in ['forwards','defense']:
   for p in box.get('playerByGameStats',{}).get(side,{}).get(group,[]):
    name=p.get('name',{}).get('default','');first,*last=name.split()
    players[str(p['playerId'])]={'id':p['playerId'],'name':name,'firstName':first,'lastName':' '.join(last),'position':p.get('position'),'team':abbr}
 for side,opposite in [('awayTeam','homeTeam'),('homeTeam','awayTeam')]:
  abbr=box[side]['abbrev'];date=box.get('gameDate','')
  if abbr in teams and teams[abbr]['date']>=date:continue
  teamplayers=[]
  for pid,p in players.items():
   if p['team']!=abbr:continue
   paired=[pair for pair in result['pairs'] if pair['team']==abbr and pid in pair['playerIds']]
   mates=[]
   for pair in paired[:3]:
    other=next(x for x in pair['playerIds'] if x!=pid)
    if other in players:mates.append({**players[other],'sharedSeconds':pair['sharedSeconds']})
   if mates:teamplayers.append({**p,'linemates':mates})
  teams[abbr]={'date':date,'gameId':gid,'opponent':box[opposite]['abbrev'],'season':box.get('season'),'capturedAt':capture,'source':url,'boxscoreSource':boxrow[2],'sample':result['sample'],'players':teamplayers}
 if len(teams)==32:break
args.output.write_text(json.dumps({'strength':'all-strengths','teams':teams},separators=(',',':'))+'\n')
print('Built actual usage for',len(teams),'teams from archived final games.')
