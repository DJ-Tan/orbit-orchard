#!/bin/sh
set -e
cd "$(dirname "$0")"
sh ../../firebase/build.sh
rm -rf site
cp -r ../../firebase/public site
sed -i 's#^<meta charset="utf-8">$#&\n<script src="../errors.js"></script>#; s#^<script src="js/ui.js"></script>$#&\n<script src="../drive.js"></script>#' site/index.html
grep -q '../drive.js' site/index.html && grep -q '../errors.js' site/index.html || { echo "build: driver not injected" >&2; exit 1; }
rm -rf site-nosdk
cp -r site site-nosdk
sed -i 's#https://www.gstatic.com/firebasejs/#http://127.0.0.1:9/firebasejs/#g' site-nosdk/index.html site-nosdk/js/backend-firebase.js
