#!/bin/sh
cd "$(dirname "$0")/../.."
{ echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><base href="../../"></head><body>'
  echo '<script src="dev/ui/errors.js"></script><script src="dev/integ/pre.js"></script>'
  sed 's#<script src="js/ui.js"></script>#<script src="js/ui.js"></script><script src="dev/integ/drive.js"></script>#' orbit-orchard.html
  echo '</body></html>'; } > dev/integ/preview.html
