#!/bin/sh
cd "$(dirname "$0")"
mkdir -p shots
P=$(mktemp -d)
timeout 120 firefox --headless --no-remote --profile "$P" --screenshot "$PWD/shots/$1.png" --window-size="$(echo $2 | tr x ,)" "file://$PWD/preview.html?$3" >/dev/null 2>&1
rm -rf "$P"
