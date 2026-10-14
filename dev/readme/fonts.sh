#!/bin/sh
# Downloads the game's Google Fonts into shots/fonts.
cd "$(dirname "$0")"
mkdir -p shots/fonts
URL=$(grep -o 'https://fonts.googleapis.com/css2[^"]*' ../../orbit-orchard.html | head -1)
curl -s -m 20 -A "Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0" "$URL" > shots/fonts/google.css
python3 - <<'PY'
import re, subprocess
css = open("shots/fonts/google.css").read()
for i, u in enumerate(sorted(set(re.findall(r"https://fonts\.gstatic\.com[^)]*", css)))):
    subprocess.run(["curl", "-s", "-m", "30", "-o", "shots/fonts/f%d.woff2" % i, u], check=True)
    css = css.replace(u, "f%d.woff2" % i)
open("shots/fonts/fonts.css", "w").write(css)
PY
