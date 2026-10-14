#!/bin/bash
cd /data2/tjunheng/Desktop-Materials/test/random-claude-task-1
LV="${@:-$(seq 0 21)}"
for i in $LV; do node dev/w4/solve.js js/levels/w4.js --level $i 2>&1 | grep -E '^\[' > dev/w4/out.$i & done
wait
for i in $LV; do cat dev/w4/out.$i; done
