#!/bin/bash
# usage: shot.sh name "query" [WxH]
cd "$(dirname "$0")"
timeout 90 firefox --headless --screenshot "$PWD/shots/$1.png" --window-size=${3:-1280,800} "file://$PWD/${PAGE:-index.html}?$2" >/dev/null 2>&1
