#!/bin/sh
# usage: run.sh NAME WxH PAGE TAG
cd "$(dirname "$0")"
for i in 1 2 3 4; do
  FTIME=${FTIME:-300} ./shot.sh "$1" "$2" "" "$3" > /dev/null
  grep -aq "\[t\] $4 \(PASS [0-9]* checks\|FAIL [0-9]* of [0-9]*\)" "shots/$1.log" && break
  echo "run $i ended before the summary, retrying" >&2
done
grep -a "\[t\] $4 " "shots/$1.log" | sed 's/^console\.[a-z]*: "//; s/"$//'
