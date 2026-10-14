// node dev/w1/path.js N angDeg pow : print path every 0.25s and end event
global.window = global;
const Sim = require("../../js/sim.js");
global.ORCHARD_WORLDS = [];
require("../../js/levels/w1.js");
const lv = ORCHARD_WORLDS[0].levels[+process.argv[2]];
const s = Sim.newSeed(lv, +process.argv[3]*Math.PI/180, +process.argv[4]);
let T=0, out=[], got=(lv.pollen||[]).map(()=>false);
for (let i=0;i<14/Sim.DT;i++){T+=Sim.DT;const ev=Sim.stepSeed(lv,s,T,Sim.DT,got);
 if(i%30===0) out.push(Math.round(s.x)+","+Math.round(s.y));
 if(ev){ if(ev.type==="pollen"){got[ev.k]=true;out.push("POLLEN"+ev.k);continue;} out.push(ev.type+(ev.i!=null?ev.i:"")+" t="+s.t.toFixed(2)); if(Sim.TERMINAL[ev.type])break;}}
console.log(out.join(" "));
