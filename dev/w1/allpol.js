// node dev/w1/allpol.js N : count single shots that collect all pollen and plant
global.window = global;
const Sim = require("../../js/sim.js");
global.ORCHARD_WORLDS = [];
require("../../js/levels/w1.js");
const lv = ORCHARD_WORLDS[0].levels[+process.argv[2]];
let n=0, ex=[];
for (let a=0;a<360;a+=0.5) for (let p=0.1;p<=1.0001;p+=0.01){
  const got=lv.pollen.map(()=>false);
  const r=Sim.simulateShot(lv,a*Math.PI/180,p,0,Sim.FLIGHT_MAX,got);
  if(r.end&&r.end.type==="plant"&&got.every(Boolean)){n++; if(ex.length<6)ex.push(a+"/"+p.toFixed(2)+"->"+r.end.i);}
}
console.log(lv.id,"all-pollen+plant shots:",n,ex.join(" "));
