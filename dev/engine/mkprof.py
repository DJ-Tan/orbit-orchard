import re
s=open('../../js/game.js').read()
start=s.index('  function draw() {'); end=s.index('  function frame(t) {')
body=s[start:end]
body2=re.sub(r'\b(draw[A-Za-z]+)\(\);',lambda m:'{T0=performance.now();%s();PROF["%s"]=(PROF["%s"]||0)+performance.now()-T0;}'%((m.group(1),)*3),body)
body2=body2.replace('  function draw() {','  function draw() { let T0;',1)
s2=s[:start]+body2+s[end:]
s2=s2.replace('function update(dt) {','function update(dt) { const U0=performance.now(); try { return update_(dt); } finally { PROF.update=(PROF.update||0)+performance.now()-U0; } }\n  function update_(dt) {',1)
open('game.prof.js','w').write('window.PROF={};\n'+s2)
