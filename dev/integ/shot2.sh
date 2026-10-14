#!/bin/sh
cd "$(dirname "$0")"
mkdir -p shots
P=$(mktemp -d)
echo 'user_pref("devtools.console.stdout.content", true);' > $P/user.js
timeout 120 firefox --headless --no-remote --profile "$P" --screenshot "$PWD/shots/$1.png" --window-size="$(echo $2 | tr x ,)" "file://$PWD/preview2.html?sc=hub&$3" 2>&1 | grep -E "\[drive\]|Error"
rm -rf "$P"
