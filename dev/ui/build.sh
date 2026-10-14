#!/bin/sh
cd "$(dirname "$0")/../.."
wrap() {
  echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><base href="../../"></head><body>'
  echo '<script src="dev/ui/errors.js"></script>'; cat
  echo '</body></html>'
}
sed 's#<script src="js/ui.js"></script>#<script src="js/ui.js"></script><script src="dev/ui/drive.js"></script>#' orbit-orchard.html | wrap > dev/ui/preview.html
sed -e 's#<script src="js/game.js"></script>#<script src="dev/ui/stub.js"></script>#' -e 's#<script src="js/ui.js"></script>#<script src="js/ui.js"></script><script src="dev/ui/drive.js"></script>#' orbit-orchard.html | wrap > dev/ui/preview-stub.html
