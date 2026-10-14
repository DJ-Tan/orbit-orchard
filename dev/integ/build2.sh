#!/bin/sh
cd "$(dirname "$0")"
sh build.sh
sed 's#<script src="dev/integ/drive.js"></script>#<script src="dev/integ/drive.js"></script><script src="dev/integ/drive2.js"></script>#' preview.html > preview2.html
