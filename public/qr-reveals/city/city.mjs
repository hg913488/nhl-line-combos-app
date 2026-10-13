// Original QR footprint planner. Dimensions are QR module units.
export function seededRandom(text) {
  let s=2166136261;
  for(const c of text)s=Math.imul(s^c.charCodeAt(0),16777619);
  return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};
}
export function assertCoverage(dark,blocks) {
  const n=dark.length,seen=Array.from({length:n},()=>Array(n).fill(0));
  for(const b of blocks)for(let r=b.r;r<b.r+b.d;r++)for(let c=b.c;c<b.c+b.w;c++) {
    if(r<0||c<0||r>=n||c>=n)throw Error('Footprint outside matrix');
    seen[r][c]++;
  }
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(seen[r][c]!==Number(dark[r][c]))throw Error(`Coverage mismatch at ${r},${c}`);
  return true;
}
export function planCity(dark,seed='qr-city') {
  const n=dark.length;
  if(!n||dark.some(row=>row.length!==n))throw Error('Expected square matrix');
  const rand=seededRandom(seed),used=Array.from({length:n},()=>Array(n).fill(false)),blocks=[];
  const fits=(r,c,d,w)=>r+d<=n&&c+w<=n&&Array.from({length:d},(_,i)=>Array.from({length:w},(_,j)=>dark[r+i][c+j]&&!used[r+i][c+j]).every(Boolean)).every(Boolean);
  const take=(r,c,d,w,h,kind)=>{
    for(let i=r;i<r+d;i++)for(let j=c;j<c+w;j++)used[i][j]=true;
    blocks.push({r,c,d,w,h,kind,x:c+w/2-n/2,z:r+d/2-n/2,delay:rand()*.7+Math.hypot(r-n*.4,c-n*.4)/n*.5});
  };
  if(n>=21)for(const[r,c]of[[0,0],[0,n-7],[n-7,0]]) {
    const marker=[[r,c,1,7],[r+6,c,1,7],[r+1,c,5,1],[r+1,c+6,5,1],[r+2,c+2,3,3]];
    if(marker.every(([a,b,d,w])=>fits(a,b,d,w)))marker.forEach(([a,b,d,w],i)=>take(a,b,d,w,i===4?8+rand()*3:.35,i===4?'tower':'wall'));
  }
  for(let r=0;r<n;r++)for(let c=0;c<n;c++) {
    if(!dark[r][c]||used[r][c])continue;
    let w=1,d=1;const wantW=1+Math.floor(rand()*3),wantD=1+Math.floor(rand()*3);
    while(w<wantW&&fits(r,c,d,w+1))w++;
    while(d<wantD&&fits(r,c,d+1,w))d++;
    const center=Math.hypot(r-n*.45,c-n*.45)/n;
    take(r,c,d,w,.7+Math.max(0,1-center)*6*(.5+rand()),'block');
  }
  assertCoverage(dark,blocks);return blocks;
}
