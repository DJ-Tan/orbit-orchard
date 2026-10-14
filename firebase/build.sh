#!/bin/sh
set -e
cd "$(dirname "$0")"
SRC=..
OUT=public
HTML="$SRC/orbit-orchard.html"
SDK=$(sed -n 's/^ *const SDK = "\(https:[^"]*\)";/\1/p' "$SRC/js/backend-firebase.js")
FONTS=$(grep -o 'https://fonts.googleapis.com/css2[^"]*' "$HTML" | head -1)
fail() { echo "build: $1" >&2; exit 1; }
[ -n "$SDK" ] || fail "SDK url not found in js/backend-firebase.js"
[ -n "$FONTS" ] || fail "Google Fonts link not found"
grep -q '^</style>$' "$HTML" || fail "</style> line not found"
grep -q '^<script src="js/ui.js"></script>$' "$HTML" || fail "ui.js script tag not found"
grep -q '^<script src="js/friends.js"></script>$' "$HTML" || fail "friends.js script tag not found"

rm -rf "$OUT"
mkdir -p "$OUT/js" "$OUT/css"
for f in $(grep -o '\(src\|href\)="\(js\|css\)/[^"]*"' "$HTML" | sed 's/^[a-z]*="//; s/"$//'); do
  mkdir -p "$OUT/$(dirname "$f")"
  cp "$SRC/$f" "$OUT/$f"
done
cp "$SRC/js/firebase-config.js" "$SRC/js/backend-firebase.js" "$SRC/js/friends-web.js" "$OUT/js/"
cp "$SRC/css/web.css" "$OUT/css/"

{
  echo '<!doctype html>'
  echo '<html lang="en">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  echo '<meta name="description" content="Sling seeds through gravity wells and plant a garden on every ringed planet.">'
  echo '<meta name="theme-color" content="#10142a">'
  echo '<link rel="icon" href="data:,">'
  for m in app auth firestore; do echo "<link rel=\"modulepreload\" href=\"${SDK}firebase-$m.js\">"; done
  sed -n '1,/^<\/style>$/p' "$HTML"
  echo '<link rel="stylesheet" href="css/web.css">'
  echo '</head>'
  echo '<body>'
  sed '1,/^<\/style>$/d' "$HTML" | sed 's#^<script src="js/ui.js"></script>$#<script src="js/firebase-config.js"></script>\n<script src="js/backend-firebase.js"></script>\n&#; s#^<script src="js/friends.js"></script>$#&\n<script src="js/friends-web.js"></script>#'
  echo '<script>if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));</script>'
  echo '</body>'
  echo '</html>'
} > "$OUT/index.html"

grep -q '^<script src="js/friends-web.js"></script>$' "$OUT/index.html" || fail "friends-web.js not inserted"
grep -q 'ORCHARD_DEV *=' "$OUT/index.html" "$OUT"/js/*.js && fail "dev flag in the build"
FILES=$(cd "$OUT" && find js css -type f | sort | sed 's/.*/"&"/' | paste -sd, -)
FILES="\"./\",$FILES,\"${SDK}firebase-app.js\",\"${SDK}firebase-auth.js\",\"${SDK}firebase-firestore.js\""
VERSION=$(cd "$OUT" && find . -type f | sort | xargs cat | md5sum | cut -c1-12)
FONTS_ESC=$(printf '%s' "$FONTS" | sed 's/[&#\\]/\\&/g')
sed "s#__VERSION__#$VERSION#; s#__FILES__#[$FILES]#; s#__FONTS__#$FONTS_ESC#" sw.js > "$OUT/sw.js"
echo "built $OUT ($(find "$OUT" -type f | wc -l) files, cache $VERSION)"
