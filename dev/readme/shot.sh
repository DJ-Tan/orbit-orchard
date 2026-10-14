#!/bin/sh
# usage: shot.sh NAME WxH "QUERY"
cd "$(dirname "$0")"
mkdir -p shots
P=$(mktemp -d)
cp ../friends/user.js "$P/user.js"
flock /tmp/claude-1020/ff.lock timeout ${FTIME:-150} firefox --headless --no-remote --profile "$P" --screenshot "$PWD/shots/$1.png" --window-size="$(echo $2 | tr x ,)" "http://127.0.0.1:${FPORT:-8765}/dev/readme/shots/preview.html?$3" > "shots/$1.log" 2>&1
rm -rf "$P"
grep -a 'console\.\(log\|warn\|error\)' "shots/$1.log" | grep -a '\[t\]\|\[ERR\]' | sed 's/^console\.[a-z]*: //'
