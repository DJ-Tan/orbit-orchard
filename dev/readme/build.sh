#!/bin/sh
cd "$(dirname "$0")/../.."
mkdir -p dev/readme/shots
FONTS='s#^##'
[ -f dev/readme/shots/fonts/fonts.css ] && FONTS='s#<link rel="stylesheet" href="https://fonts.googleapis.com/[^"]*">#<link rel="stylesheet" href="dev/readme/shots/fonts/fonts.css">#'
{ echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><base href="../../../"></head><body>'
  echo '<script src="dev/friends/pre.js"></script><script src="dev/friends/rules.js"></script><script src="dev/friends/mock-claude.js"></script>'
  sed -e "$FONTS" \
      -e 's#<script src="js/solutions.js"></script>#<script src="js/solutions.js"></script><script src="dev/readme/save.js"></script>#' \
      -e 's#<script src="js/friends.js"></script>#<script src="js/friends.js"></script><script src="dev/readme/drive.js"></script>#' orbit-orchard.html
  echo '</body></html>'; } > dev/readme/shots/preview.html
grep -q 'dev/readme/save.js' dev/readme/shots/preview.html && grep -q 'dev/readme/drive.js' dev/readme/shots/preview.html || echo "build: script tags not found" >&2
