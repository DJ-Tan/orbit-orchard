// node dev/w1/probe.js N : per-fertile hit %, angle ranges, pollen counts, end-type histogram
global.window = global;
const Sim = require("../../js/sim.js");
global.ORCHARD_WORLDS = [];
require("../../js/levels/w1.js");
const idx = +process.argv[2];
const lv = ORCHARD_WORLDS[0].levels[idx];
const fert = lv.bodies.map((b,i)=>b.kind==="fertile"?i:-1).filter(i=>i>=0);
const hits = {}, angs = {}, samp = {}; fert.forEach(i=>{hits[i]=0;angs[i]=new Set();samp[i]=[];});
const ends = {}; const pol=(lv.pollen||[]).map(()=>0); let total=0;
const polShots=(lv.pollen||[]).map(()=>[]);
for (let a=0;a<360;a+=1.5) for (let p=0.1;p<=1.0001;p+=0.035){ total++;
  const got=(lv.pollen||[]).map(()=>false);
  const r=Sim.simulateShot(lv,a*Math.PI/180,p,0,Sim.FLIGHT_MAX,got);
  got.forEach((g,k)=>{if(g){pol[k]++; if(r.end&&r.end.type==="plant") polShots[k].push(a+"/"+p.toFixed(2)+"->"+r.end.i);}});
  const t=r.end?r.end.type:"none"; ends[t]=(ends[t]||0)+1;
  if(t==="plant"){hits[r.end.i]++;angs[r.end.i].add(Math.round(a));samp[r.end.i].push(a+"/"+p.toFixed(3)+"/t"+r.seed.t.toFixed(1));}
}
console.log(lv.id, lv.name);
fert.forEach(i=>{const s=[...angs[i]].sort((x,y)=>x-y);if(process.argv[3])console.log("   ",samp[i].filter((_,k)=>k%Math.ceil(samp[i].length/12)===0).join(" "));console.log(" #"+i,(100*hits[i]/total).toFixed(2)+"%","angles:",s.length?compress(s):"-");});
console.log(" ends",JSON.stringify(ends)," pollen",pol.join(","));
polShots.forEach((s,k)=>console.log(" pollen",k,"with plant:",s.length,s.slice(0,4).join(" ")));
function compress(s){const out=[];let st=s[0],pr=s[0];for(let k=1;k<=s.length;k++){if(s[k]!==undefined&&s[k]-pr<=2){pr=s[k];continue;}out.push(st===pr?""+st:st+"-"+pr);st=s[k];pr=s[k];}return out.join(",");}
