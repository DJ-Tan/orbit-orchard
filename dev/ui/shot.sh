#!/bin/sh
# usage: shot.sh out.png WxH query [page]
cd "$(dirname "$0")"
P=$(mktemp -d)
timeout 100 firefox --headless --no-remote --profile "$P" --screenshot "$PWD/$1" --window-size="$2" "file://$PWD/${4:-preview.html}?$3" >/dev/null 2>&1
rm -rf "$P"
ls -la "$1"
