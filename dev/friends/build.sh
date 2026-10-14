#!/bin/sh
cd "$(dirname "$0")/../.."
{ echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><base href="../../"></head><body>'
  echo '<script src="dev/friends/pre.js"></script><script src="dev/friends/rules.js"></script><script src="dev/friends/mock-claude.js"></script>'
  sed 's#<script src="js/friends.js"></script>#<script src="js/friends.js"></script><script src="dev/friends/drive.js"></script>#' orbit-orchard.html
  echo '</body></html>'; } > dev/friends/preview.html
grep -q 'dev/friends/drive.js' dev/friends/preview.html || echo "build: friends.js script tag not found" >&2
